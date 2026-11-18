import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import type { EquipmentKind, Exercise, Language } from '@/domain';
import { equipmentInUse } from '@/features/figure';

const QUIET: readonly EquipmentKind[] = ['mat', 'wall', 'door'];

/** What the how-to header says about the exercise: its name and "pattern, equipment". */
export function useHowToText(
  exerciseId: string,
  equipment?: readonly EquipmentKind[],
): { exercise: Exercise | undefined; lang: Language; name: string; meta: string } {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const exercise = exerciseById.get(exerciseId);
  const kinds = (equipment ?? equipmentInUse(exercise) ?? []).filter((k) => !QUIET.includes(k));
  const gear = kinds.length
    ? kinds.map((k) => t(`labels.equipment.${k}`, { defaultValue: k }).toLocaleLowerCase(lang))
    : [t('labels.bodyweight').toLocaleLowerCase(lang)];
  return {
    exercise,
    lang,
    name: exercise?.name[lang] ?? exerciseId,
    meta: exercise
      ? t('howto.meta', {
          pattern: t(`labels.pattern.${exercise.pattern}`),
          equipment: gear.join(', '),
        })
      : '',
  };
}

/** The element's width, kept up to date. */
export function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = Math.round(el.clientWidth);
      if (w > 0) setWidth(w);
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** True on short screens, where the stage is smaller. */
export function useShortScreen(): boolean {
  const query = '(max-height: 699px)';
  const [short, setShort] = useState(() =>
    typeof matchMedia === 'undefined' ? false : matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia(query);
    const on = () => setShort(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return short;
}
