import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { useActiveProgramme, useEquipment, useProfile } from '@/app/data';
import { answerProposal, undoAnswer } from '@/app/progress';
import { constraintsRepo } from '@/db/constraints';
import type { Answer, JointRegion, Language, Profile, Programme } from '@/domain';
import { constraintsOf, fitFor, withRegion, type Proposal } from '@/engine';
import { ChangePreviewSheet } from '@/features/programme/ChangePreviewSheet';
import { ChoiceGroup } from '@/features/onboarding/components/ChoiceGroup';
import { PresenceList, RowMotion } from '@/motion';
import { jointName } from '@/features/settings/constraints/joints';
import { REGION_ORDER, withLimit } from '@/features/settings/constraints/model';
import { Button, Icon, Sheet } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { exerciseName } from './format';
import styles from './ProposalCard.module.css';

/** What the card shows once the joint is added. */
export interface Limited {
  region: JointRegion;
  removes: boolean;
  /** The exercise standing in for the one that hurt, when the card was answered as a swap. */
  substitute?: string;
  /** Other exercises that change besides the one that hurt. */
  others: number;
  /** Puts the programme and the profile back as they were; also removes the swap answer. */
  undo: () => Promise<void>;
}

export interface LimitationRowProps {
  proposal: Proposal;
  /** Called after the joint is added (and the card answered as a swap when it removes the exercise). */
  onLimited: (limited: Limited) => void;
  disabled?: boolean;
}

const fieldsOf = (profile: Profile) => ({
  ...(profile.limitations && { limitations: profile.limitations }),
  ...(profile.quiet && { quiet: true }),
  ...(profile.smallSpace && { smallSpace: true }),
});

/**
 * "Go easy on my <joint>" on a pain card. It opens the in-place change preview with the joint
 * added; nothing changes until the preview is applied. Exercises without a grade ask which joint
 * first. Renders nothing when there is no programme to re-pick.
 */
export function LimitationRow({ proposal, onLimited, disabled }: LimitationRowProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const profile = useProfile();
  const programme = useActiveProgramme();
  const equipment = useEquipment();
  const offer = proposal.limitation;
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState<JointRegion | null>(null);
  const [pickError, setPickError] = useState(false);
  const [candidate, setCandidate] = useState<{ profile: Profile; region: JointRegion } | null>(
    null,
  );
  /** The programme as it was when the preview opened: what Undo goes back to. */
  const [before, setBefore] = useState<Programme | null>(null);

  if (!offer || !profile || !programme?.generation || !equipment) return null;
  const exercise = exerciseById.get(proposal.exerciseId);
  const regionKnown = offer.region !== undefined;
  const limited = new Set(constraintsOf(profile).regions);
  const open = (region: JointRegion) => {
    setBefore(programme);
    setCandidate({ profile: withLimit(profile, region, new Date()), region });
    setPicking(false);
  };

  const removes = (region: JointRegion): boolean =>
    regionKnown
      ? offer.removes === true
      : exercise !== undefined &&
        fitFor(exercise, withRegion(constraintsOf(profile), region)) === 'out';

  const title = offer.region
    ? t('adapt.card.limit.title', { joint: jointName(t, offer.region, 'your') })
    : t('adapt.card.limit.titlePick');
  const sub = !offer.region
    ? t('adapt.card.limit.pickSub')
    : offer.removes && offer.substituteId
      ? t('adapt.card.limit.removesSub', {
          joint: jointName(t, offer.region, 'the'),
          name: exerciseName(offer.substituteId, lang),
        })
      : offer.removes
        ? t('adapt.card.limit.removesNone', { joint: jointName(t, offer.region, 'the') })
        : t('adapt.card.limit.stays', { joint: jointName(t, offer.region, 'the') });

  async function applied(info: { changes: number }) {
    const region = candidate?.region;
    if (!region || !before || !profile) return;
    const removed = removes(region);
    const substitute = regionKnown && removed ? offer?.substituteId : undefined;
    // The exercise leaves with a stand-in, or stays at a cautious dose: either way the card is answered.
    const answer: Answer | undefined = substitute
      ? await answerProposal({ ...proposal, substituteId: substitute }, 'swap')
      : !removed
        ? await answerProposal(proposal, 'keep')
        : undefined;
    const previous = { fields: fieldsOf(profile), programme: before };
    onLimited({
      region,
      removes: removed,
      ...(substitute && { substitute }),
      others: Math.max(0, info.changes - (removed ? 1 : 0)),
      undo: async () => {
        await constraintsRepo.saveConstraints(previous.fields, previous.programme);
        if (answer) await undoAnswer(answer);
      },
    });
  }

  return (
    <>
      <button
        type="button"
        className={cx(styles.ans, offer.first && styles.ansFirst)}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => (offer.region ? open(offer.region) : setPicking(true))}
      >
        <Icon name="joint" size={24} />
        <span className={styles.ansText}>
          <span className={styles.ansTitle}>{title}</span>
          {offer.first && offer.region ? (
            <span className={styles.ansLead}>{t('adapt.card.limit.suggested')}</span>
          ) : null}
          <span className={styles.ansSub}>{sub}</span>
        </span>
        <Icon name="chev-right" size={20} className={styles.ansChev} />
      </button>

      <Sheet
        open={picking}
        onClose={() => setPicking(false)}
        title={t('adapt.card.limit.pickTitle')}
        footer={
          <div className={styles.pickFoot}>
            <Button
              fullWidth
              size="player"
              onClick={() => (choice ? open(choice) : setPickError(true))}
            >
              {t('adapt.card.limit.pickConfirm')}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setPicking(false)}>
              {t('adapt.card.limit.pickCancel')}
            </Button>
          </div>
        }
      >
        <div className={styles.pickList}>
          <ChoiceGroup
            label={t('adapt.card.limit.pickTitle')}
            size="compact"
            value={choice}
            error={pickError && !choice}
            options={REGION_ORDER.filter((r) => !limited.has(r)).map((r) => ({
              value: r,
              title: jointName(t, r),
            }))}
            onChange={(region) => {
              setChoice(region);
              setPickError(false);
            }}
          />
        </div>
        <PresenceList>
          {pickError && !choice ? (
            <RowMotion key="pick-error" leave="dismiss">
              <p className={styles.pickError} role="alert">
                <Icon name="alert" size={20} />
                <span>{t('adapt.card.limit.pickError')}</span>
              </p>
            </RowMotion>
          ) : null}
        </PresenceList>
      </Sheet>

      <ChangePreviewSheet
        mode={candidate ? 'constraints' : null}
        current={programme}
        profile={candidate?.profile ?? profile}
        equipment={equipment}
        onClose={() => setCandidate(null)}
        onEquipment={() => undefined}
        onApplied={(info) => void applied(info)}
      />
    </>
  );
}
