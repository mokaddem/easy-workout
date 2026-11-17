import type { ReactNode } from 'react';
import { Card } from './Card';
import { CompareFigure, type CompareFigureProps } from './CompareFigure';
import { Icon } from './Icon';
import { cx } from './cx';
import styles from './TestResultCard.module.css';

export interface TestResultCardProps {
  /** Small line over the name ("Max test"). */
  kicker: string;
  /** Exercise name. */
  name: string;
  /** The figure; `size` is fixed to `large`, `tag` goes inside it. */
  figure: Omit<CompareFigureProps, 'size'>;
  /** Optional sentence under the figure ("Same conditions as…"). */
  line?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}

/** Head (target well, kicker, name) + large compare figure (+ tag) + optional line. */
export function TestResultCard({
  kicker,
  name,
  figure,
  line,
  headingLevel = 2,
  className,
}: TestResultCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Card as="section" className={cx(styles.card, className)}>
      <div className={styles.head}>
        <span className={styles.well}>
          <Icon name="target" />
        </span>
        <div className={styles.id}>
          <span className={styles.kicker}>{kicker}</span>
          <Heading className={styles.name}>{name}</Heading>
        </div>
      </div>
      <CompareFigure {...figure} size="large" />
      {line ? <p className={styles.line}>{line}</p> : null}
    </Card>
  );
}

export interface TestResultRowProps {
  /** Exercise name. */
  name: string;
  /** The figure; `size` is fixed to `medium`. Its `srText` is the row's spoken sentence. */
  figure: Omit<CompareFigureProps, 'size' | 'tag' | 'fromCaption' | 'toCaption'>;
  /** Small line over the name ("Max test"). */
  kicker?: string;
  className?: string;
}

/** Summary row: 48 px target well, name, medium compare figure. */
export function TestResultRow({ name, figure, kicker, className }: TestResultRowProps) {
  return (
    <Card as="div" className={cx(styles.row, className)}>
      <span className={styles.well}>
        <Icon name="target" />
      </span>
      <div className={styles.id}>
        {kicker ? <span className={styles.kicker}>{kicker}</span> : null}
        <span className={styles.name}>{name}</span>
      </div>
      <CompareFigure {...figure} size="medium" className={styles.fig} />
    </Card>
  );
}
