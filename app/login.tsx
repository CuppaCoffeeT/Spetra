import { useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
} from 'react-native';
import { useStore } from '../src/store/useStore';
import { Text, Input, Button } from '@/src/components/ui';
import { spacing, useColors } from '@/src/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { signIn, signUp, authLoading } = useStore();
  const c = useColors();

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const emailValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);

  const requirements = useMemo(
    () => [
      { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
      {
        id: 'alphanumeric',
        label: 'Letters and numbers',
        met: /[A-Za-z]/.test(password) && /[0-9]/.test(password),
      },
      { id: 'uppercase', label: 'An uppercase letter', met: /[A-Z]/.test(password) },
    ],
    [password]
  );
  const passwordValid = requirements.every((r) => r.met);
  const confirmValid = password.length > 0 && password === confirm;

  const switchMode = () => {
    setIsSignUp((v) => !v);
    setError(null);
    setSuccess(null);
    setEmailTouched(false);
    setPasswordTouched(false);
    setConfirmTouched(false);
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!emailValid) {
      setEmailTouched(true);
      setError('Please enter a valid email address.');
      return;
    }
    if (isSignUp && !passwordValid) {
      setPasswordTouched(true);
      setError('Please satisfy all password requirements.');
      return;
    }
    if (isSignUp && !confirmValid) {
      setConfirmTouched(true);
      setError('Passwords do not match.');
      return;
    }
    if (!isSignUp && !password) {
      setError('Please enter your password.');
      return;
    }

    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
        setSuccess(`We sent a confirmation link to ${email.trim()}. Check your inbox, then sign in.`);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: c.bg }]}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="display" style={styles.title}>
          Spend Tracker
        </Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          {isSignUp ? 'Create your account' : 'Track your expenses from email'}
        </Text>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            onBlur={() => setEmailTouched(true)}
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
            returnKeyType="next"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={!authLoading}
            error={emailTouched && !emailValid ? 'Enter a valid email address' : undefined}
          />
          <Input
            ref={passwordRef}
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            onBlur={() => setPasswordTouched(true)}
            onSubmitEditing={() => (isSignUp ? confirmRef.current?.focus() : handleSubmit())}
            blurOnSubmit={!isSignUp}
            returnKeyType={isSignUp ? 'next' : 'go'}
            secureTextEntry
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            editable={!authLoading}
            error={
              isSignUp && passwordTouched && !passwordValid
                ? 'Password does not meet the requirements'
                : undefined
            }
          />

          {isSignUp && (
            <>
              <Input
                ref={confirmRef}
                label="Confirm password"
                placeholder="••••••••"
                value={confirm}
                onChangeText={setConfirm}
                onBlur={() => setConfirmTouched(true)}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
                secureTextEntry
                autoComplete="new-password"
                editable={!authLoading}
                error={confirmTouched && !confirmValid ? 'Passwords do not match' : undefined}
              />
              <View style={styles.requirements}>
                {requirements.map((r) => (
                  <Text
                    key={r.id}
                    variant="caption"
                    style={{ color: r.met ? c.income : c.textMuted }}
                  >
                    {r.met ? '✓' : '○'} {r.label}
                  </Text>
                ))}
              </View>
            </>
          )}

          <Button
            title={isSignUp ? 'Create account' : 'Sign In'}
            onPress={handleSubmit}
            loading={authLoading}
            disabled={authLoading}
            fullWidth
            style={styles.button}
          />

          {error && (
            <Text variant="caption" style={[styles.feedback, { color: c.expense }]}>
              {error}
            </Text>
          )}
          {success && (
            <Text variant="caption" style={[styles.feedback, { color: c.income }]}>
              {success}
            </Text>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={switchMode}
            disabled={authLoading}
            accessibilityRole="button"
          >
            <Text variant="caption" color="accent">
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },
  form: {
    gap: spacing.lg,
  },
  requirements: {
    gap: spacing.xs,
    marginTop: -spacing.sm,
  },
  button: {
    marginTop: spacing.sm,
  },
  feedback: {
    textAlign: 'center',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});
