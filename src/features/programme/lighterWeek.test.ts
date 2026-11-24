import i18next, { type TFunction } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Phase } from '@/domain';
import type { LighterWeekReason } from '@/engine';
import { resources } from '@/i18n/resources';
import { lighterWeekPlan, phaseLabel, reasonText } from './lighterWeek';

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

const reason = (code: LighterWeekReason['code'], params: Record<string, number>) => ({
  code,
  params,
  exerciseIds: [],
  logIds: [],
});

describe('reasonText', () => {
  it('says each reason with its counts', () => {
    expect(reasonText(en, reason('hard-sets', { sets: 10, misses: 7, sessions: 2 }))).toBe(
      'Over your last 2 sessions, 7 of 10 main sets were hard or short of the goal',
    );
    expect(reasonText(en, reason('stalled-lifts', { lifts: 3, of: 5, sessions: 3 }))).toBe(
      '3 of your 5 main lifts haven’t moved up in 3 sessions',
    );
    expect(reasonText(en, reason('pain-stops', { exercises: 2, days: 14 }))).toBe(
      'Pain stopped 2 different exercises in the last 14 days',
    );
  });

  it('has the same three sentences in French', () => {
    expect(reasonText(fr, reason('hard-sets', { sets: 10, misses: 7, sessions: 2 }))).toContain(
      '7 séries principales sur 10',
    );
    expect(reasonText(fr, reason('pain-stops', { exercises: 2, days: 14 }))).toContain(
      '14 derniers',
    );
  });
});

describe('lighterWeekPlan', () => {
  it('moves the weeks from the lighter one to the end back, and the cycle ends a week later', () => {
    expect(lighterWeekPlan({ startWeek: 5 }, 8)).toEqual({
      week: 5,
      from: 5,
      to: 8,
      oldEnd: 8,
      newEnd: 9,
    });
  });
});

describe('phaseLabel', () => {
  const phase = (en: string, from: number, to: number, early = false): Phase => ({
    name: { en, fr: en },
    kind: early ? 'deload' : 'volume',
    ...(early && { origin: 'early' as const }),
    fromWeek: from,
    toWeek: to,
    adjustments: [],
  });

  it('marks the part that resumes after an inserted lighter week', () => {
    const phases = [
      phase('Volume', 2, 4),
      phase('Lighter week', 5, 5, true),
      phase('Volume', 6, 6),
    ];
    expect(phaseLabel(en, 'en', phases, 0)).toBe('Volume');
    expect(phaseLabel(en, 'en', phases, 2)).toBe('Volume (cont.)');
  });

  it('keeps the name when the lighter week sits between two different phases', () => {
    const phases = [
      phase('Volume', 2, 4),
      phase('Lighter week', 5, 5, true),
      phase('Intensity', 6, 7),
    ];
    expect(phaseLabel(en, 'en', phases, 2)).toBe('Intensity');
  });
});
