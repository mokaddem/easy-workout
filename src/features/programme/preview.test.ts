import { describe, expect, it } from 'vitest';
import type { Profile } from '@/domain';
import { generateProgramme } from '@/engine';
import { referenceEquipment } from '../../../tests/fixtures/reference-equipment';
import { inPlaceData, previewData } from './preview';

const profile: Profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 5,
  sessionMinutes: 60,
};
const active = generateProgramme({ profile, equipment: referenceEquipment });
const since = '2026-11-01T00:00:00.000Z';

describe('in-place preview', () => {
  it('keeps the programme and says what changes for a new joint', () => {
    const data = inPlaceData(active, { ...profile, limitations: [{ region: 'knee', since }] });
    expect(data.next.id).toBe(active.id);
    expect(data.next.weeks).toBe(active.weeks);
    expect(data.splitChanged).toBe(false);
    expect(data.inPlace?.added).toEqual(['knee']);
    expect(data.inPlace?.lifted).toEqual([]);
    expect(data.changes.length).toBeGreaterThan(0);
    for (const change of data.changes.filter((c) => !c.to)) {
      const cause = data.inPlace?.causes[`${change.sessionId}|${change.slot.replace(/-\d+$/, '')}`];
      expect(cause?.cause).toBe('region');
    }
  });

  it('names quiet as the cause of a removed slot', () => {
    const data = inPlaceData(active, { ...profile, quiet: true });
    expect(data.inPlace?.added).toEqual([]);
    for (const cause of Object.values(data.inPlace?.causes ?? {}))
      expect(['quiet', 'space', 'region']).toContain(cause.cause);
  });

  it('lifting brings the unconstrained programme back', () => {
    const limited = inPlaceData(active, { ...profile, limitations: [{ region: 'knee', since }] });
    const lifted = inPlaceData(limited.next, {
      ...profile,
      limitations: [{ region: 'knee', since, liftedAt: '2026-11-15T00:00:00.000Z' }],
    });
    expect(lifted.inPlace?.lifted).toEqual(['knee']);
    expect(lifted.inPlace?.added).toEqual([]);
    expect(lifted.changes.length).toBeGreaterThan(0);
    expect(lifted.next.id).toBe(active.id);
  });

  it('changes nothing when the constraints add nothing', () => {
    const data = inPlaceData(active, profile);
    expect(data.changes).toEqual([]);
    expect(data.inPlace?.volume).toEqual([]);
    expect(data.inPlace?.outEdits).toEqual([]);
  });

  it('is what previewData gives in constraints mode', () => {
    const next = { ...profile, smallSpace: true };
    const data = previewData('constraints', active, next, referenceEquipment);
    expect(data.inPlace).toBeDefined();
    expect(data.next.id).toBe(active.id);
  });
});
