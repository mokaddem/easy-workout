import { useLayoutEffect, useRef, useSyncExternalStore, type MouseEvent } from 'react';

export type Route =
  | { name: 'onboarding'; step?: number }
  | { name: 'programme'; preview?: 'new' }
  | { name: 'session'; sessionId: string; week?: number }
  | { name: 'quick'; view?: 'session' }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'profile' }
  | { name: 'equipment' }
  | { name: 'data' }
  | { name: 'play'; source?: 'quick' }
  /** The user's own sessions: the full list, and one of them. */
  | { name: 'mine-list' }
  | { name: 'mine'; sessionId: string }
  /** The session editor: a programme session, or one of the user's own (`new` for a blank one). */
  | { name: 'edit'; target: 'programme' | 'mine'; sessionId: string }
  | { name: 'not-found'; path: string };

export type Tab = 'programme' | 'quick' | 'progress' | 'settings';

const STATIC: Record<string, Route> = {
  '/': { name: 'programme' },
  '/onboarding': { name: 'onboarding' },
  '/programme': { name: 'programme' },
  '/quick': { name: 'quick' },
  '/progress': { name: 'progress' },
  '/settings': { name: 'settings' },
  '/settings/profile': { name: 'profile' },
  '/settings/equipment': { name: 'equipment' },
  '/settings/data': { name: 'data' },
  '/play': { name: 'play' },
  '/quick/mine': { name: 'mine-list' },
};

const SESSION_PATH = /^\/programme\/session\/([^/]+)$/;
const MINE_PATH = /^\/quick\/mine\/([^/]+)$/;
const EDIT_PATH = /^\/edit\/(programme|mine)\/([^/]+)$/;

export function parseLocation(pathname: string, search = ''): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/onboarding') {
    const step = Number(new URLSearchParams(search).get('step'));
    return Number.isInteger(step) && step > 1
      ? { name: 'onboarding', step }
      : { name: 'onboarding' };
  }
  if (path === '/quick' && new URLSearchParams(search).get('view') === 'session')
    return { name: 'quick', view: 'session' };
  if (path === '/play' && new URLSearchParams(search).get('source') === 'quick')
    return { name: 'play', source: 'quick' };
  if (path === '/programme' && new URLSearchParams(search).get('preview') === 'new')
    return { name: 'programme', preview: 'new' };
  const fixed = STATIC[path];
  if (fixed) return fixed;

  const session = SESSION_PATH.exec(path);
  if (session?.[1]) {
    const week = Number(new URLSearchParams(search).get('week'));
    return {
      name: 'session',
      sessionId: decodeURIComponent(session[1]),
      ...(Number.isInteger(week) && week > 0 ? { week } : {}),
    };
  }
  const mine = MINE_PATH.exec(path);
  if (mine?.[1]) return { name: 'mine', sessionId: decodeURIComponent(mine[1]) };
  const edit = EDIT_PATH.exec(path);
  if (edit?.[1] && edit[2])
    return {
      name: 'edit',
      target: edit[1] as 'programme' | 'mine',
      sessionId: decodeURIComponent(edit[2]),
    };
  return { name: 'not-found', path };
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'session': {
      const base = `/programme/session/${encodeURIComponent(route.sessionId)}`;
      return route.week === undefined ? base : `${base}?week=${route.week}`;
    }
    case 'quick':
      return route.view ? `/quick?view=${route.view}` : '/quick';
    case 'play':
      return route.source ? `/play?source=${route.source}` : '/play';
    case 'onboarding':
      return route.step ? `/onboarding?step=${route.step}` : '/onboarding';
    case 'programme':
      return route.preview ? `/programme?preview=${route.preview}` : '/programme';
    case 'profile':
      return '/settings/profile';
    case 'equipment':
      return '/settings/equipment';
    case 'data':
      return '/settings/data';
    case 'mine-list':
      return '/quick/mine';
    case 'mine':
      return `/quick/mine/${encodeURIComponent(route.sessionId)}`;
    case 'edit':
      return `/edit/${route.target}/${encodeURIComponent(route.sessionId)}`;
    case 'not-found':
      return route.path;
    default:
      return `/${route.name}`;
  }
}

/** The tab bar's current tab; null hides the bar (onboarding, the player, and edit screens with their own save dock). */
export function tabOf(route: Route): Tab | null {
  switch (route.name) {
    case 'programme':
    case 'session':
      return 'programme';
    case 'quick':
    case 'mine-list':
    case 'mine':
      return 'quick';
    case 'progress':
      return 'progress';
    case 'settings':
    case 'data':
      return 'settings';
    default:
      return null;
  }
}

/** Where "back" goes when there is no in-app history to return to (deep link, reload). */
export function parentOf(route: Route): Route {
  switch (route.name) {
    case 'session':
      return { name: 'programme' };
    case 'mine-list':
    case 'mine':
      return { name: 'quick' };
    case 'edit':
      return route.target === 'programme'
        ? { name: 'session', sessionId: route.sessionId }
        : route.sessionId === 'new'
          ? { name: 'quick' }
          : { name: 'mine', sessionId: route.sessionId };
    case 'profile':
    case 'equipment':
    case 'data':
      return { name: 'settings' };
    default:
      return { name: 'programme' };
  }
}

// ---------------------------------------------------------------------------
// History integration

/** Pushes and pops are told apart by an index kept in each history entry. */
interface EntryState {
  index: number;
}

export type Direction = 'forward' | 'back' | 'none';

interface Snapshot {
  route: Route;
  direction: Direction;
}

const listeners = new Set<() => void>();
let currentIndex = 0;
let snapshot: Snapshot = { route: { name: 'programme' }, direction: 'none' };

function readIndex(state: unknown): number | null {
  if (state && typeof state === 'object' && 'index' in state) {
    const { index } = state as EntryState;
    return typeof index === 'number' ? index : null;
  }
  return null;
}

function update(direction: Direction): void {
  snapshot = { route: parseLocation(location.pathname, location.search), direction };
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  const existing = readIndex(history.state);
  if (existing === null) history.replaceState({ index: 0 } satisfies EntryState, '');
  else currentIndex = existing;
  snapshot = { route: parseLocation(location.pathname, location.search), direction: 'none' };

  window.addEventListener('popstate', (event) => {
    const index = readIndex(event.state) ?? 0;
    if (restoring) {
      // The browser just undid a blocked back/forward; the screen never changed.
      restoring = false;
      return;
    }
    // An overlay's own entry (the exercise picker) coming and going: no move between screens.
    if (index === currentIndex) return;
    if (guard) {
      // The browser has already moved: step back to where we were, then ask.
      const delta = index - currentIndex;
      const ask = guard;
      restoring = true;
      history.go(-delta);
      ask(() => {
        guard = null;
        history.go(delta);
      });
      return;
    }
    const direction: Direction = index < currentIndex ? 'back' : 'forward';
    currentIndex = index;
    update(direction);
  });
}

// ---------------------------------------------------------------------------
// Leave guard

/** Called instead of leaving; `proceed` leaves anyway. */
export type LeaveHandler = (proceed: () => void) => void;

let guard: LeaveHandler | null = null;
let restoring = false;

/**
 * While `active`, leaving the screen (links, tabs, back button, browser back) calls `onLeave`
 * instead, and closing or reloading the page asks the browser's own confirmation.
 */
export function useLeaveGuard(
  active: boolean,
  onLeave: LeaveHandler,
  /** Also ask before the page is closed or reloaded; off when nothing would be lost. */
  { unload = true }: { unload?: boolean } = {},
): void {
  const handler = useRef(onLeave);
  useLayoutEffect(() => {
    handler.current = onLeave;
  });
  // A layout effect, so the guard is lifted in the same commit that deactivates it: a screen
  // can set "saving" and navigate away right after without being asked to confirm.
  useLayoutEffect(() => {
    if (!active) return;
    const current: LeaveHandler = (proceed) => handler.current(proceed);
    guard = current;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    if (unload) window.addEventListener('beforeunload', beforeUnload);
    return () => {
      if (guard === current) guard = null;
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [active, unload]);
}

export function navigate(to: Route | string, options: { replace?: boolean } = {}): void {
  const url = typeof to === 'string' ? to : routeHref(to);
  if (url === location.pathname + location.search) return;
  if (guard) {
    const ask = guard;
    ask(() => {
      guard = null;
      navigate(url, options);
    });
    return;
  }
  if (options.replace) {
    history.replaceState({ index: currentIndex } satisfies EntryState, '', url);
  } else {
    currentIndex += 1;
    history.pushState({ index: currentIndex } satisfies EntryState, '', url);
  }
  update(options.replace ? 'none' : 'forward');
}

/** Back within the app; falls back to the route's parent when the app was opened on a deep link. */
export function goBack(): void {
  if (currentIndex > 0) {
    if (guard) {
      const ask = guard;
      ask(() => {
        guard = null;
        history.back();
      });
    } else history.back();
  } else navigate(parentOf(snapshot.route), { replace: true });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

export function useLocationState(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useRoute(): Route {
  return useLocationState().route;
}

/** For `<a>` click handlers: keeps modified clicks (new tab, etc.) native. */
export function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string): void {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  navigate(href);
}
