import type { TFunction } from 'i18next';
import type { Language, SessionLog } from '@/domain';
import type { ProgrammeRecord } from '@/db';
import { sessionIdentity } from '../../programme/format';

export interface LogIdentity {
  /** Rotation letter of a programme session. */
  letter?: string;
  /** Name without the letter. */
  title: string;
  kind: SessionLog['source']['kind'];
  /** A day made only of cardio. */
  cardio?: boolean;
  /** A cooldown: the session it followed. */
  afterLogId?: string;
}

/** How a logged session is named: its letter and title in its programme, else its own name. */
export function logIdentity(
  log: Pick<SessionLog, 'plan' | 'source'>,
  programmes: readonly ProgrammeRecord[],
  lang: Language,
): LogIdentity {
  const kind = log.source.kind;
  if (log.source.kind === 'programme') {
    const { programmeId } = log.source;
    const programme = programmes.find((p) => p.id === programmeId);
    const identity = sessionIdentity(log.plan, lang, programme?.rotation);
    return {
      ...(identity.letter && { letter: identity.letter }),
      title: identity.title,
      kind,
      ...(identity.cardio && { cardio: true }),
    };
  }
  if (log.source.kind === 'cooldown')
    return {
      title: log.plan.name[lang],
      kind,
      ...(log.source.afterLogId && { afterLogId: log.source.afterLogId }),
    };
  return { title: log.plan.name[lang], kind };
}

/** The session a cooldown followed, named as a short phrase ("session A", "Quick session"). */
export function afterName(
  t: TFunction,
  identity: LogIdentity,
  logs: readonly SessionLog[],
  programmes: readonly ProgrammeRecord[],
  lang: Language,
): string | undefined {
  const after = identity.afterLogId ? logs.find((l) => l.id === identity.afterLogId) : undefined;
  if (!after) return undefined;
  const of = logIdentity(after, programmes, lang);
  return of.letter ? t('progress.sessions.afterLetter', { letter: of.letter }) : of.title;
}
