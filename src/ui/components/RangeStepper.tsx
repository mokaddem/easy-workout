import { Stepper } from './Stepper';
import { cx } from './cx';
import styles from './RangeStepper.module.css';

export interface RangeHalfLabels {
  /** Accessible name of this half ("Minimum reps"). */
  label: string;
  decrementLabel: string;
  incrementLabel: string;
}

export interface RangeStepperProps {
  low: number;
  high: number;
  /** Absolute bounds. */
  min: number;
  max: number;
  step?: number;
  /** Called with the new pair; low never exceeds high. */
  onChange: (low: number, high: number) => void;
  /** The joining words: "de" / "à". */
  fromWord: string;
  toWord: string;
  lowLabels: RangeHalfLabels;
  highLabels: RangeHalfLabels;
  unit?: string;
  disabled?: boolean;
  className?: string;
}

/** "from [−] 6 [+] to [−] 10 [+]": two steppers that cannot cross. */
export function RangeStepper({
  low,
  high,
  min,
  max,
  step = 1,
  onChange,
  fromWord,
  toWord,
  lowLabels,
  highLabels,
  unit,
  disabled,
  className,
}: RangeStepperProps) {
  return (
    <div className={cx(styles.range, className)}>
      <span className={styles.word}>{fromWord}</span>
      <Stepper
        compact
        label={lowLabels.label}
        decrementLabel={lowLabels.decrementLabel}
        incrementLabel={lowLabels.incrementLabel}
        min={min}
        max={Math.max(min, high)}
        step={step}
        unit={unit}
        value={low}
        disabled={disabled}
        onChange={(v) => onChange(v, high)}
      />
      <span className={styles.word}>{toWord}</span>
      <Stepper
        compact
        label={highLabels.label}
        decrementLabel={highLabels.decrementLabel}
        incrementLabel={highLabels.incrementLabel}
        min={Math.min(max, low)}
        max={max}
        step={step}
        unit={unit}
        value={high}
        disabled={disabled}
        onChange={(v) => onChange(low, v)}
      />
    </div>
  );
}
