import { exerciseById } from '../catalogue';
import type { Block, Session, SessionItem, Target } from '../domain';

/** Seconds per rep when no tempo is set. */
export const SECONDS_PER_REP = 2.5;
/** Reps assumed for an as-many-as-possible set. */
export const MAX_SET_REPS = 12;
/** Changing sides on a per-side set. */
export const SIDE_SWITCH_SEC = 5;
/** Changing legs on a loaded single-leg lift (split squat, step-up): setting up again takes longer. */
export const LEG_SWITCH_SEC = 15;

const SINGLE_LEG_PATTERNS = new Set(['squat', 'hinge', 'lunge']);

/** Pause between the two sides of a per-side set. */
export const sideSwitchSec = (exerciseId: string): number => {
  const exercise = exerciseById.get(exerciseId);
  return exercise && SINGLE_LEG_PATTERNS.has(exercise.pattern) && exercise.tags.includes('compound')
    ? LEG_SWITCH_SEC
    : SIDE_SWITCH_SEC;
};
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
  return item.perSide ? once * 2 + sideSwitchSec(item.exerciseId) : once;
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

/** Blocks of one section with the move into each, on their own. */
export const sectionSeconds = (blocks: readonly Block[], transitionSec: number): number =>
  blocks.reduce((sum, block) => sum + blockSeconds(block) + transitionSec, 0);

/** Rest after the last set or round of a block. */
const blockRestSec = (block: Block): number =>
  block.type === 'straight' ? block.restSec : block.restAfterRoundSec;

/**
 * Time between a block and the next one: the block's own rest, but never shorter than setting
 * up the next block.
 */
export const blockTransitionSec = (previous: Block | undefined, transitionSec: number): number =>
  Math.max(transitionSec, previous ? blockRestSec(previous) : 0);

/** Estimated session length in seconds. */
export const sessionSeconds = (
  session: Pick<Session, 'warmup' | 'main' | 'finisher'> & Pick<Partial<Session>, 'transitionSec'>,
): number => {
  let total = 0;
  let previous: Block | undefined;
  const own = session.transitionSec;
  const sections: [readonly Block[], number][] = [
    [session.warmup, own ?? WARMUP_TRANSITION_SEC],
    [session.main, own ?? BLOCK_TRANSITION_SEC],
    [session.finisher, own ?? BLOCK_TRANSITION_SEC],
  ];
  for (const [blocks, transitionSec] of sections)
    for (const block of blocks) {
      total += blockTransitionSec(previous, transitionSec) + blockSeconds(block);
      previous = block;
    }
  return total;
};

export const sessionMinutes = (session: Pick<Session, 'warmup' | 'main' | 'finisher'>): number =>
  Math.max(1, Math.round(sessionSeconds(session) / 60));
