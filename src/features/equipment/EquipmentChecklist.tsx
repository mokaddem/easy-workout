import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BandLevel, EquipmentInventory, EquipmentItem, Language } from '@/domain';
import { IncludedList, useToast } from '@/ui/components';
import { defaultItem } from './defaults';
import { GROUPS, HOUSEHOLD, entryOf, type Entry } from './entries';
import { EquipmentCard } from './EquipmentCard';
import { SpecForm } from './SpecForm';
import { summarize } from './summary';
import { itemError, type ItemError } from './validation';
import styles from './EquipmentChecklist.module.css';

export interface EquipmentChecklistProps {
  value: EquipmentInventory;
  onChange: (next: EquipmentInventory) => void;
  /** Show per-item validation messages (after the user tried to continue or save). */
  showErrors?: boolean;
  /** Ids of items whose specs start expanded, and scrolled into view. */
  initialOpen?: readonly string[];
}

const ERROR_KEY: Record<ItemError, string> = {
  'no-weights': 'equipment.errors.noWeights',
  range: 'equipment.errors.range',
  'no-levels': 'equipment.errors.noLevels',
  invalid: 'equipment.errors.invalid',
};

/** Every equipment kind as a checklist; ticking an item opens its specs. Shared by onboarding and the editor. */
export function EquipmentChecklist({
  value,
  onChange,
  showErrors = false,
  initialOpen = [],
}: EquipmentChecklistProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(initialOpen));
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = initialOpen[0];
    if (!id) return;
    root.current
      ?.querySelector(`[data-item-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: 'center' });
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemFor = (entry: Entry): EquipmentItem | undefined =>
    value.find((item) => entryOf(item) === entry);

  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const tick = (entry: Entry) => {
    const existing = itemFor(entry);
    if (!existing) {
      const created = defaultItem(entry.kind, entry.mode);
      onChange([...value, created]);
      if (entry.form) setOpen((prev) => new Set(prev).add(created.id));
      return;
    }
    const previous = value;
    onChange(value.filter((item) => item !== existing));
    if (entry.form) {
      toast.show({
        message: t('equipment.removed', { name: entryName(entry) }),
        action: { label: t('common.undo'), onAction: () => onChange(previous) },
      });
    }
  };

  const entryName = (entry: Entry) => t(`labels.equipment.${entry.key}`);
  const levelLabel = (level: BandLevel) => t(`labels.band.${level}`);

  const subtitle = (entry: Entry, item: EquipmentItem | undefined, isOpen: boolean) => {
    if (item && !isOpen) {
      const summary = summarize(item, lang, levelLabel);
      if (summary) return t(`equipment.summary.${summary.key}`, summary.values);
    }
    return t(`equipment.why.${entry.key}`);
  };

  return (
    <div ref={root} className={styles.list}>
      {GROUPS.map((group) => (
        <section key={group.id} className={styles.group} aria-labelledby={`eq-group-${group.id}`}>
          <h2 id={`eq-group-${group.id}`} className={styles.groupName}>
            {t(`equipment.groups.${group.id}`)}
          </h2>
          <div className={styles.cards}>
            {group.entries.map((entry) => {
              const item = itemFor(entry);
              const isOpen = item ? open.has(item.id) : false;
              const err = item ? itemError(item) : null;
              const showError = showErrors && err !== null;
              return (
                <div key={entry.key} data-item-id={item?.id} data-entry={entry.key}>
                  <EquipmentCard
                    icon={entry.icon}
                    name={entryName(entry)}
                    subtitle={subtitle(entry, item, isOpen)}
                    owned={item !== undefined}
                    expandable={entry.form !== null}
                    open={isOpen || showError}
                    hasError={showError}
                    onTick={() => tick(entry)}
                    onToggleOpen={() => item && toggleOpen(item.id)}
                  >
                    {item ? (
                      <SpecForm
                        item={item}
                        error={showError && err ? t(ERROR_KEY[err]) : undefined}
                        onChange={(next) =>
                          onChange(value.map((existing) => (existing === item ? next : existing)))
                        }
                      />
                    ) : null}
                  </EquipmentCard>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <section className={styles.group} aria-labelledby="eq-group-household">
        <h2 id="eq-group-household" className={styles.groupName}>
          {t('equipment.household.title')}
        </h2>
        <p className={styles.hint}>{t('equipment.household.hint')}</p>
        <IncludedList items={HOUSEHOLD.map((kind) => t(`labels.equipment.${kind}`))} />
      </section>
    </div>
  );
}
