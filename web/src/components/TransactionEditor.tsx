import { useEffect, useState } from 'react';
import {
  deleteTransaction,
  fetchItems,
  learnRule,
  saveItems,
  updateTransaction,
} from '../lib/api';
import type { Category, ItemDraft, Transaction } from '../lib/types';
import ItemsEditor from './ItemsEditor';
import { Badge, Button, Chip, Field, Modal, Select, Spinner, TextInput } from './ui';

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const [amount, setAmount] = useState(String(txn.amount));
  const [direction, setDirection] = useState<'in' | 'out'>(txn.direction);
  const [description, setDescription] = useState(txn.description);
  const [category, setCategory] = useState(txn.category ?? '');
  const [date, setDate] = useState(toLocalInput(txn.transactionDate));
  const [notes, setNotes] = useState(txn.notes ?? '');
  const [items, setItems] = useState<ItemDraft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItems(txn.id)
      .then((rows) =>
        setItems(
          rows.map((r) => ({
            name: r.name,
            qty: r.qty,
            unitPrice: r.unitPrice,
            amount: r.amount,
            category: r.category,
          }))
        )
      )
      .catch(() => setItems([]));
  }, [txn.id]);

  const save = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError('Enter a valid amount.');
    if (!description.trim()) return setError('Description is required.');
    setSaving(true);
    setError(null);
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
      // The learning loop: correction -> permanent merchant rule.
      if (category && category !== (txn.category ?? '')) {
        await learnRule(userId, txn.merchant ?? description, category);
      }
      await saveItems(
        userId,
        txn.id,
        (items ?? []).filter((it) => it.name.trim() && it.amount > 0)
      );
      onSaved();
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
    <Modal title="Edit transaction" onClose={onClose} wide>
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
          <TextInput type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
        <h3 className="mb-2 text-sm font-semibold">Line items</h3>
        {items === null ? (
          <Spinner />
        ) : (
          <ItemsEditor
            items={items}
            onChange={setItems}
            categories={categories}
            transactionTotal={parseFloat(amount) || null}
          />
        )}
      </div>

      {error && <p className="mt-3 text-sm text-expense">{error}</p>}

      <div className="mt-5 flex items-center justify-between">
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
    </Modal>
  );
}
