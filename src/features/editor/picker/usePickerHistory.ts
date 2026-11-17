import { useEffect, useRef } from 'react';

let pendingBack: ReturnType<typeof setTimeout> | null = null;

/**
 * While `open`, the picker owns one history entry: the system back button closes it and leaves
 * the screen underneath alone. Closing from the interface drops the entry again without the
 * router ever seeing it.
 */
export function usePickerHistory(open: boolean, onClose: () => void): void {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    if (pendingBack !== null) {
      // Closed and reopened in the same tick (a remount): keep the entry.
      clearTimeout(pendingBack);
      pendingBack = null;
    } else {
      const state: unknown = history.state;
      history.pushState({ ...(typeof state === 'object' ? state : null), picker: true }, '');
    }
    let popped = false;
    const onPop = (event: PopStateEvent) => {
      event.stopImmediatePropagation();
      popped = true;
      window.removeEventListener('popstate', onPop, true);
      latest.current();
    };
    window.addEventListener('popstate', onPop, true);
    return () => {
      window.removeEventListener('popstate', onPop, true);
      if (popped) return;
      pendingBack = setTimeout(() => {
        pendingBack = null;
        const swallow = (event: PopStateEvent) => {
          event.stopImmediatePropagation();
          window.removeEventListener('popstate', swallow, true);
        };
        window.addEventListener('popstate', swallow, true);
        history.back();
      }, 0);
    };
  }, [open]);
}
