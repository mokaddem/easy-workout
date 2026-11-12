import { useId } from 'react';
import { Icon } from '@/ui/components';
import styles from './NumField.module.css';

interface Props {
  /** Visible label; omit when a heading above already names the field. */
  label?: string;
  hint?: string;
  accessibleLabel: string;
  value: string;
  onChange: (raw: string) => void;
  onBlur?: () => void;
  unit: string;
  placeholder?: string;
  message: string;
  error?: boolean;
  compact?: boolean;
}

/** Large decimal field with a unit and one message line (note or error). */
export function NumField({
  label,
  hint,
  accessibleLabel,
  value,
  onChange,
  onBlur,
  unit,
  placeholder = '–',
  message,
  error = false,
  compact = false,
}: Props) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div
      className={`${styles.field} ${error ? styles.isError : ''} ${compact ? styles.compact : ''}`}
    >
      {label ? (
        <label className={styles.label} htmlFor={id}>
          <span>{label}</span>
          {hint ? <small>{hint}</small> : null}
        </label>
      ) : null}
      <label className={styles.box}>
        <input
          id={id}
          className={styles.input}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          aria-label={accessibleLabel}
          aria-invalid={error || undefined}
          aria-describedby={msgId}
          placeholder={placeholder}
          style={{ width: `${Math.max(value.length, placeholder.length, 1) + 0.15}ch` }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...(onBlur ? { onBlur } : {})}
        />
        <span className={styles.unit}>{unit}</span>
      </label>
      <p
        id={msgId}
        className={`${styles.msg} ${error ? styles.msgError : ''}`}
        role={error ? 'alert' : undefined}
      >
        <Icon name={error ? 'alert' : 'info'} size={20} />
        <span>{message}</span>
      </p>
    </div>
  );
}
