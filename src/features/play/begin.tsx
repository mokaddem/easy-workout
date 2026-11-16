import { useCallback, useState, type ReactNode } from 'react';
import { navigate, type Route } from '@/app/router';
import { OpenSessionError, repo } from '@/db/repo';
import type { SessionLog } from '@/domain';
import { OpenSessionDialog } from './components/OpenSessionDialog';
import { leftOpenTooLong } from './format';
import { clearSummary, finishFromOutside } from './lifecycle';
import { abandonOpenSession } from './start';
import { unlockAudio } from './signals';

interface Pending {
  open: SessionLog;
  stale: boolean;
  start: () => Promise<unknown>;
  to: Route;
  /** What is about to start, said in a sentence ("Session A — Push"). */
  next: string;
}

/**
 * Starts a session and goes to the player. When another session is open, a dialog asks what
 * to do with it first; mount `dialog` once in the screen.
 */
export function useBegin(): {
  begin: (start: () => Promise<unknown>, next: string, to?: Route) => Promise<void>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const [shown, setShown] = useState(false);

  const run = useCallback(async (start: () => Promise<unknown>, next: string, to: Route) => {
    const ask = (open: SessionLog) => {
      setPending({ open, stale: leftOpenTooLong(open, Date.now()), start, to, next });
      setShown(true);
    };
    // The Start tap is the gesture that lets the player make sound later.
    unlockAudio();
    const open = await repo.getOpenSession();
    if (open) {
      ask(open);
      return;
    }
    try {
      await start();
    } catch (error) {
      if (!(error instanceof OpenSessionError)) throw error;
      const other = await repo.getOpenSession();
      if (other) {
        ask(other);
        return;
      }
    }
    clearSummary();
    navigate(to);
  }, []);

  const begin = useCallback(
    (start: () => Promise<unknown>, next: string, to: Route = { name: 'play' }) =>
      run(start, next, to),
    [run],
  );

  const dialog = (
    <OpenSessionDialog
      open={shown}
      log={pending?.open ?? null}
      stale={pending?.stale ?? false}
      next={pending?.next ?? ''}
      onClose={() => setShown(false)}
      onResume={() => {
        setShown(false);
        clearSummary();
        navigate({ name: 'play' });
      }}
      onReplace={async (stale) => {
        const current = pending;
        if (!current) return;
        const fresh = (await repo.getOpenSession()) ?? current.open;
        // Kept sets are worth a summary only when asked for; here the session just closes.
        if (stale) await finishFromOutside(fresh, false);
        else await abandonOpenSession(fresh);
        setShown(false);
        await current.start();
        clearSummary();
        navigate(current.to);
      }}
    />
  );
  return { begin, dialog };
}
