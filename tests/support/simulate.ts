import { nextSession } from '../../src/app/programme-state';
import { exerciseById } from '../../src/catalogue';
import {
  BAND_LEVELS,
  type Answer,
  type EquipmentInventory,
  type Load,
  type Profile,
  type Programme,
  type SessionLog,
  type SetLog,
} from '../../src/domain';
import {
  asPlanned,
  playSteps,
  prepareSession,
  sessionForWeek,
  setAdjustments,
  setLogBase,
  type PlayStep,
  weekRole,
  type PreparedSession,
} from '../../src/engine';

export type Outcome = Pick<SetLog, 'actual' | 'feel' | 'feelChosen' | 'edited' | 'flag'>;

export interface SimStep {
  step: PlayStep;
  week: number;
  /** 0-based count of sessions run so far. */
  session: number;
}

export type Policy = (s: SimStep) => Outcome;

/** Logs the session exactly as planned with one tap: the goal, default feel. */
export const oneTap: Policy = ({ step }) => {
  const t = step.planned.target;
  if (t.kind === 'max') return { actual: { reps: 10 }, feel: 'right', feelChosen: false };
  if (t.kind === 'cardio') return { actual: { durationSec: t.minMinutes * 60 } };
  if (t.kind === 'interval')
    return { actual: { rounds: t.rounds, durationSec: t.rounds * (t.workSec + t.recoverySec) } };
  const actual = asPlanned(step.planned)!;
  return step.section === 'warmup' ? { actual } : { actual, feel: 'right', feelChosen: false };
};

/**
 * Kilograms moved: the implements, plus the share of the user's weight the move lifts (legs carry
 * the body; push-ups about two thirds; hanging moves all of it).
 */
const kgOf = (load: Load | undefined, exerciseId: string, bodyweightKg: number): number => {
  const exercise = exerciseById.get(exerciseId);
  const legs = exercise?.pattern === 'squat' || exercise?.pattern === 'lunge';
  if (load?.kind === 'kg') {
    const count =
      exercise?.equipment[0]?.find((r) => r.kind === 'dumbbell' || r.kind === 'kettlebell')
        ?.count ?? 1;
    return load.kg * count + (legs ? 0.75 * bodyweightKg : 0);
  }
  const share = legs ? 0.75 : exercise?.pattern === 'push-horizontal' ? 0.65 : 1;
  return share * bodyweightKg + (load?.kind === 'added-kg' ? load.kg : 0);
};

/** Each band level up costs about this many reps (assisted moves: gains them). */
const BAND_REPS = 4;

/**
 * Someone who logs what really happened: stops at the planned reserve, so reps follow their true
 * strength (which grows a little each session), fade by one rep per set; the feel stays on plan.
 * Strength starts so that week 1's load leaves `headroom` reps over the bottom of the range.
 */
export function honest(
  options: { headroom?: number; growth?: number; bodyweightKg?: number } = {},
): Policy {
  const headroom = options.headroom ?? 3;
  const growth = options.growth ?? 0.01;
  const bodyweightKg = options.bodyweightKg ?? 70;
  /** Reps-at-failure capacity per exercise (kg × (1 + reps / 30)), or max reps for bodyweight. */
  const strength = new Map<
    string,
    { cap: number; seen: number; lastSession: number; band: number }
  >();
  return (s) => {
    const { step } = s;
    if (step.section === 'warmup') return oneTap(s);
    const t = step.planned.target;
    if (t.kind !== 'reps') return oneTap(s);
    const kg = kgOf(step.planned.load, step.item.exerciseId, bodyweightKg);
    const band =
      step.planned.load?.kind === 'band' ? BAND_LEVELS.indexOf(step.planned.load.level) : 0;
    const rir = step.planned.rir ?? 2;
    const goal = step.planned.goal ?? t.min;
    const id = `${step.item.exerciseId}`;
    let st = strength.get(id);
    if (!st) {
      const reps = t.min + headroom + rir;
      st = { cap: kg * (1 + reps / 30), seen: 0, lastSession: s.session, band };
      strength.set(id, st);
    }
    if (st.lastSession !== s.session) {
      st.cap *= 1 + growth;
      st.seen++;
      st.lastSession = s.session;
    }
    const assisted = exerciseById.get(id)?.loadType === 'band-assisted' ? -1 : 1;
    const fresh =
      Math.floor(30 * (st.cap / kg - 1)) - rir - assisted * BAND_REPS * (band - st.band);
    const reps = Math.max(0, fresh - (step.set - 1));
    return {
      actual: { reps, ...(step.planned.load && { load: step.planned.load }) },
      feel: 'right',
      feelChosen: false,
      ...(reps !== goal && { edited: true }),
    };
  };
}

export interface TracePoint {
  week: number;
  load?: string;
  goal?: number;
  note?: string;
}

export interface Simulation {
  logs: SessionLog[];
  /** Per exercise and item position: the prescription each time it ran. */
  trace: Map<string, TracePoint[]>;
  prepared: PreparedSession[];
}

const loadText = (load: Load | undefined) =>
  !load
    ? undefined
    : load.kind === 'kg'
      ? `${load.kg}`
      : load.kind === 'added-kg'
        ? `+${load.kg}`
        : load.kind === 'band'
          ? load.level
          : 'bw';

/** Runs a programme session after session with a logging policy, as the app would. */
export function simulate(
  programme: Programme,
  inventory: EquipmentInventory,
  policy: Policy,
  options: {
    profile?: Pick<Profile, 'level' | 'bodyweightKg'>;
    sessions?: number;
    start?: Date;
    /** Days between sessions; a function gets the session index. */
    gapDays?: number | ((index: number) => number);
    answers?: Answer[];
    logs?: SessionLog[];
    programmes?: Programme[];
  } = {},
): Simulation {
  const logs: SessionLog[] = [...(options.logs ?? [])];
  const trace = new Map<string, TracePoint[]>();
  const prepared: PreparedSession[] = [];
  const total = options.sessions ?? programme.sessionsPerWeek * programme.weeks;
  let now = new Date(options.start ?? '2026-01-05T08:00:00.000Z');
  const record = { ...programme, id: programme.id };
  for (let n = 0; n < total; n++) {
    const position = nextSession(record, logs);
    if (position.finished) break;
    const plan = sessionForWeek(programme, position.sessionId, position.week);
    const ready = prepareSession(
      plan.session,
      {
        // A fresh array, as the app's live queries give one per change.
        logs: [...logs],
        programmes: [programme, ...(options.programmes ?? [])],
        answers: options.answers ?? [],
        inventory,
        ...(options.profile && { profile: options.profile }),
        now,
        exercises: exerciseById,
      },
      'programme',
      { role: weekRole(programme, position.week) },
    );
    prepared.push(ready);
    const adjustments = setAdjustments({ ...plan, session: ready.session }, inventory);
    const steps = playSteps(ready.session, adjustments);
    const at = now.toISOString();
    const sets: SetLog[] = steps.map(
      (step) =>
        ({
          ...setLogBase(step),
          ...policy({ step, week: position.week, session: n }),
          at,
        }) as SetLog,
    );
    for (const section of ['main', 'finisher'] as const)
      ready.session[section].forEach((block, b) =>
        (block.type === 'straight' ? [block.item] : block.items).forEach((item, i) => {
          const key = `${position.sessionId}/${section}/${b}/${i}:${item.exerciseId}`;
          const n = ready.notes[`${section}/${b}/${i}`];
          trace.set(key, [
            ...(trace.get(key) ?? []),
            {
              week: position.week,
              ...(item.load && { load: loadText(item.load) }),
              ...(item.goal !== undefined && { goal: item.goal }),
              ...(n && { note: n.code }),
            },
          ]);
        }),
      );
    logs.push({
      id: `log-${n}`,
      source: {
        kind: 'programme',
        programmeId: programme.id,
        week: position.week,
        sessionId: position.sessionId,
      },
      plan: ready.session,
      ...(adjustments && { adjustments }),
      ...(Object.keys(ready.notes).length > 0 && { progression: ready.notes }),
      status: 'completed',
      startedAt: at,
      endedAt: new Date(now.getTime() + 3_600_000).toISOString(),
      countsAsDone: true,
      sets,
    });
    const gap = typeof options.gapDays === 'function' ? options.gapDays(n) : (options.gapDays ?? 1);
    now = new Date(now.getTime() + gap * 86_400_000);
  }
  return { logs, trace, prepared };
}

/** Trace entries for an exercise, by item position, matched on its id. */
export const traceOf = (sim: Simulation, exerciseId: string): [string, TracePoint[]][] =>
  [...sim.trace.entries()].filter(([k]) => k.endsWith(`:${exerciseId}`));

/** Small seeded generator, so noisy runs repeat exactly. */
const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Someone who does what the app asks: each set stops at the goal or at the planned reserve,
 * whichever comes first, and the feel is picked (easy with two reps to spare, hard when the goal
 * was out of reach). Sets fade by `fade` reps each, the day adds ±`noise` reps, a slower tempo
 * costs a fifth of the reps, and strength grows a little each session. Week 1's load leaves
 * `headroom` reps over the bottom of the range at its reserve.
 */
export function compliant(
  options: {
    headroom?: number;
    fade?: number;
    growth?: number;
    noise?: number;
    seed?: number;
    bodyweightKg?: number;
  } = {},
): Policy {
  const headroom = options.headroom ?? 0.5;
  const fade = options.fade ?? 1.5;
  const growth = options.growth ?? 0.01;
  const noise = options.noise ?? 1;
  const bodyweightKg = options.bodyweightKg ?? 70;
  const random = seeded(options.seed ?? 1);
  const strength = new Map<string, { cap: number; band: number; session: number; day: number }>();
  return (s) => {
    const { step } = s;
    if (step.section === 'warmup') return oneTap(s);
    const t = step.planned.target;
    if (t.kind !== 'reps') return oneTap(s);
    const id = step.item.exerciseId;
    const kg = kgOf(step.planned.load, id, bodyweightKg);
    const band =
      step.planned.load?.kind === 'band' ? BAND_LEVELS.indexOf(step.planned.load.level) : 0;
    const rir = step.planned.rir ?? 2;
    const goal = step.planned.goal ?? t.min;
    let st = strength.get(id);
    if (!st) {
      st = { cap: kg * (1 + (t.min + headroom + rir) / 30), band, session: s.session, day: 0 };
      strength.set(id, st);
    }
    if (st.session !== s.session) {
      st.cap *= 1 + growth;
      st.session = s.session;
      st.day = Math.round((random() * 2 - 1) * noise);
    }
    const assisted = exerciseById.get(id)?.loadType === 'band-assisted' ? -1 : 1;
    const slow = (step.planned.tempo?.pause ?? 0) >= 1 && (step.planned.tempo?.down ?? 0) >= 3;
    let possible = 30 * (st.cap / kg - 1) - rir - assisted * BAND_REPS * (band - st.band) + st.day;
    if (slow) possible *= 0.8;
    possible -= fade * (step.set - 1);
    const reps = Math.max(0, Math.min(goal, Math.floor(possible)));
    const feel = possible - goal >= 2 ? 'easy' : possible < goal ? 'hard' : 'right';
    return {
      actual: { reps, ...(step.planned.load && { load: step.planned.load }) },
      feel,
      feelChosen: true,
      ...(reps !== goal && { edited: true }),
    };
  };
}
