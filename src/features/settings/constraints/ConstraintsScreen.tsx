import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveProgramme, useEquipment, useProfile, useSessionLogs } from '@/app/data';
import { nextSession } from '@/app/programme-state';
import { goBack, useLeaveGuard } from '@/app/router';
import { PresenceList, RowMotion } from '@/motion';
import { constraintsRepo } from '@/db/constraints';
import type { JointRegion, Language, Profile } from '@/domain';
import { DockNote } from '@/features/onboarding/components/DockNote';
import { ChangePreviewSheet } from '@/features/programme/ChangePreviewSheet';
import {
  AppBar,
  Button,
  Card,
  CheckRow,
  Dialog,
  Dock,
  Icon,
  Skeleton,
  useToast,
} from '@/ui/components';
import { longDate } from '../dates';
import { jointName } from './joints';
import {
  activeLimitation,
  draftOf,
  fieldsFor,
  profileWith,
  REGION_ORDER,
  rowState,
  sameDraft,
  toggleRegion,
  weeksSince,
  type Draft,
} from './model';
import styles from './Constraints.module.css';

export function ConstraintsScreen() {
  const profile = useProfile();
  if (profile === undefined) return <Loading />;
  if (profile === null) return null;
  return <Form profile={profile} />;
}

function Loading() {
  const { t } = useTranslation();
  return (
    <>
      <AppBar
        title={t('settings.constraints.title')}
        onBack={goBack}
        backLabel={t('common.back')}
      />
      <div className={styles.scroll}>
        <Skeleton height={400} radius="var(--radius-lg)" />
        <Skeleton height={160} radius="var(--radius-lg)" />
      </div>
    </>
  );
}

function Form({ profile }: { profile: Profile }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const toast = useToast();
  const programme = useActiveProgramme();
  const equipment = useEquipment();
  const logs = useSessionLogs();
  const saved = useMemo(() => draftOf(profile), [profile]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [preview, setPreview] = useState<Profile | null>(null);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [now] = useState(() => new Date());

  const changed = !sameDraft(saved, draft);
  useLeaveGuard(changed && !done, (proceed) => setLeave(() => proceed));
  useEffect(() => {
    if (done) goBack();
  }, [done]);

  const week = programme && logs ? nextSession(programme, logs).week : undefined;

  const regionMeta = (region: JointRegion): string | undefined => {
    const state = rowState(saved, draft, region);
    if (state === 'adding') return t('settings.constraints.adding');
    if (state === 'lifting') return t('settings.constraints.lifting');
    if (state !== 'on') return undefined;
    const since = activeLimitation(profile, region)?.since;
    if (!since) return undefined;
    const date = longDate(new Date(since), lang);
    const weeks = weeksSince(since, now);
    return weeks >= 1
      ? t('settings.constraints.since', { date, weeks })
      : t('settings.constraints.sinceDays', { date });
  };

  async function submit() {
    if (!changed) return;
    if (programme?.generation && equipment) {
      setPreview(profileWith(profile, draft, new Date()));
      return;
    }
    // Nothing to re-pick: the constraints are saved at once.
    setSaving(true);
    try {
      await constraintsRepo.saveConstraints(fieldsFor(profile, draft, new Date()));
      toast.show({ message: t('settings.constraints.savedNoChange') });
      setDone(true);
    } catch {
      toast.show({ message: t('settings.constraints.failed'), tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppBar
        title={t('settings.constraints.title')}
        onBack={goBack}
        backLabel={t('common.back')}
      />
      <div className={styles.scroll}>
        <p className={styles.intro}>{t('settings.constraints.intro')}</p>

        <section className={styles.block} aria-labelledby="limits-joints">
          <h2 className={styles.heading} id="limits-joints">
            {t('settings.constraints.joints')}
          </h2>
          <Card className={styles.rows}>
            <div role="group" aria-labelledby="limits-joints">
              {REGION_ORDER.map((region) => (
                <CheckRow
                  key={region}
                  title={jointName(t, region)}
                  meta={regionMeta(region)}
                  checked={draft.regions.includes(region)}
                  changed={['adding', 'lifting'].includes(rowState(saved, draft, region))}
                  onChange={(on) => setDraft(toggleRegion(draft, region, on))}
                />
              ))}
            </div>
          </Card>
          <p className={styles.care}>
            <Icon name="info" size={20} />
            <span>{t('settings.constraints.care')}</span>
          </p>
        </section>

        <section className={styles.block} aria-labelledby="limits-home">
          <h2 className={styles.heading} id="limits-home">
            {t('settings.constraints.home')}
          </h2>
          <Card className={styles.rows}>
            <div role="group" aria-labelledby="limits-home">
              <CheckRow
                title={t('settings.constraints.quiet')}
                meta={t('settings.constraints.quietMeta')}
                checked={draft.quiet}
                changed={draft.quiet !== saved.quiet}
                onChange={(quiet) => setDraft({ ...draft, quiet })}
              />
              <CheckRow
                title={t('settings.constraints.space')}
                meta={t('settings.constraints.spaceMeta')}
                checked={draft.smallSpace}
                changed={draft.smallSpace !== saved.smallSpace}
                onChange={(smallSpace) => setDraft({ ...draft, smallSpace })}
              />
            </div>
          </Card>
          <p className={styles.note}>{t('settings.constraints.quickToo')}</p>
        </section>
      </div>

      <Dock>
        <PresenceList>
          {changed && week !== undefined ? (
            <RowMotion key="dock-note" gap={8} leave="dismiss">
              <DockNote>{t('settings.constraints.dockNote', { week })}</DockNote>
            </RowMotion>
          ) : null}
        </PresenceList>
        <Button
          fullWidth
          size="player"
          disabled={!changed}
          loading={saving}
          onClick={() => void submit()}
        >
          {t(programme?.generation ? 'settings.constraints.preview' : 'settings.constraints.save')}
        </Button>
      </Dock>

      {programme?.generation && equipment ? (
        <ChangePreviewSheet
          mode={preview ? 'constraints' : null}
          current={programme}
          profile={preview ?? profile}
          equipment={equipment}
          onClose={() => setPreview(null)}
          onEquipment={() => undefined}
          onApplied={() => setDone(true)}
        />
      ) : null}

      <Dialog
        open={leave !== null}
        onClose={() => setLeave(null)}
        title={t('settings.leave.title')}
        description={t('settings.leave.body')}
        confirmLabel={t('settings.leave.confirm')}
        cancelLabel={t('settings.leave.stay')}
        destructive
        onConfirm={() => {
          const proceed = leave;
          setLeave(null);
          proceed?.();
        }}
      />
    </>
  );
}
