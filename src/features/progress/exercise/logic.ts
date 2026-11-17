import type {
  Answer,
  BandLevel,
  Exercise,
  Language,
  MovementPattern,
  ProgressionNote,
  Programme,
  SessionLog,
} from '@/domain';
import { activeSwaps, type BestSet, type ExerciseListItem, type ExercisePoint } from '@/engine';
import { fold } from '@/features/editor/picker/fold';

export const FAMILIES = ['push', 'pull', 'legs', 'core', 'cardio'] as const;
export type Family = (typeof FAMILIES)[number];

const FAMILY: Record<MovementPattern, Family> = {
  'push-horizontal': 'push',
  'push-vertical': 'push',
  'chest-isolation': 'push',
  'shoulder-isolation': 'push',
  'elbow-extension': 'push',
  'pull-horizontal': 'pull',
  'pull-vertical': 'pull',
  'elbow-flexion': 'pull',
  shrug: 'pull',
  squat: 'legs',
  hinge: 'legs',
  lunge: 'legs',
  'hip-extension': 'legs',
  'hip-abduction': 'legs',
  'knee-flexion': 'legs',
  'calf-raise': 'legs',
  'core-anti-extension': 'core',
  'core-anti-lateral': 'core',
  'core-flexion': 'core',
  'core-rotation': 'core',
  'spinal-extension': 'core',
  carry: 'core',
  mobility: 'core',
  locomotion: 'cardio',
  conditioning: 'cardio',
};

export const familyOf = (pattern: MovementPattern): Family => FAMILY[pattern];

export const RECENT_COUNT = 5;

export interface ListView {
  recent: ExerciseListItem[];
  groups: { family: Family; items: ExerciseListItem[] }[];
  /** A typed query: one flat list. */
  flat?: ExerciseListItem[];
}

/** Recent five by last done, then every exercise by family and name; a query flattens it. */
export function listView(
  items: readonly ExerciseListItem[],
  lookup: ReadonlyMap<string, Exercise>,
  lang: Language,
  query: string,
): ListView {
  const nameOf = (item: ExerciseListItem) =>
    lookup.get(item.exerciseId)?.name[lang] ?? item.exerciseId;
  const alphabetical = (a: ExerciseListItem, b: ExerciseListItem) =>
    nameOf(a).localeCompare(nameOf(b), lang);
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const flat = items
      .filter((item) => {
        const exercise = lookup.get(item.exerciseId);
        const names = fold([exercise?.name.fr, exercise?.name.en].filter(Boolean).join(' '));
        return words.every((w) => names.includes(w));
      })
      .sort(alphabetical);
    return { recent: [], groups: [], flat };
  }
  const groups = FAMILIES.map((family) => ({
    family,
    items: items
      .filter((i) => {
        const e = lookup.get(i.exerciseId);
        return (e ? familyOf(e.pattern) : 'core') === family;
      })
      .sort(alphabetical),
  })).filter((g) => g.items.length > 0);
  return { recent: items.slice(0, RECENT_COUNT), groups };
}

/** How the session felt, in one word: hard when any set was, else the last set's. */
export function feelOf(sets: ExercisePoint['sets']): 'easy' | 'right' | 'hard' | undefined {
  if (sets.some((s) => s.feel === 'hard')) return 'hard';
  return [...sets].reverse().find((s) => s.feel)?.feel;
}

export type Since =
  | { kind: 'load'; from: number; to: number; delta: number; added: boolean }
  | { kind: 'bands'; count: number; from: BandLevel; to: BandLevel }
  | { kind: 'reps'; count: number; time: boolean };

const bandOf = (best: BestSet | undefined): BandLevel | undefined =>
  best?.load?.kind === 'band' ? best.load.level : undefined;

/**
 * What moved between the first and the latest session: a load step in kilograms, bands less (or
 * more), or reps (seconds) gained on the best set. Nothing with one session or no gain.
 */
export function sinceSummary(points: readonly ExercisePoint[]): Since | undefined {
  const withBest = points.filter((p) => p.best && !p.stopped);
  if (withBest.length < 2) return undefined;
  const first = withBest[0]!.best!;
  const last = withBest.at(-1)!.best!;
  const bandA = bandOf(first);
  const bandB = bandOf(last);
  if (bandA && bandB && first.level !== last.level) {
    const count = Math.abs(Math.abs(last.level) - Math.abs(first.level));
    return { kind: 'bands', count, from: bandA, to: bandB };
  }
  const kgA = first.load?.kind === 'kg' || first.load?.kind === 'added-kg' ? first.level : 0;
  const kgB = last.load?.kind === 'kg' || last.load?.kind === 'added-kg' ? last.level : 0;
  if (!bandA && !bandB && kgA !== kgB && last.load?.kind !== undefined)
    return {
      kind: 'load',
      from: kgA,
      to: kgB,
      delta: Math.round((kgB - kgA) * 100) / 100,
      added: last.load?.kind === 'added-kg',
    };
  const gained = Math.round((last.value - first.value) * 10) / 10;
  if (gained > 0) return { kind: 'reps', count: gained, time: last.unit === 'seconds' };
  return undefined;
}

export type DotKind = 'change' | 'hold' | 'pain';

/** Notes worth a place on the timeline, and how their dot is drawn; undefined = leave out. */
export function dotOf(note: ProgressionNote): DotKind | undefined {
  switch (note.code) {
    case 'hold':
    case 'confirm-new-load':
    case 'swapped-in':
    case 'calibrated':
      return undefined;
    case 'hold-miss':
      return 'hold';
    case 'hold-pain':
    case 'pain-lighter':
      return 'pain';
    default:
      return 'change';
  }
}

/** "Replaces" and "replaced by": the swap answers of the user, read both ways. */
export function swapLinks(
  exerciseId: string,
  answers: readonly Answer[],
): { replaces: string[]; replacedBy?: string } {
  const swaps = activeSwaps(answers);
  const replaces = [...swaps.to].filter(([, to]) => to === exerciseId).map(([from]) => from);
  const replacedBy = swaps.to.get(exerciseId);
  return { replaces, ...(replacedBy && { replacedBy }) };
}

/** The label of a programme session ("C"); undefined for quick and own sessions. */
export function letterOf(
  log: Pick<SessionLog, 'source' | 'plan'>,
  programmes: readonly Programme[],
): string | undefined {
  if (log.source.kind !== 'programme') return undefined;
  const { programmeId } = log.source;
  const programme = programmes.find((p) => p.id === programmeId);
  if (!programme) return undefined;
  const lead = programme.rotation.filter(
    (s) =>
      !s.main.every(
        (b) => b.type === 'straight' && ['cardio', 'interval'].includes(b.item.target.kind),
      ),
  );
  const index = lead.findIndex((s) => s.id === log.plan.id);
  return index >= 0 ? String.fromCharCode(65 + index) : undefined;
}
