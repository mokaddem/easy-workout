import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EquipmentKind } from '@/domain';
import { equipmentInUse, useArrival, useFigureState, useFiguresAnimated } from '@/features/figure';
import { thumbIcon } from '@/features/editor/picker/thumbIcon';
import type { FigurePacing } from '@/motion/figure';
import { Button, Icon, SegmentedControl } from '@/ui/components';
import { pausable, StageClock, type Speed } from './stageClock';
import { useHowToText, useShortScreen, useWidth } from './useHowTo';
import styles from './howto.module.css';

export interface HowToBodyProps {
  exerciseId: string;
  /** The implements in use; the first setup listed without it. */
  equipment?: readonly EquipmentKind[] | undefined;
  /** The side being worked: side 2 shows the mirror image. */
  side?: 1 | 2 | undefined;
  /** The player's tempo clock: the figure follows it, and the speed control gives way. */
  pacing?: FigurePacing | undefined;
}

/**
 * The how-to content without a sheet: what the exercise is, the figure pinned while the key cue
 * and the steps scroll under it.
 */
export function HowToBody(props: HowToBodyProps) {
  return (
    <>
      <HowToStage {...props} />
      <HowToSteps exerciseId={props.exerciseId} equipment={props.equipment} />
    </>
  );
}

/** What the exercise is, the figure and its controls: the part that stays in view. */
export function HowToStage({ exerciseId, equipment, side = 1, pacing }: HowToBodyProps) {
  const { t } = useTranslation();
  const { exercise, name, meta } = useHowToText(exerciseId, equipment);
  const state = useFigureState(exerciseId);
  const animated = useFiguresAnimated();
  const [forced, setForced] = useState(false);
  const moves = animated || forced;
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>('normal');
  const short = useShortScreen();
  const height = short ? 184 : 236;
  const [stageRef, width] = useWidth<HTMLDivElement>(350);

  const clock = useMemo(() => new StageClock(), []);
  useEffect(() => {
    clock.setPaused(paused);
  }, [paused, clock]);
  const own = clock.pacing();
  const driven = useMemo(
    () => (pacing ? pausable(pacing, () => clock.isPaused()) : undefined),
    [pacing, clock],
  );
  const source = driven ?? own;

  const equipmentUsed = equipment ?? equipmentInUse(exercise);
  const label = t(moves ? 'howto.stage' : 'howto.stageStill', { name });
  const figure = state.status === 'ready' ? state : undefined;
  const late = useArrival(state.status === 'loading', !!figure);

  return (
    <>
      <p className={styles.meta}>{meta}</p>
      <div className={styles.pinned}>
        <div
          ref={stageRef}
          className={styles.stage}
          style={{ height }}
          data-state={state.status}
          {...(late && { 'data-arrive': '' })}
          data-testid="howto-stage"
        >
          {state.status === 'loading' ? <div className={styles.wait} aria-hidden="true" /> : null}
          {state.status === 'none' && exercise ? (
            <Icon className={styles.glyph} name={thumbIcon(exercise)} />
          ) : null}
          {figure ? (
            <figure.Figure
              animation={figure.animation}
              width={width}
              height={height}
              mode={moves ? 'loop' : 'still'}
              play={forced}
              side={side}
              equipment={equipmentUsed}
              pacing={moves ? source : undefined}
              label={label}
            />
          ) : null}
        </div>
        {figure ? (
          <div className={styles.controls} {...(late && { 'data-arrive': '' })}>
            {moves ? (
              <>
                <Button
                  variant="secondary"
                  icon={paused ? 'play' : 'pause'}
                  onClick={() => setPaused((p) => !p)}
                  aria-pressed={paused}
                >
                  {t(paused ? 'howto.play' : 'howto.pause')}
                </Button>
                {pacing ? (
                  <p className={styles.paced}>
                    <Bold
                      text={t('howto.paced', {
                        tempo: `${pacing.tempo.down}-${pacing.tempo.pause}-${pacing.tempo.up}`,
                      })}
                    />
                  </p>
                ) : (
                  <SegmentedControl
                    label={t('howto.speed')}
                    value={speed}
                    onChange={(next) => {
                      clock.setSpeed(next);
                      setSpeed(next);
                    }}
                    options={[
                      { value: 'normal', label: t('howto.normal') },
                      { value: 'slow', label: t('howto.slow') },
                    ]}
                  />
                )}
              </>
            ) : (
              <Button variant="secondary" icon="play" onClick={() => setForced(true)}>
                {t('howto.playReduced')}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

/** The key cue and the numbered steps: the part that scrolls. */
export function HowToSteps({
  exerciseId,
  equipment,
}: Pick<HowToBodyProps, 'exerciseId' | 'equipment'>) {
  const { exercise, lang } = useHowToText(exerciseId, equipment);
  const steps = exercise?.execution[lang] ?? [];
  return (
    <>
      <div className={styles.body}>
        {exercise ? <p className={styles.cue}>{exercise.keyCue[lang]}</p> : null}
        <ol className={styles.steps}>
          {steps.map((step, i) => (
            <li key={i}>
              <span className={styles.n} aria-hidden="true">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

/** A string with `<b>…</b>` emphasis. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(<b>.*?<\/b>)/g)
        .map((part, i) =>
          part.startsWith('<b>') ? <strong key={i}>{part.slice(3, -4)}</strong> : part,
        )}
    </>
  );
}
