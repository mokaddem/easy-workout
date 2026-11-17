import {
  isHousehold,
  type EquipmentInventory,
  type EquipmentKind,
  type EquipmentRequirement,
  type Exercise,
} from '../domain';

/** What an inventory provides, reduced to what exercise requirements can ask for. */
export interface EquipmentCapabilities {
  kinds: ReadonlySet<EquipmentKind>;
  /** Most dumbbells usable together at one weight: 2 means a matched pair. */
  dumbbells: 0 | 1 | 2;
  /** Most kettlebells usable together at one weight: 2 means a matched pair. */
  kettlebells: 0 | 1 | 2;
  inclineBench: boolean;
  inclineTreadmill: boolean;
}

const roundKg = (kg: number): number => Math.round(kg * 100) / 100;

/**
 * Largest number of implements of one kind that share a weight, capped at 2.
 * Adjustable dumbbells count at every weight they can be set to, so a single
 * adjustable dumbbell and a fixed one at a reachable weight still make a pair.
 */
const matchedCount = (
  inventory: EquipmentInventory,
  kind: 'dumbbell' | 'kettlebell',
): 0 | 1 | 2 => {
  const perKg = new Map<number, number>();
  const add = (kg: number, count: number) => {
    const key = roundKg(kg);
    perKg.set(key, (perKg.get(key) ?? 0) + count);
  };
  for (const item of inventory) {
    if (item.kind !== kind) continue;
    if ('weights' in item) {
      for (const piece of item.weights) add(piece.kg, piece.count);
    } else if (item.kind === 'dumbbell') {
      const steps = Math.floor((item.maxKg - item.minKg) / item.incrementKg + 1e-9);
      for (let i = 0; i <= steps; i++) add(item.minKg + i * item.incrementKg, item.count);
    }
  }
  const best = Math.max(0, ...perKg.values());
  return best >= 2 ? 2 : best === 1 ? 1 : 0;
};

export const equipmentCapabilities = (inventory: EquipmentInventory): EquipmentCapabilities => ({
  kinds: new Set(inventory.map((item) => item.kind)),
  dumbbells: matchedCount(inventory, 'dumbbell'),
  kettlebells: matchedCount(inventory, 'kettlebell'),
  inclineBench: inventory.some((item) => item.kind === 'bench' && item.incline),
  inclineTreadmill: inventory.some((item) => item.kind === 'treadmill' && item.maxInclinePct > 0),
});

/** Household items are always available; owned kinds must be in the inventory with enough of them. */
export const meetsRequirement = (
  requirement: EquipmentRequirement,
  capabilities: EquipmentCapabilities,
): boolean => {
  if (isHousehold(requirement.kind)) return true;
  if (!capabilities.kinds.has(requirement.kind)) return false;
  const needed = requirement.count ?? 1;
  if (requirement.kind === 'dumbbell') return capabilities.dumbbells >= needed;
  if (requirement.kind === 'kettlebell') return capabilities.kettlebells >= needed;
  if (requirement.incline)
    return requirement.kind === 'treadmill'
      ? capabilities.inclineTreadmill
      : capabilities.inclineBench;
  return true;
};

/** The exercise's equipment alternatives that the inventory satisfies, in catalogue order. */
export const usableSetups = (
  exercise: Exercise,
  capabilities: EquipmentCapabilities,
): EquipmentRequirement[][] =>
  exercise.equipment.filter((setup) => setup.every((req) => meetsRequirement(req, capabilities)));

/**
 * The equipment kinds the closest unmet setup is missing (fewest unmet requirements wins).
 * Empty when the exercise is available.
 */
export const missingKinds = (exercise: Exercise, capabilities: EquipmentCapabilities): string[] => {
  let best: string[] | null = null;
  for (const setup of exercise.equipment) {
    const unmet = setup
      .filter((req) => !meetsRequirement(req, capabilities))
      .map((req) => req.kind);
    if (unmet.length === 0) return [];
    if (!best || unmet.length < best.length) best = unmet;
  }
  return [...new Set(best ?? [])];
};

export const isExerciseAvailable = (
  exercise: Exercise,
  capabilities: EquipmentCapabilities,
): boolean => usableSetups(exercise, capabilities).length > 0;

export const availableExercises = (
  exercises: readonly Exercise[],
  inventory: EquipmentInventory,
): Exercise[] => {
  const capabilities = equipmentCapabilities(inventory);
  return exercises.filter((exercise) => isExerciseAvailable(exercise, capabilities));
};

/** Same content, whatever the key order: object keys sorted at every level. */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
};

/** Same items with the same specs, whatever the order. */
export const sameEquipment = (a: EquipmentInventory, b: EquipmentInventory): boolean => {
  if (a.length !== b.length) return false;
  const key = (items: EquipmentInventory) =>
    JSON.stringify([...items].sort((x, y) => x.id.localeCompare(y.id)).map(canonical));
  return key(a) === key(b);
};
