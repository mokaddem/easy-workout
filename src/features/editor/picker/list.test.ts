import { describe, expect, it } from 'vitest';
import { catalogue, exerciseById } from '@/catalogue';
import type { EquipmentInventory } from '@/domain';
import { BLOCKING_CONCERNS } from '@/engine/generate/safety';
import { substitutesFor } from '@/engine';
import { referenceEquipment } from '../../../../tests/fixtures/reference-equipment';
import {
  countFor,
  filterOptions,
  isDrill,
  listEntries,
  missingMatches,
  NO_FILTERS,
  pickable,
  suggested,
} from './list';

const loads = (inventory: EquipmentInventory) => ({ inventory, level: 'intermediate' as const });
const own = pickable(catalogue, loads(referenceEquipment), 'main');
const bodyweight = pickable(catalogue, loads([]), 'main');

describe('pickable', () => {
  it('lists only what the equipment allows, and never a blocked exercise', () => {
    expect(own.length).toBeGreaterThan(bodyweight.length);
    expect(bodyweight.length).toBeGreaterThan(0);
    for (const { concern } of own) expect(concern && BLOCKING_CONCERNS.has(concern)).toBeFalsy();
  });
});

describe('listEntries', () => {
  it('keeps warm-up drills out of the main list unless searched for', () => {
    const drill = own.find((e) => isDrill(e.exercise))!;
    const plain = listEntries(own, 'main', '', NO_FILTERS, 'en');
    expect(plain.some((e) => isDrill(e.exercise))).toBe(false);
    const found = listEntries(own, 'main', drill.exercise.name.en, NO_FILTERS, 'en');
    expect(found.map((e) => e.exercise.id)).toContain(drill.exercise.id);
  });

  it('lists drills first in the warm-up', () => {
    const warm = pickable(catalogue, loads(referenceEquipment), 'warmup');
    const list = listEntries(warm, 'warmup', '', NO_FILTERS, 'en');
    expect(isDrill(list[0]!.exercise)).toBe(true);
    const firstOther = list.findIndex((e) => !isDrill(e.exercise));
    expect(list.slice(firstOther).some((e) => isDrill(e.exercise))).toBe(false);
  });

  it('searches without accents, in either language', () => {
    const arnold =
      exerciseById.get('arnold-press') ?? catalogue.find((e) => /arnold/i.test(e.name.en))!;
    const folded = arnold.name.fr.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const hits = listEntries(own, 'main', folded, NO_FILTERS, 'fr');
    expect(hits.map((e) => e.exercise.id)).toContain(arnold.id);
  });

  it('filters by pattern and by primary muscle', () => {
    const squats = listEntries(
      own,
      'main',
      '',
      { ...NO_FILTERS, patterns: new Set(['squat']) },
      'en',
    );
    expect(squats.length).toBeGreaterThan(0);
    expect(squats.every((e) => e.exercise.pattern === 'squat')).toBe(true);
    const lats = listEntries(own, 'main', '', { ...NO_FILTERS, muscles: new Set(['lats']) }, 'en');
    expect(lats.every((e) => e.exercise.primaryMuscles.includes('lats'))).toBe(true);
    expect(countFor(own, 'main', '', { ...NO_FILTERS, muscles: new Set(['lats']) })).toBe(
      lats.length,
    );
  });

  it('orders by movement family, then name', () => {
    const list = listEntries(own, 'main', '', NO_FILTERS, 'en');
    const same = list.filter((e) => e.exercise.pattern === list[0]!.exercise.pattern);
    const names = same.map((e) => e.exercise.name.en);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
});

describe('filterOptions', () => {
  it('offers only movements and muscles the owned catalogue covers', () => {
    const options = filterOptions(bodyweight, 'main');
    expect(options.patterns).toContain('squat');
    expect(options.muscles.length).toBeGreaterThan(0);
    expect(options.patterns).not.toContain('mobility');
  });
});

describe('missingMatches', () => {
  it('counts matches that need equipment the user does not own, and names it', () => {
    const result = missingMatches(catalogue, bodyweight, [], 'main', 'pull-up', NO_FILTERS);
    expect(result.count).toBeGreaterThan(0);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing.length).toBeLessThanOrEqual(3);
  });
});

describe('suggested', () => {
  it('keeps the engine order and drops what cannot be picked here', () => {
    const base = exerciseById.get('push-up') ?? own[0]!.exercise;
    const subs = substitutesFor(base, referenceEquipment);
    const list = suggested(subs, own, 'main');
    expect(list.map((e) => e.exercise.id)).toEqual(
      subs.filter((s) => own.some((e) => e.exercise.id === s.id)).map((s) => s.id),
    );
  });
});
