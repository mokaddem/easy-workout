import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CountUp, Pulse, Roll, Tick } from '@/motion';
import { useMaxTests, useProgrammes, useSessionLogs, useSettings } from '@/app/data';
import { exerciseById } from '@/catalogue';
import { repo } from '@/db/repo';
import type { Language, MaxTest, SessionLog } from '@/domain';
import { navigate } from '@/app/router';
import { exerciseHistory, localDate, previousTest } from '@/engine';
import { ChangeTag, Rich, type ChangeTagData } from '@/features/adapt';
import {
  Button,
  CompareFigure,
  Dialog,
  Icon,
  IconButton,
  Sheet,
  Stepper,
  TestResultCard,
} from '@/ui/components';
import { exerciseLabel, glyphOf } from '../format';
import styles from '../Play.module.css';
import { beep, vibrate } from '../signals';
import {
  adjustRest,
  buildTest,
  entryPrefill,
  finishSet,
  heldSeconds,
  leadInSeconds,
  openTest,
  pauseTest,
  restSeconds,
  resumeTest,
  resultValue,
  setEntry,
  skipRest,
  startHold,
  startRest,
  testCap,
  tickTest,
  verdictOf,
  type TestFlow,
  type TestKind,
  type TestVerdict,
} from '../testFlow';
import { captionDate, shortDate, valueText, verdictKey } from '../testFormat';
import { closeSessionTest } from '../testStore';
import { AnimSlot } from './AnimSlot';
import { PlayerBar } from './PlayerBar';
import mine from './Test.module.css';

export type TestOutcome = 'done' | 'skipped' | 'pain';

export interface TestRunnerProps {
  /** The end of a session, right after its warm-up, or on its own. */
  mode: 'end' | 'after-warmup' | 'fresh';
  exerciseId: string;
  kind: TestKind;
  /** The open session that runs the test; none for a test on its own. */
  log?: SessionLog;
  /** The session is paused: clocks stand still. */
  paused: boolean;
  clock?: string;
  voiceOn?: boolean;
  onVoice?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  /** Session: the leave sheet. Test on its own: the way out. */
  onLeave: () => void;
  /** After the warm-up: what follows the test. */
  next?: { name: string; count: number; minutes: number };
  /** The test is over (saved and seen, skipped, or stopped for pain): carry on. */
  onFinished: (outcome: TestOutcome) => void;
  /** Whether the rest takeover is on screen (it turns the whole player yellow). */
  onResting?: (resting: boolean) => void;
}

interface Saved {
  test: MaxTest;
  previous: MaxTest | undefined;
}

const cycleOf = (
  programmeId: string | undefined,
  programmes: readonly { id: string; generation?: { cycle?: number } }[],
) => programmes.find((p) => p.id === programmeId)?.generation?.cycle ?? 1;

/** The max test: intro, rest, the set, the result to confirm and what it says. */
export function TestRunner(props: TestRunnerProps) {
  const { mode, exerciseId, kind, log, paused, clock, onFinished, onLeave } = props;
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const allTests = useMaxTests();
  const logs = useSessionLogs() ?? [];
  const programmes = useProgrammes() ?? [];
  const settings = useSettings();
  const fresh = mode === 'fresh';
  const context: MaxTest['context'] = fresh ? 'fresh' : 'session';
  const exercise = exerciseById.get(exerciseId);
  const name = exerciseLabel(exercise, lang, exerciseId);

  const [flow, setFlow] = useState<TestFlow>(() => openTest(kind, fresh ? 'fresh' : 'session'));
  const [now, setNow] = useState(() => Date.now());
  const [startedAt] = useState(() => new Date().toISOString());
  const [freshId] = useState(
    () => `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const [saved, setSaved] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const stage = flow.stage;
  const hold = kind === 'time';

  const previous = useMemo(
    () => previousTest({ exerciseId, context, at: startedAt }, allTests ?? []),
    [exerciseId, context, startedAt, allTests],
  );
  const previousValue = previous ? resultValue(previous) : undefined;

  // Clocks.
  const running =
    !paused && (stage.kind === 'rest' || stage.kind === 'lead-in' || stage.kind === 'running');
  useEffect(() => {
    if (!running) return;
    const frame = () => {
      const at = Date.now();
      setNow(at);
      setFlow((f) => tickTest(f, at));
    };
    const id = setInterval(frame, 250);
    document.addEventListener('visibilitychange', frame);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', frame);
    };
  }, [running]);

  // The session pauses and resumes the clocks.
  useEffect(() => {
    const at = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follows the session's pause
    setNow(at);
    setFlow((f) => (paused ? pauseTest(f, at) : resumeTest(f, at)));
  }, [paused]);

  // The yellow takeover only when the rest is set to it; until settings are read, nothing turns yellow.
  const ring = settings?.restDisplay === 'ring';
  const resting = stage.kind === 'rest' && !paused && settings !== undefined && !ring;
  const { onResting } = props;
  useEffect(() => onResting?.(resting), [resting, onResting]);
  useEffect(() => () => onResting?.(false), [onResting]);

  // Beeps for the last seconds of a countdown and when a hold reaches its ceiling.
  const sounds = settings?.sounds ?? true;
  const countdown =
    stage.kind === 'rest'
      ? restSeconds(flow, now)
      : stage.kind === 'lead-in'
        ? leadInSeconds(flow, now)
        : -1;
  useEffect(() => {
    if (!sounds || paused || countdown < 0) return;
    if (countdown > 0 && countdown <= 3) beep('tick');
  }, [countdown, sounds, paused]);
  const capped = stage.kind === 'entry' && hold && stage.value === testCap('time');
  const cappedBefore = useRef(false);
  useEffect(() => {
    if (!capped || cappedBefore.current) return;
    cappedBefore.current = true;
    if (sounds) beep('go');
    if (settings?.vibration) vibrate(250);
  }, [capped, sounds, settings?.vibration]);

  const best = () => {
    const points = exerciseHistory(exerciseId, logs, programmes);
    const unit = hold ? 'seconds' : 'reps';
    const values = points.flatMap((p) => (p.best && p.best.unit === unit ? [p.best.value] : []));
    return values.length > 0 ? Math.max(...values) : undefined;
  };
  const prefill = () => entryPrefill(kind, previous, best());

  const update = (change: (f: TestFlow, at: number) => TestFlow) => {
    const at = Date.now();
    setNow(at);
    setFlow((f) => change(f, at));
  };

  const programmeId = log?.source.kind === 'programme' ? log.source.programmeId : undefined;
  const recordId = log ? `${log.id}-test` : freshId;

  const save = async (value: number) => {
    if (busy) return;
    setBusy(true);
    const at = new Date();
    const test = buildTest({
      id: recordId,
      kind,
      exerciseId,
      value,
      now: at,
      localDate: localDate(at),
      context,
      ...(log && { logId: log.id }),
      ...(programmeId && { programmeId }),
    });
    try {
      if (log) await closeSessionTest(log.id, 'done', test);
      else await repo.saveMaxTest(test);
      setSaved({ test, previous });
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    try {
      if (log) await closeSessionTest(log.id, 'skipped');
      setSkipOpen(false);
      onFinished('skipped');
    } finally {
      setBusy(false);
    }
  };

  const stopForPain = async (value: number) => {
    setBusy(true);
    const at = new Date();
    const test = buildTest({
      id: recordId,
      kind,
      exerciseId,
      value,
      now: at,
      localDate: localDate(at),
      context,
      stopped: 'pain',
      ...(log && { logId: log.id }),
      ...(programmeId && { programmeId }),
    });
    try {
      if (log) await closeSessionTest(log.id, 'pain', test);
      else await repo.saveMaxTest(test);
      setStopOpen(false);
      onFinished('pain');
    } finally {
      setBusy(false);
    }
  };

  const kickerKey =
    mode === 'fresh'
      ? 'play.test.kickerFresh'
      : mode === 'after-warmup'
        ? 'play.test.kickerFirst'
        : 'play.test.kickerCycle';
  const contextText = t(
    fresh
      ? 'play.fresh.context'
      : mode === 'after-warmup'
        ? 'play.test.contextFirst'
        : 'play.test.context',
  );

  const bar = fresh ? (
    <div className={`${styles.bar} ${mine.freshBar}`}>
      <IconButton icon="close" label={t('play.fresh.leave')} onClick={onLeave} />
      <span>{contextText}</span>
    </div>
  ) : (
    <PlayerBar
      context={contextText}
      clock={clock ?? ''}
      voiceOn={props.voiceOn ?? true}
      paused={paused}
      onPause={
        paused ? (props.onResume ?? (() => undefined)) : (props.onPause ?? (() => undefined))
      }
      {...(props.onVoice && { onVoice: props.onVoice })}
      tone={resting ? 'rest' : 'base'}
    />
  );

  const toBeatBlock = (
    <div className={mine.toBeat}>
      {previous && previousValue !== undefined ? (
        <>
          <div className={mine.toBeatRow}>
            <span className={`${styles.num} ${mine.beatN}`}>{valueText(kind, previousValue)}</span>
            <span className={mine.beatLabel}>{t('play.test.beat')}</span>
          </div>
          <p className={mine.beatLine}>
            {t(fresh ? 'play.test.lastFresh' : 'play.test.lastSession', {
              date: shortDate(previous.date, lang),
            })}
          </p>
        </>
      ) : (
        <p className={mine.beatLine}>{t('play.test.firstTest')}</p>
      )}
    </div>
  );

  const rules = (
    <ul className={mine.rules}>
      <li>
        <Rich text={t(hold ? 'play.test.rule.oneTry' : 'play.test.rule.oneSet')} />
      </li>
      {exercise?.keyCue[lang] ? (
        <li>
          <Rich text={t('play.test.rule.form', { cue: exercise.keyCue[lang] })} />
        </li>
      ) : null}
      <li>
        <Rich text={t(hold ? 'play.test.rule.stopClock' : 'play.test.rule.stop')} />
      </li>
      {!hold && mode !== 'after-warmup' ? (
        <li>
          <Rich text={t('play.test.rule.count')} />
        </li>
      ) : null}
    </ul>
  );

  const pencil = (
    <IconButton
      icon="pencil"
      size="player"
      appearance="outline"
      label={t('play.test.options')}
      onClick={() => setStopOpen(true)}
    />
  );

  const skipDialog = (
    <Dialog
      open={skipOpen}
      onClose={() => setSkipOpen(false)}
      title={t('play.test.skipTitle')}
      description={<Rich text={t('play.test.skipBody')} />}
      confirmLabel={t('play.test.skipConfirm')}
      cancelLabel={t('play.test.skipCancel')}
      confirmLoading={busy}
      onConfirm={() => void skip()}
    />
  );

  const stopSheet = (
    <StopSheet
      open={stopOpen}
      onClose={() => setStopOpen(false)}
      kind={kind}
      busy={busy}
      held={stage.kind === 'running' ? heldSeconds(flow, now) : undefined}
      onStop={(value) => void stopForPain(value)}
    />
  );

  let body: ReactNode;
  if (paused) {
    body = (
      <>
        <div className={`${styles.set} ${mine.arrive}`}>
          <div className={styles.pausedHead}>
            <h1 className={styles.name}>{t('play.paused.title')}</h1>
            <p className={styles.pausedSession}>{log?.plan.name[lang] ?? name}</p>
          </div>
          {clock ? (
            <p className={styles.pausedClock}>
              <span className={`${styles.num} ${styles.pausedN}`}>{clock}</span>
              <span>{t('play.paused.clock')}</span>
            </p>
          ) : null}
          <p className={styles.pausedAt}>
            <b>{t('play.test.resumeAt', { name })}</b>
          </p>
        </div>
        <div className={`${styles.dock} ${mine.arriveDock}`}>
          <Button size="player" fullWidth icon="play" onClick={props.onResume}>
            {t('play.paused.resume')}
          </Button>
          <Button size="player" variant="secondary" fullWidth onClick={onLeave}>
            {t('play.test.leave')}
          </Button>
        </div>
      </>
    );
  } else if (saved) {
    body = fresh ? (
      <FreshSummary saved={saved} name={name} lang={lang} onBack={() => onFinished('done')} />
    ) : (
      <ResultView
        saved={saved}
        name={name}
        lang={lang}
        programmes={programmes}
        programmeId={programmeId}
        mode={mode}
        {...(props.next && { next: props.next })}
        onContinue={() => onFinished('done')}
      />
    );
  } else if (stage.kind === 'intro' || stage.kind === 'ready') {
    const ready = stage.kind === 'ready';
    body = (
      <>
        <div className={`${styles.set} ${mine.arrive}`}>
          <p className={mine.kicker}>{t(kickerKey)}</p>
          <h1 className={styles.name}>{name}</h1>
          {toBeatBlock}
          {rules}
          {mode === 'after-warmup' && props.next ? (
            <div className={mine.then}>
              <b>{t('play.test.then')}</b>
              <span>
                {t('play.test.thenMeta', {
                  count: props.next.count,
                  minutes: props.next.minutes,
                })}
              </span>
              <small>
                {t('play.test.thenWhy', {
                  muscles: new Intl.ListFormat(lang, { type: 'conjunction' }).format(
                    (exercise?.primaryMuscles ?? []).map((m) =>
                      t(`labels.muscle.${m}`).toLowerCase(),
                    ),
                  ),
                })}
              </small>
            </div>
          ) : null}
          {!ready ? <p className={styles.hint}>{t('play.test.restHint')}</p> : null}
          {fresh && hold ? <p className={styles.hint}>{t('play.fresh.warmup')}</p> : null}
        </div>
        <div className={`${styles.dock} ${mine.arriveDock}`}>
          {ready ? (
            <Button
              size="player"
              fullWidth
              icon="play"
              onClick={() => update((f, at) => startHold(f, at))}
            >
              <span className={mine.dockCol}>
                <span>{t('play.test.startClock')}</span>
                <small>{t('play.test.startClockSub')}</small>
              </span>
            </Button>
          ) : (
            <Button
              size="player"
              fullWidth
              icon="hourglass"
              onClick={() => update((f, at) => startRest(f, at))}
            >
              <span className={mine.dockCol}>
                <span>{t('play.test.startRest')}</span>
                <small>{t('play.test.startRestSub')}</small>
              </span>
            </Button>
          )}
          {!fresh ? (
            <Button variant="ghost" onClick={() => setSkipOpen(true)}>
              {t('play.test.skip')}
            </Button>
          ) : null}
        </div>
      </>
    );
  } else if (stage.kind === 'rest') {
    const seconds = restSeconds(flow, now);
    const total = Math.max(1, (stage.endsAt - stage.startedAt) / 1000);
    const ratio = Math.min(1, Math.max(0, seconds / total));
    const nextCard = (
      <div className={ring ? styles.ringNext : styles.restNext}>
        <span className={styles.restNextLabel}>{t('play.test.next')}</span>
        <span className={styles.restNextName}>{name}</span>
        <span className={styles.restNextRx}>
          {previousValue !== undefined
            ? t('play.test.toBeat', { value: valueText(kind, previousValue) })
            : t('play.test.firstTest')}
        </span>
      </div>
    );
    const controls = (
      <div className={styles.restCtrls}>
        <button
          type="button"
          className={styles.restBtn}
          aria-label={t('play.rest.less')}
          onClick={() => update((f, at) => adjustRest(f, -15, at))}
        >
          {t('play.rest.minus')}
        </button>
        <button
          type="button"
          className={styles.restBtn}
          aria-label={t('play.rest.more')}
          onClick={() => update((f, at) => adjustRest(f, 15, at))}
        >
          {t('play.rest.plus')}
        </button>
        <button
          type="button"
          className={`${styles.restBtn} ${ring ? styles.ringSkip : styles.restSkip}`}
          onClick={() => setFlow((f) => skipRest(f))}
        >
          {t('play.rest.skip')}
          <Icon name="skip" size={24} />
        </button>
      </div>
    );
    const doneLine = (
      <p className={styles.restDone}>
        <Icon name="check" size={20} />
        <span className={styles.restDoneText}>{t('play.test.restDone')}</span>
      </p>
    );
    body = ring ? (
      <div className={`${styles.restBody} ${mine.arrive}`}>
        {doneLine}
        <div
          className={styles.ring}
          role="timer"
          aria-label={t('play.test.rest', { count: seconds })}
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
            />
          </svg>
          <div className={styles.ringCenter}>
            <span className={`${styles.num} ${styles.ringN}`}>{seconds}</span>
            <span className={styles.ringU}>{t('play.rest.seconds')}</span>
          </div>
        </div>
        <div className={styles.ringGap} />
        {nextCard}
        {controls}
      </div>
    ) : (
      <div className={styles.restBody}>
        {doneLine}
        <div className={styles.restCenter}>
          <div
            className={styles.restTimer}
            role="timer"
            aria-label={t('play.test.rest', { count: seconds })}
          >
            <span className={styles.restN} data-digits={String(seconds).length}>
              {seconds}
            </span>
            <span className={styles.restU}>s</span>
          </div>
          <div className={styles.restBar} aria-hidden="true">
            <i style={{ width: `${ratio * 100}%` }} />
          </div>
        </div>
        {nextCard}
        {controls}
      </div>
    );
  } else if (stage.kind === 'set') {
    body = (
      <>
        <div className={`${styles.set} ${mine.arrive}`}>
          <h1 className={styles.name}>{name}</h1>
          <p className={mine.kicker}>{t('play.test.setKicker')}</p>
          <div className={styles.score}>
            <div className={styles.scoreCell}>
              <span className={`${styles.num} ${mine.max}`}>{t('play.set.max')}</span>
              <span className={styles.scoreU}>{t('play.test.unitReps')}</span>
            </div>
            <div className={styles.scoreCell}>
              {previousValue !== undefined ? (
                <>
                  <span className={`${styles.num} ${styles.scoreN} ${mine.beatSmall}`}>
                    {previousValue}
                  </span>
                  <span className={styles.scoreU}>{t('play.test.beat')}</span>
                </>
              ) : null}
            </div>
          </div>
          <p className={styles.hint}>{t('play.test.countHint')}</p>
          <AnimSlot
            glyph={glyphOf(exercise)}
            tag={exercise ? t(`labels.pattern.${exercise.pattern}`) : ''}
            cue={exercise?.keyCue[lang]}
          />
        </div>
        <div className={`${styles.dock} ${mine.arriveDock}`}>
          <div className={styles.dockRow}>
            <Button
              size="player"
              className={styles.dockDone}
              icon="check"
              onClick={() => update((f, at) => finishSet(f, at, prefill()))}
            >
              <span className={styles.dockDoneText}>
                <span>{t('play.test.done')}</span>
                <small>{t('play.test.doneSub')}</small>
              </span>
            </Button>
            {pencil}
          </div>
        </div>
      </>
    );
  } else if (stage.kind === 'lead-in') {
    body = (
      <>
        <div className={`${styles.set} ${mine.arrive}`}>
          <h1 className={styles.name}>{name}</h1>
          <div className={mine.center}>
            <span className={mine.kicker}>{t('play.test.leadIn')}</span>
            <span className={`${styles.num} ${mine.leadN}`} role="timer">
              {leadInSeconds(flow, now)}
            </span>
            <span className={styles.hint}>{t('play.test.leadInHint')}</span>
          </div>
        </div>
        <div className={`${styles.dock} ${mine.arriveDock}`}>
          <Button
            size="player"
            variant="secondary"
            fullWidth
            onClick={() => setFlow((f) => ({ ...f, stage: { kind: 'ready' } }))}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </>
    );
  } else if (stage.kind === 'running') {
    const held = heldSeconds(flow, now);
    const cap = testCap('time');
    const beaten = previousValue !== undefined && held > previousValue;
    body = (
      <>
        <div className={`${styles.set} ${mine.arrive}`}>
          <h1 className={styles.name}>{name}</h1>
          <p className={mine.kicker}>{t('play.test.holdKicker')}</p>
          <div className={mine.clockWrap}>
            <span className={`${styles.num} ${mine.clock}`} role="timer" aria-live="off">
              <Pulse fire={held >= cap - 3 && held < cap ? held : false}>
                {valueText('time', held)}
              </Pulse>
            </span>
            <div className={mine.capBar} aria-hidden="true">
              <i style={{ width: `${(held / cap) * 100}%` }} />
              {previousValue !== undefined ? (
                <b style={{ left: `${(previousValue / cap) * 100}%` }} />
              ) : null}
            </div>
            <p className={mine.capLabels}>
              <span>
                {previousValue !== undefined
                  ? t('play.test.beatTick', { value: valueText('time', previousValue) })
                  : ''}
              </span>
              <span>{t('play.test.capTick')}</span>
            </p>
            <p className={styles.hint}>
              {beaten ? (
                <span className={mine.beaten}>{t('play.test.beaten')}</span>
              ) : previousValue === undefined ? (
                t('play.test.firstHold')
              ) : (
                ''
              )}
            </p>
          </div>
        </div>
        <div className={`${styles.dock} ${mine.arriveDock}`}>
          <div className={styles.dockRow}>
            <Button
              size="player"
              className={styles.dockDone}
              icon="stop"
              onClick={() => update((f, at) => finishSet(f, at, 0))}
            >
              <span className={styles.dockDoneText}>
                <span>{t('play.test.stopClock')}</span>
                <small>{t('play.test.stopClockSub', { time: valueText('time', held) })}</small>
              </span>
            </Button>
            {pencil}
          </div>
        </div>
      </>
    );
  } else {
    const value = stage.value;
    const cap = testCap(kind);
    const diff = previousValue === undefined ? 0 : value - previousValue;
    const tag: ChangeTagData | undefined =
      previousValue === undefined
        ? undefined
        : diff === 0
          ? { icon: 'equals', text: t('play.test.tagSame') }
          : {
              icon: diff > 0 ? 'arrow-up' : 'arrow-down',
              text: hold
                ? t('play.test.tagSec', { count: Math.abs(diff) })
                : t('play.test.tagReps', { count: Math.abs(diff) }),
              srPrefix: t(diff > 0 ? 'adapt.detail.tag.srUp' : 'adapt.detail.tag.srDown'),
            };
    body = (
      <>
        <div className={`${styles.set} ${mine.entry} ${mine.arrive}`}>
          <p className={mine.kicker}>{t('play.test.entryKicker', { name })}</p>
          <h1 className={mine.entryTitle}>
            {t(hold ? 'play.test.entryTitleHold' : 'play.test.entryTitle')}
          </h1>
          <HeroStepper
            value={value}
            min={0}
            max={cap}
            text={valueText(kind, value)}
            {...(!hold && { unit: t('labels.unit.reps') })}
            label={t(hold ? 'play.test.entryTitleHold' : 'play.test.entryTitle')}
            decrementLabel={t('play.set.less')}
            incrementLabel={t('play.set.more')}
            onChange={(v) => setFlow((f) => setEntry(f, v))}
          />
          {previousValue !== undefined ? (
            <p className={mine.compare}>
              {tag ? <ChangeTag tag={tag} size="large" /> : null}
              <span>
                {diff === 0 ? (
                  t('play.test.vsSame')
                ) : (
                  <Rich text={t('play.test.vs', { value: valueText(kind, previousValue) })} />
                )}
              </span>
            </p>
          ) : null}
          {value >= cap ? (
            <p className={mine.capNote}>{t(hold ? 'play.test.capHold' : 'play.test.cap')}</p>
          ) : null}
          <p className={mine.note}>
            <Icon name="info" size={20} />
            <span>{t(`play.test.entryNote${hold ? 'Hold' : ''}${previous ? '' : 'First'}`)}</span>
          </p>
        </div>
        <div className={`${styles.dock} ${mine.arriveDock}`}>
          <Button size="player" fullWidth loading={busy} onClick={() => void save(value)}>
            <span className={mine.dockCol}>
              <span>{t('play.test.save')}</span>
              <small>{t('play.test.saveSub', { value: valueText(kind, value) })}</small>
            </span>
          </Button>
          <Button variant="ghost" onClick={() => setSkipOpen(true)}>
            {t('play.test.dontSave')}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {bar}
      <Fragment key={paused ? 'paused' : saved ? 'saved' : stage.kind}>{body}</Fragment>
      {skipDialog}
      {stopSheet}
    </>
  );
}

/** The entry's one control: the number is the hero, flanked by the two big buttons. */
function HeroStepper({
  value,
  min,
  max,
  text,
  unit,
  label,
  decrementLabel,
  incrementLabel,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  text: string;
  unit?: string;
  label: string;
  decrementLabel: string;
  incrementLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <div role="group" aria-label={label} className={mine.hstep}>
      <button
        type="button"
        className={mine.hstepBtn}
        aria-label={decrementLabel}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Icon name="minus" size={28} />
      </button>
      <output className={mine.hstepVal} aria-live="polite" aria-atomic="true">
        <span className={`${styles.num} ${mine.hstepNum} ${unit ? '' : mine.hstepTime}`}>
          <Roll value={text}>{text}</Roll>
        </span>
        {unit ? <small>{unit}</small> : null}
      </output>
      <button
        type="button"
        className={mine.hstepBtn}
        aria-label={incrementLabel}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Icon name="plus" size={28} />
      </button>
    </div>
  );
}

/** Stopping the test, for pain only: what was done is kept but never shown as a result. */
function StopSheet({
  open,
  onClose,
  kind,
  busy,
  held,
  onStop,
}: {
  open: boolean;
  onClose: () => void;
  kind: TestKind;
  busy: boolean;
  /** A hold in progress: the time so far is what is kept. */
  held: number | undefined;
  onStop: (value: number) => void;
}) {
  const { t } = useTranslation();
  const [reps, setReps] = useState(0);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('play.test.stopTitle')}
      description={t('play.test.stopPurpose')}
      footer={
        <>
          <Button
            variant="destructive"
            size="player"
            fullWidth
            icon="stop"
            loading={busy}
            onClick={() => onStop(kind === 'reps' ? reps : (held ?? 0))}
          >
            {t('play.test.stopConfirm')}
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('play.test.stopKeep')}
          </Button>
        </>
      }
    >
      <div className={mine.stopRow}>
        <div className={mine.painCard}>
          <Icon name="stop" size={24} />
          <span>
            <b>{t('play.test.stopPain')}</b>
            <small>{t('play.test.stopPainHint')}</small>
          </span>
        </div>
        {kind === 'reps' ? (
          <div>
            <span className={mine.fieldLabel}>{t('play.test.stopDone')}</span>
            <Stepper
              size="player"
              wide
              min={0}
              max={testCap('reps')}
              step={1}
              value={reps}
              onChange={setReps}
              label={t('play.test.stopDone')}
              decrementLabel={t('play.set.less')}
              incrementLabel={t('play.set.more')}
            />
          </div>
        ) : null}
        <p className={mine.note}>
          <Icon name="info" size={20} />
          <span>{t('play.test.painNote')}</span>
        </p>
      </div>
    </Sheet>
  );
}

/** What a saved result says about the one before it. */
function useVerdict(
  saved: Saved,
  programmes: readonly { id: string; generation?: { cycle?: number } }[],
) {
  const { t } = useTranslation();
  const { test, previous } = saved;
  const kind: TestKind = test.result.kind === 'reps' ? 'reps' : 'time';
  const value = resultValue(test);
  const before = previous ? resultValue(previous) : undefined;
  const verdict: TestVerdict = verdictOf(value, before);
  const key = verdictKey(verdict, test.context);
  const diff = before === undefined ? 0 : Math.abs(value - before);
  const amount = kind === 'reps' ? String(diff) : t('play.test.tagSec', { count: diff });
  const n = cycleOf(previous?.programmeId, programmes);
  const line =
    key === 'more'
      ? t(test.context === 'session' ? 'play.test.moreCycle' : 'play.test.moreFresh', {
          count: diff,
          amount,
          n,
        })
      : key === 'less'
        ? t('play.test.less', { count: diff, amount })
        : t(`play.test.${key}`);
  return { kind, value, before, verdict, line };
}

/** The result in a session: the number, what it says, and how to go on. */
function ResultView({
  saved,
  name,
  lang,
  programmes,
  programmeId,
  mode,
  next,
  onContinue,
}: {
  saved: Saved;
  name: string;
  lang: Language;
  programmes: readonly { id: string; generation?: { cycle?: number } }[];
  programmeId: string | undefined;
  mode: TestRunnerProps['mode'];
  next?: TestRunnerProps['next'];
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const { kind, value, before, verdict, line } = useVerdict(saved, programmes);
  const nextCycle = cycleOf(programmeId, programmes) + 1;
  const { previous } = saved;
  const figure = (
    <CompareFigure
      {...(before !== undefined && { from: valueText(kind, before) })}
      to={valueText(kind, value)}
      {...(kind === 'reps' && { unit: t('labels.unit.reps') })}
      {...(previous && { fromCaption: captionDate(previous.date, lang) })}
      toCaption={t('play.test.today')}
      size="medium"
      srText={
        before !== undefined
          ? t('play.test.srFigure', { from: valueText(kind, before), to: valueText(kind, value) })
          : t('play.test.srFirst', { to: valueText(kind, value) })
      }
    />
  );
  return (
    <>
      <div className={`${styles.set} ${mine.arrive}`}>
        <div className={mine.result} role="status">
          <p className={mine.kicker}>{t('play.test.saved')}</p>
          <h1 className={styles.name}>{name}</h1>
          <div className={mine.resultBig}>
            <span className={`${styles.num} ${mine.resultN}`}>
              {verdict === 'better' && before !== undefined ? (
                <CountUp from={before} to={value} format={(v) => valueText(kind, v)} />
              ) : (
                <Tick value={value}>{valueText(kind, value)}</Tick>
              )}
            </span>
            {kind === 'reps' ? <span className={mine.resultU}>{t('labels.unit.reps')}</span> : null}
          </div>
          <p className={mine.resultLine} data-verdict={verdict}>
            {line}
          </p>
          {before !== undefined ? figure : null}
          <p className={mine.note}>
            <Icon name="info" size={20} />
            <span>{t('play.test.feeds', { next: nextCycle })}</span>
          </p>
        </div>
      </div>
      <div className={`${styles.dock} ${mine.arriveDock}`}>
        <Button size="player" fullWidth onClick={onContinue}>
          {mode === 'after-warmup' && next ? (
            <span className={mine.dockCol}>
              <span>{t('play.test.continue')}</span>
              <small>{t('play.test.continueSub', { name: next.name })}</small>
            </span>
          ) : (
            t('play.test.toSummary')
          )}
        </Button>
      </div>
    </>
  );
}

/** The test on its own: the whole card, and that it changes nothing in the programme. */
function FreshSummary({
  saved,
  name,
  lang,
  onBack,
}: {
  saved: Saved;
  name: string;
  lang: Language;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { kind, value, before, verdict, line } = useVerdict(saved, []);
  const { previous, test } = saved;
  const diff = before === undefined ? 0 : value - before;
  const tag: ChangeTagData | undefined =
    before === undefined
      ? undefined
      : diff === 0
        ? { icon: 'equals', text: t('play.test.tagSame') }
        : {
            icon: diff > 0 ? 'arrow-up' : 'arrow-down',
            text:
              kind === 'time'
                ? t('play.test.tagSec', { count: Math.abs(diff) })
                : t('play.test.tagReps', { count: Math.abs(diff) }),
            srPrefix: t(diff > 0 ? 'adapt.detail.tag.srUp' : 'adapt.detail.tag.srDown'),
          };
  const logs = useMaxTests() ?? [];
  const mineTests = logs.filter((x) => x.exerciseId === test.exerciseId && !x.stopped);
  const since = mineTests[0]?.date;
  return (
    <>
      <div className={`${styles.set} ${mine.arrive}`}>
        <div className={mine.fresh} role="status">
          <h1 className={mine.entryTitle}>{t('play.fresh.title')}</h1>
          <TestResultCard
            kicker={t('play.test.kickerFresh')}
            name={name}
            headingLevel={2}
            figure={{
              ...(before !== undefined && { from: valueText(kind, before) }),
              to: valueText(kind, value),
              ...(kind === 'reps' && { unit: t('labels.unit.reps') }),
              ...(previous && { fromCaption: captionDate(previous.date, lang) }),
              toCaption: t('play.test.today'),
              ...(tag && { tag: <ChangeTag tag={tag} size="large" /> }),
              srText:
                before !== undefined
                  ? t('play.test.srFigure', {
                      from: valueText(kind, before),
                      to: valueText(kind, value),
                    })
                  : t('play.test.srFirst', { to: valueText(kind, value) }),
            }}
            line={<span data-verdict={verdict}>{line}</span>}
          />
          <p className={mine.note}>
            <Icon name="info" size={20} />
            <span>
              {t('play.fresh.notice')} {t('play.test.feedsFresh')}
            </span>
          </p>
          <button
            type="button"
            className={mine.freshRow}
            onClick={() => navigate({ name: 'tests' })}
          >
            <span>
              {t('play.fresh.allTests')}
              {since ? (
                <small>
                  {t('play.fresh.meta', {
                    name,
                    count: mineTests.length,
                    month: new Date(`${since}T12:00:00`).toLocaleDateString(lang, {
                      month: 'long',
                      year: 'numeric',
                    }),
                  })}
                </small>
              ) : null}
            </span>
            <Icon name="chev-right" size={24} />
          </button>
        </div>
      </div>
      <div className={`${styles.dock} ${mine.arriveDock}`}>
        <Button size="player" fullWidth onClick={onBack}>
          {t('play.fresh.back')}
        </Button>
      </div>
    </>
  );
}
