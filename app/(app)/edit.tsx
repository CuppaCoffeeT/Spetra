import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { Screen, Text, Input, Button, Chip } from '@/src/components/ui';
import { spacing, useColors } from '@/src/theme';
import { scanReceipt } from '@/src/lib/scanReceipt';
import { uploadReceiptImage, saveReceiptToSupabase } from '@/src/lib/receipts';

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
  const userId = useStore((s) => s.session?.user?.id);
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
  const [scanning, setScanning] = useState(false);

  // Pending receipt captured via scan; uploaded after a successful save.
  const [pendingReceipt, setPendingReceipt] = useState<{
    imageUri: string;
    text: string;
    merchant: string | null;
    amount: number | null;
    receiptDate: string | null;
  } | null>(null);

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

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanReceipt('library');
      if (!result) return;

      const { imageUri, text, ocrAvailable, fields } = result;

      // Build a short summary to drop into the Notes field.
      const snippet = text.trim().replace(/\s+/g, ' ').slice(0, 120);
      const summaryParts = [
        fields.merchant?.trim() || null,
        snippet || null,
      ].filter((p): p is string => Boolean(p));
      const summary = summaryParts.join(' — ');

      if (summary) {
        setNotes((prev) =>
          prev.trim() ? `${prev.trim()}\n${summary}` : summary
        );
      }

      setPendingReceipt({
        imageUri,
        text,
        merchant: fields.merchant,
        amount: fields.amount,
        receiptDate: fields.transactionDate,
      });

      if (!ocrAvailable) {
        notify(
          'Receipt attached',
          'Auto-extract needs the web app or a dev build. The image will be attached on save — fill in any details manually.'
        );
      }
    } catch (error) {
      notify('Error', (error as Error).message);
    } finally {
      setScanning(false);
    }
  };

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
        // Attach the scanned receipt (best-effort; never block the save).
        if (pendingReceipt && userId) {
          try {
            const storagePath = await uploadReceiptImage(
              userId,
              pendingReceipt.imageUri
            );
            if (storagePath) {
              await saveReceiptToSupabase(userId, {
                transactionId: tx.id,
                storagePath,
                merchant: pendingReceipt.merchant,
                total: pendingReceipt.amount,
                currency: 'SGD',
                receiptDate:
                  pendingReceipt.receiptDate ?? new Date(date).toISOString(),
                rawText: pendingReceipt.text,
              });
            }
          } catch (receiptError) {
            console.error('Attach receipt failed:', receiptError);
          }
        }
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

      {/* Receipt scan / attach */}
      <Button
        title={scanning ? 'Scanning…' : 'Scan / Attach Receipt'}
        variant="secondary"
        onPress={handleScan}
        disabled={scanning || saving}
        fullWidth
        style={styles.scanButton}
      />
      {pendingReceipt && (
        <Text variant="caption" color="muted" style={styles.receiptNote}>
          Receipt attached — saved with this transaction.
        </Text>
      )}

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
  scanButton: {
    marginTop: spacing.lg,
  },
  receiptNote: {
    marginTop: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.xxl,
  },
  cancelButton: {
    marginTop: spacing.sm,
  },
});
