import { useMemo, useState } from 'react';
import {
  useAnswers,
  useCheckIns,
  useEquipment,
  useMaxTests,
  useProfile,
  useProgrammes,
  useSessionLogs,
} from '@/app/data';
import { useProgressContext } from '@/app/progress';
import type { ProgrammeRecord } from '@/db';
import type {
  Answer,
  CheckIn,
  EquipmentInventory,
  Level,
  MaxTest,
  Profile,
  SessionLog,
} from '@/domain';
import { cycleReview, type CycleReview, type ProgressContext } from '@/engine';

export interface CycleData {
  record: ProgrammeRecord | null;
  /** Null when the programme doesn't exist. */
  review: CycleReview | null;
  logs: SessionLog[];
  programmes: ProgrammeRecord[];
  answers: Answer[];
  maxTests: MaxTest[];
  checkIns: CheckIn[];
  profile: Profile;
  equipment: EquipmentInventory;
  progress: ProgressContext;
  /** The level and bodyweight the offers are measured against: what the profile said when the review opened. */
  baseline: { level: Level; bodyweightKg?: number };
}

/**
 * Everything a cycle review reads, from the live database. `undefined` while loading. The profile's
 * level and weight are taken as they were when the screen opened, so accepting an offer does not
 * make it disappear from under the user.
 */
export function useCycleData(programmeId: string): CycleData | undefined {
  const programmes = useProgrammes();
  const logs = useSessionLogs();
  const answers = useAnswers();
  const maxTests = useMaxTests();
  const checkIns = useCheckIns();
  const profile = useProfile();
  const equipment = useEquipment();
  const progress = useProgressContext();
  const [openedAt] = useState(() => new Date().toISOString());
  const [baseline, setBaseline] = useState<CycleData['baseline'] | null>(null);
  if (!baseline && profile)
    setBaseline({
      level: profile.level,
      ...(profile.bodyweightKg !== undefined && { bodyweightKg: profile.bodyweightKg }),
    });

  const record = programmes?.find((p) => p.id === programmeId) ?? null;
  const review = useMemo(
    () =>
      record && logs && programmes && answers && maxTests && checkIns && baseline
        ? cycleReview(record, {
            logs,
            programmes,
            answers,
            maxTests,
            checkIns,
            level: baseline.level,
            ...(baseline.bodyweightKg !== undefined && { bodyweightKg: baseline.bodyweightKg }),
            until: record.endedAt ?? openedAt,
          })
        : null,
    [record, logs, programmes, answers, maxTests, checkIns, baseline, openedAt],
  );

  if (
    !programmes ||
    !logs ||
    !answers ||
    !maxTests ||
    !checkIns ||
    !profile ||
    !equipment ||
    !progress ||
    !baseline
  )
    return undefined;
  return {
    record,
    review,
    logs,
    programmes,
    answers,
    maxTests,
    checkIns,
    profile,
    equipment,
    progress,
    baseline,
  };
}
