import { useTranslation } from 'react-i18next';
import type { Language } from '@/domain';
import { numberText } from '@/features/adapt/format';
import { cx } from '@/ui/components/cx';
import { columnCeiling, columnWidth, linear } from './scales';
import type { LadderModel, Rung } from './ladder';
import { useInspect } from './useInspect';
import { useWidth } from './useWidth';
import styles from './charts.module.css';

export interface LadderChartProps {
  model: LadderModel;
  /** Inspected item; null = the latest. */
  selected: number | null;
  onSelect: (index: number | null) => void;
  /** "Charge, kg par haltère"; absent with no level panel. */
  levelTitle?: string;
  /** "Reps, meilleure série". */
  valueTitle: string;
  /** How to move on the chart, for assistive tech. */
  name: string;
}

const PAD_R = 8;
const TITLE_H = 18;
const GAP = 14;
const AXIS_H = 26;
const LEVEL_H = 48;
const RUNG_H = 18;
const MAX_COLUMN = 14;
const DASH_W = 8;

const sans = (t: (k: string) => string) => t('stats.ladder.sans');

/** Level panel over a column panel on one time axis: rep gains climb, load steps stair. */
export function LadderChart({
  model,
  selected,
  onSelect,
  levelTitle,
  valueTitle,
  name,
}: LadderChartProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const { ref, width } = useWidth<HTMLDivElement>();
  const level = model.level;
  const wordy = level?.kind === 'band' || level?.kind === 'assisted';
  const gutter = wordy ? 54 : 32;
  const plotW = Math.max(40, width - gutter - PAD_R);
  const px = (x: number) => gutter + x * plotW;

  const rungs = level?.rungs ?? [];
  const levelH = !level ? 0 : wordy ? Math.max(LEVEL_H, rungs.length * RUNG_H) : LEVEL_H;
  const levelTop = TITLE_H;
  const repsTitleY = levelTop + levelH + (level ? GAP : 0);
  const repsTop = repsTitleY + TITLE_H;
  const repsH = level ? 100 : 140;
  const base = repsTop + repsH;
  const height = base + AXIS_H;

  const lastIndex = model.items.length - 1;
  const active = selected !== null && selected <= lastIndex ? selected : lastIndex;
  const inspecting = selected !== null && selected <= lastIndex;

  const rungY = (r: Rung): number => {
    if (!level) return 0;
    if (wordy) {
      const index = rungs.indexOf(r);
      return levelTop + levelH - RUNG_H / 2 - index * RUNG_H;
    }
    const values = rungs.map((x) => x.value);
    const y = linear(Math.min(...values), Math.max(...values), levelTop + levelH - 8, levelTop + 8);
    return y(r.value);
  };
  const yOfLevel = (value: number | undefined): number | undefined => {
    if (!level || value === undefined) return undefined;
    const rung = rungs.find((r) => r.value === value);
    return rung ? rungY(rung) : undefined;
  };

  const ceiling = columnCeiling(model.range?.max, model.valueMax);
  const yv = linear(0, ceiling, base, repsTop);
  const xs = model.items.map((i) => px(i.x));
  const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
  const colW = columnWidth(gaps.length > 0 ? gaps : [plotW / 6], MAX_COLUMN);

  const inspect = useInspect({ xs: xs.map((x) => x), selected, onSelect });

  const rungText = (r: Rung) =>
    r.sans ? sans(t) : r.band ? t(`labels.band.${r.band}`) : numberText(r.value, lang);

  const monthText = (date: string) => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    return new Intl.DateTimeFormat(lang, { month: 'short' }).format(new Date(y, m - 1, d));
  };

  const column = (i: number) => {
    const item = model.items[i]!;
    if (item.value === undefined) return null;
    const x = xs[i]! - colW / 2;
    const top = yv(item.value);
    const h = Math.max(1, base - top);
    const r = Math.min(4, colW / 2, h);
    const d = `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + colW - r} Q${x + colW},${top} ${x + colW},${top + r} V${base} Z`;
    const hot = i === active;
    return (
      <path
        key={item.key}
        d={d}
        className={cx(item.hollow ? styles.colPain : hot ? styles.colHot : styles.colPast)}
        data-testid="ladder-column"
      />
    );
  };

  const stepPath = (() => {
    const parts: string[] = [];
    let prevY: number | undefined;
    let prevX: number | undefined;
    model.items.forEach((item, i) => {
      const y = yOfLevel(item.level);
      if (y === undefined) return;
      const x = xs[i]!;
      if (prevY === undefined || prevX === undefined) parts.push(`M${x},${y}`);
      else if (prevY !== y) {
        const mid = (prevX + x) / 2;
        parts.push(`H${mid} V${y} H${x}`);
      } else parts.push(`H${x}`);
      prevY = y;
      prevX = x;
    });
    return parts.join(' ');
  })();

  const capText = (i: number) => {
    const v = model.items[i]!.value;
    return v === undefined ? '' : numberText(v, lang);
  };

  return (
    <div ref={ref} className={styles.wrap} {...inspect} aria-label={name} data-testid="ladder-plot">
      <svg
        className={styles.svg}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        focusable="false"
      >
        {model.slots
          .filter((s) => s.current)
          .map((s) => (
            <rect
              key={s.x0}
              className={styles.now}
              x={px(s.x0) + 1}
              y={levelTop - 4}
              width={Math.max(0, (s.x1 - s.x0) * plotW - 2)}
              height={base - levelTop + 4}
              rx={4}
            />
          ))}

        {level ? (
          <>
            <text className={styles.panelTitle} x={0} y={TITLE_H - 5}>
              {levelTitle}
            </text>
            {rungs.map((r) => (
              <g key={r.value}>
                <line
                  className={styles.grid}
                  x1={gutter}
                  x2={width - PAD_R}
                  y1={rungY(r)}
                  y2={rungY(r)}
                />
                <text className={styles.tick} x={gutter - 6} y={rungY(r) + 4} textAnchor="end">
                  {rungText(r)}
                </text>
              </g>
            ))}
          </>
        ) : null}

        <text className={styles.panelTitle} x={0} y={repsTitleY + TITLE_H - 5}>
          {valueTitle}
        </text>

        {model.range ? (
          <>
            <rect
              className={styles.band}
              x={gutter}
              width={plotW}
              y={yv(model.range.max)}
              height={Math.max(0, yv(model.range.min) - yv(model.range.max))}
            />
            <text
              className={styles.tick}
              x={gutter - 6}
              y={yv(model.range.max) + 4}
              textAnchor="end"
            >
              {numberText(model.range.max, lang)}
            </text>
            <text
              className={styles.tick}
              x={gutter - 6}
              y={yv(model.range.min) + 4}
              textAnchor="end"
            >
              {numberText(model.range.min, lang)}
            </text>
          </>
        ) : null}
        <text className={styles.tick} x={gutter - 6} y={base + 4} textAnchor="end">
          0
        </text>
        <line className={styles.baseline} x1={gutter} x2={width - PAD_R} y1={base} y2={base} />

        {model.steps.map((s) => (
          <line
            key={`${s.from}-${s.to}`}
            className={styles.stepMark}
            x1={px(s.x)}
            x2={px(s.x)}
            y1={level ? levelTop : repsTop}
            y2={base}
          />
        ))}

        {stepPath ? <path className={styles.line} d={stepPath} /> : null}
        {model.items.map((item, i) => {
          const y = yOfLevel(item.level);
          return y === undefined ? null : (
            <circle
              key={item.key}
              className={styles.dot}
              cx={xs[i]}
              cy={y}
              r={i === active && inspecting ? 6 : 4}
            />
          );
        })}

        {model.items.map((_, i) => column(i))}
        {model.items.map((item, i) =>
          item.noEquipment ? (
            <line
              key={`n-${item.key}`}
              className={styles.dash}
              x1={xs[i]! - DASH_W / 2}
              x2={xs[i]! + DASH_W / 2}
              y1={base - 2}
              y2={base - 2}
            />
          ) : null,
        )}

        {inspecting ? (
          <line
            className={styles.cross}
            x1={xs[active]}
            x2={xs[active]}
            y1={level ? levelTop : repsTop}
            y2={base}
          />
        ) : null}

        {active >= 0 && model.items[active]?.value !== undefined ? (
          <text
            className={styles.cap}
            x={xs[active]}
            y={Math.max(repsTop + 12, yv(model.items[active]!.value!) - 6)}
            textAnchor="middle"
          >
            {capText(active)}
          </text>
        ) : null}

        {model.axis.map((a, i) => (
          <text
            key={`${a.kind}-${a.week ?? a.date ?? i}`}
            className={cx(styles.axis, a.current && styles.axisNow, a.later && styles.axisLater)}
            x={px(a.x)}
            y={base + 18}
            textAnchor="middle"
          >
            {a.kind === 'week' ? t('stats.ladder.weekShort', { week: a.week }) : monthText(a.date!)}
          </text>
        ))}
      </svg>
    </div>
  );
}
