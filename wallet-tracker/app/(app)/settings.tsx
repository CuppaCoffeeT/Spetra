import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { gmailService } from '@/src/services/gmail';
import { useAppStore } from '@/src/store/useStore';
import { Account } from '@/src/types';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '@/src/store/auth';

const accountTypes: Account['type'][] = ['bank', 'wallet', 'cash', 'card', 'other'];

export default function SettingsScreen() {
  const { accounts, addAccount } = useAppStore(
    useShallow((state) => ({
      accounts: state.accounts,
      addAccount: state.addAccount,
    }))
  );
  const { session, signOut, loading: authLoading } = useAuth();

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<Account['type']>('bank');
  const [newAccountCurrency, setNewAccountCurrency] = useState('SGD');
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [gmailState, setGmailState] = useState(gmailService.getState());
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) {
      Alert.alert('Missing name', 'Provide a name for the account.');
      return;
    }

    setIsSavingAccount(true);
    try {
      await addAccount({
        name: newAccountName.trim(),
        type: newAccountType,
        currency: newAccountCurrency.trim() || 'SGD',
      });
      setNewAccountName('');
      Alert.alert('Account added', 'The account is now available for use.');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Unable to save the account.');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleGmailConnect = async () => {
    setIsSyncingGmail(true);
    try {
      const state = await gmailService.connect();
      setGmailState(state);
    } catch (error) {
      console.error(error);
      Alert.alert('Gmail connection failed', 'Try again with a valid OAuth setup.');
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleGmailDisconnect = async () => {
    const state = await gmailService.disconnect();
    setGmailState(state);
  };

  const handleGmailSync = async () => {
    if (!gmailState.isConnected) {
      Alert.alert('Not connected', 'Connect Gmail first.');
      return;
    }

    setIsSyncingGmail(true);
    try {
      const messages = await gmailService.fetchRecentMessages();
      const transactions = await gmailService.transformToTransactions(messages);
      // In a real implementation we would persist the parsed transactions.
      Alert.alert(
        'Mock sync complete',
        `Parsed ${transactions.length} transaction(s) from Gmail.`
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Sync failed', 'Check logs for additional details.');
    } finally {
      setIsSyncingGmail(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.bodyText}>Signed in as</Text>
        <Text style={styles.accountName}>{session?.user?.email ?? 'Unknown user'}</Text>
        <Pressable
          style={[styles.secondaryButton, authLoading && styles.primaryButtonDisabled]}
          onPress={() => void signOut()}
          disabled={authLoading}
        >
          <Text style={styles.secondaryButtonText}>{authLoading ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Accounts</Text>
      <View style={styles.card}>
        {accounts.map((account) => (
          <View key={account.id} style={styles.accountRow}>
            <View>
              <Text style={styles.accountName}>{account.name}</Text>
              <Text style={styles.accountMeta}>
                {account.type.toUpperCase()} · {account.currencyDefault}
              </Text>
            </View>
          </View>
        ))}
        <View style={styles.divider} />
        <Text style={styles.subheading}>Add new account</Text>
        <TextInput
          placeholder="Account name"
          value={newAccountName}
          onChangeText={setNewAccountName}
          style={styles.input}
        />
        <View style={styles.toggleRow}>
          {accountTypes.map((type) => (
            <Pressable
              key={type}
              style={[
                styles.toggle,
                newAccountType === type && styles.toggleActive,
              ]}
              onPress={() => setNewAccountType(type)}
            >
              <Text
                style={[
                  styles.toggleText,
                  newAccountType === type && styles.toggleTextActive,
                ]}
              >
                {type}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          placeholder="Currency (e.g. SGD)"
          value={newAccountCurrency}
          onChangeText={setNewAccountCurrency}
          style={styles.input}
        />
        <Pressable
          style={[styles.primaryButton, isSavingAccount && styles.primaryButtonDisabled]}
          disabled={isSavingAccount}
          onPress={handleAddAccount}
        >
          <Text style={styles.primaryButtonText}>
            {isSavingAccount ? 'Saving...' : 'Add Account'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Gmail ingestion</Text>
      <View style={styles.card}>
        <Text style={styles.bodyText}>
          Connect a Gmail label that forwards transaction alerts. This demo keeps the
          connection in-memory for now; swap in real OAuth + Pub/Sub when ready.
        </Text>
        <Text style={styles.status}>
          Status: {gmailState.isConnected ? 'Connected' : 'Disconnected'}
        </Text>
        {gmailState.lastSync && <Text style={styles.status}>Last sync: {gmailState.lastSync}</Text>}
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.primaryButton, isSyncingGmail && styles.primaryButtonDisabled]}
            onPress={handleGmailConnect}
            disabled={isSyncingGmail}
          >
            <Text style={styles.primaryButtonText}>Connect Gmail</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleGmailDisconnect}>
            <Text style={styles.secondaryButtonText}>Disconnect</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.primaryButton, isSyncingGmail && styles.primaryButtonDisabled]}
          onPress={handleGmailSync}
          disabled={isSyncingGmail}
        >
          <Text style={styles.primaryButtonText}>
            {isSyncingGmail ? 'Syncing...' : 'Run mock sync'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Data management</Text>
      <View style={styles.card}>
        <Text style={styles.bodyText}>
          Exports and local encryption are not wired up yet. Use this space later for CSV
          export, local-only mode, and scheduled backups.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F8FAFC',
    gap: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  accountMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggle: {
    paddingVertical: 8,
    paddingHorizontal: 14,
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
    fontSize: 13,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  bodyText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  status: {
    fontSize: 13,
    color: '#0F172A',
  },
});
