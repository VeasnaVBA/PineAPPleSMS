/**
 * Theme Service: handles Light & Dark modes and Dynamic Main Button Colors
 * Supports persistence in localStorage, automatic contrast calculation for button readability,
 * and live updates across the application.
 */

export const PRESET_PRIMARY_COLORS = [
  { id: 'default', name: 'Default Slate', nameKm: 'ខ្មៅ/ប្រផេះដើម', hex: '#18181b' },
  { id: 'blue', name: 'Royal Blue', nameKm: 'ខៀវរាជ', hex: '#2563eb' },
  { id: 'indigo', name: 'Indigo', nameKm: 'ពណ៌អាំងឌីហ្គោ', hex: '#4f46e5' },
  { id: 'emerald', name: 'Emerald Green', nameKm: 'បៃតងត្បូងមរកត', hex: '#059669' },
  { id: 'violet', name: 'Violet / Purple', nameKm: 'ស្វាយព្រះរាជា', hex: '#7c3aed' },
  { id: 'rose', name: 'Rose / Crimson', nameKm: 'ក្រហមផ្កាកុលាប', hex: '#e11d48' },
  { id: 'amber', name: 'Amber / Orange', nameKm: 'ទឹកក្រូចអំពិល', hex: '#d97706' }
];

export function getContrastColor(hex) {
  if (!hex) return '#ffffff';
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? '#0f172a' : '#ffffff';
}

class ThemeService {
  constructor() {
    let saved = 'light';
    let savedPrimary = null;
    try {
      if (typeof localStorage !== 'undefined') {
        saved = localStorage.getItem('school_theme') || 'light';
        savedPrimary = localStorage.getItem('main_btn_color') || localStorage.getItem('school_app_primary_color') || null;
      }
    } catch (_) {}
    if (saved !== 'dark' && saved !== 'light') {
      saved = 'light';
    }
    this.theme = saved;
    this.primaryColor = savedPrimary;
    this.listeners = new Set();
  }

  async init() {
    this.apply();
    this.applyPrimaryColor(this.primaryColor);

    // Read stored theme from database if different from localStorage
    try {
      const { db } = await import('../database/db.js');
      const [savedTheme, savedPrimary] = await Promise.all([
        db.get('settings', 'theme').catch(() => null),
        db.get('settings', 'primaryColor').catch(() => null)
      ]);
      if (savedTheme?.value && (savedTheme.value === 'dark' || savedTheme.value === 'light')) {
        if (this.theme !== savedTheme.value) {
          this.setTheme(savedTheme.value, { skipSync: true });
        }
      }
      if (savedPrimary?.value !== undefined && savedPrimary.value !== null) {
        if (this.primaryColor !== savedPrimary.value) {
          this.setPrimaryColor(savedPrimary.value || null, { skipSync: true });
        }
      }
    } catch (_) {}
  }

  getTheme() {
    return this.theme;
  }

  isDark() {
    return this.theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  }

  setTheme(theme, options = {}) {
    const cleanTheme = theme === 'dark' ? 'dark' : 'light';
    this.theme = cleanTheme;
    try {
      localStorage.setItem('school_theme', cleanTheme);
    } catch (_) {}
    this.apply();
    this.applyPrimaryColor(this.primaryColor);
    this.notify();

    // Persist to IndexedDB and sync to Google Drive
    if (options.skipSync !== true) {
      this.persistAndSyncTheme(cleanTheme);
    }

    return cleanTheme;
  }

  async persistAndSyncTheme(cleanTheme) {
    try {
      const { db } = await import('../database/db.js');
      await db.put('settings', { key: 'theme', value: cleanTheme });
    } catch (_) {}

    try {
      const { syncStateManager } = await import('./syncStateManager.js');
      syncStateManager.markDirty('theme.change');
      syncStateManager.scheduleAutoSync(500);
    } catch (_) {}

    try {
      const { AdminDataService } = await import('./adminDataService.js');
      AdminDataService.queueAutoSync();
    } catch (_) {}
  }

  toggle() {
    const nextTheme = this.isDark() ? 'light' : 'dark';
    return this.setTheme(nextTheme);
  }

  apply() {
    if (typeof document === 'undefined') return;
    const isDark = this.theme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  getPrimaryColor() {
    return this.primaryColor;
  }

  getEffectivePrimaryColor() {
    if (this.primaryColor) return this.primaryColor;
    return this.isDark() ? '#ffffff' : '#18181b';
  }

  setPrimaryColor(hex, options = {}) {
    if (!hex) {
      return this.resetPrimaryColor(options);
    }
    this.primaryColor = hex;
    try {
      localStorage.setItem('main_btn_color', hex);
      localStorage.setItem('school_app_primary_color', hex);
    } catch (_) {}
    this.applyPrimaryColor(hex);
    this.notify();

    if (options.skipSync !== true) {
      this.persistAndSyncPrimaryColor(hex);
    }

    return hex;
  }

  resetPrimaryColor(options = {}) {
    this.primaryColor = null;
    try {
      localStorage.removeItem('main_btn_color');
      localStorage.removeItem('school_app_primary_color');
    } catch (_) {}
    this.applyPrimaryColor(null);
    this.notify();

    if (options.skipSync !== true) {
      this.persistAndSyncPrimaryColor('');
    }

    return this.getEffectivePrimaryColor();
  }

  async persistAndSyncPrimaryColor(hex) {
    try {
      const { db } = await import('../database/db.js');
      await db.put('settings', { key: 'primaryColor', value: hex || '' });
    } catch (_) {}

    try {
      const { syncStateManager } = await import('./syncStateManager.js');
      syncStateManager.markDirty('theme.primaryColor');
      syncStateManager.scheduleAutoSync(500);
    } catch (_) {}

    try {
      const { AdminDataService } = await import('./adminDataService.js');
      AdminDataService.queueAutoSync();
    } catch (_) {}
  }

  applyPrimaryColor(hex) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (hex) {
      const fgColor = getContrastColor(hex);
      root.style.setProperty('--primary', hex);
      root.style.setProperty('--primary-foreground', fgColor);
      root.style.setProperty('--ring', hex);
      root.style.setProperty('--main-btn-color', hex);
      root.style.setProperty('--main-btn-foreground', fgColor);
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-foreground');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--main-btn-color');
      root.style.removeProperty('--main-btn-foreground');
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      try {
        cb({
          theme: this.theme,
          primaryColor: this.primaryColor,
          effectivePrimary: this.getEffectivePrimaryColor()
        });
      } catch (err) {
        console.error('Error in theme listener:', err);
      }
    }
  }
}

export const themeService = new ThemeService();
