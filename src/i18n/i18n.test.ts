import { describe, expect, it } from 'vitest';
import { resources } from './resources';

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
  it('ships the same files in FR and EN', () => {
    expect(Object.keys(resources.fr).sort()).toEqual(Object.keys(resources.en).sort());
    expect(Object.keys(resources.fr).length).toBeGreaterThan(0);
  });

  it('FR and EN have exactly the same key set', () => {
    // Plural suffixes differ by language rules, but both languages here use _one / _other.
    expect(keyPaths(resources.fr)).toEqual(keyPaths(resources.en));
  });

  it('has no empty strings', () => {
    for (const lang of ['fr', 'en'] as const) {
      const empty = keyPaths(resources[lang]).filter((path) => {
        const value = path
          .split('.')
          .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], resources[lang]);
        return typeof value === 'string' && value.trim() === '';
      });
      expect(empty, lang).toEqual([]);
    }
  });
});
