import type {
  Block,
  Exercise,
  Load,
  Programme,
  ProgressionNote,
  Section,
  Session,
  SessionItem,
  SessionLog,
  Target,
  Tempo,
} from '../../domain';
import { exerciseById as catalogueById } from '../../catalogue';
import { sessionMinutes } from '../duration';
import { equipmentCapabilities } from '../equipment';
import { ownedWeights, snapDown } from '../generate/loads';
import { implementOf, itemKey } from '../play';
import { sessionForWeek } from '../week';
import {
  exposuresOf,
  longestGapDays,
  progressKey,
  sessionTimes,
  weekRole,
  type Exposure,
  type WeekRole,
} from './exposures';
import { capacity, effectiveKg, ladderFor, loadAt, predictReps, rungCount, rungOf } from './ladder';
import { flagProposals, holdForPain, ladderProposal, painState } from './proposals';
import { compatible, progressItem } from './rules';
import { activeSwaps, applySwaps } from './swaps';
import type { PreparedSession, ProgressContext, Proposal } from './types';

export type { PreparedSession, ProgressContext, Proposal } from './types';
export { activeSwaps, substituteFor } from './swaps';
export { BREAK_DAYS, loadToken } from './rules';
export { weekRole, type WeekRole } from './exposures';
export { capacity, predictReps } from './ladder';

const itemsOf = (block: Block) => (block.type === 'straight' ? [block.item] : block.items);
const withItems = (block: Block, items: SessionItem[]): Block =>
  block.type === 'straight' ? { ...block, item: items[0]! } : { ...block, items };

/** Exposures per exercise, shared by every call reading the same logs and programmes. */
const exposureCaches = new WeakMap<object, WeakMap<object, Map<string, Exposure[]>>>();
const exposureCache = (ctx: ProgressContext) => {
  let byProgrammes = exposureCaches.get(ctx.logs);
  if (!byProgrammes) exposureCaches.set(ctx.logs, (byProgrammes = new WeakMap()));
  let cache = byProgrammes.get(ctx.programmes);
  if (!cache) byProgrammes.set(ctx.programmes, (cache = new Map()));
  const shared = cache;
  return (exerciseId: string) => {
    let e = shared.get(exerciseId);
    if (!e) shared.set(exerciseId, (e = exposuresOf(exerciseId, ctx.logs, ctx.programmes)));
    return e;
  };
};

const lookup = (ctx: ProgressContext) => ctx.exercises ?? catalogueById;

/**
 * A session as it should run next: swaps in place, then each exercise's load, goal and tempo
 * from its history, with the why. Quick sessions only take the latest load of each exercise.
 */
export function prepareSession(
  session: Session,
  ctx: ProgressContext,
  mode: 'programme' | 'quick' = 'programme',
  options: { role?: WeekRole } = {},
): PreparedSession {
  const exercises = lookup(ctx);
  const swaps = activeSwaps(ctx.answers);
  const swapped = applySwaps(
    session,
    swaps,
    {
      inventory: ctx.inventory,
      level: ctx.profile?.level ?? 'intermediate',
      ...(ctx.profile?.bodyweightKg !== undefined && { bodyweightKg: ctx.profile.bodyweightKg }),
    },
    exercises,
  );
  const exposures = exposureCache(ctx);
  const times = sessionTimes(ctx.logs);
  const now = ctx.now.getTime();
  const notes: Record<string, ProgressionNote> = {};
  const proposals: Proposal[] = [];
  const buyNext: string[] = [];

  const progressSection = (section: 'main' | 'finisher', blocks: Block[]): Block[] =>
    blocks.map((block, blockIndex) =>
      withItems(
        block,
        itemsOf(block).map((base, itemIndex) => {
          const exercise = exercises.get(base.exerciseId);
          if (!exercise) return base;
          const all = exposures(exercise.id);
          if (mode === 'quick') return quickItem(base, exercise, all, ctx);
          const context = block.type === 'straight' ? 'straight' : 'group';
          const lastAt = all[0] ? Date.parse(all[0].at) : undefined;
          const gapDays = lastAt === undefined ? undefined : longestGapDays(times, lastAt, now);
          const key = progressKey(exercise.id, base.target, context);
          let result = progressItem({
            base,
            section,
            exercise,
            exposures: all.filter((e) => e.key === key),
            all,
            inventory: ctx.inventory,
            ...(ctx.profile?.bodyweightKg !== undefined && {
              bodyweightKg: ctx.profile.bodyweightKg,
            }),
            ...(gapDays !== undefined && { gapDays }),
            ...(options.role && { role: options.role }),
            ...(ctx.profile?.level && { level: ctx.profile.level }),
            now,
          });
          const pain = painState(all, ctx.answers);
          if (pain) result = holdForPain(result, pain, base, exercise, ctx);
          const ik = itemKey(section, blockIndex, itemIndex);
          const replaced = swapped.replaces[ik];
          if (replaced && !result.note && all.length === 0)
            result = { ...result, note: { code: 'swapped-in', params: { from: replaced } } };
          if (result.note) notes[ik] = result.note;
          if (result.ladderEnd) {
            const proposal = ladderProposal(result.ladderEnd, exercise, all, ctx);
            if (proposal === 'buy-next') {
              buyNext.push(exercise.id);
              if (result.note) notes[ik] = { ...result.note, code: 'buy-next' };
            } else if (proposal) proposals.push(proposal);
          }
          for (const p of flagProposals(exercise, all, ctx, swaps)) proposals.push(p);
          return result.item;
        }),
      ),
    );

  const before = swapped.session;
  const main = progressSection('main', before.main);
  const finisher = progressSection('finisher', before.finisher);
  const warmup = rescaleRamps(before, main, ctx);
  const out: Session = { ...before, warmup, main, finisher };
  out.estimatedMinutes = sessionMinutes(out);
  return {
    session: out,
    notes,
    replaces: swapped.replaces,
    proposals: unique(proposals),
    buyNext: [...new Set(buyNext)],
  };
}

const unique = (proposals: Proposal[]): Proposal[] => {
  const seen = new Set<string>();
  return proposals.filter((p) => {
    const k = `${p.exerciseId}|${p.kind}|${p.logId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * Quick sessions read the exercise's latest training-week load (not a peak attempt, not a deload)
 * on today's equipment, re-estimated for the quick range when it differs, and stay lighter while
 * a pain stop waits. Nothing else moves and nothing is written.
 */
function quickItem(
  base: SessionItem,
  exercise: Exercise,
  all: readonly Exposure[],
  ctx: ProgressContext,
): SessionItem {
  const latest = all.find((e) => e.evidence.length > 0 && e.item.load && e.role === 'build');
  let item = base;
  if (latest?.item.load && base.load && compatible(exercise, latest.item.load, base.load)) {
    const ladder = ladderFor(exercise, latest.item.load, ctx.inventory, ctx.profile?.bodyweightKg);
    let rung = rungOf(ladder, latest.item.load);
    const sameRange = JSON.stringify(latest.item.target) === JSON.stringify(base.target);
    const kg = effectiveKg(ladder, rung);
    const first = latest.evidence[0]!;
    if (!sameRange && kg !== undefined && base.target.kind === 'reps') {
      const cap = capacity(kg, first.value, (first.rir ?? latest.item.rir ?? 2) + first.feel);
      let best = 0;
      for (let r = 0; r < rungCount(ladder); r++) {
        const at = effectiveKg(ladder, r);
        if (at !== undefined && predictReps(cap, at, base.rir ?? 2) >= base.target.min) best = r;
      }
      rung = best;
    }
    const load = ladder.kind === 'none' ? undefined : loadAt(ladder, rung);
    if (load) item = { ...base, load };
  }
  const pain = painState(all, ctx.answers);
  return pain ? holdForPain({ item }, pain, item, exercise, ctx).item : item;
}

/** Ramp-up sets keep their share of the working load when it moves. */
function rescaleRamps(before: Session, main: Block[], ctx: ProgressContext): Block[] {
  const working = new Map<string, { was: number; now: number }>();
  before.main.forEach((block, b) =>
    itemsOf(block).forEach((item, i) => {
      const now = itemsOf(main[b]!)[i]!;
      if (item.load?.kind === 'kg' && now.load?.kind === 'kg' && !working.has(item.exerciseId))
        working.set(item.exerciseId, { was: item.load.kg, now: now.load.kg });
    }),
  );
  const capabilities = equipmentCapabilities(ctx.inventory);
  const exercises = lookup(ctx);
  return before.warmup.map((block) =>
    withItems(
      block,
      itemsOf(block).map((item) => {
        const w = working.get(item.exerciseId);
        const exercise = exercises.get(item.exerciseId);
        if (!w || w.was === w.now || item.load?.kind !== 'kg' || !exercise) return item;
        const implement = implementOf(exercise, capabilities);
        if (!implement) return item;
        const weights = ownedWeights(ctx.inventory, implement.kind, implement.count);
        const kg = snapDown(weights, (item.load.kg / w.was) * w.now);
        return kg === undefined ? item : { ...item, load: { kind: 'kg', kg } };
      }),
    ),
  );
}

/** One exercise's prescription, as the summary compares it. */
export interface Prescribed {
  target: Target;
  load?: Load;
  goal?: number;
  tempo?: Tempo;
}

export interface NextTimeLine {
  itemKey: string;
  exerciseId: string;
  before: Prescribed;
  after: Prescribed;
  note?: ProgressionNote;
}

export interface NextTime {
  lines: NextTimeLine[];
  /** Proposals raised by this session. */
  proposals: Proposal[];
  buyNext: string[];
}

const prescribed = (item: SessionItem): Prescribed => ({
  target: item.target,
  ...(item.load && { load: item.load }),
  ...(item.goal !== undefined && { goal: item.goal }),
  ...(item.tempo && { tempo: item.tempo }),
});

/**
 * What changes the next time this programme session runs (the following week), exercise by
 * exercise, from the logs including this one. Empty for sessions outside a programme.
 */
export function nextTime(
  log: SessionLog,
  programme: Programme | undefined,
  ctx: ProgressContext,
): NextTime {
  const empty: NextTime = { lines: [], proposals: [], buyNext: [] };
  const source = log.source;
  if (source.kind !== 'programme' || !programme || programme.id !== source.programmeId)
    return empty;
  if (!programme.rotation.some((s) => s.id === source.sessionId)) return empty;
  const week = Math.min(source.week + 1, programme.weeks);
  const prepared = prepareSession(
    sessionForWeek(programme, source.sessionId, week).session,
    ctx,
    'programme',
    { role: weekRole(programme, week) },
  );
  const lines: NextTimeLine[] = [];
  for (const section of ['main', 'finisher'] as const satisfies readonly Section[])
    prepared.session[section].forEach((block, b) =>
      itemsOf(block).forEach((after, i) => {
        const was = log.plan[section][b];
        const before = was && itemsOf(was)[i];
        if (!before || before.exerciseId !== after.exerciseId) return;
        if (!log.sets.some((s) => s.section === section && s.blockIndex === b && s.itemIndex === i))
          return;
        const k = itemKey(section, b, i);
        const n = prepared.notes[k];
        lines.push({
          itemKey: k,
          exerciseId: after.exerciseId,
          before: prescribed(before),
          after: prescribed(after),
          ...(n && { note: n }),
        });
      }),
    );
  return {
    lines,
    proposals: prepared.proposals.filter((p) => p.logId === log.id),
    buyNext: prepared.buyNext,
  };
}

/**
 * Everything waiting for the user across a programme: pain and no-equipment stops, harder or
 * easier variants, and exercises that would need new equipment to keep progressing.
 */
export function pendingProposals(
  programme: Programme,
  week: number,
  ctx: ProgressContext,
): { proposals: Proposal[]; buyNext: string[] } {
  const proposals: Proposal[] = [];
  const buyNext = new Set<string>();
  for (const session of programme.rotation) {
    const prepared = prepareSession(
      sessionForWeek(programme, session.id, week).session,
      ctx,
      'programme',
      {
        role: weekRole(programme, week),
      },
    );
    proposals.push(...prepared.proposals);
    for (const id of prepared.buyNext) buyNext.add(id);
  }
  return { proposals: unique(proposals), buyNext: [...buyNext] };
}
