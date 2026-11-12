import { z } from 'zod';

export const LANGUAGES = ['fr', 'en'] as const;
export const LanguageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof LanguageSchema>;

const nonEmpty = z.string().trim().min(1);

/** Text shipped in every supported language. */
export const LocalizedTextSchema = z.strictObject({ fr: nonEmpty, en: nonEmpty });
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

/** Ordered list of short texts, same number of entries in every language. */
export const LocalizedStepsSchema = z
  .strictObject({
    fr: z.array(nonEmpty).min(1).max(5),
    en: z.array(nonEmpty).min(1).max(5),
  })
  .refine((steps) => steps.fr.length === steps.en.length, {
    message: 'fr and en must have the same number of steps',
  });
export type LocalizedSteps = z.infer<typeof LocalizedStepsSchema>;

/** Stable, human-readable kebab-case identifier for static content, e.g. `goblet-squat`. */
export const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected a kebab-case id');

/** Identifier for user data (generated). */
export const IdSchema = z.string().min(1);

export const DateTimeSchema = z.iso.datetime({ offset: true });
export const DateSchema = z.iso.date();

export const int = (min: number, max?: number) => {
  const base = z.number().int().min(min);
  return max === undefined ? base : base.max(max);
};

export const positive = z.number().positive();
