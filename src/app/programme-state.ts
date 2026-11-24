import type { EquipmentInventory, Profile, Programme } from '@/domain';
import { constraintsOf } from '@/engine';

/**
 * How a programme relates to the current profile and equipment.
 * - `current`: generated from them.
 * - `out-of-date`: level, minutes, bodyweight, equipment or what is avoided (limited joints, quiet,
 *   small space) changed; the user picks when to regenerate.
 * - `needs-new`: goal or days per week changed; the split itself is different.
 */
export type Freshness = 'current' | 'out-of-date' | 'needs-new';

export function programmeFreshness(
  programme: Programme,
  profile: Profile,
  equipment: EquipmentInventory,
): Freshness {
  const generation = programme.generation;
  if (!generation) return 'current';
  const was = generation.profile;
  if (was.goal !== profile.goal || was.daysPerWeek !== profile.daysPerWeek) return 'needs-new';
  if (
    was.level !== profile.level ||
    was.sessionMinutes !== profile.sessionMinutes ||
    was.bodyweightKg !== profile.bodyweightKg ||
    avoidedKey(was) !== avoidedKey(profile) ||
    !sameInventory(generation.equipment, equipment)
  )
    return 'out-of-date';
  return 'current';
}

/**
 * The programme is out of date only because of what the profile avoids (joints, quiet, small
 * space): it can be re-picked in place, without restarting the cycle.
 */
export function onlyConstraintsDiffer(
  programme: Programme,
  profile: Profile,
  equipment: EquipmentInventory,
): boolean {
  const was = programme.generation?.profile;
  if (!was || programmeFreshness(programme, profile, equipment) !== 'out-of-date') return false;
  return (
    was.level === profile.level &&
    was.sessionMinutes === profile.sessionMinutes &&
    was.bodyweightKg === profile.bodyweightKg &&
    sameInventory(programme.generation!.equipment, equipment)
  );
}

/** What a profile avoids, as the generator sees it: the limited joints now, quiet, small space. Dates never count. */
export function avoidedKey(profile: Pick<Profile, 'limitations' | 'quiet' | 'smallSpace'>): string {
  const c = constraintsOf(profile);
  return JSON.stringify([c.regions, c.quiet, c.smallSpace]);
}

/** Same items with the same specs, whatever the order. */
export function sameInventory(a: EquipmentInventory, b: EquipmentInventory): boolean {
  if (a.length !== b.length) return false;
  const key = (items: EquipmentInventory) =>
    JSON.stringify([...items].sort((x, y) => x.id.localeCompare(y.id)).map(canonical));
  return key(a) === key(b);
}

/** Same content, same JSON: object keys sorted at every level. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}

export { nextSession, type Position } from '@/engine/position';
