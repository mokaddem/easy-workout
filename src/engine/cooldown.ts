import { exerciseById as catalogueById } from '../catalogue';
import type {
  EquipmentInventory,
  Exercise,
  Muscle,
  Profile,
  Session,
  SessionItem,
  SessionLog,
} from '../domain';
import { equipmentCapabilities, isExerciseAvailable } from './equipment';
import { constraintsOf, fitFor, fitRank, moderateRegions } from './generate/constraints';
import { MUSCLE_GROUPS } from './volume';

/** What the routine aims at, in seconds, closer and transitions included. */
export const COOLDOWN_BUDGET_SEC = 300;
/** A stretch hold; one side of a one-sided stretch. */
export const COOLDOWN_HOLD_SEC = 30;
/** Neck, wrist and forearm stretches, and moderate-joint stretches for beginners. */
export const COOLDOWN_SHORT_HOLD_SEC = 20;
/** The closing breathing drill. */
export const COOLDOWN_CLOSER_SEC = 60;
/** Between two entries (the rest the player shows). */
export const COOLDOWN_TRANSITION_SEC = 10;
/** Switching sides inside a one-sided stretch. */
export const COOLDOWN_SIDE_SWITCH_SEC = 5;

/** Breathing and relaxation drills the routine ends with, picked by id and never by muscle. */
export const COOLDOWN_CLOSERS: readonly string[] = [
  'chair-legs-breathing',
  'legs-up-the-wall',
  'seated-slow-breathing',
];

/** What a cardio-only session, or one with nothing to stretch, stretches. */
const GENERAL_GROUPS: readonly string[] = ['hip-flexors', 'hamstrings', 'chest', 'back'];

const POSITION_ORDER = { standing: 0, chair: 1, floor: 2 } as const;

/** Muscles that belong to no weekly muscle group stretch as a group of their own. */
const GROUP_MUSCLES: Readonly<Record<string, readonly Muscle[]>> = {
  ...MUSCLE_GROUPS,
  'hip-flexors': ['hip-flexors'],
  adductors: ['adductors'],
  abductors: ['abductors'],
  forearms: ['forearms'],
  traps: ['traps'],
  'lower-back': ['lower-back'],
};

const groupOfMuscle = (muscle: Muscle): string | undefined =>
  Object.keys(GROUP_MUSCLES).find((g) => (GROUP_MUSCLES[g] as readonly Muscle[]).includes(muscle));

export interface CooldownInput {
  /** The session just done. */
  after: Pick<SessionLog, 'id' | 'sets'>;
  profile: Pick<Profile, 'level' | 'limitations' | 'quiet' | 'smallSpace'> | undefined;
  inventory: EquipmentInventory;
  /** The routine does not depend on the clock; kept so callers can pass what they have. */
  now?: Date;
  exercises?: ReadonlyMap<string, Exercise>;
}

/** FNV-1a: a small, stable hash, so the same session always gets the same routine. */
const hash = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

/** Whether a finished session can be followed by a cooldown: any session that is not one. */
export const canCooldown = (log: Pick<SessionLog, 'source' | 'status'>): boolean =>
  log.status === 'completed' && log.source.kind !== 'cooldown';

/**
 * The groups a session worked, in order of first appearance: primary muscles of the main and
 * finisher sets actually done (no warm-up, cardio or flagged set).
 */
export function trainedGroups(
  after: Pick<SessionLog, 'sets'>,
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
): string[] {
  const out: string[] = [];
  for (const set of after.sets) {
    if (set.section === 'warmup' || set.flag || !set.actual) continue;
    if (set.planned.target.kind === 'cardio' || set.planned.target.kind === 'interval') continue;
    const exercise = exercises.get(set.exerciseId);
    if (!exercise || exercise.tags.includes('stretch')) continue;
    for (const muscle of exercise.primaryMuscles) {
      const group = groupOfMuscle(muscle);
      if (group && !out.includes(group)) out.push(group);
    }
  }
  return out;
}

const holdSec = (exercise: Exercise, beginner: boolean): number => {
  if (exercise.primaryMuscles.some((m) => m === 'forearms' || m === 'traps'))
    return COOLDOWN_SHORT_HOLD_SEC;
  if (Object.values(exercise.joints).includes('moderate'))
    return beginner ? COOLDOWN_SHORT_HOLD_SEC : COOLDOWN_HOLD_SEC;
  return COOLDOWN_HOLD_SEC;
};

const entrySec = (exercise: Exercise, hold: number): number =>
  exercise.unilateral ? hold * 2 + COOLDOWN_SIDE_SWITCH_SEC : hold;

/**
 * A short stretching routine for what a session worked: one stretch per trained group in the
 * order of the working sets, standing first, then chair, then floor, ending with one breathing
 * drill. Deterministic: ties between equal stretches rotate with the session's id.
 */
export function buildCooldown(input: CooldownInput): Session {
  const { after, profile, inventory } = input;
  const all = input.exercises ?? catalogueById;
  const constraints = constraintsOf(profile);
  const beginner = profile?.level === 'beginner';
  const capabilities = equipmentCapabilities(inventory);
  const seed = hash(after.id);

  const usable = [...all.values()]
    .filter(
      (e) =>
        e.tags.includes('stretch') &&
        e.position !== undefined &&
        !COOLDOWN_CLOSERS.includes(e.id) &&
        isExerciseAvailable(e, capabilities) &&
        fitFor(e, constraints) !== 'out',
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  const trained = trainedGroups(after, all);
  const used = new Set<string>();
  const spared = new Set<string>();
  const picked: { exercise: Exercise; hold: number }[] = [];
  let seconds = COOLDOWN_CLOSER_SEC + COOLDOWN_TRANSITION_SEC;

  const addFor = (groups: readonly string[]): void => {
    for (const [index, group] of groups.entries()) {
      const muscles = (GROUP_MUSCLES[group] ?? []) as readonly Muscle[];
      const candidates = usable.filter(
        (e) =>
          !used.has(e.id) &&
          e.primaryMuscles.some((m) => muscles.includes(m)) &&
          !moderateRegions(e, constraints).some((r) => spared.has(r)),
      );
      if (candidates.length === 0) continue;
      const best = Math.min(...candidates.map((e) => fitRank(fitFor(e, constraints))));
      const pool = candidates.filter((e) => fitRank(fitFor(e, constraints)) === best);
      const exercise = pool[(seed + index) % pool.length]!;
      const hold = holdSec(exercise, beginner);
      const cost = entrySec(exercise, hold) + COOLDOWN_TRANSITION_SEC;
      if (seconds + cost > COOLDOWN_BUDGET_SEC) return;
      seconds += cost;
      used.add(exercise.id);
      for (const region of moderateRegions(exercise, constraints)) spared.add(region);
      picked.push({ exercise, hold });
    }
  };

  addFor(trained);
  if (picked.length === 0) addFor(GENERAL_GROUPS);

  picked.sort(
    (a, b) =>
      POSITION_ORDER[a.exercise.position ?? 'floor'] -
      POSITION_ORDER[b.exercise.position ?? 'floor'],
  );

  const closer = pickCloser(all, capabilities, constraints, picked.at(-1)?.exercise, seed);
  const items: SessionItem[] = picked.map(({ exercise, hold }) => ({
    exerciseId: exercise.id,
    target: { kind: 'time', minSec: hold, maxSec: hold },
    ...(exercise.unilateral && { perSide: true }),
  }));
  if (closer)
    items.push({
      exerciseId: closer.id,
      target: { kind: 'time', minSec: COOLDOWN_CLOSER_SEC, maxSec: COOLDOWN_CLOSER_SEC },
    });

  return {
    id: `cooldown-${after.id}`,
    name: { fr: 'Retour au calme', en: 'Cooldown' },
    estimatedMinutes: Math.max(1, Math.ceil(seconds / 60)),
    transitionSec: COOLDOWN_TRANSITION_SEC,
    warmup: [],
    main: items.map((item) => ({
      type: 'straight' as const,
      item,
      sets: 1,
      restSec: COOLDOWN_TRANSITION_SEC,
    })),
    finisher: [],
  };
}

/**
 * One closer, picked by id: one that fits the constraints and the equipment, preferring the
 * position the stretches ended in (no extra getting up or down), rotating with the seed.
 */
function pickCloser(
  all: ReadonlyMap<string, Exercise>,
  capabilities: ReturnType<typeof equipmentCapabilities>,
  constraints: ReturnType<typeof constraintsOf>,
  last: Exercise | undefined,
  seed: number,
): Exercise | undefined {
  const pool = COOLDOWN_CLOSERS.flatMap((id) => {
    const e = all.get(id);
    return e ? [e] : [];
  });
  const fitting = pool.filter(
    (e) => isExerciseAvailable(e, capabilities) && fitFor(e, constraints) !== 'out',
  );
  const options = fitting.length > 0 ? fitting : pool;
  const alike = options.filter((e) => e.position === last?.position);
  const from = alike.length > 0 ? alike : options;
  return from[seed % from.length];
}
