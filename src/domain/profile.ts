import { z } from 'zod';
import { DateSchema, DateTimeSchema, int, LanguageSchema, positive } from './common';
import { EquipmentInventorySchema } from './equipment';
import { JointRegionSchema } from './exercise';

export const GOALS = ['muscle', 'recomposition', 'general-fitness'] as const;
export const GoalSchema = z.enum(GOALS);
export type Goal = z.infer<typeof GoalSchema>;

export const LEVELS = ['beginner', 'returning', 'intermediate', 'advanced'] as const;
export const LevelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof LevelSchema>;

/** A joint the user trains around. Lifted ones are kept (for the easing back in), but no longer avoided. */
export const LimitationSchema = z.strictObject({
  region: JointRegionSchema,
  since: DateTimeSchema,
  /** The user said it still bothers them, at this time. */
  reviewedAt: DateTimeSchema.optional(),
  liftedAt: DateTimeSchema.optional(),
});
export type Limitation = z.infer<typeof LimitationSchema>;

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const WeekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof WeekdaySchema>;

export const ProfileSchema = z.strictObject({
  goal: GoalSchema,
  level: LevelSchema,
  daysPerWeek: int(2, 6),
  sessionMinutes: int(15, 90),
  bodyweightKg: positive.optional(),
  /** Joints to avoid or spare; absent means none. */
  limitations: z.array(LimitationSchema).optional(),
  /** No jumps or impacts. */
  quiet: z.boolean().optional(),
  /** Moves that need more than a mat and arm room are left out. */
  smallSpace: z.boolean().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const SettingsSchema = z.strictObject({
  language: LanguageSchema,
  theme: z.enum(['system', 'dark', 'light']),
  voice: z.boolean(),
  sounds: z.boolean(),
  vibration: z.boolean(),
  /** Rest as a full-screen countdown or as a ring timer. */
  restDisplay: z.enum(['takeover', 'ring']),
  /** Exercise figures move; off shows their still. Absent means on. */
  figuresAnimated: z.boolean().optional(),
  lastBackupAt: DateTimeSchema.optional(),
  /** "Later" on the backup reminder hides it until then. */
  backupSnoozedUntil: DateTimeSchema.optional(),
  /** The weekly check-in card on the Programme tab. */
  checkInPrompt: z.boolean(),
  /** The check-in card was dismissed then; it comes back a week later. */
  checkInDismissedAt: DateTimeSchema.optional(),
  /** Days the user trains on, one per session of the week. */
  trainingDays: z.array(WeekdaySchema).optional(),
  /** The "still next" banner for a missed training day was dismissed then. */
  missedDayDismissedAt: DateTimeSchema.optional(),
  /** "Carry on" was chosen on the restart card then: it stays away until a new long gap starts after it. */
  restartDeclinedAt: DateTimeSchema.optional(),
  /** "Continue in the browser" was chosen on the install screen then: set-up goes on in the browser. */
  installSkippedAt: DateTimeSchema.optional(),
  /** The programme is paused since then. */
  pause: z.strictObject({ since: DateTimeSchema }).optional(),
  /** Equipment on hand while away, until the given day. */
  travelKit: z.strictObject({ equipment: EquipmentInventorySchema, until: DateSchema }).optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;
