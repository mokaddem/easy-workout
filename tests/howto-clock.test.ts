import { describe, expect, it } from 'vitest';
import { pausable, StageClock, TEMPOS } from '@/features/howto/stageClock';

describe('StageClock', () => {
  it('runs, pauses where it stands and resumes from there', () => {
    let t = 0;
    const clock = new StageClock(() => t);
    const read = clock.pacing().read;
    t = 700;
    const a = read()!;
    expect(a.phase).toBe('down');
    expect(a.progress).toBeCloseTo(0.5);
    clock.setPaused(true);
    t = 5000;
    expect(read()).toEqual(a);
    clock.setPaused(false);
    t = 5350;
    expect(read()!.progress).toBeCloseTo(0.75);
  });

  it('keeps its place in the rep when the speed changes', () => {
    let t = 0;
    const clock = new StageClock(() => t);
    t = 700;
    clock.setSpeed('slow');
    const p = clock.pacing();
    expect(p.tempo).toEqual(TEMPOS.slow);
    expect(p.read()!.phase).toBe('down');
    expect(p.read()!.progress).toBeCloseTo(0.5);
  });
});

describe('pausable', () => {
  it('freezes the player clock while paused', () => {
    let n = 0;
    let paused = false;
    const source = {
      tempo: TEMPOS.normal,
      read: () => ({ phase: 'down' as const, progress: ++n / 10 }),
    };
    const p = pausable(source, () => paused);
    expect(p.read()!.progress).toBe(0.1);
    paused = true;
    const frozen = p.read();
    expect(p.read()).toEqual(frozen);
    paused = false;
    expect(p.read()!.progress).toBeGreaterThan(frozen!.progress);
  });
});
