import { Trans } from 'react-i18next';
import { useGlyphs } from './useGlyphs';
import type { StepPlan } from './plan';
import styles from './InstallSteps.module.css';

/** The numbered steps to install: a real sequence, so real numbers. */
export function InstallSteps({ steps }: { steps: readonly StepPlan[] }) {
  const glyphs = useGlyphs();
  const small = useGlyphs(true);
  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => (
        <li key={step.id} className={styles.step}>
          {/* The list numbers itself for assistive tech. */}
          <span className={styles.n} aria-hidden="true">
            {index + 1}
          </span>
          <div className={styles.body}>
            <p className={styles.title}>
              <Trans i18nKey={`install.step.${step.id}`} components={glyphs} />
            </p>
            {step.meta ? (
              <p className={styles.meta}>
                <Trans i18nKey={`install.step.${step.meta}`} components={small} />
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
