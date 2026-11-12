import { useLiveQuery } from 'dexie-react-hooks';
import type { EquipmentInventory, Language, Profile, Settings } from '@/domain';
import type { ProgrammeRecord } from '@/db';
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

export async function updateSettings(change: Partial<Settings>): Promise<void> {
  const current = await repo.getSettings(currentLanguage());
  await repo.saveSettings({ ...current, ...change });
}

function currentLanguage(): Language {
  return i18n.language === 'fr' ? 'fr' : 'en';
}
