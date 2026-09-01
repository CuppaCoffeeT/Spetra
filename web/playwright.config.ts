import { defineConfig } from '@playwright/test';

// E2E smoke against the production build (vite preview) with a fully mocked
// Supabase backend — run `npm run build` first, then `npm run e2e`.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4179',
    headless: true,
  },
  webServer: {
    command: 'npm run preview -- --port 4179 --strictPort',
    url: 'http://localhost:4179',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
