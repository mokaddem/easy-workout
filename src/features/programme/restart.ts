import type { EquipmentInventory, Profile, Programme, SessionLog } from '@/domain';
import { previewData } from './preview';

/**
 * The programme started again from week 1: the profile it was generated from (so the level and
 * the split stay), with the joints, quiet and small space the profile has now, on the equipment
 * owned now. The user's edits carry over as on any regeneration.
 */
export function restartedProgramme(
  current: Programme,
  profile: Profile,
  equipment: EquipmentInventory,
  options: {
    customIds?: ReadonlySet<string>;
    painful?: ReadonlySet<string>;
    logs?: readonly SessionLog[];
  } = {},
): Programme {
  const base = current.generation?.profile ?? profile;
  const { limitations: _l, quiet: _q, smallSpace: _s, ...rest } = base;
  const inputs: Profile = {
    ...rest,
    ...(profile.limitations && { limitations: profile.limitations }),
    ...(profile.quiet && { quiet: true }),
    ...(profile.smallSpace && { smallSpace: true }),
  };
  return previewData(
    'new',
    current,
    inputs,
    equipment,
    options.customIds,
    options.painful,
    options.logs,
  ).next;
}

/**
 * "Carry on" was chosen for a gap that began at `lastAt` (the last session): the card stays away
 * until a later session is followed by a new long gap.
 */
export const restartDeclined = (lastAt: string, declinedAt: string | undefined): boolean =>
  declinedAt !== undefined && declinedAt >= lastAt;
