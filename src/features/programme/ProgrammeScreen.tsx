import { AnimatePresence, m } from 'motion/react';
import { EXIT_RATIO, useMotionTokens } from '@/motion';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveProgramme, useEquipment, useProfile } from '@/app/data';
import { nextSession, programmeFreshness } from '@/app/programme-state';
import { handleLinkClick, navigate, routeHref, type Route } from '@/app/router';
import type { Language, Phase } from '@/domain';
import { phaseForWeek, sessionForWeek } from '@/engine';
import { repo } from '@/db/repo';
import { AppBar, Button, Card, Icon, Skeleton } from '@/ui/components';
import { ChangePreviewSheet } from './ChangePreviewSheet';
import type { PreviewMode } from './preview';
import {
  exerciseCount,
  exerciseName,
  finisherCardio,
  phaseSlug,
  programmeIdentities,
} from './format';
import { OptionsMenu } from './OptionsMenu';
import { PhaseSheet } from './PhaseSheet';
import { ProgrammeWhySheet } from './ProgrammeWhySheet';
import { RotationGrid } from './RotationGrid';
import { equipmentGapCount, hasEquipmentGaps } from './why';
import styles from './Overview.module.css';

/** The programme tab: where the programme stands, what comes next, how the weeks are laid out. */
export function ProgrammeScreen({ route }: { route: Extract<Route, { name: 'programme' }> }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const record = useActiveProgramme();
  const profile = useProfile();
  const equipment = useEquipment();

  const [preview, setPreview] = useState<PreviewMode | null>(
    route.preview === 'new' ? 'new' : null,
  );
  const [phase, setPhase] = useState<Phase | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const tokens = useMotionTokens();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // The preview URL only opens the sheet once.
  const [opened, setOpened] = useState(route.preview === 'new');
  if (route.preview === 'new' && !opened) {
    setOpened(true);
    setPreview('new');
  } else if (route.preview !== 'new' && opened) {
    setOpened(false);
  }
  useEffect(() => {
    if (route.preview === 'new') navigate({ name: 'programme' }, { replace: true });
  }, [route.preview]);

  if (!record || !profile || !equipment)
    return (
      <>
        <AppBar title={t('nav.programme')} />
        <div className={styles.hero} aria-busy="true">
          <Skeleton height={140} radius="var(--radius-lg)" />
          <Skeleton height={48} />
        </div>
      </>
    );

  const position = nextSession(record);
  const plan = sessionForWeek(record, position.sessionId, position.week);
  const identities = programmeIdentities(record, lang);
  const identity = identities[position.index]!;
  const currentPhase = phaseForWeek(record, position.week);
  const slug = currentPhase ? phaseSlug(currentPhase.name.en) : null;
  const freshness = programmeFreshness(record, profile, equipment);
  const notes = record.generation?.notes ?? [];
  const cardioDays = record.rotation.filter((_, i) => identities[i]!.cardio).length;
  const sessions = record.rotation.length - cardioDays;
  const cardio = finisherCardio(plan.session);
  const gaps = hasEquipmentGaps(notes);
  const whyOnce = !record.whySeen;

  const dismissWhy = () => void repo.markWhySeen(record.id);
  const openWhy = () => {
    setWhyOpen(true);
    if (whyOnce) dismissWhy();
  };

  const reasons = [
    { icon: 'calendar', text: t('programme.whyCard.schedule', { count: sessions, sessions }) },
    {
      icon: 'gauge',
      text: t('programme.whyCard.goal', {
        goal: t(`labels.goal.${record.goal}`).toLocaleLowerCase(lang),
      }),
    },
    {
      icon: 'user',
      text:
        equipment.length === 0
          ? t('programme.whyCard.bodyweight')
          : t('programme.whyCard.equipment'),
    },
  ] as const;

  return (
    <>
      <AppBar
        title={record.name[lang]}
        meta={
          cardioDays > 0
            ? t('programme.meta.withCardio', {
                weeks: record.weeks,
                count: sessions,
                cardio: cardioDays,
              })
            : t('programme.meta.plain', { weeks: record.weeks, count: sessions })
        }
        actions={
          <OptionsMenu
            actions={[
              {
                id: 'variant',
                icon: 'shuffle',
                label: t('programme.menu.variant'),
                hint: t('programme.menu.variantHint'),
                onSelect: () => setPreview('variant'),
              },
              {
                id: 'profile',
                icon: 'user',
                label: t('programme.menu.profile'),
                onSelect: () => navigate({ name: 'profile' }),
              },
              {
                id: 'equipment',
                icon: 'dumbbell',
                label: t('programme.menu.equipment'),
                onSelect: () => navigate({ name: 'equipment' }),
              },
            ]}
          />
        }
      />
      <div className={styles.scroll}>
        <AnimatePresence initial={false}>
          {whyOnce ? (
            <m.div
              key="why"
              exit={{
                height: 0,
                opacity: 0,
                overflow: 'hidden',
                transition: { duration: tokens.duration.base * EXIT_RATIO, ease: tokens.ease.exit },
              }}
            >
              <Card as="section" className={styles.card} aria-labelledby="why-card-title">
                <h2 className={styles.cardTitle} id="why-card-title">
                  {t('programme.whyCard.title')}
                </h2>
                <ul className={styles.whyList}>
                  {reasons.map((reason) => (
                    <li key={reason.icon}>
                      <Icon name={reason.icon} />
                      <span>{reason.text}</span>
                    </li>
                  ))}
                </ul>
                <div className={styles.actions}>
                  <Button variant="secondary" onClick={openWhy}>
                    {t('programme.whyCard.all')}
                  </Button>
                  <Button variant="ghost" onClick={dismissWhy}>
                    {t('programme.whyCard.gotIt')}
                  </Button>
                </div>
              </Card>
            </m.div>
          ) : null}
        </AnimatePresence>

        {freshness !== 'current' && !bannerDismissed ? (
          <section className={styles.banner} aria-labelledby="stale-title">
            <div className={styles.bannerHead}>
              <span className={styles.well}>
                <Icon name="refresh" size={24} />
              </span>
              <div className={styles.bannerText}>
                <h2 className={styles.bannerTitle} id="stale-title">
                  {t('programme.banner.title')}
                </h2>
                <p className={styles.muted}>
                  {t(
                    freshness === 'needs-new'
                      ? 'programme.banner.needsNew'
                      : 'programme.banner.outOfDate',
                  )}
                </p>
              </div>
            </div>
            <div className={styles.bannerActions}>
              <Button variant="secondary" fullWidth onClick={() => setPreview('new')}>
                {t('programme.banner.generate')}
              </Button>
              <Button variant="ghost" onClick={() => setBannerDismissed(true)}>
                {t('programme.banner.keep')}
              </Button>
            </div>
          </section>
        ) : null}

        <section className={styles.hero}>
          <div
            className={styles.heroWeek}
            role="img"
            aria-label={t('programme.hero.weekOf', { week: position.week, total: record.weeks })}
          >
            <span className={styles.heroLabel}>{t('programme.hero.week')}</span>
            <span className={styles.heroRow}>
              <span className={`${styles.num} ${styles.heroN}`}>{position.week}</span>
              <span className={`${styles.num} ${styles.heroOf}`}>
                {t('programme.hero.of', { total: record.weeks })}
              </span>
            </span>
          </div>
          <div className={styles.segs} aria-hidden="true">
            {Array.from({ length: record.weeks }, (_, i) => (
              <i
                key={i}
                className={
                  i + 1 < position.week ? styles.done : i + 1 === position.week ? styles.cur : ''
                }
              />
            ))}
          </div>
          {currentPhase ? (
            <div className={styles.heroPhase}>
              <h2 className={styles.phaseTitle}>
                {t('programme.hero.phase', {
                  // "Phase réadaptation" / "Re-adaptation phase": the name only opens the line in English.
                  name:
                    lang === 'fr'
                      ? currentPhase.name.fr.toLocaleLowerCase('fr')
                      : currentPhase.name.en,
                })}
              </h2>
              {slug ? <p className={styles.muted}>{t(`programme.phase.${slug}.summary`)}</p> : null}
            </div>
          ) : (
            <h2 className={styles.phaseTitle}>{t('nav.programme')}</h2>
          )}
        </section>

        {gaps ? (
          <a
            className={styles.nudge}
            href={routeHref({ name: 'equipment' })}
            onClick={(event) => handleLinkClick(event, routeHref({ name: 'equipment' }))}
          >
            <span className={styles.well}>
              <Icon name="bag" size={24} />
            </span>
            <span className={styles.nudgeText}>
              <span className={styles.nudgeTitle}>
                {t('programme.nudge.title', { count: equipmentGapCount(notes) })}
              </span>
              <span className={styles.nudgeSub}>{t('programme.nudge.sub')}</span>
            </span>
            <Icon name="chev-right" size={20} />
          </a>
        ) : null}

        <Card as="article" className={`${styles.card} ${styles.next}`}>
          <div>
            <p className={styles.nextLabel}>{t('programme.next.label')}</p>
            <h2 className={styles.nextTitle}>{identity.fullName}</h2>
            {plan.session.focus ? (
              <p className={styles.nextMuscles}>{plan.session.focus[lang]}</p>
            ) : null}
          </div>
          <ul className={styles.facts}>
            <li>
              <Icon name="clock" size={20} />
              <span>
                ~{plan.session.estimatedMinutes} {t('labels.unit.min')}
              </span>
            </li>
            {exerciseCount(plan.session) > 0 ? (
              <li>
                <Icon name="list" size={20} />
                <span>
                  {t('programme.session.exercisesCount', { count: exerciseCount(plan.session) })}
                </span>
              </li>
            ) : null}
            {cardio ? (
              <li>
                <Icon name="incline" size={20} />
                <span>
                  {exerciseName(cardio.exerciseId, lang)}, {cardio.minutes} {t('labels.unit.min')}
                </span>
              </li>
            ) : null}
          </ul>
          <Button
            size="player"
            fullWidth
            icon="play"
            onClick={() => navigate({ name: 'play' })}
            disabled={position.finished}
          >
            {t('programme.start')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate({ name: 'session', sessionId: position.sessionId })}
          >
            {t('programme.next.details')}
          </Button>
        </Card>

        <section className={styles.rot} aria-labelledby="rot-title">
          <div>
            <h2 className={styles.heading} id="rot-title">
              {t('programme.rotation.title')}
            </h2>
            <p className={styles.small}>{t('programme.rotation.intro')}</p>
          </div>
          <RotationGrid programme={record} position={position} onPhase={setPhase} />
        </section>

        <section className={styles.list} aria-labelledby="slist-title">
          <h2 className={styles.heading} id="slist-title">
            {t('programme.sessions.title')}
          </h2>
          <div className={styles.rows}>
            {record.rotation.map((session, i) => {
              const id = identities[i]!;
              const href = routeHref({ name: 'session', sessionId: session.id });
              return (
                <a
                  key={session.id}
                  className={styles.row}
                  href={href}
                  onClick={(event) => handleLinkClick(event, href)}
                >
                  <span className={styles.rowId}>
                    {id.letter ? (
                      <span className={styles.num}>{id.letter}</span>
                    ) : (
                      <Icon name="heart" size={24} />
                    )}
                  </span>
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{id.title}</span>
                    <span className={styles.rowMeta}>
                      ~{session.estimatedMinutes} {t('labels.unit.min')}
                    </span>
                  </span>
                  <Icon name="chev-right" size={20} />
                </a>
              );
            })}
          </div>
        </section>
      </div>

      <PhaseSheet
        programme={record}
        phase={phase}
        currentWeek={position.week}
        onClose={() => setPhase(null)}
      />
      <ProgrammeWhySheet programme={record} open={whyOpen} onClose={() => setWhyOpen(false)} />
      <ChangePreviewSheet
        mode={preview}
        current={record}
        profile={profile}
        equipment={equipment}
        onClose={() => setPreview(null)}
        onEquipment={() => {
          setPreview(null);
          navigate({ name: 'equipment' });
        }}
      />
    </>
  );
}
