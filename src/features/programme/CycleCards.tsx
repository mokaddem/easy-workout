import { useTranslation } from 'react-i18next';
import type { Language, MaxTest } from '@/domain';
import { navigate } from '@/app/router';
import { PresenceList, RowMotion, Swap } from '@/motion';
import { Button, Card, Icon } from '@/ui/components';
import { Rich } from '../adapt';
import { exerciseName } from './format';
import { dayMonth, testNumberText } from './testFormat';
import styles from './Cycle.module.css';

export interface CycleEndProps {
  programmeId: string;
  cycle: number;
  /** The review was opened: the card offers the next cycle instead. */
  seen: boolean;
  first?: string;
  last?: string;
  test?: { current: MaxTest; previous?: MaxTest };
  /** A session is open: its resume banner keeps the primary. */
  resuming: boolean;
}

/** Where the next-session card stands once every session is done. */
export function CycleEndCard({
  programmeId,
  cycle,
  seen,
  first,
  last,
  test,
  resuming,
}: CycleEndProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const open = () => navigate({ name: 'review', programmeId });
  const dates =
    first && last ? `${dayMonth(first, lang, 'short')} – ${dayMonth(last, lang, 'short')}` : null;
  const primary = resuming ? 'secondary' : 'primary';
  return (
    <Card as="article" className={styles.card} aria-labelledby="cycle-end-title">
      <Swap id={seen ? 'ready' : 'ended'} innerClassName={styles.cardBody}>
        <div>
          <p className={styles.label}>{t('programme.cycleEnd.label', { n: cycle })}</p>
          <h2 className={styles.title} id="cycle-end-title">
            {t(seen ? 'programme.cycleEnd.readyTitle' : 'programme.cycleEnd.title', {
              next: cycle + 1,
            })}
          </h2>
        </div>
        {seen ? (
          <p className={styles.muted}>{t('programme.cycleEnd.readyLine')}</p>
        ) : (
          <ul className={styles.facts}>
            {dates ? (
              <li>
                <Icon name="calendar" size={20} />
                <span>{dates}</span>
              </li>
            ) : null}
            {test ? (
              <li>
                <Icon name="target" size={20} />
                <span>
                  <Rich
                    text={t(
                      test.previous
                        ? 'programme.cycleEnd.testFact'
                        : 'programme.cycleEnd.testFactFirst',
                      {
                        name: exerciseName(test.current.exerciseId, lang),
                        ...(test.previous && { from: testNumberText(test.previous) }),
                        to: testNumberText(test.current),
                      },
                    )}
                  />
                </span>
              </li>
            ) : null}
          </ul>
        )}
        <Button size="player" fullWidth variant={primary} onClick={open}>
          {seen ? t('programme.cycleEnd.start', { next: cycle + 1 }) : t('programme.cycleEnd.see')}
        </Button>
        {seen ? (
          <Button variant="secondary" fullWidth onClick={open}>
            {t('programme.cycleEnd.again')}
          </Button>
        ) : null}
        <p className={styles.note}>
          <Icon name="info" size={20} />
          <span>
            {t(seen ? 'programme.cycleEnd.meanwhile' : 'programme.cycleEnd.note', {
              next: cycle + 1,
            })}
          </span>
        </p>
      </Swap>
    </Card>
  );
}

/** The check-in slot: the card collapses away when dismissed. */
export function CheckInSlot({ show, ...props }: CheckInProps & { show: boolean }) {
  return (
    <PresenceList>
      {show ? (
        <RowMotion key="check-in" className={styles.checkInRow} leave="dismiss">
          <CheckInCard {...props} />
        </RowMotion>
      ) : null}
    </PresenceList>
  );
}

interface CheckInProps {
  /** Days since the last check-in; none yet = a first one. */
  daysSince: number | undefined;
  onOpen: () => void;
  onLater: () => void;
}

/** The weekly check-in invitation: not a banner, never above the next session. */
function CheckInCard({
  daysSince,
  onOpen,
  onLater,
}: {
  /** Days since the last check-in; none yet = a first one. */
  daysSince: number | undefined;
  onOpen: () => void;
  onLater: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card as="section" className={styles.checkIn} aria-labelledby="check-in-title">
      <div className={styles.checkInHead}>
        <span className={styles.well}>
          <Icon name="scale" size={24} />
        </span>
        <div className={styles.checkInText}>
          <h2 className={styles.checkInTitle} id="check-in-title">
            {t('programme.checkin.title')}
          </h2>
          <p className={styles.muted}>
            {daysSince === undefined
              ? t('programme.checkin.first')
              : t('programme.checkin.body', { count: daysSince })}
          </p>
        </div>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onOpen}>
          {t('programme.checkin.open')}
        </Button>
        <Button variant="ghost" onClick={onLater}>
          {t('programme.checkin.later')}
        </Button>
      </div>
    </Card>
  );
}
