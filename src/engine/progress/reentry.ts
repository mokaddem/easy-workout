import type { Block, MaxTest, Programme, Session, SessionLog } from '../../domain';
import { testWeeks } from '../maxtest';
import { phaseForWeek, scaleVolume } from '../week';
import { daysSinceTraining, lastGapEnd, programmeTimes } from './exposures';
import { isTravelLog } from './stamps';

/** Share of the usual sets a session runs at when the programme comes back after a long break. */
export const REENTRY_FACTOR = 0.7;
/** A break longer than this many days starts a re-entry rotation. */
export const REENTRY_GAP_DAYS = 28;
/** A break longer than this many days offers to start the programme again from week 1. */
export const RESTART_GAP_DAYS = 84;

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * The share of the usual volume the next programme session runs at after a long break, or
 * nothing. The rotation starts when the programme's last gap over 28 days ends (the session
 * that came back, or the one being prepared) and covers the first `sessionsPerWeek` programme
 * sessions after it that count as done. Each session carries its factor as a stamp, and the
 * stamps are what is read here: deleting a session never changes what the others got.
 */
export function reentryFor(
  logs: readonly SessionLog[],
  sessionsPerWeek: number,
  now: Date,
): number | undefined {
  const anchor = lastGapEnd(programmeTimes(logs), now.getTime(), REENTRY_GAP_DAYS);
  if (anchor === undefined) return undefined;
  let stamped = 0;
  for (const log of logs) {
    if (log.source.kind !== 'programme' || Date.parse(log.startedAt) < anchor) continue;
    if (log.status !== 'completed' || log.countsAsDone === false) continue;
    // A session at the full volume ran after the break: the rotation is over.
    if (log.adjustments?.reentry === undefined) return undefined;
    stamped++;
  }
  return stamped < sessionsPerWeek ? REENTRY_FACTOR : undefined;
}

/** The volume factor a week already applies (a deload or a lighter week), when it lightens sets. */
export function weekVolumeFactor(programme: Programme, week: number): number | undefined {
  const factors = (phaseForWeek(programme, week)?.adjustments ?? []).flatMap((a) =>
    a.kind === 'volume' && a.factor < 1 ? [a.factor] : [],
  );
  return factors.length > 0 ? Math.min(...factors) : undefined;
}

const fewer = (a: Block, b: Block): Block => {
  if (a.type === 'straight' && b.type === 'straight') {
    const ta = a.item.target;
    const tb = b.item.target;
    const item =
      ta.kind === 'interval' && tb.kind === 'interval'
        ? { ...a.item, target: { ...ta, rounds: Math.min(ta.rounds, tb.rounds) } }
        : a.item;
    return { ...a, sets: Math.min(a.sets, b.sets), item };
  }
  if (a.type === 'group' && b.type === 'group')
    return { ...a, rounds: Math.min(a.rounds, b.rounds) };
  return a;
};

/**
 * The session at the re-entry volume: sets and group rounds to 70 % (nearest, minimum 1),
 * interval rounds to 70 % (minimum 3), steady cardio and the warm-up as they were. A week that
 * already lightens volume (`weekFactor`, from `base`, the session before the week was applied)
 * never stacks with it: the smaller of the two counts.
 */
export function applyReentry(
  session: Session,
  options: { base?: Session; weekFactor?: number; factor?: number } = {},
): Session {
  const factor = options.factor ?? REENTRY_FACTOR;
  const { weekFactor, base } = options;
  if (weekFactor !== undefined && weekFactor <= factor) return session;
  const scaled = (blocks: Block[], from: Block[] | undefined): Block[] =>
    blocks.map((block, i) => {
      const own = scaleVolume(block, factor, true);
      const root = weekFactor !== undefined ? from?.[i] : undefined;
      return root ? fewer(block, scaleVolume(root, factor, true)) : own;
    });
  return {
    ...session,
    main: scaled(session.main, base?.main),
    finisher: scaled(session.finisher, base?.finisher),
  };
}

/**
 * A card offers to start the programme again from week 1 when nothing has been trained for more
 * than 84 days. The interface regenerates with the same inputs and level; declined, the re-entry
 * rotation runs instead.
 */
export function restartOffer(
  logs: readonly SessionLog[],
  now: Date,
): { days: number; lastAt: string } | undefined {
  const days = daysSinceTraining(logs, now);
  const last = programmeTimes(logs).at(-1);
  return days !== undefined && last !== undefined && days > RESTART_GAP_DAYS
    ? { days: Math.floor(days), lastAt: iso(last) }
    : undefined;
}

/**
 * Test weeks whose max test was skipped because the session ran at the re-entry volume or away
 * from home, and not done since: "Test now" is offered for them.
 */
export function testSkippedWeeks(
  programme: Programme & { id: string },
  logs: readonly SessionLog[],
  maxTests: readonly MaxTest[],
): number[] {
  if (maxTests.some((t) => t.programmeId === programme.id && t.context === 'session' && !t.stopped))
    return [];
  return testWeeks(programme).filter((week) =>
    logs.some(
      (l) =>
        l.source.kind === 'programme' &&
        l.source.programmeId === programme.id &&
        l.source.week === week &&
        l.status !== 'in-progress' &&
        (l.adjustments?.reentry !== undefined || isTravelLog(l)),
    ),
  );
}
