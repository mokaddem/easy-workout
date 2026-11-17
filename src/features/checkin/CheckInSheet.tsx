import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCheckIns } from '@/app/data';
import { repo } from '@/db/repo';
import type { CheckIn, Language } from '@/domain';
import { localDate } from '@/engine';
import { Rich } from '@/features/adapt/Rich';
import { Button, Icon, Sheet, Stepper } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import {
  SLEEP_DEFAULT,
  SLEEP_RANGE,
  WAIST_RANGE,
  WEIGHT_RANGE,
  fieldError,
  fieldsOf,
  isEmpty,
  sameFields,
  toRecord,
  type CheckInFields,
} from './form';
import styles from './CheckInSheet.module.css';

export interface CheckInSheetProps {
  open: boolean;
  onClose: () => void;
  /** A check-in to edit. Without it the sheet starts a new one (or edits the one on `date`). */
  checkIn?: CheckIn;
  /** `YYYY-MM-DD`; today when omitted. */
  date?: string;
  /** Called with the stored record after a save; the sheet then closes. */
  onSaved?: (record: CheckIn) => void;
  /** Called with the deleted record after a delete (for an Undo toast); the sheet then closes. */
  onDeleted?: (record: CheckIn) => void;
}

const capFirst = (s: string, lang: string) => s.charAt(0).toLocaleUpperCase(lang) + s.slice(1);

function dateLabel(iso: string, lang: string, weekday: boolean): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const text = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, {
    ...(weekday ? { weekday: 'long' as const } : {}),
    day: 'numeric',
    month: 'long',
  }).format(new Date(y, m - 1, d));
  return weekday ? capFirst(text, lang) : text;
}

/**
 * Weekly measures: weight, waist, sleep, notes. One per date: picking a date that already has
 * one opens it for editing. Saves and deletes through the repo itself.
 */
export function CheckInSheet(props: CheckInSheetProps) {
  // A fresh form each time the sheet opens.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setSession((n) => n + 1);
  }
  return <SheetBody key={session} {...props} />;
}

function SheetBody({ open, onClose, checkIn, date, onSaved, onDeleted }: CheckInSheetProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language.startsWith('fr') ? 'fr' : 'en') as Language;
  const all = useCheckIns();
  const today = localDate(new Date());
  const [day, setDay] = useState(checkIn?.date ?? date ?? today);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({ weight: false, waist: false });
  const dateId = useId();

  const existing = checkIn?.date === day ? checkIn : all?.find((c) => c.date === day);
  const [baseline, setBaseline] = useState<CheckInFields>(() => fieldsOf(checkIn, lang));
  const [fields, setFields] = useState<CheckInFields>(baseline);

  // A date that already has measures opens them; any other date keeps what was typed.
  const [loadedFor, setLoadedFor] = useState(checkIn?.id);
  if (existing && existing.id !== loadedFor) {
    const next = fieldsOf(existing, lang);
    setLoadedFor(existing.id);
    setBaseline(next);
    setFields(next);
  } else if (!existing && loadedFor !== undefined && all) {
    setLoadedFor(undefined);
    const blank = fieldsOf(undefined, lang);
    setBaseline(blank);
    setFields(blank);
  }

  const editing = existing !== undefined;
  const weightBad = fieldError(fields.weight, WEIGHT_RANGE);
  const waistBad = fieldError(fields.waist, WAIST_RANGE);
  const showWeightError = weightBad && touched.weight;
  const showWaistError = waistBad && touched.waist;
  const canSave =
    !saving &&
    !isEmpty(fields) &&
    !weightBad &&
    !waistBad &&
    (!editing || !sameFields(fields, baseline));

  const latestWeight = [...(all ?? [])]
    .filter((c) => c.weightKg !== undefined && c.date !== day)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastSleep = [...(all ?? [])]
    .filter((c) => c.sleepHours !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.sleepHours;

  const number = (n: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(n);
  const set = (patch: Partial<CheckInFields>) => setFields((f) => ({ ...f, ...patch }));

  const title = editing
    ? t('checkin.editTitle', { date: dateLabel(day, lang, false) })
    : t('checkin.newTitle');
  const dayText = dateLabel(day, lang, true);
  const dayShown =
    day === today
      ? // French writes weekdays and months in lower case after « Aujourd’hui, »; English doesn't.
        t('checkin.today', { date: lang === 'fr' ? dayText.toLocaleLowerCase(lang) : dayText })
      : dayText;

  async function save() {
    const input = toRecord(fields, day);
    if (!input || saving) return;
    setSaving(true);
    try {
      const record = await repo.saveCheckIn(input);
      onSaved?.(record);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing || saving) return;
    setSaving(true);
    try {
      const record = await repo.deleteCheckIn(existing.id);
      if (record) onDeleted?.(record);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={editing ? undefined : t('checkin.optional')}
      footer={
        <>
          <Button fullWidth disabled={!canSave} onClick={() => void save()}>
            {t('checkin.save')}
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {editing ? t('checkin.close') : t('checkin.cancel')}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <label className={styles.dateBtn}>
          <Icon name="calendar" />
          <span>{dayShown}</span>
          <Icon name="pencil" size={20} />
          <input
            id={dateId}
            className={styles.dateInput}
            type="date"
            aria-label={t('checkin.date')}
            value={day}
            max={today}
            onChange={(event) => {
              if (event.target.value) setDay(event.target.value);
            }}
          />
        </label>
        <div className={styles.row}>
          <NumberField
            label={t('checkin.weight')}
            unit={t('checkin.weightUnit')}
            value={fields.weight}
            onChange={(weight) => set({ weight })}
            onBlur={() => setTouched((s) => ({ ...s, weight: true }))}
            error={showWeightError ? t('checkin.weightError') : undefined}
            hint={
              !editing && latestWeight?.weightKg !== undefined ? (
                <Rich text={t('checkin.lastTime', { value: number(latestWeight.weightKg) })} />
              ) : undefined
            }
          />
          <NumberField
            label={t('checkin.waist')}
            unit={t('checkin.waistUnit')}
            value={fields.waist}
            onChange={(waist) => set({ waist })}
            onBlur={() => setTouched((s) => ({ ...s, waist: true }))}
            error={showWaistError ? t('checkin.waistError') : undefined}
            hint={editing ? undefined : t('checkin.waistHint')}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>{t('checkin.sleep')}</span>
          <Stepper
            wide
            {...SLEEP_RANGE}
            value={fields.sleep}
            onChange={(value) =>
              set({ sleep: fields.sleep === null ? (lastSleep ?? SLEEP_DEFAULT) : value })
            }
            label={t('checkin.sleep')}
            decrementLabel={t('checkin.sleepLess')}
            incrementLabel={t('checkin.sleepMore')}
            unit={t('checkin.sleepUnit')}
            format={number}
          />
          <span className={styles.hint}>{t('checkin.sleepHint')}</span>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>{t('checkin.notes')}</span>
          <textarea
            className={styles.notes}
            rows={3}
            value={fields.notes}
            placeholder={t('checkin.notesPlaceholder')}
            onChange={(event) => set({ notes: event.target.value })}
          />
        </label>
        {editing ? (
          <div className={styles.del}>
            <Button
              variant="destructive-outline"
              icon="trash"
              fullWidth
              disabled={saving}
              onClick={() => void remove()}
            >
              {t('checkin.delete')}
            </Button>
            <p>{t('checkin.deleteHint')}</p>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

interface NumberFieldProps {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  hint?: ReactNode;
  error?: string | undefined;
}

function NumberField({ label, unit, value, onChange, onBlur, hint, error }: NumberFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <label className={cx(styles.box, error && styles.boxError)}>
        <input
          id={id}
          className={styles.input}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="–"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? noteId : undefined}
          style={{ width: `${Math.max(value.length, 1) + 0.15}ch` }}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        <span className={styles.unit}>{unit}</span>
      </label>
      {error ? (
        <span id={noteId} role="alert" className={cx(styles.hint, styles.error)}>
          {error}
        </span>
      ) : hint ? (
        <span id={noteId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
