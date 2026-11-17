import { useTranslation } from 'react-i18next';
import type { ProgrammeWeekSets } from '@/engine';
import styles from '../ProgressScreen.module.css';

/** Working sets done against planned, one bar per muscle group. The figures carry the values. */
export function MeterList({ rows }: { rows: ProgrammeWeekSets['rows'] }) {
  const { t } = useTranslation();
  const scale = Math.max(1, ...rows.map((r) => Math.max(r.done, r.planned)));
  const pct = (n: number) => `${(Math.min(n, scale) / scale) * 100}%`;
  return (
    <>
      <ul className={styles.mlist}>
        {rows.map(({ group, done, planned }) => (
          <li key={group} className={styles.mrow}>
            <span className={styles.mName}>{t(`progress.group.${group}`)}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.plan} style={{ width: pct(planned) }} />
              <span
                className={styles.fill}
                style={{ width: pct(Math.min(done, planned || done)) }}
              />
              {done > planned && planned > 0 ? (
                <span className={styles.tick} style={{ left: pct(planned) }} />
              ) : null}
            </span>
            <span className={`${styles.mN} ${done === 0 ? styles.zero : ''}`}>
              <span className={styles.srOnly}>{t('progress.sets.sr', { done, planned })}</span>
              <span aria-hidden="true">
                {done}
                <small>/{planned}</small>
              </span>
            </span>
          </li>
        ))}
      </ul>
      <ul className={styles.legend} aria-hidden="true">
        <li>
          <span className={styles.swatchFill} />
          {t('progress.sets.done')}
        </li>
        <li>
          <span className={styles.swatchPlan} />
          {t('progress.sets.planned')}
        </li>
      </ul>
    </>
  );
}
