import { useCallback, useEffect, useState } from 'react';
import { useOpenSession } from '@/app/data';
import { navigate, type Route } from '@/app/router';
import type { SessionLog } from '@/domain';
import { SummaryScreen } from './components/SummaryScreen';
import { peekSummary, showSummaryFor } from './lifecycle';
import { PlayerView } from './PlayerView';

/**
 * The workout player: the open session, or back to the programme when none is open.
 * Once a session has ended here, or was finished from the resume banner, its summary shows.
 */
export function PlayScreen(_props: { route: Extract<Route, { name: 'play' }> }) {
  const open = useOpenSession();
  const [shown, setShown] = useState<SessionLog | null>(null);
  const [summary, setSummary] = useState<string | null>(peekSummary);
  if (open && shown?.id !== open.id) setShown(open);

  const onSummary = useCallback((id: string) => {
    showSummaryFor(id);
    setSummary(id);
  }, []);

  useEffect(() => {
    if (open === null && !shown && !summary) navigate({ name: 'programme' }, { replace: true });
  }, [open, shown, summary]);

  // A cooldown started from a summary is another session: the player takes over.
  if (summary && !(open && open.id !== summary)) return <SummaryScreen id={summary} />;
  const log = open ?? shown;
  if (!log) return null;
  return (
    <PlayerView key={log.id} log={log} closed={open === null} onSummary={() => onSummary(log.id)} />
  );
}
