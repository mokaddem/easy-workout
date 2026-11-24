import type {
  Answer,
  Block,
  EquipmentInventory,
  Exercise,
  Section,
  Session,
  SessionItem,
} from '../../domain';
import { exerciseById as catalogueById, catalogue } from '../../catalogue';
import { equipmentCapabilities, isExerciseAvailable, usableSetups } from '../equipment';
import { fitFor, fitRank, type Constraints } from '../generate/constraints';
import { redose } from '../generate/dose';
import { startingLoad, type LoadContext } from '../generate/loads';
import { isExerciseSafe, isMainLift } from '../generate/safety';
import { levelCap, withinStep } from '../generate/select';
import { itemKey } from '../play';

export interface Swaps {
  /** Original exercise → the one that replaces it, chains resolved. */
  to: ReadonlyMap<string, string>;
  /** Exercises swapped away because they hurt: never offered as a substitute. */
  painful: ReadonlySet<string>;
}

/** The swaps in force: the latest "swap" per exercise, unless the user went back since. */
export function activeSwaps(answers: readonly Answer[]): Swaps {
  const direct = new Map<string, string>();
  const painful = new Set<string>();
  for (const a of [...answers].sort((x, y) => x.at.localeCompare(y.at))) {
    if (a.answer === 'swap' && a.substituteId) {
      direct.set(a.exerciseId, a.substituteId);
      if (a.kind === 'pain') painful.add(a.exerciseId);
    } else if (a.answer === 'back') {
      direct.delete(a.exerciseId);
      painful.delete(a.exerciseId);
    }
  }
  const to = new Map<string, string>();
  for (const from of direct.keys()) {
    let id = from;
    const seen = new Set([from]);
    while (direct.has(id)) {
      const next = direct.get(id)!;
      if (seen.has(next)) break;
      seen.add(next);
      id = next;
    }
    if (id !== from) to.set(from, id);
  }
  return { to, painful };
}

const shareTag = (a: Exercise, b: Exercise, tag: 'compound' | 'isolation') =>
  a.tags.includes(tag) === b.tags.includes(tag);

const implementKinds = (exercise: Exercise, inventory: EquipmentInventory) =>
  new Set(
    (usableSetups(exercise, equipmentCapabilities(inventory))[0] ?? []).map(
      (r) => r.kind as string,
    ),
  );

/** The person a substitute is for: what the generator checks a pick against. */
export interface SubstituteContext {
  level: LoadContext['level'];
  bodyweightKg?: number;
  constraints?: Constraints;
}

/**
 * Other exercises for the same job, best first: same pattern, a primary muscle in common, same
 * compound / isolation tag, doable with what is owned, not a warm-up drill, not swapped away for
 * pain. Closest difficulty first; after pain, an easier one or one done with another implement.
 * With a `context`, also what the generator would accept for that person: within their level and
 * one step of the exercise, safe with what is owned, and not ruled out by a limitation, quiet or
 * small space (one that spares a limited joint comes after those that don't).
 */
export function substitutesFor(
  exercise: Exercise,
  inventory: EquipmentInventory,
  options: {
    pain?: boolean;
    avoid?: ReadonlySet<string>;
    exercises?: readonly Exercise[];
    context?: SubstituteContext;
  } = {},
): Exercise[] {
  const capabilities = equipmentCapabilities(inventory);
  const own = implementKinds(exercise, inventory);
  const { context } = options;
  const accepted = (c: Exercise): boolean => {
    if (!context) return true;
    if (fitFor(c, context.constraints) === 'out') return false;
    if (c.difficulty > levelCap(context.level, c) || !withinStep(c, exercise)) return false;
    return isExerciseSafe(c, {
      inventory,
      level: context.level,
      ...(context.bodyweightKg !== undefined && { bodyweightKg: context.bodyweightKg }),
    });
  };
  const pool = (options.exercises ?? catalogue).filter(
    (c) =>
      c.id !== exercise.id &&
      c.pattern === exercise.pattern &&
      c.primaryMuscles.some((m) => exercise.primaryMuscles.includes(m)) &&
      shareTag(c, exercise, 'compound') &&
      shareTag(c, exercise, 'isolation') &&
      !c.tags.includes('warmup') &&
      !c.tags.includes('mobility') &&
      !options.avoid?.has(c.id) &&
      isExerciseAvailable(c, capabilities) &&
      accepted(c),
  );
  const rank = (c: Exercise): number[] => {
    const harder = c.difficulty > exercise.difficulty ? 1 : 0;
    const kinds = implementKinds(c, inventory);
    const sameImplement = [...kinds].some((k) => own.has(k)) ? 1 : 0;
    const base = options.pain
      ? [harder, sameImplement, Math.abs(c.difficulty - exercise.difficulty)]
      : [Math.abs(c.difficulty - exercise.difficulty)];
    return context?.constraints ? [fitRank(fitFor(c, context.constraints)), ...base] : base;
  };
  return pool
    .map((c, order) => ({ c, key: [...rank(c), order] }))
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i++)
        if (a.key[i] !== b.key[i]) return a.key[i]! - b.key[i]!;
      return 0;
    })
    .map(({ c }) => c);
}

/** The best other exercise for the same job (see {@link substitutesFor}). */
export function substituteFor(
  exercise: Exercise,
  inventory: EquipmentInventory,
  options: Parameters<typeof substitutesFor>[2] = {},
): Exercise | undefined {
  return substitutesFor(exercise, inventory, options)[0];
}

/** The first linked variant (harder or easier) that can be done with what is owned. */
export function variantFor(
  exercise: Exercise,
  direction: 'harder' | 'easier',
  inventory: EquipmentInventory,
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
  filter: (e: Exercise) => boolean = () => true,
): Exercise | undefined {
  const capabilities = equipmentCapabilities(inventory);
  return exercise[direction]
    .map((id) => exercises.get(id))
    .find((e): e is Exercise => !!e && isExerciseAvailable(e, capabilities) && filter(e));
}

const jumps = (e: Exercise) => e.tags.includes('plyometric') || e.tags.includes('ballistic');

/**
 * A harder link that does the same job (pattern, compound or isolation, metric) one difficulty
 * step up at most, within the level when one is given. Jumps and swings only follow jumps, swings
 * or conditioning, and a lift leading its session stays a main lift. Equipment aside.
 */
export function fitsAsHarder(
  candidate: Exercise,
  exercise: Exercise,
  level?: LoadContext['level'],
  options: { leads?: boolean } = {},
): boolean {
  const c = candidate;
  if (c.pattern !== exercise.pattern || c.metric !== exercise.metric) return false;
  if (!shareTag(c, exercise, 'compound') || !shareTag(c, exercise, 'isolation')) return false;
  if (c.difficulty > exercise.difficulty + 1) return false;
  if (jumps(c) && !jumps(exercise) && exercise.pattern !== 'conditioning') return false;
  if (options.leads && !isMainLift(c)) return false;
  return !level || c.difficulty <= levelCap(level, c);
}

/** The harder variant that may take an exercise's place, first in its links, safe with what is owned. */
export function harderVariantFor(
  exercise: Exercise,
  ctx: { inventory: EquipmentInventory; constraints?: Constraints } & Partial<
    Pick<LoadContext, 'level' | 'bodyweightKg'>
  >,
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
  options: { leads?: boolean } = {},
): Exercise | undefined {
  return variantFor(
    exercise,
    'harder',
    ctx.inventory,
    exercises,
    (c) =>
      fitFor(c, ctx.constraints) !== 'out' &&
      fitsAsHarder(c, exercise, ctx.level, options) &&
      (!ctx.level ||
        isExerciseSafe(c, {
          inventory: ctx.inventory,
          level: ctx.level,
          ...(ctx.bodyweightKg !== undefined && { bodyweightKg: ctx.bodyweightKg }),
        })),
  );
}

/**
 * A harder variant would fit but needs equipment the user doesn't own: only then is buying
 * the advice (a level or a missing variant is not something to buy).
 */
export function harderNeedsEquipment(
  exercise: Exercise,
  ctx: { inventory: EquipmentInventory; constraints?: Constraints } & Partial<
    Pick<LoadContext, 'level'>
  >,
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
): boolean {
  const capabilities = equipmentCapabilities(ctx.inventory);
  return exercise.harder
    .map((id) => exercises.get(id))
    .some(
      (c) =>
        c !== undefined &&
        fitFor(c, ctx.constraints) !== 'out' &&
        fitsAsHarder(c, exercise, ctx.level) &&
        !isExerciseAvailable(c, capabilities),
    );
}

const itemsOf = (block: Block) => (block.type === 'straight' ? [block.item] : block.items);
const withItems = (block: Block, items: SessionItem[]): Block =>
  block.type === 'straight' ? { ...block, item: items[0]! } : { ...block, items };

/**
 * Another exercise taking over an item's place: re-dosed for the slot, starting from the usual
 * estimate (progression later brings its own history in), same RIR and slot.
 */
export function replacementItem(
  item: SessionItem,
  previous: Exercise,
  next: Exercise,
  leadLift: boolean,
  ctx: { inventory: EquipmentInventory; level: LoadContext['level']; bodyweightKg?: number },
): SessionItem {
  const setup = usableSetups(next, equipmentCapabilities(ctx.inventory))[0] ?? [];
  const role = leadLift ? 'main' : next.tags.includes('isolation') ? 'isolation' : 'secondary';
  const load = startingLoad(next, setup, role, { ...ctx }, () => {});
  return {
    ...(item.slot !== undefined && { slot: item.slot }),
    exerciseId: next.id,
    ...redose(item, previous, next),
    ...(item.rir !== undefined && { rir: item.rir }),
    ...(load && { load }),
  };
}

/**
 * The session with swapped exercises in place. A replacement is re-dosed for the slot and
 * starts from the usual estimate; progression later brings its own history in. A replacement
 * that can't be done with today's equipment leaves the original in place; so does one that a
 * limitation, quiet or small space now rules out, and the swap is reported in `blocked` (item
 * key → the exercise the swap pointed to).
 */
export function applySwaps(
  session: Session,
  swaps: Swaps,
  ctx: {
    inventory: EquipmentInventory;
    level: LoadContext['level'];
    bodyweightKg?: number;
    constraints?: Constraints;
  },
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
): { session: Session; replaces: Record<string, string>; blocked: Record<string, string> } {
  if (swaps.to.size === 0) return { session, replaces: {}, blocked: {} };
  const capabilities = equipmentCapabilities(ctx.inventory);
  const replaces: Record<string, string> = {};
  const blocked: Record<string, string> = {};
  const swapped = new Map<string, Exercise>();
  const replacementFor = (id: string): Exercise | undefined => {
    const to = swaps.to.get(id);
    const ex = to ? exercises.get(to) : undefined;
    return ex && isExerciseAvailable(ex, capabilities) ? ex : undefined;
  };

  const swapSection = (section: Section, blocks: Block[]): Block[] =>
    blocks.map((block, blockIndex) =>
      withItems(
        block,
        itemsOf(block).map((item, itemIndex) => {
          const previous = exercises.get(item.exerciseId);
          const next = replacementFor(item.exerciseId);
          if (!previous || !next) return item;
          if (fitFor(next, ctx.constraints) === 'out') {
            blocked[itemKey(section, blockIndex, itemIndex)] = next.id;
            return item;
          }
          replaces[itemKey(section, blockIndex, itemIndex)] = item.exerciseId;
          swapped.set(item.exerciseId, next);
          return replacementItem(item, previous, next, section === 'main' && blockIndex === 0, ctx);
        }),
      ),
    );

  const main = swapSection('main', session.main);
  const finisher = swapSection('finisher', session.finisher);
  // Ramp-up sets of a swapped lift follow it, or go when the new move takes no weight.
  const warmup = session.warmup.flatMap((block) => {
    const items = itemsOf(block);
    const ramp = items.length === 1 && items[0]!.load?.kind === 'kg' ? items[0]! : undefined;
    const next = ramp && swapped.get(ramp.exerciseId);
    if (!ramp || !next) return [block];
    return next.loadType === 'external'
      ? [withItems(block, [{ ...ramp, exerciseId: next.id }])]
      : [];
  });
  return { session: { ...session, warmup, main, finisher }, replaces, blocked };
}
