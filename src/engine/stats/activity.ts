import type { SessionLog, SessionSource } from '../../domain';
import { activeSeconds } from '../play';
import { DAY_MS, localDate, mondayOf } from './dates';

/** What was done in one calendar week (Monday to Sunday, local time). */
export interface WeekActivity {
  /** `YYYY-MM-DD` of the Monday. */
  startDate: string;
  /** `YYYY-MM-DD` of the Sunday. */
  endDate: string;
  /** Completed training sessions, every source but cooldowns. Abandoned ones are not counted. */
  sessions: number;
  bySource: Record<Exclude<SessionSource['kind'], 'cooldown'>, number>;
  /** Active time of those sessions, pauses excluded. */
  activeSeconds: number;
}

/** Completed sessions and their active time in the calendar week containing `now`. */
export function calendarWeekActivity(logs: readonly SessionLog[], now: Date): WeekActivity {
  const start = mondayOf(now);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);
  const out: WeekActivity = {
    startDate: localDate(start),
    endDate: localDate(new Date(end.getTime() - DAY_MS / 2)),
    sessions: 0,
    bySource: { programme: 0, custom: 0, quick: 0 },
    activeSeconds: 0,
  };
  for (const log of logs) {
    if (log.status !== 'completed' || log.source.kind === 'cooldown') continue;
    const at = Date.parse(log.startedAt);
    if (at < start.getTime() || at >= end.getTime()) continue;
    out.sessions++;
    out.bySource[log.source.kind]++;
    out.activeSeconds += activeSeconds(log, now);
  }
  return out;
}
