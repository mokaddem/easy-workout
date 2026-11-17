import i18next, { type TFunction } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MaxTest } from '@/domain';
import type { Highlight } from '@/engine';
import { resources } from '@/i18n/resources';
import { bestText, highlightRow } from './highlights';

let en: TFunction;
let fr: TFunction;

beforeAll(async () => {
  const make = async (lng: 'fr' | 'en') => {
    const instance = i18next.createInstance();
    await instance.init({
      lng,
      resources: { [lng]: { translation: resources[lng] } },
      interpolation: { escapeValue: false },
    });
    return instance.t;
  };
  en = await make('en');
  fr = await make('fr');
});

const at = '2026-11-12T18:00:00.000Z';
const note = (code: string, params: Record<string, string | number>): Highlight => ({
  kind: 'note',
  exerciseId: 'floor-press',
  at,
  logId: 'l',
  note: { code, params },
});

describe('highlight rows', () => {
  it('words a load step with the new load in bold', () => {
    const row = highlightRow(en, 'en', note('load-up', { from: 'kg:15', to: 'kg:17.5' }));
    expect(row.icon).toBe('arrow-up');
    expect(row.line).toContain('<b>17.5');
    expect(row.line).toMatch(/^One step up/);
  });

  it('words a raised goal and falls back when the note carries none', () => {
    expect(highlightRow(fr, 'fr', note('reps-up', { from: 5, to: 9 })).line).toContain('Objectif');
    expect(highlightRow(en, 'en', note('hold', {})).line).toMatch(/^Moved up/);
  });

  it('marks a test with the medal', () => {
    const test = {
      id: 't',
      date: '2026-11-12',
      at,
      exerciseId: 'push-up',
      context: 'fresh',
      result: { kind: 'reps', reps: 23 },
    } as MaxTest;
    const row = highlightRow(en, 'en', { kind: 'test', exerciseId: 'push-up', at, test });
    expect(row.icon).toBe('target');
    expect(row.line).toContain('<b>23 reps</b>');
  });

  it('says a best set with its load', () => {
    expect(
      bestText(en, 'en', { value: 10, unit: 'reps', load: { kind: 'kg', kg: 12.5 }, level: 12.5 }),
    ).toBe('10 reps, 12.5\u00a0kg');
    expect(bestText(en, 'en', { value: 40, unit: 'seconds', level: 0 })).toBe('40 s');
  });
});
