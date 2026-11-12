import { describe, expect, it } from 'vitest';
import { EquipmentItemSchema, OWNED_EQUIPMENT_KINDS } from '@/domain';
import { defaultItem } from './defaults';
import { ENTRIES, entryOf } from './entries';

describe('defaultItem', () => {
  it.each(OWNED_EQUIPMENT_KINDS)('gives %s a valid starting spec', (kind) => {
    const item = defaultItem(kind);
    expect(item.kind).toBe(kind);
    expect(EquipmentItemSchema.safeParse(item).success).toBe(true);
  });

  it('keeps adjustable and fixed dumbbells apart', () => {
    const adjustable = defaultItem('dumbbell');
    const fixed = defaultItem('dumbbell', 'fixed');
    expect(adjustable.id).not.toBe(fixed.id);
    expect(adjustable).toMatchObject({ mode: 'adjustable' });
    expect(fixed).toMatchObject({ mode: 'fixed' });
  });
});

describe('entries', () => {
  it('maps every default item back to its entry', () => {
    for (const entry of ENTRIES) {
      const item = defaultItem(entry.kind, entry.mode);
      expect(entryOf(item)?.key).toBe(entry.key);
    }
  });

  it('covers every owned kind', () => {
    const kinds = new Set(ENTRIES.map((e) => e.kind));
    for (const kind of OWNED_EQUIPMENT_KINDS) expect(kinds.has(kind)).toBe(true);
  });
});
