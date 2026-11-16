import { describe, expect, it } from 'vitest';
import { hasVoiceFor } from './voices';

describe('hasVoiceFor', () => {
  it('matches the language whatever the region or separator', () => {
    expect(hasVoiceFor([{ lang: 'fr-FR' }], 'fr')).toBe(true);
    expect(hasVoiceFor([{ lang: 'fr_CA' }], 'fr')).toBe(true);
    expect(hasVoiceFor([{ lang: 'EN-us' }], 'en')).toBe(true);
    expect(hasVoiceFor([{ lang: 'en' }], 'en')).toBe(true);
  });
  it('is false without a voice for it', () => {
    expect(hasVoiceFor([], 'fr')).toBe(false);
    expect(hasVoiceFor([{ lang: 'en-GB' }, { lang: 'de-DE' }], 'fr')).toBe(false);
    expect(hasVoiceFor([{ lang: 'fil-PH' }], 'fr')).toBe(false);
  });
});
