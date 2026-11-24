import type {
  Block,
  EquipmentInventory,
  Exercise,
  Load,
  Section,
  Session,
  SessionItem,
  SessionLog,
  Settings,
} from '../../domain';
import { BAND_LEVELS } from '../../domain';
import { exerciseById as catalogueById } from '../../catalogue';
import { equipmentCapabilities, isExerciseAvailable } from '../equipment';
import { ownedWeights, snapDown } from '../generate/loads';
import { countsAsDoneByDefault, implementOf, itemKey, playSteps, sessionTotals } from '../play';
import { replacementItem, substitutesFor, type SubstituteContext } from './swaps';
import { droppedEntry, isTravelLog, parseDropped } from './stamps';

/** Everything the kit is applied against. */
export interface TravelContext extends SubstituteContext {
  /** Equipment on hand while away. */
  kit: EquipmentInventory;
  exercises?: ReadonlyMap<string, Exercise>;
  /** Exercises never offered as a stand-in (swapped away for pain). */
  avoid?: ReadonlySet<string>;
}

export interface TravelResult {
  session: Session;
  /** Exercises standing in for another one, by item key in `session`: the original's id. */
  substitutions: Record<string, string>;
  /** Exercises left out, as stamped (see `droppedEntry`): their place in the plan before the kit. */
  dropped: string[];
  /** Item key before the kit → item key in `session`, for what stayed or was replaced. */
  keyMap: Record<string, string>;
}

const itemsOf = (block: Block) => (block.type === 'straight' ? [block.item] : block.items);
const roundsOf = (block: Block) => (block.type === 'straight' ? block.sets : block.rounds);
const isCardio = (item: SessionItem) =>
  item.target.kind === 'cardio' || item.target.kind === 'interval';

/** The kit that is in force today, from the settings: its last day included. */
export function activeTravelKit(
  settings: Pick<Settings, 'travelKit'>,
  now: Date,
): EquipmentInventory | undefined {
  const kit = settings.travelKit;
  if (!kit) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return today <= kit.until ? kit.equipment : undefined;
}

/**
 * The session as it can be done with the kit. What the kit can't do is replaced by the best
 * other exercise for the same job that it can (same pattern, a primary muscle in common, same
 * compound or isolation tag, and whatever the generator accepts for this person), else left
 * out. Replacements start from the usual estimate on the kit's weights.
 */
export function applyTravelKit(session: Session, ctx: TravelContext): TravelResult {
  const exercises = ctx.exercises ?? catalogueById;
  const capabilities = equipmentCapabilities(ctx.kit);
  const pool = ctx.exercises ? [...ctx.exercises.values()] : undefined;
  const taken = new Set<string>(ctx.avoid);
  for (const block of [...session.warmup, ...session.main, ...session.finisher])
    for (const item of itemsOf(block)) taken.add(item.exerciseId);
  const substitutions: Record<string, string> = {};
  const dropped: string[] = [];
  const keyMap: Record<string, string> = {};
  const standIn = new Map<string, Exercise>();
  const gone = new Set<string>();

  const rebuild = (section: Section, blocks: Block[]): Block[] => {
    const out: Block[] = [];
    blocks.forEach((block, blockIndex) => {
      const kept: { item: SessionItem; from: number }[] = [];
      itemsOf(block).forEach((item, itemIndex) => {
        const exercise = exercises.get(item.exerciseId);
        const key = itemKey(section, blockIndex, itemIndex);
        if (!exercise) return kept.push({ item, from: itemIndex });
        if (section === 'warmup') {
          const next = standIn.get(item.exerciseId);
          const ramp = itemsOf(block).length === 1 && item.load?.kind === 'kg';
          if (next && ramp && next.loadType === 'external')
            return kept.push({ item: { ...item, exerciseId: next.id }, from: itemIndex });
          if (next || (ramp && gone.has(item.exerciseId))) return;
          if (isExerciseAvailable(exercise, capabilities))
            return kept.push({ item, from: itemIndex });
          return void dropped.push(
            droppedEntry({ itemKey: key, exerciseId: exercise.id, sets: 0 }),
          );
        }
        if (isExerciseAvailable(exercise, capabilities))
          return kept.push({ item, from: itemIndex });
        const other = substitutesFor(exercise, ctx.kit, {
          avoid: taken,
          context: {
            level: ctx.level,
            ...(ctx.bodyweightKg !== undefined && { bodyweightKg: ctx.bodyweightKg }),
            ...(ctx.constraints && { constraints: ctx.constraints }),
          },
          ...(pool && { exercises: pool }),
        })[0];
        if (other) {
          taken.add(other.id);
          standIn.set(exercise.id, other);
          const replaced = replacementItem(
            item,
            exercise,
            other,
            section === 'main' && blockIndex === 0,
            {
              inventory: ctx.kit,
              level: ctx.level,
              ...(ctx.bodyweightKg !== undefined && { bodyweightKg: ctx.bodyweightKg }),
            },
          );
          substitutions[`${section}/${out.length}/${kept.length}`] = exercise.id;
          return kept.push({ item: replaced, from: itemIndex });
        }
        gone.add(exercise.id);
        dropped.push(
          droppedEntry({
            itemKey: key,
            exerciseId: exercise.id,
            sets: section === 'main' && !isCardio(item) ? roundsOf(block) : 0,
          }),
        );
      });
      if (kept.length === 0) return;
      kept.forEach(({ from }, to) => {
        keyMap[itemKey(section, blockIndex, from)] = itemKey(section, out.length, to);
      });
      const items = kept.map((k) => k.item);
      if (block.type === 'straight') out.push({ ...block, item: items[0]! });
      else if (items.length === 1)
        out.push({
          type: 'straight',
          item: items[0]!,
          sets: block.rounds,
          restSec: block.restAfterRoundSec,
        });
      else out.push({ ...block, items });
    });
    return out;
  };

  // Main and finisher first: a warm-up ramp follows the lift it belongs to.
  const main = rebuild('main', session.main);
  const finisher = rebuild('finisher', session.finisher);
  const warmup = rebuild('warmup', session.warmup);
  return { session: { ...session, warmup, main, finisher }, substitutions, dropped, keyMap };
}

/** Hard sets of the main part: sets of each non-cardio exercise, a round of a group counting once per exercise. */
const hardSets = (blocks: readonly Block[]): number =>
  blocks.reduce(
    (n, block) => n + itemsOf(block).filter((i) => !isCardio(i)).length * roundsOf(block),
    0,
  );

/**
 * Share (0 to 1) of the session's main hard sets the kit can do, as the original exercise or a
 * stand-in. Under half, pausing the programme is the better advice.
 */
export function travelCoverage(session: Session, ctx: TravelContext): number {
  const total = hardSets(session.main);
  if (total === 0) return 1;
  return hardSets(applyTravelKit(session, ctx).session.main) / total;
}

/** The kit's coverage of each session, by session id. */
export function travelCoverageOf(
  sessions: readonly Session[],
  ctx: TravelContext,
): Record<string, number> {
  return Object.fromEntries(sessions.map((s) => [s.id, travelCoverage(s, ctx)]));
}

/** What the travel stamp of a session says it did, ready to store as `adjustments.travel`. */
export const travelStamp = (
  result: Pick<TravelResult, 'substitutions' | 'dropped'>,
): { substitutions: Record<string, string>; dropped: string[] } => ({
  substitutions: result.substitutions,
  dropped: result.dropped,
});

/**
 * Whether a finished session moves the rotation on by default. A session away from home counts
 * when at least half the main hard sets of the plan it replaced were done, as the original or a
 * stand-in; what was left out counts as not done. Any other session: the usual rule.
 */
export function defaultCountsAsDone(log: SessionLog, inventory: EquipmentInventory = []): boolean {
  if (!isTravelLog(log)) return countsAsDoneByDefault(sessionTotals(log, inventory));
  const units = new Map<string, boolean>();
  for (const step of playSteps(log.plan, log.adjustments)) {
    if (step.section !== 'main' || isCardio(step.item)) continue;
    const key = `${step.blockIndex}/${step.itemIndex}/${step.set}`;
    const set = log.sets.find(
      (s) =>
        s.section === 'main' &&
        s.blockIndex === step.blockIndex &&
        s.itemIndex === step.itemIndex &&
        s.set === step.set &&
        s.side === step.side,
    );
    units.set(key, (units.get(key) ?? true) && set?.actual !== undefined && !set.flag);
  }
  const left = (log.adjustments?.travel?.dropped ?? []).reduce(
    (n, e) => n + (parseDropped(e)?.sets ?? 0),
    0,
  );
  const total = units.size + left;
  const done = [...units.values()].filter(Boolean).length;
  return total > 0 && done * 2 >= total;
}

const sameLoad = (a: Load, b: Load) => JSON.stringify(a) === JSON.stringify(b);

/** A load on the kit's weights or bands: the nearest one it has, never above what was asked. */
export function snapToKit(
  item: SessionItem,
  exercise: Exercise,
  kit: EquipmentInventory,
): SessionItem {
  const load = item.load;
  if (!load) return item;
  let next: Load | undefined;
  if (load.kind === 'kg') {
    const implement = implementOf(exercise, equipmentCapabilities(kit));
    if (!implement) return item;
    const kg = snapDown(ownedWeights(kit, implement.kind, implement.count), load.kg);
    next = kg === undefined ? undefined : { kind: 'kg', kg };
  } else if (load.kind === 'band') {
    const owned = new Set(
      kit.flatMap((i) => (i.kind === 'band' || i.kind === 'mini-band' ? i.levels : [])),
    );
    const levels = BAND_LEVELS.filter((l) => owned.has(l));
    if (levels.length === 0 || owned.has(load.level)) return item;
    const at = BAND_LEVELS.indexOf(load.level);
    const level = [...levels].sort(
      (a, b) =>
        Math.abs(BAND_LEVELS.indexOf(a) - at) - Math.abs(BAND_LEVELS.indexOf(b) - at) ||
        BAND_LEVELS.indexOf(a) - BAND_LEVELS.indexOf(b),
    )[0]!;
    next = { kind: 'band', level };
  }
  return next && !sameLoad(next, load) ? { ...item, load: next } : item;
}
