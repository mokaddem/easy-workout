import { z } from 'zod';
import { DateSchema, DateTimeSchema, IdSchema, int, positive, SlugSchema } from './common';
import { LoadSchema, SessionSchema, TargetSchema, TempoSchema } from './session';

export const FEELS = ['easy', 'right', 'hard'] as const;
export const FeelSchema = z.enum(FEELS);
export type Feel = z.infer<typeof FeelSchema>;

/**
 * Why a set was not performed. Pain and no-equipment end the exercise: its remaining sets are
 * logged with the flag. Skipped is a warm-up item passed over. Sets left when a session is
 * finished early are simply not logged.
 */
export const SET_FLAGS = ['pain', 'no-equipment', 'skipped'] as const;
export const SetFlagSchema = z.enum(SET_FLAGS);
export type SetFlag = z.infer<typeof SetFlagSchema>;

export const SECTIONS = ['warmup', 'main', 'finisher'] as const;
export const SectionSchema = z.enum(SECTIONS);
export type Section = z.infer<typeof SectionSchema>;

export const SideSchema = z.enum(['left', 'right']);
export type Side = z.infer<typeof SideSchema>;

/** What was actually done in a set. Every field the target kind uses is recorded, as planned or not. */
export const SetActualSchema = z.strictObject({
  /** Reps and max targets. Per side for per-side items. */
  reps: int(0).optional(),
  /** Time targets, steady cardio and intervals (work and recovery). */
  durationSec: int(0).optional(),
  /** Interval rounds completed. */
  rounds: int(0).optional(),
  /** Cardio as run; for intervals, the work phase. */
  speedKmh: positive.optional(),
  inclinePct: z.number().min(0).optional(),
  load: LoadSchema.optional(),
});
export type SetActual = z.infer<typeof SetActualSchema>;

export const SetLogSchema = z
  .strictObject({
    section: SectionSchema,
    blockIndex: int(0),
    itemIndex: int(0),
    /** 1-based set (straight block) or round (group). */
    set: int(1),
    side: SideSchema.optional(),
    exerciseId: SlugSchema,
    /** The prescription of this very set, week changes included (RIR of a first or last set, back-off load). */
    planned: z.strictObject({
      target: TargetSchema,
      load: LoadSchema.optional(),
      rir: int(0, 5).optional(),
      tempo: TempoSchema.optional(),
      /** Reps or seconds this set aims for; absent on older logs (the bottom of the range). */
      goal: int(1).optional(),
    }),
    /** What was done. A set stopped by pain may keep the reps done before it. */
    actual: SetActualSchema.optional(),
    /** The values were changed from the prefilled ones. */
    edited: z.boolean().optional(),
    feel: FeelSchema.optional(),
    /** The feel was picked, not left on its default. */
    feelChosen: z.boolean().optional(),
    flag: SetFlagSchema.optional(),
    /** The rest timer before this set as it ran (after adjustments or skip), when there was one. */
    restSec: int(0).optional(),
    at: DateTimeSchema,
  })
  .superRefine((set, ctx) => {
    if (!set.actual && !set.flag)
      ctx.addIssue({ code: 'custom', message: 'a set is performed (actual) or flagged' });
    if (set.actual && (set.flag === 'no-equipment' || set.flag === 'skipped'))
      ctx.addIssue({ code: 'custom', message: 'only a set stopped by pain keeps what was done' });
    if (set.flag && (set.feel || set.feelChosen))
      ctx.addIssue({ code: 'custom', message: 'a flagged set has no feel' });
  });
export type SetLog = z.infer<typeof SetLogSchema>;

/** Identifies a set within its session: the same set logged twice replaces the first record. */
export const setLogKey = (
  set: Pick<SetLog, 'section' | 'blockIndex' | 'itemIndex' | 'set' | 'side'>,
): string => `${set.section}/${set.blockIndex}/${set.itemIndex}/${set.set}/${set.side ?? ''}`;

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

/**
 * Per-set changes a week makes on top of the session (intensity weeks): RIR of the first or last
 * set of rep-based main exercises, and the load of the back-off sets after a hard first set,
 * per exercise (`section/blockIndex/itemIndex`), already snapped to owned weights.
 */
export const SetAdjustmentsSchema = z.strictObject({
  firstSetRir: int(0, 5).optional(),
  lastSetRir: int(0, 5).optional(),
  backOffLoads: z.record(z.string(), LoadSchema).optional(),
});
export type SetAdjustments = z.infer<typeof SetAdjustmentsSchema>;

/** Pauses between two sets of the player. */
export const PAUSE_KINDS = ['side', 'item', 'rest', 'block'] as const;
export const PauseKindSchema = z.enum(PAUSE_KINDS);
export type PauseKind = z.infer<typeof PauseKindSchema>;

/** The player's running clock, kept so that closing the app doesn't lose a rest or a timer. */
export const LiveClockSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('pause'),
    pause: PauseKindSchema,
    startedAt: DateTimeSchema,
    endsAt: DateTimeSchema,
  }),
  z.strictObject({ kind: z.literal('timing'), startedAt: DateTimeSchema }),
]);
export type LiveClock = z.infer<typeof LiveClockSchema>;

/** Why an exercise is prescribed as it is in a session. The code is translated by the UI. */
export const ProgressionNoteSchema = z.strictObject({
  code: SlugSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  /** The load (weight, band, added load) changed since the last time: worth a feel. */
  newLoad: z.boolean().optional(),
});
export type ProgressionNote = z.infer<typeof ProgressionNoteSchema>;

/**
 * The max test a session runs, decided when it starts: at the end of the session, or right after
 * the warm-up when every session of the week works the tested muscles. The result is a `MaxTest`.
 */
export const SessionTestSchema = z.strictObject({
  exerciseId: SlugSchema,
  kind: z.enum(['reps', 'time']),
  placement: z.enum(['end', 'after-warmup']),
  /** Absent while the test is still to come. Pain: stopped because it hurt. */
  outcome: z.enum(['done', 'skipped', 'pain']).optional(),
});
export type SessionTest = z.infer<typeof SessionTestSchema>;

export const SessionLogSchema = z.strictObject({
  id: IdSchema,
  source: SessionSourceSchema,
  /** Snapshot of the plan as it was run, so history survives later edits. */
  plan: SessionSchema,
  adjustments: SetAdjustmentsSchema.optional(),
  /** Why each exercise (`section/blockIndex/itemIndex`) was prescribed as it was, when it changed. */
  progression: z.record(z.string(), ProgressionNoteSchema).optional(),
  status: z.enum(['in-progress', 'completed', 'abandoned']),
  startedAt: DateTimeSchema,
  endedAt: DateTimeSchema.optional(),
  /** Paused time already over. Active time = end − start − pausedSec − the pause still running. */
  pausedSec: int(0).optional(),
  /** Set while the session is paused. */
  pausedAt: DateTimeSchema.optional(),
  /** Finished before its last set. */
  endedEarly: z.boolean().optional(),
  /** A completed programme session moves the rotation on unless this is false. */
  countsAsDone: z.boolean().optional(),
  note: z.string().max(2000).optional(),
  /** The programme's max test, when this session runs it. */
  test: SessionTestSchema.optional(),
  /** Only while the session is open. */
  live: LiveClockSchema.optional(),
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

/** Where a test was done: inside a programme session, or on its own (only like is compared with like). */
export const TEST_CONTEXTS = ['session', 'fresh'] as const;
export const TestContextSchema = z.enum(TEST_CONTEXTS);
export type TestContext = z.infer<typeof TestContextSchema>;

export const MaxTestSchema = z.strictObject({
  id: IdSchema,
  date: DateSchema,
  /** When it was done, for ordering tests of the same day. */
  at: DateTimeSchema,
  exerciseId: SlugSchema,
  context: TestContextSchema,
  /** The session that ran it (a scheduled test). */
  logId: IdSchema.optional(),
  /** The programme whose test week it was. */
  programmeId: IdSchema.optional(),
  /** Stopped because it hurt: what was done is kept, but it is not a result. */
  stopped: z.literal('pain').optional(),
  result: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('reps'), reps: int(0) }),
    z.strictObject({ kind: z.literal('time'), seconds: int(0) }),
  ]),
  load: LoadSchema.optional(),
});
export type MaxTest = z.infer<typeof MaxTestSchema>;

export const ANSWER_KINDS = ['pain', 'no-equipment', 'harder', 'easier', 'assisted'] as const;
export const AnswerKindSchema = z.enum(ANSWER_KINDS);
export type AnswerKind = z.infer<typeof AnswerKindSchema>;

/**
 * What the user answered to a proposal about an exercise: swap it for another, make it lighter,
 * keep it, call a missing piece of equipment a one-off, dismiss, or go back to the original.
 */
export const AnswerSchema = z
  .strictObject({
    id: IdSchema,
    exerciseId: SlugSchema,
    kind: AnswerKindSchema,
    /** The session whose sets raised the proposal; absent for "back". */
    logId: IdSchema.optional(),
    answer: z.enum(['swap', 'lighter', 'keep', 'one-off', 'dismiss', 'back']),
    substituteId: SlugSchema.optional(),
    at: DateTimeSchema,
  })
  .refine((a) => (a.answer === 'swap') === (a.substituteId !== undefined), {
    message: 'a swap names its substitute, and only a swap does',
  });
export type Answer = z.infer<typeof AnswerSchema>;
