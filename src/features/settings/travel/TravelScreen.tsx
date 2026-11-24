import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveProgramme, useAnswers, useProfile, useSettings } from '@/app/data';
import { goBack } from '@/app/router';
import { constraintsRepo } from '@/db/constraints';
import type { EquipmentInventory, Language, Profile, Programme, Settings } from '@/domain';
import { activeSwaps, activeTravelKit } from '@/engine';
import { EquipmentChecklist } from '@/features/equipment/EquipmentChecklist';
import { entryOf } from '@/features/equipment/entries';
import { invalidItems } from '@/features/equipment/validation';
import { Roll } from '@/motion';
import {
  AppBar,
  Button,
  Chip,
  ChipGroup,
  Dock,
  Icon,
  IconButton,
  IncludedList,
  ProgressBar,
  Skeleton,
  useToast,
} from '@/ui/components';
import { addDays, dayKey, localDay, shortDate } from '../dates';
import { CoverageRows } from './CoverageRows';
import { coverageOf } from './coverage';
import styles from './Travel.module.css';

export function TravelScreen() {
  const settings = useSettings();
  const profile = useProfile();
  const programme = useActiveProgramme();
  const answers = useAnswers();
  if (!settings || profile === undefined || programme === undefined || !answers) return <Loading />;
  return <Travel settings={settings} profile={profile} programme={programme} answers={answers} />;
}

function Loading() {
  const { t } = useTranslation();
  return (
    <>
      <AppBar title={t('settings.travel.title')} onBack={goBack} backLabel={t('common.back')} />
      <div className={styles.scroll}>
        <Skeleton height={200} radius="var(--radius-lg)" />
      </div>
    </>
  );
}

type Mode = 'active' | 'what' | 'until';

function Travel({
  settings,
  profile,
  programme,
  answers,
}: {
  settings: Settings;
  profile: Profile | null;
  programme: Programme | null;
  answers: NonNullable<ReturnType<typeof useAnswers>>;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const toast = useToast();
  const [now] = useState(() => new Date());
  const kit = activeTravelKit(settings, now);
  const [mode, setMode] = useState<Mode>(kit ? 'active' : 'what');
  const [prevMode, setPrevMode] = useState<Mode>(mode);
  const [moved, setMoved] = useState<'' | 'enterForward' | 'enterBack'>('');
  if (prevMode !== mode) {
    const rank: Record<Mode, number> = { active: 0, what: 1, until: 2 };
    setPrevMode(mode);
    setMoved(rank[mode] > rank[prevMode] ? 'enterForward' : 'enterBack');
  }
  const [draft, setDraft] = useState<EquipmentInventory>(kit ?? []);
  const [until, setUntil] = useState(kit ? settings.travelKit!.until : '');
  const [showErrors, setShowErrors] = useState(false);
  const [dateError, setDateError] = useState<'empty' | 'past' | null>(null);
  const [busy, setBusy] = useState(false);

  const painful = useMemo(() => activeSwaps(answers).painful, [answers]);
  const coverage = useMemo(
    () => (programme && profile ? coverageOf(programme, draft, profile, painful) : undefined),
    [programme, profile, draft, painful],
  );

  const today = dayKey(now);
  const tomorrow = dayKey(addDays(now, 1));

  function next() {
    if (invalidItems(draft).length > 0) {
      setShowErrors(true);
      toast.show({ message: t('equipment.toast.invalid'), tone: 'error' });
      return;
    }
    setMode('until');
  }

  async function activate() {
    if (!until) return setDateError('empty');
    if (until <= today) return setDateError('past');
    setBusy(true);
    try {
      await constraintsRepo.startTravelKit(draft, until, lang);
      toast.show({
        message: t('settings.travel.activated', { date: shortDate(localDay(until), lang) }),
      });
      goBack();
    } catch {
      toast.show({ message: t('settings.travel.failed'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function pauseInstead() {
    setBusy(true);
    try {
      await constraintsRepo.pauseProgramme(new Date(), lang);
      toast.show({ message: t('settings.travel.paused') });
      goBack();
    } catch {
      toast.show({ message: t('settings.travel.failed'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    if (!kit || !settings.travelKit) return;
    const previous = settings.travelKit;
    setBusy(true);
    try {
      await constraintsRepo.endTravelKit(lang);
      toast.show({
        message: t('settings.travel.ended'),
        action: {
          label: t('settings.travel.undo'),
          onAction: () =>
            void constraintsRepo.startTravelKit(previous.equipment, previous.until, lang),
        },
      });
      goBack();
    } catch {
      toast.show({ message: t('settings.travel.failed'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'active' && kit && settings.travelKit) {
    const left = Math.max(
      1,
      Math.round(
        (localDay(settings.travelKit.until).getTime() - localDay(today).getTime()) / 86_400_000,
      ),
    );
    return (
      <>
        <AppBar title={t('settings.travel.title')} onBack={goBack} backLabel={t('common.back')} />
        <div key="active" className={`${styles.scroll} ${moved ? styles[moved] : ''}`}>
          <section className={styles.hero}>
            <p className={styles.leftN}>
              <Roll className={styles.leftNum} value={left}>
                {left}
              </Roll>
              <span className={styles.leftLabel}>{t('settings.travel.left', { count: left })}</span>
            </p>
            <p className={styles.until}>
              {t('settings.travel.until', {
                date: shortDate(localDay(settings.travelKit.until), lang),
              })}
            </p>
          </section>
          <section className={styles.block}>
            <h2 className={styles.heading}>{t('settings.travel.items')}</h2>
            {kit.length > 0 ? (
              <IncludedList
                className={styles.pad}
                items={kit.map((item) => t(`labels.equipment.${entryOf(item)?.key ?? item.kind}`))}
              />
            ) : (
              <p className={styles.text}>{t('settings.travel.itemsNone')}</p>
            )}
          </section>
          {programme && coverage ? (
            <section className={styles.block}>
              <h2 className={styles.heading}>{t('settings.travel.sessions')}</h2>
              <CoverageRows programme={programme} coverage={coverage} />
            </section>
          ) : null}
          <div className={styles.actions}>
            <Button variant="secondary" fullWidth onClick={() => setMode('what')}>
              {t('settings.travel.edit')}
            </Button>
            <Button variant="secondary" fullWidth loading={busy} onClick={() => void end()}>
              {t('settings.travel.end')}
            </Button>
          </div>
        </div>
      </>
    );
  }

  const step = mode === 'until' ? 2 : 1;
  const percent = coverage ? Math.round(coverage.mean * 100) : null;
  const back = () => (mode === 'until' ? setMode('what') : kit ? setMode('active') : goBack());

  return (
    <>
      <header className={styles.topbar}>
        <IconButton icon="back" label={t('common.back')} onClick={back} />
        <ProgressBar
          variant="segmented"
          total={2}
          current={step}
          label={t('settings.travel.step', { n: step })}
          className={styles.steps}
        />
      </header>

      {mode === 'what' ? (
        <>
          <div key={mode} className={`${styles.scroll} ${moved ? styles[moved] : ''}`}>
            <div className={styles.intro}>
              <h1 className={styles.title}>{t('settings.travel.whatTitle')}</h1>
              <p className={styles.text}>{t('settings.travel.whatBody')}</p>
            </div>
            <div className={styles.checklist}>
              <EquipmentChecklist value={draft} onChange={setDraft} showErrors={showErrors} />
            </div>
          </div>
          <Dock>
            <div className={styles.split}>
              {percent !== null ? (
                <p className={styles.counter} aria-live="polite" aria-atomic="true">
                  <Roll className={styles.counterNum} value={percent}>
                    {percent}
                  </Roll>
                  <span className={styles.counterLabel}>
                    % {t('settings.travel.coverageCount')}
                  </span>
                </p>
              ) : (
                <p className={styles.counterLabel}>{t('settings.travel.coverageNoProgramme')}</p>
              )}
              <Button onClick={next}>{t('settings.travel.continue')}</Button>
            </div>
          </Dock>
        </>
      ) : (
        <>
          <div key={mode} className={`${styles.scroll} ${moved ? styles[moved] : ''}`}>
            <div className={styles.intro}>
              <h1 className={styles.title}>{t('settings.travel.untilTitle')}</h1>
            </div>
            <div className={styles.dateBlock}>
              <label className={`${styles.dateBox} ${dateError ? styles.dateInvalid : ''}`}>
                <span className={styles.hidden}>{t('settings.travel.untilField')}</span>
                <input
                  type="date"
                  className={styles.date}
                  min={tomorrow}
                  value={until}
                  aria-invalid={dateError ? true : undefined}
                  aria-describedby="travel-date-msg"
                  onChange={(event) => {
                    setUntil(event.target.value);
                    setDateError(null);
                  }}
                />
              </label>
              <ChipGroup label={t('settings.travel.untilField')}>
                {([7, 14] as const).map((days) => {
                  const key = dayKey(addDays(now, days));
                  return (
                    <Chip
                      key={days}
                      selected={until === key}
                      onToggle={() => {
                        setUntil(key);
                        setDateError(null);
                      }}
                    >
                      {t(days === 7 ? 'settings.travel.oneWeek' : 'settings.travel.twoWeeks')}
                    </Chip>
                  );
                })}
              </ChipGroup>
              <p
                id="travel-date-msg"
                className={`${styles.note} ${dateError ? styles.error : ''}`}
                role={dateError ? 'alert' : undefined}
              >
                <Icon name={dateError ? 'alert' : 'info'} size={20} />
                <span>
                  {dateError === 'empty'
                    ? t('settings.travel.dateEmpty')
                    : dateError === 'past'
                      ? t('settings.travel.dateError')
                      : t('settings.travel.untilNote')}
                </span>
              </p>
            </div>

            {programme && coverage ? (
              <section className={styles.block}>
                <h2 className={styles.heading}>{t('settings.travel.sessions')}</h2>
                <CoverageRows programme={programme} coverage={coverage} />
                {coverage.suggestPause ? (
                  <div className={styles.firm}>
                    <p className={styles.firmText}>
                      <Icon name="suitcase" size={20} />
                      <span>{t('settings.travel.suggestPause')}</span>
                    </p>
                    <Button
                      variant="secondary"
                      fullWidth
                      disabled={busy}
                      onClick={() => void pauseInstead()}
                    >
                      {t('settings.travel.pauseInstead')}
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
          <Dock>
            <Button fullWidth size="player" loading={busy} onClick={() => void activate()}>
              {t(kit ? 'settings.travel.save' : 'settings.travel.activate')}
            </Button>
          </Dock>
        </>
      )}
    </>
  );
}
