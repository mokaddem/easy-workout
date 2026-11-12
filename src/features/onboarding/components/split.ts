import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { EquipmentInventory, Goal, Level } from '@/domain';
import { generateProgramme } from '@/engine';

export interface SplitInput {
  days: number;
  minutes: number;
  goal: Goal | null;
  level: Level | null;
  equipment: EquipmentInventory;
}

export interface SplitRow {
  id: string;
  name: string;
  letter: string | null;
}

const LETTERS = 'ABCDEFG';

/** The sessions the generator would produce for these answers. */
export function useSplit({ days, minutes, goal, level, equipment }: SplitInput): SplitRow[] {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'fr' ? 'fr' : 'en';
  return useMemo(() => {
    const programme = generateProgramme({
      profile: {
        goal: goal ?? 'general-fitness',
        level: level ?? 'intermediate',
        daysPerWeek: days,
        sessionMinutes: minutes,
      },
      equipment,
    });
    let letter = 0;
    return programme.rotation.map((session) => {
      const cardio = session.id === 'cardio';
      return {
        id: session.id,
        // The tile already shows the letter.
        name: session.name[lang].replace(/^(Séance|Session) [A-Z] — /, ''),
        letter: cardio ? null : (LETTERS[letter++] ?? null),
      };
    });
  }, [days, minutes, goal, level, equipment, lang]);
}

export function splitDescription(t: TFunction, days: number, minutes: number): string {
  const short = minutes < 30;
  const base =
    short && days > 2
      ? t('onboarding.schedule.desc.rotating', { days })
      : t(`onboarding.schedule.desc.${short ? 2 : days}`);
  return `${base} ${t('onboarding.schedule.noFixedDays')}`;
}
