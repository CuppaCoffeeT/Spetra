import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchBudgets,
  fetchCategories,
  fetchTransactions,
  currentMonth,
  formatMonthLabel,
  monthOf,
  spentByCategory,
  formatMoney,
  formatDate,
} from '../lib/api';
import { useLiveTransactions } from '../lib/realtime';
import type { Budget, Category, Transaction } from '../lib/types';
import { AmountText, Badge, Button, Card, ColorDot, PageTitle, ProgressBar, Spinner } from '../components/ui';
import { ChevronRight } from '../components/Icons';

function StatLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-medium uppercase tracking-[0.08em] text-textSecondary ${className}`}>
      {children}
    </p>
  );
}

// Standalone hero figure: symbol + cents at 60% in textSecondary. The spans are
// butt-joined (zero whitespace) so the parent's textContent stays contiguous —
// e2e reads '$101.90' / '$2,500.00' as one string.
function Hero({
  amount,
  size = 'text-4xl',
  alarm = false,
}: {
  amount: number;
  size?: string;
  alarm?: boolean;
}) {
  const text = formatMoney(amount);
  const dot = text.lastIndexOf('.');
  const symbol = text.slice(0, 1);
  const whole = text.slice(1, dot);
  const cents = text.slice(dot);
  const sub = alarm ? '' : 'text-textSecondary';
  return (
    <span
      className={`font-semibold tracking-[-0.02em] [font-variant-numeric:tabular-nums] ${
        alarm ? 'text-expense' : 'text-textPrimary'
      } ${size}`}
    >{amount < 0 && '−'}<span className={`text-[0.6em] ${sub}`}>{symbol}</span>{whole}<span className={`text-[0.6em] ${sub}`}>{cents}</span></span>
  );
}

// Single 'See all' treatment for every card header — 11px caps per spec §2, with
// p-2/-m-2 hit-slop lifting the touch target toward 44px without extra visual weight.
const seeAllCls =
  'text-[11px] font-medium uppercase tracking-[0.08em] text-accent p-2 -m-2 rounded-lg focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent';

const rowLinkCls =
  'flex items-center justify-between gap-3 border-b border-border py-3 text-sm transition-colors duration-[160ms] ease-house last:border-0 hover:bg-surfaceAlt/50 active:bg-surfaceAlt focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent';

// Quiet tappability cue for deep-link rows on touch — hidden at md+ where hover carries it.
function RowChevron() {
  return <ChevronRight size={16} className="shrink-0 text-textMuted md:hidden" />;
}

export default function Dashboard({ userId }: { userId: string }) {
  const navigate = useNavigate();
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
  const monthLabel = formatMonthLabel(month);
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

  // First run: a single concierge card, nothing else.
  if (txns.length === 0) {
    return (
      <div>
        <PageTitle>Dashboard</PageTitle>
        <Card className="mx-auto mt-12 max-w-md py-10 text-center">
          <h2 className="font-display text-2xl font-medium text-textPrimary">Begin your ledger.</h2>
          <p className="mt-2 text-sm text-textSecondary">
            Add your first expense, or connect live Apple Pay tracking.
          </p>
          <div className="mt-6 flex flex-col items-stretch gap-2">
            <Button onClick={() => navigate('/add')}>Add your first transaction</Button>
            <Button variant="ghost" onClick={() => navigate('/settings')}>
              Set up live tracking
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        action={
          reviewCount > 0 ? (
            <Link
              to="/transactions?review=1"
              className="inline-flex min-h-[44px] items-center rounded-full border border-border px-4 text-sm text-warning transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
            >
              {reviewCount} transaction{reviewCount === 1 ? '' : 's'} to review
            </Link>
          ) : undefined
        }
      >
        Dashboard
      </PageTitle>

      {/* Desktop: three stat cards. */}
      <div className="hidden gap-4 md:grid md:grid-cols-3">
        <Card>
          <StatLabel>Spent — {monthLabel}</StatLabel>
          <p className="mt-2">
            <Hero amount={spent} />
          </p>
        </Card>
        <Card>
          <StatLabel>Income — {monthLabel}</StatLabel>
          <p className="mt-2">
            <Hero amount={income} />
          </p>
        </Card>
        <Card>
          <StatLabel>Net — {monthLabel}</StatLabel>
          <p className="mt-2">
            <Hero amount={net} alarm={net < 0} />
            {net < 0 && <span className="ml-2 text-xs text-textSecondary">overspent</span>}
          </p>
        </Card>
      </div>

      {/* Mobile: one shared card — Spent hero, hairline, Income + Net at half scale. */}
      <Card className="md:hidden">
        <StatLabel>Spent — {monthLabel}</StatLabel>
        <p className="mt-2">
          <Hero amount={spent} size="text-[40px]" />
        </p>
        <div className="my-4 border-t border-border" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <StatLabel>Income</StatLabel>
            <p className="mt-1">
              <Hero amount={income} size="text-xl" />
            </p>
          </div>
          <div>
            <StatLabel>Net</StatLabel>
            <p className="mt-1">
              <Hero amount={net} size="text-xl" alarm={net < 0} />
              {net < 0 && <span className="ml-1.5 text-xs text-textSecondary">overspent</span>}
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">This Month's Budgets</h2>
            <Link to="/budgets" className={seeAllCls}>
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
                    <span className="text-textSecondary [font-variant-numeric:tabular-nums]">
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
          <h2 className="mb-4 font-medium">Top Categories</h2>
          {topCats.length === 0 ? (
            <p className="text-sm text-textMuted">No spending this month.</p>
          ) : (
            <div className="flex flex-col">
              {topCats.map(([name, amt]) => (
                <Link
                  key={name}
                  to={`/transactions?cat=${encodeURIComponent(name)}&month=${month}`}
                  className={rowLinkCls}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ColorDot color={colorOf[name] ?? null} />
                    {name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-textSecondary [font-variant-numeric:tabular-nums]">
                      {formatMoney(amt)}
                    </span>
                    <RowChevron />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium">Recent Transactions</h2>
          <Link to="/transactions" className={seeAllCls}>
            See all
          </Link>
        </div>
        <div className="flex flex-col">
          {txns.slice(0, 8).map((t) => (
            <Link key={t.id} to={`/transactions?open=${t.id}`} className={rowLinkCls}>
              <span className="flex min-w-0 items-center gap-2">
                <ColorDot color={colorOf[t.category ?? ''] ?? null} />
                <span className="min-w-0">
                  {t.description}
                  <span className="ml-2 text-xs text-textSecondary">
                    {formatDate(t.transactionDate)}
                  </span>
                </span>
                {t.needsReview && <Badge tone="warning">review</Badge>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <AmountText amount={t.amount} direction={t.direction} currency={t.currency} />
                <RowChevron />
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
