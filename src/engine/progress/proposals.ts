import type { Answer, AnswerKind, Exercise, SessionItem } from '../../domain';
import type { Exposure } from './exposures';
import { ladderFor, loadAt, rungOf } from './ladder';
import { loadToken, note, type ItemResult, type LadderEnd } from './rules';
import {
  harderNeedsEquipment,
  harderVariantFor,
  substituteFor,
  variantFor,
  type Swaps,
} from './swaps';
import type { ProgressContext, Proposal } from './types';

/** Pain-free sessions after a pain stop before the exercise may get harder again. */
export const PAIN_FREE_EXPOSURES = 2;
/** A second pain stop within this many days counts as repeated. */
const PAIN_REPEAT_DAYS = 56;
/** A dismissed proposal comes back only after this many more sessions with the exercise. */
const DISMISS_EXPOSURES = 2;

const answerTo = (
  answers: readonly Answer[],
  exerciseId: string,
  kind: AnswerKind,
  logId: string,
) => answers.find((a) => a.exerciseId === exerciseId && a.kind === kind && a.logId === logId);

/** Where an exercise stands after its latest pain stop, while that still matters. */
export interface PainState {
  /** The session where it hurt. */
  exposure: Exposure;
  answer?: Answer['answer'];
  repeated: boolean;
  /** Sessions with the exercise since, without pain. */
  painFree: number;
}

/** Pain matters until it's swapped away or two sessions went by without it. */
export function painState(
  all: readonly Exposure[],
  answers: readonly Answer[],
): PainState | undefined {
  const index = all.findIndex((e) => e.pain);
  if (index < 0) return undefined;
  const exposure = all[index]!;
  const painFree = all.slice(0, index).filter((e) => !e.pain && e.evidence.length > 0).length;
  if (painFree >= PAIN_FREE_EXPOSURES) return undefined;
  const answer = answerTo(answers, exposure.exerciseId, 'pain', exposure.logId)?.answer;
  if (answer === 'swap') return undefined;
  const since = Date.parse(exposure.at) - PAIN_REPEAT_DAYS * 86_400_000;
  const repeated = all.filter((e) => e.pain && Date.parse(e.at) >= since).length >= 2;
  return { exposure, ...(answer && { answer }), repeated, painFree };
}

/** One step easier than an item: a lighter load, else fewer reps or seconds. */
export function lighterItem(
  item: SessionItem,
  exercise: Exercise,
  ctx: Pick<ProgressContext, 'inventory' | 'profile'>,
): SessionItem {
  const ladder = ladderFor(exercise, item.load, ctx.inventory, ctx.profile?.bodyweightKg);
  const rung = rungOf(ladder, item.load);
  if (ladder.kind !== 'none' && rung > 0) return { ...item, load: loadAt(ladder, rung - 1)! };
  if (item.target.kind === 'reps')
    return { ...item, goal: Math.max(1, (item.goal ?? item.target.min) - 2) };
  if (item.target.kind === 'time')
    return { ...item, goal: Math.max(5, (item.goal ?? item.target.minSec) - 10) };
  return item;
}

/**
 * While pain is pending or was answered "lighter" / "keep", the exercise stays at (or under)
 * what it was when it hurt, whatever its history says.
 */
export function holdForPain(
  result: ItemResult,
  pain: PainState,
  base: SessionItem,
  exercise: Exercise,
  ctx: Pick<ProgressContext, 'inventory' | 'profile'>,
): ItemResult {
  const hurt = pain.exposure.item;
  const sameSlot = hurt.target.kind === base.target.kind;
  const rirShift = (hurt.rir ?? 2) - (base.rir ?? 2);
  const at: SessionItem = sameSlot
    ? {
        ...result.item,
        ...(hurt.load && { load: hurt.load }),
        ...(hurt.goal !== undefined && { goal: Math.max(1, hurt.goal + rirShift) }),
      }
    : result.item;
  const lighter = pain.answer === undefined || pain.answer === 'lighter';
  const item = lighter ? lighterItem(at, exercise, ctx) : at;
  return {
    item,
    note: note(
      lighter ? 'pain-lighter' : 'hold-pain',
      {
        pending: pain.answer === undefined,
        load: loadToken(item.load),
        painFree: pain.painFree,
        needed: PAIN_FREE_EXPOSURES,
      },
      lighter && loadToken(item.load) !== loadToken(at.load),
    ),
  };
}

const exposuresAfter = (all: readonly Exposure[], logId: string) => {
  const index = all.findIndex((e) => e.logId === logId);
  return index < 0 ? all.length : index;
};

/** A dismissed proposal stays away until the exercise has been done a couple more times. */
const suppressed = (
  answers: readonly Answer[],
  exerciseId: string,
  kind: AnswerKind,
  logId: string,
  all: readonly Exposure[],
): boolean => {
  if (answerTo(answers, exerciseId, kind, logId)) return true;
  const dismissed = [...answers]
    .filter((a) => a.exerciseId === exerciseId && a.kind === kind && a.answer === 'dismiss')
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  return !!dismissed?.logId && exposuresAfter(all, dismissed.logId) < DISMISS_EXPOSURES;
};

/** Pain and no-equipment stops waiting for an answer. */
export function flagProposals(
  exercise: Exercise,
  all: readonly Exposure[],
  ctx: Pick<ProgressContext, 'answers' | 'inventory' | 'profile'>,
  swaps: Swaps,
): Proposal[] {
  const out: Proposal[] = [];
  const pain = painState(all, ctx.answers);
  if (pain && pain.answer === undefined) {
    const substitute = substituteFor(exercise, ctx.inventory, { pain: true, avoid: swaps.painful });
    const lighter = lighterItem(pain.exposure.item, exercise, ctx);
    out.push({
      kind: 'pain',
      exerciseId: exercise.id,
      logId: pain.exposure.logId,
      ...(substitute && { substituteId: substitute.id }),
      lighter: note('pain-lighter', {
        from: loadToken(pain.exposure.item.load),
        to: loadToken(lighter.load),
        ...(lighter.goal !== undefined && { goal: lighter.goal }),
      }),
      ...(pain.repeated && { repeated: true }),
    });
  }
  const latest = all[0];
  if (latest?.noEquipment && !answerTo(ctx.answers, exercise.id, 'no-equipment', latest.logId)) {
    const substitute = substituteFor(exercise, ctx.inventory, { avoid: swaps.painful });
    out.push({
      kind: 'no-equipment',
      exerciseId: exercise.id,
      logId: latest.logId,
      ...(substitute && { substituteId: substitute.id }),
    });
  }
  return out;
}

/** The end of a ladder as a proposal, or a reason to suggest buying something. */
export function ladderProposal(
  end: LadderEnd,
  exercise: Exercise,
  all: readonly Exposure[],
  ctx: Pick<ProgressContext, 'answers' | 'inventory' | 'exercises' | 'profile'>,
): Proposal | 'buy-next' | undefined {
  if (end.kind === 'buy-next') return 'buy-next';
  if (end.kind === 'none') return undefined;
  const variant =
    end.kind === 'harder'
      ? harderVariantFor(
          exercise,
          { inventory: ctx.inventory, ...ctx.profile },
          ctx.exercises ?? undefined,
        )
      : end.kind === 'easier'
        ? variantFor(exercise, 'easier', ctx.inventory, ctx.exercises)
        : variantFor(
            exercise,
            'easier',
            ctx.inventory,
            ctx.exercises,
            (e) => e.loadType === 'band-assisted',
          );
  if (!variant)
    return end.kind === 'harder' &&
      harderNeedsEquipment(exercise, { inventory: ctx.inventory, ...ctx.profile }, ctx.exercises)
      ? 'buy-next'
      : undefined;
  if (suppressed(ctx.answers, exercise.id, end.kind, end.logId, all)) return undefined;
  return { kind: end.kind, exerciseId: exercise.id, logId: end.logId, substituteId: variant.id };
}
