import type { TFunction } from 'i18next';
import { exerciseById } from '@/catalogue';
import { BAND_LEVELS } from '@/domain';
import type { BandLevel, Exercise, Language, Load, ProgressionNote, Target } from '@/domain';
import type { Prescribed } from '@/engine';
import type { IconName } from '@/ui/components';

const NBSP = ' ';
const MINUS = '−';

export const numberText = (value: number, lang: Language): string =>
  new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value);

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

export const capFirst = (text: string, lang: Language) =>
  text.charAt(0).toLocaleUpperCase(lang) + text.slice(1);

/** "Developpé militaire" by language; the id itself when the exercise is unknown. */
export const exerciseName = (id: string, lang: Language): string =>
  exerciseById.get(id)?.name[lang] ?? id;

/* ------------------------------------------------------------------ load tokens */

export type ParsedToken =
  | { kind: 'kg'; kg: number }
  | { kind: 'added'; kg: number }
  | { kind: 'band'; level: BandLevel }
  | { kind: 'bw' };

/** `kg:12`, `added:5`, `band:heavy`, `bw` (what the engine writes in note params). */
export function parseToken(token: string | undefined): ParsedToken | undefined {
  if (token === undefined) return undefined;
  if (token === 'bw') return { kind: 'bw' };
  const [kind, value] = token.split(':');
  if ((kind === 'kg' || kind === 'added') && value !== undefined && num(value) !== undefined)
    return { kind, kg: Number(value) };
  if (kind === 'band' && BAND_LEVELS.includes(value as BandLevel))
    return { kind, level: value as BandLevel };
  return undefined;
}

/** The token of a domain load, the same way the engine writes it. */
export const tokenOf = (load: Load | undefined): string => {
  if (!load || load.kind === 'bodyweight') return 'bw';
  if (load.kind === 'band') return `band:${load.level}`;
  return `${load.kind === 'kg' ? 'kg' : 'added'}:${load.kg}`;
};

const kgText = (kg: number, lang: Language) => `${numberText(kg, lang)}${NBSP}kg`;
export const secondsText = (seconds: number, lang: Language) =>
  `${numberText(seconds, lang)}${NBSP}s`;

/** Lower-case band level word: "fort", "heavy". */
export const bandWord = (t: TFunction, lang: Language, level: BandLevel): string =>
  t(`labels.band.${level}`).toLocaleLowerCase(lang);

/** A load for people: `kg:12` → "12 kg", `added:5` → "+5 kg", the band, the bodyweight word. */
export function loadText(t: TFunction, lang: Language, token: string | undefined): string {
  const parsed = parseToken(token);
  if (!parsed || parsed.kind === 'bw') return t('adapt.summary.bodyweight');
  if (parsed.kind === 'kg') return kgText(parsed.kg, lang);
  if (parsed.kind === 'added') return `+${kgText(parsed.kg, lang)}`;
  return t(`labels.bandLoad.${parsed.level}`);
}

/** The kilograms of a kg / added token without a sign: "5 kg". */
const plainKg = (lang: Language, token: string | undefined): string | undefined => {
  const parsed = parseToken(token);
  return parsed && (parsed.kind === 'kg' || parsed.kind === 'added')
    ? kgText(parsed.kg, lang)
    : undefined;
};

/** Signed difference between two kg (or added) tokens: "+2 kg", "−2 kg". */
export function deltaText(
  lang: Language,
  from: string | undefined,
  to: string | undefined,
): string | undefined {
  const a = parseToken(from);
  const b = parseToken(to);
  const kgOf = (p: ParsedToken | undefined) =>
    p?.kind === 'kg' || p?.kind === 'added' ? p.kg : p?.kind === 'bw' ? 0 : undefined;
  const x = kgOf(a);
  const y = kgOf(b);
  if (x === undefined || y === undefined || a?.kind === 'band' || b?.kind === 'band')
    return undefined;
  const d = Math.round((y - x) * 100) / 100;
  if (d === 0) return undefined;
  return `${d > 0 ? '+' : MINUS}${kgText(Math.abs(d), lang)}`;
}

export const repsText = (t: TFunction, count: number): string =>
  t('adapt.evidence.reps', { count });

/* ------------------------------------------------------------------ evidence */

export interface EvidenceInput {
  /** Reps (or seconds for holds) of each set done. */
  values: number[];
  load?: string;
  time?: boolean;
  feel?: 'easy' | 'hard';
}

/** "5 × 10 reps at 10 kg", "14, 14, 13 reps at 10 kg", "3 × 40 s held" (+ feel). */
export function evidenceText(t: TFunction, lang: Language, input: EvidenceInput): string {
  const { values } = input;
  if (values.length === 0) return '';
  const first = values[0]!;
  const same = values.every((v) => v === first);
  const parsed = parseToken(input.load);
  let text: string;
  if (input.time) {
    text = t('adapt.evidence.holds', { sets: values.length, seconds: numberText(first, lang) });
  } else {
    const withLoad = parsed && (parsed.kind === 'kg' || parsed.kind === 'added');
    const load = withLoad ? loadText(t, lang, input.load) : undefined;
    if (same) {
      text = load
        ? t('adapt.evidence.same', { sets: values.length, reps: repsText(t, first), load })
        : t('adapt.evidence.sameBare', { sets: values.length, reps: repsText(t, first) });
    } else {
      const list = values.join(', ');
      text = load
        ? t('adapt.evidence.variedLoad', { values: list, load })
        : t('adapt.evidence.variedBare', { count: values.length, values: list });
    }
    if (parsed?.kind === 'band')
      text = t('adapt.evidence.band', { evidence: text, band: loadText(t, lang, input.load) });
  }
  if (input.feel === 'easy') text += t('adapt.evidence.feelEasy');
  if (input.feel === 'hard') text += t('adapt.evidence.feelHard');
  return text;
}

/** The evidence a note's own params carry (sets, reps or seconds, load), when it has any. */
function evidenceFromNote(t: TFunction, lang: Language, note: ProgressionNote): string | undefined {
  const sets = num(note.params.sets);
  if (!sets || sets < 1) return undefined;
  const seconds = num(note.params.seconds);
  const reps = num(note.params.reps);
  const value = seconds ?? reps;
  if (value === undefined) return undefined;
  return evidenceText(t, lang, {
    values: Array<number>(sets).fill(value),
    ...(str(note.params.load) !== undefined && { load: str(note.params.load)! }),
    ...(seconds !== undefined && { time: true }),
  });
}

/* ------------------------------------------------------------------ notes */

/** What a note's wording may need that the note itself doesn't carry. All optional. */
export interface NoteContext {
  exerciseId?: string;
  /** Bottom and top of the item's range (reps, or seconds for timed holds). */
  min?: number;
  max?: number;
  /** The item's goal, when the note's params don't carry it. */
  goal?: number;
  /** Highest goal of the stage, for "up to". */
  cap?: number;
  /** Load token before the change, for notes that only carry the new one. */
  from?: string;
  to?: string;
  time?: boolean;
  /** Localized implement for an added load: "gilet lesté". */
  implement?: string;
  rounds?: number;
  /** Ready-made evidence ("5 × 10 reps at 10 kg"), replacing the one derived from the params. */
  evidence?: string;
  /** Localized date, for notes that name one. */
  date?: string;
  /** Chips only: the set is not the first of the exercise. */
  later?: boolean;
}

/** Whether the item's progression is worth a line (moved, or held for a reason worth knowing). */
export const showsWhy = (note: ProgressionNote | undefined): boolean =>
  !!note && !['hold', 'confirm-new-load', 'swapped-in'].includes(note.code);

interface Resolved {
  p: ProgressionNote['params'];
  from?: string;
  to?: string;
  goal?: number;
  time: boolean;
  exercise?: Exercise;
  amount: (n: number) => string;
  min: string;
  assisted: boolean;
}

function resolve(t: TFunction, lang: Language, note: ProgressionNote, ctx: NoteContext): Resolved {
  const p = note.params;
  const time = ctx.time ?? (p.seconds !== undefined || note.code.startsWith('time-'));
  const amount = (n: number) => (time ? secondsText(n, lang) : repsText(t, n));
  const exercise = ctx.exerciseId ? exerciseById.get(ctx.exerciseId) : undefined;
  const goal = ctx.goal ?? num(p.goal) ?? num(p.to);
  const from = str(p.from) ?? ctx.from;
  const to = str(p.to) ?? str(p.load) ?? ctx.to;
  return {
    p,
    ...(from !== undefined && { from }),
    ...(to !== undefined && { to }),
    ...(goal !== undefined && { goal }),
    time,
    ...(exercise && { exercise }),
    amount,
    min: ctx.min !== undefined ? amount(ctx.min) : t('adapt.why.minFallback'),
    assisted: exercise?.loadType === 'band-assisted',
  };
}

const bandOf = (t: TFunction, lang: Language, token: string | undefined) => {
  const parsed = parseToken(token);
  return parsed?.kind === 'band' ? bandWord(t, lang, parsed.level) : '';
};

const usesDumbbell = (exercise: Exercise | undefined) =>
  !!exercise?.equipment.some((set) => set.some((r) => r.kind === 'dumbbell'));

/** The reason as the summary row shows it (also after the evidence in session detail). */
export function noteReason(
  t: TFunction,
  lang: Language,
  note: ProgressionNote,
  ctx: NoteContext = {},
): string | undefined {
  const r = resolve(t, lang, note, ctx);
  const goalText = r.goal !== undefined ? r.amount(r.goal) : undefined;
  const goalClause = (value = goalText) =>
    value !== undefined ? t('adapt.why.goalClause', { goal: value }) : '';
  const capClause =
    ctx.cap !== undefined ? t('adapt.why.capClause', { cap: r.amount(ctx.cap) }) : '';
  const toText = r.to !== undefined ? loadText(t, lang, r.to) : '';
  const fromText = r.from !== undefined ? loadText(t, lang, r.from) : undefined;
  const days = num(r.p.days) ?? 0;

  switch (note.code) {
    case 'load-up':
      return t('adapt.why.loadUp.reason', { goalClause: goalClause() });
    case 'load-up-low':
      return goalText !== undefined
        ? t('adapt.why.loadUpLow.reason', { goal: goalText })
        : t('adapt.why.loadUpLow.reasonNoGoal');
    case 'load-down':
      return t('adapt.why.loadDown.reason', { min: r.min });
    case 'reps-up': {
      const easy = (num(r.p.to) ?? 0) - (num(r.p.from) ?? 0) >= 2;
      return t(easy ? 'adapt.why.repsUp.reasonEasy' : 'adapt.why.repsUp.reason');
    }
    case 'hold':
      return t('adapt.why.hold.reason');
    case 'hold-miss':
      return r.time
        ? t('adapt.why.holdMiss.reasonTime', { min: r.min })
        : t('adapt.why.holdMiss.reason', { min: r.min });
    case 'hold-pain':
      return t('adapt.why.holdPain.reason', { n: num(r.p.painFree) ?? 0 });
    case 'pain-lighter': {
      const pending = r.p.pending !== false;
      const easy = r.to === undefined || r.to === 'bw' || r.to === r.from;
      if (easy)
        return t(
          pending
            ? 'adapt.why.painLighter.reasonBodyweight'
            : 'adapt.why.painLighter.reasonBodyweightChosen',
        );
      if (!pending) return t('adapt.why.painLighter.reasonChosen', { to: toText });
      return fromText !== undefined
        ? t('adapt.why.painLighter.reason', { to: toText, from: fromText })
        : t('adapt.why.painLighter.reasonNoFrom', { to: toText });
    }
    case 'calibrated':
      return t('adapt.why.calibrated.reason');
    case 'beyond-range':
      return t(
        str(r.p.load) === 'bw' && !r.time
          ? 'adapt.why.beyondRange.reasonBodyweight'
          : 'adapt.why.beyondRange.reason',
        { capClause },
      );
    case 'tempo-slower':
      return t('adapt.why.tempoSlower.reason', { down: num(r.p.down) ?? 3, min: r.min });
    case 'band-heavier':
      return r.assisted
        ? t('adapt.why.bandHeavierAssisted.reason', {
            min: r.min,
            band: bandOf(t, lang, r.to),
          })
        : t('adapt.why.bandHeavier.reason', { min: r.min });
    case 'band-lighter':
      return r.assisted
        ? t('adapt.why.bandLighterAssisted.reason', {
            band: bandOf(t, lang, r.to),
            goalClause: goalClause(r.min),
          })
        : t('adapt.why.bandLighter.reason', { min: r.min });
    case 'added-load-start':
      return t('adapt.why.addedLoadStart.reason', {
        to: plainKg(lang, r.to) ?? toText,
        min: r.min,
        implementClause: ctx.implement
          ? t('adapt.why.addedLoadStart.implementClause', { implement: ctx.implement })
          : '',
      });
    case 'welcome-back':
      return t('adapt.why.welcomeBack.reason', { min: r.min });
    case 'goal-eased':
      return t(r.time ? 'adapt.why.goalEased.reasonTime' : 'adapt.why.goalEased.reason', { days });
    case 'load-snapped':
      return fromText !== undefined
        ? t('adapt.why.loadSnapped.reason', { from: fromText, to: toText })
        : t('adapt.why.loadSnapped.reasonNoFrom', { to: toText });
    case 'your-load':
      return fromText !== undefined
        ? t('adapt.why.yourLoad.reason', { from: fromText, to: toText })
        : t('adapt.why.yourLoad.reasonNoFrom', { to: toText });
    case 'work-longer':
      return t('adapt.why.workLonger.reason', {
        to: secondsText(num(r.p.to) ?? 0, lang),
        roundsClause:
          ctx.rounds !== undefined
            ? t('adapt.why.workLonger.roundsClause', { rounds: ctx.rounds })
            : '',
      });
    case 'work-shorter':
      return t('adapt.why.workShorter.reason', { to: secondsText(num(r.p.to) ?? 0, lang) });
    case 'from-history':
      return ctx.evidence !== undefined && ctx.date !== undefined
        ? t('adapt.why.fromHistory.reason', { evidence: ctx.evidence, date: ctx.date })
        : t('adapt.why.fromHistory.reasonShort');
    case 'from-test': {
      const date = str(r.p.date);
      const test = num(r.p.test);
      if (test === undefined || r.goal === undefined || date === undefined) return undefined;
      return t('adapt.why.fromTest.reason', {
        date: new Date(`${date}T12:00:00`).toLocaleDateString(lang, {
          day: 'numeric',
          month: 'long',
        }),
        test: r.amount(test),
        from: r.amount(num(r.p.from) ?? 0),
        to: r.amount(r.goal),
      });
    }
    case 'buy-next':
      return t('adapt.why.buyNext.reason');
    case 'ladder-end':
      return t('adapt.why.ladderEnd.reason');
    case 'confirm-new-load':
      return t('adapt.why.confirmNewLoad.reason');
    case 'time-up':
      return t('adapt.why.timeUp.reason', {
        delta: (num(r.p.to) ?? 0) - (num(r.p.from) ?? 0),
      });
    case 'time-down':
      return t('adapt.why.timeDown.reason', {
        min: r.min,
        to: secondsText(num(r.p.to) ?? 0, lang),
      });
    case 'swapped-in':
      return t('adapt.why.swappedIn.reason');
    default:
      return undefined;
  }
}

/** Session detail: "Last time, 5 × 10 reps at 10 kg. <reason>". */
export function noteDetail(
  t: TFunction,
  lang: Language,
  note: ProgressionNote,
  ctx: NoteContext = {},
): string | undefined {
  const reason = noteReason(t, lang, note, ctx);
  if (!reason) return undefined;
  const evidence = ctx.evidence ?? evidenceFromNote(t, lang, note);
  return evidence ? `${t('adapt.evidence.prefix', { evidence })} ${reason}` : reason;
}

/** The short line over the player's set screen; undefined when there is nothing to say. */
export function noteChip(
  t: TFunction,
  lang: Language,
  note: ProgressionNote,
  ctx: NoteContext = {},
): string | undefined {
  const r = resolve(t, lang, note, ctx);
  const goalText = r.goal !== undefined ? r.amount(r.goal) : undefined;
  const delta = deltaText(lang, r.from, r.to);
  const toText = r.to !== undefined ? loadText(t, lang, r.to) : '';
  const fromText = r.from !== undefined ? loadText(t, lang, r.from) : undefined;
  const days = num(r.p.days) ?? 0;
  const goalPart = goalText !== undefined ? t('adapt.why.goalPart', { goal: goalText }) : '';
  const deltaPart = delta !== undefined ? t('adapt.why.deltaPart', { delta }) : '';

  if (ctx.later && note.newLoad && note.code !== 'pain-lighter')
    return parseToken(r.to)?.kind === 'band' ? t('adapt.why.newBand') : t('adapt.why.newWeight');

  switch (note.code) {
    case 'load-up':
      return t('adapt.why.loadUp.chip', { deltaPart, goalPart });
    case 'load-up-low':
      return goalText !== undefined
        ? t('adapt.why.loadUpLow.chip', { deltaPart, goal: goalText })
        : t('adapt.why.loadUp.chip', { deltaPart, goalPart });
    case 'load-down':
      return delta !== undefined ? t('adapt.why.loadDown.chip', { delta, min: r.min }) : undefined;
    case 'reps-up': {
      if (goalText === undefined) return undefined;
      const easy = (num(r.p.to) ?? 0) - (num(r.p.from) ?? 0) >= 2;
      return t(easy ? 'adapt.why.repsUp.chipEasy' : 'adapt.why.repsUp.chip', { goal: goalText });
    }
    case 'hold-pain':
      return t('adapt.why.holdPain.chip');
    case 'pain-lighter': {
      if (r.to === undefined || r.to === 'bw' || r.to === r.from)
        return t('adapt.why.painLighter.chipBodyweight');
      return fromText !== undefined
        ? t('adapt.why.painLighter.chip', { to: toText, from: fromText })
        : t('adapt.why.painLighter.chipNoFrom', { to: toText });
    }
    case 'calibrated':
      return delta !== undefined
        ? t('adapt.why.calibrated.chip', { delta })
        : t('adapt.why.calibrated.chipNoDelta');
    case 'beyond-range':
      return goalText !== undefined
        ? t('adapt.why.beyondRange.chip', { goal: goalText })
        : undefined;
    case 'tempo-slower':
      return t(
        usesDumbbell(r.exercise)
          ? 'adapt.why.tempoSlower.chipDumbbell'
          : 'adapt.why.tempoSlower.chip',
      );
    case 'band-heavier':
      return r.assisted
        ? t('adapt.why.bandHeavierAssisted.chip', { band: bandOf(t, lang, r.to) })
        : t('adapt.why.bandHeavier.chip', { band: bandOf(t, lang, r.to) });
    case 'band-lighter':
      return r.assisted
        ? t('adapt.why.bandLighterAssisted.chip', { band: bandOf(t, lang, r.to) })
        : t('adapt.why.bandLighter.chip', { min: r.min });
    case 'added-load-start':
      return t('adapt.why.addedLoadStart.chip', { to: plainKg(lang, r.to) ?? toText });
    case 'welcome-back':
      return delta !== undefined
        ? t('adapt.why.welcomeBack.chip', { delta, days })
        : t('adapt.why.welcomeBack.chipNoDelta', { days });
    case 'goal-eased':
      return t(r.time ? 'adapt.why.goalEased.chipTime' : 'adapt.why.goalEased.chip', { days });
    case 'load-snapped':
      return t('adapt.why.loadSnapped.chip', { to: toText });
    case 'your-load':
      return t('adapt.why.yourLoad.chip', { to: toText });
    case 'work-longer':
      return t('adapt.why.workLonger.chip', { to: secondsText(num(r.p.to) ?? 0, lang) });
    case 'work-shorter':
      return t('adapt.why.workShorter.chip', { to: secondsText(num(r.p.to) ?? 0, lang) });
    case 'from-history':
      return r.to !== undefined
        ? t('adapt.why.fromHistory.chip', { to: toText })
        : t('adapt.why.fromHistory.chipNoLoad');
    case 'from-test':
      return goalText !== undefined ? t('adapt.why.fromTest.chip', { to: goalText }) : undefined;
    case 'time-up':
      return goalText !== undefined
        ? t('adapt.why.timeUp.chip', {
            goal: goalText,
            delta: (num(r.p.to) ?? 0) - (num(r.p.from) ?? 0),
          })
        : undefined;
    case 'time-down':
      return t('adapt.why.timeDown.chip', {
        to: secondsText(num(r.p.to) ?? 0, lang),
        min: r.min,
      });
    default:
      return undefined;
  }
}

/* ------------------------------------------------------------------ prescriptions */

const bottomOf = (target: Target): number | undefined =>
  target.kind === 'reps' ? target.min : target.kind === 'time' ? target.minSec : undefined;

const sameLoad = (a: Load | undefined, b: Load | undefined) => tokenOf(a) === tokenOf(b);

const tempoText = (tempo: NonNullable<Prescribed['tempo']>) =>
  `${tempo.down}-${tempo.pause}-${tempo.up}`;
const tempoTotal = (tempo: NonNullable<Prescribed['tempo']>) => tempo.down + tempo.pause + tempo.up;

export interface ChangeTagData {
  icon: Extract<IconName, 'arrow-up' | 'arrow-down' | 'arrow-right' | 'turtle' | 'equals'>;
  text: string;
  /** Spoken before the text: "Up:". */
  srPrefix?: string;
}

const up = (t: TFunction, text: string): ChangeTagData => ({
  icon: 'arrow-up',
  text,
  srPrefix: t('adapt.detail.tag.srUp'),
});
const down = (t: TFunction, text: string): ChangeTagData => ({
  icon: 'arrow-down',
  text,
  srPrefix: t('adapt.detail.tag.srDown'),
});

/** The pill between two prescriptions: "↑ 2 kg", "↓ 2 reps", "Slower", "More help"… */
export function changeTag(
  t: TFunction,
  lang: Language,
  before: Prescribed,
  after: Prescribed,
  opts: { assisted?: boolean } = {},
): ChangeTagData | undefined {
  const lb = parseToken(tokenOf(before.load));
  const la = parseToken(tokenOf(after.load));
  if (!sameLoad(before.load, after.load) && lb && la) {
    if ((lb.kind === 'kg' || lb.kind === 'added') && lb.kind === la.kind) {
      const d = Math.round((la.kg - lb.kg) * 100) / 100;
      const text = t('adapt.detail.tag.kg', { value: numberText(Math.abs(d), lang) });
      return d > 0 ? up(t, text) : down(t, text);
    }
    if (la.kind === 'added') return up(t, t('adapt.detail.tag.added'));
    if (lb.kind === 'added') return down(t, t('adapt.detail.tag.lighter'));
    if (lb.kind === 'band' && la.kind === 'band') {
      const heavier = BAND_LEVELS.indexOf(la.level) > BAND_LEVELS.indexOf(lb.level);
      if (opts.assisted)
        return heavier
          ? down(t, t('adapt.detail.tag.moreHelp'))
          : up(t, t('adapt.detail.tag.lessHelp'));
      return heavier
        ? up(t, t('adapt.detail.tag.heavier'))
        : down(t, t('adapt.detail.tag.lighter'));
    }
  }
  if (
    after.tempo &&
    before.tempo &&
    tempoText(after.tempo) !== tempoText(before.tempo) &&
    tempoTotal(after.tempo) > tempoTotal(before.tempo)
  )
    return { icon: 'turtle', text: t('adapt.detail.tag.slower') };
  const gb = before.goal ?? bottomOf(before.target);
  const ga = after.goal ?? bottomOf(after.target);
  if (gb !== undefined && ga !== undefined && gb !== ga) {
    const diff = Math.abs(ga - gb);
    const text =
      after.target.kind === 'time'
        ? t('adapt.detail.tag.seconds', { count: diff })
        : t('adapt.detail.tag.reps', { count: diff });
    return ga > gb ? up(t, text) : down(t, text);
  }
  return undefined;
}

export interface Figure {
  /** The new value, set large. */
  next: string;
  /** The old one, set small above it. Absent when nothing moved. */
  previous?: string;
  kind: 'load' | 'tempo' | 'goal' | 'same';
}

const loadFigure = (t: TFunction, lang: Language, load: Load | undefined): string => {
  const parsed = parseToken(tokenOf(load));
  if (!parsed || parsed.kind === 'bw') return t('adapt.summary.noLoad');
  if (parsed.kind === 'band') return t(`labels.band.${parsed.level}`);
  return loadText(t, lang, tokenOf(load));
};

const goalFigure = (t: TFunction, lang: Language, p: Prescribed): string | undefined => {
  const goal = p.goal ?? bottomOf(p.target);
  if (goal === undefined) return undefined;
  return p.target.kind === 'time' ? secondsText(goal, lang) : repsText(t, goal);
};

/** Summary row: what changes next time, as `previous → next`; "same" when nothing does. */
export function changeFigure(
  t: TFunction,
  lang: Language,
  before: Prescribed,
  after: Prescribed,
): Figure {
  if (!sameLoad(before.load, after.load))
    return {
      kind: 'load',
      previous: loadFigure(t, lang, before.load),
      next: loadFigure(t, lang, after.load),
    };
  if (before.tempo && after.tempo && tempoText(before.tempo) !== tempoText(after.tempo))
    return { kind: 'tempo', previous: tempoText(before.tempo), next: tempoText(after.tempo) };
  const gb = goalFigure(t, lang, before);
  const ga = goalFigure(t, lang, after);
  if (gb !== undefined && ga !== undefined && gb !== ga)
    return { kind: 'goal', previous: gb, next: ga };
  const current = ga ?? (after.load ? loadFigure(t, lang, after.load) : '');
  return { kind: 'same', next: current };
}

/* ------------------------------------------------------------------ goal against the range */

export type GoalState = 'under' | 'in' | 'past';

export const goalState = (goal: number, min: number, max: number): GoalState =>
  goal < min ? 'under' : goal > max ? 'past' : 'in';

/** The unit line under the player's number: "reps (8–10)", "reps, past 8–12", "seconds (30–60)". */
export function playerUnit(
  t: TFunction,
  input: { goal: number; min: number; max: number; time?: boolean; side?: 'left' | 'right' },
): string {
  const { goal, min, max, side } = input;
  const state = goalState(goal, min, max);
  const key = input.time
    ? { in: 'holdInRange', under: 'holdUnder', past: 'holdPast' }[state]
    : state === 'in'
      ? side
        ? 'inRangeSide'
        : 'inRange'
      : state;
  return t(`adapt.player.unit.${key}`, {
    min,
    max,
    ...(side && { side: t(`adapt.player.side.${side}`) }),
  });
}

/** Screen-reader text of the goal ruler. */
export function rulerLabel(
  t: TFunction,
  lang: Language,
  input: { goal: number; min: number; max: number; time?: boolean },
): string {
  const amount = (n: number) => (input.time ? secondsText(n, lang) : repsText(t, n));
  return t('adapt.detail.ruler', {
    goal: amount(input.goal),
    min: numberText(input.min, lang),
    max: input.time ? secondsText(input.max, lang) : numberText(input.max, lang),
  });
}
