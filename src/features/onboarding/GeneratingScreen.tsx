import { useTranslation } from 'react-i18next';
import { Icon, ProgressBar, Spinner } from '@/ui/components';
import styles from './GeneratingScreen.module.css';

interface Props {
  split: string;
  exerciseCount: number;
  bodyweightKg: number | null;
}

const WEEKS = 8;

/** Shown only when generation is slow; the work itself is already done when it appears. */
export function GeneratingScreen({ split, exerciseCount, bodyweightKg }: Props) {
  const { t, i18n } = useTranslation();
  const kg =
    bodyweightKg === null
      ? null
      : new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-GB', {
          maximumFractionDigits: 1,
        }).format(bodyweightKg);
  const steps: { text: string; done: boolean }[] = [
    { text: t('onboarding.generating.split', { split }), done: true },
    { text: t('onboarding.generating.exercises', { count: exerciseCount }), done: true },
    {
      text: kg ? t('onboarding.generating.loads', { kg }) : t('onboarding.generating.loadsDefault'),
      done: true,
    },
    { text: t('onboarding.generating.phases'), done: false },
  ];
  return (
    <div className={styles.gen} role="status" aria-live="polite">
      <div className={styles.body}>
        <div className={styles.weeks} aria-hidden="true">
          <span className={styles.n}>{WEEKS}</span>
          <span className={styles.unit}>{t('onboarding.generating.weeks')}</span>
        </div>
        <ProgressBar
          variant="segmented"
          total={WEEKS}
          current={WEEKS - 2}
          label={t('onboarding.generating.title')}
          className={styles.segs}
        />
        <h1 className={styles.title}>{t('onboarding.generating.title')}</h1>
        <ol className={styles.steps}>
          {steps.map((step, i) => (
            <li key={i} className={step.done ? styles.done : styles.now}>
              <span className={styles.dot} aria-hidden="true">
                {step.done ? <Icon name="check" size={20} /> : <Spinner size={20} />}
              </span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
