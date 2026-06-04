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

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-6 text-2xl font-bold text-textPrimary">{children}</h1>;
}
