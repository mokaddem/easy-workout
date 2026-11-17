import type { Load, MaxTest, Programme, SessionLog } from '@/domain';
import type { CycleReview, Upgrade } from '@/engine';
import { testValue } from '@/engine';
import { itemsOf } from '@/features/programme/format';

export type UpgradeReason =
  | { kind: 'kit'; load: Load }
  | { kind: 'test'; value: number; time: boolean }
  | { kind: 'ladder'; times: number }
  | { kind: 'plain' };

/** The session of the programme that holds an exercise, and the item that carries it. */
export function itemOf(programme: Programme, exerciseId: string) {
  for (const session of programme.rotation)
    for (const block of session.main)
      for (const item of itemsOf(block))
        if (item.exerciseId === exerciseId) return { session, item };
  return undefined;
}

/**
 * Why a lift moves to its harder version: it reached the top of what the kit offers, its test went
 * past the top of the range, or it kept hitting the top of the range.
 */
export function upgradeReason(
  upgrade: Upgrade,
  previous: Programme,
  review: CycleReview,
  logs: readonly SessionLog[],
  maxTests: readonly MaxTest[],
): UpgradeReason {
  const found = itemOf(previous, upgrade.from);
  const top = found?.item.target.kind === 'reps' ? found.item.target.max : undefined;

  const test = maxTests
    .filter(
      (t) =>
        t.programmeId === previous.id &&
        t.exerciseId === upgrade.from &&
        t.context === 'session' &&
        !t.stopped,
    )
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (test && test.result.kind === 'reps' && top !== undefined && testValue(test) > top)
    return { kind: 'test', value: testValue(test), time: false };

  const lift = review.lifts.find(
    (l) =>
      l.status === 'equipment-max' && (l.end?.exerciseId ?? l.start?.exerciseId) === upgrade.from,
  );
  if (lift?.end?.load && lift.end.load.kind !== 'bodyweight')
    return { kind: 'kit', load: lift.end.load };

  const times = logs.filter((log) => {
    if (log.source.kind !== 'programme' || log.source.programmeId !== previous.id) return false;
    const sets = log.sets.filter(
      (s) => s.exerciseId === upgrade.from && s.actual?.reps !== undefined && !s.flag,
    );
    return (
      sets.length > 0 &&
      sets.every((s) => s.planned.target.kind === 'reps' && s.actual!.reps! >= s.planned.target.max)
    );
  }).length;
  return times >= 2 ? { kind: 'ladder', times } : { kind: 'plain' };
}
