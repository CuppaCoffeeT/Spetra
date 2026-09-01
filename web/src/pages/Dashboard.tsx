import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchBudgets,
  fetchCategories,
  fetchTransactions,
  currentMonth,
  monthOf,
  spentByCategory,
  formatMoney,
} from '../lib/api';
import { useLiveTransactions } from '../lib/realtime';
import type { Budget, Category, Transaction } from '../lib/types';
import { AmountText, Badge, Card, ColorDot, PageTitle, ProgressBar, Spinner } from '../components/ui';

export default function Dashboard({ userId }: { userId: string }) {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTransactions(userId), fetchCategories(userId), fetchBudgets(userId)])
      .then(([t, c, b]) => {
        setTxns(t);
        setCats(c);
        setBudgets(b);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  // Live: a card tap lands on the dashboard the moment it's ingested.
  useLiveTransactions(userId, (t) => setTxns((prev) => [t, ...prev.filter((p) => p.id !== t.id)]));

  const month = currentMonth();
  const reviewCount = useMemo(() => txns.filter((t) => t.needsReview).length, [txns]);
  const colorOf = useMemo(() => {
    const m: Record<string, string | null> = {};
    cats.forEach((c) => (m[c.name] = c.color));
    return m;
  }, [cats]);

  const { spent, income, net, topCats } = useMemo(() => {
    const inMonth = txns.filter((t) => monthOf(t.transactionDate) === month);
    const spent = inMonth.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0);
    const income = inMonth.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0);
    const byCat = spentByCategory(txns, month);
    const topCats = Object.entries(byCat)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    return { spent, income, net: income - spent, topCats };
  }, [txns, month]);

  const monthBudgets = useMemo(() => {
    const byName = spentByCategory(txns, month);
    return budgets
      .filter((b) => b.month === month)
      .map((b) => {
        const cat = cats.find((c) => c.id === b.categoryId);
        const sp = cat ? (byName[cat.name] ?? 0) : 0;
        const pct = b.limitAmount > 0 ? sp / b.limitAmount : 0;
        return { b, cat, sp, pct, over: sp > b.limitAmount };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, cats, txns, month]);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageTitle
        action={
          reviewCount > 0 ? (
            <Link to="/transactions?review=1">
              <Badge tone="warning">
                {reviewCount} transaction{reviewCount === 1 ? '' : 's'} to review
              </Badge>
            </Link>
          ) : undefined
        }
      >
        Dashboard
      </PageTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-textMuted">Spent</p>
          <p className="mt-1 text-2xl font-bold text-expense">{formatMoney(spent)}</p>
        </Card>
        <Card>
          <p className="text-sm text-textMuted">Income</p>
          <p className="mt-1 text-2xl font-bold text-income">{formatMoney(income)}</p>
        </Card>
        <Card>
          <p className="text-sm text-textMuted">Net</p>
          <p className={`mt-1 text-2xl font-bold ${net >= 0 ? 'text-income' : 'text-expense'}`}>
            {formatMoney(net)}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">This Month's Budgets</h2>
            <Link to="/budgets" className="text-sm text-accent">
              See all
            </Link>
          </div>
          {monthBudgets.length === 0 ? (
            <p className="text-sm text-textMuted">No budgets set this month.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {monthBudgets.slice(0, 5).map(({ b, cat, sp, pct, over }) => (
                <div key={b.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ColorDot color={cat?.color ?? null} />
                      {cat?.name ?? 'Unknown'}
                    </span>
                    <span className="text-textMuted">
                      {formatMoney(sp)} / {formatMoney(b.limitAmount)}
                    </span>
                  </div>
                  <ProgressBar value={pct} tone={over ? 'expense' : pct >= 0.8 ? 'warning' : 'accent'} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Top Categories</h2>
          {topCats.length === 0 ? (
            <p className="text-sm text-textMuted">No spending this month.</p>
          ) : (
            <div className="flex flex-col">
              {topCats.map(([name, amt]) => (
                <div
                  key={name}
                  className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
                >
                  <span className="flex items-center gap-2">
                    <ColorDot color={colorOf[name] ?? null} />
                    {name}
                  </span>
                  <span className="text-textSecondary">{formatMoney(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 font-semibold">Recent Transactions</h2>
        <div className="flex flex-col">
          {txns.slice(0, 8).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
            >
              <span className="flex items-center gap-2">
                <ColorDot color={colorOf[t.category ?? ''] ?? null} />
                <span>
                  {t.description}
                  <span className="ml-2 text-xs text-textMuted">
                    {new Date(t.transactionDate).toLocaleDateString()}
                  </span>
                </span>
              </span>
              <AmountText amount={t.amount} direction={t.direction} currency={t.currency} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
