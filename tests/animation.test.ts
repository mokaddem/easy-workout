import { describe, expect, it } from 'vitest';
import { ANIMATION_FAMILIES, animationFor, animations } from '../src/catalogue/animations';
import { CATALOGUE_FAMILIES, catalogue, exerciseById } from '../src/catalogue';
import { ExerciseAnimationSchema } from '../src/domain/animation';
import {
  isHousehold,
  type AnimationProp,
  type EquipmentKind,
  type ExerciseAnimation,
} from '../src/domain';
import { frame, groupOrder, padFor } from '../src/motion/figure/look';
import { PHASE_OF_TEMPO, repCounter, tempoPoint } from '../src/motion/figure/pacing';
import {
  buildParts,
  mirrorGroup,
  PROP_SWAPS,
  propsInUse,
  variantFor,
} from '../src/motion/figure/parts';
import {
  aim,
  ANKLE_HEIGHT,
  arms,
  armsTogether,
  ball,
  body,
  bridgeAt,
  dipHands,
  during,
  feet,
  forearms,
  GRIP,
  handOnWall,
  hangFrom,
  hipBetween,
  KNEEL,
  keys,
  legAbs,
  lSit,
  onForearms,
  onToes,
  plank,
  pose,
  rep,
  seated,
  sidePlank,
  STAND,
  through,
  toesAt,
  trunk,
} from '../src/catalogue/animations/shared';
import {
  at,
  axis,
  BODY,
  dot,
  evaluate,
  NEUTRAL,
  norm,
  prepare,
  sub,
  tempoPace,
  timeAtPhase,
  timeOf,
  type Pace,
  type Prepared,
  type Vec3,
} from '../src/motion/figure/pose';
import { capsulePath } from '../src/motion/figure/svg';

const entries = Object.entries(animations);
/** Every animation, and every per-implement variant as an animation of its own. */
const drawn: [string, ExerciseAnimation][] = entries.flatMap(([id, anim]) => [
  [id, anim] as [string, ExerciseAnimation],
  ...Object.keys(anim.variants ?? {}).map(
    (kind) =>
      [`${id} with ${kind}`, variantFor(anim, [kind as EquipmentKind])] as [
        string,
        ExerciseAnimation,
      ],
  ),
]);
const PACES: [string, Pace][] = [
  ['neutral', NEUTRAL],
  ['tempo 2-1-2', tempoPace({ down: 2, pause: 1, up: 2 })],
];
const SAMPLES = 120;

const deg = (r: number) => (r * 180) / Math.PI;
const angle = (a: Vec3, b: Vec3) =>
  deg(Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))));

/** Whether any contact of the animation comes and goes. */
const scheduled = (anim: ExerciseAnimation) => anim.pins.some((p) => 'steps' in p && p.steps);

/** Every joint, fingertip and toe of the figure at time t. */
function points(prep: Prepared, t: number): [string, Vec3][] {
  const F = evaluate(prep, t).frames;
  return [
    ...Object.entries(F).map(([name, f]) => [name, f.o] as [string, Vec3]),
    ...(['l', 'r'] as const).flatMap((S) => [
      [`fingers.${S}`, at(F[`wrist.${S}`], [0, -0.06, 0])] as [string, Vec3],
      [`toes.${S}`, at(F[`ankle.${S}`], BODY.toe)] as [string, Vec3],
    ]),
  ];
}

/** How far each point moves between two moments, worst first. */
function moved(prep: Prepared, t0: number, t1: number, limit: number): string[] {
  const after = points(prep, t1);
  return points(prep, t0)
    .map(([name, p], i) => [name, Math.hypot(...sub(p, after[i]![1]))] as const)
    .filter(([, d]) => d > limit)
    .sort((a, b) => b[1] - a[1])
    .map(([name, d]) => `${name} ${(d * 100).toFixed(1)} cm`);
}

/**
 * Where the body jumps from one step to the next: every joint, fingertip and toe just before and
 * just after each step ends, the loop's own end included.
 */
function jumps(anim: ExerciseAnimation): string[] {
  const prep = prepare(anim, NEUTRAL);
  const out: string[] = [];
  for (const seg of prep.segs)
    for (const part of seg.parts) {
      const eased = seg.phase === 'eccentric' || seg.phase === 'concentric';
      const raw = eased ? Math.acos(Math.max(-1, 1 - 2 * part.u1)) / Math.PI : part.u1;
      const tb = seg.t0 + raw * (seg.t1 - seg.t0);
      for (const m of moved(prep, tb - 1e-6, tb + 1e-6, 0.005))
        out.push(`${m.replace(' ', ' jumps ')} after step ${part.step}`);
    }
  return out;
}

/**
 * The thumbnail tile rule, measured on the drawn still: it stands inside the tile's height; a
 * pose at least twice as wide as tall fills the height unless that would keep less than 55 % of
 * its width, and what leaves the tile is the end away from the head; any other pose fits whole.
 */
function tileProblems(anim: ExerciseAnimation, w: number, h: number): string[] {
  const fr = frame(anim, w, h, { still: true });
  const prep = prepare(anim, NEUTRAL);
  const { frames, loop } = evaluate(prep, timeOf(prep, anim.still));
  const [top, right, bottom, left] = padFor(w, h);
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const p of buildParts(frames, anim, { loop })) {
    if (p.layer === 'scenery') continue;
    const ends: [Vec3, number][] = p.hull
      ? p.hull.map((q) => [q, 0])
      : [
          [p.a, p.ra],
          [p.b, p.rb],
        ];
    for (const [q, r] of ends) {
      const [x, y] = fr.toScreen(q);
      x0 = Math.min(x0, x - r * fr.scale);
      x1 = Math.max(x1, x + r * fr.scale);
      y0 = Math.min(y0, y - r * fr.scale);
      y1 = Math.max(y1, y + r * fr.scale);
    }
  }
  const out: string[] = [];
  const at = `${w}x${h}`;
  const [aw, ah] = [w - left - right, h - top - bottom];
  if (y0 < top - 0.5 || y1 > h - bottom + 0.5) out.push(`${at}: cut at the top or bottom`);
  const [dw, dh] = [x1 - x0, y1 - y0];
  if (dw / dh < 2) {
    if (x0 < left - 0.5 || x1 > w - right + 0.5) out.push(`${at}: not whole`);
    return out;
  }
  if (dh < ah - 0.5 && 0.55 * dw < aw - 0.5)
    out.push(`${at}: a wide pose leaves the height unused`);
  const kept = Math.min(x1, w - right) - Math.max(x0, left);
  if (kept < 0.55 * dw - 0.5)
    out.push(`${at}: keeps ${((kept / dw) * 100).toFixed(0)} % of the width`);
  const [head] = fr.toScreen(frames.head.o);
  if (head < left - 0.5 || head > w - right + 0.5) out.push(`${at}: the head is out of the tile`);
  if (dw > aw + 0.5) {
    const nearLeft = head - x0 < x1 - head;
    const edge = nearLeft ? Math.abs(x0 - left) : Math.abs(x1 - (w - right));
    if (edge > 0.5) out.push(`${at}: cropped on the head's side`);
  }
  return out;
}

describe('exercise animations', () => {
  it('every animation matches the schema', () => {
    const failures = entries.flatMap(([id, anim]) => {
      const result = ExerciseAnimationSchema.safeParse(anim);
      return result.success
        ? []
        : result.error.issues.map((i) => `${id}: ${i.path.join('.')} ${i.message}`);
    });
    expect(failures).toEqual([]);
  });

  it('every key is a catalogue id, filed under the exercise family', () => {
    const wrong: string[] = [];
    for (const [family, set] of Object.entries(ANIMATION_FAMILIES))
      for (const id of Object.keys(set)) {
        if (!exerciseById.has(id)) wrong.push(`${id} is not a catalogue id`);
        else if (
          !CATALOGUE_FAMILIES[family as keyof typeof CATALOGUE_FAMILIES].some((e) => e.id === id)
        )
          wrong.push(`${id} is in the wrong family (${family})`);
      }
    expect(wrong).toEqual([]);
    expect(entries.length).toBe(Object.values(ANIMATION_FAMILIES).flatMap(Object.keys).length);
  });

  it('looks animations up by id', () => {
    expect(animationFor('push-up')).toBe(animations['push-up']);
    expect(animationFor('no-such-exercise')).toBeUndefined();
    expect(animationFor('constructor')).toBeUndefined();
  });

  it('every catalogue exercise has an animation', () => {
    expect(catalogue.filter((ex) => !animationFor(ex.id)).map((ex) => ex.id)).toEqual([]);
  });

  describe('schema', () => {
    const base = animations['goblet-squat']!;
    const parse = (patch: Partial<ExerciseAnimation> | Record<string, unknown>) =>
      ExerciseAnimationSchema.safeParse({ ...base, ...patch });

    it('rejects unknown keys and unknown poses', () => {
      expect(parse({ extra: 1 }).success).toBe(false);
      expect(parse({ start: 'nowhere' }).success).toBe(false);
      expect(parse({ still: 'nowhere' }).success).toBe(false);
      expect(parse({ loop: [{ to: 'nowhere', phase: 'eccentric' }] }).success).toBe(false);
    });

    it('rejects bad contacts, props and working groups', () => {
      expect(parse({ pins: [{ mode: 'plant', contact: 'knee.l' }] }).success).toBe(false);
      expect(
        parse({ pins: [{ mode: 'tether', contact: 'foot.l', anchor: [0, 0, 0], length: 1 }] })
          .success,
      ).toBe(false);
      expect(parse({ props: [{ kind: 'barbell', id: 'x', group: 'db' }] }).success).toBe(false);
      expect(parse({ working: ['arm.x'] }).success).toBe(false);
      expect(
        parse({ loop: [{ to: 'stand', phase: 'eccentric', swing: 'foot.r' }], pins: [] }).success,
      ).toBe(false);
    });

    it('checks surfaces, supports, weights and bands', () => {
      const feet = base.pins.filter((p) => p.mode === 'plant');
      expect(parse({ pins: [{ mode: 'anchor', contact: 'knees', at: [0, 0, 0] }] }).success).toBe(
        true,
      );
      // A hand on a wall needs the wall's spot.
      expect(
        parse({ pins: [...feet, { mode: 'plant', contact: 'hand.r', normal: [-1, 0, 0] }] })
          .success,
      ).toBe(false);
      expect(
        parse({
          pins: [
            ...feet,
            { mode: 'plant', contact: 'hand.r', at: [0.9, 1.2, 0.2], normal: [0, 0, 0] },
          ],
        }).success,
      ).toBe(false);
      const chair = { kind: 'chair', id: 'chair', at: [0, 0.45, 0], facing: 0 };
      expect(parse({ props: [chair] }).success).toBe(true);
      expect(parse({ props: [{ ...chair, incline: 30 }] }).success).toBe(false);
      expect(parse({ props: [{ ...chair, kind: 'bench', incline: 30 }] }).success).toBe(true);
      expect(parse({ props: [{ ...chair, kind: 'bench', incline: 120 }] }).success).toBe(false);
      const weight = { kind: 'kettlebell', id: 'kb', group: 'db', frame: 'wrist.r' };
      expect(parse({ props: [{ ...weight, at: [0, 0, 0], axis: [1, 0, 0] }] }).success).toBe(true);
      expect(parse({ props: [{ ...weight, at: [0, 0, 0], axis: [0, 0, 0] }] }).success).toBe(false);
      expect(
        parse({ props: [{ ...weight, at: [0, 0, 0], axis: [1, 0, 0], bell: 'up' }] }).success,
      ).toBe(false);
      const band = { kind: 'band', id: 'b', group: 'band', from: [0, 0, 0] };
      expect(
        parse({ props: [{ ...band, to: { frame: 'wrist.r', at: [0, -0.045, 0] } }] }).success,
      ).toBe(true);
      expect(parse({ props: [band] }).success).toBe(false);
      expect(parse({ props: [{ ...band, group: 'strap' }] }).success).toBe(false);
    });
  });

  describe('implements in use', () => {
    const swapFamily = (kind: string) =>
      PROP_SWAPS.find((f) => (f as readonly string[]).includes(kind));
    /** The equipment kind a prop depicts, if any. */
    const depicts = (p: AnimationProp): EquipmentKind | undefined =>
      p.kind === 'suspension'
        ? 'suspension-trainer'
        : p.kind === 'box' || p.kind === 'capsule' || p.kind === 'strap'
          ? p.equipment
          : p.kind;

    it('props show the first setup listed, and only implements the exercise uses', () => {
      const wrong: string[] = [];
      for (const [id, anim] of entries) {
        const ex = exerciseById.get(id)!;
        const first = ex.equipment[0]!.map((r) => r.kind);
        const listed = new Set([
          ...ex.equipment.flat().map((r) => r.kind),
          ...('addedLoad' in ex && ex.addedLoad ? ex.addedLoad.map((r) => r.kind) : []),
        ]);
        const added: string[] =
          'addedLoad' in ex && ex.addedLoad ? ex.addedLoad.map((r) => r.kind) : [];
        for (const p of anim.props) {
          const kind = depicts(p);
          // An optional added load (dumbbells on a step-up) is drawn whatever the setup.
          if (swapFamily(p.kind) && !first.includes(kind!) && !added.includes(kind!))
            wrong.push(`${id}: ${p.id} is a ${p.kind}, the first setup is ${first.join(' + ')}`);
          if (kind && !isHousehold(kind) && !listed.has(kind))
            wrong.push(`${id}: ${p.id} shows a ${kind}, which the exercise does not use`);
        }
        // A variant belongs to an implement the exercise lists, and shows it.
        for (const kind of Object.keys(anim.variants ?? {}) as EquipmentKind[]) {
          if (!listed.has(kind)) wrong.push(`${id}: a variant for ${kind}, which is not listed`);
          if (first.includes(kind)) wrong.push(`${id}: a variant for the first setup's ${kind}`);
          if (!variantFor(anim, [kind]).props.some((p) => depicts(p) === kind))
            wrong.push(`${id}: the ${kind} variant does not show a ${kind}`);
        }
      }
      expect(wrong).toEqual([]);
    });

    it('draws every setup listed, each implement at the same anchors', () => {
      const wrong: string[] = [];
      for (const [id, anim] of entries) {
        const prep = prepare(anim, NEUTRAL);
        const { frames } = evaluate(prep, timeOf(prep, anim.still));
        for (const alt of exerciseById.get(id)!.equipment) {
          const kinds = alt.map((r) => r.kind);
          const own = variantFor(anim, kinds).props;
          const props = propsInUse(own, kinds);
          props.forEach((p, i) => {
            const authored = own[i]!;
            const family = swapFamily(authored.kind);
            // The authored implement when it is in use (a setup may list a table and a chair),
            // else the family's member in use.
            const use = kinds.includes(authored.kind as EquipmentKind)
              ? authored.kind
              : family?.find((k) => kinds.includes(k));
            if (use && p.kind !== use)
              wrong.push(`${id} with ${kinds.join('+')}: ${p.id} drawn as ${p.kind}`);
            // Only the kind changes: the anchors stay.
            if (JSON.stringify({ ...p, kind: authored.kind }) !== JSON.stringify(authored))
              wrong.push(`${id} with ${kinds.join('+')}: ${p.id} moved`);
          });
          const parts = buildParts(frames, anim, { equipment: kinds });
          const finite = parts.every((q) =>
            (q.hull ?? [q.a, q.b]).every((v) => v.every(Number.isFinite)),
          );
          if (!finite) wrong.push(`${id} with ${kinds.join('+')}: parts not finite`);
          const fr = frame(anim, 56, 56, { still: true, equipment: kinds });
          if (!(fr.scale > 0 && Number.isFinite(fr.ox) && fr.contacts.length > 0))
            wrong.push(`${id} with ${kinds.join('+')}: framing failed`);
        }
      }
      expect(wrong).toEqual([]);
    });

    it('swaps within a family only, and keeps an implement that is in use', () => {
      const props = animations['seated-dumbbell-shoulder-press']!.props;
      const kinds = (equipment?: EquipmentKind[]) =>
        propsInUse(props, equipment).map((p) => p.kind);
      expect(kinds()).toEqual(props.map((p) => p.kind));
      expect(kinds(['kettlebell', 'chair'])).toEqual(['chair', 'kettlebell', 'kettlebell']);
      expect(kinds(['dumbbell', 'bench'])).toEqual(['bench', 'dumbbell', 'dumbbell']);
      expect(kinds(['band'])).toEqual(['bench', 'dumbbell', 'dumbbell']);
    });
  });

  describe.each(drawn)('%s', (_id, anim) => {
    it('holds straight what each pose declares straight', () => {
      const prep = prepare(anim, NEUTRAL);
      const bent: string[] = [];
      for (const [name, pose] of Object.entries(anim.poses))
        for (const limb of pose.straight ?? []) {
          const { frames: F } = evaluate(prep, timeOf(prep, name));
          const S = limb.slice(-1) as 'l' | 'r';
          const [a, b, c] = limb.startsWith('arm')
            ? ([`shoulder.${S}`, `elbow.${S}`, `wrist.${S}`] as const)
            : ([`hip.${S}`, `knee.${S}`, `ankle.${S}`] as const);
          // The angle inside the elbow or knee: 180° is straight.
          const inside = angle(sub(F[a].o, F[b].o), sub(F[c].o, F[b].o));
          if (inside < 170) bent.push(`${name}: ${limb} at ${inside.toFixed(0)}°`);
        }
      expect(bent).toEqual([]);
    });

    describe.each(PACES)('at pace %s', (_name, pace) => {
      const prep = prepare(anim, pace);
      const samples = Array.from({ length: SAMPLES + 1 }, (_, i) => (prep.duration * i) / SAMPLES);

      it('reaches every contact', () => {
        const worst = Math.max(...samples.map((t) => evaluate(prep, t).miss));
        expect(worst * 1000).toBeLessThan(2); // mm
      });

      it('keeps hinges in range and the right way round', () => {
        const problems: string[] = [];
        for (const t of samples) {
          const { frames: F } = evaluate(prep, t);
          for (const S of ['l', 'r'] as const) {
            const thigh = sub(F[`knee.${S}`].o, F[`hip.${S}`].o);
            const shin = sub(F[`ankle.${S}`].o, F[`knee.${S}`].o);
            const knee = angle(thigh, shin);
            // The shin folds back behind the thigh's front axis.
            if (knee > 3 && dot(shin, axis(F[`hip.${S}`].m, 0)) > 1e-4)
              problems.push(`knee.${S} folds forward at ${t.toFixed(2)}s`);
            if (knee > 152) problems.push(`knee.${S} flexed ${knee.toFixed(0)}°`);
            const upper = sub(F[`elbow.${S}`].o, F[`shoulder.${S}`].o);
            const fore = sub(F[`wrist.${S}`].o, F[`elbow.${S}`].o);
            const elbow = angle(upper, fore);
            if (elbow > 3 && dot(fore, axis(F[`shoulder.${S}`].m, 0)) < -1e-4)
              problems.push(`elbow.${S} folds backwards at ${t.toFixed(2)}s`);
            if (elbow > 152) problems.push(`elbow.${S} flexed ${elbow.toFixed(0)}°`);
          }
        }
        expect([...new Set(problems)]).toEqual([]);
      });

      // A continuous cycle never follows a tempo, which would squeeze its moving holds to nothing.
      if (pace === NEUTRAL || !anim.cycle)
        it('closes its loop: the end runs into the start', () => {
          expect(moved(prep, prep.duration - 1e-6, 0, 0.01)).toEqual([]);
        });

      it('never sinks under the floor', () => {
        const problems: string[] = [];
        for (const t of samples) {
          const { frames } = evaluate(prep, t);
          for (const p of buildParts(frames, anim)) {
            // Furniture and scenery stand on the floor by construction.
            if (p.hull || p.layer) continue;
            const low = Math.min(p.a[1] - p.ra, p.b[1] - p.rb);
            if (low < -0.004)
              problems.push(`${p.id} ${(-low * 1000).toFixed(1)} mm under at ${t.toFixed(2)}s`);
          }
        }
        expect([...new Set(problems)]).toEqual([]);
      });
    });

    it('mirrors cleanly for the second side', () => {
      const prep = prepare(anim, NEUTRAL);
      for (const t of [0, timeOf(prep, anim.still), prep.duration / 3]) {
        const { frames } = evaluate(prep, t);
        const one = buildParts(frames, anim);
        const two = buildParts(frames, anim, { mirror: true });
        expect(two).toHaveLength(one.length);
        one.forEach((p, i) => {
          const q = two[i]!;
          expect(q.id).toBe(mirrorGroup(p.id));
          expect(q.group).toBe(mirrorGroup(p.group));
          if (p.hull && q.hull) {
            expect(q.hull).toHaveLength(p.hull.length);
            p.hull.forEach((c, k) => {
              expect(q.hull[k]![0]).toBeCloseTo(c[0]);
              expect(q.hull[k]![2]).toBeCloseTo(-c[2]);
            });
          } else if (!p.hull && !q.hull) {
            expect(q.a[0]).toBeCloseTo(p.a[0]);
            expect(q.a[1]).toBeCloseTo(p.a[1]);
            expect(q.a[2]).toBeCloseTo(-p.a[2]);
            expect(q.b[2]).toBeCloseTo(-p.b[2]);
          }
        });
        // The working limbs end up on the opposite side of the body.
        if (anim.perSide)
          for (const g of anim.working) {
            const side = (parts: typeof one, group: string) => {
              const zs = parts.flatMap((p) =>
                !p.hull && p.group === group ? [(p.a[2] + p.b[2]) / 2] : [],
              );
              return zs.reduce((a, b) => a + b, 0) / zs.length;
            };
            expect(side(two, mirrorGroup(g))).toBeCloseTo(-side(one, g));
          }
      }
    });

    if (scheduled(anim))
      it('hands its contacts over without a jump', () => {
        expect(jumps(anim)).toEqual([]);
      });

    it('fits its slots and draws every group', () => {
      for (const [w, h] of [
        [350, 240],
        [350, 96],
        [72, 72],
        [56, 56],
      ] as const)
        for (const still of [false, true]) {
          const fr = frame(anim, w, h, { still });
          expect(fr.scale).toBeGreaterThan(0);
          expect(Number.isFinite(fr.ox) && Number.isFinite(fr.oy)).toBe(true);
          expect(fr.contacts.length).toBeGreaterThan(0);
          expect(fr.contacts.flat().every(Number.isFinite)).toBe(true);
          const prep = prepare(anim, NEUTRAL);
          const solved = evaluate(prep, timeOf(prep, anim.still));
          const parts = buildParts(solved.frames, anim, { minR: fr.minR, loop: solved.loop });
          expect(groupOrder(parts, fr.cam).length).toBeGreaterThan(5);
          // A still in a thumbnail tile follows the tile rule (wide poses fill the height,
          // anchored on the head) instead of being centred.
          if (still && w <= 80 && h <= 80) {
            expect(tileProblems(anim, w, h)).toEqual([]);
            continue;
          }
          // Centred, so side 2 (the picture flipped left to right) fits the same framing.
          if (anim.perSide) {
            const xs = parts.flatMap((p) =>
              p.layer === 'scenery' ? [] : (p.hull ?? [p.a, p.b]).map((q) => fr.toScreen(q)[0]),
            );
            expect(Math.abs(Math.min(...xs) + Math.max(...xs) - w)).toBeLessThan(w * 0.25);
          }
        }
    });
  });
});

describe('authoring features', () => {
  /** A one-pose animation, held still, for checking a contact or a prop. */
  const still = (
    pose: ExerciseAnimation['poses'][string],
    pins: ExerciseAnimation['pins'],
    props: ExerciseAnimation['props'] = [],
  ): ExerciseAnimation => ({
    camera: { yaw: 0 },
    poses: { a: pose },
    start: 'a',
    still: 'a',
    loop: [{ to: 'a', phase: 'hold' }],
    pins,
    props,
    working: [],
    perSide: false,
  });
  const solve = (anim: ExerciseAnimation) => {
    expect(ExerciseAnimationSchema.safeParse(anim).success).toBe(true);
    return evaluate(prepare(anim, NEUTRAL), 0);
  };
  const near = (a: Vec3, b: Vec3, mm = 2) =>
    expect(Math.hypot(...sub(a, b)) * 1000).toBeLessThan(mm);

  it('anchors the body on one knee', () => {
    const { frames: F } = solve(
      still({ ...STAND, 'knee.r': { flex: 90 } }, [
        { mode: 'anchor', contact: 'knee.r', at: [0.2, 0.45, 0.1] },
      ]),
    );
    near(F['knee.r'].o, [0.2, 0.45 + BODY.knee, 0.1]);
  });

  it('grips a bar with the fist, and stands on the toes or a heel', () => {
    const grip = solve(
      still({ ...STAND, 'shoulder.r': { plane: 90, elev: 60 } }, [
        { mode: 'plant', contact: 'hand.r', rest: 'grip', at: [0.25, 1.6, 0.25] },
      ]),
    );
    expect(grip.miss).toBeLessThan(0.002);
    near(at(grip.frames['wrist.r'], GRIP), [0.25, 1.6, 0.25]);

    const toes = solve(
      still({ ...STAND, 'ankle.r': { flex: -30 } }, [
        { mode: 'plant', contact: 'foot.r', rest: 'toes', at: [0.1, 0, 0.09] },
      ]),
    );
    near(at(toes.frames['ankle.r'], BODY.toe), [0.1, BODY.toeR, 0.09]);

    const heel = solve(
      still(seated(), [{ mode: 'plant', contact: 'foot.r', rest: 'heel', at: [0.6, 0.45, 0.09] }]),
    );
    near(at(heel.frames['ankle.r'], [-0.045, -0.042, 0]), [0.6, 0.45 + 0.033, 0.09]);
  });

  it('draws straps from a body point, and suspension on one side or on the feet', () => {
    const anim = still(
      STAND,
      [],
      [
        {
          kind: 'strap',
          id: 'cradle',
          group: 'band',
          from: { frame: 'ankle.r', at: [0.03, -0.035, 0] },
          to: [-0.5, 2.2, 0.1],
          r: 0.011,
        },
        { kind: 'suspension', id: 'straps', anchor: [0, 2.4, 0], sides: ['r'] },
        { kind: 'suspension', id: 'feet', anchor: [-0.6, 0.5, 0], on: 'feet' },
      ],
    );
    const { frames: F } = solve(anim);
    const parts = buildParts(F, anim);
    const strap = parts.find((p) => p.id === 'cradle')!;
    expect(strap.hull).toBeUndefined();
    if (!strap.hull) near(strap.a, at(F['ankle.r'], [0.03, -0.035, 0]));
    expect(parts.filter((p) => p.id.startsWith('straps.l'))).toHaveLength(0);
    expect(parts.filter((p) => p.id.startsWith('straps.r'))).toHaveLength(2);
    const cradle = parts.find((p) => p.id === 'feet.l/strap')!;
    if (!cradle.hull) near(cradle.a, at(F['ankle.l'], [0.03, -0.035, 0]));
  });

  it('rejects rests on the wrong limb, half-made straps and a side listed twice', () => {
    const base = still(STAND, []);
    const parse = (patch: Record<string, unknown>) =>
      ExerciseAnimationSchema.safeParse({ ...base, ...patch }).success;
    expect(parse({ pins: [{ mode: 'plant', contact: 'foot.r', rest: 'grip' }] })).toBe(false);
    expect(parse({ pins: [{ mode: 'plant', contact: 'hand.r', rest: 'toes' }] })).toBe(false);
    const strap = { kind: 'strap', id: 's', group: 'band', to: [0, 2, 0], r: 0.01 };
    expect(parse({ props: [strap] })).toBe(false);
    expect(parse({ props: [{ ...strap, hand: 'r', from: [0, 0, 0] }] })).toBe(false);
    expect(parse({ props: [{ ...strap, hand: 'r' }] })).toBe(true);
    expect(
      parse({ props: [{ kind: 'suspension', id: 'x', anchor: [0, 2, 0], sides: ['l', 'l'] }] }),
    ).toBe(false);
  });

  it('places legs in the vertical plane with the shared solver', () => {
    const solved = (pose: ExerciseAnimation['poses'][string]) => solve(still(pose, [])).frames;
    // Feet flat under the hips' spot, and one foot forward on its toes.
    let F = solved(body([0, 0.88], 0, { l: { ankle: [0, ANKLE_HEIGHT] }, r: toesAt(0.3) }));
    expect(F['ankle.l'].o[0]).toBeCloseTo(0, 2);
    expect(F['ankle.l'].o[1]).toBeCloseTo(ANKLE_HEIGHT, 2);
    expect(F['ankle.r'].o[0]).toBeCloseTo(0.2, 2);
    // Up on the balls of the feet: the ankle where the foot pivots about the toe.
    const b = ball(-30);
    F = solved(body([b.ankle[0], b.ankle[1] + 0.82], 0, { l: b, r: b }));
    expect(F['ankle.r'].o[0]).toBeCloseTo(b.ankle[0], 2);
    expect(F['ankle.r'].o[1]).toBeCloseTo(b.ankle[1], 2);
    // A bridge: the hips above the shoulders' line, the trunk rising toward them.
    const [hip, lean, legs] = bridgeAt(20, { l: { ankle: [0.5, ANKLE_HEIGHT] } });
    F = solved(body(hip, lean, legs));
    expect(F.root.o[1]).toBeGreaterThan(0.2);
    expect(F['ankle.l'].o[0]).toBeCloseTo(0.5, 2);
    // Two hands together on one handle, and a leg from absolute angles.
    F = solved({ ...STAND, ...armsTogether(90, 0) });
    expect(Math.abs(F['wrist.l'].o[2] - F['wrist.r'].o[2])).toBeLessThan(0.15);
    expect(legAbs('l', 0, 90, 0, 0)).toEqual({
      'hip.l': { plane: 90, elev: 0, rot: 0 },
      'knee.l': { flex: 90 },
      'ankle.l': { flex: 90 },
    });
  });
});

describe('figure timeline', () => {
  const anim = animations['goblet-squat']!;

  it('follows an outside tempo clock phase by phase', () => {
    const tempo = { down: 2, pause: 1, up: 2 };
    const prep = prepare(anim, tempoPace(tempo));
    expect(prep.duration).toBe(5);
    expect(timeAtPhase(prep, 'eccentric', 0)).toBe(0);
    expect(timeAtPhase(prep, 'eccentric', 0.5)).toBeCloseTo(1);
    expect(timeAtPhase(prep, 'pause', 0.5)).toBeCloseTo(2.5);
    expect(timeAtPhase(prep, 'concentric', 0.5)).toBeCloseTo(4);
    // The loop starts lowering and rests at the bottom through the pause, like the tempo strip.
    const bottom = evaluate(prep, timeAtPhase(prep, 'pause', 0.5)).frames.root.o[1];
    const top = evaluate(prep, 0).frames.root.o[1];
    expect(bottom).toBeLessThan(top - 0.3);
    expect(evaluate(prep, 2.5).phase).toBe('pause');
  });

  it('reads the phase and progress of a tempo', () => {
    const tempo = { down: 2, pause: 1, up: 2 };
    expect(tempoPoint(tempo, 0)).toEqual({ phase: 'down', progress: 0, rep: 0 });
    expect(tempoPoint(tempo, 1)).toEqual({ phase: 'down', progress: 0.5, rep: 0 });
    expect(tempoPoint(tempo, 2.5).phase).toBe('pause');
    expect(tempoPoint(tempo, 4)).toEqual({ phase: 'up', progress: 0.5, rep: 0 });
    expect(tempoPoint(tempo, 5)).toEqual({ phase: 'down', progress: 0, rep: 1 });
    expect(tempoPoint(tempo, 11)).toEqual({ phase: 'down', progress: 0.5, rep: 2 });
    expect(tempoPoint({ down: 0, pause: 0, up: 0 }, 3).phase).toBe('down');
  });

  it('draws a capsule as a closed path', () => {
    expect(capsulePath(10, 10, 4, 40, 10, 2)).toMatch(/^M.*Z$/);
  });
});

/* ------------------------------------------------------------------ */
/* Runtime features, shown on fixtures                                 */
/* ------------------------------------------------------------------ */

describe('runtime features', () => {
  type Pose = ExerciseAnimation['poses'][string];
  const animation = (
    poses: Record<string, Pose>,
    loop: ExerciseAnimation['loop'],
    pins: ExerciseAnimation['pins'],
    props: ExerciseAnimation['props'] = [],
    start = loop[loop.length - 1]!.to,
  ): ExerciseAnimation => ({
    camera: { yaw: 20, pitch: 10 },
    poses,
    start,
    still: start,
    loop,
    pins,
    props,
    working: [],
    perSide: false,
  });
  const valid = (anim: ExerciseAnimation) => {
    const result = ExerciseAnimationSchema.safeParse(anim);
    expect(result.success ? [] : result.error.issues.map((i) => i.message)).toEqual([]);
  };
  const near = (a: Vec3, b: Vec3, mm = 2) =>
    expect(Math.hypot(...sub(a, b)) * 1000).toBeLessThan(mm);
  /** Times inside loop step `k` at a pace, `fractions` of the way through it. */
  const stepTimes = (prep: Prepared, k: number, fractions = [0.05, 0.3, 0.5, 0.7, 0.95]) => {
    for (const seg of prep.segs)
      for (const part of seg.parts) {
        if (part.step !== k) continue;
        const eased = seg.phase === 'eccentric' || seg.phase === 'concentric';
        const inv = (q: number) => (eased ? Math.acos(1 - 2 * q) / Math.PI : q);
        return fractions.map(
          (f) => seg.t0 + inv(part.u0 + f * (part.u1 - part.u0)) * (seg.t1 - seg.t0),
        );
      }
    return [];
  };
  /** The checks every catalogue animation passes, on a fixture. */
  const sound = (anim: ExerciseAnimation) => {
    valid(anim);
    for (const [, pace] of PACES) {
      const prep = prepare(anim, pace);
      const ts = Array.from({ length: 121 }, (_, i) => (prep.duration * i) / 120);
      expect(Math.max(...ts.map((t) => evaluate(prep, t).miss)) * 1000).toBeLessThan(2);
      for (const t of ts) {
        const { frames, loop } = evaluate(prep, t);
        for (const q of buildParts(frames, anim, { loop }))
          if (!q.hull && !q.layer)
            expect(Math.min(q.a[1] - q.ra, q.b[1] - q.rb)).toBeGreaterThan(-0.004);
      }
    }
    expect(jumps(anim)).toEqual([]);
  };
  const wristOf = (anim: ExerciseAnimation, t: number, S: 'l' | 'r' = 'r') =>
    evaluate(prepare(anim, NEUTRAL), t).frames[`wrist.${S}`].o;

  describe('contacts that come and go', () => {
    // A plank on the toes: the right hand leaves its spot, taps the left shoulder, plants a step
    // further out, then walks back. Every step goes to the same pose: only the hand moves.
    const PLANK = plank(78, { shoulder: { plane: 90, elev: 78 }, elbow: { flex: 0 } });
    const placed = evaluate(
      prepare(animation({ top: PLANK }, rep('top', 'top'), [onToes()]), NEUTRAL),
      0,
    ).frames;
    const S = placed['shoulder.r'].o;
    const L = placed['shoulder.l'].o;
    const A: Vec3 = [S[0], 0, S[2] + 0.02];
    const B: Vec3 = [S[0] + 0.15, 0, S[2] + 0.02];
    /** The right hand's tap, in the chest's axes: beside the left shoulder. */
    const TAP: Vec3 = [0.05, 0.22, -0.2];
    const tap = animation(
      { top: PLANK },
      [...rep('top', 'top'), ...rep('top', 'top')],
      [
        onToes(),
        { mode: 'plant', contact: 'hand.l', at: [L[0], 0, L[2] - 0.02] },
        { mode: 'plant', contact: 'hand.r', at: A, steps: [6, 7, 0] },
        { mode: 'grip', contact: 'hand.r', frame: 'chest', at: TAP, steps: [2] },
        { mode: 'plant', contact: 'hand.r', at: B, steps: [4] },
      ],
    );

    it('holds each plant still, grips in between and arcs from plant to plant', () => {
      sound(tap);
      const prep = prepare(tap, NEUTRAL);
      const lift: Vec3 = [0, BODY.wrist, 0];
      for (const k of [6, 7, 0])
        for (const t of stepTimes(prep, k)) near(wristOf(tap, t), add3(A, lift));
      for (const t of stepTimes(prep, 4)) near(wristOf(tap, t), add3(B, lift));
      for (const t of stepTimes(prep, 2)) {
        const F = evaluate(prep, t).frames;
        near(F['wrist.r'].o, at(F.chest, TAP));
      }
      // From B back to A over one step: up in the air half-way, 8 cm by default.
      const [mid] = stepTimes(prep, 5, [0.5]);
      expect(wristOf(tap, mid!)[1]).toBeGreaterThan(BODY.wrist + 0.07);
      // The other hand never moves.
      const left = (t: number) => wristOf(tap, t, 'l');
      for (let i = 0; i <= 20; i++) near(left((prep.duration * i) / 20), left(0));
    });

    it('lets a hand go with the poses between two plants several steps apart', () => {
      const shoulder = evaluate(prepare(animation({ s: STAND }, rep('s', 's'), feet()), NEUTRAL), 0)
        .frames['shoulder.r'].o;
      const spot: Vec3 = [shoulder[0] + 0.5, shoulder[1], shoulder[2]];
      const reach = pose(STAND, { 'shoulder.r': { plane: 90, elev: 88 }, 'elbow.r': { flex: 10 } });
      const loop: ExerciseAnimation['loop'] = [
        ...rep('reach', 'stand'),
        { to: 'reach', phase: 'eccentric' },
      ];
      const poses = { stand: STAND, reach };
      const wallHand = handOnWall(spot, [-1, 0, 0], [-0.3, -0.8, 0.5], 'r');
      const touch = animation(poses, loop, [...feet(), ...during([0, 1], [wallHand])]);
      sound(touch);
      const bare = animation(poses, loop, feet());
      const prep = prepare(touch, NEUTRAL);
      const free = prepare(bare, NEUTRAL);
      for (const k of [0, 1])
        for (const t of stepTimes(prep, k))
          near(wristOf(touch, t), add3(spot, [-BODY.wrist, 0, 0]));
      // In the middle of the gap the arm is exactly where the poses put it.
      for (const t of stepTimes(prep, 3)) {
        const a = evaluate(prep, t).frames;
        const b = evaluate(free, t).frames;
        near(a['wrist.r'].o, b['wrist.r'].o, 0.001);
        near(at(a['wrist.r'], [0, -0.06, 0]), at(b['wrist.r'], [0, -0.06, 0]), 0.001);
      }
      // It leaves during step 2 and arrives during step 4, without a jump (checked in `sound`).
      const [leaving] = stepTimes(prep, 2, [0.5]);
      expect(Math.abs(wristOf(touch, leaving!)[0] - spot[0])).toBeGreaterThan(0.05);
    });

    it('moves the body from one anchor to another', () => {
      const kneel = pose(KNEEL, { root: { pos: [0, 0.5, 0] } });
      const moving = animation(
        { k: kneel },
        [...rep('k', 'k'), { to: 'k', phase: 'eccentric' }, { to: 'k', phase: 'concentric' }],
        [
          { mode: 'anchor', contact: 'knees', at: [0, 0, 0], steps: [0, 1] },
          { mode: 'anchor', contact: 'knees', at: [0.3, 0, 0], steps: [3, 4] },
        ],
        [],
        'k',
      );
      sound(moving);
      const prep = prepare(moving, NEUTRAL);
      const knees = (t: number): Vec3 => {
        const F = evaluate(prep, t).frames;
        return [
          (F['knee.l'].o[0] + F['knee.r'].o[0]) / 2,
          (F['knee.l'].o[1] + F['knee.r'].o[1]) / 2,
          0,
        ];
      };
      for (const t of stepTimes(prep, 0)) near(knees(t), [0, BODY.knee, 0]);
      for (const t of stepTimes(prep, 4)) near(knees(t), [0.3, BODY.knee, 0]);
      const [half] = stepTimes(prep, 2, [0.5]);
      expect(knees(half!)[0]).toBeCloseTo(0.15, 2);
    });

    it('flags a hand that jumps from one spot to another', () => {
      // Not valid data (no step between the two plants): the check must see the jump.
      const teleport = {
        ...tap,
        pins: [
          onToes(),
          { mode: 'plant', contact: 'hand.r', at: A, steps: [0, 1, 2, 3, 4, 5] },
          { mode: 'plant', contact: 'hand.r', at: B, steps: [6, 7] },
        ],
      } satisfies ExerciseAnimation;
      expect(ExerciseAnimationSchema.safeParse(teleport).success).toBe(false);
      expect(jumps(teleport).some((j) => j.startsWith('wrist.r'))).toBe(true);
    });

    it('checks steps in the schema', () => {
      const parse = (pins: ExerciseAnimation['pins'], loop = tap.loop) =>
        ExerciseAnimationSchema.safeParse({ ...tap, pins, loop }).success;
      const hand = (steps: number[], at: Vec3 = A) =>
        ({ mode: 'plant', contact: 'hand.r', at, steps }) as const;
      expect(parse([hand([0, 1]), hand([3, 4], B)])).toBe(true);
      // Two pins on one hand in one step, a step out of the loop, a step listed twice.
      expect(parse([hand([0, 1]), hand([1, 2], B)])).toBe(false);
      expect(parse([hand([0, 8])])).toBe(false);
      expect(parse([hand([0, 0])])).toBe(false);
      // A hand passes to another pin only across a step in which neither holds.
      expect(parse([hand([0, 1]), hand([2, 3], B)])).toBe(false);
      // A swing needs the plant in its step and the next.
      const swing = tap.loop.map((st, i) => (i === 1 ? { ...st, swing: 'hand.r' as const } : st));
      expect(parse([hand([0, 1, 2])], swing)).toBe(true);
      expect(parse([hand([0, 1])], swing)).toBe(false);
      expect(parse([hand([3, 4])], swing)).toBe(false);
      // One anchor per step; anchors may now take turns.
      const knees = (steps: number[]) => ({ mode: 'anchor', contact: 'knees', steps }) as const;
      expect(parse([knees([0, 1]), { ...knees([3, 4]), contact: 'toes' }])).toBe(true);
      expect(parse([knees([0, 1]), { ...knees([1, 4]), contact: 'toes' }])).toBe(false);
      expect(parse([knees([0, 1]), { mode: 'anchor', contact: 'toes' }])).toBe(false);
      // Lift may be 0 (a hand rolling along), not negative.
      expect(parse([{ ...hand([0]), lift: 0 }])).toBe(true);
      expect(parse([{ ...hand([0]), lift: -0.1 }])).toBe(false);
    });
  });

  describe('a forearm on the floor', () => {
    // The lean that puts the shoulders an upper arm's length over the elbows' spots.
    const shoulderY = (lean: number) =>
      evaluate(prepare(animation({ p: plank(lean) }, rep('p', 'p'), [onToes()]), NEUTRAL), 0)
        .frames['shoulder.r'].o[1];
    let [lo, hi] = [60, 89];
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (shoulderY(mid) > 0.32) lo = mid;
      else hi = mid;
    }
    const LEAN = (lo + hi) / 2;

    it('lies flat with the elbow under the shoulder', () => {
      const anim = animation({ p: plank(LEAN, { elbow: { flex: 90 } }) }, rep('p', 'p'), [
        onToes(),
        ...onForearms(),
      ]);
      sound(anim);
      const F = evaluate(prepare(anim, NEUTRAL), 0).frames;
      for (const S of ['l', 'r'] as const) {
        const sh = F[`shoulder.${S}`].o;
        const el = F[`elbow.${S}`].o;
        const wr = F[`wrist.${S}`].o;
        near(el, [sh[0], 0.04, sh[2]]);
        expect(wr[1]).toBeCloseTo(BODY.wrist, 3);
        expect(wr[0] - el[0]).toBeCloseTo(BODY.forearm, 2);
        expect(wr[2]).toBeCloseTo(el[2], 3);
        // The hand lies on along the forearm.
        expect(at(F[`wrist.${S}`], [0, -0.06, 0])[1]).toBeCloseTo(BODY.wrist, 3);
      }
    });

    it('rests on given spots, and only arms do', () => {
      const anim = animation({ p: plank(LEAN, { elbow: { flex: 90 } }) }, rep('p', 'p'), [
        onToes(),
        ...onForearms(shoulderX(LEAN), 0.34),
      ]);
      valid(anim);
      const F = evaluate(prepare(anim, NEUTRAL), 0).frames;
      expect(F['elbow.l'].o[2]).toBeCloseTo(-0.17, 2);
      expect(F['elbow.r'].o[2]).toBeCloseTo(0.17, 2);
      expect(
        ExerciseAnimationSchema.safeParse({
          ...anim,
          pins: [{ mode: 'plant', contact: 'foot.r', rest: 'forearm' }],
        }).success,
      ).toBe(false);
    });

    function shoulderX(lean: number) {
      return evaluate(prepare(animation({ p: plank(lean) }, rep('p', 'p'), [onToes()]), NEUTRAL), 0)
        .frames['shoulder.r'].o[0];
    }
  });

  describe('props carried by the body', () => {
    it('rolls an ab wheel on the floor between the fists', () => {
      const R = 0.09;
      const kneeling = (tilt: number, lean: number): Pose =>
        pose(
          legAbs('l', -tilt, 90 - tilt, -170, lean),
          legAbs('r', -tilt, 90 - tilt, -170, lean),
          { root: { lean }, spine: { flex: 6 }, chest: { flex: 4 } },
          { shoulder: { plane: 90, elev: lean + 10 }, elbow: { flex: 6 } },
        );
      const poses = { in: kneeling(0, 62), out: kneeling(35, 84) };
      const knees: ExerciseAnimation['pins'][number] = {
        mode: 'anchor',
        contact: 'knees',
        at: [0, 0, 0],
      };
      const shoulder = (name: 'in' | 'out') =>
        evaluate(prepare(animation(poses, rep(name, name), [knees]), NEUTRAL), 0).frames[
          'shoulder.r'
        ].o;
      // Where a slightly bent arm reaches the axle's height ahead of the shoulders.
      const spotX = (name: 'in' | 'out') => {
        const s = shoulder(name);
        return s[0] + Math.sqrt(Math.max(0.01, 0.53 ** 2 - (s[1] - R) ** 2));
      };
      const fist = (
        S: 'l' | 'r',
        x: number,
        steps: number[],
      ): ExerciseAnimation['pins'][number] => ({
        mode: 'plant',
        contact: `hand.${S}`,
        rest: 'grip',
        at: [x, R, S === 'l' ? -0.1 : 0.1],
        lift: 0,
        steps,
      });
      const [xIn, xOut] = [spotX('in'), spotX('out')];
      const anim = animation(
        poses,
        rep('out', 'in'),
        [
          knees,
          fist('l', xIn, [3]),
          fist('r', xIn, [3]),
          fist('l', xOut, [1]),
          fist('r', xOut, [1]),
        ],
        [{ kind: 'ab-wheel', id: 'wheel', group: 'handle', r: R }],
      );
      sound(anim);
      const prep = prepare(anim, NEUTRAL);
      for (let i = 0; i <= 40; i++) {
        const t = (prep.duration * i) / 40;
        const { frames: F } = evaluate(prep, t);
        const parts = buildParts(F, anim);
        const wheel = parts.find((q) => q.id === 'wheel/wheel')!;
        expect(Math.min(...wheel.hull!.map((q) => q[1]))).toBeCloseTo(0, 6);
        const handle = parts.find((q) => q.id === 'wheel/handle')!;
        // Both fists on the handle, at the axle's height, all the way out and back.
        for (const S of ['l', 'r'] as const) {
          const g = at(F[`wrist.${S}`], GRIP);
          expect(Math.abs(g[1] - R) * 1000).toBeLessThan(2);
          if (!handle.hull) {
            expect(g[0]).toBeCloseTo(handle.a[0], 2);
            expect(handle.a[1]).toBeCloseTo(R, 6);
          }
        }
      }
      // Rolling out: half-way, the fists are between the two spots.
      const [half] = stepTimes(prep, 0, [0.5]);
      const g = at(evaluate(prep, half!).frames['wrist.r'], GRIP);
      expect(g[0]).toBeGreaterThan(xIn + 0.05);
      expect(g[0]).toBeLessThan(xOut - 0.05);
      // The wheel shades the floor where it rolls.
      const fr = frame(anim, 350, 240);
      expect(fr.contacts.some(([x]) => x > xIn - 0.05)).toBe(true);
      expect(buildParts(evaluate(prep, 0).frames, anim, { mirror: true }).length).toBe(
        buildParts(evaluate(prep, 0).frames, anim).length,
      );
    });

    it('carries a box turning with a segment, a level seat and a handle between the fists', () => {
      const poses = {
        a: STAND,
        b: pose(STAND, { root: { pos: [0.2, 0.9, 0], lean: 20 }, spine: { flex: 10 } }),
      };
      const props: ExerciseAnimation['props'] = [
        {
          kind: 'box',
          id: 'plate',
          group: 'db',
          frame: 'chest',
          min: [0.1, 0.1, -0.1],
          max: [0.14, 0.3, 0.1],
        },
        {
          kind: 'box',
          id: 'seat',
          group: 'handle',
          equipment: 'rower',
          frame: 'root',
          slide: true,
          min: [-0.2, 0.3, -0.12],
          max: [0.15, 0.36, 0.12],
        },
        {
          kind: 'capsule',
          id: 'bar',
          group: 'handle',
          a: { frame: 'wrist.l', at: GRIP },
          b: { frame: 'wrist.r', at: GRIP },
          r: 0.015,
        },
        { kind: 'box', id: 'step', group: 'door', min: [0.5, 0, -0.2], max: [0.8, 0.2, 0.2] },
      ];
      const anim = animation(poses, rep('b', 'a'), feet(), props);
      valid(anim);
      const prep = prepare(anim, NEUTRAL);
      for (const t of [0, prep.duration / 3, timeOf(prep, 'b')]) {
        const { frames: F } = evaluate(prep, t);
        const parts = buildParts(F, anim);
        const by = (id: string) => parts.find((q) => q.id === id)!;
        const plate = by('plate').hull!;
        near(plate[0]!, at(F.chest, [0.1, 0.1, -0.1]), 0.001);
        near(plate[7]!, at(F.chest, [0.14, 0.3, 0.1]), 0.001);
        const seat = by('seat').hull!;
        expect(seat.every((q) => Math.abs(q[1] - 0.3) < 1e-9 || Math.abs(q[1] - 0.36) < 1e-9)).toBe(
          true,
        );
        near(seat[0]!, [F.root.o[0] - 0.2, 0.3, F.root.o[2] - 0.12], 0.001);
        const bar = by('bar');
        if (!bar.hull) {
          near(bar.a, at(F['wrist.l'], GRIP), 0.001);
          near(bar.b, at(F['wrist.r'], GRIP), 0.001);
        }
        // Carried boxes are framed with the figure; a box in the room stays scenery.
        expect(by('plate').layer).toBeUndefined();
        expect(by('step').layer).toBe('scenery');
      }
      expect(
        ExerciseAnimationSchema.safeParse({
          ...anim,
          props: [
            { kind: 'box', id: 'x', group: 'db', slide: true, min: [0, 0, 0], max: [1, 1, 1] },
          ],
        }).success,
      ).toBe(false);
    });
  });

  describe('a jump rope', () => {
    const land = pose(STAND, {
      shoulder: { plane: 40, elev: 22 },
      elbow: { flex: 50 },
      knee: { flex: 14 },
      root: { pos: [0, 0.9, 0] },
    });
    const air = pose(land, {
      root: { pos: [0, 1.03, 0] },
      knee: { flex: 4 },
      ankle: { flex: -25 },
    });
    const rope = (
      extra: Partial<Extract<ExerciseAnimation['props'][number], { kind: 'jump-rope' }>> = {},
    ) =>
      animation(
        { land, air },
        rep('land', 'air'),
        [],
        [{ kind: 'jump-rope', id: 'rope', under: 0.875, ...extra }],
      );
    /** In the air: the middle of the hold, 3.5 steps of 4 into the loop. */
    const inAir = (anim: ExerciseAnimation) => {
      const prep = prepare(anim, NEUTRAL);
      return stepTimes(prep, 3, [0.5])[0]!;
    };
    const ropeAt = (anim: ExerciseAnimation, loop?: number) => {
      const prep = prepare(anim, NEUTRAL);
      const { frames: F } = evaluate(prep, inAir(anim));
      const parts = buildParts(F, anim, loop === undefined ? {} : { loop }).filter((q) =>
        q.group.startsWith('rope'),
      );
      const pts = parts.flatMap((q) => (q.hull ? [] : [q.a, q.b]));
      const head = at(F.head, [0, 0.11, 0])[1] + 0.09;
      const mid = add3(at(F['wrist.l'], GRIP), at(F['wrist.r'], GRIP)).map((x) => x / 2) as Vec3;
      return { F, parts, pts, head, mid };
    };

    it('runs from fist to fist and turns forward, under the feet at its mark', () => {
      const anim = rope();
      valid(anim);
      const prep = prepare(anim, NEUTRAL);
      expect(evaluate(prep, inAir(anim)).loop).toBeCloseTo(0.875, 6);
      const under = ropeAt(anim, 0.875);
      expect(under.parts).toHaveLength(24);
      expect(new Set(under.parts.map((q) => q.group))).toEqual(new Set(['rope.l', 'rope.r']));
      const first = under.parts[0]!;
      const last = under.parts[under.parts.length - 1]!;
      if (!first.hull && !last.hull) {
        near(first.a, at(under.F['wrist.l'], GRIP), 0.001);
        near(last.b, at(under.F['wrist.r'], GRIP), 0.001);
      }
      const low = Math.min(...under.pts.map((q) => q[1]));
      expect(low).toBeGreaterThan(0.005);
      expect(low).toBeLessThan(0.02);
      const toes = (['l', 'r'] as const).map((S) => at(under.F[`ankle.${S}`], BODY.toe));
      expect(low).toBeLessThan(Math.min(...toes.map((q) => q[1])) - 0.02);
      // Right under the feet, between the heels and the toes.
      const bottom = under.pts.reduce((m, q) => (q[1] < m[1] ? q : m));
      expect(bottom[0]).toBeGreaterThan(under.F['ankle.r'].o[0] - 0.08);
      expect(bottom[0]).toBeLessThan(Math.max(...toes.map((q) => q[0])) + 0.02);
      // Without a loop position (thumbnails), it is drawn under the feet.
      expect(Math.min(...ropeAt(anim).pts.map((q) => q[1]))).toBeCloseTo(low, 6);
      // A quarter turn later it rises behind, then passes over the head, then comes down in front.
      const behind = ropeAt(anim, 0.875 + 0.25 - 1);
      expect(Math.min(...behind.pts.map((q) => q[0]))).toBeLessThan(behind.F.head.o[0] - 0.35);
      const over = ropeAt(anim, 0.375);
      const top = Math.max(...over.pts.map((q) => q[1]));
      expect(top).toBeGreaterThan(over.head);
      expect(top).toBeLessThan(over.head + 0.1);
      const front = ropeAt(anim, 0.625);
      expect(Math.max(...front.pts.map((q) => q[0]))).toBeGreaterThan(front.F.head.o[0] + 0.35);
    });

    it('turns as often as asked, and barely widens the framing', () => {
      const twice = rope({ turns: 2 });
      valid(twice);
      expect(Math.min(...ropeAt(twice, 0.375).pts.map((q) => q[1]))).toBeLessThan(0.02);
      expect(ExerciseAnimationSchema.safeParse(rope({ turns: 1.5 })).success).toBe(false);
      const bare = animation({ land, air }, rep('land', 'air'), []);
      for (const [w, h] of [
        [350, 240],
        [350, 96],
      ] as const)
        expect(frame(twice, w, h).scale / frame(bare, w, h).scale).toBeGreaterThan(0.85);
      const solved = evaluate(prepare(twice, NEUTRAL), 0);
      const two = buildParts(solved.frames, twice, { mirror: true, loop: 0.3 });
      expect(two.some((q) => q.group === 'rope.l')).toBe(true);
    });
  });

  describe('a loop of several reps under the tempo', () => {
    const open = pose(STAND, { shoulder: { plane: 0, elev: 80 } });
    const cross = (S: 'l' | 'r') =>
      pose(STAND, {
        [`shoulder.${S}`]: { plane: 90, elev: 85 },
        [`elbow.${S}`]: { flex: 30 },
      } as Pose);
    const anim = animation(
      { open, crossR: cross('r'), crossL: cross('l') },
      [...rep('crossR', 'open'), ...rep('crossL', 'open')],
      feet(),
    );
    const tempo = { down: 2, pause: 1, up: 2 };

    it('runs through every rep in step with the tempo clock', () => {
      valid(anim);
      const prep = prepare(anim, tempoPace(tempo));
      expect(prep.reps).toHaveLength(2);
      expect(prep.duration).toBe(10);
      expect(timeAtPhase(prep, 'eccentric', 0, 1)).toBeCloseTo(5);
      expect(timeAtPhase(prep, 'pause', 0.5, 1)).toBeCloseTo(7.5);
      expect(timeAtPhase(prep, 'eccentric', 0, 2)).toBeCloseTo(0);
      expect(timeAtPhase(prep, 'concentric', 0.5, -1)).toBeCloseTo(9);
      // Followed from the pacer's own clock, the loop time is the clock's, rep after rep.
      const counted = repCounter();
      for (let e = 0; e < 25; e += 0.05) {
        const point = tempoPoint(tempo, e);
        const expected = e % 10;
        const t = timeAtPhase(prep, PHASE_OF_TEMPO[point.phase], point.progress, point.rep);
        expect(Math.abs(t - expected)).toBeLessThan(1e-3);
        // A source without rep numbers is counted the same.
        const { rep: _rep, ...bare } = point;
        const u = timeAtPhase(prep, PHASE_OF_TEMPO[bare.phase], bare.progress, counted(bare));
        expect(Math.abs(u - expected)).toBeLessThan(1e-3);
      }
      // The second rep crosses the left arm.
      const second = evaluate(prep, timeAtPhase(prep, 'pause', 0.5, 1)).frames;
      expect(second['wrist.l'].o[0]).toBeGreaterThan(second['wrist.r'].o[0]);
    });

    it('marks continuous cycles, which keep their own pace', () => {
      const parse = (patch: Record<string, unknown>) =>
        ExerciseAnimationSchema.safeParse({ ...anim, ...patch }).success;
      expect(parse({ cycle: true })).toBe(true);
      expect(parse({ cycle: 'yes' })).toBe(false);
      // A loop is closed: it starts in the pose its last step ends in.
      expect(parse({ start: 'crossR' })).toBe(false);
    });

    it('keeps one-rep loops as they were', () => {
      const prep = prepare(animations['goblet-squat']!, tempoPace(tempo));
      expect(prep.reps).toHaveLength(1);
      expect(timeAtPhase(prep, 'pause', 0.5, 3)).toBeCloseTo(timeAtPhase(prep, 'pause', 0.5));
    });
  });

  describe('shared helpers', () => {
    const solved = (p: Pose) =>
      evaluate(prepare(animation({ p }, rep('p', 'p'), []), NEUTRAL), 0).frames;

    it('aims limbs, names keys and runs through them', () => {
      expect(aim([1, 0, 0])).toEqual({ plane: 90, elev: 90 });
      expect(aim([0, -1, 0], 30)).toEqual({ plane: 30, elev: 0 });
      expect(aim([-1, 0, 0], 0).plane).toBe(-90);
      expect(aim([-1, 0, 0], 200).plane).toBe(270);
      expect(keys('c', 0, 2)).toEqual(['c0', 'c1', 'c2']);
      expect(keys('c', 2, 0)).toEqual(['c2', 'c1', 'c0']);
      expect(through(['a', 'b'], 'pause')).toEqual([
        { to: 'a', phase: 'pause' },
        { to: 'b', phase: 'pause' },
      ]);
      expect(arms(90)).toEqual({ shoulder: { plane: 90, elev: 90, rot: 0 }, elbow: { flex: 6 } });
      expect(arms(30, 120, 10)).toEqual({
        shoulder: { plane: 90, elev: 40, rot: 0 },
        elbow: { flex: 90 },
      });
    });

    it('places the trunk, hangs from the shoulders and finds the hips', () => {
      const t = trunk([0.1, 0.9], 30, 5, 5);
      const F = solved({
        root: { pos: [t.root[0], t.root[1], 0], lean: 30 },
        spine: { flex: 5 },
        chest: { flex: 5 },
      });
      expect(F['shoulder.r'].o[0]).toBeCloseTo(t.shoulder[0], 3);
      expect(F['shoulder.r'].o[1]).toBeCloseTo(t.shoulder[1], 3);
      expect(t.chestLean).toBe(40);
      const hung = solved(hangFrom([0.05, 1.45], -10, 8, 4));
      expect(hung['shoulder.r'].o[0]).toBeCloseTo(0.05, 2);
      expect(hung['shoulder.r'].o[1]).toBeCloseTo(1.45, 2);
      const hip = hipBetween([0, 0.5], [1.2, 0.1], 0.5, 0.85);
      expect(Math.hypot(hip[0], hip[1] - 0.5)).toBeCloseTo(0.5, 6);
      expect(Math.hypot(hip[0] - 1.2, hip[1] - 0.1)).toBeCloseTo(0.85, 6);
      expect(lSit([0, 1.0], 90).straight).toEqual(['arm.l', 'arm.r', 'leg.l', 'leg.r']);
      expect(sidePlank(76, 0.38).root).toEqual({ pos: [0, 0.38, 0], lean: 0, tilt: 76 });
    });

    it('builds contacts', () => {
      expect(dipHands(0.45).map((p) => p.mode === 'plant' && p.at?.[1])).toEqual([0.45, 0.45]);
      expect(forearms(1.5).map((p) => p.mode === 'plant' && p.at)).toEqual([
        [1.5, 0, -0.17],
        [1.5, 0, 0.17],
      ]);
      expect(onForearms()[0]).toEqual({ contact: 'hand.l', mode: 'plant', rest: 'forearm' });
      expect(handOnWall([0.5, 1.3, 0], [-1, 0, 0], [0, -1, 0]).contact).toBe('hand.l');
      expect(
        during(
          [1, 2],
          [...feet(), { mode: 'tether', contact: 'hand.r', anchor: [0, 2, 0], length: 1 }],
        ),
      ).toEqual([
        { contact: 'foot.l', mode: 'plant', steps: [1, 2] },
        { contact: 'foot.r', mode: 'plant', steps: [1, 2] },
        { mode: 'tether', contact: 'hand.r', anchor: [0, 2, 0], length: 1 },
      ]);
    });
  });

  it('frames the wide per-side stills by the tile rule', () => {
    const wide = [
      'dead-bug',
      'bird-dog',
      'side-plank',
      'clamshell',
      'side-lying-leg-raise',
      'renegade-row',
      'band-leg-curl',
    ].filter((id) => animations[id]);
    expect(wide.length).toBeGreaterThan(0);
    for (const id of wide)
      for (const size of [72, 56]) expect(tileProblems(animations[id]!, size, size)).toEqual([]);
  });
});

const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
