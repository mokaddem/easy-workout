import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Route } from '@/app/router';
import { useActiveProgramme, useEquipment, useProfile } from '@/app/data';
import { sameInventory } from '@/app/programme-state';
import { goBack, useLeaveGuard } from '@/app/router';
import { repo } from '@/db/repo';
import type { EquipmentInventory } from '@/domain';
import type { PurchaseAdvice } from '@/engine';
import { AppBar, Button, Dialog, Dock, Icon, Skeleton, useToast } from '@/ui/components';
import { BuyNextView } from './BuyNextView';
import { EquipmentChecklist } from './EquipmentChecklist';
import { entryOf } from './entries';
import { LiveCount } from './LiveCount';
import { invalidItems } from './validation';
import { useBuyNext } from './useBuyNext';
import styles from './EquipmentScreen.module.css';

type View = 'mine' | 'buy';

export function EquipmentScreen({ route }: { route: Extract<Route, { name: 'equipment' }> }) {
  const stored = useEquipment();
  const profile = useProfile();
  const programme = useActiveProgramme();
  if (stored === undefined) return <Loading />;
  return (
    <Editor
      stored={stored}
      profile={profile}
      programme={programme}
      initialView={route.view === 'buy' ? 'buy' : 'mine'}
    />
  );
}

function Loading() {
  const { t } = useTranslation();
  return (
    <>
      <AppBar title={t('equipment.title')} onBack={goBack} backLabel={t('common.back')} />
      <div className={styles.body}>
        <Skeleton height={76} radius="var(--radius-lg)" />
      </div>
    </>
  );
}

function Editor({
  stored,
  profile,
  programme,
  initialView,
}: {
  initialView: View;
  stored: EquipmentInventory;
  profile: ReturnType<typeof useProfile>;
  programme: ReturnType<typeof useActiveProgramme>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [draft, setDraft] = useState<EquipmentInventory | undefined>(undefined);
  const [view, setView] = useState<View>(initialView);
  const [showErrors, setShowErrors] = useState(false);
  /** Set while the leave dialog is open: leaves the screen when called. */
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState<readonly string[]>([]);
  const [mineKey, setMineKey] = useState(0);
  const current = draft ?? stored;
  const dirty = draft !== undefined && !sameInventory(draft, stored);
  useLeaveGuard(dirty, (proceed) => setLeave(() => proceed));
  const buy = useBuyNext(profile, current, view === 'buy');
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [view]);

  const rotation = useMemo(() => programme?.rotation ?? [], [programme]);

  const change = (next: EquipmentInventory) => setDraft(next);

  async function save() {
    if (invalidItems(current).length > 0) {
      setShowErrors(true);
      setLeave(null);
      setView('mine');
      toast.show({ message: t('equipment.toast.invalid'), tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await repo.replaceEquipment(current);
      toast.show({
        message: programme ? t('equipment.toast.savedOutdated') : t('equipment.toast.saved'),
      });
      setShowErrors(false);
    } finally {
      setSaving(false);
    }
  }

  function own(advice: PurchaseAdvice) {
    const entry = entryOf(advice.item);
    const id = `${entry?.key ?? advice.item.kind}-${Math.random().toString(36).slice(2, 8)}`;
    const item = { ...advice.item, id };
    const before = current;
    const next = [...current.filter((existing) => entryOf(existing) !== entry), item];
    setDraft(next);
    setOpened(entry?.form ? [id] : []);
    setMineKey((n) => n + 1);
    setView('mine');
    toast.show({
      message: t('equipment.toast.added', { name: t(`equipment.buy.names.${advice.id}`) }),
      action: { label: t('common.undo'), onAction: () => setDraft(before) },
    });
  }

  return (
    <>
      <AppBar title={t('equipment.title')} onBack={goBack} backLabel={t('common.back')} />
      <div className={styles.tabs} role="tablist" aria-label={t('equipment.title')}>
        {(['mine', 'buy'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`eq-tab-${id}`}
            aria-selected={view === id}
            aria-controls="eq-panel"
            className={styles.tab}
            onClick={() => {
              setView(id);
            }}
          >
            {t(`equipment.tabs.${id}`)}
          </button>
        ))}
      </div>
      <div
        ref={scroller}
        id="eq-panel"
        role="tabpanel"
        aria-labelledby={`eq-tab-${view}`}
        className={styles.body}
      >
        {view === 'mine' ? (
          <>
            <p className={styles.intro}>{t('equipment.intro')}</p>
            <EquipmentChecklist
              key={mineKey}
              value={current}
              onChange={change}
              showErrors={showErrors}
              initialOpen={opened}
            />
          </>
        ) : (
          <BuyNextView
            state={buy.state}
            rotation={rotation}
            onOwn={own}
            onRetry={buy.retry}
            onBack={() => setView('mine')}
          />
        )}
      </div>
      <Dock>
        {dirty && programme ? (
          <p className={styles.note}>
            <Icon name="info" size={20} />
            <span>{t('equipment.dockNote')}</span>
          </p>
        ) : null}
        <div className={styles.dock}>
          <LiveCount inventory={current} />
          <Button disabled={!dirty} loading={saving} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </div>
      </Dock>
      <Dialog
        open={leave !== null}
        onClose={() => setLeave(null)}
        title={t('equipment.leave.title')}
        description={t('equipment.leave.body')}
        confirmLabel={t('equipment.leave.confirm')}
        cancelLabel={t('equipment.leave.stay')}
        destructive
        onConfirm={() => {
          const proceed = leave;
          setLeave(null);
          proceed?.();
        }}
      />
    </>
  );
}
