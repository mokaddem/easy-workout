import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import {
  useActiveProgramme,
  useAnswers,
  useCustomSession,
  useEquipment,
  useProfile,
} from '@/app/data';
import { goBack, navigate, type Route } from '@/app/router';
import type { Language, Session } from '@/domain';
import {
  generatedSession,
  placesOf,
  programmeWithSlots,
  ensureSlots,
  type EditContext,
} from '@/engine';
import { EmptyState, IconButton, Skeleton } from '@/ui/components';
import { sessionIdentity } from '../programme/format';
import { Editor } from './Editor';
import styles from './editor.module.css';

function Loading() {
  return (
    <>
      <div className={styles.bar} />
      <div className={styles.skeleton} aria-busy="true">
        <Skeleton height={64} radius="var(--radius-lg)" />
        <Skeleton height={96} radius="var(--radius-lg)" />
        <Skeleton height={96} radius="var(--radius-lg)" />
      </div>
    </>
  );
}

function Missing() {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.bar}>
        <IconButton icon="close" label={t('editor.close')} onClick={goBack} />
      </div>
      <EmptyState
        icon="list"
        title={t('editor.missingTitle')}
        description={t('editor.missingBody')}
        actionLabel={t('common.back')}
        onAction={goBack}
      />
    </>
  );
}

/** The session editor: a rotation session of the programme, or one of the user's own. */
export function EditorScreen({ route }: { route: Extract<Route, { name: 'edit' }> }) {
  const { i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const profile = useProfile();
  const inventory = useEquipment();
  const answers = useAnswers();
  const record = useActiveProgramme();
  const isNew = route.target === 'mine' && route.sessionId === 'new';
  const custom = useCustomSession(route.target === 'mine' && !isNew ? route.sessionId : undefined);

  const placedCustomId =
    route.target === 'programme' ? record?.placements?.[route.sessionId] : undefined;
  useEffect(() => {
    if (placedCustomId)
      navigate({ name: 'edit', target: 'mine', sessionId: placedCustomId }, { replace: true });
  }, [placedCustomId]);

  const ctx: EditContext | null = useMemo(
    () => (profile && inventory ? { profile, inventory, exercises: exerciseById } : null),
    [profile, inventory],
  );

  const programme = useMemo(() => (record ? programmeWithSlots(record) : null), [record]);

  if (
    profile === undefined ||
    inventory === undefined ||
    answers === undefined ||
    record === undefined ||
    (route.target === 'mine' && !isNew && custom === undefined)
  )
    return <Loading />;
  if (!ctx) return <Missing />;

  if (route.target === 'programme') {
    if (placedCustomId) return <Loading />;
    const session = programme?.rotation.find((s) => s.id === route.sessionId);
    if (!record || !programme || !session) return <Missing />;
    const identity = sessionIdentity(session, lang, programme.rotation);
    return (
      <Editor
        key={`programme:${session.id}`}
        target="programme"
        sessionId={session.id}
        initial={session}
        generated={generatedSession(programme, session.id)}
        programme={record}
        placed={false}
        ctx={ctx}
        answers={answers}
        contextLine={
          identity.letter
            ? `${identity.letter ? '' : ''}${lang === 'fr' ? 'Séance' : 'Session'} ${identity.letter}, ${identity.title}`
            : identity.fullName
        }
        letter={identity.letter}
      />
    );
  }

  let initial: Session | undefined;
  if (isNew) initial = undefined;
  else if (custom) initial = ensureSlots(stripRecord(custom));
  else return <Missing />;

  const placed = !!record && !!custom && placesOf(record, custom.id).length > 0;
  return (
    <Editor
      key={`mine:${route.sessionId}`}
      target="mine"
      sessionId={route.sessionId}
      initial={initial ?? NEW}
      copiedFrom={custom?.base ? ensureSlots(custom.base) : undefined}
      placed={placed}
      programme={record ?? undefined}
      ctx={ctx}
      answers={answers}
      contextLine={isNew ? '' : (custom?.name[lang] ?? '')}
    />
  );
}

const NEW: Session = {
  id: 'new',
  name: { fr: '', en: '' },
  estimatedMinutes: 1,
  warmup: [],
  main: [],
  finisher: [],
};

function stripRecord(record: Session & { updatedAt?: string; base?: Session }): Session {
  const { updatedAt: _, base: __, ...session } = record;
  return session;
}
