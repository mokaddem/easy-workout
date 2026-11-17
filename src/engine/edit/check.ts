import type { Block, Exercise, Muscle, Programme, Session, SessionItem } from '../../domain';
import { BLOCKING_CONCERNS, exerciseSafety, isMainLift } from '../generate/safety';
import { levelCap } from '../generate/select';
import { isSteadyCardio, loadContext, type EditContext } from './dose';
import { itemsOf, placedItems, type Section } from './slots';
import { isStrengthWork, MAJOR_GROUPS, MUSCLE_GROUPS } from '../volume';

/**
 * Something wrong with a session. `block`: it can't be saved or run as is (impossible or
 * unsafe). `warn`: a training-quality concern the user may dismiss.
 */
export interface Issue {
  level: 'block' | 'warn';
  code: IssueCode;
  ref?: { section: Section; blockIndex: number; itemIndex?: number; slot?: string };
  params?: Record<string, string | number>;
}

export type IssueCode =
  // Blocking
  | 'main-empty'
  | 'group-too-small'
  | 'range-invalid'
  | 'unknown-exercise'
  | 'no-equipment'
  | 'doorway-bar'
  | 'selector-swing'
  | 'cardio-in-group'
  // Warnings
  | 'rope-beginner'
  | 'no-fitting-load'
  | 'lead-not-main-lift'
  | 'warmup-in-main'
  | 'no-warmup'
  | 'above-level'
  | 'rir-zero-loaded'
  | 'rir-beginner'
  | 'short-rest-heavy'
  | 'many-sets'
  | 'session-volume'
  | 'muscle-volume'
  | 'repeat-exercise'
  | 'over-budget'
  | 'under-budget'
  | 'muscle-group-low'
  | 'push-pull';

/** Most sets of one block before it's flagged; the editor's steppers stop at {@link MAX_SETS}. */
export const MANY_SETS = 5;
export const MAX_SETS = 6;
/** Judgement thresholds for one session. */
const SESSION_HARD_SETS = 25;
const MUSCLE_SESSION_SETS = 12;
/** A session in the programme may run this far over its length, or this far under. */
const OVER_BUDGET = 1.25;
const UNDER_BUDGET = 0.5;
/** Heavy compounds need at least this rest between straight sets of this few reps. */
const HEAVY_REST_SEC = 60;
const HEAVY_REPS = 10;

const loaded = (item: SessionItem, exercise: Exercise) =>
  item.load?.kind === 'kg' || item.load?.kind === 'added-kg' || exercise.loadType === 'external';

const repBased = (item: SessionItem) => item.target.kind === 'reps' || item.target.kind === 'max';

/** Sets that count as training: main and finisher, cardio and drills aside. */
const hardSets = (block: Block, exercises: ReadonlyMap<string, Exercise>) =>
  itemsOf(block).filter((i) => {
    const e = exercises.get(i.exerciseId);
    return e && !isSteadyCardio(e) && !e.tags.includes('mobility');
  }).length * (block.type === 'straight' ? block.sets : block.rounds);

/** Everything wrong with one session, in order. */
export function sessionIssues(
  session: Session,
  ctx: EditContext,
  options: { inProgramme?: boolean } = {},
): Issue[] {
  const issues: Issue[] = [];
  const { level } = ctx.profile;
  const loads = loadContext(ctx);
  if (session.main.length === 0) issues.push({ level: 'block', code: 'main-empty' });

  for (const section of ['warmup', 'main', 'finisher'] as const)
    session[section].forEach((block, blockIndex) => {
      const count = block.type === 'straight' ? block.sets : block.rounds;
      const blockRef = { section, blockIndex };
      if (block.type === 'group' && block.items.length < 2)
        issues.push({ level: 'block', code: 'group-too-small', ref: blockRef });
      if (section !== 'warmup' && count > MANY_SETS)
        issues.push({ level: 'warn', code: 'many-sets', ref: blockRef, params: { sets: count } });
      itemsOf(block).forEach((item, itemIndex) => {
        const ref = { section, blockIndex, itemIndex, ...(item.slot && { slot: item.slot }) };
        const add = (lvl: Issue['level'], code: IssueCode, params?: Issue['params']) =>
          issues.push({ level: lvl, code, ref, ...(params && { params }) });
        const t = item.target;
        if ((t.kind === 'reps' && t.min > t.max) || (t.kind === 'time' && t.minSec > t.maxSec))
          add('block', 'range-invalid');
        const exercise = ctx.exercises.get(item.exerciseId);
        if (!exercise) return add('block', 'unknown-exercise');
        if (
          block.type === 'group' &&
          (isSteadyCardio(exercise) || t.kind === 'cardio' || t.kind === 'interval')
        )
          add('block', 'cardio-in-group');
        const { concern } = exerciseSafety(exercise, loads, section === 'warmup');
        if (concern) add(BLOCKING_CONCERNS.has(concern) ? 'block' : 'warn', concern);
        if (exercise.difficulty > levelCap(level, exercise))
          add('warn', 'above-level', { difficulty: exercise.difficulty });
        if (section === 'warmup') return;
        if (section === 'main' && exercise.pattern === 'mobility') add('warn', 'warmup-in-main');
        if (
          repBased(item) &&
          item.rir === 0 &&
          exercise.tags.includes('compound') &&
          loaded(item, exercise)
        )
          add('warn', 'rir-zero-loaded');
        else if (repBased(item) && level === 'beginner' && item.rir !== undefined && item.rir < 2)
          add('warn', 'rir-beginner');
        if (
          block.type === 'straight' &&
          t.kind === 'reps' &&
          t.max <= HEAVY_REPS &&
          block.restSec < HEAVY_REST_SEC &&
          exercise.tags.includes('compound') &&
          loaded(item, exercise)
        )
          add('warn', 'short-rest-heavy');
      });
    });

  const lead = session.main[0] && itemsOf(session.main[0])[0];
  const leadExercise = lead && ctx.exercises.get(lead.exerciseId);
  if (lead && leadExercise && !isSteadyCardio(leadExercise) && !isMainLift(leadExercise))
    issues.push({
      level: 'warn',
      code: 'lead-not-main-lift',
      ref: { section: 'main', blockIndex: 0, itemIndex: 0, ...(lead.slot && { slot: lead.slot }) },
    });

  const heavyMain = session.main.some((b) =>
    itemsOf(b).some((i) => {
      const e = ctx.exercises.get(i.exerciseId);
      return e && e.tags.includes('compound') && loaded(i, e);
    }),
  );
  if (heavyMain && session.warmup.length === 0) issues.push({ level: 'warn', code: 'no-warmup' });

  const work = [...session.main, ...session.finisher];
  const total = work.reduce((sum, b) => sum + hardSets(b, ctx.exercises), 0);
  if (total > SESSION_HARD_SETS)
    issues.push({ level: 'warn', code: 'session-volume', params: { sets: total } });
  for (const [muscle, sets] of muscleSets(work, ctx.exercises))
    if (sets > MUSCLE_SESSION_SETS)
      issues.push({ level: 'warn', code: 'muscle-volume', params: { muscle, sets } });

  const seen = new Map<string, Issue['ref']>();
  for (const { section, blockIndex, itemIndex, item } of placedItems(session)) {
    if (section === 'warmup') continue;
    if (seen.has(item.exerciseId))
      issues.push({
        level: 'warn',
        code: 'repeat-exercise',
        ref: { section, blockIndex, itemIndex, ...(item.slot && { slot: item.slot }) },
        params: { exerciseId: item.exerciseId },
      });
    else seen.set(item.exerciseId, { section, blockIndex, itemIndex });
  }

  if (options.inProgramme) {
    const budget = ctx.profile.sessionMinutes;
    if (session.estimatedMinutes > budget * OVER_BUDGET)
      issues.push({
        level: 'warn',
        code: 'over-budget',
        params: { minutes: session.estimatedMinutes, budget },
      });
    else if (session.estimatedMinutes < budget * UNDER_BUDGET)
      issues.push({
        level: 'warn',
        code: 'under-budget',
        params: { minutes: session.estimatedMinutes, budget },
      });
  }
  return issues;
}

/** Hard sets per primary muscle. */
function muscleSets(
  blocks: readonly Block[],
  exercises: ReadonlyMap<string, Exercise>,
  counts: (exercise: Exercise) => boolean = () => true,
): Map<Muscle, number> {
  const out = new Map<Muscle, number>();
  for (const block of blocks) {
    const count = block.type === 'straight' ? block.sets : block.rounds;
    for (const item of itemsOf(block)) {
      const e = exercises.get(item.exerciseId);
      if (!e || isSteadyCardio(e) || e.tags.includes('mobility') || !counts(e)) continue;
      for (const m of e.primaryMuscles) out.set(m, (out.get(m) ?? 0) + count);
    }
  }
  return out;
}

/** Identifies an issue across edits: what it is, on which slot, about which muscle or group. */
export const issueKey = (i: Issue) =>
  `${i.code}|${i.ref?.slot ?? ''}|${i.params?.muscle ?? i.params?.group ?? ''}`;

/**
 * Issues the user's changes caused: those the generated session (`base`) didn't already have.
 * Without a base (a session of the user's own), every issue.
 */
export function checkSession(
  session: Session,
  ctx: EditContext,
  options: { base?: Session; inProgramme?: boolean } = {},
): Issue[] {
  const issues = sessionIssues(session, ctx, options);
  if (!options.base) return issues;
  const before = new Set(sessionIssues(options.base, ctx, options).map(issueKey));
  return issues.filter((i) => !before.has(issueKey(i)));
}

/** Fewer hard sets a week than this for a major group is flagged (judgement). */
const WEEKLY_GROUP_FLOOR = 4;
/** More pushing than this many times the pulling is flagged. */
const PUSH_PULL_RATIO = 2;
const PUSH = new Set(['push-horizontal', 'push-vertical']);
const PULL = new Set(['pull-horizontal', 'pull-vertical']);

function weeklyIssues(programme: Programme, ctx: EditContext): Issue[] {
  const perRun = programme.sessionsPerWeek / programme.rotation.length;
  const groups = new Map<string, number>();
  let push = 0;
  let pull = 0;
  for (const session of programme.rotation) {
    const work = [...session.main, ...session.finisher];
    const sets = muscleSets(work, ctx.exercises, isStrengthWork);
    for (const group of MAJOR_GROUPS) {
      const most = Math.max(0, ...MUSCLE_GROUPS[group].map((m) => sets.get(m) ?? 0));
      groups.set(group, (groups.get(group) ?? 0) + most * perRun);
    }
    for (const block of work) {
      const count = block.type === 'straight' ? block.sets : block.rounds;
      for (const item of itemsOf(block)) {
        const pattern = ctx.exercises.get(item.exerciseId)?.pattern;
        if (pattern && PUSH.has(pattern)) push += count * perRun;
        if (pattern && PULL.has(pattern)) pull += count * perRun;
      }
    }
  }
  const issues: Issue[] = [];
  for (const [group, sets] of groups)
    if (sets < WEEKLY_GROUP_FLOOR)
      issues.push({
        level: 'warn',
        code: 'muscle-group-low',
        params: { group, sets: Math.round(sets) },
      });
  if (push > 0 && push > PUSH_PULL_RATIO * pull)
    issues.push({
      level: 'warn',
      code: 'push-pull',
      params: { push: Math.round(push), pull: Math.round(pull) },
    });
  return issues;
}

/**
 * Week-level warnings the user's changes caused: a major muscle group left with too little work,
 * or far more pushing than pulling. Only those the generated rotation didn't already have.
 */
export function checkProgramme(programme: Programme, ctx: EditContext): Issue[] {
  const issues = weeklyIssues(programme, ctx);
  if (!programme.generatedRotation) return issues;
  const before = new Set(
    weeklyIssues({ ...programme, rotation: programme.generatedRotation }, ctx).map(issueKey),
  );
  return issues.filter((i) => !before.has(issueKey(i)));
}
