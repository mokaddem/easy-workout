import type { EquipmentInventory, Goal, Level, Profile } from '@/domain';

export const DAYS_RANGE = { min: 2, max: 6, step: 1 } as const;
export const MINUTES_RANGE = { min: 15, max: 90, step: 5 } as const;
export const BODYWEIGHT_RANGE = { min: 30, max: 250 } as const;
export const STEP_COUNT = 5;

/** Everything the user has answered so far; survives step changes and reloads. */
export interface Draft {
  goal: Goal | null;
  level: Level | null;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: EquipmentInventory;
  /** Raw text of the bodyweight field. */
  bodyweight: string;
}

export const emptyDraft = (): Draft => ({
  goal: null,
  level: null,
  daysPerWeek: 3,
  sessionMinutes: 45,
  equipment: [],
  bodyweight: '',
});

export type BodyweightResult =
  { status: 'empty' } | { status: 'ok'; kg: number } | { status: 'invalid' };

/** Accepts "74.5" and "74,5"; empty means skipped. */
export function parseBodyweight(raw: string): BodyweightResult {
  const text = raw.trim().replace(',', '.');
  if (text === '') return { status: 'empty' };
  if (!/^\d+(\.\d+)?$/.test(text)) return { status: 'invalid' };
  const kg = Math.round(Number(text) * 10) / 10;
  return kg >= BODYWEIGHT_RANGE.min && kg <= BODYWEIGHT_RANGE.max
    ? { status: 'ok', kg }
    : { status: 'invalid' };
}

export function parseBodyweightKg(raw: string): number | null {
  const result = parseBodyweight(raw);
  return result.status === 'ok' ? result.kg : null;
}

/** First step whose answer is missing or wrong, or null when the draft can be generated. */
export function firstIncompleteStep(draft: Draft): number | null {
  if (!draft.goal) return 1;
  if (!draft.level) return 2;
  if (parseBodyweight(draft.bodyweight).status === 'invalid') return 5;
  return null;
}

/** A profile from a complete draft; null while the goal or level is missing or the weight is invalid. */
export function draftProfile(draft: Draft): Profile | null {
  const weight = parseBodyweight(draft.bodyweight);
  if (!draft.goal || !draft.level || weight.status === 'invalid') return null;
  return {
    goal: draft.goal,
    level: draft.level,
    daysPerWeek: draft.daysPerWeek,
    sessionMinutes: draft.sessionMinutes,
    ...(weight.status === 'ok' ? { bodyweightKg: weight.kg } : {}),
  };
}

const KEY = 'easy-workout.onboarding-draft';

export function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Draft>;
      return { ...emptyDraft(), ...parsed };
    }
  } catch {
    // Storage unavailable or corrupt: start fresh.
  }
  return emptyDraft();
}

export function saveDraft(draft: Draft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Not persisted; the draft still lives in memory.
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
