import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteRule,
  deleteTransaction,
  extractMerchantKey,
  fetchItems,
  fetchRules,
  learnCorrection,
  saveItems,
  updateTransaction,
} from '../lib/api';
import { showToast } from '../lib/toastBus';
import type { Category, ItemDraft, Transaction } from '../lib/types';
import ItemsEditor, { countIncomplete } from './ItemsEditor';
import { Badge, Button, Chip, Field, Modal, Select, Spinner, TextInput } from './ui';

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Everything the user can lose. Serialized once when items finish loading,
// re-serialized on render to decide whether closing needs a confirm.
type Snapshot = {
  amount: string;
  direction: 'in' | 'out';
  description: string;
  category: string;
  date: string;
  notes: string;
  items: ItemDraft[];
};

// Edit any transaction: all fields + line items. Re-categorizing teaches the
// categorizer (priority-200 rule). Saving clears the needs_review flag.
export default function TransactionEditor({
  txn,
  userId,
  categories,
  onClose,
  onSaved,
}: {
  txn: Transaction;
  userId: string;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState(String(txn.amount));
  const [direction, setDirection] = useState<'in' | 'out'>(txn.direction);
  const [description, setDescription] = useState(txn.description);
  const [category, setCategory] = useState(txn.category ?? '');
  const [date, setDate] = useState(toLocalInput(txn.transactionDate));
  const [notes, setNotes] = useState(txn.notes ?? '');
  const [items, setItems] = useState<ItemDraft[] | null>(null);
  const [initialSnap, setInitialSnap] = useState<string | null>(null);
  const [warnedIncomplete, setWarnedIncomplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const baseline = (drafts: ItemDraft[]): string =>
      JSON.stringify({
        amount: String(txn.amount),
        direction: txn.direction,
        description: txn.description,
        category: txn.category ?? '',
        date: toLocalInput(txn.transactionDate),
        notes: txn.notes ?? '',
        items: drafts,
      } satisfies Snapshot);
    fetchItems(txn.id)
      .then((rows) => {
        const drafts = rows.map((r) => ({
          name: r.name,
          qty: r.qty,
          unitPrice: r.unitPrice,
          amount: r.amount,
          category: r.category,
        }));
        setItems(drafts);
        setInitialSnap(baseline(drafts));
      })
      .catch(() => {
        setItems([]);
        setInitialSnap(baseline([]));
      });
    // Intentionally keyed on the id: a parent re-render must not refetch and
    // clobber in-progress edits or the dirty baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txn.id]);

  const dirty =
    initialSnap !== null &&
    items !== null &&
    JSON.stringify({
      amount,
      direction,
      description,
      category,
      date,
      notes,
      items,
    } satisfies Snapshot) !== initialSnap;

  const incompleteCount = items ? countIncomplete(items) : 0;

  // Undo for the LEARNED slip: delete the priority-200 rule the correction
  // just created; if it can't be found, hand the user the rules list.
  const undoLearn = async (pattern: string, cat: string) => {
    try {
      const rules = await fetchRules(userId);
      const key = extractMerchantKey(pattern);
      const match = rules.find(
        (r) =>
          r.priority === 200 &&
          r.category.toLowerCase() === cat.toLowerCase() &&
          (r.pattern.toLowerCase() === pattern.toLowerCase() ||
            (key !== '' && r.pattern.toLowerCase() === key))
      );
      if (match) await deleteRule(match.id);
      else navigate('/categories');
    } catch {
      navigate('/categories');
    }
  };

  const save = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError('Enter a valid amount.');
    if (!description.trim()) return setError('Description is required.');
    const drafts = items ?? [];
    // Two-step guard: half-filled rows get one visible warning; only an
    // explicit second Save drops them. Never a silent loss.
    if (countIncomplete(drafts) > 0 && !warnedIncomplete) {
      setWarnedIncomplete(true);
      return;
    }
    setSaving(true);
    setError(null);
    const categoryChanged = !!category && category !== (txn.category ?? '');
    const pattern = txn.merchant ?? description.trim();
    try {
      await updateTransaction(txn.id, {
        amount: amt,
        direction,
        description: description.trim(),
        category: category || null,
        transactionDate: new Date(date).toISOString(),
        notes: notes.trim() || null,
        needsReview: false,
      });
      // The learning loop: correction -> merchant rule + embedded example
      // (feeds the kNN tier so similar merchants auto-sort next time).
      if (categoryChanged) {
        await learnCorrection(userId, pattern, category);
      }
      await saveItems(
        userId,
        txn.id,
        drafts.filter((it) => it.name.trim() && it.amount > 0)
      );
      onSaved();
      if (categoryChanged) {
        showToast({
          kind: 'note',
          label: 'LEARNED',
          message: `${pattern} → ${category}`,
          action: { label: 'Undo', run: () => void undoLearn(pattern, category) },
        });
      }
    } catch (e: any) {
      setError(e.message ?? 'Save failed.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this transaction? Auto-ingest may re-import it if the alert is replayed.')) return;
    setSaving(true);
    try {
      await deleteTransaction(txn.id);
      onSaved();
    } catch (e: any) {
      setError(e.message ?? 'Delete failed.');
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit transaction"
      onClose={onClose}
      onBeforeClose={() => !dirty || confirm('Discard changes?')}
      wide
      footer={
        <div className="flex flex-col gap-2">
          {warnedIncomplete && incompleteCount > 0 && (
            <p className="text-xs text-warning">
              {incompleteCount === 1
                ? '1 line item is incomplete and will be dropped.'
                : `${incompleteCount} line items are incomplete and will be dropped.`}
            </p>
          )}
          {error && <p className="text-sm text-expense">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button variant="danger" onClick={remove} disabled={saving}>
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-textMuted">
        <Badge>{txn.source}</Badge>
        {txn.cardLabel && <Badge>{txn.cardLabel}</Badge>}
        {txn.categoryConfidence != null && (
          <Badge tone={txn.categoryConfidence >= 0.85 ? 'income' : 'warning'}>
            {Math.round(txn.categoryConfidence * 100)}% confident
          </Badge>
        )}
        {txn.needsReview && <Badge tone="warning">needs review</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Amount">
          <TextInput
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Direction">
          <div className="flex gap-2 pt-1">
            <Chip selected={direction === 'out'} onClick={() => setDirection('out')} tone="expense">
              Expense
            </Chip>
            <Chip selected={direction === 'in'} onClick={() => setDirection('in')} tone="income">
              Income
            </Chip>
          </div>
        </Field>
        <Field label="Description / merchant">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date & time">
          <TextInput type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Notes">
          <TextInput value={notes} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-textSecondary">
          Line items
        </h3>
        {items === null ? (
          <Spinner />
        ) : (
          <ItemsEditor
            items={items}
            onChange={(next) => {
              setItems(next);
              if (countIncomplete(next) === 0) setWarnedIncomplete(false);
            }}
            categories={categories}
            transactionTotal={parseFloat(amount) || null}
            onUseTotal={(sum) => setAmount(String(sum))}
            flagIncomplete={warnedIncomplete}
          />
        )}
      </div>
    </Modal>
  );
}
