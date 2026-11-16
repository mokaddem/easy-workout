import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language, SessionLog } from '@/domain';
import { Button } from '@/ui/components';
import { useModalDialog } from '@/ui/components/useModalDialog';
import dialog from '@/ui/components/Dialog.module.css';
import { mainSetCounts } from '../format';
import styles from './Lifecycle.module.css';

interface Props {
  open: boolean;
  /** The session that is open (kept while the dialog animates out). */
  log: SessionLog | null;
  /** Left open for more than 12 hours. */
  stale: boolean;
  /** The session that was about to start. */
  next: string;
  onClose: () => void;
  onResume: () => void;
  /** Closes the open session (finished when it was left open for long, abandoned otherwise), then starts the new one. */
  onReplace: (stale: boolean) => Promise<void>;
}

/** Start was pressed while another session is open: resume it, or close it and start the new one. */
export function OpenSessionDialog({ open, log, stale, next, onClose, onResume, onReplace }: Props) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const [busy, setBusy] = useState(false);
  useModalDialog(ref, open, onClose);

  const counts = log ? mainSetCounts(log) : { done: 0, total: 0 };
  const params = {
    open: log?.plan.name[lang] ?? '',
    next,
    done: counts.done,
    total: counts.total,
  };
  const replace = async () => {
    setBusy(true);
    try {
      await onReplace(stale);
    } finally {
      setBusy(false);
    }
  };
  const resume = (
    <Button variant={stale ? 'secondary' : 'primary'} fullWidth onClick={onResume} disabled={busy}>
      {t('play.open.resume')}
    </Button>
  );
  const replaceButton = (
    <Button
      variant={stale ? 'primary' : 'secondary'}
      fullWidth
      loading={busy}
      onClick={() => void replace()}
    >
      {t(stale ? 'play.open.finishStart' : 'play.open.abandonStart')}
    </Button>
  );

  return (
    <dialog ref={ref} className={dialog.root} aria-labelledby={titleId} aria-describedby={descId}>
      <div className={dialog.scrim} data-part="scrim" onClick={busy ? undefined : onClose} />
      <div className={dialog.panel} data-part="panel">
        <h2 id={titleId} className={dialog.title}>
          {t(stale ? 'play.open.titleStale' : 'play.open.title')}
        </h2>
        <p id={descId} className={dialog.description}>
          {t(stale ? 'play.open.bodyStale' : 'play.open.body', params)}
        </p>
        <div className={dialog.actions}>
          {stale ? replaceButton : resume}
          {stale ? resume : replaceButton}
          <Button
            variant="ghost"
            fullWidth
            onClick={onClose}
            disabled={busy}
            className={styles.center}
          >
            {t('play.open.cancel')}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
