import { useTranslation } from 'react-i18next';
import { handleLinkClick, navigate, routeHref } from '@/app/router';
import type { Language } from '@/domain';
import { PresenceList, RowMotion } from '@/motion';
import { Button, EmptyCard, Icon, Skeleton } from '@/ui/components';
import { MineRowView } from './MineRowView';
import { trimRows } from './logic';
import { useMineRows } from './useMine';
import styles from './Mine.module.css';

const newSession = () => navigate({ name: 'edit', target: 'mine', sessionId: 'new' });

/** "My sessions" on top of the Quick session tab: the most recent ones, and the way to make another. */
export function MineSection({ all = false }: { all?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const rows = useMineRows(lang);
  const headingId = 'mine-heading';

  if (!rows)
    return (
      <section className={styles.skeleton} aria-busy="true" aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.title}>
          {t('quick.mine.title')}
        </h2>
        <Skeleton height={80} radius="var(--radius-md)" />
        <Skeleton height={80} radius="var(--radius-md)" />
      </section>
    );

  if (rows.length === 0)
    return (
      <section className={styles.section} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.title}>
          {t('quick.mine.title')}
        </h2>
        <EmptyCard
          icon="bookmark"
          title={t('quick.mine.emptyTitle')}
          description={t('quick.mine.emptyBody')}
          actionLabel={t('quick.mine.new')}
          onAction={newSession}
        />
      </section>
    );

  const { shown, total, trimmed } = all
    ? { shown: rows, total: rows.length, trimmed: false }
    : trimRows(rows);
  const now = new Date();
  const listHref = routeHref({ name: 'mine-list' });
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.head}>
        {all ? (
          <h1 id={headingId} className={styles.pageTitle}>
            {t('quick.mine.title')}
          </h1>
        ) : (
          <h2 id={headingId} className={styles.title}>
            {t('quick.mine.title')}
          </h2>
        )}
        <span className={styles.count}>{total}</span>
      </div>
      <ul className={styles.rows}>
        <PresenceList>
          {shown.map((row) => (
            <RowMotion as="li" key={row.id}>
              <MineRowView row={row} now={now} />
            </RowMotion>
          ))}
        </PresenceList>
        {trimmed ? (
          <li>
            <a
              href={listHref}
              className={styles.row}
              onClick={(event) => handleLinkClick(event, listHref)}
            >
              <span className={styles.text}>
                <span className={styles.name}>{t('quick.mine.seeAll', { count: total })}</span>
              </span>
              <Icon name="chev-right" className={styles.chev} />
            </a>
          </li>
        ) : null}
      </ul>
      <Button variant="secondary" fullWidth icon="plus" onClick={newSession}>
        {t('quick.mine.new')}
      </Button>
    </section>
  );
}
