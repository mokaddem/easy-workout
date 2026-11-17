import type { LocalizedText, Tempo } from '../../domain';
import type {
  BlockTemplate,
  CardioSpec,
  Priority,
  SessionTemplate,
  SlotSpec,
  TemplateKey,
} from './types';

const slowTempo: Tempo = { down: 2, pause: 0, up: 2 };
const eccentricTempo: Tempo = { down: 3, pause: 0, up: 2 };

const straight = (
  slot: SlotSpec,
  sets: number,
  restSec: number,
  priority?: Priority,
): BlockTemplate => ({ type: 'straight', slot, sets, restSec, ...(priority ? { priority } : {}) });

const group = (
  style: 'superset' | 'circuit',
  rounds: number,
  restAfterRoundSec: number,
  slots: SlotSpec[],
  priority?: Priority,
): BlockTemplate => ({
  type: 'group',
  style,
  slots,
  rounds,
  restAfterRoundSec,
  ...(priority ? { priority } : {}),
});

/** Core work the week relies on: shortened under time pressure, never dropped. */
const kept = (block: BlockTemplate): BlockTemplate => ({ ...block, keep: true });

const cardio = (spec: CardioSpec, priority?: Priority): BlockTemplate => ({
  type: 'cardio',
  cardio: spec,
  ...(priority ? { priority } : {}),
});

const text = (fr: string, en: string): LocalizedText => ({ fr, en });

/** Same slot with a different dose or id. */
const vary = (slot: SlotSpec, change: Partial<SlotSpec>): SlotSpec => ({ ...slot, ...change });

// ---------------------------------------------------------------------------
// Warm-up slots
// ---------------------------------------------------------------------------

const armCircles: SlotSpec = {
  id: 'wu-arm-circles',
  role: 'warmup',
  patterns: ['mobility'],
  muscles: ['side-delts', 'front-delts'],
  prefer: ['arm-circles', 'cross-body-arm-swing'],
  time: [30, 30],
  reps: [10, 10],
};

const pullApart: SlotSpec = {
  id: 'wu-pull-apart',
  role: 'warmup',
  patterns: ['pull-horizontal', 'mobility'],
  muscles: ['rear-delts', 'upper-back'],
  prefer: ['band-pull-apart', 'prone-y-raise', 'wall-slide', 'scapular-push-up'],
  reps: [20, 20],
};

const warmupPushUp: SlotSpec = {
  id: 'wu-push-up',
  role: 'warmup',
  patterns: ['push-horizontal'],
  prefer: ['push-up', 'incline-push-up', 'knee-push-up', 'wall-push-up'],
  reps: [15, 15],
  tempo: slowTempo,
};

const deadHang: SlotSpec = {
  id: 'wu-hang',
  role: 'warmup',
  patterns: ['mobility', 'pull-vertical'],
  muscles: ['lats', 'upper-back', 'forearms'],
  prefer: ['dead-hang', 'scapular-pull-up', 'band-dislocate', 'thoracic-rotation'],
  time: [20, 20],
  reps: [10, 10],
};

const warmupFacePull: SlotSpec = {
  id: 'wu-face-pull',
  role: 'warmup',
  patterns: ['pull-horizontal', 'mobility'],
  muscles: ['rear-delts', 'upper-back'],
  prefer: ['band-face-pull', 'band-pull-apart', 'prone-y-raise', 'wall-slide'],
  reps: [20, 20],
};

const warmupSquat: SlotSpec = {
  id: 'wu-squat',
  role: 'warmup',
  patterns: ['squat', 'mobility'],
  prefer: ['bodyweight-squat', 'chair-squat', 'deep-squat-hold'],
  reps: [20, 20],
  time: [30, 30],
};

const warmupLunge: SlotSpec = {
  id: 'wu-lunge',
  role: 'warmup',
  patterns: ['lunge', 'mobility'],
  prefer: ['walking-lunge', 'reverse-lunge', 'split-squat', 'lateral-lunge'],
  reps: [10, 10],
};

const warmupBridge: SlotSpec = {
  id: 'wu-bridge',
  role: 'warmup',
  patterns: ['hip-extension', 'mobility'],
  prefer: ['glute-bridge', 'banded-glute-bridge', 'donkey-kick'],
  reps: [15, 15],
};

const upperPushWarmup = [
  straight(armCircles, 1, 0),
  straight(warmupPushUp, 1, 0),
  straight(pullApart, 2, 30),
];
const pullWarmup = [straight(deadHang, 2, 30), straight(warmupFacePull, 2, 30)];
const lowerWarmup = [
  straight(warmupSquat, 1, 0),
  straight(warmupLunge, 1, 0),
  straight(warmupBridge, 1, 0),
];
const upperDensityWarmup = [
  straight(armCircles, 1, 0),
  straight(pullApart, 2, 30),
  straight(deadHang, 1, 0),
];
const fullWarmup = [
  straight(armCircles, 1, 0),
  straight(vary(warmupSquat, { reps: [15, 15] }), 1, 0),
  straight(vary(pullApart, { reps: [15, 15] }), 2, 30),
];

// ---------------------------------------------------------------------------
// Main slots
// ---------------------------------------------------------------------------

const pushMain: SlotSpec = {
  id: 'push-main',
  role: 'main',
  patterns: ['push-horizontal'],
  tag: 'compound',
  prefer: ['dumbbell-bench-press', 'dumbbell-floor-press', 'push-up', 'band-chest-press'],
  reps: [8, 10],
  rir: 2,
};

const pushSecond: SlotSpec = {
  id: 'push-second',
  role: 'secondary',
  patterns: ['push-horizontal'],
  tag: 'compound',
  prefer: ['push-up', 'feet-elevated-push-up', 'incline-push-up', 'knee-push-up'],
  reps: [8, 12],
};

const pressVertical: SlotSpec = {
  id: 'press-vertical',
  role: 'accessory',
  patterns: ['push-vertical'],
  tag: 'compound',
  muscles: ['front-delts'],
  prefer: [
    'standing-dumbbell-shoulder-press',
    'seated-dumbbell-shoulder-press',
    'dumbbell-arnold-press',
    'band-overhead-press',
    'pike-push-up',
  ],
  reps: [10, 12],
};

const pressVerticalMain: SlotSpec = vary(pressVertical, {
  id: 'press-vertical-main',
  role: 'main',
  reps: [8, 10],
  rir: 2,
});

const chestFly: SlotSpec = {
  id: 'chest-fly',
  role: 'isolation',
  patterns: ['chest-isolation'],
  tag: 'isolation',
  prefer: ['dumbbell-floor-fly', 'band-chest-fly', 'suspension-chest-fly'],
  reps: [12, 15],
};

const lateralRaise: SlotSpec = {
  id: 'lateral-raise',
  role: 'isolation',
  patterns: ['shoulder-isolation'],
  muscles: ['side-delts'],
  prefer: ['dumbbell-lateral-raise', 'band-lateral-raise'],
  reps: [15, 15],
};

const tricepsOverhead: SlotSpec = {
  id: 'triceps',
  role: 'isolation',
  patterns: ['elbow-extension'],
  prefer: [
    'overhead-dumbbell-triceps-extension',
    'band-overhead-triceps-extension',
    'band-triceps-pushdown',
    'dumbbell-floor-triceps-extension',
    'suspension-triceps-extension',
  ],
  reps: [12, 12],
};

const dipBurnout: SlotSpec = {
  id: 'dip',
  role: 'burnout',
  patterns: ['push-vertical', 'push-horizontal'],
  tag: 'compound',
  muscles: ['triceps'],
  prefer: ['dip', 'dip-bar-negative-dip', 'bench-dip', 'close-grip-push-up'],
  reps: 'max',
  rir: 1,
};

const pullVerticalMain: SlotSpec = {
  id: 'pull-vertical-main',
  role: 'main',
  patterns: ['pull-vertical'],
  fallbackPatterns: ['pull-horizontal'],
  tag: 'compound',
  prefer: ['pull-up', 'chin-up', 'band-assisted-pull-up', 'negative-pull-up', 'band-lat-pulldown'],
  reps: [5, 8],
};

const pullVerticalSecond: SlotSpec = vary(pullVerticalMain, {
  id: 'pull-vertical-second',
  role: 'secondary',
  prefer: ['chin-up', 'pull-up', 'band-assisted-pull-up', 'negative-pull-up', 'band-lat-pulldown'],
  reps: [6, 10],
});

const rowUnilateral: SlotSpec = {
  id: 'row-unilateral',
  role: 'secondary',
  patterns: ['pull-horizontal'],
  tag: 'compound',
  prefer: [
    'one-arm-dumbbell-row',
    'chest-supported-dumbbell-row',
    'kettlebell-gorilla-row',
    'bent-over-dumbbell-row',
    'inverted-row',
    'suspension-row',
    'band-horizontal-row',
  ],
  reps: [10, 10],
};

const rowBand: SlotSpec = {
  id: 'row-band',
  role: 'accessory',
  patterns: ['pull-horizontal'],
  tag: 'compound',
  prefer: ['band-horizontal-row', 'suspension-row', 'inverted-row', 'feet-elevated-inverted-row'],
  reps: [12, 15],
};

const rowBilateral: SlotSpec = {
  id: 'row-bilateral',
  role: 'accessory',
  patterns: ['pull-horizontal'],
  tag: 'compound',
  prefer: [
    'bent-over-dumbbell-row',
    'chest-supported-dumbbell-row',
    'renegade-row',
    'kettlebell-gorilla-row',
    'feet-elevated-inverted-row',
    'inverted-row',
  ],
  reps: [12, 12],
};

const curl: SlotSpec = {
  id: 'curl',
  role: 'isolation',
  patterns: ['elbow-flexion'],
  prefer: [
    'dumbbell-biceps-curl',
    'band-biceps-curl',
    'suspension-biceps-curl',
    'dumbbell-concentration-curl',
  ],
  reps: [10, 12],
};

const hammerCurl: SlotSpec = {
  id: 'hammer-curl',
  role: 'isolation',
  patterns: ['elbow-flexion'],
  prefer: [
    'dumbbell-hammer-curl',
    'dumbbell-zottman-curl',
    'dumbbell-reverse-curl',
    'band-biceps-curl',
  ],
  reps: [12, 12],
};

const shrug: SlotSpec = {
  id: 'shrug',
  role: 'isolation',
  patterns: ['shrug'],
  prefer: ['dumbbell-shrug'],
  reps: [15, 15],
};

const facePull: SlotSpec = {
  id: 'face-pull',
  role: 'isolation',
  patterns: ['pull-horizontal'],
  tag: 'isolation',
  muscles: ['rear-delts', 'upper-back'],
  prefer: [
    'band-face-pull',
    'dumbbell-reverse-fly',
    'suspension-t-raise',
    'prone-t-raise',
    'prone-y-raise',
  ],
  reps: [20, 20],
};

const squatMain: SlotSpec = {
  id: 'squat-main',
  role: 'main',
  patterns: ['squat'],
  tag: 'compound',
  prefer: ['goblet-squat', 'dumbbell-front-squat', 'box-pistol-squat', 'bodyweight-squat'],
  reps: [10, 12],
};

const squatSumo: SlotSpec = {
  id: 'squat-sumo',
  role: 'secondary',
  patterns: ['squat'],
  tag: 'compound',
  prefer: ['goblet-sumo-squat', 'goblet-squat', 'dumbbell-front-squat', 'bodyweight-squat'],
  reps: [12, 15],
};

const lungeMain: SlotSpec = {
  id: 'lunge-main',
  role: 'secondary',
  patterns: ['lunge'],
  tag: 'compound',
  prefer: ['bulgarian-split-squat', 'dumbbell-step-up', 'reverse-lunge', 'split-squat'],
  reps: [10, 10],
};

const lungeStep: SlotSpec = {
  id: 'lunge-step',
  role: 'accessory',
  patterns: ['lunge'],
  tag: 'compound',
  prefer: ['dumbbell-step-up', 'reverse-lunge', 'split-squat', 'cossack-squat'],
  reps: [12, 12],
};

const walkingLunge: SlotSpec = {
  id: 'walking-lunge',
  role: 'accessory',
  patterns: ['lunge'],
  tag: 'compound',
  prefer: ['walking-lunge', 'reverse-lunge', 'split-squat', 'dumbbell-step-up'],
  reps: [12, 12],
};

const hingeShort: SlotSpec = {
  id: 'hinge-short',
  role: 'accessory',
  patterns: ['hinge'],
  fallbackPatterns: ['hip-extension'],
  tag: 'compound',
  prefer: [
    'dumbbell-romanian-deadlift',
    'single-leg-romanian-deadlift',
    'supported-single-leg-romanian-deadlift',
    'heels-on-chair-bridge',
  ],
  reps: [10, 12],
};

const hingeTempo: SlotSpec = {
  id: 'hinge-tempo',
  role: 'secondary',
  patterns: ['hinge'],
  fallbackPatterns: ['hip-extension'],
  tag: 'compound',
  prefer: [
    'dumbbell-romanian-deadlift',
    'single-leg-romanian-deadlift',
    'band-pull-through',
    'supported-single-leg-romanian-deadlift',
  ],
  reps: [10, 10],
  tempo: eccentricTempo,
};

const hingeMain: SlotSpec = {
  id: 'hinge-main',
  role: 'main',
  patterns: ['hinge'],
  fallbackPatterns: ['hip-extension'],
  tag: 'compound',
  prefer: [
    'dumbbell-deadlift',
    'dumbbell-romanian-deadlift',
    'single-leg-romanian-deadlift',
    'band-pull-through',
  ],
  reps: [8, 8],
};

const hipThrust: SlotSpec = {
  id: 'hip-thrust',
  role: 'accessory',
  patterns: ['hip-extension'],
  tag: 'compound',
  prefer: [
    'bench-hip-thrust',
    'floor-hip-thrust',
    'single-leg-glute-bridge',
    'heels-on-chair-bridge',
    'glute-bridge',
  ],
  reps: [15, 15],
};

const legCurl: SlotSpec = {
  id: 'leg-curl',
  role: 'isolation',
  patterns: ['knee-flexion'],
  fallbackPatterns: ['hinge'],
  prefer: [
    'sliding-leg-curl',
    'band-leg-curl',
    'suspension-hamstring-curl',
    'single-leg-sliding-leg-curl',
    'nordic-curl-eccentric',
    'hamstring-bridge-walkout',
  ],
  reps: [10, 12],
};

const calfRaise: SlotSpec = {
  id: 'calf',
  role: 'isolation',
  patterns: ['calf-raise'],
  prefer: [
    'single-leg-calf-raise',
    'dumbbell-calf-raise',
    'seated-dumbbell-calf-raise',
    'calf-raise',
  ],
  reps: [15, 20],
};

const abduction: SlotSpec = {
  id: 'abduction',
  role: 'isolation',
  patterns: ['hip-abduction'],
  prefer: ['band-hip-abduction', 'band-lateral-walk', 'side-lying-leg-raise', 'fire-hydrant'],
  reps: [20, 20],
};

const plank: SlotSpec = {
  id: 'plank',
  role: 'core',
  patterns: ['core-anti-extension'],
  prefer: ['plank', 'hollow-body-hold', 'knee-plank', 'dead-bug'],
  time: [45, 60],
  reps: [10, 12],
};

const legRaise: SlotSpec = {
  id: 'leg-raise',
  role: 'core',
  patterns: ['core-flexion'],
  prefer: ['hanging-leg-raise', 'hanging-knee-raise', 'reverse-crunch', 'lying-leg-raise'],
  reps: [10, 12],
  time: [20, 30],
};

const rotation: SlotSpec = {
  id: 'rotation',
  role: 'core',
  patterns: ['core-rotation'],
  prefer: ['russian-twist', 'band-pallof-press', 'band-woodchop', 'plank-shoulder-tap'],
  reps: [15, 15],
};

const sidePlank: SlotSpec = {
  id: 'side-plank',
  role: 'core',
  patterns: ['core-anti-lateral'],
  prefer: ['side-plank', 'knee-side-plank', 'side-plank-leg-raise'],
  time: [30, 30],
  reps: [10, 10],
};

const spinalExtension: SlotSpec = {
  id: 'back-extension',
  role: 'core',
  patterns: ['spinal-extension'],
  prefer: ['superman', 'prone-back-extension'],
  reps: [12, 12],
};

// Density circuits (upper-body)
const widePushUp: SlotSpec = vary(pushSecond, {
  id: 'wide-push',
  prefer: ['wide-push-up', 'push-up', 'incline-push-up', 'knee-push-up'],
  reps: [12, 15],
});
const rowCircuit: SlotSpec = vary(rowBilateral, {
  id: 'row-circuit',
  role: 'secondary',
  prefer: [
    'bent-over-dumbbell-row',
    'renegade-row',
    'band-horizontal-row',
    'inverted-row',
    'suspension-row',
  ],
});
const pressCircuit: SlotSpec = vary(pressVertical, {
  id: 'press-circuit',
  role: 'secondary',
  prefer: [
    'seated-dumbbell-shoulder-press',
    'standing-dumbbell-shoulder-press',
    'band-overhead-press',
    'pike-push-up',
  ],
  reps: [12, 12],
});
const chinCircuit: SlotSpec = vary(pullVerticalSecond, {
  id: 'chin-circuit',
  reps: 'max',
  rir: 1,
});
const closeGrip: SlotSpec = {
  id: 'close-grip',
  role: 'secondary',
  patterns: ['push-horizontal', 'push-vertical'],
  tag: 'compound',
  muscles: ['triceps'],
  prefer: ['close-grip-push-up', 'bench-dip', 'push-up', 'incline-push-up'],
  reps: [10, 12],
};
const bandLateral: SlotSpec = vary(lateralRaise, {
  id: 'lateral-circuit',
  prefer: ['band-lateral-raise', 'dumbbell-lateral-raise'],
  reps: [20, 20],
});
const curlCircuit: SlotSpec = vary(curl, {
  id: 'curl-circuit',
  prefer: ['dumbbell-21s', 'dumbbell-biceps-curl', 'band-biceps-curl', 'suspension-biceps-curl'],
  reps: [12, 15],
});
const kickback: SlotSpec = vary(tricepsOverhead, {
  id: 'kickback',
  prefer: [
    'dumbbell-triceps-kickback',
    'band-triceps-pushdown',
    'band-overhead-triceps-extension',
    'overhead-dumbbell-triceps-extension',
  ],
  reps: [15, 15],
});

// Metabolic finisher
const swing: SlotSpec = {
  id: 'swing',
  role: 'conditioning',
  patterns: ['hinge', 'conditioning'],
  prefer: ['kettlebell-swing', 'dumbbell-swing', 'dumbbell-thruster', 'squat-thrust'],
  reps: [15, 15],
};
const climber: SlotSpec = {
  id: 'climber',
  role: 'conditioning',
  patterns: ['conditioning'],
  prefer: ['mountain-climber', 'squat-thrust', 'bear-crawl'],
  reps: [30, 30],
  time: [30, 30],
};
const jump: SlotSpec = {
  id: 'jump',
  role: 'conditioning',
  patterns: ['squat', 'conditioning'],
  prefer: ['jump-squat', 'skater-jump', 'bodyweight-squat', 'skater-step'],
  reps: [15, 15],
};

const metabolicCircuit = (rounds: number, priority?: Priority) =>
  group('circuit', rounds, 60, [swing, climber, jump, sidePlank], priority);

// ---------------------------------------------------------------------------
// Session templates
// ---------------------------------------------------------------------------

const templates: SessionTemplate[] = [
  {
    key: 'push',
    title: text('Push', 'Push'),
    focus: text('Pectoraux, épaules, triceps', 'Chest, shoulders, triceps'),
    warmup: upperPushWarmup,
    main: [
      straight(pushMain, 4, 90),
      straight(pushSecond, 3, 90),
      straight(pressVertical, 3, 75),
      straight(chestFly, 3, 60, 2),
      group('superset', 3, 60, [lateralRaise, tricepsOverhead], 2),
      straight(dipBurnout, 2, 60, 2),
      straight(vary(facePull, { reps: [15, 20] }), 3, 45, 3),
    ],
    finisher: [cardio({ minutes: [15, 15], speedKmh: 5, inclinePct: 12 })],
  },
  {
    key: 'pull',
    title: text('Pull', 'Pull'),
    focus: text('Dos, biceps', 'Back, biceps'),
    warmup: pullWarmup,
    main: [
      straight(pullVerticalMain, 4, 120),
      straight(rowUnilateral, 4, 90),
      straight(rowBand, 3, 75),
      straight(rowBilateral, 3, 75, 2),
      group('superset', 3, 60, [curl, hammerCurl], 2),
      straight(shrug, 3, 45, 2),
      straight(vary(facePull, { reps: [15, 20] }), 3, 45, 3),
    ],
    finisher: [cardio({ minutes: [15, 15], speedKmh: 4.5, inclinePct: 15 })],
  },
  {
    key: 'lower-core',
    title: text('Bas du corps + core', 'Lower body + core'),
    warmup: lowerWarmup,
    main: [
      straight(squatMain, 4, 90),
      straight(lungeMain, 3, 90),
      straight(hingeTempo, 4, 90),
      straight(lungeStep, 3, 60),
      straight(calfRaise, 3, 45, 2),
      kept(group('superset', 3, 60, [plank, legRaise], 2)),
      straight(rotation, 3, 45, 2),
      straight(legCurl, 3, 60, 3),
      straight(abduction, 3, 45, 3),
    ],
    finisher: [],
  },
  {
    key: 'cardio',
    title: text('Repos actif', 'Active recovery'),
    warmup: [],
    main: [cardio({ minutes: [35, 40], speedKmh: 5.5, inclinePct: 10 })],
    finisher: [],
  },
  {
    key: 'upper-density',
    title: text('Haut du corps, densité', 'Upper-body density'),
    focus: text('Circuits', 'Circuits'),
    warmup: upperDensityWarmup,
    main: [
      group('circuit', 3, 45, [widePushUp, rowCircuit, pressCircuit]),
      group('circuit', 3, 45, [chinCircuit, closeGrip, bandLateral]),
      group('circuit', 3, 45, [curlCircuit, kickback, facePull], 2),
    ],
    finisher: [cardio({ minutes: [10, 10] })],
  },
  {
    key: 'lower-metabolic',
    title: text('Bas du corps + full body métabolique', 'Lower body + metabolic full body'),
    warmup: lowerWarmup,
    main: [
      straight(hingeMain, 4, 120),
      straight(squatSumo, 3, 90),
      straight(hipThrust, 3, 75),
      straight(walkingLunge, 3, 75),
      straight(abduction, 3, 45, 2),
      straight(legCurl, 3, 60, 3),
      straight(calfRaise, 3, 45, 3),
    ],
    finisher: [metabolicCircuit(4)],
  },
  {
    key: 'upper-a',
    title: text('Haut du corps A', 'Upper body A'),
    warmup: upperPushWarmup,
    main: [
      straight(pushMain, 4, 90),
      straight(rowUnilateral, 4, 90),
      straight(pressVertical, 3, 75),
      straight(pullVerticalSecond, 3, 90),
      group('superset', 3, 60, [lateralRaise, curl], 2),
      group('superset', 3, 60, [tricepsOverhead, vary(facePull, { reps: [15, 20] })], 3),
    ],
    finisher: [cardio({ minutes: [15, 15], speedKmh: 5, inclinePct: 12 })],
  },
  {
    key: 'upper-b',
    title: text('Haut du corps B', 'Upper body B'),
    warmup: [straight(armCircles, 1, 0), ...pullWarmup],
    main: [
      straight(pullVerticalMain, 4, 120),
      straight(pressVerticalMain, 4, 90),
      straight(rowBilateral, 3, 75),
      straight(pushSecond, 3, 90),
      group('superset', 3, 60, [hammerCurl, tricepsOverhead], 2),
      straight(dipBurnout, 2, 60, 3),
    ],
    finisher: [cardio({ minutes: [15, 15], speedKmh: 4.5, inclinePct: 15 })],
  },
  {
    key: 'lower-a',
    title: text('Bas du corps A', 'Lower body A'),
    warmup: lowerWarmup,
    main: [
      straight(vary(squatMain, { reps: [8, 12] }), 4, 90),
      straight(hingeTempo, 3, 90),
      straight(lungeMain, 3, 90),
      straight(calfRaise, 3, 45, 2),
      kept(group('superset', 3, 60, [plank, legRaise], 2)),
      straight(abduction, 3, 45, 3),
    ],
    finisher: [],
  },
  {
    key: 'lower-b',
    title: text('Bas du corps B', 'Lower body B'),
    warmup: lowerWarmup,
    main: [
      straight(hingeMain, 4, 120),
      straight(walkingLunge, 3, 75),
      straight(vary(hipThrust, { reps: [12, 15] }), 3, 75),
      straight(legCurl, 3, 60, 2),
      kept(group('superset', 3, 60, [sidePlank, rotation], 2)),
      straight(calfRaise, 3, 45, 3),
    ],
    finisher: [metabolicCircuit(3, 3)],
  },
  {
    key: 'full-a',
    title: text('Full body A', 'Full body A'),
    warmup: fullWarmup,
    main: [
      straight(vary(squatMain, { reps: [8, 12] }), 4, 90),
      straight(pushMain, 4, 90),
      straight(rowUnilateral, 3, 90),
      straight(hingeTempo, 3, 90),
      straight(pullVerticalSecond, 3, 90, 2),
      straight(pressVertical, 3, 75, 2),
      kept(group('superset', 3, 60, [plank, legRaise], 2)),
      straight(lungeStep, 3, 60, 3),
      group('superset', 3, 60, [curl, tricepsOverhead], 3),
    ],
    finisher: [cardio({ minutes: [10, 10], speedKmh: 5, inclinePct: 12 })],
  },
  {
    key: 'full-b',
    title: text('Full body B', 'Full body B'),
    warmup: fullWarmup,
    main: [
      straight(hingeMain, 4, 120),
      straight(pullVerticalMain, 4, 120),
      straight(lungeMain, 3, 90),
      straight(pressVerticalMain, 3, 90),
      straight(rowBilateral, 3, 75, 2),
      // Session B's only horizontal press: a two-day week has no other chest work.
      { ...straight(vary(pushSecond, { role: 'accessory' }), 3, 75, 2), keepUpToDays: 2 },
      straight(vary(hipThrust, { reps: [12, 15] }), 3, 75, 3),
      group('superset', 3, 60, [sidePlank, rotation], 3),
    ],
    finisher: [cardio({ minutes: [10, 10], speedKmh: 4.5, inclinePct: 15 })],
  },
  {
    key: 'full-c',
    title: text('Full body C', 'Full body C'),
    warmup: fullWarmup,
    main: [
      straight(
        vary(squatMain, {
          id: 'squat-c',
          prefer: [
            'dumbbell-front-squat',
            'goblet-squat',
            'goblet-sumo-squat',
            'box-pistol-squat',
            'bodyweight-squat',
          ],
        }),
        4,
        90,
      ),
      straight(vary(rowBilateral, { role: 'secondary' }), 4, 75),
      straight(
        vary(pushSecond, {
          id: 'push-c',
          prefer: [
            'dumbbell-bench-press',
            'feet-elevated-push-up',
            'push-up',
            'dumbbell-floor-press',
            'incline-push-up',
          ],
          reps: [10, 12],
        }),
        3,
        90,
      ),
      // Short sessions already squat twice a week: their second lower slot hinges instead.
      { ...straight(walkingLunge, 3, 75), shortSlot: hingeShort },
      straight(pullVerticalSecond, 3, 90, 2),
      straight(pressVertical, 3, 75, 2),
      straight(legCurl, 3, 60, 2),
      kept(group('superset', 3, 60, [plank, spinalExtension], 2)),
    ],
    finisher: [metabolicCircuit(3, 3)],
  },
  {
    key: 'core',
    title: text('Gainage', 'Core'),
    warmup: [
      straight(
        {
          id: 'wu-spine',
          role: 'warmup',
          patterns: ['mobility'],
          muscles: ['lower-back', 'abs'],
          prefer: ['cat-cow', 'thoracic-rotation', 'torso-rotation'],
          reps: [8, 8],
        },
        1,
        0,
      ),
      straight(
        {
          id: 'wu-dead-bug',
          role: 'warmup',
          patterns: ['core-anti-extension'],
          prefer: ['dead-bug', 'bird-dog'],
          reps: [8, 8],
        },
        1,
        0,
      ),
    ],
    main: [
      group('circuit', 3, 60, [
        vary(plank, { time: [30, 45] }),
        vary(legRaise, { prefer: ['reverse-crunch', 'hanging-knee-raise', 'lying-leg-raise'] }),
        sidePlank,
      ]),
      group('circuit', 3, 60, [rotation, spinalExtension, vary(climber, { role: 'core' })], 2),
    ],
    finisher: [],
  },
];

export const TEMPLATES: ReadonlyMap<TemplateKey, SessionTemplate> = new Map(
  templates.map((t) => [t.key, t]),
);

export const template = (key: TemplateKey): SessionTemplate => {
  const found = TEMPLATES.get(key);
  if (!found) throw new Error(`unknown session template ${key}`);
  return found;
};

/** Rotation by training days per week. Sessions under 30 minutes use full body instead. */
export const SPLITS: Readonly<Record<number, readonly TemplateKey[]>> = {
  2: ['full-a', 'full-b'],
  3: ['full-a', 'full-b', 'full-c'],
  4: ['upper-a', 'lower-a', 'upper-b', 'lower-b'],
  5: ['push', 'pull', 'lower-core', 'upper-density', 'lower-metabolic'],
  6: ['push', 'pull', 'lower-core', 'cardio', 'upper-density', 'lower-metabolic'],
};

export const SHORT_SESSION_MINUTES = 30;

export const splitFor = (daysPerWeek: number, sessionMinutes: number): readonly TemplateKey[] => {
  if (sessionMinutes < SHORT_SESSION_MINUTES)
    return daysPerWeek <= 2 ? ['full-a', 'full-b'] : ['full-a', 'full-b', 'full-c'];
  const split = SPLITS[daysPerWeek];
  if (!split) throw new Error(`no split for ${daysPerWeek} days a week`);
  return split;
};
