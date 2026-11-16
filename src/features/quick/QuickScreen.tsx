import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEquipment, useOpenSession, useProfile } from '@/app/data';
import { useProgressContext } from '@/app/progress';
import { goBack, navigate, type Route } from '@/app/router';
import type { Language } from '@/domain';
import { generateQuickSession, prepareSession, QUICK_FOCUSES, type QuickFocus } from '@/engine';
import { Button, Dock, Icon, IconButton, Skeleton, useToast } from '@/ui/components';
import { useBegin } from '../play/begin';
import { ResumeBanner } from '../play/components/ResumeBanner';
import { startQuickSession } from '../play/start';
import { sessionIdentity } from '../programme/format';
import { SessionView } from '../programme/SessionView';
import { RadioChoice } from './RadioTiles';
import {
  changedExercises,
  loadChoices,
  QUICK_MINUTES,
  saveChoices,
  type QuickChoices,
} from './state';
import styles from './Quick.module.css';

/** The launcher, or with `view: 'session'` the composed session (its own history entry, so Back returns to the launcher). */
export function QuickScreen({ route }: { route: Extract<Route, { name: 'quick' }> }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const profile = useProfile();
  const equipment = useEquipment();
  const toast = useToast();
  const openSession = useOpenSession();
  const { begin, dialog: beginDialog } = useBegin();
  const [choices, setChoices] = useState<QuickChoices>(loadChoices);
  const [seed, setSeed] = useState(0);
  const composed = route.view === 'session';
  const durationId = useId();
  const focusId = useId();
  const equipmentId = useId();

  useEffect(() => saveChoices(choices), [choices]);

  const inventory = useMemo(
    () => (choices.bodyweightOnly ? [] : (equipment ?? [])),
    [choices.bodyweightOnly, equipment],
  );

  const current = useMemo(
    () =>
      composed && profile
        ? generateQuickSession({
            profile,
            equipment: inventory,
            minutes: choices.minutes,
            focus: choices.focus,
            seed,
          })
        : null,
    [composed, profile, inventory, choices.minutes, choices.focus, seed],
  );
  // Loads come from history: the latest weight each exercise was done at.
  const progress = useProgressContext();
  const prepared = useMemo(
    () =>
      current && progress
        ? prepareSession(current.session, { ...progress, inventory }, 'quick').session
        : null,
    [current, progress, inventory],
  );
  const next = useMemo(
    () =>
      composed && profile
        ? generateQuickSession({
            profile,
            equipment: inventory,
            minutes: choices.minutes,
            focus: choices.focus,
            seed: seed + 1,
          })
        : null,
    [composed, profile, inventory, choices.minutes, choices.focus, seed],
  );

  // The launcher and the composed session slide past each other, but not on the first view.
  const [wasComposed, setWasComposed] = useState(composed);
  const [moved, setMoved] = useState(false);
  if (wasComposed !== composed) {
    setWasComposed(composed);
    setMoved(true);
  }

  if (profile === undefined || equipment === undefined)
    return (
      <div className={styles.skeleton} aria-busy="true">
        <Skeleton height={48} width="70%" />
        <Skeleton height={64} radius="var(--radius-md)" />
        <Skeleton height={120} radius="var(--radius-md)" />
      </div>
    );

  const update = (patch: Partial<QuickChoices>) => setChoices((c) => ({ ...c, ...patch }));

  if (!composed || !current || !next) {
    return (
      <>
        <div key="launcher" className={`${styles.scroll} ${moved ? styles.enterBack : ''}`}>
          <div className={styles.launcher}>
            <header className={styles.intro}>
              <h1 className={styles.display}>{t('quick.title')}</h1>
              <p className={styles.muted}>{t('quick.intro')}</p>
            </header>
            {openSession ? <ResumeBanner log={openSession} flush /> : null}
            <section className={styles.field} aria-labelledby={durationId}>
              <h2 id={durationId} className={styles.fieldTitle}>
                {t('quick.duration')}
              </h2>
              <RadioChoice
                variant="tiles"
                labelledBy={durationId}
                value={choices.minutes}
                onChange={(minutes) => update({ minutes })}
                options={QUICK_MINUTES.map((m) => ({
                  value: m,
                  label: t('quick.minutesLabel', { count: m }),
                  content: (
                    <>
                      <span className={styles.tileNum}>{m}</span>
                      <span className={styles.tileUnit}>{t('quick.min')}</span>
                    </>
                  ),
                }))}
              />
            </section>
            <section className={styles.field} aria-labelledby={focusId}>
              <h2 id={focusId} className={styles.fieldTitle}>
                {t('quick.focus')}
              </h2>
              <RadioChoice
                variant="chips"
                labelledBy={focusId}
                value={choices.focus}
                onChange={(focus: QuickFocus) => update({ focus })}
                options={QUICK_FOCUSES.map((f) => ({
                  value: f,
                  content: (
                    <>
                      {f === choices.focus ? (
                        <Icon name="check" size={20} className={styles.check} />
                      ) : null}
                      {t(`labels.focus.${f}`)}
                    </>
                  ),
                }))}
              />
              <p className={styles.hint} aria-live="polite">
                {t(`quick.about.${choices.focus}`)}
              </p>
            </section>
            <section className={styles.field} aria-labelledby={equipmentId}>
              <h2 id={equipmentId} className={styles.fieldTitle}>
                {t('quick.equipment')}
              </h2>
              <RadioChoice
                variant="seg"
                labelledBy={equipmentId}
                value={choices.bodyweightOnly ? 'none' : 'all'}
                onChange={(v) => update({ bodyweightOnly: v === 'none' })}
                options={[
                  {
                    value: 'all',
                    content: (
                      <>
                        <span>{t('quick.allEquipment')}</span>
                        <small>{t('quick.allEquipmentHint')}</small>
                      </>
                    ),
                  },
                  {
                    value: 'none',
                    content: (
                      <>
                        <span>{t('labels.bodyweight')}</span>
                        <small>{t('quick.noEquipmentHint')}</small>
                      </>
                    ),
                  },
                ]}
              />
            </section>
          </div>
        </div>
        <Dock>
          <Button
            size="player"
            fullWidth
            variant={openSession ? 'secondary' : 'primary'}
            onClick={() => navigate({ name: 'quick', view: 'session' })}
          >
            {t('quick.compose')}
          </Button>
        </Dock>
        {beginDialog}
      </>
    );
  }

  const shown = prepared ?? current.session;
  const noOther = changedExercises(current.session, next.session) === 0;
  const identity = {
    ...sessionIdentity(current.session, lang),
    title: t(`labels.focus.${choices.focus}`),
  };

  const shuffle = () => {
    const before = seed;
    const changed = changedExercises(current.session, next.session);
    setSeed(seed + 1);
    toast.show({
      message: t('quick.shuffled', { count: changed }),
      action: { label: t('common.undo'), onAction: () => setSeed(before) },
    });
  };

  return (
    <>
      <div className={styles.bar}>
        <IconButton icon="back" label={t('quick.backToChoices')} onClick={goBack} />
        <span className={styles.barText}>{t('quick.title')}</span>
      </div>
      <div key="session" className={`${styles.scroll} ${moved ? styles.enterForward : ''}`}>
        <SessionView
          session={shown}
          notes={current.notes}
          mode="quick"
          identity={identity}
          inventory={inventory}
          notices={<p className={styles.notice}>{t('quick.notSaved')}</p>}
          contentKey={seed}
        />
      </div>
      <Dock>
        <div className={styles.dock}>
          {noOther ? <p className={styles.dockNote}>{t('quick.noOther')}</p> : null}
          <div className={styles.dockRow}>
            <Button
              variant="secondary"
              size="player"
              icon="shuffle"
              disabled={noOther}
              onClick={shuffle}
            >
              {t('quick.shuffle')}
            </Button>
            <Button
              size="player"
              fullWidth
              icon="play"
              variant={openSession ? 'secondary' : 'primary'}
              onClick={() =>
                void begin(() => startQuickSession(shown), current.session.name[lang], {
                  name: 'play',
                  source: 'quick',
                })
              }
            >
              {t('quick.start')}
            </Button>
          </div>
        </div>
      </Dock>
      {beginDialog}
    </>
  );
}
