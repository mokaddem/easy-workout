import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import type { Feel } from '@/domain';
import { asPlanned, setGoal } from '@/engine';
import { Button, IconButton, SegmentedControl, Stepper } from '@/ui/components';
import { glyphOf, loadParts, previousReps, repsAt, targetNumber, exerciseLabel } from '../format';
import styles from '../Play.module.css';
import { AdjustSheet } from './AdjustSheet';
import { AnimSlot } from './AnimSlot';
import { NextUp, SetHead, TempoStrip } from './parts';
import type { PlayContext } from './types';

const FEELS: Feel[] = ['easy', 'right', 'hard'];

/** A rep-based set: what to do, how it should feel, and the one tap that logs it. */
export function SetScreen({ lang, inventory, log, player, step }: PlayContext) {
  const { t } = useTranslation();
  const exercise = exerciseById.get(step.item.exerciseId);
  const name = exerciseLabel(exercise, lang, step.item.exerciseId);
  const { planned } = step;
  const isMax = planned.target.kind === 'max';
  const group = step.block.type === 'group';

  const previous = isMax ? previousReps(log.sets, step) : undefined;
  const [maxReps, setMaxReps] = useState(previous?.reps ?? 10);
  const [adjustKey, setAdjustKey] = useState(0);
  const [adjusting, setAdjusting] = useState(false);

  const goal = isMax ? maxReps : setGoal(planned.target);
  const load = loadParts(t, lang, planned.load, exercise, inventory);
  const sideWord = step.side ? t(`play.side.${step.side}`) : undefined;
  const planDone = asPlanned(planned);

  const feelOptions = FEELS.map((value) => ({ value, label: t(`play.feel.${value}`) }));
  const feel = (
    <SegmentedControl
      options={feelOptions}
      value={player.state.feel}
      onChange={player.setFeel}
      label={t('play.set.feel')}
    />
  );

  const repsUnit = sideWord ? t('play.set.repsSide', { side: sideWord }) : t('play.set.reps');
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
            <span className={`${styles.num} ${styles.scoreN}`}>
              {targetNumber(t, planned.target)}
            </span>
            <span className={styles.scoreU}>
              {repsUnit}
              {planned.rir !== undefined ? (
                <span className={styles.badge}>{t('play.set.rir', { count: planned.rir })}</span>
              ) : null}
            </span>
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

        {planned.tempo ? <TempoStrip tempo={planned.tempo} /> : null}

        {group ? <NextUp step={step} lang={lang} player={player} /> : null}

        <AnimSlot
          glyph={glyphOf(exercise)}
          tag={exercise ? t(`labels.pattern.${exercise.pattern}`) : ''}
          cue={exercise?.keyCue[lang]}
        />
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
