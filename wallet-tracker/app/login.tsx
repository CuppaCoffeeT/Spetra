import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';

import { useAuth } from '@/src/store/auth';

export default function LoginScreen() {
  const { session, loading, init, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (session) {
      router.replace('/home');
    }
  }, [session]);

  const doSignIn = async () => {
    try {
      await signIn(email.trim(), password);
      setError(null);
    } catch (e: any) {
      const message = e?.message ?? 'Incorrect email or password';
      setError(message);
      setPassword('');
      Alert.alert('Sign in failed', message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to Wallet Tracker</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholder="you@example.com"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          placeholder="••••••••"
        />
      </View>
      <Pressable style={[styles.button, loading && styles.buttonDisabled]} disabled={loading} onPress={doSignIn}>
        <Text style={styles.buttonText}>{loading ? 'Loading…' : 'Sign in'}</Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Link href="/signup" style={styles.secondaryLink}>
        Create an account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: '#0F172A',
    marginBottom: 12,
  },
  field: { gap: 8 },
  label: { fontSize: 14, color: '#475569' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  secondaryLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    color: '#2563EB',
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 4,
  },
});
