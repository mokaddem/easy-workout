import { exerciseById } from '@/catalogue';
import type { EquipmentInventory, Profile, Programme, SessionLog } from '@/domain';
import {
  carryEdits,
  cycleInputs,
  generateProgramme,
  loggedLifts,
  programmeChanges,
  type CarriedEdit,
  type Issue,
  type SlotChange,
} from '@/engine';

export type PreviewMode = 'variant' | 'new';

/** The programme that would replace the current one, from the same inputs or the current profile. */
export function nextProgramme(
  mode: PreviewMode,
  current: Programme,
  profile: Profile,
  equipment: EquipmentInventory,
  logs: readonly SessionLog[] = [],
): Programme {
  const generation = current.generation;
  // A later cycle stays that cycle: same number, same rotation away from the previous one. Lifts
  // it keeps that the user has logged start from what was lifted, not from an estimate.
  const cycle = cycleInputs(generation);
  const logged = cycle.lastCycle ? loggedLifts(Object.values(cycle.lastCycle), logs) : [];
  const known = logged.length > 0 ? { loggedExercises: logged } : {};
  return mode === 'variant' && generation
    ? generateProgramme({
        profile: generation.profile,
        equipment: generation.equipment,
        seed: generation.seed + 1,
        ...cycle,
        ...known,
      })
    : generateProgramme({ profile, equipment, seed: 0, ...cycle, ...known });
}

export interface PreviewData {
  /** What replaces the current programme: the generation with the user's changes carried over. */
  next: Programme;
  /** Generator changes only: the user's own edits are not counted. */
  changes: SlotChange[];
  splitChanged: boolean;
  sizeChanged: boolean;
  oldSize: number;
  /** Present when the programme has edits or placements. */
  ledger: { kept: CarriedEdit[]; dropped: CarriedEdit[] } | null;
  /** Warnings about the sessions the user's changes were carried into, by session id. */
  issues: Record<string, Issue[]>;
}

/** The programme has changes of the user's to carry over. */
export const hasUserEdits = (programme: Programme): boolean =>
  Boolean(programme.generatedRotation) || Object.keys(programme.placements ?? {}).length > 0;

export function previewData(
  mode: PreviewMode,
  current: Programme,
  profile: Profile,
  equipment: EquipmentInventory,
  customIds: ReadonlySet<string> = new Set(),
  painful: ReadonlySet<string> = new Set(),
  logs: readonly SessionLog[] = [],
): PreviewData {
  const generated = nextProgramme(mode, current, profile, equipment, logs);
  // Measured against the generation, not the user's edited rotation.
  const before: Programme = current.generatedRotation
    ? { ...current, rotation: current.generatedRotation }
    : current;
  const carried = hasUserEdits(current)
    ? carryEdits(
        current,
        generated,
        {
          profile: generated.generation?.profile ?? profile,
          inventory: generated.generation?.equipment ?? equipment,
          exercises: exerciseById,
        },
        customIds,
        { painful },
      )
    : null;
  return {
    next: carried?.programme ?? generated,
    changes: programmeChanges(before, generated),
    splitChanged:
      current.rotation.map((s) => s.id).join('|') !== generated.rotation.map((s) => s.id).join('|'),
    sizeChanged: current.rotation.length !== generated.rotation.length,
    oldSize: current.rotation.length,
    ledger: carried ? { kept: carried.kept, dropped: carried.dropped } : null,
    issues: carried?.issues ?? {},
  };
}
