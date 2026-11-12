import type { EquipmentInventory, Profile, Programme, SessionLog } from '@/domain';

/**
 * How a programme relates to the current profile and equipment.
 * - `current`: generated from them.
 * - `out-of-date`: level, minutes, bodyweight or equipment changed; the user picks when to regenerate.
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
    !sameInventory(generation.equipment, equipment)
  )
    return 'out-of-date';
  return 'current';
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

export interface Position {
  /** 1-based week. */
  week: number;
  /** Index in the rotation of the next session to run. */
  index: number;
  sessionId: string;
  /** Every session of every week is done. */
  finished: boolean;
}

/**
 * The next session in the rotation. No calendar: each completed session of this programme
 * moves the rotation on by one, and a week ends after `sessionsPerWeek` sessions.
 */
export function nextSession(
  programme: Programme & { id: string },
  logs: readonly SessionLog[] = [],
): Position {
  const size = programme.rotation.length;
  const perWeek = programme.sessionsPerWeek;
  const done = logs.filter(
    (log) =>
      log.status === 'completed' &&
      log.source.kind === 'programme' &&
      log.source.programmeId === programme.id,
  ).length;
  const total = perWeek * programme.weeks;
  const finished = done >= total;
  const step = Math.min(done, total - 1);
  const index = step % size;
  return {
    week: Math.floor(step / perWeek) + 1,
    index,
    sessionId: programme.rotation[index]!.id,
    finished,
  };
}
