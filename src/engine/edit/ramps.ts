import type { Session } from '../../domain';
import { sessionMinutes } from '../duration';
import { rampUpBlocks } from '../generate/build';
import { exerciseSafety } from '../generate/safety';
import { loadContext, type EditContext } from './dose';
import { isRampSlot, itemsOf } from './slots';

const leadOf = (session: Session) => {
  const first = session.main[0];
  return first?.type === 'straight' ? first.item : undefined;
};

/**
 * Ramp-up sets follow the session's first lift: when it changed from `before`, the old ones go
 * and the new lift gets its own (none when it takes no weight or the warm-up already rehearses it).
 */
export function refreshRampUps(session: Session, before: Session, ctx: EditContext): Session {
  const lead = leadOf(session);
  const was = leadOf(before);
  if (lead?.exerciseId === was?.exerciseId) return session;
  const warmup = session.warmup.filter((b) => !(b.type === 'straight' && isRampSlot(b.item.slot)));
  const exercise = lead && ctx.exercises.get(lead.exerciseId);
  let ramps = [] as Session['warmup'];
  if (lead?.load?.kind === 'kg' && exercise) {
    const setup = exerciseSafety(exercise, loadContext(ctx)).setup;
    const patterns = warmup.flatMap((b) =>
      itemsOf(b).map((i) => ctx.exercises.get(i.exerciseId)?.pattern),
    );
    if (setup) ramps = rampUpBlocks(exercise, setup, lead.load.kg, patterns, ctx.inventory);
  }
  const next = { ...session, warmup: [...warmup, ...ramps] };
  return { ...next, estimatedMinutes: sessionMinutes(next) };
}
