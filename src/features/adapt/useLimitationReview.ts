import { useState } from 'react';
import { useProfile } from '@/app/data';
import type { JointRegion } from '@/domain';
import { reviewDue } from '@/features/settings/constraints/model';

/**
 * The joint to ask about, if one is due: six weeks after it started or was last confirmed, the
 * one that has waited longest. Once a joint is returned it is kept for as long as the screen
 * lives, so the card can show its answer.
 */
export function useLimitationReview(): JointRegion | undefined {
  const profile = useProfile();
  const [now] = useState(() => new Date());
  const [shown, setShown] = useState<JointRegion | undefined>();
  const due = reviewDue(profile, now)?.region;
  if (due && shown === undefined) setShown(due);
  return shown ?? due;
}
