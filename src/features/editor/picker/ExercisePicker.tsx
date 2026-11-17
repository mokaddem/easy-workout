import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById, catalogue } from '@/catalogue';
import { useAnswers, useEquipment, useProfile } from '@/app/data';
import { switchBack } from '@/app/progress';
import type { Exercise, Language, Section } from '@/domain';
import { activeSwaps, substitutesFor } from '@/engine';
import { Roll } from '@/motion';
import { Dialog, EmptyState, IconButton } from '@/ui/components';
import { useModalDialog } from '@/ui/components/useModalDialog';
import { FilterButton } from './FilterButton';
import { FilterSheet } from './FilterSheet';
import { PickRow } from './PickRow';
import { SearchField } from './SearchField';
import {
  countFor,
  filterOptions,
  hasFilters,
  listEntries,
  missingMatches,
  NO_FILTERS,
  pickable,
  suggested,
  type Entry,
  type Filters,
} from './list';
import { usePickerHistory } from './usePickerHistory';
import styles from './picker.module.css';

export interface ExercisePickerProps {
  open: boolean;
  mode: 'add' | 'replace';
  section: Section;
  /** Replace mode: the exercise being replaced — its suggested substitutes come first. */
  replacing?: string;
  /** Exercises already in the session: marked, still pickable. */
  inSession?: ReadonlySet<string>;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}

/** Full-screen exercise picker used by the session editor. */
export function ExercisePicker(props: ExercisePickerProps) {
  const { open, onClose } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  useModalDialog(dialog, open, onClose);
  usePickerHistory(open, onClose);

  return (
    <dialog ref={dialog} className={styles.root} aria-labelledby="exercise-picker-title">
      {open ? <PickerBody {...props} /> : null}
    </dialog>
  );
}

function PickerBody({ mode, section, replacing, inSession, onPick, onClose }: ExercisePickerProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const inventory = useEquipment();
  const profile = useProfile();
  const answers = useAnswers();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [bringBack, setBringBack] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const swaps = useMemo(() => activeSwaps(answers ?? []), [answers]);

  const entries = useMemo<Entry[]>(
    () =>
      inventory && profile
        ? pickable(
            catalogue,
            {
              inventory,
              level: profile.level,
              ...(profile.bodyweightKg !== undefined && { bodyweightKg: profile.bodyweightKg }),
            },
            section,
          )
        : [],
    [inventory, profile, section],
  );

  const replaced = replacing ? exerciseById.get(replacing) : undefined;
  const searching = query.trim() !== '' || hasFilters(filters);

  const shown = useMemo(
    () => listEntries(entries, section, query, filters, lang),
    [entries, section, query, filters, lang],
  );
  const options = useMemo(() => filterOptions(entries, section), [entries, section]);

  const suggestions = useMemo<Entry[]>(() => {
    if (mode !== 'replace' || !replaced || !inventory) return [];
    return suggested(
      substitutesFor(replaced, inventory, { avoid: swaps.painful }),
      entries,
      section,
    );
  }, [mode, replaced, inventory, swaps, entries, section]);

  const unowned = useMemo(
    () =>
      shown.length === 0 && inventory
        ? missingMatches(catalogue, entries, inventory, section, query, filters)
        : { count: 0, missing: [] },
    [shown.length, inventory, entries, section, query, filters],
  );

  const loading = !inventory || !profile;
  const showSuggestions = mode === 'replace' && !searching && !loading;
  const suggestedIds = new Set(suggestions.map((s) => s.exercise.id));
  const rest = showSuggestions ? shown.filter((en) => !suggestedIds.has(en.exercise.id)) : shown;
  const filterCount = countFor(entries, section, query, filters);

  const muscleList = (e: Exercise) =>
    e.primaryMuscles.map((m) => t(`labels.muscle.${m}`).toLocaleLowerCase(lang)).join(', ');

  const row = (entry: Entry): ReactNode => {
    const { exercise } = entry;
    const replacement = swaps.to.get(exercise.id);
    const current = exercise.id === replacing;
    const away = !current && replacement ? exerciseById.get(replacement) : undefined;
    const meta = inSession?.has(exercise.id)
      ? t('picker.inSession')
      : t('picker.meta', {
          pattern: t(`labels.pattern.${exercise.pattern}`),
          muscles: muscleList(exercise),
        });
    return (
      <PickRow
        key={exercise.id}
        exercise={exercise}
        name={exercise.name[lang]}
        meta={meta}
        {...(current && { current: true })}
        {...(away && { away: t('picker.away', { name: away.name[lang] }) })}
        tag={
          current
            ? t('picker.current')
            : entry.concern
              ? t(`picker.concern.${entry.concern}`, { defaultValue: '' }) || null
              : undefined
        }
        onPick={() => (away ? setBringBack(exercise.id) : onPick(exercise.id))}
      />
    );
  };

  const confirmBack = async () => {
    if (!bringBack || busy) return;
    setBusy(true);
    try {
      await switchBack(bringBack);
      const id = bringBack;
      setBringBack(null);
      onPick(id);
    } finally {
      setBusy(false);
    }
  };

  const back = bringBack ? exerciseById.get(bringBack) : undefined;
  const backReplacement = bringBack ? exerciseById.get(swaps.to.get(bringBack) ?? '') : undefined;

  const filterLabel = (group: 'movement' | 'muscle', values: readonly string[]): string => {
    const name = t(`picker.${group}`);
    if (values.length === 0) return name;
    if (values.length === 1)
      return t('picker.filterOne', {
        group: name,
        value: t(`labels.${group === 'movement' ? 'pattern' : 'muscle'}.${values[0]}`),
      });
    return t('picker.filterMany', { group: name, count: values.length });
  };

  const title = mode === 'replace' ? t('picker.replace') : t(`picker.addTo.${section}`);

  return (
    <div className={styles.panel}>
      <header className={styles.bar}>
        <IconButton icon="back" label={t('picker.back')} onClick={onClose} />
        <div className={styles.barText}>
          <h1 id="exercise-picker-title" className={styles.barTitle}>
            {title}
          </h1>
          {mode === 'replace' && replaced ? (
            <span className={styles.barMeta}>{replaced.name[lang]}</span>
          ) : null}
        </div>
      </header>

      <div className={styles.top}>
        <SearchField
          value={query}
          onChange={setQuery}
          label={t('picker.search')}
          clearLabel={t('picker.clear')}
        />
        <div className={styles.filters}>
          <FilterButton
            label={filterLabel('movement', [...filters.patterns])}
            active={filters.patterns.size > 0}
            onClick={() => setFilterOpen(true)}
          />
          <FilterButton
            label={filterLabel('muscle', [...filters.muscles])}
            active={filters.muscles.size > 0}
            onClick={() => setFilterOpen(true)}
          />
        </div>
      </div>

      <div className={styles.scroll}>
        {loading ? null : shown.length === 0 ? (
          <EmptyState
            className={styles.empty}
            icon="search"
            title={t('picker.empty.title')}
            description={
              unowned.count > 0 ? (
                <Bold
                  text={t('picker.empty.equipment', {
                    count: unowned.count,
                    equipment: unowned.missing
                      .map((k) => t(`labels.equipment.${k}`, { defaultValue: k }).toLowerCase())
                      .join(', '),
                  })}
                />
              ) : (
                t('picker.empty.body')
              )
            }
            actionLabel={
              hasFilters(filters) ? t('picker.empty.clearFilters') : t('picker.empty.clearSearch')
            }
            actionVariant="secondary"
            onAction={() => {
              if (hasFilters(filters)) setFilters(NO_FILTERS);
              else setQuery('');
            }}
          />
        ) : (
          <>
            {showSuggestions ? (
              <section aria-labelledby="picker-suggested">
                <div className={styles.head}>
                  <h2 id="picker-suggested">{t('picker.suggested')}</h2>
                  {suggestions.length > 0 ? <p>{t('picker.suggestedLine')}</p> : null}
                </div>
                {suggestions.length > 0 ? (
                  <ul className={styles.list}>{suggestions.map(row)}</ul>
                ) : (
                  <p className={styles.none}>{t('picker.noSuggestion')}</p>
                )}
              </section>
            ) : null}
            <section aria-labelledby="picker-all">
              <div className={styles.head}>
                <h2 id="picker-all">
                  {searching ? t('picker.results') : t('picker.all')}
                  <span aria-live="polite">
                    <Roll value={rest.length}>{t('picker.allCount', { count: rest.length })}</Roll>
                  </span>
                </h2>
              </div>
              <ul className={styles.list}>{rest.map(row)}</ul>
            </section>
            <p className={styles.note}>{t('picker.ownedNote')}</p>
          </>
        )}
      </div>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        options={options}
        value={filters}
        onChange={setFilters}
        count={filterCount}
      />

      <Dialog
        open={bringBack !== null}
        onClose={() => setBringBack(null)}
        title={t('picker.bringBack.title')}
        description={
          back && backReplacement ? (
            <>
              <Bold
                text={t('picker.bringBack.body', {
                  name: back.name[lang],
                  replacement: backReplacement.name[lang],
                })}
              />
              {bringBack && swaps.painful.has(bringBack) ? (
                <span className={styles.dialogLine}>{t('picker.bringBack.pain')}</span>
              ) : null}
              <span className={styles.dialogLine}>
                {t(
                  mode === 'replace' ? 'picker.bringBack.hereReplace' : 'picker.bringBack.hereAdd',
                )}
              </span>
            </>
          ) : null
        }
        confirmLabel={t('picker.bringBack.confirm')}
        cancelLabel={t('picker.bringBack.cancel')}
        confirmLoading={busy}
        onConfirm={() => void confirmBack()}
      />
    </div>
  );
}

/** A string with `<b>…</b>` emphasis. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(<b>.*?<\/b>)/g)
        .map((part, i) =>
          part.startsWith('<b>') ? <strong key={i}>{part.slice(3, -4)}</strong> : part,
        )}
    </>
  );
}
