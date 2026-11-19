import { catalogue as defaultCatalogue } from '../../catalogue';
import type { Exercise, Generation, Goal, LocalizedText, Programme, Session } from '../../domain';
import { equipmentCapabilities, meetsRequirement, sameEquipment } from '../equipment';
import { sessionMinutes, sessionSeconds } from '../duration';
import { isTestable } from '../testable';
import { buildSession } from './build';
import { OVER_TOLERANCE } from './fit';
import { ownedWeights } from './loads';
import { phasesFor, PROGRAMME_WEEKS } from './phases';
import { newSelectionState } from './select';
import { SHORT_SESSION_MINUTES, splitFor, template } from './templates';
import { NoteLog, type Context, type GenerateInput, type TemplateKey } from './types';

/** Bumped whenever the rules change what the same inputs produce. */
export const GENERATOR_VERSION = 4;

const PROGRAMME_NAME: Record<Goal, LocalizedText> = {
  muscle: { fr: 'Prise de muscle 8 semaines', en: '8-week muscle gain' },
  recomposition: { fr: 'Recomposition 8 semaines', en: '8-week recomposition' },
  'general-fitness': { fr: 'Forme générale 8 semaines', en: '8-week general fitness' },
};

const LETTERS = 'ABCDEFGHIJ';

/** A split session with fewer main blocks than this is rebuilt as full body. */
const MIN_SPLIT_MAIN_BLOCKS = 3;
const FULL_BODY: readonly TemplateKey[] = ['full-a', 'full-b', 'full-c'];

export const makeContext = (
  input: GenerateInput,
  exercises: readonly Exercise[] = defaultCatalogue,
  kept: Readonly<Record<string, string>> | undefined = input.lastCycle,
): Context => ({
  level: input.profile.level,
  profile: input.profile,
  equipment: input.equipment,
  catalogue: new Map(exercises.map((e) => [e.id, e])),
  seed: input.seed ?? 0,
  cycle: input.cycle ?? 1,
  lastCycle: new Map(Object.entries(kept ?? {})),
  lastPicks: new Map(Object.entries(input.lastCycle ?? {})),
  logged: new Set(input.loggedExercises ?? []),
  upgrades: new Map(Object.entries(input.upgrades ?? {})),
  log: new NoteLog(),
});

const mainItems = (session: Session) =>
  session.main.flatMap((b) => (b.type === 'straight' ? [b.item] : b.items));

/** Typical progression jumps: the owned step is rounded to whole steps near these. */
const UPPER_TARGET_KG = 2;
const LOWER_TARGET_KG = 4;

/** Smallest gap between owned weights of one implement, held in the count most lifts use. */
const ownedStep = (ctx: Context, kind: 'dumbbell' | 'kettlebell'): number | undefined => {
  let weights = ownedWeights(ctx.equipment, kind, 2);
  if (weights.length < 2) weights = ownedWeights(ctx.equipment, kind, 1);
  let step = Infinity;
  for (let i = 1; i < weights.length; i++) step = Math.min(step, weights[i]! - weights[i - 1]!);
  return Number.isFinite(step) && step > 0 ? Math.round(step * 100) / 100 : undefined;
};

/**
 * Load jumps for double progression, in whole steps of what the user owns (dumbbells first,
 * else kettlebells; never mixed): about 2 kg for the upper body and 4 kg for the lower body.
 * The adaptation phase still snaps each jump to an owned weight.
 */
const increments = (ctx: Context): { upper: number; lower: number } => {
  const step = ownedStep(ctx, 'dumbbell') ?? ownedStep(ctx, 'kettlebell');
  if (step === undefined) return { upper: UPPER_TARGET_KG, lower: LOWER_TARGET_KG };
  const whole = (target: number) =>
    Math.round(step * Math.max(1, Math.round(target / step)) * 100) / 100;
  return { upper: whole(UPPER_TARGET_KG), lower: whole(LOWER_TARGET_KG) };
};

const PUSH_PATTERNS: readonly string[] = [
  'push-horizontal',
  'push-vertical',
  'chest-isolation',
  'shoulder-isolation',
  'elbow-extension',
];
const PULL_PATTERNS: readonly string[] = [
  'pull-horizontal',
  'pull-vertical',
  'elbow-flexion',
  'shrug',
];
/** Pushing sets may exceed pulling sets by this much at most. */
const MAX_PUSH_TO_PULL = 1.25;

/**
 * When the equipment leaves pulling slots empty, the week tilts towards pushing. Pull blocks
 * get sets back where the session still fits its budget; otherwise push isolation sets go.
 */
/**
 * The push block that gives up a set for the balance, from push blocks in rotation order.
 * Light (isolation) work goes first, then other blocks. Never the first push block of a
 * session, and never below 2 sets. Undefined when nothing qualifies.
 */
export const pickPushTrim = <
  T extends { session: unknown; block: { sets: number }; isolation: boolean },
>(
  blocks: readonly T[],
): T | undefined => {
  const seen = new Set<unknown>();
  const later = blocks.filter((c) => {
    const first = !seen.has(c.session);
    seen.add(c.session);
    return !first && c.block.sets > 2;
  });
  return later.filter((c) => c.isolation).pop() ?? later.pop();
};

const balancePushPull = (rotation: Session[], ctx: Context, budget: number): void => {
  const patternOf = (id: string) => ctx.catalogue.get(id)?.pattern ?? 'mobility';
  const count = (patterns: readonly string[]) =>
    rotation.reduce(
      (sum, s) =>
        sum +
        s.main.reduce((acc, b) => {
          const n = b.type === 'straight' ? b.sets : b.rounds;
          const items = b.type === 'straight' ? [b.item] : b.items;
          return (
            acc +
            items
              .filter((i) => patterns.includes(patternOf(i.exerciseId)))
              .reduce((w, i) => w + balanceWeight(i.exerciseId), 0) *
              n
          );
        }, 0),
      0,
    );
  const straightBlocks = (patterns: readonly string[]) =>
    rotation.flatMap((session) =>
      session.main.flatMap((block, index) =>
        block.type === 'straight' && patterns.includes(patternOf(block.item.exerciseId))
          ? [{ session, index, block }]
          : [],
      ),
    );

  /** Bodyweight isolation (prone raises) is light work: half a set for the balance. */
  const balanceWeight = (id: string) => {
    const exercise = ctx.catalogue.get(id);
    return exercise?.loadType === 'bodyweight' && exercise.tags.includes('isolation') ? 0.5 : 1;
  };

  const maxSets = ctx.level === 'beginner' || ctx.level === 'returning' ? 4 : 5;
  let guard = 50;
  const growPull = () =>
    straightBlocks(PULL_PATTERNS).find(({ session, index, block }) => {
      // Same caps as the time fit: the volume phase adds a set to the first two blocks later.
      if (block.sets >= maxSets - (index < 2 ? 1 : 0)) return false;
      const main = session.main.map((b, i) =>
        i === index ? { ...block, sets: block.sets + 1 } : b,
      );
      return sessionSeconds({ ...session, main }) / 60 <= budget * (1 + OVER_TOLERANCE);
    });
  while (count(PUSH_PATTERNS) > MAX_PUSH_TO_PULL * count(PULL_PATTERNS) && guard-- > 0) {
    const grow = growPull();
    if (!grow) {
      const trim = pickPushTrim(
        straightBlocks(PUSH_PATTERNS).map((c) => ({
          ...c,
          isolation:
            ctx.catalogue.get(c.block.item.exerciseId)?.tags.includes('isolation') ?? false,
        })),
      );
      if (trim) {
        trim.session.main[trim.index] = { ...trim.block, sets: trim.block.sets - 1 };
        ctx.log.add(
          'balance-set-removed',
          { exerciseId: trim.block.item.exerciseId },
          { sessionId: trim.session.id, section: 'main', blockIndex: trim.index },
        );
        continue;
      }
    }
    if (!grow) break;
    grow.session.main[grow.index] = { ...grow.block, sets: grow.block.sets + 1 };
    ctx.log.add(
      'balance-set-added',
      { exerciseId: grow.block.item.exerciseId },
      { sessionId: grow.session.id, section: 'main', blockIndex: grow.index },
    );
  }
  for (const session of rotation) session.estimatedMinutes = sessionMinutes(session);
};

/**
 * Retested at the end of the cycle: the push-up variant used in the programme, else the one
 * that suits the level. Push-ups need no equipment, so every programme can test them.
 */
const maxTestExercise = (sessions: Session[], ctx: Context): Exercise | undefined => {
  const pushUps = sessions
    .flatMap(mainItems)
    .map((item) => ctx.catalogue.get(item.exerciseId))
    .filter(
      (e): e is Exercise =>
        e !== undefined && e.pattern === 'push-horizontal' && isTestable(e, ctx.level),
    );
  const fallback = ctx.level === 'beginner' ? 'knee-push-up' : 'push-up';
  return pushUps.find((e) => e.id === 'push-up') ?? pushUps[0] ?? ctx.catalogue.get(fallback);
};

/** Some loadable bodyweight move in the programme can take load the user owns. */
const canAddLoad = (sessions: Session[], ctx: Context): boolean => {
  const capabilities = equipmentCapabilities(ctx.equipment);
  return sessions.flatMap(mainItems).some((item) => {
    const exercise = ctx.catalogue.get(item.exerciseId);
    return exercise?.addedLoad?.some((req) => meetsRequirement(req, capabilities)) ?? false;
  });
};

const hasCardioFinisher = (sessions: Session[]) =>
  sessions.some((s) =>
    s.finisher.some(
      (b) =>
        b.type === 'straight' &&
        (b.item.target.kind === 'cardio' || b.item.target.kind === 'interval'),
    ),
  );

/**
 * Generates an 8-week programme from the profile and the equipment. Deterministic: the same
 * inputs and seed always give the same programme. Every choice is recorded as a note.
 */
/** Each slot's exercise, by `sessionId/slotId`, as generated (before the user's edits). */
export const slotPicks = (programme: Programme): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const session of programme.generatedRotation ?? programme.rotation)
    for (const block of [...session.main, ...session.finisher])
      for (const item of block.type === 'straight' ? [block.item] : block.items)
        if (item.slot) out[`${session.id}/${item.slot}`] = item.exerciseId;
  return out;
};

/**
 * Last cycle's picks that new equipment leaves alone: a slot where the equipment bought (or
 * given up) since changes what a fresh programme picks takes the fresh pick instead.
 */
const keptPicks = (
  input: GenerateInput,
  exercises: readonly Exercise[],
): Readonly<Record<string, string>> | undefined => {
  const { lastCycle, lastCycleEquipment } = input;
  if (!lastCycle || !lastCycleEquipment || sameEquipment(lastCycleEquipment, input.equipment))
    return lastCycle;
  const fresh = (equipment: GenerateInput['equipment']) =>
    slotPicks(
      generateProgramme(
        {
          profile: input.profile,
          equipment,
          ...(input.seed !== undefined && { seed: input.seed }),
          ...(input.cycle !== undefined && { cycle: input.cycle }),
        },
        exercises,
      ),
    );
  const before = fresh(lastCycleEquipment);
  const now = fresh(input.equipment);
  return Object.fromEntries(Object.entries(lastCycle).filter(([key]) => before[key] === now[key]));
};

export const generateProgramme = (
  input: GenerateInput,
  exercises: readonly Exercise[] = defaultCatalogue,
): Programme => {
  const lastCycle = keptPicks(input, exercises);
  const ctx = makeContext(input, exercises, lastCycle);
  const { profile } = input;
  const split = splitFor(profile.daysPerWeek, profile.sessionMinutes);
  ctx.log.add('split', {
    daysPerWeek: profile.daysPerWeek,
    sessionMinutes: profile.sessionMinutes,
    templates: split.join(','),
    shortSessions: split[0] === 'full-a' && profile.daysPerWeek > 3,
  });
  ctx.log.add('dose', { goal: profile.goal, level: profile.level });

  const buildRotation = (keys: readonly TemplateKey[], strict: boolean): Session[] | null => {
    const state = newSelectionState();
    const logLength = ctx.log.notes.length;
    let letter = 0;
    const sessions: Session[] = [];
    // Short sessions keep a short finisher each. Otherwise, without a cardio day, sessions keep
    // their finisher until one has, so the week still has conditioning.
    const shortBudget = profile.goal !== 'muscle' && profile.sessionMinutes < SHORT_SESSION_MINUTES;
    let conditioningHeld = profile.goal === 'muscle' || keys.includes('cardio');
    for (const key of keys) {
      const tpl = template(key);
      const cardioDay = key === 'cardio';
      const code = cardioDay ? '' : (LETTERS[letter++] ?? 'X');
      const session = buildSession(tpl, ctx, state, {
        id: cardioDay ? 'cardio' : `${code.toLowerCase()}-${key}`,
        name: cardioDay
          ? tpl.title
          : { fr: `Séance ${code} — ${tpl.title.fr}`, en: `Session ${code} — ${tpl.title.en}` },
        budget: profile.sessionMinutes,
        ...(strict && !cardioDay ? { minMainBlocks: MIN_SPLIT_MAIN_BLOCKS } : {}),
        ...((conditioningHeld && !shortBudget) || cardioDay ? {} : { keepConditioning: true }),
      });
      if (session && hasCardioFinisher([session])) conditioningHeld = true;
      if (!session) {
        ctx.log.notes.length = logLength;
        ctx.log.add('split-replaced', { template: key, minBlocks: MIN_SPLIT_MAIN_BLOCKS });
        return null;
      }
      sessions.push(session);
    }
    return sessions;
  };

  // A split the equipment can't fill (e.g. a pull day with nothing to pull) becomes full body
  // on the same days, so the week stays balanced.
  const isSplit = !split.every((key) => key.startsWith('full-') || key === 'cardio');
  let full = 0;
  const rotation =
    buildRotation(split, isSplit) ??
    buildRotation(
      split.map((key) => (key === 'cardio' ? key : FULL_BODY[full++ % FULL_BODY.length]!)),
      false,
    )!;

  balancePushPull(rotation, ctx, profile.sessionMinutes);

  const maxTest = maxTestExercise(rotation, ctx);
  const phases = phasesFor({
    goal: profile.goal,
    level: profile.level,
    cardioFinishers: hasCardioFinisher(rotation),
    addedLoad: canAddLoad(rotation, ctx),
    cycle: ctx.cycle,
    ...(maxTest ? { maxTest: { exerciseId: maxTest.id, name: maxTest.name } } : {}),
  });
  if (maxTest) ctx.log.add('max-test', { exerciseId: maxTest.id });

  const { upper, lower } = increments(ctx);
  const seed = input.seed ?? 0;
  return {
    id:
      input.id ??
      `${profile.goal}-${profile.daysPerWeek}d-${PROGRAMME_WEEKS}w${seed ? `-${seed}` : ''}`,
    name: PROGRAMME_NAME[profile.goal],
    goal: profile.goal,
    weeks: PROGRAMME_WEEKS,
    sessionsPerWeek: profile.daysPerWeek,
    rotation,
    phases,
    progression: {
      kind: 'double-progression',
      upperBodyIncrementKg: upper,
      lowerBodyIncrementKg: lower,
    },
    generation: {
      version: GENERATOR_VERSION,
      profile,
      equipment: input.equipment,
      seed,
      ...(ctx.cycle > 1 && { cycle: ctx.cycle }),
      ...(input.lastCycle &&
        Object.keys(input.lastCycle).length > 0 && { lastCycle: { ...input.lastCycle } }),
      ...(input.lastCycle &&
        input.lastCycleEquipment && { lastCycleEquipment: input.lastCycleEquipment }),
      ...(input.upgrades &&
        Object.keys(input.upgrades).length > 0 && { upgrades: { ...input.upgrades } }),
      notes: ctx.log.notes,
    },
  };
};

/**
 * What a programme's cycle carries into a regeneration of it (new profile, equipment or seed):
 * its number, the exercises it rotated away from and its upgrades.
 */
export const cycleInputs = (
  generation: Generation | undefined,
): Pick<GenerateInput, 'cycle' | 'lastCycle' | 'lastCycleEquipment' | 'upgrades'> => ({
  ...(generation?.cycle && { cycle: generation.cycle }),
  ...(generation?.lastCycle && { lastCycle: generation.lastCycle }),
  ...(generation?.lastCycleEquipment && { lastCycleEquipment: generation.lastCycleEquipment }),
  ...(generation?.upgrades && { upgrades: generation.upgrades }),
});
