import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isCooldownLog, type SessionLog } from '@/domain';
import { Button, Icon, Sheet, type IconName } from '@/ui/components';
import { mainSetCounts } from '../format';
import { AbandonDialog } from './AbandonDialog';
import styles from './Lifecycle.module.css';

interface Props {
  open: boolean;
  log: SessionLog;
  onClose: () => void;
  onPauseLeave: () => void;
  onFinish: () => Promise<void>;
  onAbandon: () => Promise<void>;
}

/** The three ways out of a session, from the pause screen. */
export function LeaveSheet({ open, log, onClose, onPauseLeave, onFinish, onAbandon }: Props) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const counts = mainSetCounts(log);
  const cooldown = isCooldownLog(log);
  const rows: { id: string; icon: IconName; danger?: boolean; onClick: () => void }[] = [
    { id: 'pause', icon: 'pause', onClick: onPauseLeave },
    { id: 'finish', icon: 'flag', onClick: () => void onFinish() },
    { id: 'abandon', icon: 'close', danger: true, onClick: () => setConfirming(true) },
  ];
  return (
    <>
      <Sheet
        open={open && !confirming}
        onClose={onClose}
        title={t('play.leave.title')}
        description={
          counts.done === 0
            ? t('play.leave.none')
            : t('play.leave.done', { count: counts.done, total: counts.total })
        }
        footer={
          <Button variant="secondary" size="player" fullWidth onClick={onClose}>
            {t('play.leave.cancel')}
          </Button>
        }
      >
        <div className={styles.leaveRows}>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={styles.leaveRow}
              data-danger={row.danger || undefined}
              onClick={row.onClick}
            >
              <span className={styles.leaveWell}>
                <Icon name={row.icon} size={24} />
              </span>
              <span className={styles.leaveText}>
                <b>
                  {t(
                    cooldown && row.id === 'abandon'
                      ? 'play.cooldown.leaveStop'
                      : `play.leave.${row.id}`,
                  )}
                </b>
                <small>
                  {t(
                    cooldown && row.id === 'abandon'
                      ? 'play.cooldown.leaveStopHint'
                      : cooldown && row.id === 'finish'
                        ? 'play.cooldown.leaveFinishHint'
                        : `play.leave.${row.id}Hint`,
                  )}
                </small>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
      <AbandonDialog
        open={open && confirming}
        log={log}
        onClose={() => setConfirming(false)}
        onConfirm={onAbandon}
      />
    </>
  );
}
