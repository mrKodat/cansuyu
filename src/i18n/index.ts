import { createI18n } from 'vue-i18n'
import tr from './locales/tr.json'
import en from './locales/en.json'

export const SupportedLocales = ['tr', 'en'] as const
export type SupportedLocale = (typeof SupportedLocales)[number]
export const DefaultLocale: SupportedLocale = 'tr'

export type MessageSchema = typeof tr

const messages = { tr, en }

function getInitialLocale(): SupportedLocale {
  const stored = localStorage.getItem('locale')
  if (stored && (SupportedLocales as readonly string[]).includes(stored)) {
    return stored as SupportedLocale
  }
  const browserLang = navigator.language.split('-')[0]
  if ((SupportedLocales as readonly string[]).includes(browserLang ?? '')) {
    return browserLang as SupportedLocale
  }
  return DefaultLocale
}

export const i18n = createI18n<[MessageSchema], SupportedLocale>({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages,
})
