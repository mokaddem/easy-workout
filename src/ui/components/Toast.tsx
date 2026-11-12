import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { EXIT_RATIO, useMotionTokens } from '@/motion/tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { ToastContext, type ToastApi, type ToastOptions } from './toastContext';
import styles from './Toast.module.css';

export const TOAST_MS = 3000;
export const TOAST_ACTION_MS = 5000;

export interface ToastProviderProps {
  children: ReactNode;
  /** CSS length that lifts the toast above a dock or tab bar. */
  offsetBottom?: string;
}

interface Current extends ToastOptions {
  key: number;
}

export function ToastProvider({ children, offsetBottom = '0px' }: ToastProviderProps) {
  const [current, setCurrent] = useState<Current | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const counter = useRef(0);
  const tokens = useMotionTokens();

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setCurrent(null);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    clearTimeout(timer.current);
    counter.current += 1;
    setCurrent({ ...options, key: counter.current });
    timer.current = setTimeout(() => setCurrent(null), options.action ? TOAST_ACTION_MS : TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className={styles.region}
        role="status"
        style={{
          bottom: `calc(${offsetBottom} + env(safe-area-inset-bottom, 0px) + var(--space-4))`,
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {current ? (
            <m.div
              key={current.key}
              className={styles.toast}
              data-tone={current.tone ?? 'default'}
              initial={{ opacity: 0, y: tokens.distance.sm }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: tokens.duration.base, ease: tokens.ease.snap },
              }}
              exit={{
                opacity: 0,
                transition: {
                  duration: tokens.duration.fast * EXIT_RATIO,
                  ease: tokens.ease.exit,
                },
              }}
            >
              {current.tone === 'error' ? <Icon name="stop" size={24} /> : null}
              <span className={styles.text}>{current.message}</span>
              {current.action ? (
                <Button
                  variant="ghost"
                  className={styles.action}
                  onClick={() => {
                    current.action?.onAction();
                    dismiss();
                  }}
                >
                  {current.action.label}
                </Button>
              ) : null}
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
