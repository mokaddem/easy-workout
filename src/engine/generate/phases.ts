import type { Goal, Level, LocalizedText, Phase, PhaseAdjustment } from '../../domain';

export const PROGRAMME_WEEKS = 8;

export interface PhaseOptions {
  goal: Goal;
  level: Level;
  /** Whether any session has a cardio finisher that can be lengthened. */
  cardioFinishers: boolean;
  /** Exercise retested at the end of the cycle. */
  maxTest?: { exerciseId: string; name: LocalizedText };
  /** The user can add load (belt, vest) to bodyweight moves in the programme. */
  addedLoad: boolean;
}

const text = (fr: string, en: string): LocalizedText => ({ fr, en });

/** Beginners, returning trainees and general fitness skip the peak week and stop at RIR 2. */
export const hasPeak = (goal: Goal, level: Level): boolean =>
  goal !== 'general-fitness' && (level === 'intermediate' || level === 'advanced');

/** Periodisation of the 8-week cycle: re-adaptation → volume → intensity → (peak) → deload + test. */
export const phasesFor = (options: PhaseOptions): Phase[] => {
  const { cardioFinishers, maxTest, addedLoad } = options;
  const peak = hasPeak(options.goal, options.level);
  const cardio = (addMinutes: number): PhaseAdjustment[] =>
    cardioFinishers ? [{ kind: 'cardio-minutes', addMinutes }] : [];

  const phases: Phase[] = [
    {
      name: text('Réadaptation', 'Re-adaptation'),
      fromWeek: 1,
      toWeek: peak ? 2 : 3,
      adjustments: [{ kind: 'rir', value: 3, scope: 'all-sets' }],
      note: text(
        'Apprends les mouvements, note tes charges.',
        'Learn the movements and log your loads.',
      ),
    },
    {
      name: text('Volume', 'Volume'),
      fromWeek: peak ? 3 : 4,
      toWeek: peak ? 4 : 5,
      adjustments: [{ kind: 'extra-sets', add: 1, mainBlockIndexes: [0, 1] }, ...cardio(5)],
    },
    {
      name: text('Intensité', 'Intensity'),
      fromWeek: peak ? 5 : 6,
      toWeek: peak ? 6 : 7,
      adjustments: [{ kind: 'rir', value: peak ? 1 : 2, scope: 'first-set' }, ...cardio(10)],
      ...(addedLoad
        ? {
            note: text(
              'Ajoute du lest sur un mouvement au poids du corps dès que tu dépasses le haut de la fourchette en reps strictes.',
              'Add load to a bodyweight move once you get past the top of its rep range with strict reps.',
            ),
          }
        : {}),
    },
  ];
  if (peak)
    phases.push({
      name: text('Pic', 'Peak'),
      fromWeek: 7,
      toWeek: 7,
      adjustments: [{ kind: 'rir', value: 1, scope: 'last-set' }, ...cardio(10)],
      note: text(
        'Charges maximales, RIR 1 sur les dernières séries.',
        'Heaviest loads, RIR 1 on the last sets.',
      ),
    });
  phases.push({
    name: text('Décharge + test', 'Deload + test'),
    fromWeek: PROGRAMME_WEEKS,
    toWeek: PROGRAMME_WEEKS,
    adjustments: [
      { kind: 'volume', factor: 0.6 },
      { kind: 'rir', value: 3, scope: 'all-sets' },
      ...(maxTest ? [{ kind: 'max-test' as const, exerciseIds: [maxTest.exerciseId] }] : []),
    ],
    ...(maxTest
      ? {
          note: text(
            `Semaine allégée, puis test max : ${maxTest.name.fr.toLowerCase()}.`,
            `Lighter week, then a max test: ${maxTest.name.en.toLowerCase()}.`,
          ),
        }
      : {}),
  });
  return phases;
};
