import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { useStore } from '../../src/store/useStore';
import type { BankAccount } from '../../src/types';
import { Screen, Text, Card, Button, Input } from '@/src/components/ui';
import { radii, spacing, useColors } from '@/src/theme';

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

  const c = useColors();

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
      <Card key={account.id} style={styles.accountCard}>
        <View style={styles.accountHeader}>
          <View style={[styles.accountTypeContainer, { backgroundColor: c.surfaceAlt }]}>
            <Text variant="label" color="accent">
              {icon}
            </Text>
          </View>
          <View style={styles.accountInfo}>
            <Text variant="heading" style={styles.accountDigits}>
              {account.accountType === 'card' ? 'Card' : 'Account'} ending{' '}
              {account.lastFourDigits}
            </Text>
            {isEditing ? (
              <View style={styles.editRow}>
                <Input
                  containerStyle={styles.editInput}
                  value={editLabel}
                  onChangeText={setEditLabel}
                  placeholder="Add a label..."
                  autoFocus
                />
                <Button title="Save" onPress={() => handleSaveLabel(account.id)} />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setEditingId(account.id);
                  setEditLabel(account.label || '');
                }}
              >
                <Text variant="body" color="muted">
                  {account.label || 'Tap to add label'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    );
  };

  const bankNames = Object.keys(grouped).sort();

  return (
    <Screen padded={false}>
      <FlatList
        data={bankNames}
        keyExtractor={(item) => item}
        refreshControl={
          <RefreshControl refreshing={bankAccountsLoading} onRefresh={loadBankAccounts} />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Button
            title="Detect Accounts from Emails"
            onPress={handleDetect}
            disabled={bankAccountsLoading}
            loading={bankAccountsLoading}
            fullWidth
            style={styles.detectButton}
          />
        }
        renderItem={({ item: bankName }) => (
          <View style={styles.bankSection}>
            <Text variant="title" style={styles.bankName}>
              {bankName}
            </Text>
            {grouped[bankName].map(renderAccount)}
          </View>
        )}
        ListEmptyComponent={
          !bankAccountsLoading ? (
            <View style={styles.empty}>
              <Text variant="heading" style={styles.emptyTitle}>
                No Accounts Detected
              </Text>
              <Text variant="body" color="secondary" style={styles.emptyText}>
                Sync your emails first, then tap "Detect Accounts" to find bank accounts and cards
                from your transaction emails.
              </Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
  },
  detectButton: {
    marginBottom: spacing.xl,
  },
  bankSection: {
    marginBottom: spacing.xl,
  },
  bankName: {
    marginBottom: spacing.md,
  },
  accountCard: {
    marginBottom: spacing.sm,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountTypeContainer: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  accountInfo: {
    flex: 1,
  },
  accountDigits: {
    marginBottom: spacing.xs,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  editInput: {
    flex: 1,
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
});
