import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { handleLinkClick, routeHref } from '@/app/router';
import type { Language } from '@/domain';
import type { Highlight } from '@/engine';
import { Collapse } from '@/motion';
import { Button, Icon } from '@/ui/components';
import { Rich } from '../../adapt';
import { exerciseName } from '../../adapt/format';
import { highlightRow } from '../highlights';
import styles from '../ProgressScreen.module.css';

const SHOWN = 4;

/** What moved up lately: at most four rows, the rest expand in place. */
export function HighlightList({ items, lang }: { items: readonly Highlight[]; lang: Language }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rows = items.map((h) => highlightRow(t, lang, h));
  const hidden = rows.length - SHOWN;
  const renderRow = (row: (typeof rows)[number]) => {
    const route = { name: 'exercise', exerciseId: row.exerciseId } as const;
    const href = routeHref(route);
    return (
      <a
        key={row.exerciseId}
        className={styles.hlRow}
        href={href}
        onClick={(e) => handleLinkClick(e, href)}
      >
        <span className={styles.hlWell}>
          <Icon name={row.icon} size={24} />
        </span>
        <span className={styles.hlText}>
          <span className={styles.hlName}>{exerciseName(row.exerciseId, lang)}</span>
          <span className={styles.line}>
            <Rich text={row.line} />
          </span>
        </span>
        <Icon name="chevron" size={20} className={styles.chev} />
      </a>
    );
  };
  return (
    <>
      <div className={styles.hl}>
        {rows.slice(0, SHOWN).map(renderRow)}
        <Collapse open={open}>
          <div className={styles.hl}>{rows.slice(SHOWN).map(renderRow)}</div>
        </Collapse>
      </div>
      {hidden > 0 ? (
        <Button
          variant="ghost"
          className={styles.more}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t('progress.highlights.less') : t('progress.highlights.more', { count: hidden })}
        </Button>
      ) : null}
    </>
  );
}
