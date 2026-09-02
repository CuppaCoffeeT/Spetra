import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { useLiveTransactions } from './lib/realtime';
import { formatMoney } from './lib/api';
import { useTheme, type ThemeMode } from './lib/useTheme';
import { showToast, subscribe, type ToastPayload } from './lib/toastBus';
import { Spinner, Toast } from './components/ui';
import {
  Dashboard as IconDashboard,
  Transactions as IconTransactions,
  Plus as IconPlus,
  Budgets as IconBudgets,
  More as IconMore,
  Tag as IconTag,
  Gear as IconGear,
} from './components/Icons';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Add from './pages/Add';
import Budgets from './pages/Budgets';
import Categories from './pages/Categories';
import Settings from './pages/Settings';

const FOCUS_RING = 'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions', end: false },
  { to: '/add', label: 'Add', end: false },
  { to: '/budgets', label: 'Budgets', end: false },
  { to: '/categories', label: 'Categories', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

const THEME_LABEL: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const NEXT_THEME: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };

// ---------------------------------------------------------------- toast slips

const SLIP_CLS =
  'pointer-events-auto w-full min-h-[44px] rounded-xl border border-border bg-surface px-4 py-3 text-left md:w-80 ' +
  '[box-shadow:0_12px_32px_-16px_rgba(20,16,10,.25)] dark:[box-shadow:0_12px_32px_-16px_rgba(0,0,0,.5)]';

function ToastSlip({ payload, onDismiss }: { payload: ToastPayload; onDismiss: () => void }) {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const duration =
    payload.kind === 'txn'
      ? payload.txn.needsReview
        ? 8000
        : 6000
      : payload.duration ?? (payload.action ? 8000 : 6000);

  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const remaining = useRef(duration);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const leavingRef = useRef(false);

  const leave = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => dismissRef.current(), 150);
  };
  const pause = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      if (startedAt.current != null) {
        remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
        startedAt.current = null;
      }
    }
  };
  const resume = () => {
    if (leavingRef.current || timer.current != null) return;
    startedAt.current = Date.now();
    timer.current = window.setTimeout(leave, remaining.current);
  };

  useEffect(() => {
    resume();
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hold = { onPointerOver: pause, onPointerDown: pause, onFocus: pause, onPointerLeave: resume, onBlur: resume };
  const anim = leaving ? 'animate-toast-out' : 'animate-toast-in';

  if (payload.kind === 'txn') {
    const t = payload.txn;
    return (
      <button
        type="button"
        className={`${SLIP_CLS} ${anim} ${FOCUS_RING}`}
        onClick={() => {
          navigate(`/transactions?open=${t.id}`);
          dismissRef.current();
        }}
        {...hold}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-textSecondary">
            {t.merchant ?? t.description}
          </span>
          <span className="shrink-0 text-sm font-semibold text-textPrimary [font-variant-numeric:tabular-nums]">
            {formatMoney(t.amount, t.currency)}
          </span>
        </span>
        {t.needsReview && (
          <span className="mt-1 flex items-center gap-1.5 text-xs text-textSecondary">
            <span aria-hidden className="h-[5px] w-[5px] rounded-full bg-warning" />
            Needs review
          </span>
        )}
      </button>
    );
  }

  const action = payload.action;
  return (
    <div className={`${SLIP_CLS} ${anim}`} {...hold}>
      {payload.label && (
        <div className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-textSecondary">
          {payload.label}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-textPrimary">
          {payload.tone === 'warning' && (
            <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full bg-warning" />
          )}
          <span className="min-w-0">{payload.message}</span>
        </span>
        {action && (
          <button
            type="button"
            className={`-mx-1 -my-3 min-h-[44px] min-w-[44px] shrink-0 rounded px-2 py-2 text-[13px] font-medium text-accent ${FOCUS_RING}`}
            onClick={() => {
              action.run();
              leave();
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- navigation

const TABS = [
  { to: '/', label: 'Dashboard', end: true, Icon: IconDashboard },
  { to: '/transactions', label: 'Transactions', end: false, Icon: IconTransactions },
  { to: '/add', label: 'Add', end: false, Icon: IconPlus },
  { to: '/budgets', label: 'Budgets', end: false, Icon: IconBudgets },
];

function tabCls(active: boolean): string {
  return (
    'flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] tracking-[0.02em] ' +
    `transition-colors duration-[160ms] ease-house ${FOCUS_RING} ` +
    (active ? 'text-textPrimary' : 'text-textSecondary')
  );
}

function TabDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={`h-[3px] w-[3px] rounded-full bg-accent transition-opacity duration-[160ms] ease-house ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}

function ThemeOptions({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme();
  const opt = (m: ThemeMode) => (
    <button
      key={m}
      type="button"
      aria-pressed={mode === m}
      onClick={() => setMode(m)}
      className={`min-h-[44px] rounded px-2 text-sm transition-colors duration-[160ms] ease-house ${FOCUS_RING} ${
        mode === m ? 'font-medium text-textPrimary' : 'text-textSecondary'
      }`}
    >
      {THEME_LABEL[m]}
    </button>
  );
  const dot = <span className="text-textMuted">·</span>;
  return (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {opt('system')}
      {dot}
      {opt('light')}
      {dot}
      {opt('dark')}
    </div>
  );
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  const firstRowRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus management: move focus into the sheet on open, hand it back to the
  // opener (the More tab) on close, and lock the page scroll behind the sheet.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstRowRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, []);

  const rowCls =
    `flex h-12 items-center gap-3 px-5 text-sm text-textPrimary transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt ${FOCUS_RING}`;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More"
        className="absolute inset-x-0 bottom-0 animate-sheet-rise rounded-t-[20px] border-t border-border bg-surface pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2"
      >
        <NavLink ref={firstRowRef} to="/categories" className={rowCls} onClick={onClose}>
          <span className="text-textSecondary">
            <IconTag />
          </span>
          Categories
        </NavLink>
        <NavLink to="/settings" className={rowCls} onClick={onClose}>
          <span className="text-textSecondary">
            <IconGear />
          </span>
          Settings
        </NavLink>
        <div className="flex h-12 items-center justify-between gap-3 px-5">
          <span className="text-sm text-textSecondary">Theme</span>
          <ThemeOptions compact />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- shell

function Shell({ userId }: { userId: string }) {
  const { mode, setMode } = useTheme();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; payload: ToastPayload }[]>([]);
  const toastId = useRef(0);

  const push = useRef((payload: ToastPayload) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-2), { id, payload }]);
  }).current;

  // Pages emit slips through the bus; the Shell renders them.
  useEffect(() => subscribe(push), [push]);

  // Global "it just happened" feedback: any auto-ingested transaction pops a
  // tappable receipt slip, whatever page is open.
  useLiveTransactions(userId, (t) => showToast({ kind: 'txn', txn: t }));

  const moreActive = location.pathname.startsWith('/categories') || location.pathname.startsWith('/settings');

  return (
    <div className="flex min-h-dvh md:h-dvh">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface p-4 md:flex">
        <div className="mb-8 px-2 font-display text-lg font-medium text-textPrimary">Spend Tracker</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `relative rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-[160ms] ease-house ${FOCUS_RING} ${
                  isActive ? 'text-textPrimary' : 'text-textSecondary hover:text-textPrimary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden className="absolute -left-4 bottom-1.5 top-1.5 w-0.5 bg-accent" />}
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            type="button"
            onClick={() => setMode(NEXT_THEME[mode])}
            className={`rounded-lg px-3 py-2 text-left text-[13px] font-medium text-textSecondary transition-colors duration-[160ms] ease-house hover:text-textPrimary ${FOCUS_RING}`}
          >
            Theme · {THEME_LABEL[mode]}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-24 md:overflow-y-auto md:p-8 md:pb-8">
        <Routes>
          <Route path="/" element={<Dashboard userId={userId} />} />
          <Route path="/transactions" element={<Transactions userId={userId} />} />
          <Route path="/add" element={<Add userId={userId} />} />
          <Route path="/budgets" element={<Budgets userId={userId} />} />
          <Route path="/categories" element={<Categories userId={userId} />} />
          <Route path="/settings" element={<Settings userId={userId} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] supports-[backdrop-filter]:bg-surface/95 supports-[backdrop-filter]:backdrop-blur-md md:hidden"
      >
        <div className="flex h-14 items-stretch">
          {TABS.map(({ to, label, end, Icon }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => tabCls(isActive)}>
              {({ isActive }) => (
                <>
                  <Icon />
                  <span>{label}</span>
                  <TabDot active={isActive} />
                </>
              )}
            </NavLink>
          ))}
          <button type="button" className={tabCls(moreActive)} onClick={() => setMoreOpen(true)}>
            <IconMore />
            <span>More</span>
            <TabDot active={moreActive} />
          </button>
        </div>
      </nav>

      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}

      <Toast>
        {toasts.map((t) => (
          <ToastSlip
            key={t.id}
            payload={t.payload}
            onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </Toast>
    </div>
  );
}

export default function App() {
  const { session, loading, userId } = useAuth();
  if (loading) return <Spinner />;
  if (!session || !userId) return <Login />;
  return <Shell userId={userId} />;
}
