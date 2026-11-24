import { describe, expect, it } from 'vitest';
import type { SessionLog } from '@/domain';
import { afterName, logIdentity } from './identity';

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${options.letter}` : key) as never;

const log = (id: string, source: SessionLog['source'], name = 'Name'): SessionLog =>
  ({
    id,
    source,
    status: 'completed',
    startedAt: '2026-11-09T10:00:00',
    plan: { id: 'p', name: { fr: name, en: name }, warmup: [], main: [], finisher: [] },
    sets: [],
  }) as unknown as SessionLog;

describe('log identity, cooldowns', () => {
  const quick = log('q', { kind: 'quick' }, 'Quick legs');
  const cool = log('c', { kind: 'cooldown', afterLogId: 'q' }, 'Cooldown');

  it('keeps its own name and the session it followed', () => {
    expect(logIdentity(cool, [], 'en')).toEqual({
      title: 'Cooldown',
      kind: 'cooldown',
      afterLogId: 'q',
    });
  });

  it('names the session it followed', () => {
    expect(afterName(t, logIdentity(cool, [], 'en'), [quick, cool], [], 'en')).toBe('Quick legs');
  });

  it('says nothing when that session is gone or was never stored', () => {
    expect(afterName(t, logIdentity(cool, [], 'en'), [cool], [], 'en')).toBeUndefined();
    const alone = log('c2', { kind: 'cooldown' });
    expect(afterName(t, logIdentity(alone, [], 'en'), [alone], [], 'en')).toBeUndefined();
  });
});
