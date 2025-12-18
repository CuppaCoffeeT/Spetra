import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';

import { useAuth } from '@/src/store/auth';

export default function SignupScreen() {
  const { session, loading, init, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const emailValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);

  const requirements = useMemo(
    () => [
      {
        id: 'length',
        label: 'At least 8 characters',
        satisfied: password.length >= 8,
      },
      {
        id: 'alphanumeric',
        label: 'Contains letters and numbers',
        satisfied: /[A-Za-z]/.test(password) && /[0-9]/.test(password),
      },
      {
        id: 'uppercase',
        label: 'Contains an uppercase letter',
        satisfied: /[A-Z]/.test(password),
      },
      {
        id: 'match',
        label: 'Passwords match',
        satisfied: password.length > 0 && password === confirm,
      },
    ],
    [password, confirm]
  );

  const passwordValid = requirements
    .filter((item) => item.id !== 'match')
    .every((item) => item.satisfied);

  const confirmValid = requirements.find((item) => item.id === 'match')?.satisfied ?? false;

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (session) {
      router.replace('/home');
    }
  }, [session]);

  const doSignUp = async () => {
    if (!emailValid) {
      setEmailTouched(true);
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (!passwordValid) {
      setPasswordTouched(true);
      Alert.alert('Weak password', 'Please satisfy all password requirements.');
      return;
    }
    if (!confirmValid) {
      setConfirmTouched(true);
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    try {
      const trimmed = email.trim();
      await signUp(trimmed, password);
      Alert.alert(
        'Confirm your email',
        `We sent a confirmation link to ${trimmed}. Once you verify, you can sign in.`
      );
      router.replace('/login');
    } catch (e: any) {
      Alert.alert('Sign up failed', e.message ?? 'Unknown error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your Wallet Tracker account</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onBlur={() => setEmailTouched(true)}
          style={[styles.input, emailTouched && !emailValid && styles.inputError]}
          placeholder="you@example.com"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onBlur={() => setPasswordTouched(true)}
          style={[styles.input, passwordTouched && !passwordValid && styles.inputError]}
          placeholder="••••••••"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Confirm password</Text>
        <TextInput
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          onBlur={() => setConfirmTouched(true)}
          style={[styles.input, confirmTouched && !confirmValid && styles.inputError]}
          placeholder="••••••••"
        />
        <View style={styles.requirements}>
          {requirements.map((item) => (
            <Text
              key={item.id}
              style={[
                styles.requirementText,
                item.satisfied ? styles.requirementMet : styles.requirementPending,
              ]}
            >
              • {item.label}
            </Text>
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        disabled={loading}
        onPress={doSignUp}
      >
        <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Create account'}</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Link href="/login" style={styles.link}>
          Back to sign in
        </Link>
      </View>
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
  inputError: {
    borderColor: '#DC2626',
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    color: '#475569',
  },
  link: {
    color: '#2563EB',
    fontWeight: '600',
  },
  requirements: {
    marginTop: 4,
    gap: 4,
  },
  requirementText: {
    fontSize: 12,
  },
  requirementPending: {
    color: '#DC2626',
  },
  requirementMet: {
    color: '#0F172A',
  },
});
