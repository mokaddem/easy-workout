import { useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { AnimatePresence, animate, m, usePresence } from 'motion/react';
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
  // Height changes are instant under reduced motion; only the fade remains.
  const transition = t.reduced
    ? { height: { duration: 0 }, opacity: { duration: t.duration.fast, ease: t.ease.move } }
    : { duration: t.duration.base, ease: t.ease.move };
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

interface RowMotionProps {
  as?: 'div' | 'li';
  className?: string;
  /** The list's row gap in px: a row that is not there yet gives its gap back too. */
  gap?: number;
  /** `dismiss`: the leaving row collapses at 70 % of `base` with `exit` (a dismissed card or note). */
  leave?: 'move' | 'dismiss';
  children: ReactNode;
}

/**
 * A row, card or note that is added to or removed from a list inside a `PresenceList`: height and
 * fade over `base`, `move`. Overflow is only clipped while it moves, so shadows and focus rings
 * survive at rest. Under reduced motion the height changes at once and only the fade remains.
 */
export function RowMotion({
  as = 'div',
  className,
  gap = 0,
  leave = 'move',
  children,
}: RowMotionProps) {
  const t = useMotionTokens();
  const fade = { duration: t.duration.fast, ease: t.ease.move };
  const enter = t.reduced
    ? { height: { duration: 0 }, marginTop: { duration: 0 }, opacity: fade }
    : { duration: t.duration.base, ease: t.ease.move };
  const out = t.reduced
    ? enter
    : leave === 'dismiss'
      ? { duration: t.duration.base * EXIT_RATIO, ease: t.ease.exit }
      : enter;
  const Tag = as === 'li' ? m.li : m.div;
  return (
    <Tag
      className={className}
      initial={{ height: 0, opacity: 0, marginTop: -gap, overflow: 'hidden' }}
      animate={{
        height: 'auto',
        opacity: 1,
        marginTop: 0,
        transition: enter,
        transitionEnd: { overflow: 'visible' },
      }}
      exit={{ height: 0, opacity: 0, marginTop: -gap, overflow: 'hidden', transition: out }}
    >
      {children}
    </Tag>
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

interface SwapProps {
  /** Identity of the content; a change cross-fades and the height follows the new content. */
  id: string | number;
  className?: string;
  /** Layout of the content itself (it sits in a wrapper that changes with the id). */
  innerClassName?: string;
  children: ReactNode;
}

/**
 * A card whose content changes state: the old content fades out, the new one fades in, and the
 * height animates between the two over `base`, `move`. Under reduced motion the height jumps and
 * only the cross-fade (`fast`) remains.
 */
export function Swap({ id, className, innerClassName, children }: SwapProps) {
  const t = useMotionTokens();
  const [height, setHeight] = useState<number | undefined>();
  const observer = useRef<ResizeObserver | null>(null);
  const measure = (node: HTMLDivElement | null) => {
    // A leaving child detaches (null) after the new one has attached: keep observing the new one.
    if (!node) return;
    observer.current?.disconnect();
    setHeight(node.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.current.observe(node);
  };
  useLayoutEffect(() => () => observer.current?.disconnect(), []);
  return (
    <m.div
      className={className}
      style={{ position: 'relative', overflow: 'hidden' }}
      initial={false}
      animate={{
        height: height ?? 'auto',
        transition: t.reduced ? { duration: 0 } : { duration: t.duration.base, ease: t.ease.move },
      }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <m.div
          key={id}
          ref={measure}
          className={innerClassName}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: t.duration.fast, ease: t.ease.move } }}
          exit={{
            opacity: 0,
            transition: { duration: t.duration.fast * EXIT_RATIO, ease: t.ease.exit },
          }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </m.div>
  );
}

/** Where a repositioned element was last seen (viewport top), shared by its two homes. */
export type RepositionAnchor = MutableRefObject<number | null>;

/**
 * An element that moves to another place in the layout (it is unmounted in one slot and mounted
 * in the other): on arrival it starts from where it was and glides to its new place over `base`,
 * `move`. Under reduced motion it simply appears there.
 */
export function Reposition({
  anchorRef,
  className,
  children,
}: {
  anchorRef: RepositionAnchor;
  className?: string;
  children: ReactNode;
}) {
  const t = useMotionTokens();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = anchorRef.current;
    anchorRef.current = null;
    const top = el.getBoundingClientRect().top;
    let controls: { stop: () => void } | undefined;
    if (from !== null && !t.reduced && Math.abs(from - top) > 1) {
      controls = animate(
        el,
        { y: [from - top, 0] },
        {
          duration: t.duration.base,
          ease: t.ease.move,
        },
      );
    }
    return () => {
      controls?.stop();
      anchorRef.current = el.getBoundingClientRect().top;
    };
    // The motion plays once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
