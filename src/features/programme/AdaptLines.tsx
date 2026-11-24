import { useTranslation } from 'react-i18next';
import type { Answer, Language } from '@/domain';
import { Button, Icon, type IconName } from '@/ui/components';
import { exerciseName, loadText, parseToken, Rich } from '../adapt';
import styles from './AdaptLines.module.css';

/** The why of an exercise's prescription: "Last time, … Reason." */
export function WhyLine({ text }: { text: string }) {
  return (
    <p className={styles.why}>
      <Icon name="why" size={20} />
      <span>
        <Rich text={text} />
      </span>
    </p>
  );
}

const dateText = (iso: string, lang: Language) =>
  new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'long' });

/** "Replaces: X, …" with the way back to the original. */
export function SwapLine({
  originalId,
  answer,
  firstTime,
  missedMin,
  onSwitchBack,
}: {
  originalId: string;
  answer: Answer | undefined;
  firstTime: boolean;
  /** Set when the harder variant missed its range: the bottom of it. */
  missedMin?: number;
  onSwitchBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const old = exerciseName(originalId, lang);
  let text: string;
  if (missedMin !== undefined) text = t('adapt.detail.swap.harderMissed', { min: missedMin, old });
  else if (!answer) text = t('adapt.detail.swap.replaces', { old });
  else if (answer.kind === 'pain')
    text = t('adapt.detail.swap.replacesPain', { old, date: dateText(answer.at, lang) });
  else if (answer.kind === 'assisted') text = t('adapt.detail.swap.replacesBand', { old });
  else text = t('adapt.detail.swap.replacesChoice', { old, date: dateText(answer.at, lang) });
  if (firstTime) text += ` ${t('adapt.detail.swap.firstTime')}`;
  return (
    <div className={styles.line}>
      <p className={styles.text}>
        <Icon name="swap" size={20} />
        <span>
          <Rich text={text} />
        </span>
      </p>
      <Button variant="secondary" onClick={onSwitchBack}>
        {t('adapt.detail.swap.switchBack')}
      </Button>
    </div>
  );
}

/** Pain at the last session, not yet answered: the lighter load already applies. */
export function PendingPainLine({
  fromToken,
  toToken,
  onChoose,
}: {
  fromToken: string | undefined;
  toToken: string | undefined;
  onChoose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const to = parseToken(toToken);
  const from = parseToken(fromToken);
  const withLoads = to && from && to.kind !== 'bw' && toToken !== fromToken && from.kind !== 'bw';
  const text = withLoads
    ? t('adapt.detail.pendingPain.text', {
        to: loadText(t, lang, toToken),
        from: loadText(t, lang, fromToken),
      })
    : t('adapt.detail.pendingPain.textEasy');
  return (
    <div className={`${styles.line} ${styles.pain}`}>
      <p className={styles.text}>
        <Icon name="stop" size={20} />
        <span>
          <Rich text={text} />
        </span>
      </p>
      <Button variant="secondary" onClick={onChoose}>
        {t('adapt.detail.pendingPain.choose')}
      </Button>
    </div>
  );
}

/** "Travel kit. Replaces: X." No way back: it only holds while the kit does. */
export function TravelSwapLine({ originalId }: { originalId: string }) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  return (
    <div className={styles.line}>
      <p className={styles.text}>
        <Icon name="suitcase" size={20} />
        <span>{t('programme.kit.swapLine', { name: exerciseName(originalId, lang) })}</span>
      </p>
    </div>
  );
}

/** What the plan has no exercise for: its title and why, in a dashed box. Not a button. */
export function LeftOutRow({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return (
    <div className={styles.leftOut}>
      <Icon name={icon} size={20} />
      <div className={styles.leftOutText}>
        <p className={styles.leftOutTitle}>{title}</p>
        <p className={styles.leftOutSub}>{sub}</p>
      </div>
    </div>
  );
}
