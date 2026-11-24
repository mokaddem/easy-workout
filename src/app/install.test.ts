import { describe, expect, it } from 'vitest';
import { detectPlatform } from './install';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.7444.77 Mobile/15E148 Safari/604.1',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/145.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 EdgiOS/142.3595.65 Mobile/15E148 Safari/605.1.15',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 15; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0',
  androidEdge:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36 EdgA/142.0.0.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
  linuxChrome:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',
};

describe('detectPlatform', () => {
  it('tells the iPhone browsers apart', () => {
    expect(detectPlatform(UA.iphoneSafari)).toEqual({ os: 'ios', browser: 'safari' });
    expect(detectPlatform(UA.iphoneChrome)).toEqual({ os: 'ios', browser: 'chrome' });
    expect(detectPlatform(UA.iphoneFirefox)).toEqual({ os: 'ios', browser: 'firefox' });
    expect(detectPlatform(UA.iphoneEdge)).toEqual({ os: 'ios', browser: 'edge' });
  });

  it('spots an iPad that asks for the desktop site by its touch screen', () => {
    expect(detectPlatform(UA.ipadDesktopMode, 5)).toEqual({ os: 'ios', browser: 'safari' });
    expect(detectPlatform(UA.macSafari, 0)).toEqual({ os: 'desktop', browser: 'safari' });
  });

  it('tells the Android browsers apart', () => {
    expect(detectPlatform(UA.androidChrome)).toEqual({ os: 'android', browser: 'chrome' });
    expect(detectPlatform(UA.androidSamsung)).toEqual({ os: 'android', browser: 'samsung' });
    expect(detectPlatform(UA.androidFirefox)).toEqual({ os: 'android', browser: 'firefox' });
    expect(detectPlatform(UA.androidEdge)).toEqual({ os: 'android', browser: 'edge' });
  });

  it('tells the computer browsers apart', () => {
    expect(detectPlatform(UA.windowsEdge)).toEqual({ os: 'desktop', browser: 'edge' });
    expect(detectPlatform(UA.linuxChrome)).toEqual({ os: 'desktop', browser: 'chrome' });
    expect(detectPlatform(UA.linuxFirefox)).toEqual({ os: 'desktop', browser: 'firefox' });
  });

  it('falls back to an unknown browser rather than guessing', () => {
    expect(detectPlatform('SomethingElse/1.0')).toEqual({ os: 'desktop', browser: 'other' });
  });
});
