import { useLiveQuery } from 'dexie-react-hooks';
import type {
  Answer,
  CheckIn,
  EquipmentInventory,
  Language,
  MaxTest,
  Profile,
  SessionLog,
  Settings,
} from '@/domain';
import type { CustomSessionRecord, ProgrammeRecord } from '@/db';
import { repo } from '@/db/repo';
import i18n from '@/i18n';

/** `undefined` while loading, `null` when absent. */
export type Loaded<T> = T | null | undefined;

export function useProfile(): Loaded<Profile> {
  return useLiveQuery(async () => (await repo.getProfile()) ?? null);
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => repo.getSettings(currentLanguage()));
}

export function useEquipment(): EquipmentInventory | undefined {
  return useLiveQuery(() => repo.getEquipment());
}

export function useActiveProgramme(): Loaded<ProgrammeRecord> {
  return useLiveQuery(async () => (await repo.getActiveProgramme()) ?? null);
}

/** Every session log, oldest first. */
export function useSessionLogs(): SessionLog[] | undefined {
  return useLiveQuery(() => repo.listSessionLogs());
}

/** Every programme, archived ones included. */
export function useProgrammes(): ProgrammeRecord[] | undefined {
  return useLiveQuery(() => repo.listProgrammes());
}

/** Every answer to a proposal, oldest first. */
export function useAnswers(): Answer[] | undefined {
  return useLiveQuery(() => repo.listAnswers());
}

/** Every check-in, oldest first. */
export function useCheckIns(): CheckIn[] | undefined {
  return useLiveQuery(() => repo.listCheckIns());
}

/** Every max test, oldest first. */
export function useMaxTests(): MaxTest[] | undefined {
  return useLiveQuery(() => repo.listMaxTests());
}

/** The user's own sessions, most recently changed first. */
export function useCustomSessions(): CustomSessionRecord[] | undefined {
  return useLiveQuery(() => repo.listCustomSessions());
}

/** One of the user's own sessions; `null` when it doesn't exist. */
export function useCustomSession(id: string | undefined): Loaded<CustomSessionRecord> {
  return useLiveQuery(async () => (id ? ((await repo.getCustomSession(id)) ?? null) : null), [id]);
}

/** One session log by id; `null` when it doesn't exist. */
export function useSessionLog(id: string | undefined): Loaded<SessionLog> {
  return useLiveQuery(async () => (id ? ((await repo.getSessionLog(id)) ?? null) : null), [id]);
}

/** The session being played, if one is open. */
export function useOpenSession(): Loaded<SessionLog> {
  return useLiveQuery(async () => (await repo.getOpenSession()) ?? null);
}

export function updateSettings(change: Partial<Settings>): Promise<void> {
  return repo.updateSettings(change, currentLanguage());
}

function currentLanguage(): Language {
  return i18n.language === 'fr' ? 'fr' : 'en';
}
