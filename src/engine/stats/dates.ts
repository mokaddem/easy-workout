const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of an instant, as `YYYY-MM-DD`. */
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Midnight (local) of the Monday that starts the week containing `d`. */
export const mondayOf = (d: Date): Date => {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};

/** `YYYY-MM-DD` of the Monday of the week containing the instant `iso`. */
export const weekStartOf = (iso: string): string => localDate(mondayOf(new Date(iso)));

export const DAY_MS = 86_400_000;
