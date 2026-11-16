import { z } from 'zod';
import { DateTimeSchema, IdSchema, int, LocalizedTextSchema, positive, SlugSchema } from './common';
import { GenerationSchema } from './generation';
import { GoalSchema } from './profile';
import { SessionSchema } from './session';

/** How a phase modifies the base sessions for its weeks. */
export const PhaseAdjustmentSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('rir'),
    value: int(0, 5),
    scope: z.enum(['all-sets', 'first-set', 'last-set']),
  }),
  /** Add sets (straight blocks) or rounds (groups) to the given main-block positions. Cardio blocks are never affected. */
  z.strictObject({
    kind: z.literal('extra-sets'),
    add: int(1, 5),
    mainBlockIndexes: z.array(int(0)).min(1),
  }),
  /** Scale sets and rounds, e.g. 0.6 for a deload. Cardio blocks are never affected. */
  z.strictObject({ kind: z.literal('volume'), factor: positive.max(2) }),
  /** Lengthen the cardio items in session finishers by this many minutes. */
  z.strictObject({ kind: z.literal('cardio-minutes'), addMinutes: int(1, 60) }),
  /** Max-effort retest at the end of the phase. */
  z.strictObject({ kind: z.literal('max-test'), exerciseIds: z.array(SlugSchema).min(1) }),
]);
export type PhaseAdjustment = z.infer<typeof PhaseAdjustmentSchema>;

export const PHASE_KINDS = ['re-adaptation', 'volume', 'intensity', 'peak', 'deload'] as const;
export const PhaseKindSchema = z.enum(PHASE_KINDS);
export type PhaseKind = z.infer<typeof PhaseKindSchema>;

export const PhaseSchema = z
  .strictObject({
    name: LocalizedTextSchema,
    /** What the phase is for; absent on older programmes. */
    kind: PhaseKindSchema.optional(),
    fromWeek: int(1),
    toWeek: int(1),
    adjustments: z.array(PhaseAdjustmentSchema),
    note: LocalizedTextSchema.optional(),
  })
  .refine((p) => p.fromWeek <= p.toWeek, { message: 'fromWeek must not exceed toWeek' });
export type Phase = z.infer<typeof PhaseSchema>;

export const ProgressionRuleSchema = z.strictObject({
  kind: z.literal('double-progression'),
  upperBodyIncrementKg: positive,
  lowerBodyIncrementKg: positive,
});
export type ProgressionRule = z.infer<typeof ProgressionRuleSchema>;

/** A multi-week plan: sessions run in rotation order, modified week by week by phases. */
export const ProgrammeSchema = z
  .strictObject({
    id: IdSchema,
    name: LocalizedTextSchema,
    goal: GoalSchema,
    weeks: int(1, 26),
    sessionsPerWeek: int(1, 7),
    /** Order matters more than calendar days. */
    rotation: z.array(SessionSchema).min(1),
    phases: z.array(PhaseSchema),
    progression: ProgressionRuleSchema,
    /** Present on generated programmes. */
    generation: GenerationSchema.optional(),
    createdAt: DateTimeSchema.optional(),
  })
  .superRefine((p, ctx) => {
    const ids = p.rotation.map((s) => s.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'duplicate session ids', path: ['rotation'] });

    const covered = new Set<number>();
    for (const phase of p.phases) {
      for (let w = phase.fromWeek; w <= phase.toWeek; w++) {
        if (w > p.weeks)
          ctx.addIssue({
            code: 'custom',
            message: `phase week ${w} beyond programme`,
            path: ['phases'],
          });
        if (covered.has(w))
          ctx.addIssue({
            code: 'custom',
            message: `week ${w} in several phases`,
            path: ['phases'],
          });
        covered.add(w);
      }
    }
  });
export type Programme = z.infer<typeof ProgrammeSchema>;
