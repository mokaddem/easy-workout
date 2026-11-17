import type { ProgrammeRecord } from '@/db';
import type { Exercise, Language, Level, MaxTest } from '@/domain';
import { availableExercises, isTestable } from '@/engine';
import { fold } from '@/features/editor/picker/fold';
import type { EquipmentInventory } from '@/domain';

/** Exercises a max test may use here: testable, owned equipment, no warm-up or isolation drills. */
export function testableExercises(
  catalogue: readonly Exercise[],
  inventory: EquipmentInventory,
  level: Level | undefined,
): Exercise[] {
  return availableExercises(
    catalogue.filter(
      (e) => isTestable(e, level) && !e.tags.includes('warmup') && !e.tags.includes('isolation'),
    ),
    inventory,
  ).sort((a, b) => a.name.en.localeCompare(b.name.en));
}

export const matchesName = (exercise: Exercise, query: string, lang: Language): boolean => {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = fold(`${exercise.name[lang]} ${exercise.name.en} ${exercise.name.fr}`);
  return words.every((w) => hay.includes(w));
};

export type TestContextText =
  { kind: 'fresh'; beforeProgramme: boolean } | { kind: 'session'; cycle?: number };

/** How a test's row names where it was taken. */
export function contextOf(test: MaxTest, programmes: readonly ProgrammeRecord[]): TestContextText {
  const starts = programmes.map((p) => p.startedAt ?? p.createdAt).filter((x): x is string => !!x);
  const first = starts.sort()[0];
  if (test.context === 'fresh')
    return { kind: 'fresh', beforeProgramme: first !== undefined && test.at < first };
  const owner = test.programmeId ? programmes.find((p) => p.id === test.programmeId) : undefined;
  return {
    kind: 'session',
    ...(owner && { cycle: owner.generation?.cycle ?? 1 }),
  };
}
