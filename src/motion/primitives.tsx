import { type ReactNode } from 'react';
import { AnimatePresence, m, usePresence } from 'motion/react';
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

interface TickProps {
  /** Identity of the displayed value; a change replays the entrance. Omit to play once on mount. */
  value?: string | number;
  className?: string;
  children: ReactNode;
}

/**
 * A numeral that arrives in place: it rises `distance-sm` and fades in over `fast`, `snap`.
 * There is no exit and no layout shift (the old value is simply replaced), so a clock can use it
 * every second without ever holding the display back. Under reduced motion it is a plain fade.
 */
export function Tick({ value, className, children }: TickProps) {
  const t = useMotionTokens();
  return (
    <m.span
      key={value}
      className={className}
      style={{ display: 'inline-block' }}
      initial={{ opacity: 0, y: t.distance.sm }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: t.duration.fast, ease: t.ease.snap },
      }}
    >
      {children}
    </m.span>
  );
}

interface PulseProps {
  /** Each change fires one pulse; `undefined` or `false` rests. */
  fire: string | number | false | undefined;
  className?: string;
  children: ReactNode;
}

/**
 * The last-seconds pulse: scale 1, 1.04, 1 over `fast`. Under reduced motion the scale is
 * dropped and the numerals dip in opacity instead, so it still reads as a beat.
 */
export function Pulse({ fire, className, children }: PulseProps) {
  const t = useMotionTokens();
  const active = fire !== false && fire !== undefined;
  return (
    <m.span
      key={active ? fire : 'rest'}
      className={className}
      style={{ display: 'inline-flex' }}
      initial={{ scale: 1, opacity: 1 }}
      animate={
        active
          ? t.reduced
            ? { opacity: [0.55, 1], transition: { duration: t.duration.fast, ease: t.ease.move } }
            : { scale: [1, 1.04, 1], transition: { duration: t.duration.fast, ease: t.ease.move } }
          : { scale: 1, opacity: 1 }
      }
    >
      {children}
    </m.span>
  );
}

interface FloodProps {
  /** Where the colour grows from. `bottom`: the main button. `centre`: the clock. */
  origin: 'bottom' | 'centre';
  /** Called once the entrance has finished (not on exit). */
  onSettled?: () => void;
  children?: never;
}

const FLOOD_SIZE = '300vmax';

/**
 * The yellow takeover as a disc that grows from where the tap was over `flood`, `snap`, and
 * shrinks back with `exit` over `slow`. It is purely visual: the player state has already changed.
 * Under reduced motion it is a cross-fade at full size.
 */
export function Flood({ origin, onSettled }: FloodProps) {
  const t = useMotionTokens();
  const [present] = usePresence();
  const position =
    origin === 'bottom'
      ? { bottom: `calc(72px - ${FLOOD_SIZE} / 2)` }
      : { top: `calc(46% - ${FLOOD_SIZE} / 2)` };
  const reducedFade = { duration: t.duration.fast, ease: t.ease.move };
  return (
    <m.div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '50%',
        width: FLOOD_SIZE,
        height: FLOOD_SIZE,
        marginLeft: `calc(${FLOOD_SIZE} / -2)`,
        borderRadius: '50%',
        background: 'var(--color-rest-bg)',
        pointerEvents: 'none',
        zIndex: 0,
        willChange: 'transform',
        ...position,
      }}
      initial={t.reduced ? { opacity: 0 } : { scale: 0.02 }}
      animate={
        t.reduced
          ? { opacity: 1, transition: reducedFade }
          : { scale: 1, transition: { duration: t.duration.flood, ease: t.ease.snap } }
      }
      exit={
        t.reduced
          ? { opacity: 0, transition: reducedFade }
          : { scale: 0.02, transition: { duration: t.duration.slow, ease: t.ease.exit } }
      }
      onAnimationComplete={() => {
        if (present) onSettled?.();
      }}
    />
  );
}
