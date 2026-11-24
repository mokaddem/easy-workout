import { exerciseById } from '../catalogue';
import type { EquipmentInventory, Profile, Programme, SessionLog } from '../domain';
import { carryEdits, type CarriedEdit } from './edit/merge';
import type { Issue } from './edit/check';
import { constraintsOf, fitFor, type Constraints } from './generate/constraints';
import { programmeChanges, type SlotChange } from './generate/diff';
import { generateProgramme, slotPicks } from './generate/programme';
import { withinStep } from './generate/select';
import { testBlockedByPain } from './maxtest';
import { exposuresOf, weekRole } from './progress/exposures';
import { pendingProposals } from './progress/index';
import { activeSwaps } from './progress/swaps';
import type { ProgressContext } from './progress/types';

/** A lift moving to its harder variant for the next cycle. */
export interface Upgrade {
  from: string;
  to: string;
}

/** The last week that trains (the deload repeats the week before it and offers nothing new). */
const lastTrainingWeek = (programme: Programme): number => {
  for (let w = programme.weeks; w >= 1; w--) if (weekRole(programme, w) !== 'deload') return w;
  return programme.weeks;
};

/**
 * Lifts that finished the cycle at the end of their ladder with a harder variant waiting (already
 * checked for the slot, the level and safety): the next cycle starts them on it. Not while
 * the exercise has a pain or easier proposal open, or hurt in either of its last two sessions.
 * With `constraints` (the profile the next cycle is for), a harder variant that a limitation,
 * quiet or small space rules out is not offered.
 */
export function upgradesFor(
  previous: Programme,
  ctx: ProgressContext,
  constraints?: Constraints,
): Upgrade[] {
  const { proposals } = pendingProposals(previous, lastTrainingWeek(previous), ctx);
  const troubled = new Set(proposals.filter((p) => p.kind !== 'harder').map((p) => p.exerciseId));
  const out: Upgrade[] = [];
  for (const p of proposals) {
    if (p.kind !== 'harder' || !p.substituteId || troubled.has(p.exerciseId)) continue;
    const harder = (ctx.exercises ?? exerciseById).get(p.substituteId);
    if (harder && fitFor(harder, constraints) === 'out') continue;
    const recent = exposuresOf(p.exerciseId, ctx.logs, ctx.programmes, { anySource: true }).slice(
      0,
      2,
    );
    if (recent.some((e) => e.pain)) continue;
    // A test that hurt counts too, until the movement has gone well twice.
    if (
      testBlockedByPain(p.exerciseId, {
        logs: ctx.logs,
        programmes: ctx.programmes,
        answers: ctx.answers,
        maxTests: ctx.maxTests ?? [],
        inventory: ctx.inventory,
      })
    )
      continue;
    if (!out.some((u) => u.from === p.exerciseId))
      out.push({ from: p.exerciseId, to: p.substituteId });
  }
  return withoutOutgrown(out);
}

/** The exercises among `ids` that the user has logged sets of, each once. */
export const loggedLifts = (
  ids: Iterable<string>,
  logs: readonly SessionLog[],
  programmes: readonly Programme[] = [],
): string[] =>
  [...new Set(ids)].filter(
    (id) => exposuresOf(id, logs, programmes, { anySource: true }).length > 0,
  );

/**
 * An upgrade onto a lift that is itself being upgraded would bring back what the user outgrew:
 * it takes that lift's own upgrade instead when it stays within one step of where it started,
 * and otherwise the lift holds.
 */
function withoutOutgrown(upgrades: Upgrade[]): Upgrade[] {
  const next = new Map(upgrades.map((u) => [u.from, u.to]));
  const out: Upgrade[] = [];
  for (const u of upgrades) {
    let to = u.to;
    for (const seen = new Set([u.from]); next.has(to) && !seen.has(to);) {
      seen.add(to);
      to = next.get(to)!;
    }
    if (to === u.from || next.has(to)) continue;
    if (to === u.to) {
      out.push(u);
      continue;
    }
    const from = exerciseById.get(u.from);
    const target = exerciseById.get(to);
    if (from && target && withinStep(target, from)) out.push({ from: u.from, to });
  }
  return out;
}

export interface NextCycleInput {
  previous: Programme;
  /** The profile and equipment now: the user may have changed them before starting. */
  profile: Profile;
  equipment: EquipmentInventory;
  progress: ProgressContext;
  /** The user's sessions that still exist (placements of the others are dropped). */
  customIds?: ReadonlySet<string>;
  /** Upgrades the user turned off before starting: the lift stays as it is. */
  declined?: ReadonlySet<string>;
}

export interface NextCycle {
  /** What starts: the generation with the user's changes carried over. */
  programme: Programme;
  /** The generation alone, as the changes are measured on it. */
  generated: Programme;
  cycle: number;
  /** Every upgrade on offer, the declined ones included (the preview lists them all). */
  upgrades: Upgrade[];
  /** Slot changes from last cycle's generation, upgrades and rotation included. */
  changes: SlotChange[];
  ledger: { kept: CarriedEdit[]; dropped: CarriedEdit[] } | null;
  issues: Record<string, Issue[]>;
  splitChanged: boolean;
  /** The goal changed: a new programme, counted from cycle 1 again. */
  newGoal: boolean;
}

/**
 * The programme that follows a finished cycle: same profile unless the user changed it, main lifts
 * kept (moved to their harder variant where the ladder ended), accessories rotated away from last
 * cycle's picks where an equally good one exists, and the user's edits carried over. A new goal
 * starts over at cycle 1, with nothing rotated or upgraded.
 */
export function nextCycle(input: NextCycleInput): NextCycle {
  const { previous, profile, equipment } = input;
  const was = previous.generation;
  const newGoal = was !== undefined && was.profile.goal !== profile.goal;
  const cycle = newGoal ? 1 : (was?.cycle ?? 1) + 1;
  // A lift swapped in stands in the original's slot: its upgrade goes through that slot.
  const original = new Map(
    [...activeSwaps(input.progress.answers).to].map(([from, to]) => [to, from]),
  );
  const slotOf = (u: Upgrade) => original.get(u.from) ?? u.from;
  // Lifts last cycle's slots hold that the user has sets logged of: their loads come from there.
  const logged = loggedLifts(
    Object.values(slotPicks(previous)),
    input.progress.logs,
    input.progress.programmes,
  );
  const generate = (upgrades: readonly Upgrade[]) =>
    generateProgramme({
      profile,
      equipment,
      seed: newGoal ? 0 : (was?.seed ?? 0) + 1,
      ...(cycle > 1 && { cycle }),
      ...(!newGoal && {
        lastCycle: slotPicks(previous),
        ...(logged.length > 0 && { loggedExercises: logged }),
        ...(was && { lastCycleEquipment: was.equipment }),
      }),
      ...(upgrades.length > 0 && {
        upgrades: Object.fromEntries(upgrades.map((u) => [slotOf(u), u.to])),
      }),
    });
  // Only the upgrades the slots actually took are offered: the preview never promises a change
  // that doesn't happen.
  const offered = newGoal ? [] : upgradesFor(previous, input.progress, constraintsOf(profile));
  const withAll = generate(offered);
  const applied = new Set(
    (withAll.generation?.notes ?? [])
      .filter((n) => n.code === 'exercise-upgraded')
      .map((n) => `${String(n.params.from)}>${String(n.params.exerciseId)}`),
  );
  const upgrades = offered.filter((u) => applied.has(`${slotOf(u)}>${u.to}`));
  const kept = upgrades.filter((u) => !input.declined?.has(u.from));
  const generated = kept.length === upgrades.length ? withAll : generate(kept);
  const hasEdits =
    Boolean(previous.generatedRotation) || Object.keys(previous.placements ?? {}).length > 0;
  const carried = hasEdits
    ? carryEdits(
        previous,
        generated,
        { profile, inventory: equipment, exercises: exerciseById },
        input.customIds ?? new Set(),
        { painful: activeSwaps(input.progress.answers).painful },
      )
    : null;
  const before: Programme = previous.generatedRotation
    ? { ...previous, rotation: previous.generatedRotation }
    : previous;
  return {
    programme: carried?.programme ?? generated,
    generated,
    cycle,
    upgrades,
    changes: programmeChanges(before, generated),
    ledger: carried ? { kept: carried.kept, dropped: carried.dropped } : null,
    issues: carried?.issues ?? {},
    splitChanged:
      previous.rotation.map((s) => s.id).join('|') !==
      generated.rotation.map((s) => s.id).join('|'),
    newGoal,
  };
}
