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
  download: (
    <>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.6v5.4c0 4.4-2.9 7.7-7 9-4.1-1.3-7-4.6-7-9V6.1z" />
    </>
  ),
  'shield-check': (
    <>
      <path d="M12 3.5l7 2.6v5.4c0 4.4-2.9 7.7-7 9-4.1-1.3-7-4.6-7-9V6.1z" />
      <path d="M8.8 12.2l2.3 2.3 4.2-4.6" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.5h8l4.5 4.5v12.5H6z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M9 13h6M9 16.5h4" />
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
  'step-up': (
    <>
      <path d="M3.5 19.5h5v-5h5v-5h7" />
      <path d="M16.5 6l4 3.5-4 3.5" />
    </>
  ),
  'step-down': (
    <>
      <path d="M3.5 5.5h5v5h5v5h7" />
      <path d="M16.5 12l4 3.5-4 3.5" />
    </>
  ),
  equals: (
    <>
      <path d="M5.5 9h13M5.5 15h13" />
    </>
  ),
  'arrow-up': (
    <>
      <path d="M12 19.5v-15M5.5 11L12 4.5l6.5 6.5" />
    </>
  ),
  'arrow-down': (
    <>
      <path d="M12 4.5v15M5.5 13l6.5 6.5 6.5-6.5" />
    </>
  ),
  expand: (
    <>
      <path d="M14 4h6v6M20 4l-6 6M10 20H4v-6M4 20l6-6" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
    </>
  ),
  turtle: (
    <>
      <path d="M4 16.5c0-4 3.5-7 8-7s8 3 8 7z" />
      <path d="M9 16.5l1.2-5.7M15 16.5l-1.2-5.7M3.5 16.5v2.5M20.5 16.5v2.5" />
      <path d="M20 12.5l2-1.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5l5 5" />
    </>
  ),
  more: (
    <>
      <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth="3" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
      <path d="M10 11v5.5M14 11v5.5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V5.5A1.5 1.5 0 0 0 14 4H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3" />
    </>
  ),
  group: (
    <>
      <path d="M8 5H5v14h3" />
      <path d="M11 8.5h9M11 15.5h9" />
    </>
  ),
  ungroup: (
    <>
      <path d="M8 5H5v4M5 15v4h3" />
      <path d="M11 8.5h9M11 15.5h9" />
    </>
  ),
  grip: (
    <>
      <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth="3" />
    </>
  ),
  bookmark: (
    <>
      <path d="M7 4h10v16l-5-4-5 4z" />
    </>
  ),
  'bookmark-plus': (
    <>
      <path d="M7 4h10v16l-5-4-5 4z" />
      <path d="M12 7.5v5M9.5 10h5" />
    </>
  ),
  restore: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v4h4" />
    </>
  ),
  move: (
    <>
      <path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12h.01" strokeWidth="3" />
    </>
  ),
  scale: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M7.5 11a5.5 5.5 0 0 1 9 0z" />
      <path d="M12 11l1.8-2.6" />
    </>
  ),
  medal: (
    <>
      <path d="M8 3.5l2.5 6M16 3.5l-2.5 6" />
      <circle cx="12" cy="15" r="5.5" />
      <path d="M12 12.5v5" />
    </>
  ),
  joint: (
    <>
      <path d="M6 4.5l5.2 7.6M12.8 12.8L18 19.5" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  suitcase: (
    <>
      <rect x="4" y="8" width="16" height="11" rx="2.5" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M12 8v11" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
