import { describe, expect, it } from 'vitest';
import { exportCancelled } from './cancelled';

describe('exportCancelled', () => {
  it('is plain unless a backup was due', () => {
    expect(exportCancelled(undefined).key).toBe('adapt.notes.export.cancelled');
    expect(exportCancelled(12).key).toBe('adapt.notes.export.cancelled');
  });
  it('names the age when due', () => {
    expect(exportCancelled(34)).toEqual({ key: 'adapt.notes.export.cancelledDue', count: 34 });
  });
});
