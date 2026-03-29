import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';

export const sharedMessages = {
  'zh-TW': zhTW,
  en: en,
} as const;

export type SupportedLocale = 'zh-TW' | 'en';

export const supportedLocales: SupportedLocale[] = ['zh-TW', 'en'];

export const localeNames: Record<SupportedLocale, string> = {
  'zh-TW': '繁體中文',
  en: 'English',
};

/**
 * Detect user's preferred locale from browser settings.
 * Falls back to 'zh-TW' if no match found.
 */
export function detectLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return 'zh-TW';
  const lang = navigator.language;
  if (lang.startsWith('zh')) return 'zh-TW';
  return 'en';
}

/**
 * Get stored locale from localStorage.
 * Returns null if not set.
 */
export function getStoredLocale(): SupportedLocale | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem('locale');
  if (stored === 'zh-TW' || stored === 'en') return stored;
  return null;
}

/**
 * Store locale to localStorage.
 */
export function storeLocale(locale: SupportedLocale): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('locale', locale);
}
