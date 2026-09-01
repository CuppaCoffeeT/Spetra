import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteRule,
  extractMerchantKey,
  fetchCategories,
  fetchRules,
  fileToResizedBase64,
  formatMoney,
  insertTransaction,
  parseReceipt,
  ReceiptNotConfiguredError,
  suggestCategory,
  uploadReceipt,
  learnCorrection,
} from '../lib/api';
import { showToast } from '../lib/toastBus';
import type { CatSuggestion, Category, ItemDraft, ReceiptParse } from '../lib/types';
import ItemsEditor, { countIncomplete } from '../components/ItemsEditor';
import { Camera, X } from '../components/Icons';
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

const extractedMsg = (n: number) =>
  `Extracted ${n} line item${n === 1 ? '' : 's'} — review below, then save.`;

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
  const [noMatch, setNoMatch] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptParsed, setReceiptParsed] = useState<ReceiptParse | null>(null);
  const [pendingParsed, setPendingParsed] = useState<ReceiptParse | null>(null);
  const [warnedIncomplete, setWarnedIncomplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Latest typed values, readable from async receipt-parse completions.
  const typedRef = useRef({ description: '', amount: '' });
  typedRef.current = { description, amount };

  // Revoke the thumbnail object URL on clear/replace/unmount.
  const receiptUrlRef = useRef<string | null>(null);
  receiptUrlRef.current = receiptUrl;
  useEffect(
    () => () => {
      if (receiptUrlRef.current) URL.revokeObjectURL(receiptUrlRef.current);
    },
    []
  );

  useEffect(() => {
    fetchCategories(userId).then(setCats);
  }, [userId]);

  // Auto-suggest a category when the description loses focus.
  const suggest = async () => {
    const text = description.trim();
    if (!text || category) return;
    setSuggesting(true);
    setNoMatch(false);
    const s = await suggestCategory(text);
    setSuggesting(false);
    // Only apply suggestions that name a category that still exists.
    if (s?.category && cats.some((c) => c.name === s.category)) {
      setSuggestion(s);
      setCategory(s.category);
    } else {
      setNoMatch(true);
    }
  };

  const applyParsed = async (parsed: ReceiptParse) => {
    if (parsed.merchant) setDescription(parsed.merchant);
    if (parsed.total != null) setAmount(String(parsed.total));
    if (parsed.date) setDate(`${parsed.date}T12:00`);
    if (parsed.items.length > 0) {
      setItems(parsed.items.map((it) => ({ ...it, category: null })));
    }
    setScanMsg(extractedMsg(parsed.items.length));
    if (parsed.merchant && !category) {
      setSuggesting(true);
      setNoMatch(false);
      const s = await suggestCategory(parsed.merchant);
      setSuggesting(false);
      if (s?.category && cats.some((c) => c.name === s.category)) {
        setSuggestion(s);
        setCategory(s.category);
      } else {
        setNoMatch(true);
      }
    }
  };

  const onReceiptPicked = async (file: File) => {
    if (receiptUrlRef.current) URL.revokeObjectURL(receiptUrlRef.current);
    setReceiptFile(file);
    setReceiptUrl(URL.createObjectURL(file));
    setReceiptParsed(null);
    setPendingParsed(null);
    setScanning(true);
    setScanMsg(null);
    setError(null);
    try {
      const { base64, mediaType } = await fileToResizedBase64(file);
      const parsed = await parseReceipt(base64, mediaType);
      setReceiptParsed(parsed);
      const typed = typedRef.current;
      if (typed.description.trim() || typed.amount.trim()) {
        // Never silently overwrite what the user typed — ask first.
        setPendingParsed(parsed);
      } else {
        await applyParsed(parsed);
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

  const replaceWithParsed = async () => {
    const parsed = pendingParsed;
    setPendingParsed(null);
    if (parsed) await applyParsed(parsed);
  };

  const keepMine = () => {
    const parsed = pendingParsed;
    setPendingParsed(null);
    if (!parsed) return;
    // Typed values stay; the extracted items are still offered if none exist.
    if (items.length === 0 && parsed.items.length > 0) {
      setItems(parsed.items.map((it) => ({ ...it, category: null })));
      setScanMsg(extractedMsg(parsed.items.length));
    }
  };

  const clearReceipt = () => {
    if (receiptUrlRef.current) URL.revokeObjectURL(receiptUrlRef.current);
    setReceiptUrl(null);
    setReceiptFile(null);
    setReceiptParsed(null);
    setPendingParsed(null);
    setScanMsg(null);
  };

  // Undo a learned correction: delete the priority-200 rule it just created;
  // if it can't be found, fall back to the rules list on /categories.
  const undoLearn = async (pattern: string, learnedCategory: string) => {
    try {
      const rules = await fetchRules(userId);
      const key = extractMerchantKey(pattern);
      const rule = rules.find(
        (r) =>
          r.priority === 200 &&
          r.category.toLowerCase() === learnedCategory.toLowerCase() &&
          (r.pattern.toLowerCase() === key ||
            pattern.toLowerCase().includes(r.pattern.toLowerCase()))
      );
      if (rule) await deleteRule(rule.id);
      else navigate('/categories');
    } catch (e) {
      console.error('undo learn failed:', e);
      navigate('/categories');
    }
  };

  const resetForNext = () => {
    setAmount('');
    setDescription('');
    setCategory('');
    setSuggestion(null);
    setNoMatch(false);
    setItems([]);
    setNotes('');
    setWarnedIncomplete(false);
    setError(null);
    clearReceipt();
    // date + direction are intentionally kept for rapid entry.
  };

  const save = async (andAnother = false) => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError('Enter a valid amount.');
    const desc = description.trim();
    if (!desc) return setError('Description is required.');
    // Two-step guard: half-filled line items warn once, a second Save proceeds.
    if (countIncomplete(items) > 0 && !warnedIncomplete) {
      setWarnedIncomplete(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const txn = await insertTransaction(
        userId,
        {
          amount: amt,
          currency: 'SGD',
          direction,
          description: desc,
          merchant: desc,
          category: category || null,
          categoryConfidence: suggestion && category === suggestion.category ? suggestion.confidence : 1,
          transactionDate: new Date(date).toISOString(),
          notes: notes.trim() || null,
        },
        items.filter((it) => it.name.trim() && it.amount > 0)
      );
      let receiptOk = true;
      if (receiptFile) receiptOk = await uploadReceipt(userId, txn.id, receiptFile, receiptParsed);
      if (receiptFile && !receiptOk) {
        showToast({ kind: 'note', tone: 'warning', message: 'Saved — the receipt image failed to attach.' });
      } else {
        showToast({ kind: 'note', message: `Saved · ${formatMoney(amt)} — ${desc}` });
      }
      // Picking a category the suggester didn't offer is the strongest training
      // signal in the app — teach it (fire-and-forget), and say so, quietly.
      const learnedCategory = category;
      if (learnedCategory && (!suggestion || learnedCategory !== suggestion.category)) {
        learnCorrection(userId, desc, learnedCategory).catch(console.error);
        showToast({
          kind: 'note',
          label: 'LEARNED',
          message: `${desc} → ${learnedCategory}`,
          action: {
            label: 'Undo',
            run: () => {
              void undoLearn(desc, learnedCategory);
            },
          },
        });
      }
      if (andAnother) {
        resetForNext();
        setSaving(false);
      } else {
        navigate('/transactions', { state: { justAdded: txn.id } });
      }
    } catch (e: any) {
      setError(e.message ?? 'Save failed.');
      setSaving(false);
    }
  };

  const incompleteCount = countIncomplete(items);

  return (
    <div className="max-w-3xl">
      <PageTitle>Add transaction</PageTitle>

      <Card className="mb-4">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
          <Button
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="w-full rounded-lg border border-border md:w-auto"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Camera />
              {scanning ? 'Scanning…' : 'Scan a receipt'}
            </span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => cameraRef.current?.click()}
            disabled={scanning}
            className="w-full md:w-auto"
          >
            Take a photo
          </Button>
          <span className="text-xs text-textMuted">
            Photo/screenshot → merchant, total, date and line items are extracted for review.
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onReceiptPicked(f);
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onReceiptPicked(f);
            }}
          />
        </div>
        {receiptFile && receiptUrl && (
          <div className="mt-3 flex items-center gap-3">
            <img
              src={receiptUrl}
              alt="Receipt"
              className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-xs text-textSecondary">
              {receiptFile.name}
            </span>
            <button
              type="button"
              aria-label="Remove receipt"
              onClick={clearReceipt}
              className="-m-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-textSecondary transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <X />
            </button>
          </div>
        )}
        {pendingParsed && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-textSecondary">Replace what you typed with the scanned values?</span>
            <button
              type="button"
              onClick={() => void replaceWithParsed()}
              className="-my-3 py-3 font-medium text-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={keepMine}
              className="-my-3 py-3 text-textSecondary focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
            >
              Keep mine
            </button>
          </div>
        )}
        {scanMsg && <p className="mt-2 text-sm text-textSecondary">{scanMsg}</p>}
      </Card>

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Amount (SGD)">
            <TextInput
              type="number"
              inputMode="decimal"
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
              <Select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (e.target.value) setNoMatch(false);
                }}
                className="flex-1"
              >
                <option value="">Uncategorized</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {suggesting && (
                <span className="whitespace-nowrap text-xs text-textSecondary">
                  Suggesting
                  <span className="animate-dots-pulse">.</span>
                  <span className="animate-dots-pulse [animation-delay:0.2s]">.</span>
                  <span className="animate-dots-pulse [animation-delay:0.4s]">.</span>
                </span>
              )}
              {suggestion && category === suggestion.category && (
                <Badge tone="accent">
                  <span className="uppercase tracking-[0.02em]">
                    {TIER_LABEL[suggestion.tier]} · {Math.round(suggestion.confidence * 100)}%
                  </span>
                </Badge>
              )}
            </div>
            {noMatch && !category && (
              <span className="text-xs text-textSecondary">No match — your pick will teach it.</span>
            )}
          </Field>
          <Field label="Date & time">
            <TextInput type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Notes">
            <TextInput value={notes} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-medium">Line items (optional)</h3>
          <ItemsEditor
            items={items}
            onChange={(next) => {
              setItems(next);
              if (warnedIncomplete && countIncomplete(next) === 0) setWarnedIncomplete(false);
            }}
            categories={cats}
            transactionTotal={parseFloat(amount) || null}
            onUseTotal={(sum: number) => setAmount(String(sum))}
            flagIncomplete={warnedIncomplete}
          />
        </div>

        {warnedIncomplete && incompleteCount > 0 && (
          <p className="mt-3 text-xs text-warning">
            {incompleteCount === 1
              ? '1 line item is incomplete and will be dropped.'
              : `${incompleteCount} line items are incomplete and will be dropped.`}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-expense">{error}</p>}

        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-5 mt-5 flex items-center justify-end gap-3 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur md:static md:bottom-auto md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <Button variant="ghost" onClick={() => void save(true)} disabled={saving}>
            Save & add another
          </Button>
          <Button onClick={() => void save(false)} disabled={saving} className="flex-1 md:flex-none">
            {saving ? 'Saving…' : 'Save transaction'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
