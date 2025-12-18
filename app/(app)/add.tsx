import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Platform } from 'react-native';

import { useAppStore } from '@/src/store/useStore';
import { TransactionDirection } from '@/src/types';
import { useShallow } from 'zustand/react/shallow';
import { Picker } from '@react-native-picker/picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
// Only render DateTimePicker on native platforms
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatDateLocal = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export default function AddTransactionScreen() {
  const { addTransaction, accounts, categories, addCategory } = useAppStore(
    useShallow((state) => ({
      addTransaction: state.addTransaction,
      accounts: state.accounts,
      categories: state.categories,
      addCategory: state.addCategory,
    }))
  );

  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<TransactionDirection>('out');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [categoryMode, setCategoryMode] = useState<'pick' | 'other'>('pick');
  const now = new Date();
  const [dateOnly, setDateOnly] = useState(formatDateLocal(now));
  const [hour, setHour] = useState(pad2(now.getHours()));
  const [minute, setMinute] = useState(pad2(now.getMinutes()));
  const [selectedAccount, setSelectedAccount] = useState<number | undefined>(
    accounts[0]?.id
  );
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setAmount('');
    setDirection('out');
    setDescription('');
    setCategory('');
    setCategoryMode('pick');
    const d = new Date();
    setDateOnly(formatDateLocal(d));
    setHour(pad2(d.getHours()));
    setMinute(pad2(d.getMinutes()));
    setSelectedAccount(accounts[0]?.id);
    setNotes('');
  };

  const handleSubmit = async () => {
    const amountValue = Number(amount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Invalid amount', 'Enter a number greater than zero.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Missing description', 'Add at least a short description.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalCategory = category.trim() || undefined;
      if (categoryMode === 'other') {
        if (!finalCategory) {
          Alert.alert('Missing category', 'Please enter a category name.');
          setIsSubmitting(false);
          return;
        }
        await addCategory(finalCategory);
      }
      // Compose ISO datetime from dateOnly + hour + minute (local timezone)
      const [y, m, d] = dateOnly.split('-').map((v) => Number(v));
      const hh = Number(hour);
      const mm = Number(minute);
      if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        Alert.alert('Invalid date/time', 'Please enter a valid date, hour (00-23), and minute (00-59).');
        setIsSubmitting(false);
        return;
      }
      const composed = new Date(y, m - 1, d, hh, mm).toISOString();

      await addTransaction({
        amountNative: amountValue,
        currencyNative: 'SGD',
        direction,
        description: description.trim(),
        category: finalCategory,
        txnDatetime: composed,
        accountId: selectedAccount,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Saved', 'Transaction added successfully.');
      resetForm();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Unable to save the transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onChangeDate = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (!selected) return;
    setDateOnly(formatDateLocal(selected));
  };

  const onChangeTime = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    const d = selected ?? new Date();
    setHour(pad2(d.getHours()));
    setMinute(pad2(d.getMinutes()));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Add Transaction</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Amount (SGD)</Text>
        <TextInput
          keyboardType="decimal-pad"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.toggleRow}>
          {(['out', 'in'] as TransactionDirection[]).map((value) => (
            <Pressable
              key={value}
              style={[styles.toggle, direction === value && styles.toggleActive]}
              onPress={() => setDirection(value)}
            >
              <Text
                style={[
                  styles.toggleText,
                  direction === value && styles.toggleTextActive,
                ]}
              >
                {value === 'out' ? 'Expense' : 'Income'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          placeholder="What was this for?"
          value={description}
          onChangeText={setDescription}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        {categoryMode === 'pick' ? (
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={category || '__none__'}
              onValueChange={(val) => {
                if (val === '__others__') {
                  setCategoryMode('other');
                  setCategory('');
                } else if (val === '__none__') {
                  setCategory('');
                } else {
                  setCategory(String(val));
                }
              }}
            >
              <Picker.Item label="Select category" value="__none__" />
              {categories.map((c) => (
                <Picker.Item key={c.id} label={c.name} value={c.name} />
              ))}
              <Picker.Item label="Others…" value="__others__" />
            </Picker>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <TextInput
              placeholder="Enter new category"
              value={category}
              onChangeText={setCategory}
              style={styles.input}
            />
            <View style={styles.inlineRow}>
              <Pressable style={styles.secondaryButton} onPress={() => setCategoryMode('pick')}>
                <Text style={styles.secondaryButtonText}>Back to list</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Date & Time</Text>
        {Platform.OS === 'web' ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={dateOnly}
              onChangeText={setDateOnly}
              style={styles.input}
              placeholder="YYYY-MM-DD"
            />
            <View style={styles.timeRow}>
              <TextInput
                value={hour}
                onChangeText={(t) => setHour(t.replace(/[^0-9]/g, '').slice(0, 2))}
                placeholder="HH"
                keyboardType="number-pad"
                style={[styles.input, styles.timeInput]}
                maxLength={2}
              />
              <Text style={styles.timeSeparator}>:</Text>
              <TextInput
                value={minute}
                onChangeText={(t) => setMinute(t.replace(/[^0-9]/g, '').slice(0, 2))}
                placeholder="MM"
                keyboardType="number-pad"
                style={[styles.input, styles.timeInput]}
                maxLength={2}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Pressable style={styles.inputButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.inputButtonText}>{dateOnly || 'Select date'}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={new Date()}
                mode="date"
                onChange={onChangeDate}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              />
            )}
            <View style={styles.timeRow}>
              <Pressable style={[styles.input, styles.timeInput, styles.inputButton]} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.inputButtonText}>{hour || 'HH'}</Text>
              </Pressable>
              <Text style={styles.timeSeparator}>:</Text>
              <Pressable style={[styles.input, styles.timeInput, styles.inputButton]} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.inputButtonText}>{minute || 'MM'}</Text>
              </Pressable>
            </View>
            {showTimePicker && (
              <DateTimePicker
                value={new Date()}
                mode="time"
                onChange={onChangeTime}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                is24Hour
              />
            )}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <View style={styles.inlineRow}>
          <Text style={[styles.label, { flex: 1 }]}>Account</Text>
          <Pressable style={styles.iconButton} onPress={() => router.push('/settings')} accessibilityLabel="Add account">
            <FontAwesome name="plus" size={14} color="#2563EB" />
          </Pressable>
        </View>
        <View style={styles.toggleRow}>
          {accounts.map((account) => (
            <Pressable
              key={account.id}
              style={[
                styles.toggle,
                selectedAccount === account.id && styles.toggleActive,
              ]}
              onPress={() =>
                setSelectedAccount((prev) =>
                  prev === account.id ? undefined : account.id
                )
              }
            >
              <Text
                style={[
                  styles.toggleText,
                  selectedAccount === account.id && styles.toggleTextActive,
                ]}
              >
                {account.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          placeholder="Any extra context"
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, styles.notes]}
          multiline
        />
      </View>

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.submitText}>{isSubmitting ? 'Saving...' : 'Save Transaction'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    backgroundColor: '#F8FAFC',
    paddingBottom: 60,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#475569',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  picker: {
    height: 44,
  },
  notes: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    flex: 0,
    width: 80,
    textAlign: 'center',
  },
  timeSeparator: {
    paddingHorizontal: 4,
    color: '#334155',
    fontWeight: '600',
  },
  inputButton: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  inputButtonText: {
    fontSize: 16,
    color: '#0F172A',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toggle: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#FFFFFF',
  },
  toggleActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  toggleText: {
    color: '#2563EB',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
