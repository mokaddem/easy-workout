// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Chip, ChipGroup } from './Chip';

afterEach(cleanup);

describe('Chip', () => {
  it('reflects selection in aria-pressed and toggles', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ChipGroup label="Bands">
        <Chip selected={false} onToggle={onToggle}>
          Light
        </Chip>
      </ChipGroup>,
    );
    const chip = screen.getByRole('button', { name: 'Light' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(onToggle).toHaveBeenCalledWith(true);
    rerender(
      <ChipGroup label="Bands">
        <Chip selected onToggle={onToggle}>
          Light
        </Chip>
      </ChipGroup>,
    );
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Bands' })).toBeInTheDocument();
  });
});
