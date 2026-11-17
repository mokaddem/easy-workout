import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCheckIns } from '@/app/data';
import { goBack } from '@/app/router';
import { repo } from '@/db/repo';
import type { CheckIn, Language } from '@/domain';
import { bodyTrend, type BodyField } from '@/engine';
import { Rich } from '@/features/adapt/Rich';
import { numberText } from '@/features/adapt/format';
import { CheckInSheet } from '@/features/checkin';
import { Appear } from '@/motion';
import {
  AppBar,
  Button,
  Dock,
  EmptyState,
  Icon,
  SegmentedControl,
  Skeleton,
  useToast,
} from '@/ui/components';
import { BodyChart } from '../charts/BodyChart';
import { fullDay, nbsp } from '../charts/format';
import { CheckInRow } from './CheckInRow';
import styles from './body.module.css';

const FIELDS: BodyField[] = ['weightKg', 'waistCm', 'sleepHours'];
const TAB: Record<BodyField, 'weight' | 'waist' | 'sleep'> = {
  weightKg: 'weight',
  waistCm: 'waist',
  sleepHours: 'sleep',
};

/** Weight, waist and sleep from the weekly check-ins, with their trend and every entry. */
export function BodyScreen() {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const checkIns = useCheckIns();
  const toast = useToast();
  const [field, setField] = useState<BodyField>('weightKg');
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState<{ checkIn?: CheckIn } | null>(null);

  const trend = useMemo(
    () => (checkIns ? bodyTrend(checkIns, field) : undefined),
    [checkIns, field],
  );
  const newest = useMemo(
    () => (checkIns ? [...checkIns].sort((a, b) => b.date.localeCompare(a.date)) : []),
    [checkIns],
  );

  const bar = <AppBar title={t('stats.body.title')} onBack={goBack} backLabel={t('common.back')} />;

  if (!checkIns || !trend)
    return (
      <>
        {bar}
        <div className={styles.skeleton}>
          <Skeleton height={48} radius="var(--radius-md)" />
          <Skeleton width="60%" height={96} />
          <Skeleton height={190} radius="var(--radius-lg)" />
        </div>
      </>
    );

  const sheetEl = (
    <CheckInSheet
      open={sheet !== null}
      onClose={() => setSheet(null)}
      {...(sheet?.checkIn && { checkIn: sheet.checkIn })}
      onSaved={() => toast.show({ message: t('checkin.saved') })}
      onDeleted={(record) =>
        toast.show({
          message: t('checkin.deleted'),
          action: {
            label: t('checkin.undo'),
            onAction: () => void repo.restoreCheckIn(record),
          },
        })
      }
    />
  );

  if (checkIns.length === 0)
    return (
      <>
        {bar}
        <div className={styles.scroll}>
          <EmptyState
            icon="scale"
            title={t('stats.body.emptyTitle')}
            description={t('stats.body.emptyBody')}
          />
        </div>
        <Dock>
          <Button size="player" fullWidth icon="plus" onClick={() => setSheet({})}>
            {t('stats.body.add')}
          </Button>
        </Dock>
        {sheetEl}
      </>
    );

  const points = trend.points;
  const last = points.length - 1;
  const index = selected !== null && selected <= last ? selected : last;
  const inspecting = selected !== null && selected <= last;
  const shown = points[index];
  const unit = field === 'weightKg' ? t('labels.unit.kg') : field === 'waistCm' ? 'cm' : 'h';
  const sleep = field === 'sleepHours';

  const deltaLine = (() => {
    if (sleep) {
      return points.length >= 2 && trend.mean !== undefined
        ? {
            icon: 'clock' as const,
            text: t('stats.body.sleepAvg', {
              hours: `${numberText(Math.round(trend.mean * 10) / 10, lang)}${nbsp}h`,
              count: points.length,
            }),
          }
        : undefined;
    }
    if (!trend.delta || trend.delta.value === 0) return undefined;
    const { value, weeks } = trend.delta;
    return {
      icon: value < 0 ? ('arrow-down' as const) : ('arrow-up' as const),
      text: t('stats.body.delta', {
        delta: `${value < 0 ? '−' : '+'}${numberText(Math.abs(value), lang)}${nbsp}${unit}`,
        weeks,
        count: weeks,
      }),
    };
  })();

  return (
    <>
      {bar}
      <div className={styles.scroll}>
        <div className={styles.page}>
          <SegmentedControl
            className={styles.tabs}
            label={t('stats.body.tabsLabel')}
            value={field}
            onChange={(v) => {
              setField(v);
              setSelected(null);
            }}
            options={FIELDS.map((f) => ({ value: f, label: t(`stats.body.tabs.${TAB[f]}`) }))}
          />

          {shown ? (
            <>
              <div className={styles.figure} aria-live="polite">
                <div className={styles.figureMain}>
                  <span className={styles.figureNum}>{numberText(shown.value, lang)}</span>
                  <span className={styles.figureUnit}>{unit}</span>
                </div>
                <p className={styles.figureDate}>
                  {inspecting
                    ? fullDay(shown.date, lang)
                    : t('stats.body.latest', { date: fullDay(shown.date, lang) })}
                </p>
                {deltaLine ? (
                  <p className={styles.delta}>
                    <Icon name={deltaLine.icon} size={20} />
                    <span>
                      <Rich text={deltaLine.text} />
                    </span>
                  </p>
                ) : null}
              </div>
              <div className={styles.card}>
                <Appear id={field}>
                  <BodyChart
                    points={points}
                    sleep={sleep}
                    selected={selected}
                    onSelect={setSelected}
                    name={t('stats.body.chartName', {
                      measure: t(`stats.body.tabs.${TAB[field]}`),
                    })}
                  />
                </Appear>
              </div>
              {points.length === 1 ? (
                <p className={styles.note}>{t('stats.body.oneMore')}</p>
              ) : null}
              {field === 'weightKg' ? (
                <p className={styles.note}>{t('stats.body.profileNote')}</p>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon="scale"
              title={t(`stats.body.none.${TAB[field]}`)}
              description={t('stats.body.noneBody')}
            />
          )}

          <section className={styles.section} aria-labelledby="body-all">
            <h2 id="body-all" className={styles.title}>
              {t('stats.body.all')}
            </h2>
            <ul className={styles.rows}>
              {newest.map((c) => (
                <CheckInRow key={c.id} checkIn={c} onOpen={() => setSheet({ checkIn: c })} />
              ))}
            </ul>
          </section>
        </div>
      </div>
      <Dock>
        <Button size="player" fullWidth icon="plus" onClick={() => setSheet({})}>
          {t('stats.body.add')}
        </Button>
      </Dock>
      {sheetEl}
    </>
  );
}
