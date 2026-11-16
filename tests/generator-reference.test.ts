import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import {
  ProgrammeSchema,
  type Block,
  type Profile,
  type Session,
  type SessionItem,
} from '../src/domain';
import { generateProgramme, sessionSeconds } from '../src/engine';
import { referenceEquipment } from './fixtures/reference-equipment';
import { referenceProgramme } from './fixtures/reference-programme';

/**
 * The profile the reference programme was written for. 60 minutes because the estimator
 * counts every rest, between exercises too: the source's own 45-minute figures leave most of it out.
 */
const referenceProfile: Profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 6,
  sessionMinutes: 60,
};

const generated = generateProgramme({ profile: referenceProfile, equipment: referenceEquipment });

const items = (block: Block): SessionItem[] =>
  block.type === 'straight' ? [block.item] : block.items;
const pattern = (id: string) => exerciseById.get(id)?.pattern;
const kindTag = (id: string) =>
  exerciseById.get(id)?.tags.find((t) => t === 'compound' || t === 'isolation');
const isCardio = (item: SessionItem) =>
  item.target.kind === 'cardio' || item.target.kind === 'interval';
const volume = (block: Block) => (block.type === 'straight' ? block.sets : block.rounds);
const rest = (block: Block) =>
  block.type === 'straight' ? block.restSec : block.restAfterRoundSec;

/** Hard sets: warm-ups, mobility and cardio don't count. */
const hardSets = (session: Session) =>
  session.main.reduce((sum, block) => {
    const counted = items(block).filter(
      (i) => !isCardio(i) && exerciseById.get(i.exerciseId)?.pattern !== 'mobility',
    ).length;
    return sum + counted * volume(block);
  }, 0);

const pairs = generated.rotation.map((session, i) => ({
  session,
  ref: referenceProgramme.rotation[i]!,
}));

describe('generator — reference programme', () => {
  it('produces a valid programme', () => {
    const result = ProgrammeSchema.safeParse(generated);
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it('has the same sessions per week and rotation length', () => {
    expect(generated.sessionsPerWeek).toBe(referenceProgramme.sessionsPerWeek);
    expect(generated.rotation).toHaveLength(referenceProgramme.rotation.length);
  });

  it.each(pairs.map((p) => [p.ref.id, p] as const))(
    '%s: same block shapes and movement patterns',
    (_, { session, ref }) => {
      const shape = (s: Session) =>
        s.main.map((b) => ({
          type: b.type,
          style: b.type === 'group' ? b.style : undefined,
          patterns: items(b).map((i) => pattern(i.exerciseId)),
        }));
      expect(shape(session)).toEqual(shape(ref));
    },
  );

  it.each(pairs.map((p) => [p.ref.id, p] as const))(
    '%s: sets ±1, rest ±15 s, rep targets, RIR and tempo exact',
    (_, { session, ref }) => {
      session.main.forEach((block, b) => {
        const refBlock = ref.main[b]!;
        expect(Math.abs(volume(block) - volume(refBlock)), `block ${b} sets`).toBeLessThanOrEqual(
          1,
        );
        expect(Math.abs(rest(block) - rest(refBlock)), `block ${b} rest`).toBeLessThanOrEqual(15);
        items(block).forEach((item, i) => {
          const refItem = items(refBlock)[i]!;
          expect(item.target, `block ${b} item ${i} target`).toEqual(refItem.target);
          // The source's legend makes RIR 2 its standard effort: rep-based sets without one take it.
          const repBased = refItem.target.kind === 'reps' || refItem.target.kind === 'max';
          expect(item.rir, `block ${b} item ${i} rir`).toBe(
            refItem.rir ?? (repBased ? 2 : undefined),
          );
          expect(item.tempo, `block ${b} item ${i} tempo`).toEqual(refItem.tempo);
          expect(item.perSide ?? false, `block ${b} item ${i} per side`).toBe(
            refItem.perSide ?? false,
          );
        });
      });
    },
  );

  it.each(pairs.map((p) => [p.ref.id, p] as const))(
    '%s: cardio minutes exact',
    (_, { session, ref }) => {
      const cardio = (s: Session) =>
        [...s.main, ...s.finisher]
          .flatMap(items)
          .filter(isCardio)
          .map((i) => i.target);
      const minutes = (s: Session) =>
        cardio(s).map((t) => (t.kind === 'cardio' ? [t.minMinutes, t.maxMinutes] : t));
      expect(minutes(session)).toEqual(minutes(ref));
    },
  );

  it.each(pairs.map((p) => [p.ref.id, p] as const))(
    '%s: duration within ±10 %%',
    (_, { session, ref }) => {
      const expected = sessionSeconds(ref);
      expect(Math.abs(sessionSeconds(session) - expected) / expected).toBeLessThanOrEqual(0.1);
    },
  );

  it('keeps weekly hard sets within ±10 %', () => {
    const total = (sessions: Session[]) => sessions.reduce((sum, s) => sum + hardSets(s), 0);
    const expected = total(referenceProgramme.rotation);
    expect(Math.abs(total(generated.rotation) - expected) / expected).toBeLessThanOrEqual(0.1);
  });

  it('has the same phase table', () => {
    const table = (phases: typeof generated.phases) =>
      phases.map(({ name, fromWeek, toWeek, adjustments }) => ({
        name,
        fromWeek,
        toWeek,
        adjustments,
      }));
    expect(table(generated.phases)).toEqual(table(referenceProgramme.phases));
  });

  it('keeps ≥ 70 % of main exercises; the others are same-pattern, same-tag substitutes', () => {
    let same = 0;
    let total = 0;
    const mismatches: string[] = [];
    for (const { session, ref } of pairs) {
      session.main.forEach((block, b) =>
        items(block).forEach((item, i) => {
          const refId = items(ref.main[b]!)[i]!.exerciseId;
          total++;
          if (item.exerciseId === refId) same++;
          else if (
            pattern(item.exerciseId) !== pattern(refId) ||
            kindTag(item.exerciseId) !== kindTag(refId)
          )
            mismatches.push(`${session.id}: ${item.exerciseId} for ${refId}`);
        }),
      );
    }
    expect(mismatches).toEqual([]);
    expect(same / total).toBeGreaterThanOrEqual(0.7);
  });
});
