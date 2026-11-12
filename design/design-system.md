# Easy Workout design system

Bold athletic: dark-first, high contrast, oversized numerals, one energetic accent, neutral surfaces, short punchy motion. Light mode is complete and follows the system setting unless the user overrides it.

Tokens live in `src/ui/tokens.css` (the single source of truth). Mockups in `design/mockups/` link that file directly, so a token change shows up everywhere.

---

## 1. Principles

1. **The number is the hero.** Reps, load, seconds and weeks are set in heavy condensed numerals, much bigger than the words around them. Labels sit under or beside them in small, quiet text.
2. **Yellow means "now".** The accent marks only what to do next: the primary action, the current step, the next session, the active tempo phase, the rest takeover. Selection uses inverse fills, not yellow. If two yellow things compete on one screen, one of them is wrong.
3. **Readable from the floor.** Anything needed mid-set must be readable from about 2 m with the phone lying on the floor (section 6.4). Everything else steps back.
4. **Sweaty-hand safe.** Targets are at least 48 px, in-workout controls 64 px, no swipe-only or long-press-only actions, primary actions in the bottom third.
5. **French first.** Layouts are sized on French strings, which run 20–30 % longer than English. English then fits with room to spare.

---

## 2. Theming

| Mechanism | Behaviour |
|---|---|
| `:root` | Dark tokens: the default look. |
| `@media (prefers-color-scheme: light)` | Light tokens, unless the root has `data-theme="dark"`. |
| `<html data-theme="light">` / `"dark"` | Forces a theme regardless of the system. Remove the attribute to follow the system again. |

- Both light blocks in `tokens.css` must stay identical (one for the media query, one for the forced attribute).
- Each theme sets `color-scheme`, so form controls and scrollbars match.
- Update `<meta name="theme-color">` to `--color-bg` of the active theme, and to `--color-rest-bg` while the rest takeover is on screen, so the system bars blend in.
- The rest takeover (yellow) looks the same in both themes on purpose: it is a state, not a theme.

---

## 3. Colour

### 3.1 Palette (primitives)

| Name | Hex | Use |
|---|---|---|
| Graphite 900 | `#11131A` | Dark background. Cool, slightly blue, so the yellow vibrates against it. |
| Graphite 850 / 800 / 750 | `#181B23` / `#20242E` / `#292D38` | Dark surfaces: card, raised, sunken. |
| Chalk | `#F3F4F6` | Dark-theme text and inverse fills. |
| Graphite 50 | `#F1F2F5` | Light background. Cool grey, never cream. |
| Ink | `#12141A` | Light-theme text, ink on yellow, the rest card. |
| Signal 500 | `#FFC81E` | The accent. The yellow/black pair is the most legible colour pair at a distance, which is why road signs use it. |
| Red 400 / 700 | `#FF6B5E` / `#B3261E` | Destructive and pain only (dark / light). |

The full scale (graphite 1000–50, signal 100–900, red) is in `tokens.css`.

### 3.2 Semantic tokens

| Token | Dark | Light | Role |
|---|---|---|---|
| `--color-bg` | graphite 900 | graphite 50 | Screen background |
| `--color-surface` | graphite 850 | white | Cards |
| `--color-surface-raised` | graphite 800 | white | Sheets, dialogs |
| `--color-surface-sunken` | graphite 750 | graphite 100 | Steppers, segmented tracks, wells, tempo segments |
| `--color-surface-inverse` / `--color-on-inverse` | chalk / ink | ink / chalk | Selected state, toasts, active tab |
| `--color-line` | graphite 700 | graphite 150 | Decorative dividers and card edges |
| `--color-line-strong` | graphite 600 | graphite 500 | Control outlines (≥ 3:1) |
| `--color-text` | chalk | ink | Primary text |
| `--color-text-muted` | graphite 300 | `#474D5C` | Secondary text, labels |
| `--color-text-subtle` | graphite 400 | `#5E6474` | Tertiary text, inactive tabs |
| `--color-text-disabled` | graphite 600 | graphite 300 | Disabled labels (exempt from contrast rules) |
| `--color-accent` / `--color-on-accent` | signal 500 / ink | signal 500 / ink | Fills: primary button, next, active tempo phase |
| `--color-accent-pressed` | signal 600 | signal 600 | Pressed primary |
| `--color-on-accent-muted` | `#4D3D05` | same | Secondary text on yellow |
| `--color-accent-line` | signal 500 | **ink** | Strokes and indicators on the base surface: timer ring, progress, current step |
| `--color-accent-text` | signal 500 | signal 900 | Accent as text on the base surface (use sparingly) |
| `--color-accent-tint` | yellow at 10 % | signal 100 | Highlighted row (current week) |
| `--color-complete` / `--color-on-complete` | graphite 700 / chalk | graphite 200 / ink | Finished items recede |
| `--color-danger`, `-pressed`, `on-danger`, `-text`, `-tint` | red 400 family | red 700 family | Destructive actions, pain, errors |
| `--color-focus` | signal 500 | ink | Focus ring |
| `--color-track` | graphite 750 | graphite 150 | Progress and timer tracks |
| `--color-press-overlay` | white at 8 % | ink at 6 % | Pressed state on neutral controls |
| `--color-scrim` | graphite 1000 at 72 % | ink at 48 % | Behind sheets and dialogs |
| `--color-rest-bg`, `on-rest`, `on-rest-muted`, `rest-track`, `rest-surface`, `on-rest-surface` | yellow, ink, dark olive, ink at 18 %, ink, chalk | same | The rest takeover |

**Why `--color-accent-line` turns to ink in light mode:** yellow on white is 1.4:1, which fails the 3:1 rule for graphics. In light mode the yellow stays as a fill (buttons, next, active tempo phase) and strokes become ink. The light rest ring reads like a stopwatch.

### 3.3 Usage rules

- **Accent:** at most one primary button per screen. Selected chips, check boxes, segmented options and the current tab use **inverse**, not yellow.
- **Done vs next vs later:** done = `complete` fill with a check (recedes); next = accent fill with a 2 px accent-line ring; this week's later items = strong outline; future = hairline outline.
- **Red** only for destructive actions and pain. There is no green: "done" is shown with a check and a neutral fill, so the screen never turns into a traffic light.
- **Feel (easy / right / hard)** has no colour coding. Selection is shown by an inverse fill.

### 3.4 Measured contrast (WCAG 2.x)

| Pair | Dark | Light | Target |
|---|---|---|---|
| text on bg / surface / sunken | 16.9 / 15.6 / 12.5 | 16.5 / 18.4 / 15.3 | AAA 7 |
| text-muted on bg / surface / sunken | 8.5 / 7.9 / 6.3 | 7.6 / 8.5 / 7.0 | AA 4.5 |
| text-subtle on bg / surface / sunken | 6.3 / 5.9 / 4.7 | 5.3 / 5.9 / 4.9 | AA 4.5 |
| ink on accent (buttons, rest timer) | 11.9 | 11.9 | AAA 7 |
| on-accent-muted on accent | 6.8 | 6.8 | AA 4.5 |
| accent-line on bg / surface | 12.0 / 11.1 | 16.5 / 18.4 | 3 (graphics) |
| line-strong on bg / surface | 3.5 / 3.3 | 4.4 / 5.0 | 3 (control edges) |
| danger-text on bg / surface | 6.6 / 6.2 | 5.8 / 6.5 | AA 4.5 |
| focus on bg / surface | 12.0 / 11.1 | 16.5 / 18.4 | 3 |
| on-complete on complete | 10.7 | 12.4 | AA 4.5 |

Timer and current-exercise text sit at 11.9:1 or higher in every state (AAA).

---

## 4. Typography

### 4.1 Typeface

**Archivo** by Omnibus-Type, variable font with width (62–125 %) and weight (100–900) axes. **SIL Open Font License 1.1**: free to self-host and bundle offline.

One family does everything. The width axis gives both voices: extra-condensed heavy for numerals and display text, normal width for reading. That means one variable file to cache for offline use (about 90 KB in WOFF2 for the Latin subset) and a coherent look without pairing two families.

- Condensed letters suit the floor: when the phone lies flat, the screen is seen at a steep angle and looks squashed vertically. Tall, narrow letters stay readable.
- Numerals use `font-variant-numeric: tabular-nums` so a countdown never shifts sideways. Archivo's default figures are proportional; tabular figures are a supported feature.
- Text is sentence case everywhere. No all-caps labels, no letter-spaced eyebrows.

**Self-hosting:** the app bundles the variable `wdth` faces from `@fontsource-variable/archivo` (family `'Archivo Variable'`, `font-weight: 100 900; font-stretch: 62% 125%; font-display: swap`). The Latin face is preloaded on the first screen; Latin and Latin Extended are precached by the service worker; other subsets load only if their characters appear. The mockups use the Google Fonts CDN (family `'Archivo'`) only for convenience; the token stack lists both names. System fallbacks have no condensed width, so a missing font makes numerals much wider. Always ship the font; never rely on the fallback for the player.

### 4.2 Width, weight, size

| Token | Value | Used for |
|---|---|---|
| `--font-width-numeral` | 62 % | Every numeral role |
| `--font-width-display` | 68 % | Screen titles, exercise names |
| `--font-width-title` | 76 % | Card and section titles |
| `--font-width-label` | 88 % | Buttons, chips, tabs (saves width for French) |
| `--font-width-text` | 100 % | Running text, hints |
| Weights | 400 / 500 / 600 / 700 / 800 | regular, medium, semibold, bold, heavy |

Size scale: the classic typographic scale (12, 14, 16, 18, 21, 24, 36, 48, 60, 72), extended in multiples of 48 for numerals (96, 144, 192, 240, 288). Tokens: `--font-size-<px>`, in rem.

### 4.3 Roles

| Role | Size | Line height | Weight | Width | Where |
|---|---|---|---|---|---|
| Timer, takeover (`--type-timer-size`) | 288 (≤ 2 digits), 192 (3 digits) | 0.76–0.86 | 800 | 62 % | Rest countdown, full screen |
| Timer, compact (`--type-timer-compact-size`) | 192 | 0.86 | 800 | 62 % | Inside the timer ring |
| Numeral XL | 96 | 0.86 | 800 | 62 % | Reps target and load during a set |
| Numeral L | 60 | 0.86 | 800 | 62 % | Player stats (compact variant) |
| Numeral M | 36 | 0.86 | 800 | 62 % | Player steppers, prescriptions |
| Numeral S | 24 | 1 | 800 | 62 % | Form steppers |
| Exercise | 48 (min 40) | 0.94 | 800 | 68 % | Current exercise, player |
| Display | 48 (36 for secondary headings) | 0.94 | 800 | 68 % | Screen titles |
| Title | 24 (21 headline) | 1.1 | 700 | 76 % | Cards, sections, sheets |
| Label | 18 (16 small) | 1.25 | 700 | 88 % | Buttons, segmented, chips |
| Body | 16 (18 large) | 1.5 | 400 | 100 % | Running text |
| Meta | 14 | 1.4 | 500–600 | 100 % | Secondary lines |
| Caption | 12 | 1.35 | 600 | 88 % | Grid column names only; avoid elsewhere |

Running text stays under about 60 characters per line on a phone. Text never goes below 12 px; 12 px is only for single words in dense grids.

### 4.4 French and English typography

- Numbers through `Intl.NumberFormat`: `2,5 kg` in French, `2.5 kg` in English.
- French puts a narrow no-break space (U+202F) before `: ; ? !` and `%` (`15 %`, `Série faite ?`). English puts none (`15%`).
- Units after a no-break space: `14 kg`, `90 s`, `12 km/h`. Ranges use an en dash without spaces: `8–10`. Multiplication uses `×`: `3 × 8–12`.
- Feel labels: FR *Facile / Idéal / Dur*, EN *Easy / Right / Hard*. "Juste" is avoided in French because "c'était juste" means "barely made it", the opposite of what we mean.
- Exercise names wrap with `text-wrap: balance`. Size steps down 48 → 44 → 40 px for long names; never smaller, never truncated.

---

## 5. Spacing, layout, touch

| Token | Value |
|---|---|
| `--space-1 … --space-11` | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 px |
| `--layout-gutter` | 20 px screen side padding (16 px for card lists and docks) |
| `--layout-max-width` | 40 rem content column on tablets |
| `--tap-min` | 48 px: every target |
| `--tap-comfort` | 56 px: standard buttons |
| `--tap-player` | 64 px: everything inside a workout |

- Content is left-aligned. Centring is only for the timer ring and single-action empty states.
- Primary actions sit in a bottom dock (above the home indicator, safe-area padded). In the player, nothing actionable sits in the top 20 % except pause and sound.
- Spacing between groups (24–36 px) is always larger than spacing inside a group (6–16 px); separation comes from space, cards only for things you act on.
- Respect `env(safe-area-inset-*)`. Mockups reserve 47 px at the top and 34 px at the bottom for a 390 × 844 phone.

### 5.1 App shell

```
┌ app bar (sticky, below the top safe area) ┐
│ screen content (scrolls)                  │
│ …                                         │
├ dock (sticky; pinned to the bottom)       ┤
└ tab bar (tab screens only)                ┘
```

- **One column.** The app is a single phone-width column (max 30 rem) at full dynamic viewport height, centred on wider screens. Only the screen area scrolls; the tab bar never moves.
- **Top.** The screen container is padded by the top safe area, so sticky headers (app bar, step bar, context bar) stick just below it; an opaque strip in the background colour covers the safe area, so content scrolling past never shows behind the status bar.
- **Bottom.** The dock is sticky at the bottom and pushed down with `margin-top: auto`, so it sits at the bottom edge on short screens and stays in view on long ones. It clears the home indicator itself, except above a tab bar, which already does.
- **Tab bar visibility.** Shown on the four tab roots (Programme, Quick session, Progress, Settings) and on screens reached inside a tab (session detail stays under Programme). Hidden on onboarding, on edit screens (Profile, My equipment) and in the workout: editing and training are focused tasks with their own exit (back, close, save).
- **Toasts** sit 16 px above whatever is pinned at the bottom (dock, tab bar or both). The shell measures that chrome live, so a toast never covers the primary action, whatever the screen.
- **Inner scroll regions.** Screens whose header is a context bar (session detail, quick result) keep the bar outside a scrolling body; the effect is the same as a sticky app bar.

---

## 6. Shape, depth, layers

### 6.1 Radii (by role, not one value everywhere)

| Token | Value | Used for |
|---|---|---|
| `--radius-xs` | 4 px | Progress bars, tempo segments, ticks |
| `--radius-sm` | 8 px | Check boxes, icon wells, grid cells, thumbnails |
| `--radius-md` | 14 px | Buttons, steppers, segmented controls, inputs |
| `--radius-lg` | 20 px | Cards, animation slot, rest card |
| `--radius-xl` | 28 px | Sheet top corners, dialogs |
| `--radius-pill` | 999 px | Chips, badges, toasts, tab indicator |

Borders: `--border-hairline` 1 px (decorative), `--border-control` 1.5 px (outlines), `--border-strong` 2 px (check box, outlines on yellow, phase brackets).

### 6.2 Elevation

Dark mode separates layers by surface lightness plus a faint top highlight; shadows appear only on floating layers. Light mode uses soft ink-tinted shadows.

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--elevation-0` | none | none | Flat |
| `--elevation-1` | 4 % top highlight | 1–2 px shadow | Cards |
| `--elevation-2` | highlight + 24 px shadow | 16 px shadow | Sticky docks, popovers |
| `--elevation-3` | highlight + 48 px shadow | 40 px shadow | Sheets, toasts |

### 6.3 Layers

`--z-sticky` 10, `--z-nav` 20, `--z-sheet` 40, `--z-toast` 50.

### 6.4 The 2 m rule (workout player)

On a 390 px-wide phone, 1 px is about 0.165 mm. At 2 m, normal eyesight resolves letters about 2.9 mm tall; comfortable reading at a glance needs about 3 times that.

| Tier | Minimum | Cap height | Content |
|---|---|---|---|
| 1 | 192 px numerals (288 on the takeover) | ≥ 23 mm | Rest countdown |
| 2 | 60 px numerals (96 preferred) | ≥ 7 mm | Reps target, load, set number |
| 3 | 40 px heavy condensed | ≥ 4.6 mm | Current exercise name, next exercise on rest |
| 4 | anything smaller | n/a | Read with the phone in hand: logging, hints |

Tier 1–3 content keeps AAA contrast (≥ 7:1) in every theme and state.

---

## 7. Motion

### 7.1 Tokens

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 80 ms | Press feedback (scale) |
| `--duration-fast` | 140 ms | Toggles, chips, check marks, segmented selection |
| `--duration-base` | 220 ms | Expand / collapse, card state changes |
| `--duration-slow` | 320 ms | Sheets, screen transitions |
| `--duration-flood` | 420 ms | Set → rest takeover |
| `--duration-celebrate` | 600 ms | Set done, last set, personal best |
| `--ease-snap` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances: fast start, firm landing |
| `--ease-exit` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exits: get out of the way |
| `--ease-move` | `cubic-bezier(0.65, 0, 0.35, 1)` | Repositioning, colour changes |
| `--ease-punch` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoot, achievements only |
| `--ease-linear` | `linear` | Clock-driven progress |
| `--motion-distance-sm / md / lg` | 8 / 24 / 64 px | Travel for entrances |
| `--motion-scale-press` / `-punch` | 0.97 / 1.08 | Press / celebration |

Exits run at about 70 % of the matching entrance duration.

### 7.2 Key moments

| Moment | Spec |
|---|---|
| Press | Scale to `--motion-scale-press` over `instant`, `snap`; release over `fast`. |
| Set logged | Check mark draws in over `fast`; the logged numbers punch to `--motion-scale-punch` and back over `celebrate`, `punch`. Then the rest begins. |
| Set → rest (takeover) | Yellow grows from the logged button to fill the screen over `flood`, `snap`; the countdown digits rise `distance-md` and fade in over `base`, starting 120 ms in. Rest → set reverses with `exit` over `slow`. |
| Timer ring / rest bar | Driven by the clock, `linear`, updated every frame from the real end time. Animation never drives the clock. ±15 s re-targets the arc over `base`, `move`. |
| Last 3 seconds | Digits pulse (scale 1 → 1.04 → 1) once per second over `fast`, with the beep and vibration. |
| Tempo phase change | Fill moves to the next segment over `fast`, `move`, in sync with the tempo audio. |
| Sheet | Slides up `distance-lg` + fades over `slow`, `snap`; scrim fades over `base`. |
| Toast | Rises `distance-sm` over `base`, `snap`; stays 5 s (undo) and leaves over `fast`, `exit`. |
| Card expand | Height and content fade over `base`, `move`. |
| Screen entrance | Going deeper slides the new screen in from `distance-md` on the right over `slow`, `snap`; going back, from the left. Tab to tab is a cross-fade over `base`, `move`. Changes inside a screen (step, week, view) never replay the entrance. Transform and opacity only, never blocking input. |
| Step / view change | Onboarding steps and quick launcher ↔ result slide the content by `distance-md` (direction follows forward / back) over `slow`, `snap`; the bars and dock stay put. |
| Selection fill | Choice cards, choice tiles, weight cells, segmented options, week ruler cells and tab icons fill inverse over `fast`, `move`. Choice cards also take the press scale. |
| Digit roll | Steppers, hero steppers and the live counter: the old value leaves up `distance-sm`, the new one arrives from below over `fast`, `snap` (exit at 70 %). Both share one cell, so nothing shifts. |
| Rows in and out | Split preview rows (and other lists that grow or shrink) open and close with height + fade over `base`, `move`. |
| Disclosure | Chevron rotates 180° and the body uses card expand (`base`, `move`). |
| Content swap | Week switch on session detail and Shuffle on a quick session: the new values fade in over `base`, `move`; delta tags pop in (rise `distance-sm` from press scale) over `fast`, `snap`. Buy-next skeleton → cards → error cross-fade over `base`. |
| Menu | Scales in from the corner of its button (from 0.91) with a fade over `fast`, `snap`. |
| Dialog | Rises `distance-sm` from press scale over `slow`, `snap`; scrim as for sheets; exits at 70 % with `exit`. |
| Dismissed card | The one-time "why" card collapses (height + fade) at 70 % of `base`, `exit`. |
| Generating | Steps rise `distance-sm` over `base`, `snap`; the check pops in over `fast`. |
| Spinner | One turn every 800 ms, `linear`. With reduced motion it slows to 2.4 s instead of stopping: it still says "working". |

Punch is for achievements only: never on routine taps or navigation.

### 7.3 Reduced motion

`prefers-reduced-motion: reduce` overrides the tokens: travel distances and press/punch scales become 0 / 1, overshoot becomes `--ease-move`, durations shrink to cross-fades of 100–160 ms. The takeover becomes a 160 ms cross-fade. The timer ring still moves (it carries information) but the last-3-seconds pulse is replaced by a colour change only. Components that read the tokens get this for free; anything driven from script must read them too. Script-driven motion runs through one provider that, under reduced motion, drops transforms and keeps opacity and colour changes.

---

## 8. Iconography

- 24 × 24 grid, 2 px stroke, round caps and joins, no fills (except status glyphs). 20 px in chips and facts, 28 px in equipment wells.
- Drawn in-house as inline SVG symbols.
  - Actions and navigation: back, close, chevron (right and down), plus, minus, check, play, pause, skip, sound, shuffle, swap, refresh, pencil, sliders, stop.
  - Meaning: calendar (schedule), gauge (goal and level), user (profile), bolt (quick session), chart (progress), clock, hourglass, list, flag, heart (cardio day), incline, person running, bag (what to buy), info, alert, why.
  - Equipment: dumbbell, kettlebell, band, mini-band, belt, vest, pull-up bar, dip bars, bench, treadmill, bike, rower, jump rope, ab wheel, suspension straps.
- Icons never stand alone for unfamiliar actions: icon buttons carry an accessible label, and in the player only pause, sound, edit and skip are icon-led.

---

## 9. Components

States covered for each: **default, pressed, disabled, focus, error, empty, loading** where they apply. Focus is always `--focus-ring` (2 px bg gap + 2 px focus colour), visible on any surface including yellow; inside cards and full-width rows it is drawn inset (2 px `--color-focus`) so it is never clipped. On the rest takeover the ring is ink. "Pressed" means the press overlay unless a press scale is stated.

| Group | Components |
|---|---|
| 9.1 Core controls | Button, icon button, stepper (hero, word value, load ruler), segmented control (2 × 2, tall, compact pair, view tabs), chip, check box, card, list row, progress bar, skeleton and spinner |
| 9.2 Shell | App bar, context bar, step bar, dock, tab bar |
| 9.3 Choices and numbers | Choice card and choice tile, large numeric field, live counter, split preview |
| 9.4 Equipment | Equipment card, weight grid, purchase card, cost badge, computing state |
| 9.5 Notes and messages | Note (inline, notice, dock note), banner, why card, why line, nudge row, toast, empty state |
| 9.6 Programme and session | Week hero, rotation grid, session row, session hero, week ruler, disclosure card, prescription row, group block, cardio and interval strips, delta tag |
| 9.7 Overlays | Sheet (with footer), dialog, menu, change list, session compare, reason groups |
| 9.8 Full-screen states | Generating screen, player stand-in, progress before data |
| 9.9 Workout player | Timer ring, tempo indicator, animation slot |

### 9.1 Core controls

#### Button

| Variant | Default | Pressed | Disabled |
|---|---|---|---|
| Primary | accent fill, ink label | `accent-pressed`, scale 0.97 | sunken fill, disabled label |
| Secondary | transparent, 1.5 px `line-strong` outline | press overlay | outline removed, disabled label |
| Ghost | text colour, 2 px underline | press overlay | disabled label, no underline |
| Destructive | `danger` fill, `on-danger` label (confirmations) | `danger-pressed` | as primary |
| Destructive outline | `danger-text` outline and label (in-flow stops) | danger tint | as secondary |

- Heights: 56 px (`--tap-comfort`), 64 px in the player (`--tap-player`). "Start" buttons that lead into a workout (session detail, quick result) use the 64 px size with a leading play icon; so do the single actions of the full-screen states (9.8), without the icon. Label 18 px bold at 88 % width; 21 px in the player.
- Content: optional leading icon (check for confirmations, play for start), never a trailing arrow. A two-line primary is allowed when it shows exactly what will be logged ("Fait comme prévu / 10 reps à 14 kg").
- **Loading:** label stays, a 20 px spinner replaces the icon, the button keeps its width, ignores taps and sets `aria-busy`.
- **Error:** buttons have no error state; the error shows on the field or as a toast.
- **Validation:** a step's Continue stays enabled; tapped with something missing, it marks the field in error and says what is missing. A disabled primary is used only when there is nothing to do (Save on an unchanged Profile).

#### Icon button

48 × 48 (64 × 64 in the player), radius md, transparent or sunken fill, optional outline. Pressed: press overlay. Disabled: disabled colour. Always has an `aria-label`. When it opens something it carries `aria-haspopup` / `aria-expanded`.

#### Stepper (reps, load, equipment specs)

`[−] value unit [+]` on a sunken pill. Buttons 48 px (64 px in the player); value in numeral S (forms) or M (player), unit in 14 px muted.
- Step follows the equipment: load steppers jump through the loads the equipment can actually make (2 kg steps, or the band levels), not free numbers.
- At the limit, that button is disabled. Long press is not used; each tap is one step. The value rolls (section 7.2).
- **Error:** value out of range (typed entry, if allowed) turns the outline `danger-text` with a one-line message below.
- **Empty:** shows `–` in muted until a value is set.
- **Word value:** when a value is a state rather than a number, the slot shows a word in the same place and the unit is hidden: treadmill incline 0 → *Aucune / None*; bar with no known rating → *Inconnue / Unknown*.
- **Load ruler** (adjustable dumbbells, under the min / max / step steppers): one 2 × 14 px tick per load the set can make in `line-strong`, the two ends 28 px tall in `text`, then a 14 px muted count line, live (*17 charges par haltère, de 2 à 34 kg*). The ticks are decorative; the sentence carries the value.

**Hero stepper** (days per week, session length, in onboarding and Profile): label above; sunken track, radius lg, 100 px tall (88 px in forms); 64 px buttons on `surface`, radius md, elevation 1, 2.5 px icon stroke; value numeral 96 (72 in forms) + 24 px muted unit at title width. One tap = one step (1 day, 5 minutes). Pressed: press scale. Disabled at the limit: transparent, no shadow, disabled colour.

#### Segmented control

Equal-width options on a sunken track, 4 px inset, options 48 px tall, radius 10 px inside the md track. Selected: inverse fill. Pressed: press overlay. Disabled option: disabled label, not focusable. Radio group with a roving tab stop; arrow keys move and select. Used for feel (*Facile / Idéal / Dur*), language, theme and small exclusive choices (≤ 4 options; more becomes a list).
- **2 × 2:** four options with long labels wrap into two rows of two (bar mount, level in Profile).
- **Tall:** 56 px options with a 12 px sub-line under the label (*Tout mon matériel / 6 équipements*, *Poids du corps / Aucun matériel*).
- **Compact pair:** two short options inline at the end of a row (*Seul / Par paire* in the weight grid).
- **View tabs:** the same look used as a real tab list under the app bar (*Mon matériel / Quoi acheter ensuite*): `role="tablist"`, each option `role="tab"` with `aria-selected`, the content below is the tab panel. A view that costs work (what to buy) computes only when its tab first opens.

#### Chip

48 px pill, 1.5 px outline. Selected: inverse fill plus a leading check. Used for multiple choice (band levels, filters). **Single-choice chips** (quick-session focus) are the same chip with `role="radio"`: one selected at a time, still inverse + check. **Included** items (household equipment) are not chips: they render as a static check list, so they never look tappable.

#### Check box

28 px, radius sm, 2 px outline; checked = inverse fill with check. The whole row or card header is the target.

#### Card

Surface fill, radius lg, hairline edge, elevation 1. **Selectable card**: header row is the target (≥ 76 px), check box on the right; when on, the edge becomes `line-strong` and the settings expand. **Loading:** skeleton blocks in `surface-sunken`, no shimmer, at the size of the real content. **Empty:** see empty state. A card can hold a grouped list of rows (Settings).

#### List row

Min 56 px; optional leading 48 px well (icon or thumbnail); title (16–18 px semibold) + meta line; trailing value, chevron or control. Divider = hairline, inset to the text. Pressed: press overlay. Focus: inset ring. Disabled: muted text, no chevron. A row is a link when it navigates, a button when it opens something in place.

#### Progress bar

8 px, radius xs, track `--color-track`, fill `--color-accent-line`. **Segmented** variant for steps and sequences (onboarding steps, exercise in session, sets, weeks, purchases tested): 6 px segments, 4 px apart; done = `text-subtle`, current = `accent-line`, later = track. Always paired with visible text ("Étape 4 sur 5", "7 sur 12"), so the bar is never the only carrier of the value.

#### Skeleton and spinner

- **Skeleton:** `surface-sunken` blocks at the size of the content they stand for, radius sm (or the radius of the real element), no shimmer. Session detail and the programme screen load this way.
- **Spinner:** 20 px (24 in headings), 3 px stroke in `currentColor`: a 25 % track and a quarter arc. Decorative; the text next to it says what is happening.

### 9.2 Shell

Layout rules in section 5.1.

#### App bar

Sticky top, `--color-bg` fill, `--z-sticky`. Optional back icon button (48 px; the left padding drops to 8 px), title 21 px bold at title width with an optional 14 px muted meta line, trailing icon buttons (the programme's options menu).

#### Context bar

For screens whose real title is a big heading in the content: a back icon button (session detail, quick result) or close (player stand-in, and later the player) and a 14 px muted context line on one line with an ellipsis (*Séance A — Push*, *Semaine 3 · Volume*). Min 56 px. No title element: the content's display heading is the page title.

#### Step bar (onboarding)

Back icon button from step 2, then the segmented progress bar with its label (*Étape 2 sur 5*). On step 1 the bar spans the full width. No title; each step opens with its own display heading, which takes focus on step change.

#### Dock

Sticky bottom, `--color-bg`, hairline top edge, `--z-sticky`; 12 px padding, 16 px sides, plus the home indicator unless a tab bar sits below. Holds one primary action and, when needed:
- a **dock note** above the primary (section 9.5);
- a **live counter** to the left of the primary (equipment step; the button takes the rest up to 14 rem);
- a secondary + primary row (quick result: *Mélanger* sized to its label, *Commencer* fills the rest).
Never more than one primary. Previewing another week replaces Start with a secondary *Revenir à la semaine 3* and a one-line note.

#### Tab bar

Four equal tabs, 64 px tall, hairline top edge, `--z-nav`, pads the home indicator. Each tab: 24 px icon in a 56 × 30 px pill, 13 px semibold label at 88 % width. Current: inverse pill, `text` label in bold, `aria-current="page"`. Others: `text-subtle`. Focus: ring around the tab. Tabs are links; the icons are calendar, bolt, chart, sliders.

### 9.3 Choices and numbers

#### Choice card and choice tile

Single choice, `role="radiogroup"` / `role="radio"`, arrow keys move.
- **Choice card** (goal, level): surface, 1.5 px `line-strong`, radius lg, elevation 1, 16 px padding. 28 px round mark on the left, title 21 / bold / 76 % width, description 15 px muted, optional figure on the right (numeral 36 + 13 px label: *6–12 / reps par série*). Heights: 76 px; goal 104 px (mark aligned to the top); compact 64 px with a numeral 24 figure.
- **Choice tile** (quick-session duration): five equal tiles in a row, 64 px, radius md, 1.5 px `line-strong`; numeral 36 over a 13 px muted unit (*min*).
- **Selected:** inverse fill and edge; the mark fills with a check; secondary text stays on-inverse at 78 % opacity. **Pressed:** cards scale to 0.97, tiles take the press overlay. **Error:** every option's edge turns `danger-text` and the group gets `aria-invalid`; the message sits above the group, in danger text with the alert icon (*Choisis ton niveau pour continuer.*).

#### Large numeric field

Label row (label + *Facultatif / Optional* in 14 px muted); sunken box, radius md, 1.5 px `line-strong`, 96 px tall (72 compact); numeral 60 (48 compact) input + 24 px muted unit; message line below (15 px, muted, info icon). Decimal keyboard.
- **Empty:** `–` placeholder in `text-subtle`; the message says what happens if it stays empty (*Laissé vide, les charges de départ partent de 70 kg.*).
- **Focus:** focus ring + `text` edge. **Error:** 2 px `danger-text` edge, the message turns danger text in semibold with the alert icon (*Entre un poids entre 30 et 250 kg, ou laisse vide.*). Checked on blur and on Continue, not while typing.

#### Live counter

Numeral 48 + a two-line 14 px muted label (*exercices / possibles*), left of the dock button. `aria-live="polite"`; the number rolls on every tick or spec change.

#### Split preview

Shows what a schedule turns into, under the hero steppers. Heading (*Ta semaine*), one muted line (*3 séances par semaine, 45 min, pas de jours fixes*), an info note when sessions are under 30 min, then rows: 40 px letter tile (1.5 px `line-strong`, radius sm, 18 px heavy letter) + session name 17 / 600. The cardio day uses a dashed tile with the incline glyph. Names come from the programme generator. `aria-live="polite"`; rows open and close (section 7.2).
- **Compact** (Profile): one line, the letters in a single outlined tile (*ABC*) + the description.

### 9.4 Equipment

#### Equipment card

Card with a header split into two targets:
- **Main area** (≥ 76 px): 48 px icon well, name 21 / bold, a 14 px muted sub-line. Not owned: tapping ticks it. Owned with settings: tapping expands or collapses them (chevron down, flips when open).
- **Tick column** (64 px wide, full height): a 28 px check box that always toggles ownership.
- **On:** `line-strong` edge; the sub-line becomes a summary of the settings (*Léger, moyen, fort*, *12 kg*, *Cadre de porte*). Ticking an item opens its settings; items already owned when the screen opens start collapsed; an item in error is always open.
- **Error:** `danger-text` edge (doubled with a 1 px ring) and the message inside the body. Unticking an item that has settings shows an undo toast.
- Focus: inset ring on the main area; the check box gets the ring on its own.
- Order is fixed by family (dumbbells, kettlebells, bands, bars, bench, cardio, household) in onboarding and the editor alike; owned items are not pulled to the top.

#### Weight grid (fixed dumbbells, kettlebells)

Four columns of 56 px cells, radius md, 1.5 px `line-strong`: numeral 24 + 12 px *kg*. Owned = inverse fill (`aria-pressed`). Last cell is a dashed *Autre / Other* (plus icon) that opens a row with a decimal input and *Ajouter*. Then *Combien de chaque*: one row per weight, numeral + *kg* and a compact *Seul / Par paire* segmented pair (dumbbells default to pairs, kettlebells to single). **Error** (ticked with no weight, on Continue): unselected cells take `danger-text` edges and the message names the fix (*Ajoute au moins un poids, ou décoche les kettlebells.*).

#### Purchase card (what to buy next)

Card, 16 px padding:
1. Header: 48 px icon well, name 21 / bold, cost badge under the name, and on the right the figure: *+25* in numeral 36 over a 12 px label (*exercices en plus*). When nothing new is unlocked (vest), the figure counts the bodyweight moves it can load instead.
2. Lines (16 px, 20 px icon): swap lines (*Tractions remplace Rowing inversé en séances A et C*, names bold, same change grouped across sessions) then gain lines with a plus icon, one sentence per kind of gain.
3. At most 2 swap lines and 2 gain lines; a ghost *Voir les N autres changements* expands the rest (and becomes *Voir moins*).
4. Secondary full-width *J'ai cet équipement*: adds the item, opens its settings in My equipment and shows an undo toast.

The list shows the top 3, then a secondary *Voir les 7*; once everything is shown, a short paragraph (*Aucun changement pour ton programme*) names the items that would change nothing.

#### Cost badge

Hairline pill, min 28 px: three ascending bars (4 px wide, 6 / 9 / 12 px tall; on = `text`, off = track) + *Coût faible / moyen / élevé* in 12 px. Never colour-coded, no prices.

#### Computing state

While purchases are tested: a 24 px spinner and a status line (*On teste chaque achat sur ton programme*), a segmented meter with one segment per purchase tested and its count (*7 sur 12*, real progress), then two skeleton purchase cards. `aria-busy` on the region. **Error:** the same place shows an empty state with the alert icon, what went wrong and a *Réessayer* button. **Empty** (nothing worth buying): empty state with a check icon and *Revenir à mon matériel*.

### 9.5 Notes and messages

#### Note

Information only, never an action. 20 px icon + text. Three placements, one look:
- **Inline note:** no fill, 14–15 px muted, `text-subtle` icon (under-30-min rule, doorway bar warning, bodyweight default).
- **Notice:** sunken fill, radius md, 12 × 14 px padding, 14 px text (a session longer than usual, a week that never changes, a max test this week).
- **Dock note:** inline note placed above the dock's primary, stating the consequence before acting. *Info* tone: *En enregistrant, ton programme actuel sera marqué à mettre à jour. Tu choisis quand le refaire.* *Alert* tone (alert icon, bold lead, `role="status"`): when saving will need a new programme.

The wording for an outdated programme is the same everywhere: *à mettre à jour / out of date* in dock notes, toasts and the programme banner.

#### Banner

Card with a 1.5 px `line-strong` edge, 16 px padding: 48 px icon well (refresh), title 18 / bold (*Programme à mettre à jour*), one sentence on why, then a secondary action (*Voir le nouveau programme*) and a ghost dismiss below it. Sits at the top of the programme screen, under the app bar.

#### Why card

Shown once on the programme screen right after generation, above the week. Title, three reasons each led by the icon of the input it comes from (calendar = schedule, gauge = goal and level, user = equipment), then secondary *Toutes les raisons* (opens the sheet) and ghost *Compris*. Either action dismisses it for good; it collapses out (section 7.2).

#### Why line

18 px *why* glyph + 14 px muted text under a prescription, only when a choice is out of the ordinary (a fallback exercise, an easier or harder variant, an unloaded start). Ordinary choices get no line; the why icon button on every row opens the full reasons.

#### Nudge row

Card-sized row, ≥ 76 px, hairline edge, elevation 1: 48 px icon well (bag), bold title (*4 exercices adaptés faute de matériel*), 14 px muted sub (*Voir ce qu'il vaut la peine d'acheter*), chevron. Pressed: press overlay. Shown on the programme screen only when equipment is limiting the plan.

#### Toast

Inverse pill, min 56 px, elevation 3, 15 px semibold text, fixed 16 px above the bottom chrome (section 5.1). Text says what happened in the same words as the action (*Série 4 enregistrée*, *Séance mélangée*, *Matériel enregistré. Ton programme est à mettre à jour.*); optional ghost action (*Annuler*) in on-inverse, whose focus ring is drawn for the inverse surface. Stays 5 s when it has an action, 3 s otherwise; a new toast replaces the current one. Errors use the same toast with a leading stop icon and say what went wrong and how to fix it. `role="status"`.

#### Empty state

Left-aligned: a 48 px icon well, a title saying what is missing, one sentence on what to do, one primary button. No illustration. Example: *Aucune séance cette semaine / Lance une séance rapide ou démarre ton programme.* [Démarrer le programme]. Also used for screens not built yet (title + *Cet écran arrive bientôt.*, no button).

### 9.6 Programme and session

#### Week hero (programme screen)

14 px muted label (*Semaine*), then the week number in numeral 144 beside *sur 8* in numeral 48 muted; an 8-segment week bar (8 px; done, current, later as in the progress bar); the phase name in display 36 with one muted line on what it means. Below: the next session (14 px label, name in display 36, focus line, facts with icons: duration, exercise count, cardio finisher) and the primary *Commencer*.

#### Rotation grid

Weeks down, sessions across, phases bracketed on the right; a picture of the plan, not a control (`role="table"`).
- Columns: a 26 px week label (*S3*), then one 40 px column per session, then the phase column. Header: the letter in 21 heavy over **one short word** in 12 px (*Push, Pull, Jambes, Haut, Full*; *Cardio* under a heart glyph for the cardio day). The full session name is in the tooltip and in the session list below.
- Cells 36 px, radius sm: done = `complete` fill with a check; next = accent fill with its letter and a 2 px `accent-line` ring outside a 3 px bg gap; this week's later sessions = 1.5 px `line-strong` outline; future = hairline. Each cell has a spoken state (*Semaine 3 : prochaine séance*).
- The current week sits on a 48 px `accent-tint` band behind the row.
- Phase brackets: 2 px `line-strong` left edge spanning the phase's weeks, 13 px bold name; the current phase uses `accent-line` and `text`. Each bracket is a button (target extended into the row gaps) that opens the phase sheet.

#### Session row

64 px rows under the grid, hairline between them: 48 px sunken well with the letter in numeral 36 (or the heart glyph), name 18 / bold at title width, 14 px muted meta (*~45 min*), chevron. The way into any session. Pressed: press overlay.

#### Session hero (session detail, quick result)

Rotation letter in numeral 144 (or a 96 × 106 sunken tile with a glyph for the cardio day and quick sessions) beside a 14 px kicker and the session name in display 48 (36 for long names; balanced, never truncated). Then the muscles line, stats (numeral 36 + 21 px unit, 13 px label: duration, exercises, sets) and the equipment in use as a 14 px icon list.

#### Week ruler

The weeks of the programme as equal cells across the full width (each ≥ 48 px), 56 px tall, hairlines between, numeral 24. Selected = inverse fill; done weeks = `text-subtle`; the current week carries a 14 × 4 px `accent-line` bar at the bottom (on-inverse when selected). Phase names in 13 px bold sit under 2 px brackets spanning their weeks; the selected week's phase turns `text`. Radio group with arrow keys. Also used without interaction in the phase sheet, with the whole phase selected. Not shown on sessions that never change across weeks (the cardio day): a notice says so instead.

Under the ruler: the week title, a 13 px state label (*En cours*, or an outlined pill *Aperçu* when previewing), and one sentence naming what changed since the previous week (bold figures).

#### Disclosure card

64 px header: title 18 / bold + 14 px muted meta (*Échauffement · 6 min*) + chevron in a 48 px box. The body joins below, sharing the edge and radius. Collapsed by default for the warm-up. `aria-expanded` on the header; focus inset.

#### Prescription row

One exercise. Index in numeral 21 `text-subtle` · name 21 / bold at title width · 48 px why icon button on the right. Below: numeral cells at numeral M with a 21 px muted unit and a 13 px label under each (*séries × reps*, *kg par haltère*); a load that is a word (*Poids du corps*, *Élastique léger*) is set 21 px at display width instead. Then a 14 px facts line (rest, effort *2 reps en réserve*, tempo), an optional delta tag and an optional why line. Rows are separated by hairlines.

#### Group block (superset, circuit)

Index + title 18 / bold (*Superset, 3 tours*) + one muted rule line (*Enchaîne a et b, puis 60 s de repos.*). Items sit behind a 2 px `line-strong` left bracket, lettered a / b / c in 16 px, names 18 px, numerals 24.

#### Cardio and interval strips

- **Cardio strip** (steady): duration, speed, incline as numeral 36 cells with labels. On the cardio day the duration is the hero at numeral 60, the other two in a row below.
- **Interval strip:** rounds, work, recovery and total as numeral cells, then a rhythm of bars, 36 px tall: work = full height in `text`, recovery = 34 % in `text-subtle`, with a 13 px legend.

#### Delta tag

Inverse pill, 24 px tall, 13 px bold label: the change against the previous week (*+1 série*, *−2 séries*, *+4 min*). Pops in when the week changes.

### 9.7 Overlays

#### Sheet

Bottom sheet: raised surface, top radius xl, grabber 40 × 5 px, elevation 3, scrim behind, max 90 % of the height (the body scrolls). Content: title, one-line purpose, controls, one primary action, optional destructive outline at the bottom with a one-line explanation. Closes on scrim tap, grabber drag or back; focus moves into the sheet and returns to the opener.
- **Footer:** when a sheet has actions and long content, they sit in a sticky footer on the raised surface with a hairline top edge, flush with the sheet edges and padded for the home indicator (*Utiliser cette variante* / *Garder l'actuelle*).
- Sheets in use: why this programme, why this exercise, phase, another variation, new programme.

#### Dialog

Confirmations: same raised surface, centred, max 24 rem, radius xl; title, one sentence, then two full-width buttons stacked (primary or destructive on top, secondary *Annuler* / *Revenir au profil* below). The confirm button can show the loading state.

#### Menu

Popover from an icon button: 300 px (narrower screens: full width less 24 px), raised surface, hairline edge, radius lg, elevation 3, 6 px inset. Items 56 px: 24 px icon, label, optional 14 px muted hint line (*Garde ta semaine et ton historique*); hairline separators between items. `role="menu"`; focus goes to the first item; Escape or a tap outside closes it and returns focus to the button.

#### Change list (another variation, new programme)

Count headline: numeral 96 + display 36 (*7 / exercices changent*); a "what stays" line with a check (*Même découpage, mêmes durées. Tu restes en semaine 3.*). Changes grouped by session (14 px muted session name). Each change: old name (15 px muted) above new name (18 px bold) joined by a rail: hollow 10 px dot → 2 px `line-strong` line → solid 12 px dot. Added rows show only the new name (solid dot), removed rows only the old (hollow dot). **Empty:** *Aucune autre variante pour l'instant* and one sentence (more equipment opens other options); no primary.

#### Session compare

When the split itself changes (3 → 4 days), the change list becomes a before / after: two columns (*Aujourd'hui* / *Nouveau*) of 40 px letter tiles (sunken; new sessions inverse) with session names, under a count (*4 séances au lieu de 3*).

#### Reason groups (why this programme)

One group per input: 40 px icon well + the input in bold (*3 jours, 45 min*) over a label (*Ton planning*), then the reasons as a list behind a 2 px bracket.

### 9.8 Full-screen states

#### Generating screen

No actions, no bars. Numeral 144 *8* + *semaines*, an 8-segment bar, title in display 36, then four steps: done = check, current = spinner, later = dot. Shown only when generation takes longer than 300 ms, then kept at least 800 ms so it does not flash. `role="status"`.

#### Player stand-in

Until the workout player exists, *Commencer* leads here: a context bar with close and the session name, an animation-slot placeholder (300 px) holding the first exercise (tag *Premier exercice*, name, *5 × 8–10* and the load in numerals), a title (*Le lecteur de séance arrive bientôt*) and one sentence, and a 64 px *Revenir à la séance* in the dock.

#### Progress before data

Display title, then a ghost of the chart that will fill in (axes and week labels only, no data), a title and sentence saying what will appear, and *Voir la prochaine séance* in the dock.

### 9.9 Workout player

#### Timer ring

Track `--color-track` and progress `--color-accent-line`, 20 px stroke, butt caps, starting at 12 o'clock and draining clockwise. Centre: seconds in compact timer size, unit word below. Diameter as large as the width allows (340 px on a 390 px screen). States: running, paused (digits muted, "En pause / Paused" under the number, ring stops), finished (ring empty, digits replaced by the next action for 1 s). It never shows minutes for rests: rests are whole seconds (≤ 3 digits).

#### Tempo indicator

Three segments sized to the tempo (2-1-2 → 2fr 1fr 2fr): phase name (13 px) over seconds (21 px). Active phase: accent fill. Optional rep counter tile (inverse) on the right. Paced by the same clock as the tempo audio.

#### Animation slot (placeholder)

Reserved for the future exercise animation. Keep the slot's size and position stable now, so the layout does not change when animations arrive.
- Container: radius lg, radial gradient from `surface-raised` to `surface`, hairline edge. Aspect free; min 96 px tall in the scoreboard player, 200–280 px in the instrument player, 300 px on the player stand-in, 72 × 72 thumbnail for "next".
- Content until animations exist: a perspective floor (hairlines converging to a vanishing point), the equipment glyph at 76 px in `text-subtle`, a movement-pattern tag ("Poussée horizontale"), and the exercise's key cue ("Coudes à 45°, omoplates serrées"). So the placeholder is still useful, not decoration.
- Overlays (tempo, rep counter) sit at the bottom edge; the cue moves to the top when overlays are present.
- States: placeholder (above), loading (floor and tag only), playing (later), unavailable (placeholder without cue). `role="img"` with the exercise name as its label.

---

## 10. Workout player

Two variants were mocked; **A (scoreboard) is the one to build**, with a setting that swaps the yellow rest takeover for the ring timer. Both use the same top bar (pause, "exercise n of N" with segmented progress, elapsed time, voice toggle) and the same tokens.

| | A: Scoreboard (`player-a.html`) | B: Instrument (`player-b.html`) |
|---|---|---|
| During a set | Name 48 px, set 2/4, reps 8–10 and 14 kg at 96 px, tempo strip, smaller animation slot. | Large animation stage with tempo and rep counter overlaid, name 44 px, set/reps/load row at 60 px. |
| Logging | Feel segmented (default *Idéal*) + one big "Fait comme prévu / 10 reps à 14 kg". Adjusting goes through the edit button → sheet with steppers and "Arrêter cet exercice". | Steppers always visible + three log buttons: *Plus facile*, *Comme prévu*, *Plus dur*. Any one tap logs the set with that feel. |
| Rest | Full-screen yellow takeover: 288 px seconds, draining bar, ink card for next exercise, −15 s / +15 s / Passer at the bottom. | Dark screen with a 340 px ring and 192 px seconds, −15 s / Passer / +15 s, next-exercise card, "logged" toast with undo. |
| From 2 m | Best: the screen colour alone says work or rest; the numerals are biggest. | Good; the numbers are smaller, but the ring is a familiar timer. |
| Logging speed | One tap if as planned; two taps plus a sheet when values differ. | One tap even when the feel differs; adjusting reps or load is inline. |
| Future animations | Slot is small; animation is secondary. | Slot is the hero; ready for animations. |
| Risk | The yellow takeover is very bright in a dark room. | Busier set screen; side buttons are smaller targets. |

---

## 11. Mockups

| File | Shows |
|---|---|
| `mockups/setup-onboarding.html` | Onboarding steps 1–3 and 5: goal chosen; level with Continue tapped and nothing chosen (error); schedule at the defaults (3 × 45), with five sessions (longest names) and under 30 minutes (full-body note); bodyweight left empty with the summary; bodyweight typo caught; the generating screen. |
| `mockups/onboarding-equipment.html` | Onboarding step 4: nothing ticked (bodyweight only, live count); adjustable dumbbells with min / max / step and the load ruler, plus bands; fixed weights filled and kettlebells ticked with no weight (error); doorway pull-up bar with unknown rating and bench; treadmill with no incline; household items at the end of the list. |
| `mockups/setup-equipment-editor.html` | My equipment with settings summarised; what to buy while computing; top 3 purchases; show all, with the items that change nothing; after "I own this" (settings open, undo toast, save note); nothing to suggest. |
| `mockups/setup-settings.html` | Settings tab; "New programme" confirmation; Profile unchanged (Save disabled); 4 → 3 days (alert dock note); Save tapped → new-programme dialog; 45 → 30 minutes (out-of-date note); back in Settings with the saved toast. |
| `mockups/programme-overview.html` | Week 3 before session A; right after generation with the one-time why card; the what-to-buy nudge; the out-of-date banner; the rotation grid with the cardio-day column and the session list; the options menu; the phase sheet. |
| `mockups/session-detail.html` | Session A, week 3 (longer-than-usual notice, warm-up collapsed, +1 set tags); further down: superset, max sets, steady cardio finisher; previewing week 8 (no Start); session D circuits; bodyweight week 1 with the warm-up open; inline why lines; the cardio day (no week ruler); the why sheet for one exercise. |
| `mockups/programme-sheets.html` | Why this programme (reasons grouped by input); another variation (change list); new programme after adding a pull-up bar; new programme when the split changes (3 → 4 days, session compare); no other variation. |
| `mockups/quick-session.html` | Launcher defaults; launcher at 20 min, push, bodyweight only; result after Shuffle with the undo toast; result scrolled to an interval finisher; cardio focus (intervals). |
| `mockups/programme-placeholders.html` | The player stand-in behind "Start"; the Progress tab before any data; session detail loading (skeleton). |
| `mockups/player-a.html` | Player variant A: during a set, during rest, adjusting a set. |
| `mockups/player-b.html` | Player variant B: during a set, during rest. |

Each page has FR/EN and dark/light toggles. Pages also accept `?lang=en` and `?theme=light|dark`; with no theme set they follow the system. Every frame is 390 × 844.

Where a mockup and the built screen differ, this document describes the built screen.
