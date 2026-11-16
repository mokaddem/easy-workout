import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Settings } from '@/domain';
import styles from './RestPicker.module.css';

type Value = Settings['restDisplay'];
const OPTIONS: Value[] = ['takeover', 'ring'];

/** Two tiles, each with a miniature of its look. Arrow keys move the choice. */
export function RestPicker({
  value,
  onChange,
}: {
  value: Value;
  onChange: (value: Value) => void;
}) {
  const { t } = useTranslation();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (event: KeyboardEvent, index: number) => {
    const step = ['ArrowRight', 'ArrowDown'].includes(event.key)
      ? 1
      : ['ArrowLeft', 'ArrowUp'].includes(event.key)
        ? -1
        : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + OPTIONS.length) % OPTIONS.length;
    onChange(OPTIONS[next]!);
    refs.current[next]?.focus();
  };

  return (
    <div className={styles.pick} role="radiogroup" aria-label={t('settings.during.rest')}>
      {OPTIONS.map((option, index) => (
        <button
          key={option}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === option}
          tabIndex={value === option ? 0 : -1}
          className={styles.opt}
          onClick={() => onChange(option)}
          onKeyDown={(event) => onKey(event, index)}
        >
          {option === 'takeover' ? (
            <span className={`${styles.mini} ${styles.takeover}`} aria-hidden="true">
              <b>90</b>
              <i />
            </span>
          ) : (
            <span className={`${styles.mini} ${styles.ring}`} aria-hidden="true">
              <svg viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="var(--color-track)"
                  strokeWidth="4"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="var(--color-accent-line)"
                  strokeWidth="4"
                  strokeDasharray="62 88"
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <b>90</b>
            </span>
          )}
          <span className={styles.text}>
            <span className={styles.title}>
              {t(
                option === 'takeover' ? 'settings.during.restTakeover' : 'settings.during.restRing',
              )}
            </span>
            <span className={styles.sub}>
              {t(
                option === 'takeover'
                  ? 'settings.during.restTakeoverSub'
                  : 'settings.during.restRingSub',
              )}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
