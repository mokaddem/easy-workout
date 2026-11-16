// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Sheet } from './Sheet';
import { Dialog } from './Dialog';

// jsdom has no showModal/close; emulate the open attribute.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});
afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Edit set" description="Adjust it">
        <button>Inside</button>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('renders an optional footer after the content', () => {
    render(
      <Sheet open onClose={() => {}} title="Import" footer={<button>Replace</button>}>
        <p>Body</p>
      </Sheet>,
    );
    const body = screen.getByText('Body');
    const action = screen.getByRole('button', { name: 'Replace' });
    expect(body.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(action.parentElement).not.toBe(body.parentElement);
  });

  it('opens as a modal dialog with title and description', () => {
    render(<Harness />);
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Open'));
    const dialog = screen.getByRole('dialog', { name: 'Edit set' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription('Adjust it');
  });

  it('closes on scrim click and returns focus to the opener', () => {
    render(<Harness />);
    const opener = screen.getByText('Open');
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(document.querySelector('[data-part="scrim"]') as HTMLElement);
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
    expect(opener).toHaveFocus();
  });

  it('closes on Escape (cancel event)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Open'));
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(dialog).not.toHaveAttribute('open');
  });
});

describe('Dialog', () => {
  it('confirms and cancels with two buttons', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <Dialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Stop?"
        confirmLabel="Stop"
        cancelLabel="Keep going"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
