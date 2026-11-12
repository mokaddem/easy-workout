import { useTranslation } from 'react-i18next';
import { goBack } from '@/app/router';
import { AppBar, EmptyState, type IconName } from '@/ui/components';

/** Stands in for screens that are not built yet. */
export function PlaceholderScreen({
  title,
  icon,
  back = false,
}: {
  title: string;
  icon: IconName;
  back?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <AppBar title={title} {...(back ? { onBack: goBack, backLabel: t('common.back') } : {})} />
      <EmptyState icon={icon} title={title} description={t('common.comingSoon')} />
    </>
  );
}
