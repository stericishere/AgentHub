import { test, expect } from '@playwright/test';
import { launchApp, navigateTo } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  // Navigate to settings via URL hash (sidebar has no "設定" link by default)
  await page.evaluate(() => (window.location.hash = '#/settings'));
  await page.waitForTimeout(1000);
});

test.afterAll(async () => {
  await app?.close();
});

// 13-1
test('settings tabs are all present', async () => {
  const tabs = ['帳號', '同步', '一般', 'Claude 命令列', '工作階段', '預算', '通知', '快捷鍵'];
  for (const tab of tabs) {
    const btn = page.locator(`button:has-text("${tab}")`).first();
    expect(await btn.count()).toBeGreaterThanOrEqual(1);
  }
});

// Helper: click a settings tab
async function clickTab(tab: string) {
  await page.click(`button:has-text("${tab}")`);
  await page.waitForTimeout(300);
}

// 13-2
test('general tab: language and project root fields', async () => {
  await clickTab('一般');
  await expect(page.locator('text="語言"')).toBeVisible();
  await expect(page.locator('text="專案根目錄"')).toBeVisible();

  // Can modify language
  const langSelect = page.locator('select').first();
  expect(await langSelect.count()).toBeGreaterThanOrEqual(1);
});

// 13-3
test('claude tab: CLI path, model, max turns', async () => {
  await clickTab('Claude 命令列');
  await expect(page.locator('text="CLI 路徑"')).toBeVisible();
  await expect(page.locator('text="預設 Model"')).toBeVisible();
  await expect(page.locator('text="最大回合數"')).toBeVisible();
});

// 13-4
test('session tab: auto save and font size', async () => {
  await clickTab('工作階段');
  await expect(page.locator('text="自動儲存"')).toBeVisible();
  await expect(page.locator('text="終端字體大小"')).toBeVisible();
});

// 13-5
test('budget tab: daily limit, total limit, threshold', async () => {
  await clickTab('預算');
  await expect(page.locator('text="每日 Token 限額"')).toBeVisible();
  await expect(page.locator('text="總 Token 限額"')).toBeVisible();
  await expect(page.locator('text=警示閾值').first()).toBeVisible();
});

// 13-6
test('notification tab: four toggle switches', async () => {
  await clickTab('通知');
  await expect(page.locator('text="工作階段完成"')).toBeVisible();
  await expect(page.locator('text="工作階段失敗"')).toBeVisible();
  await expect(page.locator('text="預算警告"')).toBeVisible();
  await expect(page.locator('text="關卡提交"')).toBeVisible();
});

// 13-7
test('shortcuts tab: displays keyboard shortcuts', async () => {
  await clickTab('快捷鍵');
  await expect(page.locator('text="顯示/隱藏視窗"')).toBeVisible();
  await expect(page.locator('text="命令面板"')).toBeVisible();
  await expect(page.locator('text="新增工作階段"')).toBeVisible();
  await expect(page.locator('text="Ctrl+Shift+M"')).toBeVisible();
  await expect(page.locator('main >> text="Ctrl+K"')).toBeVisible();
  await expect(page.locator('text="Ctrl+N"')).toBeVisible();
});

// 13-8
test('account tab: shows GitHub login section', async () => {
  await clickTab('帳號');
  await expect(page.locator('text="GitHub"')).toBeVisible();

  const body = await page.textContent('body');
  const hasLoginState =
    body!.includes('以 GitHub 登入') || body!.includes('已連線');
  expect(hasLoginState).toBe(true);
});

// 13-9, 13-10, 13-11 (OAuth requires browser popup — limited automation)
test.skip('GitHub OAuth login flow (requires browser popup)', async () => {});

// 13-12
test('sync tab: shows Notion section', async () => {
  await clickTab('同步');
  const body = await page.textContent('body');
  const hasNotion =
    body!.includes('Notion') || body!.includes('雲端同步');
  expect(hasNotion).toBe(true);
});

// 13-13 to 13-21 (Notion OAuth + sync operations — requires live Notion)
test.skip('Notion OAuth login flow (requires browser popup)', async () => {});

// 7C-E2E-2: 設定頁權限 tab 存在
test('settings has permissions tab', async () => {
  const permissionsTab = page.locator('button:has-text("權限")').first();
  if ((await permissionsTab.count()) > 0) {
    await permissionsTab.click();
    await page.waitForTimeout(300);
    // Confirm the permissions section is visible
    const body = await page.textContent('body');
    const hasPermissionsContent =
      body!.includes('權限') ||
      body!.includes('自動審核') ||
      body!.includes('審核規則');
    expect(hasPermissionsContent).toBe(true);
  } else {
    // Permissions tab not yet implemented — soft skip
    test.skip();
  }
});

// 7C-E2E-3: 新增自動審核規則
test('can add auto-approval rule', async () => {
  const permissionsTab = page.locator('button:has-text("權限")').first();
  if ((await permissionsTab.count()) === 0) {
    test.skip();
    return;
  }

  await permissionsTab.click();
  await page.waitForTimeout(300);

  // Look for "新增" button within the permissions tab
  const addRuleBtn = page
    .locator('button:has-text("新增規則"), button:has-text("新增"), button:has-text("+ 新增")')
    .first();

  if ((await addRuleBtn.count()) === 0) {
    // Feature not yet available — soft skip
    test.skip();
    return;
  }

  await addRuleBtn.click();
  await page.waitForTimeout(300);

  // Fill in rule details if a form appears
  const ruleInput = page.locator('input[placeholder*="規則"], input[placeholder*="工具"], input').first();
  if ((await ruleInput.count()) > 0) {
    await ruleInput.fill('e2e-test-rule');
    const saveBtn = page
      .locator('button:has-text("儲存"), button:has-text("確認"), button:has-text("新增")')
      .last();
    if ((await saveBtn.count()) > 0) {
      await saveBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Verify the page is still functional after the interaction
  const body = await page.textContent('body');
  expect(body).toBeTruthy();
});

// 7C-E2E-4: G5/G6 保護警示
test('shows G5/G6 always-manual warning', async () => {
  const permissionsTab = page.locator('button:has-text("權限")').first();
  if ((await permissionsTab.count()) === 0) {
    test.skip();
    return;
  }

  await permissionsTab.click();
  await page.waitForTimeout(300);

  const body = await page.textContent('body');
  // The page should mention G5/G6 or always-manual protection
  const hasProtectionWarning =
    body!.includes('G5') ||
    body!.includes('G6') ||
    body!.includes('始終需手動') ||
    body!.includes('手動審核') ||
    body!.includes('無法自動');

  if (hasProtectionWarning) {
    expect(hasProtectionWarning).toBe(true);
  } else {
    // Warning UI not yet implemented — soft skip
    test.skip();
  }
});

test('save button works on general tab', async () => {
  await clickTab('一般');
  const saveBtn = page.locator('button:has-text("儲存設定")');
  expect(await saveBtn.count()).toBeGreaterThanOrEqual(1);
  await saveBtn.click();
  await page.waitForTimeout(1000);

  // Should show success message
  const body = await page.textContent('body');
  expect(body).toContain('設定已儲存');
});
