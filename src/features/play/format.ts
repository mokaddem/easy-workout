import type { TFunction } from 'i18next';
import { setLogKey } from '@/domain';
import type {
  EquipmentInventory,
  Exercise,
  Language,
  Load,
  SessionLog,
  SetLog,
  Target,
  EquipmentKind,
} from '@/domain';
import {
  equipmentCapabilities,
  implementOf,
  playSteps,
  resumeIndex,
  type PlayStep,
} from '@/engine';
import type { IconName } from '@/ui/components';
import type { PlayerState } from './machine';

export const numberText = (value: number, lang: Language): string =>
  new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value);

/** "8–10", "10" or "Max": the big number of a rep set. */
export function targetNumber(t: TFunction, target: Target): string {
  if (target.kind === 'reps')
    return target.min === target.max ? String(target.min) : `${target.min}–${target.max}`;
  if (target.kind === 'time')
    return target.minSec === target.maxSec
      ? String(target.minSec)
      : `${target.minSec}–${target.maxSec}`;
  if (target.kind === 'max') return t('play.set.max');
  return '';
}

export interface LoadParts {
  /** The number, with its unit wording below it. */
  value?: string;
  unit?: string;
  /** A load said in words (a band, bodyweight). */
  word?: string;
}

/** What the load cell of a set shows. */
export function loadParts(
  t: TFunction,
  lang: Language,
  load: Load | undefined,
  exercise: Exercise | undefined,
  inventory: EquipmentInventory,
): LoadParts {
  if (!load) return {};
  switch (load.kind) {
    case 'kg': {
      const implement = exercise && implementOf(exercise, equipmentCapabilities(inventory));
      const unit =
        implement?.count === 2
          ? implement.kind === 'dumbbell'
            ? t('play.set.perDumbbell')
            : t('play.set.perKettlebell')
          : t('labels.unit.kg');
      return { value: numberText(load.kg, lang), unit };
    }
    case 'added-kg':
      return { value: `+${numberText(load.kg, lang)}`, unit: t('play.set.added') };
    case 'band':
      return { word: t(`labels.bandLoad.${load.level}`) };
    case 'bodyweight':
      return { word: t('play.set.bodyweight') };
  }
}

/** The load as a short phrase for the done button: "14 kg", "+10 kg", the band. */
export function loadShort(
  t: TFunction,
  lang: Language,
  load: Load | undefined,
): string | undefined {
  if (!load || load.kind === 'bodyweight') return undefined;
  if (load.kind === 'band') return t(`labels.bandLoad.${load.level}`);
  const kg = `${load.kind === 'added-kg' ? '+' : ''}${numberText(load.kg, lang)} ${t('labels.unit.kg')}`;
  return kg;
}

/** "10 reps at 14 kg" — what a tap on Done records. */
export function repsAt(
  t: TFunction,
  lang: Language,
  reps: number | undefined,
  load: Load | undefined,
): string {
  const repsText = reps === undefined ? '' : t('play.repsCount', { count: reps });
  const loadText = loadShort(t, lang, load);
  if (!loadText) return repsText;
  if (!repsText) return loadText;
  return load?.kind === 'band' ? `${repsText} · ${loadText}` : `${repsText}, ${loadText}`;
}

/** mm:ss, or h:mm:ss past an hour. */
export function clockText(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const GLYPH: Partial<Record<EquipmentKind, IconName>> = {
  dumbbell: 'dumbbell',
  kettlebell: 'kettlebell',
  band: 'band',
  'mini-band': 'miniband',
  'pull-up-bar': 'bar',
  bench: 'bench',
  treadmill: 'treadmill',
  'weight-belt': 'belt',
  'dip-bars': 'dips',
  'jump-rope': 'rope',
  'ab-wheel': 'wheel',
  'stationary-bike': 'bike',
  rower: 'rower',
  'weight-vest': 'vest',
  'suspension-trainer': 'straps',
};

export const glyphOf = (exercise: Exercise | undefined): IconName =>
  (exercise && GLYPH[exercise.equipment[0]?.[0]?.kind as EquipmentKind]) || 'person-run';

export interface StepProgress {
  section: 'warmup' | 'main' | 'finisher';
  /** 1-based position among the exercises counted together. */
  current: number;
  total: number;
}

/** Where an exercise stands: among the warm-up items, or among the session's exercises. */
export function progressOf(steps: readonly PlayStep[], step: PlayStep): StepProgress {
  const warmup = steps.filter((s) => s.section === 'warmup');
  const warmupCount = warmup.length > 0 ? warmup[warmup.length - 1]!.exercise + 1 : 0;
  const last = steps[steps.length - 1]?.exercise ?? 0;
  if (step.section === 'warmup')
    return { section: 'warmup', current: step.exercise + 1, total: warmupCount };
  return {
    section: step.section,
    current: step.exercise - warmupCount + 1,
    total: last + 1 - warmupCount,
  };
}

/** Reps of the last set of this exercise (same side) logged earlier in the session. */
export function previousReps(
  sets: readonly SetLog[],
  step: PlayStep,
): { set: number; reps: number } | undefined {
  const earlier = sets
    .filter(
      (set) =>
        set.section === step.section &&
        set.blockIndex === step.blockIndex &&
        set.itemIndex === step.itemIndex &&
        set.side === step.side &&
        set.set < step.set &&
        set.actual?.reps !== undefined,
    )
    .sort((a, b) => a.set - b.set);
  const last = earlier[earlier.length - 1];
  return last && { set: last.set, reps: last.actual!.reps! };
}

export const exerciseLabel = (exercise: Exercise | undefined, lang: Language, id: string): string =>
  exercise?.name[lang] ?? id;

/** The big number of a set and the word under it: "45–60 seconds", "15 reps", "Max reps". */
export function targetCell(t: TFunction, target: Target): { n: string; unit: string } {
  switch (target.kind) {
    case 'time':
      return { n: targetNumber(t, target), unit: t('play.set.unitSeconds') };
    case 'cardio':
      return {
        n:
          target.minMinutes === target.maxMinutes
            ? String(target.minMinutes)
            : `${target.minMinutes}–${target.maxMinutes}`,
        unit: t('play.cardio.minutes'),
      };
    case 'interval':
      return { n: String(target.rounds), unit: t('play.cardio.rounds2') };
    default:
      return { n: targetNumber(t, target), unit: t('play.set.reps') };
  }
}

/** What a set asks, as a short phrase: "10–12 reps, 8 kg", "45–60 s". */
export function rxText(
  t: TFunction,
  lang: Language,
  target: Target,
  load: Load | undefined,
): string {
  if (target.kind === 'time') return `${targetNumber(t, target)} ${t('play.timed.unit')}`;
  if (target.kind === 'reps' || target.kind === 'max') {
    const reps =
      target.kind === 'max'
        ? t('play.set.max')
        : `${targetNumber(t, target)} ${t('play.set.reps')}`;
    const loadText = loadShort(t, lang, load);
    return loadText ? `${reps}, ${loadText}` : reps;
  }
  return '';
}

/** " at 5 km/h, 1%": the settings of one cardio phase. */
export function phaseAt(
  t: TFunction,
  lang: Language,
  speed: number | undefined,
  incline: number | undefined,
): string {
  const parts = [
    speed !== undefined ? t('play.cardio.atSpeed', { speed: numberText(speed, lang) }) : '',
    incline !== undefined ? t('play.cardio.pct', { pct: numberText(incline, lang) }) : '',
  ];
  if (!parts[0]) return parts[1] ? ` ${parts[1]}` : '';
  return parts[1] ? `${parts[0]}, ${parts[1]}` : parts[0];
}

/** Whole minutes and seconds: "08:24". Past an hour it keeps counting minutes. */
export function minutesClock(totalSec: number): { m: string; s: string } {
  const sec = Math.max(0, Math.floor(totalSec));
  return {
    m: String(Math.floor(sec / 60)).padStart(2, '0'),
    s: String(sec % 60).padStart(2, '0'),
  };
}

/** Seconds a running timer has run, frozen while the session is paused. */
export function timerElapsed(state: PlayerState, now: number): number {
  const phase = state.phase;
  if (phase.kind !== 'timing') return 0;
  return Math.max(0, ((state.pausedAt ?? now) - phase.startedAt) / 1000);
}

/** The letter of an item of a group: a, b, c. */
export const itemLetter = (index: number): string => String.fromCharCode(97 + index);

/** Groups of the set strip: one per main block, with its planned sets and those performed. */
export function stripGroups(
  log: Pick<SessionLog, 'plan' | 'adjustments' | 'sets'>,
): { total: number; done: number }[] {
  const performed = new Set(log.sets.filter((set) => set.actual && !set.flag).map(setLogKey));
  const groups = new Map<number, { total: number; units: Map<string, boolean> }>();
  for (const step of playSteps(log.plan, log.adjustments)) {
    if (step.section !== 'main') continue;
    const group = groups.get(step.blockIndex) ?? { total: 0, units: new Map() };
    const unit = `${step.itemIndex}/${step.set}`;
    const ok = performed.has(setLogKey(step));
    group.units.set(unit, (group.units.get(unit) ?? true) && ok);
    groups.set(step.blockIndex, group);
  }
  return [...groups.values()].map((group) => ({
    total: group.units.size,
    done: [...group.units.values()].filter(Boolean).length,
  }));
}

/** The step an open session picks up at: the first with no set logged. */
export function pickUpStep(
  log: Pick<SessionLog, 'plan' | 'adjustments' | 'sets'>,
): PlayStep | undefined {
  const steps = playSteps(log.plan, log.adjustments);
  return steps[resumeIndex(steps, log.sets)];
}

/** Main sets accounted for over main sets planned, for the banner line. */
export function mainSetCounts(log: Pick<SessionLog, 'plan' | 'adjustments' | 'sets'>): {
  done: number;
  total: number;
} {
  const groups = stripGroups(log);
  return {
    done: groups.reduce((n, g) => n + g.done, 0),
    total: groups.reduce((n, g) => n + g.total, 0),
  };
}

/** "1 h 47" from 100 minutes up, whole minutes below. */
export function durationParts(totalSec: number): { value: string; unit: 'min' | null } {
  const minutes = Math.round(totalSec / 60);
  if (minutes < 100) return { value: String(minutes), unit: 'min' };
  const h = Math.floor(minutes / 60);
  return { value: `${h} h ${String(minutes % 60).padStart(2, '0')}`, unit: null };
}

export const OPEN_TOO_LONG_MS = 12 * 3_600_000;

/** An open session untouched for more than 12 hours: finished by hand, never by itself. */
export function leftOpenTooLong(
  log: Pick<SessionLog, 'startedAt' | 'sets' | 'pausedAt' | 'live'>,
  now: number,
): boolean {
  const last = Math.max(Date.parse(log.startedAt), ...log.sets.map((set) => Date.parse(set.at)));
  return now - last > OPEN_TOO_LONG_MS;
}
