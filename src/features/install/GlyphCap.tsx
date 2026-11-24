import { Icon, type IconName } from '@/ui/components';
import styles from './GlyphCap.module.css';

/** The real home-screen icon, from the app's icon file. */
export function AppIcon({ size, className }: { size: number; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icon.svg`}
      alt=""
      width={size}
      height={size}
      className={`${styles.appIcon} ${className ?? ''}`}
      style={{ width: size, height: size }}
    />
  );
}

export interface GlyphCapProps {
  icon: IconName;
  /** Read out when the glyph stands alone; glyphs followed by their word are hidden instead. */
  label?: string;
  /** Smaller cap, for the lines under a step's title. */
  small?: boolean;
}

/** The browser button to look for, drawn as a small key inside a sentence. Not interactive. */
export function GlyphCap({ icon, label, small }: GlyphCapProps) {
  return (
    <span
      className={`${styles.cap} ${small ? styles.small : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Icon name={icon} size={20} />
    </span>
  );
}
