import type { TFunction } from 'i18next';
import { isHousehold, type EquipmentInventory, type Exercise, type Language } from '@/domain';
import type { Issue, IssueCode } from '@/engine';

const KEYS: Record<IssueCode, string> = {
  'main-empty': 'emptyMain',
  'group-too-small': 'groupTooSmall',
  'range-invalid': 'rangeInvalid',
  'unknown-exercise': 'unknownExercise',
  'no-equipment': 'equipment',
  'doorway-bar': 'doorwayBar',
  'selector-swing': 'selectorSwing',
  'cardio-in-group': 'cardioInGroup',
  'rope-beginner': 'ropeBeginner',
  'no-fitting-load': 'noFittingLoad',
  'lead-not-main-lift': 'isolationFirst',
  'warmup-in-main': 'warmupInMain',
  'no-warmup': 'noWarmup',
  'above-level': 'aboveLevel',
  'rir-zero-loaded': 'failureLoaded',
  'rir-beginner': 'beginnerEffort',
  'short-rest-heavy': 'shortRest',
  'many-sets': 'manySets',
  'session-volume': 'sessionVolume',
  'muscle-volume': 'muscleVolume',
  'repeat-exercise': 'duplicate',
  'over-budget': 'sessionVolume',
  'under-budget': 'sessionVolume',
  'muscle-group-low': 'groupLow',
  'push-pull': 'pushPull',
};

/** Equipment kinds the cheapest way of doing an exercise needs and the person doesn't own. */
export function missingKinds(exercise: Exercise, inventory: EquipmentInventory): string[] {
  const owned = new Set<string>(inventory.map((i) => i.kind));
  let best: string[] | undefined;
  for (const setup of exercise.equipment) {
    const missing = [
      ...new Set(
        setup.filter((r) => !isHousehold(r.kind) && !owned.has(r.kind)).map((r) => r.kind),
      ),
    ];
    if (!best || missing.length < best.length) best = missing;
  }
  return best ?? [];
}

export interface IssueContext {
  lang: Language;
  inventory: EquipmentInventory;
  /** The exercise the issue is about, when it has one. */
  exercise?: Exercise | undefined;
  exercises: ReadonlyMap<string, Exercise>;
}

/** The sentence for an issue, in the current language. */
export function issueText(t: TFunction, issue: Issue, ctx: IssueContext): string {
  const params: Record<string, string | number> = { ...issue.params };
  if (issue.code === 'no-equipment') {
    const missing = ctx.exercise ? missingKinds(ctx.exercise, ctx.inventory) : [];
    if (missing.length === 0) return t('editor.issue.equipmentGeneric');
    params.equipment = new Intl.ListFormat(ctx.lang, { type: 'conjunction' }).format(
      missing.map((kind) => t(`labels.equipment.${kind}`).toLocaleLowerCase(ctx.lang)),
    );
  }
  if (issue.code === 'muscle-volume') params.muscle = t(`labels.muscle.${String(params.muscle)}`);
  if (issue.code === 'muscle-group-low')
    params.group = t(`editor.issue.group.${String(params.group)}`);
  if (issue.code === 'repeat-exercise')
    params.name = ctx.exercises.get(String(params.exerciseId))?.name[ctx.lang] ?? '';
  return t(`editor.issue.${KEYS[issue.code]}`, params);
}

/** What a block issue's compact action does. */
export type IssueAction = 'replace' | 'add' | 'ungroup' | null;

export function actionFor(issue: Issue): IssueAction {
  switch (issue.code) {
    case 'main-empty':
      return 'add';
    case 'group-too-small':
    case 'cardio-in-group':
      return 'ungroup';
    case 'no-equipment':
    case 'doorway-bar':
    case 'selector-swing':
    case 'unknown-exercise':
      return 'replace';
    default:
      return null;
  }
}
