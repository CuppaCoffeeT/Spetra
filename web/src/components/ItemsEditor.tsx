import { useState } from 'react';
import { formatMoney } from '../lib/api';
import type { Category, ItemDraft } from '../lib/types';
import { X } from './Icons';
import { Button, Select, TextInput, inputCls } from './ui';

// A row is "incomplete" when it half-exists: a name without a positive amount,
// or an amount without a name. Fully-empty rows stay silently droppable.
function isIncomplete(it: ItemDraft): boolean {
  const hasName = it.name.trim().length > 0;
  const hasAmount = it.amount > 0;
  return (hasName && !hasAmount) || (!hasName && hasAmount);
}

// Parents use this to drive the two-step "will be dropped" warning.
export function countIncomplete(items: ItemDraft[]): number {
  return items.reduce((n, it) => n + (isIncomplete(it) ? 1 : 0), 0);
}

// 40% warning tint for half-filled rows; browsers without color-mix ignore the
// inline declaration and fall back to the plain border-warning class.
const warnBorderStyle = {
  borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)',
} as const;

const miniLabelCls =
  'text-[10px] font-medium uppercase tracking-[0.08em] text-textSecondary md:hidden';

const removeBtnCls =
  '-m-2 h-11 w-11 shrink-0 place-items-center rounded-lg text-textMuted transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt hover:text-expense focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent';

// Editable list of line items (e.g. burger, fries, drink on one receipt).
// Controlled: parent owns the drafts array. amount = line total.
// md+: one 6-col ledger grid per row. Below md: each item is a card.
// DOM order of inputs stays name -> qty -> unitPrice -> amount -> category
// (e2e: last input[step="0.01"] must be the item amount).
export default function ItemsEditor({
  items,
  onChange,
  categories,
  transactionTotal,
  onUseTotal,
  flagIncomplete = false,
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  categories: Category[];
  transactionTotal: number | null;
  onUseTotal?: (sum: number) => void;
  flagIncomplete?: boolean;
}) {
  // Live draft string for the number field being typed in, so the controlled
  // inputs never rewrite keystrokes mid-edit (a cleared qty snapping back to 1,
  // a leading '0' vanishing). Parsed live for totals; normalized on blur.
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(null);

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
        <div className="hidden grid-cols-[1fr_3.5rem_4.5rem_5rem_minmax(6rem,8rem)_2rem] items-center gap-2 border-b border-border pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-textSecondary md:grid">
          <span>Item</span>
          <span>Qty</span>
          <span>Unit</span>
          <span className="text-right">Amount</span>
          <span>Category</span>
          <span />
        </div>
      )}
      {items.map((it, i) => {
        const warn = flagIncomplete && isIncomplete(it);
        return (
          <div
            key={i}
            style={warn ? warnBorderStyle : undefined}
            className={`flex grid-cols-[1fr_3.5rem_4.5rem_5rem_minmax(6rem,8rem)_2rem] flex-col gap-2 rounded-lg border ${
              warn ? 'border-warning' : 'border-border'
            } bg-surfaceAlt p-3 md:grid md:items-center md:rounded-none md:border-0 md:bg-transparent md:p-0`}
          >
            <div className="flex items-center gap-2 md:contents">
              <TextInput
                value={it.name}
                placeholder="e.g. Double cheeseburger"
                onChange={(e) => update(i, { name: e.target.value })}
                className="min-w-0 flex-1"
                style={warn ? warnBorderStyle : undefined}
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label="Remove item"
                title="Remove item"
                className={`grid md:hidden ${removeBtnCls}`}
              >
                <X />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-1 md:contents">
              <span className={miniLabelCls}>Qty</span>
              <span className={miniLabelCls}>Unit</span>
              <span className={`${miniLabelCls} text-right`}>Amount</span>
              <input
                type="number"
                min="0"
                step="any"
                value={draft?.key === `${i}:qty` ? draft.value : it.qty === 0 ? '' : it.qty}
                onChange={(e) => {
                  setDraft({ key: `${i}:qty`, value: e.target.value });
                  update(i, { qty: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 });
                }}
                onBlur={() => {
                  setDraft(null);
                  if (!(it.qty > 0)) update(i, { qty: 1 });
                }}
                className={`${inputCls} w-full min-w-0`}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={it.unitPrice ?? ''}
                placeholder="—"
                onChange={(e) =>
                  update(i, { unitPrice: e.target.value === '' ? null : parseFloat(e.target.value) })
                }
                className={`${inputCls} w-full min-w-0`}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft?.key === `${i}:amount` ? draft.value : it.amount === 0 ? '' : it.amount}
                onChange={(e) => {
                  setDraft({ key: `${i}:amount`, value: e.target.value });
                  update(i, { amount: parseFloat(e.target.value) || 0 });
                }}
                onBlur={() => setDraft(null)}
                className={`${inputCls} w-full min-w-0 text-right [font-variant-numeric:tabular-nums]`}
                style={warn ? warnBorderStyle : undefined}
              />
            </div>
            <Select
              value={it.category ?? ''}
              onChange={(e) => update(i, { category: e.target.value || null })}
              className="w-full min-w-0"
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
              aria-label="Remove item"
              title="Remove item"
              className={`hidden md:grid ${removeBtnCls}`}
            >
              <X />
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() =>
            onChange([...items, { name: '', qty: 1, unitPrice: null, amount: 0, category: null }])
          }
        >
          + Add line item
        </Button>
        {items.length > 0 && (
          <span className={`text-xs ${mismatch ? 'text-warning' : 'text-textSecondary'}`}>
            Items total {formatMoney(itemsSum)}
            {mismatch && transactionTotal != null && ` ≠ transaction ${formatMoney(transactionTotal)}`}
            {mismatch && onUseTotal && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => onUseTotal(itemsSum)}
                  className="-my-3 py-3 text-accent underline decoration-border underline-offset-2 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
                >
                  Use items total
                </button>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
