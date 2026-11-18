import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
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
  /** A band above the grabber, outside the scroll (the how-to's rest countdown). */
  banner?: ReactNode;
  /** A control beside the title (a close button), outside the heading so the name stays the title. */
  titleAction?: ReactNode;
  /** Content kept in view under the title while `children` scroll (the how-to's figure). */
  pinned?: ReactNode;
  className?: string;
  /**
   * When the owner is removed while the sheet is open (the screen under it ends), leave a
   * click-through copy that plays the exit, so the sheet does not vanish and nothing waits for it.
   */
  exitOnUnmount?: boolean;
}

/** Bottom sheet. Scrim and panel are separate elements so a motion pass can animate them apart. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  banner,
  titleAction,
  pinned,
  className,
  exitOnUnmount,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalDialog(ref, open, onClose);
  const live = useRef({ open, exit: !!exitOnUnmount });
  useLayoutEffect(() => {
    live.current = { open, exit: !!exitOnUnmount };
  });
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open && live.current.exit) leaveCopy(dialog);
    };
  }, []);

  const heading = (
    <h2 id={titleId} className={styles.title}>
      {title}
    </h2>
  );
  const lead = (
    <>
      <div className={styles.grabber} aria-hidden="true" />
      {titleAction ? (
        <div className={styles.titleRow}>
          {heading}
          {titleAction}
        </div>
      ) : (
        heading
      )}
      {description ? (
        <p id={descId} className={styles.description}>
          {description}
        </p>
      ) : null}
    </>
  );
  const fixedHead = footer !== undefined && pinned !== undefined;
  const head = fixedHead ? (
    children
  ) : (
    <>
      {lead}
      {pinned}
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
        {banner}
        {footer ? (
          <>
            {fixedHead ? (
              <div className={styles.head}>
                {lead}
                {pinned}
              </div>
            ) : null}
            <div className={cx(styles.scroll, fixedHead ? styles.scrollUnder : undefined)}>
              {head}
            </div>
            <div className={styles.footer}>{footer}</div>
          </>
        ) : (
          head
        )}
      </div>
    </dialog>
  );
}

/** A non-modal, click-through copy of an open sheet that plays the exit and removes itself. */
function leaveCopy(dialog: HTMLDialogElement) {
  const copy = dialog.cloneNode(true) as HTMLDialogElement;
  const resumed = dialog.hasAttribute('data-closing');
  const from = resumed ? (dialog.getAnimations?.({ subtree: true }) ?? []) : [];
  copy.dataset.closing = '';
  copy.setAttribute('aria-hidden', 'true');
  copy.setAttribute('inert', '');
  copy.style.pointerEvents = 'none';
  document.body.appendChild(copy);
  const remove = () => copy.remove();
  const running = copy.getAnimations?.({ subtree: true }) ?? [];
  // Already leaving: carry on from the same moment instead of starting over.
  running.forEach((a, i) => {
    const t = from[i]?.currentTime;
    if (t != null) a.currentTime = t;
  });
  if (running.length === 0) remove();
  else void Promise.allSettled(running.map((a) => a.finished)).then(remove);
  window.setTimeout(remove, 800);
}
