import { useMemo } from 'react';
import { format, parse } from 'date-fns';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryPill } from '@/src/components/CategoryPill';
import { StatCard } from '@/src/components/StatCard';
import { TransactionItem } from '@/src/components/TransactionItem';
import { useAppStore } from '@/src/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Transaction } from '@/src/types';

const formatCurrency = (amount: number) => `SGD ${amount.toFixed(2)}`;

const computeMonthlySummary = (transactions: Transaction[], monthKey: string) => {
  return transactions.reduce(
    (acc, txn) => {
      if (!txn.txnDatetime.startsWith(monthKey)) {
        return acc;
      }
      if (txn.direction === 'in') {
        acc.totalIn += txn.amountNative;
      } else {
        acc.totalOut += txn.amountNative;
      }
      acc.net = acc.totalIn - acc.totalOut;
      return acc;
    },
    { monthKey, totalIn: 0, totalOut: 0, net: 0 }
  );
};

const computeTopCategories = (transactions: Transaction[], monthKey: string, limit = 5) => {
  const totals = new Map<string, number>();
  transactions.forEach((txn) => {
    if (!txn.txnDatetime.startsWith(monthKey)) return;
    if (!txn.category) return;
    const amount = txn.amountNative * (txn.direction === 'out' ? 1 : -1);
    totals.set(txn.category, (totals.get(txn.category) ?? 0) + amount);
  });
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, total]) => ({ category, total }));
};

export default function HomeScreen() {
  const { transactions, monthKey } = useAppStore(
    useShallow((state) => ({
      transactions: state.transactions,
      monthKey: state.selectedMonth,
    }))
  );

  const summary = useMemo(
    () => computeMonthlySummary(transactions, monthKey),
    [transactions, monthKey]
  );
  const topCategories = useMemo(
    () => computeTopCategories(transactions, monthKey),
    [transactions, monthKey]
  );
  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  const monthLabel = (() => {
    try {
      const parsed = parse(`${monthKey}-01`, 'yyyy-MM-dd', new Date());
      return format(parsed, 'LLLL yyyy');
    } catch (error) {
      return monthKey;
    }
  })();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{monthLabel}</Text>
      <View style={styles.cardsRow}>
        <StatCard label="Spent" value={formatCurrency(summary.totalOut)} accent="danger" />
        <StatCard label="Received" value={formatCurrency(summary.totalIn)} accent="success" />
      </View>
      <View style={styles.cardsRow}>
        <StatCard label="Net" value={formatCurrency(summary.net)} footer={<Text style={styles.footerNote}>Income - Spending</Text>} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Categories</Text>
        {topCategories.length === 0 && <Text style={styles.empty}>No categorized spend yet.</Text>}
        {topCategories.map((item) => (
          <View key={item.category} style={styles.categoryRow}>
            <CategoryPill label={item.category} value={`SGD ${item.total.toFixed(2)}`} />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {recentTransactions.length === 0 && <Text style={styles.empty}>No transactions recorded.</Text>}
        {recentTransactions.map((txn) => (
          <TransactionItem key={txn.id} transaction={txn} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 24,
    backgroundColor: '#F8FAFC',
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  footerNote: {
    marginTop: 12,
    fontSize: 12,
    color: '#94A3B8',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  categoryRow: {
    marginBottom: 10,
  },
  empty: {
    fontSize: 14,
    color: '#64748B',
  },
});
