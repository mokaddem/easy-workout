import { useTranslation } from 'react-i18next';
import type { CheckIn, Language } from '@/domain';
import { numberText } from '@/features/adapt/format';
import { Icon } from '@/ui/components';
import { dateOf, nbsp } from '../charts/format';
import styles from './body.module.css';

/** One check-in in the list: date block, values (missing ones dashed), the note on one line. */
export function CheckInRow({ checkIn, onOpen }: { checkIn: CheckIn; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const date = dateOf(checkIn.date);
  const month = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, { month: 'short' }).format(
    date,
  );
  const field = (key: 'weight' | 'waist' | 'sleep', value: number | undefined, unit: string) =>
    value === undefined ? (
      <span key={key} className={styles.missing}>
        {t(`stats.body.short.${key}`)}
        {nbsp}–
      </span>
    ) : (
      <span key={key}>
        {numberText(value, lang)}
        {nbsp}
        {unit}
      </span>
    );
  return (
    <li>
      <button type="button" className={styles.row} onClick={onOpen} data-checkin={checkIn.date}>
        <span className={styles.dateBlock} aria-hidden="true">
          <span className={styles.dateDay}>{date.getDate()}</span>
          <span className={styles.dateMonth}>{month}</span>
        </span>
        <span className={styles.rowText}>
          <span className={styles.values}>
            <span className={styles.sr}>
              {new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, {
                day: 'numeric',
                month: 'long',
              }).format(date)}
              {'. '}
            </span>
            {field('weight', checkIn.weightKg, t('labels.unit.kg'))}
            {field('waist', checkIn.waistCm, 'cm')}
            {field('sleep', checkIn.sleepHours, 'h')}
          </span>
          {checkIn.notes ? <span className={styles.rowNote}>{checkIn.notes}</span> : null}
        </span>
        <Icon name="chevron" size={20} className={styles.chev} />
      </button>
    </li>
  );
}
