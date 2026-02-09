import { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useStore } from '../../src/store/useStore';

export default function TransactionsScreen() {
  const { transactions, transactionsLoading, loadTransactions, session } = useStore();

  useEffect(() => {
    if (session) {
      loadTransactions();
    }
  }, [session, loadTransactions]);

  const renderTransaction = ({ item }: { item: typeof transactions[0] }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <Text style={styles.transactionDesc} numberOfLines={1}>
          {item.description}
        </Text>
        <Text
          style={[
            styles.transactionAmount,
            item.direction === 'out' ? styles.spent : styles.income,
          ]}
        >
          {item.direction === 'out' ? '-' : '+'}${item.amount.toFixed(2)}
        </Text>
      </View>
      <View style={styles.transactionMeta}>
        <Text style={styles.category}>{item.category || 'Uncategorized'}</Text>
        <Text style={styles.date}>
          {new Date(item.transactionDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>
      {item.sourceEmail && (
        <Text style={styles.source} numberOfLines={1}>
          From: {item.sourceEmail}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={transactionsLoading} onRefresh={loadTransactions} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No Transactions</Text>
            <Text style={styles.emptyText}>
              Connect your Gmail in Settings to sync transactions from UOB and Revolut emails.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  list: {
    padding: 16,
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionDesc: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
    flex: 1,
    marginRight: 12,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  spent: {
    color: '#ef4444',
  },
  income: {
    color: '#22c55e',
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: {
    fontSize: 14,
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  date: {
    fontSize: 14,
    color: '#64748b',
  },
  source: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});
