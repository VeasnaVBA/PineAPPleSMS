import { en } from './en.js';
import { km } from './km.js';

const translations = { en, km };

class I18nManager {
  constructor() {
    const savedLocale = (typeof localStorage !== 'undefined' ? localStorage.getItem('school_lang') : null) || 'km';
    this.currentLocale = translations[savedLocale] ? savedLocale : 'km';
    this.listeners = new Set();
  }

  init() {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.currentLocale;
      if (this.currentLocale === 'km') {
        document.body?.classList.add('font-khmer');
      } else {
        document.body?.classList.remove('font-khmer');
      }
    }
  }

  getLocale() {
    return this.currentLocale;
  }

  setLocale(locale) {
    if (!translations[locale] || this.currentLocale === locale) return;
    this.currentLocale = locale;
    localStorage.setItem('school_lang', locale);
    document.documentElement.lang = locale;

    if (locale === 'km') {
      document.body.classList.add('font-khmer');
    } else {
      document.body.classList.remove('font-khmer');
    }

    this.notify();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const callback of this.listeners) {
      try {
        callback(this.currentLocale);
      } catch (err) {
        console.error('Error in i18n subscriber:', err);
      }
    }
  }

  /**
   * Translate key, e.g. t('nav.students')
   */
  t(key, params = {}) {
    const keys = key.split('.');
    let val = translations[this.currentLocale];

    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        // Fallback to English
        let fallback = translations['en'];
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in fallback) {
            fallback = fallback[fk];
          } else {
            return key; // return key if not found
          }
        }
        val = fallback;
        break;
      }
    }

    if (typeof val === 'string' && Object.keys(params).length > 0) {
      return val.replace(/\{(\w+)\}/g, (_, match) => params[match] ?? `{${match}}`);
    }

    return typeof val === 'string' ? val : key;
  }
}

export const i18n = new I18nManager();
export const t = (key, params) => i18n.t(key, params);
