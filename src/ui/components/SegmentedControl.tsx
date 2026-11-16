import { useId, useRef, type KeyboardEvent } from 'react';
import { cx } from './cx';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Up to 4 options; more becomes a list. */
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Accessible name of the radio group. */
  label: string;
  /** Nothing picked yet and a pick is wanted: outlined. */
  ask?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  ask,
  className,
}: SegmentedControlProps<T>) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const selectedIndex = options.findIndex((o) => o.value === value);
  // Roving tabindex: the selected option, else the first enabled one.
  const tabbable =
    selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : enabled[0];

  function move(from: number, delta: 1 | -1) {
    const pos = enabled.indexOf(from);
    const next = enabled[(pos + delta + enabled.length) % enabled.length];
    if (next === undefined) return;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(index, -1);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className={cx(styles.seg, ask && styles.ask, className)}
    >
      <span id={labelId} className={styles.hidden}>
        {label}
      </span>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={option.disabled}
          tabIndex={index === tabbable ? 0 : -1}
          className={styles.opt}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
