import type { TFunction } from 'i18next';
import { exerciseById } from '@/catalogue';
import { isHousehold, type EquipmentInventory, type Language } from '@/domain';
import { equipmentCapabilities, missingKinds } from '@/engine';

/** What an exercise needs, said with articles ("the pull-up bar and the bench"). */
export function neededText(
  t: TFunction,
  lang: Language,
  exerciseId: string,
  inventory: EquipmentInventory,
): string {
  const exercise = exerciseById.get(exerciseId);
  if (!exercise) return '';
  let kinds = missingKinds(exercise, equipmentCapabilities(inventory));
  // Unsafe on today's setup rather than missing: name what it runs on.
  if (kinds.length === 0)
    kinds = (exercise.equipment[0] ?? []).map((r) => r.kind).filter((k) => !isHousehold(k));
  const words = kinds.map((kind) =>
    t(`mine.the.${kind}`, { defaultValue: t(`labels.equipment.${kind}`).toLocaleLowerCase(lang) }),
  );
  return new Intl.ListFormat(lang, { type: 'conjunction' }).format(words);
}

/** The line under an exercise that can no longer be done. */
export function unusableText(
  t: TFunction,
  lang: Language,
  exerciseId: string,
  inventory: EquipmentInventory,
): string {
  const needed = neededText(t, lang, exerciseId, inventory);
  if (!needed) return t('mine.custom.unusableOther');
  const many = needed.includes(',') || / (et|and) /.test(needed);
  return t(many ? 'mine.custom.unusableMany' : 'mine.custom.unusable', { equipment: needed });
}
