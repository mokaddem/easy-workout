import { useTranslation } from 'react-i18next';
import { exerciseById } from '@/catalogue';
import type { Language } from '@/domain';
import { Button, Sheet } from '@/ui/components';
import type { WhyRequest } from './Blocks';
import { exerciseName } from './format';
import { describeNote } from './why';
import styles from './Sheets.module.css';

/** "Why this exercise": every reason the generator left for one item, and the key cue. */
export function WhySheet({
  request,
  onClose,
}: {
  request: WhyRequest | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: Language = i18n.language === 'fr' ? 'fr' : 'en';
  const exercise = request ? exerciseById.get(request.exerciseId) : undefined;
  const sentences: string[] = [];
  if (request) {
    for (const note of request.notes) {
      const sentence = describeNote(note, t, lang);
      if (sentence && !sentences.includes(sentence)) sentences.push(sentence);
    }
    if (request.first) sentences.push(t('programme.whySheet.first'));
    if (sentences.length === 0) sentences.push(t('programme.whySheet.plain'));
  }
  return (
    <Sheet
      open={request !== null}
      onClose={onClose}
      title={
        <>
          <span className={styles.eyebrow}>{t('programme.whySheet.eyebrow')}</span>
          <span className={styles.big}>
            {request ? exerciseName(request.exerciseId, lang) : ''}
          </span>
        </>
      }
    >
      {request ? (
        <div className={styles.body}>
          <ul className={styles.reasonList}>
            {sentences.map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ul>
          {exercise ? (
            <div className={styles.cue}>
              <span className={styles.cueLabel}>{t('programme.whySheet.cue')}</span>
              <p className={styles.p}>{exercise.keyCue[lang]}</p>
            </div>
          ) : null}
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('programme.whySheet.close')}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
