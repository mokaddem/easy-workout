import type { Load, Session, SessionLog, SessionItem } from '@/domain';
import { itemsOf } from '@/features/programme/format';

export interface PastItemRow {
  key: string;
  index: number;
  item: SessionItem;
  sets: number;
  /** The load the item was planned with that week, as the log recorded it. */
  load: Load | undefined;
  /** What was done, set by set; empty when nothing was. */
  done: {
    values: number[];
    unit: 'reps' | 'seconds' | 'minutes';
    load: Load | undefined;
    stopped: 'pain' | 'no-equipment' | undefined;
  };
}

/** Every exercise of the main part and the finisher, with what the log says was done. */
export function pastRows(plan: Session, log: SessionLog | undefined): PastItemRow[] {
  const rows: PastItemRow[] = [];
  for (const section of ['main', 'finisher'] as const)
    plan[section].forEach((block, blockIndex) =>
      itemsOf(block).forEach((item, itemIndex) => {
        const sets = (log?.sets ?? [])
          .filter(
            (s) =>
              s.section === section && s.blockIndex === blockIndex && s.itemIndex === itemIndex,
          )
          .sort((a, b) => a.set - b.set || (a.side ?? '').localeCompare(b.side ?? ''));
        const performed = sets.filter((s) => s.actual);
        const kind = item.target.kind;
        const unit: PastItemRow['done']['unit'] =
          kind === 'reps' || kind === 'max' ? 'reps' : kind === 'time' ? 'seconds' : 'minutes';
        const value = (s: (typeof sets)[number]): number | undefined =>
          unit === 'reps'
            ? s.actual?.reps
            : unit === 'seconds'
              ? s.actual?.durationSec
              : s.actual?.durationSec === undefined
                ? undefined
                : Math.round(s.actual.durationSec / 60);
        const flagged = sets.find((s) => s.flag === 'pain' || s.flag === 'no-equipment');
        rows.push({
          key: `${section}/${blockIndex}/${itemIndex}`,
          index: rows.length + 1,
          item,
          sets: block.type === 'straight' ? block.sets : block.rounds,
          load: sets[0]?.planned.load ?? item.load,
          done: {
            values: performed.flatMap((s) => {
              const v = value(s);
              return v === undefined ? [] : [v];
            }),
            unit,
            load: performed.at(-1)?.actual?.load ?? performed.at(-1)?.planned.load,
            stopped:
              flagged?.flag === 'pain' || flagged?.flag === 'no-equipment'
                ? flagged.flag
                : undefined,
          },
        });
      }),
    );
  return rows;
}
