import { Trans, useTranslation } from 'react-i18next';
import type { Language, Phase, PhaseAdjustment, Programme } from '@/domain';
import { Button, Sheet } from '@/ui/components';
import { exerciseName, phaseSlug } from './format';
import { effortText } from './effort';
import { WeekRuler } from './WeekRuler';
import styles from './Sheets.module.css';

const effortOf = (
  phase: Phase,
): { rir: number; scope: 'all-sets' | 'first-set' | 'last-set' } | null => {
  const found = phase.adjustments.find(
    (a): a is Extract<PhaseAdjustment, { kind: 'rir' }> => a.kind === 'rir',
  );
  return found ? { rir: found.value, scope: found.scope } : null;
};

function Bullet({ adjustment, lang }: { adjustment: PhaseAdjustment; lang: Language }) {
  const { t } = useTranslation();
  switch (adjustment.kind) {
    case 'rir':
      return (
        <Trans
          i18nKey={`programme.phase.bullet.rir.${adjustment.scope}`}
          values={{ effort: effortText(t, adjustment.value) }}
          components={{ b: <b /> }}
        />
      );
    case 'extra-sets':
      return (
        <Trans
          i18nKey="programme.phase.bullet.extraSets"
          count={adjustment.mainBlockIndexes.length}
          values={{ add: adjustment.add }}
          components={{ b: <b /> }}
        />
      );
    case 'volume':
      return (
        <Trans
          i18nKey="programme.phase.bullet.volume"
          values={{ pct: Math.round(adjustment.factor * 100) }}
          components={{ b: <b /> }}
        />
      );
    case 'cardio-minutes':
      return (
        <Trans
          i18nKey="programme.phase.bullet.cardio"
          values={{ minutes: adjustment.addMinutes }}
          components={{ b: <b /> }}
        />
      );
    case 'max-test':
      return (
        <Trans
          i18nKey="programme.phase.bullet.maxTest"
          values={{
            names: new Intl.ListFormat(lang, { type: 'conjunction' }).format(
              adjustment.exerciseIds.map((id) => exerciseName(id, lang).toLocaleLowerCase(lang)),
            ),
          }}
          components={{ b: <b /> }}
        />
      );
  }
}

/** What a phase asks: its aim, the effort and what changes in the sessions. */
export function PhaseSheet({
  programme,
  phase,
  currentWeek,
  onClose,
}: {
  programme: Programme;
  phase: Phase | null;
  currentWeek: number;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const slug = phase ? phaseSlug(phase.name.en) : null;
  const effort = phase ? effortOf(phase) : null;
  return (
    <Sheet
      open={phase !== null}
      onClose={onClose}
      title={
        <>
          <span className={styles.eyebrow}>
            {phase
              ? t('programme.phase.weeks', {
                  from: phase.fromWeek,
                  to: phase.toWeek,
                  total: programme.weeks,
                  count: phase.toWeek - phase.fromWeek + 1,
                })
              : ''}
          </span>
          <span className={styles.big}>{phase ? phase.name[lang] : ''}</span>
        </>
      }
    >
      {phase ? (
        <div className={styles.body}>
          <WeekRuler
            weeks={programme.weeks}
            phases={programme.phases}
            selected={{ from: phase.fromWeek, to: phase.toWeek }}
            current={currentWeek}
          />
          {slug ? (
            <div className={styles.facet}>
              <span className={styles.facetLabel}>{t('programme.phase.goal')}</span>
              <p className={styles.p}>{t(`programme.phase.${slug}.goal`)}</p>
            </div>
          ) : null}
          {effort ? (
            <div className={styles.facet}>
              <span className={styles.facetLabel}>{t('programme.phase.effort')}</span>
              {effort.rir === 0 ? (
                <p className={styles.p}>{t('labels.effort.failure')}</p>
              ) : (
                <div className={styles.effort}>
                  <span className={styles.effortN}>{effort.rir}</span>
                  <b>{t('programme.phase.repsInTank', { count: effort.rir })}</b>
                </div>
              )}
              <p className={`${styles.p} ${styles.muted}`}>
                {t(
                  effort.rir === 0
                    ? 'programme.phase.effortHelpFailure'
                    : 'programme.phase.effortHelp',
                  {
                    count: effort.rir,
                  },
                )}
              </p>
            </div>
          ) : null}
          <div className={styles.facet}>
            <span className={styles.facetLabel}>{t('programme.phase.changes')}</span>
            <ul className={styles.bullets}>
              {phase.adjustments.map((adjustment, index) => (
                <li key={index}>
                  <Bullet adjustment={adjustment} lang={lang} />
                </li>
              ))}
              <li>{t('programme.phase.sameLoads')}</li>
            </ul>
          </div>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('programme.phase.close')}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
