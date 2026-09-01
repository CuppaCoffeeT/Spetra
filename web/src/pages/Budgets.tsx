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
import { showToast } from '../lib/toastBus';
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

  // Spec §3: never silently mangle input. An invalid cap keeps the editor
  // open (the inline hint says why); only a real save or Cancel closes it.
  const draftValue = parseFloat(draft);
  const draftValid = Number.isFinite(draftValue) && draftValue > 0;

  const saveCap = async (categoryId: string) => {
    if (!draftValid) return;
    await setBudget(userId, categoryId, month, draftValue);
    await load();
    setEditing(null);
    setDraft('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
  };

  // One tap, reversible — the shared toast slip carries the Undo (spec §4
  // pattern); no OS-chrome confirm() inside the ledger surface.
  const removeCap = async (budget: Budget, catName: string) => {
    const { categoryId, limitAmount } = budget;
    const capMonth = month;
    await clearBudget(budget.id);
    await load();
    showToast({
      kind: 'note',
      label: 'CLEARED',
      message: `${catName} cap — ${formatMoney(limitAmount)}`,
      action: {
        label: 'Undo',
        run: () => {
          if (!categoryId) return;
          void setBudget(userId, categoryId, capMonth, limitAmount).then(load);
        },
      },
    });
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
      // One-shot: covers the 240ms row-in animation + max stagger delay, so a
      // cap set later in the same visit doesn't replay the fade.
      window.setTimeout(() => setStaggered(false), 600);
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

      {cats.length > 0 && (
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
              className="absolute top-1/2 h-[14px] w-px -translate-x-1/2 -translate-y-1/2"
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
      )}

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

      {cats.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-sm text-textSecondary">
            <p>No categories yet.</p>
            <Link
              to="/categories"
              className="mt-1 inline-block rounded-lg py-3 text-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
            >
              Create one to set a cap.
            </Link>
          </div>
        </Card>
      ) : (
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
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-textSecondary">
                  {editing === cat.id ? (
                    <span className="flex w-full flex-col gap-1">
                      <span className="flex items-center gap-3">
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
                        <Button className="-my-1 min-h-[44px]" onClick={() => saveCap(cat.id)} disabled={!draftValid}>
                          Set
                        </Button>
                        <Button variant="ghost" className="-my-1 min-h-[44px]" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </span>
                      {draft !== '' && !draftValid && (
                        <span className="text-[11px] text-textSecondary">Enter an amount above zero.</span>
                      )}
                    </span>
                  ) : hasBudget ? (
                    <>
                      <span className="flex items-center gap-3">
                        <span className="[font-variant-numeric:tabular-nums]">{formatMoney(spent)} / {formatMoney(limit)}</span>
                        {!over && (
                          <span className="[font-variant-numeric:tabular-nums] text-textSecondary">
                            {formatMoney(limit - spent)} left
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
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
                          onClick={() => budget && removeCap(budget, cat.name)}
                        >
                          Clear
                        </Button>
                      </span>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      className="-my-1 min-h-[44px]"
                      onClick={() => {
                        setEditing(cat.id);
                        setDraft('');
                      }}
                    >
                      Set budget
                    </Button>
                  )}
                </div>
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
      )}
    </div>
  );
}
