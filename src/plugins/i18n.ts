import { createI18n } from 'vue-i18n';
import { sharedMessages, getStoredLocale, detectLocale } from '../../../packages/i18n-shared/src';
import zhTW from '../locales/zh-TW.json';
import en from '../locales/en.json';

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(
        (result[key] as Record<string, unknown>) || {},
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const messages = {
  'zh-TW': deepMerge(sharedMessages['zh-TW'] as Record<string, unknown>, zhTW),
  en: deepMerge(sharedMessages.en as Record<string, unknown>, en),
};

const locale = getStoredLocale() ?? detectLocale();

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'zh-TW',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: messages as any,
  missingWarn: true,
  fallbackWarn: true,
});
