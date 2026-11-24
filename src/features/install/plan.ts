import type { InstallBrowser, InstallOs, InstallPlatform } from '@/app/install';
import type { IconName } from '@/ui/components';

export type InstallTab = InstallOs;
export type InstallVariant = 'first' | 'settings';

export interface StepPlan {
  /** Title key under `install.step`. */
  id: string;
  /** Meta key under `install.step`. */
  meta?: string;
}

export interface WhyPoint {
  id: 'data' | 'screen' | 'window' | 'offline' | 'home';
  icon: IconName;
}

export type OtherLine = 'ios' | 'chromeEdge' | 'safariMac' | 'firefox';

export interface PanelPlan {
  heading: { key: 'in' | 'inChromeEdge' | 'firefox'; browser?: InstallBrowser };
  steps: StepPlan[];
  /** Firefox on a computer: nothing to install, a paragraph instead of steps. */
  noInstall: boolean;
  /** The "nothing opens?" line under the steps of a prompt-driven install. */
  promptFallback: boolean;
  others: OtherLine[];
  /** The note line about moving data out of Firefox (Settings variant only). */
  firefoxData: boolean;
  /** The note line about the set-up staying in the browser (iPhone / iPad, Settings variant). */
  setupStays: boolean;
}

export interface PlanInput {
  tab: InstallTab;
  detected: InstallPlatform;
  canPrompt: boolean;
  variant: InstallVariant;
}

/** The tab to open on: the detected device. */
export function initialTab(detected: InstallPlatform): InstallTab {
  return detected.os;
}

/** Whether the browser's own prompt can be opened from the tab on show. */
export function promptOnTab({ tab, detected, canPrompt }: PlanInput): boolean {
  return canPrompt && detected.os !== 'ios' && tab === detected.os;
}

/** What the panel under the platform switch says, from the tab, the browser and the prompt. */
export function panelPlan(input: PlanInput): PanelPlan {
  const { tab, detected, variant } = input;
  const here = detected.os === tab;
  const settings = variant === 'settings';
  const base: PanelPlan = {
    heading: { key: 'in' },
    steps: [],
    noInstall: false,
    promptFallback: false,
    others: [],
    firefoxData: false,
    setupStays: false,
  };

  if (tab === 'ios') {
    const browser = here ? detected.browser : 'safari';
    const other = here && browser !== 'safari' && browser !== 'other';
    const steps: StepPlan[] = [
      { id: 'share', meta: other ? 'shareOtherMeta' : 'shareSafariMeta' },
      { id: 'addHome', meta: 'addHomeMeta' },
      { id: 'add', meta: 'addMeta' },
    ];
    if (here) steps.push({ id: 'open', meta: settings ? 'openRestoreMeta' : 'openSetUpMeta' });
    return {
      ...base,
      heading: { key: 'in', browser: other ? browser : 'safari' },
      steps,
      others: other ? [] : ['ios'],
      setupStays: here && settings,
    };
  }

  if (tab === 'android') {
    if (promptOnTab(input)) {
      return {
        ...base,
        heading: { key: 'in', browser: detected.browser },
        steps: [{ id: 'tapInstall' }, { id: 'confirm', meta: 'confirmMeta' }],
        promptFallback: true,
      };
    }
    const steps: StepPlan[] = [
      { id: 'menu', meta: 'menuMeta' },
      { id: 'installApp', meta: 'installAppMeta' },
      { id: 'confirmWith' },
    ];
    if (here) steps.push({ id: 'open', meta: settings ? 'openSharedMeta' : undefined });
    return {
      ...base,
      heading: { key: 'in', browser: here ? detected.browser : 'chrome' },
      steps,
    };
  }

  // A computer.
  const browser = here ? detected.browser : 'chrome';
  if (browser === 'firefox') {
    return { ...base, heading: { key: 'firefox' }, noInstall: true, firefoxData: settings };
  }
  if (browser === 'safari') {
    return {
      ...base,
      heading: { key: 'in', browser },
      steps: [
        { id: 'fileMenu', meta: 'fileMenuMeta' },
        { id: 'clickAdd', meta: 'confirmComputerMeta' },
      ],
      others: ['chromeEdge', 'firefox'],
    };
  }
  if (promptOnTab(input) && (browser === 'chrome' || browser === 'edge')) {
    return {
      ...base,
      heading: { key: 'in', browser },
      steps: [{ id: 'clickInstall' }, { id: 'confirm', meta: 'confirmComputerMeta' }],
      others: ['safariMac', 'firefox'],
    };
  }
  return {
    ...base,
    heading: { key: 'inChromeEdge' },
    steps: [
      { id: 'addressBar', meta: 'addressBarMeta' },
      { id: 'clickInstallDialog', meta: 'confirmComputerMeta' },
    ],
    others: ['safariMac', 'firefox'],
  };
}

/** The reasons to install follow the detected device, not the tab being read. */
export function whyPoints(os: InstallOs): WhyPoint[] {
  if (os === 'ios')
    return [
      { id: 'data', icon: 'shield-check' },
      { id: 'screen', icon: 'expand' },
      { id: 'offline', icon: 'offline' },
    ];
  if (os === 'android')
    return [
      { id: 'screen', icon: 'expand' },
      { id: 'offline', icon: 'offline' },
      { id: 'home', icon: 'install' },
    ];
  return [
    { id: 'window', icon: 'expand' },
    { id: 'offline', icon: 'offline' },
  ];
}

export const BROWSER_NAMES: Record<InstallBrowser, string> = {
  safari: 'Safari',
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  samsung: 'Samsung Internet',
  other: '',
};
