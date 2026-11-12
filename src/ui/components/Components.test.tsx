// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  Checkbox,
  IncludedList,
  SelectableCard,
  ListRow,
  ProgressBar,
  TabBar,
  IconButton,
  EmptyState,
} from './index';

afterEach(cleanup);

describe('Checkbox and IncludedList', () => {
  it('toggles through the native input', () => {
    const onChange = vi.fn();
    render(
      <Checkbox checked={false} onChange={onChange}>
        Mat
      </Checkbox>,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mat' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders included items without any control', () => {
    render(<IncludedList items={['Chair', 'Wall']} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('SelectableCard', () => {
  it('toggles from the header and shows its body only when on', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <SelectableCard selected={false} onToggle={onToggle} title="Dumbbells">
        <span>Settings</span>
      </SelectableCard>,
    );
    expect(screen.getByText('Settings')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Dumbbells/ }));
    expect(onToggle).toHaveBeenCalledWith(true);
    rerender(
      <SelectableCard selected onToggle={onToggle} title="Dumbbells">
        <span>Settings</span>
      </SelectableCard>,
    );
    expect(screen.getByText('Settings')).toBeVisible();
    expect(screen.getByRole('button', { name: /Dumbbells/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

describe('ListRow', () => {
  it('renders a button, a link or plain content depending on props', () => {
    const onClick = vi.fn();
    const { rerender } = render(<ListRow title="Row" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Row' }));
    expect(onClick).toHaveBeenCalled();
    rerender(<ListRow title="Row" href="/x" />);
    expect(screen.getByRole('link', { name: 'Row' })).toHaveAttribute('href', '/x');
    rerender(<ListRow title="Row" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('ProgressBar', () => {
  it('shows its text label and exposes progress values', () => {
    render(<ProgressBar variant="segmented" total={5} current={4} label="Step 4 of 5" />);
    expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '4');
    expect(bar.querySelectorAll('[data-state="done"]')).toHaveLength(3);
    expect(bar.querySelectorAll('[data-state="later"]')).toHaveLength(1);
  });
});

describe('TabBar', () => {
  const items = [
    { id: 'a', label: 'Programme', icon: 'calendar', href: '/a', current: true },
    { id: 'b', label: 'Progress', icon: 'chart', href: '/b' },
  ] as const;

  it('marks the current tab and hands plain clicks to onNavigate', () => {
    const onNavigate = vi.fn();
    render(<TabBar label="Main" items={items} onNavigate={onNavigate} />);
    expect(screen.getByRole('link', { name: 'Programme' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Progress' })).not.toHaveAttribute('aria-current');
    fireEvent.click(screen.getByRole('link', { name: 'Progress' }));
    expect(onNavigate).toHaveBeenCalledWith('/b');
    fireEvent.click(screen.getByRole('link', { name: 'Progress' }), { ctrlKey: true });
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe('IconButton and EmptyState', () => {
  it('names the icon button', () => {
    render(<IconButton icon="close" label="Close" />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('renders its primary action', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        icon="calendar"
        title="Nothing"
        description="Start one"
        actionLabel="Start"
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onAction).toHaveBeenCalled();
  });
});
