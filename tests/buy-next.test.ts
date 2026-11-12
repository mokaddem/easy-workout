import { describe, expect, it } from 'vitest';
import type { Profile } from '../src/domain';
import { buyNext } from '../src/engine';
import { equipmentSets } from './fixtures/equipment-sets';

const profile = (goal: Profile['goal'] = 'recomposition'): Profile => ({
  goal,
  level: 'intermediate',
  daysPerWeek: 4,
  sessionMinutes: 45,
  bodyweightKg: 75,
});

describe('what to buy next', () => {
  it('ranks by value, only lists purchases that change something, and is deterministic', () => {
    for (const equipment of Object.values(equipmentSets)) {
      const advice = buyNext(profile(), equipment);
      expect(buyNext(profile(), equipment)).toEqual(advice);
      for (const a of advice) expect(a.score).toBeGreaterThan(0);
      const values = advice.map((a) => a.value);
      expect(values).toEqual([...values].sort((x, y) => y - x));
    }
  });

  it('starts a bodyweight-only user with cheap gear that fills missing slots', () => {
    const [first] = buyNext(profile(), equipmentSets.bodyweight!);
    expect(first?.cost).toBe('low');
    expect(first?.gains.dropped).toBeGreaterThan(0);
  });

  it('shows the dumbbell swap slot by slot', () => {
    const dumbbells = buyNext(profile('muscle'), equipmentSets['bands-and-bar']!).find(
      (a) => a.id === 'adjustable-dumbbells',
    );
    expect(dumbbells?.changes).toContainEqual(
      expect.objectContaining({ slot: 'push-main', from: 'push-up', to: 'dumbbell-floor-press' }),
    );
  });

  it('suggests heavier dumbbells when the owned ones leave little room to progress', () => {
    const ids = buyNext(profile(), equipmentSets.reference!).map((a) => a.id);
    expect(ids).toContain('heavier-dumbbells');
    expect(ids).not.toContain('pull-up-bar');
  });

  it('drops a purchase once it is owned', () => {
    const [first] = buyNext(profile(), equipmentSets.bodyweight!);
    const after = buyNext(profile(), [...equipmentSets.bodyweight!, first!.item]).map((a) => a.id);
    expect(after).not.toContain(first!.id);
  });

  it('has little to add to a well-equipped home', () => {
    expect(buyNext(profile('muscle'), equipmentSets['well-equipped']!)).toEqual([]);
  });
});
