import { useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language, Phase } from '@/domain';
import styles from './WeekRuler.module.css';

export interface WeekRulerProps {
  weeks: number;
  phases: readonly Phase[];
  /** Selected week, or a whole phase (phase sheet). */
  selected: number | { from: number; to: number };
  /** The week the programme is on. */
  current: number;
  /** Absent: the ruler is a picture, not a control. */
  onSelect?: (week: number) => void;
}

/** Week 1…N as a radio group, with the phases bracketed underneath. */
export function WeekRuler({ weeks, phases, selected, current, onSelect }: WeekRulerProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const inSelection = (week: number) =>
    typeof selected === 'number' ? week === selected : week >= selected.from && week <= selected.to;
  const phaseSelected = (phase: Phase) =>
    typeof selected === 'number'
      ? selected >= phase.fromWeek && selected <= phase.toWeek
      : phase.fromWeek <= selected.to && phase.toWeek >= selected.from;
  const columns = { '--weeks': weeks } as CSSProperties;
  const numbers = Array.from({ length: weeks }, (_, i) => i + 1);

  const move = (week: number) => {
    if (week < 1 || week > weeks) return;
    onSelect?.(week);
    refs.current[week - 1]?.focus();
  };

  return (
    <div>
      <div
        className={styles.ruler}
        style={columns}
        {...(onSelect
          ? { role: 'radiogroup', 'aria-label': t('programme.week.group') }
          : { 'aria-hidden': true })}
      >
        {numbers.map((week) => {
          const className = [
            styles.cell,
            week < current ? styles.done : '',
            week === current ? styles.now : '',
            !onSelect && inSelection(week) ? styles.selected : '',
            !onSelect ? styles.static : '',
          ].join(' ');
          return onSelect ? (
            <button
              key={week}
              ref={(el) => {
                refs.current[week - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={inSelection(week)}
              aria-label={t('programme.week.label', { week })}
              tabIndex={inSelection(week) ? 0 : -1}
              className={className}
              onClick={() => onSelect(week)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  move(week + 1);
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  move(week - 1);
                }
              }}
            >
              {week}
            </button>
          ) : (
            <span key={week} className={className}>
              {week}
            </span>
          );
        })}
      </div>
      <ul className={styles.phases} style={columns} aria-hidden="true">
        {phases.map((phase) => (
          <li
            key={phase.fromWeek}
            className={`${styles.phase} ${phaseSelected(phase) ? styles.phaseSelected : ''}`}
            style={{ gridColumn: `${phase.fromWeek} / ${phase.toWeek + 1}` }}
          >
            {phase.origin === 'early'
              ? t('programme.week.lighterShort')
              : phase.name[lang].split(' + ')[0]}
          </li>
        ))}
      </ul>
    </div>
  );
}
