import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useStore } from '../../src/store/useStore';

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

  const handleConnectGmail = async () => {
    try {
      await connectGmail();
      Alert.alert('Success', 'Gmail connected successfully!');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleDisconnectGmail = async () => {
    Alert.alert('Disconnect Gmail', 'Are you sure you want to disconnect Gmail?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await disconnectGmail();
        },
      },
    ]);
  };

  const handleSyncEmails = async () => {
    try {
      const count = await syncEmails();
      Alert.alert('Sync Complete', `Added ${count} new transactions`);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
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
        <Text style={styles.sectionTitle}>Gmail Integration</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View>
              <Text style={styles.label}>Status</Text>
              <Text style={[styles.status, gmailState.isConnected && styles.connected]}>
                {gmailState.isConnected ? 'Connected' : 'Not connected'}
              </Text>
              {gmailState.email && (
                <Text style={styles.gmailEmail}>{gmailState.email}</Text>
              )}
            </View>
          </View>

          {gmailState.isConnected ? (
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleSyncEmails}
                disabled={gmailLoading}
              >
                {gmailLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Sync Emails</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.outlineButton]}
                onPress={handleDisconnectGmail}
                disabled={gmailLoading}
              >
                <Text style={styles.outlineButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
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
          )}

          {gmailState.lastSync && (
            <Text style={styles.lastSync}>
              Last synced: {new Date(gmailState.lastSync).toLocaleString()}
            </Text>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
  connected: {
    color: '#22c55e',
  },
  gmailEmail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  buttonGroup: {
    gap: 12,
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
  lastSync: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 12,
    textAlign: 'center',
  },
});
