import { describe, expect, it } from 'vitest';
import type { SessionLog } from '../domain';
import { setsCsv } from './csv';

const log: SessionLog = {
  id: 'l1',
  source: { kind: 'programme', programmeId: 'p', week: 2, sessionId: 'a' },
  plan: {
    id: 'a',
    name: { fr: 'Séance A, "poussée"', en: 'Session A' },
    estimatedMinutes: 40,
    warmup: [],
    main: [
      {
        type: 'straight',
        item: { exerciseId: 'push-up', target: { kind: 'reps', min: 8, max: 12 } },
        sets: 2,
        restSec: 60,
      },
    ],
    finisher: [],
  },
  status: 'completed',
  startedAt: '2026-11-14T08:00:00Z',
  sets: [
    {
      section: 'main',
      blockIndex: 0,
      itemIndex: 0,
      set: 1,
      exerciseId: 'push-up',
      planned: {
        target: { kind: 'reps', min: 8, max: 12 },
        load: { kind: 'kg', kg: 12.5 },
        rir: 2,
      },
      actual: { reps: 10, load: { kind: 'kg', kg: 12.5 } },
      edited: true,
      feel: 'hard',
      at: '2026-11-14T08:05:00Z',
    },
    {
      section: 'main',
      blockIndex: 0,
      itemIndex: 0,
      set: 2,
      exerciseId: 'push-up',
      planned: { target: { kind: 'reps', min: 8, max: 12 } },
      flag: 'pain',
      at: '2026-11-14T08:07:00Z',
    },
  ],
};

describe('setsCsv', () => {
  it('writes one row per set, quoting where needed', () => {
    const csv = setsCsv([log], 'fr', () => 'Pompes');
    const lines = csv.replace(String.fromCharCode(0xfeff), '').trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]!.startsWith('date,session,status,source,week,section,exercise_id')).toBe(true);
    expect(lines[1]).toBe(
      '2026-11-14T08:05:00Z,"Séance A, ""poussée""",completed,programme,2,main,push-up,Pompes,1,,8-12,12.5 kg,2,10,,,,,12.5 kg,hard,,true',
    );
    expect(lines[2]).toContain(',pain,');
  });
});
