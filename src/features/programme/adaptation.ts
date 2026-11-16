import type { TFunction } from 'i18next';
import type {
  Answer,
  SetAdjustments,
  Language,
  Load,
  ProgressionNote,
  Session,
  SessionItem,
  SessionLog,
} from '@/domain';
import { itemKey, playSteps, setGoal, type Prescribed, type Proposal } from '@/engine';
import { changeTag, parseToken, tokenOf, type ChangeTagData, type ParsedToken } from '../adapt';

/** The goal of an exercise's first set and of the others (they differ in intensity weeks). */
export interface ItemGoals {
  first: number;
  rest: number;
  sets: number;
}

/** Goals set by set, by item key, from the steps the player will run. */
export function itemGoals(
  session: Pick<Session, 'warmup' | 'main' | 'finisher'>,
  adjustments?: SetAdjustments,
): Record<string, ItemGoals> {
  const out: Record<string, ItemGoals> = {};
  const seen: Record<string, Map<number, number>> = {};
  for (const step of playSteps(session, adjustments)) {
    if (step.section === 'warmup' || step.side === 'right') continue;
    const goal = setGoal(step.planned);
    if (goal === undefined) continue;
    const key = itemKey(step.section, step.blockIndex, step.itemIndex);
    (seen[key] ??= new Map()).set(step.set, goal);
    const goals = seen[key]!;
    const first = goals.get(1) ?? goal;
    out[key] = { first, rest: goals.get(2) ?? first, sets: step.sets };
  }
  return out;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

const loadOf = (token: ParsedToken | undefined): Load | undefined => {
  if (!token) return undefined;
  switch (token.kind) {
    case 'kg':
      return { kind: 'kg', kg: token.kg };
    case 'added':
      return { kind: 'added-kg', kg: token.kg };
    case 'band':
      return { kind: 'band', level: token.level };
    case 'bw':
      return { kind: 'bodyweight' };
  }
};

/** The pill that says what moved since the last session, read from the note's own numbers. */
export function noteTag(
  t: TFunction,
  lang: Language,
  note: ProgressionNote | undefined,
  item: SessionItem,
  assisted: boolean,
): ChangeTagData | undefined {
  if (!note) return undefined;
  const p = note.params;
  if (note.code === 'tempo-slower') return changeTagSlower(t);
  const target = item.target;
  const make = (before: Partial<Prescribed>, after: Partial<Prescribed>) =>
    changeTag(t, lang, { target, ...before }, { target, ...after }, { assisted });

  const to = str(p.to) ?? (note.code === 'added-load-start' ? str(p.load) : undefined);
  const from = str(p.from) ?? (note.code === 'added-load-start' ? 'bw' : undefined);
  const lb = loadOf(parseToken(from));
  const la = loadOf(parseToken(to));
  if (lb && la && tokenOf(lb) !== tokenOf(la)) return make({ load: lb }, { load: la });

  const fromGoal = num(p.from);
  const toGoal = num(p.to);
  if (fromGoal !== undefined && toGoal !== undefined)
    return make({ goal: fromGoal }, { goal: toGoal });
  if (note.code === 'beyond-range') {
    const last = num(p.reps) ?? num(p.seconds);
    const goal = num(p.goal);
    if (last !== undefined && goal !== undefined) return make({ goal: last }, { goal });
  }
  return undefined;
}

const changeTagSlower = (t: TFunction): ChangeTagData => ({
  icon: 'turtle',
  text: t('adapt.detail.tag.slower'),
});

/** The latest swap answer for each original exercise that has not been undone by a later "back". */
export function swapAnswerFor(answers: readonly Answer[], originalId: string): Answer | undefined {
  const mine = answers
    .filter((a) => a.exerciseId === originalId && (a.answer === 'swap' || a.answer === 'back'))
    .sort((a, b) => a.at.localeCompare(b.at));
  const last = mine.at(-1);
  return last?.answer === 'swap' ? last : undefined;
}

/** The pending-pain proposal of an exercise, if the item's note is the lighter-while-waiting one. */
export function pendingPainFor(
  note: ProgressionNote | undefined,
  proposals: readonly Proposal[],
  exerciseId: string,
): Proposal | undefined {
  if (note?.code !== 'pain-lighter' || note.params.pending === false) return undefined;
  return proposals.find((p) => p.kind === 'pain' && p.exerciseId === exerciseId);
}

/** The break notice of a session: the first welcome-back / goal-eased note, with its days. */
export function breakNotice(
  notes: Record<string, ProgressionNote>,
): { key: 'eased' | 'stepped' | 'long'; days: number } | undefined {
  const found = Object.values(notes).find(
    (n) => n.code === 'goal-eased' || n.code === 'welcome-back',
  );
  if (!found) return undefined;
  const days = num(found.params.days) ?? 0;
  if (found.code === 'welcome-back' && days > 84) return { key: 'long', days };
  if (found.code === 'welcome-back' || days > 28) return { key: 'stepped', days };
  return { key: 'eased', days };
}

/* ------------------------------------------------------------------ decisions */

const KIND_ORDER: Record<Proposal['kind'], number> = {
  pain: 0,
  'no-equipment': 1,
  assisted: 2,
  easier: 3,
  harder: 4,
};

export { proposalKey } from '@/features/adapt';

/** In the next session first, then pain, no equipment, assisted, easier, harder. */
export function orderProposals(
  proposals: readonly Proposal[],
  inNext: ReadonlySet<string>,
): Proposal[] {
  const rank = (p: Proposal) => (inNext.has(p.exerciseId) ? 0 : 1) * 10 + KIND_ORDER[p.kind];
  return proposals
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .map(({ p }) => p);
}

/** Exercise ids of every item of a session (what "in your next session" is checked against). */
export function exerciseIds(session: Pick<Session, 'warmup' | 'main' | 'finisher'>): Set<string> {
  const ids = new Set<string>();
  for (const section of ['warmup', 'main', 'finisher'] as const)
    for (const block of session[section])
      for (const item of block.type === 'straight' ? [block.item] : block.items)
        ids.add(item.exerciseId);
  return ids;
}

export interface NudgeText {
  /** Sub line: the one in the next session, else up to two names and "n more". */
  kind: 'one' | 'names';
  names: string[];
  more: number;
}

/** Which names the decisions nudge shows: one in the next session first, else up to two. */
export function nudgeNames(
  ordered: readonly Proposal[],
  inNext: ReadonlySet<string>,
  nameOf: (id: string) => string,
): NudgeText {
  const ids = [...new Set(ordered.map((p) => p.exerciseId))];
  const first = ordered[0];
  if (first && inNext.has(first.exerciseId))
    return { kind: 'one', names: [nameOf(first.exerciseId)], more: 0 };
  const shown = ids.slice(0, 2).map(nameOf);
  return { kind: 'names', names: shown, more: Math.max(0, ids.length - shown.length) };
}

/** What a card can say about the session that raised its proposal. */
export function proposalFacts(
  proposal: Proposal,
  log: SessionLog | undefined,
  inNext: boolean,
): {
  done?: number;
  total?: number;
  atLoad?: string;
  sets?: number;
  reps?: number;
  min?: number;
  goal?: number;
  time?: boolean;
  inNextSession?: boolean;
} {
  const facts: ReturnType<typeof proposalFacts> = inNext ? { inNextSession: true } : {};
  if (!log) return facts;
  const sets = log.sets.filter((s) => s.exerciseId === proposal.exerciseId);
  const done = sets.filter((s) => s.actual && s.flag !== 'pain');
  const target = sets[0]?.planned.target;
  const time = target?.kind === 'time';
  if (time) facts.time = true;
  if (proposal.kind === 'pain' || proposal.kind === 'no-equipment') {
    facts.done = done.length;
    facts.total = sets.length;
    if (proposal.kind === 'pain' && proposal.repeated) {
      const load = done.at(-1)?.actual?.load ?? sets[0]?.planned.load;
      if (load) facts.atLoad = tokenOf(load);
    }
  } else if (proposal.kind === 'harder') {
    const values = done.map((s) => (time ? s.actual?.durationSec : s.actual?.reps));
    const reached = values.filter((v): v is number => v !== undefined);
    if (reached.length > 0) {
      facts.sets = reached.length;
      facts.reps = Math.min(...reached);
    }
  } else if (proposal.kind === 'assisted') {
    const first = done[0]?.actual?.reps;
    const goal = sets[0] ? setGoal(sets[0].planned) : undefined;
    if (first !== undefined && goal !== undefined) {
      facts.reps = first;
      facts.goal = goal;
    }
  } else if (target?.kind === 'reps') facts.min = target.min;
  else if (target?.kind === 'time') facts.min = target.minSec;
  return facts;
}
