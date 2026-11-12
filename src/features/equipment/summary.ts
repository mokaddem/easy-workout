import type { BandLevel, EquipmentItem, Language } from '@/domain';
import { formatNumber } from './format';

export interface Summary {
  /** Key under `equipment.summary`. */
  key: string;
  values: Record<string, string>;
}

const NBSP = ' ';

/** The one-line recap shown under a collapsed owned item; null when there is nothing to recap. */
export function summarize(
  item: EquipmentItem,
  lang: Language,
  levelLabel: (level: BandLevel) => string,
): Summary | null {
  const n = (v: number) => formatNumber(v, lang);
  switch (item.kind) {
    case 'dumbbell':
      if (item.mode === 'adjustable')
        return {
          key: item.count === 2 ? 'adjustablePair' : 'adjustableSingle',
          values: { min: n(item.minKg), max: n(item.maxKg), nb: NBSP },
        };
      return weights(item.weights, lang);
    case 'kettlebell':
      return weights(item.weights, lang);
    case 'band':
    case 'mini-band': {
      const list = item.levels.map((l) => levelLabel(l).toLowerCase()).join(', ');
      return { key: 'levels', values: { list: list.charAt(0).toUpperCase() + list.slice(1) } };
    }
    case 'weight-belt':
    case 'weight-vest':
      return { key: 'upTo', values: { max: n(item.maxKg), nb: NBSP } };
    case 'pull-up-bar':
      return { key: `mount.${item.mount}`, values: {} };
    case 'bench':
      return { key: item.incline ? 'benchIncline' : 'benchFlat', values: {} };
    case 'treadmill':
      return { key: 'treadmill', values: { speed: n(item.maxSpeedKmh), nb: NBSP } };
    default:
      return null;
  }
}

function weights(list: readonly { kg: number; count: 1 | 2 }[], lang: Language): Summary {
  const sorted = [...list].sort((a, b) => a.kg - b.kg);
  const text = sorted
    .map((w) => formatNumber(w.kg, lang) + (w.count === 2 ? `${NBSP}×${NBSP}2` : ''))
    .join(', ');
  return { key: 'weights', values: { list: text, nb: NBSP } };
}
