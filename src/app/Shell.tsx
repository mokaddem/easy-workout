import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { MotionProvider } from '@/motion';
import { ProgressProvider } from './progress';
import { TabBar, ToastProvider, type TabBarItem } from '@/ui/components';
import { navigate, routeHref, tabOf, useLocationState, type Route, type Tab } from './router';
import styles from './Shell.module.css';

const TABS: { id: Tab; icon: TabBarItem['icon'] }[] = [
  { id: 'programme', icon: 'calendar' },
  { id: 'quick', icon: 'bolt' },
  { id: 'progress', icon: 'chart' },
  { id: 'settings', icon: 'sliders' },
];

type Entrance = 'none' | 'forward' | 'back' | 'fade';

/**
 * How the current screen arrives. Decided once per screen identity (`route.name`), so URL changes
 * inside a screen (steps, weeks, views) never replay it. Tab to tab is a light cross-fade.
 */
function useEntrance(route: Route): Entrance {
  const { direction } = useLocationState();
  const [state, setState] = useState<{ name: string; tab: Tab | null; entrance: Entrance }>({
    name: route.name,
    tab: tabOf(route),
    entrance: 'none',
  });
  if (state.name !== route.name) {
    const tab = tabOf(route);
    const entrance: Entrance =
      tab && state.tab ? 'fade' : direction === 'none' ? 'fade' : direction;
    setState({ name: route.name, tab, entrance });
    return entrance;
  }
  return state.entrance;
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { t } = useTranslation();
  const tab = tabOf(route);
  const entrance = useEntrance(route);
  const shell = useRef<HTMLDivElement>(null);
  useBottomChrome(shell);

  return (
    <MotionProvider>
      <div ref={shell} className={styles.shell} data-tabbar={tab ? '' : undefined}>
        <ToastProvider offsetBottom={TOAST_OFFSET}>
          <ProgressProvider>
            <div
              key={route.name}
              className={styles.screen}
              data-entrance={entrance === 'none' ? undefined : entrance}
            >
              {children}
            </div>
            {tab ? (
              <TabBar
                label={t('nav.label')}
                onNavigate={(href) => navigate(href)}
                items={TABS.map(({ id, icon }) => ({
                  id,
                  icon,
                  label: t(`nav.${id}`),
                  href: routeHref({ name: id }),
                  current: id === tab,
                }))}
              />
            ) : null}
          </ProgressProvider>
        </ToastProvider>
      </div>
    </MotionProvider>
  );
}

/** The toast region adds the safe area itself; the measured chrome already includes it. */
const TOAST_OFFSET = 'max(0px, calc(var(--bottom-chrome, 0px) - env(safe-area-inset-bottom, 0px)))';

/**
 * Keeps `--bottom-chrome` on the shell equal to the height of whatever is pinned at the bottom
 * (the dock, the tab bar or both), so toasts always sit just above it.
 */
function useBottomChrome(shell: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const root = shell.current;
    if (!root) return;
    const measure = () => {
      const bottom = root.getBoundingClientRect().bottom;
      const pinned = [...root.querySelectorAll<HTMLElement>('[data-dock], nav')];
      const top = Math.min(bottom, ...pinned.map((el) => el.getBoundingClientRect().top));
      root.style.setProperty('--bottom-chrome', `${Math.max(0, bottom - top)}px`);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    const mutations = new MutationObserver(() => {
      for (const el of root.querySelectorAll('[data-dock], nav')) resize.observe(el);
      measure();
    });
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [shell]);
}
