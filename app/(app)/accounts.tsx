import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { useStore } from '../../src/store/useStore';
import type { BankAccount } from '../../src/types';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function AccountsScreen() {
  const {
    bankAccounts,
    bankAccountsLoading,
    loadBankAccounts,
    detectBankAccounts,
    updateBankAccountLabel,
    session,
  } = useStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  useEffect(() => {
    if (session) {
      loadBankAccounts();
    }
  }, [session, loadBankAccounts]);

  const handleDetect = async () => {
    try {
      const count = await detectBankAccounts();
      notify('Detection Complete', `Found ${count} account(s).`);
    } catch (error) {
      notify('Error', (error as Error).message);
    }
  };

  const handleSaveLabel = async (id: string) => {
    await updateBankAccountLabel(id, editLabel);
    setEditingId(null);
  };

  // Group accounts by bank
  const grouped = bankAccounts.reduce(
    (acc, acct) => {
      if (!acc[acct.bankName]) acc[acct.bankName] = [];
      acc[acct.bankName].push(acct);
      return acc;
    },
    {} as Record<string, BankAccount[]>
  );

  const renderAccount = (account: BankAccount) => {
    const isEditing = editingId === account.id;
    const icon = account.accountType === 'card' ? 'Card' : 'A/C';

    return (
      <View key={account.id} style={styles.accountCard}>
        <View style={styles.accountHeader}>
          <View style={styles.accountTypeContainer}>
            <Text style={styles.accountTypeIcon}>{icon}</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountDigits}>
              {account.accountType === 'card' ? 'Card' : 'Account'} ending{' '}
              {account.lastFourDigits}
            </Text>
            {isEditing ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={editLabel}
                  onChangeText={setEditLabel}
                  placeholder="Add a label..."
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.editSaveBtn}
                  onPress={() => handleSaveLabel(account.id)}
                >
                  <Text style={styles.editSaveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setEditingId(account.id);
                  setEditLabel(account.label || '');
                }}
              >
                <Text style={styles.accountLabel}>
                  {account.label || 'Tap to add label'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const bankNames = Object.keys(grouped).sort();

  return (
    <View style={styles.container}>
      <FlatList
        data={bankNames}
        keyExtractor={(item) => item}
        refreshControl={
          <RefreshControl refreshing={bankAccountsLoading} onRefresh={loadBankAccounts} />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.detectButton}
            onPress={handleDetect}
            disabled={bankAccountsLoading}
          >
            {bankAccountsLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.detectButtonText}>Detect Accounts from Emails</Text>
            )}
          </TouchableOpacity>
        }
        renderItem={({ item: bankName }) => (
          <View style={styles.bankSection}>
            <Text style={styles.bankName}>{bankName}</Text>
            {grouped[bankName].map(renderAccount)}
          </View>
        )}
        ListEmptyComponent={
          !bankAccountsLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No Accounts Detected</Text>
              <Text style={styles.emptyText}>
                Sync your emails first, then tap "Detect Accounts" to find bank accounts and cards
                from your transaction emails.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  list: {
    padding: 16,
  },
  detectButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  detectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bankSection: {
    marginBottom: 24,
  },
  bankName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountTypeContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  accountTypeIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
  },
  accountInfo: {
    flex: 1,
  },
  accountDigits: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  accountLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  editInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  editSaveBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editSaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
});
