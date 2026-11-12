import { z } from 'zod';
import { DateSchema, DateTimeSchema, IdSchema, int, positive, SlugSchema } from './common';
import { LoadSchema, SessionSchema, TargetSchema } from './session';

export const FEELS = ['easy', 'right', 'hard'] as const;
export const FeelSchema = z.enum(FEELS);
export type Feel = z.infer<typeof FeelSchema>;

/** Why a set was not performed as planned. Pain and no-equipment end the exercise for the session. */
export const SET_FLAGS = ['pain', 'no-equipment', 'skipped'] as const;
export const SetFlagSchema = z.enum(SET_FLAGS);
export type SetFlag = z.infer<typeof SetFlagSchema>;

export const SetLogSchema = z.strictObject({
  section: z.enum(['warmup', 'main', 'finisher']),
  blockIndex: int(0),
  itemIndex: int(0),
  /** 1-based set (straight block) or round (group). */
  set: int(1),
  side: z.enum(['left', 'right']).optional(),
  exerciseId: SlugSchema,
  planned: z.strictObject({ target: TargetSchema, load: LoadSchema.optional() }),
  /** Absent when the set was done exactly as planned. */
  actual: z
    .strictObject({
      reps: int(0).optional(),
      durationSec: int(0).optional(),
      load: LoadSchema.optional(),
    })
    .optional(),
  feel: FeelSchema.optional(),
  flag: SetFlagSchema.optional(),
  at: DateTimeSchema,
});
export type SetLog = z.infer<typeof SetLogSchema>;

export const SessionSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('programme'),
    programmeId: IdSchema,
    week: int(1),
    sessionId: IdSchema,
  }),
  z.strictObject({ kind: z.literal('custom'), sessionId: IdSchema }),
  z.strictObject({ kind: z.literal('quick') }),
]);
export type SessionSource = z.infer<typeof SessionSourceSchema>;

export const SessionLogSchema = z.strictObject({
  id: IdSchema,
  source: SessionSourceSchema,
  /** Snapshot of the plan as it was run, so history survives later edits. */
  plan: SessionSchema,
  status: z.enum(['in-progress', 'completed', 'abandoned']),
  startedAt: DateTimeSchema,
  endedAt: DateTimeSchema.optional(),
  sets: z.array(SetLogSchema),
});
export type SessionLog = z.infer<typeof SessionLogSchema>;

export const CheckInSchema = z.strictObject({
  id: IdSchema,
  date: DateSchema,
  weightKg: positive.optional(),
  waistCm: positive.optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  notes: z.string().optional(),
});
export type CheckIn = z.infer<typeof CheckInSchema>;

export const MaxTestSchema = z.strictObject({
  id: IdSchema,
  date: DateSchema,
  exerciseId: SlugSchema,
  result: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('reps'), reps: int(0) }),
    z.strictObject({ kind: z.literal('time'), seconds: int(0) }),
  ]),
  load: LoadSchema.optional(),
});
export type MaxTest = z.infer<typeof MaxTestSchema>;
