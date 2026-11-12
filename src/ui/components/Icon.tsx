import { PATHS, type IconName } from './iconPaths';

export type { IconName } from './iconPaths';
export { ICON_NAMES } from './iconPaths';

export type IconSize = 20 | 24 | 28;

export interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string;
}

export function Icon({ name, size = 24, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flex: 'none' }}
    >
      {PATHS[name]}
    </svg>
  );
}
