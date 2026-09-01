import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchCategories,
  fileToResizedBase64,
  insertTransaction,
  parseReceipt,
  ReceiptNotConfiguredError,
  suggestCategory,
  uploadReceipt,
} from '../lib/api';
import type { CatSuggestion, Category, ItemDraft, ReceiptParse } from '../lib/types';
import { useEffect } from 'react';
import ItemsEditor from '../components/ItemsEditor';
import { Badge, Button, Card, Chip, Field, PageTitle, Select, TextInput } from '../components/ui';

function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TIER_LABEL: Record<CatSuggestion['tier'], string> = {
  rule: 'learned rule',
  keyword: 'keywords',
  knn: 'similarity',
  llm: 'AI',
  none: 'fallback',
};

// Manual entry + receipt scan. A receipt photo prefills merchant, date, total
// AND line items (vision extraction); everything is reviewable before save.
export default function Add({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [cats, setCats] = useState<Category[]>([]);

  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);

  const [suggestion, setSuggestion] = useState<CatSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptParsed, setReceiptParsed] = useState<ReceiptParse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories(userId).then(setCats);
  }, [userId]);

  // Auto-suggest a category when the description loses focus.
  const suggest = async () => {
    const text = description.trim();
    if (!text || category) return;
    setSuggesting(true);
    const s = await suggestCategory(text);
    setSuggesting(false);
    if (s && s.category) {
      setSuggestion(s);
      setCategory(s.category);
    }
  };

  const onReceiptPicked = async (file: File) => {
    setReceiptFile(file);
    setScanning(true);
    setScanMsg(null);
    setError(null);
    try {
      const { base64, mediaType } = await fileToResizedBase64(file);
      const parsed = await parseReceipt(base64, mediaType);
      setReceiptParsed(parsed);
      if (parsed.merchant) setDescription(parsed.merchant);
      if (parsed.total != null) setAmount(String(parsed.total));
      if (parsed.date) setDate(`${parsed.date}T12:00`);
      if (parsed.items.length > 0) {
        setItems(parsed.items.map((it) => ({ ...it, category: null })));
      }
      setScanMsg(
        `Extracted ${parsed.items.length} line item${parsed.items.length === 1 ? '' : 's'} — review below, then save.`
      );
      if (parsed.merchant && !category) {
        const s = await suggestCategory(parsed.merchant);
        if (s?.category) {
          setSuggestion(s);
          setCategory(s.category);
        }
      }
    } catch (e: any) {
      if (e instanceof ReceiptNotConfiguredError) {
        setScanMsg(e.message + ' You can still enter the receipt manually.');
      } else {
        setScanMsg(e.message ?? 'Extraction failed — enter the receipt manually.');
      }
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError('Enter a valid amount.');
    if (!description.trim()) return setError('Description is required.');
    setSaving(true);
    setError(null);
    try {
      const txn = await insertTransaction(
        userId,
        {
          amount: amt,
          currency: 'SGD',
          direction,
          description: description.trim(),
          merchant: description.trim(),
          category: category || null,
          categoryConfidence: suggestion && category === suggestion.category ? suggestion.confidence : 1,
          transactionDate: new Date(date).toISOString(),
          notes: notes.trim() || null,
        },
        items.filter((it) => it.name.trim() && it.amount > 0)
      );
      if (receiptFile) await uploadReceipt(userId, txn.id, receiptFile, receiptParsed);
      navigate('/transactions');
    } catch (e: any) {
      setError(e.message ?? 'Save failed.');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageTitle>Add transaction</PageTitle>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={scanning}>
            {scanning ? 'Scanning…' : '📷 Scan a receipt'}
          </Button>
          <span className="text-xs text-textMuted">
            Photo/screenshot → merchant, total, date and line items are extracted for review.
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && onReceiptPicked(e.target.files[0])}
          />
        </div>
        {scanMsg && <p className="mt-2 text-sm text-textSecondary">{scanMsg}</p>}
      </Card>

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Amount (SGD)">
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={amount}
              placeholder="0.00"
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
            <TextInput
              value={description}
              placeholder="e.g. Burger King Jem"
              onChange={(e) => setDescription(e.target.value)}
              onBlur={suggest}
            />
          </Field>
          <Field label="Category">
            <div className="flex items-center gap-2">
              <Select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1">
                <option value="">Uncategorized</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {suggesting && <span className="text-xs text-textMuted">…</span>}
              {suggestion && category === suggestion.category && (
                <Badge tone="accent">
                  {TIER_LABEL[suggestion.tier]} · {Math.round(suggestion.confidence * 100)}%
                </Badge>
              )}
            </div>
          </Field>
          <Field label="Date & time">
            <TextInput type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Notes">
            <TextInput value={notes} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-semibold">Line items (optional)</h3>
          <ItemsEditor
            items={items}
            onChange={setItems}
            categories={cats}
            transactionTotal={parseFloat(amount) || null}
          />
        </div>

        {error && <p className="mt-3 text-sm text-expense">{error}</p>}

        <div className="mt-5 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save transaction'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
