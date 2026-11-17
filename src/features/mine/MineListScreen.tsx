import { useTranslation } from 'react-i18next';
import { goBack } from '@/app/router';
import { IconButton } from '@/ui/components';
import { MineSection } from './MineSection';
import styles from './Mine.module.css';

/** Every session of the user's own. */
export function MineListScreen() {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.bar}>
        <IconButton icon="back" label={t('mine.list.back')} onClick={goBack} />
      </div>
      <div className={styles.scroll}>
        <div className={styles.page}>
          <MineSection all />
        </div>
      </div>
    </>
  );
}
