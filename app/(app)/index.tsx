import { useEffect } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { Screen, Card, SectionHeader, ListRow, AmountText, FAB, Text } from '@/src/components/ui';
import { spacing, useColors } from '@/src/theme';

export default function HomeScreen() {
  const { transactions, transactionsLoading, loadTransactions, session } = useStore();
  const router = useRouter();
  const c = useColors();

  useEffect(() => {
    if (session) {
      loadTransactions();
    }
  }, [session, loadTransactions]);

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
});
