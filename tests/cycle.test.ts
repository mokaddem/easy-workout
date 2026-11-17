import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import type { MaxTest, Profile, Programme } from '../src/domain';
import {
  cycleReview,
  generateProgramme,
  harderVariantFor,
  isMainLift,
  nextCycle,
  testExerciseFor,
  type CycleContext,
} from '../src/engine';
import { referenceEquipment } from './fixtures/reference-equipment';
import { compliant, simulate } from './support/simulate';

const profile: Profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 6,
  sessionMinutes: 60,
  bodyweightKg: 78,
};
const programme: Programme = generateProgramme({ profile, equipment: referenceEquipment });
const sessions = programme.sessionsPerWeek * programme.weeks;
const sim = simulate(programme, referenceEquipment, compliant({ headroom: 0.5, seed: 3 }), {
  profile,
  sessions,
});
const last = sim.logs[sim.logs.length - 1]!;

const ctx = (extra: Partial<CycleContext> = {}): CycleContext => ({
  logs: sim.logs,
  programmes: [programme],
  answers: [],
  maxTests: [],
  checkIns: [],
  level: 'intermediate',
  bodyweightKg: 78,
  until: last.endedAt ?? last.startedAt,
  ...extra,
});

describe('cycle review', () => {
  const review = cycleReview(programme, ctx());

  it('counts the sessions as the rotation ran them', () => {
    expect(review.sessions.planned).toBe(sessions);
    expect(review.sessions.counted).toBe(sessions);
    expect(review.sessions.inFull).toBeLessThanOrEqual(review.sessions.counted);
    const span = Date.parse(review.sessions.last!) - Date.parse(review.sessions.first!);
    expect(review.sessions.weeksTaken).toBe(Math.ceil((span + 86_400_000) / (7 * 86_400_000)));
    expect(review.sessions.mainSets).toBeGreaterThan(0);
  });

  it('compares up to six main lifts from after calibration to the last training weeks', () => {
    expect(review.lifts.length).toBeGreaterThan(0);
    expect(review.lifts.length).toBeLessThanOrEqual(6);
    for (const lift of review.lifts) {
      expect(isMainLift(exerciseById.get(lift.end!.exerciseId)!)).toBe(true);
      expect(lift.start!.at < lift.end!.at).toBe(true);
      // Never a week-1 estimate for the start.
      const startLog = sim.logs.find((l) => l.startedAt === lift.start!.at)!;
      expect(startLog.source.kind === 'programme' && startLog.source.week).toBeGreaterThan(1);
    }
    expect(review.counts.progressed + review.counts.held + review.counts.atMax).toBe(
      review.lifts.length,
    );
    // A compliant trainee gets stronger over eight weeks.
    expect(review.counts.progressed).toBeGreaterThan(0);
    const weighted = review.lifts.filter((l) => l.percent !== undefined);
    expect(weighted.length).toBeGreaterThan(0);
    for (const l of weighted) expect(l.end!.value).toBeLessThanOrEqual(12);
  });

  it('plans the cardio of every week and reads what was logged', () => {
    expect(review.cardio.plannedMin).toBeGreaterThan(0);
    expect(review.cardio.doneMin).toBeGreaterThan(0);
  });

  it('shows the test against the previous one of the same kind', () => {
    const test = (id: string, at: string, reps: number, programmeId?: string): MaxTest => ({
      id,
      date: at.slice(0, 10),
      at,
      exerciseId: 'push-up',
      context: 'session',
      ...(programmeId && { programmeId }),
      result: { kind: 'reps', reps },
    });
    const earlier = test('a', '2020-01-01T10:00:00.000Z', 18);
    const now = test('b', last.startedAt, 24, programme.id);
    const fresh = { ...test('c', '2020-06-01T10:00:00.000Z', 30), context: 'fresh' as const };
    const out = cycleReview(programme, ctx({ maxTests: [earlier, fresh, now] }));
    expect(out.test?.current.id).toBe('b');
    expect(out.test?.previous?.id).toBe('a');
  });

  it('offers intermediate only to beginners and returning trainees who earned it', () => {
    expect(review.levelUp).toBe(false);
    const returning = cycleReview(programme, ctx({ level: 'returning' }));
    expect(returning.levelUp).toBe(
      returning.sessions.inFull >= 0.75 * sessions &&
        returning.sessions.weeksTaken <= 10 &&
        returning.counts.progressed >= (2 / 3) * returning.lifts.length,
    );
    const patchy = cycleReview(programme, ctx({ level: 'returning', logs: sim.logs.slice(0, 20) }));
    expect(patchy.levelUp).toBe(false);
  });

  it('offers the check-in weight only past 2 kg from the profile', () => {
    const checkIn = (date: string, weightKg: number) => ({ id: date, date, weightKg });
    const far = cycleReview(
      programme,
      ctx({ checkIns: [checkIn('2026-01-01', 75.5), checkIn('2026-01-08', 75.5)] }),
    );
    expect(far.bodyweight).toEqual({ kg: 75.5, differenceKg: -2.5 });
    const near = cycleReview(programme, ctx({ checkIns: [checkIn('2026-01-01', 77)] }));
    expect(near.bodyweight).toBeUndefined();
  });
});

describe('next cycle', () => {
  const progress = {
    logs: sim.logs,
    programmes: [programme],
    answers: [],
    inventory: referenceEquipment,
    profile,
    now: new Date(Date.parse(last.startedAt) + 86_400_000),
  };
  const next = nextCycle({ previous: programme, profile, equipment: referenceEquipment, progress });

  it('is the next cycle, with a new seed and the same split', () => {
    expect(next.cycle).toBe(2);
    expect(next.programme.generation?.cycle).toBe(2);
    expect(next.programme.generation?.seed).toBe(1);
    expect(next.splitChanged).toBe(false);
    expect(next.newGoal).toBe(false);
  });

  it('keeps the main lifts unless upgraded, and rotates some accessories', () => {
    const upgraded = new Set(next.upgrades.map((u) => u.from));
    const lead = (p: Programme) =>
      p.rotation.map((s) => (s.main[0]?.type === 'straight' ? s.main[0].item.exerciseId : ''));
    lead(programme).forEach((id, i) => {
      if (!upgraded.has(id)) expect(lead(next.programme)[i]).toBe(id);
    });
    expect(next.changes.length).toBeGreaterThan(0);
  });

  it('upgrades only where the slot takes the harder variant, and honours an opt-out', () => {
    for (const u of next.upgrades) {
      const from = exerciseById.get(u.from)!;
      const to = exerciseById.get(u.to)!;
      expect(to.pattern).toBe(from.pattern);
      expect(to.difficulty).toBeLessThanOrEqual(from.difficulty + 1);
      expect(to.tags.includes('plyometric') || to.tags.includes('ballistic')).toBe(false);
    }
    const first = next.upgrades[0];
    if (first) {
      const declined = nextCycle({
        previous: programme,
        profile,
        equipment: referenceEquipment,
        progress,
        declined: new Set([first.from]),
      });
      const ids = declined.programme.rotation.flatMap((s) =>
        s.main
          .flatMap((b) => (b.type === 'straight' ? [b.item] : b.items))
          .map((i) => i.exerciseId),
      );
      expect(ids).not.toContain(first.to);
    }
  });

  it('keeps its own rotation when regenerated, and still tests', () => {
    expect(
      testExerciseFor(next.programme, next.programme.weeks, {
        ...progress,
        maxTests: [],
        level: 'intermediate',
      }),
    ).toBeDefined();
  });

  it('starts over at cycle 1 for a new goal', () => {
    const muscle = nextCycle({
      previous: programme,
      profile: { ...profile, goal: 'muscle' },
      equipment: referenceEquipment,
      progress,
    });
    expect(muscle.cycle).toBe(1);
    expect(muscle.newGoal).toBe(true);
    expect(muscle.programme.generation?.cycle).toBeUndefined();
    expect(muscle.upgrades).toEqual([]);
  });
});

describe('next cycle after a level-up', () => {
  const beginner: Profile = {
    goal: 'recomposition',
    level: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 45,
  };
  const first = generateProgramme({ profile: beginner, equipment: [] });
  const run = simulate(first, [], compliant({ headroom: 0.5, seed: 5 }), {
    profile: beginner,
    sessions: first.sessionsPerWeek * first.weeks,
  });
  const progress = {
    logs: run.logs,
    programmes: [first],
    answers: [],
    inventory: [],
    profile: beginner,
    now: new Date(Date.parse(run.logs.at(-1)!.startedAt) + 86_400_000),
  };
  const next = nextCycle({
    previous: first,
    profile: { ...beginner, level: 'intermediate' },
    equipment: [],
    progress,
  });

  it('keeps the lifts: a new level changes the dose, not the exercises', () => {
    const upgraded = new Map(next.upgrades.map((u) => [u.from, u.to]));
    const lifts = (p: Programme) =>
      p.rotation.map((s) =>
        s.main
          .slice(0, 2)
          .map((b) => (b.type === 'straight' ? b.item.exerciseId : ''))
          .join(','),
      );
    lifts(first).forEach((pair, i) => {
      const now = lifts(next.programme)[i]!.split(',');
      pair.split(',').forEach((id, k) => {
        expect([id, upgraded.get(id)]).toContain(now[k]);
      });
    });
    for (const u of next.upgrades)
      expect(exerciseById.get(u.to)!.difficulty).toBeLessThanOrEqual(
        exerciseById.get(u.from)!.difficulty + 1,
      );
  });
});

describe('cycle review reads lifts as they ran', () => {
  const lead = programme.rotation[0]!.main[0]!;
  const leadId = lead.type === 'straight' ? lead.item.exerciseId : '';
  const harder = harderVariantFor(exerciseById.get(leadId)!, {
    inventory: referenceEquipment,
    level: 'intermediate',
  })?.id;

  it('follows a lift swapped for the whole cycle', () => {
    if (!harder) return;
    const answers = [
      {
        id: 'swap',
        exerciseId: leadId,
        kind: 'harder' as const,
        logId: 'x',
        answer: 'swap' as const,
        substituteId: harder,
        at: '2020-01-01T00:00:00.000Z',
      },
    ];
    const swapped = simulate(programme, referenceEquipment, compliant({ headroom: 0.5, seed: 3 }), {
      profile,
      sessions,
      answers,
    });
    const end = swapped.logs.at(-1)!;
    const out = cycleReview(programme, {
      ...ctx({ logs: swapped.logs, answers }),
      until: end.endedAt ?? end.startedAt,
    });
    const lift = out.lifts.find((l) => l.sessionId === programme.rotation[0]!.id)!;
    expect(lift.start?.exerciseId).toBe(harder);
    expect(lift.end?.exerciseId).toBe(harder);
  });
});

describe('cycle review counts', () => {
  it('counts a per-side set once', () => {
    const review = cycleReview(programme, ctx());
    const perSide = sim.logs
      .filter((l) => l.status === 'completed')
      .reduce(
        (n, l) =>
          n +
          new Set(
            l.sets
              .filter((s) => s.section === 'main' && s.actual && !s.flag)
              .map((s) => `${s.blockIndex}/${s.itemIndex}/${s.set}`),
          ).size,
        0,
      );
    expect(review.sessions.mainSets).toBe(perSide);
    expect(review.sessions.mainSets).toBeLessThan(
      sim.logs.reduce((n, l) => n + l.sets.filter((s) => s.section === 'main').length, 0),
    );
  });
});
