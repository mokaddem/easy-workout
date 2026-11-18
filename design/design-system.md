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
6. **A change shows its new value and its why.** When the plan moves, the next value is the figure (the old one small beside or above it) and the reason uses the same words on every surface: the summary row, the session-detail why line and, shorter, the player chip.

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
| `--figure-limb` / `-body` / `-limb-far` / `-far` | chalk / graphite 300 / 400 / 500 | graphite 700 / `#5E6474` / `#727888` / `#848A99` | The exercise figure: a contrast ladder (9.12) |
| `--figure-prop` / `-prop-far` | graphite 400 / 500 | `#727888` / `#848A99` | Dumbbells, towel, handles held by the figure |
| `--figure-shadow`, `-floor`, `-door`, `-cut` | graphite 900 at 70 %, `line`, `surface-sunken`, `surface-raised` | graphite 100, `line`, graphite 100, `surface-raised` | Contact shadow, floor hairline, fixed scenery, the gap drawn around each part (must equal the surface behind the figure) |

**Why `--color-accent-line` turns to ink in light mode:** yellow on white is 1.4:1, which fails the 3:1 rule for graphics. In light mode the yellow stays as a fill (buttons, next, active tempo phase) and strokes become ink. The light rest ring reads like a stopwatch.

### 3.3 Usage rules

- **Accent:** at most one primary button per screen. Selected chips, check boxes, segmented options and the current tab use **inverse**, not yellow.
- **Done vs next vs later:** done = `complete` fill with a check (recedes); next = accent fill with a 2 px accent-line ring; this week's later items = strong outline; future = hairline outline.
- **Where yellow appears** (the full list; anything else is a bug): the screen's one primary action (Start, Done, *Reprendre* on the resume banner, the summary's dock button), the next session cell, the current set segment and current item tile ring (`accent-line`), the active tempo phase while pacing, the rest takeover, interval recovery, and the incoming tile of the side-switch pause. Work clocks (hold, interval work, steady cardio) stay on the base colour, so from 2 m the screen colour alone says work or rest. Adaptation surfaces add no yellow: answer rows are outlined, change tags are outlined, the decisions nudge uses an inverse well.
- **The exercise figure is never yellow**, not even the working limb: emphasis on the figure is contrast only (9.12). On yellow the figure turns to ink.
- **Red** only for destructive actions and pain: the pain well (danger tint + stop glyph), the word *Douleur / Pain* in a kicker or done line, the stop glyph of the pain chip and the pending-pain line, the Abandon row. A second pain is not escalated to red: the care note is neutral. Warnings that destroy nothing (backup due while storage was refused, storage not granted) use the **firm** treatment (2 px `text` edge, inverse well), never red.
- **No green.** "Done" is a check on a neutral `complete` fill, so the screen never turns into a traffic light. Up and down are arrows (`arrow-up`, `arrow-down`, `step-up`, `step-down`), never colour.
- **Feel (easy / right / hard)** has no colour coding. Selection is shown by an inverse fill; "pick one" by an outline (segmented ask state).

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
| figure limb / body / limb-far / far on the slot (surface-raised) | 14.1 / 7.1 / 5.3 / 3.1 | 11.7 / 5.9 / 4.4 / 3.5 | 3 (graphics), every step |
| figure on yellow: limb / body / limb-far / far | 11.9 / 6.8 / 5.0 / 3.3 | same | 3 (graphics) |

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

- Numbers through `Intl.NumberFormat`: `2,5 kg` in French, `2.5 kg` in English (`numberText` in `src/features/adapt/format.ts`).
- French puts a **narrow no-break space (U+202F)** before `: ; ? !` and `%` (`15 %`, `Série faite ?`, `Remplace : …`). English puts none (`15%`). Never a plain space, never U+00A0 there.
- **No-break space (U+00A0)** before units (`14 kg`, `90 s`, `12 km/h`) and after *au-delà de* / *vers* before a range (`au-delà de 8–12`, `vers 8–10`), so a number never starts a line on its own. The format helpers build units this way (`kgText`, `secondsText`); a string that puts a unit after a placeholder carries the no-break space itself.
- Ranges use an en dash without spaces: `8–10`. On the player's unit line the dash is wrapped in word joiners (U+2060, `unbreakable` in `src/features/play/format.ts`) so a range never breaks. Multiplication uses `×`: `3 × 8–12`. Negative changes use the minus sign U+2212 (`−2 kg`), not a hyphen.
- **Exercise names never follow a French article or preposition.** There is no gender or elision data, so *à Pompes*, *du Rowing* or *de l'…* cannot be written correctly. Names appear as titles, after a colon (*Remplace : Développé militaire debout*), at the start of a sentence (*Traction pronation est dans ta prochaine séance.*), or as `{name} à la place` / `{name} instead`. Lower-casing a name to fit it into a sentence is the same mistake.
- Emphasis inside a localized string is `<b>…</b>`, rendered by `Rich` (`src/features/adapt/Rich.tsx`) or `Trans`; nothing else is interpreted. Bold sets the value in `text` colour inside a muted line (in danger text for the pain word).
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
| `--radius-lg` | 20 px | Cards, figure slot, how-to stage, rest card |
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
| Switch | The knob slides (and grows 16 → 22 px) over `fast`, `move`; a meta line that states the consequence cross-fades over `fast`. |
| Item or side change | The tile fill moves to the next tile over `fast`, `move`. |
| Side-switch pause | The incoming tile scales from press scale and fills over `base`, `snap`; the count digits roll. |
| Lead-in (timed hold) | Each digit rises `distance-sm` and fades in over `fast`, `snap`; lead-in → running cross-fades over `base`. |
| Interval phase change | The background floods from the clock like the takeover (`flood`, `snap`); the clock digits stay put. |
| Goal reached, hold done | The check draws in over `fast`; the button's colour change runs over `base`, `move`. No punch: not an achievement. |
| Pause screen | Cross-fade over `base`. |
| Summary entrance | The screen cross-fades in over `slow`; the duration, stat and next-time figures roll once (digit roll); the set strip is revealed left to right in one sweep over `base`, `linear`, after the cross-fade. No punch: it belongs to the set just logged. |
| Answer → confirmed | The proposal card's content cross-fades and its height animates (card expand); the check draws in over `fast`. Undo reverses it. No punch. |
| Decisions nudge | The count rolls; at 0 the row collapses (`base` × 0.7, `exit`) and the equipment nudge moves back above the next session (`base`, `move`). |
| Banners and notices | Resume and backup banners arrive with the screen and leave with the dismissed-card collapse. The import success notice opens with height + fade and rises `distance-sm` over `base`, `snap`. |
| Why chip | Arrives and leaves with its set screen; the feel ask outline never animates. |
| Figure arrives | The figure's code loads on demand: the slot shows its floor, then the figure fades in over `base`, `move`. No rise, no scale. |
| Figure loop | Driven by its own clock at a neutral pace, or by the tempo pacer while pacing is on (the pacer's phase, never the reverse). One figure moves on screen at a time: thumbnails and the "next" tile are stills. |
| Side 2 | The mirrored figure cross-fades in over `fast` when the side switch pause ends. No flip. |
| Interval phase change | The figure freezes on its key pose over `fast` (cross-fade) when recovery starts and loops again when work starts. |
| How-to sheet | The sheet motion; its figure starts at the slot's current moment, so the movement continues rather than restarts. The slot's figure freezes while the sheet is open and resumes in step when it closes. |
| Rest band (how-to sheet) | Its seconds pulse with the takeover's last 3 seconds. At 0 the sheet leaves at 70 % of `slow`, `exit`, with the end-of-rest beep. |

Punch is for achievements only: never on routine taps or navigation.

### 7.3 Reduced motion

`prefers-reduced-motion: reduce` overrides the tokens: travel distances and press/punch scales become 0 / 1, overshoot becomes `--ease-move`, durations shrink to cross-fades of 100–160 ms. The takeover and the interval flood become 160 ms colour cross-fades. The timer ring and every clock still run (they carry information) but the last-3-seconds pulse is replaced by a colour change only. The switch knob changes colour in 100 ms without travelling. Adaptation surfaces drop height animation and digit rolls: the confirmed card and the figures appear in place. The exercise figure shows its key pose, still, everywhere (slot, how-to, thumbnails); the how-to offers *Lire l'animation* so motion only ever starts from a tap. Components that read the tokens get this for free; anything driven from script must read them too. Script-driven motion runs through one provider that, under reduced motion, drops transforms and keeps opacity and colour changes.

---

## 8. Iconography

- 24 × 24 grid, 2 px stroke, round caps and joins, no fills (except status glyphs). 20 px in chips and facts, 28 px in equipment wells.
- Drawn in-house as inline SVG symbols.
  - Actions and navigation: back, close, chevron (right and down), plus, minus, check, play, pause, skip, sound, shuffle, swap, refresh, pencil, sliders, stop, download, upload, arrow-up, arrow-down, arrow-right, expand (two corner arrows: open the how-to).
  - Meaning: calendar (schedule), gauge (goal and level), user (profile), bolt (quick session), chart (progress), clock (not now), hourglass (session left open, break notice), list, flag (finish now), heart (cardio day), incline, person running, bag (what to buy), info, alert, why, shield / shield-check (lasting storage), file (backup file), step-up / step-down (harder / easier variant), equals (unchanged, keep as is), turtle (slower tempo).
  - Equipment: dumbbell, kettlebell, band, mini-band, belt, vest, pull-up bar, dip bars, bench, treadmill, bike, rower, jump rope, ab wheel, suspension straps.
- Paths live in `src/ui/components/iconPaths.tsx`. "Voice off" is not a separate glyph: the sound icon turns `text-muted` and gets a 26 × 2.5 px slash drawn in CSS, cut out by a 2 px ring in the background colour (rest yellow on the takeover).
- Icons never stand alone for unfamiliar actions: icon buttons carry an accessible label, and in the player only pause, sound, edit and skip are icon-led.

---

## 9. Components

States covered for each: **default, pressed, disabled, focus, error, empty, loading** where they apply. Focus is always `--focus-ring` (2 px bg gap + 2 px focus colour), visible on any surface including yellow; inside cards and full-width rows it is drawn inset (2 px `--color-focus`) so it is never clipped. On the rest takeover the ring is ink. "Pressed" means the press overlay unless a press scale is stated.

| Group | Components |
|---|---|
| 9.1 Core controls | Button (incl. inverse), icon button, stepper (hero, word value, load ruler), segmented control (2 × 2, tall, compact pair, view tabs, ask state), chip, check box, switch and switch row, card, list row, progress bar, set strip, skeleton and spinner |
| 9.2 Shell | App bar, context bar, step bar, dock, tab bar |
| 9.3 Choices and numbers | Choice card and choice tile, large numeric field, live counter, split preview |
| 9.4 Equipment | Equipment card, weight grid, purchase card, cost badge, computing state |
| 9.5 Notes and messages | Note (inline, notice, dock note, pending note, care note), banner (incl. firm), resume banner, backup line, why card, why line, nudge row (incl. decisions nudge), toast, empty state |
| 9.6 Programme and session | Week hero, rotation grid, session row, session hero, week ruler, disclosure card, prescription row, goal ruler, change tag, swap line and pending-pain line, group block, cardio and interval strips, delta tag |
| 9.7 Overlays | Sheet (with pinned footer), how-to sheet, dialog, menu, change list, session compare, reason groups, leave sheet, stop view, decisions sheet, import sheets and comparison table |
| 9.8 Full-screen states | Generating screen, session summary, pause screen, progress before data |
| 9.9 Workout player | Top bar and voice toggle, score, item and side tiles, next-up row, side-switch pause, big clocks, interval segments, reps-done stepper, timer ring, tempo strip, figure slot, why chip |
| 9.10 Adaptation | Proposal card (answer row, confirmed state), per-exercise list |
| 9.11 Settings and data | Rest-screen picker, last-backup block, storage status card, import success notice |
| 9.12 Exercise figure | Figure, figure tones, thumbnail, "next" tile, framing rules |

Where the build departs from the screen's design notes, the entry says so under **Built differently**.

### 9.1 Core controls

#### Button

| Variant | Default | Pressed | Disabled |
|---|---|---|---|
| Primary | accent fill, ink label | `accent-pressed`, scale 0.97 | sunken fill, disabled label |
| Secondary | transparent, 1.5 px `line-strong` outline | press overlay | outline removed, disabled label |
| Ghost | text colour, 2 px underline | press overlay | disabled label, no underline |
| Destructive | `danger` fill, `on-danger` label (confirmations) | `danger-pressed` | as primary |
| Destructive outline | `danger-text` outline and label (in-flow stops) | danger tint | as secondary |
| Inverse | `surface-inverse` fill, `on-inverse` label, 21 px | press overlay | n/a |

- **Inverse** exists for one place: *Passer* on the ring rest, where the ring already carries the accent; it mirrors the ink button on the yellow takeover. **Built differently:** it is a player style (`.ringSkip` in `src/features/play/Play.module.css`), not a `Button` variant. Promote it only if a second use appears.

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
- **Ask state** (`ask` prop): nothing selected (`value` null) and a 1.5 px `line-strong` outline drawn inside the track's edge; the group's accessible name becomes *Ressenti (à choisir) / Feel (pick one)*. Used for the feel on every set of an exercise's first session at a new load, so the answer is a real pick rather than the default. Picking an option removes the outline. The primary stays enabled; logging without a pick is allowed (and counts as untouched). No animation on the outline.

#### Switch and switch row

`SwitchRow` in `src/ui/components/Switch.tsx`. An on/off setting or decision that applies at once. The switch never appears alone: the whole row is the target.
- **Row:** full-width button, `role="switch"` + `aria-checked`; title 17 / 600, meta 14 px muted, switch on the right; min 64 px; hairline divider inset 16 px between rows. **Large** (a decision that owns a card, *Compter comme faite*): 76 px, title 18 bold at title width, meta 15 px.
- **Switch:** 52 × 32 pill, 2 px edge. Off: `surface-sunken` track, `line-strong` edge, 16 px `text-muted` knob on the left. On: inverse track and edge, 22 px `on-inverse` knob on the right. Size and position both change, so the state never depends on colour.
- **States:** pressed = press overlay; focus = inset ring; disabled = `aria-disabled` (still focusable so it can be read), dashed `text-disabled` edge and knob, and the meta says why (*Pas disponible sur ce téléphone*). The meta may state the consequence and change with the state (*Ta rotation passe à la séance B.* / *La séance A te sera reproposée la prochaine fois.*).
- Do: settings that act immediately (voice, beeps, vibration), the summary's counts-as-done. Don't: exclusive choices (segmented) or anything that needs a confirmation.

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

#### Set strip

`src/ui/components/SetStrip.tsx`. A picture of a session's main sets: one bar per planned set, grouped by exercise or group (3 px inside a group, 7 px between groups, each group as wide as its share of sets). 10 px tall (6 px `small`, in the resume banner), radius 2. Done = `text`, not done = track; warm-up and finisher are not counted. Decorative (`aria-hidden`): the text beside it carries the numbers (*9 séries sur 23*). Not a progress bar: there is no current set and no yellow.

#### Skeleton and spinner

- **Skeleton:** `surface-sunken` blocks at the size of the content they stand for, radius sm (or the radius of the real element), no shimmer. Session detail and the programme screen load this way.
- **Spinner:** 20 px (24 in headings), 3 px stroke in `currentColor`: a 25 % track and a quarter arc. Decorative; the text next to it says what is happening.

### 9.2 Shell

Layout rules in section 5.1.

#### App bar

Sticky top, `--color-bg` fill, `--z-sticky`. Optional back icon button (48 px; the left padding drops to 8 px), title 21 px bold at title width with an optional 14 px muted meta line, trailing icon buttons (the programme's options menu).

#### Context bar

For screens whose real title is a big heading in the content: a back icon button (session detail, quick result), or no button at all on the session summary (it has one way out, its dock button), and a 14 px muted context line on one line with an ellipsis (*Séance A — Push*, *Semaine 3 · Volume*). Min 56 px. No title element: the content's display heading is the page title.

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
- **Pending note** (proposal card, pain): inline note in `text` colour with a muted `arrow-down` glyph and bold values, saying what already applies while no answer is given (*Prochaine séance : **8 kg au lieu de 10 kg** tant que tu n'as pas choisi.*).
- **Care note** (proposal card, second pain on the same exercise only): notice look with 600 weight, `text` colour and the info glyph in `text`: *Si la douleur persiste, consulte un professionnel de santé.* Never red, never an action.

The wording for an outdated programme is the same everywhere: *à mettre à jour / out of date* in dock notes, toasts and the programme banner.

#### Banner

Card with a 1.5 px `line-strong` edge, 16 px padding: 48 px icon well (refresh), title 18 / bold (*Programme à mettre à jour*), one sentence on why, then a secondary action (*Voir le nouveau programme*) and a ghost dismiss below it. Sits at the top of the programme screen, under the app bar.
- **Backup reminder:** download glyph, *Sauvegarde tes données*, the backup's age, full-width secondary *Exporter une sauvegarde* (exports in place, then the banner leaves and the toast *Sauvegarde exportée* shows) and ghost *Plus tard*.
- **Firm:** for warnings that destroy nothing but matter: 2 px `text` edge, inverse icon well. The backup reminder turns firm when lasting storage was refused (shield glyph, *Tes données peuvent être effacées*). Never red.
- **Priority on the Programme tab:** resume banner > out of date > backup reminder. At most the resume banner plus one other; the backup reminder waits.

#### Resume banner

`src/features/play/components/ResumeBanner.tsx`. An open session at the top of the Programme and Quick tabs. It holds the screen's only primary: while it shows, the tab's own start buttons turn secondary.
- Anatomy: banner head (pause glyph in the well, *Séance A — Push en pause*, where it picks up), a `small` set strip with a 14 px line (***9** séries sur 23* · *commencée à 18:05*), a 64 px primary *Reprendre* with the play glyph, and two ghosts spaced apart: *Terminer maintenant* (straight to the summary) and *Abandonner* (destructive dialog).
- **Left open over 12 h:** hourglass glyph, *Séance A — Push restée ouverte*, the start day and time, active minutes instead of the start time, a 56 px primary *Terminer (garder les séries)* with the check glyph (loading while it saves); *Reprendre* and *Abandonner* become the ghosts.
- `aria-labelledby` its title. The same three verbs (*Reprendre / Terminer maintenant / Abandonner*) are used in the player and the banner.
- **Built differently:** the pick-up line reads *Reprend à {exercice}, série 2.* with the name lower-cased after *à*, which breaks the exercise-name rule (4.4). Use *Reprise : Pompes serrées, série 2.*

#### Backup line

`BackupLine` in `src/features/settings/BackupBanner.tsx`. The summary's one-line reminder, shown only when a backup is due and never on a screen that already shows the banner. Sunken row, radius md: 20 px download glyph, 14 px text with the age in bold (*Dernière sauvegarde il y a **34 jours**.*), secondary *Exporter*. Firm: 2 px inset `text` edge, glyph in `text`. Busy: spinner in the button. A cancelled share sheet shows a 3 s toast (*Export annulé : aucun fichier enregistré.*, or *… Ta dernière sauvegarde date toujours de 34 jours.* when one was due). **Built differently:** the button is the standard 56 px secondary on the sunken fill, not 48 px on `surface`.

#### Why card

Shown once on the programme screen right after generation, above the week. Title, three reasons each led by the icon of the input it comes from (calendar = schedule, gauge = goal and level, user = equipment), then secondary *Toutes les raisons* (opens the sheet) and ghost *Compris*. Either action dismisses it for good; it collapses out (section 7.2).

#### Why line

20 px *why* glyph in `text-muted` + 14 px text in `text` colour under a prescription. Two sources, one look:
- **Generation:** when a choice is out of the ordinary (a fallback exercise, an easier or harder variant, an unloaded start). Ordinary choices get no line; the why icon button on every row opens the full reasons.
- **Progression** (`WhyLine` in `src/features/programme/AdaptLines.tsx`): the evidence then the reason, *La dernière fois, 5 × 10 reps à **10 kg**. Haut de la fourchette : un cran au-dessus, objectif 8 reps.* Shown when the prescription moved, or held for a reason worth knowing (a miss, pain). Hidden while a pending-pain line says it already. Copy comes from `noteDetail` (`src/features/adapt/format.ts`), which shares its reasons with the summary row and the player chip.

#### Nudge row

Card-sized row, ≥ 76 px, hairline edge, elevation 1: 48 px icon well (bag), bold title (*4 exercices adaptés faute de matériel*), 14 px muted sub (*Voir ce qu'il vaut la peine d'acheter*), chevron. Pressed: press overlay. Shown on the programme screen only when equipment is limiting the plan. When some exercises have reached the top of the owned kit, they count into the same row (*6 exercices limités par ton matériel*); the summary closes its list with the same row (*Curl marteau est au maximum de ton matériel*).
- **Decisions nudge** (`DecisionsNudge` in `src/features/programme/Decisions.tsx`): the well is inverse and holds the count in numeral 36; title *Choix à faire*; the sub names the exercise in the next session first (*Traction pronation est dans ta prochaine séance.*), else up to two names (*Pompes, Pompes en V et 1 autre*, via `Intl.ListFormat`). The accessible name carries the count. It sits between the week hero and the next-session card; while it shows, the equipment nudge moves below the next-session card, so only one row ever sits above Start. Opens the decisions sheet.

#### Toast

Inverse pill, min 56 px, elevation 3, 15 px semibold text, fixed 16 px above the bottom chrome (section 5.1). Text says what happened in the same words as the action (*Série 4 enregistrée*, *Séance mélangée*, *Matériel enregistré. Ton programme est à mettre à jour.*); optional ghost action (*Annuler*) in on-inverse, whose focus ring is drawn for the inverse surface. Stays 5 s when it has an action, 3 s otherwise; a new toast replaces the current one. Errors use the same toast with a leading stop icon and say what went wrong and how to fix it. `role="status"`. Stopping an exercise shows no undo toast: the stop view's confirmation is the safeguard.

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

Once progression has run, a programme row shows **the goal, not the range** (`src/features/programme/Blocks.tsx`):
- Reps cell: `sets × goal` (*5 × 6*), label *séries × reps visées*, with the goal ruler under it. Timed holds: `sets × goal s`, label *séries × durée visée*.
- **Per-set goals** (intensity and peak weeks, when set 1 asks for less in reserve): *10 + 3 × 9*, label *série 1 + les suivantes, reps*; the facts line adds *Série 1 : **1 rep** en réserve, puis 2*. The ruler shows the later sets' goal.
- The facts line starts with the change tag, then the delta tag.
- Below the facts, in this order: the why line, the pending-pain line, the swap line.
- Quick sessions keep the range: they have no progression.

#### Goal ruler

`src/features/adapt/GoalRuler.tsx`. Where the goal sits in the range, at a glance. Inline: min label, bars, max label, in 13 px bold muted at label width with tabular figures. One 10 × 8 px bar (radius 2, 3 px apart) per value of the range, filled `text` up to the goal, the rest `track`.
- **Under the range** (first sessions after a load step): hollow bars (1.5 px inset `line-strong`) from the goal up to min − 1 sit before the min label; those up to the goal are filled.
- **Past the range** (no heavier load to go to): hollow bars after the max label, up to max + 4; filled up to the goal.
- **Timed holds:** one bar per 5 s; the max label carries *s*.
- Decorative: a visually hidden label carries the value (*objectif 6 reps, fourchette 8 à 10*).
- **Built differently:** the bars outside the range are solid hollow outlines, not dashed, and bands get the same 4-value reach as everything else (the note asked for 2).

#### Change tag

`src/features/adapt/ChangeTag.tsx`, data from `changeTag` in `format.ts`. What moved since the last time, on a prescription row. Outline pill, min 24 px, 1.5 px `line-strong`, 13 px bold at label width; 14 px glyph (stroke 2.5): `arrow-up` / `arrow-down` + the amount (*2 kg*, *1 rep*, *5 s*), `turtle` + *Plus lent*; words for bands (*Plus fort*, *Plus léger*; assisted: *Moins d'aide*, *Plus d'aide*) and *Lest* for a first added load. Screen readers hear *En hausse : / En baisse :* first.
- One tag per row, the most telling change: load, then tempo, then goal.
- Don't confuse it with the **delta tag** (inverse fill), which compares this week with the previous one in the plan. Change = outline = what you did changed it.

#### Swap line and pending-pain line

`SwapLine` and `PendingPainLine` in `src/features/programme/AdaptLines.tsx`. A sunken block (radius md, 12 × 14 px padding) under the why line: a 20 px glyph + 14 px text with bold names or values, then a secondary button sized to its label on `surface`.
- **Swap line:** swap glyph in `text-muted`. *Remplace : **Développé militaire debout**, après la douleur du 12 novembre.* (variants: until the band is no longer needed, your choice on a date; *Première fois : charge de départ.* is appended on its first session). Button *Revenir à l'original* opens a dialog that names the original with its load and goal (primary *Revenir à l'original*, secondary *Annuler*); it is the only answer that asks for confirmation, because it can undo a pain swap.
- **Harder variant that missed:** same line, *Plus dur que prévu : sous 8.* and the way back.
- **Pending-pain line:** stop glyph in danger text. *Douleur la dernière fois : **14 kg au lieu de 16 kg** tant que tu n'as pas choisi.* Button *Choisir* opens that exercise's proposal card in a sheet.
- **Built differently:** the button is the standard 56 px secondary (the note asked for 48 px). The harder-missed copy ends *Tu peux revenir à {exercice}.*, a name after *à*: rewrite as *Plus dur que prévu : sous 8. L'original reste disponible.*

#### Break notice

A notice (hourglass glyph) under the session hero after a long gap: *Bon retour. 23 jours depuis ta dernière séance : objectifs 2 reps plus bas, mêmes charges.*; past four weeks the loads restart one step lower; past three months the first session recalibrates the loads.

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
- **Pinned footer** (`footer` prop of `src/ui/components/Sheet.tsx`): the sheet's actions sit outside the scrolling body, on the raised surface with a hairline top edge, flush with the sheet edges and padded for the home indicator. Only the body scrolls. Rule: **every sheet with actions uses the footer**, so the actions never scroll out of reach. Buttons are full width and stacked, primary on top (*Utiliser cette variante* / *Garder l'actuelle*).
- Sheets in use: how-to (below), why this programme, why this exercise, phase, another variation, new programme, adjust set (with the stop view), leave the session, import preview, import error, decisions, a single decision (from session detail).

#### How-to sheet

How to do an exercise: the figure large and looping, the key cue, the numbered execution steps. Opens from every place an exercise is shown (9.12, entry points). A sheet with a pinned footer, max 90 % of the height.
- **Order:** grabber → (in the player during a rest: the rest band) → header: name in title 24 (balanced) + 48 px close, then a 14 px / 600 muted line *pattern, equipment* (*Poussée horizontale, poids du corps*) → **stage** → controls → body (scrolls) → footer.
- **Stage:** 16 px from the sheet edges, 236 px tall (184 px on screens under 700 px), radius lg, `surface` with a hairline edge; `--figure-cut` is set to `surface`. The figure loops at the slot framing. The stage and controls stay put; only the body scrolls, so the figure is in view while reading every step.
- **Controls** (row under the stage, 48 px): *Pause / Lire* (outline, glyph + word; the loop can always be stopped) on the left; on the right a compact segmented *Normal / Lent* (half speed). In the player while the tempo pacer runs, the segmented gives way to a muted line *Suit ton tempo **2-1-2***: the figure moves with the pacer. Under reduced motion: the key pose and one button *Lire l'animation*.
- **Body:** the key cue at 18 / 600 behind a 2 px `text` bracket, then the steps as an ordered list: the number in numeral 24 `text-subtle` (28 px column), the step at body 16 / 1.5. Steps are a real sequence, so they are numbered. The longest entry (645 characters over 4 steps) scrolls under the stage at 390 × 844; nothing is truncated.
- **Footer:** the row's own action when the sheet came from a row that has one, so a tap on the picture by mistake is never a dead end: picker → the picker's verb as primary (*Ajouter au bloc principal*, *Remplacer*) + secondary *Fermer*; everywhere else a single secondary *Fermer* (64 px in the player).
- **In the player:** nothing pauses. The sheet covers the dock, so logging waits until it closes, but the clocks, voice and beeps keep running. While a rest runs, a **rest band** tops the sheet: yellow, *Repos* 18 / 700 on the left, the seconds in numeral 48 + *s* on the right, a 4 px draining bar along its bottom edge (`rest-track` / `on-rest`); the grabber sits on it. The sheet **closes itself when the screen under it changes**: the rest ends, a hold or interval phase ends, the side switches. Then the screen underneath is what the beep refers to.
- **Inside another sheet** (Test now): the how-to replaces the sheet's content like the stop view, with a back icon before the name and *Choisir cet exercice* as the footer primary.
- Accessible: `role="dialog"` with the exercise name; the stage is `role="img"` (*Démonstration animée : Pompes* / *Position clé : Pompes*); the rest band is `role="timer"` and speaks only at its end, as the takeover does.

#### Dialog

Confirmations: same raised surface, centred, max 24 rem, radius xl; title, one sentence, then two full-width buttons stacked (primary or destructive on top, secondary *Annuler* / *Revenir au profil* below). The confirm button can show the loading state.
- Dialogs in use: new programme; **abandon** (destructive *Abandonner la séance*, says the sets stay in the history and the session will be offered again; with nothing logged, that the session is deleted); **a session is already open** (three stacked: resume it, abandon it and start the other, cancel; left open over 12 h: finish it and start the other comes first); **replace all data** (destructive *Tout remplacer*; busy state with a status line while the copy downloads and the import runs, Cancel disabled); **switch back to the original**.

#### Leave sheet

`src/features/play/components/LeaveSheet.tsx`. The ways out of a session, from the pause screen. Title *Quitter la séance ?*, description = what is already saved (*10 séries sur 22 faites. Elles sont déjà enregistrées.*). Three 76 px rows with hairlines between: 48 px sunken well, title 18 bold, 14 px muted consequence. Pause and leave (pause glyph), finish now (flag), abandon (close glyph; title in danger text, well on danger tint) → the abandon dialog. Footer: secondary *Annuler*, 64 px. Rows: press overlay, inset focus.

#### Stop view (adjust sheet)

*Arrêter cet exercice* in the adjust sheet replaces the sheet's content (a back icon returns to adjusting). Title, one line on why the reason matters, two choice cards (76 px): *Douleur* / *Pas le matériel aujourd'hui*, then a note that states the consequence and updates with the reason (sets flagged, what happens next; in a group, the exercise leaves the remaining rounds). Footer: destructive *Arrêter l'exercice*, secondary *Continuer l'exercice*. Error: tapping Stop with no reason marks both cards `danger-text` with *Choisis une raison pour arrêter.*
- **Built differently:** the title is generic (*Arrêter cet exercice ?*) rather than naming the exercise, which also keeps the exercise-name rule; no undo toast after the stop. The no-reason note still says *Tu passes directement à {exercice}*: rewrite as *Ensuite : {exercice}, sans repos.*

#### Decisions sheet

`DecisionsSheet` in `src/features/programme/Decisions.tsx`. Title *À toi de choisir*, description *Ces changements d'exercice attendent ta réponse. Sans réponse, rien ne change.*, then flat proposal cards: exercises in the next session first, then pain, no equipment, assisted, easier, harder. Footer: secondary *Fermer*. The list is a snapshot taken on open, so answered cards stay (confirmed, with Undo) until the sheet closes; the nudge count updates live.

#### Import sheets and comparison table

In `src/features/settings/DataScreen.tsx`. The system file picker leads to:
- **Preview sheet:** the backup's date as title, the file name with the file glyph, an alert note when the phone holds sessions newer than the file (*Les **4 séances** faites après cette sauvegarde seront remplacées…*), then the comparison table. Footer: primary *Remplacer par cette sauvegarde*, secondary *Annuler* → the replace-all dialog.
- **Comparison table:** `role="table"`; kind (16 / 600), *Ce fichier* (numeral 24), *Ce téléphone* (numeral 24, muted); 13 px column heads, hairline rows. Yes/no kinds show a check or `–`. Rows where both counts are 0 are hidden.
- **Error sheet:** 48 px well with the alert glyph, the reason as title, one sentence that always ends with what was changed (*Rien n'a été modifié.*), the file name with the file glyph. Footer: 64 px primary to try again or pick another file, then *Fermer* (the only action, as primary, when the backup comes from a newer version). Reasons: not a backup, damaged, newer version, copy of the current data failed. **Built differently:** "damaged" was added in the build.
- **Restore before set-up** (`RestoreBackup.tsx`, first onboarding step only): below the goal choices, after a hairline, a 15 px muted question (*Tu changes de téléphone ?*) over a ghost button with the upload glyph (*Restaurer une sauvegarde*), its glyph lined up with the text. The picked file opens a lighter preview: *Restaurer cette sauvegarde ?* as title, the date and file name, one line of contents (*Elle contient 15 séances, 482 séries et 1 programme.*), then a note when the backup has no programme in progress, and one when the phone already holds data (that copy downloads first). Footer: 64 px primary *Restaurer*, secondary *Annuler*. No replace-all dialog, since nothing is lost on an empty phone. The error sheet is the same as above. Once the data is in, the app opens on the programme.

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

#### Session summary

`src/features/play/components/SummaryScreen.tsx`. The end of a session: how long, how much, whether it counts, and what changes next time. Full screen, no tab bar, no back; a context line only (*Semaine 3 · Séance A — Push*). One 64 px primary in the dock.
- **Order:** title → duration → set strip + stats → counts-as-done → *À toi de choisir* (only if the session raised decisions) → backup line (when due) → *Exercice par exercice* → dock. The counts-as-done switch stays in the first viewport at 360 px: it is the only decision every session asks.
- **Title** display 48, balanced: *Séance terminée*, or *Séance arrêtée avant la fin* after *Terminer maintenant*.
- **Duration:** active time (pauses excluded) in numeral 144 + *min* in numeral 48 muted + a 16 px caption *Temps actif, pauses non comptées*; 100 min and over reads `1 h 47`.
- **Stats** (columns 1 : 1.3): main sets done in numeral 60 + 16 px label; total reps in numeral 60 + label, with a 14 px *volume 2 228 kg* sub-line only when kilograms were lifted.
- **Counts-as-done card:** a card holding one large switch row; on by default when at least half of the main sets were done; the meta states what the rotation does and flips with the switch; saved on every toggle. Only for a session of the current programme. Quick sessions show a notice instead: *Hors programme : ta rotation ne bouge pas.*
- **Decisions:** section title 21 + one muted line, then one proposal card per decision (9.10). A stopped exercise shows up there and in its list row; there is no separate stopped list.
- **Per-exercise list:** 9.10.
- No loading state: the summary reads a finished log.
- **Built differently:** the stats lead with sets and reps (the note had `19/23` main sets and volume as the second stat, bodyweight reps as its sub-line). Quick sessions end on *Retour aux séances rapides* instead of *Retour au programme*.

#### Pause screen

A full screen on the base colour, not a sheet, so it reads from the floor. The top bar's pause button turns into play. *En pause* (display 48) + the session line, the frozen active time in numeral 144 muted, and the resume point behind a 2 px bracket: a label line, then the exercise as a title and its set. (The label *Tu reprendras à* only holds because the name sits on its own line; *Reprise* would be safer.) Dock (64 px): primary *Reprendre*, secondary *Quitter la séance* → leave sheet. Pausing during a rest freezes its seconds; pausing during a hold drops the attempt and returns to Ready.

#### Player stand-in (retired)

Start now opens the player. The mockup is kept for reference only.

#### Progress before data

Display title, then a ghost of the chart that will fill in (axes and week labels only, no data), a title and sentence saying what will appear, and *Voir la prochaine séance* in the dock.

### 9.9 Workout player

The built player is the scoreboard (section 10). Components live in `src/features/play/components/`, styles in `src/features/play/Play.module.css`. Floor-reading sizes follow section 6.4: exercise name 48 everywhere; reps, load, speed and incline 96; rest, hold and lead-in 288; interval phase 240; steady cardio 192; ring 192; side letters 48 (144 on the switch pause); phase word 48.

#### Top bar and voice toggle

Pause (turns into play while paused), the context line with segmented progress (*Exercice 2 sur 7*, *Exercices 5–6 sur 7* for a group, *Échauffement, 2 sur 3*, *Fin de séance, intervalles*; short enough for 360 px in both languages), active time, voice toggle. On rest screens the bar takes the rest tone. **Voice toggle:** icon button with `aria-pressed` and a constant label *Annonces vocales*; off = muted icon with a slash (section 8). It mutes the voice only (beeps and vibration keep the timing) and writes the same setting as Settings. Each tap shows a 3 s toast (*Annonces vocales coupées. Les bips restent actifs.*); without a voice for the language, the toast says so.

#### Score

Two columns, `minmax(min-content, 1.45fr) minmax(min-content, 1fr)`, so French per-side units never overflow at 360 px.
- **Left:** the set's goal in numeral XL (the per-set goal when it differs), the RIR badge beside it (top-aligned, 10 px gap; 26 px outline pill, 14 px bold), then the unit line: *reps (8–10)* in range, *reps, vers 8–10* under it, *reps, au-delà de 8–12* past it; per side *reps, côté gauche (8–12)*. The badge moved beside the number so the unit line never wraps under it.
- **Right:** the load (numeral XL + unit, or a word at display width).
- **Max:** *Max* at numeral XL + a hint line (*Arrête-toi à 1 rep en réserve. Série 1 : 11 reps.*).

#### Item tiles and side tiles

- **Item tiles** (superset, circuit), right of *Tour 2/3*: 44 px, radius sm, letter 21 heavy at title width. Done = `complete` fill; current = 3 px `accent-line` ring; later = 1.5 px `line-strong`. On yellow: done = ink fill, current = 3 px dashed ink. Each tile is spoken (*Exercice a sur 2*). **Built differently:** done tiles have no check badge.
- **Side tiles** (per side): 60 px, radius md, letter 48 at numeral width (*G / D*, *L / R*). Current = inverse, done = `complete`, later = outline. The primary reads *Côté gauche fait / 10 reps à 16 kg*; each side is its own logged set.

#### Next-up row

Under the score in a group: 2 px `line-strong` left bracket, 14 px padding; *Puis* (14 muted), a 32 px letter tile, the name 18 bold at title width over a 14 px muted line (*12 reps à 10 kg, sans repos*). It always shows, because groups often have no rest between items. Last item of a round: *Puis repos 45 s, tour 3*; last item of the session: *Puis fin de séance*.

#### Side-switch pause

Dark, not yellow: it is not a rest. Title *Change de côté* (display 36); two 176 px tiles (radius lg, letter 144, 16 px caption) with an arrow between them: done side = `complete`, incoming side = accent fill; *Commence dans 4 s* in numeral 96 + 24 px label, and a draining bar. 5 s, beeps on the last 3, then the other side opens (a timed hold starts by itself). One secondary: *Commencer le côté droit*. The rest between sets comes after the second side only.

#### Big clocks

- **Hold:** Ready (the goal, hint *Mets-toi en position, puis appuie. Tu as 3 s.*, primary *Lancer le chrono*) → lead-in (*En place* + 3 at 288, *Annuler*) → running (countdown from the goal at 288 + 48 px unit; bar with a tick at the minimum; dock: feel + secondary *Arrêter le chrono / Note 22 s*). Nothing runs before the tap.
- **Interval phase:** numeral 240 + 48 unit; phase word (*Effort / Récup*) 48 + *Tour 3/8*; speed and incline of this phase at 96; *Ensuite* names the next phase. Work = base colour; recovery = yellow (dark in ring mode). Phases advance by themselves; secondary *Phase suivante*.
- **Steady cardio:** mm:ss counting up at 192, `nowrap`, the colon narrowed; bar to the goal (*Encore 6 min 36 / Objectif 15 min*). At the goal: beep, a check line, and Done turns primary. It never completes by itself. **Built differently:** the clock shrinks to fit narrow screens (`min(192px, (100vw − 40px) / 1.8)`, about 178 px at 360 px).
- **Interval segments:** one cell per round, split 2 : 3 work / recovery, 8 px: done = `text-subtle`, current phase = `accent-line` (ink on yellow), later = track.
- Paused clocks show muted digits and *En pause*.

#### Reps-done stepper

Max sets only: a player stepper (64 px buttons, numeral 36) in the dock beside the primary *Noter / 11 reps*, whose second line mirrors the value live. Minus disabled at 0. Prefilled from the previous set, else history, else 10.

#### Timer ring

Track `--color-track` and progress `--color-accent-line`, 20 px stroke, butt caps, starting at 12 o'clock and draining clockwise. Centre: seconds in compact timer size, unit word below. Diameter as large as the width allows (`min(340px, 100%)`). States: running, paused (digits muted, "En pause / Paused" under the number, ring stops), finished (ring empty, digits replaced by the next action for 1 s). It never shows minutes for rests: rests are whole seconds (≤ 3 digits). **Ring rest** (setting): dark screen with the ring, a done line, the next card on `surface` and the same three controls in the same places; *Passer* is the inverse button. The setting covers every rest, including interval recovery.

#### Tempo strip

Three segments sized to the tempo (2-1-2 → 2fr 1fr 2fr): phase name (13 px) over seconds (21 px). The strip is a toggle button (`aria-pressed`): a tap starts pacing (a soft tone per phase, the active phase in accent fill, an inverse rep counter tile appears on the right); a second tap, or logging the set, stops it. Static and neutral until tapped, so it adds no yellow by default.

#### Figure slot

The exercise figure on the set, timed, test and warm-up screens. Same size and place as before: flexible height, min 96 px, the space left above the dock. The whole slot is **one button** that opens the how-to sheet (*Comment faire : Pompes*).
- **Container:** radius lg, radial gradient from `surface-raised` to `surface`, hairline edge (unchanged). Pressed: the centre lifts by the press overlay. Focus: inset 2 px ring.
- **The figure** fills the slot's SVG; the overlays below **reserve space** and the figure is framed in what is left (9.12, framing), so nothing ever sits on it. The floor hairline always runs the full width.
- **Key cue** (the exercise's key cue): 15 / 600 `text-muted`, left-aligned, max 2 lines, under the floor at the bottom, only when the slot is at least 200 px tall. Below that it lives in the how-to only.
- **Pattern tag:** gone from the slot; the figure shows the movement. The pattern moves to the how-to header.
- **Enlarge mark:** a 32 px `surface-sunken` circle at the bottom right (8 px inset) with the `expand` glyph 18 px in `text-muted`. Decorative (the slot itself is the button); under 200 px it keeps a 40 px column on the right free of the figure.
- **Why chip:** at the top, full width; the figure is framed below it. Under 140 px tall the chip moves to the left (width: slot − 136 px, 14 px text, up to 4 lines) and the figure takes the right 136 px.
- **Per side:** side 2 is the mirror image. A 28 px sunken pill at the top left repeats the side (*D* in a 22 px inverse disc + *Côté droit*), hidden when the why chip shows. `aria-hidden`: the screen already says the side.
- **By screen:** reps → loop (neutral pace, or the tempo pacer's phase while pacing); timed hold → the hold pose, still; interval work → loop; **interval recovery → key pose, still** (it is a rest), framed like the loop so nothing jumps at the next phase; steady cardio → loop; max test → loop; player paused → frozen.
- **On yellow** (interval recovery): transparent fill, `rest-track` edge, `data-figure-tone="rest"` (ink figure), the enlarge mark becomes a 1.5 px ink ring with an ink glyph.
- **States:** moving; still (reduced motion: the key pose, framed to fill); loading (floor hairline and contact shadow only; the cue shows if there is room; the figure fades in when its code arrives, no spinner); unavailable (the old placeholder: the equipment glyph at 64 px in `text-subtle`, 48 px under 120 px, plus the cue).
- Accessible name of the button: *Comment faire : {name}* / *How to do it: {name}*. The figure itself is hidden from assistive technology.

#### Why chip

`WhyChip` in `parts.tsx`; text from `useWhy` (`why.ts`) and `noteChip` (`src/features/adapt/format.ts`). The short why of a changed number, on the set screen.
- Anatomy: absolutely placed at the top of the figure slot (8 px inset), sunken, radius md, 8 × 12 px padding; 20 px glyph (`info` in `text-muted`) + 15 px / 600 text in `text`, at most 2 lines (clamped). It costs no height, so the numerals, tempo strip and dock never move and the slot keeps its 96 px. The figure is framed below it; in a slot under 140 px tall the chip sits on the left (up to 4 lines at 14 px) and the figure on the right (Figure slot).
- When: on set 1 of an exercise whose prescription changed. On **every** set of an exercise's first session at a new load, together with the feel ask state: set 1 *Nouvelle charge, +2 kg : 6 reps pour commencer. Comment c'était ?*, later sets *Nouvelle charge : comment c'était ?*.
- **Pain variant:** stop glyph in danger text, text stays `text`; it doubles as a safety cue (*8 kg au lieu de 10 kg après ta douleur. Arrête si elle revient.*).
- Don't: add a row under the score for this (it pushed the slot to 0 at 360 × 780), or colour the chip.

### 9.10 Adaptation

Wording for every reason lives in the `adapt` namespace of the locales; `noteReason` (summary), `noteDetail` (session detail) and `noteChip` (player) in `src/features/adapt/format.ts` keep the same words across surfaces.

#### Proposal card

`src/features/adapt/ProposalCard.tsx`. A change the app will not make on its own: after pain, no equipment, or when a harder, easier or assisted variant would fit. One card per exercise.
- **Header:** 48 px well (pain: danger tint + stop glyph; no equipment: the exercise's equipment glyph; harder: `step-up`; easier: `step-down`; assisted: band) + the exercise name (21, title weight and width, balanced) + a 14 px muted kicker with bold evidence ending in the question (***Douleur**, 1 série sur 3 faite. Pour la suite ?*; for pain the bold word is danger text).
- **Answer rows:** full-width buttons, min 64 px, 1.5 px `line-strong` outline, radius md; 24 px glyph in `text-muted` (`swap` = substitute, `arrow-down` = lighter or easier, `equals` = keep or one-off, `clock` = not now), title 17 bold at label width, consequence 14 px muted. Pressed: overlay + press scale. Focus ring. While an answer saves, every row is disabled (60 % opacity). **An answer applies on tap:** no pre-selection, no confirm button.
- **Rows by kind:** pain — *X à la place* (only if a substitute exists) / *Le garder, plus léger* / *Le garder tel quel* (gone on a second pain); no equipment — *C'était ponctuel* / *X à la place, pour de bon*; harder, easier, assisted — *X à la place* / *Pas maintenant*.
- **Notes under the rows:** pending note (pain), care note (second pain), info note for no equipment (*Sans réponse, c'est compté comme ponctuel.*).
- **Confirmed state:** `complete`-fill well with a 28 px check, the answer's title (18 bold), one 15 px muted line on what now happens (bold values), ghost *Annuler* (Undo) until the screen is left. `role="status"`.
- **Variants:** `card` on the summary; `flat` in a sheet (no chrome, hairline top, 20 px vertical padding).
- No-equipment cards left unanswered on the summary are recorded as one-offs when the summary is left, so they never reach the Programme tab.
- Don't: colour the answers, make any of them yellow, or put the exercise name after an article (*X à la place*, never *à la place de X*).

#### Per-exercise list

`src/features/play/components/summary/ExerciseList.tsx`. The summary's *Exercice par exercice*: what was done, and next time's figure. One row per main exercise, in session order, in a card list with hairlines; warm-up and finisher are not listed.
- **Head:** section title 21 + one muted line (*Ce que tu as fait, et à gauche l'objectif de la prochaine fois.*); a 13 px / 600 caption *Prochaine fois* above the figure column.
- **Row:** 92 px figure column + text. Text: name 18 / 600; done line 14 px muted with the load bold (*5 séries : 14, 14, 14, 13, 13 reps à **10 kg***; after a pain stop, the last bold word *douleur* in danger text); reason 14 px in `text`.
- **Figure:** the old value 14 / 600 muted with a 20 px `arrow-right` above the new value in numeral 36 + 16 px muted unit (numeral 28 when longer than 4 characters; a word such as a band level at 17 px heavy, wrapping). **Same:** `equals` glyph + *même* in muted above the current goal in muted numerals, and a one-line reason. **Swapped:** a 28 px swap glyph, reason *Ton choix : X à la place.* **Not reached:** *Pas fait cette fois : rien ne change.* **No equipment, one-off:** *C'était ponctuel : rien ne change.*
- **Modes:** quick session — no figure column; deload — no figure column, and the sub-line says nothing moves this week; peak — only increases get a figure, everything else reads same.
- When exercises have reached the top of the owned kit, a buy-next nudge row closes the list.
- **Built differently:** the deload and peak messages are a muted sub-line under the heading, not a notice; name 18 (note: 17) and unit 16 (note: 18); *= même* is drawn as the `equals` glyph + *même*.

### 9.11 Settings and data

- **Settings root order:** *Ton entraînement* → *Pendant la séance* (switch rows for voice, beeps and vibration, then the rest-screen picker) → *Données* (one row *Données et sauvegarde* whose meta is the backup age) → *Affichage* → *À propos*. Vibration is shown disabled where the device has none, with the reason as meta; the voice row's meta says when the phone has no voice for the language.

#### Rest-screen picker

`src/features/settings/RestPicker.tsx`. Radio group of two 96 px tiles side by side: a 44 × 72 miniature of each look (yellow takeover / ring), title 17 bold, 13 px sub (*Jaune, lisible de loin* / *Plus doux dans le noir*). Selected: inverse fill, the miniature keeps its own colours. Pressed: press scale. Arrow keys move and select.

#### Data and backup screen

`src/features/settings/DataScreen.tsx`, in order of use: *Sauvegarde* (last-backup block, counts on this phone, primary *Exporter une sauvegarde*, secondary *Exporter les séries en CSV*, one line under each on what the file is for) → *Stockage* (status card) → *Importer* (one line, secondary *Importer une sauvegarde* with the upload glyph). A CSV export is not a backup and does not reset the backup age.
- **Last-backup block:** 15 px muted label; the value in numeral 72 between two muted title-24 words (*il y a **3** jours*), or a word at display 36 (*Aujourd'hui*, *Jamais*); a 14 px date line.
- **Storage status card:** card with a 40 px well, title 18 bold (*Stockage durable : accordé*), 14 px meta. Granted: shield-check. Refused or unavailable: firm (2 px `text` edge, inverse well, shield) + a bold hint (*Ajouter l'app à l'écran d'accueil permet souvent de l'obtenir.*). **Built differently:** the states are granted / refused / unavailable (the browser cannot tell); the "not asked yet" state from the design is not there.
- **Import success notice:** a notice with the check glyph at the top of the screen, bold lead naming the backup, then the file name of the copy downloaded before the import. `role="status"`.

### 9.12 Exercise figure

One stylised figure, drawn flat in SVG from a 3D skeleton, with its props (dumbbells, towel, door). Runtime in `src/motion/figure/`.

#### Figure tones

A **contrast ladder**, not colours: the working limb has the most contrast, then the body, then the far-side working limb, then the far side. In dark the working limb is lighter than the body; in light it is darker. Each step clears 3:1 against the surface behind the figure, so the silhouette and its depth read in both themes. Props sit at the far-working-limb step. The figure never uses yellow.

| Token | Dark | Light | On yellow (`data-figure-tone="rest"`) |
|---|---|---|---|
| `--figure-limb` | chalk (14.1) | graphite 700 (11.7) | ink (11.9) |
| `--figure-body` | graphite 300 (7.1) | `#5E6474` (5.9) | `#4D3D05` (6.8) |
| `--figure-limb-far` | graphite 400 (5.3) | `#727888` (4.4) | signal 900 (5.0) |
| `--figure-far` | graphite 500 (3.1) | `#848A99` (3.5) | signal 800 `#8A6A10` (3.3) |
| `--figure-prop` / `-prop-far` | graphite 400 / 500 | `#727888` / `#848A99` | signal 900 / 800 |
| `--figure-shadow` | graphite 900 at 70 % | graphite 100 | ink at 14 % |
| `--figure-floor` | `line` | `line` | `rest-track` |
| `--figure-door` | `surface-sunken` | graphite 100 | ink at 10 % |
| `--figure-cut` | `surface-raised` | `surface-raised` | `rest-bg` |

Ratios against `surface-raised` (dark) and white (light). `--figure-cut` is the gap drawn around each part so overlapping limbs stay readable: set it to the surface behind the figure wherever that is not `surface-raised` (the how-to stage sets `surface`). `data-figure-tone="ink"` gives the dark ladder in both themes, for the "next" tile on the ink rest card (a graphite 850 well, which is its cut).

#### Thumbnail

The figure's key pose, still, in a 56 × 56 tile (radius sm, the slot's gradient, hairline edge). Used in the picker, session detail, exercise progress and Test now rows. It replaces the equipment-glyph thumbnail; the glyph stays as the unavailable state.

#### "Next" tile

72 × 72, the key pose still, on the right of the rest takeover's *Ensuite* card (graphite 850 well with a graphite 700 hairline, `data-figure-tone="ink"`) and of the ring-rest next card (normal tones). The card becomes a button that opens the how-to of the next exercise; the rest keeps running (how-to sheet, rest band).

#### Framing

- **Loop framing** (slot, how-to stage, interval recovery): the whole loop fits, both sides for per-side moves, standing on the floor at the bottom padding, centred. The figure never changes size while it moves.
- **Still framing** (reduced motion, holds): the key pose fits, same padding.
- **Tile framing** (56 and 72 px stills): the key pose fits; if the pose is **at least twice as wide as tall** (floor moves: push-up, plank, bridge), it is enlarged until it fills the tile's height, but never so much that less than **55 % of its width** stays in view; it is anchored on the head's end and the other end (the feet) leaves the tile. One rule, no per-exercise crop.
- **Reserved box:** overlays in the slot (why chip, cue band, enlarge column) shrink the box the figure is framed in; padding is proportional to that box.

#### Entry points to the how-to

| Where | Tap target | Footer |
|---|---|---|
| Player set, timed, test screens | The whole figure slot | *Fermer* |
| Rest takeover, ring rest | The *Ensuite* card (with its 72 px tile) | *Fermer* |
| Session detail | Thumbnail + name, one button in the row head; the why button stays separate on the right | *Fermer* |
| Exercise picker | The thumbnail, its own 72 × 76 target left of the pick button; a hint line under the search: *Touche une image pour voir le mouvement.* | The picker's verb + *Fermer* |
| Exercise progress | A *Comment faire* card row under the title (thumbnail, *Le mouvement animé et 3 étapes*, chevron) | *Fermer* |
| Test now (inside its sheet) | The thumbnail of a row; the how-to replaces the list | *Choisir cet exercice* |

The progress list's thumbnails are pictures only: the row opens the exercise, where the how-to is one tap away.

---

## 10. Workout player

Two variants were mocked; **A (scoreboard) is built**, with a setting that swaps the yellow rest takeover for the ring timer (every rest, including interval recovery). B is kept as a reference; the exercise figure arrived in A's slot (9.9, Figure slot). Both use the same top bar and tokens. The states beyond a straight set (groups, per side, holds, intervals, cardio, warm-up, stop, pause, leave) are in `player-states.html` and section 9.9.

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
| `mockups/programme-placeholders.html` | The player stand-in behind "Start" (retired); the Progress tab before any data; session detail loading (skeleton). |
| `mockups/player-a.html` | Player variant A: during a set, during rest, adjusting a set. |
| `mockups/player-b.html` | Player variant B: during a set, during rest. |
| `mockups/player-states.html` | Superset item, between-items and after-round rests, per side and the side switch, timed hold (ready, lead-in, running), max reps, intervals (work, recovery), steady cardio (before and at the goal), warm-up, the stop flow (none picked, picked, error), pause, leave sheet, abandon, ring rest. |
| `mockups/player-summary.html` | Summary (all sets done, exercises stopped, finished early, quick session), resume banners on Programme and Quick (incl. left open over 12 h), "a session is already open" dialogs, abandon from the banner. |
| `mockups/settings-data.html` | Settings with *Pendant la séance*; Data and backup (storage granted, refused); after export; import preview, confirmation, busy, done; errors; backup reminders (standard, firm). |
| `mockups/figure.html` | The figure slot on tall and short screens, with the why chip, per side (side 2), timed hold, interval recovery on yellow; slot states at 96 / 160 / 260 px (moving, chip, reduced motion, loading, unavailable); the how-to sheet from the set (pacing on), during a rest (rest band), from the picker (long entry, scrolled), under reduced motion, inside Test now; entry points (session detail, picker, exercise progress, rest *Ensuite* card); thumbnails under the framing rule; figure tokens. Figures are drawn live by the same pose core as the app. Also accepts `?motion=reduced`. |
| `mockups/adaptation.html` | Summary with decisions (first and second pain, no equipment), answered cards and the per-exercise list; Programme tab with the decisions nudge and sheet; session detail with goal rulers, per-set goals, swaps, pending pain and the switch-back dialog; the player's why chips (new weight, per side + slower tempo, pain, past the range). Also accepts `?w=` / `?h=` to resize every frame. |

Each page has FR/EN and dark/light toggles. Pages also accept `?lang=en` and `?theme=light|dark`; with no theme set they follow the system. Every frame is 390 × 844.

Where a mockup and the built screen differ, this document describes the built screen.
