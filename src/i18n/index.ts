import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

export type Language = 'fr' | 'en';

function detectLanguage(): Language {
  const nav = typeof navigator === 'undefined' ? '' : navigator.language;
  return nav.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: resources.fr },
    en: { translation: resources.en },
  },
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: Language): Promise<unknown> {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return i18n.changeLanguage(lang);
}

export default i18n;
