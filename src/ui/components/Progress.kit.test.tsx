// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  CompareFigure,
  CycleStrip,
  Icon,
  TestResultCard,
  TestResultRow,
  type CycleCellState,
} from './index';
import { ChangeTag } from '@/features/adapt/ChangeTag';

afterEach(cleanup);

describe('icons', () => {
  it.each(['target', 'scale', 'medal'] as const)('%s draws', (name) => {
    const { container } = render(<Icon name={name} />);
    expect(container.querySelectorAll('path, circle, rect').length).toBeGreaterThan(0);
  });
});

describe('CycleStrip', () => {
  const weeks = [
    { label: '1', cells: ['done', 'early'] as CycleCellState[] },
    { label: '2', cells: ['done', 'remaining'] as CycleCellState[], current: true },
    { label: '3', cells: ['later', 'later'] as CycleCellState[] },
  ];

  it('draws one cell per session and one column per week, hidden from assistive tech', () => {
    const { container } = render(<CycleStrip weeks={weeks} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelectorAll('i')).toHaveLength(6);
    expect(root.children).toHaveLength(3);
    expect(root.textContent).toBe('123');
  });

  it('gives each state its own style, bottom-up', () => {
    const { container } = render(<CycleStrip weeks={weeks} />);
    const cells = [...container.querySelectorAll('i')].map((c) => c.className);
    expect(new Set(cells).size).toBe(4);
    expect(cells[0]).toBe(cells[2]);
  });

  it('ghost ignores the states', () => {
    const { container } = render(<CycleStrip weeks={weeks} ghost />);
    expect([...container.querySelectorAll('i')].every((c) => c.className === '')).toBe(true);
  });
});

describe('CompareFigure', () => {
  it('speaks one sentence and hides the figures', () => {
    const { container } = render(
      <CompareFigure from="18" to="24" unit="reps" srText="24 reps, 6 more than on 8 September" />,
    );
    expect(screen.getByText('24 reps, 6 more than on 8 September')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toContain('18');
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toContain('24reps');
  });

  it('shows only the new value for a first result, with a tag', () => {
    const { container } = render(
      <CompareFigure
        to="12"
        srText="12"
        tag={<ChangeTag size="large" tag={{ icon: 'arrow-up', text: '+3' }} />}
      />,
    );
    expect(container.querySelectorAll('svg').length).toBe(1);
    expect(container.textContent).toContain('+3');
  });
});

describe('ChangeTag', () => {
  it('large is opt-in', () => {
    const { container, rerender } = render(<ChangeTag tag={{ icon: 'arrow-up', text: '+1' }} />);
    const before = container.firstElementChild?.className;
    rerender(<ChangeTag size="large" tag={{ icon: 'arrow-up', text: '+1' }} />);
    expect(container.firstElementChild?.className).not.toBe(before);
  });
});

describe('TestResultCard / TestResultRow', () => {
  it('the card names the test and carries the figure', () => {
    render(
      <TestResultCard
        kicker="Max test"
        name="Push-up"
        figure={{ from: '18', to: '24', unit: 'reps', srText: '24 reps, 6 more' }}
        line="Same conditions."
      />,
    );
    expect(screen.getByRole('heading', { name: 'Push-up' })).toBeTruthy();
    expect(screen.getByText('Max test')).toBeTruthy();
    expect(screen.getByText('24 reps, 6 more')).toBeTruthy();
    expect(screen.getByText('Same conditions.')).toBeTruthy();
  });

  it('the row has a name and a spoken sentence', () => {
    render(
      <TestResultRow
        name="Plank"
        figure={{ from: '60', to: '75', unit: 's', srText: '75 seconds, 15 more' }}
      />,
    );
    expect(screen.getByText('Plank')).toBeTruthy();
    expect(screen.getByText('75 seconds, 15 more')).toBeTruthy();
  });
});
