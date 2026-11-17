import { useTranslation } from 'react-i18next';
import type { Language, Phase, Programme } from '@/domain';
import type { Position } from '@/app/programme-state';
import { Icon } from '@/ui/components';
import { rotationMarks } from './edits';
import { programmeIdentities } from './format';
import styles from './Overview.module.css';

/** Weeks down, sessions across: done, next, to do. Phases are bracketed on the right. */
export function RotationGrid({
  programme,
  position,
  onPhase,
}: {
  programme: Programme;
  position: Position;
  onPhase: (phase: Phase) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const identities = programmeIdentities(programme, lang);
  const marks = rotationMarks(programme);
  const size = programme.rotation.length;
  const perWeek = programme.sessionsPerWeek;
  const step = (position.week - 1) * perWeek + position.index;
  const weeks = Array.from({ length: programme.weeks }, (_, i) => i + 1);
  // Rotation continues across weeks: week w, column c is session number (w-1)*perWeek + c.
  const ordinal = (week: number, column: number) => (week - 1) * perWeek + column;
  const stateOf = (week: number, column: number) => {
    const n = ordinal(week, column);
    return n < step ? 'done' : n === step ? 'next' : week === position.week ? 'todo' : 'later';
  };
  /** One short word under the letter; the full name stays in the tooltip and the list below. */
  const shortLabel = (title: string): string => {
    if (/full|complet/i.test(title)) return t('programme.rotation.short.full');
    if (/^(bas du corps|lower)/i.test(title)) return t('programme.rotation.short.lower');
    if (/^(haut du corps|upper)/i.test(title)) return t('programme.rotation.short.upper');
    return title.split(/[\s,+]/)[0] ?? title;
  };
  const columns = Array.from({ length: Math.min(size, perWeek) }, (_, i) => i);
  const cols = { '--cols': columns.length } as React.CSSProperties;

  return (
    <div
      className={styles.grid}
      style={cols}
      role="table"
      aria-label={t('programme.rotation.table')}
    >
      <span />
      {columns.map((column) => {
        const identity = identities[column % size]!;
        const mine = marks.get(programme.rotation[column % size]!.id) === 'mine';
        return (
          <span
            key={column}
            className={`${styles.col} ${mine ? styles.colMine : ''}`}
            role="columnheader"
            title={identity.fullName}
            {...(mine && identity.letter
              ? { 'aria-label': t('programme.rotation.mineSr', { letter: identity.letter }) }
              : {})}
          >
            {identity.letter ? <b>{identity.letter}</b> : <Icon name="heart" size={20} />}
            <span>
              {mine
                ? t('programme.rotation.mine')
                : identity.cardio
                  ? t('programme.rotation.cardio')
                  : shortLabel(identity.title)}
            </span>
          </span>
        );
      })}
      <span />
      {weeks.map((week) => (
        <Row
          key={week}
          week={week}
          columns={columns}
          stateOf={stateOf}
          isNow={week === position.week}
          letters={columns.map((c) => identities[c % size]?.letter)}
        />
      ))}
      {programme.phases.map((phase) => (
        <button
          key={phase.fromWeek}
          type="button"
          className={`${styles.phase} ${
            position.week >= phase.fromWeek && position.week <= phase.toWeek ? styles.phaseNow : ''
          }`}
          style={{
            gridColumn: `${columns.length + 2}`,
            gridRow: `${phase.fromWeek + 1} / ${phase.toWeek + 2}`,
          }}
          onClick={() => onPhase(phase)}
        >
          {phase.name[lang]}
        </button>
      ))}
    </div>
  );
}

function Row({
  week,
  columns,
  stateOf,
  isNow,
  letters,
}: {
  week: number;
  columns: number[];
  stateOf: (week: number, column: number) => 'done' | 'next' | 'todo' | 'later';
  isNow: boolean;
  letters: (string | undefined)[];
}) {
  const { t } = useTranslation();
  return (
    <>
      {isNow ? (
        <span className={styles.now} style={{ gridRow: week + 1 }} aria-hidden="true" />
      ) : null}
      <span className={styles.wk} style={{ gridRow: week + 1, gridColumn: 1 }}>
        {t('programme.rotation.weekShort', { week })}
      </span>
      {columns.map((column) => {
        const state = stateOf(week, column);
        const letter = letters[column];
        return (
          <span
            key={column}
            role="cell"
            aria-label={t(`programme.rotation.state.${state}`, { week })}
            className={`${styles.cell} ${
              state === 'done'
                ? styles.done
                : state === 'next'
                  ? styles.cellNext
                  : state === 'todo'
                    ? styles.cellTodo
                    : styles.cellLater
            }`}
            style={{ gridRow: week + 1, gridColumn: column + 2 }}
          >
            {state === 'done' ? (
              <Icon name="check" size={20} />
            ) : state === 'next' ? (
              (letter ?? <Icon name="heart" size={20} />)
            ) : null}
          </span>
        );
      })}
    </>
  );
}
