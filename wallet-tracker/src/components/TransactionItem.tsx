import { format } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { Transaction } from '@/src/types';

interface Props {
  transaction: Transaction;
}

const formatAmount = (value: number, direction: Transaction['direction']) => {
  const formatted = value.toFixed(2);
  return direction === 'out' ? `- $${formatted}` : `+ $${formatted}`;
};

const formatDate = (iso: string) => {
  try {
    return format(new Date(iso), 'd MMM yyyy, h:mm a');
  } catch (error) {
    return iso;
  }
};

export const TransactionItem = ({ transaction }: Props) => {
  const amountColor = transaction.direction === 'out' ? '#DC2626' : '#059669';

  return (
    <View style={styles.container}>
      <View style={styles.meta}>
        <Text style={styles.description}>{transaction.descriptionClean ?? transaction.descriptionRaw ?? 'Unknown transaction'}</Text>
        <Text style={styles.category}>{transaction.category ?? 'Uncategorized'}</Text>
        <Text style={styles.date}>{formatDate(transaction.txnDatetime)}</Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>{formatAmount(transaction.amountNative, transaction.direction)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  meta: {
    flex: 1,
    marginRight: 16,
  },
  description: {
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 2,
  },
  category: {
    fontSize: 13,
    color: '#64748B',
  },
  date: {
    marginTop: 4,
    fontSize: 12,
    color: '#94A3B8',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
  },
});
