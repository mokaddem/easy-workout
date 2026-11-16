import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button, Icon, useToast } from '@/ui/components';
import { exportCancelled } from './cancelled';
import type { BackupReminderState } from './useBackupReminder';
import styles from './Backup.module.css';

/** Programme-tab reminder to export a backup. Firmer (never red) when storage was refused. */
export function BackupBanner({ state }: { state: BackupReminderState }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const firm = state.reminder === 'at-risk';
  const text =
    state.days === undefined
      ? t(firm ? 'settings.reminder.firmNever' : 'settings.reminder.never')
      : t(firm ? 'settings.reminder.firmAge' : 'settings.reminder.age', { count: state.days });

  const run = async () => {
    setBusy(true);
    try {
      if (await state.exportNow()) toast.show({ message: t('settings.data.toastBackup') });
      else {
        const { key, count } = exportCancelled(state.days);
        toast.show({ message: t(key, { count }) });
      }
    } catch {
      toast.show({ message: t('settings.data.toastFailed'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={`${styles.banner} ${firm ? styles.firm : ''}`}
      aria-labelledby="backup-reminder-title"
    >
      <div className={styles.bannerHead}>
        <span className={styles.well}>
          <Icon name={firm ? 'shield' : 'download'} size={24} />
        </span>
        <div className={styles.bannerText}>
          <h2 className={styles.bannerTitle} id="backup-reminder-title">
            {t(firm ? 'settings.reminder.firmTitle' : 'settings.reminder.title')}
          </h2>
          <p className={styles.muted}>{text}</p>
        </div>
      </div>
      <div className={styles.bannerActions}>
        <Button variant="secondary" fullWidth loading={busy} onClick={() => void run()}>
          {t('settings.reminder.export')}
        </Button>
        <Button variant="ghost" onClick={() => void state.later()}>
          {t('settings.reminder.later')}
        </Button>
      </div>
    </section>
  );
}

/** One line with Export on the session summary. */
export function BackupLine({ state }: { state: BackupReminderState }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const firm = state.reminder === 'at-risk';

  const run = async () => {
    setBusy(true);
    try {
      if (await state.exportNow()) toast.show({ message: t('settings.data.toastBackup') });
      else {
        const { key, count } = exportCancelled(state.days);
        toast.show({ message: t(key, { count }) });
      }
    } catch {
      toast.show({ message: t('settings.data.toastFailed'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${styles.line} ${firm ? styles.lineFirm : ''}`}>
      <Icon name="download" size={20} />
      <p className={styles.lineText}>
        {state.days === undefined ? (
          t('settings.reminder.lineNever')
        ) : (
          <Trans i18nKey="settings.reminder.lineAge" count={state.days} components={{ b: <b /> }} />
        )}
      </p>
      <Button variant="secondary" loading={busy} onClick={() => void run()}>
        {t('settings.reminder.lineExport')}
      </Button>
    </div>
  );
}
