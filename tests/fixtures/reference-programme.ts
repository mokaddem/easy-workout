import type { Block, Programme, SessionItem, Target } from '../../src/domain';

/**
 * Reference 8-week home recomposition programme (adjustable dumbbells, bands, weight belt,
 * pull-up bar, treadmill — no bench, so presses and flies are done on the floor). The generator
 * must be able to reproduce it for a matching profile.
 */

const reps = (min: number, max = min): Target => ({ kind: 'reps', min, max });
const secs = (minSec: number, maxSec = minSec): Target => ({ kind: 'time', minSec, maxSec });
const max: Target = { kind: 'max' };

const item = (
  exerciseId: string,
  target: Target,
  extra: Partial<SessionItem> = {},
): SessionItem => ({
  exerciseId,
  target,
  ...extra,
});

const straight = (
  exerciseId: string,
  sets: number,
  target: Target,
  restSec: number,
  extra: Partial<SessionItem> = {},
): Block => ({ type: 'straight', item: item(exerciseId, target, extra), sets, restSec });

const group = (
  style: 'superset' | 'circuit',
  rounds: number,
  restAfterRoundSec: number,
  items: SessionItem[],
): Block => ({ type: 'group', style, items, rounds, restBetweenItemsSec: 0, restAfterRoundSec });

const inclineWalk = (
  minMinutes: number,
  maxMinutes: number,
  speedKmh?: number,
  inclinePct?: number,
): Block =>
  straight(
    'treadmill-incline-walk',
    1,
    {
      kind: 'cardio',
      minMinutes,
      maxMinutes,
      ...(speedKmh === undefined ? {} : { speedKmh }),
      ...(inclinePct === undefined ? {} : { inclinePct }),
    },
    0,
  );

const slow = { down: 2, pause: 0, up: 2 };

const lowerBodyWarmup: Block[] = [
  straight('bodyweight-squat', 1, reps(20), 0),
  straight('walking-lunge', 1, reps(10), 0, { perSide: true, load: { kind: 'bodyweight' } }),
  straight('glute-bridge', 1, reps(15), 0),
];

export const referenceProgramme: Programme = {
  id: 'reference-recomposition-8w',
  name: { fr: 'Recomposition 8 semaines', en: '8-week recomposition' },
  goal: 'recomposition',
  weeks: 8,
  sessionsPerWeek: 6,
  rotation: [
    {
      id: 'a-push',
      name: { fr: 'Séance A — Push', en: 'Session A — Push' },
      focus: { fr: 'Pectoraux, épaules, triceps', en: 'Chest, shoulders, triceps' },
      estimatedMinutes: 45,
      warmup: [
        straight('arm-circles', 1, secs(30), 0),
        straight('push-up', 1, reps(15), 0, { tempo: slow }),
        straight('band-pull-apart', 2, reps(20), 30),
      ],
      main: [
        straight('dumbbell-floor-press', 4, reps(8, 10), 90, { rir: 2 }),
        straight('push-up', 3, reps(8, 12), 90),
        straight('standing-dumbbell-shoulder-press', 3, reps(10, 12), 75),
        straight('dumbbell-floor-fly', 3, reps(12, 15), 60),
        group('superset', 3, 60, [
          item('dumbbell-lateral-raise', reps(15)),
          item('overhead-dumbbell-triceps-extension', reps(12)),
        ]),
        straight('dip', 2, max, 60, { rir: 1 }),
      ],
      finisher: [inclineWalk(15, 15, 5, 12)],
    },
    {
      id: 'b-pull',
      name: { fr: 'Séance B — Pull', en: 'Session B — Pull' },
      focus: { fr: 'Dos, biceps', en: 'Back, biceps' },
      estimatedMinutes: 45,
      warmup: [straight('dead-hang', 2, secs(20), 30), straight('band-face-pull', 2, reps(20), 30)],
      main: [
        straight('pull-up', 4, reps(5, 8), 120),
        straight('one-arm-dumbbell-row', 4, reps(10), 90, { perSide: true }),
        straight('band-horizontal-row', 3, reps(12, 15), 75),
        straight('bent-over-dumbbell-row', 3, reps(12), 75),
        group('superset', 3, 60, [
          item('dumbbell-biceps-curl', reps(10, 12)),
          item('dumbbell-hammer-curl', reps(12)),
        ]),
        straight('dumbbell-shrug', 3, reps(15), 45),
      ],
      finisher: [inclineWalk(15, 15, 4.5, 15)],
    },
    {
      id: 'c-lower-core',
      name: { fr: 'Séance C — Bas du corps + core', en: 'Session C — Lower body + core' },
      estimatedMinutes: 45,
      warmup: lowerBodyWarmup,
      main: [
        straight('goblet-squat', 4, reps(10, 12), 90),
        straight('bulgarian-split-squat', 3, reps(10), 90, { perSide: true }),
        straight('dumbbell-romanian-deadlift', 4, reps(10), 90, {
          tempo: { down: 3, pause: 0, up: 2 },
        }),
        straight('dumbbell-step-up', 3, reps(12), 60, { perSide: true }),
        straight('single-leg-calf-raise', 3, reps(15, 20), 45, { perSide: true }),
        group('superset', 3, 60, [
          item('plank', secs(45, 60)),
          item('hanging-leg-raise', reps(10, 12)),
        ]),
        straight('russian-twist', 3, reps(15), 45, { perSide: true }),
      ],
      finisher: [],
    },
    {
      id: 'cardio-walk',
      name: { fr: 'Repos actif — marche inclinée', en: 'Active recovery — incline walk' },
      estimatedMinutes: 40,
      warmup: [],
      main: [inclineWalk(35, 40, 5.5, 10)],
      finisher: [],
    },
    {
      id: 'd-upper-density',
      name: { fr: 'Séance D — Upper densité', en: 'Session D — Upper-body density' },
      focus: { fr: 'Circuits', en: 'Circuits' },
      estimatedMinutes: 40,
      // The source has no warm-up for this session; a short shoulder warm-up is added.
      warmup: [
        straight('arm-circles', 1, secs(30), 0),
        straight('band-pull-apart', 2, reps(20), 30),
        straight('dead-hang', 1, secs(20), 0),
      ],
      main: [
        group('circuit', 3, 45, [
          item('wide-push-up', reps(12, 15)),
          item('bent-over-dumbbell-row', reps(12)),
          item('seated-dumbbell-shoulder-press', reps(12)),
        ]),
        group('circuit', 3, 45, [
          item('chin-up', max, { rir: 1 }),
          item('close-grip-push-up', reps(10, 12)),
          item('band-lateral-raise', reps(20)),
        ]),
        group('circuit', 3, 45, [
          item('dumbbell-21s', reps(21)),
          item('dumbbell-triceps-kickback', reps(15), { perSide: true }),
          item('band-face-pull', reps(20)),
        ]),
      ],
      finisher: [inclineWalk(10, 10)],
    },
    {
      id: 'e-lower-metabolic',
      name: {
        fr: 'Séance E — Bas du corps + full body métabolique',
        en: 'Session E — Lower body + metabolic full body',
      },
      estimatedMinutes: 45,
      // The source has no warm-up for this session; session C's is reused.
      warmup: lowerBodyWarmup,
      main: [
        straight('dumbbell-deadlift', 4, reps(8), 120),
        straight('goblet-sumo-squat', 3, reps(12, 15), 90),
        straight('floor-hip-thrust', 3, reps(15), 75),
        straight('walking-lunge', 3, reps(12), 75, { perSide: true }),
        straight('band-hip-abduction', 3, reps(20), 45, { perSide: true }),
      ],
      finisher: [
        group('circuit', 4, 60, [
          item('dumbbell-swing', reps(15)),
          item('mountain-climber', reps(30)),
          item('jump-squat', reps(15)),
          item('side-plank', secs(30), { perSide: true }),
        ]),
      ],
    },
  ],
  phases: [
    {
      name: { fr: 'Réadaptation', en: 'Re-adaptation' },
      fromWeek: 1,
      toWeek: 2,
      adjustments: [{ kind: 'rir', value: 3, scope: 'all-sets' }],
      note: {
        fr: 'Apprends les mouvements, note tes charges.',
        en: 'Learn the movements and log your loads.',
      },
    },
    {
      name: { fr: 'Volume', en: 'Volume' },
      fromWeek: 3,
      toWeek: 4,
      adjustments: [
        { kind: 'extra-sets', add: 1, mainBlockIndexes: [0, 1] },
        { kind: 'cardio-minutes', addMinutes: 5 },
      ],
    },
    {
      name: { fr: 'Intensité', en: 'Intensity' },
      fromWeek: 5,
      toWeek: 6,
      adjustments: [
        { kind: 'rir', value: 1, scope: 'first-set' },
        { kind: 'cardio-minutes', addMinutes: 10 },
      ],
      note: {
        fr: 'Début de la ceinture lestée sur pompes, tractions et dips.',
        en: 'Start using the weight belt on push-ups, pull-ups and dips.',
      },
    },
    {
      name: { fr: 'Pic', en: 'Peak' },
      fromWeek: 7,
      toWeek: 7,
      adjustments: [
        { kind: 'rir', value: 1, scope: 'last-set' },
        { kind: 'cardio-minutes', addMinutes: 10 },
      ],
      note: {
        fr: 'Charges maximales, RIR 0-1 sur les dernières séries.',
        en: 'Heaviest loads, RIR 0–1 on the last sets.',
      },
    },
    {
      name: { fr: 'Décharge + test', en: 'Deload + test' },
      fromWeek: 8,
      toWeek: 8,
      adjustments: [
        { kind: 'volume', factor: 0.6 },
        { kind: 'rir', value: 3, scope: 'all-sets' },
        { kind: 'max-test', exerciseIds: ['push-up'] },
      ],
    },
  ],
  progression: { kind: 'double-progression', upperBodyIncrementKg: 2, lowerBodyIncrementKg: 4 },
};
