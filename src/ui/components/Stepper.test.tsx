// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Stepper } from './Stepper';

const labels = { label: 'Load', decrementLabel: 'Less', incrementLabel: 'More' };

afterEach(cleanup);

describe('Stepper', () => {
  it('jumps through the allowed values', () => {
    const onChange = vi.fn();
    render(<Stepper {...labels} values={[2, 4, 7.5, 10]} value={4} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onChange).toHaveBeenLastCalledWith(7.5);
    fireEvent.click(screen.getByRole('button', { name: 'Less' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('disables the button at each limit', () => {
    const { rerender } = render(
      <Stepper {...labels} min={0} max={3} step={1} value={3} onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'More' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Less' })).toBeEnabled();
    rerender(<Stepper {...labels} min={0} max={3} step={1} value={0} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Less' })).toBeDisabled();
  });

  it('avoids float drift with fractional steps', () => {
    const onChange = vi.fn();
    render(<Stepper {...labels} min={0} max={5} step={0.1} value={0.2} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onChange).toHaveBeenCalledWith(0.3);
  });

  it('shows a dash when empty and starts at the first value', () => {
    const onChange = vi.fn();
    render(<Stepper {...labels} values={[5, 10]} value={null} onChange={onChange} />);
    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Less' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('is a labelled group and announces the value politely', () => {
    function Harness() {
      const [v, setV] = useState<number | null>(1);
      return <Stepper {...labels} unit="kg" min={0} max={9} step={1} value={v} onChange={setV} />;
    }
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Load' })).toBeInTheDocument();
    const live = screen.getByText('1').closest('[aria-live]');
    expect(live).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
