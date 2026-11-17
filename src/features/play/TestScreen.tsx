import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/app/data';
import { useProgressContext } from '@/app/progress';
import { navigate, type Route } from '@/app/router';
import { exerciseById } from '@/catalogue';
import type { Language } from '@/domain';
import { isTestable, testBlockedByPain, testKind } from '@/engine';
import { Button, IconButton } from '@/ui/components';
import { exerciseLabel } from './format';
import { TestRunner } from './components/TestRunner';
import mine from './components/Test.module.css';
import styles from './Play.module.css';
import { unlockAudio } from './signals';

const toProgress = () => navigate({ name: 'progress' }, { replace: true });

/**
 * A max test on its own, outside any session: the same intro, set, entry and result as in a
 * session, without the rest (the sheet that leads here says to warm up) and without a session log.
 */
export function TestScreen({ route }: { route: Extract<Route, { name: 'test' }> }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const ctx = useProgressContext();
  const settings = useSettings();
  const exercise = exerciseById.get(route.exerciseId);
  const testable = !!exercise && isTestable(exercise);

  useEffect(() => {
    // A link to something that can't be tested: back to where tests are chosen.
    if (!testable) navigate({ name: 'tests' }, { replace: true });
  }, [testable]);

  if (!exercise || !testable || !ctx || !settings) return null;

  const blocked = testBlockedByPain(route.exerciseId, {
    ...ctx,
    maxTests: ctx.maxTests ?? [],
    ...(ctx.profile && { level: ctx.profile.level }),
    ...(ctx.profile?.bodyweightKg !== undefined && { bodyweightKg: ctx.profile.bodyweightKg }),
  });

  if (blocked)
    return (
      <div className={styles.root}>
        <div className={`${styles.bar} ${mine.freshBar}`}>
          <IconButton icon="close" label={t('play.fresh.leave')} onClick={toProgress} />
          <span>{t('play.fresh.context')}</span>
        </div>
        <div className={styles.set}>
          <div className={mine.blocked}>
            <p className={mine.kicker}>{t('play.test.kickerFresh')}</p>
            <h1 className={styles.name}>{exerciseLabel(exercise, lang, route.exerciseId)}</h1>
            <h2 className={mine.entryTitle}>{t('play.test.blockedTitle')}</h2>
            <p className={mine.blockedBody}>{t('play.test.blockedBody')}</p>
            <p className={mine.note}>{t('play.test.blockedNote')}</p>
          </div>
        </div>
        <div className={styles.dock}>
          <Button size="player" fullWidth onClick={toProgress}>
            {t('play.test.blockedBack')}
          </Button>
        </div>
      </div>
    );

  return (
    <div className={styles.root} onPointerDown={unlockAudio}>
      <div className={styles.stage} data-stage="exercise">
        <TestRunner
          mode="fresh"
          exerciseId={route.exerciseId}
          kind={testKind(exercise)}
          paused={false}
          onLeave={toProgress}
          onFinished={toProgress}
        />
      </div>
    </div>
  );
}
