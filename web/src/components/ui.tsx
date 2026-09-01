import type { ReactNode } from 'react';
import { formatMoney } from '../lib/api';

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
  const color =
    direction === 'in' ? 'text-income' : direction === 'out' ? 'text-expense' : 'text-textPrimary';
  const sign = direction === 'in' ? '+' : direction === 'out' ? '-' : '';
  return (
    <span className={`tabular-nums ${color} ${className}`}>
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
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: bg }} />
    </div>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-2xl font-bold text-textPrimary">{children}</h1>
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
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles} ${className}`}
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
  const selBg =
    tone === 'income'
      ? 'bg-income'
      : tone === 'expense'
        ? 'bg-expense'
        : tone === 'warning'
          ? 'bg-warning'
          : 'bg-accent';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${
        selected ? `${selBg} text-white` : 'bg-surfaceAlt text-textSecondary'
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
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-textPrimary outline-none focus:border-accent';

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
      ? 'bg-surfaceAlt text-warning'
      : tone === 'accent'
        ? 'bg-surfaceAlt text-accent'
        : tone === 'income'
          ? 'bg-surfaceAlt text-income'
          : 'bg-surfaceAlt text-textMuted';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-10"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-card border border-border bg-surface p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-textMuted hover:bg-surfaceAlt">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {children}
    </div>
  );
}
