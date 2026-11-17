import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  useActiveProgramme,
  useAnswers,
  useEquipment,
  useOpenSession,
  useProfile,
  useSessionLogs,
} from '@/app/data';
import { nextSession } from '@/app/programme-state';
import { switchBack, useProgressContext, usePreparedSession } from '@/app/progress';
import { goBack, navigate, type Route } from '@/app/router';
import type { Language } from '@/domain';
import {
  ensureSlots,
  phaseForWeek,
  prepareSession,
  weekRole,
  sessionForWeek,
  setAdjustments,
  type Proposal,
} from '@/engine';
import { repo } from '@/db/repo';
import {
  ActionSheet,
  BarButton,
  Button,
  Dialog,
  Dock,
  EmptyState,
  Icon,
  IconButton,
  Sheet,
  Skeleton,
  useToast,
} from '@/ui/components';
import { ProposalCard, Rich, loadText, repsText, secondsText, tokenOf } from '../adapt';
import { breakNotice, itemGoals, proposalFacts, swapAnswerFor } from './adaptation';
import { useBegin } from '../play/begin';
import { startProgrammeSession } from '../play/start';
import { effortText } from './effort';
import { exerciseName, sessionIdentity, weekChanges, type WeekChanges } from './format';
import { hasHistory, placeState } from './edits';
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
  const answers = useAnswers();
  const ctx = useProgressContext();
  const { begin, dialog: beginDialog } = useBegin();
  const [choose, setChoose] = useState<Proposal | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [unplacing, setUnplacing] = useState(false);
  const [more, setMore] = useState(false);
  const toast = useToast();

  const session = record?.rotation.find((s) => s.id === route.sessionId);
  const position = record ? nextSession(record, logs) : null;
  const week = record ? Math.min(Math.max(route.week ?? position?.week ?? 1, 1), record.weeks) : 1;
  const prepared = usePreparedSession(record, session?.id, week);

  // Goals set by set: an intensity week asks more of the first set.
  const goals = useMemo(() => {
    if (!record || !session || !prepared) return {};
    const plan = sessionForWeek(record, session.id, week);
    return itemGoals(
      prepared.session,
      setAdjustments({ ...plan, session: prepared.session }, equipment ?? []),
    );
  }, [record, session, prepared, week, equipment]);

  // What the original exercise would be again: load and goal, for the switch-back dialog.
  const original = useMemo(() => {
    if (!back || !record || !session || !ctx) return undefined;
    const plan = sessionForWeek(record, session.id, week);
    const undone = {
      ...ctx,
      answers: [
        ...ctx.answers,
        {
          id: 'preview',
          exerciseId: back,
          kind: 'harder' as const,
          answer: 'back' as const,
          at: ctx.now.toISOString(),
        },
      ],
    };
    const result = prepareSession(plan.session, undone, 'programme', {
      role: weekRole(record, week),
    });
    for (const block of [...result.session.main, ...result.session.finisher])
      for (const item of block.type === 'straight' ? [block.item] : block.items)
        if (item.exerciseId === back) return item;
    return undefined;
  }, [back, record, session, ctx, week]);

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
  const place = placeState(record, session.id);
  const placed = place.kind === 'placed';
  const baseIdentity = sessionIdentity(session, lang, record.rotation);
  // A session of the user's own keeps its name whole: it has no "Session A — " prefix to drop.
  const identity = placed ? { ...baseIdentity, title: baseIdentity.fullName } : baseIdentity;
  const letter = identity.letter ?? '';
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

  const brk = prepared ? breakNotice(prepared.notes) : undefined;
  const notices = (
    <>
      {place.kind === 'edited' ? (
        <div className={styles.notice}>
          <Icon name="pencil" size={20} />
          <div className={styles.noticeBody}>
            <span>
              <Trans
                i18nKey="programme.session.edited"
                count={place.edits.count}
                components={{ b: <b /> }}
              />
            </span>
            <Button variant="ghost" onClick={() => setRestoring(true)}>
              {t('programme.session.restore')}
            </Button>
          </div>
        </div>
      ) : null}
      {place.kind === 'placed' ? (
        <div className={styles.notice}>
          <Icon name="bookmark" size={20} />
          <div className={styles.noticeBody}>
            <span>
              <Trans
                i18nKey="programme.session.placed"
                values={{ letter }}
                components={{ b: <b /> }}
              />
            </span>
            <Button variant="ghost" onClick={() => setUnplacing(true)}>
              {t('programme.session.unplace')}
            </Button>
          </div>
        </div>
      ) : null}
      {brk ? (
        <p className={styles.flag}>
          <Icon name="hourglass" size={20} />
          <span>
            <Rich text={t(`adapt.detail.notice.${brk.key}`, { days: brk.days })} />
          </span>
        </p>
      ) : null}
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
        <BarButton
          className={styles.barAction}
          icon="pencil"
          label={t('programme.session.edit')}
          onClick={() =>
            navigate(
              place.kind === 'placed'
                ? { name: 'edit', target: 'mine', sessionId: place.customId }
                : { name: 'edit', target: 'programme', sessionId: session.id },
            )
          }
        />
        <IconButton icon="more" label={t('programme.session.more')} onClick={() => setMore(true)} />
      </div>
      <div className={styles.scroll}>
        <SessionView
          session={prepared?.session ?? plan.session}
          {...(prepared && answers
            ? {
                adaptation: {
                  prepared,
                  goals,
                  answers,
                  onSwitchBack: setBack,
                  onChoose: setChoose,
                },
              }
            : {})}
          notes={placed ? [] : (record.generation?.notes ?? [])}
          {...(place.kind === 'edited'
            ? {
                editing: {
                  stored: ensureSlots(session),
                  edits: place.edits,
                  history: (id: string) => hasHistory(logs, id),
                },
              }
            : {})}
          {...(placed ? { kickerLabel: t('programme.session.mine') } : {})}
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
      <ActionSheet
        open={more}
        onClose={() => setMore(false)}
        title={identity.fullName}
        closeLabel={t('common.close')}
        groups={[
          [
            {
              id: 'copy',
              icon: 'copy',
              label: t('programme.session.copy'),
              hint: t('programme.session.copyHint'),
              onSelect: () => {
                setMore(false);
                void copyToMine();
              },
            },
          ],
        ]}
      />
      <Dialog
        open={restoring}
        onClose={() => setRestoring(false)}
        title={t('programme.restore.title')}
        description={
          place.kind === 'edited'
            ? t('programme.restore.body', {
                count: place.edits.count,
                letter: letter || identity.title,
              })
            : undefined
        }
        confirmLabel={t('programme.restore.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          setRestoring(false);
          void repo.resetProgrammeSession(record.id, session.id).then(() =>
            toast.show({
              message: t('programme.restore.done', { letter: letter || identity.title }),
            }),
          );
        }}
      />
      <Dialog
        open={unplacing}
        onClose={() => setUnplacing(false)}
        title={t('programme.unplace.title')}
        description={
          place.kind === 'placed'
            ? t('programme.unplace.body', {
                name: place.generatedName[lang],
                letter: letter || identity.title,
              })
            : undefined
        }
        confirmLabel={t('programme.unplace.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          setUnplacing(false);
          const name = place.kind === 'placed' ? place.generatedName[lang] : '';
          void repo.resetProgrammeSession(record.id, session.id).then(() =>
            toast.show({
              message: t('programme.unplace.done', { name, letter: letter || identity.title }),
            }),
          );
        }}
      />
      <Sheet
        open={choose !== null}
        onClose={() => setChoose(null)}
        title={t('adapt.programme.sheet.title')}
        description={t('adapt.programme.sheet.sub')}
        footer={
          <Button variant="secondary" fullWidth onClick={() => setChoose(null)}>
            {t('adapt.programme.sheet.close')}
          </Button>
        }
      >
        {choose ? (
          <ProposalCard
            key={`${choose.kind}:${choose.exerciseId}`}
            proposal={choose}
            variant="flat"
            facts={proposalFacts(
              choose,
              logs?.find((l) => l.id === choose.logId),
              true,
            )}
          />
        ) : null}
      </Sheet>
      <Dialog
        open={back !== null}
        onClose={() => setBack(null)}
        title={t('adapt.detail.dialog.title')}
        description={back ? switchBackText(back) : undefined}
        confirmLabel={t('adapt.detail.dialog.confirm')}
        cancelLabel={t('adapt.detail.dialog.cancel')}
        onConfirm={() => {
          const id = back;
          setBack(null);
          if (id) void switchBack(id);
        }}
      />
    </>
  );

  /** A copy of the session as it stands (edits included) among the user's own. */
  async function copyToMine() {
    if (!session) return;
    const { id: _id, ...rest } = session;
    const copyName = (name: string, l: Language) =>
      i18n.getFixedT(l)('programme.session.copyName', { name: name.slice(0, 28) });
    const saved = await repo.saveCustomSession({
      ...rest,
      name: { fr: copyName(session.name.fr, 'fr'), en: copyName(session.name.en, 'en') },
      base: session,
    });
    toast.show({
      message: t('programme.session.copied'),
      action: {
        label: t('programme.session.copiedView'),
        onAction: () => navigate({ name: 'mine', sessionId: saved.id }),
      },
    });
  }

  function switchBackText(id: string): string {
    const item = original;
    const target = item?.target;
    const time = target?.kind === 'time';
    const goal =
      item === undefined
        ? undefined
        : (item.goal ??
          (target?.kind === 'reps'
            ? target.min
            : target?.kind === 'time'
              ? target.minSec
              : undefined));
    const goalText =
      goal === undefined ? undefined : time ? secondsText(goal, lang) : repsText(t, goal);
    const load =
      item?.load && item.load.kind !== 'bodyweight'
        ? loadText(t, lang, tokenOf(item.load))
        : undefined;
    const at =
      goalText === undefined
        ? ''
        : load
          ? t('adapt.detail.dialog.at', { load, goal: goalText })
          : t('adapt.detail.dialog.atGoal', { goal: goalText });
    const answer = answers ? swapAnswerFor(answers, id) : undefined;
    const why =
      answer?.kind === 'pain'
        ? t('adapt.detail.dialog.whyPain')
        : answer?.kind === 'assisted'
          ? t('adapt.detail.dialog.whyBand')
          : t('adapt.detail.dialog.whyChoice');
    return t('adapt.detail.dialog.body', { old: exerciseName(id, lang), at }) + why;
  }
}

const exerciseNameLower = (id: string, lang: Language) =>
  exerciseName(id, lang).toLocaleLowerCase(lang);
