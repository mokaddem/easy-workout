import { useEffect, useState } from 'react';
import type { Language } from '@/domain';

/** Whether any of the voices speaks the language (`fr-FR`, `fr_FR` and `fr` all count as French). */
export function hasVoiceFor(voices: readonly { lang: string }[], lang: Language): boolean {
  return voices.some((voice) => voice.lang.toLowerCase().split(/[-_]/)[0] === lang);
}

/** How long an empty voice list is given to fill in before it means "no voice". */
const LOAD_GRACE_MS = 1500;

/**
 * Whether the device can speak the language: undefined while the voice list may still be loading
 * (it fills in asynchronously on some browsers), then true or false.
 */
export function useVoiceAvailable(lang: Language): boolean | undefined {
  const [available, setAvailable] = useState<boolean | undefined>(() =>
    typeof speechSynthesis === 'undefined' ? false : undefined,
  );
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const synth = speechSynthesis;
    const timer = setTimeout(() => setAvailable((value) => value ?? false), LOAD_GRACE_MS);
    const read = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        clearTimeout(timer);
        setAvailable(hasVoiceFor(voices, lang));
      }
    };
    read();
    synth.addEventListener?.('voiceschanged', read);
    return () => {
      clearTimeout(timer);
      synth.removeEventListener?.('voiceschanged', read);
    };
  }, [lang]);
  return available;
}
