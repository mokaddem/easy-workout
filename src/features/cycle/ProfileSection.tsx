import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { repo } from '@/db/repo';
import type { Language } from '@/domain';
import { Rich, numberText } from '@/features/adapt';
import { Swap } from '@/motion';
import { Button, Card, Icon } from '@/ui/components';
import { NBSP, cycleNumber } from './review';
import type { CycleData } from './useCycleData';
import styles from './ProfileSection.module.css';

type ReviewData = CycleData & {
  record: NonNullable<CycleData['record']>;
  review: NonNullable<CycleData['review']>;
};

/**
 * "Ton profil": the level-up and bodyweight offers. Accepting writes the profile right away;
 * the next cycle reads it when it starts. Undo puts back what was there.
 */
export function ProfileSection({ data, lang }: { data: ReviewData; lang: Language }) {
  const { t } = useTranslation();
  const { review, profile, baseline } = data;
  const next = cycleNumber(data.record) + 1;
  const [level, setLevel] = useState<'idle' | 'done'>('idle');
  const [weight, setWeight] = useState<'idle' | 'done'>('idle');
  const offerKg = review.bodyweight?.kg;
  const showLevel = review.levelUp;
  const showWeight = review.bodyweight !== undefined && baseline.bodyweightKg !== undefined;
  if (!showLevel && !showWeight) return null;
  const count = Number(showLevel) + Number(showWeight);
  const kg = (value: number) => `${numberText(value, lang)}${NBSP}${t('labels.unit.kg')}`;

  const setLevelTo = async (to: 'intermediate' | typeof baseline.level, state: 'idle' | 'done') => {
    await repo.saveProfile({ ...profile, level: to });
    setLevel(state);
  };
  const setWeightTo = async (value: number, state: 'idle' | 'done') => {
    await repo.saveProfile({ ...profile, bodyweightKg: value });
    setWeight(state);
  };

  return (
    <section className={styles.sec}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t('cycle.review.profile.title')}</h2>
        <p>{t('cycle.review.profile.intro', { count, next })}</p>
      </div>

      {showLevel ? (
        <Card as="div" className={styles.lvl}>
          <div className={styles.lvlHead}>
            <span className={styles.well}>
              <Icon name="step-up" />
            </span>
            <div>
              <span className={styles.kicker}>
                {t(
                  baseline.level === 'beginner'
                    ? 'cycle.review.profile.kickerBeginner'
                    : 'cycle.review.profile.kickerReturning',
                )}
              </span>
              <h3 className={styles.lvlTitle}>{t('cycle.review.profile.levelTitle')}</h3>
            </div>
          </div>
          <Swap id={level === 'done' ? 'done' : 'ask'} innerClassName={styles.swapLevel}>
            {level === 'done' ? (
              <div className={styles.done}>
                <p>
                  <Icon name="check" size={20} />
                  <span>{t('cycle.review.profile.levelDone', { next })}</span>
                </p>
                <Button variant="ghost" onClick={() => void setLevelTo(baseline.level, 'idle')}>
                  {t('cycle.review.profile.undo')}
                </Button>
              </div>
            ) : (
              <>
                <ul className={styles.why}>
                  <li>
                    <Icon name="check" size={20} />
                    <span>
                      <Rich
                        text={t('cycle.review.profile.levelSessions', {
                          done: review.sessions.inFull,
                          planned: review.sessions.planned,
                        })}
                      />
                    </span>
                  </li>
                  <li>
                    <Icon name="check" size={20} />
                    <span>
                      <Rich
                        text={t('cycle.review.profile.levelLifts', {
                          n: review.counts.progressed,
                          total: review.lifts.length,
                        })}
                      />
                    </span>
                  </li>
                  <li>
                    <Icon name="check" size={20} />
                    <span>
                      {t(
                        review.pain.length > 0
                          ? 'cycle.review.profile.levelPainSince'
                          : 'cycle.review.profile.levelPain',
                      )}
                    </span>
                  </li>
                </ul>
                <p className={styles.then}>{t('cycle.review.profile.levelThen', { next })}</p>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => void setLevelTo('intermediate', 'done')}
                >
                  {t('cycle.review.profile.levelTitle')}
                </Button>
              </>
            )}
          </Swap>
        </Card>
      ) : null}

      {showWeight && offerKg !== undefined && baseline.bodyweightKg !== undefined ? (
        <div className={styles.offer}>
          <Swap id={weight === 'done' ? 'done' : 'ask'} innerClassName={styles.swapOffer}>
            {weight === 'done' ? (
              <>
                <p>
                  <Icon name="check" size={20} />
                  <span>{t('cycle.review.profile.offerDone', { latest: kg(offerKg) })}</span>
                </p>
                <Button
                  variant="ghost"
                  onClick={() => void setWeightTo(baseline.bodyweightKg!, 'idle')}
                >
                  {t('cycle.review.profile.undo')}
                </Button>
              </>
            ) : (
              <>
                <p>
                  <Icon name="user" size={20} />
                  <span>
                    <Rich
                      text={t('cycle.review.profile.offer', {
                        profile: kg(baseline.bodyweightKg),
                        latest: kg(offerKg),
                      })}
                    />
                  </span>
                </p>
                <Button
                  variant="secondary"
                  className={styles.inline}
                  onClick={() => void setWeightTo(offerKg, 'done')}
                >
                  {t('cycle.review.profile.offerAction', { latest: kg(offerKg) })}
                </Button>
              </>
            )}
          </Swap>
        </div>
      ) : null}
    </section>
  );
}
