import { useTranslation } from 'react-i18next';
import { useProgrammes, useSessionLogs } from '@/app/data';
import { goBack, handleLinkClick, routeHref } from '@/app/router';
import type { Language } from '@/domain';
import { AppBar, EmptyState, Icon, Skeleton } from '@/ui/components';
import { byYear, pastEntries, type PastEntry } from './past';
import styles from './Past.module.css';

const dateText = (lang: Language, iso: string) =>
  new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));

/** Finished cycles and replaced programmes, read-only, newest first. */
export function PastScreen() {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const programmes = useProgrammes();
  const logs = useSessionLogs();
  const entries = programmes && logs ? pastEntries(programmes, logs) : undefined;
  return (
    <>
      <AppBar title={t('cycle.past.title')} onBack={goBack} backLabel={t('cycle.past.back')} />
      {!entries ? (
        <div className={styles.list}>
          <Skeleton height={88} radius="var(--radius-md)" />
          <Skeleton height={88} radius="var(--radius-md)" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={t('cycle.past.emptyTitle')}
          description={t('cycle.past.emptyBody')}
        />
      ) : (
        <div className={styles.list}>
          <p className={styles.intro}>{t('cycle.past.intro')}</p>
          {byYear(entries).map((group) => (
            <section key={group.year}>
              <h2 className={styles.year}>{group.year}</h2>
              {group.entries.map((entry) => (
                <Row key={entry.record.id} entry={entry} lang={lang} />
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function Row({ entry, lang }: { entry: PastEntry; lang: Language }) {
  const { t } = useTranslation();
  const href = routeHref({ name: 'past-programme', programmeId: entry.record.id });
  return (
    <a className={styles.row} href={href} onClick={(event) => handleLinkClick(event, href)}>
      {entry.finished ? (
        <span className={styles.well}>
          <span className={styles.num}>{entry.cycle}</span>
          <small>{t('cycle.past.cycleWell')}</small>
        </span>
      ) : (
        <span className={`${styles.well} ${styles.replaced}`} aria-hidden="true">
          <Icon name="refresh" />
        </span>
      )}
      <span className={styles.text}>
        <span className={styles.name}>{t(`labels.goal.${entry.record.goal}`)}</span>
        <span className={styles.meta}>
          {entry.from && entry.to && entry.sessions > 0
            ? t('cycle.past.meta', {
                from: dateText(lang, entry.from),
                to: dateText(lang, entry.to),
                count: entry.sessions,
              })
            : t('cycle.past.metaNone')}
        </span>
        <span className={styles.line}>
          <Icon name={entry.finished ? 'check' : 'refresh'} size={20} />
          <span>
            {entry.finished
              ? t('cycle.past.finished')
              : t('cycle.past.replaced', { week: entry.week })}
          </span>
        </span>
      </span>
      <Icon name="chev-right" size={20} />
    </a>
  );
}
