import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnswers, useCustomSessions, useOpenSession, useSessionLogs } from '@/app/data';
import { nextSession } from '@/app/programme-state';
import { repo, type Repo } from '@/db/repo';
import type { EquipmentInventory, Language, Profile, Programme } from '@/domain';
import { activeSwaps, issueKey, placedItems, type SlotChange } from '@/engine';
import { exerciseById } from '@/catalogue';
import { issueText } from '../editor/issueText';
import { Button, Icon, IssueLine, Sheet, useToast } from '@/ui/components';
import { EditsLedger } from './EditsLedger';
import { exerciseName, programmeIdentities } from './format';
import { ledgerRows } from './ledger';
import { previewData, type PreviewData, type PreviewMode } from './preview';
import styles from './Sheets.module.css';

export interface ChangePreviewProps {
  mode: PreviewMode | null;
  current: Programme;
  profile: Profile;
  equipment: EquipmentInventory;
  onClose: () => void;
  onEquipment: () => void;
  /** Injected for tests. */
  store?: Pick<Repo, 'activateProgramme'>;
}

export function ChangePreviewSheet(props: ChangePreviewProps) {
  const { mode, current, profile, equipment, onClose } = props;
  const { t } = useTranslation();
  const custom = useCustomSessions();
  const answers = useAnswers();
  const customIds = useMemo(() => (custom ? new Set(custom.map((s) => s.id)) : null), [custom]);
  const painful = useMemo(() => (answers ? activeSwaps(answers).painful : null), [answers]);
  const logs = useSessionLogs();
  const data = useMemo(
    () =>
      mode && customIds && painful && logs
        ? previewData(mode, current, profile, equipment, customIds, painful, logs)
        : null,
    [mode, current, profile, equipment, customIds, painful, logs],
  );
  const empty =
    mode === 'variant' && data !== null && data.changes.length === 0 && !data.splitChanged;
  return (
    <Sheet
      open={mode !== null && data !== null}
      onClose={onClose}
      title={
        mode && data ? (
          <>
            <span className={styles.eyebrow}>
              {t(
                mode === 'variant'
                  ? 'programme.preview.variantEyebrow'
                  : 'programme.preview.newEyebrow',
              )}
            </span>
            {empty ? (
              <span className={styles.big}>{t('programme.preview.noneTitle')}</span>
            ) : (
              <Headline data={data} />
            )}
          </>
        ) : null
      }
    >
      {mode && data ? <Preview {...props} mode={mode} data={data} empty={empty} /> : null}
    </Sheet>
  );
}

function Headline({ data }: { data: PreviewData }) {
  const { t } = useTranslation();
  const { next, changes, sizeChanged } = data;
  const number = sizeChanged ? next.rotation.length : changes.length;
  if (!sizeChanged && changes.length === 0)
    return <span className={styles.big}>{t('programme.preview.sameExercises')}</span>;
  return (
    <span className={styles.count}>
      <span className={styles.countN}>{number}</span>
      <span className={styles.countLabel}>
        {sizeChanged
          ? t('programme.preview.sessionsInstead', { count: number, old: data.oldSize })
          : t('programme.preview.exercisesChange', { count: number })}
      </span>
    </span>
  );
}

function Preview({
  mode,
  current,
  profile,
  equipment,
  onClose,
  onEquipment,
  data,
  empty,
  store = repo,
}: ChangePreviewProps & { mode: PreviewMode; data: PreviewData; empty: boolean }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const toast = useToast();
  const logs = useSessionLogs();
  const openSession = useOpenSession();
  const [saving, setSaving] = useState(false);
  const { next, changes, splitChanged } = data;

  const confirm = async () => {
    setSaving(true);
    try {
      await store.activateProgramme(next);
      toast.show({
        message: t(mode === 'new' ? 'programme.preview.doneNew' : 'programme.preview.doneVariant'),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (empty)
    return (
      <div className={styles.body}>
        <p className={`${styles.p} ${styles.muted}`}>{t('programme.preview.noneBody')}</p>
        <Button variant="secondary" fullWidth onClick={onEquipment}>
          {t('programme.menu.equipment')}
        </Button>
        <button type="button" className={styles.linkButton} onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    );

  const sessionTitle = (id: string): string => {
    const found =
      next.rotation.find((s) => s.id === id) ?? current.rotation.find((s) => s.id === id);
    return found ? found.name[lang] : id;
  };
  const bySession = new Map<string, SlotChange[]>();
  for (const change of changes) {
    const list = bySession.get(change.sessionId) ?? [];
    list.push(change);
    bySession.set(change.sessionId, list);
  }
  const week = nextSession(current, logs).week;
  const slotExercise = (sessionId: string, slot: string | undefined) => {
    const session = next.rotation.find((x) => x.id === sessionId);
    if (!session || !slot) return undefined;
    return [...placedItems(session)].find((p) => p.item.slot === slot)?.item.exerciseId;
  };
  // What the sessions carrying the user's changes now warn about.
  const inventory = next.generation?.equipment ?? equipment;
  const checks = Object.entries(data.issues).flatMap(([sessionId, issues]) =>
    issues
      .filter((issue) => issue.level === 'warn')
      .map((issue) => ({
        id: `${sessionId}|${issueKey(issue)}`,
        text: t('programme.preview.edits.check', {
          session: sessionTitle(sessionId),
          issue: issueText(t, issue, {
            lang,
            inventory,
            exercise: exerciseById.get(
              String(issue.params?.exerciseId ?? slotExercise(sessionId, issue.ref?.slot) ?? ''),
            ),
            exercises: exerciseById,
          }),
        }),
      })),
  );
  const ledger =
    data.ledger && data.ledger.kept.length + data.ledger.dropped.length > 0
      ? ledgerRows(t, lang, current, data.ledger, {
          rotationIds: next.rotation.map((s) => s.id),
          days: next.generation?.profile.daysPerWeek ?? profile.daysPerWeek,
          inventory: next.generation?.equipment ?? equipment,
        })
      : null;

  return (
    <div className={styles.body}>
      <p className={styles.kept}>
        <Icon name="check" size={20} />
        <span>
          {mode === 'variant'
            ? t('programme.preview.keptVariant', { week })
            : splitChanged
              ? t('programme.preview.keptNewSplit', { days: profile.daysPerWeek })
              : t('programme.preview.keptNew')}
        </span>
      </p>

      {ledger ? <EditsLedger ledger={ledger} /> : null}
      {checks.length > 0 ? (
        <section className={styles.checks} aria-label={t('programme.preview.edits.checkTitle')}>
          <h3 className={styles.checksTitle}>{t('programme.preview.edits.checkTitle')}</h3>
          {checks.map((check) => (
            <IssueLine key={check.id} level="warn">
              {check.text}
            </IssueLine>
          ))}
        </section>
      ) : null}

      {splitChanged ? (
        <div className={styles.compare}>
          <div className={styles.compareCol}>
            <h3 className={styles.compareHead}>{t('programme.preview.today')}</h3>
            {programmeIdentities(current, lang).map((identity, i) => (
              <div key={current.rotation[i]!.id} className={styles.compareRow}>
                <span className={styles.letter}>
                  {identity.letter ?? <Icon name="heart" size={20} />}
                </span>
                {identity.title}
              </div>
            ))}
          </div>
          <div className={styles.compareCol}>
            <h3 className={styles.compareHead}>{t('programme.preview.new')}</h3>
            {programmeIdentities(next, lang).map((identity, i) => (
              <div key={next.rotation[i]!.id} className={styles.compareRow}>
                <span className={`${styles.letter} ${styles.letterNew}`}>
                  {identity.letter ?? <Icon name="heart" size={20} />}
                </span>
                {identity.title}
              </div>
            ))}
          </div>
        </div>
      ) : (
        [...bySession.entries()].map(([sessionId, list]) => (
          <section key={sessionId} className={styles.session}>
            <h3 className={styles.sessionName}>{sessionTitle(sessionId)}</h3>
            {list.map((change) => (
              <div
                key={change.slot}
                className={`${styles.swap} ${!change.from ? styles.swapAdd : !change.to ? styles.swapRemove : ''}`}
              >
                <span className={styles.rail}>
                  <i />
                </span>
                {change.from ? (
                  <span className={styles.swapOld}>{exerciseName(change.from, lang)}</span>
                ) : null}
                <span className={styles.swapNew}>
                  {change.to ? exerciseName(change.to, lang) : t('programme.preview.removed')}
                </span>
              </div>
            ))}
          </section>
        ))
      )}

      {mode === 'new' ? (
        <p className={styles.notice}>
          <Icon name="calendar" size={20} />
          <span>{t('programme.preview.restart')}</span>
        </p>
      ) : null}

      {openSession?.source.kind === 'programme' ? (
        <p className={styles.notice}>
          <Icon name="info" size={20} />
          <span>{t('programme.preview.openSession')}</span>
        </p>
      ) : null}

      <div className={styles.foot}>
        <Button loading={saving} fullWidth size="player" onClick={() => void confirm()}>
          {t(mode === 'variant' ? 'programme.preview.useVariant' : 'programme.preview.useNew')}
        </Button>
        <Button variant="secondary" fullWidth onClick={onClose}>
          {t(
            mode === 'variant'
              ? 'programme.preview.keepCurrent'
              : 'programme.preview.keepCurrentNew',
          )}
        </Button>
      </div>
    </div>
  );
}
