import { z } from 'zod';
import { IdSchema, int, SlugSchema } from './common';
import { EquipmentInventorySchema } from './equipment';
import { ProfileSchema } from './profile';

/** Where in a programme or session a note applies. Absent fields widen the scope. */
export const NoteRefSchema = z.strictObject({
  sessionId: IdSchema.optional(),
  section: z.enum(['warmup', 'main', 'finisher']).optional(),
  blockIndex: int(0).optional(),
  itemIndex: int(0).optional(),
});
export type NoteRef = z.infer<typeof NoteRefSchema>;

/** One reason behind a generated choice. The code is translated by the UI; params fill it in. */
export const GenerationNoteSchema = z.strictObject({
  code: SlugSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  ref: NoteRefSchema.optional(),
});
export type GenerationNote = z.infer<typeof GenerationNoteSchema>;

/** The inputs a programme was generated from, so it can be explained and regenerated. */
export const GenerationSchema = z.strictObject({
  /** Generator rules version: a newer version may produce a different programme from the same inputs. */
  version: int(1),
  profile: ProfileSchema,
  equipment: EquipmentInventorySchema,
  seed: int(0),
  /** Which cycle of training this programme is: 2 when it follows a finished one. Absent = 1. */
  cycle: int(1).optional(),
  /** The previous cycle's picks by `sessionId/slotId`: lifts kept, accessories rotated. */
  lastCycle: z.record(z.string(), SlugSchema).optional(),
  /** The equipment the previous cycle was made for. */
  lastCycleEquipment: EquipmentInventorySchema.optional(),
  /** Exercise → harder variant taking its place in this cycle. */
  upgrades: z.record(SlugSchema, SlugSchema).optional(),
  notes: z.array(GenerationNoteSchema),
});
export type Generation = z.infer<typeof GenerationSchema>;
