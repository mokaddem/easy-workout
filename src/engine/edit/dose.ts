import type {
  Block,
  EquipmentInventory,
  Exercise,
  Profile,
  SessionItem,
  Target,
} from '../../domain';
import { itemSeconds } from '../duration';
import { FIXED_REP_EXERCISES, itemDose, straightRest, straightSets } from '../generate/dose';
import { rampLoad, startingLoad, type LoadContext } from '../generate/loads';
import { exerciseSafety, isMainLift } from '../generate/safety';
import { TEMPLATES } from '../generate/templates';
import type { BlockTemplate, SlotRole, SlotSpec } from '../generate/types';
import { itemsOf, type Section } from './slots';

/** What the editor needs to know about the person to dose and check a session. */
export interface EditContext {
  profile: Pick<Profile, 'goal' | 'level' | 'sessionMinutes' | 'bodyweightKg'>;
  inventory: EquipmentInventory;
  exercises: ReadonlyMap<string, Exercise>;
}

export const loadContext = (ctx: EditContext): LoadContext => ({
  inventory: ctx.inventory,
  level: ctx.profile.level,
  ...(ctx.profile.bodyweightKg !== undefined && { bodyweightKg: ctx.profile.bodyweightKg }),
});

const jumps = (exercise: Exercise) =>
  exercise.tags.includes('plyometric') || exercise.tags.includes('ballistic');

/** Steady cardio: machines and walks. Other conditioning is dosed like any exercise. */
export const isSteadyCardio = (exercise: Exercise) => exercise.pattern === 'locomotion';

/**
 * What an exercise the user adds is for, from where it goes and what it is. A lift added at the
 * top of the main part leads the session.
 */
export function roleFor(exercise: Exercise, section: Section, leads: boolean): SlotRole {
  if (section === 'warmup') return 'warmup';
  if (jumps(exercise) || exercise.pattern === 'conditioning') return 'conditioning';
  if (exercise.pattern.startsWith('core')) return 'core';
  if (section === 'finisher') return 'burnout';
  if (leads && isMainLift(exercise)) return 'main';
  if (exercise.tags.includes('compound')) return 'secondary';
  if (exercise.tags.includes('isolation')) return 'isolation';
  return 'accessory';
}

/** Dose when no template slot fits: sets, reps or seconds, rest. */
const ROLE_DEFAULTS: Record<
  SlotRole,
  {
    reps: readonly [number, number];
    time: readonly [number, number];
    sets: number;
    restSec: number;
  }
> = {
  main: { reps: [8, 10], time: [30, 45], sets: 4, restSec: 90 },
  secondary: { reps: [10, 12], time: [30, 45], sets: 3, restSec: 75 },
  accessory: { reps: [10, 12], time: [30, 45], sets: 3, restSec: 60 },
  isolation: { reps: [12, 15], time: [30, 45], sets: 3, restSec: 60 },
  core: { reps: [10, 15], time: [30, 45], sets: 3, restSec: 45 },
  burnout: { reps: [15, 20], time: [30, 45], sets: 2, restSec: 45 },
  conditioning: { reps: [10, 15], time: [30, 40], sets: 3, restSec: 45 },
  warmup: { reps: [10, 10], time: [30, 30], sets: 1, restSec: 15 },
};

interface SlotDose {
  slot: SlotSpec;
  sets: number;
  restSec: number;
}

/** Every template slot with the sets and rest its block gives it. */
const TEMPLATE_SLOTS: readonly SlotDose[] = [...TEMPLATES.values()].flatMap((tpl) =>
  [...tpl.main, ...tpl.finisher, ...tpl.warmup].flatMap((b: BlockTemplate): SlotDose[] =>
    b.type === 'straight'
      ? [{ slot: b.slot, sets: b.sets, restSec: b.restSec }]
      : b.type === 'group'
        ? b.slots.map((slot) => ({ slot, sets: b.rounds, restSec: b.restAfterRoundSec }))
        : [],
  ),
);

/**
 * The template slot closest to this exercise in this role: one that names it, else one whose
 * patterns accept it (the earlier the better); it must dose the exercise's metric.
 */
function nearestSlot(exercise: Exercise, role: SlotRole): SlotDose | undefined {
  const fits = (d: SlotDose) =>
    d.slot.role === role && (exercise.metric === 'time' ? !!d.slot.time : !!d.slot.reps);
  const named = TEMPLATE_SLOTS.find((d) => fits(d) && d.slot.prefer?.includes(exercise.id));
  if (named) return named;
  let best: { d: SlotDose; rank: number } | undefined;
  for (const d of TEMPLATE_SLOTS) {
    if (!fits(d)) continue;
    const rank = d.slot.patterns.indexOf(exercise.pattern);
    if (rank >= 0 && (!best || rank < best.rank)) best = { d, rank };
  }
  return best?.d;
}

const steadyCardio = (exercise: Exercise, section: Section, ctx: EditContext): Target => {
  // As the generator doses it: a cardio day in the main part (shorter for muscle gain, within
  // the session length), a finisher's minutes otherwise.
  const budget = ctx.profile.sessionMinutes;
  const day: readonly [number, number] = ctx.profile.goal === 'muscle' ? [25, 30] : [35, 40];
  const [minMinutes, maxMinutes] =
    section === 'main'
      ? [Math.min(day[0], budget), Math.min(day[1], budget)]
      : section === 'warmup'
        ? [5, 5]
        : [10, 15];
  const treadmill = ctx.inventory.find((i) => i.kind === 'treadmill');
  const settings =
    treadmill && exercise.id === 'treadmill-incline-walk'
      ? {
          speedKmh: Math.min(5, treadmill.maxSpeedKmh),
          inclinePct: Math.min(12, treadmill.maxInclinePct),
        }
      : treadmill && exercise.id === 'treadmill-walk'
        ? { speedKmh: Math.min(6, treadmill.maxSpeedKmh) }
        : {};
  return { kind: 'cardio', minMinutes, maxMinutes, ...settings };
};

/**
 * A straight block for an exercise the user adds: dosed like the generator doses the template
 * slot closest to it, for the person's goal and level, with a starting load from what they own.
 * `leads`: it goes first in the main part.
 */
export function defaultBlock(
  exercise: Exercise,
  section: Section,
  slot: string,
  ctx: EditContext,
  leads = false,
): Block {
  const { goal, level } = ctx.profile;
  if (isSteadyCardio(exercise))
    return {
      type: 'straight',
      item: { slot, exerciseId: exercise.id, target: steadyCardio(exercise, section, ctx) },
      sets: 1,
      restSec: 0,
    };

  const role = roleFor(exercise, section, leads);
  const loads = loadContext(ctx);
  const setup = exerciseSafety(exercise, loads, role === 'warmup').setup ?? [];
  const easier = level === 'beginner' || level === 'returning';

  // Rope work ramps in with short bouts, as the generator doses it.
  if (exercise.id.startsWith('jump-rope') && section !== 'warmup')
    return {
      type: 'straight',
      item: {
        slot,
        exerciseId: exercise.id,
        target: {
          kind: 'interval',
          rounds: ROPE_ROUNDS,
          workSec: ROPE_WORK_SEC,
          recoverySec: ROPE_RECOVERY_SEC,
        },
      },
      sets: 1,
      restSec: 0,
    };

  // Jumps and swings in the main part are power work: crisp reps, full rest, no grinding.
  if (section === 'main' && jumps(exercise) && exercise.metric === 'reps') {
    const load = startingLoad(exercise, setup, 'conditioning', loads, () => {});
    const swing = exercise.tags.includes('ballistic');
    return {
      type: 'straight',
      item: {
        slot,
        exerciseId: exercise.id,
        target: swing ? { kind: 'reps', min: 8, max: 12 } : { kind: 'reps', min: 5, max: 6 },
        ...(exercise.unilateral && { perSide: true }),
        ...(load && { load }),
      },
      sets: easier ? 2 : 3,
      restSec: 90,
    };
  }

  const near = nearestSlot(exercise, role);
  const fallback = ROLE_DEFAULTS[role];
  const spec: SlotSpec = near?.slot ?? {
    id: slot,
    role,
    patterns: [exercise.pattern],
    reps: fallback.reps,
    time: fallback.time,
  };
  const dose = itemDose(spec, exercise, 'ranked', goal, level);
  let sets = role === 'warmup' ? 1 : straightSets(near?.sets ?? fallback.sets, role, goal, level);
  // Conditioning isn't scaled by level in the templates: lighter for beginners and returners.
  if (role === 'conditioning' && easier) sets = Math.max(1, sets - 1);
  const restSec = straightRest(near?.restSec ?? fallback.restSec, role, goal, exercise, 'ranked');

  let item: SessionItem = { slot, exerciseId: exercise.id, ...dose };
  const fixed = OWN_FIXED_REPS[exercise.id];
  if (fixed && item.target.kind === 'reps')
    item = { ...item, target: { kind: 'reps', min: fixed[0], max: fixed[1] } };
  if (role === 'warmup') {
    // A loaded lift in the warm-up rehearses it: one set of 10 at about half its working load;
    // a bodyweight lift, about half the bottom of its working range.
    const working = startingLoad(exercise, setup, 'secondary', loads, () => {});
    const kg = working?.kind === 'kg' ? rampLoad(setup, working.kg, 0.5, ctx.inventory) : undefined;
    if (kg !== undefined)
      item = { ...item, target: { kind: 'reps', min: 10, max: 10 }, load: { kind: 'kg', kg } };
    else {
      if (working && working.kind !== 'kg') item = { ...item, load: working };
      if (exercise.tags.includes('compound') && exercise.metric === 'reps') {
        const workSlot = nearestSlot(exercise, 'secondary');
        const work = itemDose(
          workSlot?.slot ?? {
            id: slot,
            role: 'secondary',
            patterns: [exercise.pattern],
            reps: ROLE_DEFAULTS.secondary.reps,
          },
          exercise,
          'ranked',
          goal,
          level,
        ).target;
        // "As many as possible" work is hard by definition: the fewest reps rehearse it.
        const reps =
          work.kind === 'reps'
            ? Math.max(WARMUP_MIN_REPS, Math.round(work.min / 2))
            : work.kind === 'max'
              ? WARMUP_MIN_REPS
              : undefined;
        if (reps !== undefined) item = { ...item, target: { kind: 'reps', min: reps, max: reps } };
      }
    }
    delete item.rir;
  } else {
    const load = startingLoad(exercise, setup, role, loads, () => {});
    if (load) item = { ...item, load };
    item = { ...item, target: widened(item.target, exercise, role) };
  }
  return { type: 'straight', item, sets, restSec };
}

/** Jumps stay crisp: never more reps than this in a set. */
const JUMP_MAX_REPS = 10;
/** Fewest reps of a bodyweight lift rehearsed in the warm-up. */
const WARMUP_MIN_REPS = 3;
const ROPE_ROUNDS = 10;
const ROPE_WORK_SEC = 20;
const ROPE_RECOVERY_SEC = 40;
/** Moves whose reps are set by how hard they are, for exercises added by the user. */
const OWN_FIXED_REPS: Readonly<Record<string, readonly [number, number]>> = {
  'nordic-curl': [3, 6],
  'nordic-curl-eccentric': [3, 6],
};

/**
 * A one-number rep target leaves no room for double progression: it gets a range (10 → 10–12,
 * 15 → 15–20). Moves with a fixed count keep it; jumps are capped.
 */
function widened(target: Target, exercise: Exercise, role: SlotRole): Target {
  if (target.kind !== 'reps') return target;
  let { min, max } = target;
  if (min === max && !FIXED_REP_EXERCISES.has(exercise.id) && !OWN_FIXED_REPS[exercise.id])
    max = min + (min >= 12 ? 5 : 2);
  if (jumps(exercise) || role === 'conditioning') {
    max = Math.min(max, JUMP_MAX_REPS);
    min = Math.min(min, max);
  }
  return { kind: 'reps', min, max };
}

/** Steady cardio stays on its own: it never runs inside a superset or circuit. */
export const canGroup = (block: Block, exercises: ReadonlyMap<string, Exercise>): boolean =>
  itemsOf(block).every((i) => {
    const e = exercises.get(i.exerciseId);
    return !!e && !isSteadyCardio(e) && i.target.kind !== 'cardio' && i.target.kind !== 'interval';
  });

/** Between two exercises of a superset or circuit: time to switch, not to recover. */
export const GROUP_SWITCH_SEC = 10;
/** Shortest rest after a round of chained exercises. */
const MIN_ROUND_REST_SEC = 60;

/**
 * Rests for chaining two blocks: a short switch between exercises, and after the round the
 * longer of their own rests less the time spent on the other exercise (it rests one while
 * working the other), never under a minute. Given the exercises, two moves for the same muscle
 * keep the full rest.
 */
export function groupRests(
  a: Block,
  b: Block,
  exercises?: ReadonlyMap<string, Exercise>,
): { restBetweenItemsSec: number; restAfterRoundSec: number } {
  const rest = (x: Block) => (x.type === 'straight' ? x.restSec : x.restAfterRoundSec);
  const work = (x: Block) => itemsOf(x).reduce((sum, i) => sum + itemSeconds(i), 0);
  const longer =
    rest(a) >= rest(b) ? { rest: rest(a), other: work(b) } : { rest: rest(b), other: work(a) };
  // Two moves for the same muscle don't rest it while the other runs: the full rest stays.
  const muscles = (x: Block) =>
    itemsOf(x).flatMap((i) => exercises?.get(i.exerciseId)?.primaryMuscles ?? []);
  const same = muscles(a).some((m) => muscles(b).includes(m));
  if (same) return { restBetweenItemsSec: GROUP_SWITCH_SEC, restAfterRoundSec: longer.rest };
  return {
    restBetweenItemsSec: GROUP_SWITCH_SEC,
    restAfterRoundSec: Math.max(
      MIN_ROUND_REST_SEC,
      Math.round((longer.rest - longer.other) / 5) * 5,
    ),
  };
}

/** Each exercise of a group back to its own straight sets, with the rest its role calls for. */
export function ungroupedRest(
  item: SessionItem,
  section: Section,
  ctx: EditContext,
  leads: boolean,
): number {
  const exercise = ctx.exercises.get(item.exerciseId);
  if (!exercise) return 60;
  const role = roleFor(exercise, section, leads);
  const near = nearestSlot(exercise, role);
  return straightRest(
    near?.restSec ?? ROLE_DEFAULTS[role].restSec,
    role,
    ctx.profile.goal,
    exercise,
    'ranked',
  );
}
