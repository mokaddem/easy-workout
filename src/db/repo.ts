import type { EquipmentInventory, Language, Profile, Programme, Settings } from '../domain';
import { db as defaultDb, type ProgrammeRecord, type WorkoutDatabase } from './index';

export function defaultSettings(language: Language): Settings {
  return { language, theme: 'system', voice: true, sounds: true, vibration: true };
}

export function createRepo(db: WorkoutDatabase = defaultDb) {
  async function getProfile(): Promise<Profile | undefined> {
    const record = await db.profile.get('me');
    return record && withoutId(record);
  }

  async function saveProfile(profile: Profile): Promise<void> {
    await db.profile.put({ ...profile, id: 'me' });
  }

  async function getSettings(fallbackLanguage: Language): Promise<Settings> {
    const record = await db.settings.get('settings');
    return record ? withoutId(record) : defaultSettings(fallbackLanguage);
  }

  async function saveSettings(settings: Settings): Promise<void> {
    await db.settings.put({ ...settings, id: 'settings' });
  }

  function getEquipment(): Promise<EquipmentInventory> {
    return db.equipment.toArray();
  }

  /** The inventory is edited as a whole, so it is stored as a whole. */
  async function replaceEquipment(items: EquipmentInventory): Promise<void> {
    await db.transaction('rw', db.equipment, async () => {
      await db.equipment.clear();
      await db.equipment.bulkPut(items);
    });
  }

  function getActiveProgramme(): Promise<ProgrammeRecord | undefined> {
    return db.programmes.where('status').equals('active').first();
  }

  /**
   * Makes `programme` the active one. The previous programme is kept as archived,
   * not deleted, so its history stays available.
   */
  async function activateProgramme(
    programme: Programme,
    now = new Date(),
  ): Promise<ProgrammeRecord> {
    const record: ProgrammeRecord = {
      ...programme,
      id: programmeId(programme, now),
      createdAt: programme.createdAt ?? now.toISOString(),
      status: 'active',
    };
    await db.transaction('rw', db.programmes, async () => {
      await db.programmes.where('status').equals('active').modify({ status: 'archived' });
      await db.programmes.put(record);
    });
    return record;
  }

  async function markWhySeen(programmeId: string): Promise<void> {
    await db.programmes.update(programmeId, { whySeen: true });
  }

  /** Profile, equipment and first programme are written together, so a half-finished setup never sticks. */
  function completeSetup(
    profile: Profile,
    equipment: EquipmentInventory,
    programme: Programme,
    now = new Date(),
  ): Promise<ProgrammeRecord> {
    return db.transaction('rw', [db.profile, db.equipment, db.programmes], async () => {
      await saveProfile(profile);
      await replaceEquipment(equipment);
      return activateProgramme(programme, now);
    });
  }

  return {
    getProfile,
    saveProfile,
    getSettings,
    saveSettings,
    getEquipment,
    replaceEquipment,
    getActiveProgramme,
    activateProgramme,
    markWhySeen,
    completeSetup,
  };
}

/** Singleton records carry a fixed key that is not part of the domain object. */
function withoutId<T extends { id: string }>(record: T): Omit<T, 'id'> {
  const copy: Partial<T> = { ...record };
  delete copy.id;
  return copy as Omit<T, 'id'>;
}

/** Generated ids describe the inputs, so the same inputs give the same id; stored ids must be unique. */
function programmeId(programme: Programme, now: Date): string {
  return `${programme.id}-${now.getTime().toString(36)}`;
}

export type Repo = ReturnType<typeof createRepo>;
export const repo = createRepo();
