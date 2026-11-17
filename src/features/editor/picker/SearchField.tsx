import { useRef } from 'react';
import { Icon, IconButton } from '@/ui/components';
import styles from './picker.module.css';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  clearLabel: string;
}

/** Search box; Enter hides the on-screen keyboard. */
export function SearchField({ value, onChange, label, clearLabel }: SearchFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.search}>
      <Icon name="search" size={24} className={styles.searchIcon} />
      <input
        ref={input}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={styles.searchInput}
        value={value}
        placeholder={label}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            input.current?.blur();
          }
        }}
      />
      {value ? (
        <IconButton
          icon="close"
          label={clearLabel}
          onClick={() => {
            onChange('');
            input.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
