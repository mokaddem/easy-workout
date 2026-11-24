import { describe, expect, it } from 'vitest';
import type { Profile } from '@/domain';
import { generateProgramme } from '@/engine';
import { referenceEquipment } from '../../../tests/fixtures/reference-equipment';
import { restartDeclined, restartedProgramme } from './restart';

const profile: Profile = {
  goal: 'muscle',
  level: 'beginner',
  daysPerWeek: 4,
  sessionMinutes: 45,
};
const current = generateProgramme({ profile, equipment: referenceEquipment });

describe('restartedProgramme', () => {
  it('keeps the inputs and the level, whatever the profile says now', () => {
    const next = restartedProgramme(
      current,
      { ...profile, level: 'intermediate', daysPerWeek: 5 },
      referenceEquipment,
    );
    expect(next.generation?.profile.level).toBe('beginner');
    expect(next.generation?.profile.daysPerWeek).toBe(4);
    expect(next.rotation.map((s) => s.id)).toEqual(current.rotation.map((s) => s.id));
  });

  it('takes the joints and switches of the profile now', () => {
    const since = '2026-11-01T00:00:00.000Z';
    const next = restartedProgramme(
      current,
      { ...profile, quiet: true, limitations: [{ region: 'knee', since }] },
      referenceEquipment,
    );
    expect(next.generation?.profile.quiet).toBe(true);
    expect(next.generation?.profile.limitations).toEqual([{ region: 'knee', since }]);
  });
});

describe('restartDeclined', () => {
  it('stays declined until a later session starts a new gap', () => {
    const last = '2026-08-01T10:00:00.000Z';
    expect(restartDeclined(last, undefined)).toBe(false);
    expect(restartDeclined(last, '2026-11-10T10:00:00.000Z')).toBe(true);
    // A session after the decline: the next gap's last session is later than the decline.
    expect(restartDeclined('2026-11-12T10:00:00.000Z', '2026-11-10T10:00:00.000Z')).toBe(false);
  });
});
