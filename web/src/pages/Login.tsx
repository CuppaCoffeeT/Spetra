import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; confirm?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const emailValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);
  const requirements = useMemo(
    () => [
      { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
      { id: 'alnum', label: 'Letters and numbers', met: /[A-Za-z]/.test(password) && /[0-9]/.test(password) },
      { id: 'upper', label: 'An uppercase letter', met: /[A-Z]/.test(password) },
    ],
    [password]
  );
  const passwordValid = requirements.every((r) => r.met);
  const confirmValid = password.length > 0 && password === confirm;
  const isSignup = mode === 'signup';

  const inputClass = (invalid: boolean) =>
    `rounded-lg border bg-surface px-3 py-2 text-base text-textPrimary focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent md:text-sm ${
      invalid ? 'border-expense' : 'border-border focus:border-accent'
    }`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!emailValid) {
      setTouched((t) => ({ ...t, email: true }));
      setError('Please enter a valid email address.');
      return;
    }
    if (isSignup && !passwordValid) {
      setTouched((t) => ({ ...t, password: true }));
      setError('Please satisfy all password requirements.');
      return;
    }
    if (isSignup && !confirmValid) {
      setTouched((t) => ({ ...t, confirm: true }));
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    const trimmed = email.trim();
    const { error } = isSignup
      ? await supabase.auth.signUp({ email: trimmed, password })
      : await supabase.auth.signInWithPassword({ email: trimmed, password });
    if (error) setError(error.message);
    else if (isSignup) setSuccess(`We sent a confirmation link to ${trimmed}. Check your inbox, then sign in.`);
    setBusy(false);
  };

  const switchMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setSuccess(null);
    setTouched({});
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 font-display text-[22px] font-medium text-textPrimary">Spend Tracker</h1>
        <p className="mb-6 text-sm text-textMuted">
          {isSignup ? 'Create your account' : 'Sign in to view your wallet'}
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-textSecondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              aria-invalid={touched.email && !emailValid}
              className={inputClass(!!touched.email && !emailValid)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm text-textSecondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              aria-invalid={isSignup && touched.password && !passwordValid}
              className={inputClass(isSignup && !!touched.password && !passwordValid)}
            />
          </div>

          {isSignup && (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="confirm" className="text-sm text-textSecondary">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                  aria-invalid={touched.confirm && !confirmValid}
                  className={inputClass(!!touched.confirm && !confirmValid)}
                />
              </div>
              <ul className="flex flex-col gap-1 text-xs">
                {requirements.map((r) => (
                  <li key={r.id} className={r.met ? 'text-income' : 'text-textMuted'}>
                    {r.met ? '✓' : '○'} {r.label}
                  </li>
                ))}
              </ul>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-expense">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="text-sm text-income">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] rounded-lg bg-primary py-2 text-sm font-medium text-bg transition-opacity duration-[160ms] ease-house hover:opacity-90 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent disabled:opacity-50"
          >
            {busy ? '…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button
          onClick={switchMode}
          className="mt-1 rounded-lg py-3 text-sm text-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
        >
          {isSignup ? 'Have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </Card>
    </div>
  );
}
