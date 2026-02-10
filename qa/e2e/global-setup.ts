import { chromium, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireEnv, optionalEnv } from './lib/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_DIR = path.join(__dirname, '.auth');

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    process.env.APP_BASE_URL ||
    (config.projects[0]?.use?.baseURL as string | undefined) ||
    'http://localhost:5173';

  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const browser = await chromium.launch();

  try {
    // --- ADMIN LOGIN ---
    const adminEmail = requireEnv('QA_ADMIN_EMAIL');
    const adminPassword = requireEnv('QA_ADMIN_PASSWORD');

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    await adminPage.goto(`${baseURL}/auth`, { waitUntil: 'domcontentloaded' });

    await adminPage.fill('input[name="email"]', adminEmail);
    await adminPage.fill('input[name="password"]', adminPassword);
    await adminPage.locator('button[type="submit"]').click();

    // Wait to leave /auth
    await adminPage.waitForURL((url) => !url.pathname.startsWith('/auth'), {
      timeout: 20_000,
    });

    await adminContext.storageState({ path: path.join(AUTH_DIR, 'admin.json') });
    await adminContext.close();

    // --- CLIENT LOGIN (only if creds present) ---
    const clientEmail = optionalEnv('QA_CLIENT_EMAIL');
    const clientPassword = optionalEnv('QA_CLIENT_PASSWORD');

    if (clientEmail && clientPassword) {
      const clientContext = await browser.newContext();
      const clientPage = await clientContext.newPage();

      await clientPage.goto(`${baseURL}/client/login`, {
        waitUntil: 'domcontentloaded',
      });

      await clientPage.fill('input[name="email"]', clientEmail);
      await clientPage.fill('input[name="password"]', clientPassword);
      await clientPage.locator('button[type="submit"]').click();

      // Wait for URL to start with /client
      await clientPage.waitForURL(
        (url) => url.pathname.startsWith('/client') && url.pathname !== '/client/login',
        { timeout: 20_000 },
      );

      await clientContext.storageState({
        path: path.join(AUTH_DIR, 'client.json'),
      });
      await clientContext.close();
    }
  } finally {
    await browser.close();
  }
}
