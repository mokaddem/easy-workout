import { exerciseById } from '@/catalogue';
import type {
  Block,
  EquipmentInventory,
  EquipmentKind,
  Language,
  Programme,
  Session,
  SessionItem,
} from '@/domain';
import { equipmentCapabilities, usableSetups, type WeekPlan } from '@/engine';
import type { IconName } from '@/ui/components';

const HOUSEHOLD: readonly EquipmentKind[] = ['chair', 'wall', 'door', 'table', 'mat'];

export const EQUIPMENT_ICON: Partial<Record<EquipmentKind, IconName>> = {
  dumbbell: 'dumbbell',
  kettlebell: 'kettlebell',
  band: 'band',
  'mini-band': 'miniband',
  'weight-belt': 'belt',
  'weight-vest': 'vest',
  'pull-up-bar': 'bar',
  'dip-bars': 'dips',
  bench: 'bench',
  treadmill: 'treadmill',
  'stationary-bike': 'bike',
  rower: 'rower',
  'jump-rope': 'rope',
  'ab-wheel': 'wheel',
  'suspension-trainer': 'straps',
};

export const isCardioItem = (item: SessionItem): boolean =>
  item.target.kind === 'cardio' || item.target.kind === 'interval';

export const isCardioBlock = (block: Block): boolean =>
  block.type === 'straight' && isCardioItem(block.item);

export const itemsOf = (block: Block): SessionItem[] =>
  block.type === 'straight' ? [block.item] : block.items;

/** A day made only of cardio, like the walk of a 6-day split. */
export const isCardioDay = (session: Session): boolean => session.main.every(isCardioBlock);

export const exerciseName = (id: string, lang: Language): string =>
  exerciseById.get(id)?.name[lang] ?? id;

export interface SessionIdentity {
  /** Rotation letter, absent for cardio days and quick sessions. */
  letter?: string;
  /** Name without the letter: "Push". */
  title: string;
  /** Full name, as shown in lists: "Séance A — Push". */
  fullName: string;
  cardio: boolean;
}

export function sessionIdentity(
  session: Session,
  lang: Language,
  rotation?: readonly Session[],
): SessionIdentity {
  const cardio = isCardioDay(session);
  const fullName = session.name[lang];
  const letterIndex = rotation
    ? rotation.filter((s) => !isCardioDay(s)).findIndex((s) => s.id === session.id)
    : -1;
  const parts = fullName.split(' — ');
  const title = !cardio && parts.length > 1 ? parts.slice(1).join(' — ') : fullName;
  return {
    ...(!cardio && letterIndex >= 0 ? { letter: String.fromCharCode(65 + letterIndex) } : {}),
    title,
    fullName,
    cardio,
  };
}

export const programmeIdentities = (programme: Programme, lang: Language) =>
  programme.rotation.map((session) => sessionIdentity(session, lang, programme.rotation));

/** Exercises of the main section, cardio excluded. */
export const exerciseCount = (session: Session): number =>
  session.main
    .filter((block) => !isCardioBlock(block))
    .reduce((sum, block) => sum + itemsOf(block).length, 0);

/** Minutes of one cardio item (the top of a range). */
export function cardioMinutes(item: SessionItem): number {
  const t = item.target;
  if (t.kind === 'cardio') return t.maxMinutes;
  if (t.kind === 'interval') return Math.round((t.rounds * (t.workSec + t.recoverySec)) / 60);
  return 0;
}

/** The cardio block closing the session, if any: exercise id and minutes. */
export function finisherCardio(session: Session): { exerciseId: string; minutes: number } | null {
  for (const block of session.finisher) {
    if (block.type === 'straight' && isCardioItem(block.item))
      return { exerciseId: block.item.exerciseId, minutes: cardioMinutes(block.item) };
  }
  return null;
}

/** Equipment kinds the session uses, household items left out, in first-use order. */
export function sessionEquipment(
  session: Session,
  inventory?: EquipmentInventory,
): EquipmentKind[] {
  const capabilities = inventory ? equipmentCapabilities(inventory) : null;
  const kinds = new Set<EquipmentKind>();
  for (const block of [...session.warmup, ...session.main, ...session.finisher]) {
    for (const item of itemsOf(block)) {
      const exercise = exerciseById.get(item.exerciseId);
      if (!exercise) continue;
      const setup =
        (capabilities ? usableSetups(exercise, capabilities)[0] : undefined) ??
        exercise.equipment[0] ??
        [];
      for (const requirement of setup)
        if (!HOUSEHOLD.includes(requirement.kind)) kinds.add(requirement.kind);
    }
  }
  return [...kinds];
}

export function formatNumber(value: number, lang: Language): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value);
}

export const range = (min: number, max: number): string =>
  min === max ? `${min}` : `${min}–${max}`;

/** Where in a programme's phases a week sits. */
export function phaseSlug(
  nameEn: string,
): 'readapt' | 'volume' | 'intensity' | 'peak' | 'deload' | 'lighter' | null {
  const key = nameEn.toLowerCase();
  if (key.startsWith('re-adaptation')) return 'readapt';
  if (key.startsWith('volume')) return 'volume';
  if (key.startsWith('intensity')) return 'intensity';
  if (key.startsWith('peak')) return 'peak';
  if (key.startsWith('deload')) return 'deload';
  if (key.startsWith('lighter')) return 'lighter';
  return null;
}

// ---------------------------------------------------------------------------
// Week-to-week changes

export interface BlockDelta {
  unit: 'set' | 'round' | 'min';
  /** Signed. */
  amount: number;
}

export function blockDelta(previous: Block | undefined, current: Block): BlockDelta | null {
  if (!previous || previous.type !== current.type) return null;
  if (current.type === 'straight' && previous.type === 'straight') {
    const a = previous.item.target;
    const b = current.item.target;
    if (a.kind === 'cardio' && b.kind === 'cardio')
      return b.maxMinutes === a.maxMinutes
        ? null
        : { unit: 'min', amount: b.maxMinutes - a.maxMinutes };
    if (a.kind === 'interval' && b.kind === 'interval') {
      const minutes = cardioMinutes(current.item) - cardioMinutes(previous.item);
      return minutes === 0 ? null : { unit: 'min', amount: minutes };
    }
    return current.sets === previous.sets
      ? null
      : { unit: 'set', amount: current.sets - previous.sets };
  }
  if (current.type === 'group' && previous.type === 'group')
    return current.rounds === previous.rounds
      ? null
      : { unit: 'round', amount: current.rounds - previous.rounds };
  return null;
}

/** RIR of the first rep-based main exercise: what the week asks of every set. */
export function weekEffort(session: Session): number | undefined {
  for (const block of session.main)
    for (const item of itemsOf(block))
      if ((item.target.kind === 'reps' || item.target.kind === 'max') && item.rir !== undefined)
        return item.rir;
  return undefined;
}

export interface WeekChanges {
  moreSets: number;
  fewerSets: number;
  cardioMinutes: number;
  effortFrom?: number;
  effortTo?: number;
  firstSetRir?: number;
  lastSetRir?: number;
}

/** What this week asks differently from the previous one, summed over the session. */
export function weekChanges(previous: WeekPlan, current: WeekPlan): WeekChanges {
  const result: WeekChanges = { moreSets: 0, fewerSets: 0, cardioMinutes: 0 };
  const sections = ['main', 'finisher'] as const;
  for (const section of sections) {
    current.session[section].forEach((block, index) => {
      const delta = blockDelta(previous.session[section][index], block);
      if (!delta) return;
      if (delta.unit === 'min') result.cardioMinutes += delta.amount;
      else if (delta.amount > 0) result.moreSets += 1;
      else result.fewerSets += 1;
    });
  }
  const from = weekEffort(previous.session);
  const to = weekEffort(current.session);
  if (from !== undefined && to !== undefined && from !== to) {
    result.effortFrom = from;
    result.effortTo = to;
  }
  if (current.setRir.first !== undefined && current.setRir.first !== previous.setRir.first)
    result.firstSetRir = current.setRir.first;
  if (current.setRir.last !== undefined && current.setRir.last !== previous.setRir.last)
    result.lastSetRir = current.setRir.last;
  return result;
}
