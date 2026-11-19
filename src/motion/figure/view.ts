/**
 * Draws a figure into an SVG group: one gap outline and one fill path per part group, painted
 * far to near. DOM only; no React. Elements are reused between frames.
 */
import type { ExerciseAnimation } from '@/domain';
import { groupOrder, toneOf, TONE_CSS, type Framing } from './look';
import { groupPaths } from './svg';
import type { Part } from './parts';

const NS = 'http://www.w3.org/2000/svg';

export interface FigureView {
  draw: (parts: Part[]) => void;
  destroy: () => void;
}

export function createFigureView(
  host: SVGGElement,
  fr: Framing,
  anim: ExerciseAnimation,
): FigureView {
  const groups = new Map<string, { gap: SVGPathElement; fill: SVGPathElement }>();
  let lastOrder = '';
  let drawn: string[] = [];

  const make = (group: string) => {
    const gap = document.createElementNS(NS, 'path');
    gap.setAttribute('fill', 'none');
    gap.setAttribute('stroke-width', String(Math.round(fr.gap * 2 * 10) / 10));
    gap.setAttribute('stroke-linejoin', 'round');
    gap.style.stroke = TONE_CSS.cut;
    const fill = document.createElementNS(NS, 'path');
    fill.style.fill = TONE_CSS[toneOf(group, anim, false, fr.cam)];
    const el = { gap, fill };
    groups.set(group, el);
    return el;
  };

  return {
    draw(parts) {
      const paths = groupPaths(parts, fr);
      const order = groupOrder(parts, fr.cam, drawn);
      for (const g of order) {
        const el = groups.get(g) ?? make(g);
        const p = paths.get(g);
        el.fill.setAttribute('d', p?.fill ?? '');
        el.gap.setAttribute('d', p?.gap || 'M0 0');
      }
      const key = order.join();
      if (key !== lastOrder) {
        for (const [g, el] of groups)
          if (!paths.has(g)) {
            el.gap.remove();
            el.fill.remove();
          }
        for (const g of order) {
          const el = groups.get(g)!;
          host.append(el.gap, el.fill);
        }
        lastOrder = key;
      }
      drawn = order;
    },
    destroy() {
      host.replaceChildren();
      groups.clear();
      drawn = [];
      lastOrder = '';
    },
  };
}
