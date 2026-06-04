import { View, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import type { GmailAccount } from '../../src/types';
import { Screen, Card, SectionHeader, ListRow, Button, Text } from '@/src/components/ui';
import { spacing, radii, useColors } from '@/src/theme';

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

  const c = useColors();
  const router = useRouter();

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
    <Screen scroll>
      <View style={styles.section}>
        <SectionHeader title="Account" />
        <Card>
          <Text variant="label" color="secondary">Email</Text>
          <Text variant="body" style={styles.value}>{session?.user?.email || 'Not signed in'}</Text>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Gmail Accounts" />
        <Card>
          {hasAccounts ? (
            <>
              {gmailState.accounts.map((account) => (
                <ListRow
                  key={account.email}
                  title={account.email}
                  right={
                    <View style={styles.accountRight}>
                      <Text variant="label" color="income">Connected</Text>
                      <TouchableOpacity
                        style={[styles.removeButton, { borderColor: c.expense }]}
                        onPress={() => handleDisconnectGmail(account)}
                        disabled={gmailLoading}
                      >
                        <Text variant="label" color="expense">Remove</Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              ))}

              <View style={styles.buttonGroup}>
                <Button
                  title="Sync All Emails"
                  onPress={handleSyncEmails}
                  disabled={gmailLoading}
                  loading={gmailLoading}
                />
                <Button
                  title="Add Gmail Account"
                  variant="ghost"
                  onPress={handleConnectGmail}
                  disabled={gmailLoading}
                  style={[styles.outlineButton, { borderColor: c.accent }]}
                />
              </View>
            </>
          ) : (
            <>
              <Text variant="body" color="expense" style={styles.emptyStatus}>No accounts connected</Text>
              <Button
                title="Connect Gmail"
                onPress={handleConnectGmail}
                disabled={gmailLoading}
                loading={gmailLoading}
              />
            </>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Categories" />
        <Card>
          <Button
            title="Manage Categories"
            variant="secondary"
            onPress={() => router.push('/(app)/categories')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Data" />
        <Card>
          <Button
            title="Sync with Cloud"
            variant="ghost"
            onPress={syncData}
            disabled={syncLoading}
            loading={syncLoading}
            style={[styles.outlineButton, { borderColor: c.accent }]}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          disabled={authLoading}
          loading={authLoading}
          style={{ backgroundColor: c.expense }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: spacing.lg,
  },
  value: {
    marginTop: spacing.xs,
  },
  emptyStatus: {
    marginBottom: spacing.lg,
  },
  outlineButton: {
    borderWidth: 1,
  },
  buttonGroup: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  accountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  removeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
});
