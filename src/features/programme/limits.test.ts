import { describe, expect, it } from 'vitest';
import type { Profile } from '@/domain';
import { generateProgramme } from '@/engine';
import { referenceEquipment } from '../../../tests/fixtures/reference-equipment';
import { hasConstraints, leftOutPosition, programmeLimits } from './limits';

const base: Profile = {
  goal: 'recomposition',
  level: 'intermediate',
  daysPerWeek: 5,
  sessionMinutes: 60,
};
const since = '2026-11-01T00:00:00.000Z';

describe('programmeLimits', () => {
  it('knows when nothing is avoided', () => {
    expect(hasConstraints(base)).toBe(false);
    expect(hasConstraints({ ...base, quiet: true })).toBe(true);
    expect(
      hasConstraints({ ...base, limitations: [{ region: 'knee', since, liftedAt: since }] }),
    ).toBe(false);
  });

  it('lists what a joint changes in the programme', () => {
    const profile = { ...base, limitations: [{ region: 'knee' as const, since }] };
    const programme = generateProgramme({ profile, equipment: referenceEquipment });
    const limits = programmeLimits(programme, profile);
    expect(limits.capped.length).toBeGreaterThan(0);
    for (const l of limits.leftOut) expect(l.note.code).toBe('slot-limited');
  });

  it('has nothing for a programme made without constraints', () => {
    const programme = generateProgramme({ profile: base, equipment: referenceEquipment });
    const limits = programmeLimits(programme, base);
    expect(limits).toEqual({ leftOut: [], volume: [], capped: [] });
  });
});

describe('leftOutPosition', () => {
  it('places a left-out slot among the blocks that stayed', () => {
    const profile = { ...base, limitations: [{ region: 'shoulder' as const, since }] };
    const programme = generateProgramme({ profile, equipment: referenceEquipment });
    const notes = (programme.generation?.notes ?? []).filter((n) => n.code === 'slot-limited');
    for (const n of notes) {
      const at = leftOutPosition(programme, n.ref!.sessionId!, String(n.params.slot));
      const session = programme.rotation.find((s) => s.id === n.ref!.sessionId)!;
      expect(at === undefined || (at >= 0 && at <= session.main.length)).toBe(true);
    }
  });
});
