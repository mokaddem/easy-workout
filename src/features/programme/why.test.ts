import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Goal, Language, Level } from '@/domain';
import { generateProgramme, generateQuickSession, QUICK_FOCUSES } from '@/engine';
import { resources } from '@/i18n/resources';
import { equipmentSets } from '../../../tests/fixtures/equipment-sets';
import { describeNote, isInlineNote, programmeReasons } from './why';

const GOALS: Goal[] = ['muscle', 'recomposition', 'general-fitness'];
const LEVELS: Level[] = ['beginner', 'returning', 'intermediate', 'advanced'];
const DAYS = [2, 3, 4, 5, 6];

const instance = i18next.createInstance();
beforeAll(async () => {
  await instance.init({
    lng: 'fr',
    fallbackLng: false,
    resources: { fr: { translation: resources.fr }, en: { translation: resources.en } },
    interpolation: { escapeValue: false },
  });
});

const bad = (sentence: string | null) =>
  sentence === null ||
  sentence.trim() === '' ||
  /\{\{|\}\}/.test(sentence) ||
  /^(why|programme|labels|nav|common)\./.test(sentence) ||
  /\b(why|programme|labels)\.[\w.-]+/.test(sentence);

describe('describeNote', () => {
  it('gives every note shown to the user a sentence in both languages, never a raw key', () => {
    const problems: string[] = [];
    const codes = new Set<string>();
    for (const [setName, equipment] of Object.entries(equipmentSets))
      for (const goal of GOALS)
        for (const level of LEVELS)
          for (const daysPerWeek of DAYS) {
            const programme = generateProgramme({
              profile: { goal, level, daysPerWeek, sessionMinutes: 45 },
              equipment,
            });
            for (const note of programme.generation?.notes ?? []) {
              codes.add(note.code);
              for (const lang of ['fr', 'en'] as Language[]) {
                const t = instance.getFixedT(lang);
                const sentence = describeNote(note, t, lang);
                const hidden = note.code === 'exercise-preferred' && !note.params.instead;
                if (hidden ? sentence !== null : bad(sentence))
                  problems.push(
                    `${setName}/${goal}/${level}/${daysPerWeek} ${lang} ${note.code}: ${sentence}`,
                  );
              }
            }
          }
    expect(problems.slice(0, 10)).toEqual([]);
    expect(codes.size).toBeGreaterThan(10);
  });

  it('covers quick-session notes', () => {
    for (const focus of QUICK_FOCUSES) {
      const { notes } = generateQuickSession({
        profile: {
          goal: 'general-fitness',
          level: 'intermediate',
          daysPerWeek: 3,
          sessionMinutes: 45,
        },
        equipment: equipmentSets.reference!,
        minutes: 30,
        focus,
      });
      for (const note of notes)
        for (const lang of ['fr', 'en'] as Language[]) {
          const sentence = describeNote(note, instance.getFixedT(lang), lang);
          const hidden = note.code === 'exercise-preferred' && !note.params.instead;
          if (!hidden) expect(bad(sentence), `${focus} ${lang} ${note.code}`).toBe(false);
        }
    }
  });

  it('computes the starting-load share from the target and bodyweight', () => {
    const t = instance.getFixedT('en');
    const sentence = describeNote(
      {
        code: 'load-start',
        params: {
          exerciseId: 'push-up',
          kg: 10,
          targetKg: 10.5,
          bodyweightKg: 70,
          bodyweightAssumed: true,
        },
      },
      t,
      'en',
    );
    expect(sentence).toContain('15%');
    expect(sentence).toContain('70 kg');
  });

  it('shows "preferred" only when it replaced something', () => {
    const t = instance.getFixedT('fr');
    const plain = { code: 'exercise-preferred', params: { exerciseId: 'push-up', slot: 'x' } };
    expect(describeNote(plain, t, 'fr')).toBeNull();
    expect(isInlineNote(plain)).toBe(false);
    const swapped = {
      code: 'exercise-preferred',
      params: {
        exerciseId: 'dumbbell-floor-press',
        slot: 'x',
        instead: 'dumbbell-bench-press',
        missing: 'bench',
      },
    };
    expect(describeNote(swapped, t, 'fr')).toContain('banc');
    expect(isInlineNote(swapped)).toBe(true);
  });

  it('groups programme reasons by input', () => {
    const programme = generateProgramme({
      profile: { goal: 'recomposition', level: 'intermediate', daysPerWeek: 6, sessionMinutes: 45 },
      equipment: equipmentSets.reference!,
    });
    const groups = programmeReasons(programme.generation!.notes, instance.getFixedT('en'), 'en');
    expect(groups.map((g) => g.input)).toEqual(expect.arrayContaining(['schedule', 'goal']));
    for (const g of groups) expect(g.sentences.length).toBeGreaterThan(0);
  });
});
