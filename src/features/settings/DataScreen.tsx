import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, m } from 'motion/react';
import { Trans, useTranslation } from 'react-i18next';
import { EXIT_RATIO, useMotionTokens } from '@/motion';
import { updateSettings, useOpenSession, useSessionLogs, useSettings } from '@/app/data';
import { storagePersisted } from '@/app/backup';
import { goBack } from '@/app/router';
import { exerciseById } from '@/catalogue';
import { db } from '@/db';
import {
  backupFileName,
  exportBackup,
  importBackup,
  parseBackup,
  type BackupFile,
} from '@/db/backup';
import { setsCsv, setsCsvFileName } from '@/db/csv';
import type { Language } from '@/domain';
import { AppBar, Button, Card, Dialog, Icon, Sheet, useToast } from '@/ui/components';
import { exportJsonBackup } from './backupActions';
import { deliverFile } from './files';
import { countsOf, phoneCounts, type Counts } from './phone';
import styles from './Data.module.css';

type Stage =
  | { kind: 'idle' }
  | { kind: 'preview'; backup: BackupFile; fileName: string; phone: Counts; newer: number }
  | { kind: 'confirm'; backup: BackupFile; fileName: string; phone: Counts; newer: number }
  | { kind: 'busy'; backup: BackupFile; fileName: string; step: 'copy' | 'import' }
  | {
      kind: 'error';
      reason: 'not-a-backup' | 'invalid' | 'newer-version' | 'copy-failed';
      fileName: string;
      backup?: BackupFile;
    };

type Storage = 'granted' | 'refused' | 'unknown' | 'loading';

const DAY_MS = 86_400_000;

const ROWS: { key: keyof Omit<Counts, 'profile'>; label: string }[] = [
  { key: 'sessions', label: 'sessions' },
  { key: 'sets', label: 'sets' },
  { key: 'programmes', label: 'programmes' },
  { key: 'equipment', label: 'equipment' },
  { key: 'checkIns', label: 'checkIns' },
  { key: 'maxTests', label: 'maxTests' },
  { key: 'customSessions', label: 'customSessions' },
];

/** Backup, storage and import. */
export function DataScreen() {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const toast = useToast();
  const tokens = useMotionTokens();
  const settings = useSettings();
  const logs = useSessionLogs();
  const openSession = useOpenSession();
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null);
  const [storage, setStorage] = useState<Storage>('loading');
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [done, setDone] = useState<{ date: string; copy: string } | null>(null);
  const [now] = useState(() => Date.now());
  const picker = useRef<HTMLInputElement>(null);
  const note = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void storagePersisted().then((value) => {
      if (live) setStorage(value === true ? 'granted' : value === false ? 'refused' : 'unknown');
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (done) note.current?.scrollIntoView({ block: 'nearest' });
  }, [done]);

  const dateText = (iso: string, style: 'long' | 'full' = 'long') =>
    new Intl.DateTimeFormat(lang, {
      day: 'numeric',
      month: 'long',
      ...(style === 'full' && { year: 'numeric' }),
    }).format(new Date(iso));
  const longDate = (iso: string) =>
    new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(iso),
    );

  // Last backup block.
  const last = settings?.lastBackupAt;
  const days = last ? Math.max(0, Math.floor((now - Date.parse(last)) / DAY_MS)) : undefined;
  const sessionCount = logs?.length ?? 0;
  const setCount = logs?.reduce((sum, log) => sum + log.sets.length, 0) ?? 0;

  const programmeCount = useLiveQuery(() => db.programmes.count());
  const failed = () => toast.show({ message: t('settings.data.toastFailed'), tone: 'error' });

  const exportJson = async () => {
    setBusy('json');
    try {
      if ((await exportJsonBackup()) !== 'cancelled')
        toast.show({ message: t('settings.data.toastBackup') });
    } catch {
      failed();
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy('csv');
    try {
      const rows = await (await import('@/db/repo')).repo.listSessionLogs();
      const csv = setsCsv(rows, lang, (id) => exerciseById.get(id)?.name[lang]);
      if ((await deliverFile(csv, setsCsvFileName(), 'text/csv')) !== 'cancelled')
        toast.show({ message: t('settings.data.toastCsv') });
    } catch {
      failed();
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setDone(null);
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setStage({ kind: 'error', reason: 'not-a-backup', fileName: file.name });
      return;
    }
    const parsed = parseBackup(raw);
    if (!parsed.ok) {
      setStage({ kind: 'error', reason: parsed.reason, fileName: file.name });
      return;
    }
    const phone = await phoneCounts();
    const fileAt = parsed.backup.exportedAt;
    const newer = phone.sessionStarts.filter((start) => start > fileAt).length;
    setStage({
      kind: 'preview',
      backup: parsed.backup,
      fileName: file.name,
      phone: phone.counts,
      newer,
    });
  };

  const replace = async (backup: BackupFile, fileName: string) => {
    setStage({ kind: 'busy', backup, fileName, step: 'copy' });
    try {
      // The copy of what is on the phone now always downloads: no share sheet before a replace.
      const copyName = backupFileName().replace(
        'easy-workout-',
        lang === 'fr' ? 'easy-workout-avant-import-' : 'easy-workout-before-import-',
      );
      await deliverFile(JSON.stringify(await exportBackup()), copyName, 'application/json', {
        share: false,
      });
      setStage({ kind: 'busy', backup, fileName, step: 'import' });
      await importBackup(backup);
      await updateSettings({ lastBackupAt: backup.exportedAt });
      setDone({ date: dateText(backup.exportedAt), copy: copyName });
      setStage({ kind: 'idle' });
    } catch {
      setStage({ kind: 'error', reason: 'copy-failed', fileName, backup });
    }
  };

  const close = () => setStage({ kind: 'idle' });
  const pick = () => picker.current?.click();

  const sheetOpen = stage.kind === 'preview' || stage.kind === 'confirm' || stage.kind === 'busy';
  const confirmOpen = stage.kind === 'confirm' || stage.kind === 'busy';
  const withFile = stage.kind === 'preview' || stage.kind === 'confirm' ? stage : null;
  const kept = stage.kind === 'busy' ? stage : withFile;
  const previewDate = kept ? longDate(kept.backup.exportedAt) : '';
  const confirmDate = kept ? dateText(kept.backup.exportedAt) : '';

  return (
    <>
      <AppBar title={t('settings.data.title')} onBack={goBack} backLabel={t('common.back')} />

      <AnimatePresence initial={false}>
        {done ? (
          <m.div
            key="done"
            style={{ overflow: 'hidden' }}
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: { duration: tokens.duration.base, ease: tokens.ease.snap },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: { duration: tokens.duration.base * EXIT_RATIO, ease: tokens.ease.exit },
            }}
          >
            <div className={styles.doneNote} role="status" ref={note}>
              <p className={styles.notice}>
                <Icon name="check" size={20} />
                <span>
                  <Trans
                    i18nKey="settings.import.done"
                    values={{ date: done.date }}
                    components={{ b: <b /> }}
                  />{' '}
                  {t('settings.import.doneCopy', { file: done.copy })}
                </span>
              </p>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>

      <section className={styles.sec} aria-labelledby="data-backup">
        <h2 className={styles.heading} id="data-backup">
          {t('settings.data.backup')}
        </h2>
        <div className={styles.last}>
          <span className={styles.lastLabel}>{t('settings.data.last')}</span>
          <div className={styles.lastValue} data-testid="last-backup">
            {days === undefined ? (
              <span className={styles.lastWord}>{t('settings.data.never')}</span>
            ) : days === 0 ? (
              <span className={styles.lastWord}>{t('settings.data.today')}</span>
            ) : (
              <span className={styles.lastUnit}>
                <Trans
                  i18nKey="settings.data.ago"
                  count={days}
                  components={{ num: <span className={styles.lastNum} /> }}
                />
              </span>
            )}
          </div>
          {last ? (
            <span className={styles.lastMeta}>
              {t('settings.data.lastDate', {
                date: longDate(last),
                time: new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(
                  new Date(last),
                ),
              })}
            </span>
          ) : null}
        </div>
        <p className={styles.lastMeta}>
          {t('settings.data.counts', {
            list: [
              t('settings.data.n_sessions', { count: sessionCount }),
              t('settings.data.n_sets', { count: setCount }),
              t('settings.data.n_programmes', { count: programmeCount ?? 0 }),
            ].join(', '),
          })}
        </p>

        <div className={styles.action}>
          <Button
            size="player"
            fullWidth
            icon="download"
            loading={busy === 'json'}
            onClick={() => void exportJson()}
          >
            {t('settings.data.exportJson')}
          </Button>
          <p className={styles.hint}>{t('settings.data.exportJsonHint')}</p>
        </div>
        <div className={styles.action}>
          <Button
            variant="secondary"
            fullWidth
            icon="file"
            loading={busy === 'csv'}
            onClick={() => void exportCsv()}
          >
            {t('settings.data.exportCsv')}
          </Button>
          <p className={styles.hint}>{t('settings.data.exportCsvHint')}</p>
        </div>
      </section>

      <section className={styles.sec} aria-labelledby="data-storage">
        <h2 className={styles.heading} id="data-storage">
          {t('settings.data.storage')}
        </h2>
        <Card
          className={`${styles.status} ${storage === 'refused' || storage === 'unknown' ? styles.firm : ''}`}
        >
          <span className={styles.well}>
            <Icon name={storage === 'granted' ? 'shield-check' : 'shield'} size={24} />
          </span>
          <div className={styles.statusText}>
            <h3 className={styles.statusTitle}>
              {t(`settings.data.storage_${storage === 'loading' ? 'unknown' : storage}`)}
            </h3>
            <p className={styles.statusMeta}>
              {t(`settings.data.storage_${storage === 'loading' ? 'unknown' : storage}Meta`)}
            </p>
            {storage === 'refused' || storage === 'unknown' ? (
              <p className={styles.statusMeta}>
                <b>{t('settings.data.storageHint')}</b>
              </p>
            ) : null}
          </div>
        </Card>
      </section>

      <section className={styles.sec} aria-labelledby="data-import">
        <h2 className={styles.heading} id="data-import">
          {t('settings.data.import')}
        </h2>
        <p className={styles.hint}>{t('settings.data.importHint')}</p>
        <Button variant="secondary" fullWidth icon="upload" onClick={pick}>
          {t('settings.data.importButton')}
        </Button>
        <input
          ref={picker}
          type="file"
          accept=".json,application/json"
          className={styles.file}
          aria-label={t('settings.data.importButton')}
          tabIndex={-1}
          data-testid="import-file"
          onChange={(event) => void onFile(event)}
        />
      </section>

      <Sheet
        open={sheetOpen}
        onClose={close}
        title={t('settings.import.title')}
        footer={
          kept ? (
            <>
              <Button
                size="player"
                fullWidth
                onClick={() => withFile && setStage({ ...withFile, kind: 'confirm' })}
              >
                {t('settings.import.replace')}
              </Button>
              <Button variant="secondary" fullWidth onClick={close}>
                {t('common.cancel')}
              </Button>
            </>
          ) : undefined
        }
      >
        {kept ? (
          <div className={styles.sheetBody}>
            <div className={styles.lede}>
              <p className={styles.eyebrow}>
                {t('settings.import.previewTitle', { date: previewDate })}
              </p>
              <p className={styles.file2}>
                <Icon name="file" size={20} />
                <span className={styles.fileName}>{kept.fileName}</span>
              </p>
            </div>
            {withFile && withFile.newer > 0 ? (
              <p className={`${styles.notice} ${styles.alert}`}>
                <Icon name="alert" size={20} />
                <span>
                  <Trans
                    i18nKey="settings.import.newer"
                    count={withFile.newer}
                    components={{ b: <b /> }}
                  />
                </span>
              </p>
            ) : null}
            {withFile ? <Compare file={countsOf(withFile.backup)} phone={withFile.phone} /> : null}
          </div>
        ) : null}
      </Sheet>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (stage.kind === 'confirm') setStage({ ...stage, kind: 'preview' });
        }}
        title={t('settings.import.confirmTitle')}
        description={
          stage.kind === 'busy'
            ? t(stage.step === 'copy' ? 'settings.import.busyCopy' : 'settings.import.busyImport')
            : `${t('settings.import.confirmText', { date: confirmDate })}${
                openSession ? ` ${t('settings.import.confirmOpen')}` : ''
              }`
        }
        confirmLabel={t('settings.import.confirmAll')}
        cancelLabel={t('common.cancel')}
        destructive
        confirmLoading={stage.kind === 'busy'}
        onConfirm={() => {
          if (stage.kind === 'confirm') void replace(stage.backup, stage.fileName);
        }}
      />

      <Sheet
        open={stage.kind === 'error'}
        onClose={close}
        title={errorTitle(stage, t)}
        footer={
          stage.kind === 'error' ? (
            <>
              {stage.reason === 'newer-version' ? null : (
                <Button
                  size="player"
                  fullWidth
                  onClick={() => {
                    if (stage.reason === 'copy-failed' && stage.backup) {
                      void replace(stage.backup, stage.fileName);
                    } else {
                      close();
                      setTimeout(pick, 0);
                    }
                  }}
                >
                  {t(
                    stage.reason === 'copy-failed'
                      ? 'settings.import.retry'
                      : 'settings.import.another',
                  )}
                </Button>
              )}
              <Button
                variant={stage.reason === 'newer-version' ? 'primary' : 'secondary'}
                fullWidth
                onClick={close}
              >
                {t('common.close')}
              </Button>
            </>
          ) : undefined
        }
      >
        {stage.kind === 'error' ? (
          <div className={styles.sheetBody}>
            <span className={styles.errWell}>
              <Icon name="alert" size={24} />
            </span>
            <p className={styles.errText}>{t(`settings.import.error_${stage.reason}Text`)}</p>
            <p className={styles.file2}>
              <Icon name="file" size={20} />
              <span className={styles.fileName}>{stage.fileName}</span>
            </p>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

function errorTitle(stage: Stage, t: (key: string) => string): string {
  return stage.kind === 'error' ? t(`settings.import.error_${stage.reason}`) : '';
}

function Compare({ file, phone }: { file: Counts; phone: Counts }) {
  const { t, i18n } = useTranslation();
  const fmt = new Intl.NumberFormat(i18n.language);
  const rows = ROWS.filter((row) => file[row.key] > 0 || phone[row.key] > 0);
  return (
    <div className={styles.cmp} role="table" aria-label={t('settings.import.compare')}>
      <div role="row" className={styles.cmpRow}>
        <span role="columnheader" className={`${styles.cmpHead} ${styles.cmpFirst}`}>
          {' '}
        </span>
        <span role="columnheader" className={styles.cmpHead}>
          {t('settings.import.thisFile')}
        </span>
        <span role="columnheader" className={styles.cmpHead}>
          {t('settings.import.thisPhone')}
        </span>
      </div>
      {rows.map((row) => (
        <div role="row" className={styles.cmpRow} key={row.key}>
          <span role="rowheader" className={styles.cmpKey}>
            {t(`settings.import.kind_${row.label}`)}
          </span>
          <span role="cell" className={styles.cmpVal}>
            {fmt.format(file[row.key])}
          </span>
          <span role="cell" className={`${styles.cmpVal} ${styles.cmpPhone}`}>
            {fmt.format(phone[row.key])}
          </span>
        </div>
      ))}
      <div role="row" className={styles.cmpRow}>
        <span role="rowheader" className={styles.cmpKey}>
          {t('settings.import.kind_profile')}
        </span>
        <span role="cell" className={styles.cmpVal}>
          {file.profile ? <Icon name="check" size={20} /> : '–'}
        </span>
        <span role="cell" className={`${styles.cmpVal} ${styles.cmpPhone}`}>
          {phone.profile ? <Icon name="check" size={20} /> : '–'}
        </span>
      </div>
    </div>
  );
}
