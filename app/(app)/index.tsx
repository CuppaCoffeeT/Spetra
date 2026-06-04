import { useEffect } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import {
  Screen,
  Card,
  SectionHeader,
  ListRow,
  AmountText,
  ProgressBar,
  FAB,
  Text,
} from '@/src/components/ui';
import { spacing, useColors } from '@/src/theme';
import { currentMonth as getCurrentMonth, spentByCategory } from '@/src/lib/budgets';

export default function HomeScreen() {
  const {
    transactions,
    transactionsLoading,
    loadTransactions,
    session,
    categories,
    loadCategories,
    budgets,
    loadBudgets,
  } = useStore();
  const router = useRouter();
  const c = useColors();

  useEffect(() => {
    if (session) {
      loadTransactions();
      loadCategories();
      loadBudgets();
    }
  }, [session, loadTransactions, loadCategories, loadBudgets]);

  // Map category name -> color for the colour dots in Top Categories.
  const categoryColors = categories.reduce((acc, cat) => {
    if (cat.color) acc[cat.name] = cat.color;
    return acc;
  }, {} as Record<string, string>);

  // Calculate monthly summary
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyTransactions = transactions.filter((t) => {
    const date = new Date(t.transactionDate);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const totalSpent = monthlyTransactions
    .filter((t) => t.direction === 'out')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = monthlyTransactions
    .filter((t) => t.direction === 'in')
    .reduce((sum, t) => sum + t.amount, 0);

  const categoryTotals = monthlyTransactions
    .filter((t) => t.direction === 'out')
    .reduce((acc, t) => {
      const cat = t.category || 'Other';
      acc[cat] = (acc[cat] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Budget summary for the current month: pair each budget that belongs to this
  // month with its category (to resolve the denormalized category NAME used by
  // transactions), then compute spend BY CATEGORY NAME.
  const month = getCurrentMonth();
  const spentThisMonth = spentByCategory(transactions, month);
  const monthBudgets = budgets
    .filter((b) => b.month === month)
    .map((b) => {
      const category = b.categoryId
        ? categories.find((cat) => cat.id === b.categoryId)
        : undefined;
      const name = category?.name ?? 'Uncategorized';
      const spent = spentThisMonth[name] ?? 0;
      const limit = b.limitAmount;
      const pct = limit > 0 ? spent / limit : 0;
      const over = limit > 0 && spent > limit;
      const near = limit > 0 && pct >= 0.8 && !over;
      return { id: b.id, name, color: category?.color ?? null, spent, limit, pct, over, near };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <View style={styles.wrapper}>
      <Screen
        scroll
        refreshControl={
          <RefreshControl refreshing={transactionsLoading} onRefresh={loadTransactions} />
        }
      >
        <View style={styles.header}>
          <Text variant="display">Hello!</Text>
          <Text variant="body" color="secondary" style={styles.monthLabel}>
            {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        </View>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text variant="label" color="secondary" style={styles.summaryLabel}>
                Spent
              </Text>
              <AmountText amount={totalSpent} direction="out" showSign={false} variant="title" />
            </View>
            <View style={styles.summaryItem}>
              <Text variant="label" color="secondary" style={styles.summaryLabel}>
                Income
              </Text>
              <AmountText amount={totalIncome} direction="in" showSign={false} variant="title" />
            </View>
          </View>
          <View style={[styles.netRow, { borderTopColor: c.border }]}>
            <Text variant="body" color="secondary">
              Net
            </Text>
            <AmountText
              amount={totalIncome - totalSpent}
              direction={totalIncome - totalSpent >= 0 ? 'in' : 'out'}
              showSign={false}
              variant="heading"
            />
          </View>
        </Card>

        <View style={styles.section}>
          <SectionHeader
            title="This Month's Budgets"
            action={{ label: 'See all', onPress: () => router.push('/(app)/budgets') }}
          />
          {monthBudgets.length === 0 ? (
            <Text variant="body" color="muted" style={styles.emptyText}>
              No budgets yet — set one in the Budgets tab
            </Text>
          ) : (
            monthBudgets.map((b) => (
              <View key={b.id} style={styles.budgetRow}>
                <View style={styles.budgetTop}>
                  <View style={styles.budgetName}>
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: b.color ?? c.textMuted },
                      ]}
                    />
                    <Text variant="body" numberOfLines={1}>
                      {b.name}
                    </Text>
                  </View>
                  <View style={styles.budgetAmounts}>
                    <AmountText
                      amount={b.spent}
                      showSign={false}
                      style={{ color: b.over ? c.expense : c.textPrimary }}
                    />
                    <Text variant="body" color="muted">
                      {' / '}
                    </Text>
                    <AmountText amount={b.limit} showSign={false} style={{ color: c.textSecondary }} />
                  </View>
                </View>
                <ProgressBar
                  value={Math.min(b.pct, 1)}
                  color={b.over ? c.expense : b.near ? c.warning : c.accent}
                  style={styles.budgetBar}
                />
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Top Categories" />
          {sortedCategories.length === 0 ? (
            <Text variant="body" color="muted" style={styles.emptyText}>
              No transactions this month
            </Text>
          ) : (
            sortedCategories.map(([category, amount]) => (
              <ListRow
                key={category}
                title={category}
                left={
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: categoryColors[category] ?? c.textMuted },
                    ]}
                  />
                }
                right={<AmountText amount={amount} showSign={false} style={{ color: c.textSecondary }} />}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Recent Transactions" />
          {transactions.slice(0, 5).map((t) => (
            <ListRow
              key={t.id}
              title={t.description}
              subtitle={new Date(t.transactionDate).toLocaleDateString()}
              right={<AmountText amount={t.amount} direction={t.direction} />}
              onPress={() => router.push({ pathname: '/(app)/edit', params: { id: t.id } })}
            />
          ))}
          {transactions.length === 0 && (
            <Text variant="body" color="muted" style={styles.emptyText}>
              No transactions yet. Connect Gmail to sync!
            </Text>
          )}
        </View>
      </Screen>
      <FAB onPress={() => router.push('/(app)/add')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  monthLabel: {
    marginTop: spacing.xs,
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    marginBottom: spacing.xs,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  section: {
    padding: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  budgetRow: {
    paddingVertical: spacing.sm,
  },
  budgetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  budgetName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  budgetAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  budgetBar: {
    height: 6,
  },
});
