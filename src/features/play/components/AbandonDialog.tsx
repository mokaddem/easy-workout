import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionLog } from '@/domain';
import { Dialog } from '@/ui/components';

interface Props {
  open: boolean;
  log: SessionLog;
  onClose: () => void;
  /** Resolves once the session is abandoned. */
  onConfirm: () => Promise<void>;
}

/** Abandoning always asks, and says what is kept. */
export function AbandonDialog({ open, log, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const main = log.sets.filter((set) => set.section !== 'warmup').length;
  const count = main > 0 ? main : log.sets.length;
  const body =
    log.sets.length === 0
      ? t('play.abandon.bodyNone')
      : t(log.source.kind === 'quick' ? 'play.abandon.bodyQuick' : 'play.abandon.body', { count });
  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={t('play.abandon.title')}
      description={body}
      confirmLabel={t('play.abandon.confirm')}
      cancelLabel={t('play.abandon.cancel')}
      destructive
      confirmLoading={busy}
      onConfirm={() => {
        setBusy(true);
        void onConfirm().finally(() => setBusy(false));
      }}
    />
  );
}
