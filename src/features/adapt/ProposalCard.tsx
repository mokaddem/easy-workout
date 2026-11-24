import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { Swap } from '@/motion';
import type { Answer, Language } from '@/domain';
import { jointName } from '@/features/settings/constraints/joints';
import type { Proposal } from '@/engine';
import { answerProposal, undoAnswer } from '@/app/progress';
import { glyphOf } from '@/features/play/format';
import { Button, Card, Icon, type IconName } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { LimitationRow, type Limited } from './LimitationRow';
import { Rich } from './Rich';
import {
  bandWord,
  capFirst,
  exerciseName,
  loadText,
  parseToken,
  repsText,
  secondsText,
} from './format';
import styles from './ProposalCard.module.css';

/** What the card can say about the session that raised the proposal. Everything is optional. */
export interface ProposalFacts {
  /** Sets done / planned in that session (pain, no equipment). */
  done?: number;
  total?: number;
  /** Load token the pain came back at: "even at 8 kg". */
  atLoad?: string;
  /** What "keep it as it is" keeps: load token and goal. */
  keepLoad?: string;
  keepGoal?: number;
  /** Harder: sets × reps reached past the range. */
  sets?: number;
  reps?: number;
  /** Bottom of the range (easier: the reps missed; harder / swaps: the goal to start). */
  min?: number;
  /** Goal the exercise stays at ("not now"); assisted: the goal to reach. */
  goal?: number;
  /** Assisted: the band the substitute starts with, as a token (`band:medium`). */
  band?: string;
  /** What distinguishes the substitute: "assis", "with a chair" (already localized). */
  difference?: string;
  /** Session letter for the confirmed swap: "A". */
  sessionLetter?: string;
  /** Add "In your next session." to the question line. */
  inNextSession?: boolean;
  /** Timed exercise: goals and minimums are seconds. */
  time?: boolean;
}

export interface ProposalCardProps {
  proposal: Proposal;
  facts?: ProposalFacts;
  /** `flat` drops the chrome inside a sheet. */
  variant?: 'card' | 'flat';
  onAnswered?: (answer: Answer) => void;
  onUndone?: () => void;
}

type Choice = Answer['answer'];

interface Row {
  choice: Choice;
  icon: IconName;
  title: string;
  sub: string;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const numOf = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

export function ProposalCard({
  proposal,
  facts = {},
  variant = 'card',
  onAnswered,
  onUndone,
}: ProposalCardProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language.startsWith('fr') ? 'fr' : 'en') as Language;
  const nameId = useId();
  const [answered, setAnswered] = useState<{ answer: Answer; choice: Choice } | undefined>();
  const [busy, setBusy] = useState(false);
  /** The user added the joint to the limitations instead of answering with one of the rows. */
  const [limited, setLimited] = useState<Limited | undefined>();

  const { kind, exerciseId } = proposal;
  const exercise = exerciseById.get(exerciseId);
  const name = exerciseName(exerciseId, lang);
  const substitute = proposal.substituteId ? exerciseName(proposal.substituteId, lang) : undefined;
  const amount = (n: number) => (facts.time ? secondsText(n, lang) : repsText(t, n));

  const lighterParams = proposal.lighter?.params ?? {};
  const fromTok = str(lighterParams.from);
  const toTok = str(lighterParams.to);
  const lighterGoal = numOf(lighterParams.goal);
  const fromParsed = parseToken(fromTok);
  const toParsed = parseToken(toTok);
  const loadChanged = !!toParsed && toParsed.kind !== 'bw' && !!fromParsed && fromTok !== toTok;
  const keepToken = facts.keepLoad ?? fromTok;
  const keepParsed = parseToken(keepToken);
  const hasKeepLoad = !!keepParsed && keepParsed.kind !== 'bw';

  const shown = (tok: string | undefined) =>
    parseToken(tok)?.kind === 'band' ? bandFor(tok) : loadText(t, lang, tok);
  const bandFor = (tok: string | undefined) => {
    const p = parseToken(tok);
    return p?.kind === 'band' ? bandWord(t, lang, p.level) : '';
  };

  /* ---------------------------------------------------------------- copy */
  const swapRow = (): Row | undefined => {
    if (!substitute) return undefined;
    const title = t(
      kind === 'no-equipment' ? 'adapt.card.swap.titleForGood' : 'adapt.card.swap.title',
      {
        name: substitute,
      },
    );
    let sub: string;
    if (kind === 'pain')
      sub = facts.difference
        ? t('adapt.card.swap.sub', { difference: facts.difference })
        : t('adapt.card.swap.subPlain');
    else if (kind === 'no-equipment')
      sub = facts.difference
        ? t('adapt.card.swap.subDifference', { difference: capFirst(facts.difference, lang) })
        : t('adapt.card.swap.subPlain');
    else if (kind === 'harder')
      sub =
        facts.min !== undefined
          ? t('adapt.card.swap.subHarder', { min: amount(facts.min) })
          : t('adapt.card.swap.subPlain');
    else if (kind === 'easier') sub = t('adapt.card.swap.subEasier');
    else
      sub = facts.band
        ? t('adapt.card.swap.subAssisted', { band: bandFor(facts.band) })
        : t('adapt.card.swap.subPlain');
    return { choice: 'swap', icon: 'swap', title, sub };
  };

  const lighterRow = (): Row => {
    if (loadChanged && toParsed?.kind === 'band')
      return {
        choice: 'lighter',
        icon: 'arrow-down',
        title: t('adapt.card.lighter.title'),
        sub: t('adapt.card.lighter.subBand', { band: bandFor(toTok), from: bandFor(fromTok) }),
      };
    if (loadChanged)
      return {
        choice: 'lighter',
        icon: 'arrow-down',
        title: t('adapt.card.lighter.title'),
        sub: t('adapt.card.lighter.sub', {
          to: loadText(t, lang, toTok),
          from: loadText(t, lang, fromTok),
        }),
      };
    if (lighterGoal !== undefined && toParsed && toParsed.kind !== 'bw')
      return {
        choice: 'lighter',
        icon: 'arrow-down',
        title: t('adapt.card.lighter.title'),
        sub: t('adapt.card.lighter.subGoal', { goal: amount(lighterGoal) }),
      };
    return {
      choice: 'lighter',
      icon: 'arrow-down',
      title: t('adapt.card.lighter.titleEasy'),
      sub: t('adapt.card.lighter.subEasy'),
    };
  };

  const keepRow = (): Row => ({
    choice: 'keep',
    icon: 'equals',
    title: t('adapt.card.keep.title'),
    sub:
      hasKeepLoad && facts.keepGoal !== undefined
        ? t('adapt.card.keep.sub', {
            load: loadText(t, lang, keepToken),
            goal: amount(facts.keepGoal),
          })
        : hasKeepLoad
          ? t('adapt.card.keep.subLoad', { load: loadText(t, lang, keepToken) })
          : t('adapt.card.keep.subPlain'),
  });

  const rows: Row[] = [];
  const swap = swapRow();
  if (kind === 'pain') {
    if (swap) rows.push(swap);
    rows.push(lighterRow());
    if (!proposal.repeated) rows.push(keepRow());
  } else if (kind === 'no-equipment') {
    rows.push({
      choice: 'one-off',
      icon: 'equals',
      title: t('adapt.card.oneOff.title'),
      sub: t('adapt.card.oneOff.sub'),
    });
    if (swap) rows.push(swap);
  } else {
    if (swap) rows.push(swap);
    rows.push({
      choice: 'dismiss',
      icon: 'clock',
      title: t('adapt.card.notNow.title'),
      sub:
        kind === 'harder' && facts.goal !== undefined
          ? t('adapt.card.notNow.subHarder', { goal: amount(facts.goal) })
          : t('adapt.card.notNow.sub'),
    });
  }

  const kicker = (): string => {
    const total = facts.total;
    const done = facts.done;
    const question = (key: 'next' | 'harder' | 'easier') => t(`adapt.card.question.${key}`);
    let line: string;
    if (kind === 'pain') {
      if (done !== undefined && total !== undefined)
        line = proposal.repeated
          ? t('adapt.card.kicker.painAgain', {
              count: done,
              total,
              evenAt: facts.atLoad
                ? t('adapt.card.kicker.evenAt', { load: loadText(t, lang, facts.atLoad) })
                : '',
            })
          : t('adapt.card.kicker.pain', { count: done, total });
      else line = `${t('adapt.summary.done.pain')}.`;
      line += ` ${question('next')}`;
    } else if (kind === 'no-equipment') {
      line =
        done !== undefined && total !== undefined
          ? t('adapt.card.kicker.noEquipment', { count: done, total })
          : t('adapt.card.kicker.generic');
      line += ` ${question('next')}`;
    } else if (kind === 'harder') {
      line =
        facts.sets !== undefined && facts.reps !== undefined
          ? t('adapt.card.kicker.harder', { summary: `${facts.sets} × ${amount(facts.reps)}` })
          : t('adapt.card.kicker.generic');
      line += ` ${question('harder')}`;
    } else if (kind === 'easier') {
      line =
        facts.min !== undefined
          ? t('adapt.card.kicker.easier', { min: amount(facts.min) })
          : t('adapt.card.kicker.generic');
      line += ` ${question('easier')}`;
    } else {
      line =
        facts.reps !== undefined && facts.goal !== undefined
          ? t('adapt.card.kicker.assisted', { reps: amount(facts.reps), goal: facts.goal })
          : t('adapt.card.kicker.generic');
    }
    if (facts.inNextSession) line += ` ${t('adapt.card.inNext')}`;
    return line;
  };

  const confirmedCopy = (choice: Choice): { title: string; sub: string } => {
    switch (choice) {
      case 'swap':
        return {
          title: t(
            kind === 'no-equipment' ? 'adapt.card.swap.titleForGood' : 'adapt.card.swap.title',
            { name: substitute ?? '' },
          ),
          sub: t('adapt.card.confirmed.swapSub', {
            old: name,
            from: facts.sessionLetter
              ? t('adapt.card.confirmed.swapFrom', { letter: facts.sessionLetter })
              : '',
          }),
        };
      case 'lighter':
        return {
          title: t('adapt.card.confirmed.lighterTitle'),
          sub:
            loadChanged || (toParsed && toParsed.kind !== 'bw')
              ? t('adapt.card.confirmed.lighterSub', { name, to: loadText(t, lang, toTok) })
              : t('adapt.card.confirmed.lighterSubPlain', { name }),
        };
      case 'keep':
        return {
          title: t('adapt.card.confirmed.keepTitle'),
          sub:
            hasKeepLoad && facts.keepGoal !== undefined
              ? t('adapt.card.confirmed.keepSub', {
                  name,
                  load: loadText(t, lang, keepToken),
                  goal: amount(facts.keepGoal),
                })
              : t('adapt.card.confirmed.keepSubPlain', { name }),
        };
      case 'one-off':
        return {
          title: t('adapt.card.oneOff.title'),
          sub: t('adapt.card.confirmed.oneOffSub', { name }),
        };
      default:
        return {
          title: t('adapt.card.notNow.title'),
          sub:
            kind === 'harder' && facts.goal !== undefined
              ? t('adapt.card.confirmed.notNowHarder', { name, goal: amount(facts.goal) })
              : t('adapt.card.confirmed.notNowOther', { name }),
        };
    }
  };

  /* ---------------------------------------------------------------- actions */
  const choose = async (choice: Choice) => {
    if (busy) return;
    setBusy(true);
    try {
      const answer = await answerProposal(proposal, choice);
      setAnswered({ answer, choice });
      onAnswered?.(answer);
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (limited && !busy) {
      setBusy(true);
      try {
        await limited.undo();
        setLimited(undefined);
        onUndone?.();
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!answered || busy) return;
    setBusy(true);
    try {
      await undoAnswer(answered.answer);
      setAnswered(undefined);
      onUndone?.();
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- render */
  const wellIcon: IconName =
    kind === 'pain'
      ? 'stop'
      : kind === 'no-equipment'
        ? glyphOf(exercise)
        : kind === 'harder'
          ? 'step-up'
          : kind === 'easier'
            ? 'step-down'
            : 'band';

  const done = answered !== undefined || limited !== undefined;
  const wrap = (children: ReactNode) =>
    variant === 'card' ? (
      <Card as="article" className={styles.pc} aria-labelledby={nameId}>
        <Swap
          id={done ? 'confirmed' : 'asking'}
          innerClassName={done ? cx(styles.body, styles.bodyDone) : styles.body}
        >
          {children}
        </Swap>
      </Card>
    ) : (
      <article className={styles.flat} aria-labelledby={nameId}>
        <Swap
          id={done ? 'confirmed' : 'asking'}
          innerClassName={done ? cx(styles.body, styles.bodyDone) : styles.body}
        >
          {children}
        </Swap>
      </article>
    );

  if (limited || answered) {
    const copy = limited
      ? {
          title: t('adapt.card.confirmed.limitTitle', {
            joint: jointName(t, limited.region, 'your'),
          }),
          sub: t(
            limited.substitute
              ? 'adapt.card.confirmed.limitSwap'
              : limited.removes
                ? 'adapt.card.confirmed.limitRemoved'
                : 'adapt.card.confirmed.limitStays',
            {
              count: limited.others,
              name: limited.substitute ? exerciseName(limited.substitute, lang) : '',
            },
          ),
        }
      : confirmedCopy(answered!.choice);
    return wrap(
      <>
        <h3 id={nameId} hidden>
          {name}
        </h3>
        <div className={styles.confirmed} role="status">
          <span className={cx(styles.well, styles.wellDone)}>
            <Icon name="check" size={28} />
          </span>
          <div className={styles.confirmedText}>
            <p className={styles.confirmedTitle}>{copy.title}</p>
            <p className={styles.confirmedSub}>
              <Rich text={copy.sub} />
            </p>
            <Button
              variant="ghost"
              className={styles.undo}
              disabled={busy}
              onClick={() => void undo()}
            >
              {t('adapt.card.undo')}
            </Button>
          </div>
        </div>
      </>,
    );
  }

  const limitRow =
    kind === 'pain' && proposal.limitation ? (
      <LimitationRow proposal={proposal} disabled={busy} onLimited={setLimited} />
    ) : null;
  const limitFirst = proposal.limitation?.first === true;

  const pendingNote =
    kind === 'pain'
      ? loadChanged
        ? t('adapt.card.note.pending', { to: shown(toTok), from: shown(fromTok) })
        : t('adapt.card.note.pendingEasy')
      : undefined;

  return wrap(
    <>
      <div className={styles.head}>
        <span className={cx(styles.well, kind === 'pain' && styles.wellPain)}>
          <Icon name={wellIcon} size={28} />
        </span>
        <div className={styles.headText}>
          <h3 id={nameId} className={styles.name}>
            {name}
          </h3>
          <p className={cx(styles.kick, kind === 'pain' && styles.painKick)}>
            <Rich text={kicker()} />
          </p>
        </div>
      </div>
      <div className={styles.answers}>
        {limitRow && limitFirst ? limitRow : null}
        {rows.map((row) => (
          <button
            key={row.choice}
            type="button"
            className={styles.ans}
            disabled={busy}
            onClick={() => void choose(row.choice)}
          >
            <Icon name={row.icon} size={24} />
            <span className={styles.ansText}>
              <span className={styles.ansTitle}>{row.title}</span>
              <span className={styles.ansSub}>{row.sub}</span>
            </span>
          </button>
        ))}
        {limitRow && !limitFirst ? limitRow : null}
      </div>
      {pendingNote ? (
        <p className={cx(styles.note, styles.noteNow)}>
          <Icon name="arrow-down" size={20} />
          <span>
            <Rich text={pendingNote} />
          </span>
        </p>
      ) : null}
      {kind === 'pain' && proposal.repeated ? (
        <p className={cx(styles.note, styles.care)}>
          <Icon name="info" size={20} />
          <span>{t('adapt.card.note.care')}</span>
        </p>
      ) : null}
      {kind === 'no-equipment' ? (
        <p className={styles.note}>
          <Icon name="info" size={20} />
          <span>{t('adapt.card.note.noEquipment')}</span>
        </p>
      ) : null}
    </>,
  );
}
