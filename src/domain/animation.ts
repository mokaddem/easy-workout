import { z } from 'zod';
import { EquipmentKindSchema } from './equipment';

/**
 * The looping figure animation of one exercise: key poses (joint angles in degrees), the loop
 * through them, the contacts held while moving, and the props drawn with the figure. The
 * exercise's id lives on the catalogue entry; this data is keyed by it.
 *
 * Camera yaw: 0 = side (the figure faces right), 90 = front, in between = three-quarter view.
 * Joint angles follow the conventions documented in `src/motion/figure/pose.ts`.
 */

const n = z.number().optional();
const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

/** Every segment frame of the skeleton. */
export const FRAME_NAMES = [
  'root',
  'spine',
  'chest',
  'neck',
  'head',
  'shoulder.l',
  'shoulder.r',
  'elbow.l',
  'elbow.r',
  'wrist.l',
  'wrist.r',
  'hip.l',
  'hip.r',
  'knee.l',
  'knee.r',
  'ankle.l',
  'ankle.r',
] as const;
export const FrameNameSchema = z.enum(FRAME_NAMES);
export type FrameName = z.infer<typeof FrameNameSchema>;

/* Joint angles. A sided joint takes a shared value, or `name.l` / `name.r` for one side. */
const Root = z.strictObject({ pos: Vec3.optional(), lean: n, turn: n, tilt: n });
const Trunk = z.strictObject({ flex: n, bend: n, twist: n });
const Flex = z.strictObject({ flex: n });
const Clavicle = z.strictObject({ elev: n, prot: n });
const Ball = z.strictObject({ plane: n, elev: n, rot: n });
const Elbow = z.strictObject({ flex: n, pron: n });
const Wrist = z.strictObject({ flex: n, dev: n });

export const PoseSchema = z.strictObject({
  root: Root.optional(),
  spine: Trunk.optional(),
  chest: Trunk.optional(),
  neck: Flex.optional(),
  head: Flex.optional(),
  clav: Clavicle.optional(),
  'clav.l': Clavicle.optional(),
  'clav.r': Clavicle.optional(),
  shoulder: Ball.optional(),
  'shoulder.l': Ball.optional(),
  'shoulder.r': Ball.optional(),
  elbow: Elbow.optional(),
  'elbow.l': Elbow.optional(),
  'elbow.r': Elbow.optional(),
  wrist: Wrist.optional(),
  'wrist.l': Wrist.optional(),
  'wrist.r': Wrist.optional(),
  hip: Ball.optional(),
  'hip.l': Ball.optional(),
  'hip.r': Ball.optional(),
  knee: Flex.optional(),
  'knee.l': Flex.optional(),
  'knee.r': Flex.optional(),
  ankle: Flex.optional(),
  'ankle.l': Flex.optional(),
  'ankle.r': Flex.optional(),
  /**
   * Limbs the exercise holds straight in this pose (a locked-out press, a support on straight
   * arms). Not a joint: the figure ignores it; the checks hold the solved pose to it.
   */
  straight: z.array(z.enum(['arm.l', 'arm.r', 'leg.l', 'leg.r'])).optional(),
});
export type AnimationPose = z.infer<typeof PoseSchema>;

export const LOOP_PHASES = ['eccentric', 'pause', 'concentric', 'hold'] as const;
export const LoopPhaseSchema = z.enum(LOOP_PHASES);
export type LoopPhase = z.infer<typeof LoopPhaseSchema>;

const SidedContact = z.enum(['foot.l', 'foot.r', 'hand.l', 'hand.r']);
const HandContact = z.enum(['hand.l', 'hand.r']);
const AnchorContact = z.enum(['toes', 'feet', 'knees', 'knee.l', 'knee.r']);
export type Contact = z.infer<typeof AnchorContact> | z.infer<typeof SidedContact>;

/** Which way an elbow points, in the frame's own axes. */
const Pole = z.strictObject({ frame: FrameNameSchema, dir: Vec3 });

/**
 * The loop steps (indices into `loop`, from 0) during which a contact holds; it is released during
 * the others. Without it, the contact holds all loop long.
 */
const Steps = z.array(z.number().int().min(0)).min(1).optional();

/**
 * Contacts held in world space while the body moves.
 * anchor: the body pivots on it (toes, both feet, both knees, or one knee on a bench).
 * plant: held on a surface; moves only during a loop step's `swing`, with a lift.
 * grip: a hand on a point of a body segment (a dumbbell at the chest, hands on the hips).
 * tether: a hand on a strap of fixed length hanging from a fixed point (a towel on a door).
 *
 * `at` on an anchor or a plant is the point of the surface it rests on: y is the surface height
 * (0 = the floor, a chair seat, a wall's height for a hand on it). Without `at`, a plant rests on
 * the floor under where the start pose puts it.
 *
 * Contacts that come and go (`steps`): an anchor, a plant or a grip may hold during some loop steps
 * only, and the same hand, foot or anchor may be pinned again by another pin in other steps (a hand
 * planted elsewhere, a hand gripping a shoulder): one pin per contact in any step. While a pin
 * holds, its contact does not slide. Between two pins of a contact:
 * - over one step, the contact travels from one to the other, on an arc `lift` high (the second
 *   plant's, else the first's, else 8 cm) when both are plants; `lift: 0` rolls it along;
 * - over several steps, it follows the poses: it leaves the first pin during the first of those
 *   steps and reaches the next one during the last.
 * A plant without `at` rests on the floor under where the pose at the start of its first step
 * puts it, an anchor likewise. While no anchor holds, the body stands where the poses put it
 * (`root.pos`), eased from and to the anchors around. A pin hands over to another of the same
 * contact only across a step in which neither holds.
 */
export const PinSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('anchor'),
    contact: AnchorContact,
    at: Vec3.optional(),
    steps: Steps,
  }),
  z.strictObject({
    mode: z.literal('plant'),
    contact: SidedContact,
    at: Vec3.optional(),
    /**
     * How the hand or foot rests (default flat: a palm or a sole flat on the surface). `grip`: the
     * fist around a bar or handle whose centre is `at`; `toes`: a foot on its toes; `heel`: a foot
     * on its heel. Except flat and forearm, the hand or foot keeps its own angle to the forearm or
     * shin. `forearm`: the forearm lies flat on the surface, pointing the way the body faces, the
     * hand flat beyond it; `at` is then the spot under the elbow (default: under the shoulder in
     * the pose the plant starts in), and the body must hold the shoulder an upper arm's length
     * (0.28 m) above it. `pole` is not used with a forearm.
     */
    rest: z.enum(['flat', 'grip', 'toes', 'heel', 'forearm']).optional(),
    /** The way the surface faces, when it is not the floor or a seat (a wall: the palm presses on it). */
    normal: Vec3.optional(),
    pole: Pole.optional(),
    /** Height the foot or hand rises during a swing or a move to its next plant, in metres. */
    lift: z.number().min(0).optional(),
    /** The body rides on this leg, held straight. */
    straight: z.boolean().optional(),
    steps: Steps,
  }),
  z.strictObject({
    mode: z.literal('grip'),
    contact: HandContact,
    frame: FrameNameSchema,
    at: Vec3,
    pole: Pole.optional(),
    steps: Steps,
  }),
  z.strictObject({
    mode: z.literal('tether'),
    contact: HandContact,
    anchor: Vec3,
    length: z.number().positive(),
  }),
]);
export type AnimationPin = z.infer<typeof PinSchema>;

/**
 * Tone and depth group of a prop: weights, towels, handles and bands take the prop tone (per side
 * with `.l` / `.r`), the door the scenery tone.
 */
const PropGroup = z.string().regex(/^(db|towel|handle|door|band)(\.[lr])?$/);

/** A point that moves with the body (`frame` + `at`, in that segment's axes) or stays put (world). */
const PropPoint = z.union([Vec3, z.strictObject({ frame: FrameNameSchema, at: Vec3 })]);

/**
 * A weight held in the hand or hands. `at` is the middle of the handle in `frame`, `axis` its
 * direction. The same anchors draw a dumbbell or a kettlebell: `bell` says where a kettlebell's
 * bell sits from its handle (back: on the back of the wrist, as in a rack or a press; out: past
 * the fist, as when it hangs at the side or is pressed bottom up). `down` is one weight held at
 * its top with both hands, hanging straight down from `at` whatever the hands do (a dumbbell by
 * its upper head, a kettlebell by the horns); `axis` is then unused. A goblet-size weight is the
 * larger one held at the chest.
 */
const HandWeight = {
  id: z.string().min(1),
  group: PropGroup,
  frame: FrameNameSchema,
  at: Vec3,
  axis: Vec3,
  size: z.literal('goblet').optional(),
  bell: z.enum(['back', 'out', 'down']).optional(),
};

/**
 * Furniture to sit, lie, lean or stand on. `at` is the middle of the seat area (y = the top's
 * height); `facing` (degrees, 0 = +x, 90 = -z, like the root's turn) is its front: where someone
 * sitting on it faces, and the side it is approached from. Every support's front edge lies 0.2 m
 * ahead of `at`, so a body resting anywhere from `at` to that edge stays on whichever one is
 * drawn: a chair is a seat around `at` with its backrest behind; a bench and a table reach back
 * from it. `incline` raises a bench's back pad behind its seat, in degrees from flat.
 */
const Support = {
  id: z.string().min(1),
  at: Vec3,
  facing: z.number(),
  incline: z.number().min(0).max(90).optional(),
};

/** An elastic band from one point to another: a door anchor, under a foot, a hand's grip. */
const Band = {
  id: z.string().min(1),
  group: PropGroup,
  from: PropPoint,
  to: PropPoint,
};

export const PropSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('dumbbell'), ...HandWeight }),
  z.strictObject({ kind: z.literal('kettlebell'), ...HandWeight }),
  z.strictObject({ kind: z.literal('chair'), ...Support }),
  z.strictObject({ kind: z.literal('bench'), ...Support }),
  z.strictObject({ kind: z.literal('table'), ...Support }),
  z.strictObject({ kind: z.literal('band'), ...Band }),
  z.strictObject({ kind: z.literal('mini-band'), ...Band }),
  /** A wall: `at` is a point of its surface, `normal` the way it faces (into the room). */
  z.strictObject({ kind: z.literal('wall'), id: z.string().min(1), at: Vec3, normal: Vec3 }),
  /** Parallel bars along x, `width` apart, centred on `at` (y = the bars' height). */
  z.strictObject({
    kind: z.literal('dip-bars'),
    id: z.string().min(1),
    at: Vec3,
    width: z.number().positive(),
  }),
  /** Suspension straps from a fixed point overhead to a handle in each hand. */
  z.strictObject({
    kind: z.literal('suspension'),
    id: z.string().min(1),
    anchor: Vec3,
    /** One strap or both (default both). */
    sides: z
      .array(z.enum(['l', 'r']))
      .min(1)
      .max(2)
      .optional(),
    /** Handles in the hands (default) or cradles on the feet. */
    on: z.enum(['hands', 'feet']).optional(),
  }),
  /**
   * A box from corner `min` to corner `max`: fixed in the room, or carried by a body segment
   * (`frame`): the corners are then in that segment's axes from its origin and the box turns with
   * it (a plate held at the chest). With `slide` as well, it stays level at its height and only
   * follows the segment along the floor: x and z are offsets from the segment's origin, y heights
   * above the floor (a rower's seat under the pelvis, `frame: 'root'`). A box in the room is
   * scenery (it never sets the framing); a carried box is framed like the figure.
   */
  z.strictObject({
    kind: z.literal('box'),
    id: z.string().min(1),
    group: PropGroup,
    equipment: EquipmentKindSchema.optional(),
    min: Vec3,
    max: Vec3,
    frame: FrameNameSchema.optional(),
    slide: z.boolean().optional(),
  }),
  /** A capsule between two points, each fixed in the room or carried by a body segment (a handle in a fist). */
  z.strictObject({
    kind: z.literal('capsule'),
    id: z.string().min(1),
    group: PropGroup,
    equipment: EquipmentKindSchema.optional(),
    a: PropPoint,
    b: PropPoint,
    r: z.number().positive(),
  }),
  /**
   * An ab wheel held by its handle in both fists and rolling on the floor: its axle runs through
   * the middle of the two grips, its rim touches the floor under them. Plant both hands with
   * `rest: 'grip'` and `at` at the axle's height (`r`), `lift: 0` between plants, so they hold
   * the handle while it rolls.
   */
  z.strictObject({
    kind: z.literal('ab-wheel'),
    id: z.string().min(1),
    group: PropGroup,
    /** Radius of the wheel, in metres. */
    r: z.number().positive(),
    /** Width of its tread (default 0.06 m). */
    width: z.number().positive().optional(),
  }),
  /**
   * A jump rope from fist to fist, turning forward around the hands' line: over the head, down in
   * front, under the feet, up behind. Its middle runs round an oval about the body, from just over
   * the floor under the feet to a little above the head, and `reach` (default 0.5 m) in front of
   * and behind the body, so it barely widens the framing. The turn follows the loop's progress counted in steps (step k of n runs from k / n
   * to (k + 1) / n): `turns` full turns per loop (default 1: one per jump of a one-jump loop),
   * passing under the feet at `under` (0..1, default 0). The halves draw as groups `rope.l` and
   * `rope.r`.
   */
  z.strictObject({
    kind: z.literal('jump-rope'),
    id: z.string().min(1),
    turns: z.number().int().positive().optional(),
    under: z.number().min(0).max(1).optional(),
    reach: z.number().positive().optional(),
  }),
  z.strictObject({
    kind: z.literal('strap'),
    id: z.string().min(1),
    group: PropGroup,
    equipment: EquipmentKindSchema.optional(),
    /** From a hand's grip, or `from` any point (a body point follows it: an ankle in a cradle). */
    hand: z.enum(['l', 'r']).optional(),
    from: PropPoint.optional(),
    to: Vec3,
    r: z.number().positive(),
  }),
]);
export type AnimationProp = z.infer<typeof PropSchema>;

/**
 * One step of the loop: move to a pose during a phase. Consecutive steps of one phase share its
 * duration (weighted by `share`) and one easing. `swing` lifts and re-plants that contact.
 */
export const LoopStepSchema = z.strictObject({
  to: z.string().min(1),
  phase: LoopPhaseSchema,
  share: z.number().positive().optional(),
  swing: SidedContact.optional(),
});
export type LoopStep = z.infer<typeof LoopStepSchema>;

export const WORKING_GROUPS = ['arm.l', 'arm.r', 'leg.l', 'leg.r', 'torso'] as const;

const CameraSchema = z.strictObject({ yaw: z.number(), pitch: z.number().optional() });

/**
 * What changes when an alternative implement changes the body's position (a dip between two
 * chairs sits much lower than on bars): poses (by name, the others kept), contacts, props, camera,
 * still and framing hints. The loop stays the same.
 */
export const AnimationVariantSchema = z.strictObject({
  camera: CameraSchema.optional(),
  poses: z.record(z.string().min(1), PoseSchema).optional(),
  still: z.string().optional(),
  pins: z.array(PinSchema).optional(),
  props: z.array(PropSchema).optional(),
  frameHints: z.array(Vec3).optional(),
});
export type AnimationVariant = z.infer<typeof AnimationVariantSchema>;

const AnimationBase = z.strictObject({
  camera: CameraSchema,
  poses: z.record(z.string().min(1), PoseSchema),
  /** The pose the loop starts in: the one its last step ends in, as the loop is closed. */
  start: z.string(),
  /** The key pose shown for reduced motion and thumbnails. */
  still: z.string(),
  /** Always lower, pause, lift (and hold), so a paced loop lines up with the tempo strip. */
  loop: z.array(LoopStepSchema).min(1),
  pins: z.array(PinSchema),
  props: z.array(PropSchema),
  /** Limb groups drawn one grey step lighter. */
  working: z.array(z.enum(WORKING_GROUPS)),
  /** Side 2 is the mirror image of side 1. */
  perSide: z.boolean(),
  /**
   * A continuous cycle (a stride, a pedal stroke, a rope turn) that moves through every phase,
   * holds included: it always loops at its own pace and never follows a tempo.
   */
  cycle: z.boolean().optional(),
  /** Seconds per phase when no tempo paces the loop, for moves the default pace rushes. */
  neutral: z
    .strictObject({
      eccentric: z.number().positive().max(10).optional(),
      pause: z.number().nonnegative().max(10).optional(),
      concentric: z.number().positive().max(10).optional(),
      hold: z.number().nonnegative().max(10).optional(),
    })
    .optional(),
  /** Extra points the framing must include (a prop sticking out of the figure's reach). */
  frameHints: z.array(Vec3).optional(),
  /**
   * Per implement: what changes when that implement is in use. The animation itself shows the
   * first setup the exercise lists.
   */
  variants: z.partialRecord(EquipmentKindSchema, AnimationVariantSchema).optional(),
});

/** An animation with a variant's changes applied. */
export function withVariant<A extends z.infer<typeof AnimationBase>>(a: A, v: AnimationVariant): A {
  return {
    ...a,
    ...(v.camera ? { camera: v.camera } : {}),
    ...(v.still ? { still: v.still } : {}),
    ...(v.pins ? { pins: v.pins } : {}),
    ...(v.props ? { props: v.props } : {}),
    ...(v.frameHints ? { frameHints: v.frameHints } : {}),
    poses: { ...a.poses, ...v.poses },
  };
}

type Issue = (message: string, path: (string | number)[]) => void;

function checkAnimation(a: z.infer<typeof AnimationBase>, issue: Issue): void {
  const known = (name: string) => Object.hasOwn(a.poses, name);
  if (Object.keys(a.poses).length === 0) issue('at least one pose', ['poses']);
  if (!known(a.start)) issue(`unknown pose ${a.start}`, ['start']);
  const last = a.loop[a.loop.length - 1];
  if (last && last.to !== a.start)
    issue(`the loop is closed: start is the last step's pose (${last.to})`, ['start']);
  if (!known(a.still)) issue(`unknown pose ${a.still}`, ['still']);
  const n = a.loop.length;
  // Which pin holds each contact (or the anchor) in each step.
  const holds = (p: AnimationPin, k: number) =>
    p.mode === 'tether' || !p.steps || p.steps.includes(k);
  const slot = (p: AnimationPin) => (p.mode === 'anchor' ? 'anchor' : p.contact);
  const holder = (name: string, k: number) =>
    a.pins.findIndex((p) => slot(p) === name && holds(p, k));
  a.pins.forEach((p, i) => {
    if (p.mode === 'tether' || !p.steps) return;
    if (new Set(p.steps).size !== p.steps.length) issue('a step is listed twice', ['pins', i]);
    if (p.steps.some((k) => k >= n)) issue(`steps run from 0 to ${n - 1}`, ['pins', i, 'steps']);
  });
  a.loop.forEach((step, i) => {
    if (!known(step.to)) issue(`unknown pose ${step.to}`, ['loop', i, 'to']);
    if (!step.swing) return;
    const p = a.pins[holder(step.swing, i)];
    if (p?.mode !== 'plant') issue(`${step.swing} is not a planted contact`, ['loop', i, 'swing']);
    else if (p.steps && !p.steps.includes((i + 1) % n))
      issue(`${step.swing} must stay planted in the next step`, ['loop', i, 'swing']);
  });
  const slots = new Set(a.pins.map(slot));
  const once = new Set<string>();
  for (let k = 0; k < n; k++) {
    const held = a.pins.filter((p) => holds(p, k));
    if (held.filter((p) => p.mode === 'anchor').length > 1) once.add('one anchor at most');
    if (held.filter((p) => p.mode === 'plant' && p.straight).length > 1)
      once.add('one straight leg at most');
    const contacts = held.flatMap((p) => (p.mode === 'anchor' ? [] : [p.contact]));
    if (new Set(contacts).size !== contacts.length) once.add('a contact is pinned twice');
    // A contact moves from one pin to another only across a step in which neither holds.
    for (const name of slots) {
      const now = holder(name, k);
      const next = holder(name, (k + 1) % n);
      if (now >= 0 && next >= 0 && now !== next)
        once.add(`${name} passes from one pin to another without a step between them`);
    }
  }
  for (const message of once) issue(message, ['pins']);
  const ids = a.props.map((p) => p.id);
  if (new Set(ids).size !== ids.length) issue('duplicate prop id', ['props']);
  a.pins.forEach((p, i) => {
    if (p.mode === 'plant' && p.rest === 'grip' && !p.contact.startsWith('hand.'))
      issue('only a hand grips', ['pins', i, 'rest']);
    if (p.mode === 'plant' && p.rest === 'forearm' && !p.contact.startsWith('hand.'))
      issue('only an arm rests on its forearm', ['pins', i, 'rest']);
    if (
      p.mode === 'plant' &&
      (p.rest === 'toes' || p.rest === 'heel') &&
      !p.contact.startsWith('foot.')
    )
      issue(`only a foot rests on its ${p.rest}`, ['pins', i, 'rest']);
    if (p.mode === 'plant' && p.normal && !p.at)
      issue('a contact on a surface that is not the floor needs `at`', ['pins', i, 'at']);
    if (p.mode === 'plant' && p.normal && Math.hypot(...p.normal) < 1e-6)
      issue('normal must not be zero', ['pins', i, 'normal']);
  });
  a.props.forEach((p, i) => {
    if (p.kind === 'wall' && Math.hypot(...p.normal) < 1e-6)
      issue('normal must not be zero', ['props', i, 'normal']);
    if ((p.kind === 'dumbbell' || p.kind === 'kettlebell') && Math.hypot(...p.axis) < 1e-6)
      issue('axis must not be zero', ['props', i, 'axis']);
    if (p.kind !== 'bench' && 'incline' in p && p.incline !== undefined)
      issue('only a bench inclines', ['props', i, 'incline']);
    if (p.kind === 'strap' && (p.hand === undefined) === (p.from === undefined))
      issue('a strap starts at a hand or at `from`, one of them', ['props', i]);
    if (p.kind === 'suspension' && new Set(p.sides ?? []).size !== (p.sides ?? []).length)
      issue('a side is listed twice', ['props', i, 'sides']);
    if (p.kind === 'box' && p.slide && !p.frame)
      issue('a box slides with a body segment: give its `frame`', ['props', i, 'slide']);
  });
}

export const ExerciseAnimationSchema = AnimationBase.superRefine((a, ctx) => {
  const at =
    (prefix: (string | number)[]): Issue =>
    (message, path) =>
      ctx.addIssue({ code: 'custom', message, path: [...prefix, ...path] });
  checkAnimation(a, at([]));
  for (const [kind, v] of Object.entries(a.variants ?? {}))
    if (v) checkAnimation(withVariant(a, v), at(['variants', kind]));
});
export type ExerciseAnimation = z.infer<typeof ExerciseAnimationSchema>;
