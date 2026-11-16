import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Flood } from '@/motion';
import { updateSettings, useEquipment, useSettings } from '@/app/data';
import { navigate } from '@/app/router';
import { useToast } from '@/ui/components';
import type { Language, SessionLog } from '@/domain';
import { activeSeconds } from '@/engine';
import { PlayerBar } from './components/PlayerBar';
import { RestScreen, SwitchScreen } from './components/RestScreen';
import { SetScreen } from './components/SetScreen';
import { CardioScreen, HoldScreen, IntervalScreen, WarmupScreen } from './components/TimedScreens';
import { LeaveSheet } from './components/LeaveSheet';
import { PausedScreen } from './components/StatusScreens';
import { clockText, progressOf, timerElapsed } from './format';
import { currentStep, intervalClock } from './machine';
import styles from './Play.module.css';
import { announcement, unlockAudio, useSignals, useWakeLock } from './signals';
import { usePlayer } from './usePlayer';

/** Runs one open session. Mount it keyed by the log id; `closed` once the log is no longer open. */
export function PlayerView({
  log,
  closed,
  onSummary,
}: {
  log: SessionLog;
  closed: boolean;
  /** The session is finished and stored: show its summary. */
  onSummary: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const player = usePlayer(log);
  const inventory = useEquipment() ?? [];
  const settings = useSettings();
  const toast = useToast();
  const { state, now, finish } = player;
  const describe = (index: number) => {
    const at = state.steps[index];
    return at ? announcement(at, t, lang) : '';
  };
  useSignals(state, now, settings, describe, lang);
  useWakeLock(state.phase.kind !== 'finished' && state.pausedAt === undefined);
  const step = currentStep(state);
  const finished = state.phase.kind === 'finished' || !step;

  // The session clock moves on its own, between taps.
  const [tick, setTick] = useState(now);
  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [finished]);

  // Set once this screen ends the session itself: its closing is expected, not a surprise.
  const leaving = useRef(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  // Visual only: whether the yellow disc has finished growing (the background takes over then).
  const [flooded, setFlooded] = useState(false);
  useEffect(() => {
    if (!finished || leaving.current) return;
    leaving.current = true;
    void finish({ endedEarly: false }).then(onSummary);
  }, [finished, finish, onSummary]);

  // The session was closed from elsewhere before it ended here.
  useEffect(() => {
    if (closed && !finished && !leaving.current) navigate({ name: 'programme' }, { replace: true });
  }, [closed, finished]);

  if (finished || !step) return <div className={styles.root} />;

  const leave = {
    pause: () => {
      leaving.current = true;
      if (state.pausedAt === undefined) player.pause();
      navigate({ name: 'programme' }, { replace: true });
    },
    finish: async () => {
      leaving.current = true;
      // Nothing logged: there is no summary to show, it is the same as abandoning.
      if (log.sets.length === 0) {
        await player.abandon();
        navigate({ name: 'programme' }, { replace: true });
        return;
      }
      await finish({ endedEarly: true });
      onSummary();
    },
    abandon: async () => {
      leaving.current = true;
      await player.abandon();
      navigate({ name: 'programme' }, { replace: true });
    },
  };

  const progress = progressOf(state.steps, step);
  const segments = { total: progress.total, current: progress.current };
  const context =
    progress.section === 'warmup'
      ? t('play.context.warmup', { current: progress.current, total: progress.total })
      : progress.section === 'finisher'
        ? step.planned.target.kind === 'interval'
          ? t('play.context.finisherIntervals')
          : step.planned.target.kind === 'cardio'
            ? t('play.context.finisherCardio')
            : t('play.context.finisher')
        : t('play.context.exercise', { current: progress.current, total: progress.total });
  const clock = clockText(activeSeconds(log, new Date(Math.max(tick, now))));
  const voiceOn = settings?.voice ?? true;
  const ring = settings?.restDisplay === 'ring';
  const onVoice = () => {
    void updateSettings({ voice: !voiceOn });
    toast.show({ message: t(voiceOn ? 'play.voiceOff' : 'play.voiceOn') });
  };
  const ctx = { lang, inventory, log, player, step };
  const phase = state.phase;
  const paused = state.pausedAt !== undefined;
  const resting = phase.kind === 'pause' && !paused;
  const target = step.planned.target;
  const recovery =
    !paused &&
    phase.kind === 'timing' &&
    target.kind === 'interval' &&
    intervalClock(target, timerElapsed(state, now)).part === 'recovery';
  // Yellow means rest: the takeover, and the recovery phase of intervals. The ring setting turns both
  // dark; until settings are read, nothing turns yellow, so the ring never opens with a flash.
  const yellow =
    settings !== undefined && !ring && ((resting && phase.pause.kind !== 'side') || recovery);

  let body;
  if (paused) {
    body = (
      <>
        <PlayerBar
          context={context}
          segments={segments}
          clock={clock}
          voiceOn={voiceOn}
          onVoice={onVoice}
          paused
          onPause={player.resume}
        />
        <PausedScreen {...ctx} clock={clock} onLeave={() => setLeaveOpen(true)} />
        <LeaveSheet
          open={leaveOpen}
          log={log}
          onClose={() => setLeaveOpen(false)}
          onPauseLeave={leave.pause}
          onFinish={leave.finish}
          onAbandon={leave.abandon}
        />
      </>
    );
  } else if (resting && phase.pause.kind === 'side') {
    body = (
      <SwitchScreen {...ctx} {...{ state, now, clock, voiceOn, onVoice, context, segments }} />
    );
  } else if (resting) {
    body = <RestScreen {...ctx} {...{ state, now, clock, voiceOn, onVoice, ring }} />;
  } else {
    body = (
      <>
        <PlayerBar
          context={context}
          segments={segments}
          clock={clock}
          voiceOn={voiceOn}
          onVoice={onVoice}
          tone={yellow ? 'rest' : 'base'}
          onPause={player.pause}
        />
        {step.section === 'warmup' ? (
          <WarmupScreen key={state.index} {...ctx} />
        ) : target.kind === 'reps' || target.kind === 'max' ? (
          <SetScreen key={state.index} {...ctx} />
        ) : target.kind === 'time' ? (
          <HoldScreen key={state.index} {...ctx} {...{ state, now }} />
        ) : target.kind === 'cardio' ? (
          <CardioScreen key={state.index} {...ctx} {...{ state, now }} />
        ) : (
          <IntervalScreen key={state.index} {...ctx} {...{ state, now }} />
        )}
      </>
    );
  }

  // How this screen arrives: a new exercise slides in, anything else fades.
  const before = state.steps[state.index - 1];
  const stage = paused
    ? 'paused'
    : resting
      ? phase.pause.kind === 'side'
        ? 'switch'
        : 'rest'
      : before &&
          before.section === step.section &&
          before.blockIndex === step.blockIndex &&
          before.itemIndex === step.itemIndex
        ? 'next'
        : 'exercise';
  const stageKey = stage === 'next' || stage === 'exercise' ? `${stage}-${state.index}` : stage;

  return (
    // Any tap may be the first since the app reopened: it lets sound play again.
    <div
      className={styles.root}
      data-tone={yellow ? 'rest' : undefined}
      data-flooding={yellow && !flooded ? '' : undefined}
      onPointerDown={unlockAudio}
    >
      <AnimatePresence initial={false} onExitComplete={() => setFlooded(false)}>
        {yellow ? (
          <Flood
            key="flood"
            origin={resting ? 'bottom' : 'centre'}
            onSettled={() => setFlooded(true)}
          />
        ) : null}
      </AnimatePresence>
      <div className={styles.stage} data-stage={stage} key={stageKey}>
        {body}
      </div>
    </div>
  );
}
