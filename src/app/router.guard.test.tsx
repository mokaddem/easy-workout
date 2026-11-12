// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { goBack, navigate, useLeaveGuard, type LeaveHandler } from './router';

function Guarded({ active, onLeave }: { active: boolean; onLeave: LeaveHandler }) {
  useLeaveGuard(active, onLeave);
  return null;
}

const path = () => location.pathname;

describe('leave guard', () => {
  it('asks before navigating and leaves only when told to', () => {
    navigate('/settings/profile');
    let proceed: (() => void) | undefined;
    const onLeave = vi.fn<LeaveHandler>((go) => (proceed = go));
    const { unmount } = render(<Guarded active onLeave={onLeave} />);

    act(() => navigate('/programme'));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(path()).toBe('/settings/profile');

    act(() => proceed?.());
    expect(path()).toBe('/programme');
    unmount();
  });

  it('asks before going back', () => {
    navigate('/settings');
    navigate('/settings/equipment');
    const onLeave = vi.fn<LeaveHandler>();
    const { unmount } = render(<Guarded active onLeave={onLeave} />);
    act(() => goBack());
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(path()).toBe('/settings/equipment');
    unmount();
  });

  it('does nothing while inactive or after unmount', () => {
    navigate('/settings');
    const onLeave = vi.fn<LeaveHandler>();
    const { rerender, unmount } = render(<Guarded active={false} onLeave={onLeave} />);
    act(() => navigate('/quick'));
    expect(path()).toBe('/quick');

    rerender(<Guarded active onLeave={onLeave} />);
    unmount();
    act(() => navigate('/progress'));
    expect(path()).toBe('/progress');
    expect(onLeave).not.toHaveBeenCalled();
  });
});
