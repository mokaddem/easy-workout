import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { resources } from '@/i18n/resources';
import { kitSummary } from './kitSummary';

const instance = i18next.createInstance();
beforeAll(async () => {
  await instance.init({
    lng: 'en',
    resources: { en: { translation: resources.en }, fr: { translation: resources.fr } },
    interpolation: { escapeValue: false },
  });
});

describe('kitSummary', () => {
  it('counts what stood in and what was left out', () => {
    const t = instance.getFixedT('en');
    const travel = {
      substitutions: { 'main/0/0': 'push-up', 'main/1/0': 'squat' },
      dropped: ['main/2/0:x:3'],
    };
    expect(kitSummary(t, travel)).toBe('2 exercises swapped, 1 dropped');
  });

  it('leaves out a clause that is zero', () => {
    const t = instance.getFixedT('en');
    expect(kitSummary(t, { substitutions: { 'main/0/0': 'push-up' }, dropped: [] })).toBe(
      '1 exercise swapped',
    );
    expect(kitSummary(t, { substitutions: {}, dropped: ['main/0/0:x:3', 'main/1/0:y:3'] })).toBe(
      '2 dropped',
    );
  });

  it('says that everything works when nothing changed', () => {
    expect(kitSummary(instance.getFixedT('fr'), { substitutions: {}, dropped: [] })).toBe(
      'tout est possible',
    );
    expect(kitSummary(instance.getFixedT('en'), undefined)).toBe('everything works');
  });
});
