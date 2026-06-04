import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { CATEGORIES } from '../../src/services/categorizer';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function AddTransactionScreen() {
  const router = useRouter();
  const { addTransaction } = useStore();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Transaction</Text>

      {/* Direction toggle */}
      <View style={styles.directionRow}>
        <TouchableOpacity
          style={[styles.directionBtn, direction === 'out' && styles.directionBtnActiveOut]}
          onPress={() => setDirection('out')}
        >
          <Text
            style={[
              styles.directionBtnText,
              direction === 'out' && styles.directionBtnTextActive,
            ]}
          >
            Expense
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.directionBtn, direction === 'in' && styles.directionBtnActiveIn]}
          onPress={() => setDirection('in')}
        >
          <Text
            style={[
              styles.directionBtnText,
              direction === 'in' && styles.directionBtnTextActive,
            ]}
          >
            Income
          </Text>
        </TouchableOpacity>
      </View>

      {/* Amount */}
      <Text style={styles.label}>Amount (SGD)</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      {/* Description */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="What was this for?"
        value={description}
        onChangeText={setDescription}
      />

      {/* Date */}
      <Text style={styles.label}>Date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
      />

      {/* Category */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text
              style={[
                styles.categoryChipText,
                category === cat && styles.categoryChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Transaction'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  directionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  directionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  directionBtnActiveOut: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  directionBtnActiveIn: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
  },
  directionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  directionBtnTextActive: {
    color: '#1e293b',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  categoryChipActive: {
    backgroundColor: '#3b82f6',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
  },
});
