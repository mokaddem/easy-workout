import type {
  Answer,
  AnswerKind,
  EquipmentInventory,
  Exercise,
  Profile,
  Programme,
  ProgressionNote,
  Session,
  SessionLog,
} from '../../domain';

/** Everything progression reads. Nothing here is written by it. */
export interface ProgressContext {
  /** Every session log; only finished programme sessions count as evidence. */
  logs: readonly SessionLog[];
  /** Programmes the logs belong to, archived ones included, to know each week's phase. */
  programmes: readonly Programme[];
  answers: readonly Answer[];
  inventory: EquipmentInventory;
  /** Level and bodyweight for the starting load of an exercise swapped in. */
  profile?: Pick<Profile, 'level' | 'bodyweightKg'>;
  now: Date;
  exercises?: ReadonlyMap<string, Exercise>;
}

/** Something the user is asked to decide about an exercise. */
export interface Proposal {
  kind: AnswerKind;
  exerciseId: string;
  /** The session whose sets raised it. */
  logId: string;
  /** The exercise offered in its place, when there is one. */
  substituteId?: string;
  /** Pain: the lighter prescription already applied while the proposal waits. */
  lighter?: ProgressionNote;
  /** Pain: the exercise hurt more than once lately, so "keep" isn't offered. */
  repeated?: boolean;
}

/** A session ready to show or run: swaps and progression applied. */
export interface PreparedSession {
  session: Session;
  /** Why each changed exercise (`section/blockIndex/itemIndex`) is prescribed as it is. */
  notes: Record<string, ProgressionNote>;
  /** Exercises standing in for another one, by item key: the one they replace. */
  replaces: Record<string, string>;
  proposals: Proposal[];
  /** Exercises at the end of their ladder with nothing harder to offer: buying would help. */
  buyNext: string[];
}
