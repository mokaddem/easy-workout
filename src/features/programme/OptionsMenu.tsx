import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, IconButton, type IconName } from '@/ui/components';
import styles from './Overview.module.css';

export interface MenuAction {
  id: string;
  icon: IconName;
  label: string;
  hint?: string;
  onSelect: () => void;
}

/** The programme options button and its small popover. */
export function OptionsMenu({ actions }: { actions: MenuAction[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={styles.menuWrap}>
      <IconButton
        ref={button}
        icon="sliders"
        label={t('programme.menu.button')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <>
          <button
            type="button"
            className={styles.catch}
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className={styles.menu} role="menu" aria-label={t('programme.menu.button')}>
            {actions.map((action, index) => (
              <div key={action.id} style={{ display: 'contents' }}>
                {index > 0 ? <div className={styles.menuSep} role="separator" /> : null}
                <button
                  ref={index === 0 ? first : undefined}
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => {
                    setOpen(false);
                    action.onSelect();
                  }}
                >
                  <Icon name={action.icon} />
                  <span className={styles.menuLabel}>{action.label}</span>
                  {action.hint ? <span className={styles.menuHint}>{action.hint}</span> : null}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
