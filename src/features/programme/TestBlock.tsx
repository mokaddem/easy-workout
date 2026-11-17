import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '@/domain';
import { Button, Card, Icon } from '@/ui/components';
import { Rich } from '../adapt';
import { exerciseName } from './format';
import type { SessionTestView } from './cycleTest';
import { dayMonth, testResultText } from './testFormat';
import styles from './TestBlock.module.css';

/** The sentence under the session hero that says where the test runs, and why there. */
export function TestNotice({ view }: { view: SessionTestView }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  if (view.kind === 'done' || view.kind === 'skipped') return null;
  const text =
    view.kind === 'pain'
      ? t('programme.session.testNoticeBlocked')
      : t(
          view.placement === 'end'
            ? 'programme.session.testNotice'
            : 'programme.session.testNoticeFirst',
          {
            name: exerciseName(view.exerciseId, lang),
            muscles: view.muscles ? t(`programme.session.testMuscles.${view.muscles}`) : '',
          },
        );
  return (
    <p className={styles.notice}>
      <Icon name="target" size={20} />
      <span>
        <Rich text={text} />
      </span>
    </p>
  );
}

/** The test as a section of the session: the rule, the number to beat, or what became of it. */
export function TestBlock({ view }: { view: SessionTestView }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const [whyOpen, setWhyOpen] = useState(false);
  const name = exerciseName(view.exerciseId, lang);

  let title = name;
  let body: React.ReactNode;
  if (view.kind === 'run') {
    body = (
      <>
        <p className={styles.rule}>
          {t(
            view.testKind === 'time'
              ? 'programme.session.testRuleHold'
              : 'programme.session.testRuleReps',
          )}
        </p>
        <p className={styles.prev}>
          {view.last ? (
            <Rich
              text={t('programme.session.testLast', {
                value: testResultText(t, view.last),
                date: dayMonth(view.last.date, lang),
              })}
            />
          ) : (
            t('programme.session.testNone')
          )}
        </p>
        <Button variant="ghost" onClick={() => setWhyOpen((open) => !open)} aria-expanded={whyOpen}>
          {t('programme.session.testWhy')}
        </Button>
        {whyOpen ? <p className={styles.prev}>{t('why.maxTest', { name })}</p> : null}
      </>
    );
  } else if (view.kind === 'done') {
    body = (
      <p className={styles.rule}>
        {view.test ? (
          <Rich
            text={t('programme.session.testDone', {
              date: dayMonth(view.date, lang),
              value: testResultText(t, view.test),
            })}
          />
        ) : (
          t('programme.session.testDoneNoValue', { date: dayMonth(view.date, lang) })
        )}
      </p>
    );
  } else if (view.kind === 'skipped') {
    body = (
      <p className={styles.rule}>
        {t('programme.session.testSkipped', { date: dayMonth(view.date, lang) })}
      </p>
    );
  } else {
    title = t('programme.session.testBlockedTitle', { name });
    body = (
      <>
        {view.hurtId && view.hurtDate ? (
          <p className={styles.rule}>
            {t('programme.session.testBlocked', {
              count: view.freeSince,
              exercise: exerciseName(view.hurtId, lang),
              date: dayMonth(view.hurtDate, lang),
            })}
          </p>
        ) : null}
        <p className={styles.prev}>{t('programme.session.testBlockedLater')}</p>
      </>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="session-test-title">
      <div className={styles.head}>
        <h2 className={styles.title} id="session-test-title">
          {t('programme.session.testTitle')}
        </h2>
        {view.kind === 'run' ? (
          <span className={styles.meta}>{t('programme.session.testMinutes')}</span>
        ) : null}
      </div>
      <Card className={styles.block}>
        <span className={styles.well}>
          <Icon name="target" size={24} />
        </span>
        <div className={styles.text}>
          <h3 className={styles.name}>{title}</h3>
          {body}
        </div>
      </Card>
    </section>
  );
}
