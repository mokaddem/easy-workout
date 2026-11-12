import { type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { EXIT_RATIO, useMotionTokens } from './tokens';

interface RollProps {
  /** Identity of the displayed value: when it changes, the old one leaves and the new one arrives. */
  value: string | number;
  className?: string;
  children: ReactNode;
}

/**
 * Digit roll for steppers and live counters: the old value leaves up by `distance-sm`, the new
 * one arrives from below over `fast`, `snap`. Both share one grid cell, so nothing shifts.
 */
export function Roll({ value, className, children }: RollProps) {
  const t = useMotionTokens();
  const d = t.distance.sm;
  return (
    <span className={className} style={{ display: 'inline-grid' }}>
      <AnimatePresence initial={false}>
        <m.span
          key={value}
          style={{ gridArea: '1 / 1', justifySelf: 'center' }}
          initial={{ opacity: 0, y: d }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: t.duration.fast, ease: t.ease.snap },
          }}
          exit={{
            opacity: 0,
            y: -d,
            transition: { duration: t.duration.fast * EXIT_RATIO, ease: t.ease.exit },
          }}
        >
          {children}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

interface CollapseProps {
  open: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Height and content fade over `base`, `move`. Closed content leaves the tree. */
export function Collapse({ open, id, className, children }: CollapseProps) {
  const t = useMotionTokens();
  const transition = { duration: t.duration.base, ease: t.ease.move };
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <m.div
          key="body"
          id={id}
          className={className}
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition }}
          exit={{ height: 0, opacity: 0, transition }}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

interface PresenceProps {
  /** Identity of the content; a change cross-fades. */
  id: string | number;
  className?: string;
  children: ReactNode;
}

/** Cross-fade between two states that occupy the same place (skeleton to cards, values on a week switch). */
export function CrossFade({ id, className, children }: PresenceProps) {
  const t = useMotionTokens();
  return (
    <div style={{ position: 'relative' }}>
      <AnimatePresence initial={false} mode="popLayout">
        <m.div
          key={id}
          className={className}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: t.duration.base, ease: t.ease.move } }}
          exit={{ opacity: 0, transition: { duration: t.duration.fast, ease: t.ease.exit } }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

/** Rows that come and go in a list: height and fade over `base`, `move`. */
export function PresenceList({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}

export function ListRowMotion({
  className,
  gap = 0,
  children,
}: {
  className?: string;
  /** The list's row gap in px: a row that is not there yet gives its gap back too. */
  gap?: number;
  children: ReactNode;
}) {
  const t = useMotionTokens();
  const transition = { duration: t.duration.base, ease: t.ease.move };
  return (
    <m.li
      className={className}
      style={{ overflow: 'hidden' }}
      initial={{ height: 0, opacity: 0, marginTop: -gap }}
      animate={{ height: 'auto', opacity: 1, marginTop: 0, transition }}
      exit={{ height: 0, opacity: 0, marginTop: -gap, transition }}
    >
      {children}
    </m.li>
  );
}
