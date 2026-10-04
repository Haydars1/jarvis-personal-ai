import { translations } from './translations';

export type Language = 'de' | 'tr' | 'en';
export const SUPPORTED_LANGUAGES: readonly Language[] = ['de', 'tr', 'en'];
export const LANGUAGE_STORAGE_KEY = '6006_language';
export const LANGUAGE_MANUAL_OVERRIDE_KEY = '6006_language_manual';

export function normalizeLanguage(value: unknown): Language {
  const code = String(value ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code) ? code as Language : 'de';
}

export function loadLanguage(storage: Pick<Storage, 'getItem'> | null | undefined, navigatorLanguage = 'de'): Language {
  const stored = storage?.getItem?.(LANGUAGE_STORAGE_KEY);
  const hasManualOverride = storage?.getItem?.(LANGUAGE_MANUAL_OVERRIDE_KEY) === '1';
  return hasManualOverride && stored ? normalizeLanguage(stored) : normalizeLanguage(navigatorLanguage);
}

export function saveLanguage(storage: Pick<Storage, 'setItem'> | null | undefined, language: unknown): Language {
  const normalized = normalizeLanguage(language);
  storage?.setItem?.(LANGUAGE_STORAGE_KEY, normalized);
  storage?.setItem?.(LANGUAGE_MANUAL_OVERRIDE_KEY, '1');
  return normalized;
}

export function t(language: unknown, key: string, params: Record<string, string | number> = {}): string {
  const lang = normalizeLanguage(language);
  const template = translations[lang]?.[key] ?? translations.de[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
