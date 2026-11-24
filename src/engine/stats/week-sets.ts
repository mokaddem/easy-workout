import { isCooldownLog, type Exercise, type Programme, type SessionLog } from '../../domain';
import { exerciseById as catalogueById } from '../../catalogue';
import { sessionForWeek } from '../week';
import { MUSCLE_GROUP_IDS, type MuscleGroup } from '../volume';
import {
  addGroupCounts,
  emptyGroupCounts,
  hardSetsOfLog,
  plannedHardSets,
  type GroupCounts,
} from './hard-sets';

export interface WeekSetsRow {
  group: MuscleGroup;
  done: number;
  planned: number;
}

export interface ProgrammeWeekSets {
  week: number;
  /** When the week began (ISO), as worked out from the logs. */
  since: string;
  /** Every group, in the usual order, even at 0. */
  rows: WeekSetsRow[];
}

/** When a programme week began: its first session, else the end of the previous week's last one, else the programme's start. */
export function programmeWeekStart(
  programme: Pick<Programme, 'id'>,
  week: number,
  logs: readonly SessionLog[],
  programmeStartedAt: string,
): string {
  const own = logs.filter(
    (l) => l.source.kind === 'programme' && l.source.programmeId === programme.id,
  );
  const weekOf = (l: SessionLog) => (l.source.kind === 'programme' ? l.source.week : 0);
  const inWeek = own.filter((l) => weekOf(l) === week).map((l) => l.startedAt);
  if (inWeek.length > 0) return inWeek.sort()[0]!;
  const before = own
    .filter((l) => weekOf(l) < week && l.status !== 'in-progress')
    .map((l) => l.endedAt ?? l.startedAt);
  if (before.length > 0) return before.sort().at(-1)!;
  return programmeStartedAt;
}

/**
 * Hard sets done against planned for a programme week, per muscle group. Planned comes from the
 * week's sessions with the phase applied; done from the programme's completed sessions of that
 * week plus completed sessions of other sources started after the week began.
 */
export function programmeWeekSets(input: {
  programme: Programme;
  /** The programme week to report (the current position's week). */
  week: number;
  logs: readonly SessionLog[];
  programmeStartedAt: string;
  exercises?: ReadonlyMap<string, Exercise>;
}): ProgrammeWeekSets {
  const { programme, week, logs, programmeStartedAt } = input;
  const exercises = input.exercises ?? catalogueById;
  const size = programme.rotation.length;
  let planned: GroupCounts = emptyGroupCounts();
  for (let k = 0; k < programme.sessionsPerWeek; k++) {
    const id = programme.rotation[((week - 1) * programme.sessionsPerWeek + k) % size]!.id;
    planned = addGroupCounts(
      planned,
      plannedHardSets(sessionForWeek(programme, id, week).session, exercises),
    );
  }

  const since = programmeWeekStart(programme, week, logs, programmeStartedAt);
  let done: GroupCounts = emptyGroupCounts();
  for (const log of logs) {
    if (log.status !== 'completed' || isCooldownLog(log)) continue;
    const counts =
      log.source.kind === 'programme'
        ? log.source.programmeId === programme.id && log.source.week === week
        : log.startedAt > since;
    if (counts) done = addGroupCounts(done, hardSetsOfLog(log, exercises));
  }
  return {
    week,
    since,
    rows: MUSCLE_GROUP_IDS.map((group) => ({ group, done: done[group], planned: planned[group] })),
  };
}
