import type { Transaction } from './types';

// Tiny app-wide toast bus. Pages emit payloads; the Shell owns rendering,
// timers, and dismissal. Keeps toast UI out of every page component.

export type ToastPayload =
  | { kind: 'txn'; txn: Transaction }
  | {
      kind: 'note';
      /** 11px caps slug above the message, e.g. 'LEARNED'. */
      label?: string;
      message: string;
      tone?: 'default' | 'warning';
      action?: { label: string; run: () => void };
      /** Override auto duration (ms). */
      duration?: number;
    };

type Listener = (t: ToastPayload) => void;

const listeners = new Set<Listener>();

export function showToast(t: ToastPayload): void {
  listeners.forEach((fn) => fn(t));
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
