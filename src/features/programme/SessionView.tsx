import type { TFunction } from 'i18next';
import { useState, type ReactNode } from 'react';
import { Collapse } from '@/motion';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { equipmentInUse } from '@/features/figure';
import { HowToSheet } from '@/features/howto';
import type {
  Answer,
  EquipmentInventory,
  GenerationNote,
  Language,
  Session,
  SessionItem,
} from '@/domain';
import {
  itemKey,
  sessionSeconds,
  type PreparedSession,
  type Proposal,
  type WeekPlan,
} from '@/engine';
import { Icon, type IconName } from '@/ui/components';
import {
  blockDelta,
  EQUIPMENT_ICON,
  exerciseCount,
  exerciseName,
  formatNumber,
  isCardioBlock,
  itemsOf,
  range,
  sessionEquipment,
  type SessionIdentity,
} from './format';
import { notesForItem } from './why';
import { editLine, editSentence, type SessionEdits } from './edits';
import { CardioRow, DeltaTag, Prescription, type ItemAdapt, type WhyRequest } from './Blocks';
import { noteTag, pendingPainFor, swapAnswerFor, type ItemGoals } from './adaptation';
import { effortText } from './effort';
import { WhySheet } from './WhySheet';
import styles from './SessionView.module.css';

/** The user's changes to a programme session, for the edit lines. */
export interface SessionEditing {
  /** The stored session (without the week's adjustments), which the edits are measured on. */
  stored: Session;
  edits: SessionEdits;
  /** The user has trained this exercise before. */
  history: (exerciseId: string) => boolean;
}

/** What progression did to the session: the why of each exercise, swaps, pain waiting, set goals. */
export interface SessionAdaptation {
  prepared: Pick<PreparedSession, 'notes' | 'replaces' | 'proposals'>;
  goals: Record<string, ItemGoals>;
  answers: readonly Answer[];
  onSwitchBack: (originalId: string) => void;
  onChoose: (proposal: Proposal) => void;
}

export interface SessionViewProps {
  /** The session as it runs: week adjustments already applied. */
  session: Session;
  /** Generation notes of the programme (or of the quick session) the session belongs to. */
  notes: readonly GenerationNote[];
  /** `programme`: part of a rotation. `quick`: a one-off session, no week and no progression. */
  mode: 'programme' | 'quick';
  /** Letter, title and kind of session; see `sessionIdentity`. */
  identity: SessionIdentity;
  /** Owned equipment, used to name the setup each exercise runs on. */
  inventory?: EquipmentInventory;
  /** The same session one week earlier: blocks that changed get a tag. */
  previous?: Session;
  /** First- and last-set effort of the week (`WeekPlan.setRir`). */
  setRir?: WeekPlan['setRir'];
  /** Notices under the hero stats (longer than usual, not the next session…). */
  notices?: ReactNode;
  /** Slot between the hero and the sections: the week ruler. */
  ruler?: ReactNode;
  /** Progression applied to `session`; absent for quick sessions. */
  adaptation?: SessionAdaptation;
  /** Set when the user edited the session: edited rows say so, notes follow their slots. */
  editing?: SessionEditing;
  /** Replaces the kicker above the title ("My session"). */
  kickerLabel?: string;
  /** Glyph of the hero tile when the session has no letter (the user's own: bookmark). */
  heroIcon?: IconName;
  /** The week's max test as a section: right after the warm-up, or at the end of the session. */
  testAfterWarmup?: ReactNode;
  testAtEnd?: ReactNode;
  /** Changes when the content is replaced in place (another week, a shuffle): the sections fade in. */
  contentKey?: string | number;
}

/**
 * Read-only rendering of a session: hero, warm-up, main work and finisher, with a "why"
 * button on every exercise. Reused by the quick-session screen.
 */
export function SessionView({
  session,
  notes,
  mode,
  identity,
  inventory,
  previous,
  setRir,
  notices,
  ruler,
  adaptation,
  editing,
  kickerLabel,
  heroIcon,
  testAfterWarmup,
  testAtEnd,
  contentKey = 0,
}: SessionViewProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const [why, setWhy] = useState<WhyRequest | null>(null);
  const [howTo, setHowTo] = useState<{ id: string; open: boolean } | null>(null);
  const openHowTo = (id: string) => setHowTo({ id, open: true });
  const [warmupOpen, setWarmupOpen] = useState(false);
  // Replayed only after the first replacement, so opening a session adds nothing to the screen entrance.
  const [seenKey, setSeenKey] = useState(contentKey);
  const [replaced, setReplaced] = useState(false);
  if (seenKey !== contentKey) {
    setSeenKey(contentKey);
    setReplaced(true);
  }
  const swap = replaced ? styles.swap : undefined;
  const kinds = sessionEquipment(session, inventory);
  const count = exerciseCount(session);
  const sessionId = mode === 'programme' ? session.id : undefined;

  /** Generation notes of one item; by slot once the session was edited. */
  const notesOf = (
    section: 'warmup' | 'main' | 'finisher',
    blockIndex: number,
    item: SessionItem,
    itemIndex?: number,
  ) =>
    notesForItem(
      notes,
      {
        ...(sessionId ? { sessionId } : {}),
        section,
        blockIndex,
        ...(itemIndex === undefined ? {} : { itemIndex }),
        ...(item.slot ? { slot: item.slot } : {}),
      },
      item.exerciseId,
      editing?.edits.generated,
    );

  /** "Edited by you …" for an edited or added item, nothing otherwise. */
  const editOf = (item: SessionItem): string | undefined => {
    if (!editing || !item.slot || !editing.edits.items.has(item.slot)) return undefined;
    const line = editLine(editing.stored, editing.edits.generated, item.slot, editing.history);
    return line ? editSentence(t, line, (id) => exerciseName(id, lang)) : undefined;
  };

  const adaptFor = (
    section: 'main' | 'finisher',
    blockIndex: number,
    itemIndex: number,
    item: SessionItem,
  ): ItemAdapt | undefined => {
    if (!adaptation) return undefined;
    const key = itemKey(section, blockIndex, itemIndex);
    const note = adaptation.prepared.notes[key];
    const original = adaptation.prepared.replaces[key];
    const tag = noteTag(
      t,
      lang,
      note,
      item,
      exerciseById.get(item.exerciseId)?.loadType === 'band-assisted',
    );
    const pain = pendingPainFor(note, adaptation.prepared.proposals, item.exerciseId);
    const goals = adaptation.goals[key];
    return {
      ...(note && { note }),
      ...(goals && { goals }),
      ...(tag && { tag }),
      ...(pain && { pain }),
      ...(original && {
        replaces: { id: original, answer: swapAnswerFor(adaptation.answers, original) },
      }),
      onSwitchBack: adaptation.onSwitchBack,
      onChoose: adaptation.onChoose,
    } as ItemAdapt;
  };

  const ask = (
    section: 'warmup' | 'main' | 'finisher',
    blockIndex: number,
    item: SessionItem,
    itemIndex?: number,
  ) =>
    setWhy({
      exerciseId: item.exerciseId,
      notes: notesOf(section, blockIndex, item, itemIndex),
      first:
        mode === 'programme' &&
        section === 'main' &&
        blockIndex === 0 &&
        !isCardioBlock(session.main[0]!),
    });

  const kicker =
    kickerLabel ??
    (identity.cardio
      ? t('programme.session.cardioDay')
      : mode === 'quick'
        ? t('programme.session.quick')
        : null);
  const long = identity.title.length > 14;

  let number = 0;
  const warmupMinutes = Math.round(
    sessionSeconds({ warmup: session.warmup, main: [], finisher: [] }) / 60,
  );
  const warmupCount = session.warmup.reduce((sum, block) => sum + itemsOf(block).length, 0);
  const finisherIsCardio = session.finisher.length > 0 && session.finisher.every(isCardioBlock);

  const renderBlocks = (section: 'main' | 'finisher') =>
    session[section].map((block, blockIndex) => {
      const delta = blockDelta(previous?.[section][blockIndex], block);
      const first = blockIndex === 0;
      if (block.type === 'straight') {
        const cardio = isCardioBlock(block);
        const label = !cardio && section === 'main' ? String(++number) : '';
        const itemNotes = notesOf(section, blockIndex, block.item);
        return cardio ? (
          <CardioRow
            key={blockIndex}
            item={block.item}
            label={label}
            first={first}
            big={identity.cardio && section === 'main'}
            delta={delta}
            notes={itemNotes}
            edit={editOf(block.item)}
            {...optional(adaptFor(section, blockIndex, 0, block.item))}
            onWhy={() => ask(section, blockIndex, block.item)}
            onHowTo={() => openHowTo(block.item.exerciseId)}
          />
        ) : (
          <Prescription
            key={blockIndex}
            item={block.item}
            label={label}
            first={first}
            sets={block.sets}
            restSec={block.restSec}
            delta={delta}
            notes={itemNotes}
            edit={editOf(block.item)}
            {...(section === 'main' && setRir?.first !== undefined
              ? { firstSetRir: setRir.first }
              : {})}
            {...(section === 'main' && setRir?.last !== undefined
              ? { lastSetRir: setRir.last }
              : {})}
            {...optional(adaptFor(section, blockIndex, 0, block.item))}
            onWhy={() => ask(section, blockIndex, block.item)}
            onHowTo={() => openHowTo(block.item.exerciseId)}
          />
        );
      }
      const index = section === 'main' ? ++number : null;
      const letters = block.items.map((_, i) => String.fromCharCode(97 + i));
      const items = new Intl.ListFormat(lang, { type: 'conjunction' }).format(letters);
      const efforts = new Set(block.items.map((item) => item.rir));
      const shared = efforts.size === 1 ? [...efforts][0] : undefined;
      const rule = [
        block.style === 'superset'
          ? t('programme.group.ruleSuperset', { items, rest: block.restAfterRoundSec })
          : t('programme.group.ruleCircuit', {
              count: block.items.length,
              rest: block.restAfterRoundSec,
            }),
        shared === undefined ? '' : `${effortText(t, shared)}.`,
      ]
        .filter(Boolean)
        .join(' ');
      return (
        <section key={blockIndex} className={`${styles.grp} ${first ? styles.grpFirst : ''}`}>
          <span className={`${styles.num} ${styles.rxIdx}`}>{index ?? ''}</span>
          <div className={styles.grpHead}>
            <h3 className={styles.grpTitle}>
              {t(`programme.group.${block.style}`, { count: block.rounds })}
              <DeltaTag delta={delta} />
            </h3>
            <p className={styles.grpMeta}>{rule}</p>
          </div>
          <div className={styles.grpItems}>
            {block.items.map((item, itemIndex) => (
              <Prescription
                key={itemIndex}
                item={item}
                label={letters[itemIndex] ?? ''}
                first={itemIndex === 0}
                sets={block.rounds}
                notes={notesOf(section, blockIndex, item, itemIndex)}
                edit={editOf(item)}
                {...optional(adaptFor(section, blockIndex, itemIndex, item))}
                onWhy={() => ask(section, blockIndex, item, itemIndex)}
                onHowTo={() => openHowTo(item.exerciseId)}
              />
            ))}
          </div>
        </section>
      );
    });

  return (
    <div className={styles.root}>
      <section className={styles.head}>
        <div className={styles.id}>
          {identity.letter ? (
            <span className={`${styles.num} ${styles.letter}`} aria-hidden="true">
              {identity.letter}
            </span>
          ) : (
            <span className={styles.letterIcon} aria-hidden="true">
              <Icon name={heroIcon ?? (identity.cardio ? 'heart' : 'bolt')} size={28} />
            </span>
          )}
          <div className={styles.idText}>
            {kicker ? <span className={styles.kicker}>{kicker}</span> : null}
            {identity.letter ? (
              <span className={styles.srOnly}>
                {t('programme.session.letterName', { letter: identity.letter })}
              </span>
            ) : null}
            <h1 className={`${styles.display} ${long ? styles.displayLong : ''}`}>
              {identity.title}
            </h1>
            {session.focus ? <p className={styles.sub}>{session.focus[lang]}</p> : null}
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.num}>
              ~{session.estimatedMinutes}
              <small>{t('labels.unit.min')}</small>
            </span>
            <span className={styles.statLabel}>{t('programme.session.estimated')}</span>
          </div>
          {count > 0 ? (
            <div className={styles.stat}>
              <span className={styles.num}>{count}</span>
              <span className={styles.statLabel}>
                {t('programme.session.exercises', { count })}
              </span>
            </div>
          ) : null}
        </div>
        {notices}
        {kinds.length > 0 ? (
          <ul className={styles.gear} aria-label={t('programme.session.equipment')}>
            {kinds.map((kind) => (
              <li key={kind}>
                <Icon name={EQUIPMENT_ICON[kind] ?? 'dumbbell'} size={20} />
                {t(`labels.equipment.${kind}`)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {ruler}

      {session.warmup.length > 0 ? (
        <section className={styles.section}>
          <button
            type="button"
            className={styles.disc}
            aria-expanded={warmupOpen}
            aria-controls="warmup-body"
            onClick={() => setWarmupOpen((open) => !open)}
          >
            <span className={styles.discText}>
              <span className={styles.discTitle}>{t('programme.session.warmup')}</span>
              <span className={styles.discMeta}>
                {t('programme.session.warmupMeta', {
                  count: warmupCount,
                  minutes: Math.max(1, warmupMinutes),
                })}
              </span>
            </span>
            <span className={styles.discChev}>
              <Icon name="chev-down" />
            </span>
          </button>
          <Collapse open={warmupOpen} id="warmup-body" className={styles.discCollapse}>
            <div className={styles.discBody}>
              {session.warmup.flatMap((block, blockIndex) =>
                itemsOf(block).map((item, itemIndex) => {
                  const sets = block.type === 'straight' ? block.sets : block.rounds;
                  const rest = block.type === 'straight' && sets > 1 ? block.restSec : 0;
                  return (
                    <div key={`${blockIndex}-${itemIndex}`} className={styles.wu}>
                      <button
                        type="button"
                        className={`${styles.wuName} ${styles.wuOpen}`}
                        data-howto={item.exerciseId}
                        aria-label={t('play.figure.open', {
                          name: exerciseName(item.exerciseId, lang),
                        })}
                        onClick={() => openHowTo(item.exerciseId)}
                      >
                        {exerciseName(item.exerciseId, lang)}
                      </button>
                      <span className={styles.wuRx}>{warmupDose(item, sets, t)}</span>
                      <WarmupMeta item={item} rest={rest} />
                    </div>
                  );
                }),
              )}
            </div>
          </Collapse>
        </section>
      ) : null}

      {testAfterWarmup}

      <section key={`main-${contentKey}`} className={`${styles.section} ${swap ?? ''}`}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{t('programme.session.main')}</h2>
          <span className={styles.sectionMeta}>
            {t('programme.session.blocks', { count: session.main.length })}
          </span>
        </div>
        {renderBlocks('main')}
      </section>

      {session.finisher.length > 0 ? (
        <section key={`finisher-${contentKey}`} className={`${styles.section} ${swap ?? ''}`}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t('programme.session.finisher')}</h2>
            {finisherIsCardio ? (
              <span className={styles.sectionMeta}>{t('programme.session.cardio')}</span>
            ) : null}
          </div>
          {renderBlocks('finisher')}
        </section>
      ) : null}

      {testAtEnd}

      <WhySheet request={why} onClose={() => setWhy(null)} />
      <HowToSheet
        open={howTo?.open ?? false}
        onClose={() => setHowTo((h) => (h ? { ...h, open: false } : h))}
        exerciseId={howTo?.id ?? ''}
        equipment={equipmentInUse(exerciseById.get(howTo?.id ?? ''), inventory)}
      />
    </div>
  );
}

const optional = (adapt: ItemAdapt | undefined) => (adapt ? { adapt } : {});

function warmupDose(item: SessionItem, sets: number, t: TFunction): string {
  const target = item.target;
  const prefix = sets > 1 ? `${sets} × ` : '';
  if (target.kind === 'time')
    return `${prefix}${range(target.minSec, target.maxSec)} ${t('labels.unit.s')}`;
  if (target.kind === 'reps')
    return sets > 1
      ? `${sets} × ${range(target.min, target.max)}`
      : `${range(target.min, target.max)} ${t('labels.unit.reps')}`;
  if (target.kind === 'max') return `${prefix}max`;
  return '';
}

function WarmupMeta({ item, rest }: { item: SessionItem; rest: number }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const parts: string[] = [];
  if (item.load?.kind === 'kg')
    parts.push(`${formatNumber(item.load.kg, lang)} ${t('labels.unit.kg')}`);
  if (item.load?.kind === 'band') parts.push(t(`labels.bandLoad.${item.load.level}`));
  if (item.tempo)
    parts.push(
      `${t('programme.rx.tempo')} ${item.tempo.down}-${item.tempo.pause}-${item.tempo.up}`,
    );
  if (rest > 0)
    parts.push(`${t('programme.rx.rest').toLocaleLowerCase(lang)} ${rest} ${t('labels.unit.s')}`);
  return parts.length > 0 ? <span className={styles.wuMeta}>{parts.join(', ')}</span> : null;
}
