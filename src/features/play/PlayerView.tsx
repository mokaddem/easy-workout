import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Flood } from '@/motion';
import { exerciseById } from '@/catalogue';
import { updateSettings, useEquipment, useSettings } from '@/app/data';
import { navigate, useLeaveGuard } from '@/app/router';
import { useVoiceAvailable } from '@/features/settings/voices';
import { useToast } from '@/ui/components';
import { setLogKey, type Language, type SessionLog } from '@/domain';
import { activeSeconds, sessionMinutes } from '@/engine';
import { PlayerBar } from './components/PlayerBar';
import { RestScreen, SwitchScreen } from './components/RestScreen';
import { SetScreen } from './components/SetScreen';
import { CardioScreen, HoldScreen, IntervalScreen, WarmupScreen } from './components/TimedScreens';
import { LeaveSheet } from './components/LeaveSheet';
import { PausedScreen } from './components/StatusScreens';
import { TestRunner } from './components/TestRunner';
import { clockText, exerciseLabel, progressOf, timerElapsed } from './format';
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
  const step = currentStep(state);
  const finished = state.phase.kind === 'finished' || !step;
  const voiceAvailable = useVoiceAvailable(lang);

  // The max test this session runs: at the end, or right after the warm-up. Once it has opened it
  // stays until the user moves on, even though saving it already closes it in the log.
  const test = log.test;
  const pendingTest = !!test && !test.outcome;
  const warmupDone = state.steps.every(
    (s) => s.section !== 'warmup' || state.logged.has(setLogKey(s)),
  );
  const testDue = pendingTest && (finished || (test.placement === 'after-warmup' && warmupDone));
  const [testStage, setTestStage] = useState<'idle' | 'open' | 'closed'>('idle');
  if (testDue && testStage === 'idle') setTestStage('open');
  const atTest = !!test && (testStage === 'open' || (testStage === 'idle' && testDue));
  const sessionOver = finished && !atTest;
  const [testResting, setTestResting] = useState(false);
  useWakeLock(!sessionOver && state.pausedAt === undefined);

  // The session clock moves on its own, between taps.
  const [tick, setTick] = useState(now);
  useEffect(() => {
    if (sessionOver) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessionOver]);

  // Set once this screen ends the session itself: its closing is expected, not a surprise.
  const leaving = useRef(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  // Visual only: whether the yellow disc has finished growing (the background takes over then).
  const [flooded, setFlooded] = useState(false);
  useEffect(() => {
    if (!sessionOver || leaving.current) return;
    leaving.current = true;
    void finish({ endedEarly: false }).then(onSummary);
  }, [sessionOver, finish, onSummary]);

  // The test comes in place of a pause between the warm-up and the first exercise.
  const { skipPause } = player;
  const stillPausing = atTest && !finished && state.phase.kind === 'pause';
  useEffect(() => {
    if (stillPausing) skipPause();
  }, [stillPausing, skipPause]);

  // Back (gesture, button or browser) asks what to do with the session instead of leaving it.
  const paused = state.pausedAt !== undefined;
  const pauseNow = player.pause;
  // Closing or reloading the page loses nothing (the session resumes), so the browser isn't asked.
  useLeaveGuard(
    !sessionOver && !closed,
    (proceed) => {
      if (leaving.current) {
        proceed();
        return;
      }
      if (!paused) pauseNow();
      setLeaveOpen(true);
    },
    { unload: false },
  );

  // The session was closed from elsewhere before it ended here.
  useEffect(() => {
    if (!closed || sessionOver || leaving.current) return;
    leaving.current = true;
    navigate({ name: 'programme' }, { replace: true });
  }, [closed, sessionOver]);

  if (sessionOver) return <div className={styles.root} />;

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

  const clock = clockText(activeSeconds(log, new Date(Math.max(tick, now))));
  const voiceOn = settings?.voice ?? true;
  const ring = settings?.restDisplay === 'ring';
  const onVoice = () => {
    void updateSettings({ voice: !voiceOn });
    toast.show({
      message: t(
        voiceOn
          ? 'play.voiceOff'
          : voiceAvailable === false
            ? 'adapt.notes.noVoice.toast'
            : 'play.voiceOn',
      ),
    });
  };
  const mainSteps = state.steps.filter((x) => x.section === 'main');
  const firstMain = mainSteps[0]
    ? {
        name: exerciseLabel(
          exerciseById.get(mainSteps[0].item.exerciseId),
          lang,
          mainSteps[0].item.exerciseId,
        ),
        count: new Set(mainSteps.map((x) => `${x.blockIndex}-${x.itemIndex}`)).size,
        minutes: Math.round(sessionMinutes(log.plan)),
      }
    : undefined;

  const testBranch =
    atTest && test ? (
      <div
        className={styles.root}
        data-tone={testResting ? 'rest' : undefined}
        data-flooding={testResting && !flooded ? '' : undefined}
        onPointerDown={unlockAudio}
      >
        <AnimatePresence initial={false} onExitComplete={() => setFlooded(false)}>
          {testResting ? (
            <Flood key="flood" origin="bottom" onSettled={() => setFlooded(true)} />
          ) : null}
        </AnimatePresence>
        <div className={styles.stage} data-stage={testResting ? 'rest' : 'exercise'}>
          <TestRunner
            mode={test.placement}
            exerciseId={test.exerciseId}
            kind={test.kind}
            log={log}
            paused={paused}
            clock={clock}
            voiceOn={voiceOn}
            onVoice={onVoice}
            onPause={player.pause}
            onResume={player.resume}
            onLeave={() => setLeaveOpen(true)}
            onResting={setTestResting}
            onFinished={() => setTestStage('closed')}
            {...(test.placement === 'after-warmup' && firstMain && { next: firstMain })}
          />
        </div>
        <LeaveSheet
          open={leaveOpen}
          log={log}
          onClose={() => setLeaveOpen(false)}
          onPauseLeave={leave.pause}
          onFinish={leave.finish}
          onAbandon={leave.abandon}
        />
      </div>
    ) : null;
  if (testBranch) return testBranch;
  if (!step) return <div className={styles.root} />;

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
  const ctx = { lang, inventory, log, player, step };
  const phase = state.phase;
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
      <LeaveSheet
        open={leaveOpen}
        log={log}
        onClose={() => setLeaveOpen(false)}
        onPauseLeave={leave.pause}
        onFinish={leave.finish}
        onAbandon={leave.abandon}
      />
    </div>
  );
}
