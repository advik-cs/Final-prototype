import { en, TranslationKey } from './locales/en';
import { hi } from './locales/hi';
import { kn } from './locales/kn';
import { ta } from './locales/ta';
import { te } from './locales/te';
import { ml } from './locales/ml';
import { mr } from './locales/mr';
import { bn } from './locales/bn';
import { gu } from './locales/gu';
import { pa } from './locales/pa';
import { or } from './locales/or';
import { as } from './locales/as';

export type SupportedLanguage =
  | 'en'
  | 'hi'
  | 'kn'
  | 'ta'
  | 'te'
  | 'ml'
  | 'mr'
  | 'bn'
  | 'gu'
  | 'pa'
  | 'or'
  | 'as';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', label: 'English — English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', label: 'हिंदी — Hindi' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', label: 'ಕನ್ನಡ — Kannada' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', label: 'தமிழ் — Tamil' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', label: 'తెలుగు — Telugu' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', label: 'മലയാളം — Malayalam' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', label: 'मराठी — Marathi' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', label: 'বাংলা — Bengali' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', label: 'ગુજરાતી — Gujarati' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', label: 'ਪੰਜਾਬੀ — Punjabi' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', label: 'ଓଡ଼ିଆ — Odia' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', label: 'অসমীয়া — Assamese' },
];

export const locales: Record<SupportedLanguage, Partial<Record<TranslationKey, string>>> = {
  en,
  hi,
  kn,
  ta,
  te,
  ml,
  mr,
  bn,
  gu,
  pa,
  or,
  as,
};

export type { TranslationKey };

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export function t(
  lang: SupportedLanguage,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const text = locales[lang]?.[key] ?? locales['en']?.[key] ?? key;
  if (!params) return text;
  return Object.entries(params).reduce(
    (acc, [paramKey, val]) => acc.replace(new RegExp(`{${paramKey}}`, 'g'), String(val)),
    text
  );
}
