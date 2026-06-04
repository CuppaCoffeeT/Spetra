import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useStore } from '../../src/store/useStore';
import { currentMonth, spentByCategory } from '../../src/lib/budgets';
import type { Budget, Category } from '../../src/types';
import {
  Screen,
  Text,
  Card,
  Button,
  Input,
  ProgressBar,
  AmountText,
} from '@/src/components/ui';
import { spacing, radii, useColors } from '@/src/theme';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 'YYYY-MM' -> 'June 2026'. */
function formatMonthLabel(month: string): string {
  const [year, mm] = month.split('-');
  const idx = Number(mm) - 1;
  const name = MONTH_NAMES[idx] ?? mm;
  return `${name} ${year}`;
}

/** Shift a 'YYYY-MM' string by +/- whole months. */
function shiftMonth(month: string, delta: number): string {
  const [year, mm] = month.split('-').map(Number);
  // Day 1 avoids end-of-month rollover; Date math handles year wrap.
  const d = new Date(year, mm - 1 + delta, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function BudgetsScreen() {
  const { categories, loadCategories, transactions, loadTransactions, budgets, loadBudgets, setBudget, clearBudget } =
    useStore();
  const c = useColors();

  const [month, setMonth] = useState<string>(currentMonth());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
    loadTransactions();
    loadBudgets();
  }, []);

  // category name -> total 'out' spend for this month.
  const spendByName = useMemo(
    () => spentByCategory(transactions, month),
    [transactions, month]
  );

  // category id -> budget row for this month.
  const budgetByCategory = useMemo(() => {
    const map: Record<string, Budget> = {};
    for (const b of budgets) {
      if (b.month === month && b.categoryId) {
        map[b.categoryId] = b;
      }
    }
    return map;
  }, [budgets, month]);

  // Summary totals: budgeted limits + spend across budgeted categories.
  const { totalBudgeted, totalSpent } = useMemo(() => {
    let budgeted = 0;
    let spent = 0;
    for (const cat of categories) {
      const budget = budgetByCategory[cat.id];
      if (!budget) continue;
      budgeted += budget.limitAmount;
      spent += spendByName[cat.name] ?? 0;
    }
    return { totalBudgeted: budgeted, totalSpent: spent };
  }, [categories, budgetByCategory, spendByName]);

  const overallPct = totalBudgeted > 0 ? totalSpent / totalBudgeted : 0;
  const overallOver = totalBudgeted > 0 && totalSpent > totalBudgeted;
  const remaining = totalBudgeted - totalSpent;

  const startEditing = (cat: Category) => {
    setEditingId(cat.id);
    const existing = budgetByCategory[cat.id];
    setDraftAmount(existing ? String(existing.limitAmount) : '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftAmount('');
  };

  const goPrevMonth = () => {
    cancelEditing();
    setMonth((m) => shiftMonth(m, -1));
  };

  const goNextMonth = () => {
    cancelEditing();
    setMonth((m) => shiftMonth(m, 1));
  };

  const handleSave = async (cat: Category) => {
    const amount = Number(draftAmount);
    if (!Number.isFinite(amount) || amount < 0) return;

    setSavingId(cat.id);
    try {
      await setBudget(cat.id, month, amount);
      cancelEditing();
    } finally {
      setSavingId(null);
    }
  };

  const handleClear = async (budgetId: string) => {
    setSavingId(budgetId);
    try {
      await clearBudget(budgetId);
      cancelEditing();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Screen scroll padded>
      <Text variant="title" style={styles.title}>
        Budgets
      </Text>

      {/* Month selector */}
      <View style={styles.monthRow}>
        <Button title="‹" variant="secondary" onPress={goPrevMonth} style={styles.monthArrow} />
        <Text variant="heading" style={styles.monthLabel}>
          {formatMonthLabel(month)}
        </Text>
        <Button title="›" variant="secondary" onPress={goNextMonth} style={styles.monthArrow} />
      </View>

      {/* Summary */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text variant="label" color="muted">
            Budgeted
          </Text>
          <AmountText amount={totalBudgeted} variant="label" />
        </View>
        <View style={styles.summaryRow}>
          <Text variant="label" color="muted">
            Spent
          </Text>
          <AmountText amount={totalSpent} variant="label" />
        </View>
        <ProgressBar
          value={Math.min(overallPct, 1)}
          color={overallOver ? c.expense : overallPct >= 0.8 ? c.warning : c.accent}
          height={10}
          style={styles.summaryBar}
        />
        {totalBudgeted > 0 ? (
          <View style={styles.summaryRow}>
            <Text variant="caption" color="muted">
              {overallOver ? 'Over by' : 'Remaining'}
            </Text>
            <AmountText
              amount={Math.abs(remaining)}
              variant="caption"
              style={{ color: overallOver ? c.expense : c.income }}
            />
          </View>
        ) : (
          <Text variant="caption" color="muted">
            No budgets set for this month.
          </Text>
        )}
      </Card>

      {/* Per-category list */}
      <View style={styles.list}>
        {categories.map((cat) => {
          const budget = budgetByCategory[cat.id];
          const limit = budget?.limitAmount ?? 0;
          const spent = spendByName[cat.name] ?? 0;
          const pct = limit > 0 ? spent / limit : 0;
          const over = limit > 0 && spent > limit;
          const near = limit > 0 && pct >= 0.8 && !over;
          const barColor = over ? c.expense : near ? c.warning : c.accent;
          const isEditing = editingId === cat.id;
          const busy = savingId === cat.id || (budget != null && savingId === budget.id);

          return (
            <Card key={cat.id} style={styles.catCard} onPress={isEditing ? undefined : () => startEditing(cat)}>
              <View style={styles.catHeader}>
                <View style={styles.catNameRow}>
                  <View style={[styles.dot, { backgroundColor: cat.color ?? c.accent }]} />
                  <Text variant="label">{cat.name}</Text>
                </View>
                {budget ? (
                  <View style={styles.catAmounts}>
                    <AmountText amount={spent} variant="caption" />
                    <Text variant="caption" color="muted">
                      {' / '}
                    </Text>
                    <AmountText amount={limit} variant="caption" />
                  </View>
                ) : (
                  <Text variant="caption" color="muted">
                    No budget
                  </Text>
                )}
              </View>

              {limit > 0 ? (
                <ProgressBar
                  value={Math.min(pct, 1)}
                  color={barColor}
                  style={styles.catBar}
                />
              ) : null}

              {over ? (
                <View style={styles.overRow}>
                  <Text variant="caption" style={{ color: c.expense }}>
                    Over by{' '}
                  </Text>
                  <AmountText
                    amount={spent - limit}
                    variant="caption"
                    style={{ color: c.expense }}
                  />
                </View>
              ) : null}

              {isEditing ? (
                <View style={styles.editor}>
                  <Input
                    label="Monthly cap"
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={draftAmount}
                    onChangeText={setDraftAmount}
                    containerStyle={styles.editorInput}
                  />
                  <View style={styles.editorButtons}>
                    <Button
                      title="Save"
                      onPress={() => handleSave(cat)}
                      loading={busy}
                      disabled={busy}
                      style={styles.editorButton}
                    />
                    {budget ? (
                      <Button
                        title="Clear"
                        variant="secondary"
                        onPress={() => handleClear(budget.id)}
                        disabled={busy}
                        style={styles.editorButton}
                      />
                    ) : null}
                    <Button
                      title="Cancel"
                      variant="ghost"
                      onPress={cancelEditing}
                      disabled={busy}
                      style={styles.editorButton}
                    />
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })}

        {categories.length === 0 ? (
          <Text variant="body" color="muted">
            No categories yet. Add categories to start budgeting.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.lg,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  monthArrow: {
    minWidth: 48,
    paddingHorizontal: spacing.md,
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
  },
  summaryCard: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryBar: {
    marginVertical: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
  catCard: {
    gap: spacing.sm,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  catAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catBar: {
    marginTop: spacing.xs,
  },
  overRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editor: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  editorInput: {
    marginBottom: 0,
  },
  editorButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editorButton: {
    flex: 1,
  },
});
