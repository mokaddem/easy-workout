/** Lower-cases, drops accents and unifies apostrophes so "Écarté" matches "ecarte". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’‘`]/g, "'").toLowerCase().trim();
}

/** Every word typed appears somewhere in the name (accents and case ignored). */
export function matchesQuery(names: readonly string[], query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystacks = names.map(fold);
  return words.every((w) => haystacks.some((h) => h.includes(w)));
}
