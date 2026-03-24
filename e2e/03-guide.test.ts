import { test, expect } from '@playwright/test';
import { launchApp, navigateTo, waitForHeading } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  await navigateTo(page, '使用說明');
});

test.afterAll(async () => {
  await app?.close();
});

// 3-1
test('shows Claude Code CLI detection status', async () => {
  await waitForHeading(page, '使用說明');
  // Should show either "已就緒" or "未安裝"
  const statusText = await page.textContent('body');
  const hasStatus =
    statusText!.includes('Claude Code CLI 已就緒') ||
    statusText!.includes('Claude Code CLI 未安裝');
  expect(hasStatus).toBe(true);
});

// 3-2
test('shows 4-step installation guide', async () => {
  const steps = [
    '安裝 Claude Code CLI',
    '登入 Claude Code',
    '在 Maestro 建立專案',
    '啟動工作階段',
  ];
  for (const step of steps) {
    await expect(page.locator(`text="${step}"`)).toBeVisible();
  }
});

// 3-3
test('shows core concepts, system requirements, and FAQ', async () => {
  await expect(page.locator('text="核心概念"')).toBeVisible();
  await expect(page.locator('text="系統需求"')).toBeVisible();
  await expect(page.locator('text="常見問題"')).toBeVisible();
});

test('system requirements table has correct entries', async () => {
  const requirements = ['Node.js', 'Claude Code CLI', 'Anthropic 帳號', 'Git'];
  for (const req of requirements) {
    await expect(page.locator(`text="${req}"`).first()).toBeVisible();
  }
});

test('npm install command is displayed', async () => {
  await expect(
    page.locator('text="npm install -g @anthropic-ai/claude-code"'),
  ).toBeVisible();
});
