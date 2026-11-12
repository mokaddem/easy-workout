import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveProgramme, useProfile, useSettings } from '@/app/data';
import { navigate, useRoute, type Route } from '@/app/router';
import { Shell } from '@/app/Shell';
import { applyTheme } from '@/app/theme';
import { EquipmentScreen } from '@/features/equipment/EquipmentScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { PlaceholderScreen } from '@/features/placeholder/PlaceholderScreen';
import { PlayScreen } from '@/features/play/PlayScreen';
import { ProgrammeScreen } from '@/features/programme/ProgrammeScreen';
import { SessionScreen } from '@/features/programme/SessionScreen';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import { QuickScreen } from '@/features/quick/QuickScreen';
import { ProfileScreen } from '@/features/settings/ProfileScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { setLanguage } from '@/i18n';

function Screen({ route }: { route: Route }) {
  const { t } = useTranslation();
  switch (route.name) {
    case 'onboarding':
      return <OnboardingScreen />;
    case 'programme':
      return <ProgrammeScreen route={route} />;
    case 'session':
      return <SessionScreen route={route} />;
    case 'quick':
      return <QuickScreen route={route} />;
    case 'progress':
      return <ProgressScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'equipment':
      return <EquipmentScreen />;
    case 'play':
      return <PlayScreen route={route} />;
    case 'not-found':
      return <PlaceholderScreen title={t('common.notFound')} icon="close" back />;
  }
}

export default function App() {
  const settings = useSettings();
  const profile = useProfile();
  const programme = useActiveProgramme();
  const route = useRoute();

  const language = settings?.language;
  const theme = settings?.theme;
  useEffect(() => {
    if (language) void setLanguage(language);
  }, [language]);
  useEffect(() => (theme ? applyTheme(theme) : undefined), [theme]);

  const loading = profile === undefined || programme === undefined;
  const setUp = Boolean(profile && programme);
  const redirect: 'onboarding' | 'programme' | null = loading
    ? null
    : !setUp && route.name !== 'onboarding'
      ? 'onboarding'
      : setUp && route.name === 'onboarding'
        ? 'programme'
        : null;

  useEffect(() => {
    if (redirect) navigate({ name: redirect }, { replace: true });
  }, [redirect]);

  if (loading || redirect) return null;
  return (
    <Shell route={route}>
      <Screen route={route} />
    </Shell>
  );
}
