import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCustomSessions } from '@/app/data';
import { navigate } from '@/app/router';
import { repo } from '@/db/repo';
import type { Language } from '@/domain';
import { nextCycle, type NextCycle, type SlotChange } from '@/engine';
import { Roll } from '@/motion';
import { Rich, loadText, numberText, tokenOf } from '@/features/adapt';
import { EditsLedger } from '@/features/programme/EditsLedger';
import { exerciseName, sessionIdentity } from '@/features/programme/format';
import { ledgerRows } from '@/features/programme/ledger';
import sheet from '@/features/programme/Sheets.module.css';
import { Button, Icon, Sheet, useToast } from '@/ui/components';
import switchStyles from '@/ui/components/Switch.module.css';
import { NBSP, cycleNumber } from './review';
import { itemOf, upgradeReason } from './next';
import type { CycleData } from './useCycleData';
import styles from './NextCycleSheet.module.css';

export interface NextCycleSheetProps {
  open: boolean;
  onClose: () => void;
  data: CycleData & {
    record: NonNullable<CycleData['record']>;
    review: NonNullable<CycleData['review']>;
  };
}

/** What starting the next cycle changes, with a switch for each harder version, then Start. */
export function NextCycleSheet({ open, onClose, data }: NextCycleSheetProps) {
  const custom = useCustomSessions();
  const [declined, setDeclined] = useState<ReadonlySet<string>>(new Set());
  const customIds = useMemo(() => (custom ? new Set(custom.map((s) => s.id)) : null), [custom]);
  const result = useMemo(
    () =>
      open && customIds
        ? nextCycle({
            previous: data.record,
            profile: data.profile,
            equipment: data.equipment,
            progress: data.progress,
            customIds,
            declined,
          })
        : null,
    [open, customIds, data.record, data.profile, data.equipment, data.progress, declined],
  );
  return (
    <Sheet
      open={open && result !== null}
      onClose={onClose}
      title={result ? <Headline result={result} /> : null}
      footer={result ? <Footer data={data} result={result} onClose={onClose} /> : null}
    >
      {result ? (
        <Body
          data={data}
          result={result}
          declined={declined}
          onToggle={(from) =>
            setDeclined((prev) => {
              const next = new Set(prev);
              if (next.has(from)) next.delete(from);
              else next.add(from);
              return next;
            })
          }
        />
      ) : null}
    </Sheet>
  );
}

function Headline({ result }: { result: NextCycle }) {
  const { t } = useTranslation();
  const whole = result.splitChanged || result.newGoal;
  const count = whole ? result.programme.rotation.length : result.changes.length;
  return (
    <>
      <span className={sheet.eyebrow}>
        {t('cycle.next.eyebrow', {
          programme: t(`labels.goal.${result.programme.goal}`),
          n: result.cycle,
        })}
      </span>
      {count === 0 ? (
        <span className={sheet.big}>{t('cycle.next.none')}</span>
      ) : (
        <span className={sheet.count}>
          <Roll value={count} className={sheet.countN}>
            {count}
          </Roll>
          <span className={sheet.countLabel}>
            {whole ? t('cycle.next.sessionsNew', { count }) : t('cycle.next.count', { count })}
          </span>
        </span>
      )}
    </>
  );
}

function Body({
  data,
  result,
  declined,
  onToggle,
}: {
  data: NextCycleSheetProps['data'];
  result: NextCycle;
  declined: ReadonlySet<string>;
  onToggle: (from: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const { record, profile, equipment } = data;
  const { programme, upgrades, changes } = result;
  const levelUp =
    profile.level === 'intermediate' && record.generation?.profile.level !== 'intermediate';
  const upgraded = new Set(upgrades.map((u) => u.from));
  const rotated = changes.filter((c) => !(c.from && upgraded.has(c.from)));
  const bySession = new Map<string, SlotChange[]>();
  for (const change of rotated) {
    const list = bySession.get(change.sessionId) ?? [];
    list.push(change);
    bySession.set(change.sessionId, list);
  }
  const sessionTitle = (id: string) =>
    (programme.rotation.find((x) => x.id === id) ?? record.rotation.find((x) => x.id === id))?.name[
      lang
    ] ?? id;
  const ledger =
    result.ledger && result.ledger.kept.length + result.ledger.dropped.length > 0
      ? ledgerRows(t, lang, record, result.ledger, {
          rotationIds: programme.rotation.map((s) => s.id),
          days: programme.generation?.profile.daysPerWeek ?? profile.daysPerWeek,
          inventory: programme.generation?.equipment ?? equipment,
        })
      : null;

  return (
    <div className={sheet.body}>
      {result.newGoal ? (
        <p className={sheet.kept}>
          <Icon name="info" size={20} />
          <span>{t('cycle.next.newGoal')}</span>
        </p>
      ) : result.splitChanged ? (
        <p className={sheet.kept}>
          <Icon name="check" size={20} />
          <span>{t('programme.preview.keptNewSplit', { days: profile.daysPerWeek })}</span>
        </p>
      ) : (
        <p className={sheet.kept}>
          <Icon name="check" size={20} />
          <span>{t('cycle.next.kept', { weeks: programme.weeks })}</span>
        </p>
      )}
      {levelUp ? (
        <p className={sheet.kept}>
          <Icon name="user" size={20} />
          <span>{t('cycle.next.level')}</span>
        </p>
      ) : null}

      {ledger ? <EditsLedger ledger={ledger} /> : null}

      {upgrades.length > 0 ? (
        <section className={styles.group}>
          <h3 className={styles.groupTitle}>
            <Icon name="step-up" size={20} />
            {t('cycle.next.harderTitle')}
          </h3>
          <p className={styles.groupSub}>{t('cycle.next.harderSub')}</p>
          <div>
            {upgrades.map((upgrade) => {
              const off = declined.has(upgrade.from);
              const found = itemOf(record, upgrade.from);
              const identity = found
                ? sessionIdentity(found.session, lang, record.rotation)
                : undefined;
              const reason = upgradeReason(upgrade, record, data.review, data.logs, data.maxTests);
              const letter = identity?.letter ?? '';
              const why = off ? (
                t('cycle.next.keptExercise')
              ) : reason.kind === 'kit' ? (
                <Rich
                  text={t('cycle.next.harderKit', {
                    letter,
                    load: loadText(t, lang, tokenOf(reason.load)),
                  })}
                />
              ) : reason.kind === 'test' ? (
                <Rich
                  text={t('cycle.next.harderTest', {
                    letter,
                    value: `${numberText(reason.value, lang)}${NBSP}${t('labels.unit.reps')}`,
                  })}
                />
              ) : reason.kind === 'ladder' ? (
                t('cycle.next.harderLadder', { letter, times: reason.times })
              ) : letter ? (
                t('cycle.next.harderPlain', { letter })
              ) : (
                t('cycle.next.harderNoLetter')
              );
              const newName = exerciseName(upgrade.to, lang);
              return (
                <div
                  key={upgrade.from}
                  className={`${sheet.swap} ${styles.up} ${off ? styles.off : ''}`}
                >
                  <span className={sheet.rail} aria-hidden="true">
                    <i />
                  </span>
                  <span className={`${sheet.swapOld} ${styles.col2}`}>
                    {exerciseName(upgrade.from, lang)}
                  </span>
                  <span className={`${sheet.swapNew} ${styles.newName} ${styles.col2}`}>
                    {newName}
                  </span>
                  <span className={styles.why}>{why}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!off}
                    aria-label={t('cycle.next.upgradeLabel', { name: newName })}
                    className={styles.toggle}
                    onClick={() => onToggle(upgrade.from)}
                  >
                    <span className={switchStyles.switch} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {!result.splitChanged && !result.newGoal && bySession.size > 0 ? (
        <section className={styles.group}>
          <h3 className={styles.groupTitle}>
            <Icon name="shuffle" size={20} />
            {t('cycle.next.rotatedTitle')}
          </h3>
          <p className={styles.groupSub}>{t('cycle.next.rotatedSub')}</p>
          {[...bySession.entries()].map(([sessionId, list]) => (
            <div key={sessionId} className={sheet.session}>
              <h4 className={sheet.sessionName}>{sessionTitle(sessionId)}</h4>
              {list.map((change) => (
                <div
                  key={change.slot}
                  className={`${sheet.swap} ${!change.from ? sheet.swapAdd : !change.to ? sheet.swapRemove : ''}`}
                >
                  <span className={sheet.rail} aria-hidden="true">
                    <i />
                  </span>
                  {change.from ? (
                    <span className={sheet.swapOld}>{exerciseName(change.from, lang)}</span>
                  ) : null}
                  <span className={sheet.swapNew}>
                    {change.to ? exerciseName(change.to, lang) : t('programme.preview.removed')}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </section>
      ) : null}

      <p className={sheet.notice}>
        <Icon name="info" size={20} />
        <span>{t('cycle.next.archived', { n: cycleNumber(record) })}</span>
      </p>
    </div>
  );
}

function Footer({
  data,
  result,
  onClose,
}: {
  data: NextCycleSheetProps['data'];
  result: NextCycle;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const start = async () => {
    setSaving(true);
    try {
      await repo.startNextCycle(data.record.id, result.programme);
      onClose();
      navigate({ name: 'programme' });
      toast.show({ message: t('cycle.next.done', { next: result.cycle }) });
    } catch {
      toast.show({ message: t('cycle.next.error') });
      setSaving(false);
    }
  };
  return (
    <div className={styles.foot}>
      <Button size="player" fullWidth loading={saving} onClick={() => void start()}>
        {t('cycle.next.start', { next: result.cycle })}
      </Button>
      <Button variant="secondary" fullWidth onClick={onClose}>
        {t('cycle.next.notNow')}
      </Button>
    </div>
  );
}
