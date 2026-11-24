import { useMemo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon, GlyphCap } from './GlyphCap';
import styles from './GlyphCap.module.css';

/** The named components the install strings use (`<share/>`, `<kebab/>`, `<b>`…). */
export function useGlyphs(small = false): Record<string, ReactElement> {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      b: <b />,
      share: <GlyphCap icon="share" small={small} />,
      add: <GlyphCap icon="add-square" small={small} />,
      install: <GlyphCap icon="install" small={small} />,
      more: <GlyphCap icon="more" label={t('install.glyph.more')} small={small} />,
      menu: <GlyphCap icon="menu" label={t('install.glyph.menu')} small={small} />,
      kebab: <GlyphCap icon="more-vertical" label={t('install.glyph.kebab')} small={small} />,
      installDesktop: (
        <GlyphCap icon="install-desktop" label={t('install.glyph.installDesktop')} small={small} />
      ),
      app: (
        <span className={styles.appCap} aria-hidden="true">
          <AppIcon size={26} />
        </span>
      ),
    }),
    [t, small],
  );
}
