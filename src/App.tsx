import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveProgramme, useProfile, useSettings } from '@/app/data';
import { navigate, useRoute, type Route } from '@/app/router';
import { Shell } from '@/app/Shell';
import { applyTheme } from '@/app/theme';
import { PlaceholderScreen } from '@/features/placeholder/PlaceholderScreen';
import { ProgrammeScreen } from '@/features/programme/ProgrammeScreen';
import { setLanguage } from '@/i18n';

/** Screens other than the landing one load on first visit; the offline cache holds them all. */
const OnboardingScreen = lazyScreen(
  () => import('@/features/onboarding/OnboardingScreen'),
  'OnboardingScreen',
);
const SessionScreen = lazyScreen(
  () => import('@/features/programme/SessionScreen'),
  'SessionScreen',
);
const QuickScreen = lazyScreen(() => import('@/features/quick/QuickScreen'), 'QuickScreen');
const ProgressScreen = lazyScreen(
  () => import('@/features/progress/ProgressScreen'),
  'ProgressScreen',
);
const SettingsScreen = lazyScreen(
  () => import('@/features/settings/SettingsScreen'),
  'SettingsScreen',
);
const ProfileScreen = lazyScreen(
  () => import('@/features/settings/ProfileScreen'),
  'ProfileScreen',
);
const DataScreen = lazyScreen(() => import('@/features/settings/DataScreen'), 'DataScreen');
const EquipmentScreen = lazyScreen(
  () => import('@/features/equipment/EquipmentScreen'),
  'EquipmentScreen',
);
const PlayScreen = lazyScreen(() => import('@/features/play/PlayScreen'), 'PlayScreen');
const MineListScreen = lazyScreen(() => import('@/features/mine/MineListScreen'), 'MineListScreen');
const MineScreen = lazyScreen(() => import('@/features/mine/MineScreen'), 'MineScreen');
const EditorScreen = lazyScreen(() => import('@/features/editor/EditorScreen'), 'EditorScreen');
const HistoryScreen = lazyScreen(
  () => import('@/features/progress/history/HistoryScreen'),
  'HistoryScreen',
);
const LogScreen = lazyScreen(() => import('@/features/progress/history/LogScreen'), 'LogScreen');
const ExercisesScreen = lazyScreen(
  () => import('@/features/progress/exercise/ExercisesScreen'),
  'ExercisesScreen',
);
const ExerciseScreen = lazyScreen(
  () => import('@/features/progress/exercise/ExerciseScreen'),
  'ExerciseScreen',
);
const BodyScreen = lazyScreen(() => import('@/features/progress/body/BodyScreen'), 'BodyScreen');
const TestsScreen = lazyScreen(
  () => import('@/features/progress/tests/TestsScreen'),
  'TestsScreen',
);
const PastScreen = lazyScreen(() => import('@/features/past/PastScreen'), 'PastScreen');
const PastProgrammeScreen = lazyScreen(
  () => import('@/features/past/PastProgrammeScreen'),
  'PastProgrammeScreen',
);
const PastSessionScreen = lazyScreen(
  () => import('@/features/past/PastSessionScreen'),
  'PastSessionScreen',
);
const ReviewScreen = lazyScreen(() => import('@/features/cycle/ReviewScreen'), 'ReviewScreen');
const TestScreen = lazyScreen(() => import('@/features/play/TestScreen'), 'TestScreen');

function lazyScreen<K extends string, P extends object>(
  load: () => Promise<Record<K, ComponentType<P>>>,
  name: K,
) {
  return lazy(async () => ({ default: (await load())[name] }));
}

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
      return <EquipmentScreen route={route} />;
    case 'data':
      return <DataScreen />;
    case 'play':
      return <PlayScreen route={route} />;
    case 'mine-list':
      return <MineListScreen />;
    case 'mine':
      return <MineScreen route={route} />;
    case 'edit':
      return <EditorScreen route={route} />;
    case 'history':
      return <HistoryScreen />;
    case 'log':
      return <LogScreen route={route} />;
    case 'exercises':
      return <ExercisesScreen />;
    case 'exercise':
      return <ExerciseScreen route={route} />;
    case 'body':
      return <BodyScreen />;
    case 'tests':
      return <TestsScreen />;
    case 'past':
      return <PastScreen />;
    case 'past-programme':
      return <PastProgrammeScreen route={route} />;
    case 'past-session':
      return <PastSessionScreen route={route} />;
    case 'review':
      return <ReviewScreen route={route} />;
    case 'test':
      return <TestScreen route={route} />;
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
      <Suspense fallback={null}>
        <Screen route={route} />
      </Suspense>
    </Shell>
  );
}
