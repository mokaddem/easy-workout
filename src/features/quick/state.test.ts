// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { EquipmentInventory, Profile } from '@/domain';
import { generateQuickSession } from '@/engine';
import { bodyweightBeginner, reference } from '../../../e2e/support/seed';
import { changedExercises, DEFAULT_CHOICES, loadChoices, saveChoices } from './state';

// @vitest-environment jsdom

afterEach(() => sessionStorage.clear());

describe('launcher choices', () => {
  it('starts on the defaults', () => {
    expect(loadChoices()).toEqual(DEFAULT_CHOICES);
  });

  it('keeps the choices for the visit', () => {
    saveChoices({ minutes: 20, focus: 'push', bodyweightOnly: true });
    expect(loadChoices()).toEqual({ minutes: 20, focus: 'push', bodyweightOnly: true });
  });

  it('ignores stored values it does not know', () => {
    sessionStorage.setItem('ew.quick.choices', JSON.stringify({ minutes: 7, focus: 'legs' }));
    expect(loadChoices()).toEqual(DEFAULT_CHOICES);
    sessionStorage.setItem('ew.quick.choices', '{broken');
    expect(loadChoices()).toEqual(DEFAULT_CHOICES);
  });
});

describe('shuffle detection', () => {
  const make = (
    seed: number,
    focus: 'push' | 'full',
    setup: { profile: Profile; equipment: EquipmentInventory } = reference,
  ) => generateQuickSession({ ...setup, minutes: 20, focus, seed }).session;

  it('reports nothing changed for the same session', () => {
    expect(changedExercises(make(0, 'push'), make(0, 'push'))).toBe(0);
  });

  it('reports nothing changed when a single-template focus cannot vary', () => {
    expect(changedExercises(make(0, 'push'), make(1, 'push'))).toBe(0);
  });

  it('counts the exercises that differ', () => {
    const count = changedExercises(
      make(0, 'full', bodyweightBeginner),
      make(1, 'full', bodyweightBeginner),
    );
    expect(count).toBeGreaterThan(0);
  });
});
