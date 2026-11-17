import type { Exercise, Language, MovementPattern, Programme, Session, SessionLog } from '@/domain';
import {
  generatedSession,
  isSteadyCardio,
  itemsOf,
  placesOf,
  removeItem,
  type Issue,
  type QuickFocus,
} from '@/engine';

const PUSH = new Set<MovementPattern>([
  'push-horizontal',
  'push-vertical',
  'chest-isolation',
  'shoulder-isolation',
  'elbow-extension',
]);
const PULL = new Set<MovementPattern>([
  'pull-horizontal',
  'pull-vertical',
  'elbow-flexion',
  'shrug',
]);
const LOWER = new Set<MovementPattern>([
  'squat',
  'hinge',
  'lunge',
  'hip-extension',
  'hip-abduction',
  'knee-flexion',
  'calf-raise',
]);
const CORE = new Set<MovementPattern>([
  'core-anti-extension',
  'core-anti-lateral',
  'core-flexion',
  'core-rotation',
  'spinal-extension',
]);

/** The focus that best names a session, from what its main part trains. */
export function sessionFocus(
  session: Session,
  exercises: ReadonlyMap<string, Exercise>,
): QuickFocus {
  const groups = new Set<'push' | 'pull' | 'lower' | 'core'>();
  let cardio = false;
  for (const block of session.main)
    for (const item of itemsOf(block)) {
      const exercise = exercises.get(item.exerciseId);
      if (!exercise || exercise.tags.includes('warmup') || exercise.tags.includes('mobility'))
        continue;
      if (isSteadyCardio(exercise) || item.target.kind === 'interval') cardio = true;
      else if (PUSH.has(exercise.pattern)) groups.add('push');
      else if (PULL.has(exercise.pattern)) groups.add('pull');
      else if (LOWER.has(exercise.pattern)) groups.add('lower');
      else if (CORE.has(exercise.pattern)) groups.add('core');
      else cardio = true;
    }
  if (groups.size === 0) return cardio ? 'cardio' : 'full';
  const upper = groups.has('push') || groups.has('pull');
  if (groups.has('lower') && upper) return 'full';
  if (groups.has('lower')) return 'lower';
  if (groups.has('push') && groups.has('pull')) return 'upper';
  if (groups.has('push')) return 'push';
  if (groups.has('pull')) return 'pull';
  return 'core';
}

/**
 * When a session of the user's own was last done: on its own, or in the active programme in a
 * place it runs in (a run of that place counts only when it ran this session — its name — not
 * the programme's own session from before it was placed).
 */
export function lastDone(
  logs: readonly SessionLog[],
  custom: Pick<Session, 'id' | 'name'>,
  placed?: { programmeId: string; sessionIds: readonly string[] },
): Date | undefined {
  let latest: number | undefined;
  for (const log of logs) {
    if (log.status !== 'completed') continue;
    const source = log.source;
    const mine =
      (source.kind === 'custom' && source.sessionId === custom.id) ||
      (source.kind === 'programme' &&
        !!placed &&
        source.programmeId === placed.programmeId &&
        placed.sessionIds.includes(source.sessionId) &&
        log.plan.name.fr === custom.name.fr);
    if (!mine) continue;
    const at = Date.parse(log.endedAt ?? log.startedAt);
    if (latest === undefined || at > latest) latest = at;
  }
  return latest === undefined ? undefined : new Date(latest);
}

export type When =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'days'; count: number }
  | { kind: 'date'; date: Date };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** A day, said relative to today; older than a month it becomes a date. */
export function whenDone(at: Date, now: Date): When {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days <= 0) return { kind: 'today' };
  if (days === 1) return { kind: 'yesterday' };
  if (days < 30) return { kind: 'days', count: days };
  return { kind: 'date', date: at };
}

/** Newest used first: last done, else last saved. */
export function sortRows<T extends { lastDone: Date | undefined; updatedAt: number }>(
  rows: readonly T[],
): T[] {
  const key = (r: T) => Math.max(r.lastDone?.getTime() ?? 0, r.updatedAt);
  return [...rows].sort((a, b) => key(b) - key(a));
}

/** Up to five rows as they are; beyond that the four most recent and a link to all of them. */
export const MAX_SHOWN = 5;
export function trimRows<T>(rows: readonly T[]): { shown: T[]; total: number; trimmed: boolean } {
  const trimmed = rows.length > MAX_SHOWN;
  return { shown: rows.slice(0, trimmed ? MAX_SHOWN - 1 : MAX_SHOWN), total: rows.length, trimmed };
}

export const UNUSABLE_CODES: ReadonlySet<Issue['code']> = new Set([
  'no-equipment',
  'doorway-bar',
  'selector-swing',
  'unknown-exercise',
]);

/** Block issues that mean an exercise can't be done with today's equipment. */
export const unusableIssues = (issues: readonly Issue[]): Issue[] =>
  issues.filter((i) => i.level === 'block' && UNUSABLE_CODES.has(i.code) && i.ref);

/** The session without the exercises at these issues' places; null when nothing would be left to do. */
export function withoutUnusable(session: Session, issues: readonly Issue[]): Session | null {
  const order = { warmup: 0, main: 1, finisher: 2 } as const;
  const places = unusableIssues(issues)
    .map((i) => i.ref!)
    .filter((r) => r.itemIndex !== undefined)
    .sort(
      (a, b) =>
        order[b.section] - order[a.section] ||
        b.blockIndex - a.blockIndex ||
        (b.itemIndex ?? 0) - (a.itemIndex ?? 0),
    );
  let next = session;
  for (const ref of places)
    next = removeItem(next, {
      section: ref.section,
      blockIndex: ref.blockIndex,
      itemIndex: ref.itemIndex ?? 0,
    });
  return next.main.length === 0 ? null : next;
}

export interface PlaceChoice {
  sessionId: string;
  letter: string;
  /** Name of the generated session that would be replaced. */
  name: string;
  minutes: number;
  isNext: boolean;
  sameFocus: boolean;
  /** Another of the user's sessions already holds the place. */
  takenBy: string | undefined;
}

/**
 * The rotation places a session can take: every one but the cardio day and those it already
 * holds. `isCardio` and `title` come from the programme screens' own naming.
 */
export function placeChoices(input: {
  programme: Programme;
  customId: string;
  focus: QuickFocus;
  nextSessionId: string | undefined;
  lang: Language;
  focusOf: (generated: Session) => QuickFocus;
  isCardio: (session: Session) => boolean;
  title: (generated: Session) => string;
}): PlaceChoice[] {
  const { programme } = input;
  const held = new Set(placesOf(programme, input.customId));
  const out: PlaceChoice[] = [];
  let letterIndex = 0;
  for (const entry of programme.rotation) {
    const generated = generatedSession(programme, entry.id) ?? entry;
    if (input.isCardio(generated)) continue;
    const letter = String.fromCharCode(65 + letterIndex++);
    if (held.has(entry.id)) continue;
    const owner = programme.placements?.[entry.id];
    out.push({
      sessionId: entry.id,
      letter,
      name: input.title(generated),
      minutes: generated.estimatedMinutes,
      isNext: entry.id === input.nextSessionId,
      sameFocus: input.focusOf(generated) === input.focus,
      takenBy: owner && owner !== input.customId ? owner : undefined,
    });
  }
  return out;
}
