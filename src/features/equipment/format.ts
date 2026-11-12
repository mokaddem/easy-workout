import type { Language } from '@/domain';

/** Numbers with the language's decimal mark, at most one decimal. */
export function formatNumber(value: number, lang: Language): string {
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
    maximumFractionDigits: 1,
  }).format(value);
}
