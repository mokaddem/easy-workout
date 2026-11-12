// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ToastProvider } from './Toast';
import { useToast } from './useToast';

function Trigger({
  withAction = false,
  onAction = () => {},
}: {
  withAction?: boolean;
  onAction?: () => void;
}) {
  const toast = useToast();
  return (
    <button
      onClick={() =>
        toast.show({
          message: 'Saved',
          action: withAction ? { label: 'Undo', onAction } : undefined,
        })
      }
    >
      go
    </button>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Toast', () => {
  it('shows in a status region and leaves after 3 s', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    act(() => void vi.advanceTimersByTime(2900));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('stays 5 s with an action, and the action dismisses it', () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Trigger withAction onAction={onAction} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    act(() => void vi.advanceTimersByTime(4900));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
