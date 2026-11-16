import type { Proposal } from '@/engine';

/** Identifies a proposal: the same kind for the same exercise from another session is another one. */
export const proposalKey = (p: Pick<Proposal, 'kind' | 'exerciseId' | 'logId'>): string =>
  `${p.kind}:${p.exerciseId}:${p.logId}`;
