import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
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

export default function AddTransactionScreen() {
  const router = useRouter();
  const { addTransaction, categories, loadCategories } = useStore();
  const c = useColors();

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  // Keep the selected category valid if its category was deleted/renamed.
  useEffect(() => {
    if (categories.length > 0 && !categories.some((cat) => cat.name === category)) {
      setCategory(categories[0].name);
    }
  }, [categories, category]);

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
      const result = await addTransaction({
        amount: parsedAmount,
        currency: 'SGD',
        direction,
        description: description.trim(),
        category,
        transactionDate: new Date(date).toISOString(),
        source: 'manual',
      });

      if (result) {
        router.back();
      } else {
        notify('Error', 'Failed to save transaction.');
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
        Add Transaction
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
        title={saving ? 'Saving...' : 'Save Transaction'}
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
