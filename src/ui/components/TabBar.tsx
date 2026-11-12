import type { MouseEvent } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';
import styles from './TabBar.module.css';

export interface TabBarItem {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  current?: boolean;
}

export interface TabBarProps {
  items: readonly TabBarItem[];
  /** Called on plain left-clicks so a router can take over; modified clicks keep native behaviour. */
  onNavigate?: (href: string) => void;
  /** Accessible name of the navigation landmark. */
  label: string;
  className?: string;
}

export function TabBar({ items, onNavigate, label, className }: TabBarProps) {
  function handle(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onNavigate) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(href);
  }

  return (
    <nav aria-label={label} className={cx(styles.bar, className)}>
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={cx(styles.tab, item.current && styles.current)}
          aria-current={item.current ? 'page' : undefined}
          onClick={(event) => handle(event, item.href)}
        >
          <span className={styles.icon}>
            <Icon name={item.icon} />
          </span>
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
