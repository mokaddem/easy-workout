import type { Load, Programme, SessionItem, SessionLog, SetLog, Target } from '../../src/domain';

export const reps = (min: number, max: number): Target => ({ kind: 'reps', min, max });
export const kg = (n: number): Load => ({ kind: 'kg', kg: n });

export interface SetSpec {
  value?: number;
  load?: Load;
  flag?: SetLog['flag'];
  feel?: SetLog['feel'];
  /** The feel was picked, not left on its default. */
  chosen?: boolean;
  edited?: boolean;
  rir?: number;
  goal?: number;
}

export interface EntrySpec {
  exerciseId: string;
  target?: Target;
  load?: Load;
  rir?: number;
  /** Sets the plan holds, when more than the ones logged. */
  planned?: number;
  sets: SetSpec[];
}

export interface LogSpec {
  id: string;
  at: string;
  source?: SessionLog['source'];
  status?: SessionLog['status'];
  main?: EntrySpec[];
  warmup?: EntrySpec[];
  finisher?: EntrySpec[];
  progression?: SessionLog['progression'];
  adjustments?: SessionLog['adjustments'];
  endedEarly?: boolean;
}

/** A log with one straight block per entry; set n of an entry is its n-th spec. */
export function makeLog(o: LogSpec): SessionLog {
  const sets: SetLog[] = [];
  const blocks = (section: 'warmup' | 'main' | 'finisher', list: EntrySpec[] = []) =>
    list.map((entry, blockIndex) => {
      const target = entry.target ?? reps(8, 12);
      const item: SessionItem = {
        exerciseId: entry.exerciseId,
        target,
        ...(entry.load && { load: entry.load }),
        ...(entry.rir !== undefined && { rir: entry.rir }),
      };
      entry.sets.forEach((s, i) => {
        const load = s.load ?? entry.load;
        const rir = s.rir ?? entry.rir;
        const base: SetLog = {
          section,
          blockIndex,
          itemIndex: 0,
          set: i + 1,
          exerciseId: entry.exerciseId,
          planned: {
            target,
            ...(load && { load }),
            ...(rir !== undefined && { rir }),
            ...(s.goal !== undefined && { goal: s.goal }),
          },
          ...(s.flag && { flag: s.flag }),
          ...(s.feel && { feel: s.feel }),
          ...(s.chosen && { feelChosen: true }),
          ...(s.edited && { edited: true }),
          at: o.at,
        };
        if (!s.flag || s.value !== undefined)
          base.actual = {
            ...(target.kind === 'time' ? { durationSec: s.value } : { reps: s.value }),
            ...(load && { load }),
          };
        sets.push(base);
      });
      return {
        type: 'straight' as const,
        item,
        sets: entry.planned ?? entry.sets.length,
        restSec: 60,
      };
    });
  return {
    id: o.id,
    source: o.source ?? { kind: 'quick' },
    plan: {
      id: 'sess',
      name: { fr: 'S', en: 'S' },
      estimatedMinutes: 30,
      warmup: blocks('warmup', o.warmup),
      main: blocks('main', o.main),
      finisher: blocks('finisher', o.finisher),
    },
    status: o.status ?? 'completed',
    startedAt: o.at,
    ...(o.status !== 'in-progress' && {
      endedAt: new Date(Date.parse(o.at) + 30 * 60_000).toISOString(),
    }),
    ...(o.progression && { progression: o.progression }),
    ...(o.adjustments && { adjustments: o.adjustments }),
    ...(o.endedEarly && { endedEarly: true }),
    sets,
  };
}

export const values = (...v: number[]): SetSpec[] => v.map((value) => ({ value }));

/** A programme as far as the engine reads it: rotation ids, weeks and phases. */
export function makeProgramme(over: Partial<Programme> = {}): Programme & { id: string } {
  const phase = (
    name: string,
    kind: NonNullable<Programme['phases'][number]['kind']>,
    fromWeek: number,
    toWeek: number,
    adjustments: Programme['phases'][number]['adjustments'] = [],
  ) => ({ name: { fr: name, en: name }, kind, fromWeek, toWeek, adjustments });
  return {
    id: 'p',
    name: { fr: 'P', en: 'P' },
    goal: 'muscle',
    weeks: 8,
    sessionsPerWeek: 2,
    rotation: [
      {
        id: 'a',
        name: { fr: 'A', en: 'A' },
        estimatedMinutes: 30,
        warmup: [],
        main: [],
        finisher: [],
      },
      {
        id: 'b',
        name: { fr: 'B', en: 'B' },
        estimatedMinutes: 30,
        warmup: [],
        main: [],
        finisher: [],
      },
    ],
    phases: [
      phase('Re-adaptation', 're-adaptation', 1, 2, [{ kind: 'rir', value: 3, scope: 'all-sets' }]),
      phase('Volume', 'volume', 3, 4),
      phase('Intensity', 'intensity', 5, 6),
      phase('Peak', 'peak', 7, 7),
      phase('Deload', 'deload', 8, 8, [
        { kind: 'volume', factor: 0.6 },
        { kind: 'rir', value: 3, scope: 'all-sets' },
        { kind: 'max-test', exerciseIds: ['push-up'] },
      ]),
    ],
    progression: { kind: 'double-progression', upperBodyIncrementKg: 2, lowerBodyIncrementKg: 4 },
    ...over,
  } as Programme & { id: string };
}
