import { useTranslation } from 'react-i18next';
import type { Language, Programme } from '@/domain';
import { sessionIdentity } from '@/features/programme/format';
import { Icon } from '@/ui/components';
import { percentText } from '../dates';
import { rowMetaText, type Coverage } from './coverage';
import styles from './Travel.module.css';

/** Each session of the rotation with what the kit leaves of it. */
export function CoverageRows({
  programme,
  coverage,
}: {
  programme: Pick<Programme, 'rotation'>;
  coverage: Coverage;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  return (
    <ul className={styles.coverage}>
      {coverage.rows.map((row) => {
        const session = programme.rotation.find((s) => s.id === row.sessionId);
        if (!session) return null;
        const identity = sessionIdentity(session, lang, programme.rotation);
        const meta = rowMetaText(t, row);
        const pct = percentText(row.share, lang);
        return (
          <li
            key={row.sessionId}
            className={styles.coverRow}
            aria-label={t('settings.travel.rowAria', {
              name: identity.fullName,
              percent: Math.round(row.share * 100),
              meta: row.low ? t('settings.travel.rowLow') : meta,
            })}
          >
            <span className={styles.tile}>
              {identity.letter ?? <Icon name="heart" size={20} />}
            </span>
            <span className={styles.coverText}>
              <span className={styles.coverName}>{identity.title}</span>
              <span className={styles.meter} aria-hidden="true">
                <i style={{ transform: `scaleX(${Math.round(row.share * 100) / 100})` }} />
              </span>
              {row.low ? (
                <span className={styles.coverLow}>
                  <Icon name="alert" size={20} />
                  {t('settings.travel.rowLow')}
                </span>
              ) : (
                <span className={styles.coverMeta}>{meta}</span>
              )}
            </span>
            <span className={styles.coverPct}>{pct}</span>
          </li>
        );
      })}
    </ul>
  );
}
