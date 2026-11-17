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
  return { title: log.plan.name[lang], kind };
}
