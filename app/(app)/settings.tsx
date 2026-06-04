import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useStore } from '../../src/store/useStore';
import type { GmailAccount } from '../../src/types';

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function SettingsScreen() {
  const {
    session,
    signOut,
    authLoading,
    gmailState,
    gmailLoading,
    connectGmail,
    disconnectGmail,
    syncEmails,
    syncData,
    syncLoading,
  } = useStore();

  const hasAccounts = gmailState.accounts.length > 0;

  const handleConnectGmail = async () => {
    try {
      await connectGmail();
    } catch (error) {
      notify('Error', (error as Error).message);
    }
  };

  const handleDisconnectGmail = (account: GmailAccount) => {
    confirm('Remove Account', `Disconnect ${account.email}?`, async () => {
      await disconnectGmail(account.email);
    });
  };

  const handleSyncEmails = async () => {
    try {
      const count = await syncEmails();
      notify('Sync Complete', `Added ${count} new transactions`);
    } catch (error) {
      notify('Error', (error as Error).message);
    }
  };

  const handleSignOut = () => {
    confirm('Sign Out', 'Are you sure you want to sign out?', () => {
      signOut();
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{session?.user?.email || 'Not signed in'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gmail Accounts</Text>
        <View style={styles.card}>
          {hasAccounts ? (
            <>
              {gmailState.accounts.map((account) => (
                <View key={account.email} style={styles.accountRow}>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountEmail}>{account.email}</Text>
                    <Text style={[styles.status, styles.connected]}>Connected</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleDisconnectGmail(account)}
                    disabled={gmailLoading}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleSyncEmails}
                  disabled={gmailLoading}
                >
                  {gmailLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Sync All Emails</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.outlineButton]}
                  onPress={handleConnectGmail}
                  disabled={gmailLoading}
                >
                  <Text style={styles.outlineButtonText}>Add Gmail Account</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.status, { marginBottom: 16 }]}>No accounts connected</Text>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleConnectGmail}
                disabled={gmailLoading}
              >
                {gmailLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Connect Gmail</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.button, styles.outlineButton]}
            onPress={syncData}
            disabled={syncLoading}
          >
            {syncLoading ? (
              <ActivityIndicator color="#3b82f6" size="small" />
            ) : (
              <Text style={styles.outlineButtonText}>Sync with Cloud</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={handleSignOut}
          disabled={authLoading}
        >
          {authLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Sign Out</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  label: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#1e293b',
  },
  status: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  connected: {
    color: '#22c55e',
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonGroup: {
    gap: 12,
    marginTop: 16,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
});
