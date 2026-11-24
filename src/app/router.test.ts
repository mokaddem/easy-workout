import { describe, expect, it } from 'vitest';
import { parentOf, parseLocation, routeHref, tabOf, type Route } from './router';

describe('router', () => {
  const routes: Route[] = [
    { name: 'onboarding' },
    { name: 'onboarding', step: 3 },
    { name: 'programme' },
    { name: 'programme', preview: 'new' },
    { name: 'session', sessionId: 'push-a' },
    { name: 'session', sessionId: 'push-a', week: 3 },
    { name: 'quick' },
    { name: 'quick', view: 'session' },
    { name: 'progress' },
    { name: 'settings' },
    { name: 'profile' },
    { name: 'constraints' },
    { name: 'travel' },
    { name: 'equipment' },
    { name: 'play' },
    { name: 'play', source: 'quick' },
  ];

  it.each(routes)('round-trips $name', (route) => {
    const url = new URL(routeHref(route), 'http://x');
    expect(parseLocation(url.pathname, url.search)).toEqual(route);
  });

  it('treats the root and trailing slashes as the same screen', () => {
    expect(parseLocation('/')).toEqual({ name: 'programme' });
    expect(parseLocation('/settings/')).toEqual({ name: 'settings' });
  });

  it('ignores a malformed week', () => {
    expect(parseLocation('/programme/session/a', '?week=abc')).toEqual({
      name: 'session',
      sessionId: 'a',
    });
    expect(parseLocation('/programme/session/a', '?week=0')).toEqual({
      name: 'session',
      sessionId: 'a',
    });
  });

  it('encodes session ids', () => {
    const route: Route = { name: 'session', sessionId: 'a b/c' };
    const url = new URL(routeHref(route), 'http://x');
    expect(parseLocation(url.pathname, url.search)).toEqual(route);
  });

  it('reports unknown paths', () => {
    expect(parseLocation('/nope')).toEqual({ name: 'not-found', path: '/nope' });
  });

  it('maps routes to tabs and parents', () => {
    expect(tabOf({ name: 'session', sessionId: 'a' })).toBe('programme');
    expect(tabOf({ name: 'settings' })).toBe('settings');
    expect(tabOf({ name: 'equipment' })).toBeNull();
    expect(tabOf({ name: 'onboarding' })).toBeNull();
    expect(tabOf({ name: 'play' })).toBeNull();
    expect(parentOf({ name: 'profile' })).toEqual({ name: 'settings' });
    expect(parentOf({ name: 'constraints' })).toEqual({ name: 'settings' });
    expect(parentOf({ name: 'travel' })).toEqual({ name: 'settings' });
    expect(parentOf({ name: 'session', sessionId: 'a' })).toEqual({ name: 'programme' });
  });
});
