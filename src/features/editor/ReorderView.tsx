import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { animate } from 'motion/react';
import { useMotionTokens } from '@/motion';
import type { Exercise, Language, Session } from '@/domain';
import { canMoveBy } from './editOps';
import { itemsOf, SECTIONS, type Section } from '@/engine';
import { Icon } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { doseLine, nameOf } from './dose';
import styles from './editor.module.css';

interface Props {
  draft: Session;
  exercises: ReadonlyMap<string, Exercise>;
  lang: Language;
  /** The row moved last: `section:index`. */
  moved: string | null;
  onMove: (section: Section, index: number, delta: -1 | 1) => void;
}

/** Every block as a compact row with up and down buttons; sections stay as they are. */
export function ReorderView({ draft, exercises, lang, moved, onMove }: Props) {
  const { t } = useTranslation();
  const tokens = useMotionTokens();
  const root = useRef<HTMLDivElement>(null);
  const tops = useRef(new Map<string, number>());
  // A move swaps the row with its neighbour: each row glides from where it was (transform only).
  // Under reduced motion the swap is a short fade instead of a travel.
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    root.current?.querySelectorAll<HTMLElement>('[data-row]').forEach((el) => {
      const key = el.dataset.row!;
      const top = el.getBoundingClientRect().top;
      next.set(key, top);
      const from = tops.current.get(key);
      if (from === undefined || Math.abs(from - top) < 1) return;
      if (tokens.reduced) {
        animate(
          el,
          { opacity: [0.4, 1] },
          { duration: tokens.duration.fast, ease: tokens.ease.move },
        );
      } else {
        animate(
          el,
          { y: [from - top, 0] },
          { duration: tokens.duration.base, ease: tokens.ease.move },
        );
      }
    });
    tops.current = next;
  });
  return (
    <div ref={root} style={{ display: 'contents' }}>
      <p className={styles.reorderHint}>{t('editor.reorderMode.hint')}</p>
      {SECTIONS.filter((s) => draft[s].length > 0).map((section) => (
        <section key={section} className={styles.section}>
          <h2 className={styles.sectionTitle}>{t(`programme.session.${section}`)}</h2>
          <div className={styles.list}>
            {draft[section].map((block, index) => {
              const items = itemsOf(block);
              const first = items[0]!;
              const title =
                block.type === 'group'
                  ? t(`programme.group.${block.style}`, { count: block.rounds })
                  : nameOf(exercises, first.exerciseId, lang);
              const at = { section, index };
              return (
                <div
                  key={first.slot ?? index}
                  data-row={first.slot ?? `${section}:${index}`}
                  className={cx(
                    styles.reorderRow,
                    moved === `${section}:${index}` && styles.reorderMoved,
                  )}
                >
                  <span className={styles.grip} aria-hidden="true">
                    <Icon name="grip" />
                  </span>
                  <span className={styles.reorderText}>
                    <span className={styles.reorderName}>{title}</span>
                    {block.type === 'straight' ? (
                      <span className={styles.facts}>
                        {doseLine(
                          t,
                          block.item,
                          block.sets,
                          block.restSec,
                          exercises.get(block.item.exerciseId),
                          lang,
                        )}
                      </span>
                    ) : (
                      <span className={styles.reorderGroup}>
                        {block.items.map((item, i) => (
                          <span key={item.slot ?? i} className={styles.facts}>
                            {nameOf(exercises, item.exerciseId, lang)}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className={styles.mini}
                    aria-label={t('editor.reorderMode.up', { name: title })}
                    disabled={!canMoveBy(draft, at, -1)}
                    onClick={() => onMove(section, index, -1)}
                  >
                    <Icon name="arrow-up" />
                  </button>
                  <button
                    type="button"
                    className={styles.mini}
                    aria-label={t('editor.reorderMode.down', { name: title })}
                    disabled={!canMoveBy(draft, at, 1)}
                    onClick={() => onMove(section, index, 1)}
                  >
                    <Icon name="arrow-down" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
