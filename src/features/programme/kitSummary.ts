import type { TFunction } from 'i18next';

/** "2 exercises swapped, 1 dropped", or that everything works. */
export function kitSummary(
  t: TFunction,
  travel: { substitutions: Record<string, string>; dropped: string[] } | undefined,
): string {
  const swapped = travel ? Object.keys(travel.substitutions).length : 0;
  const dropped = travel ? travel.dropped.length : 0;
  const parts = [
    ...(swapped > 0 ? [t('programme.kit.swapped', { count: swapped })] : []),
    ...(dropped > 0 ? [t('programme.kit.dropped', { count: dropped })] : []),
  ];
  return parts.length > 0 ? parts.join(', ') : t('programme.kit.all');
}
