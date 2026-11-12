import type { Block, Session, SessionItem, Target } from '../domain';

/** Seconds per rep when no tempo is set. */
export const SECONDS_PER_REP = 2.5;
/** Reps assumed for an as-many-as-possible set. */
export const MAX_SET_REPS = 12;
/** Changing sides on a per-side set. */
export const SIDE_SWITCH_SEC = 5;
/** Moving between exercises inside a superset or circuit. */
export const ITEM_SWITCH_SEC = 10;
/** Setting up the next block. */
export const BLOCK_TRANSITION_SEC = 20;
export const WARMUP_TRANSITION_SEC = 15;

const repSeconds = (item: SessionItem) =>
  item.tempo ? item.tempo.down + item.tempo.pause + item.tempo.up : SECONDS_PER_REP;

const midpoint = (min: number, max: number) => Math.ceil((min + max) / 2);

const targetSeconds = (target: Target, item: SessionItem): number => {
  switch (target.kind) {
    case 'reps':
      return midpoint(target.min, target.max) * repSeconds(item);
    case 'max':
      return MAX_SET_REPS * repSeconds(item);
    case 'time':
      return target.maxSec;
    case 'cardio':
      return target.maxMinutes * 60;
    case 'interval':
      return target.rounds * (target.workSec + target.recoverySec);
  }
};

/** Working time of one set of an item, both sides included. */
export const itemSeconds = (item: SessionItem): number => {
  const once = targetSeconds(item.target, item);
  return item.perSide ? once * 2 + SIDE_SWITCH_SEC : once;
};

/** Working and resting time of a block, without the transition into it. */
export const blockSeconds = (block: Block): number => {
  if (block.type === 'straight')
    return block.sets * itemSeconds(block.item) + (block.sets - 1) * block.restSec;
  const between = Math.max(block.restBetweenItemsSec, ITEM_SWITCH_SEC);
  const round =
    block.items.reduce((sum, item) => sum + itemSeconds(item), 0) +
    (block.items.length - 1) * between;
  return block.rounds * round + (block.rounds - 1) * block.restAfterRoundSec;
};

export const sectionSeconds = (blocks: readonly Block[], transitionSec: number): number =>
  blocks.reduce((sum, block) => sum + blockSeconds(block) + transitionSec, 0);

/** Estimated session length in seconds. */
export const sessionSeconds = (session: Pick<Session, 'warmup' | 'main' | 'finisher'>): number =>
  sectionSeconds(session.warmup, WARMUP_TRANSITION_SEC) +
  sectionSeconds(session.main, BLOCK_TRANSITION_SEC) +
  sectionSeconds(session.finisher, BLOCK_TRANSITION_SEC);

export const sessionMinutes = (session: Pick<Session, 'warmup' | 'main' | 'finisher'>): number =>
  Math.max(1, Math.round(sessionSeconds(session) / 60));
