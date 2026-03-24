import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import ru from '../locales/ru.json'
import zh from '../locales/zh.json'

const saved = localStorage.getItem('lang')
const browser = navigator.language.slice(0, 2)
const fallback = ['en', 'ru', 'zh'].includes(browser) ? browser : 'en'

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru }, zh: { translation: zh } },
  lng: saved ?? fallback,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
