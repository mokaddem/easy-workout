import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  useActiveProgramme,
  useEquipment,
  useOpenSession,
  useProfile,
  useSessionLogs,
} from '@/app/data';
import { nextSession } from '@/app/programme-state';
import { goBack, navigate, type Route } from '@/app/router';
import type { Language } from '@/domain';
import { phaseForWeek, sessionForWeek } from '@/engine';
import { Button, Dock, EmptyState, Icon, IconButton, Skeleton } from '@/ui/components';
import { useBegin } from '../play/begin';
import { startProgrammeSession } from '../play/start';
import { effortText } from './effort';
import { exerciseName, sessionIdentity, weekChanges, type WeekChanges } from './format';
import { SessionView } from './SessionView';
import { WeekRuler } from './WeekRuler';
import styles from './SessionScreen.module.css';

/** The sentence under the ruler: what this week asks differently from the one before. */
function Changes({ week, changes }: { week: number; changes: WeekChanges }) {
  const { t } = useTranslation();
  const parts: React.ReactNode[] = [];
  if (changes.moreSets > 0)
    parts.push(
      <Trans
        key="more"
        i18nKey="programme.changes.moreSets"
        count={changes.moreSets}
        components={{ b: <b /> }}
      />,
    );
  if (changes.fewerSets > 0)
    parts.push(
      <Trans
        key="fewer"
        i18nKey="programme.changes.fewerSets"
        count={changes.fewerSets}
        components={{ b: <b /> }}
      />,
    );
  if (changes.effortTo !== undefined && changes.effortFrom !== undefined)
    parts.push(
      <Trans
        key="effort"
        i18nKey="programme.changes.effort"
        values={{
          to: effortText(t, changes.effortTo),
          from:
            changes.effortFrom === 0
              ? t('labels.effort.failure').toLocaleLowerCase()
              : changes.effortFrom,
        }}
        components={{ b: <b /> }}
      />,
    );
  if (changes.firstSetRir !== undefined)
    parts.push(
      <Trans
        key="first"
        i18nKey="programme.changes.firstSet"
        values={{ effort: effortText(t, changes.firstSetRir) }}
        components={{ b: <b /> }}
      />,
    );
  if (changes.lastSetRir !== undefined)
    parts.push(
      <Trans
        key="last"
        i18nKey="programme.changes.lastSet"
        values={{ effort: effortText(t, changes.lastSetRir) }}
        components={{ b: <b /> }}
      />,
    );
  if (changes.cardioMinutes !== 0)
    parts.push(
      <Trans
        key="cardio"
        i18nKey="programme.changes.cardio"
        values={{
          minutes: `${changes.cardioMinutes > 0 ? '+' : '−'}${Math.abs(changes.cardioMinutes)}`,
        }}
        components={{ b: <b /> }}
      />,
    );
  if (parts.length === 0)
    return <p className={styles.delta}>{t('programme.changes.none', { week })}</p>;
  return (
    <p className={styles.delta}>
      {t('programme.changes.intro', { week })}{' '}
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? ', ' : ''}
          {part}
        </span>
      ))}
      .
    </p>
  );
}

/** One session of the programme, in any week, with the way to start it when it is the next one. */
export function SessionScreen({ route }: { route: Extract<Route, { name: 'session' }> }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const record = useActiveProgramme();
  const profile = useProfile();
  const equipment = useEquipment();
  const logs = useSessionLogs();
  const openSession = useOpenSession();
  const { begin, dialog: beginDialog } = useBegin();

  const session = record?.rotation.find((s) => s.id === route.sessionId);
  const position = record ? nextSession(record, logs) : null;
  const week = record ? Math.min(Math.max(route.week ?? position?.week ?? 1, 1), record.weeks) : 1;

  // Sessions that are the same every week (the cardio day) get no week ruler.
  const constant = useMemo(() => {
    if (!record || !session) return false;
    const first = JSON.stringify(sessionForWeek(record, session.id, 1).session);
    return Array.from({ length: record.weeks - 1 }, (_, i) => i + 2).every(
      (w) => JSON.stringify(sessionForWeek(record, session.id, w).session) === first,
    );
  }, [record, session]);

  if (record === undefined || profile === undefined)
    return (
      <>
        <div className={styles.bar} />
        <div className={styles.skeleton} aria-busy="true">
          <Skeleton height={106} radius="var(--radius-lg)" />
          <Skeleton height={36} width="60%" />
          <Skeleton height={160} radius="var(--radius-lg)" />
        </div>
      </>
    );

  if (!record || !session || !position)
    return (
      <>
        <div className={styles.bar}>
          <IconButton icon="back" label={t('programme.session.backToProgramme')} onClick={goBack} />
        </div>
        <EmptyState
          icon="calendar"
          title={t('programme.session.missingTitle')}
          description={t('programme.session.missingBody')}
          actionLabel={t('programme.session.backToProgramme')}
          onAction={() => navigate({ name: 'programme' }, { replace: true })}
        />
      </>
    );

  const plan = sessionForWeek(record, session.id, week);
  const previous = week > 1 ? sessionForWeek(record, session.id, week - 1) : null;
  const identity = sessionIdentity(session, lang, record.rotation);
  const phase = phaseForWeek(record, week);
  const isCurrentWeek = week === position.week;
  const isNext = session.id === position.sessionId;
  const canStart = isCurrentWeek && isNext && !position.finished;
  const over = profile ? plan.session.estimatedMinutes - profile.sessionMinutes : 0;
  const tests = plan.maxTests;

  const selectWeek = (next: number) =>
    navigate(
      { name: 'session', sessionId: session.id, ...(next === position.week ? {} : { week: next }) },
      { replace: true },
    );

  const notices = (
    <>
      {profile && over >= 5 && !identity.cardio ? (
        <p className={styles.flag}>
          <Icon name="clock" size={20} />
          <span>
            <Trans
              i18nKey="programme.session.longer"
              values={{ minutes: Math.round(over / 5) * 5, budget: profile.sessionMinutes }}
              components={{ b: <b /> }}
            />
          </span>
        </p>
      ) : null}
      {!isNext && isCurrentWeek ? (
        <p className={styles.flag}>
          <Icon name="info" size={20} />
          <span>{t('programme.session.notNext')}</span>
        </p>
      ) : null}
    </>
  );

  const ruler = constant ? (
    <div className={styles.wk}>
      <p className={styles.flag}>
        <Icon name="calendar" size={20} />
        <span>{t('programme.session.sameEveryWeek')}</span>
      </p>
    </div>
  ) : (
    <div className={styles.wk}>
      <div className={styles.wkHead}>
        <h2 className={styles.wkTitle}>
          {phase
            ? t('programme.week.title', { week, phase: phase.name[lang].toLocaleLowerCase(lang) })
            : t('programme.week.label', { week })}
        </h2>
        <span className={`${styles.wkState} ${isCurrentWeek ? '' : styles.wkPreview}`}>
          {t(isCurrentWeek ? 'programme.week.current' : 'programme.week.preview')}
        </span>
      </div>
      <WeekRuler
        weeks={record.weeks}
        phases={record.phases}
        selected={week}
        current={position.week}
        onSelect={selectWeek}
      />
      {previous ? <Changes week={week - 1} changes={weekChanges(previous, plan)} /> : null}
      {tests.length > 0 ? (
        <p className={styles.flag}>
          <Icon name="flag" size={20} />
          <span>
            {t('programme.week.test', {
              names: new Intl.ListFormat(lang, { type: 'conjunction' }).format(
                tests.map((id) => exerciseNameLower(id, lang)),
              ),
            })}
          </span>
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      <div className={styles.bar}>
        <IconButton icon="back" label={t('programme.session.backToProgramme')} onClick={goBack} />
        <span className={styles.barText}>
          {t('programme.session.context', {
            name: record.name[lang],
            week,
            total: record.weeks,
          })}
        </span>
      </div>
      <div className={styles.scroll}>
        <SessionView
          session={plan.session}
          notes={record.generation?.notes ?? []}
          mode="programme"
          identity={identity}
          inventory={record.generation?.equipment ?? equipment ?? []}
          {...(previous ? { previous: previous.session } : {})}
          setRir={plan.setRir}
          notices={notices}
          ruler={ruler}
          contentKey={week}
        />
      </div>
      {canStart || !isCurrentWeek ? (
        <Dock>
          {canStart ? (
            <Button
              size="player"
              fullWidth
              icon="play"
              variant={openSession ? 'secondary' : 'primary'}
              onClick={() =>
                void begin(() => startProgrammeSession(record, equipment ?? []), identity.fullName)
              }
            >
              {t('programme.start')}
            </Button>
          ) : (
            <>
              <p className={styles.dockNote}>
                {t('programme.session.previewNote', { week: position.week })}
              </p>
              <Button
                size="player"
                variant="secondary"
                fullWidth
                onClick={() => selectWeek(position.week)}
              >
                {t('programme.session.backToWeek', { week: position.week })}
              </Button>
            </>
          )}
        </Dock>
      ) : null}
      {beginDialog}
    </>
  );
}

const exerciseNameLower = (id: string, lang: Language) =>
  exerciseName(id, lang).toLocaleLowerCase(lang);
