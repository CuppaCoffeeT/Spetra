import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';

export default function HomeScreen() {
  const { transactions, transactionsLoading, loadTransactions, session } = useStore();
  const router = useRouter();

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
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={transactionsLoading} onRefresh={loadTransactions} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello!</Text>
        <Text style={styles.monthLabel}>
          {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Spent</Text>
            <Text style={[styles.summaryValue, styles.spent]}>
              ${totalSpent.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, styles.income]}>
              ${totalIncome.toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={styles.netRow}>
          <Text style={styles.netLabel}>Net</Text>
          <Text
            style={[
              styles.netValue,
              totalIncome - totalSpent >= 0 ? styles.income : styles.spent,
            ]}
          >
            ${(totalIncome - totalSpent).toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Categories</Text>
        {sortedCategories.length === 0 ? (
          <Text style={styles.emptyText}>No transactions this month</Text>
        ) : (
          sortedCategories.map(([category, amount]) => (
            <View key={category} style={styles.categoryRow}>
              <Text style={styles.categoryName}>{category}</Text>
              <Text style={styles.categoryAmount}>${amount.toFixed(2)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.slice(0, 5).map((t) => (
          <View key={t.id} style={styles.transactionRow}>
            <View>
              <Text style={styles.transactionDesc}>{t.description}</Text>
              <Text style={styles.transactionDate}>
                {new Date(t.transactionDate).toLocaleDateString()}
              </Text>
            </View>
            <Text
              style={[
                styles.transactionAmount,
                t.direction === 'out' ? styles.spent : styles.income,
              ]}
            >
              {t.direction === 'out' ? '-' : '+'}${t.amount.toFixed(2)}
            </Text>
          </View>
        ))}
        {transactions.length === 0 && (
          <Text style={styles.emptyText}>No transactions yet. Connect Gmail to sync!</Text>
        )}
      </View>
    </ScrollView>
    <TouchableOpacity
      style={styles.fab}
      onPress={() => router.push('/(app)/add')}
      activeOpacity={0.8}
    >
      <Text style={styles.fabText}>+</Text>
    </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    paddingTop: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  monthLabel: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  spent: {
    color: '#ef4444',
  },
  income: {
    color: '#22c55e',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  netLabel: {
    fontSize: 16,
    color: '#64748b',
  },
  netValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  categoryName: {
    fontSize: 16,
    color: '#1e293b',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  transactionDesc: {
    fontSize: 16,
    color: '#1e293b',
  },
  transactionDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },
});
