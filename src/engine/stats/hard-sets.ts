import type { Exercise, Session, SessionLog, SetLog } from '../../domain';
import { exerciseById as catalogueById } from '../../catalogue';
import { groupsOf, isStrengthWork, MUSCLE_GROUP_IDS, type MuscleGroup } from '../volume';

/** A count per muscle group, every group present. */
export type GroupCounts = Record<MuscleGroup, number>;

export const emptyGroupCounts = (): GroupCounts =>
  Object.fromEntries(MUSCLE_GROUP_IDS.map((g) => [g, 0])) as GroupCounts;

const isCardioTarget = (kind: string) => kind === 'cardio' || kind === 'interval';

/**
 * Hard sets a log gives each muscle group: performed sets (done, not flagged) of strength work in
 * the main part or the finisher. Both sides of a per-side set make one set; a set counts for every
 * group its exercise's primary muscles belong to.
 */
export function hardSetsOfLog(
  log: Pick<SessionLog, 'sets'>,
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
): GroupCounts {
  const counts = emptyGroupCounts();
  const seen = new Set<string>();
  for (const set of log.sets) {
    if (!performed(set)) continue;
    const exercise = exercises.get(set.exerciseId);
    if (!exercise || !isStrengthWork(exercise) || isCardioTarget(set.planned.target.kind)) continue;
    const key = `${set.section}/${set.blockIndex}/${set.itemIndex}/${set.set}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const group of groupsOf(exercise)) counts[group]++;
  }
  return counts;
}

const performed = (set: SetLog): boolean =>
  set.actual !== undefined && set.flag === undefined && set.section !== 'warmup';

/** Hard sets a planned session holds per muscle group (the same definition, over the plan). */
export function plannedHardSets(
  session: Pick<Session, 'main' | 'finisher'>,
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
): GroupCounts {
  const counts = emptyGroupCounts();
  for (const block of [...session.main, ...session.finisher]) {
    const entries =
      block.type === 'straight'
        ? [{ item: block.item, sets: block.sets }]
        : block.items.map((item) => ({ item, sets: block.rounds }));
    for (const { item, sets } of entries) {
      const exercise = exercises.get(item.exerciseId);
      if (!exercise || !isStrengthWork(exercise) || isCardioTarget(item.target.kind)) continue;
      for (const group of groupsOf(exercise)) counts[group] += sets;
    }
  }
  return counts;
}

export const addGroupCounts = (a: GroupCounts, b: GroupCounts): GroupCounts => {
  const out = emptyGroupCounts();
  for (const g of MUSCLE_GROUP_IDS) out[g] = a[g] + b[g];
  return out;
};
