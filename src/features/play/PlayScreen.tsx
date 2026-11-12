import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import { useActiveProgramme } from '@/app/data';
import { nextSession } from '@/app/programme-state';
import { goBack, type Route } from '@/app/router';
import type { EquipmentKind, SessionItem } from '@/domain';
import { sessionForWeek } from '@/engine';
import { Button, Dock, Icon, IconButton, type IconName } from '@/ui/components';
import shared from '@/features/placeholder/placeholder.module.css';
import styles from './PlayScreen.module.css';

const GLYPH: Partial<Record<EquipmentKind, IconName>> = {
  dumbbell: 'dumbbell',
  kettlebell: 'kettlebell',
  band: 'band',
  'mini-band': 'miniband',
  'pull-up-bar': 'bar',
  bench: 'bench',
  treadmill: 'treadmill',
  'weight-belt': 'belt',
};

/** Where "Start" leads until the workout player exists: the session's first exercise and a way back. */
export function PlayScreen({ route }: { route: Extract<Route, { name: 'play' }> }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'fr' ? 'fr' : 'en';
  const active = useActiveProgramme();
  // A quick session isn't stored before it starts, so there is nothing to preview for it yet.
  const programme = route.source === 'quick' ? null : active;

  const position = programme ? nextSession(programme) : null;
  const plan =
    programme && position ? sessionForWeek(programme, position.sessionId, position.week) : null;
  const block = plan?.session.main[0];
  const item = block ? (block.type === 'straight' ? block.item : block.items[0]) : undefined;
  const sets = block ? (block.type === 'straight' ? block.sets : block.rounds) : 0;
  const exercise = item ? exerciseById.get(item.exerciseId) : undefined;
  const kind = exercise?.equipment[0]?.[0]?.kind;

  return (
    <>
      <header className={styles.bar}>
        <IconButton icon="close" label={t('common.close')} onClick={goBack} />
        <span className={styles.barText}>{plan?.session.name[lang] ?? t('play.title')}</span>
      </header>
      <div className={styles.stub}>
        {exercise && item ? (
          <div
            className={styles.slot}
            role="img"
            aria-label={t('play.demoToCome', { name: exercise.name[lang] })}
          >
            <svg
              className={styles.floor}
              viewBox="0 0 350 80"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0 4H350M-60 80L150 4M410 80L200 4M70 80L163 4M280 80L187 4M175 80V4M0 22H350M0 46H350" />
            </svg>
            <span className={styles.tag}>{t('play.firstExercise')}</span>
            <Icon className={styles.glyph} name={(kind && GLYPH[kind]) ?? 'person-run'} />
            <div className={styles.first}>
              <span className={styles.name}>{exercise.name[lang]}</span>
              <Prescription item={item} sets={sets} />
            </div>
          </div>
        ) : null}
        <div className={shared.text}>
          <h1 className={shared.title}>{t('play.comingSoon')}</h1>
          <p className={shared.body}>{t('play.comingSoonBody')}</p>
        </div>
      </div>
      <Dock>
        <Button size="player" fullWidth onClick={goBack}>
          {t('play.backToSession')}
        </Button>
      </Dock>
    </>
  );
}

function Prescription({ item, sets }: { item: SessionItem; sets: number }) {
  const { t } = useTranslation();
  const target = item.target;
  const dose =
    target.kind === 'reps'
      ? `${sets} × ${target.min === target.max ? target.min : `${target.min}–${target.max}`}`
      : target.kind === 'time'
        ? `${sets} × ${target.minSec === target.maxSec ? target.minSec : `${target.minSec}–${target.maxSec}`} ${t('labels.unit.s')}`
        : target.kind === 'max'
          ? `${sets} × max`
          : null;
  const load = item.load;
  return (
    <span className={styles.rx}>
      {dose ? <span className={shared.num}>{dose}</span> : null}
      {load?.kind === 'kg' || load?.kind === 'added-kg' ? (
        <span className={shared.num}>
          {load.kind === 'added-kg' ? '+' : ''}
          {load.kg}
          <small className={styles.unit}>{t('labels.unit.kg')}</small>
        </span>
      ) : null}
    </span>
  );
}
