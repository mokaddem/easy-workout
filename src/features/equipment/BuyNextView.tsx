import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CrossFade } from '@/motion';
import type { EquipmentItem, Session } from '@/domain';
import type { PurchaseAdvice } from '@/engine';
import { Button, EmptyState, ProgressBar, Skeleton, Spinner } from '@/ui/components';
import type { BuyNextState } from './useBuyNext';
import { PurchaseCard } from './PurchaseCard';
import styles from './BuyNextView.module.css';

const FIRST = 3;

export interface BuyNextViewProps {
  state: BuyNextState;
  rotation: readonly Pick<Session, 'id'>[];
  onOwn: (advice: PurchaseAdvice) => void;
  onRetry: () => void;
  onBack: () => void;
}

/** Skeleton, cards and error share one place: switching between them cross-fades. */
export function BuyNextView(props: BuyNextViewProps) {
  const { status } = props.state;
  return (
    <CrossFade id={status === 'done' ? 'done' : status === 'error' ? 'error' : 'busy'}>
      <BuyNextBody {...props} />
    </CrossFade>
  );
}

function BuyNextBody({ state, rotation, onOwn, onRetry, onBack }: BuyNextViewProps) {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const intro = <p className={styles.intro}>{t('equipment.buy.intro')}</p>;

  if (state.status === 'error') {
    return (
      <div className={styles.view}>
        {intro}
        <EmptyState
          icon="alert"
          title={t('equipment.buy.error')}
          description={t('equipment.buy.errorHint')}
          actionLabel={t('equipment.buy.retry')}
          onAction={onRetry}
        />
      </div>
    );
  }

  if (state.status !== 'done') {
    const computing = state.status === 'computing' ? state : null;
    return (
      <div className={styles.view} aria-busy="true">
        {intro}
        <div className={styles.computing}>
          <p className={styles.computingTitle} role="status">
            <Spinner size={24} />
            {t('equipment.buy.computing')}
          </p>
          {computing && computing.total > 0 ? (
            <ProgressBar
              variant="segmented"
              total={computing.total}
              current={Math.min(computing.done + 1, computing.total)}
              label={t('equipment.buy.progress', { done: computing.done, total: computing.total })}
            />
          ) : null}
        </div>
        {[0, 1].map((n) => (
          <div key={n} className={styles.skeleton}>
            <div className={styles.skeletonHead}>
              <Skeleton width={48} height={48} radius="var(--radius-sm)" />
              <div className={styles.skeletonId}>
                <Skeleton width="60%" height={20} />
                <Skeleton width="35%" height={14} />
              </div>
            </div>
            <Skeleton height={14} />
            <Skeleton width="80%" height={14} />
            <Skeleton height={56} radius="var(--radius-md)" />
          </div>
        ))}
      </div>
    );
  }

  const { advice, unchanged } = state;
  if (advice.length === 0) {
    return (
      <div className={styles.view}>
        {intro}
        <EmptyState
          icon="check"
          title={t('equipment.buy.nothing')}
          description={t('equipment.buy.nothingHint')}
          actionLabel={t('equipment.buy.backToMine')}
          onAction={onBack}
        />
      </div>
    );
  }

  const shown = showAll ? advice : advice.slice(0, FIRST);
  const names = unchanged.map((u) => unchangedName(u.item, u.id, t));
  const listed = new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' }).format(
    names,
  );
  // The list opens the sentence.
  const sentence = listed.charAt(0).toLocaleUpperCase(i18n.language) + listed.slice(1);
  return (
    <div className={styles.view}>
      {intro}
      <div className={styles.stack}>
        {shown.map((a) => (
          <PurchaseCard key={a.id} advice={a} rotation={rotation} onOwn={() => onOwn(a)} />
        ))}
        {!showAll && advice.length > FIRST ? (
          <Button variant="secondary" fullWidth onClick={() => setShowAll(true)}>
            {t('equipment.buy.showAll', { count: advice.length })}
          </Button>
        ) : null}
        {(showAll || advice.length <= FIRST) && names.length > 0 ? (
          <section className={styles.none}>
            <h3>{t('equipment.buy.unchangedTitle')}</h3>
            <p>{t('equipment.buy.unchangedHint', { list: sentence })}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function unchangedName(_item: EquipmentItem, id: string, t: (key: string) => string): string {
  const name = t(`equipment.buy.names.${id}`);
  return name.charAt(0).toLowerCase() + name.slice(1);
}
