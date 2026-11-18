import { describe, expect, it } from 'vitest';
import { animationFor } from '@/catalogue/animations';
import { frame } from '@/motion/figure/look';
import { tempoPoint } from '@/motion/figure';

describe('thumbnail framing', () => {
  const wide = animationFor('push-up');

  it('enlarges a wide pose in a tile and keeps its head in view', () => {
    expect(wide).toBeDefined();
    if (!wide) return;
    const tile = frame(wide, 56, 56, { still: true });
    const roomy = frame(wide, 200, 200, { still: true });
    // Per pixel of tile, the tile pose is drawn larger than the roomy still's fit.
    expect(tile.scale / 56).toBeGreaterThan(roomy.scale / 200);
    const [headX] = tile.toScreen([0, 0, 0]);
    expect(Number.isFinite(headX)).toBe(true);
  });

  it('leaves a loop framing alone', () => {
    if (!wide) return;
    const loop = frame(wide, 56, 56);
    const still = frame(wide, 56, 56, { still: true });
    expect(still.scale).toBeGreaterThanOrEqual(loop.scale);
  });
});

describe('tempo point', () => {
  it('follows the strip phases and repeats each rep', () => {
    const tempo = { down: 2, pause: 1, up: 2 };
    expect(tempoPoint(tempo, 0.5)).toMatchObject({ phase: 'down', progress: 0.25 });
    expect(tempoPoint(tempo, 2.5)).toMatchObject({ phase: 'pause', progress: 0.5 });
    expect(tempoPoint(tempo, 4)).toMatchObject({ phase: 'up', progress: 0.5 });
    expect(tempoPoint(tempo, 5.5)).toMatchObject({ phase: 'down', progress: 0.25 });
  });
});
