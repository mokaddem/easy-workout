import type { TFunction } from 'i18next';
import type { Profile } from '@/domain';

/** "Recomposition, intermédiaire, 4 × 45 min" */
export function profileSummary(profile: Profile, t: TFunction, language: string): string {
  return t('settings.profileSummary', {
    goal: t(`settings.goalShort.${profile.goal}`),
    level: t(`labels.level.${profile.level}`).toLocaleLowerCase(language),
    days: profile.daysPerWeek,
    minutes: profile.sessionMinutes,
  });
}
