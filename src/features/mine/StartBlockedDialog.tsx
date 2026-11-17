import { useId, useRef } from 'react';
import { Button } from '@/ui/components';
import { useModalDialog } from '@/ui/components/useModalDialog';
import styles from '@/ui/components/Dialog.module.css';

export interface StartBlockedDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** Left out when there is nothing left to do without the unusable exercises. */
  withoutLabel: string | null;
  onWithout: () => void;
  editLabel: string;
  onEdit: () => void;
  cancelLabel: string;
}

/** Starting a session with exercises that can't be done: skip them, edit, or cancel. */
export function StartBlockedDialog({
  open,
  onClose,
  title,
  description,
  withoutLabel,
  onWithout,
  editLabel,
  onEdit,
  cancelLabel,
}: StartBlockedDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalDialog(ref, open, onClose);
  return (
    <dialog ref={ref} className={styles.root} aria-labelledby={titleId} aria-describedby={descId}>
      <div className={styles.scrim} data-part="scrim" onClick={onClose} />
      <div className={styles.panel} data-part="panel">
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={descId} className={styles.description}>
          {description}
        </p>
        <div className={styles.actions}>
          {withoutLabel ? (
            <Button fullWidth onClick={onWithout}>
              {withoutLabel}
            </Button>
          ) : null}
          <Button variant={withoutLabel ? 'secondary' : 'primary'} fullWidth onClick={onEdit}>
            {editLabel}
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
