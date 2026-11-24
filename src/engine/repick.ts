import { exerciseById } from '../catalogue';
import type { Exercise, Phase, PhaseAdjustment, Profile, Programme, SessionLog } from '../domain';
import type { Issue } from './edit/check';
import { carryEdits, type CarriedEdit } from './edit/merge';
import { itemEdits } from './edit/rotation';
import { bySlot, ensureSlots, programmeWithSlots } from './edit';
import { constraintsOf, fitFor, isConstrained } from './generate/constraints';
import { programmeChanges, type SlotChange } from './generate/diff';
import { cycleInputs, generateProgramme } from './generate/programme';
import { TEMPLATES } from './generate/templates';
import type { TemplateKey } from './generate/types';
import { loggedLifts } from './next-cycle';

export interface RepickOptions {
  /** The user's own sessions that still exist (placements of the others are dropped). */
  customIds?: ReadonlySet<string>;
  /** Exercises swapped away for pain: never brought in as a substitute for an edit. */
  painful?: ReadonlySet<string>;
  /** Logs, so lifts the user has logged start from what was lifted. */
  logs?: readonly SessionLog[];
  exercises?: readonly Exercise[];
}

/** A user's exercise that stays in the programme though a constraint now rules it out. */
export interface OutEdit {
  sessionId: string;
  slot: string;
  exerciseId: string;
}

export interface Repick {
  /** The active programme re-picked: same id, phases, weeks and position; new exercises where constraints changed them. */
  programme: Programme;
  /** Slot swaps the generator makes, for the preview. The user's own edits are not counted. */
  changes: SlotChange[];
  /** Present when the programme has edits or placements. */
  ledger: { kept: CarriedEdit[]; dropped: CarriedEdit[] } | null;
  /** Warnings about the sessions the user's changes were carried into, by session id. */
  issues: Record<string, Issue[]>;
  /** The user's own exercises that are now ruled out: kept, with a warning. */
  outEdits: OutEdit[];
}

/** The template a rotation session was built from, from its id (`a-push`, `cardio`). */
const templateKey = (sessionId: string): TemplateKey | undefined => {
  const key = (sessionId === 'cardio' ? 'cardio' : sessionId.replace(/^[a-z]-/, '')) as TemplateKey;
  return TEMPLATES.has(key) ? key : undefined;
};

/** The profile the programme was generated for, with the constraints of `profile` instead. */
const withConstraintsOf = (was: Profile, profile: Profile): Profile => {
  const { limitations: _l, quiet: _q, smallSpace: _s, ...rest } = was;
  return {
    ...rest,
    ...(profile.limitations && { limitations: profile.limitations }),
    ...(profile.quiet !== undefined && { quiet: profile.quiet }),
    ...(profile.smallSpace !== undefined && { smallSpace: profile.smallSpace }),
  };
};

const isMaxTest = (a: PhaseAdjustment): a is Extract<PhaseAdjustment, { kind: 'max-test' }> =>
  a.kind === 'max-test';

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/** The phases of the active programme, its max test pointed at what the new generation tests. */
const phasesWith = (active: Programme, generated: Programme): Phase[] => {
  const test = generated.phases.flatMap((p) => p.adjustments).find(isMaxTest);
  const generatedNote = generated.phases.find((p) =>
    p.adjustments.some((a) => a.kind === 'max-test'),
  )?.note;
  return active.phases.map((phase) => {
    const was = phase.adjustments.find(isMaxTest);
    if (!was || (test && sameIds(test.exerciseIds, was.exerciseIds))) return phase;
    const { note: _note, ...rest } = phase;
    return {
      ...rest,
      adjustments: phase.adjustments.flatMap((a): PhaseAdjustment[] =>
        a.kind !== 'max-test' ? [a] : test ? [test] : [],
      ),
      ...(test && generatedNote && { note: generatedNote }),
    };
  });
};

/**
 * Applies new constraints (limitations, quiet, small space) to the programme in progress without
 * restarting the cycle: regenerates it with the same inputs and seed, takes its rotation (the
 * user's edits carried over as on a regeneration) and keeps the active programme's id, phases
 * (an inserted lighter week included), weeks and sessions, so the position in the rotation and
 * the logs stay valid. The user's own exercises that are now ruled out stay, and are listed.
 */
export function repickInPlace(
  active: Programme,
  profile: Profile,
  options: RepickOptions = {},
): Repick {
  const generation = active.generation;
  if (!generation)
    return { programme: active, changes: [], ledger: null, issues: {}, outEdits: [] };
  const exercises = options.exercises ?? [...exerciseById.values()];
  const byId = options.exercises ? new Map(exercises.map((e) => [e.id, e])) : exerciseById;
  const was = programmeWithSlots(active);
  const constraints = constraintsOf(profile);

  // The user's own picks are not up to the generator, but they use up the session's budget.
  const reserved: Record<string, string[]> = {};
  for (const session of was.rotation) {
    const base = was.generatedRotation?.find((s) => s.id === session.id);
    const placed = was.placements?.[session.id] !== undefined;
    const kept = (base ? [...itemEdits(session, base)] : [])
      .filter(([, edit]) => edit === 'exercise' || edit === 'added')
      .map(([slot]) => bySlot(session).get(slot)!.item.exerciseId);
    const ids = placed ? [...bySlot(session).values()].map((l) => l.item.exerciseId) : kept;
    if (ids.length > 0) reserved[session.id] = ids;
  }

  const keys = active.rotation.map((s) => templateKey(s.id));
  const rotationKeys = keys.every((k) => k !== undefined) ? (keys as TemplateKey[]) : undefined;
  const cycle = cycleInputs(generation);
  const logged = cycle.lastCycle
    ? loggedLifts(Object.values(cycle.lastCycle), options.logs ?? [])
    : [];
  const nextProfile = withConstraintsOf(generation.profile, profile);
  const generated = generateProgramme(
    {
      profile: nextProfile,
      equipment: generation.equipment,
      seed: generation.seed,
      ...cycle,
      ...(logged.length > 0 && { loggedExercises: logged }),
      ...(rotationKeys && { rotationKeys }),
      ...(Object.keys(reserved).length > 0 && { reserved }),
    },
    exercises,
  );

  const carried =
    active.generatedRotation || Object.keys(active.placements ?? {}).length > 0
      ? carryEdits(
          active,
          generated,
          { profile: nextProfile, inventory: generation.equipment, exercises: byId },
          options.customIds ?? new Set(),
          { painful: options.painful ?? new Set() },
        )
      : null;
  const merged = carried?.programme ?? generated;

  const programme: Programme = {
    ...merged,
    id: active.id,
    name: active.name,
    weeks: active.weeks,
    sessionsPerWeek: active.sessionsPerWeek,
    phases: phasesWith(active, generated),
    progression: active.progression,
    ...(active.lighterWeek && { lighterWeek: active.lighterWeek }),
    ...(active.createdAt && { createdAt: active.createdAt }),
  };

  // Measured against the generation, not the user's edited rotation.
  const before: Programme = active.generatedRotation
    ? { ...active, rotation: active.generatedRotation }
    : active;
  const outEdits: OutEdit[] = [];
  if (isConstrained(constraints))
    for (const session of programme.rotation) {
      const base = generated.rotation.find((s) => s.id === session.id);
      const original = base ? bySlot(ensureSlots(base)) : new Map();
      for (const [slot, { item }] of bySlot(ensureSlots(session))) {
        const exercise = byId.get(item.exerciseId);
        if (!exercise || original.get(slot)?.item.exerciseId === item.exerciseId) continue;
        if (fitFor(exercise, constraints) === 'out')
          outEdits.push({ sessionId: session.id, slot, exerciseId: item.exerciseId });
      }
    }

  return {
    programme,
    changes: programmeChanges(before, generated),
    ledger: carried ? { kept: carried.kept, dropped: carried.dropped } : null,
    issues: carried?.issues ?? {},
    outEdits,
  };
}
