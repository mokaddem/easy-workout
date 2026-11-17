import type { Session } from '@/domain';

const key = (target: string, sessionId: string) => `editor-draft:${target}:${sessionId}`;

const isDraft = (value: unknown): value is Session => {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'object' &&
    s.name !== null &&
    Array.isArray(s.warmup) &&
    Array.isArray(s.main) &&
    Array.isArray(s.finisher)
  );
};

/** The draft kept for an open editor, if the app was closed before it was saved. */
export function loadDraft(target: string, sessionId: string): Session | null {
  try {
    const raw = localStorage.getItem(key(target, sessionId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function storeDraft(target: string, sessionId: string, draft: Session): void {
  try {
    localStorage.setItem(key(target, sessionId), JSON.stringify(draft));
  } catch {
    /* storage unavailable: the draft just isn't kept */
  }
}

export function clearDraft(target: string, sessionId: string): void {
  try {
    localStorage.removeItem(key(target, sessionId));
  } catch {
    /* nothing to clear */
  }
}
