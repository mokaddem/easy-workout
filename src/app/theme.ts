import type { Settings } from '@/domain';

type ThemeSetting = Settings['theme'];

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Applies the theme to the document and keeps the browser chrome colour in step with the background. */
export function applyTheme(theme: ThemeSetting): () => void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;

  const syncChrome = () => {
    const background = getComputedStyle(root).getPropertyValue('--color-bg').trim();
    if (!background) return;
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
      meta.content = background;
  };
  syncChrome();

  if (theme !== 'system') return () => {};
  const query = darkQuery();
  query.addEventListener('change', syncChrome);
  return () => query.removeEventListener('change', syncChrome);
}
