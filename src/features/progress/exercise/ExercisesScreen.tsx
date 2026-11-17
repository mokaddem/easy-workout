import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { useMaxTests, useProgrammes, useSessionLogs } from '@/app/data';
import { goBack, navigate } from '@/app/router';
import type { Language } from '@/domain';
import { exerciseList, highlights } from '@/engine';
import { SearchField } from '@/features/editor/picker/SearchField';
import { AppBar, EmptyState, Skeleton } from '@/ui/components';
import { ExerciseRow } from './ExerciseRow';
import { listView } from './logic';
import { noteTag } from './noteTag';
import styles from './exercise.module.css';

/** Every exercise done, recent first, then by movement family; search flattens it. */
export function ExercisesScreen() {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const logs = useSessionLogs();
  const programmes = useProgrammes();
  const tests = useMaxTests();
  const [query, setQuery] = useState('');

  const items = useMemo(
    () => (logs && programmes ? exerciseList(logs, programmes) : undefined),
    [logs, programmes],
  );
  const tags = useMemo(() => {
    const map = new Map<string, ReturnType<typeof noteTag> | { record: true }>();
    if (!logs || !programmes || !tests) return map;
    for (const h of highlights(logs, programmes, tests, new Date())) {
      if (h.kind === 'note') {
        const assisted = exerciseById.get(h.exerciseId)?.loadType === 'band-assisted';
        const tag = noteTag(t, lang, h.note, assisted);
        if (tag) map.set(h.exerciseId, tag);
      } else if (h.kind === 'best') map.set(h.exerciseId, { record: true });
    }
    return map;
  }, [logs, programmes, tests, t, lang]);

  const view = useMemo(
    () => (items ? listView(items, exerciseById, lang, query) : undefined),
    [items, lang, query],
  );

  const bar = (
    <AppBar
      title={t('stats.exercises.title')}
      {...(items ? { meta: t('stats.exercises.meta', { count: items.length }) } : {})}
      onBack={goBack}
      backLabel={t('common.back')}
    />
  );

  if (!items || !view)
    return (
      <>
        {bar}
        <div className={styles.skeleton}>
          <Skeleton height={56} radius="var(--radius-md)" />
          <Skeleton height={76} />
          <Skeleton height={76} />
          <Skeleton height={76} />
        </div>
      </>
    );

  const rows = (list: typeof items) =>
    list.map((item) => {
      const tag = tags.get(item.exerciseId);
      return (
        <ExerciseRow
          key={item.exerciseId}
          item={item}
          exercise={exerciseById.get(item.exerciseId)}
          {...(tag && { tag })}
          onOpen={() => navigate({ name: 'exercise', exerciseId: item.exerciseId })}
        />
      );
    });

  return (
    <>
      {bar}
      <div className={styles.scroll}>
        {items.length === 0 ? (
          <EmptyState
            icon="chart"
            title={t('stats.exercises.emptyTitle')}
            description={t('stats.exercises.emptyBody')}
          />
        ) : (
          <>
            <div className={styles.searchWrap}>
              <SearchField
                value={query}
                onChange={setQuery}
                label={t('stats.exercises.search')}
                clearLabel={t('picker.clear')}
              />
            </div>
            <div className={styles.listPage}>
              {view.flat ? (
                view.flat.length > 0 ? (
                  <ul className={styles.rows}>{rows(view.flat)}</ul>
                ) : (
                  <EmptyState
                    icon="search"
                    title={t('stats.exercises.noMatch')}
                    description={t('stats.exercises.noMatchBody')}
                  />
                )
              ) : (
                <>
                  <section className={styles.section} aria-labelledby="ex-recent">
                    <h2 id="ex-recent" className={styles.title}>
                      {t('stats.exercises.recent')}
                    </h2>
                    <ul className={styles.rows}>{rows(view.recent)}</ul>
                  </section>
                  {view.groups.map((g) => (
                    <section
                      key={g.family}
                      className={styles.section}
                      aria-labelledby={`ex-${g.family}`}
                    >
                      <div className={styles.head}>
                        <h2 id={`ex-${g.family}`} className={styles.title}>
                          {t(`stats.exercises.family.${g.family}`)}
                        </h2>
                        <span className={styles.count}>{g.items.length}</span>
                      </div>
                      <ul className={styles.rows}>{rows(g.items)}</ul>
                    </section>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
