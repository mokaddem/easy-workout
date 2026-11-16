import { useState, type ReactNode } from 'react';
import { Tick } from '@/motion';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import type { Feel, Language, SetActual, Target } from '@/domain';
import { playerUnit } from '@/features/adapt';
import { Button, Icon, IconButton, SegmentedControl } from '@/ui/components';
import {
  exerciseLabel,
  glyphOf,
  loadParts,
  minutesClock,
  numberText,
  phaseAt,
  rxText,
  targetCell,
  timerElapsed,
  unbreakable,
} from '../format';
import { setGoal } from '@/engine';
import { clockSeconds, intervalClock, type PlayerState } from '../machine';
import styles from '../Play.module.css';
import { AdjustSheet } from './AdjustSheet';
import { AnimSlot } from './AnimSlot';
import { NextUp, SetHead, TempoStrip } from './parts';
import type { PlayContext } from './types';
import { useWhy } from './why';

const FEELS: Feel[] = ['easy', 'right', 'hard'];

export interface TimedProps extends PlayContext {
  state: PlayerState;
  now: number;
}

type Interval = Extract<Target, { kind: 'interval' }>;
type Cardio = Extract<Target, { kind: 'cardio' }>;
type Hold = Extract<Target, { kind: 'time' }>;

/** The pencil beside a primary action: for holds and cardio it only leads to stopping. */
function EditStop({ ctx, partial }: { ctx: PlayContext; partial?: () => SetActual | undefined }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <IconButton
        icon="pencil"
        size="player"
        appearance="outline"
        label={t('play.cardio.stopHint')}
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      />
      <AdjustSheet
        key={key}
        open={open}
        onClose={() => setOpen(false)}
        initialReps={0}
        mode="stop"
        {...(partial && { partial })}
        {...ctx}
      />
    </>
  );
}

function Name({ ctx }: { ctx: PlayContext }) {
  const exercise = exerciseById.get(ctx.step.item.exerciseId);
  return (
    <h1 className={styles.name}>{exerciseLabel(exercise, ctx.lang, ctx.step.item.exerciseId)}</h1>
  );
}

function Slot({ ctx, tag }: { ctx: PlayContext; tag?: string }) {
  const { t } = useTranslation();
  const exercise = exerciseById.get(ctx.step.item.exerciseId);
  const why = useWhy(ctx);
  return (
    <AnimSlot
      why={why}
      glyph={glyphOf(exercise)}
      tag={tag ?? (exercise ? t(`labels.pattern.${exercise.pattern}`) : '')}
      cue={exercise?.keyCue[ctx.lang]}
    />
  );
}

function SpeedIncline({
  speed,
  incline,
  lang,
}: {
  speed: number | undefined;
  incline: number | undefined;
  lang: Language;
}) {
  const { t } = useTranslation();
  if (speed === undefined && incline === undefined) return null;
  return (
    <div className={styles.score}>
      <div className={styles.scoreCell}>
        {speed !== undefined ? (
          <>
            <span className={`${styles.num} ${styles.scoreN}`}>{numberText(speed, lang)}</span>
            <span className={styles.scoreU}>{t('play.cardio.speedUnit')}</span>
          </>
        ) : null}
      </div>
      <div className={styles.scoreCell}>
        {incline !== undefined ? (
          <>
            <span className={`${styles.num} ${styles.scoreN}`}>{numberText(incline, lang)}</span>
            <span className={styles.scoreU}>{t('play.cardio.inclineUnit')}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** 3, 2, 1 before a timer: nothing else on screen but how to cancel. */
function LeadIn({
  ctx,
  state,
  now,
  then,
}: {
  ctx: PlayContext;
  state: PlayerState;
  now: number;
  then: string;
}) {
  const { t } = useTranslation();
  const seconds = clockSeconds(state, now);
  return (
    <>
      <div className={`${styles.set} ${styles.phaseIn}`}>
        <Name ctx={ctx} />
        <div
          className={styles.leadin}
          role="timer"
          aria-label={t('play.timed.leadInLabel', { count: seconds })}
        >
          <p className={styles.leadinWord}>{t('play.timed.leadIn')}</p>
          <span className={`${styles.num} ${styles.leadinN}`}>
            <Tick value={seconds}>{seconds}</Tick>
          </span>
          <p className={styles.leadinThen}>{then}</p>
        </div>
      </div>
      <div className={styles.dock}>
        <Button
          variant="secondary"
          size="player"
          fullWidth
          onClick={() => {
            // Pausing drops the countdown back to ready; resuming right away leaves it there.
            ctx.player.pause();
            ctx.player.resume();
          }}
        >
          {t('play.timed.cancel')}
        </Button>
      </div>
    </>
  );
}

function Bar({
  percent,
  tick,
  children,
}: {
  percent: number;
  tick?: number | undefined;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className={styles.hbar} aria-hidden="true">
        <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        {tick !== undefined ? (
          <span className={styles.hbarTick} style={{ left: `${tick}%` }} />
        ) : null}
      </div>
      <div className={styles.hbarLegend}>{children}</div>
    </div>
  );
}

/** A timed hold: ready, 3 s lead-in, countdown from the top of the range with a tick at the bottom. */
export function HoldScreen(props: TimedProps) {
  const { t } = useTranslation();
  const { state, now, lang, inventory, player, step } = props;
  const target = step.planned.target as Hold;
  const phase = state.phase;
  const exercise = exerciseById.get(step.item.exerciseId);
  const why = useWhy(props);
  // The countdown starts from the set's goal; the range's bottom stays as a tick while it is ahead.
  const goal = setGoal(step.planned) ?? target.minSec;
  const ticked = target.minSec < goal;

  if (phase.kind === 'lead-in')
    return (
      <LeadIn
        ctx={props}
        state={state}
        now={now}
        then={
          ticked
            ? t('play.timed.thenRange', { max: goal, min: target.minSec })
            : t('play.timed.thenOne', { count: goal })
        }
      />
    );

  if (phase.kind === 'timing') {
    const elapsed = timerElapsed(state, now);
    const held = Math.round(elapsed);
    const remaining = clockSeconds(state, now);
    return (
      <>
        <div className={`${styles.set} ${styles.phaseIn}`}>
          <Name ctx={props} />
          <SetHead step={step} bare />
          <div className={styles.clockBlock}>
            <div
              className={styles.clock}
              role="timer"
              aria-label={t('play.timed.timerLabel', { count: remaining })}
            >
              <span className={`${styles.num} ${styles.clockN}`}>{remaining}</span>
              <span className={styles.clockU}>{t('play.timed.unit')}</span>
            </div>
            <Bar
              percent={(elapsed / goal) * 100}
              tick={ticked ? (target.minSec / goal) * 100 : undefined}
            >
              {ticked ? (
                <span style={{ left: `${(target.minSec / goal) * 100}%` }}>
                  {t('play.timed.minimum', { count: target.minSec })}
                </span>
              ) : null}
              <span className={styles.hbarEnd}>
                {goal} {t('play.timed.unit')}
              </span>
            </Bar>
            <p className={styles.heldLine}>{t('play.timed.held', { seconds: held })}</p>
          </div>
        </div>
        <div className={styles.dock}>
          <SegmentedControl
            options={FEELS.map((value) => ({ value, label: t(`play.feel.${value}`) }))}
            value={why.ask && !state.feelChosen ? null : state.feel}
            onChange={player.setFeel}
            label={why.ask ? t('adapt.player.feelAsk') : t('play.set.feel')}
            {...(why.ask && !state.feelChosen && { ask: true })}
          />
          <Button
            variant="secondary"
            size="player"
            fullWidth
            icon="stop"
            className={styles.dockSecond}
            onClick={player.finishTimer}
          >
            <span className={styles.dockDoneText}>
              <span>{t('play.timed.stop')}</span>
              <small>{t('play.timed.logs', { seconds: held })}</small>
            </span>
          </Button>
        </div>
      </>
    );
  }

  const load = loadParts(t, lang, step.planned.load, exercise, inventory);
  const cell = {
    n: String(goal),
    unit:
      target.minSec < target.maxSec
        ? unbreakable(
            playerUnit(t, {
              goal,
              min: target.minSec,
              max: target.maxSec,
              time: true,
              ...(step.side && { side: step.side }),
            }),
          )
        : t('play.set.unitSeconds'),
  };
  return (
    <>
      <div className={styles.set}>
        <Name ctx={props} />
        <SetHead step={step} />
        <div className={styles.score}>
          <div className={styles.scoreCell}>
            <span className={`${styles.num} ${styles.scoreN}`}>{cell.n}</span>
            <span className={styles.scoreU}>{cell.unit}</span>
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
        <NextUp step={step} lang={lang} player={player} />
        <Slot ctx={props} />
      </div>
      <div className={styles.dock}>
        <p className={styles.dockHint}>
          <Icon name="info" size={20} />
          <span>{t('play.timed.heldHint')}</span>
        </p>
        <div className={styles.dockRow}>
          <Button size="player" className={styles.dockDone} icon="play" onClick={player.startTimer}>
            {t('play.timed.start')}
          </Button>
          <EditStop ctx={props} />
        </div>
      </div>
    </>
  );
}

/** Ready screen of cardio and intervals: what is planned, then Start. */
function TimedReady({
  ctx,
  summary,
  speed,
  incline,
}: {
  ctx: PlayContext;
  summary: string;
  speed: number | undefined;
  incline: number | undefined;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.set}>
        <Name ctx={ctx} />
        <p className={styles.summary}>{summary}</p>
        <SpeedIncline speed={speed} incline={incline} lang={ctx.lang} />
        <Slot ctx={ctx} />
      </div>
      <div className={styles.dock}>
        <div className={styles.dockRow}>
          <Button
            size="player"
            className={styles.dockDone}
            icon="play"
            onClick={ctx.player.startTimer}
          >
            {t('play.cardio.start')}
          </Button>
          <EditStop ctx={ctx} />
        </div>
      </div>
    </>
  );
}

/** Work / recovery intervals: one layout for both phases; recovery is yellow (set by the player). */
export function IntervalScreen(props: TimedProps) {
  const { t } = useTranslation();
  const { state, now, lang, player, step } = props;
  const target = step.planned.target as Interval;
  const phase = state.phase;

  if (phase.kind === 'lead-in')
    return (
      <LeadIn
        ctx={props}
        state={state}
        now={now}
        then={t('play.cardio.thenIntervals', { rounds: target.rounds })}
      />
    );

  if (phase.kind !== 'timing')
    return (
      <TimedReady
        ctx={props}
        summary={t('play.cardio.rounds', {
          rounds: target.rounds,
          work: target.workSec,
          recovery: target.recoverySec,
        })}
        speed={target.workSpeedKmh}
        incline={target.workInclinePct}
      />
    );

  const elapsed = timerElapsed(state, now);
  const iv = intervalClock(target, elapsed);
  const work = iv.part === 'work';
  const remaining = Math.ceil(iv.remainingSec);
  const workAt = phaseAt(t, lang, target.workSpeedKmh, target.workInclinePct);
  const recoveryAt = phaseAt(t, lang, target.recoverySpeedKmh, target.recoveryInclinePct);
  const nextRound = iv.round < target.rounds;
  const next =
    work && target.recoverySec > 0
      ? t('play.cardio.nextRecovery', { sec: target.recoverySec, at: recoveryAt })
      : nextRound
        ? t('play.cardio.nextRound', { round: iv.round + 1, sec: target.workSec, at: workAt })
        : t('play.cardio.lastPhase');
  const phaseWord = work ? t('play.cardio.work') : t('play.cardio.recovery');

  return (
    <>
      <div className={`${styles.set} ${styles.phaseIn}`}>
        <Name ctx={props} />
        <div className={styles.ivHead}>
          <div className={styles.ivTop}>
            <span className={styles.ivPhase}>{phaseWord}</span>
            <span className={styles.ivRound}>
              <span>{t('play.set.round')}</span>
              <span>
                <span className={styles.num}>{iv.round}</span>
                <span className={`${styles.num} ${styles.of}`}>/{target.rounds}</span>
              </span>
            </span>
          </div>
          <div className={styles.ivSegs} aria-hidden="true">
            {Array.from({ length: target.rounds }, (_, i) => (
              <i
                key={i}
                className={
                  i + 1 < iv.round
                    ? styles.done
                    : i + 1 === iv.round
                      ? work
                        ? styles.work
                        : styles.rec
                      : ''
                }
              />
            ))}
          </div>
        </div>
        <div
          className={`${styles.clock} ${styles.clockPhase}`}
          role="timer"
          aria-label={t('play.cardio.timerLabel', { phase: phaseWord, count: remaining })}
        >
          <span className={`${styles.num} ${styles.clockN}`}>{remaining}</span>
          <span className={styles.clockU}>{t('play.timed.unit')}</span>
        </div>
        <SpeedIncline
          speed={work ? target.workSpeedKmh : target.recoverySpeedKmh}
          incline={work ? target.workInclinePct : target.recoveryInclinePct}
          lang={lang}
        />
        <p className={styles.ivNext}>
          <span>{t('play.cardio.nextLabel')}</span>
          <b>{next}</b>
        </p>
        <Slot ctx={props} tag="" />
      </div>
      <div className={styles.dock}>
        <div className={styles.dockRow}>
          <Button
            variant="secondary"
            size="player"
            icon="skip"
            className={`${styles.dockDone} ${styles.dockSecond}`}
            onClick={player.skipIntervalPart}
          >
            <span className={styles.dockDoneText}>
              <span>{t('play.cardio.nextPhase')}</span>
            </span>
          </Button>
          <EditStop
            ctx={props}
            partial={() => ({
              durationSec: Math.round(timerElapsed(player.state, Date.now())),
              rounds: intervalClock(target, timerElapsed(player.state, Date.now())).completedRounds,
            })}
          />
        </div>
      </div>
    </>
  );
}

/** Steady cardio: counts up towards the goal; Done becomes the main action once it is reached. */
export function CardioScreen(props: TimedProps) {
  const { t } = useTranslation();
  const { state, now, lang, step } = props;
  const target = step.planned.target as Cardio;
  const phase = state.phase;
  const goalMin = target.minMinutes;
  const range = target.minMinutes < target.maxMinutes;
  const goalText = range
    ? t('play.cardio.goalRange', { min: target.minMinutes, max: target.maxMinutes })
    : t('play.cardio.goal', { minutes: goalMin });

  if (phase.kind === 'lead-in')
    return (
      <LeadIn
        ctx={props}
        state={state}
        now={now}
        then={t('play.cardio.thenCardio', { min: goalMin })}
      />
    );
  if (phase.kind !== 'timing')
    return (
      <TimedReady
        ctx={props}
        summary={goalText}
        speed={target.speedKmh}
        incline={target.inclinePct}
      />
    );

  const elapsed = timerElapsed(state, now);
  const clock = minutesClock(elapsed);
  const reached = elapsed >= goalMin * 60;
  const left = minutesClock(Math.max(0, goalMin * 60 - elapsed));
  const toGo = `${Number(left.m)} ${t('play.cardio.minutes')} ${left.s}`;
  const minutes = Math.round(elapsed / 60);
  const at = phaseAt(t, lang, target.speedKmh, target.inclinePct);

  return (
    <>
      <div className={`${styles.set} ${styles.phaseIn}`}>
        <Name ctx={props} />
        <div className={styles.clockBlock}>
          <div
            className={`${styles.clock} ${styles.clockMmss}`}
            role="timer"
            aria-label={t('play.cardio.clockLabel', {
              minutes: Number(clock.m),
              seconds: Number(clock.s),
            })}
          >
            <span className={`${styles.num} ${styles.clockN}`}>
              {clock.m}
              <span className={styles.colon}>:</span>
              {clock.s}
            </span>
          </div>
          <Bar
            percent={(elapsed / ((range ? target.maxMinutes : goalMin) * 60)) * 100}
            tick={range ? (goalMin / target.maxMinutes) * 100 : undefined}
          >
            {reached ? (
              <span className={styles.reached} role="status">
                <Icon name="check" size={20} />
                {t('play.cardio.goalReached', { minutes: goalMin })}
              </span>
            ) : (
              <>
                <span className={styles.hbarStart}>{t('play.cardio.toGo', { time: toGo })}</span>
                <span className={styles.hbarEnd}>{goalText}</span>
              </>
            )}
          </Bar>
        </div>
        <SpeedIncline speed={target.speedKmh} incline={target.inclinePct} lang={lang} />
        <Slot ctx={props} tag="" />
      </div>
      <div className={styles.dock}>
        <div className={styles.dockRow}>
          {reached ? (
            <Button
              size="player"
              className={styles.dockDone}
              icon="check"
              onClick={props.player.finishTimer}
            >
              <span className={styles.dockDoneText}>
                <span>{t('play.cardio.done')}</span>
                <small>{t('play.cardio.doneAt', { minutes, at })}</small>
              </span>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="player"
              icon="flag"
              className={`${styles.dockDone} ${styles.dockSecond}`}
              onClick={props.player.finishTimer}
            >
              <span className={styles.dockDoneText}>
                <span>{t('play.cardio.stopHere')}</span>
                <small>{t('play.cardio.logsMin', { count: minutes })}</small>
              </span>
            </Button>
          )}
          <EditStop
            ctx={props}
            partial={() => ({
              durationSec: Math.round(timerElapsed(props.player.state, Date.now())),
            })}
          />
        </div>
      </div>
    </>
  );
}

/** What a warm-up item logs when it has no single goal (cardio, intervals, as many as possible). */
function warmupActual(target: Target): SetActual {
  if (target.kind === 'cardio') return { durationSec: target.minMinutes * 60 };
  if (target.kind === 'interval') return { rounds: target.rounds };
  return {};
}

/** A warm-up item: the same set screen without a feel, one tap, and a button to skip it. */
export function WarmupScreen(props: PlayContext) {
  const { t } = useTranslation();
  const { lang, inventory, player, step } = props;
  const { planned } = step;
  const exercise = exerciseById.get(step.item.exerciseId);
  const cell = targetCell(t, planned.target);
  const load = loadParts(t, lang, planned.load, exercise, inventory);
  const sideWord = step.side ? t(`play.side.${step.side}`) : undefined;
  const note = step.item.note?.[lang];
  const group = step.block.type === 'group';
  const summary = rxText(t, lang, planned.target, undefined) || `${cell.n} ${cell.unit}`;
  return (
    <>
      <div className={styles.set}>
        <Name ctx={props} />
        {group || step.side || step.sets > 1 ? <SetHead step={step} bare /> : null}
        <div className={styles.score}>
          <div className={styles.scoreCell}>
            <span className={`${styles.num} ${styles.scoreN}`}>{cell.n}</span>
            <span className={styles.scoreU}>
              {sideWord && planned.target.kind === 'reps'
                ? t('play.set.repsSide', { side: sideWord })
                : cell.unit}
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
        {note ? <p className={styles.hint}>{note}</p> : null}
        {planned.tempo ? <TempoStrip tempo={planned.tempo} /> : null}
        <Slot ctx={props} tag={t('play.warmup.tag')} />
      </div>
      <div className={styles.dock}>
        <div className={styles.dockRow}>
          <Button
            size="player"
            className={styles.dockDone}
            icon="check"
            aria-label={t('play.warmup.done')}
            onClick={() => {
              if (!player.doneAsPlanned()) player.logSet(warmupActual(planned.target));
            }}
          >
            <span className={styles.dockDoneText}>
              <span>{t('play.warmup.done')}</span>
              <small>{summary}</small>
            </span>
          </Button>
          <IconButton
            icon="skip"
            size="player"
            appearance="outline"
            label={t('play.warmup.skip')}
            onClick={player.skipWarmupItem}
          />
        </div>
      </div>
    </>
  );
}
