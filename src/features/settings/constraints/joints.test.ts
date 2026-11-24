import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { resources } from '@/i18n/resources';
import { constraintsMeta, jointName, jointsText } from './joints';

const fr = i18next.createInstance();
const en = i18next.createInstance();

beforeAll(async () => {
  await fr.init({ lng: 'fr', resources: { fr: { translation: resources.fr } } });
  await en.init({ lng: 'en', resources: { en: { translation: resources.en } } });
});

describe('joint names', () => {
  it('uses the authored forms', () => {
    expect(jointName(fr.t, 'knee', 'the')).toBe('le genou');
    expect(jointName(fr.t, 'hip', 'your')).toBe('ta hanche');
    expect(jointName(fr.t, 'shoulder', 'the')).toBe('l’épaule');
    expect(jointName(en.t, 'lower-back', 'your')).toBe('your lower back');
    expect(jointName(en.t, 'ankle')).toBe('Ankle');
  });

  it('lists several joints as a sentence', () => {
    expect(jointsText(fr.t, 'fr', ['knee', 'shoulder'])).toBe('ton genou et ton épaule');
    expect(jointsText(en.t, 'en', ['knee'])).toBe('your knee');
  });
});

describe('row meta', () => {
  const draft = (
    regions: Parameters<typeof jointName>[1][],
    quiet = false,
    smallSpace = false,
  ) => ({
    regions,
    quiet,
    smallSpace,
  });

  it('names the joints, then the switches, lower case after the first', () => {
    expect(constraintsMeta(fr.t, draft(['knee'], true))).toBe('Genou, sans sauts');
    expect(constraintsMeta(en.t, draft(['knee', 'wrist'], true, true))).toBe(
      'Knee, wrist, no jumping, small space',
    );
    expect(constraintsMeta(fr.t, draft([], false, true))).toBe('Petit espace');
  });

  it('is empty when nothing is avoided', () => {
    expect(constraintsMeta(en.t, draft([]))).toBeUndefined();
  });
});
