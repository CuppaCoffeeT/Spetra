import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useStore } from '../src/store/useStore';

// Check synchronously on module load if we're returning from OAuth
const hasOAuthHash =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location.hash.includes('access_token');

export default function RootLayout() {
  const { session, authLoading, initAuth, initGmail, gmailState } = useStore();
  const initialized = useRef(false);
  const router = useRouter();
  const segments = useSegments();
  const [oauthPending, setOauthPending] = useState(hasOAuthHash);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initAuth();
      initGmail();
    }
  }, [initAuth, initGmail]);

  // When initGmail finishes processing the OAuth callback, it updates gmailState.
  // Detect that and navigate to settings.
  useEffect(() => {
    if (!oauthPending || authLoading) return;

    if (gmailState.isConnected) {
      setOauthPending(false);
      if (session) {
        router.replace('/(app)/settings');
      }
    } else if (!session) {
      // Auth settled with no session - can't stay pending, let user log in
      // Gmail tokens are already saved, they'll be picked up after login
      setOauthPending(false);
    }
  }, [oauthPending, gmailState, authLoading, session, router]);

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
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
