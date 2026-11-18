import type { EquipmentInventory, EquipmentKind, Exercise } from '@/domain';
import { equipmentCapabilities, usableSetups } from '@/engine';

/**
 * The implements the exercise is done with: the kinds of its first usable setup (the first setup
 * listed when no inventory is known), for the figure to draw.
 */
export function equipmentInUse(
  exercise: Exercise | undefined,
  inventory?: EquipmentInventory,
): EquipmentKind[] | undefined {
  if (!exercise) return undefined;
  const setup =
    (inventory ? usableSetups(exercise, equipmentCapabilities(inventory))[0] : undefined) ??
    exercise.equipment[0];
  if (!setup?.length) return undefined;
  return [...new Set(setup.map((requirement) => requirement.kind))];
}
