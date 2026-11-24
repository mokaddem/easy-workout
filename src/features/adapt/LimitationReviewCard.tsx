import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveProgramme, useEquipment, useProfile } from '@/app/data';
import { constraintsRepo } from '@/db/constraints';
import type { JointRegion, Language } from '@/domain';
import { ChangePreviewSheet } from '@/features/programme/ChangePreviewSheet';
import { longDate } from '@/features/settings/dates';
import { jointName, capital } from '@/features/settings/constraints/joints';
import {
  adaptedCount,
  REVIEW_WEEKS,
  weeksSince,
  withLift,
} from '@/features/settings/constraints/model';
import { Swap } from '@/motion';
import { Button, Card, Icon } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { Rich } from './Rich';
import styles from './ProposalCard.module.css';

const WEEK_MS = 7 * 86_400_000;

type Answered =
  { kind: 'kept'; until: Date; undo: () => Promise<void> } | { kind: 'lifted'; changes: number };

/** "Still bothered by your knee?" Keep it (asked again in six weeks) or lift it, after a preview. */
export function LimitationReviewCard({ region }: { region: JointRegion }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const profile = useProfile();
  const programme = useActiveProgramme();
  const equipment = useEquipment();
  const [answered, setAnswered] = useState<Answered | undefined>();
  const [lifting, setLifting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => new Date());

  const entry = [...(profile?.limitations ?? [])]
    .filter((l) => l.region === region)
    .sort((a, b) => b.since.localeCompare(a.since))[0];
  if (!profile || !entry) return null;

  const joint = jointName(t, region, 'your');
  // "Ton genou te gêne encore ?" opens the sentence; English says "by your knee".
  const lead = lang === 'fr' ? capital(joint) : joint;
  const since = new Date(entry.since);
  const count = programme ? adaptedCount(programme, region) : 0;

  async function keep() {
    if (busy || !entry) return;
    setBusy(true);
    try {
      const previous = entry.reviewedAt;
      const at = new Date();
      await constraintsRepo.setLimitationReviewedAt(region, at);
      setAnswered({
        kind: 'kept',
        until: new Date(at.getTime() + REVIEW_WEEKS * WEEK_MS),
        undo: () => constraintsRepo.setLimitationReviewedAt(region, previous),
      });
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (answered?.kind !== 'kept' || busy) return;
    setBusy(true);
    try {
      await answered.undo();
      setAnswered(undefined);
    } finally {
      setBusy(false);
    }
  }

  const copy =
    answered?.kind === 'kept'
      ? {
          title: t('settings.review.keptTitle'),
          sub: t('settings.review.keptSub', { date: longDate(answered.until, lang) }),
        }
      : answered?.kind === 'lifted'
        ? {
            title: t('settings.review.liftedTitle', { joint }),
            sub: t('settings.review.liftedSub', { count: answered.changes }),
          }
        : null;

  return (
    <Card
      as="article"
      className={styles.pc}
      aria-label={t('settings.review.title', { joint: lead })}
    >
      <Swap
        id={copy ? 'confirmed' : 'asking'}
        innerClassName={copy ? cx(styles.body, styles.bodyDone) : styles.body}
      >
        {copy ? (
          <div className={styles.confirmed} role="status">
            <span className={cx(styles.well, styles.wellDone)}>
              <Icon name="check" size={28} />
            </span>
            <div className={styles.confirmedText}>
              <p className={styles.confirmedTitle}>{copy.title}</p>
              <p className={styles.confirmedSub}>{copy.sub}</p>
              {answered?.kind === 'kept' ? (
                <Button
                  variant="ghost"
                  className={styles.undo}
                  disabled={busy}
                  onClick={() => void undo()}
                >
                  {t('settings.review.undo')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.head}>
              <span className={styles.well}>
                <Icon name="joint" size={28} />
              </span>
              <div className={styles.headText}>
                <h3 className={styles.name}>{t('settings.review.title', { joint: lead })}</h3>
                <p className={styles.kick}>
                  <Rich
                    text={t('settings.review.kicker', {
                      date: longDate(since, lang),
                      weeks: weeksSince(entry.since, now),
                      count,
                    })}
                  />
                </p>
              </div>
            </div>
            <div className={styles.answers}>
              <button
                type="button"
                className={styles.ans}
                disabled={busy}
                onClick={() => void keep()}
              >
                <Icon name="equals" size={24} />
                <span className={styles.ansText}>
                  <span className={styles.ansTitle}>{t('settings.review.keep')}</span>
                  <span className={styles.ansSub}>{t('settings.review.keepSub')}</span>
                </span>
              </button>
              <button
                type="button"
                className={styles.ans}
                aria-haspopup="dialog"
                disabled={busy || !programme?.generation || !equipment}
                onClick={() => setLifting(true)}
              >
                <Icon name="arrow-up" size={24} />
                <span className={styles.ansText}>
                  <span className={styles.ansTitle}>{t('settings.review.lift')}</span>
                  <span className={styles.ansSub}>{t('settings.review.liftSub')}</span>
                </span>
                <Icon name="chev-right" size={20} className={styles.ansChev} />
              </button>
            </div>
          </>
        )}
      </Swap>
      {programme?.generation && equipment ? (
        <ChangePreviewSheet
          mode={lifting ? 'constraints' : null}
          current={programme}
          profile={withLift(profile, region, now)}
          equipment={equipment}
          onClose={() => setLifting(false)}
          onEquipment={() => undefined}
          onApplied={(info) => setAnswered({ kind: 'lifted', changes: info.changes })}
        />
      ) : null}
    </Card>
  );
}
