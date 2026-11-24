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
  Profile,
  Programme,
  Session,
  SessionItem,
} from '@/domain';
import {
  constraintsOf,
  isRampSlot,
  itemKey,
  outCause,
  parseDropped,
  rampSharePct,
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
import { sparedJoint } from '../adapt';
import { notesForItem } from './why';
import { editLine, editSentence, type SessionEdits } from './edits';
import { CardioRow, DeltaTag, Prescription, type ItemAdapt, type WhyRequest } from './Blocks';
import { noteTag, pendingPainFor, swapAnswerFor, type ItemGoals } from './adaptation';
import { LeftOutRow } from './AdaptLines';
import { leftOutPosition } from './limits';
import { leftOutBecause, leftOutTitle } from './why';
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
  prepared: Pick<PreparedSession, 'notes' | 'replaces' | 'proposals'> &
    Partial<Pick<PreparedSession, 'travel' | 'doseCapped'>>;
  /** What the profile avoids: the joint the notes about sparing it name. */
  profile?: Pick<Profile, 'limitations' | 'quiet' | 'smallSpace'> | null;
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
  /** The programme the session belongs to: where a slot that was left out stood. */
  programme?: Pick<Programme, 'rotation' | 'generation'>;
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
  programme,
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

  /** The user's own pick that what they avoid now rules out: kept, with the reason. */
  const keptOutOf = (item: SessionItem): string | undefined => {
    if (!editing || !item.slot || !editing.edits.items.has(item.slot)) return undefined;
    const exercise = exerciseById.get(item.exerciseId);
    const profile = adaptation?.profile;
    if (!exercise || !profile) return undefined;
    const cause = outCause(exercise, constraintsOf(profile));
    if (!cause) return undefined;
    if (cause.cause === 'region')
      return t('why.constraint.keptOutRegion', {
        joint: t(`labels.joint.${cause.region}.your`),
      });
    return t(
      cause.cause === 'quiet' ? 'why.constraint.keptOutQuiet' : 'why.constraint.keptOutSpace',
    );
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
    const away = adaptation.prepared.travel?.substitutions[key];
    // The travel kit's stand-ins have no way back: only the user's own swaps do.
    const original =
      adaptation.prepared.replaces[key] === away ? undefined : adaptation.prepared.replaces[key];
    const capped = adaptation.prepared.doseCapped?.includes(key) === true;
    const joint = sparedJoint(exerciseById.get(item.exerciseId), adaptation.profile);
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
      ...(away && { travelFrom: away }),
      ...(capped && { capped }),
      ...(joint && { joint }),
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
  // Ramp-up sets of the first lift are listed apart from the warm-up drills, and count as one item.
  const isRamp = (block: Session['warmup'][number]) =>
    block.type === 'straight' && isRampSlot(block.item.slot);
  const rampBlocks = session.warmup.filter(isRamp);
  const warmupCount =
    session.warmup
      .filter((b) => !isRamp(b))
      .reduce((sum, block) => sum + itemsOf(block).length, 0) + (rampBlocks.length > 0 ? 1 : 0);
  const leadMain = session.main[0];
  const workingKg =
    leadMain?.type === 'straight' && leadMain.item.load?.kind === 'kg'
      ? leadMain.item.load.kg
      : undefined;
  const finisherIsCardio = session.finisher.length > 0 && session.finisher.every(isCardioBlock);

  /** What this section has no exercise for: slots a joint, quiet or small space left out, and what the kit can't do. */
  const leftOutItems = (section: 'main' | 'finisher') => {
    const rows: { key: string; at: number; icon: IconName; title: string; sub: string }[] = [];
    if (section === 'main')
      for (const note of notes) {
        if (note.code !== 'slot-limited') continue;
        if (note.ref?.sessionId && note.ref.sessionId !== sessionId) continue;
        rows.push({
          key: `slot-${String(note.params.slot)}`,
          at:
            (programme && sessionId
              ? leftOutPosition(programme, sessionId, String(note.params.slot))
              : undefined) ?? Infinity,
          icon: note.params.cause === 'region' ? 'joint' : 'info',
          title: leftOutTitle(t, note.params.patterns, lang),
          sub: leftOutBecause(t, note.params),
        });
      }
    for (const entry of adaptation?.prepared.travel?.dropped ?? []) {
      const dropped = parseDropped(entry);
      if (!dropped || !dropped.itemKey.startsWith(`${section}/`)) continue;
      rows.push({
        key: `kit-${entry}`,
        // Where it stood in the plan before the kit: its block index.
        at: Number(dropped.itemKey.split('/')[1]),
        icon: 'suitcase',
        title: exerciseName(dropped.exerciseId, lang),
        sub: t('programme.kit.droppedRow'),
      });
    }
    return rows.map((row) => ({
      at: row.at,
      node: (
        <div key={row.key} className={styles.leftOutItem}>
          <LeftOutRow icon={row.icon} title={row.title} sub={row.sub} />
        </div>
      ),
    }));
  };

  /** The section's blocks, with each left-out row at the place its slot stood. */
  const renderBlocks = (section: 'main' | 'finisher') => {
    const rows = leftOutItems(section);
    const out: ReactNode[] = [];
    const blocks = renderBlockList(section);
    blocks.forEach((block, i) => {
      for (const row of rows) if (Math.min(row.at, blocks.length) === i) out.push(row.node);
      out.push(block);
    });
    if (blocks.length === 0) for (const row of rows) out.push(row.node);
    else for (const row of rows) if (row.at >= blocks.length) out.push(row.node);
    return out;
  };

  const renderBlockList = (section: 'main' | 'finisher') =>
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
            keptOut={keptOutOf(block.item)}
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
            keptOut={keptOutOf(block.item)}
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
                keptOut={keptOutOf(item)}
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
                isRamp(block)
                  ? []
                  : itemsOf(block).map((item, itemIndex) => {
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
              {rampBlocks.length > 0 ? (
                <div className={styles.ramp}>
                  <p className={styles.rampTitle}>
                    {t('programme.session.rampTitle', { count: rampBlocks.length })}
                  </p>
                  {rampBlocks.map((block, i) => {
                    if (block.type !== 'straight') return null;
                    const { item } = block;
                    const kg = item.load?.kind === 'kg' ? item.load.kg : undefined;
                    const meta = [
                      kg !== undefined
                        ? `${formatNumber(kg, lang)}\u00A0${t('labels.unit.kg')}`
                        : '',
                      kg !== undefined && workingKg !== undefined
                        ? t('programme.session.rampShare', {
                            pct: rampSharePct(kg, workingKg),
                            kg: formatNumber(workingKg, lang),
                          })
                        : '',
                      `${t('programme.rx.rest').toLocaleLowerCase(lang)} ${block.restSec} ${t('labels.unit.s')}`,
                    ].filter(Boolean);
                    return (
                      <div key={item.slot ?? i} className={styles.wu}>
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
                        <span className={styles.wuRx}>{warmupDose(item, 1, t)}</span>
                        <span className={styles.wuMeta}>{meta.join(', ')}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
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
      ) : leftOutItems('finisher').length > 0 ? (
        <section className={styles.section}>{renderBlocks('finisher')}</section>
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
