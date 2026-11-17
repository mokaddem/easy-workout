import { describe, expect, it } from 'vitest';
import type { SessionLog } from '@/domain';
import { exerciseBlocks } from './blocks';

const plan = {
  id: 's',
  name: { fr: 's', en: 's' },
  estimatedMinutes: 30,
  warmup: [
    {
      type: 'straight',
      sets: 1,
      restSec: 0,
      item: { exerciseId: 'arm-circles', target: { kind: 'reps', min: 10, max: 10 } },
    },
  ],
  main: [
    {
      type: 'straight',
      sets: 3,
      restSec: 60,
      item: { exerciseId: 'push-up', target: { kind: 'reps', min: 8, max: 12 } },
    },
    {
      type: 'straight',
      sets: 2,
      restSec: 60,
      item: { exerciseId: 'plank', target: { kind: 'time', minSec: 30, maxSec: 40 } },
    },
  ],
  finisher: [],
};
const at = '2026-11-09T10:00:00.000Z';
const set = (section: string, blockIndex: number, n: number, rest: object) => ({
  section,
  blockIndex,
  itemIndex: 0,
  set: n,
  exerciseId: 'x',
  at,
  planned: { target: { kind: 'reps', min: 8, max: 12 }, goal: 9 },
  ...rest,
});

describe('exercise blocks', () => {
  it('lists every exercise in order with the sets logged for it', () => {
    const sets = [
      set('main', 0, 2, { actual: { reps: 9, load: { kind: 'kg', kg: 10 } }, feel: 'right' }),
      set('main', 0, 1, { actual: { reps: 10 } }),
      set('main', 1, 1, {
        planned: { target: { kind: 'time', minSec: 30, maxSec: 40 } },
        actual: { durationSec: 35 },
      }),
      set('main', 1, 2, { flag: 'pain', actual: { durationSec: 12 } }),
    ] as unknown as SessionLog['sets'];
    const blocks = exerciseBlocks({ plan, sets } as unknown as SessionLog);
    expect(blocks.map((b) => [b.section, b.exerciseId, b.rows.length])).toEqual([
      ['warmup', 'arm-circles', 0],
      ['main', 'push-up', 2],
      ['main', 'plank', 2],
    ]);
    expect(blocks[0]!.notReached).toBe(true);
    expect(blocks[1]!.rows.map((r) => r.n)).toEqual([1, 2]);
    expect(blocks[1]!.rows[1]).toMatchObject({
      value: 9,
      goal: 9,
      feel: 'right',
      load: { kg: 10 },
    });
    expect(blocks[2]!.stopped).toBe('pain');
    expect(blocks[2]!.rows[0]).toMatchObject({ unit: 'seconds', value: 35 });
  });
});
