import { useLayoutEffect, useRef, useSyncExternalStore, type MouseEvent } from 'react';

export type Route =
  | { name: 'onboarding'; step?: number }
  | { name: 'programme'; preview?: 'new' }
  | { name: 'session'; sessionId: string; week?: number }
  | { name: 'quick'; view?: 'session' }
  | { name: 'progress' }
  /** Progress: logged sessions, one of them, exercises, one exercise, body, max tests. */
  | { name: 'history' }
  | { name: 'log'; logId: string }
  | { name: 'exercises' }
  | { name: 'exercise'; exerciseId: string }
  | { name: 'body' }
  | { name: 'tests' }
  /** Finished and replaced programmes, one of them, and one of its sessions. */
  | { name: 'past' }
  | { name: 'past-programme'; programmeId: string; view?: 'sessions' }
  | { name: 'past-session'; programmeId: string; sessionId: string }
  /** A cycle's review, full screen. */
  | { name: 'review'; programmeId: string }
  | { name: 'settings' }
  | { name: 'profile' }
  /** Joints, noise, space. */
  | { name: 'constraints' }
  /** The travel kit: set up in two steps, or the active kit. */
  | { name: 'travel' }
  /** `buy`: straight to the "what to buy next" view. */
  | { name: 'equipment'; view?: 'buy' }
  | { name: 'data' }
  /** How to install the app on the home screen, from Settings. */
  | { name: 'install' }
  /** The same guide on a first visit from a phone browser, before set-up. */
  | { name: 'install-first' }
  | { name: 'play'; source?: 'quick' }
  /** A max test on its own, outside any session. */
  | { name: 'test'; exerciseId: string }
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
  '/settings/limits': { name: 'constraints' },
  '/settings/travel': { name: 'travel' },
  '/settings/equipment': { name: 'equipment' },
  '/settings/data': { name: 'data' },
  '/settings/install': { name: 'install' },
  '/install': { name: 'install-first' },
  '/play': { name: 'play' },
  '/quick/mine': { name: 'mine-list' },
  '/progress/history': { name: 'history' },
  '/progress/exercises': { name: 'exercises' },
  '/progress/body': { name: 'body' },
  '/progress/tests': { name: 'tests' },
  '/progress/programmes': { name: 'past' },
};

const SESSION_PATH = /^\/programme\/session\/([^/]+)$/;
const MINE_PATH = /^\/quick\/mine\/([^/]+)$/;
const EDIT_PATH = /^\/edit\/(programme|mine)\/([^/]+)$/;
const LOG_PATH = /^\/progress\/session\/([^/]+)$/;
const EXERCISE_PATH = /^\/progress\/exercise\/([^/]+)$/;
const PAST_PATH = /^\/progress\/programmes\/([^/]+)$/;
const PAST_SESSION_PATH = /^\/progress\/programmes\/([^/]+)\/session\/([^/]+)$/;
const REVIEW_PATH = /^\/programme\/review\/([^/]+)$/;
const TEST_PATH = /^\/test\/([^/]+)$/;

/** Where the app is served from, without the trailing slash: empty at the site root. */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** The pathname inside the app, without the base it is served under. */
function appPath(pathname: string): string {
  if (!BASE) return pathname;
  if (pathname === BASE) return '/';
  return pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length) : pathname;
}

export function parseLocation(pathname: string, search = ''): Route {
  const inApp = appPath(pathname);
  const path = inApp.length > 1 ? inApp.replace(/\/+$/, '') : inApp;
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
  if (path === '/settings/equipment' && new URLSearchParams(search).get('view') === 'buy')
    return { name: 'equipment', view: 'buy' };
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
  const log = LOG_PATH.exec(path);
  if (log?.[1]) return { name: 'log', logId: decodeURIComponent(log[1]) };
  const exercise = EXERCISE_PATH.exec(path);
  if (exercise?.[1]) return { name: 'exercise', exerciseId: decodeURIComponent(exercise[1]) };
  const pastSession = PAST_SESSION_PATH.exec(path);
  if (pastSession?.[1] && pastSession[2])
    return {
      name: 'past-session',
      programmeId: decodeURIComponent(pastSession[1]),
      sessionId: decodeURIComponent(pastSession[2]),
    };
  const past = PAST_PATH.exec(path);
  if (past?.[1])
    return {
      name: 'past-programme',
      programmeId: decodeURIComponent(past[1]),
      ...(new URLSearchParams(search).get('view') === 'sessions' && { view: 'sessions' as const }),
    };
  const review = REVIEW_PATH.exec(path);
  if (review?.[1]) return { name: 'review', programmeId: decodeURIComponent(review[1]) };
  const test = TEST_PATH.exec(path);
  if (test?.[1]) return { name: 'test', exerciseId: decodeURIComponent(test[1]) };
  const edit = EDIT_PATH.exec(path);
  if (edit?.[1] && edit[2])
    return {
      name: 'edit',
      target: edit[1] as 'programme' | 'mine',
      sessionId: decodeURIComponent(edit[2]),
    };
  return { name: 'not-found', path };
}

/** The address of a screen, under the base the app is served from. */
export function routeHref(route: Route): string {
  return BASE + routePath(route);
}

function routePath(route: Route): string {
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
    case 'constraints':
      return '/settings/limits';
    case 'travel':
      return '/settings/travel';
    case 'equipment':
      return route.view ? `/settings/equipment?view=${route.view}` : '/settings/equipment';
    case 'data':
      return '/settings/data';
    case 'install':
      return '/settings/install';
    case 'install-first':
      return '/install';
    case 'mine-list':
      return '/quick/mine';
    case 'mine':
      return `/quick/mine/${encodeURIComponent(route.sessionId)}`;
    case 'edit':
      return `/edit/${route.target}/${encodeURIComponent(route.sessionId)}`;
    case 'history':
      return '/progress/history';
    case 'log':
      return `/progress/session/${encodeURIComponent(route.logId)}`;
    case 'exercises':
      return '/progress/exercises';
    case 'exercise':
      return `/progress/exercise/${encodeURIComponent(route.exerciseId)}`;
    case 'body':
      return '/progress/body';
    case 'tests':
      return '/progress/tests';
    case 'past':
      return '/progress/programmes';
    case 'past-programme': {
      const base = `/progress/programmes/${encodeURIComponent(route.programmeId)}`;
      return route.view ? `${base}?view=${route.view}` : base;
    }
    case 'past-session':
      return `/progress/programmes/${encodeURIComponent(route.programmeId)}/session/${encodeURIComponent(route.sessionId)}`;
    case 'review':
      return `/programme/review/${encodeURIComponent(route.programmeId)}`;
    case 'test':
      return `/test/${encodeURIComponent(route.exerciseId)}`;
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
    case 'history':
    case 'log':
    case 'exercises':
    case 'exercise':
    case 'body':
    case 'tests':
    case 'past':
    case 'past-programme':
    case 'past-session':
      return 'progress';
    case 'settings':
    case 'data':
    case 'install':
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
    case 'constraints':
    case 'travel':
    case 'equipment':
    case 'data':
    case 'install':
      return { name: 'settings' };
    case 'history':
    case 'exercises':
    case 'body':
    case 'tests':
    case 'past':
      return { name: 'progress' };
    case 'log':
      return { name: 'history' };
    case 'exercise':
      return { name: 'exercises' };
    case 'past-programme':
      return { name: 'past' };
    case 'past-session':
      return { name: 'past-programme', programmeId: route.programmeId, view: 'sessions' };
    case 'review':
      return { name: 'programme' };
    case 'test':
      return { name: 'tests' };
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
