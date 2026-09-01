import { useSyncExternalStore } from 'react';

// Three-state theme: 'system' follows prefers-color-scheme live; 'light'/'dark'
// are explicit picks persisted to localStorage('theme'). A module-level store
// keeps every useTheme() consumer (sidebar, More sheet, Settings) in sync.

export type ThemeMode = 'system' | 'light' | 'dark';

const LIGHT_BG = '#F6F4EF';
const DARK_BG = '#121110';

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem('theme');
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // Storage unavailable (private mode, blocked) — fall through to system.
  }
  return 'system';
}

const mq: MediaQueryList | null =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

let mode: ThemeMode = readStored();
const listeners = new Set<() => void>();

function resolvedDark(): boolean {
  return mode === 'dark' || (mode === 'system' && !!mq?.matches);
}

function apply(): void {
  document.documentElement.classList.toggle('dark', resolvedDark());
  // Keep the browser chrome color honest: system mode restores the per-media
  // defaults; an explicit choice pins BOTH metas to that theme's bg.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    if (mode === 'system') {
      m.content = (m.getAttribute('media') ?? '').includes('dark') ? DARK_BG : LIGHT_BG;
    } else {
      m.content = mode === 'dark' ? DARK_BG : LIGHT_BG;
    }
  });
}

function emit(): void {
  listeners.forEach((fn) => fn());
}

function setMode(next: ThemeMode): void {
  mode = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Non-fatal: the choice just won't survive a reload.
  }
  apply();
  emit();
}

function onSystemChange(): void {
  if (mode === 'system') {
    apply();
    emit();
  }
}
if (mq) {
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onSystemChange);
  else if (typeof (mq as any).addListener === 'function') (mq as any).addListener(onSystemChange);
}

// Apply the stored theme immediately on module load (before first paint of
// the app tree) so there's no light-flash for returning dark-mode users.
if (typeof document !== 'undefined') apply();

function subscribeStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): string {
  return `${mode}:${resolvedDark() ? 'dark' : 'light'}`;
}

export function useTheme(): { mode: ThemeMode; resolvedDark: boolean; setMode: (m: ThemeMode) => void } {
  const snap = useSyncExternalStore(subscribeStore, getSnapshot);
  const [m, resolved] = snap.split(':');
  return { mode: m as ThemeMode, resolvedDark: resolved === 'dark', setMode };
}
