import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, NameField, Sheet } from '@/ui/components';
import styles from './Quick.module.css';

export interface SaveSheetProps {
  open: boolean;
  onClose: () => void;
  defaultName: string;
  onSave: (name: string) => Promise<void>;
}

/** Names a quick session and keeps it among the user's own sessions. */
export function SaveSheet({ open, onClose, defaultName, onSave }: SaveSheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName(defaultName);
      setError(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => input.current?.select());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const save = async () => {
    const typed = name.trim();
    if (!typed) {
      setError(true);
      input.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave(typed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('quick.saveSheet.title')}
      description={t('quick.saveSheet.line')}
      footer={
        <>
          <Button fullWidth loading={saving} onClick={() => void save()}>
            {t('quick.saveSheet.confirm')}
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('quick.saveSheet.cancel')}
          </Button>
        </>
      }
    >
      <form
        className={styles.saveForm}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <NameField
          ref={input}
          label={t('quick.saveSheet.name')}
          value={name}
          placeholder={defaultName}
          onChange={(value) => {
            setName(value);
            setError(false);
          }}
          {...(error ? { error: t('quick.saveSheet.error') } : {})}
        />
        <p className={styles.saveNote}>
          <Icon name="info" size={20} />
          <span>{t('quick.saveSheet.loads')}</span>
        </p>
      </form>
    </Sheet>
  );
}
