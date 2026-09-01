import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  clearBudget,
  fetchBudgets,
  fetchCategories,
  fetchTransactions,
  currentMonth,
  formatMonthLabel,
  formatMoney,
  setBudget,
  spentByCategory,
} from '../lib/api';
import { useLiveTransactions } from '../lib/realtime';
import type { Budget, Category, Transaction } from '../lib/types';
import { AmountText, Button, Card, ColorDot, PageTitle, ProgressBar, Spinner, TextInput } from '../components/ui';
import { ChevronLeft, ChevronRight } from '../components/Icons';

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Budgets({ userId }: { userId: string }) {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());
  const [editing, setEditing] = useState<string | null>(null); // category id
  const [draft, setDraft] = useState('');
  const [carrying, setCarrying] = useState(false);
  const [staggered, setStaggered] = useState(false); // rows fade in after a carry-over

  const load = useCallback(() => {
    return Promise.all([fetchTransactions(userId), fetchCategories(userId), fetchBudgets(userId)])
      .then(([t, c, b]) => {
        setTxns(t);
        setCats(c);
        setBudgets(b);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live Apple Pay taps land here too — the 400ms bar-width transition is the
  // only notification.
  useLiveTransactions(userId, (t) => setTxns((prev) => [t, ...prev.filter((p) => p.id !== t.id)]));

  useEffect(() => {
    setStaggered(false);
  }, [month]);

  const saveCap = async (categoryId: string) => {
    const limit = parseFloat(draft);
    if (Number.isFinite(limit) && limit > 0) {
      await setBudget(userId, categoryId, month, limit);
      await load();
    }
    setEditing(null);
    setDraft('');
  };

  const removeCap = async (budgetId: string, catName: string) => {
    if (!confirm(`Remove the ${catName} cap for ${formatMonthLabel(month)}?`)) return;
    await clearBudget(budgetId);
    await load();
  };

  const prevMonth = shiftMonth(month, -1);
  const monthBudgets = useMemo(() => budgets.filter((b) => b.month === month), [budgets, month]);
  const priorBudgets = useMemo(
    () => budgets.filter((b) => b.month === prevMonth && b.categoryId),
    [budgets, prevMonth]
  );

  const carryOver = async () => {
    if (carrying || priorBudgets.length === 0) return;
    setCarrying(true);
    try {
      for (const b of priorBudgets) {
        await setBudget(userId, b.categoryId!, month, b.limitAmount);
      }
      await load();
      setStaggered(true);
    } finally {
      setCarrying(false);
    }
  };

  const rows = useMemo(() => {
    const byName = spentByCategory(txns, month);
    return cats.map((cat) => {
      const budget = budgets.find((b) => b.categoryId === cat.id && b.month === month) ?? null;
      const limit = budget?.limitAmount ?? 0;
      const spent = byName[cat.name] ?? 0;
      const pct = limit > 0 ? spent / limit : 0;
      return { cat, budget, limit, spent, pct, over: limit > 0 && spent > limit, hasBudget: !!budget };
    });
  }, [cats, budgets, txns, month]);

  const totalBudgeted = rows.reduce((s, r) => s + r.limit, 0);
  const totalSpent = rows.filter((r) => r.hasBudget).reduce((s, r) => s + r.spent, 0);
  const overallPct = totalBudgeted > 0 ? totalSpent / totalBudgeted : 0;

  // Pace tick — only meaningful for the month we are living through.
  const isCurrentMonth = month === currentMonth();
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const elapsed = dayOfMonth / daysInMonth;

  if (loading) return <Spinner />;

  let budgetIdx = -1; // stagger index across rows that hold a budget

  return (
    <div>
      <PageTitle>Budgets</PageTitle>

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="grid h-11 w-11 place-items-center rounded-lg text-textSecondary transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <ChevronLeft />
        </button>
        <span className="font-display text-base font-medium text-textPrimary">{formatMonthLabel(month)}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="grid h-11 w-11 place-items-center rounded-lg text-textSecondary transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <ChevronRight />
        </button>
      </div>

      <Card className="mb-6">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-textSecondary">Budgeted</span>
          <AmountText amount={totalBudgeted} />
        </div>
        <div className="mb-3 flex justify-between text-sm">
          <span className="text-textSecondary">Spent (budgeted)</span>
          <AmountText amount={totalSpent} />
        </div>
        <div className="relative">
          <ProgressBar
            value={overallPct}
            tone={totalSpent > totalBudgeted && totalBudgeted > 0 ? 'expense' : overallPct >= 0.8 ? 'warning' : 'accent'}
          />
          {isCurrentMonth && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-[14px] w-px -translate-y-1/2"
              style={{
                left: `${elapsed * 100}%`,
                background: 'var(--text-primary)',
                boxShadow: '0 0 0 1px var(--bg)',
              }}
            />
          )}
        </div>
        {isCurrentMonth && (
          <p className="mt-1 text-right text-[11px] text-textSecondary">
            Day {dayOfMonth} · {Math.round(elapsed * 100)}% elapsed
          </p>
        )}
      </Card>

      {monthBudgets.length === 0 && priorBudgets.length > 0 && (
        <div className="-mt-3 mb-6">
          <button
            type="button"
            disabled={carrying}
            onClick={carryOver}
            className="min-h-[44px] rounded-lg px-2 text-sm text-accent transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent disabled:opacity-50"
          >
            Carry over {formatMonthLabel(prevMonth)}&rsquo;s budgets
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {rows.map(({ cat, budget, limit, spent, pct, over, hasBudget }) => {
          if (hasBudget) budgetIdx += 1;
          const stagger = staggered && hasBudget;
          return (
            <div
              key={cat.id}
              className={stagger ? 'animate-row-in' : undefined}
              style={stagger ? { animationDelay: `${budgetIdx * 40}ms` } : undefined}
            >
            <Card>
              <div className="mb-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  to={`/transactions?cat=${encodeURIComponent(cat.name)}&month=${month}`}
                  className="flex items-center gap-2 self-start font-medium text-textPrimary transition-colors duration-[160ms] ease-house hover:text-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent sm:self-auto"
                >
                  <ColorDot color={cat.color} />
                  {cat.name}
                </Link>
                <span className="flex flex-wrap items-center gap-3 text-sm text-textSecondary">
                  {editing === cat.id ? (
                    <>
                      <TextInput
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="1"
                        value={draft}
                        autoFocus
                        placeholder="Cap"
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveCap(cat.id)}
                        className="w-24 flex-1 sm:flex-none"
                      />
                      <Button onClick={() => saveCap(cat.id)}>Set</Button>
                      <Button variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : hasBudget ? (
                    <>
                      <span className="[font-variant-numeric:tabular-nums]">{formatMoney(spent)} / {formatMoney(limit)}</span>
                      {!over && (
                        <span className="[font-variant-numeric:tabular-nums] text-textSecondary">
                          {formatMoney(limit - spent)} left
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        className="-my-1 min-h-[44px]"
                        onClick={() => {
                          setEditing(cat.id);
                          setDraft(String(limit));
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="-my-1 min-h-[44px]"
                        onClick={() => budget && removeCap(budget.id, cat.name)}
                      >
                        Clear
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(cat.id);
                        setDraft('');
                      }}
                    >
                      Set budget
                    </Button>
                  )}
                </span>
              </div>
              {hasBudget && (
                <>
                  <ProgressBar value={pct} tone={over ? 'expense' : pct >= 0.8 ? 'warning' : 'accent'} />
                  {over && <p className="mt-1 text-xs text-expense">Over by {formatMoney(spent - limit)}</p>}
                </>
              )}
            </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
