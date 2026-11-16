import { useCallback, useEffect, useRef } from 'react';
import { answerProposal } from '@/app/progress';
import type { Proposal } from '@/engine';
import { proposalKey } from '@/features/adapt';

/**
 * Leaving the summary without answering a "no equipment today" card counts as a one-off.
 * `record` is for the primary action; unmounting records too, once.
 */
export function useLeaveOneOffs(proposals: Proposal[]) {
  const state = useRef({ proposals, answered: new Set<string>(), recorded: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    state.current.proposals = proposals;
  }, [proposals]);

  const record = useCallback(() => {
    const s = state.current;
    if (s.recorded) return;
    s.recorded = true;
    for (const proposal of s.proposals)
      if (proposal.kind === 'no-equipment' && !s.answered.has(proposalKey(proposal)))
        void answerProposal(proposal, 'one-off');
  }, []);

  useEffect(() => {
    // Deferred so a development remount doesn't count as leaving.
    if (timer.current) clearTimeout(timer.current);
    return () => {
      timer.current = setTimeout(record, 0);
    };
  }, [record]);

  return {
    record,
    markAnswered: (p: Proposal) => state.current.answered.add(proposalKey(p)),
    markUndone: (p: Proposal) => state.current.answered.delete(proposalKey(p)),
  };
}
