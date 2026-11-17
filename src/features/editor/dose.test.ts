import { describe, expect, it } from 'vitest';
import type { SessionItem } from '@/domain';
import { doseFacts, doseLine, doseNumber, itemNumber, range, usesEffort } from './dose';
import { actionFor, missingKinds } from './issueText';
import { exerciseById } from '@/catalogue';

const t = ((key: string, params?: Record<string, unknown>) =>
  `${key}${params ? JSON.stringify(params) : ''}`) as never;

const reps: SessionItem = { exerciseId: 'x', target: { kind: 'reps', min: 6, max: 10 }, rir: 2 };

describe('dose figures', () => {
  it('writes ranges and sets', () => {
    expect(range(8, 8)).toBe('8');
    expect(range(8, 12)).toBe('8–12');
    expect(doseNumber(reps, 4)).toEqual({ value: '4×6–10' });
    expect(itemNumber(reps)).toEqual({ value: '6–10' });
    expect(
      doseNumber({ exerciseId: 'x', target: { kind: 'time', minSec: 30, maxSec: 45 } }, 3),
    ).toEqual({ value: '3×30–45', unit: 's' });
    expect(
      doseNumber({ exerciseId: 'x', target: { kind: 'time', minSec: 30, maxSec: 30 } }, 1),
    ).toEqual({ value: '30', unit: 's' });
    expect(
      doseNumber(
        { exerciseId: 'x', target: { kind: 'cardio', minMinutes: 15, maxMinutes: 20 } },
        1,
      ),
    ).toEqual({ value: '15–20', unit: 'min' });
  });

  it('hides effort for jumps and timed work', () => {
    const jump = exerciseById.get('jump-squat');
    expect(usesEffort(reps, undefined)).toBe(true);
    if (jump) expect(usesEffort(reps, jump)).toBe(false);
    expect(
      usesEffort({ exerciseId: 'x', target: { kind: 'time', minSec: 20, maxSec: 30 } }, undefined),
    ).toBe(false);
  });

  it('puts effort and rest in one line', () => {
    expect(doseFacts(t, reps, 90, undefined, 'en')).toContain('editor.dose.restSet');
    expect(doseFacts(t, reps, 0, undefined, 'en')).toContain('labels.effort.rir');
    expect(doseLine(t, reps, 4, 90, undefined, 'en').startsWith('4 × 6–10, ')).toBe(true);
  });
});

describe('issue helpers', () => {
  it('names the equipment that is missing, household aside', () => {
    const press =
      exerciseById.get('dumbbell-bench-press') ?? exerciseById.get('barbell-bench-press');
    if (!press) return;
    const missing = missingKinds(press, []);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing).not.toContain('mat');
  });

  it('offers a fix where there is one', () => {
    expect(actionFor({ level: 'block', code: 'main-empty' })).toBe('add');
    expect(actionFor({ level: 'block', code: 'no-equipment' })).toBe('replace');
    expect(actionFor({ level: 'block', code: 'group-too-small' })).toBe('ungroup');
    expect(actionFor({ level: 'warn', code: 'many-sets' })).toBeNull();
  });
});
