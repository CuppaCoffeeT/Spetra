import { useEffect, useMemo, useState } from 'react';
import { fetchCategories, fetchTransactions, monthOf, formatMonthLabel } from '../lib/api';
import type { Category, Transaction } from '../lib/types';
import { AmountText, Card, ColorDot, PageTitle, Spinner } from '../components/ui';

export default function Transactions({ userId }: { userId: string }) {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchTransactions(userId), fetchCategories(userId)])
      .then(([t, c]) => {
        setTxns(t);
        setCats(c);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const colorOf = useMemo(() => {
    const m: Record<string, string | null> = {};
    cats.forEach((c) => (m[c.name] = c.color));
    return m;
  }, [cats]);

  const months = useMemo(
    () => Array.from(new Set(txns.map((t) => monthOf(t.transactionDate)))).sort().reverse(),
    [txns]
  );

  const filtered = month ? txns.filter((t) => monthOf(t.transactionDate) === month) : txns;

  if (loading) return <Spinner />;

  return (
    <div>
      <PageTitle>Transactions</PageTitle>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setMonth(null)}
          className={`rounded-full px-3 py-1 text-sm ${
            month === null ? 'bg-accent text-white' : 'bg-surfaceAlt text-textSecondary'
          }`}
        >
          All
        </button>
        {months.map((m) => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={`rounded-full px-3 py-1 text-sm ${
              month === m ? 'bg-accent text-white' : 'bg-surfaceAlt text-textSecondary'
            }`}
          >
            {formatMonthLabel(m)}
          </button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-textMuted">No transactions.</p>
        ) : (
          <div className="flex flex-col">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border-b border-border py-3 text-sm last:border-0"
              >
                <div className="flex items-center gap-3">
                  <ColorDot color={colorOf[t.category ?? ''] ?? null} />
                  <div>
                    <div className="text-textPrimary">{t.description}</div>
                    <div className="text-xs text-textMuted">
                      {new Date(t.transactionDate).toLocaleDateString()} · {t.category ?? 'Uncategorized'}
                      {t.source !== 'manual' ? ` · ${t.source}` : ''}
                    </div>
                  </div>
                </div>
                <AmountText amount={t.amount} direction={t.direction} currency={t.currency} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
