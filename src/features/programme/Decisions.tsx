import { useTranslation } from 'react-i18next';
import type { Language, SessionLog } from '@/domain';
import type { Proposal } from '@/engine';
import { Roll } from '@/motion';
import { Button, Icon, Sheet } from '@/ui/components';
import { ProposalCard } from '../adapt';
import { proposalFacts, proposalKey, type NudgeText } from './adaptation';
import styles from './Overview.module.css';

/** The row on the Programme tab that says how many exercise decisions wait. */
export function DecisionsNudge({
  count,
  text,
  onOpen,
}: {
  count: number;
  text: NudgeText;
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  let sub: string;
  if (text.kind === 'one') sub = t('adapt.programme.nudge.one', { name: text.names[0] });
  else if (text.more === 0)
    sub = new Intl.ListFormat(lang, { type: 'conjunction' }).format(text.names);
  else
    sub = t('adapt.programme.nudge.names', {
      a: text.names[0],
      b: text.names[1],
      count: text.more,
    });
  const label = `${t('adapt.programme.nudge.label', { count })} ${sub}`;
  return (
    <button type="button" className={styles.nudge} aria-label={label} onClick={onOpen}>
      <span className={`${styles.well} ${styles.wellCount}`} aria-hidden="true">
        <Roll value={count} className={styles.num}>
          {count}
        </Roll>
      </span>
      <span className={styles.nudgeText} aria-hidden="true">
        <span className={styles.nudgeTitle}>{t('adapt.programme.nudge.title')}</span>
        <span className={styles.nudgeSub}>{sub}</span>
      </span>
      <Icon name="chev-right" size={20} />
    </button>
  );
}

/**
 * "Your call": the cards stay mounted once answered (confirmed, with Undo) because the list
 * shown is a snapshot taken when the sheet opened.
 */
export function DecisionsSheet({
  proposals,
  open,
  logs,
  inNext,
  onClose,
}: {
  proposals: readonly Proposal[];
  open: boolean;
  logs: readonly SessionLog[] | undefined;
  inNext: ReadonlySet<string>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('adapt.programme.sheet.title')}
      description={t('adapt.programme.sheet.sub')}
      footer={
        <Button variant="secondary" fullWidth onClick={onClose}>
          {t('adapt.programme.sheet.close')}
        </Button>
      }
    >
      <div className={styles.decisions}>
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposalKey(proposal)}
            proposal={proposal}
            variant="flat"
            facts={proposalFacts(
              proposal,
              logs?.find((l) => l.id === proposal.logId),
              inNext.has(proposal.exerciseId),
            )}
          />
        ))}
      </div>
    </Sheet>
  );
}
