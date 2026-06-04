import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { Screen, Text, Input, Button, Chip } from '@/src/components/ui';
import { spacing, useColors } from '@/src/theme';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function EditTransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, updateTransaction, categories, loadCategories } = useStore();
  const c = useColors();

  const tx = transactions.find((t) => t.id === id);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const [amount, setAmount] = useState(() => (tx ? String(tx.amount) : ''));
  const [description, setDescription] = useState(() => tx?.description ?? '');
  const [category, setCategory] = useState(() => tx?.category ?? 'Other');
  const [direction, setDirection] = useState<'out' | 'in'>(() => tx?.direction ?? 'out');
  const [date, setDate] = useState(() =>
    tx ? tx.transactionDate.slice(0, 10) : new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(() => tx?.notes ?? '');
  const [saving, setSaving] = useState(false);

  // Keep the selected category valid if its category was deleted/renamed.
  useEffect(() => {
    if (categories.length > 0 && !categories.some((cat) => cat.name === category)) {
      setCategory(categories[0].name);
    }
  }, [categories, category]);

  if (!tx) {
    return (
      <Screen padded>
        <Text variant="title" style={styles.title}>
          Transaction not found
        </Text>
        <Button title="Back" onPress={() => router.back()} fullWidth />
      </Screen>
    );
  }

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      notify('Error', 'Please enter a valid amount.');
      return;
    }
    if (!description.trim()) {
      notify('Error', 'Please enter a description.');
      return;
    }

    setSaving(true);
    try {
      const result = await updateTransaction(tx.id, {
        amount: parsedAmount,
        direction,
        description: description.trim(),
        category,
        transactionDate: new Date(date).toISOString(),
        notes: notes.trim(),
      });

      if (result) {
        router.back();
      } else {
        notify('Error', 'Failed to update transaction.');
      }
    } catch (error) {
      notify('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll padded>
      <Text variant="title" style={styles.title}>
        Edit Transaction
      </Text>

      {/* Direction toggle */}
      <View style={styles.directionRow}>
        <Chip
          label="Expense"
          selected={direction === 'out'}
          selectedColor={c.expense}
          onPress={() => setDirection('out')}
          style={styles.directionChip}
        />
        <Chip
          label="Income"
          selected={direction === 'in'}
          selectedColor={c.income}
          onPress={() => setDirection('in')}
          style={styles.directionChip}
        />
      </View>

      {/* Amount */}
      <Input
        label="Amount (SGD)"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        containerStyle={styles.field}
      />

      {/* Description */}
      <Input
        label="Description"
        placeholder="What was this for?"
        value={description}
        onChangeText={setDescription}
        containerStyle={styles.field}
      />

      {/* Date */}
      <Input
        label="Date"
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
        containerStyle={styles.field}
      />

      {/* Notes */}
      <Input
        label="Notes"
        placeholder="Add details…"
        value={notes}
        onChangeText={setNotes}
        multiline
        containerStyle={styles.field}
      />

      {/* Category */}
      <Text variant="label" color="muted" style={styles.label}>
        Category
      </Text>
      <View style={styles.categoryGrid}>
        {categories.map((cat) => (
          <Chip
            key={cat.id}
            label={cat.name}
            selected={category === cat.name}
            selectedColor={cat.color ?? undefined}
            onPress={() => setCategory(cat.name)}
          />
        ))}
      </View>

      {/* Save */}
      <Button
        title={saving ? 'Saving...' : 'Save Changes'}
        onPress={handleSave}
        disabled={saving}
        fullWidth
        style={styles.saveButton}
      />

      <Button
        title="Cancel"
        variant="ghost"
        onPress={() => router.back()}
        fullWidth
        style={styles.cancelButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xl,
  },
  label: {
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  field: {
    marginTop: spacing.lg,
  },
  directionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  directionChip: {
    flex: 1,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.xxl,
  },
  cancelButton: {
    marginTop: spacing.sm,
  },
});
