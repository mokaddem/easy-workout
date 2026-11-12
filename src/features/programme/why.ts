import type { TFunction } from 'i18next';
import { exerciseById } from '@/catalogue';
import type { GenerationNote, Language } from '@/domain';

/** Notes that name a specific exercise slot of a session. */
export type ReasonInput = 'schedule' | 'goal' | 'equipment';

const lcFirst = (text: string, lang: Language) =>
  text.charAt(0).toLocaleLowerCase(lang) + text.slice(1);

const exerciseName = (id: unknown, lang: Language): string => {
  const exercise = typeof id === 'string' ? exerciseById.get(id) : undefined;
  return exercise ? exercise.name[lang] : String(id ?? '');
};

const list = (csv: unknown): string[] =>
  typeof csv === 'string' ? csv.split(',').filter((part) => part.length > 0) : [];

const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value) || 0);

/** Layout of a split: "2 × full body, un jour cardio". */
const layout = (templates: string[], t: TFunction, lang: Language): string => {
  const counts = new Map<string, number>();
  for (const key of templates) {
    const label = t(`why.template.${key}`, { defaultValue: '' });
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) =>
      count > 1 ? `${count} × ${lcFirst(label, lang)}` : lcFirst(label, lang),
    )
    .join(', ');
};

/**
 * One sentence, in the given language, for a generation note. `null` for notes that carry
 * no news for the user (the usual first choice of an exercise) and for unknown codes.
 */
export function describeNote(
  note: GenerationNote,
  t: TFunction,
  language: Language,
): string | null {
  const p = note.params;
  const name = exerciseName(p.exerciseId, language);
  const pattern = (value: unknown) =>
    lcFirst(t(`labels.pattern.${String(value)}`, { defaultValue: String(value) }), language);
  const patterns = (csv: unknown) => list(csv).map(pattern).join(', ');

  switch (note.code) {
    case 'split': {
      const base = t('why.split.base', {
        count: num(p.daysPerWeek),
        layout: layout(list(p.templates), t, language),
      });
      return p.shortSessions ? `${base} ${t('why.split.short')}` : base;
    }
    case 'split-replaced':
      return t('why.splitReplaced', {
        template: lcFirst(t(`why.template.${String(p.template)}`, { defaultValue: '' }), language),
      });
    case 'dose':
      return [
        t(`why.dose.goal.${String(p.goal)}`, { defaultValue: '' }),
        t(`why.dose.level.${String(p.level)}`, { defaultValue: '' }),
      ]
        .filter((part) => part.length > 0)
        .join(' ');
    case 'exercise-preferred': {
      if (!p.instead) return null;
      const missing = list(p.missing)
        .map((kind) => lcFirst(t(`labels.equipment.${kind}`, { defaultValue: kind }), language))
        .join(', ');
      return t('why.replaces', {
        instead: lcFirst(exerciseName(p.instead, language), language),
        missing,
      });
    }
    case 'exercise-ranked':
      return t('why.ranked', { pattern: pattern(p.pattern) });
    case 'exercise-easier-variant':
      return p.from
        ? t('why.easierFrom', { from: exerciseName(p.from, language) })
        : t('why.easier');
    case 'exercise-harder-variant':
      return p.from
        ? t('why.harderFrom', { from: exerciseName(p.from, language) })
        : t('why.harder');
    case 'exercise-fallback-pattern':
      return t('why.fallback', { wanted: patterns(p.wanted) });
    case 'slot-dropped':
      return t('why.slotDropped', { patterns: patterns(p.patterns) });
    case 'load-start': {
      const bodyweight = num(p.bodyweightKg);
      const pct = bodyweight > 0 ? Math.round((num(p.targetKg) / bodyweight) * 100) : 0;
      const base = t('why.loadStart', { kg: num(p.kg), pct });
      return p.bodyweightAssumed ? `${base} ${t('why.loadStartAssumed', { bodyweight })}` : base;
    }
    case 'load-band':
      return t('why.loadBand', {
        band: t(`labels.bandLoad.${String(p.level)}`, { defaultValue: String(p.level) }),
      });
    case 'load-unloaded-start':
      return t('why.loadUnloaded');
    case 'ramp-up':
      return t('why.rampUp', { kg: num(p.workingKg) });
    case 'finisher-skipped-goal':
      return t('why.finisherSkipped');
    case 'cardio-modality': {
      const modality = t(`labels.modality.${String(p.modality)}`, { defaultValue: name });
      return t('why.cardioModality', { modality });
    }
    case 'cardio-unavailable':
      return t('why.cardioUnavailable');
    case 'balance-set-added':
      return t('why.balanceAdded', { name });
    case 'balance-set-removed':
      return t('why.balanceRemoved', { name });
    case 'time-fit': {
      const action = String(p.action);
      const known = [
        'block-added',
        'block-dropped',
        'finisher-dropped',
        'finisher-lengthened',
        'finisher-shortened',
        'rests-shortened',
        'round-added',
        'rounds-trimmed',
        'set-added',
        'sets-trimmed',
        'warmup-shortened',
      ];
      return t(`why.timeFit.${known.includes(action) ? action : 'other'}`, {
        budget: num(p.budget),
        seconds: num(p.seconds),
      });
    }
    case 'max-test':
      return t('why.maxTest', { name });
    case 'quick-session':
      return t('why.quick', {
        minutes: num(p.minutes),
        focus: lcFirst(t(`labels.focus.${String(p.focus)}`, { defaultValue: '' }), language),
      });
    default:
      return null;
  }
}

/** Codes worth a line under the exercise itself: the choice is out of the ordinary. */
const INLINE_CODES = new Set([
  'exercise-fallback-pattern',
  'exercise-easier-variant',
  'exercise-harder-variant',
  'exercise-preferred',
  'load-unloaded-start',
]);

export const isInlineNote = (note: GenerationNote): boolean =>
  INLINE_CODES.has(note.code) &&
  (note.code !== 'exercise-preferred' || Boolean(note.params.instead));

/** Where an item sits in its session; used to find the notes written about it. */
export interface ItemPosition {
  sessionId?: string;
  section: 'warmup' | 'main' | 'finisher';
  blockIndex: number;
  itemIndex?: number;
}

/** Notes about one exercise of one block. Ramp-up sets live in the warm-up but belong to the lift. */
export function notesForItem(
  notes: readonly GenerationNote[],
  position: ItemPosition,
  exerciseId: string,
): GenerationNote[] {
  return notes.filter((note) => {
    if (note.params.exerciseId !== exerciseId) return false;
    const ref = note.ref;
    if (position.sessionId && ref?.sessionId && ref.sessionId !== position.sessionId) return false;
    if (note.code === 'ramp-up') return position.section === 'main';
    return (
      ref?.section === position.section &&
      ref.blockIndex === position.blockIndex &&
      ref.itemIndex === position.itemIndex
    );
  });
}

export interface ReasonGroup {
  input: ReasonInput;
  sentences: string[];
}

const GROUP_OF: Record<string, ReasonInput | undefined> = {
  split: 'schedule',
  'split-replaced': 'schedule',
  'time-fit': 'schedule',
  dose: 'goal',
  'max-test': 'goal',
  'finisher-skipped-goal': 'goal',
  'balance-set-added': 'goal',
  'balance-set-removed': 'goal',
  'exercise-easier-variant': 'goal',
  'exercise-harder-variant': 'goal',
  'exercise-fallback-pattern': 'equipment',
  'slot-dropped': 'equipment',
  'cardio-unavailable': 'equipment',
  'cardio-modality': 'equipment',
  'exercise-preferred': 'equipment',
};

/** Programme-level reasons grouped by the input behind them; repeats across sessions collapse. */
export function programmeReasons(
  notes: readonly GenerationNote[],
  t: TFunction,
  language: Language,
): ReasonGroup[] {
  const groups = new Map<ReasonInput, string[]>();
  for (const note of notes) {
    const input = GROUP_OF[note.code];
    if (!input) continue;
    const sentence = describeNote(note, t, language);
    if (!sentence) continue;
    const sentences = groups.get(input) ?? [];
    if (!sentences.includes(sentence)) sentences.push(sentence);
    groups.set(input, sentences);
  }
  return (['schedule', 'goal', 'equipment'] as const)
    .filter((input) => groups.has(input))
    .map((input) => ({ input, sentences: groups.get(input) ?? [] }));
}

/** Notes that mean the equipment held the programme back: the "what to buy next" nudge. */
export const hasEquipmentGaps = (notes: readonly GenerationNote[]): boolean =>
  notes.some((n) => n.code === 'slot-dropped' || n.code === 'exercise-fallback-pattern');

/** Number of slots dropped or filled by a fallback, for the nudge. */
export const equipmentGapCount = (notes: readonly GenerationNote[]): number =>
  notes.filter((n) => n.code === 'slot-dropped' || n.code === 'exercise-fallback-pattern').length;
