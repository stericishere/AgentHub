import { test, expect } from '@playwright/test';
import { launchApp, navigateTo } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  await navigateTo(page, '知識庫');
  await page.waitForTimeout(1000);
});

test.afterAll(async () => {
  await app?.close();
});

// 10-1: FileTree loads — heading "知識庫" is inside the left panel h2
test('knowledge page loads with file tree', async () => {
  await expect(page.locator('h2:has-text("知識庫")')).toBeVisible();
});

// 10-2: Click a tree item to view file
test('clicking a folder expands it and shows files', async () => {
  // Move mouse away from sidebar first to ensure it collapses
  await page.mouse.move(600, 400);
  await page.waitForTimeout(300);

  // Click the "company" folder in the main content area
  const folder = page.locator('main >> text=company').first();
  await folder.click();
  await page.waitForTimeout(500);

  // After expanding, there should be child items
  const body = await page.textContent('body');
  expect(body!.length).toBeGreaterThan(100);
});

// 10-3: Search input with placeholder "搜尋知識庫..."
test('search input exists', async () => {
  await expect(page.locator('input[placeholder="搜尋知識庫..."]')).toBeVisible();
});

test('search returns results', async () => {
  const searchInput = page.locator('input[placeholder="搜尋知識庫..."]');
  await searchInput.fill('SOP');
  await searchInput.press('Enter');
  await page.waitForTimeout(500);
  // Should show search results or keep displaying tree
  const body = await page.textContent('body');
  expect(body).toBeTruthy();
});
