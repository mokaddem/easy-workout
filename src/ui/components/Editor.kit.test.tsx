// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ActionSheet,
  BarButton,
  DurationMeter,
  EmptyCard,
  IssueLine,
  LiveEstimate,
  NameField,
  RangeStepper,
  Stepper,
  Tag,
} from './index';

// jsdom has no showModal/close; emulate the open attribute.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BarButton', () => {
  it('clicks, and a settled one is inert', () => {
    const onClick = vi.fn();
    const { rerender } = render(<BarButton icon="pencil" label="Edit" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<BarButton icon="check" label="Saved" settled onClick={onClick} />);
    const settled = screen.getByRole('button', { name: 'Saved' });
    expect(settled).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(settled);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ActionSheet', () => {
  it('lists items, calls the handler, honours disabled and closes from the footer', () => {
    const a = vi.fn();
    const b = vi.fn();
    const onClose = vi.fn();
    render(
      <ActionSheet
        open
        onClose={onClose}
        eyebrow="Main, 2 of 5"
        title="Floor press"
        closeLabel="Close"
        groups={[
          [{ id: 'a', label: 'Edit sets', hint: '4 × 8', icon: 'sliders', onSelect: a }],
          [],
          [
            { id: 'up', label: 'Move up', icon: 'arrow-up', onSelect: b, disabled: true },
            { id: 'rm', label: 'Remove', icon: 'trash', onSelect: b, danger: true },
          ],
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit sets/ }));
    expect(a).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
    expect(screen.getAllByRole('group')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(b).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Tag', () => {
  it('renders its label', () => {
    render(<Tag label="Edited" icon="pencil" />);
    expect(screen.getByText('Edited')).toBeInTheDocument();
  });
});

describe('IssueLine', () => {
  it('shows the text under its id and dismisses', () => {
    const onDismiss = vi.fn();
    render(
      <IssueLine level="warn" id="w1" onDismiss={onDismiss} dismissLabel="Dismiss">
        Heavy set, short rest
      </IssueLine>,
    );
    expect(document.getElementById('w1')).toHaveTextContent('Heavy set, short rest');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('has no dismiss button unless asked', () => {
    render(<IssueLine level="block">Not doable</IssueLine>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('NameField', () => {
  it('labels the input, reports changes, caps length and shows the error', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <NameField label="Name" value="" onChange={onChange} placeholder="Name it" />,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('maxlength', '40');
    fireEvent.change(input, { target: { value: 'Legs' } });
    expect(onChange).toHaveBeenCalledWith('Legs');
    rerender(<NameField label="Name" value="" onChange={onChange} error="Give it a name" />);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Give it a name');
  });
});

describe('RangeStepper', () => {
  const labels = (w: string) => ({
    label: `${w} reps`,
    decrementLabel: `${w} less`,
    incrementLabel: `${w} more`,
  });
  function Harness() {
    const [r, setR] = useState({ low: 6, high: 7 });
    return (
      <RangeStepper
        low={r.low}
        high={r.high}
        min={1}
        max={30}
        fromWord="from"
        toWord="to"
        lowLabels={labels('Min')}
        highLabels={labels('Max')}
        onChange={(low, high) => setR({ low, high })}
      />
    );
  }

  it('never lets the halves cross', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Min more' }));
    expect(screen.getByRole('button', { name: 'Min more' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Max less' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Max more' }));
    expect(screen.getByRole('button', { name: 'Max less' })).toBeEnabled();
    expect(screen.getByText('from')).toBeInTheDocument();
  });
});

describe('Stepper words', () => {
  const base = { label: 'Effort', decrementLabel: 'Less', incrementLabel: 'More' };
  it('shows a word for the value and for zero, without the unit', () => {
    const { rerender } = render(
      <Stepper
        {...base}
        wide
        min={0}
        max={4}
        step={1}
        value={2}
        word="2 in the tank"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('2 in the tank')).toBeInTheDocument();
    rerender(
      <Stepper
        {...base}
        unit="s"
        zeroWord="None"
        min={0}
        max={90}
        step={15}
        value={0}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByText('s')).toBeNull();
    rerender(
      <Stepper
        {...base}
        unit="s"
        zeroWord="None"
        min={0}
        max={90}
        step={15}
        value={15}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('s')).toBeInTheDocument();
  });
});

describe('EmptyCard', () => {
  it('fires its action', () => {
    const onAction = vi.fn();
    render(
      <EmptyCard
        icon="bookmark"
        title="None yet"
        description="Save one"
        actionLabel="Build"
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('LiveEstimate', () => {
  it('shows the numeral and the delta tag when given', () => {
    const { rerender } = render(<LiveEstimate label="Session" minutes={52} unit="min" />);
    expect(screen.getByText('~52')).toBeInTheDocument();
    expect(screen.queryByText('+2 min')).toBeNull();
    rerender(<LiveEstimate label="Session" minutes={54} unit="min" delta="+2 min" />);
    expect(screen.getByText('+2 min')).toBeInTheDocument();
  });
});

describe('DurationMeter', () => {
  it('announces only after the value has been quiet', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <DurationMeter minutes={52} unit="min" budget={45} line="7 more" announcement="52 minutes" />,
    );
    const status = screen.getByRole('status');
    act(() => void vi.advanceTimersByTime(700));
    expect(status).toHaveTextContent('52 minutes');
    rerender(
      <DurationMeter minutes={54} unit="min" budget={45} line="9 more" announcement="54 minutes" />,
    );
    act(() => void vi.advanceTimersByTime(300));
    expect(status).toHaveTextContent('52 minutes');
    rerender(
      <DurationMeter
        minutes={55}
        unit="min"
        budget={45}
        line="10 more"
        announcement="55 minutes"
      />,
    );
    act(() => void vi.advanceTimersByTime(300));
    expect(status).toHaveTextContent('52 minutes');
    act(() => void vi.advanceTimersByTime(400));
    expect(status).toHaveTextContent('55 minutes');
  });

  it('draws no bar without a budget', () => {
    const { container } = render(
      <DurationMeter minutes={30} unit="min" line="Estimate" announcement="30" />,
    );
    expect(container.querySelector('[class*="track"]')).toBeNull();
  });
});
