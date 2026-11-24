import { exerciseById } from '@/catalogue';
import type { GenerationNote, Profile, Programme } from '@/domain';
import { constraintsOf, fitFor, isConstrained } from '@/engine';
import { template } from '@/engine/generate/templates';
import type { SessionTemplate, TemplateKey } from '@/engine/generate/types';

export interface Limits {
  /** Slots a joint, quiet or small space left out, with the session they belong to. */
  leftOut: { sessionId: string; note: GenerationNote }[];
  /** "Fewer sets for a muscle" notes. */
  volume: GenerationNote[];
  /** Exercises kept at 2 reps in reserve at least, once per session. */
  capped: { sessionId: string; exerciseId: string }[];
}

/** Whether the profile avoids anything: the Programme tab shows its limits row only then. */
export const hasConstraints = (
  profile: Pick<Profile, 'limitations' | 'quiet' | 'smallSpace'>,
): boolean => isConstrained(constraintsOf(profile));

/** What the programme works around, from its generation notes and the exercises it holds now. */
export function programmeLimits(
  programme: Pick<Programme, 'rotation' | 'generation'>,
  profile: Pick<Profile, 'limitations' | 'quiet' | 'smallSpace'>,
): Limits {
  const notes = programme.generation?.notes ?? [];
  const constraints = constraintsOf(profile);
  const capped: Limits['capped'] = [];
  for (const session of programme.rotation) {
    const seen = new Set<string>();
    for (const block of [...session.main, ...session.finisher])
      for (const item of block.type === 'straight' ? [block.item] : block.items) {
        const exercise = exerciseById.get(item.exerciseId);
        if (!exercise || seen.has(exercise.id) || fitFor(exercise, constraints) === 'ok') continue;
        seen.add(exercise.id);
        capped.push({ sessionId: session.id, exerciseId: exercise.id });
      }
  }
  return {
    leftOut: notes.flatMap((note) =>
      note.code === 'slot-limited' && note.ref?.sessionId
        ? [{ sessionId: note.ref.sessionId, note }]
        : [],
    ),
    volume: notes.filter((n) => n.code === 'muscle-volume-reduced'),
    capped,
  };
}

const slotBase = (slot: string): string => slot.replace(/-\d+$/, '');

/**
 * Where a slot that was left out stood among the main blocks of its session: the number of
 * blocks before it that still have an exercise. From the session's template, in the order of the
 * split. `undefined` when the template can't be found: the row then goes last.
 */
export function leftOutPosition(
  programme: Pick<Programme, 'rotation' | 'generation'>,
  sessionId: string,
  slot: string,
): number | undefined {
  const keys = String(
    (programme.generation?.notes ?? []).find((n) => n.code === 'split')?.params.templates ?? '',
  ).split(',');
  const key = keys[programme.rotation.findIndex((s) => s.id === sessionId)] as
    TemplateKey | undefined;
  if (!key) return undefined;
  let blocks: SessionTemplate['main'];
  try {
    blocks = template(key).main;
  } catch {
    return undefined;
  }
  const ids = (b: SessionTemplate['main'][number]): string[] =>
    b.type === 'straight' ? [b.slot.id] : b.type === 'group' ? b.slots.map((s) => s.id) : [];
  const leftOut = new Set(
    (programme.generation?.notes ?? []).flatMap((n) =>
      (n.code === 'slot-limited' || n.code === 'slot-dropped') && n.ref?.sessionId === sessionId
        ? [String(n.params.slot), slotBase(String(n.params.slot))]
        : [],
    ),
  );
  const at = blocks.findIndex((b) => ids(b).some((id) => id === slot || id === slotBase(slot)));
  if (at < 0) return undefined;
  return blocks
    .slice(0, at)
    .filter((b) => b.type !== 'cardio' && !ids(b).every((id) => leftOut.has(id))).length;
}
