import { readFileSync } from 'fs';
import { join } from 'path';

type Locale = 'zh-TW' | 'en';

let currentLocale: Locale = 'zh-TW';
let messages: Record<Locale, Record<string, unknown>> = {
  'zh-TW': {},
  en: {},
};

/**
 * Initialize i18n messages for main process.
 * Loads from the renderer's locale files at build time via bundler,
 * or at runtime from the shared package.
 */
export function initI18n(): void {
  try {
    // Load from i18n-shared package
    const basePath = join(__dirname, '../../../packages/i18n-shared/src/locales');
    const zhTW = JSON.parse(readFileSync(join(basePath, 'zh-TW.json'), 'utf-8'));
    const en = JSON.parse(readFileSync(join(basePath, 'en.json'), 'utf-8'));

    // Also load app-specific electron keys from renderer locales
    const appBasePath = join(__dirname, '../../src/locales');
    try {
      const appZhTW = JSON.parse(readFileSync(join(appBasePath, 'zh-TW.json'), 'utf-8'));
      const appEn = JSON.parse(readFileSync(join(appBasePath, 'en.json'), 'utf-8'));
      messages['zh-TW'] = { ...zhTW, ...appZhTW };
      messages.en = { ...en, ...appEn };
    } catch {
      messages['zh-TW'] = zhTW;
      messages.en = en;
    }
  } catch (err) {
    console.warn('[i18n] Failed to load locale files, using fallback', err);
    // Hardcoded fallback for critical menu items
    messages = {
      'zh-TW': {
        electron: {
          menu: { about: '關於 Maestro', quit: '結束', edit: '編輯', undo: '復原', redo: '重做', cut: '剪下', copy: '複製', paste: '貼上', selectAll: '全選', view: '檢視', reload: '重新載入', devtools: '開發者工具', zoomIn: '放大', zoomOut: '縮小', resetZoom: '重設縮放' },
          tray: { showWindow: '顯示視窗', sessions: 'Sessions: {n} 執行中', quit: '結束' },
        },
        common: { quit: '結束', copy: '複製', paste: '貼上', cut: '剪下', selectAll: '全選' },
      },
      en: {
        electron: {
          menu: { about: 'About Maestro', quit: 'Quit', edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All', view: 'View', reload: 'Reload', devtools: 'Developer Tools', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', resetZoom: 'Reset Zoom' },
          tray: { showWindow: 'Show Window', sessions: 'Sessions: {n} Running', quit: 'Quit' },
        },
        common: { quit: 'Quit', copy: 'Copy', paste: 'Paste', cut: 'Cut', selectAll: 'Select All' },
      },
    };
  }
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Translate a key. Supports dot notation (e.g. 'electron.menu.about').
 * Supports simple {n} parameter substitution.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let val: unknown = messages[currentLocale];
  for (const k of keys) {
    if (val && typeof val === 'object') {
      val = (val as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }
  if (typeof val !== 'string') return key;
  if (params) {
    return val.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
  }
  return val;
}
