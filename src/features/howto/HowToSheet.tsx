import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pulse } from '@/motion';
import { Button, IconButton, Sheet } from '@/ui/components';
import { HowToSteps, HowToStage, type HowToBodyProps } from './HowToBody';
import { useHowToText } from './useHowTo';
import styles from './howto.module.css';
import type { ReactNode } from 'react';

/** The countdown of the rest running under the sheet, in the player. */
export interface HowToRest {
  seconds: number;
  total: number;
}

export interface HowToSheetProps extends HowToBodyProps {
  open: boolean;
  onClose: () => void;
  /** A rest is running underneath: a yellow band keeps the countdown, and the sheet leaves at 0. */
  rest?: HowToRest | undefined;
  /** The row's own action, repeated above Close (e.g. "Add to the main block"). */
  action?: ReactNode;
}

/** How to do an exercise, in a sheet: the figure, the key cue and the numbered steps. */
export function HowToSheet({ open, onClose, rest, action, ...body }: HowToSheetProps) {
  const { t } = useTranslation();
  const { name } = useHowToText(body.exerciseId, body.equipment);
  // Once opened the body stays, so the content does not vanish while the sheet leaves.
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  const over = rest !== undefined && rest.seconds <= 0;
  useEffect(() => {
    if (open && over) onClose();
  }, [open, over, onClose]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={name}
      titleAction={<IconButton icon="close" label={t('howto.close')} onClick={onClose} />}
      pinned={opened && body.exerciseId ? <HowToStage {...body} /> : null}
      className={styles.sheet}
      exitOnUnmount={rest !== undefined}
      banner={
        rest ? (
          <div className={styles.band} role="timer" aria-label={t('howto.restBand')}>
            <span className={styles.bandLabel}>{t('howto.restBand')}</span>
            <span className={styles.bandN}>
              <Pulse fire={rest.seconds > 0 && rest.seconds <= 3 ? rest.seconds : false}>
                {Math.max(0, rest.seconds)}
              </Pulse>
              <small>s</small>
            </span>
            <i
              className={styles.bandBar}
              style={{
                width: `${Math.min(100, Math.max(0, (rest.seconds / Math.max(1, rest.total)) * 100))}%`,
              }}
            />
          </div>
        ) : undefined
      }
      footer={
        <>
          {action}
          <Button
            variant="secondary"
            fullWidth
            onClick={onClose}
            className={action ? styles.closeBeside : undefined}
          >
            {t('howto.close')}
          </Button>
        </>
      }
    >
      {opened && body.exerciseId ? (
        <HowToSteps exerciseId={body.exerciseId} equipment={body.equipment} />
      ) : null}
    </Sheet>
  );
}
