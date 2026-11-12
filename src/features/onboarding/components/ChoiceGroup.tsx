import { useId, useRef, type KeyboardEvent } from 'react';
import { Icon } from '@/ui/components';
import styles from './ChoiceGroup.module.css';

export interface ChoiceOption<T extends string> {
  value: T;
  title: string;
  description?: string;
  /** Large figure at the end of the card, e.g. a rep range. */
  figure?: { value: string; label: string };
}

interface Props<T extends string> {
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** goal = tall cards with a description; compact = title and figure only. */
  size?: 'default' | 'goal' | 'compact';
  error?: boolean;
}

/** Single choice as a stack of cards. */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'default',
  error = false,
}: Props<T>) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((o) => o.value === value);
  const tabbable = selected >= 0 ? selected : 0;

  function onKeyDown(event: KeyboardEvent, index: number) {
    const delta =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-invalid={error || undefined}
      className={`${styles.choices} ${error ? styles.error : ''}`}
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
          tabIndex={index === tabbable ? 0 : -1}
          className={`${styles.choice} ${size === 'goal' ? styles.goal : ''} ${
            size === 'compact' ? styles.compact : ''
          }`}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <span className={styles.radio} aria-hidden="true">
            <Icon name="check" size={20} />
          </span>
          <span className={styles.text}>
            <span className={styles.title}>{option.title}</span>
            {option.description ? <span className={styles.desc}>{option.description}</span> : null}
          </span>
          {option.figure ? (
            <span className={styles.fig}>
              <span className={styles.num}>{option.figure.value}</span>
              <small>{option.figure.label}</small>
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
