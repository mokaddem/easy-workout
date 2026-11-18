import { useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { exerciseById } from '@/catalogue';
import type { Language, Settings, Tempo } from '@/domain';
import type { PlayStep } from '@/engine';
import { cuesBetween, type Reading } from './cues';
import type { PlayerState } from './machine';

/** What a voice cue says for a set: the exercise, which set, the side, the target and the load. */
export function announcement(step: PlayStep, t: TFunction, lang: Language): string {
  const name = exerciseById.get(step.item.exerciseId)?.name[lang] ?? step.item.exerciseId;
  const where =
    step.section === 'warmup'
      ? t('voice.warmup', { name })
      : t(step.block.type === 'group' ? 'voice.round' : 'voice.set', {
          name,
          set: step.set,
          sets: step.sets,
        });
  const parts = [where];
  if (step.side) parts.push(t(`voice.side.${step.side}`));

  const target = step.planned.target;
  const goal = step.planned.goal;
  // A set with a goal announces it: that is what "done as planned" will log.
  const what =
    goal !== undefined && target.kind === 'reps'
      ? t('voice.reps', { count: goal })
      : goal !== undefined && target.kind === 'time'
        ? t('voice.seconds', { count: goal })
        : target.kind === 'reps'
          ? target.min === target.max
            ? t('voice.reps', { count: target.min })
            : t('voice.repRange', { min: target.min, max: target.max })
          : target.kind === 'max'
            ? t('voice.max')
            : target.kind === 'time'
              ? target.minSec === target.maxSec
                ? t('voice.seconds', { count: target.maxSec })
                : t('voice.secondRange', { min: target.minSec, max: target.maxSec })
              : target.kind === 'cardio'
                ? target.minMinutes === target.maxMinutes
                  ? t('voice.minutes', { count: target.maxMinutes })
                  : t('voice.minuteRange', { min: target.minMinutes, max: target.maxMinutes })
                : t('voice.intervals', { rounds: target.rounds, work: target.workSec });

  const load = step.planned.load;
  const kg = (value: number) => value.toLocaleString(lang);
  const how =
    load?.kind === 'kg'
      ? t('voice.kg', { kg: kg(load.kg) })
      : load?.kind === 'added-kg'
        ? t('voice.addedKg', { kg: kg(load.kg) })
        : load?.kind === 'band'
          ? t('voice.band', { level: t(`labels.band.${load.level}`).toLowerCase() })
          : '';
  const joiner = load?.kind === 'band' ? ', ' : ' ';
  parts.push(how ? `${what}${joiner}${how}.` : `${what}.`);
  return parts.join(' ');
}

let audio: AudioContext | undefined;

/** Sound can only start from a tap (iOS): call this from one, e.g. Start or Done. */
export function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    // No Web Audio: the player stays silent.
  }
}

const TONES = {
  /** Last seconds of a countdown. */
  tick: { hz: 880, seconds: 0.12, volume: 0.5 },
  /** A countdown ran out. */
  go: { hz: 1320, seconds: 0.45, volume: 0.5 },
  /** Tempo phase change: soft, so it can run through a whole set. */
  tempo: { hz: 660, seconds: 0.07, volume: 0.25 },
} as const;

export function beep(kind: keyof typeof TONES): void {
  if (!audio || audio.state !== 'running') return;
  const start = audio.currentTime;
  const { hz, seconds: length, volume } = TONES[kind];
  const tone = audio.createOscillator();
  const gain = audio.createGain();
  tone.type = 'sine';
  tone.frequency.value = hz;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  tone.connect(gain).connect(audio.destination);
  tone.start(start);
  tone.stop(start + length + 0.02);
}

/** Phones without the Vibration API (iPhone) can't vibrate at all. */
export const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function vibrate(pattern: number | number[]): void {
  if (canVibrate()) navigator.vibrate(pattern);
}

/** Says `text` with a voice of the language; stays quiet when the device has none for it. */
export function speak(text: string, lang: Language): void {
  const synth = globalThis.speechSynthesis;
  if (!synth) return;
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang));
  // Voices load late on some browsers: with none listed yet, let the browser pick by language.
  if (voices.length > 0 && !voice) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? (lang === 'fr' ? 'fr-FR' : 'en-GB');
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

/** Beeps, vibration and voice for the player, each behind its own setting. */
export function useSignals(
  state: PlayerState,
  now: number,
  settings: Pick<Settings, 'voice' | 'sounds' | 'vibration'> | undefined,
  describe: (index: number) => string,
  lang: Language,
): void {
  const previous = useRef<Reading | null>(null);
  const latest = useRef({ settings, describe, lang });
  useEffect(() => {
    latest.current = { settings, describe, lang };
  });

  useEffect(() => {
    const next: Reading = { state, now };
    const before = previous.current;
    previous.current = next;
    const { settings: on, describe: say, lang: language } = latest.current;
    if (!on) return;
    const cues = before
      ? cuesBetween(before, next)
      : state.phase.kind === 'set' && state.pausedAt === undefined
        ? [{ kind: 'announce' as const, index: state.index }]
        : [];
    for (const cue of cues) {
      if (cue.kind === 'tick') {
        if (on.sounds) beep('tick');
      } else if (cue.kind === 'go') {
        if (on.sounds) beep('go');
        if (on.vibration) vibrate(250);
      } else if (on.voice) speak(say(cue.index), language);
    }
  }, [state, now]);
}

export type TempoPhase = 'down' | 'pause' | 'up';

/** Where a rep stands after `elapsed` seconds of pacing: rep number (1-based) and phase. */
export function tempoPosition(tempo: Tempo, elapsed: number): { rep: number; phase: TempoPhase } {
  const cycle = tempo.down + tempo.pause + tempo.up;
  if (cycle <= 0) return { rep: 1, phase: 'down' };
  const into = elapsed % cycle;
  const phase: TempoPhase =
    into < tempo.down ? 'down' : into < tempo.down + tempo.pause ? 'pause' : 'up';
  return { rep: Math.floor(elapsed / cycle) + 1, phase };
}

export interface TempoPacer {
  running: boolean;
  /** Wall-clock start of the pacing (ms), when it runs. */
  startedAt: number | null;
  rep: number;
  phase: TempoPhase;
  toggle: () => void;
}

/** Paces reps to a tempo once started: the phase moves on with a soft tone (when sounds are on). */
export function useTempoPacer(tempo: Tempo | undefined, sounds: boolean): TempoPacer {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastPhase = useRef<string | null>(null);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [startedAt]);

  const running = startedAt !== null && tempo !== undefined;
  const position = running
    ? tempoPosition(tempo, Math.max(0, (now - startedAt) / 1000))
    : { rep: 1, phase: 'down' as const };
  const key = running ? `${position.rep}/${position.phase}` : null;

  useEffect(() => {
    if (key !== null && lastPhase.current !== null && key !== lastPhase.current && sounds)
      beep('tempo');
    lastPhase.current = key;
  }, [key, sounds]);

  return {
    running,
    startedAt: running ? startedAt : null,
    ...position,
    toggle: () => {
      unlockAudio();
      const at = Date.now();
      setNow(at);
      setStartedAt((current) => (current === null ? at : null));
    },
  };
}

/** Keeps the screen on while `active`, taking the lock back whenever the page shows again. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let done = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (done) void sentinel.release();
      } catch {
        // Refused (battery saver, unsupported in this context): the screen may sleep.
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release();
    };
  }, [active]);
}
