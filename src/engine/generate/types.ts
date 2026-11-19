import type {
  EquipmentInventory,
  Exercise,
  GenerationNote,
  Level,
  LocalizedText,
  MovementPattern,
  Muscle,
  NoteRef,
  Profile,
  Tempo,
} from '../../domain';

/**
 * What a slot is for. It drives hard filters, how candidates are ranked and how
 * goal and level change the dose.
 */
export type SlotRole =
  'main' | 'secondary' | 'accessory' | 'isolation' | 'core' | 'burnout' | 'warmup' | 'conditioning';

/** Reps as a range, or as many as possible. */
export type RepsSpec = readonly [number, number] | 'max';

export interface SlotSpec {
  /** Stable within its template, used in notes and for tie-breaking. */
  id: string;
  role: SlotRole;
  /** Accepted movement patterns, best first. */
  patterns: readonly MovementPattern[];
  /** Used only when nothing in `patterns` can be filled. */
  fallbackPatterns?: readonly MovementPattern[];
  tag?: 'compound' | 'isolation';
  /** Candidates training one of these as a primary muscle rank first. */
  muscles?: readonly Muscle[];
  /** Hand-picked exercises, best first. */
  prefer?: readonly string[];
  /** Set by the builder for a slot inside a superset or circuit. */
  grouped?: boolean;
  /** Dose for rep-based exercises; an exercise counted in reps needs it. */
  reps?: RepsSpec;
  /** Dose for timed exercises, in seconds; a timed exercise needs it. */
  time?: readonly [number, number];
  rir?: number;
  tempo?: Tempo;
}

/** Steady cardio, resolved to the best machine (or a bodyweight fallback) the user has. */
export interface CardioSpec {
  minutes: readonly [number, number];
  /** Treadmill settings, clamped to the machine's limits. */
  speedKmh?: number;
  inclinePct?: number;
}

/** 1 = always, 2 = dropped first when time is short, 3 = only added when time allows. */
export type Priority = 1 | 2 | 3;

interface BlockOptions {
  priority?: Priority;
  /** The time fit may shorten this block but never drops it (e.g. the week's core work). */
  keep?: boolean;
  /** Kept the same way in weeks of at most this many days, where nothing else does its job. */
  keepUpToDays?: number;
  /** Under 30-minute sessions, this straight block holds another slot (the week stays balanced). */
  shortSlot?: SlotSpec;
}

export type BlockTemplate = BlockOptions &
  (
    | { type: 'straight'; slot: SlotSpec; sets: number; restSec: number }
    | {
        type: 'group';
        style: 'superset' | 'circuit';
        slots: readonly SlotSpec[];
        rounds: number;
        restAfterRoundSec: number;
        restBetweenItemsSec?: number;
      }
    | { type: 'cardio'; cardio: CardioSpec }
  );

export type TemplateKey =
  | 'push'
  | 'pull'
  | 'lower-core'
  | 'upper-density'
  | 'lower-metabolic'
  | 'cardio'
  | 'upper-a'
  | 'upper-b'
  | 'lower-a'
  | 'lower-b'
  | 'full-a'
  | 'full-b'
  | 'full-c'
  | 'core';

export interface SessionTemplate {
  key: TemplateKey;
  /** Title after the session letter, e.g. "Push". */
  title: LocalizedText;
  focus?: LocalizedText;
  warmup: readonly BlockTemplate[];
  main: readonly BlockTemplate[];
  finisher: readonly BlockTemplate[];
}

export interface GenerateInput {
  profile: Profile;
  equipment: EquipmentInventory;
  /** Breaks ties between equally good candidates; 0 keeps the default order. */
  seed?: number;
  /** Which cycle this programme is (1 when absent): later cycles no longer teach the movements. */
  cycle?: number;
  /**
   * The previous cycle's picks, by `sessionId/slotId`. Main and secondary slots keep theirs when
   * they still fit (a new level changes the dose, not the lifts); in slots a seed may vary,
   * another equally good exercise is picked when there is one.
   */
  lastCycle?: Readonly<Record<string, string>>;
  /** The equipment last cycle was made for: where new equipment changes a slot's pick, it wins. */
  lastCycleEquipment?: EquipmentInventory;
  /** Exercise → the harder variant that replaces it wherever it would be picked. */
  upgrades?: Readonly<Record<string, string>>;
  /**
   * Exercises the user has logged sets of. Their working load comes from what was lifted, so a
   * kept lift needs no owned weight near the starting-load estimate.
   */
  loggedExercises?: readonly string[];
  /** Defaults to a name derived from the inputs. */
  id?: string;
}

/** Collects notes while generating, with the location they apply to. */
export class NoteLog {
  readonly notes: GenerationNote[] = [];

  add(code: string, params: GenerationNote['params'] = {}, ref?: NoteRef): void {
    this.notes.push(ref === undefined ? { code, params } : { code, params, ref });
  }
}

export interface Context {
  level: Level;
  profile: Profile;
  equipment: EquipmentInventory;
  catalogue: ReadonlyMap<string, Exercise>;
  seed: number;
  cycle: number;
  /** Last cycle's picks that stay (the slots equipment changes did not release). */
  lastCycle: ReadonlyMap<string, string>;
  /** Every one of last cycle's picks, kept or not: the reference for the one-step limit. */
  lastPicks: ReadonlyMap<string, string>;
  /** Exercises with logged history. */
  logged: ReadonlySet<string>;
  upgrades: ReadonlyMap<string, string>;
  log: NoteLog;
}
