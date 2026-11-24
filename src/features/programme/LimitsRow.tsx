import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { navigate } from '@/app/router';
import type { Language, Profile, Programme } from '@/domain';
import { Button, Icon, Sheet } from '@/ui/components';
import { constraintsMeta } from '../settings/constraints/joints';
import { draftOf } from '../settings/constraints/model';
import { LeftOutRow } from './AdaptLines';
import { programmeIdentities } from './format';
import { programmeLimits } from './limits';
import { describeNote, leftOutBecause, leftOutTitle } from './why';
import styles from './Overview.module.css';
import sheet from './Sheets.module.css';

/** "Adapted for you: knee, no jumping": what the programme works around, and where to change it. */
export function LimitsRow({ programme, profile }: { programme: Programme; profile: Profile }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const [open, setOpen] = useState(false);
  const limits = programmeLimits(programme, profile);
  const list = constraintsMeta(t, draftOf(profile)) ?? '';
  const identities = programmeIdentities(programme, lang);
  const sessionName = (id: string) =>
    identities[programme.rotation.findIndex((s) => s.id === id)]?.fullName ?? id;
  const count = limits.leftOut.length;

  return (
    <>
      <button
        type="button"
        className={`${styles.nudge} ${styles.nudgeButton}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className={styles.well}>
          <Icon name="joint" size={24} />
        </span>
        <span className={styles.nudgeText}>
          <span className={styles.nudgeTitle}>{t('programme.limits.title', { list })}</span>
          <span className={styles.nudgeSub}>
            {count > 0 ? t('programme.limits.sub', { count }) : t('programme.limits.subNone')}
          </span>
        </span>
        <Icon name="chev-right" size={20} />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={<span className={sheet.big}>{t('programme.limits.sheetTitle')}</span>}
        footer={
          <div className={sheet.foot}>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setOpen(false);
                navigate({ name: 'constraints' });
              }}
            >
              {t('programme.limits.edit')}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
              {t('common.close')}
            </Button>
          </div>
        }
      >
        {open ? (
          <div className={sheet.body}>
            {limits.leftOut.length > 0 ? (
              <section className={sheet.session}>
                <h3 className={sheet.sessionName}>{t('programme.limits.leftOut')}</h3>
                {limits.leftOut.map(({ sessionId, note }) => (
                  <LeftOutRow
                    key={`${sessionId}|${String(note.params.slot)}`}
                    icon={note.params.cause === 'region' ? 'joint' : 'info'}
                    title={t('programme.limits.sessionLine', {
                      session: sessionName(sessionId),
                      what: leftOutTitle(t, note.params.patterns, lang),
                    })}
                    sub={leftOutBecause(t, note.params)}
                  />
                ))}
              </section>
            ) : null}
            {limits.volume.length > 0 ? (
              <section className={sheet.session}>
                <h3 className={sheet.sessionName}>{t('programme.limits.lessVolume')}</h3>
                {limits.volume.map((note) => (
                  <p key={`${String(note.params.muscle)}`} className={sheet.p}>
                    {describeNote(note, t, lang)}
                  </p>
                ))}
              </section>
            ) : null}
            {limits.capped.length > 0 ? (
              <section className={sheet.session}>
                <h3 className={sheet.sessionName}>{t('programme.limits.capped')}</h3>
                {limits.capped.map((c) => (
                  <p key={`${c.sessionId}|${c.exerciseId}`} className={sheet.p}>
                    {t('programme.limits.sessionLine', {
                      session: sessionName(c.sessionId),
                      what: exerciseById.get(c.exerciseId)?.name[lang] ?? c.exerciseId,
                    })}
                  </p>
                ))}
              </section>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
