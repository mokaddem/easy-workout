import { catalogue as defaultCatalogue } from '../../catalogue';
import type {
  EquipmentInventory,
  Exercise,
  GenerationNote,
  LocalizedText,
  Profile,
  Session,
} from '../../domain';
import { buildSession } from './build';
import { makeContext } from './programme';
import { newSelectionState } from './select';
import { template } from './templates';
import type { SessionTemplate, TemplateKey } from './types';

export const QUICK_FOCUSES = ['full', 'upper', 'lower', 'push', 'pull', 'core', 'cardio'] as const;
export type QuickFocus = (typeof QUICK_FOCUSES)[number];

/** Templates per focus; a seed rotates through them for "give me another one". */
const FOCUS_TEMPLATES: Record<QuickFocus, readonly TemplateKey[]> = {
  full: ['full-a', 'full-b', 'full-c'],
  upper: ['upper-a', 'upper-b'],
  lower: ['lower-a', 'lower-b'],
  push: ['push'],
  pull: ['pull'],
  core: ['core'],
  cardio: ['cardio'],
};

const FOCUS_TITLE: Record<QuickFocus, LocalizedText> = {
  full: { fr: 'Full body', en: 'Full body' },
  upper: { fr: 'Haut du corps', en: 'Upper body' },
  lower: { fr: 'Bas du corps', en: 'Lower body' },
  push: { fr: 'Push', en: 'Push' },
  pull: { fr: 'Pull', en: 'Pull' },
  core: { fr: 'Gainage', en: 'Core' },
  cardio: { fr: 'Cardio', en: 'Cardio' },
};

export interface QuickSessionInput {
  /** Goal, level and bodyweight are used; days and session length are not. */
  profile: Profile;
  /** Equipment available today: all owned by default, `[]` for bodyweight only. */
  equipment: EquipmentInventory;
  minutes: number;
  focus: QuickFocus;
  seed?: number;
}

export interface QuickSession {
  session: Session;
  notes: GenerationNote[];
}

/** A cardio session lasts exactly the time asked for; at home, intervals come before a walk. */
const cardioTemplate = (minutes: number): SessionTemplate => {
  const base = template('cardio');
  return {
    ...base,
    main: base.main.map((b) =>
      b.type === 'cardio'
        ? { ...b, cardio: { ...b.cardio, minutes: [minutes, minutes] as const } }
        : b,
    ),
  };
};

/** A one-off session for a focus and a time budget. It carries no progression. */
export const generateQuickSession = (
  input: QuickSessionInput,
  exercises: readonly Exercise[] = defaultCatalogue,
): QuickSession => {
  const seed = input.seed ?? 0;
  const ctx = makeContext({ profile: input.profile, equipment: input.equipment, seed }, exercises);
  const keys = FOCUS_TEMPLATES[input.focus];
  const key = keys[seed % keys.length]!;
  const tpl = input.focus === 'cardio' ? cardioTemplate(input.minutes) : template(key);
  ctx.log.add('quick-session', { focus: input.focus, minutes: input.minutes, template: key });

  const title = FOCUS_TITLE[input.focus];
  const session = buildSession(tpl, ctx, newSelectionState(), {
    id: `quick-${input.focus}`,
    // The cardio focus is named after its modality, added by the session builder.
    name:
      input.focus === 'cardio'
        ? { fr: 'Séance express', en: 'Quick session' }
        : { fr: `Séance express — ${title.fr}`, en: `Quick session — ${title.en}` },
    budget: input.minutes,
    // Exactly the minutes asked for; at home, intervals win over a walk outside.
    cardioPlace: 'finisher',
  });
  // Built without a minimum block count, so a session always comes back.
  return { session: session!, notes: ctx.log.notes };
};
