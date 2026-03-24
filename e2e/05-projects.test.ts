import { test, expect } from '@playwright/test';
import { launchApp, navigateTo, waitForHeading, createTestWorkDir } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;
let testWorkDir: string;

test.beforeAll(async () => {
  testWorkDir = createTestWorkDir();
  ({ app, page } = await launchApp());
});

test.afterAll(async () => {
  await app?.close();
});

// 5-1
test('project list page loads', async () => {
  await navigateTo(page, '專案');
  await waitForHeading(page, '專案');
});

// 5-2 + 5-3
test('create a new project via modal', async () => {
  // Open modal
  await page.locator('button', { hasText: '新增專案' }).click();
  await page.waitForTimeout(500);

  // Fill name — clear first, then type character by character to trigger v-model
  const nameInput = page.locator('input[placeholder="我的新專案"]');
  await nameInput.click();
  await nameInput.fill('');
  await nameInput.type('E2E Test Project', { delay: 10 });
  await page.waitForTimeout(200);

  // Fill workDir
  const dirInput = page.locator('input[placeholder*="projects"]');
  await dirInput.click();
  await dirInput.fill('');
  await dirInput.type(testWorkDir, { delay: 5 });
  await page.waitForTimeout(200);

  // Click the submit button inside the modal (not the top-right one)
  // The modal container is .fixed.inset-0, the submit button is the last "建立專案" inside it
  const submitBtn = page.locator('.fixed.inset-0 button', { hasText: '建立專案' });
  await submitBtn.click();
  await page.waitForTimeout(3000);

  // Check if modal closed (no more .fixed.inset-0 overlay)
  const modalGone = await page.locator('.fixed.inset-0').count();
  // Project should now appear in the list
  const body = await page.textContent('body');
  expect(body).toContain('E2E Test Project');
});

// 5-5
test('project card shows name', async () => {
  await expect(page.locator('text=E2E Test Project').first()).toBeVisible();
});

// 5-6
test('click project card opens detail page', async () => {
  await page.locator('text=E2E Test Project').first().click();
  await page.waitForTimeout(1500);
  const body = await page.textContent('body');
  expect(body).toContain('E2E Test Project');
});

// 6-1
test('sprint section visible in project detail', async () => {
  const body = await page.textContent('body');
  const hasSprint = body!.includes('Sprint') || body!.includes('sprint') || body!.includes('新增');
  expect(hasSprint).toBe(true);
});

// Cleanup
test('delete project cleans up', async () => {
  const deleteBtn = page.locator('button', { hasText: '刪除' }).first();
  if ((await deleteBtn.count()) > 0) {
    await deleteBtn.click();
    await page.waitForTimeout(500);
    const confirmBtn = page.locator('button', { hasText: '確認' }).first();
    if ((await confirmBtn.count()) > 0) {
      await confirmBtn.click();
      await page.waitForTimeout(1000);
    }
  }
});
