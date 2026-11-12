import { z } from 'zod';
import { DateTimeSchema, int, LanguageSchema, positive } from './common';

export const GOALS = ['muscle', 'recomposition', 'general-fitness'] as const;
export const GoalSchema = z.enum(GOALS);
export type Goal = z.infer<typeof GoalSchema>;

export const LEVELS = ['beginner', 'returning', 'intermediate', 'advanced'] as const;
export const LevelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof LevelSchema>;

export const ProfileSchema = z.strictObject({
  goal: GoalSchema,
  level: LevelSchema,
  daysPerWeek: int(2, 6),
  sessionMinutes: int(15, 90),
  bodyweightKg: positive.optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const SettingsSchema = z.strictObject({
  language: LanguageSchema,
  theme: z.enum(['system', 'dark', 'light']),
  voice: z.boolean(),
  sounds: z.boolean(),
  vibration: z.boolean(),
  lastBackupAt: DateTimeSchema.optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;
