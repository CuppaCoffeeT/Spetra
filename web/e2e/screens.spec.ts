import { test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Screenshot rig for design review — run with:  SCREENS=1 npx playwright test e2e/screens.spec.ts
// Writes PNGs to e2e/__screens/. Skipped in normal test runs.
// Mock backend is a self-contained copy of the smoke-spec harness.

const REF = 'fpasfffeywotrclprcai';
const USER_ID = '00000000-0000-4000-8000-000000000001';

const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const FAKE_JWT = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: USER_ID, role: 'authenticated', exp: 9999999999 })}.e2e-sig`;
const SESSION = {
  access_token: FAKE_JWT, token_type: 'bearer', expires_in: 3600, expires_at: 9999999999,
  refresh_token: 'e2e-refresh',
  user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'e2e@test.local', created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} },
};
const monthStartPlus = (hours: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, hours)).toISOString();
};
const recent = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const CATEGORIES = [
  { id: 'c1', user_id: USER_ID, name: 'Food', color: '#F59E0B', sort_order: 0 },
  { id: 'c2', user_id: USER_ID, name: 'Transport', color: '#0EA5E9', sort_order: 1 },
  { id: 'c3', user_id: USER_ID, name: 'Shopping', color: '#EC4899', sort_order: 2 },
];
const TXNS = [
  { id: 't1', user_id: USER_ID, amount: 12.9, currency: 'SGD', direction: 'out', description: 'BURGER KING JEM', merchant: 'BURGER KING JEM', card_label: 'UOB Visa', category: 'Food', transaction_date: monthStartPlus(3), source: 'shortcut', category_confidence: 0.85, needs_review: false, notes: null },
  { id: 't2', user_id: USER_ID, amount: 89, currency: 'SGD', direction: 'out', description: 'POKEMON CENTER SG', merchant: 'POKEMON CENTER SG', card_label: null, category: 'Shopping', transaction_date: monthStartPlus(2), source: 'email', category_confidence: 0.4, needs_review: true, notes: 'gift' },
  { id: 't3', user_id: USER_ID, amount: 2500, currency: 'SGD', direction: 'in', description: 'SALARY AUG', merchant: null, card_label: null, category: null, transaction_date: monthStartPlus(1), source: 'email', category_confidence: null, needs_review: false, notes: null },
];
const ITEMS = [
  { id: 'i1', user_id: USER_ID, transaction_id: 't1', name: 'Whopper meal', qty: 1, unit_price: 8.9, amount: 8.9, category: null, sort_order: 0 },
  { id: 'i2', user_id: USER_ID, transaction_id: 't1', name: 'Nuggets', qty: 2, unit_price: 2, amount: 4, category: null, sort_order: 1 },
];
const MONTH = new Date().toISOString().slice(0, 7);
const BUDGETS = [{ id: 'b1', user_id: USER_ID, category_id: 'c1', month: MONTH, limit_amount: 300 }];
const RULES = [
  { id: 'r1', user_id: USER_ID, pattern: 'pokemon', category: 'Shopping', priority: 200, created_at: recent(100), updated_at: recent(100) },
  { id: 'r2', user_id: USER_ID, pattern: 'grab', category: 'Transport', priority: 50, created_at: recent(90), updated_at: recent(90) },
];
const KEYS = [{ id: 'k1', user_id: USER_ID, key: 'stk_e2e_test_key_abc123', label: 'iPhone shortcut', created_at: recent(200), last_used_at: null }];

async function mockBackend(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, session]) => window.localStorage.setItem(key, session),
    [`sb-${REF}-auth-token`, JSON.stringify(SESSION)] as [string, string]
  );
  await page.route('**/auth/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/user')) return route.fulfill({ json: SESSION.user });
    if (url.includes('/token')) return route.fulfill({ json: SESSION });
    return route.fulfill({ json: {} });
  });
  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop() ?? '';
    const method = route.request().method();
    const wantsObject = (route.request().headers()['accept'] ?? '').includes('pgrst.object');
    if (method === 'GET') {
      let data: unknown[] = [];
      if (table === 'transactions') data = TXNS;
      else if (table === 'categories') data = CATEGORIES;
      else if (table === 'budgets') data = BUDGETS;
      else if (table === 'rules') data = RULES;
      else if (table === 'ingest_keys') data = KEYS;
      else if (table === 'transaction_items') {
        const f = url.searchParams.get('transaction_id');
        data = f ? ITEMS.filter((i) => `eq.${i.transaction_id}` === f) : ITEMS.map((i) => ({ transaction_id: i.transaction_id }));
      }
      return route.fulfill({ json: wantsObject ? (data[0] ?? null) : data });
    }
    if (method === 'POST') return route.fulfill({ status: 201, json: wantsObject ? { ...TXNS[0], id: 't-new' } : [] });
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/functions/v1/categorize', (route) => {
    const body = route.request().postDataJSON() as { action?: string } | null;
    if (body?.action === 'status') return route.fulfill({ json: { examples: 27, seeds: 25, corrections: 2 } });
    if (body?.action === 'seed') return route.fulfill({ json: { seeded: 0, remaining: 0, total: 25 } });
    if (body?.action === 'learn') return route.fulfill({ json: { status: 'learned', exampleOk: true, ruleOk: true } });
    return route.fulfill({ json: { category: 'Food', confidence: 0.9, tier: 'knn' } });
  });
}

const PAGES: Array<[string, string]> = [
  ['dashboard', '/'],
  ['transactions', '/transactions'],
  ['editor-open', '/transactions?open=t1'],
  ['add', '/add'],
  ['budgets', '/budgets'],
  ['categories', '/categories'],
  ['settings', '/settings'],
];
const MODES: Array<[string, { width: number; height: number }, 'light' | 'dark']> = [
  ['mobile', { width: 390, height: 844 }, 'light'],
  ['mobile-dark', { width: 390, height: 844 }, 'dark'],
  ['desktop', { width: 1280, height: 800 }, 'light'],
];

for (const [name, path] of PAGES) {
  test(`shot ${name}`, async ({ page }) => {
    test.skip(!process.env.SCREENS, 'screenshot rig — set SCREENS=1');
    await mockBackend(page);
    for (const [tag, viewport, scheme] of MODES) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `e2e/__screens/${name}-${tag}.png`, fullPage: true });
    }
  });
}
