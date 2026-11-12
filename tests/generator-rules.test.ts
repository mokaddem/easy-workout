import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import {
  GOALS,
  LEVELS,
  ProgrammeSchema,
  type Block,
  type EquipmentInventory,
  type Exercise,
  type Profile,
  type Programme,
  type Session,
  type SessionItem,
} from '../src/domain';
import {
  equipmentCapabilities,
  generateProgramme,
  isExerciseAvailable,
  sessionForWeek,
  sessionSeconds,
} from '../src/engine';
import { levelCap } from '../src/engine/generate/select';
import { ownedWeights } from '../src/engine/generate/loads';
import { equipmentSets } from './fixtures/equipment-sets';

interface Case {
  label: string;
  profile: Profile;
  equipment: EquipmentInventory;
  programme: Programme;
}

const cases: Case[] = [];
for (const [equipmentName, equipment] of Object.entries(equipmentSets))
  for (const goal of GOALS)
    for (const level of LEVELS)
      for (const daysPerWeek of [2, 3, 4, 5, 6])
        for (const sessionMinutes of [20, 45, 75]) {
          const profile: Profile = { goal, level, daysPerWeek, sessionMinutes };
          cases.push({
            label: `${equipmentName}/${goal}/${level}/${daysPerWeek}d/${sessionMinutes}min`,
            profile,
            equipment,
            programme: generateProgramme({ profile, equipment }),
          });
        }

const items = (b: Block): SessionItem[] => (b.type === 'straight' ? [b.item] : b.items);
const sessionItems = (s: Session, sections: ('warmup' | 'main' | 'finisher')[]) =>
  sections.flatMap((section) => s[section].flatMap(items));
const exercise = (id: string): Exercise => {
  const found = exerciseById.get(id);
  if (!found) throw new Error(`unknown exercise ${id}`);
  return found;
};
const isCardioDay = (s: Session) => s.id === 'cardio';

/** Collects violations across the whole matrix, so one failure lists every offending case. */
const violations = (check: (c: Case) => string[]): string[] =>
  cases
    .flatMap((c) => check(c).map((v) => `${c.label}: ${v}`))
    .slice(0, Number(process.env.MAX_VIOLATIONS ?? 15));

describe(`generator — rules over ${cases.length} profiles`, () => {
  it('produces valid programmes', () => {
    expect(
      violations((c) => {
        const r = ProgrammeSchema.safeParse(c.programme);
        return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      }),
    ).toEqual([]);
  });

  it('is deterministic', () => {
    for (const c of cases.slice(0, 40))
      expect(generateProgramme({ profile: c.profile, equipment: c.equipment })).toEqual(
        c.programme,
      );
  });

  it('only uses exercises the equipment allows, at or below the level cap', () => {
    expect(
      violations((c) => {
        const capabilities = equipmentCapabilities(c.equipment);
        return c.programme.rotation.flatMap((s) =>
          sessionItems(s, ['warmup', 'main', 'finisher']).flatMap(({ exerciseId }) => {
            const ex = exercise(exerciseId);
            const out: string[] = [];
            if (!isExerciseAvailable(ex, capabilities)) out.push(`${exerciseId} not available`);
            if (ex.difficulty > levelCap(c.profile.level, ex)) out.push(`${exerciseId} too hard`);
            return out;
          }),
        );
      }),
    ).toEqual([]);
  });

  it('keeps warm-up drills out of main and finisher, and never repeats an exercise there', () => {
    expect(
      violations((c) =>
        c.programme.rotation.flatMap((s) => {
          const ids = sessionItems(s, ['main', 'finisher']).map((i) => i.exerciseId);
          const out = ids
            .filter((id) => exercise(id).pattern === 'mobility')
            .map((id) => `${id} in main`);
          const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
          return [...out, ...dupes.map((id) => `${s.id}: ${id} twice`)];
        }),
      ),
    ).toEqual([]);
  });

  it('opens every strength session with a warm-up and a compound lift', () => {
    expect(
      violations((c) =>
        c.programme.rotation
          .filter((s) => !isCardioDay(s))
          .flatMap((s) => {
            const out: string[] = [];
            if (s.warmup.length === 0) out.push(`${s.id}: no warm-up`);
            const first = s.main[0];
            if (!first) return [`${s.id}: empty`];
            const lead = items(first)[0]!;
            if (first.type === 'straight' && !exercise(lead.exerciseId).tags.includes('compound'))
              out.push(`${s.id}: opens with ${lead.exerciseId}`);
            return out;
          }),
      ),
    ).toEqual([]);
  });

  it('covers push, pull, knee-dominant, hip-dominant and core every week', () => {
    const groups: Record<string, string[]> = {
      push: ['push-horizontal', 'push-vertical'],
      pull: ['pull-horizontal', 'pull-vertical'],
      knee: ['squat', 'lunge'],
      hip: ['hinge', 'hip-extension'],
      core: ['core-anti-extension', 'core-anti-lateral', 'core-flexion', 'core-rotation'],
    };
    expect(
      violations((c) => {
        const patterns = new Set<string>(
          c.programme.rotation.flatMap((s) =>
            sessionItems(s, ['main', 'finisher']).map((i) => exercise(i.exerciseId).pattern),
          ),
        );
        return Object.entries(groups)
          .filter(([, list]) => !list.some((p) => patterns.has(p)))
          .map(([name]) => `no ${name}`);
      }),
    ).toEqual([]);
  });

  it('fits the time budget (+10 %) for strength sessions', () => {
    expect(
      violations((c) =>
        c.programme.rotation
          .filter((s) => !isCardioDay(s))
          .filter((s) => sessionSeconds(s) / 60 > c.profile.sessionMinutes * 1.1)
          .map((s) => `${s.id} ${Math.round(sessionSeconds(s) / 60)} min`),
      ),
    ).toEqual([]);
  });

  it('never prescribes RIR 0, and keeps tempo off ballistic and plyometric moves', () => {
    expect(
      violations((c) => [
        ...c.programme.phases.flatMap((p) =>
          p.adjustments
            .filter((a) => a.kind === 'rir' && a.value === 0)
            .map(() => `${p.name.en} RIR 0`),
        ),
        ...c.programme.rotation.flatMap((s) =>
          sessionItems(s, ['warmup', 'main', 'finisher']).flatMap((i) => {
            const tags = exercise(i.exerciseId).tags;
            const out: string[] = [];
            if (i.rir === 0) out.push(`${i.exerciseId} RIR 0`);
            if (i.tempo && (tags.includes('ballistic') || tags.includes('plyometric')))
              out.push(`${i.exerciseId} has a tempo`);
            return out;
          }),
        ),
      ]),
    ).toEqual([]);
  });

  it('starts loadable bodyweight moves unloaded and external loads on owned weights', () => {
    expect(
      violations((c) =>
        c.programme.rotation.flatMap((s) =>
          sessionItems(s, ['warmup', 'main', 'finisher']).flatMap((i) => {
            const ex = exercise(i.exerciseId);
            if (ex.loadType === 'bodyweight-loadable' && i.load?.kind !== 'bodyweight')
              return [`${i.exerciseId} not unloaded`];
            if (i.load?.kind === 'kg') {
              const owned = [
                ...ownedWeights(c.equipment, 'dumbbell', 1),
                ...ownedWeights(c.equipment, 'kettlebell', 1),
              ];
              if (!owned.includes(i.load.kg))
                return [`${i.exerciseId} at ${i.load.kg} kg not owned`];
            }
            return [];
          }),
        ),
      ),
    ).toEqual([]);
  });

  it('keeps jump rope away from beginners and get-ups / windmills at 1–3 reps', () => {
    expect(
      violations((c) =>
        c.programme.rotation.flatMap((s) =>
          sessionItems(s, ['warmup', 'main', 'finisher']).flatMap((i) => {
            const out: string[] = [];
            const rope = exercise(i.exerciseId).equipment.every((set) =>
              set.some((r) => r.kind === 'jump-rope'),
            );
            if (c.profile.level === 'beginner' && rope) out.push(`${i.exerciseId} for a beginner`);
            if (
              ['kettlebell-turkish-get-up', 'kettlebell-windmill'].includes(i.exerciseId) &&
              (i.target.kind !== 'reps' || i.target.max > 3)
            )
              out.push(`${i.exerciseId} reps`);
            return out;
          }),
        ),
      ),
    ).toEqual([]);
  });

  it('skips the peak week below intermediate and for general fitness', () => {
    expect(
      violations((c) => {
        const peak = c.programme.phases.some((p) => p.name.en === 'Peak');
        const expected =
          c.profile.goal !== 'general-fitness' &&
          (c.profile.level === 'intermediate' || c.profile.level === 'advanced');
        return peak === expected ? [] : [`peak ${peak}`];
      }),
    ).toEqual([]);
  });

  it('explains every exercise choice', () => {
    expect(
      violations((c) =>
        c.programme.rotation.flatMap((s) =>
          s.main.flatMap((b, blockIndex) =>
            items(b).flatMap((item, i) => {
              const explained = c.programme.generation?.notes.some(
                (n) =>
                  n.code.startsWith(
                    item.target.kind === 'cardio' || item.target.kind === 'interval'
                      ? 'cardio'
                      : 'exercise-',
                  ) &&
                  n.ref?.sessionId === s.id &&
                  n.ref.section === 'main' &&
                  n.ref.blockIndex === blockIndex &&
                  (b.type === 'straight' || n.ref.itemIndex === i),
              );
              return explained ? [] : [`${s.id} main ${blockIndex}/${i} ${item.exerciseId}`];
            }),
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('keeps the week balanced: push sets at most 1.3 × pull sets', () => {
    const push = [
      'push-horizontal',
      'push-vertical',
      'chest-isolation',
      'shoulder-isolation',
      'elbow-extension',
    ];
    const pull = ['pull-horizontal', 'pull-vertical', 'elbow-flexion', 'shrug'];
    expect(
      violations((c) => {
        let pushSets = 0;
        let pullSets = 0;
        for (const s of c.programme.rotation)
          for (const b of s.main)
            for (const i of items(b)) {
              const sets = b.type === 'straight' ? b.sets : b.rounds;
              const pattern = exercise(i.exerciseId).pattern;
              if (push.includes(pattern)) pushSets += sets;
              if (pull.includes(pattern)) pullSets += sets;
            }
        return pushSets > 1.3 * pullSets ? [`push ${pushSets} vs pull ${pullSets}`] : [];
      }),
    ).toEqual([]);
  });

  it('fills at least 75 % of a 45-minute budget for intermediate and advanced trainees with dumbbells', () => {
    expect(
      violations((c) => {
        const equipped = c.equipment.some((item) => item.kind === 'dumbbell');
        if (!equipped || c.profile.sessionMinutes !== 45) return [];
        if (c.profile.level === 'beginner' || c.profile.level === 'returning') return [];
        return c.programme.rotation
          .filter((s) => !isCardioDay(s))
          .filter((s) => sessionSeconds(s) / 60 < 0.75 * c.profile.sessionMinutes)
          .map((s) => `${s.id} ${Math.round(sessionSeconds(s) / 60)} min`);
      }),
    ).toEqual([]);
  });

  it('gives every rep-based main exercise an effort target', () => {
    expect(
      violations((c) =>
        c.programme.rotation.flatMap((s) =>
          s.main
            .flatMap(items)
            .filter(
              (i) => (i.target.kind === 'reps' || i.target.kind === 'max') && i.rir === undefined,
            )
            .filter((i) => exercise(i.exerciseId).pattern !== 'conditioning')
            .map((i) => `${s.id}: ${i.exerciseId} without RIR`),
        ),
      ),
    ).toEqual([]);
  });

  it('starts external loads within 0.6–1.5 × the bodyweight-ratio target', () => {
    expect(
      violations((c) =>
        (c.programme.generation?.notes ?? [])
          .filter((n) => n.code === 'load-start')
          .filter((n) => {
            const share = Number(n.params.kg) / Number(n.params.targetKg);
            return share < 0.6 - 1e-9 || share > 1.5 + 1e-9;
          })
          .map(
            (n) =>
              `${String(n.params.exerciseId)} ${String(n.params.kg)} kg for ${String(n.params.targetKg)}`,
          ),
      ),
    ).toEqual([]);
  });

  it('fills overhead-press slots with shoulder-dominant presses only', () => {
    expect(
      violations((c) =>
        (c.programme.generation?.notes ?? [])
          .filter(
            (n) => n.code.startsWith('exercise-') && String(n.params.slot).startsWith('press-'),
          )
          .filter(
            (n) => !exercise(String(n.params.exerciseId)).primaryMuscles.includes('front-delts'),
          )
          .map((n) => `${String(n.params.slot)}: ${String(n.params.exerciseId)}`),
      ),
    ).toEqual([]);
  });

  it('keeps split sessions at three or more main blocks, else switches to full body', () => {
    expect(
      violations((c) =>
        c.programme.rotation
          .filter((s) => !isCardioDay(s) && !s.id.includes('full-'))
          .filter((s) => s.main.length < 3 && c.profile.sessionMinutes >= 45)
          .map((s) => `${s.id}: ${s.main.length} blocks`),
      ),
    ).toEqual([]);
  });

  it('keeps conditioning in every recomposition and general-fitness week', () => {
    expect(
      violations((c) => {
        if (c.profile.goal === 'muscle') return [];
        const conditioning = c.programme.rotation.some(
          (s) => s.finisher.length > 0 || isCardioDay(s),
        );
        return conditioning ? [] : ['no conditioning'];
      }),
    ).toEqual([]);
  });

  it('never goes past 5 sets of one exercise in any week (4 for beginners and returning)', () => {
    expect(
      violations((c) => {
        const cap = c.profile.level === 'beginner' || c.profile.level === 'returning' ? 4 : 5;
        const out: string[] = [];
        for (const s of c.programme.rotation)
          for (const week of [1, 3, 5])
            for (const b of sessionForWeek(c.programme, s.id, week).session.main) {
              const sets = b.type === 'straight' ? b.sets : b.rounds;
              if (sets > cap)
                out.push(`${s.id} week ${week}: ${items(b)[0]!.exerciseId} × ${sets}`);
            }
        return out;
      }),
    ).toEqual([]);
  });

  it('never leads a session with a renegade row', () => {
    expect(
      violations((c) =>
        c.programme.rotation
          .filter((s) => s.main[0] && items(s.main[0])[0]!.exerciseId === 'renegade-row')
          .map((s) => s.id),
      ),
    ).toEqual([]);
  });

  it('keeps every week of a session within 125 % of the budget', () => {
    expect(
      violations((c) =>
        c.programme.rotation
          .filter((s) => !isCardioDay(s))
          .flatMap((s) =>
            [1, 3, 4, 5, 7, 8].flatMap((week) => {
              const minutes = sessionSeconds(sessionForWeek(c.programme, s.id, week).session) / 60;
              return minutes > 1.25 * c.profile.sessionMinutes
                ? [`${s.id} week ${week}: ${Math.round(minutes)} min`]
                : [];
            }),
          ),
      ),
    ).toEqual([]);
  });
});
