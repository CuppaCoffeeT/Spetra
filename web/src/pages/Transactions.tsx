import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchCategories,
  fetchItemizedIds,
  fetchItems,
  fetchTransactions,
  formatMoney,
  formatMonthLabel,
  monthOf,
} from '../lib/api';
import { useLiveTransactions } from '../lib/realtime';
import type { Category, Transaction, TransactionItem } from '../lib/types';
import TransactionEditor from '../components/TransactionEditor';
import { AmountText, Badge, Card, Chip, ColorDot, PageTitle, Spinner, TextInput } from '../components/ui';

export default function Transactions({ userId }: { userId: string }) {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [itemized, setItemized] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const [month, setMonth] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [reviewOnly, setReviewOnly] = useState(searchParams.get('review') === '1');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, TransactionItem[]>>({});
  const [editing, setEditing] = useState<Transaction | null>(null);

  const load = useCallback(() => {
    return Promise.all([fetchTransactions(userId), fetchCategories(userId), fetchItemizedIds(userId)])
      .then(([t, c, ids]) => {
        setTxns(t);
        setCats(c);
        setItemized(ids);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // A card tap / bank alert landed while the page is open — show it instantly.
  useLiveTransactions(userId, (t) => setTxns((prev) => [t, ...prev.filter((p) => p.id !== t.id)]));

  const colorOf = useMemo(() => {
    const m: Record<string, string | null> = {};
    cats.forEach((c) => (m[c.name] = c.color));
    return m;
  }, [cats]);

  const months = useMemo(
    () => Array.from(new Set(txns.map((t) => monthOf(t.transactionDate)))).sort().reverse(),
    [txns]
  );

  const reviewCount = useMemo(() => txns.filter((t) => t.needsReview).length, [txns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txns.filter((t) => {
      if (month && monthOf(t.transactionDate) !== month) return false;
      if (catFilter && (t.category ?? 'Uncategorized') !== catFilter) return false;
      if (reviewOnly && !t.needsReview) return false;
      if (q) {
        const hay = `${t.description} ${t.merchant ?? ''} ${t.notes ?? ''} ${t.category ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [txns, month, catFilter, reviewOnly, query]);

  const toggleExpand = (t: Transaction) => {
    const next = expandedId === t.id ? null : t.id;
    setExpandedId(next);
    if (next && itemsCache[t.id] === undefined) {
      fetchItems(t.id).then((rows) => setItemsCache((c) => ({ ...c, [t.id]: rows })));
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageTitle>Transactions</PageTitle>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search description, notes…"
          className="w-64"
        />
        <Chip selected={reviewOnly} onClick={() => setReviewOnly((v) => !v)} tone="warning">
          Needs review{reviewCount > 0 ? ` (${reviewCount})` : ''}
        </Chip>
        {cats.map((c) => (
          <Chip
            key={c.id}
            selected={catFilter === c.name}
            onClick={() => setCatFilter((f) => (f === c.name ? null : c.name))}
          >
            {c.name}
          </Chip>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip selected={month === null} onClick={() => setMonth(null)}>
          All
        </Chip>
        {months.map((m) => (
          <Chip key={m} selected={month === m} onClick={() => setMonth(m)}>
            {formatMonthLabel(m)}
          </Chip>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-textMuted">No transactions.</p>
        ) : (
          <div className="flex flex-col">
            {filtered.map((t) => {
              const expanded = expandedId === t.id;
              const items = itemsCache[t.id];
              return (
                <div key={t.id} className="border-b border-border last:border-0">
                  <div
                    className="flex cursor-pointer items-center justify-between gap-3 py-3 text-sm"
                    onClick={() => toggleExpand(t)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ColorDot color={colorOf[t.category ?? ''] ?? null} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-textPrimary">
                          <span className="truncate">{t.description}</span>
                          {t.needsReview && <Badge tone="warning">review</Badge>}
                          {itemized.has(t.id) && <Badge tone="accent">items</Badge>}
                        </div>
                        <div className="text-xs text-textMuted">
                          {new Date(t.transactionDate).toLocaleDateString()} ·{' '}
                          {t.category ?? 'Uncategorized'}
                          {t.source !== 'manual' ? ` · ${t.source}` : ''}
                          {t.cardLabel ? ` · ${t.cardLabel}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <AmountText amount={t.amount} direction={t.direction} currency={t.currency} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(t);
                        }}
                        className="rounded-lg px-2 py-1 text-xs text-textSecondary hover:bg-surfaceAlt"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mb-3 ml-6 rounded-lg bg-surfaceAlt p-3 text-sm">
                      {items === undefined ? (
                        <p className="text-xs text-textMuted">Loading items…</p>
                      ) : items.length === 0 ? (
                        <p className="text-xs text-textMuted">
                          No line items — use Edit to itemize this transaction.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {items.map((it) => (
                            <div key={it.id} className="flex items-center justify-between">
                              <span className="text-textSecondary">
                                {it.qty !== 1 ? `${it.qty} × ` : ''}
                                {it.name}
                                {it.category && (
                                  <span className="ml-2 text-xs text-textMuted">{it.category}</span>
                                )}
                              </span>
                              <span className="tabular-nums text-textSecondary">
                                {formatMoney(it.amount, t.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {t.notes && <p className="mt-2 text-xs text-textMuted">📝 {t.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {editing && (
        <TransactionEditor
          txn={editing}
          userId={userId}
          categories={cats}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setItemsCache({});
            load();
          }}
        />
      )}
    </div>
  );
}
