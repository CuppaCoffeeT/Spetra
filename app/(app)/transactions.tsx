import { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { Screen, Text, Card, ListRow, Chip, AmountText } from '@/src/components/ui';
import { spacing, radii, useColors } from '@/src/theme';

export default function TransactionsScreen() {
  const {
    transactions,
    transactionsLoading,
    loadTransactions,
    updateTransaction,
    session,
    categories,
    loadCategories,
  } = useStore();

  const c = useColors();
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [categoryModalTxId, setCategoryModalTxId] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      loadTransactions();
      loadCategories();
    }
  }, [session, loadTransactions, loadCategories]);

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
    <Card style={styles.transactionCard}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/(app)/edit', params: { id: item.id } })}
      >
        <View style={styles.transactionHeader}>
          <Text variant="heading" numberOfLines={1} style={styles.transactionDesc}>
            {item.description}
          </Text>
          <AmountText
            amount={item.amount}
            direction={item.direction === 'out' ? 'out' : 'in'}
            variant="heading"
          />
        </View>
      </TouchableOpacity>
      <View style={styles.transactionMeta}>
        <TouchableOpacity onPress={() => setCategoryModalTxId(item.id)}>
          <View style={[styles.category, { backgroundColor: c.surfaceAlt }]}>
            <Text variant="label" color="accent">
              {item.category || 'Uncategorized'}
            </Text>
          </View>
        </TouchableOpacity>
        <Text variant="label" color="secondary">
          {new Date(item.transactionDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>
      {item.source === 'manual' && (
        <Text variant="caption" color="muted" style={styles.source}>
          Manual entry
        </Text>
      )}
    </Card>
  );

  return (
    <Screen>
      {/* Month selector */}
      <View style={[styles.monthBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthBarContent}
        >
          <Chip
            label="All"
            selected={!selectedMonth}
            onPress={() => setSelectedMonth(null)}
          />
          {months.map((m) => {
            const isActive =
              selectedMonth &&
              m.getMonth() === selectedMonth.getMonth() &&
              m.getFullYear() === selectedMonth.getFullYear();
            return (
              <Chip
                key={m.toISOString()}
                label={formatMonth(m)}
                selected={!!isActive}
                onPress={() => setSelectedMonth(m)}
              />
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
            <Text variant="title" style={styles.emptyTitle}>
              No Transactions
            </Text>
            <Text variant="body" color="secondary" style={styles.emptyText}>
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
          style={[styles.modalOverlay, { backgroundColor: c.overlay }]}
          activeOpacity={1}
          onPress={() => setCategoryModalTxId(null)}
        >
          <View style={[styles.modalContent, { backgroundColor: c.surface }]}>
            <Text variant="heading" style={styles.modalTitle}>
              Select Category
            </Text>
            {categories.map((cat) => (
              <ListRow
                key={cat.id}
                title={cat.name}
                left={
                  <View
                    style={[styles.colorDot, { backgroundColor: cat.color ?? c.border }]}
                  />
                }
                onPress={() =>
                  categoryModalTxId && handleCategoryChange(categoryModalTxId, cat.name)
                }
              />
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    borderBottomWidth: 1,
  },
  monthBarContent: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  list: {
    padding: spacing.lg,
  },
  transactionCard: {
    marginBottom: spacing.md,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  transactionDesc: {
    flex: 1,
    marginRight: spacing.md,
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.sm,
  },
  source: {
    marginTop: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    width: 280,
    maxHeight: '70%',
  },
  modalTitle: {
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
