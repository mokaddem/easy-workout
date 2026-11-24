import type { TFunction } from 'i18next';
import type { EquipmentInventory, Programme, Profile, Session } from '@/domain';
import { applyTravelKit, constraintsOf, isConstrained, travelCoverage } from '@/engine';

/** Under this mean coverage, a pause is the better advice. */
export const PAUSE_BELOW = 0.5;

export interface CoverageRow {
  sessionId: string;
  /** Share (0 to 1) of the session's main hard sets the kit can do. */
  share: number;
  swapped: number;
  dropped: number;
  low: boolean;
}

export interface Coverage {
  rows: CoverageRow[];
  /** Mean of the rows: the live counter. */
  mean: number;
  /** The kit takes more than half the sets away on average. */
  suggestPause: boolean;
}

const isKept = (session: Session): boolean => session.main.length > 0;

/**
 * What a kit does to each session of the rotation: its coverage, how many exercises stand in
 * for another and how many are left out.
 */
export function coverageOf(
  programme: Pick<Programme, 'rotation'>,
  kit: EquipmentInventory,
  profile: Pick<Profile, 'level' | 'bodyweightKg' | 'limitations' | 'quiet' | 'smallSpace'>,
  avoid?: ReadonlySet<string>,
): Coverage {
  const constraints = constraintsOf(profile);
  const ctx = {
    kit,
    level: profile.level,
    ...(profile.bodyweightKg !== undefined && { bodyweightKg: profile.bodyweightKg }),
    ...(isConstrained(constraints) && { constraints }),
    ...(avoid && { avoid }),
  };
  const rows = programme.rotation.filter(isKept).map((session): CoverageRow => {
    const share = travelCoverage(session, ctx);
    const result = applyTravelKit(session, ctx);
    return {
      sessionId: session.id,
      share,
      swapped: Object.keys(result.substitutions).length,
      dropped: result.dropped.length,
      low: share < PAUSE_BELOW,
    };
  });
  const mean = rows.length === 0 ? 1 : rows.reduce((n, r) => n + r.share, 0) / rows.length;
  return { rows, mean, suggestPause: rows.length > 0 && mean < PAUSE_BELOW };
}

/** "2 swapped, 1 dropped", or that everything works. */
export function rowMetaText(t: TFunction, row: Pick<CoverageRow, 'swapped' | 'dropped'>): string {
  if (row.swapped === 0 && row.dropped === 0) return t('settings.travel.rowAllKept');
  const parts = [
    ...(row.swapped > 0 ? [t('settings.travel.rowSwapped', { count: row.swapped })] : []),
    ...(row.dropped > 0 ? [t('settings.travel.rowDropped', { count: row.dropped })] : []),
  ];
  return parts.join(', ');
}
