import { describe, expect, it } from 'vitest';
import type { InstallPlatform } from '@/app/install';
import { initialTab, panelPlan, promptOnTab, whyPoints, type PlanInput } from './plan';

const safari: InstallPlatform = { os: 'ios', browser: 'safari' };
const chromeIos: InstallPlatform = { os: 'ios', browser: 'chrome' };
const chromeAndroid: InstallPlatform = { os: 'android', browser: 'chrome' };
const chromeDesktop: InstallPlatform = { os: 'desktop', browser: 'chrome' };

function plan(over: Partial<PlanInput> & { detected: InstallPlatform }) {
  return panelPlan({ tab: over.detected.os, canPrompt: false, variant: 'first', ...over });
}
const ids = (steps: { id: string }[]) => steps.map((s) => s.id);

describe('install panel plan', () => {
  it('opens on the detected device', () => {
    expect(initialTab(chromeAndroid)).toBe('android');
  });

  it('iPhone Safari: share, add, confirm, open; the set-up meta depends on the variant', () => {
    const first = plan({ detected: safari });
    expect(ids(first.steps)).toEqual(['share', 'addHome', 'add', 'open']);
    expect(first.steps[0]?.meta).toBe('shareSafariMeta');
    expect(first.steps[3]?.meta).toBe('openSetUpMeta');
    expect(first.heading).toEqual({ key: 'in', browser: 'safari' });
    expect(first.others).toEqual(['ios']);
    expect(first.setupStays).toBe(false);
    const settings = plan({ detected: safari, variant: 'settings' });
    expect(settings.steps[3]?.meta).toBe('openRestoreMeta');
    expect(settings.setupStays).toBe(true);
  });

  it('another browser on iOS names itself and drops the other-browser line', () => {
    const p = plan({ detected: chromeIos });
    expect(p.heading).toEqual({ key: 'in', browser: 'chrome' });
    expect(p.steps[0]?.meta).toBe('shareOtherMeta');
    expect(p.others).toEqual([]);
  });

  it('the iPhone tab read from elsewhere has no open step and no set-up note', () => {
    const p = plan({ detected: chromeDesktop, tab: 'ios', variant: 'settings' });
    expect(ids(p.steps)).toEqual(['share', 'addHome', 'add']);
    expect(p.setupStays).toBe(false);
    expect(p.heading.browser).toBe('safari');
  });

  it('Android with the prompt: two steps and the fallback line; without it: the menu path', () => {
    const withPrompt = plan({ detected: chromeAndroid, canPrompt: true });
    expect(ids(withPrompt.steps)).toEqual(['tapInstall', 'confirm']);
    expect(withPrompt.promptFallback).toBe(true);
    const without = plan({ detected: chromeAndroid, variant: 'settings' });
    expect(ids(without.steps)).toEqual(['menu', 'installApp', 'confirmWith', 'open']);
    expect(without.steps[3]?.meta).toBe('openSharedMeta');
    expect(plan({ detected: chromeAndroid }).steps[3]?.meta).toBeUndefined();
  });

  it('a prompt is only used on the detected device’s own tab', () => {
    expect(
      promptOnTab({ tab: 'ios', detected: chromeAndroid, canPrompt: true, variant: 'first' }),
    ).toBe(false);
    expect(
      promptOnTab({ tab: 'android', detected: chromeAndroid, canPrompt: true, variant: 'first' }),
    ).toBe(true);
    expect(promptOnTab({ tab: 'ios', detected: safari, canPrompt: true, variant: 'first' })).toBe(
      false,
    );
    const off = plan({ detected: chromeAndroid, tab: 'desktop', canPrompt: true });
    expect(off.heading).toEqual({ key: 'inChromeEdge' });
  });

  it('computers: prompt, address bar, Safari menu and Firefox', () => {
    expect(ids(plan({ detected: chromeDesktop, canPrompt: true }).steps)).toEqual([
      'clickInstall',
      'confirm',
    ]);
    const bar = plan({ detected: chromeDesktop });
    expect(ids(bar.steps)).toEqual(['addressBar', 'clickInstallDialog']);
    expect(bar.heading).toEqual({ key: 'inChromeEdge' });
    expect(bar.others).toEqual(['safariMac', 'firefox']);
    const mac = plan({ detected: { os: 'desktop', browser: 'safari' } });
    expect(ids(mac.steps)).toEqual(['fileMenu', 'clickAdd']);
    expect(mac.others).toEqual(['chromeEdge', 'firefox']);
    const ff = plan({ detected: { os: 'desktop', browser: 'firefox' }, variant: 'settings' });
    expect(ff.noInstall).toBe(true);
    expect(ff.heading.key).toBe('firefox');
    expect(ff.firefoxData).toBe(true);
  });

  it('the reasons follow the device', () => {
    expect(whyPoints('ios').map((p) => p.id)).toEqual(['data', 'screen', 'offline']);
    expect(whyPoints('android').map((p) => p.id)).toEqual(['screen', 'offline', 'home']);
    expect(whyPoints('desktop').map((p) => p.id)).toEqual(['window', 'offline']);
  });
});
