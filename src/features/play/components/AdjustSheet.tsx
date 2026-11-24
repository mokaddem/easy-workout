import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { setLogKey, type Feel, type Load, type SetActual, type SetFlag } from '@/domain';
import { loadOptions, restOfExercise } from '@/engine';
import { Button, Icon, IconButton, SegmentedControl, Sheet, Stepper } from '@/ui/components';
import { exerciseLabel, numberText, targetNumber } from '../format';
import styles from '../Play.module.css';
import type { PlayContext } from './types';

type Reason = Exclude<SetFlag, 'skipped'>;
const FEELS: Feel[] = ['easy', 'right', 'hard'];

interface AdjustSheetProps extends PlayContext {
  open: boolean;
  onClose: () => void;
  /** Reps the stepper starts at. */
  initialReps: number;
  /** `stop` opens straight on stopping the exercise (holds, cardio): there are no reps to adjust. */
  mode?: 'adjust' | 'stop';
  /** What a stop for pain keeps of the set in progress, read when it is confirmed. */
  partial?: () => SetActual | undefined;
  /** A ramp-up set: reps and load only, no feel and no stopping the lift. */
  ramp?: boolean;
}

/** Log what was really done, or stop the exercise. */
export function AdjustSheet({
  open,
  onClose,
  initialReps,
  mode = 'adjust',
  partial: partialOf,
  ramp,
  lang,
  inventory,
  player,
  step,
}: AdjustSheetProps) {
  const { t } = useTranslation();
  const exercise = exerciseById.get(step.item.exerciseId);
  const { planned } = step;
  const options = loadOptions(exercise, planned.load, inventory);

  const [view, setView] = useState<'adjust' | 'stop'>(mode);
  const [reps, setReps] = useState(initialReps);
  const [repsTouched, setRepsTouched] = useState(false);
  const [kg, setKg] = useState(planned.load?.kind === 'kg' ? planned.load.kg : undefined);
  const [level, setLevel] = useState(
    options.kind === 'band' && planned.load?.kind === 'band'
      ? options.levels.indexOf(planned.load.level)
      : -1,
  );
  const [loadTouched, setLoadTouched] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [error, setError] = useState(false);

  const load = (): Load | undefined => {
    if (!loadTouched) return planned.load;
    if (options.kind === 'kg' && kg !== undefined) return { kind: 'kg', kg };
    if (options.kind === 'band' && level >= 0)
      return { kind: 'band', level: options.levels[level]! };
    return planned.load;
  };

  const save = () => {
    const chosen = load();
    player.logSet({ reps, ...(chosen && { load: chosen }) });
    onClose();
  };

  // What stopping ends: the sets left of this exercise, and where the session goes next.
  const state = player.state;
  const rest = restOfExercise(state.steps, state.index).filter(
    (s) => !state.logged.has(setLogKey(s)),
  );
  const numbers = rest.map((s) => s.set);
  const from = Math.min(...numbers);
  const to = Math.max(...numbers);
  const next = state.steps.find(
    (s, i) => i > state.index && !state.logged.has(setLogKey(s)) && !rest.includes(s),
  );
  const then = next
    ? t('play.stop.thenNext', {
        name: exerciseLabel(exerciseById.get(next.item.exerciseId), lang, next.item.exerciseId),
      })
    : t('play.stop.thenEnd');
  const noteKey =
    reason === 'pain' ? 'notePain' : reason === 'no-equipment' ? 'noteNoEquipment' : 'noteNone';
  const note =
    step.block.type === 'group'
      ? t('play.stop.noteGroup')
      : t(`play.stop.${noteKey}`, { count: to === from ? 1 : 2, from, to, then });

  const stop = () => {
    if (!reason) {
      setError(true);
      return;
    }
    const partial =
      reason !== 'pain'
        ? undefined
        : mode === 'stop'
          ? partialOf?.()
          : repsTouched && reps > 0
            ? { reps }
            : undefined;
    player.stopExercise(reason, partial);
    onClose();
  };

  const reasons: { value: Reason; title: string; hint: string }[] = [
    { value: 'pain', title: t('play.stop.pain'), hint: t('play.stop.painHint') },
    {
      value: 'no-equipment',
      title: t('play.stop.noEquipment'),
      hint: t('play.stop.noEquipmentHint'),
    },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        view === 'adjust'
          ? ramp
            ? t('play.adjust.titleWarmup')
            : t('play.adjust.title', { set: step.set })
          : t('play.stop.title')
      }
      description={view === 'adjust' ? t('play.adjust.intro') : t('play.stop.purpose')}
      footer={
        view === 'adjust' ? (
          <>
            <Button size="player" fullWidth onClick={save}>
              {t('play.adjust.save')}
            </Button>
            {ramp ? null : (
              <div className={styles.sheetStop}>
                <Button
                  variant="destructive-outline"
                  fullWidth
                  icon="stop"
                  onClick={() => setView('stop')}
                >
                  {t('play.adjust.stop')}
                </Button>
                <small>{t('play.adjust.stopHint')}</small>
              </div>
            )}
          </>
        ) : (
          <>
            <Button variant="destructive" size="player" fullWidth icon="stop" onClick={stop}>
              {t('play.stop.confirm')}
            </Button>
            <Button variant="secondary" fullWidth onClick={onClose}>
              {t('play.stop.keep')}
            </Button>
          </>
        )
      }
    >
      {view === 'adjust' ? (
        <>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              {t('play.adjust.reps')}
              <small>{t('play.adjust.target', { target: targetNumber(t, planned.target) })}</small>
            </span>
            <Stepper
              size="player"
              min={0}
              max={200}
              step={1}
              value={reps}
              onChange={(value) => {
                setReps(value);
                setRepsTouched(true);
              }}
              label={t('play.adjust.reps')}
              decrementLabel={t('play.set.less')}
              incrementLabel={t('play.set.more')}
            />
          </div>
          {options.kind === 'kg' && options.weights.length > 0 ? (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>
                {t('play.adjust.load')}
                <small>{t('play.adjust.loadHint')}</small>
              </span>
              <Stepper
                size="player"
                values={options.weights}
                value={kg}
                onChange={(value) => {
                  setKg(value);
                  setLoadTouched(true);
                }}
                format={(value) => numberText(value, lang)}
                unit={t('labels.unit.kg')}
                label={t('play.adjust.load')}
                decrementLabel={t('play.set.less')}
                incrementLabel={t('play.set.more')}
              />
            </div>
          ) : null}
          {options.kind === 'band' && options.levels.length > 0 ? (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>
                {t('play.adjust.load')}
                <small>{t('play.adjust.loadHint')}</small>
              </span>
              <Stepper
                size="player"
                values={options.levels.map((_, i) => i)}
                value={level >= 0 ? level : undefined}
                onChange={(value) => {
                  setLevel(value);
                  setLoadTouched(true);
                }}
                format={(value) => t(`labels.band.${options.levels[value]}`)}
                label={t('play.adjust.load')}
                decrementLabel={t('play.set.less')}
                incrementLabel={t('play.set.more')}
              />
            </div>
          ) : null}
          {ramp ? null : (
            <SegmentedControl
              options={FEELS.map((value) => ({ value, label: t(`play.feel.${value}`) }))}
              value={state.feel}
              onChange={player.setFeel}
              label={t('play.set.feel')}
            />
          )}
        </>
      ) : (
        <>
          {mode === 'adjust' ? (
            <div>
              <IconButton
                icon="back"
                label={t('play.stop.back')}
                onClick={() => {
                  setView('adjust');
                  setError(false);
                }}
              />
            </div>
          ) : null}
          <div
            className={styles.choices}
            role="radiogroup"
            aria-label={t('play.stop.reason')}
            aria-describedby={error ? 'stop-error' : undefined}
          >
            {reasons.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={reason === option.value}
                className={`${styles.choice} ${error ? styles.choiceError : ''}`}
                onClick={() => {
                  setReason(option.value);
                  setError(false);
                }}
              >
                <span className={styles.choiceMark}>
                  <Icon name="check" size={20} />
                </span>
                <span>
                  <b>{option.title}</b>
                  <small>{option.hint}</small>
                </span>
              </button>
            ))}
          </div>
          {error ? (
            <p id="stop-error" role="alert" className={styles.choiceMessage}>
              {t('play.stop.error')}
            </p>
          ) : null}
          <p className={styles.note}>
            <Icon name="info" size={20} />
            <span>{note}</span>
          </p>
        </>
      )}
    </Sheet>
  );
}
