import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nextSession } from '@/app/programme-state';
import { constraintsRepo } from '@/db/constraints';
import { WEEKDAYS, type Language, type Programme, type SessionLog, type Weekday } from '@/domain';
import { Tick } from '@/motion';
import { programmeIdentities } from '@/features/programme/format';
import { Button, Card, CheckRow, Icon, Sheet, useToast } from '@/ui/components';
import { weekdayName } from '../dates';
import {
  canTick,
  daysStatus,
  missingDays,
  previewDays,
  sameDays,
  sortDays,
  type DaysStatus,
} from './model';
import styles from './TrainingDays.module.css';

export interface TrainingDaysSheetProps {
  open: boolean;
  onClose: () => void;
  /** As many days as sessions a week. */
  daysPerWeek: number;
  saved: readonly Weekday[];
  /** The rotation previewed on the days; without a programme the rows only tick. */
  programme: (Programme & { id: string }) | null | undefined;
  logs: readonly SessionLog[];
}

/** Picks the weekdays the user trains on. Soft: the rotation never skips a session. */
export function TrainingDaysSheet({
  open,
  onClose,
  daysPerWeek,
  saved,
  programme,
  logs,
}: TrainingDaysSheetProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const toast = useToast();
  const [draft, setDraft] = useState<Weekday[]>(() => sortDays(saved));
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now] = useState(() => new Date());

  // Each time the sheet opens it starts from what is saved.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(sortDays(saved));
      setShowError(false);
    }
  }

  const identities = useMemo(
    () => (programme ? programmeIdentities(programme, lang) : []),
    [programme, lang],
  );
  const preview = useMemo(
    () =>
      programme
        ? previewDays({
            days: draft,
            now,
            logs,
            nextIndex: nextSession(programme, logs).index,
            size: programme.rotation.length,
          })
        : undefined,
    [programme, draft, now, logs],
  );

  const full = !canTick(draft, daysPerWeek);
  const missing = missingDays(draft, daysPerWeek);
  const status = daysStatus(draft, daysPerWeek);
  const error = showError && missing > 0;

  const toggle = (day: Weekday, on: boolean) => {
    setShowError(false);
    setDraft((current) => sortDays(on ? [...current, day] : current.filter((d) => d !== day)));
  };

  const letterOf = (index: number | undefined): string | undefined =>
    index === undefined ? undefined : (identities[index]?.letter ?? undefined);

  async function save(days: Weekday[]) {
    if (days.length > 0 && missingDays(days, daysPerWeek) > 0) {
      setShowError(true);
      return;
    }
    setSaving(true);
    try {
      await constraintsRepo.setTrainingDays(days, lang);
      const first = days.length > 0 ? preview?.first : undefined;
      const letter = first ? letterOf(first.index) : undefined;
      toast.show({
        message:
          days.length === 0
            ? t('settings.days.cleared')
            : first && letter
              ? t('settings.days.saved', { letter, day: weekdayName(first.day.weekday, lang) })
              : t('settings.days.savedPlain'),
      });
      onClose();
    } catch {
      toast.show({ message: t('settings.constraints.failed'), tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('settings.days.title')}
      description={t('settings.days.purpose', { count: daysPerWeek })}
      footer={
        <div className={styles.foot}>
          <Button
            fullWidth
            size="player"
            loading={saving}
            disabled={sameDays(draft, saved)}
            onClick={() => void save(draft)}
          >
            {t('settings.days.save')}
          </Button>
          {saved.length > 0 ? (
            <Button variant="secondary" fullWidth disabled={saving} onClick={() => void save([])}>
              {t('settings.days.clear')}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className={styles.body}>
        <Card className={styles.rows}>
          <div role="group" aria-label={t('settings.days.title')}>
            {WEEKDAYS.map((day) => {
              const on = draft.includes(day);
              const letter = on ? letterOf(preview?.byDay.get(day)) : undefined;
              return (
                <CheckRow
                  key={day}
                  compact
                  title={<span className={styles.day}>{weekdayName(day, lang)}</span>}
                  checked={on}
                  disabled={!on && full}
                  onChange={(next) => toggle(day, next)}
                  leading={
                    letter ? (
                      <span className={styles.letter}>
                        <Tick value={letter}>{letter}</Tick>
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </Card>
        <p
          className={`${styles.status} ${error ? styles.error : ''}`}
          aria-live="polite"
          role={error ? 'alert' : undefined}
        >
          {error ? <Icon name="alert" size={20} /> : null}
          <Tick value={error ? 'error' : statusText(t, status)}>
            {error ? t('settings.days.error', { count: missing }) : statusText(t, status)}
          </Tick>
        </p>
      </div>
    </Sheet>
  );
}

function statusText(t: ReturnType<typeof useTranslation>['t'], status: DaysStatus): string {
  if (status.kind === 'none') return t('settings.days.none');
  return t(status.kind === 'full' ? 'settings.days.full' : 'settings.days.left', {
    count: status.count,
  });
}
