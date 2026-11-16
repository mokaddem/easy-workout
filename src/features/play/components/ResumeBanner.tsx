import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { navigate } from '@/app/router';
import { exerciseById } from '@/catalogue';
import type { Language, SessionLog } from '@/domain';
import { activeSeconds } from '@/engine';
import { Button, Icon, SetStrip } from '@/ui/components';
import { exerciseLabel, leftOpenTooLong, mainSetCounts, pickUpStep, stripGroups } from '../format';
import { clearSummary, finishFromOutside } from '../lifecycle';
import { idleSince } from '../usePlayer';
import { abandonOpenSession } from '../start';
import { AbandonDialog } from './AbandonDialog';
import styles from './Lifecycle.module.css';

/** "Started yesterday at 18:05", or on a date when older. */
function startedText(
  t: ReturnType<typeof useTranslation>['t'],
  lang: Language,
  startedAt: string,
  now: number,
): string {
  const start = new Date(startedAt);
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(start);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(new Date(now)) - day(start)) / 86_400_000);
  if (days < 1) return t('play.resume.startedToday', { time });
  if (days === 1) return t('play.resume.startedYesterday', { time });
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(start);
  return t('play.resume.startedOn', { date, time });
}

/**
 * An open session, at the top of the Programme and Quick tabs. It holds the screen's only
 * primary action; open for more than 12 hours it leads with finishing (the sets are kept).
 */
export function ResumeBanner({ log, flush }: { log: SessionLog; flush?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const [now] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const stale = leftOpenTooLong(log, now);
  const name = log.plan.name[lang];
  const counts = mainSetCounts(log);
  const step = pickUpStep(log);
  const exercise = step && exerciseById.get(step.item.exerciseId);
  const picksUp = step
    ? t('play.resume.picksUp', {
        exercise: exerciseLabel(exercise, lang, step.item.exerciseId).toLowerCase(),
        set: step.set,
      })
    : t('play.resume.picksUpEnd');
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(log.startedAt),
  );
  const titleId = `resume-${log.id}`;

  const resume = () => {
    clearSummary();
    navigate({ name: 'play' });
  };
  const finish = async () => {
    setBusy(true);
    try {
      await finishFromOutside(log);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${styles.banner} ${flush ? styles.flush : ''}`} aria-labelledby={titleId}>
      <div className={styles.head}>
        <span className={styles.well}>
          <Icon name={stale ? 'hourglass' : 'pause'} size={24} />
        </span>
        <div className={styles.text}>
          <h2 className={styles.title} id={titleId}>
            {t(stale ? 'play.resume.stale' : 'play.resume.paused', { name })}
          </h2>
          <p className={styles.muted}>
            {stale ? startedText(t, lang, log.startedAt, now) : picksUp}
          </p>
        </div>
      </div>
      <div className={styles.progress}>
        <SetStrip groups={stripGroups(log)} small />
        <p className={styles.progressLine}>
          <span>
            <Trans
              i18nKey="play.resume.progress"
              count={counts.done}
              values={{ done: counts.done, total: counts.total }}
              components={{ b: <b /> }}
            />
          </span>
          <span>
            {stale
              ? t('play.resume.active', {
                  minutes: Math.round(
                    activeSeconds(log, new Date(idleSince(log, now) ?? now)) / 60,
                  ),
                })
              : t('play.resume.started', { time })}
          </span>
        </p>
      </div>
      <div className={styles.actions}>
        {stale ? (
          <Button fullWidth icon="check" loading={busy} onClick={() => void finish()}>
            {t('play.resume.finishKeep')}
          </Button>
        ) : (
          <Button size="player" fullWidth icon="play" onClick={resume}>
            {t('play.resume.resume')}
          </Button>
        )}
        <div className={styles.pair}>
          {stale ? (
            <Button variant="ghost" onClick={resume}>
              {t('play.resume.resume')}
            </Button>
          ) : (
            <Button variant="ghost" loading={busy} onClick={() => void finish()}>
              {t('play.resume.finishNow')}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            {t('play.resume.abandon')}
          </Button>
        </div>
      </div>
      <AbandonDialog
        open={confirming}
        log={log}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await abandonOpenSession(log);
          setConfirming(false);
        }}
      />
    </section>
  );
}
