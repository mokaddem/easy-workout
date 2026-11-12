// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'easy', label: 'Easy' },
  { value: 'right', label: 'Right' },
  { value: 'hard', label: 'Hard' },
] as const;

function Harness({ initial = 'right' }: { initial?: 'easy' | 'right' | 'hard' }) {
  const [value, setValue] = useState<'easy' | 'right' | 'hard' | null>(initial);
  return <SegmentedControl label="Feel" options={options} value={value} onChange={setValue} />;
}

afterEach(cleanup);

describe('SegmentedControl', () => {
  it('uses radio-group semantics', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Feel' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Right' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Easy' })).not.toBeChecked();
  });

  it('moves selection and focus with arrow keys, wrapping around', () => {
    render(<Harness />);
    const right = screen.getByRole('radio', { name: 'Right' });
    right.focus();
    fireEvent.keyDown(right, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Hard' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Hard' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Hard' }), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Easy' })).toBeChecked();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Easy' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'Hard' })).toBeChecked();
  });

  it('only the selected option is in the tab order', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Right' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Easy' })).toHaveAttribute('tabindex', '-1');
  });
});
