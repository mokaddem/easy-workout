import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { updateSettings } from '@/app/data';
import { importBackup, type BackupFile } from '@/db/backup';
import type { Language } from '@/domain';
import { Button, Icon, Sheet, useToast } from '@/ui/components';
import { ImportErrorSheet, type ImportFailure } from './ImportErrorSheet';
import { countsOf, phoneCounts } from './phone';
import { downloadCopyBeforeImport, holdsData, readBackupFile, resumesSetup } from './restore';
import styles from './Data.module.css';

type Stage =
  | { kind: 'idle' }
  | { kind: 'preview' | 'busy'; backup: BackupFile; fileName: string; copy: boolean }
  | { kind: 'error'; reason: ImportFailure; fileName: string; backup?: BackupFile; copy?: boolean };

/**
 * Restore a backup before anything is set up, e.g. on a new phone. The app opens on the restored
 * programme as soon as the data is in.
 */
export function RestoreBackup({
  className,
  onRestored,
}: {
  className?: string;
  /** Called once the backup is in, before the app moves on. */
  onRestored?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const toast = useToast();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const picker = useRef<HTMLInputElement>(null);

  const pick = () => picker.current?.click();
  const close = () => setStage((s) => (s.kind === 'busy' ? s : { kind: 'idle' }));

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const read = await readBackupFile(file);
    if (!read.ok) {
      setStage({ kind: 'error', reason: read.reason, fileName: file.name });
      return;
    }
    const copy = holdsData((await phoneCounts()).counts);
    setStage({ kind: 'preview', backup: read.backup, fileName: file.name, copy });
  };

  const restore = async (backup: BackupFile, fileName: string, copy: boolean) => {
    setStage({ kind: 'busy', backup, fileName, copy });
    if (copy) {
      try {
        await downloadCopyBeforeImport(lang);
      } catch {
        setStage({ kind: 'error', reason: 'copy-failed', fileName, backup, copy });
        return;
      }
    }
    try {
      await importBackup(backup);
      await updateSettings({ lastBackupAt: backup.exportedAt });
    } catch {
      setStage({ kind: 'preview', backup, fileName, copy });
      toast.show({ message: t('onboarding.restore.failed'), tone: 'error' });
      return;
    }
    onRestored?.();
    if (!resumesSetup(backup)) {
      setStage({ kind: 'idle' });
      toast.show({ message: t('onboarding.restore.doneSetup') });
    }
  };

  const shown = stage.kind === 'preview' || stage.kind === 'busy' ? stage : null;
  const counts = shown ? countsOf(shown.backup) : null;
  const list = counts
    ? new Intl.ListFormat(lang, { type: 'conjunction' }).format(
        [
          counts.sessions > 0 && t('settings.data.n_sessions', { count: counts.sessions }),
          counts.sets > 0 && t('settings.data.n_sets', { count: counts.sets }),
          t('settings.data.n_programmes', { count: counts.programmes }),
        ]
          .filter((x): x is string => Boolean(x))
          // Keep each number with its noun.
          .map((x) => x.replace(' ', '\u00a0')),
      )
    : '';
  const date = shown
    ? new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(
        new Date(shown.backup.exportedAt),
      )
    : '';

  return (
    <>
      <Button variant="ghost" icon="upload" className={className} onClick={pick}>
        {t('onboarding.restore.button')}
      </Button>
      <input
        ref={picker}
        type="file"
        accept=".json,application/json"
        className={styles.file}
        aria-label={t('onboarding.restore.button')}
        tabIndex={-1}
        data-testid="restore-file"
        onChange={(event) => void onFile(event)}
      />

      <Sheet
        open={shown !== null}
        onClose={close}
        title={t('onboarding.restore.title')}
        footer={
          shown ? (
            <>
              <Button
                size="player"
                fullWidth
                loading={shown.kind === 'busy'}
                onClick={() => void restore(shown.backup, shown.fileName, shown.copy)}
              >
                {t('onboarding.restore.confirm')}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                disabled={shown.kind === 'busy'}
                onClick={close}
              >
                {t('common.cancel')}
              </Button>
            </>
          ) : undefined
        }
      >
        {shown ? (
          <div className={styles.sheetBody}>
            <div className={styles.lede}>
              <p className={styles.eyebrow}>{t('settings.import.previewTitle', { date })}</p>
              <p className={styles.file2}>
                <Icon name="file" size={20} />
                <span className={styles.fileName}>{shown.fileName}</span>
              </p>
            </div>
            <p className={styles.errText}>{t('onboarding.restore.holds', { list })}</p>
            {resumesSetup(shown.backup) ? null : (
              <p className={styles.notice}>
                <Icon name="info" size={20} />
                <span>{t('onboarding.restore.noProgramme')}</span>
              </p>
            )}
            {shown.copy ? (
              <p className={styles.notice}>
                <Icon name="download" size={20} />
                <span>{t('onboarding.restore.copy')}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      <ImportErrorSheet
        error={stage.kind === 'error' ? stage : null}
        onClose={close}
        onAnother={() => {
          setStage({ kind: 'idle' });
          setTimeout(pick, 0);
        }}
        onRetry={() => {
          if (stage.kind === 'error' && stage.backup)
            void restore(stage.backup, stage.fileName, stage.copy ?? true);
        }}
      />
    </>
  );
}
