import { useMemo } from 'react';
import { exerciseById } from '@/catalogue';
import {
  useActiveProgramme,
  useCustomSessions,
  useEquipment,
  useProfile,
  useSessionLogs,
} from '@/app/data';
import type { CustomSessionRecord } from '@/db';
import type { Language } from '@/domain';
import { checkSession, placesOf, type EditContext } from '@/engine';
import { sessionIdentity } from '../programme/format';
import { lastDone, sessionFocus, sortRows, unusableIssues } from './logic';

/** What the checks need to know about the person. */
export function useEditContext(): EditContext | undefined {
  const profile = useProfile();
  const equipment = useEquipment();
  return useMemo(
    () =>
      profile && equipment ? { profile, inventory: equipment, exercises: exerciseById } : undefined,
    [profile, equipment],
  );
}

export interface MineRow {
  id: string;
  session: CustomSessionRecord;
  focus: ReturnType<typeof sessionFocus>;
  lastDone: Date | undefined;
  /** Letters of the programme sessions it replaces. */
  placedLetters: string[];
  /** Exercises that can no longer be done with today's equipment. */
  unusable: number;
  updatedAt: number;
}

/** The user's own sessions, newest used first; undefined while loading. */
export function useMineRows(lang: Language): MineRow[] | undefined {
  const customs = useCustomSessions();
  const logs = useSessionLogs();
  const record = useActiveProgramme();
  const ctx = useEditContext();
  return useMemo(() => {
    if (!customs || !logs || record === undefined || !ctx) return undefined;
    const rows = customs.map((session): MineRow => {
      const places = record ? placesOf(record, session.id) : [];
      return {
        id: session.id,
        session,
        focus: sessionFocus(session, exerciseById),
        lastDone: lastDone(
          logs,
          session,
          record ? { programmeId: record.id, sessionIds: places } : undefined,
        ),
        placedLetters: record
          ? places.map((id) => {
              const entry = record.rotation.find((s) => s.id === id);
              return entry ? (sessionIdentity(entry, lang, record.rotation).letter ?? '') : '';
            })
          : [],
        unusable: unusableIssues(checkSession(session, ctx)).length,
        updatedAt: Date.parse(session.updatedAt),
      };
    });
    return sortRows(rows);
  }, [customs, logs, record, ctx, lang]);
}
