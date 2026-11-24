import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { repo } from '@/db/repo';
import type { LighterWeekSignal } from '@/engine';
import { PresenceList, RowMotion } from '@/motion';
import { Button, Card, Icon, Sheet, useToast } from '@/ui/components';
import { lighterWeekPlan, reasonText } from './lighterWeek';
import styles from './Cycle.module.css';
import sheet from './Sheets.module.css';

/** The offer of a lighter week: the evidence, then "make it lighter" or "not now". */
export function LighterWeekSlot({
  signal,
  onOpen,
  onLater,
}: {
  signal: LighterWeekSignal | undefined;
  onOpen: () => void;
  onLater: () => void;
}) {
  return (
    <PresenceList>
      {signal ? (
        <RowMotion key="lighter-week" className={styles.checkInRow} leave="dismiss">
          <LighterWeekCard signal={signal} onOpen={onOpen} onLater={onLater} />
        </RowMotion>
      ) : null}
    </PresenceList>
  );
}

function LighterWeekCard({
  signal,
  onOpen,
  onLater,
}: {
  signal: LighterWeekSignal;
  onOpen: () => void;
  onLater: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card as="section" className={styles.checkIn} aria-labelledby="lighter-week-title">
      <div className={styles.checkInHead}>
        <span className={styles.well}>
          <Icon name="gauge" size={24} />
        </span>
        <div className={styles.checkInText}>
          <h2 className={styles.checkInTitle} id="lighter-week-title">
            {t('programme.lighter.title')}
          </h2>
          <p className={styles.muted}>{t('programme.lighter.intro')}</p>
        </div>
      </div>
      <ul className={styles.reasons}>
        {signal.reasons.map((reason) => (
          <li key={reason.code}>{reasonText(t, reason)}</li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onOpen}>
          {t('programme.lighter.make', { week: signal.startWeek })}
        </Button>
        <Button variant="ghost" onClick={onLater}>
          {t('programme.lighter.later')}
        </Button>
      </div>
    </Card>
  );
}

/** What making the week lighter changes, before it is saved. */
export function LighterWeekSheet({
  programmeId,
  weeks,
  signal,
  onClose,
}: {
  programmeId: string;
  weeks: number;
  signal: LighterWeekSignal | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const plan = signal ? lighterWeekPlan(signal, weeks) : undefined;

  const confirm = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await repo.insertLighterWeekAt(programmeId, plan.week);
      toast.show({ message: t('programme.lighter.done', { week: plan.week }) });
      onClose();
    } catch {
      toast.show({ message: t('programme.lighter.failed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={plan !== undefined}
      onClose={onClose}
      footer={
        plan ? (
          <>
            <Button loading={saving} fullWidth size="player" onClick={() => void confirm()}>
              {t('programme.lighter.confirm', { week: plan.week })}
            </Button>
            <Button variant="secondary" fullWidth onClick={onClose}>
              {t('programme.lighter.keep')}
            </Button>
          </>
        ) : null
      }
      title={
        plan ? (
          <>
            <span className={sheet.eyebrow}>{t('programme.lighter.sheetEyebrow')}</span>
            <span className={sheet.big}>
              {t('programme.lighter.sheetTitle', { week: plan.week })}
            </span>
          </>
        ) : null
      }
    >
      {plan ? (
        <div className={sheet.body}>
          <ul className={sheet.bullets}>
            <li>{t('programme.lighter.what', { week: plan.week })}</li>
            <li>
              {t('programme.lighter.moves', {
                count: plan.to - plan.from + 1,
                from: plan.from,
                to: plan.to,
              })}
            </li>
            <li>{t('programme.lighter.end', { end: plan.newEnd, old: plan.oldEnd })}</li>
            <li>{t('programme.lighter.resume')}</li>
          </ul>
        </div>
      ) : null}
    </Sheet>
  );
}
