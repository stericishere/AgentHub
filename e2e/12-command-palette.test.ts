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

// 14-1: Ctrl+K opens palette — input placeholder is "搜尋頁面、代理人、指令..."
test('Ctrl+K opens command palette', async () => {
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(500);

  const paletteInput = page.locator('input[placeholder="搜尋頁面、代理人、指令..."]');
  await expect(paletteInput).toBeVisible();
});

// 14-2: Typing shows results
test('command palette shows results on input', async () => {
  const paletteInput = page.locator('input[placeholder="搜尋頁面、代理人、指令..."]');
  await paletteInput.fill('儀表');
  await page.waitForTimeout(300);

  // Should show "儀表板" in results
  await expect(page.locator('text="儀表板"').first()).toBeVisible();
});

// 14-3: Enter selects and navigates
test('selecting a command palette item navigates', async () => {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Palette should be closed
  const paletteInput = page.locator('input[placeholder="搜尋頁面、代理人、指令..."]');
  await expect(paletteInput).not.toBeVisible();

  // Should be on dashboard
  await expect(page.locator('h2:has-text("儀表板")')).toBeVisible();
});

// 14-4: Escape closes palette
test('Escape closes command palette', async () => {
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);

  // Verify it's open
  await expect(
    page.locator('input[placeholder="搜尋頁面、代理人、指令..."]'),
  ).toBeVisible();

  // Close with Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await expect(
    page.locator('input[placeholder="搜尋頁面、代理人、指令..."]'),
  ).not.toBeVisible();
});
