import { useTranslation } from 'react-i18next';
import type { Language, Programme } from '@/domain';
import { Button, Icon, Sheet, type IconName } from '@/ui/components';
import { programmeReasons, type ReasonInput } from './why';
import styles from './Sheets.module.css';

const ICON: Record<ReasonInput, IconName> = {
  schedule: 'calendar',
  goal: 'gauge',
  equipment: 'user',
};

/** Why this programme, reason by reason, grouped by what the user told us. */
export function ProgrammeWhySheet({
  programme,
  open,
  onClose,
}: {
  programme: Programme;
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const generation = programme.generation;
  const groups = open ? programmeReasons(generation?.notes ?? [], t, lang) : [];
  // A list in a line of text: only its first item keeps its capital ("Haltères, élastiques et banc").
  const kinds = [...new Set((generation?.equipment ?? []).map((item) => item.kind))].map(
    (kind, index) => {
      const label = t(`labels.equipment.${kind}`);
      return index === 0 ? label : label.charAt(0).toLocaleLowerCase(lang) + label.slice(1);
    },
  );

  const head = (input: ReasonInput): { title: string; label: string } => {
    const profile = generation?.profile;
    switch (input) {
      case 'schedule':
        return {
          title: profile
            ? t('programme.why.scheduleTitle', {
                days: profile.daysPerWeek,
                minutes: profile.sessionMinutes,
              })
            : t('programme.why.schedule'),
          label: t('programme.why.schedule'),
        };
      case 'goal':
        return {
          title: profile
            ? t('programme.why.goalTitle', {
                goal: t(`labels.goal.${profile.goal}`),
                level: t(`labels.level.${profile.level}`).toLocaleLowerCase(lang),
              })
            : t('programme.why.goal'),
          label: t('programme.why.goal'),
        };
      case 'equipment':
        return {
          title:
            kinds.length === 0
              ? t('programme.why.bodyweightOnly')
              : new Intl.ListFormat(lang, { type: 'conjunction' }).format(kinds),
          label: t('programme.why.equipment'),
        };
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <>
          <span className={styles.eyebrow}>{programme.name[lang]}</span>
          <span className={styles.big}>{t('programme.why.title')}</span>
        </>
      }
    >
      {open ? (
        <div className={styles.body}>
          <div className={styles.reasons}>
            {groups.map((group) => {
              const { title, label } = head(group.input);
              return (
                <section key={group.input} className={styles.reasonGroup}>
                  <div className={styles.reasonHead}>
                    <span className={styles.well}>
                      <Icon name={ICON[group.input]} />
                    </span>
                    <div>
                      <div className={styles.reasonInput}>{title}</div>
                      <div className={styles.reasonLabel}>{label}</div>
                    </div>
                  </div>
                  <ul className={styles.reasonList}>
                    {group.sentences.map((sentence) => (
                      <li key={sentence}>{sentence}</li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('programme.why.close')}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
