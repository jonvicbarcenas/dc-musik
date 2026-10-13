import en from '../../locales/en.json' with { type: 'json' };
import tl from '../../locales/tl.json' with { type: 'json' };

export type TranslationKey = keyof typeof en;
export type Language = 'en' | 'tl';
const translations: Record<Language, Record<TranslationKey, string>> = { en, tl };

/** Missing languages fall back to English. User/provider text is never used as a lookup key. */
export function translate(
  language: Language,
  key: TranslationKey,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return translations[language][key].replace(/\{([a-z]+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
