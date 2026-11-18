import { Appear } from '@/motion';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { catalogue, exerciseById } from '@/catalogue';
import { useActiveProgramme } from '@/app/data';
import { navigate } from '@/app/router';
import type { Language } from '@/domain';
import {
  defaultTestExercise,
  testBlockedByPain,
  testPainFreeNeeded,
  testExerciseFor,
  testValue,
  testWeeks,
} from '@/engine';
import { numberText } from '@/features/adapt/format';
import { SearchField } from '@/features/editor/picker/SearchField';
import { Thumb } from '@/features/editor/picker/Thumb';
import { HowToBody } from '@/features/howto';
import { equipmentInUse } from '@/features/figure';
import { Button, EmptyState, Icon, IconButton, Sheet } from '@/ui/components';
import { cx } from '@/ui/components/cx';
import { shortDate } from '../charts/format';
import { matchesName, testableExercises } from './logic';
import { useTestContext } from './useTestContext';
import styles from './tests.module.css';

export interface TestNowSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Take a max test now: the programme's exercise or another testable one, then the player. */
export function TestNowSheet({ open, onClose }: TestNowSheetProps) {
  const [view, setView] = useState<'choose' | 'pick' | 'howto'>('choose');
  const [other, setOther] = useState<string | undefined>();
  const [choice, setChoice] = useState<'default' | 'other'>('default');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView('choose');
      setOther(undefined);
      setChoice('default');
    }
  }
  return (
    <SheetBody
      open={open}
      onClose={onClose}
      view={view}
      setView={setView}
      other={other}
      setOther={setOther}
      choice={choice}
      setChoice={setChoice}
    />
  );
}

interface BodyProps {
  open: boolean;
  onClose: () => void;
  view: 'choose' | 'pick' | 'howto';
  setView: (v: 'choose' | 'pick' | 'howto') => void;
  other: string | undefined;
  setOther: (id: string | undefined) => void;
  choice: 'default' | 'other';
  setChoice: (c: 'default' | 'other') => void;
}

function SheetBody({
  open,
  onClose,
  view,
  setView,
  other,
  setOther,
  choice,
  setChoice,
}: BodyProps) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const ctx = useTestContext();
  const programme = useActiveProgramme();
  const [query, setQuery] = useState('');
  const [peek, setPeek] = useState<string | undefined>();

  const defaultId = useMemo(
    () =>
      ctx && programme !== undefined ? defaultTestExercise(programme ?? undefined, ctx) : undefined,
    [ctx, programme],
  );
  const programmeTest = useMemo(() => {
    if (!ctx || !programme) return undefined;
    for (const week of testWeeks(programme)) {
      const id = testExerciseFor(programme, week, ctx);
      if (id) return id;
    }
    return undefined;
  }, [ctx, programme]);
  const blocked = (id: string) => (ctx ? testBlockedByPain(id, ctx) : false);
  const last = (id: string) => {
    const tests = (ctx?.maxTests ?? []).filter((x) => x.exerciseId === id && !x.stopped);
    return tests.sort((a, b) => b.at.localeCompare(a.at))[0];
  };
  const lastText = (id: string): string | undefined => {
    const test = last(id);
    if (!test) return undefined;
    const value = testValue(test);
    const amount =
      test.result.kind === 'time'
        ? `${numberText(value, lang)}${' '}${t('labels.unit.s')}`
        : t('stats.unit.repsN', { count: value, n: numberText(value, lang) });
    return t('stats.tests.last', { value: amount, date: shortDate(test.date, lang) });
  };

  const testable = useMemo(
    () => (ctx ? testableExercises(catalogue, ctx.inventory, ctx.level) : []),
    [ctx],
  );
  const shown = testable.filter((e) => matchesName(e, query, lang));

  const defaultBlocked = defaultId ? blocked(defaultId) : false;
  const chosen = choice === 'other' ? other : defaultBlocked ? undefined : defaultId;
  const nameOf = (id: string) => exerciseById.get(id)?.name[lang] ?? id;

  const why = (id: string) => (
    <span className={styles.why}>
      <Icon name="stop" size={20} />
      <span>
        {t('stats.tests.unavailableCount', {
          count: ctx ? Math.max(1, testPainFreeNeeded(id, ctx)) : 1,
        })}
      </span>
    </span>
  );

  if (view === 'howto' && peek) {
    const peeked = exerciseById.get(peek);
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={
          <span className={styles.titleRow}>
            <IconButton icon="back" label={t('howto.back')} onClick={() => setView('pick')} />
            <span>{nameOf(peek)}</span>
          </span>
        }
        footer={
          <div className={styles.footer}>
            <Button
              size="player"
              fullWidth
              disabled={blocked(peek)}
              onClick={() => {
                setOther(peek);
                setChoice('other');
                setView('choose');
              }}
            >
              {t('howto.pickForTest')}
            </Button>
          </div>
        }
      >
        <Appear id={view} onMount className={styles.sheetBody}>
          <HowToBody exerciseId={peek} equipment={equipmentInUse(peeked, ctx?.inventory)} />
        </Appear>
      </Sheet>
    );
  }

  if (view === 'pick')
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={t('stats.tests.pickerTitle')}
        footer={
          <div className={styles.footer}>
            <Button variant="secondary" fullWidth onClick={() => setView('choose')}>
              {t('stats.tests.back')}
            </Button>
          </div>
        }
      >
        <Appear id={view} onMount className={styles.sheetBody}>
          <p className={styles.pickNote}>{t('stats.tests.pickerNote')}</p>
          <p className={styles.howtoHint}>{t('picker.howtoHint')}</p>
          <div className={styles.searchWrap}>
            <SearchField
              value={query}
              onChange={setQuery}
              label={t('stats.tests.search')}
              clearLabel={t('picker.clear')}
            />
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon="search"
              title={t('stats.tests.noMatch')}
              description={t('stats.tests.noMatchBody')}
            />
          ) : (
            <ul className={styles.pickList}>
              {shown.map((e) => {
                const hurt = blocked(e.id);
                return (
                  <li key={e.id} className={styles.pickWrap}>
                    <button
                      type="button"
                      className={styles.thumbHit}
                      aria-label={t('play.figure.open', { name: e.name[lang] })}
                      data-howto={e.id}
                      onClick={() => {
                        setPeek(e.id);
                        setView('howto');
                      }}
                    >
                      <Thumb exercise={e} />
                    </button>
                    <button
                      type="button"
                      className={styles.pickRow}
                      aria-disabled={hurt || undefined}
                      data-exercise={e.id}
                      onClick={
                        hurt
                          ? undefined
                          : () => {
                              setOther(e.id);
                              setChoice('other');
                              setView('choose');
                            }
                      }
                    >
                      <span className={styles.choiceText}>
                        <span className={styles.choiceName}>{e.name[lang]}</span>
                        {hurt ? (
                          why(e.id)
                        ) : (
                          <span className={styles.choiceSub}>
                            {lastText(e.id) ?? t(`labels.pattern.${e.pattern}`)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Appear>
      </Sheet>
    );

  const card = (key: 'default' | 'other', id: string, sub: React.ReactNode, disabled: boolean) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={choice === key && !disabled}
      aria-disabled={disabled || undefined}
      className={styles.choice}
      data-choice={key}
      onClick={disabled ? undefined : () => setChoice(key)}
    >
      <span className={styles.choiceText}>
        <span className={styles.choiceName} {...(disabled && { 'data-muted': '' })}>
          {nameOf(id)}
        </span>
        {sub}
      </span>
      <span className={styles.mark} aria-hidden="true">
        {choice === key && !disabled ? <Icon name="check" size={20} /> : null}
      </span>
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('stats.tests.sheetTitle')}
      description={t('stats.tests.sheetBody')}
      footer={
        <div className={styles.footer}>
          <Button
            size="player"
            fullWidth
            icon="play"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              onClose();
              navigate({ name: 'test', exerciseId: chosen });
            }}
          >
            {t('stats.tests.start')}
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      }
    >
      <Appear id={view} onMount className={styles.sheetBody}>
        <div role="radiogroup" aria-label={t('stats.tests.sheetTitle')} className={styles.choices}>
          {defaultId
            ? card(
                'default',
                defaultId,
                defaultBlocked ? (
                  why(defaultId)
                ) : (
                  <span className={styles.choiceSub}>
                    {[
                      defaultId === programmeTest ? t('stats.tests.programmeChoice') : undefined,
                      lastText(defaultId) ??
                        (defaultId === programmeTest ? undefined : t('stats.tests.defaultSub')),
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                ),
                defaultBlocked,
              )
            : null}
          {other && other !== defaultId
            ? card(
                'other',
                other,
                <span className={styles.choiceSub}>
                  {lastText(other) ??
                    t(`labels.pattern.${exerciseById.get(other)?.pattern ?? 'squat'}`)}
                </span>,
                false,
              )
            : null}
          <button
            type="button"
            className={cx(styles.choice, styles.choiceDashed)}
            onClick={() => setView('pick')}
          >
            <span className={styles.choiceText}>
              <span className={styles.choiceName}>{t('stats.tests.other')}</span>
              <span className={styles.choiceSub}>{t('stats.tests.otherSub')}</span>
            </span>
            <Icon name="chevron" size={20} />
          </button>
        </div>
        <ol className={styles.steps}>
          {(['warmup', 'one', 'result'] as const).map((s) => (
            <li key={s}>
              <span>{t(`stats.tests.step.${s}`)}</span>
            </li>
          ))}
        </ol>
      </Appear>
    </Sheet>
  );
}
