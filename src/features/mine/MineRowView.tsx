import { useTranslation } from 'react-i18next';
import { handleLinkClick, routeHref } from '@/app/router';
import type { Language } from '@/domain';
import { Icon } from '@/ui/components';
import { whenDone } from './logic';
import type { MineRow } from './useMine';
import styles from './Mine.module.css';

/** One of the user's own sessions in a list: length, name, focus and last time, where it runs. */
export function MineRowView({ row, now }: { row: MineRow; now: Date }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const name = row.session.name[lang];
  const focus = t(`labels.focus.${row.focus}`);
  const when = row.lastDone ? whenDone(row.lastDone, now) : undefined;
  const whenText = !when
    ? ''
    : when.kind === 'date'
      ? t('quick.mine.when.date', {
          date: when.date.toLocaleDateString(lang, { day: 'numeric', month: 'long' }),
        })
      : when.kind === 'days'
        ? t('quick.mine.when.days', { count: when.count })
        : t(`quick.mine.when.${when.kind}`);
  const meta = when
    ? t('quick.mine.meta', { focus, when: whenText })
    : t('quick.mine.never', { focus });
  const href = routeHref({ name: 'mine', sessionId: row.id });
  const letters = row.placedLetters.filter(Boolean);
  const placed = row.placedLetters.length > 0;

  return (
    <a href={href} className={styles.row} onClick={(event) => handleLinkClick(event, href)}>
      <span className={styles.well} aria-hidden="true">
        <span className={styles.wellNum}>~{row.session.estimatedMinutes}</span>
        <span className={styles.wellUnit}>{t('labels.unit.min')}</span>
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{meta}</span>
        {placed ? (
          <span className={styles.status}>
            {letters[0] ? (
              <span className={styles.letter} aria-hidden="true">
                {letters[0]}
              </span>
            ) : null}
            <span>{t('quick.mine.placed')}</span>
            {letters[0] ? (
              <span className={styles.srOnly}>
                {t('quick.mine.placedSr', { letter: letters.join(', ') })}
              </span>
            ) : null}
          </span>
        ) : null}
        {row.unusable > 0 ? (
          <span className={`${styles.status} ${styles.flag}`}>
            <Icon name="alert" size={20} />
            <span>{t('quick.mine.flag', { count: row.unusable })}</span>
          </span>
        ) : null}
      </span>
      <Icon name="chev-right" className={styles.chev} />
    </a>
  );
}
