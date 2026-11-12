import { useTranslation } from 'react-i18next';
import { setLanguage } from '@/i18n';

export default function App() {
  const { t, i18n } = useTranslation();
  const other = i18n.language === 'fr' ? 'en' : 'fr';

  return (
    <main>
      <h1>{t('app.title')}</h1>
      <p>{t('app.tagline')}</p>
      <button
        type="button"
        onClick={() => void setLanguage(other)}
        aria-label={t('common.language')}
      >
        {other.toUpperCase()}
      </button>
    </main>
  );
}
