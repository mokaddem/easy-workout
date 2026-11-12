import { describe, expect, it } from 'vitest';
import type { Block, Session } from '../src/domain';
import { sessionForWeek } from '../src/engine';
import { referenceProgramme as programme } from './fixtures/reference-programme';

const sets = (b: Block) => (b.type === 'straight' ? b.sets : b.rounds);
const finisherMinutes = (s: Session) =>
  s.finisher.flatMap((b) =>
    b.type === 'straight' && b.item.target.kind === 'cardio' ? [b.item.target.maxMinutes] : [],
  );
const base = (id: string) => programme.rotation.find((s) => s.id === id)!;

describe('sessionForWeek — reference phases', () => {
  it('never touches warm-ups', () => {
    for (let week = 1; week <= 8; week++)
      for (const s of programme.rotation)
        expect(sessionForWeek(programme, s.id, week).session.warmup).toEqual(s.warmup);
  });

  it('weeks 1–2: RIR 3 on every rep-based main set, nothing on holds or cardio', () => {
    const { session } = sessionForWeek(programme, 'c-lower-core', 1);
    const items = session.main.flatMap((b) => (b.type === 'straight' ? [b.item] : b.items));
    for (const item of items)
      expect(item.rir, item.exerciseId).toBe(item.target.kind === 'time' ? undefined : 3);
    const walk = sessionForWeek(programme, 'cardio-walk', 1).session.main[0]!;
    expect(walk.type === 'straight' && walk.item.rir).toBeFalsy();
  });

  it('weeks 3–4: one more set on main blocks 1 and 2, cardio skipped, finisher +5 min', () => {
    const push = sessionForWeek(programme, 'a-push', 3).session;
    expect(push.main.map(sets)).toEqual([5, 4, 3, 3, 3, 2]);
    expect(finisherMinutes(push)).toEqual([20]);
    const density = sessionForWeek(programme, 'd-upper-density', 4).session;
    expect(density.main.map(sets)).toEqual([4, 4, 3]);
    expect(sessionForWeek(programme, 'cardio-walk', 3).session.main).toEqual(
      base('cardio-walk').main,
    );
  });

  it('weeks 5–7: first-set then last-set RIR 1, finishers +10 min, cardio day unchanged', () => {
    const intensity = sessionForWeek(programme, 'a-push', 5);
    expect(intensity.setRir).toEqual({ first: 1 });
    expect(finisherMinutes(intensity.session)).toEqual([25]);
    const peak = sessionForWeek(programme, 'b-pull', 7);
    expect(peak.setRir).toEqual({ last: 1 });
    expect(finisherMinutes(peak.session)).toEqual([25]);
    expect(sessionForWeek(programme, 'cardio-walk', 7).session.main).toEqual(
      base('cardio-walk').main,
    );
  });

  it('week 8: volume × 0.6 rounded to the nearest set (min 1), RIR 3, max test', () => {
    const push = sessionForWeek(programme, 'a-push', 8);
    expect(push.session.main.map(sets)).toEqual([2, 2, 2, 2, 2, 1]);
    expect(finisherMinutes(push.session)).toEqual([15]);
    expect(push.maxTests).toEqual(['push-up']);
    const metabolic = sessionForWeek(programme, 'e-lower-metabolic', 8).session;
    expect(metabolic.finisher.map(sets)).toEqual([2]);
  });

  it('recomputes the estimated duration', () => {
    const w1 = sessionForWeek(programme, 'a-push', 1).session.estimatedMinutes;
    const w3 = sessionForWeek(programme, 'a-push', 3).session.estimatedMinutes;
    const w8 = sessionForWeek(programme, 'a-push', 8).session.estimatedMinutes;
    expect(w3).toBeGreaterThan(w1);
    expect(w8).toBeLessThan(w1);
  });

  it('rejects unknown sessions and weeks outside the programme', () => {
    expect(() => sessionForWeek(programme, 'nope', 1)).toThrow();
    expect(() => sessionForWeek(programme, 'a-push', 9)).toThrow();
  });
});
