import type { EquipmentInventory, Profile, Programme } from '@/domain';
import { generateProgramme, programmeChanges, type SlotChange } from '@/engine';

export type PreviewMode = 'variant' | 'new';

/** The programme that would replace the current one, from the same inputs or the current profile. */
export function nextProgramme(
  mode: PreviewMode,
  current: Programme,
  profile: Profile,
  equipment: EquipmentInventory,
): Programme {
  const generation = current.generation;
  return mode === 'variant' && generation
    ? generateProgramme({
        profile: generation.profile,
        equipment: generation.equipment,
        seed: generation.seed + 1,
      })
    : generateProgramme({ profile, equipment, seed: 0 });
}

export interface PreviewData {
  next: Programme;
  changes: SlotChange[];
  splitChanged: boolean;
  sizeChanged: boolean;
  oldSize: number;
}

export function previewData(
  mode: PreviewMode,
  current: Programme,
  profile: Profile,
  equipment: EquipmentInventory,
): PreviewData {
  const next = nextProgramme(mode, current, profile, equipment);
  return {
    next,
    changes: programmeChanges(current, next),
    splitChanged:
      current.rotation.map((s) => s.id).join('|') !== next.rotation.map((s) => s.id).join('|'),
    sizeChanged: current.rotation.length !== next.rotation.length,
    oldSize: current.rotation.length,
  };
}
