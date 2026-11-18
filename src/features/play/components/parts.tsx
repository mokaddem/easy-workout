import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import type { SessionItem, Tempo } from '@/domain';
import type { PlayStep } from '@/engine';
import { Icon } from '@/ui/components';
import { exerciseLabel, itemLetter, rxText } from '../format';
import styles from '../Play.module.css';
import type { TempoPacer } from '../signals';
import type { PlayContext } from './types';
import type { Why } from './why';

export function SideTiles({ side }: { side: 'left' | 'right' }) {
  const { t } = useTranslation();
  return (
    <div className={styles.sides}>
      {(['left', 'right'] as const).map((s) => (
        <i
          key={s}
          className={s === side ? styles.cur : side === 'right' && s === 'left' ? styles.done : ''}
          role="img"
          aria-label={t(`play.side.sideWord`, { side: t(`play.side.${s}`) })}
        >
          <b>{t(s === 'left' ? 'play.side.leftLetter' : 'play.side.rightLetter')}</b>
        </i>
      ))}
    </div>
  );
}

/** a / b / c tiles of a group: done, current, later. On yellow the current one is dashed. */
export function ItemTiles({
  items,
  index,
  label,
}: {
  items: readonly SessionItem[];
  index: number;
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.items} {...(label && { role: 'img', 'aria-label': label })}>
      {items.map((item, i) => (
        <i
          key={item.exerciseId + i}
          className={i < index ? styles.done : i === index ? styles.cur : ''}
          {...(!label && {
            role: 'img',
            'aria-label': t('play.set.itemLabel', { letter: itemLetter(i), count: items.length }),
          })}
        >
          {itemLetter(i)}
        </i>
      ))}
    </div>
  );
}

/** Set or round label, side or item tiles, and the segments of the sets. */
export function SetHead({ step, bare }: { step: PlayStep; bare?: boolean }) {
  const { t } = useTranslation();
  const group = step.block.type === 'group';
  return (
    <div className={styles.setHead}>
      <div className={styles.setRow}>
        <span className={styles.setLabel}>
          <span>{group ? t('play.set.round') : t('play.set.set')}</span>
          <span>
            <span className={styles.num}>{step.set}</span>
            <span className={`${styles.num} ${styles.of}`}>/{step.sets}</span>
          </span>
        </span>
        {step.block.type === 'group' ? (
          <ItemTiles items={step.block.items} index={step.itemIndex} />
        ) : step.side ? (
          <SideTiles side={step.side} />
        ) : null}
      </div>
      {bare ? null : (
        <div className={styles.segs} aria-hidden="true">
          {Array.from({ length: step.sets }, (_, i) => (
            <i
              key={i}
              className={i + 1 < step.set ? styles.done : i + 1 === step.set ? styles.cur : ''}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** "Then b, Extension…, 12 reps, no rest": what follows in a superset or circuit. */
export function NextUp({ step, lang, player }: Pick<PlayContext, 'step' | 'lang' | 'player'>) {
  const { t } = useTranslation();
  const block = step.block;
  if (block.type !== 'group') return null;
  const next = block.items[step.itemIndex + 1];
  if (next) {
    const exercise = exerciseById.get(next.exerciseId);
    const rx = rxText(t, lang, next.target, next.load);
    return (
      <div className={styles.nextUp}>
        <span className={styles.nextUpLabel}>{t('play.next.label')}</span>
        <span className={styles.nextUpTile}>{itemLetter(step.itemIndex + 1)}</span>
        <span className={styles.nextUpBody}>
          <b>{exerciseLabel(exercise, lang, next.exerciseId)}</b>
          <span>{block.restBetweenItemsSec === 0 ? t('play.next.withRest', { rx }) : rx}</span>
        </span>
      </div>
    );
  }
  const text =
    step.set < step.sets
      ? block.restAfterRoundSec > 0
        ? t('play.next.thenRest', { seconds: block.restAfterRoundSec, round: step.set + 1 })
        : t('play.next.thenRound', { round: step.set + 1 })
      : player.state.index >= player.state.steps.length - 1
        ? t('play.next.end')
        : null;
  if (!text) return null;
  return (
    <div className={styles.nextUp}>
      <span className={styles.nextUpBody}>
        <span>{text}</span>
      </span>
    </div>
  );
}

/** Lower / hold / lift segments; a tap paces the reps to the tempo with a soft tone. */
export function TempoStrip({ tempo, pacer }: { tempo: Tempo; pacer: TempoPacer }) {
  const { t } = useTranslation();
  const phases = [
    ['down', 'lower'],
    ['pause', 'hold'],
    ['up', 'lift'],
  ] as const;
  return (
    <button
      type="button"
      className={styles.tempo}
      aria-pressed={pacer.running}
      aria-label={`${t(pacer.running ? 'play.set.tempoStop' : 'play.set.tempoStart')}, ${t('play.set.tempo', tempo)}`}
      onClick={pacer.toggle}
      style={{
        gridTemplateColumns: `${tempo.down || 1}fr ${tempo.pause || 1}fr ${tempo.up || 1}fr${pacer.running ? ' auto' : ''}`,
      }}
    >
      {phases.map(([phase, word]) => (
        <span
          key={phase}
          className={styles.tempoSeg}
          data-active={pacer.running && pacer.phase === phase ? '' : undefined}
        >
          <span>{t(`play.set.${word}`)}</span>
          <b>{t('play.set.seconds', { count: tempo[phase] })}</b>
        </span>
      ))}
      {pacer.running ? (
        <span className={styles.tempoRep}>
          <small>{t('play.set.tempoRep', { rep: '' }).trim()}</small>
          <b>{pacer.rep}</b>
        </span>
      ) : null}
    </button>
  );
}

/** The why chip, drawn over the top of the animation slot. */
export function WhyChip({ why }: { why: Why }) {
  if (!why.text) return null;
  return (
    <p data-reserve="chip" className={`${styles.whyChip} ${why.pain ? styles.whyPain : ''}`}>
      <Icon name={why.pain ? 'stop' : 'info'} size={20} />
      <span>{why.text}</span>
    </p>
  );
}
