import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe('router served under a sub-path', () => {
  let router: typeof import('./router');

  beforeAll(async () => {
    vi.stubEnv('BASE_URL', '/easy-workout/');
    vi.resetModules();
    router = await import('./router');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reads screens from addresses under the base', () => {
    expect(router.parseLocation('/easy-workout/settings')).toEqual({ name: 'settings' });
    expect(router.parseLocation('/easy-workout/onboarding', '?step=2')).toEqual({
      name: 'onboarding',
      step: 2,
    });
    expect(router.parseLocation('/easy-workout/progress/session/a%20b')).toEqual({
      name: 'log',
      logId: 'a b',
    });
  });

  it('treats the base itself, with or without a slash, as the home screen', () => {
    expect(router.parseLocation('/easy-workout/')).toEqual({ name: 'programme' });
    expect(router.parseLocation('/easy-workout')).toEqual({ name: 'programme' });
  });

  it('writes addresses under the base and reads them back', () => {
    const route = { name: 'session', sessionId: 'push-a', week: 3 } as const;
    const href = router.routeHref(route);
    expect(href).toBe('/easy-workout/programme/session/push-a?week=3');
    const [path, search] = href.split('?');
    expect(router.parseLocation(path ?? '', `?${search}`)).toEqual(route);
  });

  it('keeps an unknown address as written inside the app', () => {
    const route = router.parseLocation('/easy-workout/nowhere');
    expect(route).toEqual({ name: 'not-found', path: '/nowhere' });
    expect(router.routeHref(route)).toBe('/easy-workout/nowhere');
  });
});
