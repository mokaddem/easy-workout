import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEquipment, useProfile, useSettings } from '@/app/data';
import { goBack, navigate, useLeaveGuard } from '@/app/router';
import { constraintsRepo } from '@/db/constraints';
import { repo } from '@/db/repo';
import { GOALS, LEVELS, type Goal, type Level, type Profile } from '@/domain';
import { ChoiceGroup } from '@/features/onboarding/components/ChoiceGroup';
import { DockNote } from '@/features/onboarding/components/DockNote';
import { HeroStepper } from '@/features/onboarding/components/HeroStepper';
import { NumField } from '@/features/onboarding/components/NumField';
import { SplitPreview } from '@/features/onboarding/components/SplitPreview';
import { DAYS_RANGE, MINUTES_RANGE, parseBodyweight } from '@/features/onboarding/draft';
import { AppBar, Button, Dialog, Dock, SegmentedControl, useToast } from '@/ui/components';
import styles from './ProfileScreen.module.css';

const REPS: Record<Goal, string> = {
  muscle: '6–12',
  recomposition: '8–15',
  'general-fitness': '10–15',
};

export function ProfileScreen() {
  const profile = useProfile();
  const equipment = useEquipment();
  if (!profile || !equipment) return null;
  return <ProfileForm profile={profile} equipment={equipment} />;
}

interface Form {
  goal: Goal;
  level: Level;
  daysPerWeek: number;
  sessionMinutes: number;
  bodyweight: string;
}

const toForm = (profile: Profile): Form => ({
  goal: profile.goal,
  level: profile.level,
  daysPerWeek: profile.daysPerWeek,
  sessionMinutes: profile.sessionMinutes,
  bodyweight: profile.bodyweightKg === undefined ? '' : String(profile.bodyweightKg),
});

function ProfileForm({
  profile,
  equipment,
}: {
  profile: Profile;
  equipment: ReturnType<typeof useEquipment> & object;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const settings = useSettings();
  const initial = toForm(profile);
  const [form, setForm] = useState<Form>(initial);
  const [dialog, setDialog] = useState<'new' | null>(null);
  /** Set while the leave dialog is open: leaves the screen when called. */
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [weightShown, setWeightShown] = useState(false);
  const [saving, setSaving] = useState(false);

  const weight = parseBodyweight(form.bodyweight);
  const initialWeight = parseBodyweight(initial.bodyweight);
  const weightChanged =
    weight.status === 'invalid'
      ? form.bodyweight.trim() !== initial.bodyweight
      : (weight.status === 'ok' ? weight.kg : null) !==
        (initialWeight.status === 'ok' ? initialWeight.kg : null);
  const goalChanged = form.goal !== initial.goal;
  const daysChanged = form.daysPerWeek !== initial.daysPerWeek;
  const needsNew = goalChanged || daysChanged;
  const changed =
    needsNew ||
    form.level !== initial.level ||
    form.sessionMinutes !== initial.sessionMinutes ||
    weightChanged;
  const weightError = weight.status === 'invalid' && weightShown;
  useLeaveGuard(changed && !saving, (proceed) => setLeave(() => proceed));

  function update(change: Partial<Form>) {
    setForm((current) => ({ ...current, ...change }));
  }

  function nextProfile(): Profile | null {
    if (weight.status === 'invalid') return null;
    return {
      goal: form.goal,
      level: form.level,
      daysPerWeek: form.daysPerWeek,
      sessionMinutes: form.sessionMinutes,
      ...(weight.status === 'ok' ? { bodyweightKg: weight.kg } : {}),
      // Joints, noise and space have their own screen: saving the profile keeps them.
      ...(profile.limitations ? { limitations: profile.limitations } : {}),
      ...(profile.quiet ? { quiet: true } : {}),
      ...(profile.smallSpace ? { smallSpace: true } : {}),
    };
  }

  async function save(afterNeedsNew: boolean) {
    const next = nextProfile();
    if (!next) {
      setWeightShown(true);
      setDialog(null);
      return;
    }
    if (needsNew && !afterNeedsNew) {
      setDialog('new');
      return;
    }
    setSaving(true);
    await repo.saveProfile(next);
    // Training days are one per session of the week: another number of days starts them over.
    const resetDays = daysChanged && (settings?.trainingDays?.length ?? 0) > 0;
    if (resetDays) await constraintsRepo.setTrainingDays([]);
    setDialog(null);
    if (resetDays) toast.show({ message: t('settings.profilePage.daysReset') });
    if (needsNew) {
      navigate({ name: 'programme', preview: 'new' });
    } else {
      toast.show({ message: t('settings.profilePage.saved') });
      goBack();
    }
  }

  const days = form.daysPerWeek;
  const dialogText =
    goalChanged && daysChanged
      ? t('settings.profilePage.newDialogBoth', { days })
      : goalChanged
        ? t('settings.profilePage.newDialogGoal')
        : t('settings.profilePage.newDialogDays', { days });

  return (
    <>
      <AppBar title={t('settings.profile')} onBack={goBack} backLabel={t('common.back')} />
      <div className={styles.scroll}>
        <section className={styles.block}>
          <h2 className={styles.heading}>{t('settings.profilePage.goal')}</h2>
          <p className={styles.hint}>{t('settings.profilePage.goalHint')}</p>
          <ChoiceGroup
            label={t('settings.profilePage.goal')}
            size="compact"
            value={form.goal}
            options={GOALS.map((goal) => ({
              value: goal,
              title: t(`labels.goal.${goal}`),
              figure: { value: REPS[goal], label: t('onboarding.reps') },
            }))}
            onChange={(goal: Goal) => update({ goal })}
          />
        </section>

        <section className={styles.block}>
          <h2 className={styles.heading}>{t('settings.profilePage.level')}</h2>
          <div className={styles.pad}>
            <SegmentedControl
              className={styles.grid}
              label={t('settings.profilePage.level')}
              value={form.level}
              options={LEVELS.map((level) => ({ value: level, label: t(`labels.level.${level}`) }))}
              onChange={(level) => update({ level })}
            />
          </div>
        </section>

        <section className={styles.block}>
          <h2 className={styles.heading}>{t('settings.profilePage.schedule')}</h2>
          <p className={styles.hint}>{t('settings.profilePage.scheduleHint')}</p>
          <HeroStepper
            size="form"
            label={t('settings.profilePage.days')}
            value={form.daysPerWeek}
            {...DAYS_RANGE}
            decrementLabel={t('onboarding.schedule.daysLess')}
            incrementLabel={t('onboarding.schedule.daysMore')}
            onChange={(daysPerWeek) => update({ daysPerWeek })}
          />
          <HeroStepper
            size="form"
            label={t('settings.profilePage.minutes')}
            value={form.sessionMinutes}
            {...MINUTES_RANGE}
            unit={t('labels.unit.min')}
            decrementLabel={t('onboarding.schedule.minutesLess')}
            incrementLabel={t('onboarding.schedule.minutesMore')}
            onChange={(sessionMinutes) => update({ sessionMinutes })}
          />
          <SplitPreview
            compact
            days={form.daysPerWeek}
            minutes={form.sessionMinutes}
            goal={form.goal}
            level={form.level}
            equipment={equipment}
          />
        </section>

        <section className={styles.block}>
          <h2 className={styles.heading}>{t('settings.profilePage.bodyweight')}</h2>
          <NumField
            compact
            accessibleLabel={t('onboarding.bodyweight.field')}
            value={form.bodyweight}
            onChange={(bodyweight) => update({ bodyweight })}
            onBlur={() => setWeightShown(true)}
            unit={t('labels.unit.kg')}
            error={weightError}
            message={
              weightError
                ? t('onboarding.bodyweight.error')
                : t('settings.profilePage.bodyweightNote')
            }
          />
        </section>
      </div>

      <Dock>
        {needsNew ? (
          <DockNote tone="alert">
            <b>{t('settings.profilePage.needsNew')}</b> {t('settings.profilePage.needsNewRest')}
          </DockNote>
        ) : changed ? (
          <DockNote>{t('settings.profilePage.outdated')}</DockNote>
        ) : null}
        <Button fullWidth disabled={!changed} loading={saving} onClick={() => void save(false)}>
          {t('common.save')}
        </Button>
      </Dock>

      <Dialog
        open={dialog === 'new'}
        onClose={() => setDialog(null)}
        title={t('settings.profilePage.newDialogTitle')}
        description={dialogText}
        confirmLabel={t('settings.profilePage.seeNew')}
        cancelLabel={t('settings.profilePage.backToProfile')}
        onConfirm={() => void save(true)}
      />
      <Dialog
        open={leave !== null}
        onClose={() => setLeave(null)}
        title={t('settings.profilePage.leaveTitle')}
        description={t('settings.profilePage.leaveText')}
        confirmLabel={t('settings.profilePage.leave')}
        cancelLabel={t('settings.profilePage.stay')}
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
