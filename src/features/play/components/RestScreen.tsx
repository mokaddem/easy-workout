import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Pulse } from '@/motion';
import { exerciseById } from '@/catalogue';
import { Button, Icon } from '@/ui/components';
import { clockSeconds, type PlayerState } from '../machine';
import { exerciseLabel, itemLetter, repsAt, rxText, targetNumber } from '../format';
import styles from '../Play.module.css';
import { ItemTiles } from './parts';
import { PlayerBar } from './PlayerBar';
import type { PlayContext } from './types';

/** The arc and bar follow the clock; a +/-15 s nudge is the one jump, and it glides over `base`, `move`. */
function useNudged(seconds: number): CSSProperties | undefined {
  const last = useRef(seconds);
  const [nudged, setNudged] = useState(false);
  useEffect(() => {
    const jump = Math.abs(seconds - last.current) > 2;
    last.current = seconds;
    if (!jump) return;
    setNudged(true);
    const id = setTimeout(() => setNudged(false), 320);
    return () => clearTimeout(id);
  }, [seconds]);
  return nudged
    ? { transitionDuration: 'var(--duration-base)', transitionTimingFunction: 'var(--ease-move)' }
    : undefined;
}

/** The last three seconds beat once each, with the beep. */
const lastSeconds = (seconds: number) => (seconds > 0 && seconds <= 3 ? seconds : false);

interface RestProps extends PlayContext {
  state: PlayerState;
  now: number;
  clock: string;
  voiceOn: boolean;
  onVoice: () => void;
  /** The ring timer instead of the yellow takeover. */
  ring?: boolean;
}

/** Between two sets, items or rounds: the yellow takeover (or the ring) with the countdown and what is next. */
export function RestScreen({
  state,
  now,
  clock,
  voiceOn,
  onVoice,
  ring,
  lang,
  player,
  step,
}: RestProps) {
  const { t } = useTranslation();
  const phase = state.phase;
  const nudge = useNudged(phase.kind === 'pause' ? clockSeconds(state, now) : 0);
  if (phase.kind !== 'pause') return null;
  const last = state.last === undefined ? undefined : state.steps[state.last];
  const lastExercise = last && exerciseById.get(last.item.exerciseId);
  const seconds = clockSeconds(state, now);
  const total = Math.max(1, (phase.endsAt - phase.startedAt) / 1000);
  const ratio = Math.min(1, Math.max(0, seconds / total));
  const kind = phase.pause.kind;
  const group = step.block.type === 'group';
  const betweenItems = group && kind === 'item';

  const done = !last
    ? null
    : betweenItems
      ? null
      : kind === 'rest'
        ? t(last.block.type === 'group' ? 'play.rest.roundLogged' : 'play.rest.setLogged', {
            set: last.set,
            sets: last.sets,
          })
        : t('play.rest.exerciseDone', {
            name: exerciseLabel(lastExercise, lang, last.item.exerciseId),
          });

  const exercise = exerciseById.get(step.item.exerciseId);
  const { planned } = step;
  const goal = planned.target.kind === 'reps' ? planned.target.min : undefined;
  const rx = group
    ? rxText(t, lang, planned.target, planned.load)
    : planned.target.kind === 'reps' || planned.target.kind === 'max'
      ? repsAt(t, lang, goal, planned.load) ||
        `${targetNumber(t, planned.target)} ${t('play.set.reps')}`
      : planned.target.kind === 'time'
        ? t('play.set.seconds', { count: planned.target.minSec })
        : '';
  const nextName = exerciseLabel(exercise, lang, step.item.exerciseId);
  const startsRound = group && kind === 'rest';
  const nextLabel = startsRound
    ? t('play.rest.roundStarts', { set: step.set, sets: step.sets })
    : t('play.rest.next');
  const letter = group && (startsRound || betweenItems) ? itemLetter(step.itemIndex) : undefined;
  const nextRx = group
    ? rx
    : `${t('play.rest.setOf', { set: step.set, sets: step.sets })}${rx ? ` · ${rx}` : ''}`;
  const context = kind === 'item' ? t('play.context.change') : t('play.context.rest');

  const controls = (
    <div className={styles.restCtrls}>
      <button
        type="button"
        className={styles.restBtn}
        aria-label={t('play.rest.less')}
        onClick={() => player.adjustPause(-15)}
      >
        {t('play.rest.minus')}
      </button>
      <button
        type="button"
        className={styles.restBtn}
        aria-label={t('play.rest.more')}
        onClick={() => player.adjustPause(15)}
      >
        {t('play.rest.plus')}
      </button>
      <button
        type="button"
        className={`${styles.restBtn} ${ring ? styles.ringSkip : styles.restSkip}`}
        onClick={player.skipPause}
      >
        {t('play.rest.skip')}
        <Icon name="skip" size={24} />
      </button>
    </div>
  );

  const nextCard = (
    <div className={ring ? styles.ringNext : styles.restNext}>
      <span className={styles.restNextLabel}>
        {nextLabel}
        {letter ? (
          <span className={styles.restNextTile} aria-hidden="true">
            {letter}
          </span>
        ) : null}
      </span>
      <span className={styles.restNextName}>{nextName}</span>
      <span className={styles.restNextRx}>{nextRx}</span>
    </div>
  );

  const doneLine = done ? (
    <p className={styles.restDone}>
      <Icon name="check" size={20} />
      <span className={styles.restDoneText}>{done}</span>
    </p>
  ) : null;

  if (ring)
    return (
      <>
        <PlayerBar
          context={context}
          clock={clock}
          voiceOn={voiceOn}
          onVoice={onVoice}
          onPause={player.pause}
        />
        <div className={styles.restBody}>
          {doneLine}
          <div
            className={styles.ring}
            role="timer"
            aria-label={t('play.rest.label', { count: seconds })}
          >
            <svg viewBox="0 0 340 340" aria-hidden="true">
              <circle className={styles.ringTrack} cx="170" cy="170" r="160" />
              <circle
                className={styles.ringProgress}
                cx="170"
                cy="170"
                r="160"
                pathLength="100"
                strokeDasharray={`${ratio * 100} 100`}
                style={nudge}
              />
            </svg>
            <div className={styles.ringCenter}>
              <span className={`${styles.num} ${styles.ringN}`}>
                <Pulse fire={lastSeconds(seconds)}>{seconds}</Pulse>
              </span>
              <span className={styles.ringU}>{t('play.rest.seconds')}</span>
            </div>
          </div>
          <div className={styles.ringGap} />
          {nextCard}
          {controls}
        </div>
      </>
    );

  return (
    <>
      <PlayerBar
        tone="rest"
        context={context}
        clock={clock}
        voiceOn={voiceOn}
        onVoice={onVoice}
        onPause={player.pause}
      />
      <div className={styles.restBody}>
        {betweenItems && step.block.type === 'group' ? (
          <div className={styles.restRound}>
            <span className={styles.setLabel}>
              <span>{t('play.set.round')}</span>
              <span>
                <span className={styles.num}>{step.set}</span>
                <span className={`${styles.num} ${styles.of}`}>/{step.sets}</span>
              </span>
            </span>
            <ItemTiles
              items={step.block.items}
              index={step.itemIndex}
              label={t('play.rest.itemsNext', {
                done: itemLetter(Math.max(0, step.itemIndex - 1)),
                next: itemLetter(step.itemIndex),
              })}
            />
          </div>
        ) : null}
        {doneLine}
        <div className={styles.restCenter}>
          <div
            className={styles.restTimer}
            role="timer"
            aria-label={t('play.rest.label', { count: seconds })}
          >
            <span className={styles.restN} data-digits={String(seconds).length}>
              <Pulse fire={lastSeconds(seconds)}>{seconds}</Pulse>
            </span>
            <span className={styles.restU}>s</span>
          </div>
          <div className={styles.restBar} aria-hidden="true">
            <i style={{ width: `${ratio * 100}%`, ...nudge }} />
          </div>
        </div>
        {nextCard}
        {controls}
      </div>
    </>
  );
}

/** The 5-second pause when a per-side exercise changes side: dark, because it isn't a rest. */
export function SwitchScreen({
  state,
  now,
  clock,
  voiceOn,
  onVoice,
  lang,
  player,
  step,
  context,
  segments,
}: RestProps & { context: string; segments: { total: number; current: number } }) {
  const { t } = useTranslation();
  const phase = state.phase;
  if (phase.kind !== 'pause' || !step.side) return null;
  const exercise = exerciseById.get(step.item.exerciseId);
  const seconds = clockSeconds(state, now);
  const total = Math.max(1, (phase.endsAt - phase.startedAt) / 1000);
  const doneSide = step.side === 'right' ? 'left' : 'right';
  const letter = (side: 'left' | 'right') =>
    t(side === 'left' ? 'play.side.leftLetter' : 'play.side.rightLetter');
  const nextWord = t(`play.side.${step.side}`);
  return (
    <>
      <PlayerBar
        context={context}
        segments={segments}
        clock={clock}
        voiceOn={voiceOn}
        onVoice={onVoice}
        onPause={player.pause}
      />
      <div className={styles.set}>
        <h1 className={styles.name}>{exerciseLabel(exercise, lang, step.item.exerciseId)}</h1>
        <span className={styles.setLabel}>
          <span>{t('play.set.set')}</span>
          <span>
            <span className={styles.num}>{step.set}</span>
            <span className={`${styles.num} ${styles.of}`}>/{step.sets}</span>
          </span>
        </span>
        <p className={styles.switchTitle}>{t('play.side.switch')}</p>
        <div className={styles.switch}>
          <div className={`${styles.switchTile} ${styles.done}`}>
            <b>{letter(doneSide)}</b>
            <span>
              <Icon name="check" size={20} />
              {t('play.side.done')}
            </span>
          </div>
          <Icon name="chev-right" size={28} />
          <div className={`${styles.switchTile} ${styles.next}`}>
            <b>{letter(step.side)}</b>
            <span className={styles.capital}>{t('play.side.sideWord', { side: nextWord })}</span>
          </div>
        </div>
        <div className={styles.switchCount}>
          <div className={styles.count} role="timer">
            <span className={styles.countL}>{t('play.side.startsIn')}</span>
            <span className={`${styles.num} ${styles.countN}`}>
              {t('play.set.seconds', { count: seconds })}
            </span>
          </div>
          <div className={styles.tbar} aria-hidden="true">
            <i style={{ width: `${Math.min(100, (seconds / total) * 100)}%` }} />
          </div>
        </div>
      </div>
      <div className={styles.dock}>
        <Button variant="secondary" size="player" fullWidth onClick={player.skipPause}>
          {t('play.side.startNow', { side: nextWord })}
        </Button>
      </div>
    </>
  );
}
