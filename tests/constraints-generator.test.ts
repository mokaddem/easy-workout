import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/catalogue';
import {
  JOINT_REGIONS,
  type JointRegion,
  type Level,
  type Profile,
  type Programme,
  type Session,
} from '../src/domain';
import { constraintsOf, fitFor, generateProgramme, type Constraints } from '../src/engine';
import { referenceEquipment } from './fixtures/reference-equipment';
import { equipmentSets } from './fixtures/equipment-sets';

const SINCE = '2026-01-01T00:00:00.000Z';

const profileFor = (level: Level, avoided: Partial<Profile> = {}): Profile => ({
  goal: 'recomposition',
  level,
  daysPerWeek: 5,
  sessionMinutes: 60,
  ...avoided,
});

const limited = (region: JointRegion): Partial<Profile> => ({
  limitations: [{ region, since: SINCE }],
});

const itemsOf = (session: Session) =>
  [...session.warmup, ...session.main, ...session.finisher].flatMap((b) =>
    b.type === 'straight' ? [b.item] : b.items,
  );

const sections = (session: Session) => ({
  warmup: session.warmup,
  worked: [...session.main, ...session.finisher],
});

const exercisesOf = (blocks: Session['main']) =>
  blocks
    .flatMap((b) => (b.type === 'straight' ? [b.item] : b.items))
    .map((i) => exerciseById.get(i.exerciseId)!);

/** Every exercise of the programme is allowed; main and finisher spare one joint at most once per session. */
const expectRespected = (programme: Programme, constraints: Constraints) => {
  for (const session of programme.rotation) {
    for (const item of itemsOf(session))
      expect(
        fitFor(exerciseById.get(item.exerciseId)!, constraints),
        `${session.id}: ${item.exerciseId}`,
      ).not.toBe('out');
    const { warmup, worked } = sections(session);
    for (const blocks of [warmup, worked])
      for (const region of constraints.regions) {
        const sparing = new Set(
          exercisesOf(blocks)
            .filter((e) => e.joints[region] === 'moderate')
            .map((e) => e.id),
        );
        expect(sparing.size, `${session.id} spares ${region}`).toBeLessThanOrEqual(1);
      }
  }
};

const readable = (programme: Programme): string => {
  const lines: string[] = [];
  for (const n of programme.generation?.notes ?? []) {
    const at = n.ref?.sessionId ?? '-';
    switch (n.code) {
      case 'slot-limited':
        lines.push(
          `  ${at}: ${n.params.slot} left out (${n.params.cause}${n.params.region ? ` ${n.params.region}` : ''})`,
        );
        break;
      case 'slot-dropped':
        lines.push(`  ${at}: ${n.params.slot} left out (no equipment)`);
        break;
      case 'exercise-fallback-pattern':
        lines.push(`  ${at}: ${n.params.slot} -> ${n.params.exerciseId} [${n.params.pattern}]`);
        break;
      case 'cardio-unavailable':
        lines.push(`  ${at}: cardio unavailable`);
        break;
      case 'finisher-thin':
        lines.push(`  ${at}: finisher is a short plain circuit`);
        break;
      case 'muscle-volume-reduced':
        lines.push(`  week: ${n.params.muscle} ${n.params.before} -> ${n.params.after} sets`);
        break;
    }
  }
  return lines.length > 0 ? lines.join('\n') : '  (nothing left out)';
};

const columns: [string, Partial<Profile>][] = [
  ...JOINT_REGIONS.map((r): [string, Partial<Profile>] => [r, limited(r)]),
  ['quiet + small space', { quiet: true, smallSpace: true }],
];

describe('generator with constraints — bodyweight only', () => {
  const rows: string[] = [];
  for (const level of ['beginner', 'intermediate'] as const)
    for (const [name, avoided] of columns)
      it(`${level} · ${name}`, () => {
        const profile = profileFor(level, avoided);
        const programme = generateProgramme({ profile, equipment: equipmentSets.bodyweight! });
        expectRespected(programme, constraintsOf(profile));
        rows.push(`${level} · ${name}\n${readable(programme)}`);
      });

  it('records the slots left out and the fallbacks', async () => {
    await expect(`${rows.join('\n\n')}\n`).toMatchFileSnapshot(
      './__snapshots__/constraints-matrix.txt',
    );
  });
});

describe('generator with constraints — reference equipment', () => {
  it.each(JOINT_REGIONS)('respects a limited %s', (region) => {
    const profile = profileFor('intermediate', limited(region));
    expectRespected(
      generateProgramme({ profile, equipment: referenceEquipment }),
      constraintsOf(profile),
    );
  });

  it('respects several limited joints at once, and quiet', () => {
    const profile = profileFor('intermediate', {
      limitations: [
        { region: 'knee', since: SINCE },
        { region: 'shoulder', since: SINCE },
      ],
      quiet: true,
    });
    expectRespected(
      generateProgramme({ profile, equipment: referenceEquipment }),
      constraintsOf(profile),
    );
  });
});
