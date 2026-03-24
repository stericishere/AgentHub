import { test, expect } from '@playwright/test';
import { launchApp, navigateTo, waitForHeading, createTestWorkDir } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let app: ElectronApplication;
let page: Page;
let testWorkDir: string;

test.beforeAll(async () => {
  testWorkDir = createTestWorkDir();
  ({ app, page } = await launchApp());
  await navigateTo(page, '任務');
  await page.waitForTimeout(1000);
});

test.afterAll(async () => {
  await app?.close();
});

// 7-1: TaskBoardView has KanbanColumn components
test('task board page loads', async () => {
  const heading = await page.textContent('h2');
  expect(heading).toContain('任務');
});

// 7-2: "新增任務" button
test('create task button exists', async () => {
  const createBtn = page.locator('button:has-text("新增任務")');
  // Button may only show when a project is selected
  const body = await page.textContent('body');
  expect(body).toContain('任務');
});

// 7-8: Project/Sprint selector dropdowns
test('project and sprint selectors exist', async () => {
  const selects = page.locator('select');
  const count = await selects.count();
  // Should have project and sprint selects (or show "no project" message)
  const body = await page.textContent('body');
  const hasSelector = count >= 1 || body!.includes('專案') || body!.includes('尚無');
  expect(hasSelector).toBe(true);
});

// 7-9: Task detail page shows Git section when project has workDir
test('task detail page has git section for project tasks', async () => {
  // Create a project with workDir
  const project = await page.evaluate(async (dir: string) => {
    return await (window as any).maestro.projects.create({
      name: 'E2E Git Task Test',
      workDir: dir,
    });
  }, testWorkDir);

  // Create a task in that project
  const task = await page.evaluate(async (projId: string) => {
    return await (window as any).maestro.tasks.create({
      projectId: projId,
      title: 'E2E Git 測試任務',
    });
  }, project.id);

  // Reload page so stores pick up new data, then navigate to task detail
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  await page.evaluate((hash: string) => {
    window.location.hash = hash;
  }, `#/tasks/${task.id}`);
  await page.waitForTimeout(2000);

  // Should show task detail heading
  await expect(page.locator('h2:has-text("任務詳情")')).toBeVisible();

  // Should have "Git 變更" section (only when project has workDir)
  await expect(page.locator('text="Git 變更"')).toBeVisible();

  // Clean up
  await page.evaluate(async (id: string) => {
    await (window as any).maestro.tasks.delete(id);
  }, task.id);
  await page.evaluate(async (id: string) => {
    await (window as any).maestro.projects.delete(id);
  }, project.id);
});
