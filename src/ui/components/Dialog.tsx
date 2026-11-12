import { useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { useModalDialog } from './useModalDialog';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Uses the destructive button for the confirm action. */
  destructive?: boolean;
  confirmLoading?: boolean;
}

/** Centred confirmation: two full-width buttons, stacked. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = false,
  confirmLoading = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalDialog(ref, open, onClose);

  return (
    <dialog
      ref={ref}
      className={styles.root}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      <div className={styles.scrim} data-part="scrim" onClick={onClose} />
      <div className={styles.panel} data-part="panel">
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description ? (
          <p id={descId} className={styles.description}>
            {description}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            fullWidth
            loading={confirmLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
