import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '@/domain';
import { Icon } from '@/ui/components';
import type { SessionIdentity } from './format';
import type { StripCell } from './weekStrip';
import styles from './WeekStrip.module.css';

/** The next seven days with each planned session on its day. Decorative: not a control. */
export function WeekStrip({
  cells,
  identities,
  lang,
}: {
  cells: StripCell[];
  identities: readonly SessionIdentity[];
  lang: Language;
}) {
  const { t } = useTranslation();
  const short = new Intl.DateTimeFormat(lang, { weekday: 'short' });
  const long = new Intl.DateTimeFormat(lang, { weekday: 'long' });
  const todayIndex = cells.findIndex((cell) => cell.today);
  const letterOf = (index: number): string | undefined => identities[index]?.letter ?? undefined;
  return (
    <section className={styles.root} aria-labelledby="week-strip-title">
      <h2 className={styles.title} id="week-strip-title">
        {t('programme.week.stripTitle')}
      </h2>
      <div className={styles.strip} role="table">
        {todayIndex >= 0 ? (
          <span
            className={styles.band}
            aria-hidden="true"
            style={{ '--day': todayIndex } as CSSProperties}
          />
        ) : null}
        <div role="row" style={{ display: 'contents' }}>
          {cells.map((cell) => {
            const weekday = long.format(cell.at);
            const planned = cell.session;
            const label =
              planned && planned.index >= 0
                ? t('programme.week.cell', {
                    weekday,
                    day: cell.day,
                    letter: letterOf(planned.index) ?? t('programme.week.cardio'),
                  })
                : planned
                  ? t('programme.week.doneCell', { weekday, day: cell.day })
                  : t('programme.week.rest', { weekday, day: cell.day });
            return (
              <div
                key={cell.date}
                role="cell"
                aria-label={label}
                className={`${styles.col} ${cell.today ? styles.today : ''}`}
              >
                <span className={styles.weekday} aria-hidden="true">
                  {cell.today ? t('programme.week.today') : short.format(cell.at)}
                </span>
                <span className={styles.date} aria-hidden="true">
                  {cell.day}
                </span>
                {planned ? (
                  <span className={`${styles.cell} ${styles[planned.kind]}`} aria-hidden="true">
                    {planned.kind === 'done' ? (
                      <Icon name="check" size={20} />
                    ) : (
                      (letterOf(planned.index) ?? <Icon name="heart" size={20} />)
                    )}
                  </span>
                ) : (
                  <span className={styles.rest} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
