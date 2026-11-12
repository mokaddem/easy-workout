import { useId, useRef, type ReactNode } from 'react';
import { cx } from './cx';
import { useModalDialog } from './useModalDialog';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Bottom sheet. Scrim and panel are separate elements so a motion pass can animate them apart. */
export function Sheet({ open, onClose, title, description, children, className }: SheetProps) {
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
      <div className={cx(styles.panel, className)} data-part="panel">
        <div className={styles.grabber} aria-hidden="true" />
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description ? (
          <p id={descId} className={styles.description}>
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </dialog>
  );
}
