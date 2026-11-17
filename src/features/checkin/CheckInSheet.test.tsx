// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckIn } from '@/domain';
import { resources } from '@/i18n/resources';

const saveCheckIn = vi.fn();
const deleteCheckIn = vi.fn();
let stored: CheckIn[] = [];
vi.mock('@/db/repo', () => ({
  repo: {
    saveCheckIn: (...args: unknown[]) => saveCheckIn(...args),
    deleteCheckIn: (...args: unknown[]) => deleteCheckIn(...args),
  },
}));
vi.mock('@/app/data', () => ({ useCheckIns: () => stored }));

import { CheckInSheet } from './CheckInSheet';

const instance = i18next.createInstance();

beforeAll(async () => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
  await instance.use(initReactI18next).init({
    lng: 'en',
    resources: { en: { translation: resources.en } },
    interpolation: { escapeValue: false },
  });
});

const past: CheckIn = {
  id: 'c1',
  date: '2026-11-08',
  weightKg: 79.7,
  waistCm: 86.5,
  sleepHours: 6.5,
  notes: 'Family dinner.',
};

beforeEach(() => {
  stored = [];
  saveCheckIn.mockImplementation((input) => Promise.resolve({ id: 'new', ...input }));
  deleteCheckIn.mockImplementation(() => Promise.resolve(past));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mount(props: Partial<React.ComponentProps<typeof CheckInSheet>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onDeleted = vi.fn();
  render(
    <I18nextProvider i18n={instance}>
      <CheckInSheet open onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} {...props} />
    </I18nextProvider>,
  );
  return { onClose, onSaved, onDeleted };
}

const save = () => screen.getByRole('button', { name: 'Save' });

describe('CheckInSheet', () => {
  it('keeps Save off while everything is empty, then saves what was typed', async () => {
    const { onSaved, onClose } = mount({ date: '2026-11-14' });
    expect(screen.getByRole('heading', { name: 'New check-in' })).toBeTruthy();
    expect(save()).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '79,4' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: ' tired ' } });
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveCheckIn).toHaveBeenCalledWith({
      date: '2026-11-14',
      weightKg: 79.4,
      notes: 'tired',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('flags an out-of-range weight on blur and refuses to save it', () => {
    mount({ date: '2026-11-14' });
    const weight = screen.getByLabelText('Weight');
    fireEvent.change(weight, { target: { value: '12' } });
    expect(save()).toHaveProperty('disabled', true);
    fireEvent.blur(weight);
    expect(screen.getByRole('alert').textContent).toContain('between 30 and 250 kg');
  });

  it('starts the sleep stepper from the last value', async () => {
    stored = [{ ...past, sleepHours: 6 }];
    const { onSaved } = mount({ date: '2026-11-14' });
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveCheckIn).toHaveBeenCalledWith({ date: '2026-11-14', sleepHours: 6 });
  });

  it('opens the check-in of the picked date for editing (one per date)', () => {
    stored = [past];
    mount({ date: '2026-11-14' });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-08' } });
    expect(screen.getByRole('heading', { name: /Check-in of 8 November/ })).toBeTruthy();
    expect((screen.getByLabelText('Weight') as HTMLInputElement).value).toBe('79.7');
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Family dinner.');
    expect(save()).toHaveProperty('disabled', true);
  });

  it('edits an existing check-in: Save wakes on a change and keeps the date', async () => {
    stored = [past];
    const { onSaved } = mount({ checkIn: past });
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '79.2' } });
    expect(save()).toHaveProperty('disabled', false);
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveCheckIn).toHaveBeenCalledWith({
      date: '2026-11-08',
      weightKg: 79.2,
      waistCm: 86.5,
      sleepHours: 6.5,
      notes: 'Family dinner.',
    });
  });

  it('deletes through the repo and hands the record back for Undo', async () => {
    stored = [past];
    const { onDeleted, onClose } = mount({ checkIn: past });
    fireEvent.click(screen.getByRole('button', { name: 'Delete this check-in' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(past));
    expect(deleteCheckIn).toHaveBeenCalledWith('c1');
    expect(onClose).toHaveBeenCalled();
  });

  it('has no delete for a new check-in', () => {
    mount({ date: '2026-11-14' });
    expect(screen.queryByRole('button', { name: 'Delete this check-in' })).toBeNull();
  });
});
