import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Block, Exercise, Language, SessionItem } from '@/domain';
import type { ItemEdit } from '@/engine';
import { PresenceList, RowMotion } from '@/motion';
import { Icon, Tag } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { doseFacts, doseNumber, groupItemWord, itemNumber, nameOf } from './dose';
import styles from './editor.module.css';

const useLang = (): Language => {
  const { i18n } = useTranslation();
  return i18n.language === 'fr' ? 'fr' : 'en';
};

function EditTag({ edit }: { edit: ItemEdit | undefined }) {
  const { t } = useTranslation();
  if (!edit) return null;
  return edit === 'added' ? (
    <Tag icon="plus" label={t('editor.tag.added')} />
  ) : (
    <Tag icon="pencil" label={t('editor.tag.edited')} />
  );
}

function MoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.more} aria-label={label} onClick={onClick}>
      <span>
        <Icon name="more" />
      </span>
    </button>
  );
}

interface StraightProps {
  block: Extract<Block, { type: 'straight' }>;
  exercises: ReadonlyMap<string, Exercise>;
  /** Main blocks are numbered; warm-up and finisher aren't. */
  number?: number | undefined;
  warm?: boolean;
  edit?: ItemEdit | undefined;
  bad?: boolean;
  foot?: ReactNode;
  describedBy?: string | undefined;
  onOpen: () => void;
  onMore: () => void;
  focusKey: string;
}

/** One exercise with its sets: tap for its dose, the dots for everything else. */
export function StraightCard({
  block,
  exercises,
  number,
  warm,
  edit,
  bad,
  foot,
  describedBy,
  onOpen,
  onMore,
  focusKey,
}: StraightProps) {
  const { t } = useTranslation();
  const lang = useLang();
  const item = block.item;
  const exercise = exercises.get(item.exerciseId);
  const name = nameOf(exercises, item.exerciseId, lang);
  const { value, unit } = doseNumber(item, block.sets);
  const facts = doseFacts(t, item, block.restSec, exercise, lang);
  return (
    <article className={cx(styles.card, warm && styles.cardWarm, bad && styles.cardBad)}>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.main}
          data-block={focusKey}
          aria-describedby={describedBy}
          aria-label={t('editor.blockLabel', { name })}
          onClick={onOpen}
        >
          <span className={cx(styles.num, styles.idx)} aria-hidden="true">
            {number ?? ''}
          </span>
          <span className={styles.body}>
            <span className={styles.name}>{name}</span>
            <span className={styles.dose}>
              <span className={cx(styles.num, styles.doseNum)}>
                {value}
                {unit ? <small>{t(`labels.unit.${unit}`)}</small> : null}
              </span>
              {facts ? <span className={styles.facts}>{facts}</span> : null}
            </span>
            {edit ? (
              <span className={styles.tags}>
                <EditTag edit={edit} />
              </span>
            ) : null}
          </span>
        </button>
        <MoreButton label={t('editor.blockActions', { name })} onClick={onMore} />
      </div>
      <PresenceList>
        {foot ? (
          <RowMotion key="foot" leave="dismiss">
            <div className={styles.foot}>{foot}</div>
          </RowMotion>
        ) : null}
      </PresenceList>
    </article>
  );
}

interface GroupItemView {
  item: SessionItem;
  edit?: ItemEdit | undefined;
  onOpen: () => void;
  onMore: () => void;
}

interface GroupProps {
  block: Extract<Block, { type: 'group' }>;
  exercises: ReadonlyMap<string, Exercise>;
  number?: number | undefined;
  bad?: boolean;
  foot?: ReactNode;
  views: GroupItemView[];
  onOpenGroup: () => void;
  onMoreGroup: () => void;
  onAdd: () => void;
  focusKey: string;
  describedBy?: string | undefined;
  /** The group appeared while the screen was open: its bracket draws down. */
  fresh?: boolean;
}

export function GroupCard({
  block,
  exercises,
  number,
  bad,
  foot,
  views,
  onOpenGroup,
  onMoreGroup,
  onAdd,
  focusKey,
  describedBy,
  fresh = false,
}: GroupProps) {
  const { t } = useTranslation();
  // Decided once, when the card first appears.
  const [draws] = useState(fresh);
  const lang = useLang();
  const letters = block.items.map((_, i) => String.fromCharCode(97 + i));
  const title = t(`programme.group.${block.style}`, { count: block.rounds });
  const rule =
    block.style === 'superset'
      ? t('programme.group.ruleSuperset', {
          items: new Intl.ListFormat(lang, { type: 'conjunction' }).format(letters),
          rest: block.restAfterRoundSec,
        })
      : t('programme.group.ruleCircuit', {
          count: block.items.length,
          rest: block.restAfterRoundSec,
        });
  return (
    <article className={cx(styles.card, bad && styles.cardBad)}>
      <div className={styles.groupHead}>
        <button
          type="button"
          className={styles.groupMain}
          data-block={focusKey}
          aria-describedby={describedBy}
          aria-label={t('editor.groupLabel', { name: title })}
          onClick={onOpenGroup}
        >
          <span className={styles.groupTitle}>
            <span className={cx(styles.num, styles.idx)} aria-hidden="true">
              {number ?? ''}
            </span>
            <span>{title}</span>
          </span>
          <span className={styles.groupRule}>{rule}</span>
        </button>
        <MoreButton label={t('editor.groupActions', { name: title })} onClick={onMoreGroup} />
      </div>
      <div className={cx(styles.items, draws && styles.bracketDraw)}>
        {views.map((view, i) => {
          const name = nameOf(exercises, view.item.exerciseId, lang);
          const { value, unit } = itemNumber(view.item);
          const word = groupItemWord(t, view.item, exercises.get(view.item.exerciseId));
          return (
            <div key={view.item.slot ?? i} className={styles.item}>
              <button
                type="button"
                className={styles.itemMain}
                aria-label={t('editor.blockLabel', { name })}
                onClick={view.onOpen}
              >
                <span className={styles.letter} aria-hidden="true">
                  {letters[i]}
                </span>
                <span className={styles.body}>
                  <span className={styles.itemName}>{name}</span>
                  <span className={styles.itemDose}>
                    <span className={styles.num}>
                      {value}
                      {unit ? <small>{t(`labels.unit.${unit}`)}</small> : null}
                    </span>
                    {word ? <span className={styles.facts}>{word}</span> : null}
                  </span>
                  {view.edit ? (
                    <span className={styles.tags}>
                      <EditTag edit={view.edit} />
                    </span>
                  ) : null}
                </span>
              </button>
              <MoreButton label={t('editor.itemActions', { name })} onClick={view.onMore} />
            </div>
          );
        })}
        <button type="button" className={styles.addInGroup} onClick={onAdd}>
          <Icon name="plus" />
          {t(block.style === 'superset' ? 'editor.addToSuperset' : 'editor.addToCircuit')}
        </button>
      </div>
      <PresenceList>
        {foot ? (
          <RowMotion key="foot" leave="dismiss">
            <div className={styles.foot}>{foot}</div>
          </RowMotion>
        ) : null}
      </PresenceList>
    </article>
  );
}

export function Tombstone({ name, onPutBack }: { name: string; onPutBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.tomb}>
      <p className={styles.tombText}>
        <span>{t('editor.removedLabel')}</span> <b>{name}</b>
      </p>
      <button
        type="button"
        className={styles.tombBtn}
        aria-label={t('editor.putBackSr', { name })}
        onClick={onPutBack}
      >
        {t('editor.putBack')}
      </button>
    </div>
  );
}

export function AddRow({
  section,
  sectionName,
  bad,
  onClick,
}: {
  section: string;
  sectionName: string;
  bad?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={cx(styles.addRow, bad && styles.addRowBad)}
      data-add={section}
      aria-label={t('editor.addSr', { section: sectionName })}
      onClick={onClick}
    >
      <Icon name="plus" />
      {t('editor.add')}
    </button>
  );
}
