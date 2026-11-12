import { useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import type { Language, Session } from '@/domain';
import type { PurchaseAdvice } from '@/engine';
import { Button, Card, Icon, type IconName } from '@/ui/components';
import { entryOf } from './entries';
import { groupChanges, sessionLetters, type SwapLine } from './swaps';
import styles from './PurchaseCard.module.css';

const MAX_LINES = 2;
const COST_BARS = { low: 1, medium: 2, high: 3 } as const;

interface Line {
  id: string;
  icon: IconName;
  content: ReactNode;
}

export interface PurchaseCardProps {
  advice: PurchaseAdvice;
  rotation: readonly Pick<Session, 'id'>[];
  onOwn: () => void;
}

export function PurchaseCard({ advice, rotation, onOwn }: PurchaseCardProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const [expanded, setExpanded] = useState(false);
  const entry = entryOf(advice.item);
  const list = new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' });
  const nameOf = (id: string) => exerciseById.get(id)?.name[lang] ?? id;

  const swapLines: Line[] = groupChanges(advice.changes, sessionLetters(rotation))
    .filter((line): line is SwapLine & { to: string } => line.to !== undefined)
    .map((line) => {
      const sessions = list.format(
        line.sessions.map((s) => (s === 'cardio' ? t('equipment.buy.cardioDay') : s)),
      );
      const base = {
        count: line.sessions.length,
        values: { to: nameOf(line.to), from: line.from ? nameOf(line.from) : '', sessions },
        components: { b: <b /> },
      };
      return {
        id: `${line.from ?? ''}>${line.to}`,
        icon: 'swap' as const,
        content: (
          <Trans i18nKey={line.from ? 'equipment.buy.swapIn' : 'equipment.buy.addIn'} {...base} />
        ),
      };
    });

  const gains = advice.gains;
  const loaded = (gains.cappedLoads ?? 0) + (gains.noHeadroom ?? 0);
  const noChange = advice.changes.length === 0;
  const gainLines: Line[] = [
    gains.dropped ? gain('dropped', gains.dropped) : null,
    gains.fallbacks ? gain('fallbacks', gains.fallbacks) : null,
    gains.ranked ? gain('ranked', gains.ranked) : null,
    gains.limitedProgression ? gain('limitedProgression', gains.limitedProgression) : null,
    gains.noAddedLoad
      ? gain(noChange ? 'noAddedLoadOnly' : 'noAddedLoad', gains.noAddedLoad)
      : null,
    loaded > 0 ? gain('heavier', 1) : null,
    gains.cardio ? gain('cardio', 1) : null,
  ].filter((line): line is Line => line !== null);

  function gain(key: string, count: number): Line {
    return {
      id: key,
      icon: 'plus',
      content: t(`equipment.buy.gain.${key}`, { count }),
    };
  }

  const shownSwaps = expanded ? swapLines : swapLines.slice(0, MAX_LINES);
  const shownGains = expanded ? gainLines : gainLines.slice(0, MAX_LINES);
  const hidden = swapLines.length - shownSwaps.length + (gainLines.length - shownGains.length);

  const unlocked = advice.unlockedExercises;
  const figure = unlocked > 0 ? unlocked : (gains.noAddedLoad ?? 0);
  const figureLabel =
    unlocked > 0
      ? t('equipment.buy.exercises', { count: unlocked })
      : t('equipment.buy.exercisesToLoad', { count: figure });
  const name = t(`equipment.buy.names.${advice.id}`);

  return (
    <Card as="article" className={styles.card} aria-label={name}>
      <div className={styles.head}>
        <span className={styles.well}>
          <Icon name={entry?.icon ?? 'bag'} size={28} />
        </span>
        <div className={styles.id}>
          <h3 className={styles.name}>{name}</h3>
          <span className={styles.cost}>
            <span className={styles.bars} aria-hidden="true">
              {[1, 2, 3].map((bar) => (
                <i key={bar} className={bar <= COST_BARS[advice.cost] ? styles.on : undefined} />
              ))}
            </span>
            {t(`labels.cost.${advice.cost}`)}
          </span>
        </div>
        {figure > 0 ? (
          <p className={styles.fig}>
            <span className={styles.num}>{unlocked > 0 ? `+${figure}` : figure}</span>
            <small>{figureLabel}</small>
          </p>
        ) : null}
      </div>
      {shownSwaps.length + shownGains.length > 0 ? (
        <ul className={styles.list}>
          {[...shownSwaps, ...shownGains].map((line) => (
            <li key={line.id}>
              <Icon name={line.icon} size={20} />
              <span>{line.content}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {hidden > 0 || expanded ? (
        <Button
          variant="ghost"
          className={styles.more}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('equipment.buy.fewer') : t('equipment.buy.more', { count: hidden })}
        </Button>
      ) : null}
      <Button variant="secondary" fullWidth onClick={onOwn}>
        {t('equipment.buy.own')}
      </Button>
    </Card>
  );
}
