import { describe, expect, it } from 'vitest';
import type { Block, SessionItem } from '@/domain';
import { playSteps } from '@/engine';
import i18n from '@/i18n';
import { announcement, tempoPosition } from './signals';

const straight = (item: SessionItem, sets: number): Block => ({
  type: 'straight',
  item,
  sets,
  restSec: 60,
});

describe('announcement', () => {
  const steps = playSteps({
    warmup: [],
    main: [
      straight(
        {
          exerciseId: 'dumbbell-floor-press',
          target: { kind: 'reps', min: 8, max: 10 },
          load: { kind: 'kg', kg: 12.5 },
        },
        3,
      ),
      straight(
        {
          exerciseId: 'one-arm-dumbbell-row',
          target: { kind: 'reps', min: 10, max: 10 },
          perSide: true,
          load: { kind: 'band', level: 'light' },
        },
        1,
      ),
    ],
    finisher: [],
  });

  it('says the exercise, the set, the target and the load', async () => {
    const fr = await i18n.cloneInstance().changeLanguage('fr');
    expect(announcement(steps[1]!, fr, 'fr')).toBe(
      'Développé couché au sol. Série 2 sur 3. 8 à 10 répétitions à 12,5 kilos.',
    );
    const en = await i18n.cloneInstance().changeLanguage('en');
    expect(announcement(steps[4]!, en, 'en')).toMatch(
      /\. Set 1 of 1\. Right side\. 10 reps, light band\.$/,
    );
  });
});

describe('tempoPosition', () => {
  it('walks down, pause and up, rep after rep', () => {
    const tempo = { down: 3, pause: 1, up: 2 };
    expect(tempoPosition(tempo, 0)).toEqual({ rep: 1, phase: 'down' });
    expect(tempoPosition(tempo, 3.2)).toEqual({ rep: 1, phase: 'pause' });
    expect(tempoPosition(tempo, 4.5)).toEqual({ rep: 1, phase: 'up' });
    expect(tempoPosition(tempo, 6.1)).toEqual({ rep: 2, phase: 'down' });
    expect(tempoPosition({ down: 2, pause: 0, up: 2 }, 2.5)).toEqual({ rep: 1, phase: 'up' });
  });
});
