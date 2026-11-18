import { useState } from 'react';
import { useSettings } from '@/app/data';
import { equipmentInUse } from '@/features/figure';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import type { Feel } from '@/domain';
import { asPlanned, setGoal } from '@/engine';
import { playerUnit } from '@/features/adapt';
import { Button, IconButton, SegmentedControl, Stepper } from '@/ui/components';
import {
  glyphOf,
  unbreakable,
  loadParts,
  previousReps,
  repsAt,
  targetNumber,
  exerciseLabel,
} from '../format';
import styles from '../Play.module.css';
import { AdjustSheet } from './AdjustSheet';
import { usePlayerHowTo } from '@/features/howto';
import { FigureSlot } from './FigureSlot';
import { NextUp, SetHead, TempoStrip } from './parts';
import type { PlayContext } from './types';
import { useFigurePacing } from './useFigurePacing';
import { useWhy } from './why';
import { useTempoPacer } from '../signals';

const FEELS: Feel[] = ['easy', 'right', 'hard'];

/** A rep-based set: what to do, how it should feel, and the one tap that logs it. */
export function SetScreen({ lang, inventory, log, player, step }: PlayContext) {
  const { t } = useTranslation();
  const why = useWhy({ lang, log, step });
  const settings = useSettings();
  const pacer = useTempoPacer(step.planned.tempo, settings?.sounds ?? true);
  const pacing = useFigurePacing(step.planned.tempo, pacer);
  const exercise = exerciseById.get(step.item.exerciseId);
  const name = exerciseLabel(exercise, lang, step.item.exerciseId);
  const howto = usePlayerHowTo({
    exerciseId: step.item.exerciseId,
    equipment: equipmentInUse(exercise, inventory),
    side: step.side,
    pacing,
    screenKey: `${step.set}-${step.itemIndex}-${step.side ?? ''}`,
  });
  const { planned } = step;
  const isMax = planned.target.kind === 'max';
  const group = step.block.type === 'group';

  const previous = isMax ? previousReps(log.sets, step) : undefined;
  const [maxReps, setMaxReps] = useState(previous?.reps ?? 10);
  const [adjustKey, setAdjustKey] = useState(0);
  const [adjusting, setAdjusting] = useState(false);

  const goal = isMax ? maxReps : setGoal(planned);
  const load = loadParts(t, lang, planned.load, exercise, inventory);
  const sideWord = step.side ? t(`play.side.${step.side}`) : undefined;
  const planDone = asPlanned(planned);

  const feelOptions = FEELS.map((value) => ({ value, label: t(`play.feel.${value}`) }));
  const feel = (
    <SegmentedControl
      options={feelOptions}
      value={why.ask && !player.state.feelChosen ? null : player.state.feel}
      onChange={player.setFeel}
      label={why.ask ? t('adapt.player.feelAsk') : t('play.set.feel')}
      {...(why.ask && !player.state.feelChosen && { ask: true })}
    />
  );

  const { target } = planned;
  const repsUnit =
    target.kind === 'reps' && goal !== undefined && target.min < target.max
      ? playerUnit(t, {
          goal,
          min: target.min,
          max: target.max,
          ...(step.side && { side: step.side }),
        })
      : sideWord
        ? t('play.set.repsSide', { side: sideWord })
        : t('play.set.reps');
  const hint = isMax
    ? [
        planned.rir === undefined
          ? undefined
          : planned.rir === 0
            ? t('play.max.failure')
            : t('play.max.hint', { count: planned.rir }),
        previous
          ? t('play.max.previous', { set: previous.set, reps: previous.reps })
          : t('play.max.none'),
      ]
        .filter(Boolean)
        .join(' ')
    : undefined;

  return (
    <>
      <div className={styles.set}>
        <h1 className={styles.name}>{name}</h1>

        <SetHead step={step} />

        <div className={styles.score}>
          <div className={styles.scoreCell}>
            <div className={styles.scoreTop}>
              <span className={`${styles.num} ${styles.scoreN}`}>
                {target.kind === 'reps' && goal !== undefined
                  ? goal
                  : targetNumber(t, planned.target)}
              </span>
              {planned.rir !== undefined ? (
                <span className={styles.badge}>{t('play.set.rir', { count: planned.rir })}</span>
              ) : null}
            </div>
            <span className={styles.scoreU}>{unbreakable(repsUnit)}</span>
          </div>
          <div className={styles.scoreCell}>
            {load.value ? (
              <>
                <span className={`${styles.num} ${styles.scoreN}`}>{load.value}</span>
                <span className={styles.scoreU}>{load.unit}</span>
              </>
            ) : load.word ? (
              <span className={styles.scoreW}>{load.word}</span>
            ) : null}
          </div>
        </div>

        {hint ? <p className={styles.hint}>{hint}</p> : null}

        {planned.tempo ? <TempoStrip tempo={planned.tempo} pacer={pacer} /> : null}

        {group ? <NextUp step={step} lang={lang} player={player} /> : null}

        <FigureSlot
          exerciseId={step.item.exerciseId}
          name={name}
          glyph={glyphOf(exercise)}
          cue={exercise?.keyCue[lang]}
          why={why}
          equipment={equipmentInUse(exercise, inventory)}
          side={step.side}
          pacing={pacing}
          covered={howto.isOpen}
          onOpenHowTo={howto.open}
        />
        {howto.sheet}
      </div>

      <div className={styles.dock}>
        {feel}
        {isMax ? (
          <div className={styles.dockRow}>
            <Stepper
              size="player"
              className={styles.dockStepper}
              min={0}
              max={200}
              step={1}
              value={maxReps}
              onChange={setMaxReps}
              label={t('play.set.repsDone')}
              decrementLabel={t('play.set.less')}
              incrementLabel={t('play.set.more')}
            />
            <Button
              size="player"
              className={styles.dockDone}
              icon="check"
              onClick={() =>
                player.logSet({ reps: maxReps, ...(planned.load && { load: planned.load }) })
              }
            >
              <span className={styles.dockDoneText}>
                <span>{t('play.set.log')}</span>
                <small>{t('play.repsCount', { count: maxReps })}</small>
              </span>
            </Button>
          </div>
        ) : (
          <div className={styles.dockRow}>
            <Button
              size="player"
              className={styles.dockDone}
              icon="check"
              onClick={() => player.doneAsPlanned()}
            >
              <span className={styles.dockDoneText}>
                <span>
                  {step.side
                    ? t(step.side === 'left' ? 'play.side.leftDone' : 'play.side.rightDone')
                    : t('play.set.doneAsPlanned')}
                </span>
                <small>{repsAt(t, lang, planDone?.reps ?? goal, planned.load)}</small>
              </span>
            </Button>
            <IconButton
              icon="pencil"
              size="player"
              appearance="outline"
              label={t('play.set.edit')}
              onClick={() => {
                setAdjustKey((k) => k + 1);
                setAdjusting(true);
              }}
            />
          </div>
        )}
        {isMax ? (
          <Button
            variant="ghost"
            onClick={() => {
              setAdjustKey((k) => k + 1);
              setAdjusting(true);
            }}
          >
            {t('play.set.edit')}
          </Button>
        ) : null}
      </div>

      <AdjustSheet
        key={adjustKey}
        open={adjusting}
        onClose={() => setAdjusting(false)}
        initialReps={goal ?? 0}
        {...{ lang, inventory, log, player, step }}
      />
    </>
  );
}
