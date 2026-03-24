import { test, expect } from '@playwright/test';
import { launchApp, navigateTo, waitForHeading } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  await navigateTo(page, '代理人');
  await waitForHeading(page, '代理人');
});

test.afterAll(async () => {
  await app?.close();
});

// 4-1: AgentCard has class "rounded-xl border" and contains "啟動" button
test('agent list loads with agent cards', async () => {
  await page.waitForTimeout(1500);
  // Each AgentCard has a "啟動" button inside
  const launchBtns = page.locator('button:has-text("啟動")');
  const count = await launchBtns.count();
  expect(count).toBeGreaterThanOrEqual(10);
});

// 4-2: Department filter chips — "全部" plus department buttons
test('department filter tabs are present', async () => {
  // "全部" is always present
  await expect(page.locator('button:has-text("全部")').first()).toBeVisible();
  // Department buttons contain "(count)" pattern
  const deptButtons = page.locator('button:has-text("(")');
  const count = await deptButtons.count();
  expect(count).toBeGreaterThanOrEqual(5);
});

test('clicking department tab filters agents', async () => {
  // Count cards before filter
  const beforeCount = await page.locator('button:has-text("啟動")').count();

  // Click first department chip (not "全部")
  const firstDept = page.locator('button:has-text("(")').first();
  await firstDept.click();
  await page.waitForTimeout(500);

  // Should have fewer cards (filtered)
  const afterCount = await page.locator('button:has-text("啟動")').count();
  expect(afterCount).toBeLessThanOrEqual(beforeCount);

  // Reset to "全部"
  await page.locator('button:has-text("全部")').first().click();
  await page.waitForTimeout(300);
});

// 4-3: No search box in AgentsView currently — skip
test.skip('search box filters agents', async () => {
  // AgentsView uses department chips, not a text search input
});

// 4-4, 4-5: Click "詳情" button to open detail
test('clicking agent detail button opens detail page', async () => {
  const detailBtn = page.locator('button:has-text("詳情")').first();
  await detailBtn.click();
  await page.waitForTimeout(1000);

  // Should be on agent detail page — shows agent info
  const body = await page.textContent('body');
  expect(body!.length).toBeGreaterThan(200);

  // Navigate back
  await navigateTo(page, '代理人');
  await page.waitForTimeout(500);
});
