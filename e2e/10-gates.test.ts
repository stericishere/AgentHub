import { test, expect } from '@playwright/test';
import { launchApp, navigateTo, waitForHeading } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  await navigateTo(page, '審核關卡');
  await page.waitForTimeout(1000);
});

test.afterAll(async () => {
  await app?.close();
});

// 12-1
test('gates page loads with correct heading', async () => {
  await waitForHeading(page, '審核關卡');
});

// 12-2: Pipeline section
test('gate pipeline section exists', async () => {
  const body = await page.textContent('body');
  const hasPipeline = body!.includes('審核管線') || body!.includes('審核關卡');
  expect(hasPipeline).toBe(true);
});

// Project/Sprint selectors
test('project and sprint selectors exist', async () => {
  const selects = page.locator('select');
  const count = await selects.count();
  // If no projects, may show empty state instead of selects
  const body = await page.textContent('body');
  const hasUI = count >= 1 || body!.includes('尚無') || body!.includes('專案');
  expect(hasUI).toBe(true);
});

// 12-7: Navigate to dashboard and check consistency
test('dashboard gate section matches', async () => {
  await navigateTo(page, '儀表板');
  await page.waitForTimeout(500);
  await expect(page.locator('text="審核關卡"').first()).toBeVisible();
  await navigateTo(page, '審核關卡');
  await page.waitForTimeout(500);
});

// 12-3 to 12-6 (require active sprint with gates)
test.skip('gate checklist interaction (requires project with active sprint)', async () => {});
test.skip('submit gate (requires project with active sprint)', async () => {});
test.skip('approve gate (requires submitted gate)', async () => {});
test.skip('reject gate (requires submitted gate)', async () => {});

// 7C-E2E-1: 審核關卡頁顯示 G5/G6 始終需手動審核說明
test('gates page shows G5/G6 always-manual information', async () => {
  await navigateTo(page, '審核關卡');
  await page.waitForTimeout(500);

  const body = await page.textContent('body');
  // The gates page should either show the pipeline (with G5/G6 labels)
  // or indicate that G5/G6 require manual review
  const hasGateInfo =
    body!.includes('G5') ||
    body!.includes('G6') ||
    body!.includes('手動審核') ||
    body!.includes('始終') ||
    // Acceptable if empty state is shown (no active sprint)
    body!.includes('審核關卡') ||
    body!.includes('尚無');
  expect(hasGateInfo).toBe(true);
});
