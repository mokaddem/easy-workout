import { z } from 'zod';
import { IdSchema, positive } from './common';

/** Equipment the user declares owning. */
export const OWNED_EQUIPMENT_KINDS = [
  'dumbbell',
  'kettlebell',
  'band',
  'mini-band',
  'weight-belt',
  'weight-vest',
  'pull-up-bar',
  'dip-bars',
  'bench',
  'treadmill',
  'stationary-bike',
  'rower',
  'jump-rope',
  'ab-wheel',
  'suspension-trainer',
] as const;

/** Household items every home is assumed to have. */
export const HOUSEHOLD_EQUIPMENT_KINDS = ['chair', 'wall', 'door', 'table', 'mat'] as const;

export const EQUIPMENT_KINDS = [...OWNED_EQUIPMENT_KINDS, ...HOUSEHOLD_EQUIPMENT_KINDS] as const;
export const EquipmentKindSchema = z.enum(EQUIPMENT_KINDS);
export type EquipmentKind = z.infer<typeof EquipmentKindSchema>;

export const isHousehold = (kind: EquipmentKind): boolean =>
  (HOUSEHOLD_EQUIPMENT_KINDS as readonly string[]).includes(kind);

/** Ordered from lightest to heaviest. */
export const BAND_LEVELS = ['extra-light', 'light', 'medium', 'heavy', 'extra-heavy'] as const;
export const BandLevelSchema = z.enum(BAND_LEVELS);
export type BandLevel = z.infer<typeof BandLevelSchema>;

/**
 * What an exercise needs. `count` applies to implements used in pairs or singly
 * (dumbbells, kettlebells, chairs); `incline` to benches and treadmills that can incline.
 */
export const EquipmentRequirementSchema = z
  .strictObject({
    kind: EquipmentKindSchema,
    count: z.union([z.literal(1), z.literal(2)]).optional(),
    incline: z.literal(true).optional(),
  })
  .refine((req) => req.incline === undefined || req.kind === 'bench' || req.kind === 'treadmill', {
    message: 'incline only applies to a bench or a treadmill',
  });
export type EquipmentRequirement = z.infer<typeof EquipmentRequirementSchema>;

const weightPiece = z.strictObject({
  kg: positive,
  count: z.union([z.literal(1), z.literal(2)]),
});

const base = { id: IdSchema };

const AdjustableDumbbellsSchema = z
  .strictObject({
    ...base,
    kind: z.literal('dumbbell'),
    mode: z.literal('adjustable'),
    count: z.union([z.literal(1), z.literal(2)]),
    minKg: positive,
    maxKg: positive,
    incrementKg: positive,
    /** Selector (dial) dumbbells must not be swung; spin-lock plates are bolted on. */
    mechanism: z.enum(['spin-lock', 'selector']).optional(),
  })
  .refine((d) => d.minKg < d.maxKg, { message: 'minKg must be below maxKg' });

const FixedDumbbellsSchema = z.strictObject({
  ...base,
  kind: z.literal('dumbbell'),
  mode: z.literal('fixed'),
  weights: z.array(weightPiece).min(1),
});

const KettlebellsSchema = z.strictObject({
  ...base,
  kind: z.literal('kettlebell'),
  weights: z.array(weightPiece).min(1),
});

const BandsSchema = z.strictObject({
  ...base,
  kind: z.enum(['band', 'mini-band']),
  levels: z.array(BandLevelSchema).min(1),
});

const AddedLoadSchema = z.strictObject({
  ...base,
  kind: z.enum(['weight-belt', 'weight-vest']),
  maxKg: positive,
  incrementKg: positive,
});

const PullUpBarSchema = z.strictObject({
  ...base,
  kind: z.literal('pull-up-bar'),
  mount: z.enum(['doorway', 'wall', 'ceiling', 'freestanding']),
  /** Rated load (bodyweight + added load), when the user knows it. */
  maxLoadKg: positive.optional(),
});

const BenchSchema = z.strictObject({
  ...base,
  kind: z.literal('bench'),
  incline: z.boolean(),
});

const TreadmillSchema = z.strictObject({
  ...base,
  kind: z.literal('treadmill'),
  maxSpeedKmh: positive,
  maxInclinePct: z.number().min(0),
});

const SimpleEquipmentSchema = z.strictObject({
  ...base,
  kind: z.enum([
    'dip-bars',
    'stationary-bike',
    'rower',
    'jump-rope',
    'ab-wheel',
    'suspension-trainer',
  ]),
});

/** One piece (or set) of equipment the user owns, with the specs the engine needs. */
export const EquipmentItemSchema = z.union([
  AdjustableDumbbellsSchema,
  FixedDumbbellsSchema,
  KettlebellsSchema,
  BandsSchema,
  AddedLoadSchema,
  PullUpBarSchema,
  BenchSchema,
  TreadmillSchema,
  SimpleEquipmentSchema,
]);
export type EquipmentItem = z.infer<typeof EquipmentItemSchema>;

export const EquipmentInventorySchema = z.array(EquipmentItemSchema);
export type EquipmentInventory = z.infer<typeof EquipmentInventorySchema>;
