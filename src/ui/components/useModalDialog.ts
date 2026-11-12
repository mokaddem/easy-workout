import { useEffect, useRef, type RefObject } from 'react';

/**
 * Drives a native <dialog> from a controlled `open` flag.
 * Escape and native closes are reported through `onClose`; focus goes back to the opener.
 */
export function useModalDialog(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      // Reopened while still leaving: stay open, drop the leaving state.
      delete dialog.dataset.closing;
      if (!dialog.open) {
        opener.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      }
      return;
    }
    if (!dialog.open) return;
    // Focus goes back right away; the dialog stays on screen until its exit animation is done.
    opener.current?.focus();
    opener.current = null;
    dialog.dataset.closing = '';
    const running = dialog.getAnimations?.({ subtree: true }) ?? [];
    let cancelled = false;
    const finish = () => {
      if (cancelled || !dialog.open || !dialog.hasAttribute('data-closing')) return;
      delete dialog.dataset.closing;
      dialog.close();
    };
    if (running.length === 0) finish();
    else void Promise.allSettled(running.map((a) => a.finished)).then(finish);
    return () => {
      cancelled = true;
    };
  }, [ref, open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      // The parent owns the state: ask it to close instead of closing natively.
      event.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [ref]);

  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [ref]);
}
