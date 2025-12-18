import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { TransactionItem } from '@/src/components/TransactionItem';
import { useAppStore } from '@/src/store/useStore';
import { TransactionDirection } from '@/src/types';
import { useShallow } from 'zustand/react/shallow';

const directionLabels: Record<TransactionDirection | 'all', string> = {
  all: 'All',
  in: 'Income',
  out: 'Expense',
};

export default function TransactionsScreen() {
  const { filters, setFilters, accounts, getVisibleTransactions } = useAppStore(
    useShallow((state) => ({
      filters: state.filters,
      setFilters: state.setFilters,
      accounts: state.accounts,
      getVisibleTransactions: state.getVisibleTransactions,
    }))
  );
  const [categoryFilter, setCategoryFilter] = useState(filters.category ?? '');

  const transactions = useMemo(() => getVisibleTransactions(), [getVisibleTransactions, filters]);

  const handleDirectionChange = (direction: TransactionDirection | 'all') => {
    setFilters({
      ...filters,
      direction: direction === 'all' ? undefined : direction,
    });
  };

  const handleAccountChange = (accountId: number | undefined) => {
    setFilters({
      ...filters,
      accountId,
    });
  };

  const applyCategoryFilter = () => {
    setFilters({
      ...filters,
      category: categoryFilter.length ? categoryFilter : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <Text style={styles.filtersTitle}>Filters</Text>
        <View style={styles.filterRow}>
          {(Object.keys(directionLabels) as Array<TransactionDirection | 'all'>).map((key) => (
            <Pressable
              key={key}
              style={[
                styles.filterChip,
                filters.direction === key || (key === 'all' && !filters.direction)
                  ? styles.filterChipActive
                  : null,
              ]}
              onPress={() => handleDirectionChange(key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filters.direction === key || (key === 'all' && !filters.direction)
                    ? styles.filterChipTextActive
                    : null,
                ]}
              >
                {directionLabels[key]}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.filterRow}>
          {accounts.map((account) => (
            <Pressable
              key={account.id}
              style={[
                styles.filterChip,
                filters.accountId === account.id ? styles.filterChipActive : null,
              ]}
              onPress={() =>
                handleAccountChange(
                  filters.accountId === account.id ? undefined : account.id
                )
              }
            >
              <Text
                style={[
                  styles.filterChipText,
                  filters.accountId === account.id ? styles.filterChipTextActive : null,
                ]}
              >
                {account.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.categoryFilter}>
          <TextInput
            placeholder="Category contains..."
            value={categoryFilter}
            onChangeText={setCategoryFilter}
            onSubmitEditing={applyCategoryFilter}
            style={styles.categoryInput}
          />
          <Pressable style={styles.applyButton} onPress={applyCategoryFilter}>
            <Text style={styles.applyButtonText}>Apply</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <TransactionItem transaction={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No transactions match the filters.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  filters: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterChipText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  categoryFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryInput: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#F1F5F9',
  },
  applyButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
  },
  listContent: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  empty: {
    paddingVertical: 40,
    textAlign: 'center',
    color: '#64748B',
  },
});
