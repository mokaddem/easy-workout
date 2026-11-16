import {
  BAND_LEVELS,
  type BandLevel,
  type EquipmentInventory,
  type Exercise,
  type Load,
} from '../../domain';
import { equipmentCapabilities, meetsRequirement, usableSetups } from '../equipment';
import { DEFAULT_BODYWEIGHT_KG, ownedWeights } from '../generate/loads';

type AddedImplement = 'weight-belt' | 'weight-vest' | 'dumbbell' | 'kettlebell';

/**
 * The loads an exercise can be done with, easiest first. A step up is the next rung.
 * - `kg`: owned dumbbells or kettlebells for the exercise's setup (never both kinds), per
 *   implement; `count` implements, plus `bodyKg` of the user's own weight for leg moves.
 * - `added`: bodyweight first (0), then one implement's loads in total kg, capped by the bar.
 * - `band`: owned bands; for assisted moves the heaviest band comes first (it helps most).
 * - `none`: bodyweight or untracked load: reps and tempo only.
 */
export type Ladder =
  | { kind: 'kg'; rungs: number[]; count: number; bodyKg: number }
  | {
      kind: 'added';
      rungs: number[];
      bodyKg: number;
      implement?: AddedImplement;
      count?: 1 | 2;
    }
  | { kind: 'band'; rungs: BandLevel[]; assisted: boolean }
  | { kind: 'none' };

const roundKg = (kg: number) => Math.round(kg * 100) / 100;

/** Share of bodyweight a move lifts along with the load: legs carry the body, presses part of it. */
export const bodyShare = (exercise: Exercise, added: boolean): number => {
  if (exercise.pattern === 'squat' || exercise.pattern === 'lunge') return 0.75;
  if (!added) return 0;
  if (exercise.pattern === 'hinge') return 0.5;
  return exercise.pattern === 'push-horizontal' ? 0.65 : 1;
};

const bandKind = (exercise: Exercise, inventory: EquipmentInventory): 'band' | 'mini-band' => {
  const capabilities = equipmentCapabilities(inventory);
  const setup = usableSetups(exercise, capabilities)[0] ?? exercise.equipment[0] ?? [];
  return setup.some((r) => r.kind === 'mini-band') ? 'mini-band' : 'band';
};

/**
 * The implement that adds load to a bodyweight move: the one in use, else the first the exercise
 * lists that is owned. One implement per ladder, so loads never alternate between two.
 */
const addedImplement = (
  exercise: Exercise,
  load: Load | undefined,
  inventory: EquipmentInventory,
): { implement: AddedImplement; count: 1 | 2; rungs: number[] } | undefined => {
  const capabilities = equipmentCapabilities(inventory);
  const options = (exercise.addedLoad ?? []).filter((req) => meetsRequirement(req, capabilities));
  const inUse =
    load?.kind === 'added-kg' && load.implement
      ? options.find((req) => req.kind === load.implement)
      : undefined;
  const req = inUse ?? options[0];
  if (!req) return undefined;
  const implement = req.kind as AddedImplement;
  if (implement === 'dumbbell' || implement === 'kettlebell') {
    const count = req.count === 2 ? 2 : 1;
    const rungs = ownedWeights(inventory, implement, count).map((kg) => roundKg(kg * count));
    return { implement, count, rungs };
  }
  const kg = new Set<number>();
  for (const item of inventory) {
    if (item.kind !== implement || !('incrementKg' in item) || !('maxKg' in item)) continue;
    const steps = Math.floor(item.maxKg / item.incrementKg + 1e-9);
    for (let i = 1; i <= steps; i++) kg.add(roundKg(i * item.incrementKg));
  }
  return { implement, count: 1, rungs: [...kg].sort((a, b) => a - b) };
};

/** Most a pull-up bar takes, minus the user: the added load it can still hold. */
const barCap = (
  exercise: Exercise,
  inventory: EquipmentInventory,
  bodyweightKg: number,
): number | undefined => {
  if (!exercise.equipment.some((setup) => setup.some((r) => r.kind === 'pull-up-bar')))
    return undefined;
  const ratings = inventory.flatMap((item) =>
    item.kind === 'pull-up-bar' && item.maxLoadKg !== undefined ? [item.maxLoadKg] : [],
  );
  return ratings.length === 0 ? undefined : Math.max(...ratings) - bodyweightKg;
};

export function ladderFor(
  exercise: Exercise,
  load: Load | undefined,
  inventory: EquipmentInventory,
  bodyweightKg: number = DEFAULT_BODYWEIGHT_KG,
): Ladder {
  if (load?.kind === 'kg' || (load === undefined && exercise.loadType === 'external')) {
    const capabilities = equipmentCapabilities(inventory);
    const setup = usableSetups(exercise, capabilities)[0];
    const req = setup?.find((r) => r.kind === 'dumbbell' || r.kind === 'kettlebell');
    if (!req) return { kind: 'none' };
    const count = req.count === 2 ? 2 : 1;
    const rungs = ownedWeights(inventory, req.kind as 'dumbbell' | 'kettlebell', count);
    return rungs.length > 0
      ? { kind: 'kg', rungs, count, bodyKg: bodyShare(exercise, false) * bodyweightKg }
      : { kind: 'none' };
  }
  if (exercise.loadType === 'band' || exercise.loadType === 'band-assisted') {
    const kind = bandKind(exercise, inventory);
    const owned = new Set(inventory.flatMap((i) => (i.kind === kind ? i.levels : [])));
    const levels = BAND_LEVELS.filter((l) => owned.has(l));
    if (levels.length === 0) return { kind: 'none' };
    const assisted = exercise.loadType === 'band-assisted';
    return { kind: 'band', rungs: assisted ? levels.reverse() : levels, assisted };
  }
  if (exercise.loadType === 'bodyweight-loadable') {
    const cap = barCap(exercise, inventory, bodyweightKg);
    const owned = addedImplement(exercise, load, inventory);
    const bodyKg = bodyShare(exercise, true) * bodyweightKg;
    if (!owned) return { kind: 'added', rungs: [0], bodyKg };
    const rungs = [0, ...owned.rungs.filter((kg) => cap === undefined || kg <= cap)];
    return { kind: 'added', rungs, bodyKg, implement: owned.implement, count: owned.count };
  }
  return { kind: 'none' };
}

/** Position of a load on its ladder: exact, else the nearest easier rung (what's owned now). */
export function rungOf(ladder: Ladder, load: Load | undefined): number {
  switch (ladder.kind) {
    case 'kg': {
      const kg = load?.kind === 'kg' ? load.kg : 0;
      let index = 0;
      ladder.rungs.forEach((w, i) => {
        if (w <= kg + 1e-9) index = i;
      });
      return index;
    }
    case 'added': {
      const kg = load?.kind === 'added-kg' ? load.kg : 0;
      let index = 0;
      ladder.rungs.forEach((w, i) => {
        if (w <= kg + 1e-9) index = i;
      });
      return index;
    }
    case 'band': {
      if (load?.kind !== 'band') return 0;
      const exact = ladder.rungs.indexOf(load.level);
      if (exact >= 0) return exact;
      // A band no longer owned: the nearest one that makes the move easier.
      const order = (l: BandLevel) => BAND_LEVELS.indexOf(l);
      const wanted = order(load.level);
      const easier = ladder.rungs
        .map((l, i) => ({ i, d: ladder.assisted ? order(l) - wanted : wanted - order(l) }))
        .filter((x) => x.d >= 0)
        .sort((a, b) => a.d - b.d)[0];
      return easier?.i ?? 0;
    }
    case 'none':
      return 0;
  }
}

export function loadAt(ladder: Ladder, rung: number): Load | undefined {
  switch (ladder.kind) {
    case 'kg': {
      const kg = ladder.rungs[rung];
      return kg === undefined ? undefined : { kind: 'kg', kg };
    }
    case 'added': {
      const kg = ladder.rungs[rung] ?? 0;
      if (kg <= 0) return { kind: 'bodyweight' };
      return {
        kind: 'added-kg',
        kg,
        ...(ladder.implement && { implement: ladder.implement }),
        ...(ladder.count === 2 && { count: 2 as const }),
      };
    }
    case 'band': {
      const level = ladder.rungs[rung];
      return level === undefined ? undefined : { kind: 'band', level };
    }
    case 'none':
      return undefined;
  }
}

export const rungCount = (ladder: Ladder): number =>
  ladder.kind === 'none' ? 1 : ladder.rungs.length;

/** Kilograms moved, for the rep estimate: the implements, plus the share of the user they lift. */
export function effectiveKg(ladder: Ladder, rung: number): number | undefined {
  if (ladder.kind === 'kg') {
    const kg = ladder.rungs[rung];
    return kg === undefined ? undefined : kg * ladder.count + ladder.bodyKg;
  }
  if (ladder.kind === 'added') return ladder.bodyKg + (ladder.rungs[rung] ?? 0);
  return undefined;
}

export function sameLoad(a: Load | undefined, b: Load | undefined): boolean {
  if (!a || !b) return (a?.kind ?? 'bodyweight') === (b?.kind ?? 'bodyweight');
  if (a.kind !== b.kind) return false;
  if (a.kind === 'band' && b.kind === 'band') return a.level === b.level;
  if ('kg' in a && 'kg' in b) return Math.abs(a.kg - b.kg) < 1e-6;
  return true;
}

/** Reps estimate (Epley form): the load × (reps + reps in reserve) a set shows. */
export const capacity = (kg: number, reps: number, rir: number): number =>
  kg * (1 + (reps + rir) / 30);

/** Reps doable at `kg` stopping `rir` reps short, from a capacity. */
export const predictReps = (cap: number, kg: number, rir: number): number =>
  Math.floor(30 * (cap / kg - 1) - rir + 1e-9);
