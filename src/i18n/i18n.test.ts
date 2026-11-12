import { describe, expect, it } from 'vitest';
import fr from './fr.json';
import en from './en.json';

function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj)
    .flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return value !== null && typeof value === 'object'
        ? keyPaths(value as Record<string, unknown>, path)
        : [path];
    })
    .sort();
}

describe('i18n resources', () => {
  it('FR and EN have exactly the same key set', () => {
    expect(keyPaths(fr)).toEqual(keyPaths(en));
  });
});
