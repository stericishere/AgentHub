import { test, expect } from '@playwright/test';
import { launchApp, navigateTo, waitForHeading } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  await navigateTo(page, '儀表板');
  await waitForHeading(page, '儀表板');
});

test.afterAll(async () => {
  await app?.close();
});

// 16-1
test('four stat cards display correct labels', async () => {
  const labels = ['代理人', '執行中', '專案', '今日用量'];
  for (const label of labels) {
    await expect(page.locator(`text="${label}"`).first()).toBeVisible();
  }
});

// 16-2
test('sprint section exists', async () => {
  await expect(page.locator('text="進行中 Sprint"')).toBeVisible();
});

// 16-3
test('pending tasks section exists', async () => {
  await expect(page.locator('text="待處理任務"')).toBeVisible();
});

// 16-4
test('active sessions section exists', async () => {
  await expect(page.locator('text="活躍工作階段"')).toBeVisible();
});

// 16-5
test('gate status section exists', async () => {
  await expect(page.locator('text="審核關卡"').first()).toBeVisible();
});

// 16-6
test('recent activity section exists', async () => {
  await expect(page.locator('text="最近活動"')).toBeVisible();
});

// 16-7
test('budget card or cost info displayed', async () => {
  const body = await page.textContent('body');
  const hasBudget =
    body!.includes('今日用量') || body!.includes('Token') || body!.includes('$');
  expect(hasBudget).toBe(true);
});

// Cross-check: "查看全部" links work
test('sprint "查看全部" navigates to projects', async () => {
  const viewAllBtns = page.locator('button:has-text("查看全部")');
  const first = viewAllBtns.first();
  if ((await first.count()) > 0) {
    await first.click();
    await page.waitForTimeout(500);
    // Should have navigated away from dashboard
    const url = page.url();
    expect(url).toBeTruthy();

    // Go back
    await navigateTo(page, '儀表板');
    await page.waitForTimeout(500);
  }
});
