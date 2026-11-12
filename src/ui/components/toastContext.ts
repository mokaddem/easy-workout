import { createContext } from 'react';

export interface ToastOptions {
  message: string;
  /** Optional ghost action ("Undo"); extends the display time to 5 s. */
  action?: { label: string; onAction: () => void };
  /** Errors get a leading stop icon. */
  tone?: 'default' | 'error';
}

export interface ToastApi {
  show: (options: ToastOptions) => void;
  dismiss: () => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
