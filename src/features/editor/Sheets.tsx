import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Block, Exercise, Session, SessionItem } from '@/domain';
import { MAX_SETS, type BlockDose, type ItemAt, type ItemDose } from '@/engine';
import {
  Button,
  Icon,
  LiveEstimate,
  RangeStepper,
  SegmentedControl,
  Sheet,
  Stepper,
} from '@/ui/components';
import { effortText } from '../programme/effort';
import { isCardioTarget, usesEffort } from './dose';
import styles from './editor.module.css';

function Field({
  label,
  sub,
  inline = true,
  children,
}: {
  label: string;
  sub?: string;
  inline?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <div className={inline ? styles.fieldRow : undefined}>
        <span className={styles.fieldLabel}>
          {label}
          {sub ? <span className={styles.fieldSub}>{sub}</span> : null}
        </span>
        {inline ? children : null}
      </div>
      {inline ? null : children}
    </div>
  );
}

interface DoseSheetProps {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  at: ItemAt | null;
  draft: Session;
  exercise: Exercise | undefined;
  /** Minutes when the sheet opened, for the delta. */
  openedAt: number;
  onItem: (dose: ItemDose) => void;
  onBlock: (dose: BlockDose) => void;
  onAdjustGroup: () => void;
  /** Warnings about this item (effort 0 on a loaded lift), already filtered. */
  issues?: ReactNode;
  /** What the programme had, for edited items. */
  original?: { text: ReactNode; onRestore: () => void } | undefined;
}

const itemAt = (draft: Session, at: ItemAt): { block: Block; item: SessionItem } | undefined => {
  const block = draft[at.section][at.blockIndex];
  if (!block) return undefined;
  const item = block.type === 'straight' ? block.item : block.items[at.itemIndex];
  return item ? { block, item } : undefined;
};

/** Sets, range, effort and rest of one exercise; changes apply to the editor as they are made. */
export function DoseSheet({
  open,
  onClose,
  eyebrow,
  title,
  at,
  draft,
  exercise,
  openedAt,
  onItem,
  onBlock,
  onAdjustGroup,
  issues,
  original,
}: DoseSheetProps) {
  const { t } = useTranslation();
  const found = at ? itemAt(draft, at) : undefined;
  const delta = draft.estimatedMinutes - openedAt;
  return (
    <Sheet
      open={open && !!found}
      onClose={onClose}
      title={
        <>
          <span className={styles.sheetEyebrow}>{eyebrow}</span>
          {title}
        </>
      }
      description={
        <LiveEstimate
          label={t('editor.dose.session')}
          minutes={draft.estimatedMinutes}
          unit={t('labels.unit.min')}
          {...(delta !== 0 && {
            delta: t(delta > 0 ? 'editor.dose.deltaMore' : 'editor.dose.deltaLess', {
              n: Math.abs(delta),
            }),
          })}
        />
      }
      footer={
        <Button size="player" fullWidth onClick={onClose}>
          {t('editor.dose.done')}
        </Button>
      }
    >
      {found ? (
        <DoseFields
          block={found.block}
          item={found.item}
          exercise={exercise}
          onItem={onItem}
          onBlock={onBlock}
          onAdjustGroup={onAdjustGroup}
          issues={issues}
          original={original}
        />
      ) : null}
    </Sheet>
  );
}

function DoseFields({
  block,
  item,
  exercise,
  onItem,
  onBlock,
  onAdjustGroup,
  issues,
  original,
}: {
  block: Block;
  item: SessionItem;
  exercise: Exercise | undefined;
  onItem: (dose: ItemDose) => void;
  onBlock: (dose: BlockDose) => void;
  onAdjustGroup: () => void;
  issues?: ReactNode;
  original?: DoseSheetProps['original'];
}) {
  const { t } = useTranslation();
  const target = item.target;
  const cardio = isCardioTarget(item);
  const inGroup = block.type === 'group';
  const side = item.perSide ? 'Side' : '';

  return (
    <div className={styles.sheetBody}>
      {target.kind === 'cardio' ? (
        <Field label={t('editor.cardio.duration')}>
          <Stepper
            label={t('editor.cardio.duration')}
            decrementLabel={t('editor.cardio.durationLess')}
            incrementLabel={t('editor.cardio.durationMore')}
            min={5}
            max={60}
            step={5}
            unit={t('labels.unit.min')}
            value={target.maxMinutes}
            onChange={(v) => onItem({ target: { ...target, minMinutes: v, maxMinutes: v } })}
          />
        </Field>
      ) : null}
      {target.kind === 'interval' ? (
        <>
          <Field label={t('editor.cardio.rounds')}>
            <Stepper
              label={t('editor.cardio.rounds')}
              decrementLabel={t('editor.cardio.roundsLess')}
              incrementLabel={t('editor.cardio.roundsMore')}
              min={1}
              max={20}
              step={1}
              value={target.rounds}
              onChange={(rounds) => onItem({ target: { ...target, rounds } })}
            />
          </Field>
          <Field label={t('editor.cardio.work')}>
            <Stepper
              label={t('editor.cardio.work')}
              decrementLabel={t('editor.cardio.workLess')}
              incrementLabel={t('editor.cardio.workMore')}
              min={10}
              max={120}
              step={5}
              unit={t('labels.unit.s')}
              value={target.workSec}
              onChange={(workSec) => onItem({ target: { ...target, workSec } })}
            />
          </Field>
          <Field label={t('editor.cardio.recovery')}>
            <Stepper
              label={t('editor.cardio.recovery')}
              decrementLabel={t('editor.cardio.recoveryLess')}
              incrementLabel={t('editor.cardio.recoveryMore')}
              min={10}
              max={180}
              step={5}
              unit={t('labels.unit.s')}
              value={target.recoverySec}
              onChange={(recoverySec) => onItem({ target: { ...target, recoverySec } })}
            />
          </Field>
        </>
      ) : null}

      {!cardio && block.type === 'straight' ? (
        <Field label={t('editor.dose.sets')}>
          <Stepper
            label={t('editor.dose.sets')}
            decrementLabel={t('editor.dose.setsLess')}
            incrementLabel={t('editor.dose.setsMore')}
            min={1}
            max={MAX_SETS}
            step={1}
            value={block.sets}
            onChange={(sets) => onBlock({ sets })}
          />
        </Field>
      ) : null}
      {!cardio && block.type === 'group' ? (
        <div className={styles.fixed}>
          <span>
            <Trans
              i18nKey="editor.dose.fixedRounds"
              values={{ n: block.rounds }}
              components={{ b: <b /> }}
            />
          </span>
          <Button variant="ghost" onClick={onAdjustGroup}>
            {t('editor.dose.adjust')}
          </Button>
        </div>
      ) : null}

      {target.kind === 'reps' ? (
        <Field label={t(`editor.dose.reps${side}`)} inline={false}>
          <RangeStepper
            low={target.min}
            high={target.max}
            min={1}
            max={30}
            fromWord={t('editor.dose.from')}
            toWord={t('editor.dose.to')}
            lowLabels={{
              label: t('editor.dose.reps'),
              decrementLabel: t('editor.dose.minLess'),
              incrementLabel: t('editor.dose.minMore'),
            }}
            highLabels={{
              label: t('editor.dose.reps'),
              decrementLabel: t('editor.dose.maxLess'),
              incrementLabel: t('editor.dose.maxMore'),
            }}
            onChange={(min, max) => onItem({ target: { kind: 'reps', min, max } })}
          />
        </Field>
      ) : null}
      {target.kind === 'time' ? (
        <Field label={t(`editor.dose.time${side}`)} inline={false}>
          <RangeStepper
            low={target.minSec}
            high={target.maxSec}
            min={5}
            max={180}
            step={5}
            unit={t('labels.unit.s')}
            fromWord={t('editor.dose.from')}
            toWord={t('editor.dose.to')}
            lowLabels={{
              label: t('editor.dose.time'),
              decrementLabel: t('editor.dose.minLess'),
              incrementLabel: t('editor.dose.minMore'),
            }}
            highLabels={{
              label: t('editor.dose.time'),
              decrementLabel: t('editor.dose.maxLess'),
              incrementLabel: t('editor.dose.maxMore'),
            }}
            onChange={(minSec, maxSec) => onItem({ target: { kind: 'time', minSec, maxSec } })}
          />
        </Field>
      ) : null}

      {usesEffort(item, exercise) ? (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('editor.dose.effort')}</span>
          <Stepper
            wide
            label={t('editor.dose.effort')}
            decrementLabel={t('editor.dose.effortLess')}
            incrementLabel={t('editor.dose.effortMore')}
            min={0}
            max={4}
            step={1}
            value={item.rir}
            word={item.rir === undefined ? undefined : effortText(t, item.rir)}
            onChange={(rir) => onItem({ rir })}
          />
          {item.rir !== undefined ? (
            <p className={styles.hint}>
              {item.rir === 0
                ? t('editor.dose.effortHint0')
                : t('editor.dose.effortHint', { count: item.rir })}
            </p>
          ) : null}
          {issues}
        </div>
      ) : null}

      {!cardio && block.type === 'straight' ? (
        <Field label={t('editor.dose.rest')}>
          <Stepper
            label={t('editor.dose.rest')}
            decrementLabel={t('editor.dose.restLess')}
            incrementLabel={t('editor.dose.restMore')}
            min={0}
            max={240}
            step={15}
            unit={t('labels.unit.s')}
            zeroWord={t('editor.group.restNone')}
            value={block.restSec}
            onChange={(restSec) => onBlock({ restSec })}
          />
        </Field>
      ) : null}

      <p className={styles.hint}>
        {cardio
          ? t(original ? 'editor.cardio.untouched' : 'editor.cardio.untouchedMine')
          : t(inGroup ? 'editor.dose.noLoadGroup' : 'editor.dose.noLoad')}
      </p>

      {original ? (
        <div className={styles.originalBlock}>
          <p>{original.text}</p>
          <Button variant="ghost" icon="restore" onClick={original.onRestore}>
            {t('editor.dose.restore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface GroupSheetProps {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  block: Extract<Block, { type: 'group' }> | undefined;
  minutes: number;
  openedAt: number;
  onBlock: (dose: BlockDose) => void;
  onStyle: (style: 'superset' | 'circuit') => void;
  onUngroup: () => void;
}

export function GroupSheet({
  open,
  onClose,
  eyebrow,
  title,
  block,
  minutes,
  openedAt,
  onBlock,
  onStyle,
  onUngroup,
}: GroupSheetProps) {
  const { t } = useTranslation();
  const delta = minutes - openedAt;
  return (
    <Sheet
      open={open && !!block}
      onClose={onClose}
      title={
        <>
          <span className={styles.sheetEyebrow}>{eyebrow}</span>
          {title}
        </>
      }
      description={
        <LiveEstimate
          label={t('editor.dose.session')}
          minutes={minutes}
          unit={t('labels.unit.min')}
          {...(delta !== 0 && {
            delta: t(delta > 0 ? 'editor.dose.deltaMore' : 'editor.dose.deltaLess', {
              n: Math.abs(delta),
            }),
          })}
        />
      }
      footer={
        <Button size="player" fullWidth onClick={onClose}>
          {t('editor.dose.done')}
        </Button>
      }
    >
      {block ? (
        <div className={styles.sheetBody}>
          <div className={styles.field}>
            <SegmentedControl
              label={t('editor.group.type')}
              value={block.style}
              onChange={onStyle}
              options={[
                { value: 'superset', label: t('editor.group.superset') },
                { value: 'circuit', label: t('editor.group.circuit') },
              ]}
            />
            <p className={styles.hint}>
              {t(
                block.style === 'superset' ? 'editor.group.supersetSub' : 'editor.group.circuitSub',
              )}
            </p>
          </div>
          <Field label={t('editor.group.rounds')}>
            <Stepper
              label={t('editor.group.rounds')}
              decrementLabel={t('editor.group.roundsLess')}
              incrementLabel={t('editor.group.roundsMore')}
              min={1}
              max={MAX_SETS}
              step={1}
              value={block.rounds}
              onChange={(rounds) => onBlock({ rounds })}
            />
          </Field>
          <Field label={t('editor.group.restBetween')}>
            <Stepper
              label={t('editor.group.restBetween')}
              decrementLabel={t('editor.group.restBetweenLess')}
              incrementLabel={t('editor.group.restBetweenMore')}
              min={0}
              max={90}
              step={5}
              unit={t('labels.unit.s')}
              zeroWord={t('editor.group.restNone')}
              value={block.restBetweenItemsSec}
              onChange={(restBetweenItemsSec) => onBlock({ restBetweenItemsSec })}
            />
          </Field>
          <Field label={t('editor.group.restAfter')}>
            <Stepper
              label={t('editor.group.restAfter')}
              decrementLabel={t('editor.group.restAfterLess')}
              incrementLabel={t('editor.group.restAfterMore')}
              min={15}
              max={240}
              step={15}
              unit={t('labels.unit.s')}
              value={block.restAfterRoundSec}
              onChange={(restAfterRoundSec) => onBlock({ restAfterRoundSec })}
            />
          </Field>
          <div className={styles.sheetActions}>
            <Button variant="secondary" icon="ungroup" fullWidth onClick={onUngroup}>
              {t('editor.group.ungroup')}
            </Button>
            <p className={styles.hint}>{t('editor.group.ungroupLine', { n: block.rounds })}</p>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

interface LeaveSheetProps {
  open: boolean;
  onClose: () => void;
  count: number;
  isNew: boolean;
  programme: boolean;
  blocked: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/** Shown when leaving with unsaved changes. */
export function LeaveSheet({
  open,
  onClose,
  count,
  isNew,
  programme,
  blocked,
  saving,
  onSave,
  onDiscard,
}: LeaveSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('editor.leave.title')}
      description={isNew ? undefined : t('editor.leave.desc', { count })}
      footer={
        <Button variant="secondary" fullWidth onClick={onClose}>
          {t('editor.leave.stay')}
        </Button>
      }
    >
      <div className={styles.leaveList}>
        <button
          type="button"
          className={styles.leaveItem}
          disabled={saving || blocked > 0}
          onClick={onSave}
        >
          <span className={styles.leaveIcon}>
            <Icon name="check" />
          </span>
          <span className={styles.leaveLabel}>{t('editor.leave.save')}</span>
          <span className={styles.leaveSub}>
            {blocked > 0
              ? t('editor.leave.saveBlocked', { count: blocked })
              : t(
                  isNew
                    ? 'editor.leave.saveSubNew'
                    : programme
                      ? 'editor.leave.saveSub'
                      : 'editor.leave.saveSubCustom',
                )}
          </span>
        </button>
        <button
          type="button"
          className={`${styles.leaveItem} ${styles.leaveDanger}`}
          onClick={onDiscard}
        >
          <span className={styles.leaveIcon}>
            <Icon name="close" />
          </span>
          <span className={styles.leaveLabel}>{t('editor.leave.discard')}</span>
          <span className={styles.leaveSub}>
            {isNew ? t('editor.leave.discardNew') : t('editor.leave.discardSub', { count })}
          </span>
        </button>
      </div>
    </Sheet>
  );
}
