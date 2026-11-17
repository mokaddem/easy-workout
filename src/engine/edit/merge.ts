import type { Block, Exercise, Programme, Session, SessionItem } from '../../domain';
import { sessionMinutes } from '../duration';
import { fitTarget, redose } from '../generate/dose';
import { BLOCKING_CONCERNS, exerciseSafety, isExerciseSafe } from '../generate/safety';
import { levelCap } from '../generate/select';
import { MAX_SETS } from './check';
import { replacementItem, substitutesFor } from '../progress/swaps';
import { checkSession, issueKey, type Issue } from './check';
import { defaultBlock, loadContext, type EditContext } from './dose';
import { refreshRampUps } from './ramps';
import { bySlot, restoreSlot, sameValue, sessionEdited, tidy, type Located } from './rotation';
import {
  ensureSlots,
  isRampSlot,
  itemsOf,
  programmeWithSlots,
  SECTIONS,
  type Section,
} from './slots';

/** One of the user's changes, as a regeneration carries it over or drops it. */
export interface CarriedEdit {
  sessionId: string;
  kind: 'exercise' | 'dose' | 'added' | 'removed' | 'placement' | 'session';
  slot?: string;
  /** The user's exercise (or, for a removal, the one left out). */
  exerciseId?: string;
  /** Why it was dropped: the session or the slot no longer exists, or the exercise isn't usable. */
  reason?: 'session-gone' | 'slot-gone' | 'unusable';
}

export interface CarryResult<P extends Programme> {
  programme: P;
  kept: CarriedEdit[];
  dropped: CarriedEdit[];
  /** What the merged sessions now warn about, by session id. */
  issues: Record<string, Issue[]>;
}

const countOf = (b: Block) => (b.type === 'straight' ? b.sets : b.rounds);
const restOf = (b: Block) => (b.type === 'straight' ? b.restSec : b.restAfterRoundSec);

interface Merge {
  ctx: EditContext;
  sessionId: string;
  kept: CarriedEdit[];
  dropped: CarriedEdit[];
  /** Exercises swapped away for pain: never brought in as a substitute. */
  painful: ReadonlySet<string>;
  /** The person and equipment the previous programme was made for. */
  previous: EditContext;
  /** Straight blocks of exercises the user added and never re-dosed: dosed again for now. */
  redosed: Map<string, Block>;
}

/**
 * The exercise can still be done here: safe with the equipment, and, outside the warm-up, a
 * weighted lift has a weight that fits (unloaded, it would be pointless).
 */
const usable = (m: Merge, exerciseId: string, section: Section) => {
  const e = m.ctx.exercises.get(exerciseId);
  if (!e) return false;
  const { concern } = exerciseSafety(e, loadContext(m.ctx), section === 'warmup');
  if (!concern) return true;
  return !BLOCKING_CONCERNS.has(concern) && concern !== 'no-fitting-load';
};

/**
 * One item: the user's changed fields on top of the new generation. A replaced exercise is
 * re-dosed from the new slot unless the user also set its range; a kept range is fitted to the
 * exercise it now applies to.
 */
function mergeItem(
  m: Merge,
  mine: SessionItem,
  base: SessionItem,
  fresh: SessionItem,
  section: Section,
  leads: boolean,
): SessionItem {
  const ex = (id: string) => m.ctx.exercises.get(id);
  const slot = mine.slot ?? '';
  const myEx = ex(mine.exerciseId);
  const baseEx = ex(base.exerciseId);
  const freshEx = ex(fresh.exerciseId);
  if (!myEx || !baseEx || !freshEx) return fresh;

  if (mine.exerciseId !== base.exerciseId) {
    if (!usable(m, mine.exerciseId, section)) {
      m.dropped.push({
        sessionId: m.sessionId,
        kind: 'exercise',
        slot,
        exerciseId: mine.exerciseId,
        reason: 'unusable',
      });
      return fresh;
    }
    m.kept.push({ sessionId: m.sessionId, kind: 'exercise', slot, exerciseId: mine.exerciseId });
    const swapped =
      fresh.exerciseId === mine.exerciseId
        ? fresh
        : replacementItem(fresh, freshEx, myEx, leads, {
            inventory: m.ctx.inventory,
            level: m.ctx.profile.level,
            ...(m.ctx.profile.bodyweightKg !== undefined && {
              bodyweightKg: m.ctx.profile.bodyweightKg,
            }),
          });
    // The range the replacement got back then, unless the user set another one.
    const rangeSet = !sameValue(mine.target, redose(base, baseEx, myEx).target);
    return {
      ...swapped,
      ...(rangeSet && { target: fitTarget(mine.target, myEx) }),
      ...(mine.rir !== base.rir && rirOf(mine)),
    };
  }

  const rangeSet = !sameValue(mine.target, base.target);
  const rirSet = mine.rir !== base.rir;
  if (rangeSet || rirSet)
    m.kept.push({ sessionId: m.sessionId, kind: 'dose', slot, exerciseId: fresh.exerciseId });
  const next: SessionItem = {
    ...fresh,
    ...(rangeSet && { target: fitTarget(mine.target, freshEx) }),
  };
  if (rirSet) {
    delete next.rir;
    Object.assign(next, rirOf(mine));
  }
  return next;
}

const rirOf = (item: SessionItem) => (item.rir === undefined ? {} : { rir: item.rir });

/** The block the user arranged, its sets and rests from the new generation unless they set them. */
function mergeBlock(
  m: Merge,
  mine: Block,
  items: SessionItem[],
  base: Session,
  fresh: Session,
): Block | undefined {
  if (items.length === 0) return undefined;
  const again = mine.type === 'straight' ? m.redosed.get(mine.item.slot ?? '') : undefined;
  if (again?.type === 'straight')
    return { type: 'straight', item: items[0]!, sets: again.sets, restSec: again.restSec };
  const lead = mine.type === 'straight' ? mine.item.slot : mine.items[0]!.slot;
  const was = lead ? bySlot(base).get(lead)?.block : undefined;
  const now = items[0]?.slot ? bySlot(fresh).get(items[0].slot)?.block : undefined;
  const sameShape = was && was.type === mine.type && sameValue(slotsOf(was), slotsOf(mine));
  const countSet = !sameShape || countOf(mine) !== countOf(was);
  const restSet = !sameShape || restOf(mine) !== restOf(was);
  // Sets the user changed carry as a change on top of the new dose (a level drop still lowers them).
  // A block the user only chained runs for the largest count its exercises now have.
  const counts = (session: Session) =>
    itemsOf(mine)
      .map((i) => bySlot(session).get(i.slot ?? '')?.block)
      .filter((x): x is Block => !!x)
      .map(countOf);
  const regroupedOnly =
    !sameShape && counts(base).length > 0 && countOf(mine) === Math.max(...counts(base));
  const count =
    regroupedOnly && counts(fresh).length > 0
      ? Math.max(...counts(fresh))
      : !now
        ? countOf(mine)
        : !sameShape
          ? countOf(mine)
          : countSet
            ? Math.min(MAX_SETS, Math.max(1, countOf(now) + countOf(mine) - countOf(was)))
            : countOf(now);
  const rest = restSet || !now ? restOf(mine) : restOf(now);
  if (sameShape && (countOf(mine) !== countOf(was) || restOf(mine) !== restOf(was)))
    if (!m.kept.some((k) => k.sessionId === m.sessionId && k.slot === lead && k.kind === 'dose'))
      m.kept.push({ sessionId: m.sessionId, kind: 'dose', ...(lead && { slot: lead }) });
  if (items.length === 1 || mine.type === 'straight')
    return { type: 'straight', item: items[0]!, sets: count, restSec: rest };
  const between =
    mine.restBetweenItemsSec !== (was?.type === 'group' ? was.restBetweenItemsSec : undefined) ||
    now?.type !== 'group'
      ? mine.restBetweenItemsSec
      : now.restBetweenItemsSec;
  return {
    type: 'group',
    style: items.length === 2 ? mine.style : 'circuit',
    items,
    rounds: count,
    restBetweenItemsSec: between,
    restAfterRoundSec: rest,
  };
}

const slotsOf = (b: Block) => itemsOf(b).map((i) => i.slot);

/**
 * An exercise the user added, as they left it — unless they kept the dose it was given: then it
 * is dosed again for the new profile (a level drop lowers it too).
 */
function redoseAdded(
  m: Merge,
  item: SessionItem,
  block: Block,
  section: Section,
  blockIndex: number,
): SessionItem {
  const exercise = m.ctx.exercises.get(item.exerciseId);
  if (!exercise || block.type !== 'straight' || !item.slot) return item;
  const leads = section === 'main' && blockIndex === 0;
  const given = defaultBlock(exercise, section, item.slot, m.previous, leads);
  if (
    given.type !== 'straight' ||
    !sameValue(given.item.target, item.target) ||
    given.item.rir !== item.rir ||
    given.sets !== block.sets ||
    given.restSec !== block.restSec
  )
    return item;
  const now = defaultBlock(exercise, section, item.slot, m.ctx, leads);
  if (now.type !== 'straight') return item;
  m.redosed.set(item.slot, now);
  return now.item;
}

/** The user's version of a session carried onto its new generation. */
function mergeSession(m: Merge, base: Session, mine: Session, fresh: Session): Session {
  const baseBy = bySlot(base);
  const mineBy = bySlot(mine);
  const freshBy = bySlot(fresh);
  const out: Record<Section, Block[]> = { warmup: [], main: [], finisher: [] };

  for (const section of SECTIONS)
    mine[section].forEach((block, blockIndex) => {
      const items: SessionItem[] = [];
      for (const item of itemsOf(block)) {
        const slot = item.slot ?? '';
        if (isRampSlot(slot)) continue;
        const b = baseBy.get(slot);
        const f = freshBy.get(slot);
        if (!b) {
          if (usable(m, item.exerciseId, section)) {
            items.push(redoseAdded(m, item, block, section, blockIndex));
            m.kept.push({
              sessionId: m.sessionId,
              kind: 'added',
              slot,
              exerciseId: item.exerciseId,
            });
          } else
            m.dropped.push({
              sessionId: m.sessionId,
              kind: 'added',
              slot,
              exerciseId: item.exerciseId,
              reason: 'unusable',
            });
          continue;
        }
        if (!f) {
          const changed =
            item.exerciseId !== b.item.exerciseId ||
            !sameValue(item.target, b.item.target) ||
            item.rir !== b.item.rir;
          if (changed)
            m.dropped.push({
              sessionId: m.sessionId,
              kind: item.exerciseId !== b.item.exerciseId ? 'exercise' : 'dose',
              slot,
              exerciseId: item.exerciseId,
              reason: 'slot-gone',
            });
          continue;
        }
        const leads = section === 'main' && blockIndex === 0 && items.length === 0;
        items.push(mergeItem(m, item, b.item, f.item, section, leads));
      }
      const merged = mergeBlock(m, block, items, base, fresh);
      if (merged) out[section].push(merged);
    });

  // Slots the user took out stay out.
  for (const [slot, b] of baseBy)
    if (!mineBy.has(slot) && !isRampSlot(slot) && freshBy.has(slot))
      m.kept.push({ sessionId: m.sessionId, kind: 'removed', slot, exerciseId: b.item.exerciseId });

  // Slots new in this generation go where the generation put them, unless an exercise the user
  // added already does that job (same pattern, a primary muscle in common).
  // Only additions that were kept, and only in the same section (a warm-up drill never stands
  // in for main work).
  const addedJobs = [...mineBy.values()]
    .filter(
      (l) =>
        !baseBy.has(l.item.slot ?? '') &&
        l.section !== 'warmup' &&
        m.kept.some(
          (k) => k.sessionId === m.sessionId && k.kind === 'added' && k.slot === l.item.slot,
        ),
    )
    .map((l) => ({ section: l.section, exercise: m.ctx.exercises.get(l.item.exerciseId) }))
    .filter((a): a is { section: Section; exercise: Exercise } => !!a.exercise);
  const covered = (i: SessionItem, section: Section) => {
    const e = m.ctx.exercises.get(i.exerciseId);
    return (
      !!e &&
      addedJobs.some(
        ({ section: s, exercise: a }) =>
          s === section &&
          a.pattern === e.pattern &&
          a.primaryMuscles.some((x) => e.primaryMuscles.includes(x)),
      )
    );
  };
  for (const section of SECTIONS)
    fresh[section].forEach((block, blockIndex) => {
      const fresh_ = itemsOf(block).filter(
        (i) =>
          i.slot &&
          !baseBy.has(i.slot) &&
          !mineBy.has(i.slot) &&
          !isRampSlot(i.slot) &&
          !covered(i, section),
      );
      if (fresh_.length === 0) return;
      const added: Block =
        fresh_.length === itemsOf(block).length
          ? block
          : fresh_.length === 1
            ? { type: 'straight', item: fresh_[0]!, sets: countOf(block), restSec: restOf(block) }
            : { ...(block as Extract<Block, { type: 'group' }>), items: fresh_ };
      out[section].splice(anchorIndex(out[section], fresh[section], blockIndex), 0, added);
    });

  const ramps = fresh.warmup.filter((b) => b.type === 'straight' && isRampSlot(b.item.slot));
  let merged: Session = { ...mine, ...out, warmup: [...out.warmup, ...ramps] };

  // A replacement that can't be carried no longer does the job of what the user took out for
  // it: what the new generation has for that movement comes back.
  const lostPatterns = new Set(
    m.dropped
      .filter((d) => d.sessionId === m.sessionId && d.reason === 'unusable' && d.exerciseId)
      .map((d) => m.ctx.exercises.get(d.exerciseId!)?.pattern),
  );
  for (const [slot, b] of baseBy) {
    const f = freshBy.get(slot);
    if (mineBy.has(slot) || isRampSlot(slot) || !f) continue;
    if (!lostPatterns.has(m.ctx.exercises.get(f.item.exerciseId)?.pattern)) continue;
    merged = restoreSlot(merged, fresh, slot);
    const at = m.kept.findIndex(
      (k) => k.sessionId === m.sessionId && k.kind === 'removed' && k.slot === slot,
    );
    if (at >= 0) m.kept.splice(at, 1);
    m.dropped.push({
      sessionId: m.sessionId,
      kind: 'removed',
      slot,
      exerciseId: b.item.exerciseId,
      reason: 'unusable',
    });
  }
  merged = refreshRampUps(merged, fresh, m.ctx);
  merged = withoutRepeats(m, merged, fresh);
  return { ...merged, id: fresh.id, estimatedMinutes: sessionMinutes(merged) };
}

/** After the nearest earlier block of the new generation that is in the result; else first. */
function anchorIndex(result: Block[], fresh: Block[], blockIndex: number): number {
  for (let i = blockIndex - 1; i >= 0; i--) {
    const slots = new Set(slotsOf(fresh[i]!));
    const at = result.findIndex((b) => slotsOf(b).some((s) => slots.has(s)));
    if (at >= 0) return at + 1;
  }
  return 0;
}

/**
 * An exercise the new generation picked that the user already does elsewhere in the session
 * gives way to another one for the same job.
 */
function withoutRepeats(m: Merge, session: Session, fresh: Session): Session {
  const freshBy = bySlot(fresh);
  const fromUser = (l: Located) => {
    const f = freshBy.get(l.item.slot ?? '');
    return !f || f.item.exerciseId !== l.item.exerciseId;
  };
  const located = [...bySlot(session).values()].filter((l) => l.section !== 'warmup');
  const userIds = new Set(located.filter(fromUser).map((l) => l.item.exerciseId));
  const taken = new Set(located.map((l) => l.item.exerciseId));
  const replace = new Map<string, SessionItem>();
  for (const l of located) {
    if (fromUser(l) || !userIds.has(l.item.exerciseId)) continue;
    const was: Exercise | undefined = m.ctx.exercises.get(l.item.exerciseId);
    const other =
      was &&
      substitutesFor(was, m.ctx.inventory, {
        avoid: new Set([...taken, ...m.painful]),
        exercises: [...m.ctx.exercises.values()],
      }).find(
        (e) =>
          isExerciseSafe(e, loadContext(m.ctx), l.section === 'warmup') &&
          e.difficulty <= levelCap(m.ctx.profile.level, e),
      );
    if (!was || !other) continue;
    taken.add(other.id);
    replace.set(
      l.item.slot ?? '',
      replacementItem(l.item, was, other, l.section === 'main' && l.blockIndex === 0, {
        inventory: m.ctx.inventory,
        level: m.ctx.profile.level,
        ...(m.ctx.profile.bodyweightKg !== undefined && {
          bodyweightKg: m.ctx.profile.bodyweightKg,
        }),
      }),
    );
  }
  if (replace.size === 0) return session;
  const swap = (b: Block): Block =>
    b.type === 'straight'
      ? { ...b, item: replace.get(b.item.slot ?? '') ?? b.item }
      : { ...b, items: b.items.map((i) => replace.get(i.slot ?? '') ?? i) };
  return { ...session, main: session.main.map(swap), finisher: session.finisher.map(swap) };
}

/**
 * Carries the user's changes from a programme onto its regeneration (new profile, equipment or
 * cycle): edits by session and slot, field by field; their own sessions by place. What can't be
 * carried is listed, never dropped silently. `customIds`: the user's sessions that still exist.
 */
export function carryEdits<P extends Programme>(
  previous: Programme,
  next: P,
  ctx: EditContext,
  customIds: ReadonlySet<string> = new Set(),
  options: { painful?: ReadonlySet<string> } = {},
): CarryResult<P> {
  const prev = programmeWithSlots(previous);
  const fresh = programmeWithSlots(next);
  const before: EditContext = {
    profile: prev.generation?.profile ?? ctx.profile,
    inventory: prev.generation?.equipment ?? ctx.inventory,
    exercises: ctx.exercises,
  };
  const result: CarryResult<P> = { programme: fresh, kept: [], dropped: [], issues: {} };
  if (!prev.generatedRotation) return result;

  const placements: Record<string, string> = {};
  const rotation = fresh.rotation.map((session) => {
    const i = prev.rotation.findIndex((s) => s.id === session.id);
    if (i < 0) return session;
    const m: Merge = {
      ctx,
      sessionId: session.id,
      kept: result.kept,
      dropped: result.dropped,
      painful: options.painful ?? new Set(),
      previous: before,
      redosed: new Map(),
    };
    const placed = prev.placements?.[session.id];
    if (placed) {
      if (!customIds.has(placed)) return session;
      const copy = ensureSlots({ ...prev.rotation[i]!, id: session.id });
      const issues = checkSession(copy, ctx, { inProgramme: true });
      // A session of the user's own that can't be run safely any more gives its place back.
      if (issues.some((x) => x.level === 'block')) {
        result.dropped.push({ sessionId: session.id, kind: 'placement', reason: 'unusable' });
        return session;
      }
      placements[session.id] = placed;
      result.kept.push({ sessionId: session.id, kind: 'placement' });
      // Only what the new profile or equipment brings: the rest the user saw when they built it.
      const known = new Set(
        checkSession(copy, before, { inProgramme: true }).map((x) => issueKey(x)),
      );
      result.issues[session.id] = issues.filter((x) => !known.has(issueKey(x)));
      return copy;
    }
    const base = prev.generatedRotation![i]!;
    const mine = prev.rotation[i]!;
    if (!sessionEdited(mine, base)) return session;
    const merged = mergeSession(m, base, mine, session);
    // Only what the regeneration brings: warnings the user's version already had (they saw
    // them while editing) and those they dismissed stay quiet.
    const known = new Set([
      ...checkSession(mine, before, { base, inProgramme: true }).map((x) => issueKey(x)),
      ...(mine.dismissedIssues ?? []),
    ]);
    result.issues[session.id] = checkSession(merged, ctx, {
      base: session,
      inProgramme: true,
    }).filter((x) => !known.has(issueKey(x)));
    return merged;
  });

  for (const [i, s] of prev.rotation.entries()) {
    if (fresh.rotation.some((f) => f.id === s.id)) continue;
    if (prev.placements?.[s.id] || sessionEdited(s, prev.generatedRotation[i]!))
      result.dropped.push({ sessionId: s.id, kind: 'session', reason: 'session-gone' });
  }

  result.programme = tidy({
    ...fresh,
    rotation,
    generatedRotation: fresh.rotation,
    placements,
  });
  return result;
}
