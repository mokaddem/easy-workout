import type {
  EquipmentInventory,
  Exercise,
  Language,
  Muscle,
  MovementPattern,
  Section,
} from '@/domain';
import { MOVEMENT_PATTERNS, MUSCLES } from '@/domain';
import { equipmentCapabilities, missingKinds } from '@/engine';
import { BLOCKING_CONCERNS, exerciseSafety, type Concern } from '@/engine/generate/safety';
import type { LoadContext } from '@/engine/generate/loads';
import { matchesQuery } from './fold';

/** An exercise the user can pick, with a warning when it is a poor fit. */
export interface Entry {
  exercise: Exercise;
  concern?: Concern;
}

export interface Filters {
  patterns: ReadonlySet<MovementPattern>;
  muscles: ReadonlySet<Muscle>;
}

export const NO_FILTERS: Filters = { patterns: new Set(), muscles: new Set() };

export const hasFilters = (f: Filters): boolean => f.patterns.size > 0 || f.muscles.size > 0;

/** Warm-up and mobility drills: only listed in the warm-up, or when searched for. */
export const isDrill = (e: Exercise): boolean =>
  e.tags.includes('warmup') || e.tags.includes('mobility');

/** Exercises the equipment allows and nothing makes unsafe; mild concerns ride along. */
export function pickable(
  exercises: readonly Exercise[],
  loads: LoadContext,
  section: Section,
): Entry[] {
  const out: Entry[] = [];
  for (const exercise of exercises) {
    const { concern } = exerciseSafety(exercise, loads, section === 'warmup');
    if (concern && BLOCKING_CONCERNS.has(concern)) continue;
    out.push(concern ? { exercise, concern } : { exercise });
  }
  return out;
}

const patternRank = new Map(MOVEMENT_PATTERNS.map((p, i) => [p, i] as const));
const muscleRank = new Map(MUSCLES.map((m, i) => [m, i] as const));

const nameOf = (e: Exercise, lang: Language) => e.name[lang];

export const exerciseMatches = (e: Exercise, query: string, filters: Filters): boolean =>
  matchesQuery([e.name.fr, e.name.en], query) &&
  (filters.patterns.size === 0 || filters.patterns.has(e.pattern)) &&
  (filters.muscles.size === 0 || e.primaryMuscles.some((m) => filters.muscles.has(m)));

/** Pattern families in movement order, then name; warm-up drills first in the warm-up, last elsewhere. */
export function sortEntries<T extends { exercise: Exercise }>(
  entries: readonly T[],
  section: Section,
  lang: Language,
): T[] {
  const drillFirst = section === 'warmup' ? -1 : 1;
  return [...entries].sort((a, b) => {
    const da = isDrill(a.exercise) ? drillFirst : 0;
    const db = isDrill(b.exercise) ? drillFirst : 0;
    if (da !== db) return da - db;
    const pa = patternRank.get(a.exercise.pattern) ?? 0;
    const pb = patternRank.get(b.exercise.pattern) ?? 0;
    if (pa !== pb) return pa - pb;
    return nameOf(a.exercise, lang).localeCompare(nameOf(b.exercise, lang), lang);
  });
}

/** Drills stay out of the main and finisher lists unless the user is searching. */
const visible = (e: Exercise, section: Section, query: string) =>
  section === 'warmup' || query.trim() !== '' || !isDrill(e);

/** What the picker shows for the search and filters, in order. */
export function listEntries(
  entries: readonly Entry[],
  section: Section,
  query: string,
  filters: Filters,
  lang: Language,
): Entry[] {
  return sortEntries(
    entries.filter(
      (en) => visible(en.exercise, section, query) && exerciseMatches(en.exercise, query, filters),
    ),
    section,
    lang,
  );
}

/** The movement and muscle filters worth offering: only what the shown exercises cover. */
export function filterOptions(
  entries: readonly Entry[],
  section: Section,
): { patterns: MovementPattern[]; muscles: Muscle[] } {
  const patterns = new Set<MovementPattern>();
  const muscles = new Set<Muscle>();
  for (const { exercise } of entries) {
    if (!visible(exercise, section, '')) continue;
    patterns.add(exercise.pattern);
    for (const m of exercise.primaryMuscles) muscles.add(m);
  }
  return {
    patterns: [...patterns].sort((a, b) => patternRank.get(a)! - patternRank.get(b)!),
    muscles: [...muscles].sort((a, b) => muscleRank.get(a)! - muscleRank.get(b)!),
  };
}

/** How many exercises the filters would show, with a candidate filter set. */
export const countFor = (
  entries: readonly Entry[],
  section: Section,
  query: string,
  filters: Filters,
): number =>
  entries.filter(
    (en) => visible(en.exercise, section, query) && exerciseMatches(en.exercise, query, filters),
  ).length;

/**
 * Matches that need equipment the user doesn't own: how many, and the items most often missing
 * (at most three).
 */
export function missingMatches(
  exercises: readonly Exercise[],
  entries: readonly Entry[],
  inventory: EquipmentInventory,
  section: Section,
  query: string,
  filters: Filters,
): { count: number; missing: string[] } {
  const owned = new Set(entries.map((en) => en.exercise.id));
  const capabilities = equipmentCapabilities(inventory);
  const tally = new Map<string, number>();
  let count = 0;
  for (const e of exercises) {
    if (owned.has(e.id) || !visible(e, section, query) || !exerciseMatches(e, query, filters))
      continue;
    const missing = missingKinds(e, capabilities);
    if (missing.length === 0) continue;
    count++;
    for (const kind of missing) tally.set(kind, (tally.get(kind) ?? 0) + 1);
  }
  const missing = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kind]) => kind);
  return { count, missing };
}

/** The suggested substitutes that are also pickable here, in the engine's order. */
export function suggested(
  substitutes: readonly Exercise[],
  entries: readonly Entry[],
  section: Section,
): Entry[] {
  const byId = new Map(entries.map((en) => [en.exercise.id, en] as const));
  return substitutes
    .map((s) => byId.get(s.id))
    .filter((en): en is Entry => en !== undefined && visible(en.exercise, section, ''));
}
