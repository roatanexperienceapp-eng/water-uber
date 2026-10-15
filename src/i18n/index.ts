import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import zh from './locales/zh.json';
import type { LangCode } from '@/types';

export const LANGUAGES: { code: LangCode; label: string; short: string; locale: string }[] = [
  { code: 'en', label: 'English', short: 'EN', locale: 'en-US' },
  { code: 'es', label: 'Español', short: 'ES', locale: 'es-HN' },
  { code: 'fr', label: 'Français', short: 'FR', locale: 'fr-FR' },
  { code: 'de', label: 'Deutsch', short: 'DE', locale: 'de-DE' },
  { code: 'pt', label: 'Português', short: 'PT', locale: 'pt-BR' },
  { code: 'it', label: 'Italiano', short: 'IT', locale: 'it-IT' },
  { code: 'zh', label: '中文', short: '中文', locale: 'zh-CN' },
];

const deviceLang = getLocales()[0]?.languageCode ?? 'en';
const initial = (LANGUAGES.find((l) => l.code === deviceLang)?.code ?? 'en') as LangCode;

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    pt: { translation: pt },
    it: { translation: it },
    zh: { translation: zh },
  },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function localeFor(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.locale ?? 'en-US';
}

export default i18n;
