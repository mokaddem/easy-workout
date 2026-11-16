import { useTranslation } from 'react-i18next';
import { Button, Icon, Sheet } from '@/ui/components';
import type { ReadFailure } from './restore';
import styles from './Data.module.css';

export type ImportFailure = ReadFailure | 'copy-failed';

/** Why a backup can't be imported, with a way to pick another file or try again. */
export function ImportErrorSheet({
  error,
  onClose,
  onAnother,
  onRetry,
}: {
  error: { reason: ImportFailure; fileName: string } | null;
  onClose: () => void;
  onAnother: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const reason = error?.reason;
  return (
    <Sheet
      open={error !== null}
      onClose={onClose}
      title={reason ? t(`settings.import.error_${reason}`) : ''}
      footer={
        reason ? (
          <>
            {reason === 'newer-version' ? null : (
              <Button
                size="player"
                fullWidth
                onClick={reason === 'copy-failed' ? onRetry : onAnother}
              >
                {t(reason === 'copy-failed' ? 'settings.import.retry' : 'settings.import.another')}
              </Button>
            )}
            <Button
              variant={reason === 'newer-version' ? 'primary' : 'secondary'}
              fullWidth
              onClick={onClose}
            >
              {t('common.close')}
            </Button>
          </>
        ) : undefined
      }
    >
      {error ? (
        <div className={styles.sheetBody}>
          <span className={styles.errWell}>
            <Icon name="alert" size={24} />
          </span>
          <p className={styles.errText}>{t(`settings.import.error_${error.reason}Text`)}</p>
          <p className={styles.file2}>
            <Icon name="file" size={20} />
            <span className={styles.fileName}>{error.fileName}</span>
          </p>
        </div>
      ) : null}
    </Sheet>
  );
}
