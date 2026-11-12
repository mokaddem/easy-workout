import { describe, expect, it } from 'vitest';
import type { EquipmentInventory, Profile } from '../src/domain';
import { generateProgramme } from '../src/engine';
import { equipmentSets } from './fixtures/equipment-sets';
import { renderNotes, renderProgramme } from './support/render';

/** Readable programmes for a spread of profiles; review the diff whenever generation changes. */
const samples: [string, Profile, EquipmentInventory][] = [
  [
    'reference-recomposition-6d',
    { goal: 'recomposition', level: 'intermediate', daysPerWeek: 6, sessionMinutes: 55 },
    equipmentSets.reference!,
  ],
  [
    'reference-recomposition-6d-45min',
    { goal: 'recomposition', level: 'intermediate', daysPerWeek: 6, sessionMinutes: 45 },
    equipmentSets.reference!,
  ],
  [
    'bodyweight-fitness-beginner-3d',
    { goal: 'general-fitness', level: 'beginner', daysPerWeek: 3, sessionMinutes: 45 },
    equipmentSets.bodyweight!,
  ],
  [
    'bands-bar-muscle-returning-4d',
    { goal: 'muscle', level: 'returning', daysPerWeek: 4, sessionMinutes: 60, bodyweightKg: 82 },
    equipmentSets['bands-and-bar']!,
  ],
  [
    'kettlebells-recomposition-beginner-2d',
    {
      goal: 'recomposition',
      level: 'beginner',
      daysPerWeek: 2,
      sessionMinutes: 30,
      bodyweightKg: 64,
    },
    equipmentSets.kettlebells!,
  ],
  [
    'fixed-dumbbells-muscle-intermediate-5d',
    { goal: 'muscle', level: 'intermediate', daysPerWeek: 5, sessionMinutes: 60, bodyweightKg: 75 },
    equipmentSets['fixed-dumbbells']!,
  ],
  [
    'well-equipped-muscle-advanced-4d',
    { goal: 'muscle', level: 'advanced', daysPerWeek: 4, sessionMinutes: 75, bodyweightKg: 85 },
    equipmentSets['well-equipped']!,
  ],
  [
    'well-equipped-fitness-intermediate-3d-20min',
    { goal: 'general-fitness', level: 'intermediate', daysPerWeek: 3, sessionMinutes: 20 },
    equipmentSets['well-equipped']!,
  ],
];

describe('generator — sample programmes', () => {
  it.each(samples)('%s', async (name, profile, equipment) => {
    const programme = generateProgramme({ profile, equipment });
    const text = `${renderProgramme(programme)}\nWhy (choices other than the first preference):\n${renderNotes(programme)}\n`;
    await expect(text).toMatchFileSnapshot(`./__snapshots__/programmes/${name}.txt`);
  });
});
