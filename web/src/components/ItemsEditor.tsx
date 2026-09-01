import { formatMoney } from '../lib/api';
import type { Category, ItemDraft } from '../lib/types';
import { Button, Select, TextInput, inputCls } from './ui';

// Editable list of line items (e.g. burger, fries, drink on one receipt).
// Controlled: parent owns the drafts array. amount = line total.
export default function ItemsEditor({
  items,
  onChange,
  categories,
  transactionTotal,
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  categories: Category[];
  transactionTotal: number | null;
}) {
  const update = (i: number, patch: Partial<ItemDraft>) => {
    const next = items.slice();
    next[i] = { ...next[i], ...patch };
    // Keep amount in sync when qty/unitPrice are both present.
    if ((patch.qty !== undefined || patch.unitPrice !== undefined) && next[i].unitPrice != null) {
      next[i].amount = Math.round(next[i].qty * next[i].unitPrice! * 100) / 100;
    }
    onChange(next);
  };

  const itemsSum = Math.round(items.reduce((s, it) => s + (it.amount || 0), 0) * 100) / 100;
  const mismatch =
    transactionTotal != null && items.length > 0 && Math.abs(itemsSum - transactionTotal) > 0.005;

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div className="grid grid-cols-[1fr_3.5rem_4.5rem_5rem_minmax(6rem,8rem)_2rem] items-center gap-2 text-[11px] uppercase tracking-wide text-textMuted">
          <span>Item</span>
          <span>Qty</span>
          <span>Unit</span>
          <span>Amount</span>
          <span>Category</span>
          <span />
        </div>
      )}
      {items.map((it, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_3.5rem_4.5rem_5rem_minmax(6rem,8rem)_2rem] items-center gap-2"
        >
          <TextInput
            value={it.name}
            placeholder="e.g. Double cheeseburger"
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <input
            type="number"
            min="0"
            step="any"
            value={it.qty}
            onChange={(e) => update(i, { qty: parseFloat(e.target.value) || 1 })}
            className={inputCls}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={it.unitPrice ?? ''}
            placeholder="—"
            onChange={(e) =>
              update(i, { unitPrice: e.target.value === '' ? null : parseFloat(e.target.value) })
            }
            className={inputCls}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={it.amount || ''}
            onChange={(e) => update(i, { amount: parseFloat(e.target.value) || 0 })}
            className={inputCls}
          />
          <Select
            value={it.category ?? ''}
            onChange={(e) => update(i, { category: e.target.value || null })}
          >
            <option value="">(txn's)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="rounded-lg py-1 text-textMuted hover:bg-surfaceAlt hover:text-expense"
            title="Remove item"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() =>
            onChange([...items, { name: '', qty: 1, unitPrice: null, amount: 0, category: null }])
          }
        >
          + Add line item
        </Button>
        {items.length > 0 && (
          <span className={`text-xs ${mismatch ? 'text-warning' : 'text-textMuted'}`}>
            Items total {formatMoney(itemsSum)}
            {mismatch && transactionTotal != null && ` ≠ transaction ${formatMoney(transactionTotal)}`}
          </span>
        )}
      </div>
    </div>
  );
}
