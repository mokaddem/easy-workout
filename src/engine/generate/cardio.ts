import type { Block, Exercise, LocalizedText, Target } from '../../domain';
import { equipmentCapabilities, isExerciseAvailable } from '../equipment';
import { withinStep } from './select';
import type { CardioSpec, Context } from './types';

export type CardioModality =
  | 'incline-walk'
  | 'treadmill-walk'
  | 'bike'
  | 'rower'
  | 'jump-rope'
  | 'step-intervals'
  | 'brisk-walk';

export interface CardioChoice {
  block: Block;
  exerciseId: string;
  modality: CardioModality;
}

/** Name suffix for a dedicated cardio day. */
export const CARDIO_LABEL: Record<CardioModality, LocalizedText> = {
  'incline-walk': { fr: 'marche inclinée', en: 'incline walk' },
  'treadmill-walk': { fr: 'marche sur tapis', en: 'treadmill walk' },
  bike: { fr: 'vélo', en: 'bike' },
  rower: { fr: 'rameur', en: 'rower' },
  'jump-rope': { fr: 'corde à sauter', en: 'jump rope' },
  'step-intervals': { fr: 'cardio', en: 'cardio' },
  'brisk-walk': { fr: 'marche rapide', en: 'brisk walk' },
};

/** Brisk pace on a flat treadmill, where incline can't raise the effort. */
const FLAT_WALK_KMH = 6;

/** Jump rope ramps in with short work bouts. */
const ROPE_WORK_SEC = 20;
const ROPE_RECOVERY_SEC = 40;
/** Low-impact bodyweight intervals when there is no machine or rope. */
const STEP_WORK_SEC = 40;
const STEP_RECOVERY_SEC = 20;

const straight = (exerciseId: string, target: Target): Block => ({
  type: 'straight',
  item: { exerciseId, target },
  sets: 1,
  restSec: 0,
});

const steady = (
  spec: CardioSpec,
  extra: { speedKmh?: number; inclinePct?: number } = {},
): Target => ({
  kind: 'cardio',
  minMinutes: spec.minutes[0],
  maxMinutes: spec.minutes[1],
  ...(extra.speedKmh === undefined ? {} : { speedKmh: extra.speedKmh }),
  ...(extra.inclinePct === undefined ? {} : { inclinePct: extra.inclinePct }),
});

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * The best cardio the user's equipment allows, in order: incline treadmill walk, flat
 * treadmill walk, bike, rower, jump-rope intervals (not for beginners, finishers only),
 * then low-impact step intervals for a finisher or a brisk walk for a cardio day.
 */
const resolveWith = (
  spec: CardioSpec,
  place: 'finisher' | 'day',
  ctx: Context,
  allowed: (exercise: Exercise) => boolean,
): CardioChoice | null => {
  const capabilities = equipmentCapabilities(ctx.equipment);
  const available = (id: string) => {
    const exercise = ctx.catalogue.get(id);
    return (
      exercise !== undefined && allowed(exercise) && isExerciseAvailable(exercise, capabilities)
    );
  };
  const treadmill = ctx.equipment.find((item) => item.kind === 'treadmill');

  if (treadmill && treadmill.maxInclinePct > 0 && available('treadmill-incline-walk')) {
    const speedKmh =
      spec.speedKmh === undefined ? undefined : Math.min(spec.speedKmh, treadmill.maxSpeedKmh);
    const inclinePct =
      spec.inclinePct === undefined
        ? undefined
        : Math.min(spec.inclinePct, treadmill.maxInclinePct);
    return {
      block: straight('treadmill-incline-walk', steady(spec, { speedKmh, inclinePct })),
      exerciseId: 'treadmill-incline-walk',
      modality: 'incline-walk',
    };
  }
  if (treadmill && available('treadmill-walk')) {
    const speedKmh =
      spec.speedKmh === undefined ? undefined : Math.min(FLAT_WALK_KMH, treadmill.maxSpeedKmh);
    return {
      block: straight('treadmill-walk', steady(spec, { speedKmh })),
      exerciseId: 'treadmill-walk',
      modality: 'treadmill-walk',
    };
  }
  if (available('stationary-bike-ride'))
    return {
      block: straight('stationary-bike-ride', steady(spec)),
      exerciseId: 'stationary-bike-ride',
      modality: 'bike',
    };
  if (available('rowing-machine'))
    return {
      block: straight('rowing-machine', steady(spec)),
      exerciseId: 'rowing-machine',
      modality: 'rower',
    };
  if (place === 'finisher' && ctx.level !== 'beginner' && available('jump-rope-bounce')) {
    const rounds = Math.max(
      1,
      roundTo((spec.minutes[1] * 60) / (ROPE_WORK_SEC + ROPE_RECOVERY_SEC), 1),
    );
    return {
      block: straight('jump-rope-bounce', {
        kind: 'interval',
        rounds,
        workSec: ROPE_WORK_SEC,
        recoverySec: ROPE_RECOVERY_SEC,
      }),
      exerciseId: 'jump-rope-bounce',
      modality: 'jump-rope',
    };
  }
  if (place === 'finisher' && available('step-jacks')) {
    const rounds = Math.max(
      1,
      roundTo((spec.minutes[1] * 60) / (STEP_WORK_SEC + STEP_RECOVERY_SEC), 1),
    );
    return {
      block: straight('step-jacks', {
        kind: 'interval',
        rounds,
        workSec: STEP_WORK_SEC,
        recoverySec: STEP_RECOVERY_SEC,
      }),
      exerciseId: 'step-jacks',
      modality: 'step-intervals',
    };
  }
  if (available('brisk-walk'))
    return {
      block: straight('brisk-walk', steady(spec)),
      exerciseId: 'brisk-walk',
      modality: 'brisk-walk',
    };
  return null;
};

/** Last cycle's cardio in this session, when it had one. */
const lastCardio = (sessionId: string | undefined, ctx: Context): Exercise | undefined => {
  if (!sessionId) return undefined;
  for (const [key, id] of ctx.lastPicks)
    if (key.startsWith(`${sessionId}/cardio-`)) return ctx.catalogue.get(id);
  return undefined;
};

/**
 * The best cardio the equipment allows, no more than one step harder than last cycle's in the
 * same session and with no jumps where there were none; the best one overall when nothing
 * milder is available.
 */
export const resolveCardio = (
  spec: CardioSpec,
  place: 'finisher' | 'day',
  ctx: Context,
  sessionId?: string,
): CardioChoice | null => {
  const best = resolveWith(spec, place, ctx, () => true);
  const was = lastCardio(sessionId, ctx);
  if (!best || !was) return best;
  const exercise = ctx.catalogue.get(best.exerciseId);
  if (exercise && withinStep(exercise, was)) return best;
  return resolveWith(spec, place, ctx, (e) => withinStep(e, was)) ?? best;
};
