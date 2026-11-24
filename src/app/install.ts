import { useSyncExternalStore } from 'react';

export type InstallOs = 'ios' | 'android' | 'desktop';
export type InstallBrowser = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'other';

export interface InstallPlatform {
  os: InstallOs;
  browser: InstallBrowser;
}

/** Which device and browser the app runs in, as far as installing it is concerned. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  // iPadOS reports itself as a Mac; only its touch screen tells them apart.
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (ios) {
    const browser: InstallBrowser = /CriOS\//.test(userAgent)
      ? 'chrome'
      : /EdgiOS\//.test(userAgent)
        ? 'edge'
        : /FxiOS\//.test(userAgent)
          ? 'firefox'
          : /Version\/[\d.]+.*Safari\//.test(userAgent)
            ? 'safari'
            : 'other';
    return { os: 'ios', browser };
  }
  if (/Android/.test(userAgent)) {
    const browser: InstallBrowser = /SamsungBrowser\//.test(userAgent)
      ? 'samsung'
      : /Firefox\//.test(userAgent)
        ? 'firefox'
        : /EdgA\//.test(userAgent)
          ? 'edge'
          : /Chrome\//.test(userAgent)
            ? 'chrome'
            : 'other';
    return { os: 'android', browser };
  }
  const browser: InstallBrowser = /Edg\//.test(userAgent)
    ? 'edge'
    : /Firefox\//.test(userAgent)
      ? 'firefox'
      : /Chrome\//.test(userAgent)
        ? 'chrome'
        : /Version\/[\d.]+.*Safari\//.test(userAgent)
          ? 'safari'
          : 'other';
  return { os: 'desktop', browser };
}

export function currentPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return { os: 'desktop', browser: 'other' };
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
}

/** True when the app runs from the home screen (or the dock) rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const media =
    typeof window.matchMedia === 'function' &&
    ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
    );
  return iosStandalone || media;
}

// ---------------------------------------------------------------------------
// The browser's own install prompt (Chromium on Android and computers)

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  /** The browser offers its install prompt: an Install button can open it. */
  canPrompt: boolean;
  /** Installed while this page was open. */
  installed: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallState = { canPrompt: false, installed: false };
const listeners = new Set<() => void>();

function set(next: Partial<InstallState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keeps the browser's own banner away: the install screen offers the prompt instead.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    set({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    set({ canPrompt: false, installed: true });
  });
}

/** Opens the browser's install prompt; it can be used once. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null;
  set({ canPrompt: false });
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') set({ installed: true });
  return outcome;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
