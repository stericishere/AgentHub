import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

/**
 * Browse Server — manages a Playwright browser daemon for Agent browsing.
 * Communicates over localhost HTTP with Bearer token auth.
 */

interface BrowseServerState {
  running: boolean;
  port: number;
  token: string;
  idleTimer: ReturnType<typeof setTimeout> | null;
  browser: unknown | null;
  context: unknown | null;
  page: unknown | null;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const state: BrowseServerState = {
  running: false,
  port: 0,
  token: '',
  idleTimer: null,
  browser: null,
  context: null,
  page: null,
};

function resetIdleTimer(): void {
  if (state.idleTimer) clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => {
    logger.info('Browse server idle timeout reached, stopping...');
    stop();
  }, IDLE_TIMEOUT_MS);
}

export async function start(): Promise<{ port: number; token: string }> {
  if (state.running) {
    return { port: state.port, token: state.token };
  }

  try {
    // Dynamic import to avoid bundling playwright unless needed
    const { chromium } = await import('playwright');

    state.token = randomUUID();
    state.browser = await chromium.launch({ headless: true });
    state.context = await (state.browser as any).newContext({
      viewport: { width: 1280, height: 720 },
    });
    state.page = await (state.context as any).newPage();

    // Use a simple HTTP server for tool communication
    const http = await import('http');
    const server = http.createServer(async (req, res) => {
      // Auth check
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${state.token}`) {
        res.writeHead(401);
        res.end('Unauthorized');
        return;
      }

      resetIdleTimer();

      let body = '';
      for await (const chunk of req) body += chunk;

      try {
        const payload = body ? JSON.parse(body) : {};
        const result = await handleRequest(req.url || '/', payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    // Listen on random available port
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    state.port = (server.address() as any).port;
    state.running = true;

    resetIdleTimer();
    logger.info(`Browse server started on port ${state.port}`);
    return { port: state.port, token: state.token };
  } catch (err) {
    logger.error('Failed to start browse server', err);
    throw err;
  }
}

export async function stop(): Promise<void> {
  if (!state.running) return;

  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }

  try {
    if (state.browser) {
      await (state.browser as any).close();
    }
  } catch (err) {
    logger.warn('Error closing browser', err);
  }

  state.browser = null;
  state.context = null;
  state.page = null;
  state.running = false;
  state.port = 0;
  state.token = '';
  logger.info('Browse server stopped');
}

export function getStatus(): { running: boolean; port: number } {
  return { running: state.running, port: state.port };
}

async function handleRequest(
  url: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const page = state.page as any;
  if (!page) throw new Error('No active page');

  switch (url) {
    case '/navigate': {
      const targetUrl = payload.url as string;
      if (!targetUrl) throw new Error('url is required');
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return { url: page.url(), title: await page.title() };
    }

    case '/screenshot': {
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      return { screenshot: buffer.toString('base64'), url: page.url() };
    }

    case '/click': {
      const selector = payload.selector as string;
      const ref = payload.ref as string;
      if (ref) {
        await page.locator(`[data-ref="${ref}"]`).click({ timeout: 5000 });
      } else if (selector) {
        await page.locator(selector).click({ timeout: 5000 });
      } else {
        throw new Error('selector or ref is required');
      }
      return { success: true };
    }

    case '/type': {
      const selector = payload.selector as string;
      const text = payload.text as string;
      if (!text) throw new Error('text is required');
      if (selector) {
        await page.locator(selector).fill(text, { timeout: 5000 });
      } else {
        await page.keyboard.type(text);
      }
      return { success: true };
    }

    case '/read_text': {
      const selector = payload.selector as string || 'body';
      const text = await page.locator(selector).innerText({ timeout: 5000 });
      return { text: text.slice(0, 10000) };
    }

    case '/wait': {
      const ms = (payload.ms as number) || 1000;
      const waitSelector = payload.selector as string;
      if (waitSelector) {
        await page.locator(waitSelector).waitFor({ timeout: Math.min(ms, 30000) });
      } else {
        await page.waitForTimeout(Math.min(ms, 10000));
      }
      return { success: true };
    }

    default:
      throw new Error(`Unknown action: ${url}`);
  }
}
