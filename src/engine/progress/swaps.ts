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
import { redose } from '../generate/dose';
import { startingLoad, type LoadContext } from '../generate/loads';
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

/**
 * Another exercise for the same job: same pattern, a primary muscle in common, same compound /
 * isolation tag, doable with what is owned, not a warm-up drill, not swapped away for pain.
 * After pain, an easier one or one done with another implement comes first.
 */
export function substituteFor(
  exercise: Exercise,
  inventory: EquipmentInventory,
  options: { pain?: boolean; avoid?: ReadonlySet<string>; exercises?: readonly Exercise[] } = {},
): Exercise | undefined {
  const capabilities = equipmentCapabilities(inventory);
  const own = implementKinds(exercise, inventory);
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
      isExerciseAvailable(c, capabilities),
  );
  const rank = (c: Exercise): number[] => {
    const harder = c.difficulty > exercise.difficulty ? 1 : 0;
    const kinds = implementKinds(c, inventory);
    const sameImplement = [...kinds].some((k) => own.has(k)) ? 1 : 0;
    return options.pain
      ? [harder, sameImplement, Math.abs(c.difficulty - exercise.difficulty)]
      : [Math.abs(c.difficulty - exercise.difficulty)];
  };
  return pool
    .map((c, order) => ({ c, key: [...rank(c), order] }))
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i++)
        if (a.key[i] !== b.key[i]) return a.key[i]! - b.key[i]!;
      return 0;
    })[0]?.c;
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

const itemsOf = (block: Block) => (block.type === 'straight' ? [block.item] : block.items);
const withItems = (block: Block, items: SessionItem[]): Block =>
  block.type === 'straight' ? { ...block, item: items[0]! } : { ...block, items };

/**
 * The session with swapped exercises in place. A replacement is re-dosed for the slot and
 * starts from the usual estimate; progression later brings its own history in. A replacement
 * that can't be done with today's equipment leaves the original in place.
 */
export function applySwaps(
  session: Session,
  swaps: Swaps,
  ctx: { inventory: EquipmentInventory; level: LoadContext['level']; bodyweightKg?: number },
  exercises: ReadonlyMap<string, Exercise> = catalogueById,
): { session: Session; replaces: Record<string, string> } {
  if (swaps.to.size === 0) return { session, replaces: {} };
  const capabilities = equipmentCapabilities(ctx.inventory);
  const replaces: Record<string, string> = {};
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
          replaces[itemKey(section, blockIndex, itemIndex)] = item.exerciseId;
          swapped.set(item.exerciseId, next);
          const setup = usableSetups(next, capabilities)[0] ?? [];
          const role =
            section === 'main' && blockIndex === 0
              ? 'main'
              : next.tags.includes('isolation')
                ? 'isolation'
                : 'secondary';
          const load = startingLoad(next, setup, role, { ...ctx }, () => {});
          const replaced: SessionItem = {
            exerciseId: next.id,
            ...redose(item, previous, next),
            ...(item.rir !== undefined && { rir: item.rir }),
            ...(load && { load }),
          };
          return replaced;
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
  return { session: { ...session, warmup, main, finisher }, replaces };
}
