import { describe, expect, it } from 'vitest';
import { exerciseById } from '@/catalogue';
import type { Session, SessionLog } from '@/domain';
import {
  checkSession,
  generateProgramme,
  generateQuickSession,
  placeSession,
  QUICK_FOCUSES,
} from '@/engine';
import { bodyweightBeginner, reference } from '../../../e2e/support/seed';
import {
  lastDone,
  MAX_SHOWN,
  placeChoices,
  sessionFocus,
  sortRows,
  trimRows,
  unusableIssues,
  whenDone,
  withoutUnusable,
} from './logic';

const quick = (focus: (typeof QUICK_FOCUSES)[number]): Session =>
  generateQuickSession({
    profile: reference.profile,
    equipment: reference.equipment,
    minutes: 30,
    focus,
    seed: 0,
  }).session;

const log = (over: Partial<SessionLog> & Pick<SessionLog, 'source'>): SessionLog => ({
  id: Math.random().toString(36),
  plan: quick('push'),
  status: 'completed',
  startedAt: '2026-11-10T10:00:00.000Z',
  endedAt: '2026-11-10T10:40:00.000Z',
  sets: [],
  ...over,
});

describe('session focus', () => {
  it.each(['push', 'pull', 'core', 'lower', 'upper', 'cardio'] as const)(
    'names a %s session',
    (f) => {
      expect(sessionFocus(quick(f), exerciseById)).toBe(f);
    },
  );
  it('names a full-body session', () => {
    expect(sessionFocus(quick('full'), exerciseById)).toBe('full');
  });
});

describe('last done', () => {
  const own = { id: 'own-1', name: { fr: 'Ma poussée', en: 'Ma poussée' } };
  const placedRun = (endedAt: string, name = own.name) =>
    log({
      source: { kind: 'programme', programmeId: 'p', week: 1, sessionId: 'd-upper' },
      plan: { ...quick('push'), name },
      endedAt,
    });
  const logs = [
    log({ source: { kind: 'custom', sessionId: 'own-1' }, endedAt: '2026-11-08T10:00:00.000Z' }),
    log({ source: { kind: 'custom', sessionId: 'own-1' }, endedAt: '2026-11-12T10:00:00.000Z' }),
    log({ source: { kind: 'custom', sessionId: 'own-2' }, endedAt: '2026-11-15T10:00:00.000Z' }),
    log({
      source: { kind: 'custom', sessionId: 'own-1' },
      status: 'abandoned',
      endedAt: '2026-11-16T10:00:00.000Z',
    }),
  ];
  const placed = { programmeId: 'p', sessionIds: ['d-upper'] };
  it('is the latest finished run on its own', () => {
    expect(lastDone(logs, own)?.toISOString()).toBe('2026-11-12T10:00:00.000Z');
  });
  it('counts runs in the programme place it holds', () => {
    const runs = [...logs, placedRun('2026-11-14T10:00:00.000Z')];
    expect(lastDone(runs, own, placed)?.toISOString()).toBe('2026-11-14T10:00:00.000Z');
  });
  it("ignores that place's runs from before it was placed", () => {
    const before = placedRun('2026-11-14T10:00:00.000Z', { fr: 'Séance D', en: 'Session D' });
    expect(lastDone([...logs, before], own, placed)?.toISOString()).toBe(
      '2026-11-12T10:00:00.000Z',
    );
  });
  it('is undefined when never done', () => {
    expect(lastDone(logs, { ...own, id: 'own-3' })).toBeUndefined();
  });
});

describe('when', () => {
  const now = new Date(2026, 10, 16, 14);
  it('says today, yesterday, days, then a date', () => {
    expect(whenDone(new Date(2026, 10, 16, 8), now)).toEqual({ kind: 'today' });
    expect(whenDone(new Date(2026, 10, 15, 23), now)).toEqual({ kind: 'yesterday' });
    expect(whenDone(new Date(2026, 10, 12), now)).toEqual({ kind: 'days', count: 4 });
    expect(whenDone(new Date(2026, 8, 1), now).kind).toBe('date');
  });
});

describe('list', () => {
  it('puts the newest used first', () => {
    const rows = [
      { id: 'a', lastDone: undefined, updatedAt: 5 },
      { id: 'b', lastDone: new Date(10), updatedAt: 1 },
      { id: 'c', lastDone: undefined, updatedAt: 7 },
    ];
    expect(sortRows(rows).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
  it('shows up to five, else the four most recent', () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => i);
    expect(trimRows(items(5))).toEqual({ shown: items(5), total: 5, trimmed: false });
    const six = trimRows(items(6));
    expect(six.shown).toHaveLength(MAX_SHOWN - 1);
    expect(six).toMatchObject({ total: 6, trimmed: true });
  });
});

describe('place choices', () => {
  const programme = { ...generateProgramme({ ...reference, seed: 0 }), id: 'p' };
  const input = {
    programme,
    customId: 'own-1',
    focus: 'upper' as const,
    nextSessionId: programme.rotation[0]!.id,
    lang: 'en' as const,
    focusOf: (s: Session) => sessionFocus(s, exerciseById),
    isCardio: (s: Session) =>
      s.main.every((b) => b.type === 'straight' && b.item.target.kind === 'cardio'),
    title: (s: Session) => s.name.en,
  };

  it('offers every session but the cardio day, lettered, with the next one marked', () => {
    const choices = placeChoices(input);
    expect(choices.map((c) => c.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(choices.some((c) => c.sessionId === 'cardio')).toBe(false);
    expect(choices.filter((c) => c.isNext)).toHaveLength(1);
    expect(choices.every((c) => c.takenBy === undefined)).toBe(true);
  });

  it('says which place another session of the user holds, and skips the ones this one holds', () => {
    const place = placeChoices(input)[3]!.sessionId;
    const other = placeSession(programme, place, { ...quick('upper'), id: 'own-2' });
    expect(
      placeChoices({ ...input, programme: other }).find((c) => c.sessionId === place)?.takenBy,
    ).toBe('own-2');
    const mine = placeSession(programme, place, { ...quick('upper'), id: 'own-1' });
    expect(placeChoices({ ...input, programme: mine }).some((c) => c.sessionId === place)).toBe(
      false,
    );
  });
});

describe('exercises that cannot be done', () => {
  const ctx = {
    profile: bodyweightBeginner.profile,
    inventory: bodyweightBeginner.equipment,
    exercises: exerciseById,
  };
  const heavy = generateQuickSession({
    profile: reference.profile,
    equipment: reference.equipment,
    minutes: 45,
    focus: 'upper',
    seed: 0,
  }).session;

  it('finds them and leaves the rest', () => {
    const issues = checkSession(heavy, ctx);
    const unusable = unusableIssues(issues);
    expect(unusable.length).toBeGreaterThan(0);
    const rest = withoutUnusable(heavy, issues);
    if (rest) expect(unusableIssues(checkSession(rest, ctx))).toHaveLength(0);
  });
});
