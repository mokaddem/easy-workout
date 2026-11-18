import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { Fragment } from 'react';
import type {
  Answer,
  GenerationNote,
  Language,
  Load,
  ProgressionNote,
  SessionItem,
} from '@/domain';
import type { Proposal } from '@/engine';
import { useEquipment } from '@/app/data';
import { thumbIcon } from '@/features/editor/picker/thumbIcon';
import { equipmentInUse, FigureTile } from '@/features/figure';
import { Icon } from '@/ui/components';
import { ChangeTag, GoalRuler, noteDetail, Rich, showsWhy, type ChangeTagData } from '../adapt';
import { PendingPainLine, SwapLine, WhyLine } from './AdaptLines';
import type { ItemGoals } from './adaptation';
import { cardioMinutes, exerciseName, formatNumber, range, type BlockDelta } from './format';
import { effortText } from './effort';
import { describeNote, isInlineNote } from './why';
import styles from './SessionView.module.css';

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

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

/** What progression says about one exercise of the session as it will run. */
export interface ItemAdapt {
  note?: ProgressionNote;
  goals?: ItemGoals;
  tag?: ChangeTagData;
  /** The exercise this one stands in for, with the answer that put it there. */
  replaces?: { id: string; answer?: Answer | undefined };
  /** Pain waiting for an answer. */
  pain?: Proposal;
  onSwitchBack?: (originalId: string) => void;
  onChoose?: (proposal: Proposal) => void;
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
  /** What the user changed here: shown in place of the generation lines. */
  edit?: string | undefined;
  firstSetRir?: number;
  lastSetRir?: number;
  adapt?: ItemAdapt;
  onWhy: () => void;
  /** Opens the how-to: the picture and the name become one button. */
  onHowTo?: () => void;
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

/** Sets × goal (or set 1 + the others), the range ruler, the load. */
function Dose({
  item,
  sets,
  lang,
  goals,
}: {
  item: SessionItem;
  sets: number;
  lang: Language;
  goals?: ItemGoals | undefined;
}) {
  const { t } = useTranslation();
  const target = item.target;
  const side = item.perSide ? 'PerSide' : '';
  let value: React.ReactNode = null;
  let unit = '';
  let ruler: React.ReactNode = null;
  if (target.kind === 'reps' && goals) {
    const split = sets > 1 && goals.first !== goals.rest;
    value = split ? `${goals.first} + ${sets - 1} × ${goals.rest}` : `${sets} × ${goals.rest}`;
    unit = t(`adapt.detail.unit.${split ? 'firstPlus' : 'setsReps'}${side}`);
    ruler = <GoalRuler goal={goals.rest} min={target.min} max={target.max} />;
  } else if (target.kind === 'reps') {
    value = `${sets} × ${range(target.min, target.max)}`;
    unit = t(`programme.rx.setsReps${item.perSide ? 'Side' : ''}`);
  } else if (target.kind === 'max') {
    value = `${sets} × max`;
    unit = t(`programme.rx.setsReps${item.perSide ? 'Side' : ''}`);
  } else if (target.kind === 'time') {
    const goal = goals?.rest;
    const shown = goal !== undefined ? String(goal) : range(target.minSec, target.maxSec);
    value = (
      <>
        {sets > 1 ? `${sets} × ` : ''}
        {shown}
        <small>{t('labels.unit.s')}</small>
      </>
    );
    unit =
      goal !== undefined && sets > 1
        ? t('adapt.detail.unit.setsTime')
        : t(
            sets > 1
              ? `programme.rx.setsTime${item.perSide ? 'Side' : ''}`
              : `programme.rx.time${item.perSide ? 'Side' : ''}`,
          );
    if (goal !== undefined)
      ruler = <GoalRuler goal={goal} min={target.minSec} max={target.maxSec} time />;
  }
  return (
    <div className={styles.rxNums}>
      {value !== null ? (
        <div className={styles.rxCell}>
          <span className={`${styles.num} ${styles.rxN}`}>{value}</span>
          <span className={styles.rxU}>{unit}</span>
          {ruler}
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
  edit,
  firstSetRir,
  lastSetRir,
  adapt,
  onWhy,
  onHowTo,
}: RxProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const name = exerciseName(item.exerciseId, lang);
  const lines = notes
    .filter(isInlineNote)
    .map((note) => describeNote(note, t, lang))
    .filter((line): line is string => Boolean(line));
  const repBased = item.target.kind === 'reps' || item.target.kind === 'max';
  const goals = adapt?.goals;
  const perSet = repBased && goals !== undefined && sets > 1 && goals.first !== goals.rest;
  const note = adapt?.note;
  const target = item.target;
  const pending = adapt?.pain !== undefined;
  const whyText =
    note && showsWhy(note) && !pending
      ? noteDetail(t, lang, note, {
          exerciseId: item.exerciseId,
          ...(target.kind === 'reps' && { min: target.min, max: target.max }),
          ...(target.kind === 'time' && { min: target.minSec, max: target.maxSec, time: true }),
        })
      : undefined;
  return (
    <article className={`${styles.rx} ${first ? styles.rxFirst : ''}`}>
      <span className={`${styles.num} ${styles.rxIdx}`}>{label}</span>
      <ExerciseHead exerciseId={item.exerciseId} name={name} onHowTo={onHowTo} />
      <button
        type="button"
        className={styles.rxWhy}
        aria-label={t('programme.rx.whyAbout', { name })}
        onClick={onWhy}
      >
        <Icon name="why" />
      </button>
      <div className={styles.rxBody}>
        <Dose item={item} sets={sets} lang={lang} goals={goals} />
        <div className={styles.facts}>
          {adapt?.tag ? <ChangeTag tag={adapt.tag} /> : null}
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
        {perSet && firstSetRir !== undefined && item.rir !== undefined && firstSetRir > 0 ? (
          <p className={styles.facts}>
            <span>
              <Rich
                text={t('adapt.detail.perSetFacts', {
                  first: t('adapt.evidence.reps', { count: firstSetRir }),
                  rest: item.rir,
                })}
              />
            </span>
          </p>
        ) : repBased && firstSetRir !== undefined ? (
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
        {whyText ? <WhyLine text={whyText} /> : null}
        {edit ? <EditLine text={edit} /> : null}
        {edit
          ? null
          : lines.map((line) => (
              <p key={line} className={styles.whyLine}>
                <Icon name="why" size={20} />
                <span>{line}</span>
              </p>
            ))}
        {adapt?.pain ? (
          <PendingPainLine
            fromToken={str(adapt.pain.lighter?.params.from)}
            toToken={str(adapt.pain.lighter?.params.to) ?? str(note?.params.load)}
            onChoose={() => adapt.onChoose?.(adapt.pain!)}
          />
        ) : null}
        {adapt?.replaces ? (
          <SwapLine
            originalId={adapt.replaces.id}
            answer={adapt.replaces.answer}
            firstTime={note?.code === 'swapped-in'}
            {...(adapt.replaces.answer?.kind === 'harder' &&
            note?.code === 'hold-miss' &&
            target.kind === 'reps'
              ? { missedMin: target.min }
              : {})}
            onSwitchBack={() => adapt.onSwitchBack?.(adapt.replaces!.id)}
          />
        ) : null}
      </div>
    </article>
  );
}

/** "Edited by you: …", in place of why the generator chose the exercise. */
function EditLine({ text }: { text: string }) {
  return (
    <p className={styles.whyLine}>
      <Icon name="pencil" size={20} />
      <span>{text}</span>
    </p>
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
  edit,
  adapt,
  onWhy,
  onHowTo,
}: {
  item: SessionItem;
  label?: string;
  first?: boolean;
  big?: boolean;
  delta?: BlockDelta | null;
  notes: GenerationNote[];
  edit?: string | undefined;
  adapt?: ItemAdapt;
  onWhy: () => void;
  onHowTo?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const name = exerciseName(item.exerciseId, lang);
  const target = item.target;
  const cardioNote = adapt?.note;
  const cardioWhy =
    cardioNote && showsWhy(cardioNote)
      ? noteDetail(t, lang, cardioNote, { exerciseId: item.exerciseId })
      : undefined;
  const lines = notes
    .filter(isInlineNote)
    .map((note) => describeNote(note, t, lang))
    .filter((line): line is string => Boolean(line));
  return (
    <article className={`${styles.rx} ${first ? styles.rxFirst : ''}`}>
      <span className={`${styles.num} ${styles.rxIdx}`}>{label ?? ''}</span>
      <ExerciseHead exerciseId={item.exerciseId} name={name} onHowTo={onHowTo} />
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
          {adapt?.tag ? <ChangeTag tag={adapt.tag} /> : null}
          <DeltaTag delta={delta} />
          {item.rir === undefined ? null : (
            <span>
              <b>{effortText(t, item.rir)}</b>
            </span>
          )}
        </div>
        {cardioWhy ? <WhyLine text={cardioWhy} /> : null}
        {edit ? <EditLine text={edit} /> : null}
        {edit
          ? null
          : lines.map((line) => (
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

/** The exercise's name, with its still picture as one button that opens the how-to. */
function ExerciseHead({
  exerciseId,
  name,
  onHowTo,
}: {
  exerciseId: string;
  name: string;
  onHowTo: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const inventory = useEquipment();
  if (!onHowTo) return <h3 className={styles.rxName}>{name}</h3>;
  const exercise = exerciseById.get(exerciseId);
  return (
    <h3 className={styles.rxName}>
      <button
        type="button"
        className={styles.rxOpen}
        aria-label={t('play.figure.open', { name })}
        data-howto={exerciseId}
        onClick={onHowTo}
      >
        <span className={styles.rxThumb}>
          <FigureTile
            exerciseId={exerciseId}
            size={56}
            equipment={equipmentInUse(exercise, inventory)}
            fallback={exercise ? <Icon name={thumbIcon(exercise)} size={28} /> : null}
          />
        </span>
        <span className={styles.rxOpenName}>{name}</span>
      </button>
    </h3>
  );
}
