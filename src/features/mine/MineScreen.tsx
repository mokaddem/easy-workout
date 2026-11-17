import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import {
  useActiveProgramme,
  useCustomSession,
  useEquipment,
  useOpenSession,
  useSessionLogs,
} from '@/app/data';
import { goBack, navigate, type Route } from '@/app/router';
import type { CustomSessionRecord } from '@/db';
import { repo } from '@/db/repo';
import type { Language, Session } from '@/domain';
import {
  checkSession,
  generatedSession,
  itemsOf,
  placesOf,
  refreshRampUps,
  replaceItem,
  replacementItem,
  suggestPlacing,
  type Issue,
} from '@/engine';
import {
  ActionSheet,
  BarButton,
  Button,
  Dialog,
  Dock,
  EmptyState,
  Icon,
  IconButton,
  IssueLine,
  Skeleton,
  useToast,
} from '@/ui/components';
import { ExercisePicker } from '../editor/picker';
import { useBegin } from '../play/begin';
import { startCustomSession } from '../play/start';
import { exerciseName, sessionIdentity } from '../programme/format';
import { SessionView } from '../programme/SessionView';
import { PlaceSheet } from './PlaceSheet';
import { StartBlockedDialog } from './StartBlockedDialog';
import { unusableIssues, withoutUnusable } from './logic';
import { neededText, unusableText } from './unusable';
import { useEditContext } from './useMine';
import styles from './Mine.module.css';

/** The session as the engine and the player know it: without the storage stamp. */
function plain(record: CustomSessionRecord): Session {
  const { updatedAt: _, base: __, ...session } = record;
  return session;
}

/** One session of the user's own: what it holds, and the ways to start, change, place or delete it. */
export function MineScreen({ route }: { route: Extract<Route, { name: 'mine' }> }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const custom = useCustomSession(route.sessionId);
  const record = useActiveProgramme();
  const logs = useSessionLogs();
  const equipment = useEquipment();
  const ctx = useEditContext();
  const openSession = useOpenSession();
  const toast = useToast();
  const { begin, dialog: beginDialog } = useBegin();
  const [menu, setMenu] = useState(false);
  const [place, setPlace] = useState(false);
  const [unplace, setUnplace] = useState(false);
  const [remove, setRemove] = useState(false);
  const [blockedStart, setBlockedStart] = useState(false);
  const [replacing, setReplacing] = useState<{
    section: 'warmup' | 'main' | 'finisher';
    blockIndex: number;
    itemIndex: number;
    exerciseId: string;
  } | null>(null);

  const issues = useMemo<Issue[]>(
    () => (custom && ctx ? checkSession(custom, ctx) : []),
    [custom, ctx],
  );
  const unusable = unusableIssues(issues);

  const header = (children?: React.ReactNode) => (
    <div className={styles.bar}>
      <IconButton icon="back" label={t('mine.custom.back')} onClick={goBack} />
      <span className={styles.barText}>{t('mine.custom.context')}</span>
      {children}
    </div>
  );

  if (custom === undefined || record === undefined || !logs || !ctx)
    return (
      <>
        {header()}
        <div className={styles.skeletonPage} aria-busy="true">
          <Skeleton height={106} radius="var(--radius-lg)" />
          <Skeleton height={36} width="60%" />
          <Skeleton height={160} radius="var(--radius-lg)" />
        </div>
      </>
    );

  if (custom === null)
    return (
      <>
        {header()}
        <EmptyState
          icon="bookmark"
          title={t('mine.custom.missingTitle')}
          description={t('mine.custom.missingBody')}
          actionLabel={t('mine.custom.back')}
          onAction={() => navigate({ name: 'quick' }, { replace: true })}
        />
      </>
    );

  const session = plain(custom);
  const name = custom.name[lang];
  const places = record ? placesOf(record, custom.id) : [];
  const placed = record && places.length > 0 ? record : null;
  const placeInfo = places.map((slot) => {
    const entry = record?.rotation.find((s) => s.id === slot);
    const generated = record ? generatedSession(record, slot) : undefined;
    return {
      slot,
      letter: entry && record ? (sessionIdentity(entry, lang, record.rotation).letter ?? '') : '',
      generatedName:
        generated && record ? sessionIdentity(generated, lang, record.rotation).title : '',
    };
  });
  const first = placeInfo[0];
  const nudge = !placed && !!record && suggestPlacing(logs, custom.id, new Date());
  const identity = { title: name, fullName: name, cardio: false };

  const start = (s: Session) => void begin(() => startCustomSession(s, equipment ?? []), name);
  const onStart = () => (unusable.length > 0 ? setBlockedStart(true) : start(session));
  const itemOf = (issue: Issue) => {
    const ref = issue.ref;
    if (!ref || ref.itemIndex === undefined) return undefined;
    const block = session[ref.section][ref.blockIndex];
    return block ? itemsOf(block)[ref.itemIndex] : undefined;
  };

  const without = withoutUnusable(session, issues);
  const blockedNames = [
    ...new Set(unusable.map((i) => itemOf(i)?.exerciseId).filter((id): id is string => !!id)),
  ];
  const duplicate = async () => {
    const copy = t('mine.custom.copyName', { name });
    const { id: _id, ...rest } = session;
    const saved = await repo.saveCustomSession({
      ...rest,
      name: { fr: copy, en: copy },
      ...(custom.base && { base: custom.base }),
    });
    toast.show({
      message: t('mine.custom.duplicated'),
      action: {
        label: t('mine.custom.view'),
        onAction: () => navigate({ name: 'mine', sessionId: saved.id }),
      },
    });
  };

  const unplaceNow = async () => {
    setUnplace(false);
    if (!record) return;
    for (const { slot } of placeInfo) await repo.resetProgrammeSession(record.id, slot);
    if (first)
      toast.show({
        message: t('mine.custom.unplaced', { name: first.generatedName, letter: first.letter }),
      });
  };

  const removeNow = async () => {
    setRemove(false);
    const programmeId = record?.id;
    const slots = places;
    const label = first;
    await repo.deleteCustomSession(session.id);
    navigate({ name: 'quick' }, { replace: true });
    toast.show({
      message: label
        ? t('mine.custom.deletedPlaced', { name: label.generatedName, letter: label.letter })
        : t('mine.custom.deleted'),
      action: {
        label: t('common.undo'),
        onAction: () =>
          void (async () => {
            await repo.saveCustomSession(session);
            if (programmeId)
              for (const slot of slots)
                await repo.placeCustomSession(programmeId, slot, session.id);
          })(),
      },
    });
  };

  const replaceWith = async (exerciseId: string) => {
    const target = replacing;
    setReplacing(null);
    if (!target) return;
    const block = session[target.section][target.blockIndex];
    const item = block && itemsOf(block)[target.itemIndex];
    const previous = exerciseById.get(target.exerciseId);
    const next = exerciseById.get(exerciseId);
    if (!item || !previous || !next) return;
    const at = {
      section: target.section,
      blockIndex: target.blockIndex,
      itemIndex: target.itemIndex,
    };
    const replaced = replaceItem(
      session,
      at,
      replacementItem(item, previous, next, target.section === 'main' && target.blockIndex === 0, {
        inventory: ctx.inventory,
        level: ctx.profile.level,
        ...(ctx.profile.bodyweightKg !== undefined && { bodyweightKg: ctx.profile.bodyweightKg }),
      }),
    );
    await repo.saveCustomSession(refreshRampUps(replaced, session, ctx));
    toast.show({ message: t('mine.custom.replaced') });
  };

  const notices = (
    <div className={styles.notices}>
      <p className={styles.note}>
        <Icon name="info" size={20} />
        <span>{t('mine.custom.standalone')}</span>
      </p>
      {nudge ? (
        <p className={styles.note}>
          <Icon name="calendar" size={20} />
          <span className={styles.noteBody}>
            <span>{t('mine.custom.nudge')}</span>
            <Button variant="secondary" onClick={() => setPlace(true)}>
              {t('mine.custom.nudgeAction')}
            </Button>
          </span>
        </p>
      ) : null}
      {placed ? (
        <p className={styles.note}>
          <Icon name="bookmark" size={20} />
          <span className={styles.noteBody}>
            <span>
              <Trans
                i18nKey="mine.custom.placed"
                values={{ letter: first?.letter }}
                components={{ b: <b /> }}
              />
            </span>
            <Button variant="ghost" onClick={() => setUnplace(true)}>
              {t('mine.custom.unplace')}
            </Button>
          </span>
        </p>
      ) : record ? (
        <button type="button" className={styles.placeRow} onClick={() => setPlace(true)}>
          <span className={styles.placeWell} aria-hidden="true">
            <Icon name="calendar" size={24} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className={styles.placeTitle}>{t('mine.custom.place')}</span>
            <span className={styles.placeSub}>{t('mine.custom.placeSub')}</span>
          </span>
          <Icon name="chev-right" className={styles.chev} />
        </button>
      ) : null}
      {unusable.length > 0 ? (
        <div className={styles.issues}>
          {unusable.map((issue) => {
            const item = itemOf(issue);
            if (!item || !issue.ref) return null;
            const known = exerciseById.has(item.exerciseId);
            const ref = issue.ref;
            return (
              <IssueLine
                key={`${ref.section}-${ref.blockIndex}-${ref.itemIndex}`}
                level="block"
                action={
                  known ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setReplacing({
                          section: ref.section,
                          blockIndex: ref.blockIndex,
                          itemIndex: ref.itemIndex ?? 0,
                          exerciseId: item.exerciseId,
                        })
                      }
                    >
                      {t('mine.custom.replace')}
                    </Button>
                  ) : undefined
                }
              >
                <b>{exerciseName(item.exerciseId, lang)}.</b>{' '}
                {unusableText(t, lang, item.exerciseId, ctx.inventory)}
              </IssueLine>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  const names = new Intl.ListFormat(lang, { type: 'conjunction' }).format(
    blockedNames.slice(0, 2).map((id) => exerciseName(id, lang)),
  );

  return (
    <>
      {header(
        <>
          <BarButton
            icon="pencil"
            label={t('mine.custom.edit')}
            onClick={() => navigate({ name: 'edit', target: 'mine', sessionId: custom.id })}
          />
          <IconButton icon="more" label={t('mine.custom.options')} onClick={() => setMenu(true)} />
        </>,
      )}
      <div className={styles.scroll}>
        <SessionView
          session={session}
          notes={[]}
          mode="programme"
          identity={identity}
          inventory={ctx.inventory}
          notices={notices}
          kickerLabel={t('mine.custom.kicker')}
          heroIcon="bookmark"
        />
      </div>
      <Dock>
        <Button
          size="player"
          fullWidth
          icon="play"
          variant={openSession ? 'secondary' : 'primary'}
          onClick={onStart}
        >
          {t('mine.custom.start')}
        </Button>
      </Dock>
      {beginDialog}
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        eyebrow={name}
        title={t('mine.custom.options')}
        closeLabel={t('common.close')}
        groups={[
          [
            ...(record
              ? [
                  placed
                    ? {
                        id: 'unplace',
                        label: t('mine.custom.unplace'),
                        hint: t('mine.custom.unplaceHint'),
                        icon: 'restore' as const,
                        onSelect: () => {
                          setMenu(false);
                          setUnplace(true);
                        },
                      }
                    : {
                        id: 'place',
                        label: t('mine.custom.place'),
                        hint: t('mine.custom.placeHint'),
                        icon: 'calendar' as const,
                        onSelect: () => {
                          setMenu(false);
                          setPlace(true);
                        },
                      },
                ]
              : []),
            {
              id: 'duplicate',
              label: t('mine.custom.duplicate'),
              hint: t('mine.custom.duplicateHint'),
              icon: 'copy',
              onSelect: () => {
                setMenu(false);
                void duplicate();
              },
            },
          ],
          [
            {
              id: 'delete',
              label: t('mine.custom.delete'),
              icon: 'trash',
              danger: true,
              onSelect: () => {
                setMenu(false);
                setRemove(true);
              },
            },
          ],
        ]}
      />
      {record ? (
        <PlaceSheet
          open={place}
          onClose={() => setPlace(false)}
          custom={custom}
          programme={record}
          logs={logs}
          ctx={ctx}
        />
      ) : null}
      <Dialog
        open={unplace}
        onClose={() => setUnplace(false)}
        title={t('mine.custom.unplaceDialog.title')}
        description={t('mine.custom.unplaceDialog.body', {
          name: first?.generatedName,
          letter: first?.letter,
        })}
        confirmLabel={t('mine.custom.unplaceDialog.confirm')}
        cancelLabel={t('mine.custom.cancel')}
        onConfirm={() => void unplaceNow()}
      />
      <Dialog
        open={remove}
        onClose={() => setRemove(false)}
        title={t('mine.custom.deleteDialog.title')}
        description={
          <>
            {first ? (
              <>
                <Trans
                  i18nKey="mine.custom.deleteDialog.placed"
                  values={{ letter: first.letter, name: first.generatedName }}
                  components={{ b: <b /> }}
                />{' '}
              </>
            ) : null}
            {t('mine.custom.deleteDialog.history')}
          </>
        }
        confirmLabel={t('mine.custom.deleteDialog.confirm')}
        cancelLabel={t('mine.custom.cancel')}
        destructive
        onConfirm={() => void removeNow()}
      />
      <StartBlockedDialog
        open={blockedStart}
        onClose={() => setBlockedStart(false)}
        title={t('mine.custom.startBlocked.title', { count: blockedNames.length })}
        description={t('mine.custom.startBlocked.body', {
          count: blockedNames.length,
          name: blockedNames[0] ? exerciseName(blockedNames[0], lang) : '',
          names,
          equipment: blockedNames[0] ? neededText(t, lang, blockedNames[0], ctx.inventory) : '',
        })}
        withoutLabel={
          without ? t('mine.custom.startWithout', { count: blockedNames.length }) : null
        }
        onWithout={() => {
          setBlockedStart(false);
          if (without) start(without);
        }}
        editLabel={t('mine.custom.editSession')}
        onEdit={() => {
          setBlockedStart(false);
          navigate({ name: 'edit', target: 'mine', sessionId: custom.id });
        }}
        cancelLabel={t('mine.custom.cancel')}
      />
      <ExercisePicker
        open={replacing !== null}
        mode="replace"
        section={replacing?.section ?? 'main'}
        {...(replacing ? { replacing: replacing.exerciseId } : {})}
        onPick={(id) => void replaceWith(id)}
        onClose={() => setReplacing(null)}
      />
    </>
  );
}
