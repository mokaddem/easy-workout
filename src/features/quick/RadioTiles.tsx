import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Quick.module.css';

export interface RadioOption<T extends string | number> {
  value: T;
  /** Accessible name when it differs from the visible content. */
  label?: string;
  content: ReactNode;
}

interface RadioChoiceProps<T extends string | number> {
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Id of the heading that names the group. */
  labelledBy: string;
  variant: 'tiles' | 'chips' | 'seg';
}

/** Single choice among a few options, with radio-group semantics and arrow-key movement. */
export function RadioChoice<T extends string | number>({
  options,
  value,
  onChange,
  labelledBy,
  variant,
}: RadioChoiceProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const groupClass = { tiles: styles.tiles, chips: styles.chips, seg: styles.seg }[variant];
  const optionClass = { tiles: styles.tile, chips: styles.chip, seg: styles.segOpt }[variant];

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={groupClass}>
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            tabIndex={checked ? 0 : -1}
            className={optionClass}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, i)}
          >
            {option.content}
          </button>
        );
      })}
    </div>
  );
}
