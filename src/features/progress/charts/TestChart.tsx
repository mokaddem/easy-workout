import { useTranslation } from 'react-i18next';
import type { Language } from '@/domain';
import { numberText } from '@/features/adapt/format';
import { cx } from '@/ui/components/cx';
import { linear, slotCentres } from './scales';
import { bestOfContext, type TestColumn } from './testChart';
import { useInspect } from './useInspect';
import { useWidth } from './useWidth';
import styles from './charts.module.css';

export interface TestChartProps {
  columns: readonly TestColumn[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  name: string;
}

const MIN_SLOTS = 5;
const GUTTER = 8;
const AXIS_H = 26;
const MAX_COLUMN = 24;

/** One column per test: solid for a fresh test, outlined for one taken inside a session. */
export function TestChart({ columns, selected, onSelect, name }: TestChartProps) {
  const { i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const { ref, width } = useWidth<HTMLDivElement>();
  const plotH = columns.length === 1 ? 80 : 110;
  const top = 22;
  const base = top + plotH;
  const slots = Math.max(MIN_SLOTS, columns.length);
  const plotW = Math.max(40, width - GUTTER * 2);
  const slotW = plotW / slots;
  const xs = slotCentres(slots)
    .slice(0, columns.length)
    .map((x) => GUTTER + x * plotW);
  const max = Math.max(1, ...columns.map((c) => c.value));
  const y = linear(0, max * 1.15, base, top);
  const colW = Math.min(MAX_COLUMN, Math.max(6, Math.round(slotW * 0.55)));
  const last = columns.length - 1;
  const active = selected !== null && selected <= last ? selected : last;
  const inspect = useInspect({ xs, selected, onSelect });

  const dateText = (date: string) => {
    const [yy, m, d] = date.split('-').map(Number) as [number, number, number];
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(
      new Date(yy, m - 1, d),
    );
  };

  return (
    <div ref={ref} className={styles.wrap} {...inspect} aria-label={name} data-testid="test-plot">
      <svg
        className={styles.svg}
        width={width}
        height={base + AXIS_H}
        viewBox={`0 0 ${width} ${base + AXIS_H}`}
        aria-hidden="true"
        focusable="false"
      >
        <line className={styles.baseline} x1={GUTTER} x2={width - GUTTER} y1={base} y2={base} />
        {columns.map((c, i) => {
          const x = xs[i]! - colW / 2;
          const topY = y(c.value);
          const h = Math.max(1, base - topY);
          const r = Math.min(4, colW / 2, h);
          const d = `M${x},${base} V${topY + r} Q${x},${topY} ${x + r},${topY} H${x + colW - r} Q${x + colW},${topY} ${x + colW},${topY + r} V${base} Z`;
          const labelled = i === last || bestOfContext(columns, i) || i === active;
          return (
            <g key={c.id}>
              <path
                d={d}
                className={cx(
                  c.context === 'session'
                    ? styles.colHollow
                    : i === active
                      ? styles.colHot
                      : styles.colPast,
                )}
              />
              {labelled ? (
                <text
                  className={styles.cap}
                  x={xs[i]}
                  y={Math.max(14, topY - 6)}
                  textAnchor="middle"
                >
                  {numberText(c.value, lang)}
                </text>
              ) : null}
              <text
                className={cx(styles.axis, i === last && styles.axisNow)}
                x={xs[i]}
                y={base + 18}
                textAnchor="middle"
              >
                {dateText(c.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
