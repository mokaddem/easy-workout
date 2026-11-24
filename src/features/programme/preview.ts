import { exerciseById } from '@/catalogue';
import type {
  EquipmentInventory,
  GenerationNote,
  JointRegion,
  Profile,
  Programme,
  SessionLog,
} from '@/domain';
import {
  applySwaps,
  carryEdits,
  constraintsOf,
  cycleInputs,
  fitFor,
  generateProgramme,
  isConstrained,
  loggedLifts,
  outCause,
  programmeChanges,
  repickInPlace,
  type CarriedEdit,
  type Constraints,
  type Issue,
  type SlotChange,
  type Swaps,
} from '@/engine';

/**
 * `variant` / `new`: another programme replaces the current one. `constraints`: the same
 * programme re-picked in place for changed joints, quiet or small space (the profile handed to
 * the preview carries the new constraints).
 */
export type PreviewMode = 'variant' | 'new' | 'constraints';

/** Why a slot or an exercise is affected: a limited joint, quiet or small space. */
export type Cause = { cause: 'region'; regions: JointRegion[] } | { cause: 'quiet' | 'space' };

/** A user's own pick the new constraints advise against; it stays. */
export interface OutEditNote {
  sessionId: string;
  exerciseId: string;
  cause: Cause;
}

/** A swap the user chose that the new constraints set aside. */
export interface BlockedSwapNote {
  sessionId: string;
  /** The exercise the swap pointed to. */
  exerciseId: string;
  cause: Cause;
}

export interface VolumeNote {
  muscle: string;
  before: number;
  after: number;
  regions: JointRegion[];
}

/** What an in-place re-pick adds to the preview. */
export interface InPlaceData {
  /** Why each removed slot is gone, by `sessionId|slot`. */
  causes: Record<string, Cause>;
  volume: VolumeNote[];
  outEdits: OutEditNote[];
  blockedSwaps: BlockedSwapNote[];
  /** Joints being added / lifted, against what the programme was picked for. */
  added: JointRegion[];
  lifted: JointRegion[];
}

/** The programme that would replace the current one, from the same inputs or the current profile. */
export function nextProgramme(
  mode: PreviewMode,
  current: Programme,
  profile: Profile,
  equipment: EquipmentInventory,
  logs: readonly SessionLog[] = [],
): Programme {
  const generation = current.generation;
  // A later cycle stays that cycle: same number, same rotation away from the previous one. Lifts
  // it keeps that the user has logged start from what was lifted, not from an estimate.
  const cycle = cycleInputs(generation);
  const logged = cycle.lastCycle ? loggedLifts(Object.values(cycle.lastCycle), logs) : [];
  const known = logged.length > 0 ? { loggedExercises: logged } : {};
  return mode === 'variant' && generation
    ? generateProgramme({
        profile: generation.profile,
        equipment: generation.equipment,
        seed: generation.seed + 1,
        ...cycle,
        ...known,
      })
    : generateProgramme({ profile, equipment, seed: 0, ...cycle, ...known });
}

export interface PreviewData {
  /** What replaces the current programme: the generation with the user's changes carried over. */
  next: Programme;
  /** Generator changes only: the user's own edits are not counted. */
  changes: SlotChange[];
  splitChanged: boolean;
  sizeChanged: boolean;
  oldSize: number;
  /** Present when the programme has edits or placements. */
  ledger: { kept: CarriedEdit[]; dropped: CarriedEdit[] } | null;
  /** Warnings about the sessions the user's changes were carried into, by session id. */
  issues: Record<string, Issue[]>;
  /** Only in `constraints` mode. */
  inPlace?: InPlaceData;
}

/** The programme has changes of the user's to carry over. */
export const hasUserEdits = (programme: Programme): boolean =>
  Boolean(programme.generatedRotation) || Object.keys(programme.placements ?? {}).length > 0;

export function previewData(
  mode: PreviewMode,
  current: Programme,
  profile: Profile,
  equipment: EquipmentInventory,
  customIds: ReadonlySet<string> = new Set(),
  painful: ReadonlySet<string> = new Set(),
  logs: readonly SessionLog[] = [],
  swaps?: Swaps,
): PreviewData {
  if (mode === 'constraints') return inPlaceData(current, profile, customIds, painful, logs, swaps);
  const generated = nextProgramme(mode, current, profile, equipment, logs);
  // Measured against the generation, not the user's edited rotation.
  const before: Programme = current.generatedRotation
    ? { ...current, rotation: current.generatedRotation }
    : current;
  const carried = hasUserEdits(current)
    ? carryEdits(
        current,
        generated,
        {
          profile: generated.generation?.profile ?? profile,
          inventory: generated.generation?.equipment ?? equipment,
          exercises: exerciseById,
        },
        customIds,
        { painful },
      )
    : null;
  return {
    next: carried?.programme ?? generated,
    changes: programmeChanges(before, generated),
    splitChanged:
      current.rotation.map((s) => s.id).join('|') !== generated.rotation.map((s) => s.id).join('|'),
    sizeChanged: current.rotation.length !== generated.rotation.length,
    oldSize: current.rotation.length,
    ledger: carried ? { kept: carried.kept, dropped: carried.dropped } : null,
    issues: carried?.issues ?? {},
  };
}

const slotBase = (slot: string): string => slot.replace(/-\d+$/, '');

const causeOf = (c: ReturnType<typeof outCause>): Cause | undefined =>
  !c
    ? undefined
    : c.cause === 'region'
      ? { cause: 'region', regions: [c.region] }
      : { cause: c.cause === 'quiet' ? 'quiet' : 'space' };

/** The slot-limited notes of a generation, by `sessionId|slot`. */
function removalCauses(next: Programme): Record<string, Cause> {
  const out: Record<string, Cause> = {};
  for (const n of next.generation?.notes ?? []) {
    if (n.code !== 'slot-limited' || !n.ref?.sessionId) continue;
    const slot = slotBase(String(n.params.slot));
    const cause = String(n.params.cause);
    out[`${n.ref.sessionId}|${slot}`] =
      cause === 'region'
        ? { cause: 'region', regions: [String(n.params.region) as JointRegion] }
        : { cause: cause === 'quiet' ? 'quiet' : 'space' };
  }
  return out;
}

const regionsOf = (list: unknown): JointRegion[] =>
  String(list ?? '')
    .split(',')
    .filter(Boolean) as JointRegion[];

const volumeNotes = (notes: readonly GenerationNote[] | undefined): VolumeNote[] =>
  (notes ?? [])
    .filter((n) => n.code === 'muscle-volume-reduced')
    .map((n) => ({
      muscle: String(n.params.muscle),
      before: Number(n.params.before),
      after: Number(n.params.after),
      regions: regionsOf(n.params.regions),
    }));

const sameVolume = (a: VolumeNote, b: VolumeNote) =>
  a.muscle === b.muscle &&
  a.before === b.before &&
  a.after === b.after &&
  a.regions.join() === b.regions.join();

/**
 * The programme re-picked in place for the constraints of `profile`, with what the preview says
 * about it: causes of removed slots, fewer sets for a muscle, the user's own picks that are now
 * advised against, and swaps set aside. Only what is new against the current programme is listed.
 */
export function inPlaceData(
  current: Programme,
  profile: Profile,
  customIds: ReadonlySet<string> = new Set(),
  painful: ReadonlySet<string> = new Set(),
  logs: readonly SessionLog[] = [],
  swaps?: Swaps,
): PreviewData {
  const repick = repickInPlace(current, profile, { customIds, painful, logs });
  const before: Constraints = constraintsOf(current.generation?.profile);
  const after: Constraints = constraintsOf(profile);
  const was = volumeNotes(current.generation?.notes);

  const outEdits = repick.outEdits.flatMap((o): OutEditNote[] => {
    const exercise = exerciseById.get(o.exerciseId);
    if (!exercise || fitFor(exercise, before) === 'out') return [];
    const cause = causeOf(outCause(exercise, after));
    return cause ? [{ sessionId: o.sessionId, exerciseId: o.exerciseId, cause }] : [];
  });

  const blockedSwaps: BlockedSwapNote[] = [];
  const generation = repick.programme.generation;
  if (swaps && swaps.to.size > 0 && generation) {
    const level = generation.profile.level;
    const context = (constraints: Constraints) => ({
      inventory: generation.equipment,
      level,
      ...(generation.profile.bodyweightKg !== undefined && {
        bodyweightKg: generation.profile.bodyweightKg,
      }),
      ...(isConstrained(constraints) && { constraints }),
    });
    for (const session of repick.programme.rotation) {
      const now = applySwaps(session, swaps, context(after)).blocked;
      const earlier = applySwaps(session, swaps, context(before)).blocked;
      for (const [key, exerciseId] of Object.entries(now)) {
        if (earlier[key] === exerciseId) continue;
        const exercise = exerciseById.get(exerciseId);
        const cause = exercise && causeOf(outCause(exercise, after));
        if (cause) blockedSwaps.push({ sessionId: session.id, exerciseId, cause });
      }
    }
  }

  return {
    next: repick.programme,
    changes: repick.changes,
    splitChanged: false,
    sizeChanged: false,
    oldSize: current.rotation.length,
    ledger: repick.ledger,
    issues: repick.issues,
    inPlace: {
      causes: removalCauses(repick.programme),
      volume: volumeNotes(repick.programme.generation?.notes).filter(
        (v) => !was.some((w) => sameVolume(w, v)),
      ),
      outEdits,
      blockedSwaps,
      added: after.regions.filter((r) => !before.regions.includes(r)),
      lifted: before.regions.filter((r) => !after.regions.includes(r)),
    },
  };
}
