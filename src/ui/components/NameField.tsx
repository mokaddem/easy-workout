import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';
import styles from './NameField.module.css';

export interface NameFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'type'
> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Error message; its presence turns the field to the error state. */
  error?: string;
  /** Defaults to 40. */
  maxLength?: number;
}

/** Title-sized text field for naming a session. */
export const NameField = forwardRef<HTMLInputElement, NameFieldProps>(function NameField(
  { label, value, onChange, error, maxLength = 40, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const msgId = `${inputId}-error`;
  return (
    <div className={cx(styles.field, error && styles.invalid, className)}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.box}>
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type="text"
          className={styles.input}
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? msgId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error ? (
        <p id={msgId} className={styles.message}>
          <Icon name="alert" size={20} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
});
