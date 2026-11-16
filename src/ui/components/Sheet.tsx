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
  /** Actions pinned at the bottom while the content above scrolls. */
  footer?: ReactNode;
  className?: string;
}

/** Bottom sheet. Scrim and panel are separate elements so a motion pass can animate them apart. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalDialog(ref, open, onClose);

  const head = (
    <>
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
    </>
  );

  return (
    <dialog
      ref={ref}
      className={styles.root}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      <div className={styles.scrim} data-part="scrim" onClick={onClose} />
      <div
        className={cx(styles.panel, footer ? styles.withFooter : undefined, className)}
        data-part="panel"
      >
        {footer ? (
          <>
            <div className={styles.scroll}>{head}</div>
            <div className={styles.footer}>{footer}</div>
          </>
        ) : (
          head
        )}
      </div>
    </dialog>
  );
}
