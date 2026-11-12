import { exerciseById } from '../../src/catalogue';
import type { Block, Programme, Session, SessionItem, Target } from '../../src/domain';

const name = (id: string) => exerciseById.get(id)?.name.en ?? `?${id}`;

const target = (t: Target): string => {
  switch (t.kind) {
    case 'reps':
      return t.min === t.max ? `${t.min}` : `${t.min}-${t.max}`;
    case 'time':
      return t.minSec === t.maxSec ? `${t.minSec}s` : `${t.minSec}-${t.maxSec}s`;
    case 'max':
      return 'max';
    case 'cardio': {
      const mins =
        t.minMinutes === t.maxMinutes ? `${t.minMinutes}` : `${t.minMinutes}-${t.maxMinutes}`;
      const extra = [t.speedKmh && `${t.speedKmh} km/h`, t.inclinePct && `${t.inclinePct}%`].filter(
        Boolean,
      );
      return `${mins} min${extra.length ? ` @ ${extra.join(', ')}` : ''}`;
    }
    case 'interval':
      return `${t.rounds} × (${t.workSec}s on / ${t.recoverySec}s off)`;
  }
};

const item = (i: SessionItem): string => {
  const parts = [name(i.exerciseId), target(i.target) + (i.perSide ? '/side' : '')];
  if (i.rir !== undefined) parts.push(`RIR ${i.rir}`);
  if (i.tempo) parts.push(`tempo ${i.tempo.down}-${i.tempo.pause}-${i.tempo.up}`);
  if (i.load)
    parts.push(
      i.load.kind === 'kg'
        ? `${i.load.kg} kg`
        : i.load.kind === 'added-kg'
          ? `+${i.load.kg} kg`
          : i.load.kind === 'band'
            ? `${i.load.level} band`
            : 'bodyweight',
    );
  return parts.join(' · ');
};

const block = (b: Block, n: number): string[] => {
  if (b.type === 'straight') {
    const sets = b.sets > 1 || b.restSec > 0 ? `${b.sets} × ` : '';
    const rest = b.restSec > 0 ? `  (rest ${b.restSec}s)` : '';
    return [`  ${n}. ${sets}${item(b.item)}${rest}`];
  }
  return [
    `  ${n}. ${b.style} × ${b.rounds} rounds (rest ${b.restAfterRoundSec}s after each round)`,
    ...b.items.map((i) => `       - ${item(i)}`),
  ];
};

export const renderSession = (s: Session): string => {
  const lines = [`## ${s.name.en}  [${s.id}, ~${s.estimatedMinutes} min]`];
  const section = (title: string, blocks: Block[]) => {
    if (blocks.length === 0) return;
    lines.push(`${title}:`);
    blocks.forEach((b, i) => lines.push(...block(b, i + 1)));
  };
  section('Warm-up', s.warmup);
  section('Main', s.main);
  section('Finisher', s.finisher);
  return lines.join('\n');
};

export const renderProgramme = (p: Programme): string => {
  const lines = [`# ${p.name.en} — ${p.sessionsPerWeek} sessions/week, ${p.weeks} weeks`];
  if (p.generation) {
    const { profile } = p.generation;
    lines.push(
      `Profile: ${profile.goal}, ${profile.level}, ${profile.daysPerWeek} days, ${profile.sessionMinutes} min` +
        (profile.bodyweightKg ? `, ${profile.bodyweightKg} kg` : ''),
    );
  }
  lines.push(
    `Progression: +${p.progression.upperBodyIncrementKg} kg upper / +${p.progression.lowerBodyIncrementKg} kg lower`,
    '',
    'Phases:',
    ...p.phases.map(
      (ph) =>
        `  W${ph.fromWeek}${ph.toWeek > ph.fromWeek ? `-${ph.toWeek}` : ''} ${ph.name.en}: ` +
        ph.adjustments
          .map((a) =>
            a.kind === 'rir'
              ? `RIR ${a.value} (${a.scope})`
              : a.kind === 'extra-sets'
                ? `+${a.add} set on main blocks ${a.mainBlockIndexes.map((i) => i + 1).join(', ')}`
                : a.kind === 'volume'
                  ? `volume × ${a.factor}`
                  : a.kind === 'cardio-minutes'
                    ? `cardio +${a.addMinutes} min`
                    : `max test: ${a.exerciseIds.map(name).join(', ')}`,
          )
          .join('; '),
    ),
    '',
  );
  for (const s of p.rotation) lines.push(renderSession(s), '');
  return lines.join('\n');
};

export const renderNotes = (p: Programme): string =>
  (p.generation?.notes ?? [])
    .filter((n) => !['exercise-preferred'].includes(n.code))
    .map((n) => {
      const ref = n.ref
        ? `[${[n.ref.sessionId, n.ref.section, n.ref.blockIndex, n.ref.itemIndex].filter((x) => x !== undefined).join('/')}] `
        : '';
      return `- ${ref}${n.code} ${JSON.stringify(n.params)}`;
    })
    .join('\n');
