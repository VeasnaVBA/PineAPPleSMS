/**
 * Student ID Card Template Component
 * Generates pixel-perfect, print-ready vertical & horizontal Student ID Cards
 * with support for Portrait/Landscape card orientations and Portrait/Landscape A4 sheets.
 */
import { generateBarcodeSVG } from '../utils/barcode.js';
import { getIcon } from './icons.js';
import { formatKhmerLunarDate, formatKhmerSolarDate } from '../utils/khmerLunar.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

export const DEFAULT_FIELD_STYLES = {
  nameKh: { font: 'Kantumruy Pro', size: 8, color: '#0f172a', bold: true },
  nameLatin: { font: 'Inter', size: 7, color: '#1e293b', bold: true },
  className: { font: 'Kantumruy Pro', size: 7.5, color: '#0f172a', bold: true },
  studentId: { font: 'monospace', size: 7.5, color: '#1e40af', bold: true },
  academicYear: { font: 'monospace', size: 7.5, color: '#1e293b', bold: false },
  dob: { font: 'monospace', size: 7.5, color: '#1e293b', bold: false },
  gender: { font: 'Kantumruy Pro', size: 7.5, color: '#1e293b', bold: false },
  fatherName: { font: 'Kantumruy Pro', size: 7.5, color: '#1e293b', bold: false },
  motherName: { font: 'Kantumruy Pro', size: 7.5, color: '#1e293b', bold: false },
  phone: { font: 'monospace', size: 7.5, color: '#1e293b', bold: false }
};

export function getFontFamilyCSS(fontName) {
  switch (fontName) {
    case 'Moul':
      return "'Khmer OS Muol Light', 'Moul', cursive, sans-serif";
    case 'Siemreap':
      return "'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif";
    case 'Inter':
      return "'Inter', sans-serif";
    case 'Roboto':
      return "'Roboto', sans-serif";
    case 'Plus Jakarta Sans':
      return "'Plus Jakarta Sans', sans-serif";
    case 'monospace':
      return "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    case 'Kantumruy Pro':
    default:
      return "'Kantumruy Pro', 'Khmer OS Siemreap', 'Siemreap', sans-serif";
  }
}

export const DEFAULT_CARD_CONFIG = {
  // Orientation & Dimensions
  cardOrientation: 'portrait', // 'portrait' | 'landscape'
  sheetOrientation: 'portrait', // 'portrait' | 'landscape'
  dimensions: 'cr80', // 'cr80', 'medium', 'badge', 'custom'
  widthMm: 54,
  heightMm: 85.6,
  cardsPerSheet: 8, // 4, 6, 8, 10
  gapMm: 4,
  sheetMarginMm: 8, // 0, 5, 8, 12, or custom mm
  showCropMarks: true,

  // Theme & Styling
  accentColor: '#1E40AF', // Royal Blue
  ribbonText: 'STUDENT ID CARD',
  backgroundStyle: 'curves',
  backgroundImage: '', // base64 or URL (1:1 card size fit)
  backgroundOpacity: 100, // 0 - 100%

  // School Branding & Header Text Styling / Transforms
  schoolNameKh: 'ឈ្មោះសាលារៀន',
  schoolNameKhFont: 'Kantumruy Pro',
  schoolNameKhSize: 8,
  schoolNameKhColor: '#0f172a',
  schoolNameKhBold: true,

  schoolNameEn: 'SCHOOL NAME',
  schoolNameEnFont: 'Inter',
  schoolNameEnSize: 6.5,
  schoolNameEnColor: '#64748b',
  schoolNameEnBold: true,

  headerScale: 100, // %
  headerOffsetX: 0, // px
  headerOffsetY: 0, // px

  schoolLogo: './assets/images/school_logo.png', // base64 or URL
  logoScale: 100, // 50 - 200%
  logoOffsetX: 0, // px
  logoOffsetY: 0, // px

  // Student Photo Transforms
  photoScale: 100, // 80 - 200%
  photoOffsetX: 0, // px
  photoOffsetY: 0, // px

  // Signatures, Stamp & Signatory Title
  showSignature: true,
  signatureImage: '', // base64
  signatureScale: 100, // 50 - 200%
  signatureOffsetX: 0, // px
  signatureOffsetY: 0, // px

  showStamp: true,
  stampImage: '', // base64
  stampScale: 100, // 50 - 200%
  stampOffsetX: 0, // px
  stampOffsetY: 0, // px

  showDirectorTitle: true,
  directorTitle: 'នាយកសាលា',
  directorTitleFont: 'Kantumruy Pro',
  directorTitleSize: 6,
  directorTitleColor: '#475569',
  directorTitleBold: true,
  titleScale: 100, // %
  titleOffsetX: 0, // px
  titleOffsetY: 0, // px

  // Khmer Lunar & Solar Date on Card
  showCardDate: false,
  cardDateType: 'lunar_solar', // 'lunar_solar' | 'lunar' | 'solar' | 'custom'
  cardDateValue: '', // ISO YYYY-MM-DD (defaults to current date)
  cardDateLocation: '', // Location prefix for solar date, e.g. 'អនុវិទ្យាល័យព្រៃតូច'
  cardDateCustomLine1: '', // Override for lunar line
  cardDateCustomLine2: '', // Override for solar line
  cardDateFont: 'Siemreap',
  cardDateSize: 4.5,
  cardDateColor: '#334155',
  cardDateBold: false,
  cardDateScale: 100, // %
  cardDateOffsetX: 0, // px
  cardDateOffsetY: 0, // px

  // Student Metadata Fields Transforms
  fieldsScale: 100, // %
  fieldsOffsetX: 0, // px
  fieldsOffsetY: 0, // px

  // Field Display Checklist
  fields: {
    nameKh: true,
    nameLatin: true,
    className: true,
    studentId: true,
    academicYear: true,
    dob: true,
    gender: true,
    fatherName: false,
    motherName: false,
    phone: false
  },

  // Per-field Text Styling: Font, Size, Color, Bold
  fieldStyles: {
    ...DEFAULT_FIELD_STYLES
  }
};

/**
 * Resolves Khmer Lunar & Solar date text lines for card
 * @param {Object} cfg 
 * @returns {{ line1: string, line2: string }}
 */
export function resolveCardDateText(cfg = {}) {
  if (!cfg.showCardDate) return { line1: '', line2: '' };

  const rawDate = cfg.cardDateValue ? new Date(cfg.cardDateValue) : new Date();
  const validDate = isNaN(rawDate.getTime()) ? new Date() : rawDate;

  const defaultLunar = formatKhmerLunarDate(validDate);
  const locationPrefix = cfg.cardDateLocation && cfg.cardDateLocation.trim() ? `${cfg.cardDateLocation.trim()}, ` : '';
  const defaultSolar = `${locationPrefix}${formatKhmerSolarDate(validDate)}`;

  if (cfg.cardDateType === 'custom') {
    return {
      line1: cfg.cardDateCustomLine1 !== undefined ? cfg.cardDateCustomLine1 : defaultLunar,
      line2: cfg.cardDateCustomLine2 !== undefined ? cfg.cardDateCustomLine2 : defaultSolar
    };
  }

  if (cfg.cardDateType === 'lunar') {
    return {
      line1: cfg.cardDateCustomLine1 !== undefined && cfg.cardDateCustomLine1 !== '' ? cfg.cardDateCustomLine1 : defaultLunar,
      line2: ''
    };
  }

  if (cfg.cardDateType === 'solar') {
    return {
      line1: cfg.cardDateCustomLine2 !== undefined && cfg.cardDateCustomLine2 !== '' ? cfg.cardDateCustomLine2 : defaultSolar,
      line2: ''
    };
  }

  // 'lunar_solar' (default)
  return {
    line1: cfg.cardDateCustomLine1 !== undefined && cfg.cardDateCustomLine1 !== '' ? cfg.cardDateCustomLine1 : defaultLunar,
    line2: cfg.cardDateCustomLine2 !== undefined && cfg.cardDateCustomLine2 !== '' ? cfg.cardDateCustomLine2 : defaultSolar
  };
}

/**
 * Dimension presets map in millimeters for Portrait & Landscape
 */
export const DIMENSION_PRESETS = {
  portrait: {
    cr80: { name: 'CR80 Standard (54 × 85.6 mm)', widthMm: 54, heightMm: 85.6 },
    medium: { name: 'Medium ID Badge (60 × 90 mm)', widthMm: 60, heightMm: 90 },
    badge: { name: 'Large Event Badge (65 × 95 mm)', widthMm: 65, heightMm: 95 }
  },
  landscape: {
    cr80: { name: 'CR80 Standard (85.6 × 54 mm)', widthMm: 85.6, heightMm: 54 },
    medium: { name: 'Medium ID Badge (90 × 60 mm)', widthMm: 90, heightMm: 60 },
    badge: { name: 'Large Event Badge (95 × 65 mm)', widthMm: 95, heightMm: 65 }
  }
};

/**
 * Preset Color Themes
 */
export const THEME_COLOR_PRESETS = [
  { name: 'Royal Blue', hex: '#1E40AF' },
  { name: 'Deep Emerald', hex: '#047857' },
  { name: 'Crimson Maroon', hex: '#991B1B' },
  { name: 'Dark Slate', hex: '#1E293B' },
  { name: 'Classic Indigo', hex: '#4338CA' },
  { name: 'Royal Purple', hex: '#6D28D9' },
  { name: 'Teal Cyan', hex: '#0F766E' },
  { name: 'Warm Amber', hex: '#B45309' }
];

/**
 * Renders a single standalone ID card HTML in Portrait or Landscape orientation
 * @param {Object} student 
 * @param {Object} config 
 * @param {Map} classMap 
 * @returns {string} HTML string
 */
export function renderIDCardHtml(student = {}, config = DEFAULT_CARD_CONFIG, classMap = new Map()) {
  const cfg = { ...DEFAULT_CARD_CONFIG, ...config, fields: { ...DEFAULT_CARD_CONFIG.fields, ...(config?.fields || {}) } };
  const isLandscape = cfg.cardOrientation === 'landscape';
  const accent = cfg.accentColor || '#1E40AF';
  const widthMm = cfg.widthMm || (isLandscape ? 85.6 : 54);
  const heightMm = cfg.heightMm || (isLandscape ? 54 : 85.6);

  // Resolve Student Info
  const studentId = student.studentId || 'STU-000';
  const lastNameKh = student.lastNameKh || '';
  const firstNameKh = student.firstNameKh || '';
  const fullNameKh = `${lastNameKh} ${firstNameKh}`.trim() || student.khmerName || '—';
  
  const lastNameLatin = student.lastNameLatin || '';
  const firstNameLatin = student.firstNameLatin || '';
  const fullNameLatin = `${lastNameLatin} ${firstNameLatin}`.trim() || student.englishName || '';

  const className = classMap.get(student.classId) || student.className || student.classId || '—';
  const academicYear = student.academicYear || '2024–2025';
  const dob = formatDisplayDate(student.dateOfBirth) || '';
  const gender = student.gender === 'Female' || student.gender === 'ស្រី' ? 'ស្រី' : 'ប្រុស';
  const fatherName = student.fatherName || '';
  const motherName = student.motherName || '';
  const phone = student.studentPhone || student.phone || student.fatherPhone || '';

  // Photo resolution
  const photoUrl = student.photoBlob 
    ? (typeof student.photoBlob === 'string' ? student.photoBlob : URL.createObjectURL(student.photoBlob)) 
    : (student.photo && student.photo !== '(Photo attached)' ? student.photo : null);
  
  const initial = firstNameLatin ? firstNameLatin.charAt(0).toUpperCase() : (firstNameKh ? firstNameKh.charAt(0) : 'S');

  // CSS Transforms for Move and Zoom
  const headerTransform = `transform: translate(${cfg.headerOffsetX || 0}px, ${cfg.headerOffsetY || 0}px) scale(${(cfg.headerScale || 100) / 100}); transform-origin: center top;`;
  const logoTransform = `transform: translate(${cfg.logoOffsetX || 0}px, ${cfg.logoOffsetY || 0}px) scale(${(cfg.logoScale || 100) / 100}); transform-origin: center center;`;
  const photoTransform = `transform: translate(${cfg.photoOffsetX || 0}px, ${cfg.photoOffsetY || 0}px) scale(${(cfg.photoScale || 100) / 100}); transform-origin: center center;`;
  const fieldsTransform = `transform: translate(${cfg.fieldsOffsetX || 0}px, ${cfg.fieldsOffsetY || 0}px) scale(${(cfg.fieldsScale || 100) / 100}); transform-origin: center center;`;
  const signatureTransform = `transform: translate(${cfg.signatureOffsetX || 0}px, ${cfg.signatureOffsetY || 0}px) scale(${(cfg.signatureScale || 100) / 100}); transform-origin: center bottom;`;
  const stampTransform = `transform: translate(${cfg.stampOffsetX || 0}px, ${cfg.stampOffsetY || 0}px) scale(${(cfg.stampScale || 100) / 100}); transform-origin: center center;`;
  const titleTransform = `transform: translate(${cfg.titleOffsetX || 0}px, ${cfg.titleOffsetY || 0}px) scale(${(cfg.titleScale || 100) / 100}); transform-origin: center center;`;

  // Signatory Title Style
  const titleStyle = `font-family: ${getFontFamilyCSS(cfg.directorTitleFont || 'Kantumruy Pro')}; font-size: ${cfg.directorTitleSize !== undefined ? cfg.directorTitleSize : 6}px; color: ${cfg.directorTitleColor || '#475569'}; font-weight: ${cfg.directorTitleBold !== false ? '700' : '500'}; line-height: 1.5; padding-top: 1px;`;

  // Khmer Date Style & Transforms
  const dateTransform = `transform: translate(${cfg.cardDateOffsetX || 0}px, ${cfg.cardDateOffsetY || 0}px) scale(${(cfg.cardDateScale || 100) / 100}); transform-origin: center bottom;`;
  const dateStyle = `font-family: ${getFontFamilyCSS(cfg.cardDateFont || 'Siemreap')}; font-size: ${cfg.cardDateSize !== undefined ? cfg.cardDateSize : (isLandscape ? 4 : 4.5)}px; color: ${cfg.cardDateColor || '#334155'}; font-weight: ${cfg.cardDateBold ? '700' : '500'}; line-height: 1.65; padding-top: 1.5px; padding-bottom: 0.5px;`;

  const { line1: dateLine1, line2: dateLine2 } = resolveCardDateText(cfg);
  const cardDateHtml = (cfg.showCardDate && (dateLine1 || dateLine2)) ? `
    <div class="card-date-block draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none z-20 text-center w-full px-0.5 py-0.5 mb-0.5 overflow-visible pointer-events-auto"
         data-asset-type="cardDate"
         style="${dateTransform}">
      ${dateLine1 ? `<div class="font-khmer whitespace-nowrap text-center overflow-visible" style="${dateStyle}">${dateLine1}</div>` : ''}
      ${dateLine2 ? `<div class="font-khmer whitespace-nowrap text-center overflow-visible" style="${dateStyle}">${dateLine2}</div>` : ''}
    </div>
  ` : '';

  // School Name styles
  const schoolKhStyle = `font-family: ${getFontFamilyCSS(cfg.schoolNameKhFont || 'Kantumruy Pro')}; font-size: ${cfg.schoolNameKhSize !== undefined ? cfg.schoolNameKhSize : (isLandscape ? 7.5 : 8)}px; color: ${cfg.schoolNameKhColor || '#0f172a'}; font-weight: ${cfg.schoolNameKhBold !== false ? '700' : '500'}; line-height: 1.15;`;
  const schoolEnStyle = `font-family: ${getFontFamilyCSS(cfg.schoolNameEnFont || 'Inter')}; font-size: ${cfg.schoolNameEnSize !== undefined ? cfg.schoolNameEnSize : (isLandscape ? 6 : 6.5)}px; color: ${cfg.schoolNameEnColor || '#64748b'}; font-weight: ${cfg.schoolNameEnBold !== false ? '700' : '500'}; line-height: 1.15;`;

  // School Logo
  const schoolLogoHtml = cfg.schoolLogo ? `
    <img src="${cfg.schoolLogo}" alt="Logo" class="${isLandscape ? 'w-5 h-5 max-h-5' : 'w-6 h-6 max-h-6'} object-contain mb-0.5 filter drop-shadow-2xs transition-transform duration-75 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none" data-asset-type="logo" style="${logoTransform}" />
  ` : `
    <div class="${isLandscape ? 'w-5 h-5' : 'w-6 h-6'} rounded-full mb-0.5 flex items-center justify-center text-white shadow-2xs shrink-0 transition-transform duration-75 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 select-none" data-asset-type="logo" style="background: ${accent}; ${logoTransform}">
      <svg class="${isLandscape ? 'w-3 h-3' : 'w-3.5 h-3.5'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
    </div>
  `;

  // Dynamic field style resolver
  const getFieldValStyle = (key, defaultFont = 'Kantumruy Pro', defaultSize = 7.5, defaultColor = '#0f172a', defaultBold = false) => {
    const s = cfg.fieldStyles?.[key] || {};
    const font = s.font || defaultFont;
    const size = s.size !== undefined ? s.size : defaultSize;
    const color = s.color || defaultColor;
    const bold = s.bold !== undefined ? s.bold : defaultBold;
    return `font-family: ${getFontFamilyCSS(font)}; font-size: ${size}px; color: ${color}; font-weight: ${bold ? '700' : '500'}; line-height: 1.2;`;
  };

  // LANDSCAPE CARD LAYOUT
  if (isLandscape) {
    return `
      <div class="id-card-item id-card-landscape relative overflow-hidden bg-white text-slate-800 select-none box-border flex font-sans border border-slate-300 shadow-sm print:border-slate-400 print:shadow-none"
           style="width: ${widthMm}mm; height: ${heightMm}mm; max-width: ${widthMm}mm; max-height: ${heightMm}mm; --card-accent: ${accent};">

        ${cfg.backgroundImage ? `
          <!-- Custom Card Background Image -->
          <img src="${cfg.backgroundImage}" alt="Card Background" class="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 select-none" style="opacity: ${(cfg.backgroundOpacity !== undefined ? cfg.backgroundOpacity : 100) / 100};" />
        ` : ''}

        <!-- Main Card Body (Landscape) -->
        <div class="card-body-content relative z-10 mx-2 my-1 flex flex-col justify-between flex-1 h-full min-w-0">
          
          <!-- Top Header: Logo & School Names (Horizontal Bar) -->
          <div class="flex items-center gap-1.5 border-b border-slate-200/80 pb-0.5 w-full shrink-0 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none z-20"
               data-asset-type="header"
               style="${headerTransform}">
            <div class="shrink-0 flex items-center justify-center overflow-visible">${schoolLogoHtml}</div>
            <div class="flex-1 min-w-0">
              <h4 class="uppercase tracking-tight truncate" style="${schoolKhStyle}">
                ${cfg.schoolNameKh || 'ឈ្មោះសាលារៀន'}
              </h4>
              ${cfg.schoolNameEn ? `
                <p class="uppercase tracking-tighter truncate mt-0.5" style="${schoolEnStyle}">
                  ${cfg.schoolNameEn}
                </p>
              ` : ''}
            </div>
            <!-- School Mini Badge / Status -->
            <span class="text-[6px] font-bold px-1 py-0.2 rounded text-white shrink-0 font-khmer" style="background: ${accent};">
              សិស្ស
            </span>
          </div>

          <!-- Middle Split: Photo (Left) + Metadata (Center) + Signature/Barcode (Right) -->
          <div class="flex items-center justify-between gap-1.5 flex-1 my-0.5 min-h-0">
            
            <!-- Student Photo Box (Whole framed container moves & zooms) -->
            <div class="relative shrink-0 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 select-none z-20"
                 data-asset-type="photo"
                 style="${photoTransform}">
              <div class="w-13 h-16 sm:w-14 sm:h-[68px] rounded-sm overflow-hidden bg-slate-100 flex items-center justify-center shadow-2xs border"
                   style="border-color: ${accent};">
                ${photoUrl ? `
                  <img src="${photoUrl}" alt="${fullNameLatin || fullNameKh}" class="w-full h-full object-cover pointer-events-none select-none" />
                ` : `
                  <div class="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 font-bold text-sm">
                    <span style="color: ${accent};">${initial}</span>
                  </div>
                `}
              </div>
            </div>

            <!-- Metadata Key-Value Field List -->
            <div class="flex-1 min-w-0 text-[7px] leading-tight space-y-0.5 text-slate-700 font-medium px-0.5 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none z-20"
                 data-asset-type="fields"
                 style="${fieldsTransform}">
              ${cfg.fields.nameKh ? `
                <div class="grid grid-cols-[38%_62%] items-baseline">
                  <span class="text-slate-500 font-semibold font-khmer">ឈ្មោះ</span>
                  <span class="truncate" style="${getFieldValStyle('nameKh', 'Kantumruy Pro', 7.5, '#0f172a', true)}">: ${fullNameKh}</span>
                </div>
              ` : ''}

              ${cfg.fields.nameLatin && fullNameLatin ? `
                <div class="grid grid-cols-[38%_62%] items-baseline">
                  <span class="text-slate-500 font-semibold font-khmer text-[6px]">ឈ្មោះឡាតាំង</span>
                  <span class="uppercase tracking-tight truncate" style="${getFieldValStyle('nameLatin', 'Inter', 6.5, '#1e293b', true)}">: ${fullNameLatin}</span>
                </div>
              ` : ''}

              ${cfg.fields.className ? `
                <div class="grid grid-cols-[38%_62%] items-baseline">
                  <span class="text-slate-500 font-semibold font-khmer">ថ្នាក់</span>
                  <span class="truncate" style="${getFieldValStyle('className', 'Kantumruy Pro', 7.5, '#0f172a', true)}">: ${className}</span>
                </div>
              ` : ''}

              ${cfg.fields.studentId ? `
                <div class="grid grid-cols-[38%_62%] items-baseline">
                  <span class="text-slate-500 font-semibold font-khmer">អត្តលេខ</span>
                  <span class="truncate" style="${getFieldValStyle('studentId', 'monospace', 7.5, accent, true)}">: ${studentId}</span>
                </div>
              ` : ''}

              ${cfg.fields.academicYear ? `
                <div class="grid grid-cols-[38%_62%] items-baseline">
                  <span class="text-slate-500 font-semibold font-khmer">ឆ្នាំសិក្សា</span>
                  <span class="truncate" style="${getFieldValStyle('academicYear', 'monospace', 7, '#1e293b', false)}">: ${academicYear}</span>
                </div>
              ` : ''}

              ${cfg.fields.dob && dob ? `
                <div class="grid grid-cols-[38%_62%] items-baseline">
                  <span class="text-slate-500 font-semibold font-khmer">ថ្ងៃកំណើត</span>
                  <span class="truncate" style="${getFieldValStyle('dob', 'monospace', 7, '#1e293b', false)}">: ${dob}</span>
                </div>
              ` : ''}

              ${cfg.fields.gender ? `
                <div class="grid grid-cols-[38%_62%] items-baseline">
                  <span class="text-slate-500 font-semibold font-khmer">ភេទ</span>
                  <span class="truncate" style="${getFieldValStyle('gender', 'Kantumruy Pro', 7, '#1e293b', false)}">: ${gender}</span>
                </div>
              ` : ''}

              ${cfg.fields.fatherName && fatherName ? `
                <div class="grid grid-cols-[38%_62%] items-baseline">
                  <span class="text-slate-500 font-semibold font-khmer">ឪពុក</span>
                  <span class="truncate" style="${getFieldValStyle('fatherName', 'Kantumruy Pro', 7.5, '#1e293b', false)}">: ${fatherName}</span>
                </div>
              ` : ''}

              ${cfg.fields.motherName && motherName ? `
                <div class="grid grid-cols-[38%_62%] items-baseline">
                  <span class="text-slate-500 font-semibold font-khmer">ម្តាយ</span>
                  <span class="truncate" style="${getFieldValStyle('motherName', 'Kantumruy Pro', 7.5, '#1e293b', false)}">: ${motherName}</span>
                </div>
              ` : ''}

              ${cfg.fields.phone && phone ? `
                <div class="grid grid-cols-[38%_62%] items-baseline">
                  <span class="text-slate-500 font-semibold font-khmer">ទូរសព្ទ</span>
                  <span class="truncate" style="${getFieldValStyle('phone', 'monospace', 7.5, '#1e293b', false)}">: ${phone}</span>
                </div>
              ` : ''}
            </div>

            <!-- Right Column: Date, Stamp & Signature Section -->
            ${cfg.showCardDate || cfg.showSignature || cfg.showStamp || (cfg.showDirectorTitle !== false && cfg.directorTitle) ? `
              <div class="w-22 shrink-0 flex flex-col items-center justify-between h-full py-0.5 border-l border-slate-100 pl-1 relative overflow-visible">
                ${cardDateHtml}
                ${cfg.showStamp && cfg.stampImage ? `
                  <div class="w-full flex justify-center items-center overflow-visible">
                    <img src="${cfg.stampImage}" alt="Stamp" class="w-6 h-6 object-contain opacity-85 -mb-1 transition-transform duration-75 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none" data-asset-type="stamp" style="${stampTransform}" />
                  </div>
                ` : '<div class="h-2"></div>'}

                <div class="text-center w-full flex flex-col items-center overflow-visible">
                  ${cfg.showSignature && cfg.signatureImage ? `
                    <div class="w-full flex justify-center items-center overflow-visible">
                      <img src="${cfg.signatureImage}" alt="Signature" class="h-3.5 max-h-3.5 object-contain mx-auto -mb-0.5 transition-transform duration-75 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none" data-asset-type="signature" style="${signatureTransform}" />
                    </div>
                  ` : ''}
                  ${cfg.showDirectorTitle !== false && cfg.directorTitle ? `
                    <div class="draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none z-20 text-center w-full px-0.5 overflow-visible"
                         data-asset-type="title"
                         style="${titleTransform}">
                      <span class="block overflow-visible whitespace-nowrap font-khmer text-center" style="${titleStyle}">
                        ${cfg.directorTitle}
                      </span>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}

          </div>

        </div>
      </div>
    `;
  }

  // PORTRAIT CARD LAYOUT (Default)
  return `
    <div class="id-card-item id-card-portrait relative overflow-hidden bg-white text-slate-800 select-none box-border flex flex-col justify-between font-sans border border-slate-300 shadow-sm print:border-slate-400 print:shadow-none"
         style="width: ${widthMm}mm; height: ${heightMm}mm; max-width: ${widthMm}mm; max-height: ${heightMm}mm; --card-accent: ${accent};">
      
      <!-- Background: Custom Image -->
      ${cfg.backgroundImage ? `
        <!-- Custom Card Background Image -->
        <img src="${cfg.backgroundImage}" alt="Card Background" class="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 select-none" style="opacity: ${(cfg.backgroundOpacity !== undefined ? cfg.backgroundOpacity : 100) / 100};" />
      ` : ''}

      <!-- Main Card Body Area -->
      <div class="card-body-content relative z-10 mx-2 my-1.5 flex flex-col items-center justify-between flex-1 h-full min-w-0">
        
        <!-- Header: School Logo & Name -->
        <div class="card-header-bar text-center w-full px-0.5 shrink-0 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none z-20"
             data-asset-type="header"
             style="${headerTransform}">
          <div class="flex justify-center overflow-visible">${schoolLogoHtml}</div>
          <h4 class="uppercase tracking-tight line-clamp-1 truncate" style="${schoolKhStyle}">
            ${cfg.schoolNameKh || 'ឈ្មោះសាលារៀន'}
          </h4>
          ${cfg.schoolNameEn ? `
            <p class="uppercase tracking-tighter truncate mt-0.5" style="${schoolEnStyle}">
              ${cfg.schoolNameEn}
            </p>
          ` : ''}
        </div>

        <!-- Student Photo Box with Accent Border Frame (Whole framed container moves & zooms) -->
        <div class="relative my-1 shrink-0 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 select-none z-20"
             data-asset-type="photo"
             style="${photoTransform}">
          <div class="w-14 h-16 sm:w-16 sm:h-[72px] rounded-sm overflow-hidden bg-slate-100 flex items-center justify-center shadow-xs border-2"
               style="border-color: ${accent};">
            ${photoUrl ? `
              <img src="${photoUrl}" alt="${fullNameLatin || fullNameKh}" class="w-full h-full object-cover pointer-events-none select-none" />
            ` : `
              <div class="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 font-bold text-base">
                <span style="color: ${accent};">${initial}</span>
              </div>
            `}
          </div>
        </div>

        <!-- Metadata Key-Value Field List -->
        <div class="w-full text-[7.5px] leading-tight space-y-0.5 text-slate-700 font-medium my-0.5 px-0.5 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none z-20"
             data-asset-type="fields"
             style="${fieldsTransform}">
          ${cfg.fields.nameKh ? `
            <div class="grid grid-cols-[36%_64%] items-baseline">
              <span class="text-slate-500 font-semibold font-khmer">ឈ្មោះ</span>
              <span class="truncate" style="${getFieldValStyle('nameKh', 'Kantumruy Pro', 8, '#0f172a', true)}">: ${fullNameKh}</span>
            </div>
          ` : ''}

          ${cfg.fields.nameLatin && fullNameLatin ? `
            <div class="grid grid-cols-[36%_64%] items-baseline">
              <span class="text-slate-500 font-semibold font-khmer text-[6.5px]">ឈ្មោះឡាតាំង</span>
              <span class="uppercase tracking-tight truncate" style="${getFieldValStyle('nameLatin', 'Inter', 7, '#1e293b', true)}">: ${fullNameLatin}</span>
            </div>
          ` : ''}

          ${cfg.fields.className ? `
            <div class="grid grid-cols-[36%_64%] items-baseline">
              <span class="text-slate-500 font-semibold font-khmer">ថ្នាក់</span>
              <span class="truncate" style="${getFieldValStyle('className', 'Kantumruy Pro', 7.5, '#0f172a', true)}">: ${className}</span>
            </div>
          ` : ''}

          ${cfg.fields.studentId ? `
            <div class="grid grid-cols-[36%_64%] items-baseline">
              <span class="text-slate-500 font-semibold font-khmer">អត្តលេខ</span>
              <span class="truncate" style="${getFieldValStyle('studentId', 'monospace', 7.5, accent, true)}">: ${studentId}</span>
            </div>
          ` : ''}

          ${cfg.fields.academicYear ? `
            <div class="grid grid-cols-[36%_64%] items-baseline">
              <span class="text-slate-500 font-semibold font-khmer">ឆ្នាំសិក្សា</span>
              <span class="truncate" style="${getFieldValStyle('academicYear', 'monospace', 7.5, '#1e293b', false)}">: ${academicYear}</span>
            </div>
          ` : ''}

          ${cfg.fields.dob && dob ? `
            <div class="grid grid-cols-[36%_64%] items-baseline">
              <span class="text-slate-500 font-semibold font-khmer">ថ្ងៃកំណើត</span>
              <span class="truncate" style="${getFieldValStyle('dob', 'monospace', 7.5, '#1e293b', false)}">: ${dob}</span>
            </div>
          ` : ''}

          ${cfg.fields.gender ? `
            <div class="grid grid-cols-[36%_64%] items-baseline">
              <span class="text-slate-500 font-semibold font-khmer">ភេទ</span>
              <span class="truncate" style="${getFieldValStyle('gender', 'Kantumruy Pro', 7.5, '#1e293b', false)}">: ${gender}</span>
            </div>
          ` : ''}

          ${cfg.fields.fatherName && fatherName ? `
            <div class="grid grid-cols-[36%_64%] items-baseline">
              <span class="text-slate-500 font-semibold font-khmer">ឪពុក</span>
              <span class="truncate" style="${getFieldValStyle('fatherName', 'Kantumruy Pro', 7.5, '#1e293b', false)}">: ${fatherName}</span>
            </div>
          ` : ''}

          ${cfg.fields.motherName && motherName ? `
            <div class="grid grid-cols-[36%_64%] items-baseline">
              <span class="text-slate-500 font-semibold font-khmer">ម្តាយ</span>
              <span class="truncate" style="${getFieldValStyle('motherName', 'Kantumruy Pro', 7.5, '#1e293b', false)}">: ${motherName}</span>
            </div>
          ` : ''}

          ${cfg.fields.phone && phone ? `
            <div class="grid grid-cols-[36%_64%] items-baseline">
              <span class="text-slate-500 font-semibold font-khmer">ទូរសព្ទ</span>
              <span class="truncate" style="${getFieldValStyle('phone', 'monospace', 7.5, '#1e293b', false)}">: ${phone}</span>
            </div>
          ` : ''}
        </div>

        <!-- Footer: Date, Signature, Stamp, and Signatory Title -->
        <div class="w-full mt-auto pt-0.5 flex flex-col items-center shrink-0 overflow-visible">
          ${cardDateHtml}
          ${cfg.showSignature || cfg.showStamp || (cfg.showDirectorTitle !== false && cfg.directorTitle) ? `
            <div class="w-full flex items-end justify-between px-1 mb-0.5 relative min-h-[22px] overflow-visible">
              <div class="relative flex items-center justify-start overflow-visible">
                ${cfg.showStamp && cfg.stampImage ? `
                  <img src="${cfg.stampImage}" alt="Stamp" class="w-7 h-7 object-contain opacity-85 -mb-1 transition-transform duration-75 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none" data-asset-type="stamp" style="${stampTransform}" />
                ` : ''}
              </div>

              <div class="text-center flex flex-col items-center overflow-visible">
                ${cfg.showSignature && cfg.signatureImage ? `
                  <img src="${cfg.signatureImage}" alt="Signature" class="h-4 max-h-4 object-contain mx-auto -mb-0.5 transition-transform duration-75 draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none" data-asset-type="signature" style="${signatureTransform}" />
                ` : ''}
                ${cfg.showDirectorTitle !== false && cfg.directorTitle ? `
                  <div class="draggable-card-asset cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 rounded select-none z-20 text-center px-0.5 overflow-visible"
                       data-asset-type="title"
                       style="${titleTransform}">
                    <span class="block overflow-visible whitespace-nowrap font-khmer text-center" style="${titleStyle}">
                      ${cfg.directorTitle}
                    </span>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>

      </div>
    </div>
  `;
}

/**
 * Split an array of students into chunks for pagination
 */
export function chunkStudentsForPages(students = [], perPage = 8) {
  const count = Number(perPage) || 8;
  const chunks = [];
  for (let i = 0; i < students.length; i += count) {
    chunks.push(students.slice(i, i + count));
  }
  return chunks.length > 0 ? chunks : [[]];
}

/**
 * Calculates CSS grid classes and styles for A4 sheet based on cardsPerSheet and orientations
 */
export function getSheetGridLayout(cardsPerSheet = 8, cardOrientation = 'portrait', sheetOrientation = 'portrait') {
  const count = Number(cardsPerSheet);
  const isCardLandscape = cardOrientation === 'landscape';
  const isSheetLandscape = sheetOrientation === 'landscape';

  if (isSheetLandscape) {
    // A4 Landscape: 297mm width, 210mm height
    switch (count) {
      case 4:
        return { cols: 2, rows: 2, gridClass: 'grid-cols-2 grid-rows-2' };
      case 6:
        return { cols: 3, rows: 2, gridClass: 'grid-cols-3 grid-rows-2' };
      case 8:
        return { cols: 4, rows: 2, gridClass: 'grid-cols-4 grid-rows-2' };
      case 10:
        return { cols: 5, rows: 2, gridClass: 'grid-cols-5 grid-rows-2' };
      default:
        return { cols: 3, rows: 2, gridClass: 'grid-cols-3 grid-rows-2' };
    }
  }

  // A4 Portrait: 210mm width, 297mm height
  switch (count) {
    case 4:
      return { cols: 2, rows: 2, gridClass: 'grid-cols-2 grid-rows-2' };
    case 6:
      return { cols: 2, rows: 3, gridClass: 'grid-cols-2 grid-rows-3' };
    case 10:
      return { cols: 2, rows: 5, gridClass: 'grid-cols-2 grid-rows-5' };
    case 8:
    default:
      return { cols: 2, rows: 4, gridClass: 'grid-cols-2 grid-rows-4' };
  }
}

/**
 * Renders a single virtual A4 sheet containing up to cardsPerSheet ID cards
 */
export function renderCardSheetHtml(studentsSlice = [], config = DEFAULT_CARD_CONFIG, pageIndex = 0, totalPages = 1, classMap = new Map()) {
  const cfg = { ...DEFAULT_CARD_CONFIG, ...config };
  const isSheetLandscape = cfg.sheetOrientation === 'landscape';
  const layout = getSheetGridLayout(cfg.cardsPerSheet, cfg.cardOrientation, cfg.sheetOrientation);
  const gapMm = cfg.gapMm || 4;

  const sheetWidthMm = isSheetLandscape ? 297 : 210;
  const sheetHeightMm = isSheetLandscape ? 210 : 297;
  const sheetMarginMm = cfg.sheetMarginMm !== undefined ? cfg.sheetMarginMm : 8;

  const cardsHtml = studentsSlice.map(student => {
    return renderIDCardHtml(student, cfg, classMap);
  }).join('');

  return `
    <div class="a4-card-sheet relative bg-white mx-auto shadow-xl print:shadow-none box-border flex flex-col justify-between overflow-hidden print:overflow-visible font-sans ${isSheetLandscape ? 'a4-sheet-landscape' : 'a4-sheet-portrait'}"
         data-page="${pageIndex + 1}"
         style="width: ${sheetWidthMm}mm; min-height: ${sheetHeightMm}mm; height: ${sheetHeightMm}mm; padding: ${sheetMarginMm}mm; box-sizing: border-box;">
      
      <!-- Top Cutting Guides / Crop Marks -->
      ${cfg.showCropMarks ? `
        <div class="absolute top-2 left-4 right-4 flex justify-between text-[8px] text-slate-400 select-none print:flex">
          <span class="flex items-center gap-1">
            ${getIcon('scissors', 'w-3 h-3 text-slate-400')}
            <span>Cutting Guides (${cfg.cardOrientation.toUpperCase()})</span>
          </span>
          <span>Page ${pageIndex + 1} / ${totalPages}</span>
        </div>
      ` : ''}

      <!-- Centered Cards Grid on A4 Page -->
      <div class="id-cards-grid grid ${layout.gridClass} justify-center items-center h-full w-full my-auto"
           style="gap: ${gapMm}mm;">
        ${cardsHtml}
      </div>

      <!-- Bottom Sheet Footer -->
      <div class="text-center text-[7.5px] text-slate-400 select-none pt-1.5 flex justify-between items-center print:flex">
        <span>SmartSchool ID Card Studio</span>
        <span>A4 ${cfg.sheetOrientation.toUpperCase()} • ${studentsSlice.length} Cards</span>
        <span>Page ${pageIndex + 1} of ${totalPages}</span>
      </div>
    </div>
  `;
}
