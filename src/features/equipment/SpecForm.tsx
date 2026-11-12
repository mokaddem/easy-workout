import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BAND_LEVELS, type BandLevel, type EquipmentItem, type Language } from '@/domain';
import { Button, Chip, ChipGroup, Icon, SegmentedControl, Stepper } from '@/ui/components';
import { formatNumber } from './format';
import styles from './SpecForm.module.css';

const DUMBBELL_WEIGHTS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
const KETTLEBELL_WEIGHTS = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32];
/** Stepper value standing for "rated load unknown". */
const UNKNOWN = 0;
const FIRST_RATED = 100;

export interface SpecFormProps {
  item: EquipmentItem;
  onChange: (next: EquipmentItem) => void;
  /** Message to show for this item's validation problem. */
  error?: string | undefined;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label}
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

function Block({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.block}>
      <span className={styles.label}>
        {label}
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className={styles.error} role="alert">
      <Icon name="alert" size={20} />
      <span>{message}</span>
    </p>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className={styles.note}>
      <Icon name="info" size={20} />
      <span>{children}</span>
    </p>
  );
}

export function SpecForm({ item, onChange, error }: SpecFormProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const n = (v: number) => formatNumber(v, lang);
  const kg = t('labels.unit.kg');
  const less = t('equipment.form.less');
  const more = t('equipment.form.more');

  const stepperProps = (label: string) => ({
    label,
    decrementLabel: `${label} – ${less}`,
    incrementLabel: `${label} – ${more}`,
    format: n,
  });

  switch (item.kind) {
    case 'dumbbell': {
      if (item.mode === 'fixed') {
        return (
          <WeightGrid
            all={DUMBBELL_WEIGHTS}
            defaultCount={2}
            weights={item.weights}
            onChange={(weights) => onChange({ ...item, weights })}
            error={error}
          />
        );
      }
      return (
        <>
          {error ? <ErrorLine message={error} /> : null}
          <Block label={t('equipment.form.howMany')}>
            <SegmentedControl
              label={t('equipment.form.howMany')}
              value={item.count === 2 ? 'pair' : 'single'}
              onChange={(v) => onChange({ ...item, count: v === 'pair' ? 2 : 1 })}
              options={[
                { value: 'single', label: t('equipment.form.justOne') },
                { value: 'pair', label: t('equipment.form.pair') },
              ]}
            />
          </Block>
          <Block label={t('equipment.form.locking')} hint={t('equipment.form.lockingHint')}>
            <SegmentedControl
              label={t('equipment.form.locking')}
              value={item.mechanism ?? null}
              onChange={(mechanism) => onChange({ ...item, mechanism })}
              options={[
                { value: 'spin-lock', label: t('equipment.form.spinLock') },
                { value: 'selector', label: t('equipment.form.selector') },
              ]}
            />
          </Block>
          <div className={styles.sep} />
          <Field label={t('equipment.form.lightest')}>
            <Stepper
              {...stepperProps(t('equipment.form.lightest'))}
              value={item.minKg}
              min={0.5}
              max={30}
              step={0.5}
              unit={kg}
              onChange={(minKg) => onChange({ ...item, minKg })}
            />
          </Field>
          <Field label={t('equipment.form.heaviest')}>
            <Stepper
              {...stepperProps(t('equipment.form.heaviest'))}
              value={item.maxKg}
              min={1}
              max={100}
              step={0.5}
              unit={kg}
              onChange={(maxKg) => onChange({ ...item, maxKg })}
            />
          </Field>
          <Field label={t('equipment.form.increment')} hint={t('equipment.form.incrementHint')}>
            <Stepper
              {...stepperProps(t('equipment.form.increment'))}
              value={item.incrementKg}
              min={0.5}
              max={10}
              step={0.5}
              unit={kg}
              onChange={(incrementKg) => onChange({ ...item, incrementKg })}
            />
          </Field>
          <Ruler min={item.minKg} max={item.maxKg} step={item.incrementKg} lang={lang} />
        </>
      );
    }
    case 'kettlebell':
      return (
        <WeightGrid
          all={KETTLEBELL_WEIGHTS}
          defaultCount={1}
          weights={item.weights}
          onChange={(weights) => onChange({ ...item, weights })}
          error={error}
        />
      );
    case 'band':
    case 'mini-band':
      return (
        <Block label={t('equipment.form.levels')}>
          {error ? <ErrorLine message={error} /> : null}
          <ChipGroup label={t('equipment.form.levels')}>
            {BAND_LEVELS.map((level: BandLevel) => (
              <Chip
                key={level}
                selected={item.levels.includes(level)}
                onToggle={(on) =>
                  onChange({
                    ...item,
                    levels: BAND_LEVELS.filter((l) => (l === level ? on : item.levels.includes(l))),
                  })
                }
              >
                {t(`labels.band.${level}`)}
              </Chip>
            ))}
          </ChipGroup>
        </Block>
      );
    case 'weight-belt':
    case 'weight-vest': {
      const belt = item.kind === 'weight-belt';
      return (
        <>
          <Field
            label={t('equipment.form.maxLoad')}
            hint={t(belt ? 'equipment.form.beltMaxHint' : 'equipment.form.vestMaxHint')}
          >
            <Stepper
              {...stepperProps(t('equipment.form.maxLoad'))}
              value={item.maxKg}
              min={1}
              max={60}
              step={belt ? 2.5 : 1}
              unit={kg}
              onChange={(maxKg) => onChange({ ...item, maxKg })}
            />
          </Field>
          <Field label={t('equipment.form.increment')} hint={t('equipment.form.smallestPlate')}>
            <Stepper
              {...stepperProps(t('equipment.form.increment'))}
              value={item.incrementKg}
              min={0.5}
              max={10}
              step={0.5}
              unit={kg}
              onChange={(incrementKg) => onChange({ ...item, incrementKg })}
            />
          </Field>
        </>
      );
    }
    case 'pull-up-bar': {
      const rated = item.maxLoadKg ?? UNKNOWN;
      const setRated = (value: number) => {
        const { maxLoadKg: _drop, ...rest } = item;
        void _drop;
        onChange(value === UNKNOWN ? rest : { ...rest, maxLoadKg: value });
      };
      return (
        <>
          <Block label={t('equipment.form.mount')}>
            <SegmentedControl
              className={styles.grid}
              label={t('equipment.form.mount')}
              value={item.mount}
              onChange={(mount) => onChange({ ...item, mount })}
              options={(['doorway', 'wall', 'ceiling', 'freestanding'] as const).map((m) => ({
                value: m,
                label: t(`labels.mount.${m}`),
              }))}
            />
          </Block>
          {item.mount === 'doorway' ? <Note>{t('equipment.form.doorwayNote')}</Note> : null}
          <Field label={t('equipment.form.ratedLoad')} hint={t('equipment.form.ratedLoadHint')}>
            <Stepper
              {...stepperProps(t('equipment.form.ratedLoad'))}
              value={rated}
              values={[UNKNOWN, 50, 60, 70, 80, 90, ...range(100, 300, 10)]}
              format={(v) => (v === UNKNOWN ? t('equipment.form.unknown') : n(v))}
              {...(rated === UNKNOWN ? {} : { unit: kg })}
              onChange={(v) => setRated(rated === UNKNOWN && v === 50 ? FIRST_RATED : v)}
            />
          </Field>
        </>
      );
    }
    case 'bench':
      return (
        <Block label={t('equipment.form.benchType')}>
          <SegmentedControl
            label={t('equipment.form.benchType')}
            value={item.incline ? 'incline' : 'flat'}
            onChange={(v) => onChange({ ...item, incline: v === 'incline' })}
            options={[
              { value: 'flat', label: t('equipment.form.flat') },
              { value: 'incline', label: t('equipment.form.adjustable') },
            ]}
          />
        </Block>
      );
    case 'treadmill':
      return (
        <>
          <Field label={t('equipment.form.topSpeed')}>
            <Stepper
              {...stepperProps(t('equipment.form.topSpeed'))}
              value={item.maxSpeedKmh}
              min={4}
              max={25}
              step={0.5}
              unit={t('labels.unit.kmh')}
              onChange={(maxSpeedKmh) => onChange({ ...item, maxSpeedKmh })}
            />
          </Field>
          <Field label={t('equipment.form.maxIncline')} hint={t('equipment.form.maxInclineHint')}>
            <Stepper
              {...stepperProps(t('equipment.form.maxIncline'))}
              value={item.maxInclinePct}
              min={0}
              max={20}
              step={1}
              format={(v) => (v === 0 ? t('equipment.form.none') : n(v))}
              {...(item.maxInclinePct === 0 ? {} : { unit: t('labels.unit.pct') })}
              onChange={(maxInclinePct) => onChange({ ...item, maxInclinePct })}
            />
          </Field>
        </>
      );
    default:
      return null;
  }
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

function Ruler({
  min,
  max,
  step,
  lang,
}: {
  min: number;
  max: number;
  step: number;
  lang: Language;
}) {
  const { t } = useTranslation();
  if (!(min < max) || step <= 0) return null;
  const loads: number[] = [];
  for (let v = min; v < max - 1e-6; v = Math.round((v + step) * 100) / 100) loads.push(v);
  loads.push(max);
  return (
    <div className={styles.ruler}>
      <div className={styles.ticks} aria-hidden="true">
        {loads.map((load, i) => (
          <i
            key={load}
            className={i === 0 || i === loads.length - 1 ? styles.end : undefined}
            style={{ left: `${((load - min) / (max - min)) * 100}%` }}
          />
        ))}
      </div>
      <p className={styles.rulerCount} aria-live="polite">
        {t('equipment.form.loadCount', {
          count: loads.length,
          min: formatNumber(min, lang),
          max: formatNumber(max, lang),
        })}
      </p>
    </div>
  );
}

interface WeightGridProps {
  all: readonly number[];
  defaultCount: 1 | 2;
  weights: readonly { kg: number; count: 1 | 2 }[];
  onChange: (weights: { kg: number; count: 1 | 2 }[]) => void;
  error?: string | undefined;
}

function WeightGrid({ all, defaultCount, weights, onChange, error }: WeightGridProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const owned = new Map(weights.map((w) => [w.kg, w.count]));
  const cells = [...new Set([...all, ...weights.map((w) => w.kg)])].sort((a, b) => a - b);

  const toggle = (kg: number) => {
    if (owned.has(kg)) onChange(weights.filter((w) => w.kg !== kg));
    else onChange([...weights, { kg, count: defaultCount }].sort((a, b) => a.kg - b.kg));
  };
  const setCount = (kg: number, count: 1 | 2) =>
    onChange(weights.map((w) => (w.kg === kg ? { ...w, count } : w)));

  const parsed = Number(draft.replace(',', '.'));
  const valid = draft.trim() !== '' && Number.isFinite(parsed) && parsed > 0 && parsed <= 100;
  const addOther = () => {
    if (!valid) return;
    const kg = Math.round(parsed * 100) / 100;
    if (!owned.has(kg))
      onChange([...weights, { kg, count: defaultCount }].sort((a, b) => a.kg - b.kg));
    setDraft('');
    setAdding(false);
  };

  return (
    <>
      <Block label={t('equipment.form.weightsOwned')} hint={t('equipment.form.weightsOwnedHint')}>
        {error ? <ErrorLine message={error} /> : null}
        <div className={`${styles.wgrid} ${error ? styles.wgridError : ''}`}>
          {cells.map((kg) => (
            <button
              key={kg}
              type="button"
              className={styles.wcell}
              aria-pressed={owned.has(kg)}
              aria-label={`${formatNumber(kg, lang)} ${t('labels.unit.kg')}`}
              onClick={() => toggle(kg)}
            >
              <span className={styles.wnum}>{formatNumber(kg, lang)}</span>
              <span className={styles.wunit}>{t('labels.unit.kg')}</span>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.wcell} ${styles.wadd}`}
            aria-expanded={adding}
            onClick={() => setAdding((v) => !v)}
          >
            <Icon name="plus" size={20} />
            {t('equipment.form.other')}
          </button>
        </div>
        {adding ? (
          <div className={styles.addRow}>
            <input
              className={styles.input}
              inputMode="decimal"
              aria-label={t('equipment.form.otherWeight')}
              placeholder={t('equipment.form.otherPlaceholder')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOther();
                }
              }}
            />
            <Button variant="secondary" disabled={!valid} onClick={addOther}>
              {t('equipment.form.add')}
            </Button>
          </div>
        ) : null}
      </Block>
      {weights.length > 0 ? (
        <Block label={t('equipment.form.howManyEach')}>
          <ul className={styles.wrows}>
            {[...weights]
              .sort((a, b) => a.kg - b.kg)
              .map((w) => (
                <li key={w.kg} className={styles.wrow}>
                  <span className={styles.wkg}>
                    <span className={styles.wnum}>{formatNumber(w.kg, lang)}</span>
                    {' '}
                    {t('labels.unit.kg')}
                  </span>
                  <SegmentedControl
                    className={styles.compact}
                    label={`${formatNumber(w.kg, lang)} ${t('labels.unit.kg')}`}
                    value={w.count === 2 ? 'pair' : 'single'}
                    onChange={(v) => setCount(w.kg, v === 'pair' ? 2 : 1)}
                    options={[
                      { value: 'single', label: t('equipment.form.single') },
                      { value: 'pair', label: t('equipment.form.byPair') },
                    ]}
                  />
                </li>
              ))}
          </ul>
        </Block>
      ) : null}
    </>
  );
}
