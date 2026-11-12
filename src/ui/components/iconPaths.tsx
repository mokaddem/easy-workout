import type { ReactNode } from 'react';

/** In-house 24×24 stroke icons: 2 px stroke, round caps and joins. */
export const PATHS = {
  back: (
    <>
      <path d="M15 5l-7 7 7 7" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12M18 6L6 18" />
    </>
  ),
  pause: (
    <>
      <path d="M9 5v14M15 5v14" strokeWidth="3" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M18 7a7 7 0 0 1 0 10" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  minus: (
    <>
      <path d="M5 12h14" />
    </>
  ),
  check: (
    <>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </>
  ),
  skip: (
    <>
      <path d="M6 6l8 6-8 6z" />
      <path d="M18 6v12" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M19 7h1M4 17h3M13 17h7" />
      <circle cx="16" cy="7" r="2.5" />
      <circle cx="10" cy="17" r="2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  bolt: (
    <>
      <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
    </>
  ),
  chart: (
    <>
      <path d="M5 20V12M11 20V5M17 20v-9M3 20h18" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth="3" />
    </>
  ),
  incline: (
    <>
      <path d="M3 19h18L21 8z" />
      <path d="M16 19v-3" />
    </>
  ),
  stop: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 8.5l7 7" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M2.5 10v4M5.5 7v10M18.5 7v10M21.5 10v4M5.5 12h13" />
    </>
  ),
  band: (
    <>
      <path d="M3 5h4M17 5h4" />
      <path d="M7 5c0 9 2.5 14 5 14s5-5 5-14" />
    </>
  ),
  belt: (
    <>
      <path d="M3 6.5c3 1.3 6 2 9 2s6-.7 9-2" />
      <path d="M8.5 8.2L12 14l3.5-5.8" />
      <rect x="8" y="14" width="8" height="6" rx="1.5" />
    </>
  ),
  bar: (
    <>
      <path d="M2.5 7h19M5 4v6M19 4v6" />
      <path d="M9.5 7v3.5M14.5 7v3.5" />
      <circle cx="12" cy="15.5" r="2.5" />
    </>
  ),
  treadmill: (
    <>
      <path d="M3 17.5h12.5a2.5 2.5 0 0 0 2.4-1.8L20.5 6" />
      <path d="M18 6h4.5" />
      <path d="M5 20.5h10" />
    </>
  ),
  bench: (
    <>
      <path d="M3 10.5h18" />
      <path d="M6 10.5v8M18 10.5v8" />
      <path d="M4 18.5h4M16 18.5h4" />
    </>
  ),
  chevron: <path d="M9 5l7 7-7 7" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.4h.01" strokeWidth="2.6" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8.5h14l-1.2 11.5H6.2z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </>
  ),
  bike: (
    <>
      <path d="M7 20.5h10M12 20.5v-5M8 6h4l1.5 9.5H17l1-5" />
      <path d="M16.5 10.5H20" />
      <circle cx="12" cy="15.5" r="0.6" />
    </>
  ),
  'chev-down': (
    <>
      <path d="M6 9.5l6 6 6-6" />
    </>
  ),
  'chev-right': (
    <>
      <path d="M9.5 6l6 6-6 6" />
    </>
  ),
  'chevron-down': (
    <>
      <path d="M5 9l7 7 7-7" />
    </>
  ),
  dips: (
    <>
      <path d="M3 8.5h6M15 8.5h6M6 8.5v12M18 8.5v12M4 20.5h4M16 20.5h4" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4M6 4h11l-2 4 2 4H6" />
    </>
  ),
  gauge: (
    <>
      <path d="M4.5 17a7.5 7.5 0 1 1 15 0" />
      <path d="M12 17l3.6-4.6" />
    </>
  ),
  heart: (
    <>
      <path d="M12 19.5s-7-4.2-7-9.4A3.9 3.9 0 0 1 12 7.8a3.9 3.9 0 0 1 7 2.3c0 5.2-7 9.4-7 9.4z" />
    </>
  ),
  hourglass: (
    <>
      <path d="M7 4h10M7 20h10" />
      <path d="M8 4c0 4.5 8 5.5 8 8s-8 3.5-8 8M16 4c0 4.5-8 5.5-8 8s8 3.5 8 8" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6h.01" strokeWidth="2.6" />
    </>
  ),
  kettlebell: (
    <>
      <path d="M9 10.2V8a3 3 0 0 1 6 0v2.2" />
      <path d="M6.5 15a5.5 5.5 0 1 1 11 0c0 2.1-.7 3.6-1.6 5H8.1c-.9-1.4-1.6-2.9-1.6-5z" />
    </>
  ),
  miniband: (
    <>
      <ellipse cx="12" cy="12" rx="8.5" ry="5" />
      <ellipse cx="12" cy="12" rx="5" ry="2.3" />
    </>
  ),
  'person-run': (
    <>
      <circle cx="14" cy="4.5" r="1.8" />
      <path d="M6 21l3.5-5.5 3 2.5 1-5.5" />
      <path d="M8 10.5l3.5-3 4 2.5 2.5 3" />
      <path d="M13.5 13l2.5 2.5" />
    </>
  ),
  play: (
    <>
      <path d="M8 5.5v13l10.5-6.5z" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4.5H15" />
    </>
  ),
  rope: (
    <>
      <path d="M5.5 3.5v6M18.5 3.5v6" />
      <path d="M5.5 9.5c0 7.5 3 11 6.5 11s6.5-3.5 6.5-11" />
    </>
  ),
  rower: (
    <>
      <path d="M2.5 18.5h19M5 18.5l2.5-3.5h6.5" />
      <path d="M14 15l4-7M16.5 8h4" />
      <path d="M8 11.5h4" />
    </>
  ),
  shuffle: (
    <>
      <path d="M3.5 7h3c4.5 0 5.5 10 10 10h3.5" />
      <path d="M3.5 17h3c1.5 0 2.6-1.2 3.4-2.8M13.6 9.8C14.4 8.2 15.5 7 17 7h3" />
      <path d="M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5" />
    </>
  ),
  straps: (
    <>
      <path d="M12 2.5v5M12 7.5L7 17M12 7.5L17 17" />
      <path d="M5 17h4M15 17h4M7 17v3M17 17v3" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1-4 3.8-6 7-6s6 2 7 6" />
    </>
  ),
  vest: (
    <>
      <path d="M8.5 3.5L5 6v14.5h5.5V16h3v4.5H19V6l-3.5-2.5c-.4 2-1.8 3.5-3.5 3.5s-3.1-1.5-3.5-3.5z" />
      <path d="M7.5 11h3M13.5 11h3" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M2.5 12H6M18 12h3.5" />
    </>
  ),
  why: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.7 9.6a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.4v.5" />
      <path d="M12 16.6h.01" strokeWidth="2.6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
