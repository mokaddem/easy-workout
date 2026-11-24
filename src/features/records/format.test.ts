import i18next, { type TFunction } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ExerciseRecord } from '@/engine';
import { resources } from '@/i18n/resources';
import { recordLine, recordSetText } from './format';

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
    return instance.getFixedT(lng);
  };
  en = await make('en');
  fr = await make('fr');
});

const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

describe('recordSetText', () => {
  it('writes a loaded set as load × reps', () => {
    expect(
      plain(recordSetText(en, 'en', { value: 9, unit: 'reps', load: { kind: 'kg', kg: 22 } })),
    ).toBe('22 kg × 9');
    expect(
      plain(
        recordSetText(en, 'en', { value: 8, unit: 'reps', load: { kind: 'added-kg', kg: 10 } }),
      ),
    ).toBe('+10 kg × 8');
  });

  it('writes bodyweight reps and holds without a load', () => {
    expect(
      plain(recordSetText(en, 'en', { value: 12, unit: 'reps', load: { kind: 'bodyweight' } })),
    ).toBe('12 reps');
    expect(plain(recordSetText(en, 'en', { value: 45, unit: 'seconds' }))).toBe('45 s');
  });

  it('names the band and keeps a loaded hold readable', () => {
    const band = recordSetText(en, 'en', {
      value: 12,
      unit: 'reps',
      load: { kind: 'band', level: 'heavy' },
    });
    expect(plain(band)).toMatch(/ × 12$/);
    expect(
      plain(recordSetText(en, 'en', { value: 30, unit: 'seconds', load: { kind: 'kg', kg: 10 } })),
    ).toBe('10 kg · 30 s');
  });

  it('uses the decimal comma in French', () => {
    expect(
      plain(recordSetText(fr, 'fr', { value: 10, unit: 'reps', load: { kind: 'kg', kg: 22.5 } })),
    ).toBe('22,5 kg × 10');
  });
});

describe('recordLine', () => {
  const record: ExerciseRecord = {
    exerciseId: 'goblet-squat',
    logId: 'a',
    at: '2026-01-01T10:00:00.000Z',
    set: { value: 9, unit: 'reps', load: { kind: 'kg', kg: 22 }, itemKey: 'main/0/0', set: 1 },
    previous: { value: 12, unit: 'reps', load: { kind: 'kg', kg: 20 } },
    notable: true,
  };

  it('puts the record next to the best before it', () => {
    expect(plain(recordLine(en, 'en', record))).toBe('22 kg × 9 · best was 20 kg × 12');
    expect(plain(recordLine(fr, 'fr', record))).toBe('22 kg × 9 · avant : 20 kg × 12');
  });
});
