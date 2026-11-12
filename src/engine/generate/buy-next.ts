import { catalogue as defaultCatalogue } from '../../catalogue';
import type {
  EquipmentInventory,
  EquipmentItem,
  Exercise,
  GenerationNote,
  Profile,
  Programme,
} from '../../domain';
import { availableExercises, equipmentCapabilities, meetsRequirement } from '../equipment';
import { ownedWeights } from './loads';
import { programmeChanges, type SlotChange } from './diff';
import { generateProgramme } from './programme';

export type PurchaseCost = 'low' | 'medium' | 'high';

export interface PurchaseOption {
  id: string;
  /** What gets added to the inventory to evaluate it. */
  item: EquipmentItem;
  cost: PurchaseCost;
  /** Whether it is worth evaluating for this inventory. */
  applies: (inventory: EquipmentInventory, profile: Profile) => boolean;
}

const owns = (inventory: EquipmentInventory, kind: EquipmentItem['kind']) =>
  inventory.some((item) => item.kind === kind);

const heaviestPair = (inventory: EquipmentInventory) =>
  Math.max(0, ...ownedWeights(inventory, 'dumbbell', 2));

/** Room to progress: a pair at least this share of bodyweight. */
const DUMBBELL_HEADROOM_RATIO = 0.35;

/** Typical home purchases, with the spec assumed when evaluating them. */
export const PURCHASE_OPTIONS: readonly PurchaseOption[] = [
  {
    id: 'pull-up-bar',
    item: { id: 'buy-bar', kind: 'pull-up-bar', mount: 'doorway' },
    cost: 'low',
    applies: (inv) => !owns(inv, 'pull-up-bar'),
  },
  {
    id: 'resistance-bands',
    item: { id: 'buy-bands', kind: 'band', levels: ['light', 'medium', 'heavy'] },
    cost: 'low',
    applies: (inv) => !owns(inv, 'band'),
  },
  {
    id: 'mini-bands',
    item: { id: 'buy-mini', kind: 'mini-band', levels: ['light', 'medium'] },
    cost: 'low',
    applies: (inv) => !owns(inv, 'mini-band'),
  },
  {
    id: 'jump-rope',
    item: { id: 'buy-rope', kind: 'jump-rope' },
    cost: 'low',
    applies: (inv) => !owns(inv, 'jump-rope'),
  },
  {
    id: 'ab-wheel',
    item: { id: 'buy-wheel', kind: 'ab-wheel' },
    cost: 'low',
    applies: (inv) => !owns(inv, 'ab-wheel'),
  },
  {
    id: 'adjustable-dumbbells',
    item: {
      id: 'buy-db',
      kind: 'dumbbell',
      mode: 'adjustable',
      count: 2,
      minKg: 2,
      maxKg: 24,
      incrementKg: 2,
    },
    cost: 'high',
    applies: (inv) => !owns(inv, 'dumbbell'),
  },
  {
    id: 'heavier-dumbbells',
    item: {
      id: 'buy-db-heavy',
      kind: 'dumbbell',
      mode: 'adjustable',
      count: 2,
      minKg: 2.5,
      maxKg: 32.5,
      incrementKg: 2.5,
    },
    cost: 'high',
    applies: (inv, profile) =>
      owns(inv, 'dumbbell') &&
      heaviestPair(inv) < DUMBBELL_HEADROOM_RATIO * (profile.bodyweightKg ?? 70),
  },
  {
    id: 'kettlebell',
    item: {
      id: 'buy-kb',
      kind: 'kettlebell',
      weights: [
        { kg: 12, count: 1 },
        { kg: 16, count: 1 },
      ],
    },
    cost: 'medium',
    applies: (inv) => !owns(inv, 'kettlebell'),
  },
  {
    id: 'adjustable-bench',
    item: { id: 'buy-bench', kind: 'bench', incline: true },
    cost: 'medium',
    applies: (inv) => !inv.some((item) => item.kind === 'bench' && item.incline),
  },
  {
    id: 'weight-vest',
    item: { id: 'buy-vest', kind: 'weight-vest', maxKg: 10, incrementKg: 1 },
    cost: 'medium',
    applies: (inv) => !owns(inv, 'weight-vest') && !owns(inv, 'weight-belt'),
  },
  {
    id: 'dip-bars',
    item: { id: 'buy-dips', kind: 'dip-bars' },
    cost: 'medium',
    applies: (inv) => !owns(inv, 'dip-bars'),
  },
  {
    id: 'suspension-trainer',
    item: { id: 'buy-trx', kind: 'suspension-trainer' },
    cost: 'medium',
    applies: (inv) => !owns(inv, 'suspension-trainer'),
  },
  {
    id: 'treadmill',
    item: { id: 'buy-treadmill', kind: 'treadmill', maxSpeedKmh: 12, maxInclinePct: 10 },
    cost: 'high',
    applies: (inv) => !owns(inv, 'treadmill'),
  },
  {
    id: 'stationary-bike',
    item: { id: 'buy-bike', kind: 'stationary-bike' },
    cost: 'high',
    applies: (inv) =>
      !['treadmill', 'stationary-bike', 'rower'].some((k) => owns(inv, k as EquipmentItem['kind'])),
  },
  {
    id: 'rower',
    item: { id: 'buy-rower', kind: 'rower' },
    cost: 'high',
    applies: (inv) =>
      !['treadmill', 'stationary-bike', 'rower'].some((k) => owns(inv, k as EquipmentItem['kind'])),
  },
];

const COST_FACTOR: Record<PurchaseCost, number> = { low: 1, medium: 2, high: 4 };

/** Lower is better. */
const CARDIO_RANK: Record<string, number> = {
  'incline-walk': 0,
  'treadmill-walk': 1,
  bike: 1,
  rower: 1,
  'jump-rope': 2,
  'brisk-walk': 2,
  'step-intervals': 3,
};

interface Metrics {
  dropped: number;
  fallbacks: number;
  ranked: number;
  /** Starting loads well below what the profile calls for: the weights are too light. */
  cappedLoads: number;
  /** Loaded lifts whose heaviest owned weight leaves little room to progress. */
  noHeadroom: number;
  /** Loadable bodyweight moves with nothing to add load with. */
  noAddedLoad: number;
  /** Strength exercises that can only progress by reps or a band step (plain bodyweight, bands). */
  limitedProgression: number;
  cardio: number;
}

const CORE_PATTERNS = new Set([
  'core-anti-extension',
  'core-anti-lateral',
  'core-flexion',
  'core-rotation',
  'spinal-extension',
]);

const notesOf = (p: Programme): GenerationNote[] => p.generation?.notes ?? [];
const count = (p: Programme, code: string) => notesOf(p).filter((n) => n.code === code).length;

const measure = (
  p: Programme,
  inventory: EquipmentInventory,
  exercises: ReadonlyMap<string, Exercise>,
): Metrics => {
  const capabilities = equipmentCapabilities(inventory);
  const loadNotes = notesOf(p).filter((n) => n.code === 'load-start');
  const heaviest = Math.max(
    0,
    ...ownedWeights(inventory, 'dumbbell', 1),
    ...ownedWeights(inventory, 'kettlebell', 1),
  );
  const mainItems = p.rotation.flatMap((s) =>
    s.main.flatMap((b) => (b.type === 'straight' ? [b.item] : b.items)),
  );
  return {
    dropped: count(p, 'slot-dropped') + count(p, 'cardio-unavailable'),
    fallbacks: count(p, 'exercise-fallback-pattern'),
    ranked: count(p, 'exercise-ranked'),
    cappedLoads: loadNotes.filter((n) => Number(n.params.kg) < 0.8 * Number(n.params.targetKg))
      .length,
    noHeadroom: loadNotes.filter((n) => heaviest < 1.5 * Number(n.params.targetKg)).length,
    noAddedLoad: mainItems.filter((item) => {
      const added = exercises.get(item.exerciseId)?.addedLoad;
      return added !== undefined && !added.some((req) => meetsRequirement(req, capabilities));
    }).length,
    limitedProgression: mainItems.filter((item) => {
      const exercise = exercises.get(item.exerciseId);
      return (
        exercise !== undefined &&
        item.target.kind !== 'time' &&
        !CORE_PATTERNS.has(exercise.pattern) &&
        exercise.pattern !== 'conditioning' &&
        (exercise.loadType === 'bodyweight' || exercise.loadType === 'band')
      );
    }).length,
    cardio: notesOf(p)
      .filter((n) => n.code === 'cardio-modality')
      .reduce((sum, n) => sum + (CARDIO_RANK[String(n.params.modality)] ?? 3), 0),
  };
};

/** How much each improvement counts. */
const WEIGHTS: Record<keyof Metrics, number> = {
  dropped: 4,
  fallbacks: 3,
  ranked: 1.5,
  cappedLoads: 1,
  noHeadroom: 0.5,
  noAddedLoad: 0.5,
  limitedProgression: 1,
  cardio: 1,
};

/** Goal emphasis: progressive load matters most for muscle gain, cardio least. */
const goalWeight = (key: keyof Metrics, goal: Profile['goal']): number => {
  if (key === 'cardio') return goal === 'muscle' ? 0.25 : 1;
  if (key === 'limitedProgression')
    return goal === 'muscle' ? 1.5 : goal === 'recomposition' ? 1 : 0.5;
  return 1;
};

export interface PurchaseAdvice {
  id: string;
  item: EquipmentItem;
  cost: PurchaseCost;
  /** Weighted improvement of the programme. */
  score: number;
  /** Score per unit of cost; the ranking key. */
  value: number;
  /** What improves, metric by metric. */
  gains: Partial<Record<keyof Metrics, number>>;
  /** Exercises the purchase makes available. */
  unlockedExercises: number;
  /** Slots that would get a different exercise. */
  changes: SlotChange[];
}

/**
 * Ranks purchases by how much they would improve the programme generated for this profile,
 * per unit of rough cost. Only purchases that change something are returned.
 */
export const buyNext = (
  profile: Profile,
  equipment: EquipmentInventory,
  exercises: readonly Exercise[] = defaultCatalogue,
  /** Purchases tried so far, out of those that apply: 0 … total. */
  onProgress?: (done: number, total: number) => void,
): PurchaseAdvice[] => {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const before = generateProgramme({ profile, equipment }, exercises);
  const baseMetrics = measure(before, equipment, byId);
  const baseAvailable = availableExercises(exercises, equipment).length;

  const advice: PurchaseAdvice[] = [];
  const options = PURCHASE_OPTIONS.filter((option) => option.applies(equipment, profile));
  for (const [tried, option] of options.entries()) {
    onProgress?.(tried, options.length);
    const inventory = [...equipment, option.item];
    const after = generateProgramme({ profile, equipment: inventory }, exercises);
    const metrics = measure(after, inventory, byId);

    const gains: PurchaseAdvice['gains'] = {};
    let score = 0;
    for (const key of Object.keys(WEIGHTS) as (keyof Metrics)[]) {
      // A metric can look worse only because the purchase brings in new exercises
      // (e.g. first loaded lifts with little headroom); that never counts against it.
      const gain = baseMetrics[key] - metrics[key];
      if (gain <= 0) continue;
      gains[key] = gain;
      score += gain * WEIGHTS[key] * goalWeight(key, profile.goal);
    }
    if (score <= 0) continue;

    const changes = programmeChanges(before, after);
    const rounded = Math.round(score * 100) / 100;
    advice.push({
      id: option.id,
      item: option.item,
      cost: option.cost,
      score: rounded,
      value: Math.round((score / COST_FACTOR[option.cost]) * 100) / 100,
      gains,
      unlockedExercises: availableExercises(exercises, inventory).length - baseAvailable,
      changes,
    });
  }
  onProgress?.(options.length, options.length);
  return advice.sort((a, b) => b.value - a.value || b.score - a.score || a.id.localeCompare(b.id));
};
