import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Trans, useTranslation } from 'react-i18next';
import type { ProgrammeRecord } from '@/db';
import { repo } from '@/db/repo';
import { goBack, navigate, useLeaveGuard } from '@/app/router';
import type { Answer, Exercise, Language, Programme, Session, SessionItem } from '@/domain';
import {
  activeSwaps,
  addToGroup,
  bySlot,
  canGroup,
  checkProgramme,
  checkSession,
  defaultBlock,
  groupRests,
  groupWithNext,
  insertBlock,
  isRampSlot,
  isSteadyCardio,
  issueKey,
  itemEdits,
  itemsOf,
  newSlot,
  refreshRampUps,
  removeBlock,
  removedSlots,
  removeItem,
  replaceItem,
  replacementItem,
  resetItem,
  restoreSlot,
  saveSessionEdit,
  sectionSeconds,
  sessionEdited,
  setBlockDose,
  setItemDose,
  ungroup,
  ungroupedRest,
  WARMUP_TRANSITION_SEC,
  moveItem,
  renameSession,
  type EditContext,
  type Issue,
  type ItemAt,
  type Section,
} from '@/engine';
import {
  ActionSheet,
  Button,
  Dialog,
  Dock,
  DurationMeter,
  Icon,
  IconButton,
  IssueLine,
  NameField,
  BarButton,
  useToast,
  type ActionItem,
} from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { ExercisePicker } from './picker';
import { PresenceList, RowMotion } from '@/motion';
import { AddRow, GroupCard, StraightCard, Tombstone } from './Cards';
import { clearDraft, loadDraft, storeDraft } from './draftStore';
import { doseLine, doseNumber, nameOf } from './dose';
import {
  blankSession,
  countChanges,
  dismissIssue,
  exerciseIdsOf,
  hasItems,
  moveBlockBy,
  moveBlockToSection,
  pruneDismissals,
  sameSession,
  setGroupStyle,
  takeOutOfGroup,
  blockNumber,
} from './editOps';
import { blockKey, firstBlocking, groupIssues } from './issues';
import { actionFor, issueText } from './issueText';
import { DoseSheet, GroupSheet, LeaveSheet } from './Sheets';
import { ReorderView } from './ReorderView';
import { tombstones, tombstonesIn } from './tombstones';
import { effortText } from '../programme/effort';
import styles from './editor.module.css';

export interface EditorProps {
  target: 'programme' | 'mine';
  /** Route id: a rotation session, a custom session, or `new`. */
  sessionId: string;
  /** The session as stored. */
  initial: Session;
  /** The programme's version, for programme sessions. */
  generated?: Session | undefined;
  /** What a session of the user's own was copied from: checks only flag what changed since. */
  copiedFrom?: Session | undefined;
  /** The active programme, for the week-level checks and the save of a programme session. */
  programme?: ProgrammeRecord | undefined;
  /** A custom session running in the programme: measured against its length. */
  placed: boolean;
  ctx: EditContext;
  answers: readonly Answer[];
  /** The line under the title: "Session A, Push" or the session's name. */
  contextLine: string;
  /** The rotation letter of a programme session, for the toast. */
  letter?: string | undefined;
}

type At = { section: Section; blockIndex: number; itemIndex?: number };
type PickerState = {
  mode: 'add' | 'replace';
  section: Section;
  /** Add to this group (block index), or replace the item here. */
  at?: At;
};

const SECTION_KEYS = { warmup: 'toWarmup', main: 'toMain', finisher: 'toFinisher' } as const;

export function Editor({
  target,
  sessionId,
  initial,
  generated,
  copiedFrom,
  programme,
  placed,
  ctx,
  answers,
  contextLine,
  letter,
}: EditorProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const toast = useToast();
  const isNew = sessionId === 'new';
  const programmeSession = target === 'programme';

  const [start] = useState(() => {
    const kept = loadDraft(target, sessionId);
    const restored = !!kept && !sameSession(kept, initial);
    return { restored, draft: restored && kept ? kept : isNew ? blankSession() : initial };
  });
  const [draft, setDraft] = useState<Session>(start.draft);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [menu, setMenu] = useState<At | null>(null);
  const [dose, setDose] = useState<{ at: At; openedAt: number } | null>(null);
  const [groupAt, setGroupAt] = useState<{
    section: Section;
    index: number;
    openedAt: number;
  } | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [reorder, setReorder] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [warmOpen, setWarmOpen] = useState(false);
  const scrollTo = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  /** False while the screen paints for the first time: nothing that is already there animates. */
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const nameInput = useRef<HTMLInputElement>(null);

  const dirty = !sameSession(draft, isNew ? blankSession() : initial);
  const changes = countChanges(draft, isNew ? blankSession() : initial);

  useEffect(() => {
    if (start.restored) {
      toast.show({ message: t('editor.draftRestored') });
    }
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (saved) return;
    if (dirty) storeDraft(target, sessionId, draft);
    else clearDraft(target, sessionId);
  }, [draft, dirty, saved, target, sessionId]);

  useLeaveGuard(dirty && !saved, (proceed) => setLeave(() => proceed));

  useEffect(() => {
    const key = scrollTo.current;
    if (!key) return;
    scrollTo.current = null;
    scroller.current?.querySelector(`[data-block="${key}"]`)?.closest('article')?.scrollIntoView({
      block: 'nearest',
    });
  }, [draft]);

  /** Applies a change; dismissals about items that changed go. */
  const apply = (fn: (s: Session) => Session) =>
    setDraft((prev) => pruneDismissals(prev, fn(prev)));

  const exercises = ctx.exercises;
  const swaps = useMemo(() => activeSwaps(answers), [answers]);
  const edits = useMemo(
    () =>
      generated ? itemEdits(draft, generated) : new Map<string, 'added' | 'exercise' | 'dose'>(),
    [draft, generated],
  );
  const stones = useMemo(() => (generated ? tombstones(draft, generated) : []), [draft, generated]);

  const budget = programmeSession || placed ? ctx.profile.sessionMinutes : undefined;
  const issues = useMemo(() => {
    const base = generated ?? copiedFrom;
    const own = checkSession(draft, ctx, {
      ...(base && { base }),
      inProgramme: budget !== undefined,
    });
    let week: Issue[] = [];
    if (programmeSession && programme) {
      try {
        week = checkProgramme(saveSessionEdit(programme as Programme, draft), ctx);
      } catch {
        week = [];
      }
    }
    return [...own, ...week];
  }, [draft, ctx, generated, copiedFrom, budget, programmeSession, programme]);
  const grouped = useMemo(
    () => groupIssues(issues, draft.dismissedIssues),
    [issues, draft.dismissedIssues],
  );

  const nameMissing = target === 'mine' && draft.name[lang].trim() === '';
  const blockers = grouped.blocking.length + (nameMissing && attempted ? 1 : 0);
  const exerciseOf = (issue: Issue): Exercise | undefined => {
    if (!issue.ref) return undefined;
    const block = draft[issue.ref.section][issue.ref.blockIndex];
    const item = block && itemsOf(block)[issue.ref.itemIndex ?? 0];
    return item && exercises.get(item.exerciseId);
  };

  // ---- actions -----------------------------------------------------------

  const atItem = (at: At): ItemAt => ({
    section: at.section,
    blockIndex: at.blockIndex,
    itemIndex: at.itemIndex ?? 0,
  });
  const blockOf = (at: At) => draft[at.section][at.blockIndex];
  const itemOf = (at: At) => {
    const block = blockOf(at);
    return block ? itemsOf(block)[at.itemIndex ?? 0] : undefined;
  };

  const openDose = (at: At) => setDose({ at, openedAt: draft.estimatedMinutes });

  const removeAt = (at: At) => {
    const block = blockOf(at);
    const item = itemOf(at);
    if (!block || !item) return;
    const before = draft;
    const name = nameOf(exercises, item.exerciseId, lang);
    const slot = item.slot ?? '';
    if (block.type === 'group' && at.itemIndex !== undefined) {
      apply((s) => removeItem(s, atItem(at)));
      if (block.items.length === 2) toast.show({ message: t('editor.ungroupedToast') });
      return;
    }
    apply((s) => removeBlock(s, at.section, at.blockIndex));
    const viaTombstone = generated && bySlot(generated).has(slot);
    if (!viaTombstone)
      toast.show({
        message: t('editor.removedToast', { name }),
        action: { label: t('common.undo'), onAction: () => setDraft(before) },
      });
  };

  const pick = (exerciseId: string) => {
    const state = picker;
    setPicker(null);
    const exercise = exercises.get(exerciseId);
    if (!state || !exercise) return;
    const section = state.section;
    if (state.mode === 'add' && !state.at) {
      const leads = section === 'main' && draft.main.length === 0;
      const block = defaultBlock(exercise, section, newSlot(draft), ctx, leads);
      apply((s) => insertBlock(s, { section, index: s[section].length }, block));
      scrollTo.current = blockKey(section, draft[section].length);
      return;
    }
    if (state.mode === 'add' && state.at) {
      const at = state.at;
      const target = blockOf(at);
      if (!target) return;
      if (isSteadyCardio(exercise)) {
        toast.show({ message: t('editor.cardioNotInGroup'), tone: 'error' });
        return;
      }
      const made = defaultBlock(exercise, section, newSlot(draft), ctx, false);
      const item = made.type === 'straight' ? made.item : made.items[0]!;
      apply((s) => addToGroup(s, section, at.blockIndex, item));
      if (target.type === 'group' && target.items.length === 2)
        toast.show({ message: t('editor.circuitToast') });
      return;
    }
    if (state.mode === 'replace' && state.at) {
      const at = state.at;
      const item = itemOf(at);
      const previous = item && exercises.get(item.exerciseId);
      if (!item || !previous || previous.id === exercise.id) return;
      const lead = at.section === 'main' && at.blockIndex === 0 && (at.itemIndex ?? 0) === 0;
      const next = replacementItem(item, previous, exercise, lead, {
        inventory: ctx.inventory,
        level: ctx.profile.level,
        ...(ctx.profile.bodyweightKg !== undefined && { bodyweightKg: ctx.profile.bodyweightKg }),
      });
      apply((s) => replaceItem(s, atItem(at), next));
    }
  };

  const groupNext = (at: At) => {
    const a = blockOf(at);
    const b = draft[at.section][at.blockIndex + 1];
    if (!a || !b) return;
    const rests = groupRests(a, b, ctx.exercises);
    apply((s) =>
      setBlockDose(
        groupWithNext(s, at.section, at.blockIndex, rests.restBetweenItemsSec),
        at.section,
        at.blockIndex,
        { restAfterRoundSec: rests.restAfterRoundSec },
      ),
    );
    // Chained, they run for the larger count: say so when one of them gains sets.
    const count = (x: typeof a) => (x.type === 'straight' ? x.sets : x.rounds);
    if (count(a) !== count(b))
      toast.show({ message: t('editor.groupedRounds', { count: Math.max(count(a), count(b)) }) });
  };

  const ungroupBlock = (section: Section, index: number) => {
    const block = draft[section][index];
    if (!block || block.type !== 'group') return;
    const leadsFirst = section === 'main' && index === 0;
    apply((s) => {
      const split = ungroup(s, section, index);
      return setStraightRests(split, section, index, block.items.length, leadsFirst);
    });
  };

  /** Each exercise split out of a group gets the rest its place calls for. */
  const setStraightRests = (
    session: Session,
    section: Section,
    index: number,
    count: number,
    leadsFirst: boolean,
  ) => {
    let next = session;
    for (let i = 0; i < count; i++) {
      const block = next[section][index + i];
      if (block?.type !== 'straight') continue;
      next = setBlockDose(next, section, index + i, {
        restSec: ungroupedRestFor(block.item, section, leadsFirst && i === 0),
      });
    }
    return next;
  };
  const ungroupedRestFor = (item: SessionItem, section: Section, leads: boolean) =>
    ungroupedRest(item, section, ctx, leads);

  const moveRow = (section: Section, index: number, delta: -1 | 1) => {
    const block = draft[section][index];
    if (!block) return;
    const to = index + delta;
    apply((s) => moveBlockBy(s, { section, index }, delta));
    setMoved(blockKey(section, to));
    const first = itemsOf(block)[0]!;
    const name =
      block.type === 'group'
        ? t(`programme.group.${block.style}`, { count: block.rounds })
        : nameOf(exercises, first.exerciseId, lang);
    setAnnounce(t('editor.reorderMode.moved', { name, n: to + 1, total: draft[section].length }));
  };

  // ---- save --------------------------------------------------------------

  function jumpToFirstProblem() {
    if (nameMissing) {
      nameInput.current?.focus();
      nameInput.current?.scrollIntoView({ block: 'center' });
      return;
    }
    const first = firstBlocking(grouped);
    const root = scroller.current;
    if (!first || !root) return;
    const el = first.ref
      ? root.querySelector<HTMLElement>(
          `[data-block="${blockKey(first.ref.section, first.ref.blockIndex)}"]`,
        )
      : root.querySelector<HTMLElement>('[data-add="main"]');
    el?.scrollIntoView({ block: 'center' });
    el?.focus();
  }

  async function save(after?: () => void) {
    if (nameMissing || grouped.blocking.length > 0) {
      setAttempted(true);
      setLeave(null);
      queueMicrotask(jumpToFirstProblem);
      return;
    }
    setSaving(true);
    try {
      const typed = draft.name[lang].trim();
      const named: Session =
        target === 'mine' ? renameSession(draft, { fr: typed, en: typed }) : draft;
      const final = refreshRampUps(named, isNew ? blankSession() : initial, ctx);
      let message: string;
      let record: { id: string } | undefined;
      if (programmeSession) {
        if (!programme) throw new Error('no programme');
        await repo.saveProgrammeSession(programme.id, final);
        message = letter
          ? t('editor.savedProgramme', { letter })
          : t('editor.savedProgrammeCardio');
      } else if (isNew) {
        const { id: _, ...rest } = final;
        record = await repo.saveCustomSession(rest);
        message = t('editor.created');
      } else {
        await repo.saveCustomSession(final);
        message = t('editor.savedMine');
      }
      clearDraft(target, sessionId);
      flushSync(() => setSaved(true));
      toast.show({ message });
      if (after) after();
      else if (record) navigate({ name: 'mine', sessionId: record.id }, { replace: true });
      else goBack();
    } catch {
      setSaving(false);
      toast.show({ message: t('editor.saveFailed'), tone: 'error' });
    }
  }

  // ---- rendering helpers -------------------------------------------------

  const sectionName = (section: Section) => t(`programme.session.${section}`);

  function issueLines(section: Section, index: number, ids: string) {
    const list = grouped.byBlock.get(blockKey(section, index)) ?? [];
    return list.map((issue, i) => (
      <RowMotion key={`${issue.code}-${issue.ref?.slot ?? ''}-${i}`} gap={8} leave="dismiss">
        <IssueLine
          level={issue.level}
          id={`${ids}-${i}`}
          {...(issue.level === 'warn' && {
            onDismiss: () => apply((s) => dismissIssue(s, issueKey(issue))),
            dismissLabel: t('editor.dismiss'),
          })}
          {...(issue.level === 'block' &&
            actionFor(issue) && {
              action: (
                <Button
                  variant="secondary"
                  className={styles.compactBtn}
                  onClick={() => issueAction(issue)}
                >
                  {t(
                    actionFor(issue) === 'replace'
                      ? 'editor.issue.replace'
                      : actionFor(issue) === 'ungroup'
                        ? 'editor.issue.ungroup'
                        : 'editor.add',
                  )}
                </Button>
              ),
            })}
        >
          {issueText(t, issue, {
            lang,
            inventory: ctx.inventory,
            exercise: exerciseOf(issue),
            exercises,
          })}
        </IssueLine>
      </RowMotion>
    ));
  }

  function issueAction(issue: Issue) {
    const action = actionFor(issue);
    if (action === 'add') setPicker({ mode: 'add', section: 'main' });
    else if (action === 'ungroup' && issue.ref)
      ungroupBlock(issue.ref.section, issue.ref.blockIndex);
    else if (action === 'replace' && issue.ref) {
      const at = {
        section: issue.ref.section,
        blockIndex: issue.ref.blockIndex,
        itemIndex: issue.ref.itemIndex ?? 0,
      };
      setPicker({ mode: 'replace', section: issue.ref.section, at });
    }
  }

  function swapNotes(block: Session['main'][number]) {
    return itemsOf(block).flatMap((item) => {
      const to = swaps.to.get(item.exerciseId);
      if (!to) return [];
      const name = nameOf(exercises, to, lang);
      return [
        <p key={`swap-${item.slot}`} className={styles.swap}>
          <Icon name="swap" size={20} />
          <span>
            <Trans
              i18nKey={
                swaps.painful.has(item.exerciseId)
                  ? 'editor.swapNote.pain'
                  : 'editor.swapNote.choice'
              }
              values={{ name }}
              components={{ b: <b /> }}
            />
          </span>
        </p>,
      ];
    });
  }

  function foot(section: Section, index: number, block: Session['main'][number]) {
    const lines = issueLines(section, index, `issue-${section}-${index}`);
    const notes = swapNotes(block);
    return lines.length + notes.length > 0 ? (
      <>
        <PresenceList>{lines}</PresenceList>
        {notes}
      </>
    ) : undefined;
  }

  const hasBlockIssue = (section: Section, index: number) =>
    (grouped.byBlock.get(blockKey(section, index)) ?? []).some((i) => i.level === 'block');

  function renderBlock(section: Section, index: number) {
    const block = draft[section][index]!;
    const key = blockKey(section, index);
    const number = blockNumber(section, index);
    const bad = hasBlockIssue(section, index);
    const describedBy = bad ? `issue-${section}-${index}-0` : undefined;
    if (block.type === 'straight') {
      const edit =
        block.item.slot && !isRampSlot(block.item.slot) ? edits.get(block.item.slot) : undefined;
      return (
        <StraightCard
          key={block.item.slot ?? key}
          block={block}
          exercises={exercises}
          number={number}
          warm={section === 'warmup'}
          edit={edit}
          bad={bad}
          foot={foot(section, index, block)}
          describedBy={describedBy}
          focusKey={key}
          onOpen={() => openDose({ section, blockIndex: index })}
          onMore={() => setMenu({ section, blockIndex: index })}
        />
      );
    }
    return (
      <GroupCard
        key={block.items[0]?.slot ?? key}
        block={block}
        exercises={exercises}
        number={number}
        bad={bad}
        foot={foot(section, index, block)}
        describedBy={describedBy}
        focusKey={key}
        fresh={settled}
        views={block.items.map((item, itemIndex) => ({
          item,
          edit: item.slot && !isRampSlot(item.slot) ? edits.get(item.slot) : undefined,
          onOpen: () => openDose({ section, blockIndex: index, itemIndex }),
          onMore: () => setMenu({ section, blockIndex: index, itemIndex }),
        }))}
        onOpenGroup={() => setGroupAt({ section, index, openedAt: draft.estimatedMinutes })}
        onMoreGroup={() => setMenu({ section, blockIndex: index })}
        onAdd={() => setPicker({ mode: 'add', section, at: { section, blockIndex: index } })}
      />
    );
  }

  function renderSection(section: Section) {
    const blocks = draft[section];
    const there = tombstonesIn(stones, section);
    const warmIssues = blocks.some(
      (_, i) => (grouped.byBlock.get(blockKey(section, i)) ?? []).length > 0,
    );
    if (
      section === 'warmup' &&
      blocks.length > 0 &&
      !warmOpen &&
      !warmIssues &&
      there.length === 0
    ) {
      const count = blocks.reduce((n, b) => n + itemsOf(b).length, 0);
      const minutes = Math.max(1, Math.round(sectionSeconds(blocks, WARMUP_TRANSITION_SEC) / 60));
      return (
        <button
          key={section}
          type="button"
          className={styles.disclosure}
          aria-expanded={false}
          onClick={() => setWarmOpen(true)}
        >
          <span>
            <strong>{sectionName(section)}</strong>
            <span>{t('programme.session.warmupMeta', { count, minutes })}</span>
          </span>
          <Icon name="chev-down" className={styles.chev} />
        </button>
      );
    }
    const mainEmpty = section === 'main' && blocks.length === 0;
    const rows: React.ReactNode[] = [];
    blocks.forEach((_, i) => {
      for (const stone of there.filter((s) => s.before === i))
        rows.push(
          <RowMotion key={`stone-${stone.slot}`} gap={12}>
            <Tombstone
              name={nameOf(exercises, stone.exerciseId, lang)}
              onPutBack={() => generated && apply((s) => restoreSlot(s, generated, stone.slot))}
            />
          </RowMotion>,
        );
      const card = renderBlock(section, i);
      rows.push(
        <RowMotion key={card.key} gap={12}>
          {card}
        </RowMotion>,
      );
    });
    for (const stone of there.filter((s) => s.before >= blocks.length))
      rows.push(
        <RowMotion key={`stone-${stone.slot}`} gap={12}>
          <Tombstone
            name={nameOf(exercises, stone.exerciseId, lang)}
            onPutBack={() => generated && apply((s) => restoreSlot(s, generated, stone.slot))}
          />
        </RowMotion>,
      );
    return (
      <section key={section} className={styles.section} aria-labelledby={`sec-${section}`}>
        <div className={styles.sectionHead}>
          <div>
            <h2 id={`sec-${section}`} className={styles.sectionTitle}>
              {sectionName(section)}
            </h2>
            <p className={styles.sectionSub}>
              {blocks.length === 0
                ? t(section === 'main' ? 'editor.mainRequired' : 'editor.optional')
                : t('programme.session.blocks', { count: blocks.length })}
            </p>
          </div>
          {section === 'main' && blocks.length > 1 ? (
            <BarButton icon="move" label={t('editor.reorder')} onClick={() => setReorder(true)} />
          ) : null}
        </div>
        {mainEmpty && grouped.mainEmpty ? (
          <p className={styles.sectionError} role="alert">
            <Icon name="alert" size={20} />
            {t('editor.issue.emptyMain')}
          </p>
        ) : null}
        <div className={styles.list}>
          <PresenceList>{rows}</PresenceList>
        </div>
        <AddRow
          section={section}
          sectionName={sectionName(section)}
          bad={mainEmpty && grouped.mainEmpty}
          onClick={() => setPicker({ mode: 'add', section })}
        />
      </section>
    );
  }

  // ---- menus -------------------------------------------------------------

  function menuProps() {
    if (!menu) return { eyebrow: '', title: '', groups: [] as ActionItem[][] };
    const block = blockOf(menu);
    const item = itemOf(menu);
    if (!block || !item) return { eyebrow: '', title: '', groups: [] as ActionItem[][] };
    const { section, blockIndex } = menu;
    const total = draft[section].length;
    const close = () => setMenu(null);
    const run = (fn: () => void) => () => {
      close();
      fn();
    };
    const isGroupHeader = block.type === 'group' && menu.itemIndex === undefined;
    const inGroupItem = block.type === 'group' && menu.itemIndex !== undefined;
    const exercise = exercises.get(item.exerciseId);
    const sectionLabel = sectionName(section);

    const moveItems: ActionItem[] = [];
    if (inGroupItem && block.type === 'group') {
      const i = menu.itemIndex!;
      moveItems.push(
        {
          id: 'up',
          label: t('editor.act.up'),
          icon: 'arrow-up',
          disabled: i === 0,
          onSelect: run(() => apply((s) => moveItem(s, atItem(menu), i - 1))),
        },
        {
          id: 'down',
          label: t('editor.act.down'),
          icon: 'arrow-down',
          disabled: i === block.items.length - 1,
          onSelect: run(() => apply((s) => moveItem(s, atItem(menu), i + 1))),
        },
      );
    } else {
      moveItems.push(
        {
          id: 'up',
          label: t('editor.act.up'),
          ...(blockIndex > 0 && { hint: t('editor.act.position', { n: blockIndex }) }),
          icon: 'arrow-up',
          disabled: blockIndex === 0,
          onSelect: run(() => apply((s) => moveBlockBy(s, { section, index: blockIndex }, -1))),
        },
        {
          id: 'down',
          label: t('editor.act.down'),
          ...(blockIndex < total - 1 && { hint: t('editor.act.position', { n: blockIndex + 2 }) }),
          icon: 'arrow-down',
          disabled: blockIndex === total - 1,
          onSelect: run(() => apply((s) => moveBlockBy(s, { section, index: blockIndex }, 1))),
        },
      );
      for (const other of ['warmup', 'main', 'finisher'] as const)
        if (other !== section)
          moveItems.push({
            id: `to-${other}`,
            label: t(`editor.act.${SECTION_KEYS[other]}`),
            icon: 'flag',
            onSelect: run(() =>
              apply((s) => moveBlockToSection(s, { section, index: blockIndex }, other)),
            ),
          });
    }

    const slot = item.slot ?? '';
    const edit = generated && !isRampSlot(slot) ? edits.get(slot) : undefined;
    const restore: ActionItem[] =
      generated && edit && edit !== 'added'
        ? [
            {
              id: 'restore',
              label: t('editor.act.restore'),
              icon: 'restore',
              onSelect: run(() => apply((s) => resetItem(s, generated, slot))),
            },
          ]
        : [];
    const remove: ActionItem = {
      id: 'remove',
      label: t(isGroupHeader ? 'editor.act.groupRemove' : 'editor.act.remove'),
      hint: t(target === 'mine' ? 'editor.act.removeHintMine' : 'editor.act.removeHint'),
      icon: 'trash',
      danger: true,
      onSelect: run(() => removeAt(menu)),
    };

    if (isGroupHeader && block.type === 'group') {
      const title = t(`programme.group.${block.style}`, { count: block.rounds });
      return {
        eyebrow: t('editor.act.eyebrowGroup', { section: sectionLabel, n: blockIndex + 1 }),
        title,
        groups: [
          [
            {
              id: 'edit',
              label: t('editor.act.groupEdit'),
              icon: 'sliders',
              onSelect: run(() =>
                setGroupAt({ section, index: blockIndex, openedAt: draft.estimatedMinutes }),
              ),
            },
            {
              id: 'add',
              label: t(block.style === 'superset' ? 'editor.addToSuperset' : 'editor.addToCircuit'),
              icon: 'plus',
              onSelect: run(() => setPicker({ mode: 'add', section, at: { section, blockIndex } })),
            },
            {
              id: 'ungroup',
              label: t('editor.act.groupUngroup'),
              icon: 'ungroup',
              onSelect: run(() => ungroupBlock(section, blockIndex)),
            },
          ] satisfies ActionItem[],
          moveItems,
          [
            {
              ...remove,
              hint: t(target === 'mine' ? 'editor.act.removeHintMine' : 'editor.act.removeHint'),
            },
          ],
        ],
      };
    }

    const cardio = item.target.kind === 'cardio' || item.target.kind === 'interval';
    const doseLabel = cardio
      ? 'editor.act.doseCardio'
      : item.target.kind === 'time'
        ? 'editor.act.doseTime'
        : 'editor.act.dose';
    const sets = block.type === 'straight' ? block.sets : block.rounds;
    const rest = block.type === 'straight' ? block.restSec : undefined;
    const next = draft[section][blockIndex + 1];
    const canChain =
      block.type === 'straight' &&
      !!next &&
      next.type === 'straight' &&
      canGroup(block, exercises) &&
      canGroup(next, exercises);
    const nextName =
      next && next.type === 'straight' ? nameOf(exercises, next.item.exerciseId, lang) : '';
    const first: ActionItem[] = [
      {
        id: 'dose',
        label: t(doseLabel),
        hint: doseLine(t, item, sets, rest, exercise, lang),
        icon: 'sliders',
        onSelect: run(() => openDose(menu)),
      },
      {
        id: 'replace',
        label: t('editor.act.replace'),
        hint: t('editor.act.replaceHint'),
        icon: 'swap',
        onSelect: run(() => setPicker({ mode: 'replace', section, at: menu })),
      },
    ];
    if (inGroupItem)
      first.push({
        id: 'leave-group',
        label: t('editor.act.leaveGroup'),
        icon: 'ungroup',
        onSelect: run(() => {
          if (block.type === 'group' && block.items.length === 2)
            toast.show({ message: t('editor.ungroupedToast') });
          apply((s) => takeOutOfGroup(s, atItem(menu), ctx));
        }),
      });
    else if (canChain)
      first.push({
        id: 'group',
        label: t('editor.act.group'),
        hint: t('editor.act.groupHint', { name: nextName }),
        icon: 'group',
        onSelect: run(() => groupNext(menu)),
      });
    return {
      eyebrow: inGroupItem
        ? t('editor.act.eyebrowItem', {
            section: sectionLabel,
            n: blockIndex + 1,
            letter: String.fromCharCode(97 + (menu.itemIndex ?? 0)),
          })
        : t('editor.act.eyebrow', { section: sectionLabel, n: blockIndex + 1, total }),
      title: nameOf(exercises, item.exerciseId, lang),
      groups: [first, moveItems, [...restore, remove]],
    };
  }

  const menuView = menuProps();

  // ---- dose sheet --------------------------------------------------------

  const doseAt = dose?.at;
  const doseItem = doseAt ? itemOf(doseAt) : undefined;
  const doseBlock = doseAt ? blockOf(doseAt) : undefined;
  const doseIssues = (() => {
    if (!doseAt || !doseItem) return undefined;
    const list = (grouped.byBlock.get(blockKey(doseAt.section, doseAt.blockIndex)) ?? []).filter(
      (i) =>
        i.level === 'warn' &&
        (i.code === 'rir-zero-loaded' || i.code === 'rir-beginner') &&
        (i.ref?.itemIndex ?? 0) === (doseAt.itemIndex ?? 0),
    );
    if (list.length === 0) return undefined;
    return list.map((issue) => (
      <IssueLine
        key={issue.code}
        level="warn"
        onDismiss={() => apply((s) => dismissIssue(s, issueKey(issue)))}
        dismissLabel={t('editor.dismiss')}
      >
        {issueText(t, issue, { lang, inventory: ctx.inventory, exercise: undefined, exercises })}
      </IssueLine>
    ));
  })();

  const doseOriginal = (() => {
    if (!generated || !doseItem) return undefined;
    const slot = doseItem.slot ?? '';
    const edit = edits.get(slot);
    if (!edit || edit === 'added' || isRampSlot(slot)) return undefined;
    const was = bySlot(generated).get(slot);
    if (!was) return undefined;
    const sets = was.block.type === 'straight' ? was.block.sets : was.block.rounds;
    const rest = was.block.type === 'straight' ? was.block.restSec : was.block.restAfterRoundSec;
    const { value, unit } = doseNumber(was.item, sets);
    const text =
      edit === 'exercise' ? (
        <Trans
          i18nKey="editor.dose.originalExercise"
          values={{ name: nameOf(exercises, was.item.exerciseId, lang) }}
          components={{ b: <b /> }}
        />
      ) : (
        <Trans
          i18nKey={
            was.item.rir === undefined ? 'editor.dose.originalNoEffort' : 'editor.dose.original'
          }
          values={{
            dose: `${value.replace('×', ' × ')}${unit ? ` ${t(`labels.unit.${unit}`)}` : ''}`,
            effort: was.item.rir === undefined ? '' : effortText(t, was.item.rir),
            sec: rest,
          }}
          components={{ b: <b /> }}
        />
      );
    return { text, onRestore: () => apply((s) => resetItem(s, generated, slot)) };
  })();

  const groupBlock = groupAt ? draft[groupAt.section][groupAt.index] : undefined;

  // ---- meter -------------------------------------------------------------

  const minutes = hasItems(draft) ? draft.estimatedMinutes : null;
  const delta = minutes !== null && budget !== undefined ? minutes - budget : 0;
  const meterKind =
    minutes === null
      ? 'empty'
      : budget === undefined
        ? 'plain'
        : Math.abs(delta) <= 2
          ? 'on'
          : delta > 0
            ? 'over'
            : 'under';
  const meterLine =
    meterKind === 'empty' ? (
      t('editor.meter.empty')
    ) : meterKind === 'plain' ? (
      t('editor.meter.plain')
    ) : meterKind === 'on' ? (
      t('editor.meter.on', { budget })
    ) : (
      <Trans
        i18nKey={`editor.meter.${meterKind}`}
        values={{ n: Math.abs(delta), budget }}
        components={{ b: <b /> }}
      />
    );
  const announcement =
    minutes === null
      ? t('editor.meter.empty')
      : meterKind === 'plain'
        ? t('editor.meter.srPlain', { n: minutes })
        : meterKind === 'on'
          ? t('editor.meter.srOn', { n: minutes, budget })
          : t(meterKind === 'over' ? 'editor.meter.srOver' : 'editor.meter.srUnder', {
              n: minutes,
              delta: Math.abs(delta),
              budget,
            });

  const resetCount = generated
    ? [...itemEdits(draft, generated).keys()].filter((s) => !isRampSlot(s)).length +
      removedSlots(draft, generated).filter((s) => !isRampSlot(s)).length
    : 0;
  const showReset = !!generated && sessionEdited(draft, generated);

  return (
    <>
      <div className={styles.bar}>
        <IconButton icon="close" label={t('editor.close')} onClick={goBack} />
        <div className={styles.barText}>
          <h1 className={styles.barTitle}>
            {reorder
              ? t('editor.reorderMode.title')
              : t(isNew ? 'editor.titleNew' : 'editor.title')}
          </h1>
          {contextLine ? <span className={styles.barMeta}>{contextLine}</span> : null}
        </div>
      </div>
      <DurationMeter
        className={styles.meter}
        minutes={minutes}
        unit={t('labels.unit.min')}
        {...(budget !== undefined && { budget })}
        line={meterLine}
        announcement={announcement}
      />
      <div ref={scroller} className={styles.scroll}>
        {reorder ? (
          <>
            <ReorderView
              draft={draft}
              exercises={exercises}
              lang={lang}
              moved={moved}
              onMove={moveRow}
            />
            <span className={styles.srOnly} role="status" aria-live="polite">
              {announce}
            </span>
          </>
        ) : (
          <>
            {programmeSession ? (
              <p className={styles.note}>
                <Icon name="calendar" size={20} />
                <span>{t('editor.phaseNote')}</span>
              </p>
            ) : null}
            {target === 'mine' && placed ? (
              <p className={styles.note}>
                <Icon name="info" size={20} />
                <span>{t('editor.placedNote')}</span>
              </p>
            ) : null}
            {target === 'mine' ? (
              <NameField
                ref={nameInput}
                label={t('editor.name')}
                value={draft.name[lang]}
                placeholder={t('editor.namePlaceholder')}
                onChange={(value) => {
                  apply((s) => renameSession(s, { fr: value, en: value }));
                }}
                {...(nameMissing && attempted && { error: t('editor.nameError') })}
              />
            ) : null}
            <PresenceList>
              {grouped.session.length > 0 ? (
                <RowMotion key="notes" gap={20} leave="dismiss">
                  <div className={styles.notes}>
                    <PresenceList>
                      {grouped.session.map((issue, i) => (
                        <RowMotion key={`${issue.code}-${i}`} gap={8} leave="dismiss">
                          <IssueLine
                            level={issue.level}
                            onDismiss={() => apply((s) => dismissIssue(s, issueKey(issue)))}
                            dismissLabel={t('editor.dismiss')}
                          >
                            {issueText(t, issue, {
                              lang,
                              inventory: ctx.inventory,
                              exercise: undefined,
                              exercises,
                            })}
                          </IssueLine>
                        </RowMotion>
                      ))}
                    </PresenceList>
                  </div>
                </RowMotion>
              ) : null}
            </PresenceList>
            {(['warmup', 'main', 'finisher'] as const).map(renderSection)}
            {showReset ? (
              <div className={styles.restore}>
                <p>{t('editor.resetAllLine', { count: resetCount })}</p>
                <Button
                  variant="destructive-outline"
                  icon="restore"
                  fullWidth
                  onClick={() => setResetOpen(true)}
                >
                  {t('editor.resetAll')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <Dock>
        {reorder ? (
          <Button size="player" fullWidth onClick={() => setReorder(false)}>
            {t('editor.reorderMode.done')}
          </Button>
        ) : (
          <>
            {blockers > 0 ? (
              <p className={cx(styles.dockNote, styles.dockNoteBad)} role="alert">
                <Icon name="alert" size={20} />
                <span>
                  <Trans i18nKey="editor.issues" count={blockers} components={{ b: <b /> }} />
                  {grouped.shown.some((i) => i.level === 'warn')
                    ? ` ${t('editor.issuesNotes')}`
                    : ''}
                </span>
              </p>
            ) : null}
            <Button
              size="player"
              fullWidth
              icon="check"
              disabled={!dirty}
              loading={saving}
              onClick={() => void save()}
            >
              {t('editor.save')}
            </Button>
          </>
        )}
      </Dock>

      <ActionSheet
        open={menu !== null}
        onClose={() => setMenu(null)}
        eyebrow={menuView.eyebrow}
        title={menuView.title}
        groups={menuView.groups}
        closeLabel={t('common.close')}
      />
      <DoseSheet
        open={dose !== null}
        onClose={() => setDose(null)}
        eyebrow={
          doseAt && doseBlock
            ? doseBlock.type === 'group'
              ? t('editor.dose.eyebrowGroup', {
                  section: sectionName(doseAt.section),
                  n: doseAt.blockIndex + 1,
                  letter: String.fromCharCode(97 + (doseAt.itemIndex ?? 0)),
                })
              : t('editor.dose.eyebrow', {
                  section: sectionName(doseAt.section),
                  n: doseAt.blockIndex + 1,
                })
            : ''
        }
        title={doseItem ? nameOf(exercises, doseItem.exerciseId, lang) : ''}
        at={doseAt ? atItem(doseAt) : null}
        draft={draft}
        exercise={doseItem && exercises.get(doseItem.exerciseId)}
        openedAt={dose?.openedAt ?? draft.estimatedMinutes}
        onItem={(change) => doseAt && apply((s) => setItemDose(s, atItem(doseAt), change))}
        onBlock={(change) =>
          doseAt && apply((s) => setBlockDose(s, doseAt.section, doseAt.blockIndex, change))
        }
        onAdjustGroup={() => {
          if (!doseAt) return;
          setDose(null);
          setGroupAt({
            section: doseAt.section,
            index: doseAt.blockIndex,
            openedAt: draft.estimatedMinutes,
          });
        }}
        issues={doseIssues}
        original={doseOriginal}
      />
      <GroupSheet
        open={groupAt !== null}
        onClose={() => setGroupAt(null)}
        eyebrow={
          groupAt
            ? t('editor.act.eyebrowGroup', {
                section: sectionName(groupAt.section),
                n: groupAt.index + 1,
              })
            : ''
        }
        title={
          groupBlock && groupBlock.type === 'group'
            ? t(`programme.group.${groupBlock.style}`, { count: groupBlock.rounds })
            : ''
        }
        block={groupBlock && groupBlock.type === 'group' ? groupBlock : undefined}
        minutes={draft.estimatedMinutes}
        openedAt={groupAt?.openedAt ?? draft.estimatedMinutes}
        onBlock={(change) =>
          groupAt && apply((s) => setBlockDose(s, groupAt.section, groupAt.index, change))
        }
        onStyle={(style) =>
          groupAt && apply((s) => setGroupStyle(s, groupAt.section, groupAt.index, style))
        }
        onUngroup={() => {
          if (!groupAt) return;
          const { section, index } = groupAt;
          setGroupAt(null);
          ungroupBlock(section, index);
        }}
      />
      <ExercisePicker
        open={picker !== null}
        mode={picker?.mode ?? 'add'}
        section={picker?.section ?? 'main'}
        {...(picker?.mode === 'replace' && picker.at
          ? (() => {
              const item = itemOf(picker.at);
              return item ? { replacing: item.exerciseId } : {};
            })()
          : {})}
        inSession={exerciseIdsOf(draft)}
        onPick={pick}
        onClose={() => setPicker(null)}
      />
      <LeaveSheet
        open={leave !== null}
        onClose={() => setLeave(null)}
        count={changes}
        isNew={isNew}
        programme={programmeSession}
        blocked={blockers}
        saving={saving}
        onSave={() => {
          const proceed = leave;
          void save(() => proceed?.());
        }}
        onDiscard={() => {
          const proceed = leave;
          clearDraft(target, sessionId);
          flushSync(() => setSaved(true));
          setLeave(null);
          proceed?.();
        }}
      />
      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={t('editor.resetDialog.title')}
        description={t('editor.resetDialog.body')}
        confirmLabel={t('editor.resetDialog.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          setResetOpen(false);
          if (generated) setDraft(generated);
          toast.show({ message: t('editor.resetDone') });
        }}
      />
    </>
  );
}
