import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapse } from '@/motion';
import { Icon } from '@/ui/components';
import type { Ledger, LedgerRow } from './ledger';
import styles from './EditsLedger.module.css';

function Rows({ rows, kept }: { rows: LedgerRow[]; kept?: boolean }) {
  return (
    <ul className={styles.list}>
      {rows.map((row) => (
        <li key={row.id} className={styles.row}>
          <span className={`${styles.dot} ${kept ? styles.dotKept : ''}`} aria-hidden="true" />
          <span>
            <span className={styles.where}>{row.where}</span>
            {row.name ? <span className={styles.name}>{row.name}</span> : null}
            {row.why ? <span className={styles.why}>{row.why}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The user's changes at a regeneration: how many carry over, which don't and why. */
export function EditsLedger({ ledger }: { ledger: Ledger }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const { kept, dropped, splitChanged } = ledger;
  const total = kept.length + dropped.length;

  return (
    <section className={styles.ledger} aria-label={t('programme.preview.edits.title')}>
      <h3 className={styles.title}>
        <Icon name="pencil" size={20} />
        {t('programme.preview.edits.title')}
      </h3>
      {splitChanged ? (
        <>
          <p className={styles.line}>
            {t('programme.preview.edits.splitChanged', { count: total })}
          </p>
          <Disclosure
            label={t('programme.preview.edits.showList')}
            open={open}
            onToggle={() => setOpen((v) => !v)}
            id={bodyId}
          >
            <Rows rows={dropped} />
          </Disclosure>
        </>
      ) : (
        <>
          <div className={styles.figs}>
            <div className={styles.fig}>
              <span className={styles.figN}>{kept.length}</span>
              <span className={styles.figLabel}>
                {t('programme.preview.edits.kept', { count: kept.length })}
              </span>
            </div>
            {dropped.length > 0 ? (
              <div className={`${styles.fig} ${styles.figMuted}`}>
                <span className={styles.figN}>{dropped.length}</span>
                <span className={styles.figLabel}>
                  {t('programme.preview.edits.dropped', { count: dropped.length })}
                </span>
              </div>
            ) : (
              <p className={styles.line}>{t('programme.preview.edits.allKept')}</p>
            )}
          </div>
          {dropped.length > 0 ? <Rows rows={dropped} /> : null}
          {kept.length > 0 ? (
            <Disclosure
              label={t('programme.preview.edits.showKept', { count: kept.length })}
              open={open}
              onToggle={() => setOpen((v) => !v)}
              id={bodyId}
            >
              <Rows rows={kept} kept />
            </Disclosure>
          ) : null}
        </>
      )}
    </section>
  );
}

function Disclosure({
  label,
  open,
  onToggle,
  id,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        className={styles.disc}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span className={styles.discTitle}>{label}</span>
        <span className={styles.chev}>
          <Icon name="chev-down" />
        </span>
      </button>
      <Collapse open={open} id={id}>
        {children}
      </Collapse>
    </div>
  );
}
