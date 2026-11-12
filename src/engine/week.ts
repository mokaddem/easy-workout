import type { Block, Phase, Programme, Session, SessionItem } from '../domain';
import { sessionMinutes, sessionSeconds } from './duration';

/** A session as it runs in a given week of its programme. */
export interface WeekPlan {
  week: number;
  phase?: Phase;
  /** Sets, rounds, cardio length and whole-session RIR already applied. */
  session: Session;
  /** RIR for the first or last set of each rep-based main exercise, overriding the item's RIR. */
  setRir: { first?: number; last?: number };
  /**
   * With a hard first set, the sets after it are back-off sets at this share of its load
   * (snapped to an owned weight by whoever runs the session), so they don't slide to failure.
   */
  backOffLoadFactor?: number;
  /** Exercises to retest to the max at the end of this week. */
  maxTests: string[];
}

const isCardioItem = (item: SessionItem) =>
  item.target.kind === 'cardio' || item.target.kind === 'interval';

const isCardioBlock = (block: Block) => block.type === 'straight' && isCardioItem(block.item);

/** RIR only means something for sets counted in reps. */
const takesRir = (item: SessionItem) => item.target.kind === 'reps' || item.target.kind === 'max';

const mapItems = (block: Block, fn: (item: SessionItem) => SessionItem): Block =>
  block.type === 'straight'
    ? { ...block, item: fn(block.item) }
    : { ...block, items: block.items.map(fn) };

const scale = (count: number, factor: number) => Math.max(1, Math.round(count * factor));

/** Most sets of one exercise in a session, volume phase included. */
const maxSetsFor = (programme: Programme): number => {
  const level = programme.generation?.profile.level;
  return level === 'beginner' || level === 'returning' ? 4 : 5;
};

/**
 * Harder weeks may run this far over a generated programme's session budget; extra cardio
 * only fills the room the extra sets leave. Hand-written programmes have no budget.
 */
export const PHASE_BUDGET_CEILING = 1.25;

/** A generated session still fits its phase ceiling; hand-written programmes always do. */
const withinCeiling = (programme: Programme, session: Session): boolean => {
  const budget = programme.generation?.profile.sessionMinutes;
  return budget === undefined || sessionSeconds(session) / 60 <= budget * PHASE_BUDGET_CEILING;
};

/** Back-off sets after a hard first set. */
export const BACK_OFF_LOAD_FACTOR = 0.9;
/** Intervals are work-dense: phases lengthen them by half their rounds at most. */
const MAX_INTERVAL_GROWTH = 0.5;

const scaleBlock = (block: Block, factor: number): Block =>
  block.type === 'straight'
    ? { ...block, sets: scale(block.sets, factor) }
    : { ...block, rounds: scale(block.rounds, factor) };

const addCardioMinutes = (item: SessionItem, minutes: number): SessionItem => {
  const t = item.target;
  if (t.kind === 'cardio')
    return {
      ...item,
      target: { ...t, minMinutes: t.minMinutes + minutes, maxMinutes: t.maxMinutes + minutes },
    };
  if (t.kind === 'interval') {
    const extra = Math.min(
      Math.round((minutes * 60) / (t.workSec + t.recoverySec)),
      Math.round(t.rounds * MAX_INTERVAL_GROWTH),
    );
    return { ...item, target: { ...t, rounds: t.rounds + extra } };
  }

  return item;
};

export const phaseForWeek = (programme: Programme, week: number): Phase | undefined =>
  programme.phases.find((p) => p.fromWeek <= week && week <= p.toWeek);

/**
 * Applies the week's phase to one session of the rotation. Warm-ups are never changed;
 * set and volume changes skip cardio; deloads round sets to the nearest whole set, minimum 1.
 */
export const sessionForWeek = (programme: Programme, sessionId: string, week: number): WeekPlan => {
  const base = programme.rotation.find((s) => s.id === sessionId);
  if (!base) throw new Error(`no session ${sessionId} in programme ${programme.id}`);
  if (week < 1 || week > programme.weeks) throw new Error(`week ${week} outside the programme`);

  const phase = phaseForWeek(programme, week);
  let main = base.main;
  let finisher = base.finisher;
  const setRir: WeekPlan['setRir'] = {};
  const maxTests: string[] = [];
  let cardioMinutes = 0;

  for (const adjustment of phase?.adjustments ?? []) {
    switch (adjustment.kind) {
      case 'rir':
        if (adjustment.scope === 'all-sets')
          main = main.map((b) =>
            isCardioBlock(b)
              ? b
              : mapItems(b, (i) => (takesRir(i) ? { ...i, rir: adjustment.value } : i)),
          );
        else if (adjustment.scope === 'first-set') setRir.first = adjustment.value;
        else setRir.last = adjustment.value;
        break;
      case 'extra-sets': {
        const cap = maxSetsFor(programme);
        for (const index of adjustment.mainBlockIndexes) {
          const b = main[index];
          if (!b || isCardioBlock(b)) continue;
          const grown: Block =
            b.type === 'straight'
              ? { ...b, sets: Math.max(b.sets, Math.min(cap, b.sets + adjustment.add)) }
              : { ...b, rounds: Math.max(b.rounds, Math.min(cap, b.rounds + adjustment.add)) };
          const next = main.map((x, i) => (i === index ? grown : x));
          if (!withinCeiling(programme, { ...base, main: next, finisher })) continue;
          main = next;
        }
        break;
      }
      case 'volume':
        main = main.map((b) => (isCardioBlock(b) ? b : scaleBlock(b, adjustment.factor)));
        finisher = finisher.map((b) => (isCardioBlock(b) ? b : scaleBlock(b, adjustment.factor)));
        break;
      case 'cardio-minutes':
        // Applied last, so it can only use the time the other changes left.
        cardioMinutes += adjustment.addMinutes;
        break;
      case 'max-test':
        maxTests.push(...adjustment.exerciseIds);
        break;
    }
  }

  if (cardioMinutes > 0) {
    const budget = programme.generation?.profile.sessionMinutes;
    const room =
      budget === undefined
        ? cardioMinutes
        : Math.floor(
            budget * PHASE_BUDGET_CEILING - sessionSeconds({ ...base, main, finisher }) / 60,
          );
    const add = Math.min(cardioMinutes, Math.max(0, room));
    if (add > 0)
      finisher = finisher.map((b) =>
        isCardioBlock(b) ? mapItems(b, (i) => addCardioMinutes(i, add)) : b,
      );
  }

  const session: Session = { ...base, main, finisher };
  session.estimatedMinutes = sessionMinutes(session);
  return {
    week,
    ...(phase ? { phase } : {}),
    session,
    setRir,
    ...(setRir.first === undefined ? {} : { backOffLoadFactor: BACK_OFF_LOAD_FACTOR }),
    maxTests,
  };
};
