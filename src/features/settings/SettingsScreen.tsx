import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  updateSettings,
  useActiveProgramme,
  useEquipment,
  useProfile,
  useSessionLogs,
  useSettings,
} from '@/app/data';
import { navigate } from '@/app/router';
import { repo } from '@/db/repo';
import type { Language, Settings } from '@/domain';
import { activeTravelKit } from '@/engine';
import { equipmentSummary } from '@/features/onboarding/summary';
import { Card, Dialog, ListRow, SegmentedControl, SwitchRow } from '@/ui/components';
import { canVibrate } from '../play/signals';
import { constraintsMeta } from './constraints/joints';
import { draftOf } from './constraints/model';
import { shortDate, localDay, weekdayName } from './dates';
import { TrainingDaysSheet } from './days/TrainingDaysSheet';
import { sortDays } from './days/model';
import { RestPicker } from './RestPicker';
import { profileSummary } from './summary';
import { useVoiceAvailable } from './voices';
import styles from './SettingsScreen.module.css';

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
] as const;

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const voiceAvailable = useVoiceAvailable(i18n.language === 'fr' ? 'fr' : 'en');
  const settings = useSettings();
  const profile = useProfile();
  const equipment = useEquipment();
  const programme = useActiveProgramme();
  const logs = useSessionLogs();
  const [confirmNew, setConfirmNew] = useState(false);
  const [daysOpen, setDaysOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const language: Language = settings?.language ?? (i18n.language === 'fr' ? 'fr' : 'en');
  const themeOptions: { value: Settings['theme']; label: string }[] = [
    { value: 'system', label: t('settings.themeSystem') },
    { value: 'dark', label: t('settings.themeDark') },
    { value: 'light', label: t('settings.themeLight') },
  ];

  const constraintsRow = profile
    ? (constraintsMeta(t, draftOf(profile)) ?? t('settings.constraintsNone'))
    : undefined;
  const days = sortDays(settings?.trainingDays ?? []);
  const daysRow =
    days.length > 0
      ? days.map((d) => weekdayName(d, language, 'short')).join(', ')
      : t('settings.daysNone');
  const kit = settings ? activeTravelKit(settings, new Date(now)) : undefined;
  const travelRow =
    kit && settings?.travelKit
      ? t('settings.travelUntil', { date: shortDate(localDay(settings.travelKit.until), language) })
      : t('settings.travelNone');

  const vibrates = canVibrate();
  const lastBackup = settings?.lastBackupAt;
  const backupDays = lastBackup
    ? Math.max(0, Math.floor((now - Date.parse(lastBackup)) / 86_400_000))
    : undefined;
  const backupMeta = !settings
    ? undefined
    : backupDays === undefined
      ? t('settings.dataRowNever')
      : backupDays === 0
        ? t('settings.dataRowToday')
        : t('settings.dataRowAge', { count: backupDays });

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>{t('settings.title')}</h1>
      </div>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('settings.training')}</h2>
        <Card className={styles.rows}>
          <ListRow
            icon="user"
            title={t('settings.profile')}
            meta={profile ? profileSummary(profile, t, language) : undefined}
            onClick={() => navigate({ name: 'profile' })}
          />
          <ListRow
            icon="joint"
            title={t('settings.constraintsRow')}
            meta={constraintsRow}
            onClick={() => navigate({ name: 'constraints' })}
          />
          <ListRow
            icon="calendar"
            title={t('settings.daysRow')}
            meta={settings && profile ? daysRow : undefined}
            onClick={() => setDaysOpen(true)}
          />
          <ListRow
            icon="suitcase"
            title={t('settings.travelRow')}
            meta={settings ? travelRow : undefined}
            onClick={() => navigate({ name: 'travel' })}
          />
          <SwitchRow
            checked={settings?.checkInPrompt ?? true}
            onChange={(on) => void repo.setCheckInPrompt(on)}
            className={styles.checkRow}
            title={t('settings.checkin.title')}
            meta={t(
              (settings?.checkInPrompt ?? true) ? 'settings.checkin.on' : 'settings.checkin.off',
            )}
          />
          <ListRow
            icon="dumbbell"
            title={t('settings.equipment')}
            meta={equipment ? equipmentSummary(equipment, t) : undefined}
            onClick={() => navigate({ name: 'equipment' })}
          />
          <ListRow
            icon="refresh"
            title={t('settings.newProgramme')}
            meta={t('settings.newProgrammeMeta')}
            onClick={() => setConfirmNew(true)}
          />
        </Card>
      </section>

      <section className={styles.section} aria-labelledby="settings-during">
        <h2 className={styles.heading} id="settings-during">
          {t('settings.during.title')}
        </h2>
        <Card className={styles.rows}>
          <SwitchRow
            checked={settings?.voice ?? true}
            onChange={(voice) => void updateSettings({ voice })}
            title={t('settings.during.voice')}
            meta={
              voiceAvailable === false
                ? t('adapt.notes.noVoice.row')
                : t('settings.during.voiceMeta')
            }
          />
          <SwitchRow
            checked={settings?.sounds ?? true}
            onChange={(sounds) => void updateSettings({ sounds })}
            title={t('settings.during.sounds')}
            meta={t('settings.during.soundsMeta')}
          />
          <SwitchRow
            checked={vibrates && (settings?.vibration ?? true)}
            disabled={!vibrates}
            onChange={(vibration) => void updateSettings({ vibration })}
            title={t('settings.during.vibration')}
            meta={t(vibrates ? 'settings.during.vibrationMeta' : 'settings.during.vibrationOff')}
          />
        </Card>
        <span className={styles.restLabel} id="settings-rest">
          {t('settings.during.rest')}
        </span>
        <RestPicker
          value={settings?.restDisplay ?? 'takeover'}
          onChange={(restDisplay) => void updateSettings({ restDisplay })}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('settings.dataSection')}</h2>
        <Card className={styles.rows}>
          <ListRow
            icon="shield"
            title={t('settings.dataRow')}
            meta={backupMeta}
            onClick={() => navigate({ name: 'data' })}
          />
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('settings.display')}</h2>
        <div className={styles.field}>
          <span className={styles.label}>{t('settings.language')}</span>
          <SegmentedControl
            label={t('settings.language')}
            options={LANGUAGES.map((l) => ({ ...l }))}
            value={language}
            onChange={(value) => void updateSettings({ language: value })}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>{t('settings.theme')}</span>
          <SegmentedControl
            label={t('settings.theme')}
            options={themeOptions}
            value={settings?.theme ?? 'system'}
            onChange={(theme) => void updateSettings({ theme })}
          />
          <p className={styles.hint}>{t('settings.themeHint')}</p>
        </div>
        <Card className={styles.rows}>
          <SwitchRow
            checked={settings?.figuresAnimated ?? true}
            onChange={(figuresAnimated) => void updateSettings({ figuresAnimated })}
            title={t('settings.figures')}
            meta={t('settings.figuresMeta')}
          />
        </Card>
        <p className={styles.quiet}>{t('settings.units')}</p>
      </section>

      <section className={`${styles.section} ${styles.about}`}>
        <h2 className={styles.heading}>{t('settings.about')}</h2>
        <p className={styles.aboutName}>{t('app.title')}</p>
        <p className={styles.hint}>{t('settings.aboutLocal')}</p>
        <p className={`${styles.hint} ${styles.aboutMore}`}>{t('settings.aboutHealth')}</p>
        <p className={`${styles.hint} ${styles.aboutMore}`}>{t('settings.aboutLicense')}</p>
      </section>

      {profile ? (
        <TrainingDaysSheet
          open={daysOpen}
          onClose={() => setDaysOpen(false)}
          daysPerWeek={profile.daysPerWeek}
          saved={settings?.trainingDays ?? []}
          programme={programme}
          logs={logs ?? []}
        />
      ) : null}

      <Dialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        title={t('settings.newDialog.title')}
        description={t('settings.newDialog.text')}
        confirmLabel={t('settings.newDialog.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setConfirmNew(false);
          navigate({ name: 'programme', preview: 'new' });
        }}
      />
    </>
  );
}
