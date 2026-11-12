import { EquipmentItemSchema, type EquipmentInventory, type EquipmentItem } from '@/domain';

export type ItemError = 'no-weights' | 'range' | 'no-levels' | 'invalid';

/** What is wrong with an item's specs, if anything. */
export function itemError(item: EquipmentItem): ItemError | null {
  switch (item.kind) {
    case 'dumbbell':
      if (item.mode === 'fixed') return item.weights.length === 0 ? 'no-weights' : null;
      if (item.minKg >= item.maxKg) return 'range';
      break;
    case 'kettlebell':
      if (item.weights.length === 0) return 'no-weights';
      break;
    case 'band':
    case 'mini-band':
      if (item.levels.length === 0) return 'no-levels';
      break;
    default:
      break;
  }
  return EquipmentItemSchema.safeParse(item).success ? null : 'invalid';
}

/** Item ids whose specs are invalid (e.g. kettlebells ticked with no weight). Empty = can continue. */
export function invalidItems(items: EquipmentInventory): string[] {
  return items.filter((item) => itemError(item) !== null).map((item) => item.id);
}
