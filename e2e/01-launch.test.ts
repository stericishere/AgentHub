import { test, expect } from '@playwright/test';
import { launchApp } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
});

test.afterAll(async () => {
  await app?.close();
});

// 1-1
test('app launches without crash', async () => {
  expect(page).toBeTruthy();
  const content = await page.textContent('body');
  expect(content).toBeTruthy();
});

// 1-2
test('title bar shows Maestro', async () => {
  const title = await page.title();
  expect(title).toContain('Maestro');
});

// 1-3
test('dashboard loads with stat cards', async () => {
  await page.waitForSelector('h2:has-text("儀表板")', { timeout: 10000 });
  // Stat card labels
  await expect(page.locator('text="代理人"').first()).toBeVisible();
  await expect(page.locator('text="執行中"').first()).toBeVisible();
  await expect(page.locator('text="專案"').first()).toBeVisible();
  await expect(page.locator('text="今日用量"').first()).toBeVisible();
});

// 1-4, 1-5, 1-6, 1-7 (Tray + global shortcut — OS-level, skip)
test.skip('system tray icon appears', async () => {});
test.skip('closing window hides to tray', async () => {});
test.skip('tray double-click restores window', async () => {});
test.skip('Ctrl+Shift+M toggles window', async () => {});

// 1-8
test('window has correct minimum dimensions', async () => {
  const size = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  expect(size.width).toBeGreaterThanOrEqual(900);
  expect(size.height).toBeGreaterThanOrEqual(550);
});
