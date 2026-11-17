// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogue } from '@/catalogue';
import type { Answer, Profile } from '@/domain';
import { resources } from '@/i18n/resources';
import { referenceEquipment } from '../../../../tests/fixtures/reference-equipment';
import { pickable } from './list';

const switchBack = vi.fn();
let answers: Answer[] = [];
vi.mock('@/app/data', () => ({
  useEquipment: () => referenceEquipment,
  useProfile: (): Profile => ({
    goal: 'muscle',
    level: 'intermediate',
    daysPerWeek: 4,
    sessionMinutes: 45,
  }),
  useAnswers: () => answers,
}));
vi.mock('@/app/progress', () => ({
  switchBack: (...args: unknown[]) => switchBack(...args),
}));

import { ExercisePicker, type ExercisePickerProps } from './ExercisePicker';

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
beforeEach(() => {
  answers = [];
  switchBack.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

const entries = pickable(
  catalogue,
  { inventory: referenceEquipment, level: 'intermediate' },
  'main',
).filter((e) => !e.concern && !e.exercise.tags.includes('warmup'));
const [a, b, c] = entries.map((e) => e.exercise);

const row = (id: string) => document.querySelector<HTMLElement>(`[data-exercise="${id}"]`)!;

function mount(props: Partial<ExercisePickerProps> = {}) {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(
    <I18nextProvider i18n={instance}>
      <ExercisePicker open mode="add" section="main" onPick={onPick} onClose={onClose} {...props} />
    </I18nextProvider>,
  );
  return { onPick, onClose };
}

describe('ExercisePicker', () => {
  it('renders nothing while closed', () => {
    mount({ open: false });
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('picks an exercise', () => {
    const { onPick } = mount();
    fireEvent.click(row(a!.id));
    expect(onPick).toHaveBeenCalledWith(a!.id);
  });

  it('searches by name and says when nothing matches', () => {
    mount();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(screen.getByText('No exercise found')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear search' }).at(-1)!);
    expect(row(a!.id)).toBeTruthy();
  });

  it('marks the exercise being replaced and exercises already in the session', () => {
    const { onPick } = mount({
      mode: 'replace',
      replacing: a!.id,
      inSession: new Set([b!.id]),
    });
    expect(screen.getByText('Suggested')).toBeTruthy();
    expect(row(a!.id).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(row(a!.id));
    expect(onPick).not.toHaveBeenCalled();
    expect(row(b!.id).textContent).toContain('Already in this session');
    fireEvent.click(row(b!.id));
    expect(onPick).toHaveBeenCalledWith(b!.id);
  });

  it('asks before bringing back a swapped-out exercise, then ends the swap and picks it', async () => {
    answers = [
      {
        id: 'x',
        exerciseId: a!.id,
        kind: 'harder',
        answer: 'swap',
        substituteId: c!.id,
        at: '2026-01-01T00:00:00.000Z',
      },
    ];
    const { onPick } = mount();
    expect(row(a!.id).textContent).toContain(`${c!.name.en} replaces it in your sessions.`);
    fireEvent.click(row(a!.id));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByText('Bring this exercise back?')).toBeTruthy();
    expect(screen.queryByText(/after pain/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bring it back' }));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(a!.id));
    expect(switchBack).toHaveBeenCalledWith(a!.id);
  });

  it('says so when the swap was for pain, and cancel changes nothing', () => {
    answers = [
      {
        id: 'x',
        exerciseId: a!.id,
        kind: 'pain',
        answer: 'swap',
        substituteId: c!.id,
        at: '2026-01-01T00:00:00.000Z',
      },
    ];
    const { onPick } = mount();
    fireEvent.click(row(a!.id));
    expect(screen.getByText(/after pain/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(switchBack).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('closes from the back button and from the system back gesture, not on other keys', () => {
    const { onClose } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the editor' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('lets Enter in the search field hide the keyboard', () => {
    mount();
    const input = screen.getByRole('searchbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.activeElement).not.toBe(input);
  });
});
