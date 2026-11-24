import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnswers, useCustomSessions, useOpenSession, useSessionLogs } from '@/app/data';
import { nextSession } from '@/app/programme-state';
import { constraintsRepo, type Constraints } from '@/db/constraints';
import { repo, type Repo } from '@/db/repo';
import type { EquipmentInventory, Language, Profile, Programme } from '@/domain';
import { activeSwaps, issueKey, placedItems, type SlotChange } from '@/engine';
import { InPlaceCause, InPlaceNotes } from './InPlaceNotes';
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
  /** `constraints` mode: called after the re-picked programme and the constraints are saved. */
  onApplied?: (info: { changes: number }) => void;
  /** Injected for tests. */
  store?: Pick<Repo, 'activateProgramme'> & Pick<Constraints, 'saveConstraints'>;
}

/** The in-place preview's reason for a removed slot is keyed by session and slot. */
const causeKey = (change: SlotChange) => `${change.sessionId}|${change.slot.replace(/-\d+$/, '')}`;

export function ChangePreviewSheet(props: ChangePreviewProps) {
  const { mode, current, profile, equipment, onClose } = props;
  const { t } = useTranslation();
  const custom = useCustomSessions();
  const answers = useAnswers();
  const customIds = useMemo(() => (custom ? new Set(custom.map((s) => s.id)) : null), [custom]);
  const swaps = useMemo(() => (answers ? activeSwaps(answers) : null), [answers]);
  const painful = swaps?.painful ?? null;
  const logs = useSessionLogs();
  const data = useMemo(
    () =>
      mode && customIds && painful && logs && swaps
        ? previewData(mode, current, profile, equipment, customIds, painful, logs, swaps)
        : null,
    [mode, current, profile, equipment, customIds, painful, logs, swaps],
  );
  const empty =
    mode === 'variant' && data !== null && data.changes.length === 0 && !data.splitChanged;
  const eyebrow =
    mode === 'variant'
      ? 'programme.preview.variantEyebrow'
      : mode === 'constraints'
        ? 'settings.preview.constraintsEyebrow'
        : 'programme.preview.newEyebrow';
  return (
    <Sheet
      open={mode !== null && data !== null}
      onClose={onClose}
      title={
        mode && data ? (
          <>
            <span className={styles.eyebrow}>{t(eyebrow)}</span>
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
  const { next, changes, sizeChanged, inPlace } = data;
  const number = sizeChanged ? next.rotation.length : changes.length;
  if (inPlace && changes.length === 0)
    return <span className={styles.big}>{t('settings.preview.noChangeTitle')}</span>;
  if (!sizeChanged && changes.length === 0)
    return <span className={styles.big}>{t('programme.preview.sameExercises')}</span>;
  return (
    <span className={styles.count}>
      <span className={styles.countN}>{number}</span>
      <span className={styles.countLabel}>
        {sizeChanged
          ? t('programme.preview.sessionsInstead', { count: number, old: data.oldSize })
          : inPlace && inPlace.added.length === 0 && inPlace.lifted.length > 0
            ? t('settings.preview.comeBack', { count: number })
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
  onApplied,
  data,
  empty,
  store = { ...repo, saveConstraints: constraintsRepo.saveConstraints },
}: ChangePreviewProps & { mode: PreviewMode; data: PreviewData; empty: boolean }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const toast = useToast();
  const logs = useSessionLogs();
  const openSession = useOpenSession();
  const [saving, setSaving] = useState(false);
  const { next, changes, splitChanged } = data;

  const inPlace = data.inPlace;
  const confirm = async () => {
    setSaving(true);
    try {
      if (mode === 'constraints') {
        await store.saveConstraints(profile, next);
        toast.show({
          message: t(
            changes.length > 0
              ? 'settings.constraints.saved'
              : 'settings.constraints.savedNoChange',
          ),
        });
        onApplied?.({ changes: changes.length });
        onClose();
        return;
      }
      await store.activateProgramme(next);
      toast.show({
        message: t(mode === 'new' ? 'programme.preview.doneNew' : 'programme.preview.doneVariant'),
      });
      onClose();
    } catch (error) {
      if (mode !== 'constraints') throw error;
      toast.show({ message: t('settings.preview.failed'), tone: 'error' });
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
  // Re-picking in place keeps the user's edits where their slot stays: only the ones that no
  // longer apply are worth listing.
  const shownLedger =
    data.ledger && inPlace ? { kept: [], dropped: data.ledger.dropped } : data.ledger;
  const ledger =
    shownLedger && shownLedger.kept.length + shownLedger.dropped.length > 0
      ? ledgerRows(t, lang, current, shownLedger, {
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
          {mode === 'constraints'
            ? changes.length === 0
              ? t('settings.preview.noChangeBody')
              : t('settings.preview.keptInPlace', { week })
            : mode === 'variant'
              ? t('programme.preview.keptVariant', { week })
              : splitChanged
                ? t('programme.preview.keptNewSplit', { days: profile.daysPerWeek })
                : t('programme.preview.keptNew')}
        </span>
      </p>

      {ledger ? <EditsLedger ledger={ledger} /> : null}
      {checks.length > 0 && !inPlace ? (
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
                {change.to || !inPlace?.causes[causeKey(change)] ? (
                  <span className={styles.swapNew}>
                    {change.to ? exerciseName(change.to, lang) : t('programme.preview.removed')}
                  </span>
                ) : null}
                {!change.to && inPlace ? (
                  <InPlaceCause cause={inPlace.causes[causeKey(change)]} />
                ) : null}
              </div>
            ))}
          </section>
        ))
      )}

      {inPlace ? <InPlaceNotes data={inPlace} lang={lang} sessionTitle={sessionTitle} /> : null}

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
          {t(
            mode === 'constraints'
              ? changes.length === 0
                ? 'settings.preview.save'
                : 'settings.preview.apply'
              : mode === 'variant'
                ? 'programme.preview.useVariant'
                : 'programme.preview.useNew',
          )}
        </Button>
        <Button variant="secondary" fullWidth onClick={onClose}>
          {t(
            mode === 'constraints'
              ? 'settings.preview.cancel'
              : mode === 'variant'
                ? 'programme.preview.keepCurrent'
                : 'programme.preview.keepCurrentNew',
          )}
        </Button>
      </div>
    </div>
  );
}
