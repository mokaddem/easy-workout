import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateSettings, useEquipment, useProfile, useSettings } from '@/app/data';
import { navigate } from '@/app/router';
import type { Language, Settings } from '@/domain';
import { equipmentSummary } from '@/features/onboarding/summary';
import { Card, Dialog, ListRow, SegmentedControl } from '@/ui/components';
import { profileSummary } from './summary';
import styles from './SettingsScreen.module.css';

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
] as const;

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const profile = useProfile();
  const equipment = useEquipment();
  const [confirmNew, setConfirmNew] = useState(false);

  const language: Language = settings?.language ?? (i18n.language === 'fr' ? 'fr' : 'en');
  const themeOptions: { value: Settings['theme']; label: string }[] = [
    { value: 'system', label: t('settings.themeSystem') },
    { value: 'dark', label: t('settings.themeDark') },
    { value: 'light', label: t('settings.themeLight') },
  ];

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
        <p className={styles.quiet}>{t('settings.units')}</p>
      </section>

      <section className={`${styles.section} ${styles.about}`}>
        <h2 className={styles.heading}>{t('settings.about')}</h2>
        <p className={styles.aboutName}>{t('app.title')}</p>
        <p className={styles.hint}>{t('settings.aboutLocal')}</p>
      </section>

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
