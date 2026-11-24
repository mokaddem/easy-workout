// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { resources } from '@/i18n/resources';
import { InstallSteps } from './InstallSteps';

const instance = i18next.createInstance();

beforeAll(async () => {
  await instance.use(initReactI18next).init({
    lng: 'en',
    resources: { en: { translation: resources.en } },
    interpolation: { escapeValue: false },
  });
});
afterEach(cleanup);

describe('InstallSteps', () => {
  it('renders self-closing glyph tags inside a sentence, with the bold label', () => {
    const { container } = render(
      <I18nextProvider i18n={instance}>
        <InstallSteps
          steps={[
            { id: 'share', meta: 'shareSafariMeta' },
            { id: 'addressBar', meta: 'addressBarMeta' },
          ]}
        />
      </I18nextProvider>,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).not.toMatch(/[<>]/);
    expect(items[0]?.querySelector('b')?.textContent).toBe('Share');
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(4);
    // A glyph that stands alone is named; one followed by its word is hidden.
    expect(screen.getAllByRole('img', { name: 'three dots' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('img', { name: 'install icon' })).toHaveLength(1);
    expect(items[0]?.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });
});
