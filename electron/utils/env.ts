import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

let loaded = false;

/**
 * Load .env file into process.env (only once).
 * In packaged builds, .env is optional — secrets should be injected at build time.
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const envPath = app.isPackaged
    ? join(process.resourcesPath, '.env')
    : join(app.getAppPath(), '.env');

  if (!existsSync(envPath)) return;

  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional
  }
}

export function getEnv(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}
