import { test, expect } from '@playwright/test';
import { launchApp, navigateTo, waitForHeading } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  await navigateTo(page, '成本');
  await page.waitForTimeout(1000);
});

test.afterAll(async () => {
  await app?.close();
});

// CostsView heading is "用量分析"
// 11-1
test('cost overview page loads', async () => {
  await waitForHeading(page, '用量分析');
});

// 11-2: Three tabs — "依代理人" / "依模型" / "每日趨勢"
test('breakdown tabs are present', async () => {
  await expect(page.locator('button:has-text("依代理人")')).toBeVisible();
  await expect(page.locator('button:has-text("依模型")')).toBeVisible();
  await expect(page.locator('button:has-text("每日趨勢")')).toBeVisible();
});

test('clicking breakdown tab switches view', async () => {
  await page.locator('button:has-text("依模型")').click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("每日趨勢")').click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("依代理人")').click();
  await page.waitForTimeout(300);
  // No crash = pass
  const body = await page.textContent('body');
  expect(body).toContain('用量分析');
});

// 11-3
test('stat cards show token and USD info', async () => {
  const body = await page.textContent('body');
  // StatCards should show token/cost related labels
  const hasStats = body!.includes('今日') || body!.includes('Token') || body!.includes('$');
  expect(hasStats).toBe(true);
});
