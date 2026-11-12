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
  log: NoteLog;
}
