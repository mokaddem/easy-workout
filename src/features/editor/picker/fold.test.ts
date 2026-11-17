import { describe, expect, it } from 'vitest';
import { fold, matchesQuery } from './fold';

describe('fold', () => {
  it('drops accents, case and typographic apostrophes', () => {
    expect(fold('  Écarté à l’Élastique ')).toBe("ecarte a l'elastique");
  });
});

describe('matchesQuery', () => {
  it('matches every word, in any order, in either language', () => {
    const names = ['Développé épaules assis', 'Seated shoulder press'];
    expect(matchesQuery(names, 'epaules dev')).toBe(true);
    expect(matchesQuery(names, 'SHOULDER seated')).toBe(true);
    expect(matchesQuery(names, 'epaules squat')).toBe(false);
  });
  it('matches everything on an empty query', () => {
    expect(matchesQuery(['x'], '   ')).toBe(true);
  });
});
