import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useStore } from '../../src/store/useStore';
import { CATEGORIES } from '../../src/services/categorizer';

export default function TransactionsScreen() {
  const { transactions, transactionsLoading, loadTransactions, updateTransaction, session } =
    useStore();

  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [categoryModalTxId, setCategoryModalTxId] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      loadTransactions();
    }
  }, [session, loadTransactions]);

  // Generate month options from transactions
  const months = useMemo(() => {
    const monthSet = new Map<string, Date>();
    for (const t of transactions) {
      const d = new Date(t.transactionDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthSet.has(key)) {
        monthSet.set(key, new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
    return Array.from(monthSet.values()).sort((a, b) => b.getTime() - a.getTime());
  }, [transactions]);

  const filtered = useMemo(() => {
    if (!selectedMonth) return transactions;
    const m = selectedMonth.getMonth();
    const y = selectedMonth.getFullYear();
    return transactions.filter((t) => {
      const d = new Date(t.transactionDate);
      return d.getMonth() === m && d.getFullYear() === y;
    });
  }, [transactions, selectedMonth]);

  const handleCategoryChange = async (txId: string, category: string) => {
    setCategoryModalTxId(null);
    await updateTransaction(txId, { category });
  };

  const formatMonth = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const renderTransaction = ({ item }: { item: (typeof transactions)[0] }) => (
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
        <TouchableOpacity onPress={() => setCategoryModalTxId(item.id)}>
          <Text style={styles.category}>{item.category || 'Uncategorized'}</Text>
        </TouchableOpacity>
        <Text style={styles.date}>
          {new Date(item.transactionDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>
      {item.source === 'manual' && (
        <Text style={styles.source}>Manual entry</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Month selector */}
      <View style={styles.monthBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthBarContent}
        >
          <TouchableOpacity
            style={[styles.monthPill, !selectedMonth && styles.monthPillActive]}
            onPress={() => setSelectedMonth(null)}
          >
            <Text style={[styles.monthPillText, !selectedMonth && styles.monthPillTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {months.map((m) => {
            const isActive =
              selectedMonth &&
              m.getMonth() === selectedMonth.getMonth() &&
              m.getFullYear() === selectedMonth.getFullYear();
            return (
              <TouchableOpacity
                key={m.toISOString()}
                style={[styles.monthPill, isActive && styles.monthPillActive]}
                onPress={() => setSelectedMonth(m)}
              >
                <Text style={[styles.monthPillText, isActive && styles.monthPillTextActive]}>
                  {formatMonth(m)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
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
              {selectedMonth
                ? `No transactions for ${formatMonth(selectedMonth)}.`
                : 'Connect your Gmail in Settings to sync transactions from UOB and Revolut emails.'}
            </Text>
          </View>
        }
      />

      {/* Category picker modal */}
      <Modal
        visible={categoryModalTxId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryModalTxId(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCategoryModalTxId(null)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Category</Text>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.categoryOption}
                onPress={() => categoryModalTxId && handleCategoryChange(categoryModalTxId, cat)}
              >
                <Text style={styles.categoryOptionText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  monthBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  monthBarContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  monthPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  monthPillActive: {
    backgroundColor: '#3b82f6',
  },
  monthPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  monthPillTextActive: {
    color: '#fff',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: 280,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#1e293b',
  },
});
