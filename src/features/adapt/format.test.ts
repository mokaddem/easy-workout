import i18next, { type TFunction } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ProgressionNote } from '@/domain';
import { resources } from '@/i18n/resources';
import {
  changeFigure,
  changeTag,
  deltaText,
  evidenceText,
  goalState,
  loadText,
  noteChip,
  noteDetail,
  noteReason,
  parseToken,
  playerUnit,
  rulerLabel,
  showsWhy,
} from './format';

let en: TFunction;
let fr: TFunction;

beforeAll(async () => {
  const make = async (lng: 'fr' | 'en') => {
    const instance = i18next.createInstance();
    await instance.init({
      lng,
      resources: { [lng]: { translation: resources[lng] } },
      interpolation: { escapeValue: false },
    });
    return instance.getFixedT(lng);
  };
  en = await make('en');
  fr = await make('fr');
});

const note = (code: string, params: ProgressionNote['params'] = {}, newLoad = false) => ({
  code,
  params,
  ...(newLoad && { newLoad: true }),
});

const sp = ' ';
const nn = '\u202f';

describe('load tokens', () => {
  it('parses and says every token kind', () => {
    expect(parseToken('kg:12')).toEqual({ kind: 'kg', kg: 12 });
    expect(parseToken('band:heavy')).toEqual({ kind: 'band', level: 'heavy' });
    expect(parseToken('nope')).toBeUndefined();
    expect(loadText(en, 'en', 'kg:12')).toBe(`12${sp}kg`);
    expect(loadText(en, 'en', 'added:5')).toBe(`+5${sp}kg`);
    expect(loadText(fr, 'fr', 'kg:2.5')).toBe(`2,5${sp}kg`);
    expect(loadText(fr, 'fr', 'band:heavy')).toBe('Élastique fort');
    expect(loadText(en, 'en', 'bw')).toBe('Bodyweight');
  });

  it('signs the difference', () => {
    expect(deltaText('en', 'kg:10', 'kg:12')).toBe(`+2${sp}kg`);
    expect(deltaText('en', 'kg:12', 'kg:10')).toBe(`−2${sp}kg`);
    expect(deltaText('en', 'bw', 'added:2')).toBe(`+2${sp}kg`);
    expect(deltaText('en', 'kg:10', 'kg:10')).toBeUndefined();
    expect(deltaText('en', 'band:light', 'band:heavy')).toBeUndefined();
  });
});

describe('evidence', () => {
  it('says same reps, varied reps, bodyweight, bands and holds', () => {
    expect(evidenceText(en, 'en', { values: [10, 10, 10, 10, 10], load: 'kg:10' })).toBe(
      `5 × 10 reps at 10${sp}kg`,
    );
    expect(evidenceText(en, 'en', { values: [14, 14, 13], load: 'kg:10', feel: 'easy' })).toBe(
      `14, 14, 13 reps at 10${sp}kg, felt easy`,
    );
    expect(evidenceText(en, 'en', { values: [17, 17, 16], load: 'bw' })).toBe(
      '3 sets: 17, 17, 16 reps',
    );
    expect(evidenceText(en, 'en', { values: [40, 40, 40], time: true })).toBe(`3 × 40${sp}s held`);
    expect(evidenceText(fr, 'fr', { values: [12, 12, 12, 12], load: 'bw' })).toBe(
      `4 × 12${sp}reps`,
    );
  });
});

describe('notes', () => {
  const up = note(
    'load-up',
    { sets: 5, reps: 10, load: 'kg:10', from: 'kg:10', to: 'kg:12' },
    true,
  );

  it('gives the same change on every surface', () => {
    expect(noteReason(en, 'en', up, { goal: 8 })).toBe(
      'Top of the range: one step up, goal 8 reps.',
    );
    expect(noteDetail(en, 'en', up, { goal: 8 })).toBe(
      `Last time, 5 × 10 reps at 10${sp}kg. Top of the range: one step up, goal 8 reps.`,
    );
    expect(noteChip(en, 'en', up, { goal: 8 })).toBe(
      `New weight, +2${sp}kg: goal 8 reps. How did it feel?`,
    );
    expect(noteChip(en, 'en', up, { goal: 8, later: true })).toBe('New weight: how did it feel?');
  });

  it('drops the clauses it has no figure for', () => {
    expect(noteReason(en, 'en', up)).toBe('Top of the range: one step up.');
  });

  it('uses French typography', () => {
    expect(noteChip(fr, 'fr', up, { goal: 8 })).toBe(
      `Nouvelle charge, +2${sp}kg${nn}: objectif 8${sp}reps. Comment c’était${nn}?`,
    );
  });

  it('tells bands, assisted and bodyweight apart', () => {
    const heavier = note('band-heavier', { from: 'band:light', to: 'band:medium' }, true);
    expect(noteReason(en, 'en', heavier, { min: 8 })).toBe(
      'Past the range: heavier band, back to 8 reps.',
    );
    expect(noteReason(en, 'en', heavier, { min: 6, exerciseId: 'band-assisted-pull-up' })).toMatch(
      /^Under 6 reps twice in a row: more help, medium band\.$|^Past the range/,
    );
    const bw = note('beyond-range', { load: 'bw', goal: 14, max: 12 });
    expect(noteReason(en, 'en', bw, { cap: 16 })).toBe(
      'No load to add with your kit: the goal goes past the range, up to 16 reps.',
    );
    expect(noteChip(en, 'en', bw)).toBe('Goal 14 reps, past the range');
  });

  it('words pain in its three states', () => {
    const pending = note('pain-lighter', { pending: true, load: 'kg:8', painFree: 0, needed: 2 });
    expect(noteReason(en, 'en', pending, { from: 'kg:10' })).toBe(
      `Pain last time: 8${sp}kg instead of 10${sp}kg until you choose.`,
    );
    expect(noteChip(en, 'en', pending, { from: 'kg:10' })).toContain('Stop if it comes back.');
    const chosen = { ...pending, params: { ...pending.params, pending: false } };
    expect(noteReason(en, 'en', chosen)).toContain('no increase before 2 pain-free sessions');
    expect(noteReason(en, 'en', note('hold-pain', { painFree: 1, needed: 2 }))).toBe(
      'No increase before 2 pain-free sessions (1 of 2).',
    );
  });

  it('words the notes about sparing a joint, with its name when there is one', () => {
    const hold = note('dose-cap-hold', { load: 'kg:8' });
    expect(noteReason(en, 'en', hold, { joint: 'knee' })).toBe(
      'Same weight after a hard set, to go easy on your knee.',
    );
    expect(noteChip(fr, 'fr', hold, { joint: 'knee' })).toContain('ton genou');
    expect(noteReason(en, 'en', hold)).toContain('your joint');
    const end = note('ladder-end-limited');
    expect(noteReason(en, 'en', end, { joint: 'shoulder' })).toContain('your shoulder');
    expect(showsWhy(end)).toBe(true);
  });

  it('has no chip for plain holds and no line for them either', () => {
    expect(noteChip(en, 'en', note('hold'))).toBeUndefined();
    expect(showsWhy(note('hold'))).toBe(false);
    expect(showsWhy(note('hold-miss'))).toBe(true);
    expect(showsWhy(undefined)).toBe(false);
  });

  it('knows every code the engine writes', () => {
    const codes = [
      'reps-up',
      'hold',
      'hold-miss',
      'confirm-new-load',
      'load-up',
      'load-up-low',
      'load-down',
      'added-load-start',
      'band-heavier',
      'band-lighter',
      'beyond-range',
      'tempo-slower',
      'ladder-end',
      'buy-next',
      'calibrated',
      'your-load',
      'from-history',
      'swapped-in',
      'goal-eased',
      'welcome-back',
      'load-snapped',
      'time-up',
      'time-down',
      'work-longer',
      'work-shorter',
      'pain-lighter',
      'hold-pain',
    ];
    for (const code of codes)
      for (const t of [en, fr])
        expect(noteReason(t, t === en ? 'en' : 'fr', note(code))).toBeTruthy();
  });
});

describe('prescriptions', () => {
  const reps = { kind: 'reps', min: 8, max: 10 } as const;

  it('tags the change', () => {
    const tag = (a: object, b: object, o = {}) =>
      changeTag(en, 'en', { target: reps, ...a }, { target: reps, ...b }, o);
    expect(tag({ load: { kind: 'kg', kg: 10 } }, { load: { kind: 'kg', kg: 12 } })).toMatchObject({
      icon: 'arrow-up',
      text: `2${sp}kg`,
    });
    expect(tag({ goal: 10 }, { goal: 8 })).toMatchObject({ icon: 'arrow-down', text: '2 reps' });
    expect(tag({ goal: 8 }, { goal: 9 })?.text).toBe('1 rep');
    expect(
      tag({ tempo: { down: 2, pause: 1, up: 2 } }, { tempo: { down: 3, pause: 1, up: 2 } }),
    ).toMatchObject({ icon: 'turtle', text: 'Slower' });
    expect(tag({ load: { kind: 'bodyweight' } }, { load: { kind: 'added-kg', kg: 2 } })?.text).toBe(
      'Added load',
    );
    expect(
      tag(
        { load: { kind: 'band', level: 'light' } },
        { load: { kind: 'band', level: 'medium' } },
        {
          assisted: true,
        },
      )?.text,
    ).toBe('More help');
    expect(tag({ goal: 8 }, { goal: 8 })).toBeUndefined();
    const hold = { kind: 'time', minSec: 30, maxSec: 60 } as const;
    expect(changeTag(en, 'en', { target: hold, goal: 40 }, { target: hold, goal: 45 })?.text).toBe(
      `5${sp}s`,
    );
  });

  it('puts the new value in the figure', () => {
    expect(
      changeFigure(
        en,
        'en',
        { target: reps, load: { kind: 'kg', kg: 18 } },
        { target: reps, load: { kind: 'kg', kg: 20 } },
      ),
    ).toEqual({ kind: 'load', previous: `18${sp}kg`, next: `20${sp}kg` });
    expect(changeFigure(en, 'en', { target: reps, goal: 10 }, { target: reps, goal: 11 })).toEqual({
      kind: 'goal',
      previous: '10 reps',
      next: '11 reps',
    });
    expect(changeFigure(en, 'en', { target: reps, goal: 12 }, { target: reps, goal: 12 })).toEqual({
      kind: 'same',
      next: '12 reps',
    });
  });
});

describe('goal against the range', () => {
  it('names where the goal sits', () => {
    expect(goalState(6, 8, 10)).toBe('under');
    expect(goalState(9, 8, 10)).toBe('in');
    expect(goalState(13, 8, 12)).toBe('past');
  });

  it('words the unit under the player number', () => {
    expect(playerUnit(en, { goal: 9, min: 8, max: 10 })).toBe('reps (8–10)');
    expect(playerUnit(en, { goal: 9, min: 8, max: 12, side: 'left' })).toBe(
      'reps, left side (8–12)',
    );
    expect(playerUnit(en, { goal: 6, min: 8, max: 10 })).toBe('reps, toward 8–10');
    expect(playerUnit(fr, { goal: 13, min: 8, max: 12 })).toBe('reps, au-delà de\u00a08–12');
    expect(playerUnit(en, { goal: 45, min: 30, max: 60, time: true })).toBe('seconds (30–60)');
  });

  it('reads the ruler to screen readers', () => {
    expect(rulerLabel(en, 'en', { goal: 6, min: 8, max: 10 })).toBe('goal 6 reps, range 8 to 10');
  });
});
