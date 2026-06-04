import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useStore } from '../src/store/useStore';
import { useColors } from '@/src/theme';

// Check synchronously on module load if we're returning from OAuth
const hasOAuthHash =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location.hash.includes('access_token');

// Module-level flags survive React strict mode remounts
let initialized = false;
let autoSynced = false;

export default function RootLayout() {
  const { session, authLoading, initAuth, initGmail, gmailState, syncEmails } = useStore();
  const router = useRouter();
  const segments = useSegments();
  const c = useColors();
  const [oauthPending, setOauthPending] = useState(hasOAuthHash);

  useEffect(() => {
    if (!initialized) {
      initialized = true;
      initAuth();
      initGmail();
    }
  }, [initAuth, initGmail]);

  // When initGmail finishes processing the OAuth callback, it updates gmailState.
  // Detect that and navigate to settings.
  useEffect(() => {
    if (!oauthPending || authLoading) return;

    if (gmailState.accounts.length > 0) {
      setOauthPending(false);
      if (session) {
        router.replace('/(app)/settings');
      }
    } else if (!session || !authLoading) {
      // Auth settled with no session, or initGmail finished without finding accounts
      // Gmail tokens are already saved, they'll be picked up after login
      setOauthPending(false);
    }
  }, [oauthPending, gmailState, authLoading, session, router]);

  // Auto-sync emails on app load when logged in with Gmail accounts
  useEffect(() => {
    if (autoSynced || authLoading || oauthPending) return;
    if (session && gmailState.accounts.length > 0) {
      autoSynced = true;
      syncEmails().catch(() => {});
    }
  }, [session, gmailState, authLoading, oauthPending, syncEmails]);

  // Periodic auto-sync every 5 minutes while the app is open
  useEffect(() => {
    if (!session || gmailState.accounts.length === 0) return;

    const interval = setInterval(() => {
      syncEmails().catch(() => {});
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [session, gmailState.accounts.length, syncEmails]);

  useEffect(() => {
    // Don't do auth routing while OAuth callback is being processed
    if (authLoading || oauthPending) return;

    const inAppGroup = segments[0] === '(app)';

    if (!session && inAppGroup) {
      router.replace('/login');
    } else if (session && !inAppGroup && segments[0] !== undefined) {
      router.replace('/(app)');
    }
  }, [session, authLoading, segments, router, oauthPending]);

  if (authLoading || oauthPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}
