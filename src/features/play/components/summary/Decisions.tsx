import { useTranslation } from 'react-i18next';
import type { Answer } from '@/domain';
import type { NextTimeLine, Proposal } from '@/engine';
import { ProposalCard, tokenOf, type ProposalFacts } from '@/features/adapt';
import type { ExerciseDone } from './rows';
import styles from './ExerciseList.module.css';

interface Props {
  /** Snapshot taken when the summary opened, so answered cards stay (with Undo). */
  proposals: Proposal[];
  rows: ExerciseDone[];
  lines: NextTimeLine[];
  sessionLetter?: string;
  onAnswered: (proposal: Proposal, answer: Answer) => void;
  onUndone: (proposal: Proposal) => void;
}

function factsFor(
  proposal: Proposal,
  rows: ExerciseDone[],
  lines: NextTimeLine[],
  sessionLetter: string | undefined,
): ProposalFacts {
  const row = rows.find((r) => r.exerciseId === proposal.exerciseId);
  const line = lines.find((l) => l.exerciseId === proposal.exerciseId);
  const facts: ProposalFacts = {};
  if (row) {
    facts.done = row.values.length;
    facts.total = row.total;
    facts.sets = row.values.length;
    if (row.values.length > 0) facts.reps = Math.max(...row.values);
    if (row.min !== undefined) facts.min = row.min;
    if (row.load && proposal.kind === 'pain') facts.atLoad = tokenOf(row.load);
    if (row.unit === 'seconds') facts.time = true;
  }
  if (line) {
    facts.keepLoad = tokenOf(line.before.load);
    const goal = line.before.goal ?? row?.min;
    if (goal !== undefined) {
      facts.keepGoal = goal;
      facts.goal = goal;
    }
  }
  if (sessionLetter) facts.sessionLetter = sessionLetter;
  return facts;
}

/** The "your call" section: one card per proposal the session raised. */
export function Decisions({ proposals, rows, lines, sessionLetter, onAnswered, onUndone }: Props) {
  const { t } = useTranslation();
  if (proposals.length === 0) return null;
  const stops = proposals.every((p) => p.kind === 'pain' || p.kind === 'no-equipment');
  return (
    <section className={styles.sec} aria-labelledby="summary-decisions">
      <div className={styles.head}>
        <h2 className={styles.title} id="summary-decisions">
          {t('adapt.summary.decisions.title')}
        </h2>
        <p className={styles.sub}>
          {stops
            ? t('adapt.summary.decisions.sub', { count: proposals.length })
            : t('adapt.summary.decisions.subChanges')}
        </p>
      </div>
      {proposals.map((proposal) => (
        <ProposalCard
          key={`${proposal.kind}/${proposal.exerciseId}`}
          proposal={proposal}
          facts={factsFor(proposal, rows, lines, sessionLetter)}
          onAnswered={(answer) => onAnswered(proposal, answer)}
          onUndone={() => onUndone(proposal)}
        />
      ))}
    </section>
  );
}
