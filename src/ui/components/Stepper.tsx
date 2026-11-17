import { useId } from 'react';
import { Roll } from '@/motion';
import { Icon } from './Icon';
import { cx } from './cx';
import styles from './Stepper.module.css';

interface StepperBase {
  /** Current value; null or undefined shows the empty dash. */
  value: number | null | undefined;
  onChange: (value: number) => void;
  /** Accessible name of the whole control (what is being set). */
  label: string;
  decrementLabel: string;
  incrementLabel: string;
  unit?: string;
  format?: (value: number) => string;
  size?: 'form' | 'player';
  disabled?: boolean;
  className?: string;
  /** Stretch to the full width; the value sits centred between the buttons. */
  wide?: boolean;
  /** Narrower value cell, for steppers placed side by side. */
  compact?: boolean;
  /** Replaces the displayed number with a word (the value is still the number). No unit. */
  word?: string;
  /** Shown instead of 0, without the unit. */
  zeroWord?: string;
}

export interface StepperValuesProps extends StepperBase {
  /** Ordered, ascending list of values the equipment can actually make. */
  values: readonly number[];
  min?: never;
  max?: never;
  step?: never;
}

export interface StepperRangeProps extends StepperBase {
  values?: undefined;
  min: number;
  max: number;
  step: number;
}

export type StepperProps = StepperValuesProps | StepperRangeProps;

const EPSILON = 1e-9;

function clean(n: number): number {
  return Number(n.toFixed(6));
}

/** Next value above / below the current one, or undefined at the limit. */
function neighbour(props: StepperProps, direction: 1 | -1): number | undefined {
  const { value } = props;
  if (props.values) {
    const list = props.values;
    if (list.length === 0) return undefined;
    if (value == null) return direction === 1 ? list[0] : undefined;
    return direction === 1
      ? list.find((v) => v > value + EPSILON)
      : [...list].reverse().find((v) => v < value - EPSILON);
  }
  const { min, max, step } = props;
  if (value == null) return direction === 1 ? min : undefined;
  const next = clean(value + direction * step);
  if (direction === 1) return value >= max - EPSILON ? undefined : Math.min(next, max);
  return value <= min + EPSILON ? undefined : Math.max(next, min);
}

export function Stepper(props: StepperProps) {
  const {
    value,
    onChange,
    label,
    decrementLabel,
    incrementLabel,
    unit,
    format,
    size = 'form',
    wide,
    compact,
    word,
    zeroWord,
  } = props;
  const labelId = useId();
  const down = props.disabled ? undefined : neighbour(props, -1);
  const up = props.disabled ? undefined : neighbour(props, 1);
  const empty = value == null;
  const shown = empty ? undefined : (word ?? (value === 0 ? zeroWord : undefined));

  const text = empty ? '–' : (shown ?? (format ? format(value) : String(value)));

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cx(
        styles.stepper,
        size === 'player' && styles.player,
        wide && styles.wide,
        compact && styles.compact,
        props.className,
      )}
    >
      <span id={labelId} className={styles.hidden}>
        {label}
      </span>
      <button
        type="button"
        className={styles.btn}
        aria-label={decrementLabel}
        disabled={down === undefined}
        onClick={() => down !== undefined && onChange(down)}
      >
        <Icon name="minus" />
      </button>
      <span
        className={cx(styles.value, empty && styles.empty)}
        aria-live="polite"
        aria-atomic="true"
      >
        <Roll className={shown !== undefined ? styles.word : styles.num} value={text}>
          {text}
        </Roll>
        {unit && !empty && shown === undefined ? <span className={styles.unit}>{unit}</span> : null}
      </span>
      <button
        type="button"
        className={styles.btn}
        aria-label={incrementLabel}
        disabled={up === undefined}
        onClick={() => up !== undefined && onChange(up)}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
