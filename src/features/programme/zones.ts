/**
 * What the Programme tab asks of the user, in zones with a cap each: at most one banner on top
 * (the open-session banner aside) and at most one invitation under the next-session card. An
 * item further down waits until the one above is answered or dismissed.
 */
export type TopBanner = 'restart' | 'out-of-date' | 'backup';
export type Invitation = 'lighter-week' | 'limitation-review' | 'check-in';

export interface ZoneInput {
  /** The programme is paused: nothing about the calendar is asked. */
  paused: boolean;
  /** Every session is done: the next-session card gives way to the cycle card. */
  finished: boolean;
  restart: boolean;
  outOfDate: boolean;
  backup: boolean;
  lighterWeek: boolean;
  limitationReview: boolean;
  checkIn: boolean;
}

export interface Zones {
  banner: TopBanner | null;
  invitation: Invitation | null;
}

/** Restart outranks out-of-date (it decides the week), which outranks the backup reminder. */
export function cardZones(input: ZoneInput): Zones {
  const banner: TopBanner | null =
    input.restart && !input.paused
      ? 'restart'
      : input.outOfDate
        ? 'out-of-date'
        : input.backup
          ? 'backup'
          : null;
  // The lighter week is the most time-bound, the check-in the most routine.
  const invitation: Invitation | null =
    input.paused || input.finished
      ? null
      : input.lighterWeek
        ? 'lighter-week'
        : input.limitationReview
          ? 'limitation-review'
          : input.checkIn
            ? 'check-in'
            : null;
  return { banner, invitation };
}
