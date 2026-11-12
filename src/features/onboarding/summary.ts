import type { TFunction } from 'i18next';
import { catalogue } from '@/catalogue';
import type { EquipmentInventory } from '@/domain';
import { availableExercises } from '@/engine';

/** "Élastiques, kettlebells" — kinds only, at most three, then "+N". */
export function equipmentKinds(inventory: EquipmentInventory, t: TFunction): string {
  const kinds = [...new Set(inventory.map((item) => item.kind))];
  if (kinds.length === 0) return t('onboarding.summary.bodyweightOnly');
  // Only the first item of the line keeps its capital.
  const shown = kinds.slice(0, 3).map((kind, index) => {
    const label = t(`labels.equipment.${kind}`);
    return index === 0 ? label : label.charAt(0).toLocaleLowerCase() + label.slice(1);
  });
  const rest = kinds.length - shown.length;
  return rest > 0
    ? `${shown.join(', ')} ${t('onboarding.summary.more', { count: rest })}`
    : shown.join(', ');
}

export function exerciseCount(inventory: EquipmentInventory): number {
  return availableExercises(catalogue, inventory).length;
}

/** "Élastiques, kettlebells. 132 exercices" */
export function equipmentSummary(inventory: EquipmentInventory, t: TFunction): string {
  return `${equipmentKinds(inventory, t)}. ${t('onboarding.summary.exercises', {
    count: exerciseCount(inventory),
  })}`;
}
