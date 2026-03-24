import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { join } from 'path';
import { mkdirSync } from 'fs';

/** Absolute path to the mock Claude CLI used in E2E tests. */
export const MOCK_CLAUDE_CLI_PATH = join(__dirname, 'mock-claude-cli.js');

/**
 * Create a unique test working directory under C:\e2e-test\.
 * Name format: auto-test-YYYYMMDD-HHmmss-SSS
 */
export function createTestWorkDir(): string {
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    '-',
    String(now.getMilliseconds()).padStart(3, '0'),
  ].join('');
  const dir = join('C:\\e2e-test', `auto-test-${ts}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Launch the Electron app and return { app, page }.
 *
 * Pass `useMockCli: true` to inject the mock Claude CLI via MOCK_CLAUDE_CLI,
 * which allows session-spawn tests to run without a real Claude Code installation.
 */
export async function launchApp(
  options: { useMockCli?: boolean } = {},
): Promise<{ app: ElectronApplication; page: Page }> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (options.useMockCli) {
    env.MOCK_CLAUDE_CLI = MOCK_CLAUDE_CLI_PATH;
  }

  const app = await electron.launch({
    args: [join(__dirname, '../out/main/index.js')],
    env,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  // Wait for Vue router to settle
  await page.waitForTimeout(1000);
  return { app, page };
}

/** Hover sidebar to expand, then click a nav item by label. */
export async function navigateTo(page: Page, label: string): Promise<void> {
  const sidebar = page.locator('aside.sidebar-rail');
  await sidebar.hover();
  await page.waitForTimeout(300);
  await page.click(`aside >> text="${label}"`);
  await page.waitForTimeout(500);
}

/** Wait for a heading (h2/h3) containing the given text. */
export async function waitForHeading(page: Page, text: string, timeout = 5000): Promise<void> {
  await page.waitForSelector(`h2:has-text("${text}"), h3:has-text("${text}")`, { timeout });
}

/** Fill an input field found by its label text. */
export async function fillByLabel(page: Page, label: string, value: string): Promise<void> {
  const labelEl = page.locator(`label:has-text("${label}")`);
  const input = labelEl.locator('..').locator('input, select, textarea');
  await input.fill(value);
}

/** Click a button by its visible text. */
export async function clickButton(page: Page, text: string): Promise<void> {
  await page.click(`button:has-text("${text}")`);
}
