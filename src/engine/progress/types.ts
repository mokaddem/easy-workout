import type {
  Answer,
  AnswerKind,
  EquipmentInventory,
  Exercise,
  JointRegion,
  MaxTest,
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
  /** Max tests: a recent one can lift a goal. */
  maxTests?: readonly MaxTest[];
  inventory: EquipmentInventory;
  /**
   * Level and bodyweight for the starting load of an exercise swapped in; limitations, quiet and
   * small space for what may be offered or prescribed.
   */
  profile?: Pick<Profile, 'level' | 'bodyweightKg' | 'limitations' | 'quiet' | 'smallSpace'>;
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
  /** Pain: what adding a limitation offers on the card. */
  limitation?: LimitationOffer;
}

/** The "add to my limitations" option of a pain card. */
export interface LimitationOffer {
  /**
   * The joint the exercise is hardest on, ready to be ticked; absent when the exercise has no
   * grade (or every graded joint is already limited): the card shows a picker.
   */
  region?: JointRegion;
  /** Adding it takes the exercise out of the programme: the card is answered as a swap. */
  removes?: boolean;
  /** The swap that answer would make (the exercise's best substitute once the joint is limited). */
  substituteId?: string;
  /** Second stop on the exercise: this option is shown first. */
  first?: boolean;
}

/** A session ready to show or run: swaps and progression applied. */
export interface PreparedSession {
  session: Session;
  /** Why each changed exercise (`section/blockIndex/itemIndex`) is prescribed as it is. */
  notes: Record<string, ProgressionNote>;
  /** Exercises standing in for another one, by item key: the one they replace. */
  replaces: Record<string, string>;
  /** Swaps in force that a limitation, quiet or small space now rules out, by item key → the swap's target. */
  blockedSwaps: Record<string, string>;
  /** Exercises sparing a limited joint (`section/blockIndex/itemIndex`): never prescribed under 2 reps in reserve. */
  doseCapped: string[];
  proposals: Proposal[];
  /** Exercises at the end of their ladder with nothing harder to offer: buying would help. */
  buyNext: string[];
  /**
   * Back after a long break: the share of the usual volume the session runs at. Stored as
   * `adjustments.reentry` when the session starts, and the player's max test is skipped.
   */
  reentry?: number;
  /**
   * Prepared for a travel kit: what stood in for what and what was left out. Stored as
   * `adjustments.travel` when the session starts; no max test, and the sets prove nothing for home.
   */
  travel?: { substitutions: Record<string, string>; dropped: string[] };
}
