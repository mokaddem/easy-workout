import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { updateSettings, useSettings } from '@/app/data';
import { currentPlatform, promptInstall, useInstallState } from '@/app/install';
import { goBack, navigate } from '@/app/router';
import { CrossFade } from '@/motion';
import { Button, Dock, Icon, IconButton } from '@/ui/components';
import { AppIcon } from './GlyphCap';
import { useGlyphs } from './useGlyphs';
import { InstallSteps } from './InstallSteps';
import {
  BROWSER_NAMES,
  initialTab,
  panelPlan,
  promptOnTab,
  whyPoints,
  type InstallTab,
  type InstallVariant,
} from './plan';
import styles from './InstallScreen.module.css';

const TABS: InstallTab[] = ['ios', 'android', 'desktop'];

/** How to put the app on the home screen (or the dock): a gate on the first visit, a page in Settings. */
export function InstallScreen({ variant }: { variant: InstallVariant }) {
  const { t } = useTranslation();
  const [detected] = useState(currentPlatform);
  const { canPrompt, installed } = useInstallState();
  const [tab, setTab] = useState<InstallTab>(initialTab(detected));
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const gate = variant === 'first';
  const computer = detected.os === 'desktop';

  const input = { tab, detected, canPrompt, variant };
  const plan = panelPlan(input);
  const showInstall = promptOnTab(input) && !installed;
  const browserName = BROWSER_NAMES[detected.browser];

  // Moves on once the app has read the stored choice back: until then it sends a phone browser here.
  const [leaving, setLeaving] = useState(false);
  const skipped = useSettings()?.installSkippedAt;
  useEffect(() => {
    if (leaving && skipped) navigate({ name: 'onboarding' });
  }, [leaving, skipped]);
  const leave = () => {
    setLeaving(true);
    void updateSettings({ installSkippedAt: new Date().toISOString() });
  };
  const continueLabel = browserName
    ? t('install.continue', { browser: browserName })
    : t('install.continueGeneric');

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + TABS.length) % TABS.length;
    setTab(TABS[next]!);
    tabRefs.current[next]?.focus();
  };

  const doneText = computer ? t('install.done.textComputer') : t('install.done.text');
  const doneMore =
    variant === 'settings' && detected.os === 'android'
      ? ` ${t('install.step.openSharedMeta')}`
      : '';

  return (
    <>
      {gate ? null : (
        <header className={styles.ctx}>
          <IconButton icon="back" label={t('common.back')} onClick={goBack} />
          <span className={styles.ctxText}>{t('settings.title')}</span>
        </header>
      )}

      <CrossFade id={installed ? 'done' : 'guide'}>
        {installed ? (
          <div className={styles.done} role="status">
            <div className={styles.doneIcon}>
              <AppIcon size={96} />
              <span className={styles.badge}>
                <Icon name="check" size={24} />
              </span>
            </div>
            <h1 className={styles.display}>{t('install.done.title')}</h1>
            <p className={styles.doneText}>{doneText + doneMore}</p>
          </div>
        ) : (
          <div className={`${styles.page} ${gate ? styles.gate : ''}`}>
            <div className={styles.hero}>
              <h1 className={styles.display}>{t('install.title')}</h1>
              <AppIcon size={64} className={styles.heroIcon} />
              <p className={styles.lead}>{t(computer ? 'install.leadComputer' : 'install.lead')}</p>
            </div>

            {plan.setupStays ? (
              <NoteLine
                textKey="install.setupStays"
                values={{ browser: browserName || 'Safari' }}
              />
            ) : null}

            <div role="tablist" aria-label={t('install.platform.label')} className={styles.seg}>
              {TABS.map((id, index) => (
                <button
                  key={id}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`install-tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls="install-panel"
                  tabIndex={tab === id ? 0 : -1}
                  className={styles.opt}
                  onClick={() => setTab(id)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                >
                  {t(`install.platform.${id === 'desktop' ? 'computer' : id}`)}
                </button>
              ))}
            </div>

            <CrossFade id={`${tab}-${plan.heading.key}-${plan.noInstall}`}>
              <div
                role="tabpanel"
                id="install-panel"
                aria-labelledby={`install-tab-${tab}`}
                className={styles.how}
              >
                <h2 className={styles.howHeading}>
                  {plan.heading.key === 'firefox'
                    ? t('install.firefox.title')
                    : plan.heading.key === 'inChromeEdge'
                      ? t('install.inChromeEdge')
                      : t('install.in', {
                          browser: BROWSER_NAMES[plan.heading.browser ?? 'chrome'] || 'Chrome',
                        })}
                </h2>
                {plan.noInstall ? (
                  <p className={styles.ffx}>{t('install.firefox.text')}</p>
                ) : (
                  <InstallSteps steps={plan.steps} />
                )}
                {plan.promptFallback ? <Fallback /> : null}
                {plan.firefoxData ? <NoteLine textKey="install.firefox.data" /> : null}
                {plan.others.length > 0 ? <Others lines={plan.others} /> : null}
              </div>
            </CrossFade>

            <section className={styles.why} aria-labelledby="install-why">
              <h2 className={styles.whyHeading} id="install-why">
                {t('install.why.title')}
              </h2>
              <ul className={styles.whyList}>
                {whyPoints(detected.os).map(({ id, icon }) => (
                  <li key={id} className={styles.whyItem}>
                    <Icon name={icon} size={24} />
                    <span className={styles.whyTitle}>{t(`install.why.${id}`)}</span>
                    <span className={styles.whyMeta}>{t(`install.why.${id}Meta`)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </CrossFade>

      {gate || showInstall ? (
        <Dock>
          {gate && detected.os === 'ios' && !installed ? (
            <p className={styles.dockNote}>
              <Icon name="info" size={20} />
              <span>
                <Trans
                  i18nKey="install.firstNote"
                  values={{ browser: browserName || 'Safari' }}
                  components={{ b: <b /> }}
                />
              </span>
            </p>
          ) : null}
          {showInstall ? (
            <Button
              fullWidth
              icon="install"
              onClick={() => {
                void promptInstall();
              }}
            >
              {t('install.install')}
            </Button>
          ) : null}
          {gate ? (
            <Button
              variant={showInstall ? 'ghost' : 'secondary'}
              fullWidth={!showInstall}
              className={showInstall ? styles.ghost : undefined}
              onClick={leave}
            >
              {continueLabel}
            </Button>
          ) : null}
        </Dock>
      ) : null}
    </>
  );
}

function NoteLine({ textKey, values }: { textKey: string; values?: Record<string, string> }) {
  const { t } = useTranslation();
  return (
    <div className={styles.note}>
      <Icon name="file" size={20} />
      <p className={styles.noteText}>
        <Trans i18nKey={textKey} values={values} components={{ b: <b /> }} />
      </p>
      <Button
        variant="secondary"
        className={styles.noteButton}
        onClick={() => navigate({ name: 'data' })}
      >
        {t('install.toData')}
      </Button>
    </div>
  );
}

function Fallback() {
  const small = useGlyphs(true);
  return (
    <p className={styles.fallback}>
      <Icon name="info" size={20} />
      <span>
        <Trans i18nKey="install.promptFallback" components={small} />
      </span>
    </p>
  );
}

function Others({ lines }: { lines: readonly string[] }) {
  const { t } = useTranslation();
  const small = useGlyphs(true);
  return (
    <div className={styles.others}>
      <h3 className={styles.othersHeading}>{t('install.others.title')}</h3>
      <ul className={styles.othersList}>
        {lines.map((line) => (
          <li key={line}>
            <Trans i18nKey={`install.others.${line}`} components={small} />
          </li>
        ))}
      </ul>
    </div>
  );
}
