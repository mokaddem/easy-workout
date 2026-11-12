import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { Fragment } from 'react';
import type { GenerationNote, Language, Load, SessionItem } from '@/domain';
import { Icon } from '@/ui/components';
import { cardioMinutes, exerciseName, formatNumber, range, type BlockDelta } from './format';
import { effortText } from './effort';
import { describeNote, isInlineNote } from './why';
import styles from './SessionView.module.css';

export function DeltaTag({ delta }: { delta: BlockDelta | null | undefined }) {
  const { t } = useTranslation();
  if (!delta || delta.amount === 0) return null;
  const sign = delta.amount > 0 ? '+' : '−';
  return (
    <span className={styles.delta}>
      {t(`programme.delta.${delta.unit}`, { count: Math.abs(delta.amount), sign })}
    </span>
  );
}

/** Where the "why" of one exercise opens from. */
export interface WhyRequest {
  exerciseId: string;
  notes: GenerationNote[];
  /** The first exercise of the main section: the freshest moment of the session. */
  first: boolean;
}

interface RxProps {
  item: SessionItem;
  /** Index number or group letter. */
  label: string;
  first?: boolean;
  sets?: number;
  restSec?: number;
  delta?: BlockDelta | null;
  notes: GenerationNote[];
  firstSetRir?: number;
  lastSetRir?: number;
  onWhy: () => void;
}

function implementLabel(item: SessionItem, t: TFunction): string | null {
  const kinds = new Set(
    exerciseById
      .get(item.exerciseId)
      ?.equipment.flat()
      .map((r) => r.kind),
  );
  if (kinds.has('dumbbell')) return t('programme.rx.perDumbbell');
  if (kinds.has('kettlebell')) return t('programme.rx.perKettlebell');
  return null;
}

function LoadCell({ item, load, lang }: { item: SessionItem; load: Load; lang: Language }) {
  const { t } = useTranslation();
  switch (load.kind) {
    case 'kg': {
      const unit = implementLabel(item, t);
      return (
        <div className={styles.rxCell}>
          <span className={`${styles.num} ${styles.rxN}`}>
            {formatNumber(load.kg, lang)}
            <small>{t('labels.unit.kg')}</small>
          </span>
          {unit ? <span className={styles.rxU}>{unit}</span> : null}
        </div>
      );
    }
    case 'added-kg':
      return (
        <div className={styles.rxCell}>
          <span className={`${styles.num} ${styles.rxN}`}>
            +{formatNumber(load.kg, lang)}
            <small>{t('labels.unit.kg')}</small>
          </span>
          <span className={styles.rxU}>{t('programme.rx.addedLoad')}</span>
        </div>
      );
    case 'band':
      return (
        <div className={styles.rxCell}>
          <span className={styles.rxW}>{t(`labels.bandLoad.${load.level}`)}</span>
        </div>
      );
    case 'bodyweight':
      return (
        <div className={styles.rxCell}>
          <span className={`${styles.rxW} ${styles.rxWMuted}`}>{t('labels.bodyweight')}</span>
        </div>
      );
  }
}

/** Sets × reps or time, the load, and the facts around them. */
function Dose({ item, sets, lang }: { item: SessionItem; sets: number; lang: Language }) {
  const { t } = useTranslation();
  const target = item.target;
  const side = item.perSide ? 'Side' : '';
  let value: React.ReactNode = null;
  let unit = '';
  if (target.kind === 'reps') {
    value = `${sets} × ${range(target.min, target.max)}`;
    unit = t(`programme.rx.setsReps${side}`);
  } else if (target.kind === 'max') {
    value = `${sets} × max`;
    unit = t(`programme.rx.setsReps${side}`);
  } else if (target.kind === 'time') {
    value = (
      <>
        {sets > 1 ? `${sets} × ` : ''}
        {range(target.minSec, target.maxSec)}
        <small>{t('labels.unit.s')}</small>
      </>
    );
    unit = t(sets > 1 ? `programme.rx.setsTime${side}` : `programme.rx.time${side}`);
  }
  return (
    <div className={styles.rxNums}>
      {value !== null ? (
        <div className={styles.rxCell}>
          <span className={`${styles.num} ${styles.rxN}`}>{value}</span>
          <span className={styles.rxU}>{unit}</span>
        </div>
      ) : null}
      {item.load ? <LoadCell item={item} load={item.load} lang={lang} /> : null}
    </div>
  );
}

export function Prescription({
  item,
  label,
  first,
  sets = 1,
  restSec,
  delta,
  notes,
  firstSetRir,
  lastSetRir,
  onWhy,
}: RxProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const name = exerciseName(item.exerciseId, lang);
  const lines = notes
    .filter(isInlineNote)
    .map((note) => describeNote(note, t, lang))
    .filter((line): line is string => Boolean(line));
  const repBased = item.target.kind === 'reps' || item.target.kind === 'max';
  return (
    <article className={`${styles.rx} ${first ? styles.rxFirst : ''}`}>
      <span className={`${styles.num} ${styles.rxIdx}`}>{label}</span>
      <h3 className={styles.rxName}>{name}</h3>
      <button
        type="button"
        className={styles.rxWhy}
        aria-label={t('programme.rx.whyAbout', { name })}
        onClick={onWhy}
      >
        <Icon name="why" />
      </button>
      <div className={styles.rxBody}>
        <Dose item={item} sets={sets} lang={lang} />
        <div className={styles.facts}>
          <DeltaTag delta={delta} />
          {restSec !== undefined && restSec > 0 ? (
            <span>
              {t('programme.rx.rest')}{' '}
              <b>
                {restSec} {t('labels.unit.s')}
              </b>
            </span>
          ) : null}
          {item.rir !== undefined && repBased ? (
            <span>
              <b>{effortText(t, item.rir)}</b>
            </span>
          ) : null}
          {item.tempo ? (
            <span>
              {t('programme.rx.tempo')}{' '}
              <b>
                {item.tempo.down}-{item.tempo.pause}-{item.tempo.up}
              </b>
            </span>
          ) : null}
        </div>
        {repBased && firstSetRir !== undefined ? (
          <p className={styles.facts}>
            {t('programme.rx.firstSet', { effort: effortText(t, firstSetRir) })}
          </p>
        ) : null}
        {repBased && lastSetRir !== undefined ? (
          <p className={styles.facts}>
            {t('programme.rx.lastSet', { effort: effortText(t, lastSetRir) })}
          </p>
        ) : null}
        {item.target.kind === 'max' ? (
          <p className={styles.facts}>{t('programme.rx.maxHint')}</p>
        ) : null}
        {lines.map((line) => (
          <p key={line} className={styles.whyLine}>
            <Icon name="why" size={20} />
            <span>{line}</span>
          </p>
        ))}
      </div>
    </article>
  );
}

/** Steady cardio or intervals: no sets, a duration and a pace. */
export function CardioRow({
  item,
  label,
  first,
  big,
  delta,
  notes,
  onWhy,
}: {
  item: SessionItem;
  label?: string;
  first?: boolean;
  big?: boolean;
  delta?: BlockDelta | null;
  notes: GenerationNote[];
  onWhy: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const name = exerciseName(item.exerciseId, lang);
  const target = item.target;
  const lines = notes
    .filter(isInlineNote)
    .map((note) => describeNote(note, t, lang))
    .filter((line): line is string => Boolean(line));
  return (
    <article className={`${styles.rx} ${first ? styles.rxFirst : ''}`}>
      <span className={`${styles.num} ${styles.rxIdx}`}>{label ?? ''}</span>
      <h3 className={styles.rxName}>{name}</h3>
      <button
        type="button"
        className={styles.rxWhy}
        aria-label={t('programme.rx.whyAbout', { name })}
        onClick={onWhy}
      >
        <Icon name="why" />
      </button>
      <div className={styles.rxBody}>
        {target.kind === 'cardio' ? (
          <div className={`${styles.cardio} ${big ? styles.cardioBig : ''}`}>
            <div className={styles.rxCell}>
              <span className={`${styles.num} ${styles.rxN}`}>
                {range(target.minMinutes, target.maxMinutes)}
                <small>{t('labels.unit.min')}</small>
              </span>
              <span className={styles.rxU}>{t('programme.rx.duration')}</span>
            </div>
            {target.speedKmh !== undefined ? (
              <div className={styles.rxCell}>
                <span className={`${styles.num} ${styles.rxN}`}>
                  {formatNumber(target.speedKmh, lang)}
                  <small>{t('labels.unit.kmh')}</small>
                </span>
                <span className={styles.rxU}>{t('programme.rx.speed')}</span>
              </div>
            ) : null}
            {target.inclinePct !== undefined ? (
              <div className={styles.rxCell}>
                <span className={`${styles.num} ${styles.rxN}`}>
                  {formatNumber(target.inclinePct, lang)}
                  <small>{t('labels.unit.pct')}</small>
                </span>
                <span className={styles.rxU}>{t('programme.rx.incline')}</span>
              </div>
            ) : null}
          </div>
        ) : target.kind === 'interval' ? (
          <Intervals target={target} lang={lang} />
        ) : null}
        <div className={styles.facts}>
          <DeltaTag delta={delta} />
          {item.rir === undefined ? null : (
            <span>
              <b>{effortText(t, item.rir)}</b>
            </span>
          )}
        </div>
        {lines.map((line) => (
          <p key={line} className={styles.whyLine}>
            <Icon name="why" size={20} />
            <span>{line}</span>
          </p>
        ))}
      </div>
    </article>
  );
}

function Intervals({
  target,
  lang,
}: {
  target: Extract<SessionItem['target'], { kind: 'interval' }>;
  lang: Language;
}) {
  const { t } = useTranslation();
  const total = cardioMinutes({ exerciseId: '', target });
  const pace = (speed?: number, incline?: number) =>
    [
      speed === undefined ? null : `${formatNumber(speed, lang)} ${t('labels.unit.kmh')}`,
      incline === undefined ? null : `${formatNumber(incline, lang)} ${t('labels.unit.pct')}`,
    ]
      .filter(Boolean)
      .join(', ');
  const work = pace(target.workSpeedKmh, target.workInclinePct);
  const rest = pace(target.recoverySpeedKmh, target.recoveryInclinePct);
  return (
    <div className={styles.ivl}>
      <div className={styles.rxNums}>
        <div className={styles.rxCell}>
          <span className={`${styles.num} ${styles.rxN}`}>{target.rounds}</span>
          <span className={styles.rxU}>{t('programme.rx.rounds')}</span>
        </div>
        <div className={styles.rxCell}>
          <span className={`${styles.num} ${styles.rxN}`}>
            {target.workSec}
            <small>{t('labels.unit.s')}</small>
          </span>
          <span className={styles.rxU}>{t('programme.rx.work')}</span>
        </div>
        <div className={styles.rxCell}>
          <span className={`${styles.num} ${styles.rxN}`}>
            {target.recoverySec}
            <small>{t('labels.unit.s')}</small>
          </span>
          <span className={styles.rxU}>{t('programme.rx.recovery')}</span>
        </div>
        <div className={styles.rxCell}>
          <span className={`${styles.num} ${styles.rxN}`}>
            {total}
            <small>{t('labels.unit.min')}</small>
          </span>
          <span className={styles.rxU}>{t('programme.rx.total')}</span>
        </div>
      </div>
      <div className={styles.ivlBars} aria-hidden="true">
        {Array.from({ length: Math.min(target.rounds, 12) }, (_, i) => (
          <Fragment key={i}>
            <i className={styles.ivlWork} />
            <i className={styles.ivlRest} />
          </Fragment>
        ))}
      </div>
      <div className={styles.ivlLegend}>
        <span>
          <i className={styles.ivlWork} />
          {t('programme.rx.work')}
          {work ? ` · ${work}` : ''}
        </span>
        <span>
          <i className={styles.ivlRest} />
          {t('programme.rx.recovery')}
          {rest ? ` · ${rest}` : ''}
        </span>
      </div>
    </div>
  );
}
