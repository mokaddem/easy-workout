import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { navigate, goBack, useRoute } from '@/app/router';
import { repo } from '@/db/repo';
import { GOALS, LEVELS, type EquipmentInventory, type Goal, type Level } from '@/domain';
import { generateProgramme } from '@/engine';
import { EquipmentChecklist } from '@/features/equipment/EquipmentChecklist';
import { LiveCount } from '@/features/equipment/LiveCount';
import { invalidItems } from '@/features/equipment/validation';
import { RestoreBackup } from '@/features/settings/RestoreBackup';
import { Button, Dock, Icon, IconButton, ProgressBar } from '@/ui/components';
import { ChoiceGroup } from './components/ChoiceGroup';
import { HeroStepper } from './components/HeroStepper';
import { NumField } from './components/NumField';
import { SplitPreview } from './components/SplitPreview';
import { GeneratingScreen } from './GeneratingScreen';
import {
  DAYS_RANGE,
  MINUTES_RANGE,
  STEP_COUNT,
  clearDraft,
  draftProfile,
  firstIncompleteStep,
  loadDraft,
  parseBodyweight,
  parseBodyweightKg,
  saveDraft,
  type Draft,
} from './draft';
import { equipmentSummary, exerciseCount } from './summary';
import styles from './OnboardingScreen.module.css';

const REPS: Record<Goal, string> = {
  muscle: '6–12',
  recomposition: '8–15',
  'general-fitness': '10–15',
};
const GENERATE_SLOW_MS = 300;
const GENERATING_MIN_MS = 800;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function goToStep(step: number, replace = false) {
  navigate({ name: 'onboarding', ...(step > 1 ? { step } : {}) }, { replace });
}

export function OnboardingScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const rawStep = route.name === 'onboarding' ? (route.step ?? 1) : 1;
  const step = Math.min(STEP_COUNT, Math.max(1, rawStep));

  const [draft, setDraftState] = useState<Draft>(loadDraft);
  const [triedStep, setTriedStep] = useState<number | null>(null);
  const [weightTouched, setWeightTouched] = useState(false);
  const [prevStep, setPrevStep] = useState(step);
  const [stepMotion, setStepMotion] = useState<'' | 'enterForward' | 'enterBack'>('');
  if (prevStep !== step) {
    setPrevStep(step);
    setStepMotion(step > prevStep ? 'enterForward' : 'enterBack');
  }
  const [phase, setPhase] = useState<'form' | 'working' | 'generating'>('form');
  const [failed, setFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function update(change: Partial<Draft>) {
    setDraftState((current) => {
      const next = { ...current, ...change };
      saveDraft(next);
      return next;
    });
  }

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const showError = triedStep === step;
  const weight = parseBodyweight(draft.bodyweight);
  const weightError = weight.status === 'invalid' && (weightTouched || showError);

  function back() {
    const index = (history.state as { index?: number } | null)?.index ?? 0;
    if (index > 0) goBack();
    else goToStep(step - 1, true);
  }

  function next() {
    if (step === 1 && !draft.goal) return setTriedStep(1);
    if (step === 2 && !draft.level) return setTriedStep(2);
    if (step === 4 && invalidItems(draft.equipment).length > 0) return setTriedStep(4);
    goToStep(step + 1);
  }

  async function generate() {
    const incomplete = firstIncompleteStep(draft);
    const profile = draftProfile(draft);
    if (incomplete !== null || !profile) {
      setWeightTouched(true);
      if (incomplete !== null && incomplete !== 5) goToStep(incomplete);
      setTriedStep(incomplete);
      return;
    }
    setFailed(false);
    setPhase('working');
    try {
      // Let the busy button paint before the synchronous generation starts.
      await wait(0);
      const started = performance.now();
      const programme = generateProgramme({ profile, equipment: draft.equipment });
      const slow = performance.now() - started > GENERATE_SLOW_MS;
      if (slow) {
        setPhase('generating');
        await wait(GENERATING_MIN_MS);
      }
      await repo.completeSetup(profile, draft.equipment, programme);
      clearDraft();
    } catch {
      setPhase('form');
      setFailed(true);
    }
  }

  if (phase === 'generating') {
    return (
      <GeneratingScreen
        split={t(
          `onboarding.summary.split.${draft.daysPerWeek < 3 || draft.sessionMinutes < 30 ? 'full' : draft.daysPerWeek}`,
        )}
        exerciseCount={exerciseCount(draft.equipment)}
        bodyweightKg={parseBodyweightKg(draft.bodyweight)}
      />
    );
  }

  const last = step === STEP_COUNT;
  const busy = phase === 'working';

  return (
    <>
      <header className={styles.bar}>
        {step > 1 ? <IconButton icon="back" label={t('common.back')} onClick={back} /> : null}
        <ProgressBar
          variant="segmented"
          total={STEP_COUNT}
          current={step}
          label={t('onboarding.step', { n: step, total: STEP_COUNT })}
          className={`${styles.steps} ${step === 1 ? styles.solo : ''}`}
        />
      </header>
      <div
        key={step}
        className={`${styles.scroll} ${stepMotion ? styles[stepMotion] : ''}`}
        ref={scrollRef}
      >
        {step === 1 ? (
          <GoalStep draft={draft} update={update} error={showError} headingRef={headingRef} />
        ) : step === 2 ? (
          <LevelStep draft={draft} update={update} error={showError} headingRef={headingRef} />
        ) : step === 3 ? (
          <ScheduleStep draft={draft} update={update} headingRef={headingRef} />
        ) : step === 4 ? (
          <EquipmentStep draft={draft} update={update} error={showError} headingRef={headingRef} />
        ) : (
          <FinalStep
            draft={draft}
            update={update}
            headingRef={headingRef}
            weightError={weightError}
            onWeightBlur={() => setWeightTouched(true)}
            edit={(s) => goToStep(s)}
            failed={failed}
          />
        )}
      </div>
      <Dock>
        {step === 4 ? (
          <div className={styles.split}>
            <LiveCount inventory={draft.equipment} />
            <Button onClick={next}>{t('common.continue')}</Button>
          </div>
        ) : last ? (
          <Button fullWidth loading={busy} onClick={() => void generate()}>
            {t('onboarding.generate')}
          </Button>
        ) : (
          <Button fullWidth onClick={next}>
            {t('common.continue')}
          </Button>
        )}
      </Dock>
    </>
  );
}

type Ref = React.RefObject<HTMLHeadingElement | null>;

function Intro({
  title,
  text,
  error,
  headingRef,
  children,
}: {
  title: string;
  text?: string;
  error?: string | undefined;
  headingRef: Ref;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.intro}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        {title}
      </h1>
      {text ? <p className={styles.text}>{text}</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          <Icon name="alert" size={20} />
          <span>{error}</span>
        </p>
      ) : null}
      {children}
    </div>
  );
}

interface StepProps {
  draft: Draft;
  update: (change: Partial<Draft>) => void;
  headingRef: Ref;
}

function GoalStep({ draft, update, error, headingRef }: StepProps & { error: boolean }) {
  const { t } = useTranslation();
  const options = useMemo(
    () =>
      GOALS.map((goal) => ({
        value: goal,
        title: t(`labels.goal.${goal}`),
        description: t(`onboarding.goal.${goal}`),
        figure: { value: REPS[goal], label: t('onboarding.reps') },
      })),
    [t],
  );
  return (
    <>
      <Intro
        title={t('onboarding.goal.title')}
        text={t('onboarding.goal.intro')}
        error={error ? t('onboarding.goal.error') : undefined}
        headingRef={headingRef}
      />
      <ChoiceGroup
        label={t('onboarding.goal.label')}
        size="goal"
        options={options}
        value={draft.goal}
        error={error}
        onChange={(goal: Goal) => update({ goal })}
      />
      <div className={styles.restore}>
        <p className={styles.restoreLead}>{t('onboarding.restore.lead')}</p>
        <RestoreBackup onRestored={clearDraft} />
      </div>
    </>
  );
}

function LevelStep({ draft, update, error, headingRef }: StepProps & { error: boolean }) {
  const { t } = useTranslation();
  const options = useMemo(
    () =>
      LEVELS.map((level) => ({
        value: level,
        title: t(`labels.level.${level}`),
        description: t(`onboarding.level.${level}`),
      })),
    [t],
  );
  return (
    <>
      <Intro
        title={t('onboarding.level.title')}
        text={t('onboarding.level.intro')}
        error={error ? t('onboarding.level.error') : undefined}
        headingRef={headingRef}
      />
      <ChoiceGroup
        label={t('onboarding.level.label')}
        options={options}
        value={draft.level}
        error={error}
        onChange={(level: Level) => update({ level })}
      />
    </>
  );
}

function ScheduleStep({ draft, update, headingRef }: StepProps) {
  const { t } = useTranslation();
  return (
    <>
      <Intro title={t('onboarding.schedule.title')} headingRef={headingRef} />
      <HeroStepper
        label={t('onboarding.schedule.days')}
        value={draft.daysPerWeek}
        {...DAYS_RANGE}
        decrementLabel={t('onboarding.schedule.daysLess')}
        incrementLabel={t('onboarding.schedule.daysMore')}
        onChange={(daysPerWeek) => update({ daysPerWeek })}
      />
      <div className={styles.gap} />
      <HeroStepper
        label={t('onboarding.schedule.minutes')}
        value={draft.sessionMinutes}
        {...MINUTES_RANGE}
        unit={t('labels.unit.min')}
        decrementLabel={t('onboarding.schedule.minutesLess')}
        incrementLabel={t('onboarding.schedule.minutesMore')}
        onChange={(sessionMinutes) => update({ sessionMinutes })}
      />
      <SplitPreview
        days={draft.daysPerWeek}
        minutes={draft.sessionMinutes}
        goal={draft.goal}
        level={draft.level}
        equipment={draft.equipment}
      />
    </>
  );
}

function EquipmentStep({ draft, update, error, headingRef }: StepProps & { error: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <Intro
        title={t('onboarding.equipment.title')}
        text={t('onboarding.equipment.intro')}
        headingRef={headingRef}
      >
        <p className={styles.note}>
          <Icon name="info" size={20} />
          <span>{t('onboarding.equipment.none')}</span>
        </p>
      </Intro>
      <div className={styles.checklist}>
        <EquipmentChecklist
          value={draft.equipment}
          showErrors={error}
          onChange={(equipment: EquipmentInventory) => update({ equipment })}
        />
      </div>
    </>
  );
}

function FinalStep({
  draft,
  update,
  headingRef,
  weightError,
  onWeightBlur,
  edit,
  failed,
}: StepProps & {
  weightError: boolean;
  onWeightBlur: () => void;
  edit: (step: number) => void;
  failed: boolean;
}) {
  const { t } = useTranslation();
  const days = draft.daysPerWeek;
  const splitKey = days < 3 || draft.sessionMinutes < 30 ? 'full' : String(days);
  const rows: { key: string; label: string; value: string; edit: string; step: number }[] = [
    {
      key: 'goal',
      label: t('onboarding.summary.goal'),
      value: draft.goal ? t(`labels.goal.${draft.goal}`) : '–',
      edit: t('onboarding.summary.editGoal'),
      step: 1,
    },
    {
      key: 'level',
      label: t('onboarding.summary.level'),
      value: draft.level ? t(`labels.level.${draft.level}`) : '–',
      edit: t('onboarding.summary.editLevel'),
      step: 2,
    },
    {
      key: 'schedule',
      label: t('onboarding.summary.schedule'),
      value: t('onboarding.summary.scheduleValue', {
        days,
        minutes: draft.sessionMinutes,
        split: t(`onboarding.summary.split.${splitKey}`),
      }),
      edit: t('onboarding.summary.editSchedule'),
      step: 3,
    },
    {
      key: 'equipment',
      label: t('onboarding.summary.equipment'),
      value: equipmentSummary(draft.equipment, t),
      edit: t('onboarding.summary.editEquipment'),
      step: 4,
    },
  ];
  return (
    <>
      <Intro
        title={t('onboarding.bodyweight.title')}
        text={t('onboarding.bodyweight.intro')}
        headingRef={headingRef}
      />
      <NumField
        label={t('onboarding.bodyweight.label')}
        hint={t('common.optional')}
        accessibleLabel={t('onboarding.bodyweight.field')}
        value={draft.bodyweight}
        onChange={(bodyweight) => update({ bodyweight })}
        onBlur={onWeightBlur}
        unit={t('labels.unit.kg')}
        error={weightError}
        message={weightError ? t('onboarding.bodyweight.error') : t('onboarding.bodyweight.skip')}
      />
      <section className={styles.recap}>
        <h2 className={styles.recapTitle}>{t('onboarding.summary.title')}</h2>
        <ul className={styles.rows}>
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                className={styles.row}
                aria-label={row.edit}
                onClick={() => edit(row.step)}
              >
                <span className={styles.rowText}>
                  <span className={styles.rowMeta}>{row.label}</span>
                  <span className={styles.rowTitle}>{row.value}</span>
                </span>
                <Icon name="pencil" size={24} />
              </button>
            </li>
          ))}
        </ul>
      </section>
      {failed ? (
        <p className={`${styles.error} ${styles.padded}`} role="alert">
          <Icon name="alert" size={20} />
          <span>{t('onboarding.generating.error')}</span>
        </p>
      ) : null}
    </>
  );
}
