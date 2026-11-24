import type { TFunction } from 'i18next';
import type { JointRegion, Language } from '@/domain';
import type { Draft } from './model';

export type JointForm = 'label' | 'the' | 'your';

/** A joint's name in one of its authored forms: "Genou", "le genou", "ton genou". */
export const jointName = (t: TFunction, region: JointRegion, form: JointForm = 'label'): string =>
  t(`labels.joint.${region}.${form}`);

export const capital = (text: string): string =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

/** "ton genou et ton épaule": the authored forms, joined like a spoken list. */
export function jointsText(
  t: TFunction,
  lang: Language,
  regions: readonly JointRegion[],
  form: JointForm = 'your',
): string {
  const names = regions.map((r) => jointName(t, r, form));
  return new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(names);
}

/**
 * What is avoided, for a row's meta: the joints by name, then "no jumping", then "small space".
 * Lower case after the first item. Empty when nothing is.
 */
export function constraintsMeta(
  t: TFunction,
  draft: Pick<Draft, 'regions' | 'quiet' | 'smallSpace'>,
): string | undefined {
  const parts = [
    ...draft.regions.map((r) => jointName(t, r)),
    ...(draft.quiet ? [t('settings.quietShort')] : []),
    ...(draft.smallSpace ? [t('settings.spaceShort')] : []),
  ].map((part, i) => (i === 0 ? capital(part) : part.charAt(0).toLowerCase() + part.slice(1)));
  if (parts.length === 0) return undefined;
  return parts.join(', ');
}
