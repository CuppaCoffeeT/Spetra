import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { Budget, Category, Transaction } from '../lib/types';
import { AmountText, Button, Card, ColorDot, PageTitle, ProgressBar, Spinner, TextInput } from '../components/ui';

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

  const saveCap = async (categoryId: string) => {
    const limit = parseFloat(draft);
    if (Number.isFinite(limit) && limit > 0) {
      await setBudget(userId, categoryId, month, limit);
      await load();
    }
    setEditing(null);
    setDraft('');
  };

  const removeCap = async (budgetId: string) => {
    await clearBudget(budgetId);
    await load();
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

  if (loading) return <Spinner />;

  return (
    <div>
      <PageTitle>Budgets</PageTitle>

      <div className="mb-4 flex items-center gap-4">
        <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-lg bg-surfaceAlt px-3 py-1 text-sm">
          ‹
        </button>
        <span className="font-semibold">{formatMonthLabel(month)}</span>
        <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="rounded-lg bg-surfaceAlt px-3 py-1 text-sm">
          ›
        </button>
      </div>

      <Card className="mb-6">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-textMuted">Budgeted</span>
          <AmountText amount={totalBudgeted} />
        </div>
        <div className="mb-3 flex justify-between text-sm">
          <span className="text-textMuted">Spent</span>
          <AmountText amount={totalSpent} />
        </div>
        <ProgressBar
          value={overallPct}
          tone={totalSpent > totalBudgeted && totalBudgeted > 0 ? 'expense' : overallPct >= 0.8 ? 'warning' : 'accent'}
        />
      </Card>

      <div className="flex flex-col gap-3">
        {rows.map(({ cat, budget, limit, spent, pct, over, hasBudget }) => (
          <Card key={cat.id}>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <ColorDot color={cat.color} />
                {cat.name}
              </span>
              <span className="flex items-center gap-2 text-sm text-textMuted">
                {editing === cat.id ? (
                  <>
                    <TextInput
                      type="number"
                      min="0"
                      step="1"
                      value={draft}
                      autoFocus
                      placeholder="Cap"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveCap(cat.id)}
                      className="w-24"
                    />
                    <Button onClick={() => saveCap(cat.id)}>Set</Button>
                    <Button variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </>
                ) : hasBudget ? (
                  <>
                    {formatMoney(spent)} / {formatMoney(limit)}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(cat.id);
                        setDraft(String(limit));
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => budget && removeCap(budget.id)}>
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
                {over && (
                  <p className="mt-1 text-xs text-expense">Over by {formatMoney(spent - limit)}</p>
                )}
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
