// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Answer } from '@/domain';
import type { Proposal } from '@/engine';
import { resources } from '@/i18n/resources';

const answerProposal = vi.fn();
const undoAnswer = vi.fn();
vi.mock('@/app/progress', () => ({
  answerProposal: (...args: unknown[]) => answerProposal(...args),
  undoAnswer: (...args: unknown[]) => undoAnswer(...args),
}));

import { ProposalCard } from './ProposalCard';
import { GoalRuler } from './GoalRuler';
import { ChangeTag } from './ChangeTag';

const instance = i18next.createInstance();

beforeAll(async () => {
  await instance.use(initReactI18next).init({
    lng: 'en',
    resources: { en: { translation: resources.en } },
    interpolation: { escapeValue: false },
  });
});

const saved: Answer = {
  id: 'a1',
  exerciseId: 'push-up',
  kind: 'pain',
  answer: 'lighter',
  at: '2026-11-16T10:00:00.000Z',
};

afterEach(cleanup);

beforeEach(() => {
  answerProposal.mockReset().mockResolvedValue(saved);
  undoAnswer.mockReset().mockResolvedValue(undefined);
});

const pain: Proposal = {
  kind: 'pain',
  exerciseId: 'push-up',
  logId: 'log-1',
  substituteId: 'incline-push-up',
  lighter: { code: 'pain-lighter', params: { from: 'kg:10', to: 'kg:8' } },
};

const renderCard = (proposal: Proposal) =>
  render(
    <I18nextProvider i18n={instance}>
      <ProposalCard proposal={proposal} facts={{ done: 1, total: 3 }} />
    </I18nextProvider>,
  );

describe('ProposalCard', () => {
  it('offers swap, lighter and keep on a first pain, then confirms with Undo', async () => {
    renderCard(pain);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /Keep it, lighter/ }));
    await waitFor(() => expect(screen.getByText('Kept, lighter')).toBeInTheDocument());
    expect(answerProposal).toHaveBeenCalledWith(pain, 'lighter');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(undoAnswer).toHaveBeenCalledWith(saved));
    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(3));
  });

  it('drops "keep" and adds the care note on a repeated pain', () => {
    renderCard({ ...pain, repeated: true });
    expect(screen.queryByRole('button', { name: /Keep it as it is/ })).toBeNull();
    expect(screen.getByText(/see a health professional/)).toBeInTheDocument();
  });

  it('offers a one-off and a swap for missing equipment', () => {
    renderCard({ kind: 'no-equipment', exerciseId: 'push-up', logId: 'l', substituteId: 'x' });
    expect(screen.getByRole('button', { name: /It was a one-off/ })).toBeInTheDocument();
    expect(screen.getByText(/counts as a one-off/)).toBeInTheDocument();
  });

  it('has no swap row without a substitute, and "not now" for ladder proposals', () => {
    renderCard({ kind: 'harder', exerciseId: 'push-up', logId: 'l' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Not now/ })).toBeInTheDocument();
  });
});

describe('GoalRuler and ChangeTag', () => {
  it('draws one bar per value plus dashed ones outside the range', () => {
    const { container } = render(
      <I18nextProvider i18n={instance}>
        <GoalRuler goal={6} min={8} max={10} />
      </I18nextProvider>,
    );
    expect(container.querySelectorAll('i')).toHaveLength(5);
    expect(screen.getByText('goal 6 reps, range 8 to 10')).toBeInTheDocument();
  });

  it('renders the tag text with a spoken direction', () => {
    render(<ChangeTag tag={{ icon: 'arrow-up', text: '2 kg', srPrefix: 'Up:' }} />);
    expect(screen.getByText(/2.kg/)).toBeInTheDocument();
  });
});
