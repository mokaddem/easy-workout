import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '@/domain';
import { Rich } from '../adapt';
import { Card, Dialog, Icon } from '@/ui/components';
import { dayMonth } from './testFormat';
import styles from '../adapt/ProposalCard.module.css';

/**
 * After a very long break: start the programme again from week 1, or carry on with lighter
 * sessions. Answer rows, so the next-session card keeps the tab's one primary.
 */
export function RestartCard({
  days,
  lastAt,
  week,
  sessions,
  onRestart,
  onCarry,
}: {
  days: number;
  lastAt: string;
  /** The week the programme carries on in. */
  week: number;
  /** How many of the next sessions run lighter. */
  sessions: number;
  onRestart: () => Promise<void>;
  onCarry: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Card as="section" className={styles.pc} aria-labelledby="restart-title">
      <div className={styles.body}>
        <div className={styles.head}>
          <span className={styles.well}>
            <Icon name="hourglass" size={28} />
          </span>
          <div className={styles.headText}>
            <h2 className={styles.name} id="restart-title">
              {t('programme.restart.title')}
            </h2>
            <p className={styles.kick}>
              <Rich
                text={t('programme.restart.kicker', {
                  date: dayMonth(lastAt, lang),
                  days,
                })}
              />
            </p>
          </div>
        </div>
        <div className={styles.answers}>
          <button
            type="button"
            className={styles.ans}
            aria-haspopup="dialog"
            onClick={() => setConfirming(true)}
          >
            <Icon name="refresh" size={24} />
            <span className={styles.ansText}>
              <span className={styles.ansTitle}>{t('programme.restart.again')}</span>
              <span className={styles.ansSub}>{t('programme.restart.againSub')}</span>
            </span>
          </button>
          <button type="button" className={styles.ans} onClick={onCarry}>
            <Icon name="arrow-right" size={24} />
            <span className={styles.ansText}>
              <span className={styles.ansTitle}>{t('programme.restart.carry', { week })}</span>
              <span className={styles.ansSub}>
                {t('programme.restart.carrySub', { count: sessions })}
              </span>
            </span>
          </button>
        </div>
      </div>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('programme.restart.dialogTitle')}
        description={t('programme.restart.dialogBody')}
        confirmLabel={t('programme.restart.confirm')}
        cancelLabel={t('common.cancel')}
        confirmLoading={busy}
        onConfirm={() => {
          setBusy(true);
          void onRestart().finally(() => {
            setBusy(false);
            setConfirming(false);
          });
        }}
      />
    </Card>
  );
}
