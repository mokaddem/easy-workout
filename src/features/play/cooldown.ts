import type { TFunction } from 'i18next';
import type { Language, SessionLog } from '@/domain';
import { MUSCLE_GROUP_IDS, trainedGroups } from '@/engine';
import { listText } from '../progress/format';

/** The most groups the offer names; the routine itself decides what it stretches. */
const OFFER_MAX = 4;

/** What a cooldown after this session stretches, in the order the session worked it. */
export const offerGroups = (log: Pick<SessionLog, 'sets'>): string[] =>
  trainedGroups(log).slice(0, OFFER_MAX);

/** Display name of a stretched group: a weekly muscle group, or a single muscle. */
export const groupName = (t: TFunction, id: string): string =>
  t(
    (MUSCLE_GROUP_IDS as readonly string[]).includes(id)
      ? `progress.group.${id}`
      : `labels.muscle.${id}`,
  );

/** The one line under the cooldown offer. */
export function offerLine(t: TFunction, log: Pick<SessionLog, 'sets'>, lang: Language): string {
  const groups = offerGroups(log);
  return groups.length === 0
    ? t('play.cooldown.offerGeneral')
    : t('play.cooldown.offerGroups', {
        groups: listText(
          groups.map((g) => groupName(t, g).toLocaleLowerCase(lang)),
          lang,
        ),
      });
}
