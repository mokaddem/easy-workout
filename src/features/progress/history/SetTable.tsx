import { useTranslation } from 'react-i18next';
import type { Language } from '@/domain';
import { Icon } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { secondsText } from '../../adapt/format';
import { loadFigure } from '../highlights';
import type { ExerciseBlock, SetRow } from './blocks';
import styles from './History.module.css';

/** What a no-equipment stop turned into, as the user answered it. */
export type NoEquipmentAnswer = 'one-off' | 'swap' | undefined;

function valueText(t: ReturnType<typeof useTranslation>['t'], lang: Language, row: SetRow) {
  if (row.value === undefined) return undefined;
  switch (row.unit) {
    case 'reps':
      return t('progress.log.reps', { count: row.value });
    case 'seconds':
      return secondsText(row.value, lang);
    case 'minutes':
      return t('progress.log.minutes', { count: row.value });
    case 'rounds':
      return t('progress.log.rounds', { count: row.value });
  }
}

/** The sets logged for one exercise, read-only and compact. The text carries every value. */
export function SetTable({
  block,
  lang,
  answer,
}: {
  block: ExerciseBlock;
  lang: Language;
  answer: NoEquipmentAnswer;
}) {
  const { t } = useTranslation();
  if (block.rows.length === 0)
    return <p className={styles.stEmpty}>{t('progress.log.notReached')}</p>;
  const sided = block.rows.some((r) => r.side);
  const hasLoad = block.rows.some((r) => r.load);
  const columns = ['22px', sided && '22px', hasLoad && '1fr', '1fr', '58px']
    .filter(Boolean)
    .join(' ');
  const firstFlag = block.rows.findIndex((r) => r.flag === 'pain' || r.flag === 'no-equipment');
  return (
    <div className={styles.st} style={{ ['--st-columns' as string]: columns }}>
      {block.rows.map((row, i) => {
        const key = `${row.n}-${row.side ?? ''}-${i}`;
        const n = <span className={styles.stN}>{row.n}</span>;
        const side = sided ? (
          <span className={styles.stSideLabel}>
            {row.side ? (
              <>
                <span aria-hidden="true">{t(`progress.log.side.${row.side}`)}</span>
                <span className={styles.srOnly}>{t(`progress.log.sideLabel.${row.side}`)}</span>
              </>
            ) : null}
          </span>
        ) : null;

        if (row.flag === 'pain' || row.flag === 'no-equipment') {
          if (i !== firstFlag)
            return (
              <div key={key} className={cx(styles.stRow, styles.stOff)}>
                {n}
                <span className={styles.stOffText}>{t('progress.log.notDone')}</span>
              </div>
            );
          if (row.flag === 'pain')
            return (
              <div key={key} className={styles.stRow}>
                {n}
                <span className={cx(styles.stFlag, styles.stFlagPain)}>
                  <Icon name="stop" size={20} />
                  <span>
                    {t('progress.log.painSet')}
                    {row.value !== undefined ? (
                      <>
                        {' '}
                        <small>{t('progress.log.painAfter', { reps: row.value })}</small>
                      </>
                    ) : null}
                  </span>
                </span>
              </div>
            );
          return (
            <div key={key} className={styles.stRow}>
              {n}
              <span className={styles.stFlag}>
                <Icon name="alert" size={20} />
                <span>
                  {t('progress.log.noEquipment')}
                  {answer ? (
                    <>
                      {' '}
                      <small>
                        ({t(answer === 'swap' ? 'progress.log.forGood' : 'progress.log.oneOff')})
                      </small>
                    </>
                  ) : null}
                </span>
              </span>
            </div>
          );
        }
        if (row.flag === 'skipped')
          return (
            <div key={key} className={cx(styles.stRow, styles.stOff)}>
              {n}
              <span className={styles.stOffText}>{t('progress.log.skipped')}</span>
            </div>
          );

        const value = valueText(t, lang, row);
        const load = row.load ? loadFigure(t, lang, row.load) : undefined;
        return (
          <div key={key} className={styles.stRow}>
            {n}
            {side}
            {hasLoad ? <span className={styles.stV}>{load ?? ''}</span> : null}
            <span className={styles.stV}>
              {value ?? ''}
              {row.goal !== undefined && row.goal !== row.value ? (
                <small>{t('progress.log.goal', { goal: row.goal })}</small>
              ) : null}
            </span>
            <span className={styles.stFeel}>{row.feel ? t(`play.feel.${row.feel}`) : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
