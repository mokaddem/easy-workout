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

**Self-hosting (before release):** ship `archivo-latin-ext.woff2` (variable) from the app's own assets, declared with `font-weight: 100 900; font-stretch: 62% 125%; font-display: swap`, preloaded on the first screen and precached by the service worker. The mockups use the Google Fonts CDN only for convenience. System fallbacks have no condensed width, so a missing font makes numerals much wider. Always ship the font; never rely on the fallback for the player.

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

Punch is for achievements only: never on routine taps or navigation.

### 7.3 Reduced motion

`prefers-reduced-motion: reduce` overrides the tokens: travel distances and press/punch scales become 0 / 1, overshoot becomes `--ease-move`, durations shrink to cross-fades of 100–160 ms. The takeover becomes a 160 ms cross-fade. The timer ring still moves (it carries information) but the last-3-seconds pulse is replaced by a colour change only. Components that read the tokens get this for free; anything driven from script must read them too.

---

## 8. Iconography

- 24 × 24 grid, 2 px stroke, round caps and joins, no fills (except status glyphs). 20 px in chips and facts, 28 px in equipment wells.
- Drawn in-house as inline SVG symbols: back, close, pause, sound, plus, minus, check, skip, sliders, calendar, bolt, chart, pencil, clock, list, incline, stop; equipment: dumbbell, band, belt, pull-up bar, treadmill, bench.
- Icons never stand alone for unfamiliar actions: icon buttons carry an accessible label, and in the player only pause, sound, edit and skip are icon-led.

---

## 9. Components

States covered for each: **default, pressed, disabled, focus, error, empty, loading** where they apply. Focus is always `--focus-ring` (2 px bg gap + 2 px focus colour), visible on any surface including yellow. On the rest takeover the ring is ink.

### Button

| Variant | Default | Pressed | Disabled |
|---|---|---|---|
| Primary | accent fill, ink label | `accent-pressed`, scale 0.97 | sunken fill, disabled label |
| Secondary | transparent, 1.5 px `line-strong` outline | press overlay | outline removed, disabled label |
| Ghost | text colour, 2 px underline | press overlay | disabled label, no underline |
| Destructive | `danger` fill, `on-danger` label (confirmations) | `danger-pressed` | as primary |
| Destructive outline | `danger-text` outline and label (in-flow stops) | danger tint | as secondary |

- Heights: 56 px (`--tap-comfort`), 64 px in the player (`--tap-player`). Label 18 px bold at 88 % width; 21 px in the player.
- Content: optional leading icon (check for confirmations), never a trailing arrow. A two-line primary is allowed when it shows exactly what will be logged ("Fait comme prévu / 10 reps à 14 kg").
- **Loading:** label stays, a 20 px spinner replaces the icon, the button keeps its width and ignores taps.
- **Error:** buttons have no error state; the error shows on the field or as a toast.

### Icon button

48 × 48 (64 × 64 in the player), radius md, transparent or sunken fill, optional outline. Pressed: press overlay. Disabled: disabled colour. Always has an `aria-label`.

### Stepper (reps, load, equipment specs)

`[−] value unit [+]` on a sunken pill. Buttons 48 px (64 px in the player); value in numeral S (forms) or M (player), unit in 14 px muted.
- Step follows the equipment: load steppers jump through the loads the equipment can actually make (2 kg steps, or the band levels), not free numbers.
- At the limit, that button is disabled. Long press is not used; each tap is one step.
- **Error:** value out of range (typed entry, if allowed) turns the outline `danger-text` with a one-line message below.
- **Empty:** shows `–` in muted until a value is set.

### Segmented control

Equal-width options on a sunken track, 4 px inset, options 48 px tall. Selected: inverse fill. Pressed: press overlay. Disabled option: disabled label, not focusable. Used for feel (*Facile / Idéal / Dur*) and small exclusive choices (≤ 4 options; more becomes a list).

### Chip

48 px pill, 1.5 px outline. Selected: inverse fill plus a leading check. Used for multiple choice (band levels, filters). **Included** items (household equipment) are not chips: they render as a static check list, so they never look tappable.

### Check box

28 px, radius sm, 2 px outline; checked = inverse fill with check. The whole row or card header is the target.

### Card

Surface fill, radius lg, hairline edge, elevation 1. **Selectable card** (equipment): header row is the target (≥ 76 px), check box on the right; when on, the edge becomes `line-strong` and the settings expand. **Loading:** skeleton blocks in `surface-sunken`, no shimmer, at the size of the real content. **Empty:** see empty state.

### List row

Min 56 px; optional leading 48 px well (icon or thumbnail); title (16–18 px semibold) + meta line; trailing value, chevron or control. Divider = hairline, inset to the text. Pressed: press overlay. Disabled: muted text, no chevron.

### Timer ring

Track `--color-track` and progress `--color-accent-line`, 20 px stroke, butt caps, starting at 12 o'clock and draining clockwise. Centre: seconds in compact timer size, unit word below. Diameter as large as the width allows (340 px on a 390 px screen). States: running, paused (digits muted, "En pause / Paused" under the number, ring stops), finished (ring empty, digits replaced by the next action for 1 s). It never shows minutes for rests: rests are whole seconds (≤ 3 digits).

### Progress bar

8 px, radius xs, track `--color-track`, fill `--color-accent-line`. **Segmented** variant for steps and sequences (onboarding steps, exercise in session, sets, weeks): done = `text-subtle`, current = `accent-line`, later = track. Always paired with text ("Étape 4 sur 5"), so the bar is never the only carrier of the value.

### Tempo indicator

Three segments sized to the tempo (2-1-2 → 2fr 1fr 2fr): phase name (13 px) over seconds (21 px). Active phase: accent fill. Optional rep counter tile (inverse) on the right. Paced by the same clock as the tempo audio.

### Sheet / modal

Bottom sheet: raised surface, top radius xl, grabber 40 × 5 px, elevation 3, scrim behind. Content: title, one-line purpose, controls, one primary action, optional destructive outline at the bottom with a one-line explanation. Closes on scrim tap, grabber drag or back. Dialogs (confirmations) use the same surface, centred, with two buttons stacked full width.

### Toast

Inverse pill, min 56 px, elevation 3, bottom of the screen above the dock. Text says what happened in the same words as the action ("Série 4 enregistrée"); optional ghost action ("Annuler"). Stays 5 s when it has an action, 3 s otherwise. Errors use the same toast with a leading stop icon and say what went wrong and how to fix it.

### Empty state

Left-aligned: a 48 px icon well, a title saying what is missing, one sentence on what to do, one primary button. No illustration. Example: *Aucune séance cette semaine / Lance une séance rapide ou démarre ton programme.* [Démarrer le programme].

### Animation slot (placeholder)

Reserved for the future exercise animation. Keep the slot's size and position stable now, so the layout does not change when animations arrive.
- Container: radius lg, radial gradient from `surface-raised` to `surface`, hairline edge. Aspect free; min 96 px tall in the scoreboard player, 200–280 px in the instrument player, 72 × 72 thumbnail for "next".
- Content until animations exist: a perspective floor (hairlines converging to a vanishing point), the equipment glyph at 76 px in `text-subtle`, a movement-pattern tag ("Poussée horizontale"), and the exercise's key cue ("Coudes à 45°, omoplates serrées"). So the placeholder is still useful, not decoration.
- Overlays (tempo, rep counter) sit at the bottom edge; the cue moves to the top when overlays are present.
- States: placeholder (above), loading (floor and tag only), playing (later), unavailable (placeholder without cue). `role="img"` with the exercise name as its label.

---

## 10. Workout player

Two variants are mocked for decision; both use the same top bar (pause, "exercise n of N" with segmented progress, elapsed time, voice toggle) and the same tokens.

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
| `mockups/onboarding-equipment.html` | Equipment step: adjustable dumbbells with min/max/step steppers and a live load ruler, band levels, weight belt max load, treadmill incline and speed, pull-up bar and bench not owned, household items already included. |
| `mockups/programme-overview.html` | Week 3 of 8, volume phase, next-session card (Séance A — Push, ~45 min), 8-week × A–E rotation grid with done / next / later and phase brackets, tab bar. |
| `mockups/player-a.html` | Variant A: during a set, during rest, adjusting a set. |
| `mockups/player-b.html` | Variant B: during a set, during rest. |

Each page has FR/EN and dark/light toggles. Pages also accept `?lang=en` and `?theme=light|dark`; with no theme set they follow the system.
