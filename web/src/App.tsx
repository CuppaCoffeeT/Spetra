import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { supabase } from './lib/supabase';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';

function useDarkMode() {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions', end: false },
  { to: '/budgets', label: 'Budgets', end: false },
];

function Shell({ userId }: { userId: string }) {
  const { dark, toggle } = useDarkMode();
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface p-4">
        <div className="mb-8 px-2 text-lg font-bold">Spend Tracker</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-surfaceAlt text-textPrimary' : 'text-textSecondary hover:bg-surfaceAlt'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            onClick={toggle}
            className="rounded-lg px-3 py-2 text-left text-sm text-textSecondary hover:bg-surfaceAlt"
          >
            {dark ? '☀︎ Light' : '☾ Dark'}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-lg px-3 py-2 text-left text-sm text-expense hover:bg-surfaceAlt"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Routes>
          <Route path="/" element={<Dashboard userId={userId} />} />
          <Route path="/transactions" element={<Transactions userId={userId} />} />
          <Route path="/budgets" element={<Budgets userId={userId} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { session, loading, userId } = useAuth();
  if (loading) return <Spinner />;
  if (!session || !userId) return <Login />;
  return <Shell userId={userId} />;
}
