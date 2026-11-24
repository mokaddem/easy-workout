import { useTranslation } from 'react-i18next';
import type { Language } from '@/domain';
import { Icon, IssueLine } from '@/ui/components';
import { jointsText } from '../settings/constraints/joints';
import { exerciseName } from './format';
import type { Cause, InPlaceData } from './preview';
import styles from './InPlace.module.css';

/** The reason a slot was left out, under its row in the change list. */
export function InPlaceCause({ cause }: { cause: Cause | undefined }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  if (!cause) return null;
  return (
    <span className={styles.cause}>
      {cause.cause === 'region'
        ? t('settings.preview.causeRegion', { joint: jointsText(t, lang, cause.regions, 'your') })
        : t(
            cause.cause === 'quiet' ? 'settings.preview.causeQuiet' : 'settings.preview.causeSpace',
          )}
    </span>
  );
}

/**
 * "Good to know": fewer sets for a muscle, the user's own picks the new constraints advise
 * against (kept), swaps set aside, and how lifted joints ease back in. Nothing shows without lines.
 */
export function InPlaceNotes({
  data,
  lang,
  sessionTitle,
}: {
  data: InPlaceData;
  lang: Language;
  sessionTitle: (sessionId: string) => string;
}) {
  const { t } = useTranslation();
  const joint = (regions: Parameters<typeof jointsText>[2]) => jointsText(t, lang, regions, 'your');
  const muscle = (id: string) => {
    const name = t(`labels.muscle.${id}`);
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  const lines =
    data.volume.length + data.outEdits.length + data.blockedSwaps.length + data.lifted.length;
  if (lines === 0) return null;
  return (
    <section className={styles.aside} aria-label={t('settings.preview.aside')}>
      <h3 className={styles.asideTitle}>{t('settings.preview.aside')}</h3>
      {data.volume.map((v) => (
        <p key={v.muscle} className={styles.line}>
          <Icon name="joint" size={20} />
          <span>
            {t('settings.preview.volume', {
              muscle: muscle(v.muscle),
              before: v.before,
              after: v.after,
              joint: joint(v.regions),
            })}
          </span>
        </p>
      ))}
      {data.outEdits.map((o) => (
        <IssueLine key={`${o.sessionId}|${o.exerciseId}`} level="warn" className={styles.issueLine}>
          {t(
            o.cause.cause === 'region'
              ? 'settings.preview.outEdit'
              : o.cause.cause === 'quiet'
                ? 'settings.preview.outEditQuiet'
                : 'settings.preview.outEditSpace',
            {
              session: sessionTitle(o.sessionId),
              name: exerciseName(o.exerciseId, lang),
              joint: o.cause.cause === 'region' ? joint(o.cause.regions) : '',
            },
          )}
        </IssueLine>
      ))}
      {data.blockedSwaps.map((b) => (
        <p key={`${b.sessionId}|${b.exerciseId}`} className={styles.line}>
          <Icon name="swap" size={20} />
          <span>
            {t(
              b.cause.cause === 'region'
                ? 'settings.preview.blockedSwap'
                : b.cause.cause === 'quiet'
                  ? 'settings.preview.blockedSwapQuiet'
                  : 'settings.preview.blockedSwapSpace',
              {
                name: exerciseName(b.exerciseId, lang),
                joint: b.cause.cause === 'region' ? joint(b.cause.regions) : '',
              },
            )}
          </span>
        </p>
      ))}
      {data.lifted.length > 0 ? (
        <p className={styles.line}>
          <Icon name="info" size={20} />
          <span>{t('settings.preview.liftEasing')}</span>
        </p>
      ) : null}
    </section>
  );
}
