import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { formatMoney } from '../lib/api';
import { X } from './Icons';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-border bg-surface p-5 ${className}`}>{children}</div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16 text-textMuted">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  );
}

export function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full"
      style={{ backgroundColor: color ?? 'var(--text-muted)' }}
    />
  );
}

export function AmountText({
  amount,
  direction,
  currency = 'SGD',
  className = '',
}: {
  amount: number;
  direction?: 'in' | 'out';
  currency?: string;
  className?: string;
}) {
  const color = direction === 'in' ? 'text-income' : 'text-textPrimary';
  const sign = direction === 'in' ? '+' : '';
  return (
    <span className={`[font-variant-numeric:tabular-nums] ${color} ${className}`}>
      {sign}
      {formatMoney(amount, currency)}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = 'accent',
}: {
  value: number;
  tone?: 'accent' | 'expense' | 'warning' | 'income';
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const bg =
    tone === 'expense'
      ? 'var(--expense)'
      : tone === 'warning'
        ? 'var(--warning)'
        : tone === 'income'
          ? 'var(--income)'
          : 'var(--accent)';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surfaceAlt">
      <div
        className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-[400ms] motion-safe:ease-house"
        style={{ width: `${pct}%`, backgroundColor: bg }}
      />
    </div>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="font-display text-2xl font-medium tracking-[-0.01em] text-textPrimary">
        {children}
      </h1>
      {action}
    </div>
  );
}

// --- form + action primitives (revamp) ---------------------------------------

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const styles =
    variant === 'primary'
      ? 'bg-primary text-bg hover:opacity-90'
      : variant === 'danger'
        ? 'text-expense hover:bg-surfaceAlt'
        : 'text-textSecondary hover:bg-surfaceAlt';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[40px] rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-[160ms] ease-house focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  selected,
  onClick,
  tone = 'accent',
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  tone?: 'accent' | 'income' | 'expense' | 'warning';
}) {
  const base =
    'inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm transition-colors duration-[160ms] ease-house focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent';
  // Review-chip exception: a selected warning chip keeps the outline and pairs
  // a 5px warning dot with its words (never color-only).
  if (tone === 'warning' && selected) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} border-border bg-transparent text-textPrimary`}
      >
        <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 rounded-full bg-warning" />
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${
        selected
          ? 'border-transparent bg-primary text-bg'
          : 'border-border bg-transparent text-textSecondary'
      }`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-textSecondary">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  'rounded-lg border border-border bg-surface px-3 py-2 text-base text-textPrimary focus:border-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent md:text-sm';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Badge({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'warning' | 'accent' | 'income';
}) {
  const cls =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'accent'
        ? 'text-accent'
        : tone === 'income'
          ? 'text-income'
          : 'text-textMuted';
  return (
    <span
      className={`inline-block rounded-full border border-border bg-transparent px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  footer,
  onBeforeClose,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
  onBeforeClose?: () => boolean;
}) {
  const requestClose = (source: 'backdrop' | 'x' | 'escape') => {
    // Below md the modal is a full-height sheet; a stray backdrop tap must
    // never destroy input. Backdrop-close is desktop-only.
    if (source === 'backdrop' && window.innerWidth < 768) return;
    if (onBeforeClose && !onBeforeClose()) return;
    onClose();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestCloseRef.current('escape');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 md:items-center md:justify-start md:overflow-y-auto md:p-10"
      onClick={() => requestClose('backdrop')}
    >
      <div
        className={`flex min-h-dvh w-full flex-col rounded-t-[20px] border border-border bg-surface [box-shadow:0_24px_60px_-20px_rgba(20,16,10,.30)] dark:[box-shadow:0_24px_60px_-20px_rgba(0,0,0,.55)] motion-safe:animate-[sheet-rise_280ms_cubic-bezier(0.22,1,0.36,1)] md:min-h-0 md:rounded-card md:motion-safe:animate-none ${
          wide ? 'md:max-w-2xl' : 'md:max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[20px] border-b border-border bg-surface px-6 py-4 md:rounded-t-card">
          <h2 className="font-display text-lg font-medium text-textPrimary">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => requestClose('x')}
            className="-m-2 grid h-11 w-11 place-items-center rounded-lg text-textSecondary transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
          >
            <X />
          </button>
        </div>
        <div className="flex-1 px-6 py-4 md:overflow-visible">{children}</div>
        {footer && (
          <div className="sticky bottom-0 border-t border-border bg-surface/95 px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-0 z-50 flex flex-col gap-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:pt-0"
    >
      {children}
    </div>
  );
}
