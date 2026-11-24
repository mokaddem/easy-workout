import { describe, expect, it } from 'vitest';
import { makeLog, values } from '../../../tests/support/logs';
import { groupName, offerGroups, offerLine } from './cooldown';

// A stand-in translator: the key and its options, readable.
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}|${JSON.stringify(options)}` : key) as never;

const log = (exerciseIds: string[]) =>
  makeLog({
    id: 'l1',
    at: '2026-03-02T09:00:00.000Z',
    main: exerciseIds.map((exerciseId) => ({ exerciseId, sets: values(10, 10, 10) })),
  });

describe('cooldown offer', () => {
  it('names the trained groups in the order they were worked', () => {
    const l = log(['push-up', 'goblet-squat']);
    expect(offerGroups(l)).toEqual(expect.arrayContaining(['chest']));
    expect(offerGroups(l).indexOf('chest')).toBeLessThan(offerGroups(l).indexOf('quads'));
  });

  it('names at most four groups', () => {
    expect(
      offerGroups(log(['push-up', 'goblet-squat', 'pull-up', 'dumbbell-curl', 'plank'])).length,
    ).toBeLessThanOrEqual(4);
  });

  it('says something general when there is nothing to name', () => {
    expect(offerLine(t, log([]), 'en')).toBe('play.cooldown.offerGeneral');
  });

  it('lists the groups in lower case', () => {
    const named = ((key: string, options?: Record<string, unknown>) =>
      options ? String(options.groups) : key.endsWith('chest') ? 'Chest' : key) as never;
    expect(offerLine(named, log(['push-up']), 'en')).toBe('chest');
  });

  it('labels weekly groups and single muscles from their own keys', () => {
    expect(groupName(t, 'chest')).toBe('progress.group.chest');
    expect(groupName(t, 'hip-flexors')).toBe('labels.muscle.hip-flexors');
  });
});
