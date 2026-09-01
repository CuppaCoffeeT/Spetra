import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  fetchCategories,
  fetchItemizedIds,
  fetchItems,
  fetchTransactions,
  formatMoney,
  formatMonthLabel,
  monthOf,
  updateTransaction,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // URL is the source of truth for the filters — deep links from the toast,
  // Dashboard and Budgets land here fully applied.
  const reviewOnly = searchParams.get('review') === '1';
  const catFilter = searchParams.get('cat');
  const month = searchParams.get('month');

  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, TransactionItem[]>>({});
  const [editing, setEditing] = useState<Transaction | null>(null);
  // Rows whose 'review' badge is mid cross-fade after an inline Confirm.
  const [fadingBadges, setFadingBadges] = useState<Set<string>>(new Set());
  // Row that was just added from /add — gets the 1.2s settle tint once.
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (value === null) p.delete(key);
        else p.set(key, value);
        return p;
      });
    },
    [setSearchParams]
  );

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

  // ?open=<id> deep link (toast slip, Dashboard recent rows) → open the editor.
  useEffect(() => {
    const id = searchParams.get('open');
    if (id && !loading) {
      const it = txns.find((t) => t.id === id);
      if (it) setEditing(it);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete('open');
          return p;
        },
        { replace: true }
      );
    }
  }, [loading, searchParams, txns, setSearchParams]);

  // Settle tint for the row just saved on /add; cleared from history state so a
  // refresh doesn't replay the animation.
  useEffect(() => {
    const st = location.state as { justAdded?: string } | null;
    if (st?.justAdded) {
      setJustAddedId(st.justAdded);
      window.history.replaceState({ ...window.history.state, usr: null }, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // One tap clears the flag; the badge cross-fades out instead of vanishing.
  const confirmTxn = (t: Transaction) => {
    updateTransaction(t.id, { needsReview: false }).catch(console.error);
    setFadingBadges((prev) => new Set(prev).add(t.id));
    setTxns((prev) => prev.map((p) => (p.id === t.id ? { ...p, needsReview: false } : p)));
    window.setTimeout(() => {
      setFadingBadges((prev) => {
        const n = new Set(prev);
        n.delete(t.id);
        return n;
      });
    }, 220);
  };

  const clearFilters = () => {
    setQuery('');
    setSearchParams({});
  };

  if (loading) return <Spinner />;

  const railCls =
    'scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0';

  return (
    <div>
      <PageTitle>Transactions</PageTitle>

      <div className="mb-3">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search description, notes…"
          className="w-full md:w-64"
        />
      </div>

      <div className={`${railCls} mb-3`}>
        <Chip
          selected={reviewOnly}
          onClick={() => setParam('review', reviewOnly ? null : '1')}
          tone="warning"
        >
          Needs review{reviewCount > 0 ? ` (${reviewCount})` : ''}
        </Chip>
        {cats.map((c) => (
          <Chip
            key={c.id}
            selected={catFilter === c.name}
            onClick={() => setParam('cat', catFilter === c.name ? null : c.name)}
          >
            {c.name}
          </Chip>
        ))}
      </div>

      <div className={`${railCls} mb-4`}>
        <Chip selected={month === null} onClick={() => setParam('month', null)}>
          All
        </Chip>
        {months.map((m) => (
          <Chip key={m} selected={month === m} onClick={() => setParam('month', m)}>
            {formatMonthLabel(m)}
          </Chip>
        ))}
      </div>

      <Card>
        {txns.length === 0 ? (
          <div className="py-12 text-center text-sm text-textSecondary">
            <p>No transactions yet.</p>
            <Link
              to="/add"
              className="mt-1 inline-block rounded-lg py-3 text-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
            >
              Add your first transaction
            </Link>
          </div>
        ) : reviewOnly && reviewCount === 0 ? (
          <p className="py-12 text-center text-sm text-textSecondary">
            All clear. Nothing awaiting review.
          </p>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-textSecondary">
            <p>Nothing matches these filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 rounded-lg py-3 text-accent underline decoration-border underline-offset-2 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((t) => {
              const expanded = expandedId === t.id;
              const items = itemsCache[t.id];
              const showReviewBadge = t.needsReview || fadingBadges.has(t.id);
              return (
                <div
                  key={t.id}
                  className={`border-b border-border last:border-0 ${
                    justAddedId === t.id ? 'animate-settle-tint' : ''
                  }`}
                >
                  <div className="flex items-center gap-1 text-sm">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`items-${t.id}`}
                      onClick={() => toggleExpand(t)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg py-3 text-left focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ColorDot color={colorOf[t.category ?? ''] ?? null} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-textPrimary">
                            <span className="truncate">{t.description}</span>
                            {showReviewBadge && (
                              <span
                                className={`motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-house ${
                                  t.needsReview ? 'opacity-100' : 'opacity-0'
                                }`}
                              >
                                <Badge tone="warning">review</Badge>
                              </span>
                            )}
                            {itemized.has(t.id) && <Badge tone="accent">items</Badge>}
                          </div>
                          <div className="text-xs text-textSecondary">
                            {new Date(t.transactionDate).toLocaleDateString()} ·{' '}
                            {t.category ?? 'Uncategorized'}
                            {t.source !== 'manual' ? ` · ${t.source}` : ''}
                            {t.cardLabel ? ` · ${t.cardLabel}` : ''}
                          </div>
                        </div>
                      </div>
                      <AmountText
                        amount={t.amount}
                        direction={t.direction}
                        currency={t.currency}
                        className="shrink-0"
                      />
                    </button>
                    {t.needsReview && (
                      <button
                        type="button"
                        onClick={() => confirmTxn(t)}
                        className="-my-2 min-h-[44px] shrink-0 rounded-lg px-2 py-2.5 text-[13px] font-medium text-accent transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
                      >
                        Confirm
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="-my-2 min-h-[44px] shrink-0 rounded-lg px-2 py-2.5 text-[13px] text-textSecondary transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      Edit
                    </button>
                  </div>

                  {expanded && (
                    <div id={`items-${t.id}`} className="mb-3 ml-6 rounded-lg bg-surfaceAlt p-3 text-sm">
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
                      {t.notes && (
                        <p className="mt-2 text-xs text-textSecondary">
                          <span className="mr-1 text-[10px] font-medium uppercase tracking-[0.08em]">
                            Notes
                          </span>
                          {t.notes}
                        </p>
                      )}
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
