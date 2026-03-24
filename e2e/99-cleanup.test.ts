import { test } from '@playwright/test';
import { launchApp } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';
import { rmSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
});

test.afterAll(async () => {
  await app?.close();
});

test('clean up E2E test projects from database', async () => {
  // Delete any projects with "E2E" in the name via the app's IPC
  const projects = await page.evaluate(async () => {
    return await (window as any).maestro.projects.list();
  });

  for (const p of projects) {
    if (p.name && p.name.includes('E2E')) {
      await page.evaluate(async (id: string) => {
        await (window as any).maestro.projects.delete(id);
      }, p.id);
    }
  }
});

test('clean up E2E test work directories', async () => {
  const testRoot = 'C:\\e2e-test';
  if (existsSync(testRoot)) {
    const dirs = readdirSync(testRoot).filter((d) => d.startsWith('auto-test-'));
    for (const d of dirs) {
      rmSync(join(testRoot, d), { recursive: true, force: true });
    }
    // Remove root if empty
    if (readdirSync(testRoot).length === 0) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});
