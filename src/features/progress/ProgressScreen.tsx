import { useTranslation } from 'react-i18next';
import { navigate } from '@/app/router';
import { Button, Dock } from '@/ui/components';
import shared from '@/features/placeholder/placeholder.module.css';
import styles from './ProgressScreen.module.css';

const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Empty until sessions are logged: a ghost of the chart that will fill in. */
export function ProgressScreen() {
  const { t } = useTranslation();
  return (
    <>
      <div className={shared.empty}>
        <h1 className={shared.display}>{t('progress.title')}</h1>
        <div className={styles.chart} aria-hidden="true">
          <div className={styles.y}>
            <span>{t('labels.unit.kg')}</span>
            <span />
            <span />
            <span />
            <span>0</span>
          </div>
          <div className={styles.grid} />
          <div className={styles.x}>
            {WEEKS.map((week) => (
              <span key={week}>{t('progress.weekShort', { week })}</span>
            ))}
          </div>
        </div>
        <div className={styles.emptyBody}>
          <h2 className={shared.title}>{t('progress.emptyTitle')}</h2>
          <p className={shared.body}>{t('progress.emptyBody')}</p>
        </div>
      </div>
      <Dock>
        <Button size="player" fullWidth onClick={() => navigate({ name: 'programme' })}>
          {t('progress.seeNext')}
        </Button>
      </Dock>
    </>
  );
}
