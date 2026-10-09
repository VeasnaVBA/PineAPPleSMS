/**
 * Font Appearance Service
 * Manages independent typography settings for English and Khmer text.
 * Persists user preferences locally in localStorage and applies CSS custom properties globally.
 */

export const ENGLISH_FONTS = {
  'Inter': {
    name: 'Inter',
    label: 'Inter',
    stack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    preview: 'The quick brown fox jumps over the lazy dog. 0123456789'
  },
  'Roboto': {
    name: 'Roboto',
    label: 'Roboto',
    stack: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    preview: 'The quick brown fox jumps over the lazy dog. 0123456789'
  },
  'Plus Jakarta Sans': {
    name: 'Plus Jakarta Sans',
    label: 'Plus Jakarta Sans',
    stack: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    preview: 'The quick brown fox jumps over the lazy dog. 0123456789'
  }
};

export const KHMER_FONTS = {
  'Kantumruy Pro': {
    name: 'Kantumruy Pro',
    label: 'កន្ទុមរុយ ប្រូ (Kantumruy Pro)',
    stack: "'Kantumruy Pro', 'Khmer OS Siemreap', 'Siemreap', 'Khmer OS', 'Battambang', system-ui, sans-serif",
    preview: 'ប្រព័ន្ធគ្រប់គ្រងសាលារៀន ស្មាតស្គូល ២០២៤–២០២៥ (០១២៣៤៥៦៧៨៩)'
  },
  'Khmer OS Siemreap': {
    name: 'Khmer OS Siemreap',
    label: 'ខ្មែរ អូអេស សៀមរាប (Khmer OS Siemreap)',
    stack: "'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', 'Khmer OS', 'Battambang', system-ui, sans-serif",
    preview: 'ប្រព័ន្ធគ្រប់គ្រងសាលារៀន ស្មាតស្គូល ២០២៤–២០២៥ (០១២៣៤៥៦៧៨៩)'
  },
  'Khmer OS Moul Light': {
    name: "'Khmer OS Muol Light', 'Moul', cursive",
    label: 'យូនីកូដ មូល (Khmer OS Muol Light)',
    stack: "'Khmer OS Muol Light', 'Moul', 'Khmer OS Moul Light', cursive, sans-serif",
    preview: 'ព្រះរាជាណាចក្រកម្ពុជា ជាតិ សាសនា ព្រះមហាក្សត្រ'
  },
  "'Khmer OS Muol Light', 'Moul', cursive": {
    name: "'Khmer OS Muol Light', 'Moul', cursive",
    label: 'យូនីកូដ មូល (Khmer OS Muol Light)',
    stack: "'Khmer OS Muol Light', 'Moul', 'Khmer OS Moul Light', cursive, sans-serif",
    preview: 'ព្រះរាជាណាចក្រកម្ពុជា ជាតិ សាសនា ព្រះមហាក្សត្រ'
  }
};

export const FONT_SIZES = {
  '2xs': {
    id: '2xs',
    size: '10px',
    percent: '62.5%',
    labelEn: 'Micro',
    labelKm: 'តូចបំផុត',
    scale: 0.625
  },
  'xs': {
    id: 'xs',
    size: '12px',
    percent: '75%',
    labelEn: 'Extra Small',
    labelKm: 'តូចខ្លាំង',
    scale: 0.75
  },
  'sm': {
    id: 'sm',
    size: '14px',
    percent: '87.5%',
    labelEn: 'Small',
    labelKm: 'តូច',
    scale: 0.875
  },
  'base': {
    id: 'base',
    size: '16px',
    percent: '100%',
    labelEn: 'Normal',
    labelKm: 'ធម្មតា',
    scale: 1.0
  },
  'lg': {
    id: 'lg',
    size: '18px',
    percent: '112.5%',
    labelEn: 'Large',
    labelKm: 'ធំ',
    scale: 1.125
  },
  'xl': {
    id: 'xl',
    size: '20px',
    percent: '125%',
    labelEn: 'Extra Large',
    labelKm: 'ធំខ្លាំង',
    scale: 1.25
  }
};

class FontService {
  constructor() {
    this.storageKeyEn = 'app_font_en';
    this.storageKeyKm = 'app_font_km';
    this.storageKeySize = 'app_font_size';
    this.listeners = new Set();
  }

  init() {
    this.apply();
  }

  getEnglishFont() {
    const saved = localStorage.getItem(this.storageKeyEn);
    return ENGLISH_FONTS[saved] ? saved : 'Inter';
  }

  getKhmerFont() {
    const saved = localStorage.getItem(this.storageKeyKm);
    if (saved && KHMER_FONTS[saved]) return saved;
    if (saved === 'Khmer OS Moul Light') return "'Khmer OS Muol Light', 'Moul', cursive";
    return 'Kantumruy Pro';
  }

  getFontSize() {
    const saved = localStorage.getItem(this.storageKeySize);
    return FONT_SIZES[saved] ? saved : 'base';
  }

  getEnglishStack(fontName = null) {
    const font = fontName || this.getEnglishFont();
    return ENGLISH_FONTS[font]?.stack || ENGLISH_FONTS['Inter'].stack;
  }

  getKhmerStack(fontName = null) {
    const font = fontName || this.getKhmerFont();
    return KHMER_FONTS[font]?.stack || KHMER_FONTS['Kantumruy Pro'].stack;
  }

  setEnglishFont(fontName) {
    if (!ENGLISH_FONTS[fontName]) return;
    localStorage.setItem(this.storageKeyEn, fontName);
    this.apply();
    this.notify();
  }

  setKhmerFont(fontName) {
    if (!KHMER_FONTS[fontName]) return;
    localStorage.setItem(this.storageKeyKm, fontName);
    this.apply();
    this.notify();
  }

  setFontSize(sizeKey) {
    if (!FONT_SIZES[sizeKey]) return;
    localStorage.setItem(this.storageKeySize, sizeKey);
    this.apply();
    this.notify();
  }

  apply() {
    const en = this.getEnglishFont();
    const km = this.getKhmerFont();
    const fontSizeKey = this.getFontSize();
    const sizeConfig = FONT_SIZES[fontSizeKey] || FONT_SIZES['base'];
    const enStack = this.getEnglishStack(en);
    const kmStack = this.getKhmerStack(km);

    if (typeof document !== 'undefined' && document.documentElement) {
      const root = document.documentElement;
      root.style.setProperty('--font-en', enStack);
      root.style.setProperty('--font-km', kmStack);
      root.style.setProperty('--font-sans', `${enStack}, ${kmStack}`);
      root.style.setProperty('--font-khmer', `${kmStack}, ${enStack}`);
      root.setAttribute('data-font-en', en);
      root.setAttribute('data-font-km', km);

      // Root typographic scaling
      root.setAttribute('data-font-size', fontSizeKey);
      root.style.fontSize = sizeConfig.size;
      root.style.setProperty('--app-font-size', sizeConfig.size);
      root.style.setProperty('--app-font-scale', sizeConfig.scale);
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
          en: this.getEnglishFont(),
          km: this.getKhmerFont(),
          fontSize: this.getFontSize()
        });
      } catch (err) {
        console.error('Error in font service subscriber:', err);
      }
    }
  }
}

export const fontService = new FontService();
