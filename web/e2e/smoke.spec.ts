import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Full-page smoke of the revamped web app with a mocked Supabase backend:
// a seeded auth session (localStorage) + intercepted REST/function calls.
// Every page must render its mock data with zero uncaught page errors.

const REF = 'fpasfffeywotrclprcai';
const USER_ID = '00000000-0000-4000-8000-000000000001';

const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');
const FAKE_JWT = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
  sub: USER_ID,
  role: 'authenticated',
  exp: 9999999999,
})}.e2e-sig`;

const SESSION = {
  access_token: FAKE_JWT,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 9999999999,
  refresh_token: 'e2e-refresh',
  user: {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e@test.local',
    created_at: '2026-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
  },
};

// Dates inside the current month so Dashboard/Budgets month-math sees them.
const recent = (hoursAgo: number) =>
  new Date(Date.now() - hoursAgo * 3600_000).toISOString();

// Anchored to the 1st of the current UTC month — `recent()` can cross a month
// boundary (e.g. running on the 1st), which would break the month-math sums.
const monthStartPlus = (hours: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, hours)).toISOString();
};

const CATEGORIES = [
  { id: 'c1', user_id: USER_ID, name: 'Food', color: '#F59E0B', sort_order: 0 },
  { id: 'c2', user_id: USER_ID, name: 'Transport', color: '#0EA5E9', sort_order: 1 },
  { id: 'c3', user_id: USER_ID, name: 'Shopping', color: '#EC4899', sort_order: 2 },
];

const TXNS = [
  {
    id: 't1', user_id: USER_ID, amount: 12.9, currency: 'SGD', direction: 'out',
    description: 'BURGER KING JEM', merchant: 'BURGER KING JEM', card_label: 'UOB Visa',
    category: 'Food', transaction_date: monthStartPlus(3), source: 'shortcut',
    category_confidence: 0.85, needs_review: false, notes: null,
  },
  {
    id: 't2', user_id: USER_ID, amount: 89, currency: 'SGD', direction: 'out',
    description: 'POKEMON CENTER SG', merchant: 'POKEMON CENTER SG', card_label: null,
    category: 'Shopping', transaction_date: monthStartPlus(2), source: 'email',
    category_confidence: 0.4, needs_review: true, notes: 'gift',
  },
  {
    id: 't3', user_id: USER_ID, amount: 2500, currency: 'SGD', direction: 'in',
    description: 'SALARY AUG', merchant: null, card_label: null,
    category: null, transaction_date: monthStartPlus(1), source: 'email',
    category_confidence: null, needs_review: false, notes: null,
  },
];

const ITEMS = [
  { id: 'i1', user_id: USER_ID, transaction_id: 't1', name: 'Whopper meal', qty: 1, unit_price: 8.9, amount: 8.9, category: null, sort_order: 0 },
  { id: 'i2', user_id: USER_ID, transaction_id: 't1', name: 'Nuggets', qty: 2, unit_price: 2, amount: 4, category: null, sort_order: 1 },
];

const MONTH = new Date().toISOString().slice(0, 7);
const BUDGETS = [
  { id: 'b1', user_id: USER_ID, category_id: 'c1', month: MONTH, limit_amount: 300 },
];

const RULES = [
  { id: 'r1', user_id: USER_ID, pattern: 'pokemon', category: 'Shopping', priority: 200, created_at: recent(100), updated_at: recent(100) },
  { id: 'r2', user_id: USER_ID, pattern: 'grab', category: 'Transport', priority: 50, created_at: recent(90), updated_at: recent(90) },
];

const KEYS = [
  { id: 'k1', user_id: USER_ID, key: 'stk_e2e_test_key_abc123', label: 'iPhone shortcut', created_at: recent(200), last_used_at: null },
];

async function mockBackend(page: Page): Promise<string[]> {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

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
        const txnFilter = url.searchParams.get('transaction_id');
        data = txnFilter
          ? ITEMS.filter((i) => `eq.${i.transaction_id}` === txnFilter)
          : ITEMS.map((i) => ({ transaction_id: i.transaction_id }));
      }
      return route.fulfill({ json: wantsObject ? (data[0] ?? null) : data });
    }
    if (method === 'POST') {
      // insertTransaction expects the created row back (.single()).
      if (table === 'transactions') {
        return route.fulfill({
          status: 201,
          json: wantsObject
            ? { ...TXNS[0], id: 't-new', description: 'Sushi Express', amount: 5.5 }
            : [],
        });
      }
      return route.fulfill({ status: 201, json: [] });
    }
    return route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/functions/v1/categorize', (route) => {
    const body = route.request().postDataJSON() as { action?: string } | null;
    if (body?.action === 'status') {
      return route.fulfill({ json: { examples: 27, seeds: 25, corrections: 2 } });
    }
    if (body?.action === 'seed') {
      return route.fulfill({ json: { seeded: 0, remaining: 0, total: 25 } });
    }
    if (body?.action === 'learn') {
      return route.fulfill({ json: { status: 'learned', exampleOk: true, ruleOk: true } });
    }
    return route.fulfill({ json: { category: 'Food', confidence: 0.9, tier: 'knn' } });
  });

  return pageErrors;
}

test('dashboard renders totals, budgets, review badge and recent transactions', async ({ page }) => {
  const errors = await mockBackend(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('1 transaction to review')).toBeVisible();
  // Spent = 12.90 + 89.00 out this month.
  await expect(page.getByText('$101.90').first()).toBeVisible();
  await expect(page.getByText('$2500.00').first()).toBeVisible();
  await expect(page.getByText('BURGER KING JEM').first()).toBeVisible();
  await expect(page.getByText("This Month's Budgets")).toBeVisible();
  expect(errors).toEqual([]);
});

test('transactions: filters, expandable line items, edit modal saves', async ({ page }) => {
  const errors = await mockBackend(page);
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  await expect(page.getByText('Needs review (1)')).toBeVisible();
  await expect(page.getByText('POKEMON CENTER SG')).toBeVisible();

  // Expand the itemized transaction -> line items appear.
  await page.getByText('BURGER KING JEM').first().click();
  await expect(page.getByText('Whopper meal')).toBeVisible();
  await expect(page.getByText('2 × Nuggets')).toBeVisible();

  // Edit modal: fields prefilled, items editor loaded, save works.
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await expect(page.getByRole('heading', { name: 'Edit transaction' })).toBeVisible();
  await expect(page.locator('input[type="number"]').first()).toHaveValue('12.9');
  await expect(page.getByPlaceholder('e.g. Double cheeseburger').first()).toHaveValue('Whopper meal');
  await page.getByRole('combobox').first().selectOption('Shopping');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit transaction' })).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('review filter shows only flagged transactions', async ({ page }) => {
  const errors = await mockBackend(page);
  await page.goto('/transactions?review=1');
  await expect(page.getByText('POKEMON CENTER SG')).toBeVisible();
  await expect(page.getByText('BURGER KING JEM')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('add: category auto-suggest, line items, save navigates to transactions', async ({ page }) => {
  const errors = await mockBackend(page);
  await page.goto('/add');
  await expect(page.getByRole('heading', { name: 'Add transaction' })).toBeVisible();

  await page.getByPlaceholder('0.00').fill('5.50');
  await page.getByPlaceholder('e.g. Burger King Jem').fill('Sushi Express');
  await page.getByPlaceholder('e.g. Burger King Jem').blur();
  // kNN suggestion badge from the mocked categorize fn.
  await expect(page.getByText('similarity · 90%')).toBeVisible();

  await page.getByRole('button', { name: '+ Add line item' }).click();
  await page.getByPlaceholder('e.g. Double cheeseburger').fill('Salmon set');
  await page.locator('input[step="0.01"]').last().fill('5.50');

  await page.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  expect(errors).toEqual([]);
});

test('budgets: caps render with spend, set-budget affordance present', async ({ page }) => {
  const errors = await mockBackend(page);
  await page.goto('/budgets');
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();
  // Food: spent 12.90 of 300 cap.
  await expect(page.getByText('$12.90 / $300.00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set budget' }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('categories: list and learned rules with source badges', async ({ page }) => {
  const errors = await mockBackend(page);
  await page.goto('/categories');
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
  // Category name inputs are uncontrolled (defaultValue), so the value
  // attribute is present in the DOM.
  await expect(page.locator('input[value="Food"]')).toBeVisible();
  await expect(page.getByText('pokemon')).toBeVisible();
  await expect(page.getByText('your correction', { exact: true })).toBeVisible();
  await expect(page.getByText('AI-learned', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('settings: keys, webhook URL, categorizer status, shortcut guide', async ({ page }) => {
  const errors = await mockBackend(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('stk_e2e_test_key_abc123').first()).toBeVisible();
  await expect(page.getByText('never used')).toBeVisible();
  await expect(page.getByText(`/functions/v1/ingest`).first()).toBeVisible();
  await expect(page.getByText('27 examples')).toBeVisible();
  await expect(page.getByText('Live Apple Pay tracking (iOS Shortcut)')).toBeVisible();
  expect(errors).toEqual([]);
});
