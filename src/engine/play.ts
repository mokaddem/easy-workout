import { exerciseById as catalogueById } from '../catalogue';
import {
  BAND_LEVELS,
  SECTIONS,
  setLogKey,
  type BandLevel,
  type Block,
  type EquipmentInventory,
  type Exercise,
  type Load,
  type PauseKind,
  type Section,
  type Session,
  type SessionItem,
  type SessionLog,
  type SetActual,
  type SetAdjustments,
  type SetFlag,
  type SetLog,
  type Side,
  type Target,
} from '../domain';
import {
  BLOCK_TRANSITION_SEC,
  blockTransitionSec,
  sideSwitchSec,
  WARMUP_TRANSITION_SEC,
} from './duration';
import { equipmentCapabilities, usableSetups, type EquipmentCapabilities } from './equipment';
import { FIXED_REP_EXERCISES } from './generate/dose';
import { DEFAULT_BODYWEIGHT_KG, ownedWeights, snapDown } from './generate/loads';
import { bodyShare, capacity, predictReps } from './progress/ladder';
import { takesPhaseRir, type WeekPlan } from './week';

/** The prescription of one set, week changes included. */
export type SetPrescription = SetLog['planned'];

/** One set the player runs: a set of a straight block or one exercise of a round, per side when needed. */
export interface PlayStep {
  section: Section;
  blockIndex: number;
  itemIndex: number;
  /** 1-based set (straight block) or round (group). */
  set: number;
  /** Sets or rounds of the block. */
  sets: number;
  side?: Side;
  item: SessionItem;
  planned: SetPrescription;
  block: Block;
  /** Position of this exercise among all the exercises of the session, 0-based. */
  exercise: number;
}

/**
 * What comes between two steps.
 * - `side`: switching sides of a per-side exercise.
 * - `item`: next exercise of the same round (superset, circuit); 0 s means straight on.
 * - `rest`: between sets of a straight block, or after a round.
 * - `block`: into the next block.
 * - `end`: nothing left.
 */
export interface Pause {
  kind: PauseKind | 'end';
  seconds: number;
}

const itemsOf = (block: Block) => (block.type === 'straight' ? [block.item] : block.items);
const roundsOf = (block: Block) => (block.type === 'straight' ? block.sets : block.rounds);
const roundRestOf = (block: Block) =>
  block.type === 'straight' ? block.restSec : block.restAfterRoundSec;
const transitionInto = (section: Section) =>
  section === 'warmup' ? WARMUP_TRANSITION_SEC : BLOCK_TRANSITION_SEC;

/** A week's first- or last-set RIR moves a set at most this many reps closer to failure. */
const MAX_SET_RIR_STEP = 2;

/** Lightest share of the top set's load a back-off set may drop to. */
export const MIN_BACK_OFF_SHARE = 0.8;

/** Identifies an exercise within its session, across its sets. */
export const itemKey = (section: Section, blockIndex: number, itemIndex: number): string =>
  `${section}/${blockIndex}/${itemIndex}`;

/** First- and last-set RIR only apply to sets counted in reps of the main part. */
const takesSetRir = (section: Section, target: Target) =>
  section === 'main' && (target.kind === 'reps' || target.kind === 'max');

function prescription(
  section: Section,
  blockIndex: number,
  itemIndex: number,
  item: SessionItem,
  set: number,
  sets: number,
  adjustments: SetAdjustments | undefined,
): SetPrescription {
  let rir = item.rir;
  let load = item.load;
  let goal = item.goal;
  if (adjustments && takesSetRir(section, item.target) && takesPhaseRir(item)) {
    // A week's first- or last-set RIR makes a set harder, never easier than the item's own, and
    // at most two reps closer to failure. Jumps keep none.
    const own = item.rir;
    const harder = (phase: number) =>
      own === undefined ? phase : Math.max(Math.min(phase, own), own - MAX_SET_RIR_STEP);
    if (set === 1 && adjustments.firstSetRir !== undefined) rir = harder(adjustments.firstSetRir);
    else if (set === sets && adjustments.lastSetRir !== undefined)
      rir = harder(adjustments.lastSetRir);
    // A set closer to failure asks for as many more reps as it gives up in reserve, unless the
    // rep count is the movement itself.
    const fixed =
      FIXED_REP_EXERCISES.has(item.exerciseId) ||
      (item.target.kind === 'reps' && item.target.max <= 3);
    if (goal !== undefined && item.rir !== undefined && rir !== undefined && !fixed)
      goal = Math.max(1, goal + item.rir - rir);
    const backOff = adjustments.backOffLoads?.[itemKey(section, blockIndex, itemIndex)];
    if (set > 1 && backOff) {
      load = backOff;
      // A lighter back-off set aims for what the top set's goal predicts at its load.
      const top = item.load;
      const firstRir =
        adjustments.firstSetRir === undefined ? item.rir : harder(adjustments.firstSetRir);
      if (
        !fixed &&
        item.goal !== undefined &&
        item.target.kind === 'reps' &&
        top?.kind === 'kg' &&
        backOff.kind === 'kg' &&
        item.rir !== undefined &&
        firstRir !== undefined &&
        rir !== undefined
      ) {
        // On the load moved: implements, plus the share of the body a leg move lifts.
        const exercise = catalogueById.get(item.exerciseId);
        const count =
          exercise?.equipment[0]?.find((r) => r.kind === 'dumbbell' || r.kind === 'kettlebell')
            ?.count ?? 1;
        const body = exercise ? bodyShare(exercise, false) * DEFAULT_BODYWEIGHT_KG : 0;
        const moved = (kg: number) => kg * count + body;
        const topGoal = item.goal + item.rir - firstRir;
        const predicted = predictReps(
          capacity(moved(top.kg), topGoal, firstRir),
          moved(backOff.kg),
          rir,
        );
        goal = Math.min(item.target.max + 4, Math.max(item.target.min, predicted));
      }
    }
  }
  return {
    target: item.target,
    ...(load && { load }),
    ...(rir !== undefined && { rir }),
    ...(item.tempo && { tempo: item.tempo }),
    ...(goal !== undefined && { goal }),
  };
}

/** The session as the player runs it: warm-up, main, finisher, round by round, side by side. */
export function playSteps(
  session: Pick<Session, Section>,
  adjustments?: SetAdjustments,
): PlayStep[] {
  const steps: PlayStep[] = [];
  let exercise = 0;
  for (const section of SECTIONS) {
    session[section].forEach((block, blockIndex) => {
      const items = itemsOf(block);
      const sets = roundsOf(block);
      for (let set = 1; set <= sets; set++)
        items.forEach((item, itemIndex) => {
          const planned = prescription(
            section,
            blockIndex,
            itemIndex,
            item,
            set,
            sets,
            adjustments,
          );
          const sides: (Side | undefined)[] = item.perSide ? ['left', 'right'] : [undefined];
          for (const side of sides)
            steps.push({
              section,
              blockIndex,
              itemIndex,
              set,
              sets,
              ...(side && { side }),
              item,
              planned,
              block,
              exercise: exercise + itemIndex,
            });
        });
      exercise += items.length;
    });
  }
  return steps;
}

/** The dumbbell or kettlebell setup an exercise is done with, from the first usable setup. */
export function implementOf(
  exercise: Exercise,
  capabilities: EquipmentCapabilities,
): { kind: 'dumbbell' | 'kettlebell'; count: 1 | 2 } | undefined {
  const setup = usableSetups(exercise, capabilities)[0] ?? exercise.equipment[0] ?? [];
  const req = setup.find((r) => r.kind === 'dumbbell' || r.kind === 'kettlebell');
  if (!req) return undefined;
  return { kind: req.kind as 'dumbbell' | 'kettlebell', count: req.count === 2 ? 2 : 1 };
}

/** What the edit sheet offers to change a set's load: the weights or bands owned for the exercise. */
export type LoadOptions =
  { kind: 'kg'; weights: number[] } | { kind: 'band'; levels: BandLevel[] } | { kind: 'none' };

export function loadOptions(
  exercise: Exercise | undefined,
  load: Load | undefined,
  inventory: EquipmentInventory,
): LoadOptions {
  if (load?.kind === 'band') {
    const owned = new Set(
      inventory.flatMap((item) =>
        item.kind === 'band' || item.kind === 'mini-band' ? item.levels : [],
      ),
    );
    return { kind: 'band', levels: BAND_LEVELS.filter((level) => owned.has(level)) };
  }
  if (load?.kind === 'kg' && exercise) {
    const implement = implementOf(exercise, equipmentCapabilities(inventory));
    if (implement)
      return { kind: 'kg', weights: ownedWeights(inventory, implement.kind, implement.count) };
  }
  return { kind: 'none' };
}

/**
 * The week's per-set changes, resolved against the equipment owned when the session starts:
 * back-off loads are snapped down to an owned weight, and dropped when none is lighter or the
 * nearest one is too far below.
 */
export function setAdjustments(
  plan: Pick<WeekPlan, 'session' | 'setRir' | 'backOffLoadFactor'>,
  inventory: EquipmentInventory,
  exerciseById: ReadonlyMap<string, Exercise> = catalogueById,
): SetAdjustments | undefined {
  const adjustments: SetAdjustments = {
    ...(plan.setRir.first !== undefined && { firstSetRir: plan.setRir.first }),
    ...(plan.setRir.last !== undefined && { lastSetRir: plan.setRir.last }),
  };
  const factor = plan.backOffLoadFactor;
  if (factor !== undefined) {
    const capabilities = equipmentCapabilities(inventory);
    const loads: Record<string, Load> = {};
    plan.session.main.forEach((block, blockIndex) =>
      itemsOf(block).forEach((item, itemIndex) => {
        if (!takesSetRir('main', item.target) || item.load?.kind !== 'kg') return;
        // Back-off sets follow a top set harder than the rest; an item already that hard has none.
        const first = plan.setRir.first;
        if (first !== undefined && item.rir !== undefined && item.rir <= first) return;
        const exercise = exerciseById.get(item.exerciseId);
        const implement = exercise && implementOf(exercise, capabilities);
        if (!implement) return;
        const weights = ownedWeights(inventory, implement.kind, implement.count);
        const kg = snapDown(weights, item.load.kg * factor);
        // A jump down too far (coarse fixed weights) is no back-off: keep the load, let reps fall.
        if (kg !== undefined && kg < item.load.kg && kg >= item.load.kg * MIN_BACK_OFF_SHARE)
          loads[itemKey('main', blockIndex, itemIndex)] = { kind: 'kg', kg };
      }),
    );
    if (Object.keys(loads).length > 0) adjustments.backOffLoads = loads;
  }
  return Object.keys(adjustments).length > 0 ? adjustments : undefined;
}

/** Number of distinct exercises in the session. */
export const exerciseCount = (steps: readonly PlayStep[]): number =>
  steps.length === 0 ? 0 : steps[steps.length - 1]!.exercise + 1;

const sameItem = (a: PlayStep, b: PlayStep) =>
  a.section === b.section && a.blockIndex === b.blockIndex && a.itemIndex === b.itemIndex;
const sameBlock = (a: PlayStep, b: PlayStep) =>
  a.section === b.section && a.blockIndex === b.blockIndex;

/**
 * The pause between the step just done and the next one to run. Steps skipped in between
 * (an exercise stopped mid-circuit) don't matter: only the two ends do.
 * After a block, the rest is the block's own rest, but never shorter than the move to the next
 * block, as the duration estimate counts it.
 */
export function pauseBetween(done: PlayStep, next: PlayStep | undefined): Pause {
  if (!next) return { kind: 'end', seconds: 0 };
  if (sameBlock(done, next)) {
    if (done.set === next.set) {
      if (sameItem(done, next))
        return { kind: 'side', seconds: sideSwitchSec(done.item.exerciseId) };
      if (done.block.type === 'group')
        return { kind: 'item', seconds: done.block.restBetweenItemsSec };
    }
    return { kind: 'rest', seconds: roundRestOf(done.block) };
  }
  return { kind: 'block', seconds: blockTransitionSec(done.block, transitionInto(next.section)) };
}

/** Index of the first step with no set logged; `steps.length` when everything is logged. */
export function resumeIndex(steps: readonly PlayStep[], sets: readonly SetLog[]): number {
  const logged = new Set(sets.map(setLogKey));
  const index = steps.findIndex((step) => !logged.has(setLogKey(step)));
  return index === -1 ? steps.length : index;
}

/** The step at `index` and every later step of the same exercise: what stopping the exercise ends. */
export function restOfExercise(steps: readonly PlayStep[], index: number): PlayStep[] {
  const from = steps[index];
  return from ? steps.slice(index).filter((step) => sameItem(step, from)) : [];
}

/**
 * The value a set aims at today: its goal, else the bottom of its range, so that one tap never
 * claims more than was planned. Undefined for targets without a single goal (as many as
 * possible, cardio).
 */
export function setGoal(planned: Pick<SetPrescription, 'target' | 'goal'>): number | undefined {
  const { target } = planned;
  if (target.kind !== 'reps' && target.kind !== 'time') return undefined;
  return planned.goal ?? (target.kind === 'reps' ? target.min : target.minSec);
}

/**
 * What "done as planned" records: the goal at the planned load. Undefined when the set needs
 * input (as many reps as possible) or a timer (cardio, intervals).
 */
export function asPlanned(planned: SetPrescription): SetActual | undefined {
  const goal = setGoal(planned);
  if (goal === undefined) return undefined;
  const load = planned.load && { load: planned.load };
  return planned.target.kind === 'reps' ? { reps: goal, ...load } : { durationSec: goal, ...load };
}

/** The SetLog fields that identify and describe a step, before what was done is known. */
export function setLogBase(step: PlayStep): Omit<SetLog, 'actual' | 'feel' | 'flag' | 'at'> {
  return {
    section: step.section,
    blockIndex: step.blockIndex,
    itemIndex: step.itemIndex,
    set: step.set,
    ...(step.side && { side: step.side }),
    exerciseId: step.item.exerciseId,
    planned: step.planned,
  };
}

export interface SessionTotals {
  /** Main sets planned and accounted for (performed, or ended by pain or missing equipment); both sides make one set. */
  main: { planned: number; done: number };
  /** Performed sets of main and finisher exercises, cardio aside; both sides make one set. */
  hardSets: number;
  /** Reps over main and finisher sets, both sides counted. */
  totalReps: number;
  /** Σ reps × kg over main and finisher sets, a pair of dumbbells counted twice. 0 for bodyweight and bands. */
  volumeKg: number;
  /** Exercises ended by pain or missing equipment, in session order. */
  stopped: { exerciseId: string; flag: Exclude<SetFlag, 'skipped'> }[];
}

const isCardio = (target: Target) => target.kind === 'cardio' || target.kind === 'interval';

export function sessionTotals(
  log: Pick<SessionLog, 'plan' | 'adjustments' | 'sets'>,
  inventory: EquipmentInventory = [],
  exerciseById: ReadonlyMap<string, Exercise> = catalogueById,
): SessionTotals {
  const steps = playSteps(log.plan, log.adjustments);
  const byKey = new Map(log.sets.map((set) => [setLogKey(set), set]));
  const capabilities = equipmentCapabilities(inventory);
  const implementsOf = (exerciseId: string) => {
    const exercise = exerciseById.get(exerciseId);
    return (exercise && implementOf(exercise, capabilities)?.count) ?? 1;
  };

  // One unit per set: the two sides of a per-side set together.
  const units = new Map<string, { step: PlayStep; logs: (SetLog | undefined)[] }>();
  for (const step of steps) {
    const key = setLogKey({ ...step, side: undefined });
    const unit = units.get(key) ?? { step, logs: [] };
    unit.logs.push(byKey.get(setLogKey(step)));
    units.set(key, unit);
  }

  const totals: SessionTotals = {
    main: { planned: 0, done: 0 },
    hardSets: 0,
    totalReps: 0,
    volumeKg: 0,
    stopped: [],
  };
  const stoppedItems = new Set<string>();
  for (const { step, logs } of units.values()) {
    if (step.section === 'main') {
      totals.main.planned++;
      if (logs.every((set) => set)) totals.main.done++;
    }
    const flag = logs.find((set) => set?.flag)?.flag;
    const exerciseKey = itemKey(step.section, step.blockIndex, step.itemIndex);
    if (flag && flag !== 'skipped' && !stoppedItems.has(exerciseKey)) {
      stoppedItems.add(exerciseKey);
      totals.stopped.push({ exerciseId: step.item.exerciseId, flag });
    }
    if (step.section === 'warmup' || isCardio(step.planned.target)) continue;
    if (logs.some((set) => set?.actual && !set.flag)) totals.hardSets++;
    for (const set of logs) {
      const reps = set?.actual?.reps ?? 0;
      const load = set?.actual?.load;
      totals.totalReps += reps;
      if (load?.kind === 'kg')
        totals.volumeKg += reps * load.kg * implementsOf(step.item.exerciseId);
      if (load?.kind === 'added-kg') totals.volumeKg += reps * load.kg;
    }
  }
  totals.volumeKg = Math.round(totals.volumeKg * 10) / 10;
  return totals;
}

/** A session finished early still moves the rotation on, by default, when at least half its main sets are accounted for. */
export const countsAsDoneByDefault = (totals: SessionTotals): boolean =>
  totals.main.planned > 0 && totals.main.done * 2 >= totals.main.planned;

/** Time spent in the session, pauses excluded. */
export function activeSeconds(
  log: Pick<SessionLog, 'startedAt' | 'endedAt' | 'pausedSec' | 'pausedAt'>,
  now: Date = new Date(),
): number {
  const end = log.endedAt ? Date.parse(log.endedAt) : now.getTime();
  const running = log.pausedAt ? Math.max(0, end - Date.parse(log.pausedAt)) : 0;
  const ms = end - Date.parse(log.startedAt) - running - (log.pausedSec ?? 0) * 1000;
  return Math.max(0, Math.round(ms / 1000));
}
