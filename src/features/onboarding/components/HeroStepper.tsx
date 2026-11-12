import { useId } from 'react';
import { Roll } from '@/motion';
import { Icon } from '@/ui/components';
import styles from './HeroStepper.module.css';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  decrementLabel: string;
  incrementLabel: string;
  unit?: string;
  /** hero = 100 px track, 96 px numeral; form = 88 px track, 72 px numeral. */
  size?: 'hero' | 'form';
}

/** Big stepper: one tap = one step. */
export function HeroStepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
  decrementLabel,
  incrementLabel,
  unit,
  size = 'hero',
}: Props) {
  const labelId = useId();
  return (
    <div className={`${styles.big} ${size === 'form' ? styles.form : ''}`}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div className={styles.track} role="group" aria-labelledby={labelId}>
        <button
          type="button"
          className={styles.btn}
          aria-label={decrementLabel}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Icon name="minus" size={28} />
        </button>
        <output className={styles.value} aria-live="polite">
          <Roll className={styles.num} value={value}>
            {value}
          </Roll>
          {unit ? <span className={styles.unit}>{unit}</span> : null}
        </output>
        <button
          type="button"
          className={styles.btn}
          aria-label={incrementLabel}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          <Icon name="plus" size={28} />
        </button>
      </div>
    </div>
  );
}
