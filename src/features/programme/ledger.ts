import type { TFunction } from 'i18next';
import { exerciseById } from '@/catalogue';
import type { EquipmentInventory, Language, Programme } from '@/domain';
import {
  equipmentCapabilities,
  generatedSession,
  missingKinds,
  programmeWithSlots,
  type CarriedEdit,
} from '@/engine';
import { editLine, ledgerWhat } from './edits';
import { exerciseName, sessionIdentity } from './format';

export interface LedgerRow {
  id: string;
  /** "Session B, Pull: 5 sets instead of 4". */
  where: string;
  /** Exercise or session name, on its own line. */
  name: string;
  /** Why a dropped change no longer applies. */
  why?: string;
}

export interface Ledger {
  kept: LedgerRow[];
  dropped: LedgerRow[];
  /** The split changed and none of the changes survives: one line and a list behind a disclosure. */
  splitChanged: boolean;
}

/** Kinds with a line of their own in the "needs …" reason (household items are always there). */
const hasEquipmentLine = (t: TFunction, kind: string): boolean =>
  t(`programme.preview.edits.equip.${kind}`, { defaultValue: '' }) !== '';

/** Rows for the edits ledger of the regenerate preview. */
export function ledgerRows(
  t: TFunction,
  lang: Language,
  current: Programme,
  carried: { kept: CarriedEdit[]; dropped: CarriedEdit[] },
  next: { rotationIds: string[]; days: number; inventory: EquipmentInventory },
): Ledger {
  const withSlots = programmeWithSlots(current);
  const capabilities = equipmentCapabilities(next.inventory);

  const row = (edit: CarriedEdit, index: number): LedgerRow => {
    const session = withSlots.rotation.find((s) => s.id === edit.sessionId);
    const identity = session ? sessionIdentity(session, lang, withSlots.rotation) : undefined;
    // A placed session keeps its custom name; the generated one names the slot.
    const generated = generatedSession(withSlots, edit.sessionId);
    const slotIdentity = generated
      ? sessionIdentity(generated, lang, withSlots.rotation)
      : identity;
    const line = session && generated && edit.slot ? editLine(session, generated, edit.slot) : null;
    const what = ledgerWhat(t, edit.kind, line);
    const title = slotIdentity?.title ?? edit.sessionId;
    const where = slotIdentity?.letter
      ? t('programme.preview.edits.where', { letter: slotIdentity.letter, session: title, what })
      : t('programme.preview.edits.whereNoLetter', { session: title, what });
    const name =
      edit.kind === 'placement' || edit.kind === 'session'
        ? (session?.name[lang] ?? '')
        : edit.exerciseId
          ? exerciseName(edit.exerciseId, lang)
          : '';
    let why: string | undefined;
    if (edit.reason === 'session-gone')
      why = slotIdentity?.letter
        ? t('programme.preview.edits.why.sessionGone', {
            letter: slotIdentity.letter,
            days: next.days,
          })
        : t('programme.preview.edits.why.sessionGoneNoLetter', { days: next.days });
    else if (edit.reason === 'slot-gone') why = t('programme.preview.edits.why.slotGone');
    else if (edit.reason === 'unusable') {
      const exercise = edit.exerciseId ? exerciseById.get(edit.exerciseId) : undefined;
      const missing = exercise
        ? missingKinds(exercise, capabilities).find((kind) => hasEquipmentLine(t, kind))
        : undefined;
      why =
        edit.kind === 'placement'
          ? t('programme.preview.edits.why.placementUnusable')
          : missing
            ? t('programme.preview.edits.why.equipment', {
                equipment: t(`programme.preview.edits.equip.${missing}`),
              })
            : t('programme.preview.edits.why.unusable');
    }
    return {
      id: `${edit.sessionId}:${edit.kind}:${edit.slot ?? ''}:${index}`,
      where,
      name,
      ...(why ? { why } : {}),
    };
  };

  const splitChanged =
    withSlots.rotation.map((s) => s.id).join('|') !== next.rotationIds.join('|') &&
    carried.kept.length === 0 &&
    carried.dropped.length > 0;
  return {
    kept: carried.kept.map(row),
    dropped: carried.dropped.map(row),
    splitChanged,
  };
}
