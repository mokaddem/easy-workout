import { setLogKey, type SessionLog } from '@/domain';
import { isRampSlot, playSteps, rampSharePct, type PlayStep } from '@/engine';

/** A warm-up step that belongs to the ramp-up sets of the session's first lift. */
export const isRampStep = (step: PlayStep | undefined): boolean =>
  !!step && step.section === 'warmup' && isRampSlot(step.item.slot);

export interface RampPosition {
  /** 1-based position of the set among the ramp sets of the lift. */
  set: number;
  count: number;
  /** Indices (into the steps) of the ramp sets of the lift. */
  from: number;
  to: number;
  /** The first working set's load, when it is a plain weight of the same lift. */
  workingKg?: number;
  /** This set's load as a share of it, to the nearest 5 %. */
  sharePct?: number;
}

/** Where a ramp step stands among the ramp sets of its lift (consecutive ramp steps); undefined for anything else. */
export function rampOf(
  steps: readonly PlayStep[],
  step: PlayStep | undefined,
): RampPosition | undefined {
  if (!step || !isRampStep(step)) return undefined;
  const at = steps.findIndex((s) => s.section === 'warmup' && s.blockIndex === step.blockIndex);
  if (at < 0) return undefined;
  let from = at;
  while (from > 0 && isRampStep(steps[from - 1])) from--;
  let to = at;
  while (to < steps.length - 1 && isRampStep(steps[to + 1])) to++;
  const count = to - from + 1;
  const lead = steps.find((s) => s.section === 'main');
  const working = lead?.planned.load;
  const kg = step.planned.load;
  const workingKg =
    lead && lead.item.exerciseId === step.item.exerciseId && working?.kind === 'kg'
      ? working.kg
      : undefined;
  return {
    set: at - from + 1,
    count,
    from,
    to,
    ...(workingKg !== undefined && { workingKg }),
    ...(workingKg !== undefined &&
      kg?.kind === 'kg' && { sharePct: rampSharePct(kg.kg, workingKg) }),
  };
}

/**
 * Warm-up items as the counter shows them: the ramp sets of one lift are a single item.
 * `current` is 1-based for a warm-up step.
 */
export function warmupCounter(
  steps: readonly PlayStep[],
  step: PlayStep,
): { current: number; total: number } {
  let units = 0;
  let current = 0;
  let previous: PlayStep | undefined;
  for (const s of steps) {
    if (s.section !== 'warmup') break;
    const joinsRamp = isRampStep(s) && isRampStep(previous);
    if (!previous || (s.exercise !== previous.exercise && !joinsRamp)) units++;
    if (s.blockIndex === step.blockIndex && s.itemIndex === step.itemIndex) current = units;
    previous = s;
  }
  return { current, total: units };
}

export interface RampSummary {
  /** Ramp sets planned for the session. */
  total: number;
  /** Ramp sets performed. */
  done: number;
  /** Ramp sets skipped, one by one or all at once. */
  skipped: number;
}

/**
 * What became of the session's ramp-up sets, for one line on the summary; undefined when there were
 * none or none was reached. Display only: they never count as work sets.
 */
export function rampSummary(
  log: Pick<SessionLog, 'plan' | 'adjustments' | 'sets'>,
): RampSummary | undefined {
  const byKey = new Map(log.sets.map((set) => [setLogKey(set), set]));
  const out: RampSummary = { total: 0, done: 0, skipped: 0 };
  for (const step of playSteps(log.plan, log.adjustments)) {
    if (!isRampStep(step)) continue;
    out.total++;
    const logged = byKey.get(setLogKey(step));
    if (logged?.flag === 'skipped') out.skipped++;
    else if (logged?.actual) out.done++;
  }
  return out.total > 0 && out.done + out.skipped > 0 ? out : undefined;
}
