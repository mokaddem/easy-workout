import { useTranslation } from 'react-i18next';
import type { Language } from '@/domain';
import type { BodyPoint } from '@/engine';
import { numberText } from '@/features/adapt/format';
import { cx } from '@/ui/components/cx';
import { bodyLayout } from './bodyChart';
import { linear } from './scales';
import { useInspect } from './useInspect';
import { useWidth } from './useWidth';
import styles from './charts.module.css';

export interface BodyChartProps {
  points: readonly BodyPoint[];
  /** Sleep is drawn as columns, weight and waist as a line. */
  sleep?: boolean;
  selected: number | null;
  onSelect: (index: number | null) => void;
  name: string;
}

const GUTTER = 32;
const PAD = 10;
const PLOT_H = 140;
const AXIS_H = 26;
const TOP = 14;

/** Body measures over time: a straight line between check-ins, or one column per night average. */
export function BodyChart({ points, sleep = false, selected, onSelect, name }: BodyChartProps) {
  const { i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const { ref, width } = useWidth<HTMLDivElement>();
  const layout = bodyLayout(points, sleep);
  const left = GUTTER + PAD;
  const right = width - PAD - 4;
  const xs = layout.xs.map((x) => left + x * Math.max(10, right - left));
  const base = TOP + PLOT_H;
  const y = linear(layout.axis.min, layout.axis.max, base, TOP);
  const last = points.length - 1;
  const active = selected !== null && selected <= last ? selected : last;
  const inspecting = selected !== null && selected <= last;
  const inspect = useInspect({ xs, selected, onSelect });

  const dateText = (date: string) => {
    const [yy, m, d] = date.split('-').map(Number) as [number, number, number];
    return new Intl.DateTimeFormat(lang, {
      day: layout.monthLabels ? undefined : 'numeric',
      month: 'short',
    }).format(new Date(yy, m - 1, d));
  };

  const line = points
    .map((_, i) => `${i === 0 ? 'M' : 'L'}${xs[i]},${y(points[i]!.value)}`)
    .join(' ');
  const colW = 16;

  return (
    <div ref={ref} className={styles.wrap} {...inspect} aria-label={name} data-testid="body-plot">
      <svg
        className={styles.svg}
        width={width}
        height={base + AXIS_H}
        viewBox={`0 0 ${width} ${base + AXIS_H}`}
        aria-hidden="true"
        focusable="false"
      >
        {layout.axis.ticks.map((tick) => (
          <g key={tick}>
            <line className={styles.grid} x1={GUTTER} x2={width - 4} y1={y(tick)} y2={y(tick)} />
            <text className={styles.tick} x={GUTTER - 6} y={y(tick) + 4} textAnchor="end">
              {numberText(tick, lang)}
            </text>
          </g>
        ))}
        <line className={styles.baseline} x1={GUTTER} x2={width - 4} y1={base} y2={base} />
        {sleep
          ? points.map((p, i) => (
              <rect
                key={p.date}
                className={i === active ? styles.colHot : styles.colPast}
                x={xs[i]! - colW / 2}
                y={y(p.value)}
                width={colW}
                height={Math.max(1, base - y(p.value))}
                rx={4}
              />
            ))
          : null}
        {!sleep && points.length > 1 ? <path className={styles.line} d={line} /> : null}
        {!sleep
          ? points.map((p, i) => (
              <circle
                key={p.date}
                className={styles.dot}
                cx={xs[i]}
                cy={y(p.value)}
                r={i === active && inspecting ? 6 : i === last ? 5 : 4}
              />
            ))
          : null}
        {inspecting ? (
          <line className={styles.cross} x1={xs[active]} x2={xs[active]} y1={TOP} y2={base} />
        ) : null}
        {sleep && points[active] ? (
          <text
            className={styles.cap}
            x={xs[active]}
            y={Math.max(TOP + 10, y(points[active]!.value) - 6)}
            textAnchor="middle"
          >
            {numberText(points[active]!.value, lang)}
          </text>
        ) : null}
        {layout.labelled.map((i) => (
          <text
            key={points[i]!.date}
            className={cx(styles.axis, i === last && styles.axisNow)}
            x={xs[i]}
            y={base + 18}
            textAnchor="middle"
          >
            {dateText(points[i]!.date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
