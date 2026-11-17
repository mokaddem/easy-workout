import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { useCustomSessions } from '@/app/data';
import { nextSession } from '@/app/programme-state';
import { navigate } from '@/app/router';
import { repo } from '@/db/repo';
import type { CustomSessionRecord, ProgrammeRecord } from '@/db';
import type { Language, SessionLog } from '@/domain';
import { checkProgramme, checkSession, issueKey, placeSession, type EditContext } from '@/engine';
import { issueText } from '../editor/issueText';
import { Button, Icon, IssueLine, Sheet, useToast } from '@/ui/components';
import { isCardioDay, sessionIdentity } from '../programme/format';
import { placeChoices, sessionFocus, unusableIssues } from './logic';
import styles from './Mine.module.css';

export interface PlaceSheetProps {
  open: boolean;
  onClose: () => void;
  custom: CustomSessionRecord;
  programme: ProgrammeRecord;
  logs: readonly SessionLog[];
  ctx: EditContext;
}

/** Picks the programme session one of the user's own sessions replaces. */
export function PlaceSheet({ open, onClose, custom, programme, logs, ctx }: PlaceSheetProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const toast = useToast();
  const customs = useCustomSessions();
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const issues = useMemo(() => checkSession(custom, ctx, { inProgramme: true }), [custom, ctx]);
  const blocked = unusableIssues(issues).length > 0;
  const budget = issues.find((i) => i.code === 'over-budget' || i.code === 'under-budget');
  const choices = useMemo(
    () =>
      placeChoices({
        programme,
        customId: custom.id,
        focus: sessionFocus(custom, exerciseById),
        nextSessionId: nextSession(programme, logs).sessionId,
        lang,
        focusOf: (s) => sessionFocus(s, exerciseById),
        isCardio: isCardioDay,
        title: (s) => sessionIdentity(s, lang, programme.rotation).title,
      }),
    [programme, custom, logs, lang],
  );
  const choice = choices.find((c) => c.sessionId === picked);
  // What the week would lose with it in that place (pulling, a muscle group…).
  const weekly = useMemo(() => {
    if (!picked) return [];
    const { updatedAt: _, base: __, ...session } = custom;
    return checkProgramme(placeSession(programme, picked, session), ctx);
  }, [picked, custom, programme, ctx]);
  const nameOf = (id: string) => customs?.find((c) => c.id === id)?.name[lang] ?? '';

  const move = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + choices.length) % choices.length;
    const target = choices[next];
    if (!target) return;
    setPicked(target.sessionId);
    setError(false);
    refs.current[next]?.focus();
  };

  const close = () => {
    onClose();
    setPicked(null);
    setError(false);
  };

  const confirm = async () => {
    if (!choice) {
      setError(true);
      return;
    }
    const previous = choice.takenBy;
    await repo.placeCustomSession(programme.id, choice.sessionId, custom.id);
    close();
    toast.show({
      message: t('mine.place.done', { name: custom.name[lang], letter: choice.letter }),
      action: {
        label: t('common.undo'),
        onAction: () =>
          void (async () => {
            await repo.resetProgrammeSession(programme.id, choice.sessionId);
            if (previous) await repo.placeCustomSession(programme.id, choice.sessionId, previous);
          })(),
      },
    });
  };

  const budgetText = budget
    ? t(budget.code === 'over-budget' ? 'mine.place.overBudget' : 'mine.place.underHalf', {
        minutes: budget.params?.minutes,
        budget: budget.params?.budget,
        delta: Number(budget.params?.minutes ?? 0) - Number(budget.params?.budget ?? 0),
      })
    : null;

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('mine.place.title')}
      description={t('mine.place.line')}
      footer={
        blocked ? (
          <>
            <Button
              fullWidth
              onClick={() => navigate({ name: 'edit', target: 'mine', sessionId: custom.id })}
            >
              {t('mine.custom.editSession')}
            </Button>
            <Button variant="secondary" fullWidth onClick={close}>
              {t('mine.place.cancel')}
            </Button>
          </>
        ) : (
          <>
            <Button fullWidth onClick={() => void confirm()}>
              {choice
                ? t('mine.place.confirm', { letter: choice.letter })
                : t('mine.place.confirmNone')}
            </Button>
            <Button variant="secondary" fullWidth onClick={close}>
              {t('mine.place.cancel')}
            </Button>
          </>
        )
      }
    >
      {blocked ? (
        <div className={styles.sheetNotes}>
          <IssueLine level="block">{t('mine.place.blocked')}</IssueLine>
        </div>
      ) : (
        <>
          {error ? (
            <p className={styles.fieldError} role="alert" style={{ marginTop: 'var(--space-3)' }}>
              {t('mine.place.error')}
            </p>
          ) : null}
          <div
            role="radiogroup"
            aria-label={t('mine.place.group')}
            aria-invalid={error || undefined}
            className={`${styles.choices} ${error ? styles.choicesError : ''}`}
            style={{ marginTop: 'var(--space-3)' }}
          >
            {choices.map((c, i) => {
              const checked = c.sessionId === picked;
              const extras = [
                c.isNext ? t('mine.place.next') : null,
                c.sameFocus ? t('mine.place.sameFocus') : null,
              ].filter(Boolean);
              const meta = [t('mine.place.meta', { minutes: c.minutes }), ...extras].join(', ');
              return (
                <button
                  key={c.sessionId}
                  ref={(node) => {
                    refs.current[i] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked || (picked === null && i === 0) ? 0 : -1}
                  className={styles.choice}
                  onClick={() => {
                    setPicked(c.sessionId);
                    setError(false);
                  }}
                  onKeyDown={(event) => move(event, i)}
                >
                  <span className={styles.mark} aria-hidden="true">
                    <Icon name="check" size={20} />
                  </span>
                  <span className={styles.tag} aria-hidden="true">
                    {c.letter}
                  </span>
                  <span className={styles.choiceText}>
                    <span className={styles.choiceName}>
                      <span className={styles.srOnly}>
                        {t('mine.place.sessionLetter', { letter: c.letter })}.{' '}
                      </span>
                      {c.name}
                    </span>
                    <span className={styles.choiceMeta}>{meta}</span>
                    {c.takenBy ? (
                      <span className={styles.choiceMeta}>
                        {t('mine.place.taken', { name: nameOf(c.takenBy) })}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.sheetNotes} aria-live="polite">
            {choice ? (
              <p className={styles.note}>
                <Icon name="info" size={20} />
                <span>
                  {choice.isNext
                    ? t('mine.place.backNext')
                    : t('mine.place.back', { session: choice.name })}
                  {choice.takenBy
                    ? ` ${t('mine.place.swapTaken', { name: nameOf(choice.takenBy) })}`
                    : ''}
                </span>
              </p>
            ) : null}
            {budgetText ? <IssueLine level="warn">{budgetText}</IssueLine> : null}
            {weekly.map((issue) => (
              <IssueLine key={issueKey(issue)} level="warn">
                {issueText(t, issue, {
                  lang,
                  inventory: ctx.inventory,
                  exercises: ctx.exercises,
                })}
              </IssueLine>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
