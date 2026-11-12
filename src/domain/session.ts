import { z } from 'zod';
import { IdSchema, int, LocalizedTextSchema, positive, SlugSchema } from './common';
import { BandLevelSchema } from './equipment';

/** Seconds per phase of a rep, e.g. 3-0-2 = 3 s lowering, no pause, 2 s lifting. */
export const TempoSchema = z.strictObject({
  down: int(0, 10),
  pause: int(0, 10),
  up: int(0, 10),
});
export type Tempo = z.infer<typeof TempoSchema>;

/** What one set of an exercise asks for. */
export const TargetSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('reps'), min: int(1), max: int(1) }),
    z.strictObject({ kind: z.literal('time'), minSec: int(1), maxSec: int(1) }),
    /** As many reps as possible, usually paired with an RIR. */
    z.strictObject({ kind: z.literal('max') }),
    z.strictObject({
      kind: z.literal('cardio'),
      minMinutes: int(1),
      maxMinutes: int(1),
      speedKmh: positive.optional(),
      inclinePct: z.number().min(0).optional(),
    }),
  ])
  .superRefine((t, ctx) => {
    const bad =
      (t.kind === 'reps' && t.min > t.max) ||
      (t.kind === 'time' && t.minSec > t.maxSec) ||
      (t.kind === 'cardio' && t.minMinutes > t.maxMinutes);
    if (bad) ctx.addIssue({ code: 'custom', message: 'range minimum exceeds maximum' });
  });
export type Target = z.infer<typeof TargetSchema>;

/** Load for one set. kg is per implement (each dumbbell). */
export const LoadSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('kg'), kg: positive }),
  z.strictObject({ kind: z.literal('added-kg'), kg: positive }),
  z.strictObject({ kind: z.literal('band'), level: BandLevelSchema }),
  z.strictObject({ kind: z.literal('bodyweight') }),
]);
export type Load = z.infer<typeof LoadSchema>;

/** One exercise inside a block, with its per-set target. */
export const SessionItemSchema = z.strictObject({
  exerciseId: SlugSchema,
  target: TargetSchema,
  /** Reps in reserve to stop at. */
  rir: int(0, 5).optional(),
  tempo: TempoSchema.optional(),
  /** Target counted per side (per arm, per leg, per side). */
  perSide: z.boolean().optional(),
  load: LoadSchema.optional(),
  note: LocalizedTextSchema.optional(),
});
export type SessionItem = z.infer<typeof SessionItemSchema>;

/**
 * straight: sets of one exercise with rest between sets.
 * group: exercises chained back to back for N rounds (superset = 2 exercises, circuit = more),
 * resting after each round.
 */
export const BlockSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('straight'),
    item: SessionItemSchema,
    sets: int(1, 20),
    restSec: int(0, 600),
  }),
  z.strictObject({
    type: z.literal('group'),
    style: z.enum(['superset', 'circuit']),
    items: z.array(SessionItemSchema).min(2),
    rounds: int(1, 20),
    restBetweenItemsSec: int(0, 300),
    restAfterRoundSec: int(0, 600),
  }),
]);
export type Block = z.infer<typeof BlockSchema>;

/** A planned session: what the player runs and what logs snapshot. */
export const SessionSchema = z.strictObject({
  id: IdSchema,
  name: LocalizedTextSchema,
  focus: LocalizedTextSchema.optional(),
  estimatedMinutes: int(1, 240),
  warmup: z.array(BlockSchema),
  main: z.array(BlockSchema).min(1),
  finisher: z.array(BlockSchema),
});
export type Session = z.infer<typeof SessionSchema>;
