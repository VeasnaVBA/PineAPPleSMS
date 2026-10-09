/**
 * Global Report Viewer Component
 * Wraps every printable report across the School Management System with:
 * 1. Exact Highlighted Selection Capture (`window.getSelection` & `Range`).
 * 2. Focus-stealing prevention (`mousedown: e.preventDefault()`) so active highlights stay selected.
 * 3. Isolated inline formatting (`<span>` wrapping) strictly for highlighted text.
 *    - Never modifies global document font as a fallback when text is not highlighted.
 *    - Shows "សូមជ្រើសរើសអត្ថបទជាមុនសិន" (Please highlight text first) if no text is selected.
 * 4. Text Position Nudge Controls (←, →, ↑, ↓) strictly for highlighted text via `.report-nudge-box`.
 * 5. Page Layout Refactor: Sheet Margins renamed and refactored to "Page Padding" on outer container.
 * 6. Complete HTML & Preset persistence to IndexedDB (`savedHtmlContent`, `padding`).
 */

import { getIcon } from './icons.js';
import { reportService } from '../services/reportService.js';
import { ENGLISH_FONTS, KHMER_FONTS } from '../services/fontService.js';
import { toast } from './toast.js';
import { t, i18n } from '../i18n/i18n.js';

function toKhmerNumerals(num) {
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(num).replace(/[0-9]/g, d => khmerDigits[d]);
}

export const PAPER_DIMENSIONS = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 }
};

export function getPaperDimensions(size = 'A4', orientation = 'portrait') {
  const normSize = String(size || 'A4').toUpperCase();
  const base = PAPER_DIMENSIONS[normSize] || PAPER_DIMENSIONS.A4;
  if (orientation === 'landscape') {
    return { width: base.height, height: base.width };
  }
  return { width: base.width, height: base.height };
}

export class ReportViewer {
  /**
   * Open the Global Report Viewer
   * @param {Object} options
   * @param {string} options.reportKey - Unique identifier (e.g. 'dropout_report', 'student_list')
   * @param {string} options.title - Header title of the report
   * @param {string} [options.defaultOrientation='portrait'] - 'portrait' | 'landscape'
   * @param {string} [options.defaultPaperSize='A4'] - 'A4' | 'A3' | 'A5'
   * @param {Object} [options.defaultMargins] - { top: 15, bottom: 15, left: 15, right: 15 } in mm
   * @param {string} [options.defaultFontFamily='Kantumruy Pro'] - Base font
   * @param {number} [options.defaultFontSize=11] - Base font size in pt
   * @param {Function} [options.renderHeaderControls] - (container, viewer) => void
   * @param {Function} options.renderContent - async (paperContainer, viewer) => void
   * @param {Function} [options.onClose] - Callback when closed
   */
  static async open(options) {
    const viewer = new ReportViewer(options);
    await viewer.init();
    return viewer;
  }

  constructor(options) {
    this.options = {
      reportKey: options.reportKey || 'default_report',
      title: options.title || t('reportViewer.title') || 'Report Viewer',
      defaultOrientation: options.defaultOrientation || 'portrait',
      defaultPaperSize: options.defaultPaperSize || 'A4',
      defaultMargins: options.defaultMargins || { top: 15, bottom: 15, left: 15, right: 15 },
      defaultFontFamily: options.defaultFontFamily || 'Kantumruy Pro',
      defaultFontSize: options.defaultFontSize || 10,
      renderHeaderControls: options.renderHeaderControls || null,
      renderContent: options.renderContent || (() => {}),
      alwaysFresh: options.alwaysFresh !== undefined ? options.alwaysFresh : true,
      onClose: options.onClose || null
    };

    this.settings = {
      paperSize: (this.options.defaultPaperSize || 'A4').toUpperCase(),
      padding: { ...this.options.defaultMargins },
      margins: { ...this.options.defaultMargins },
      orientation: this.options.defaultOrientation,
      zoom: 100,
      defaultFontFamily: this.options.defaultFontFamily,
      defaultFontSize: this.options.defaultFontSize || 10
    };

    this.currentRange = null;
    this.hasActiveSelection = false;
    this.savedHtmlContent = null;
    this.savedImages = [];
    this.savedTextBoxes = [];
    this.overlay = null;
    this.paperElement = null;
    this.scalerElement = null;
    this.contentElement = null;
    this.sidebarElement = null;
    this.styleElement = null;
    this.isAutoSave = true;
    this.sidebarOpen = true;
    this.currentHighlightPt = this.settings.defaultFontSize || 10;
    this.multiSelectedElements = new Set();
    this.currentTableCell = null;
    this.currentTableRow = null;
    this.currentTable = null;
    this.shadingTargetMode = 'cell';
    this.currentRowPadding = 8;
    this.currentColumnWidth = 'auto';
    this.savedColumnWidths = {};
    this.customFilterValues = options.defaultFilterValues ? { ...options.defaultFilterValues } : {};
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 30;
  }

  async init() {
    // 1. Load saved preset and HTML content from IndexedDB
    try {
      const saved = await reportService.getReportSettings(this.options.reportKey);
      if (saved) {
        const savedPadding = saved.padding || saved.margins;
        if (savedPadding) {
          this.settings.padding = { ...this.settings.padding, ...savedPadding };
          this.settings.margins = { ...this.settings.margins, ...savedPadding };
        }
        if (saved.paperSize) this.settings.paperSize = String(saved.paperSize).toUpperCase();
        if (saved.orientation) this.settings.orientation = saved.orientation;
        if (saved.zoom) this.settings.zoom = Number(saved.zoom);
        if (saved.defaultFontFamily) this.settings.defaultFontFamily = saved.defaultFontFamily;
        if (saved.defaultFontSize) this.settings.defaultFontSize = Number(saved.defaultFontSize);
        if (saved.savedHtmlContent || saved.customOverridesHtml) {
          this.savedHtmlContent = saved.savedHtmlContent || saved.customOverridesHtml;
        }
        if (Array.isArray(saved.savedImages)) {
          this.savedImages = saved.savedImages;
        }
        if (Array.isArray(saved.savedTextBoxes)) {
          this.savedTextBoxes = saved.savedTextBoxes;
        }
        // Restore row height and column widths
        if (saved.currentRowPadding != null) {
          this.currentRowPadding = Number(saved.currentRowPadding);
        }
        if (saved.savedColumnWidths && typeof saved.savedColumnWidths === 'object') {
          this.savedColumnWidths = { ...saved.savedColumnWidths };
        }
        if (saved.currentColumnWidth != null) {
          this.currentColumnWidth = saved.currentColumnWidth;
        }
        if (saved.customFilterValues && typeof saved.customFilterValues === 'object') {
          this.customFilterValues = { ...saved.customFilterValues };
        }
      }
    } catch (err) {
      console.warn('Failed to load report preset:', err);
    }

    // 2. Build DOM layout
    this.renderModal();

    // 3. Attach event listeners
    this.attachEventListeners();

    // 4. Render report content (row padding & column width are re-applied inside refreshContent)
    await this.refreshContent(false);

    // 5. Apply outer page setup (padding, orientation, zoom)
    this.applyPageSetup();
  }

  /**
   * Render the full-screen report viewer modal
   */
  renderModal() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'report-viewer-overlay fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md animate-fade-in select-none text-foreground';

    // Available fonts: Standardized English font names (no Khmer text in dropdown)
    const fontMap = new Map();
    fontMap.set("'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive", {
      name: "'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive",
      label: 'Khmer OS Moul Light',
      stack: "'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif"
    });
    Object.values(KHMER_FONTS).forEach(f => {
      const isMuol = f.label.includes('Muol Light') || f.label.includes('Moul Light') || f.name.includes('Muol') || f.name.includes('Moul');
      if (!isMuol && !fontMap.has(f.name)) {
        const cleanName = f.name.replace(/['",]/g, '').trim();
        fontMap.set(f.name, { name: f.name, label: cleanName, stack: f.stack });
      }
    });
    Object.values(ENGLISH_FONTS).forEach(f => {
      if (!fontMap.has(f.name)) {
        fontMap.set(f.name, { name: f.name, label: f.name, stack: f.stack });
      }
    });
    const availableFonts = Array.from(fontMap.values());

    const isKm = i18n.getLocale() === 'km';

    // Inject styles for multi-selected elements and strict toolbar height normalization
    if (!document.getElementById('rv-multi-select-style')) {
      const style = document.createElement('style');
      style.id = 'rv-multi-select-style';
      style.textContent = `
        .rv-multi-selected {
          outline: 2px solid #2563eb !important;
          outline-offset: 1px !important;
          background-color: rgba(37, 99, 235, 0.12) !important;
          border-radius: 2px !important;
        }
        @media print {
          .rv-multi-selected {
            outline: none !important;
            background-color: transparent !important;
          }
        }
        /* High-visibility highlight on text in report in dark and light modes */
        .report-viewer-sheet ::selection,
        .report-viewer-sheet *::selection,
        .a4-sheet-page ::selection,
        .a4-sheet-page *::selection,
        .rv-paper-content ::selection,
        .rv-paper-content *::selection,
        #rv-paper-sheet ::selection,
        #rv-paper-sheet *::selection,
        #rv-paper-container ::selection,
        #rv-paper-container *::selection {
          background-color: #2563eb !important;
          color: #ffffff !important;
        }
        .report-viewer-sheet ::-moz-selection,
        .report-viewer-sheet *::-moz-selection,
        .a4-sheet-page ::-moz-selection,
        .a4-sheet-page *::-moz-selection,
        .rv-paper-content ::-moz-selection,
        .rv-paper-content *::-moz-selection,
        #rv-paper-sheet ::-moz-selection,
        #rv-paper-sheet *::-moz-selection,
        #rv-paper-container ::-moz-selection,
        #rv-paper-container *::-moz-selection {
          background-color: #2563eb !important;
          color: #ffffff !important;
        }
        /* Strict Toolbar Height Normalization: All tools match Save Preset button (32px / h-8) */
        .report-viewer-toolbar {
          min-height: 44px !important;
          align-items: center !important;
        }
        .report-viewer-toolbar * {
          box-sizing: border-box !important;
        }
        .report-viewer-toolbar select#rv-font-family {
          height: 32px !important;
          min-height: 32px !important;
          max-height: 32px !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          padding-left: 8px !important;
          padding-right: 20px !important;
          line-height: 30px !important;
          font-size: 12px !important;
          border-radius: 6px !important;
        }
        .report-viewer-toolbar #rv-font-size-container {
          height: 32px !important;
          min-height: 32px !important;
          max-height: 32px !important;
        }
        .report-viewer-toolbar input#rv-tb-font-size-input {
          height: 28px !important;
          min-height: 28px !important;
          max-height: 28px !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          font-size: 12px !important;
          line-height: 28px !important;
          vertical-align: middle !important;
          display: inline-block !important;
        }
        .report-viewer-toolbar select#rv-nudge-step {
          height: 24px !important;
          min-height: 24px !important;
          max-height: 24px !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          padding-left: 4px !important;
          padding-right: 14px !important;
          font-size: 11px !important;
          border-radius: 4px !important;
          line-height: 22px !important;
        }
        .report-viewer-toolbar .rv-tool-h8 {
          height: 32px !important;
          min-height: 32px !important;
          max-height: 32px !important;
        }
        /* Strict Header Controls Height Normalization (Strictly 32px / h-8 = Print Button) */
        .report-viewer-header select,
        .report-viewer-header input:not([type="checkbox"]):not([type="radio"]),
        .report-viewer-header button,
        .report-viewer-header #rv-extra-header-controls select,
        .report-viewer-header #rv-extra-header-controls input:not([type="checkbox"]):not([type="radio"]),
        .report-viewer-header #rv-extra-header-controls button,
        .report-viewer-header #rv-btn-export-pdf,
        .report-viewer-header #rv-btn-print {
          height: 32px !important;
          min-height: 32px !important;
          max-height: 32px !important;
          box-sizing: border-box !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          line-height: 30px !important;
          vertical-align: middle !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .report-viewer-header #rv-btn-close {
          height: 32px !important;
          min-height: 32px !important;
          max-height: 32px !important;
          width: 32px !important;
          min-width: 32px !important;
          max-width: 32px !important;
          box-sizing: border-box !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .report-viewer-header select,
        .report-viewer-header #rv-extra-header-controls select {
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 8px center !important;
          padding-right: 24px !important;
          padding-left: 10px !important;
          justify-content: flex-start !important;
        }
        .report-viewer-header .hidden,
        .report-viewer-header #rv-extra-header-controls .hidden,
        .report-viewer-header [hidden] {
          display: none !important;
        }
        .report-viewer-header #rv-extra-header-controls #rv-popover-province-menu,
        .report-viewer-header #rv-extra-header-controls #rv-popover-year-menu,
        .report-viewer-header #rv-extra-header-controls #rv-popover-date-menu,
        .report-viewer-header #rv-extra-header-controls #rv-scoresheet-popover-date-menu {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          line-height: normal !important;
        }
        .report-viewer-header #rv-extra-header-controls #rv-popover-province-menu:not(.hidden),
        .report-viewer-header #rv-extra-header-controls #rv-popover-year-menu:not(.hidden),
        .report-viewer-header #rv-extra-header-controls #rv-popover-date-menu:not(.hidden),
        .report-viewer-header #rv-extra-header-controls #rv-scoresheet-popover-date-menu:not(.hidden) {
          display: block !important;
        }
        .report-viewer-header #rv-extra-header-controls #rv-popover-province-menu *,
        .report-viewer-header #rv-extra-header-controls #rv-popover-year-menu *,
        .report-viewer-header #rv-extra-header-controls #rv-popover-date-menu *,
        .report-viewer-header #rv-extra-header-controls #rv-scoresheet-popover-date-menu * {
          line-height: normal !important;
        }
        .report-viewer-header #rv-extra-header-controls #rv-popover-date-menu button,
        .report-viewer-header #rv-extra-header-controls #rv-scoresheet-popover-date-menu button {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          padding-top: 4px !important;
          padding-bottom: 4px !important;
        }
        .report-viewer-header #rv-extra-header-controls input#rv-input-new-province,
        .report-viewer-header #rv-extra-header-controls input#rv-input-new-year,
        .report-viewer-header #rv-extra-header-controls button#rv-btn-add-province,
        .report-viewer-header #rv-extra-header-controls button#rv-btn-add-year {
          height: 32px !important;
          min-height: 32px !important;
          max-height: 32px !important;
          box-sizing: border-box !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
        }
        .report-viewer-header #rv-extra-header-controls .rv-btn-delete-prov,
        .report-viewer-header #rv-extra-header-controls .rv-btn-delete-year {
          height: 24px !important;
          min-height: 24px !important;
          max-height: 24px !important;
          width: 24px !important;
          padding: 0 !important;
        }
      `;
      document.head.appendChild(style);
    }

    this.overlay.innerHTML = `
      <!-- 1. Top Header Row -->
      <div class="report-viewer-header px-4 py-2 border-b border-border bg-card flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            ${getIcon('fileText', 'w-4 h-4')}
          </div>
          <div>
            <h2 class="text-sm font-bold text-foreground font-khmer flex items-center gap-2">
              <span>${this.options.title}</span>
            </h2>
          </div>
        </div>

        <!-- Extra Action Controls Slot (Filters, Excel, etc.) -->
        <div id="rv-extra-header-controls" class="flex items-center gap-2 flex-wrap"></div>

        <!-- Primary Actions -->
        <div class="flex items-center gap-2">
          <!-- Export PDF Button -->
          <button type="button" 
                  id="rv-btn-export-pdf" 
                  class="h-8 px-3 rounded-md border border-input bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 font-khmer shadow-xs cursor-pointer"
                  title="${t('reportViewer.exportPdf') || 'Export to PDF'}">
            ${getIcon('fileDown', 'w-3.5 h-3.5 text-primary')}
            <span>${t('reportViewer.exportPdf') || 'ទាញយកជា PDF'}</span>
          </button>

          <!-- Print Button -->
          <button type="button" 
                  id="rv-btn-print" 
                  class="h-8 px-3.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 font-khmer shadow-xs cursor-pointer">
            ${getIcon('printer', 'w-3.5 h-3.5')}
            <span>${t('reportViewer.print') || 'បោះពុម្ព (Print)'}</span>
          </button>

          <!-- Close Button -->
          <button type="button" 
                  id="rv-btn-close" 
                  class="w-8 h-8 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center cursor-pointer shadow-xs" 
                  title="${t('reportViewer.close') || 'Close'}">
            ${getIcon('x', 'w-4 h-4')}
          </button>
        </div>
      </div>

      <!-- 2. Sticky Formatting Toolbar: All formatting tools use mousedown: e.preventDefault() -->
      <div class="report-viewer-toolbar px-4 py-1.5 border-b border-border bg-muted/40 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
        
        <!-- Left: Text Formatting Controls (Applied STRICTLY to active selection) -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <!-- Undo & Redo Controls -->
          <div class="flex items-center rounded-md border border-input bg-card h-8 p-0.5 gap-0.5 shadow-xs">
            <button type="button" 
                    id="rv-btn-undo" 
                    class="rv-format-btn h-full px-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
                    title="${t('reportViewer.undo') || 'Undo'} (Ctrl+Z)" 
                    disabled>
              ${getIcon('undo', 'w-3.5 h-3.5')}
            </button>
            <button type="button" 
                    id="rv-btn-redo" 
                    class="rv-format-btn h-full px-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
                    title="${t('reportViewer.redo') || 'Redo'} (Ctrl+Y)" 
                    disabled>
              ${getIcon('redo', 'w-3.5 h-3.5')}
            </button>
          </div>

          <div class="h-4 w-px bg-border mx-0.5"></div>

          <!-- Font Family Dropdown -->
          <select id="rv-font-family" class="no-shadcn h-8 px-2.5 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs min-w-[145px] max-w-[165px] cursor-pointer" title="Font Family">
            <option value="" disabled selected>Font...</option>
            ${availableFonts.map(f => `
              <option value="${f.name}">${f.label}</option>
            `).join('')}
          </select>

          <!-- Font Size Stepper & Input -->
          <div id="rv-font-size-container" class="flex items-center rounded-md border border-input bg-card h-8 shadow-xs overflow-hidden">
            <button type="button" id="rv-tb-btn-font-dec" class="rv-format-btn h-full w-7 hover:bg-muted text-foreground flex items-center justify-center font-bold text-sm cursor-pointer select-none transition-colors border-0 bg-transparent" title="Decrease Font Size">-</button>
            <div class="h-4 w-px bg-border"></div>
            <div class="flex items-center px-1.5 h-full">
              <input type="number" id="rv-tb-font-size-input" min="6" max="72" value="${this.settings.defaultFontSize || 10}" class="no-shadcn w-8 h-full text-center font-mono font-semibold text-xs border-0 bg-transparent text-foreground p-0 focus:outline-none cursor-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" title="Font Size (px)" />
              <span class="text-[11px] text-muted-foreground font-mono select-none -ml-0.5">px</span>
            </div>
            <div class="h-4 w-px bg-border"></div>
            <button type="button" id="rv-tb-btn-font-inc" class="rv-format-btn h-full w-7 hover:bg-muted text-foreground flex items-center justify-center font-bold text-sm cursor-pointer select-none transition-colors border-0 bg-transparent" title="Increase Font Size">+</button>
          </div>

          <div class="h-4 w-px bg-border mx-0.5"></div>

          <!-- Bold Toggle Button -->
          <button type="button" 
                  id="rv-btn-bold" 
                  class="rv-format-btn h-8 w-8 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-xs" 
                  title="${t('reportViewer.bold') || 'Bold'} (Ctrl+B)">
            ${getIcon('bold', 'w-4 h-4')}
          </button>

          <!-- Italic Toggle Button -->
          <button type="button" 
                  id="rv-btn-italic" 
                  class="rv-format-btn h-8 w-8 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-xs" 
                  title="${t('reportViewer.italic') || 'Italic'} (Ctrl+I)">
            ${getIcon('italic', 'w-4 h-4')}
          </button>

          <!-- Color Picker Button -->
          <div class="relative flex items-center shadow-xs" title="${t('reportViewer.textColor') || 'Text Color'}">
            <label for="rv-color-picker" class="rv-format-btn h-8 w-8 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer">
              ${getIcon('palette', 'w-4 h-4 text-primary')}
            </label>
            <input type="color" id="rv-color-picker" value="#000000" class="no-shadcn opacity-0 absolute inset-0 w-8 h-8 cursor-pointer" />
          </div>

          <div class="h-4 w-px bg-border mx-0.5"></div>

          <!-- Alignment Buttons -->
          <div class="flex items-center rounded-md border border-input bg-card h-8 p-0.5 gap-0.5 shadow-xs">
            <button type="button" id="rv-btn-align-left" class="rv-format-btn h-full px-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors" title="${t('reportViewer.alignLeft') || 'Left'}">
              ${getIcon('alignLeft', 'w-3.5 h-3.5')}
            </button>
            <button type="button" id="rv-btn-align-center" class="rv-format-btn h-full px-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors" title="${t('reportViewer.alignCenter') || 'Center'}">
              ${getIcon('alignCenter', 'w-3.5 h-3.5')}
            </button>
            <button type="button" id="rv-btn-align-right" class="rv-format-btn h-full px-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors" title="${t('reportViewer.alignRight') || 'Right'}">
              ${getIcon('alignRight', 'w-3.5 h-3.5')}
            </button>
            <button type="button" id="rv-btn-align-justify" class="rv-format-btn h-full px-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors" title="${t('reportViewer.alignJustify') || 'Justify'}">
              ${getIcon('alignJustify', 'w-3.5 h-3.5')}
            </button>
          </div>

          <div class="h-4 w-px bg-border mx-0.5"></div>

          <!-- Table Shading Tool -->
          <div class="relative" id="rv-shading-group">
            <button type="button" 
                    id="rv-btn-shading-toggle" 
                    class="rv-format-btn h-8 px-2 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center gap-1 transition-colors cursor-pointer shadow-xs" 
                    title="${t('reportViewer.cellShading') || 'Table Cell / Row Shading'}">
              ${getIcon('paintBucket', 'w-3.5 h-3.5 text-primary')}
              <span class="text-[11px] font-medium hidden sm:inline font-khmer">${t('reportViewer.cellShading') || 'ពណ៌ផ្ទៃតារាង'}</span>
            </button>

            <!-- Shading Popover -->
            <div id="rv-popover-shading" 
                 class="hidden absolute top-9.5 left-0 z-50 w-64 p-3 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-2.5 font-khmer select-none">
              <div class="flex items-center justify-between text-xs font-bold border-b border-border pb-1.5">
                <span class="flex items-center gap-1.5 text-foreground">
                  ${getIcon('paintBucket', 'w-3.5 h-3.5 text-primary')}
                  <span>${t('reportViewer.cellShading') || 'ពណ៌ផ្ទៃតារាង'}</span>
                </span>
                <span id="rv-selected-cell-info" class="text-[10px] text-muted-foreground font-mono"></span>
              </div>

              <!-- Scope Selector (Cell vs Row) -->
              <div class="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg text-[11px]">
                <button type="button" id="rv-shading-target-cell" class="flex-1 py-1 rounded-md text-center font-medium transition-colors bg-card shadow-xs text-foreground cursor-pointer">
                  ${t('reportViewer.targetCell') || 'ក្រឡា (Cell)'}
                </button>
                <button type="button" id="rv-shading-target-row" class="flex-1 py-1 rounded-md text-center font-medium transition-colors text-muted-foreground hover:text-foreground cursor-pointer">
                  ${t('reportViewer.targetRow') || 'ជួរដេក (Row)'}
                </button>
              </div>

              <!-- Quick Shade Presets -->
              <div class="space-y-1">
                <div class="text-[10px] text-muted-foreground font-medium">ពណ៌លឿន (Presets):</div>
                <div class="grid grid-cols-4 gap-1.5">
                  <button type="button" class="rv-shade-preset-btn h-7 rounded border border-border flex items-center justify-center bg-white hover:ring-2 hover:ring-primary text-[10px] cursor-pointer" data-color="#ffffff" title="White">#fff</button>
                  <button type="button" class="rv-shade-preset-btn h-7 rounded border border-border flex items-center justify-center bg-zinc-100 hover:ring-2 hover:ring-primary text-[10px] text-zinc-700 cursor-pointer" data-color="#f4f4f5" title="Light Gray">Gray</button>
                  <button type="button" class="rv-shade-preset-btn h-7 rounded border border-border flex items-center justify-center bg-blue-100 hover:ring-2 hover:ring-primary text-[10px] text-blue-700 cursor-pointer" data-color="#dbeafe" title="Soft Blue">Blue</button>
                  <button type="button" class="rv-shade-preset-btn h-7 rounded border border-border flex items-center justify-center bg-emerald-100 hover:ring-2 hover:ring-primary text-[10px] text-emerald-700 cursor-pointer" data-color="#dcfce7" title="Soft Green">Green</button>
                  <button type="button" class="rv-shade-preset-btn h-7 rounded border border-border flex items-center justify-center bg-amber-100 hover:ring-2 hover:ring-primary text-[10px] text-amber-700 cursor-pointer" data-color="#fef3c7" title="Soft Amber">Amber</button>
                  <button type="button" class="rv-shade-preset-btn h-7 rounded border border-border flex items-center justify-center bg-rose-100 hover:ring-2 hover:ring-primary text-[10px] text-rose-700 cursor-pointer" data-color="#ffe4e6" title="Soft Rose">Rose</button>
                  <button type="button" class="rv-shade-preset-btn h-7 rounded border border-border flex items-center justify-center bg-purple-100 hover:ring-2 hover:ring-primary text-[10px] text-purple-700 cursor-pointer" data-color="#f3e8ff" title="Soft Purple">Purple</button>
                  <button type="button" class="rv-shade-preset-btn h-7 rounded border border-border flex items-center justify-center bg-transparent hover:ring-2 hover:ring-primary text-[10px] text-muted-foreground cursor-pointer" data-color="transparent" title="Transparent / Reset">✕</button>
                </div>
              </div>

              <!-- Custom Color Picker -->
              <div class="flex items-center justify-between gap-2 pt-1 border-t border-border">
                <span class="text-xs text-muted-foreground">${t('reportViewer.customColor') || 'ពណ៌ផ្ទាល់ខ្លួន'}:</span>
                <div class="flex items-center gap-1.5">
                  <input type="color" id="rv-cell-color-picker" value="#f4f4f5" class="w-7 h-7 rounded border border-border p-0.5 cursor-pointer bg-transparent" />
                  <button type="button" id="rv-btn-clear-shading" class="px-2 py-1 text-[11px] rounded bg-muted hover:bg-muted/80 text-muted-foreground cursor-pointer">
                    ${t('reportViewer.colorTransparent') || 'គ្មានពណ៌'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Row Height / Padding Tool -->
          <div class="relative" id="rv-row-height-group">
            <button type="button" 
                    id="rv-btn-row-height-toggle" 
                    class="rv-format-btn h-8 px-2 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center gap-1 transition-colors cursor-pointer shadow-xs" 
                    title="${t('reportViewer.rowHeight') || 'Row Height / Padding'}">
              ${getIcon('table', 'w-3.5 h-3.5 text-primary')}
              <span class="text-[11px] font-medium hidden sm:inline font-khmer">${t('reportViewer.rowHeight') || 'កម្ពស់ជួរដេក'}</span>
            </button>

            <!-- Row Height Popover -->
            <div id="rv-popover-row-height" 
                 class="hidden absolute top-9.5 left-0 z-50 w-56 p-3 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-2.5 font-khmer select-none">
              <div class="flex items-center justify-between text-xs font-bold border-b border-border pb-1.5">
                <span class="flex items-center gap-1.5 text-foreground">
                  ${getIcon('table', 'w-3.5 h-3.5 text-primary')}
                  <span>${t('reportViewer.rowHeight') || 'កម្ពស់ជួរដេក'}</span>
                </span>
                <span id="rv-row-height-val" class="font-mono text-primary font-bold text-xs">8px</span>
              </div>

              <!-- Presets -->
              <div class="grid grid-cols-3 gap-1 text-[11px]">
                <button type="button" class="rv-row-preset-btn py-1 px-1.5 rounded border border-border hover:bg-muted text-center cursor-pointer" data-padding="4">${t('reportViewer.compact') || 'តូច'}</button>
                <button type="button" class="rv-row-preset-btn py-1 px-1.5 rounded border border-border hover:bg-muted text-center cursor-pointer font-bold text-primary" data-padding="8">${t('reportViewer.normal') || 'ធម្មតា'}</button>
                <button type="button" class="rv-row-preset-btn py-1 px-1.5 rounded border border-border hover:bg-muted text-center cursor-pointer" data-padding="14">${t('reportViewer.spacious') || 'ធំ'}</button>
              </div>

              <!-- Stepper -->
              <div class="flex items-center justify-between gap-2 pt-1 border-t border-border">
                <span class="text-xs text-muted-foreground">ទំហំលម្អិត:</span>
                <div class="flex items-center rounded-md border border-input bg-card h-7 overflow-hidden">
                  <button type="button" id="rv-btn-row-pad-dec" class="h-full px-2 hover:bg-muted text-foreground cursor-pointer font-bold">-</button>
                  <span id="rv-tb-row-pad-display" class="px-2 font-mono text-xs font-semibold">8px</span>
                  <button type="button" id="rv-btn-row-pad-inc" class="h-full px-2 hover:bg-muted text-foreground cursor-pointer font-bold">+</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Column Width Tool -->
          <div class="relative" id="rv-col-width-group">
            <button type="button" 
                    id="rv-btn-col-width-toggle" 
                    class="rv-format-btn h-8 px-2 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center gap-1 transition-colors cursor-pointer shadow-xs" 
                    title="${t('reportViewer.columnWidth') || 'Column Width'}">
              ${getIcon('columns', 'w-3.5 h-3.5 text-primary')}
              <span class="text-[11px] font-medium hidden sm:inline font-khmer">${t('reportViewer.columnWidth') || 'ទទឹងជួរឈរ'}</span>
            </button>

            <!-- Column Width Popover -->
            <div id="rv-popover-col-width" 
                 class="hidden absolute top-9.5 left-0 z-50 w-64 p-3 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-2.5 font-khmer select-none">
              <div class="flex items-center justify-between text-xs font-bold border-b border-border pb-1.5">
                <span class="flex items-center gap-1.5 text-foreground">
                  ${getIcon('columns', 'w-3.5 h-3.5 text-primary')}
                  <span>${t('reportViewer.columnWidth') || 'ទទឹងជួរឈរ'}</span>
                </span>
                <span id="rv-selected-col-info" class="text-[10px] text-muted-foreground font-mono"></span>
              </div>

              <!-- Presets -->
              <div class="grid grid-cols-4 gap-1 text-[11px]">
                <button type="button" class="rv-col-preset-btn py-1 px-1 rounded border border-border hover:bg-muted text-center cursor-pointer font-bold text-primary" data-width="auto">${t('reportViewer.autoWidth') || (isKm ? 'ស្វ័យប្រវត្តិ' : 'Auto')}</button>
                <button type="button" class="rv-col-preset-btn py-1 px-1 rounded border border-border hover:bg-muted text-center cursor-pointer" data-width="65">${t('reportViewer.narrow') || 'តូច'}</button>
                <button type="button" class="rv-col-preset-btn py-1 px-1 rounded border border-border hover:bg-muted text-center cursor-pointer" data-width="120">${t('reportViewer.normal') || 'ធម្មតា'}</button>
                <button type="button" class="rv-col-preset-btn py-1 px-1 rounded border border-border hover:bg-muted text-center cursor-pointer" data-width="200">${t('reportViewer.wide') || 'ធំ'}</button>
              </div>

              <!-- Stepper -->
              <div class="flex items-center justify-between gap-2 pt-1 border-t border-border">
                <span class="text-xs text-muted-foreground">${isKm ? 'ទទឹងលម្អិត:' : 'Fine Adjust:'}</span>
                <div class="flex items-center rounded-md border border-input bg-card h-7 overflow-hidden">
                  <button type="button" id="rv-btn-col-width-dec" class="h-full px-2 hover:bg-muted text-foreground cursor-pointer font-bold">-10</button>
                  <span id="rv-tb-col-width-display" class="px-2 font-mono text-xs font-semibold">${isKm ? 'ស្វ័យប្រវត្តិ' : 'Auto'}</span>
                  <button type="button" id="rv-btn-col-width-inc" class="h-full px-2 hover:bg-muted text-foreground cursor-pointer font-bold">+10</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Insert Image Tool -->
          <div class="relative" id="rv-insert-image-group">
            <button type="button" 
                    id="rv-btn-insert-image" 
                    class="rv-format-btn h-8 px-2 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center gap-1 transition-colors cursor-pointer shadow-xs" 
                    title="${t('reportViewer.insertImage') || 'Insert Image (Stamps / Signatures / Logos)'}">
              ${getIcon('image', 'w-3.5 h-3.5 text-primary')}
              <span class="text-[11px] font-medium hidden sm:inline font-khmer">${t('reportViewer.insertImage') || 'រូបភាព'}</span>
            </button>
            <input type="file" id="rv-image-file-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden" />
          </div>

          <!-- Insert Text Box Tool -->
          <div class="relative" id="rv-insert-textbox-group">
            <button type="button" 
                    id="rv-btn-insert-textbox" 
                    class="rv-format-btn h-8 px-2 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center gap-1 transition-colors cursor-pointer shadow-xs" 
                    title="${isKm ? 'បញ្ចូលប្រអប់អត្ថបទ (Insert Movable Text Box)' : 'Insert Movable Text Box'}">
              ${getIcon('type', 'w-3.5 h-3.5 text-primary')}
              <span class="text-[11px] font-medium hidden sm:inline font-khmer">${isKm ? 'ប្រអប់អត្ថបទ' : 'Text Box'}</span>
            </button>
          </div>

          <div class="h-4 w-px bg-border mx-0.5"></div>

          <!-- Nudge Position Controls: 2 Arrow Buttons (Horizontal & Vertical with Popover Sliders) -->
          <div class="flex items-center gap-1">
            <!-- 1. Horizontal Nudge Button (Left ⇄ Right) -->
            <div class="relative" id="rv-nudge-x-group">
              <button type="button" 
                      id="rv-btn-nudge-x-toggle" 
                      class="rv-format-btn h-8 w-8 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-xs" 
                      title="${isKm ? 'រំកិល ឆ្វេង ⇄ ស្ដាំ (Horizontal Nudge Slider)' : 'Horizontal Nudge (Left ⇄ Right Slider)'}">
                ${getIcon('arrowLeftRight', 'w-4 h-4 text-primary')}
              </button>

              <!-- Horizontal Slider Popover -->
              <div id="rv-popover-nudge-x" 
                   class="hidden absolute top-9.5 left-0 z-50 w-64 p-3 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-2.5 font-khmer select-none">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold flex items-center gap-1.5 text-foreground">
                    ${getIcon('arrowLeftRight', 'w-3.5 h-3.5 text-primary')}
                    <span>${isKm ? 'រំកិល ឆ្វេង ⇄ ស្ដាំ' : 'Horizontal Shift'}</span>
                  </span>
                  <span id="rv-tb-nudge-x-val" class="font-mono font-bold text-primary text-xs px-2 py-0.5 rounded bg-primary/10 border border-primary/20">+0px</span>
                </div>
                
                <input type="range" 
                       id="rv-tb-nudge-x-slider" 
                       min="-150" 
                       max="150" 
                       step="1" 
                       value="0" 
                       class="w-full cursor-pointer accent-primary h-2 bg-muted rounded-lg" />

                <div class="flex items-center justify-between gap-1 text-[10px] font-mono">
                  <button type="button" class="rv-nudge-step-btn px-1.5 py-0.5 rounded border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer" data-axis="x" data-delta="-10">-10</button>
                  <button type="button" class="rv-nudge-step-btn px-1.5 py-0.5 rounded border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer" data-axis="x" data-delta="-1">-1</button>
                  <button type="button" class="rv-nudge-step-btn px-2 py-0.5 rounded border border-input bg-background hover:bg-muted font-bold text-foreground cursor-pointer" data-axis="x" data-set="0">0</button>
                  <button type="button" class="rv-nudge-step-btn px-1.5 py-0.5 rounded border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer" data-axis="x" data-delta="1">+1</button>
                  <button type="button" class="rv-nudge-step-btn px-1.5 py-0.5 rounded border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer" data-axis="x" data-delta="10">+10</button>
                </div>
              </div>
            </div>

            <!-- 2. Vertical Nudge Button (Top ⇅ Bottom) -->
            <div class="relative" id="rv-nudge-y-group">
              <button type="button" 
                      id="rv-btn-nudge-y-toggle" 
                      class="rv-format-btn h-8 w-8 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-xs" 
                      title="${isKm ? 'រំកិល លើ ⇅ ក្រោម (Vertical Nudge Slider)' : 'Vertical Nudge (Top ⇅ Bottom Slider)'}">
                ${getIcon('arrowUpDown', 'w-4 h-4 text-primary')}
              </button>

              <!-- Vertical Slider Popover -->
              <div id="rv-popover-nudge-y" 
                   class="hidden absolute top-9.5 left-0 z-50 w-64 p-3 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-2.5 font-khmer select-none">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold flex items-center gap-1.5 text-foreground">
                    ${getIcon('arrowUpDown', 'w-3.5 h-3.5 text-primary')}
                    <span>${isKm ? 'រំកិល លើ ⇅ ក្រោម' : 'Vertical Shift'}</span>
                  </span>
                  <span id="rv-tb-nudge-y-val" class="font-mono font-bold text-primary text-xs px-2 py-0.5 rounded bg-primary/10 border border-primary/20">+0px</span>
                </div>
                
                <input type="range" 
                       id="rv-tb-nudge-y-slider" 
                       min="-150" 
                       max="150" 
                       step="1" 
                       value="0" 
                       class="w-full cursor-pointer accent-primary h-2 bg-muted rounded-lg" />

                <div class="flex items-center justify-between gap-1 text-[10px] font-mono">
                  <button type="button" class="rv-nudge-step-btn px-1.5 py-0.5 rounded border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer" data-axis="y" data-delta="-10">-10</button>
                  <button type="button" class="rv-nudge-step-btn px-1.5 py-0.5 rounded border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer" data-axis="y" data-delta="-1">-1</button>
                  <button type="button" class="rv-nudge-step-btn px-2 py-0.5 rounded border border-input bg-background hover:bg-muted font-bold text-foreground cursor-pointer" data-axis="y" data-set="0">0</button>
                  <button type="button" class="rv-nudge-step-btn px-1.5 py-0.5 rounded border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer" data-axis="y" data-delta="1">+1</button>
                  <button type="button" class="rv-nudge-step-btn px-1.5 py-0.5 rounded border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer" data-axis="y" data-delta="10">+10</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Orientation, Paper Size, Margins, Zoom, Presets -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <!-- Orientation Toggle (Paper Style: Portrait / Landscape) -->
          <div class="flex items-center rounded-md border border-input bg-card h-8 p-0.5 text-xs font-medium font-khmer shadow-xs" title="${t('reportViewer.orientation') || (isKm ? 'ទម្រង់ក្រដាស' : 'Orientation')}">
            <button type="button" 
                    id="rv-btn-orient-portrait" 
                    class="h-full px-2.5 rounded transition-colors cursor-pointer flex items-center ${this.settings.orientation === 'portrait' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'}">
              ${t('reportViewer.portrait') || 'បញ្ឈរ'}
            </button>
            <button type="button" 
                    id="rv-btn-orient-landscape" 
                    class="h-full px-2.5 rounded transition-colors cursor-pointer flex items-center ${this.settings.orientation === 'landscape' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'}">
              ${t('reportViewer.landscape') || 'ផ្ដេក'}
            </button>
          </div>

          <!-- Paper Size Toggle (A4, A3) -->
          <div class="flex items-center rounded-md border border-input bg-card h-8 p-0.5 text-xs font-bold font-mono shadow-xs" title="${t('reportViewer.paperSize') || (isKm ? 'ទំហំក្រដាស' : 'Paper Size')}">
            <button type="button" 
                    id="rv-btn-size-a4" 
                    data-size="A4"
                    class="h-full px-2 rounded transition-colors cursor-pointer flex items-center ${(this.settings.paperSize || 'A4') === 'A4' ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'}">
              A4
            </button>
            <button type="button" 
                    id="rv-btn-size-a3" 
                    data-size="A3"
                    class="h-full px-2 rounded transition-colors cursor-pointer flex items-center ${this.settings.paperSize === 'A3' ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'}">
              A3
            </button>
          </div>

          <!-- Paper Margin Tool -->
          <div class="relative" id="rv-margin-group">
            <button type="button" 
                    id="rv-btn-margin-toggle" 
                    class="rv-format-btn h-8 px-2 rounded-md border border-input bg-card hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs" 
                    title="${t('reportViewer.paperMargin') || (isKm ? 'គម្លាតគែមក្រដាស' : 'Paper Margins')}">
              ${getIcon('slidersHorizontal', 'w-3.5 h-3.5 text-primary')}
              <span class="text-[11px] font-medium hidden sm:inline font-khmer">${t('reportViewer.paperMargin') || (isKm ? 'គែមក្រដាស' : 'Margins')}</span>
              <span id="rv-margin-active-badge" class="text-[10px] font-mono text-muted-foreground font-bold">15mm</span>
            </button>

            <!-- Margin Popover -->
            <div id="rv-popover-margin" 
                 class="hidden absolute top-9.5 right-0 z-50 w-64 p-3 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-2.5 font-khmer select-none">
              <div class="flex items-center justify-between text-xs font-bold border-b border-border pb-1.5">
                <span class="flex items-center gap-1.5 text-foreground">
                  ${getIcon('slidersHorizontal', 'w-3.5 h-3.5 text-primary')}
                  <span>${t('reportViewer.paperMargin') || (isKm ? 'គម្លាតគែមក្រដាស' : 'Paper Margins')}</span>
                </span>
                <span id="rv-margin-summary" class="text-[10px] text-primary font-mono font-bold">15mm</span>
              </div>

              <!-- Margin Presets -->
              <div class="grid grid-cols-3 gap-1 text-[11px] font-mono font-semibold">
                <button type="button" class="rv-margin-preset-btn py-1 px-1 rounded border border-border hover:bg-muted text-center cursor-pointer" data-margin="10">${t('reportViewer.marginNarrow') || '10mm'}</button>
                <button type="button" class="rv-margin-preset-btn py-1 px-1 rounded border border-border hover:bg-muted text-center cursor-pointer font-bold text-primary" data-margin="15">${t('reportViewer.marginNormal') || '15mm'}</button>
                <button type="button" class="rv-margin-preset-btn py-1 px-1 rounded border border-border hover:bg-muted text-center cursor-pointer" data-margin="20">${t('reportViewer.marginWide') || '20mm'}</button>
              </div>

              <!-- 4 Sides Custom Inputs -->
              <div class="space-y-1.5 pt-1 border-t border-border">
                <div class="text-[10px] text-muted-foreground font-medium">${isKm ? 'កែតម្រូវគែមនីមួយៗ (mm):' : 'Custom Margins (mm):'}</div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <!-- Top -->
                  <div class="flex items-center justify-between bg-muted/30 rounded p-1 border border-border/50">
                    <span class="text-[11px] text-muted-foreground">${t('reportViewer.top') || (isKm ? 'លើ' : 'Top')}:</span>
                    <div class="flex items-center rounded border border-input bg-card h-6 overflow-hidden">
                      <button type="button" class="rv-margin-step-btn px-1.5 h-full hover:bg-muted text-foreground cursor-pointer font-bold" data-side="top" data-delta="-2">-</button>
                      <span id="rv-margin-top-val" class="w-7 text-center font-mono text-[11px] font-semibold text-foreground">15</span>
                      <button type="button" class="rv-margin-step-btn px-1.5 h-full hover:bg-muted text-foreground cursor-pointer font-bold" data-side="top" data-delta="2">+</button>
                    </div>
                  </div>
                  <!-- Bottom -->
                  <div class="flex items-center justify-between bg-muted/30 rounded p-1 border border-border/50">
                    <span class="text-[11px] text-muted-foreground">${t('reportViewer.bottom') || (isKm ? 'ក្រោម' : 'Bottom')}:</span>
                    <div class="flex items-center rounded border border-input bg-card h-6 overflow-hidden">
                      <button type="button" class="rv-margin-step-btn px-1.5 h-full hover:bg-muted text-foreground cursor-pointer font-bold" data-side="bottom" data-delta="-2">-</button>
                      <span id="rv-margin-bottom-val" class="w-7 text-center font-mono text-[11px] font-semibold text-foreground">15</span>
                      <button type="button" class="rv-margin-step-btn px-1.5 h-full hover:bg-muted text-foreground cursor-pointer font-bold" data-side="bottom" data-delta="2">+</button>
                    </div>
                  </div>
                  <!-- Left -->
                  <div class="flex items-center justify-between bg-muted/30 rounded p-1 border border-border/50">
                    <span class="text-[11px] text-muted-foreground">${t('reportViewer.left') || (isKm ? 'ឆ្វេង' : 'Left')}:</span>
                    <div class="flex items-center rounded border border-input bg-card h-6 overflow-hidden">
                      <button type="button" class="rv-margin-step-btn px-1.5 h-full hover:bg-muted text-foreground cursor-pointer font-bold" data-side="left" data-delta="-2">-</button>
                      <span id="rv-margin-left-val" class="w-7 text-center font-mono text-[11px] font-semibold text-foreground">15</span>
                      <button type="button" class="rv-margin-step-btn px-1.5 h-full hover:bg-muted text-foreground cursor-pointer font-bold" data-side="left" data-delta="2">+</button>
                    </div>
                  </div>
                  <!-- Right -->
                  <div class="flex items-center justify-between bg-muted/30 rounded p-1 border border-border/50">
                    <span class="text-[11px] text-muted-foreground">${t('reportViewer.right') || (isKm ? 'ស្តាំ' : 'Right')}:</span>
                    <div class="flex items-center rounded border border-input bg-card h-6 overflow-hidden">
                      <button type="button" class="rv-margin-step-btn px-1.5 h-full hover:bg-muted text-foreground cursor-pointer font-bold" data-side="right" data-delta="-2">-</button>
                      <span id="rv-margin-right-val" class="w-7 text-center font-mono text-[11px] font-semibold text-foreground">15</span>
                      <button type="button" class="rv-margin-step-btn px-1.5 h-full hover:bg-muted text-foreground cursor-pointer font-bold" data-side="right" data-delta="2">+</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Zoom Controls -->
          <div id="rv-zoom-controls" class="flex items-center rounded-md border border-input bg-card h-8 p-0.5 gap-1 text-xs font-mono shadow-xs" title="Zoom: Ctrl + Mouse Wheel, or scroll over controls">
            <button type="button" id="rv-btn-zoom-out" class="h-full px-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors" title="Zoom Out (Ctrl + Wheel Down)">
              ${getIcon('zoomOut', 'w-3.5 h-3.5')}
            </button>
            <span id="rv-zoom-label" class="w-12 text-center font-semibold text-foreground text-xs select-none cursor-pointer hover:text-primary transition-colors" title="Click to reset zoom to 100%">${this.settings.zoom}%</span>
            <button type="button" id="rv-btn-zoom-in" class="h-full px-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors" title="Zoom In (Ctrl + Wheel Up)">
              ${getIcon('zoomIn', 'w-3.5 h-3.5')}
            </button>
          </div>

          <!-- Preset Save & Reset Actions -->
          <button type="button" 
                  id="rv-btn-save-preset" 
                  class="h-8 px-3 rounded-md border border-input bg-card hover:bg-muted text-foreground transition-colors flex items-center gap-1.5 font-khmer shadow-xs cursor-pointer text-xs" 
                  title="${t('reportViewer.savePreset') || 'Save Preset'}">
            ${getIcon('save', 'w-3.5 h-3.5 text-primary')}
            <span>${t('reportViewer.savePreset') || 'រក្សាទុក'}</span>
          </button>

          <button type="button" 
                  id="rv-btn-reset-preset" 
                  class="h-8 w-8 rounded-md border border-input bg-card hover:bg-muted text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center shadow-xs cursor-pointer" 
                  title="${t('reportViewer.resetPreset') || 'Reset to Default'}">
            ${getIcon('rotateCcw', 'w-3.5 h-3.5')}
          </button>
        </div>
      </div>

      <!-- 3. Main Workspace: Paper Canvas + Dedicated Slidebar -->
      <div class="report-viewer-body flex-1 flex overflow-hidden relative">
        
        <!-- Center/Left: Paper Scroll Canvas (Workspace Desk) -->
        <div id="rv-scroll-container" class="report-preview-workspace report-viewer-scroll-container flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center bg-muted/40">
          <div id="rv-paper-container" class="report-viewer-paper-scaler transition-transform duration-150 flex flex-col items-center gap-8">
            <div id="rv-paper-sheet" 
                 class="a4-sheet-page report-viewer-sheet bg-white text-black shadow-md rounded-xs border border-zinc-300 relative transition-all duration-150 select-text" 
                 contenteditable="true" 
                 spellcheck="false" 
                 style="outline: none;">
              <div id="rv-paper-content" class="rv-paper-content w-full">
                <div class="py-12 text-center text-muted-foreground text-xs font-khmer">កំពុងរៀបចំទិន្នន័យរបាយការណ៍...</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(this.overlay);

    // Get references
    this.paperElement = this.overlay.querySelector('#rv-paper-sheet');
    this.contentElement = this.overlay.querySelector('#rv-paper-content');
    this.scalerElement = this.overlay.querySelector('#rv-paper-container');
    this.sidebarElement = this.overlay.querySelector('#rv-sidebar');

    // Mount optional extra controls into header slot
    const extraControlsContainer = this.overlay.querySelector('#rv-extra-header-controls');
    if (this.options.renderHeaderControls && extraControlsContainer) {
      this.options.renderHeaderControls(extraControlsContainer, this);
    }
  }

  /**
   * Apply Page Setup strictly to all page wrapper sheets & scaler
   */
  applyPageSetup() {
    if (!this.scalerElement) return;

    const { padding, orientation, zoom } = this.settings;
    const paperSize = (this.settings.paperSize || 'A4').toUpperCase();
    const pad = padding || this.settings.margins || { top: 15, bottom: 15, left: 15, right: 15 };
    const { width: pageW_mm, height: pageH_mm } = getPaperDimensions(paperSize, orientation);

    // Apply exact dimensions and padding to all page sheets
    const sheets = this.scalerElement.querySelectorAll('.a4-sheet-page, .report-viewer-sheet');
    sheets.forEach(sheet => {
      sheet.style.width = `${pageW_mm}mm`;
      sheet.style.height = `${pageH_mm}mm`;
      sheet.style.minHeight = `${pageH_mm}mm`;
      sheet.style.maxHeight = `${pageH_mm}mm`;
      sheet.style.boxSizing = 'border-box';
      sheet.style.paddingTop = `${pad.top}mm`;
      sheet.style.paddingBottom = `${pad.bottom}mm`;
      sheet.style.paddingLeft = `${pad.left}mm`;
      sheet.style.paddingRight = `${pad.right}mm`;
      sheet.style.overflow = 'hidden';
    });

    // Zoom applies ONLY to CSS transform scale on scaler container
    this.scalerElement.style.transform = `scale(${zoom / 100})`;
    this.scalerElement.style.transformOrigin = 'top center';

    // Update UI indicators
    this.syncUIControls();

    // Update dynamic print @page rules
    this.updatePrintStyles();
  }

  /**
   * Synchronize UI inputs with current settings
   */
  syncUIControls() {
    const { orientation, zoom } = this.settings;
    const paperSize = (this.settings.paperSize || 'A4').toUpperCase();
    const pad = this.settings.padding || this.settings.margins || { top: 15, bottom: 15, left: 15, right: 15 };

    // Zoom displays
    const zoomLabel = this.overlay.querySelector('#rv-zoom-label');
    if (zoomLabel) zoomLabel.textContent = `${zoom}%`;

    // Orientation buttons
    const btnPortrait = this.overlay.querySelector('#rv-btn-orient-portrait');
    const btnLandscape = this.overlay.querySelector('#rv-btn-orient-landscape');
    if (btnPortrait && btnLandscape) {
      if (orientation === 'portrait') {
        btnPortrait.className = 'h-full px-2.5 rounded transition-colors cursor-pointer flex items-center bg-primary text-primary-foreground font-semibold shadow-xs';
        btnLandscape.className = 'h-full px-2.5 rounded transition-colors cursor-pointer flex items-center text-muted-foreground hover:text-foreground';
      } else {
        btnPortrait.className = 'h-full px-2.5 rounded transition-colors cursor-pointer flex items-center text-muted-foreground hover:text-foreground';
        btnLandscape.className = 'h-full px-2.5 rounded transition-colors cursor-pointer flex items-center bg-primary text-primary-foreground font-semibold shadow-xs';
      }
    }

    // Paper Size buttons (A4, A3)
    ['a4', 'a3'].forEach(sz => {
      const btn = this.overlay.querySelector(`#rv-btn-size-${sz}`);
      if (btn) {
        if (paperSize === sz.toUpperCase()) {
          btn.className = 'h-full px-2 rounded transition-colors cursor-pointer flex items-center bg-primary text-primary-foreground font-bold shadow-xs';
        } else {
          btn.className = 'h-full px-2 rounded transition-colors cursor-pointer flex items-center text-muted-foreground hover:text-foreground';
        }
      }
    });

    // Margin badge & indicators
    const marginBadge = this.overlay.querySelector('#rv-margin-active-badge');
    const marginSummary = this.overlay.querySelector('#rv-margin-summary');
    const isUniform = pad.top === pad.bottom && pad.top === pad.left && pad.top === pad.right;
    const summaryText = isUniform ? `${pad.top}mm` : `${pad.top}/${pad.right}/${pad.bottom}/${pad.left}mm`;
    if (marginBadge) marginBadge.textContent = summaryText;
    if (marginSummary) marginSummary.textContent = summaryText;

    const topVal = this.overlay.querySelector('#rv-margin-top-val');
    const bottomVal = this.overlay.querySelector('#rv-margin-bottom-val');
    const leftVal = this.overlay.querySelector('#rv-margin-left-val');
    const rightVal = this.overlay.querySelector('#rv-margin-right-val');
    if (topVal) topVal.textContent = String(pad.top);
    if (bottomVal) bottomVal.textContent = String(pad.bottom);
    if (leftVal) leftVal.textContent = String(pad.left);
    if (rightVal) rightVal.textContent = String(pad.right);

    this.overlay.querySelectorAll('.rv-margin-preset-btn').forEach(btn => {
      const m = Number(btn.dataset.margin);
      if (isUniform && pad.top === m) {
        btn.classList.add('font-bold', 'text-primary');
      } else {
        btn.classList.remove('font-bold', 'text-primary');
      }
    });
  }

  /**
   * Update @page rules in print stylesheet
   * NOTE: W3C standard disallows !important inside @page; removing it allows Chromium to switch landscape/portrait automatically.
   */
  updatePrintStyles() {
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'report-viewer-dynamic-print-style';
      document.head.appendChild(this.styleElement);
    }

    const { padding, orientation } = this.settings;
    const paperSize = (this.settings.paperSize || 'A4').toUpperCase();
    const pad = padding || this.settings.margins || { top: 15, bottom: 15, left: 15, right: 15 };
    const { width: pageW_mm, height: pageH_mm } = getPaperDimensions(paperSize, orientation);

    this.styleElement.innerHTML = `
      @media print {
        @page {
          size: ${paperSize} ${orientation};
          margin: 0;
        }
        html, body {
          background-color: #ffffff !important;
          color: #000000 !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        body * {
          visibility: hidden;
        }
        .report-preview-workspace,
        .report-preview-workspace *,
        .a4-sheet-page,
        .a4-sheet-page *,
        .report-viewer-sheet,
        .report-viewer-sheet * {
          visibility: visible;
        }
        body.printing-report-viewer #app,
        body.printing-report-viewer .report-viewer-header,
        body.printing-report-viewer .report-viewer-toolbar,
        body.printing-report-viewer #rv-sidebar,
        body.printing-report-viewer .no-print,
        body.printing-report-viewer button,
        body.printing-report-viewer .rv-resize-handle,
        body.printing-report-viewer .rv-image-toolbar,
        body.printing-report-viewer .rv-page-badge,
        body.printing-report-viewer .rv-textbox-toolbar,
        body.printing-report-viewer .rv-textbox-resize-handle {
          display: none !important;
          visibility: hidden !important;
        }
        body.printing-report-viewer .report-preview-workspace {
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
          overflow: visible !important;
          display: block !important;
        }
        body.printing-report-viewer .report-viewer-paper-scaler {
          transform: none !important;
          width: 100% !important;
          gap: 0 !important;
          display: block !important;
        }
        body.printing-report-viewer .a4-sheet-page,
        body.printing-report-viewer .report-viewer-sheet {
          box-shadow: none !important;
          border: none !important;
          padding: ${pad.top}mm ${pad.right}mm ${pad.bottom}mm ${pad.left}mm !important;
          margin: 0 !important;
          width: ${pageW_mm}mm !important;
          max-width: ${pageW_mm}mm !important;
          height: ${pageH_mm}mm !important;
          max-height: ${pageH_mm}mm !important;
          min-height: ${pageH_mm}mm !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          background: #ffffff !important;
          color: #000000 !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        body.printing-report-viewer .a4-sheet-page:last-child,
        body.printing-report-viewer .report-viewer-sheet:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        body.printing-report-viewer .rv-resizable-image {
          position: absolute !important;
          outline: none !important;
          z-index: 30 !important;
        }
        body.printing-report-viewer .rv-floating-textbox {
          position: absolute !important;
          outline: none !important;
          z-index: 35 !important;
        }
        body.printing-report-viewer .rv-textbox-content {
          border: none !important;
          background: transparent !important;
          outline: none !important;
        }
        body.printing-report-viewer table,
        body.printing-report-viewer tr,
        body.printing-report-viewer th,
        body.printing-report-viewer td,
        body.printing-report-viewer [style*="background-color"] {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body.printing-report-viewer .report-viewer-sheet table,
        body.printing-report-viewer .a4-sheet-page table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        body.printing-report-viewer thead {
          display: table-header-group !important;
        }
        body.printing-report-viewer tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        body.printing-report-viewer .report-viewer-overlay {
          position: static !important;
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
          display: block !important;
          backdrop-filter: none !important;
        }
      }
    `;
  }

  /**
   * Helper to create a discrete A4 physical page sheet
   */
  createPageSheet(pageIndex = 0, pageW_mm = 297, pageH_mm = 210, pad = { top: 15, bottom: 15, left: 15, right: 15 }) {
    const sheet = document.createElement('div');
    sheet.className = 'a4-sheet-page report-viewer-sheet bg-white text-black shadow-md rounded-xs border border-zinc-300 relative transition-all duration-150 select-text';
    sheet.dataset.pageIndex = String(pageIndex);
    sheet.contentEditable = 'true';
    sheet.spellcheck = false;
    sheet.style.outline = 'none';
    sheet.style.width = `${pageW_mm}mm`;
    sheet.style.height = `${pageH_mm}mm`;
    sheet.style.minHeight = `${pageH_mm}mm`;
    sheet.style.maxHeight = `${pageH_mm}mm`;
    sheet.style.boxSizing = 'border-box';
    sheet.style.padding = `${pad.top}mm ${pad.right}mm ${pad.bottom}mm ${pad.left}mm`;
    sheet.style.overflow = 'hidden';
    sheet.style.position = 'relative';

    const inner = document.createElement('div');
    inner.className = 'rv-paper-content w-full h-full';
    sheet.appendChild(inner);
    return sheet;
  }

  /**
   * Automated DOM pagination splitter
   * Splits document content across fixed-dimension A4 sheets
   * @param {HTMLElement} stagingElement
   * @param {number} [pageHeightLimit]
   */
  paginateReportContent(stagingElement, pageHeightLimit) {
    if (!this.scalerElement || !stagingElement) return;

    const { padding, orientation } = this.settings;
    const paperSize = (this.settings.paperSize || 'A4').toUpperCase();
    const pad = padding || this.settings.margins || { top: 15, bottom: 15, left: 15, right: 15 };
    const { width: pageW_mm, height: pageH_mm } = getPaperDimensions(paperSize, orientation);

    // 1mm = 3.779527559px at standard 96 DPI
    const MM_TO_PX = 3.779527559;
    const totalPageHeight = Math.round(pageH_mm * MM_TO_PX);
    const padTop = Math.round(pad.top * MM_TO_PX);
    const padBottom = Math.round(pad.bottom * MM_TO_PX);
    // usableHeight = totalPageHeight - (paddingTop + paddingBottom)
    const usableHeight = pageHeightLimit || Math.max(250, totalPageHeight - (padTop + padBottom) - 25);

    // Measure staging content in offscreen clone
    stagingElement.style.width = `${pageW_mm}mm`;
    stagingElement.style.padding = `${pad.top}mm ${pad.right}mm ${pad.bottom}mm ${pad.left}mm`;
    stagingElement.style.boxSizing = 'border-box';
    stagingElement.style.position = 'absolute';
    stagingElement.style.visibility = 'hidden';
    stagingElement.style.left = '-99999px';
    stagingElement.style.top = '0px';
    document.body.appendChild(stagingElement);

    const rootDoc = stagingElement.firstElementChild || stagingElement;
    const table = stagingElement.querySelector('table');
    const contentH_px = rootDoc.offsetHeight || (stagingElement.scrollHeight - padTop - padBottom);

    // Case 0: Pre-paginated Multi-Page Document (e.g. MoEYS Teacher CV or explicit page templates)
    const explicitPages = stagingElement.querySelectorAll('.teacher-cv-page, .report-explicit-page');
    if (explicitPages.length > 0) {
      this.scalerElement.innerHTML = '';
      explicitPages.forEach((pageEl, idx) => {
        const sheet = this.createPageSheet(idx, pageW_mm, pageH_mm, pad);
        const inner = sheet.querySelector('.rv-paper-content');
        inner.innerHTML = pageEl.innerHTML;
        this.scalerElement.appendChild(sheet);
      });
      stagingElement.remove();

      this.paperElement = this.scalerElement.querySelector('.a4-sheet-page, .report-viewer-sheet');
      this.contentElement = this.paperElement ? this.paperElement.querySelector('.rv-paper-content') : null;
      this.updatePageBadges();
      return;
    }

    // Case 1: Fits entirely on 1 single page
    if (!table || contentH_px <= usableHeight + 15) {
      this.scalerElement.innerHTML = '';
      const sheet = this.createPageSheet(0, pageW_mm, pageH_mm, pad);
      const inner = sheet.querySelector('.rv-paper-content');
      inner.innerHTML = stagingElement.innerHTML;
      this.scalerElement.appendChild(sheet);
      stagingElement.remove();

      this.paperElement = sheet;
      this.contentElement = inner;
      this.updatePageBadges();
      return;
    }

    // Case 2: Multi-Page Table Document
    const tableWrapper = table.closest('.overflow-x-auto') || table;
    const children = Array.from(rootDoc.children);
    const tableIdx = children.indexOf(tableWrapper);
    const beforeTable = tableIdx > 0 ? children.slice(0, tableIdx) : [];
    const afterTable = tableIdx >= 0 ? children.slice(tableIdx + 1) : [];

    this.scalerElement.innerHTML = '';
    let pageIdx = 0;
    let currentSheet = this.createPageSheet(pageIdx, pageW_mm, pageH_mm, pad);
    this.scalerElement.appendChild(currentSheet);
    let currentInner = currentSheet.querySelector('.rv-paper-content');

    let currentDoc = document.createElement('div');
    currentDoc.className = rootDoc.className || 'moeys-report-document max-w-full mx-auto space-y-4';
    currentInner.appendChild(currentDoc);

    // Append top header elements to Page 1
    beforeTable.forEach(el => currentDoc.appendChild(el.cloneNode(true)));

    // Create table on current sheet
    let currentTWrap = document.createElement('div');
    if (tableWrapper.classList.contains('overflow-x-auto')) currentTWrap.className = 'overflow-x-auto';
    let currentT = document.createElement('table');
    currentT.className = table.className;
    const thead = table.querySelector('thead');
    if (thead) currentT.appendChild(thead.cloneNode(true));
    let currentTbody = document.createElement('tbody');
    const tbody = table.querySelector('tbody');
    if (tbody) currentTbody.className = tbody.className;
    currentT.appendChild(currentTbody);
    currentTWrap.appendChild(currentT);
    currentDoc.appendChild(currentTWrap);

    // Distribute table rows across pages
    const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
    rows.forEach(row => {
      const clonedRow = row.cloneNode(true);
      currentTbody.appendChild(clonedRow);

      if (currentDoc.offsetHeight > usableHeight && currentTbody.children.length > 1) {
        clonedRow.remove();

        pageIdx++;
        currentSheet = this.createPageSheet(pageIdx, pageW_mm, pageH_mm, pad);
        this.scalerElement.appendChild(currentSheet);
        currentInner = currentSheet.querySelector('.rv-paper-content');

        currentDoc = document.createElement('div');
        currentDoc.className = rootDoc.className || 'moeys-report-document max-w-full mx-auto space-y-4';
        currentInner.appendChild(currentDoc);

        currentTWrap = document.createElement('div');
        if (tableWrapper.classList.contains('overflow-x-auto')) currentTWrap.className = 'overflow-x-auto';
        currentT = document.createElement('table');
        currentT.className = table.className;
        if (thead) currentT.appendChild(thead.cloneNode(true));
        currentTbody = document.createElement('tbody');
        if (tbody) currentTbody.className = tbody.className;
        currentT.appendChild(currentTbody);
        currentTWrap.appendChild(currentT);
        currentDoc.appendChild(currentTWrap);

        currentTbody.appendChild(clonedRow);
      }
    });

    // Append after-table elements (summary stats and signatures)
    if (afterTable.length > 0) {
      const afterWrap = document.createElement('div');
      afterWrap.className = 'space-y-4 pt-2';
      afterTable.forEach(el => afterWrap.appendChild(el.cloneNode(true)));
      currentDoc.appendChild(afterWrap);

      if (currentDoc.offsetHeight > usableHeight) {
        afterWrap.remove();
        pageIdx++;
        currentSheet = this.createPageSheet(pageIdx, pageW_mm, pageH_mm, pad);
        this.scalerElement.appendChild(currentSheet);
        currentInner = currentSheet.querySelector('.rv-paper-content');

        currentDoc = document.createElement('div');
        currentDoc.className = rootDoc.className || 'moeys-report-document max-w-full mx-auto space-y-4';
        currentDoc.appendChild(afterWrap);
        currentInner.appendChild(currentDoc);
      }
    }

    stagingElement.remove();
    this.paperElement = this.scalerElement.querySelector('.a4-sheet-page, .report-viewer-sheet');
    this.contentElement = this.paperElement ? this.paperElement.querySelector('.rv-paper-content') : null;
    this.updatePageBadges();
  }

  /**
   * Backward-compatible alias for paginateReportContent
   */
  paginateContent(stagingElement) {
    return this.paginateReportContent(stagingElement);
  }

  /**
   * Update page counter badges across all sheets
   */
  updatePageBadges() {
    if (!this.scalerElement) return;
    const sheets = this.scalerElement.querySelectorAll('.a4-sheet-page, .report-viewer-sheet');
    sheets.forEach((sh, idx) => {
      sh.querySelectorAll('.rv-page-badge').forEach(b => b.remove());
      const badge = document.createElement('div');
      badge.className = 'rv-page-badge absolute bottom-2 right-4 text-[10px] text-zinc-400 font-mono select-none pointer-events-none';
      badge.textContent = `ទំព័រទី ${toKhmerNumerals(idx + 1)} / Page ${idx + 1}`;
      sh.appendChild(badge);
    });
  }

  /**
   * Check whether any sheet has overflowed and trigger re-pagination pass
   */
  checkAndRepaginateIfNeeded() {
    if (!this.scalerElement) return;
    const sheets = Array.from(this.scalerElement.querySelectorAll('.a4-sheet-page, .report-viewer-sheet'));
    let hasOverflow = false;
    for (const sheet of sheets) {
      const inner = sheet.querySelector('.rv-paper-content');
      if (inner && inner.scrollHeight > sheet.clientHeight - 10) {
        hasOverflow = true;
        break;
      }
    }
    if (hasOverflow) {
      this.repaginateFromCurrentSheets();
    }
  }

  /**
   * Reconstruct the full unpaginated document HTML from current sheets,
   * capturing all user-edited text, table cells, headers, and footer elements across all pages.
   * @returns {string}
   */
  getCurrentDocumentHtml() {
    if (!this.scalerElement) return '';
    const sheets = Array.from(this.scalerElement.querySelectorAll('.a4-sheet-page, .report-viewer-sheet'));
    if (sheets.length === 0) {
      return this.contentElement ? this.contentElement.innerHTML : '';
    }

    // Check if explicit multi-page document (e.g. MoEYS Teacher CV)
    const isExplicitMultiPage = sheets.some(sh => sh.querySelector('.teacher-cv-page, [class*="teacher-cv"]') || sh.classList.contains('teacher-cv-page'));
    if (isExplicitMultiPage || (sheets.length > 1 && !sheets[0].querySelector('.moeys-report-document table'))) {
      const pageHtmls = sheets.map((sh, idx) => {
        const inner = sh.querySelector('.rv-paper-content') || sh;
        const clone = inner.cloneNode(true);
        clone.querySelectorAll('.rv-page-badge, .rv-floating-textbox, .rv-resizable-image').forEach(el => el.remove());
        return `<div class="teacher-cv-page teacher-cv-page-${idx + 1} a4-sheet-page relative bg-white mx-auto box-border">${clone.innerHTML}</div>`;
      });
      return `<div class="teacher-cv-document font-siemreap text-black text-[13px] leading-[1.65] select-text">${pageHtmls.join('\n')}</div>`;
    }

    if (sheets.length === 1) {
      const doc = sheets[0].querySelector('.moeys-report-document') || sheets[0].querySelector('.rv-paper-content');
      if (!doc) return sheets[0].innerHTML;
      const clone = doc.cloneNode(true);
      clone.querySelectorAll('.rv-page-badge, .rv-floating-textbox, .rv-resizable-image').forEach(el => el.remove());
      return clone.outerHTML;
    }

    // Multi-page document: merge distributed sheets back into a single document structure
    const firstDoc = sheets[0].querySelector('.moeys-report-document') || sheets[0].querySelector('.rv-paper-content');
    if (!firstDoc) {
      return this.contentElement ? this.contentElement.innerHTML : '';
    }

    const rootClone = firstDoc.cloneNode(true);
    rootClone.querySelectorAll('.rv-page-badge, .rv-floating-textbox, .rv-resizable-image').forEach(el => el.remove());

    const tableInRoot = rootClone.querySelector('table');
    const tbodyInRoot = tableInRoot ? tableInRoot.querySelector('tbody') : null;

    for (let i = 1; i < sheets.length; i++) {
      const sheetDoc = sheets[i].querySelector('.moeys-report-document') || sheets[i].querySelector('.rv-paper-content');
      if (!sheetDoc) continue;

      const nextTable = sheetDoc.querySelector('table');
      if (nextTable && tbodyInRoot) {
        const nextTbody = nextTable.querySelector('tbody');
        if (nextTbody) {
          Array.from(nextTbody.children).forEach(tr => {
            tbodyInRoot.appendChild(tr.cloneNode(true));
          });
        }
      }

      // If this sheet has elements after the table, append them to rootClone
      if (nextTable) {
        const tableWrap = nextTable.closest('.overflow-x-auto') || nextTable;
        let sib = tableWrap.nextElementSibling;
        while (sib) {
          if (!sib.classList.contains('rv-page-badge') && !sib.classList.contains('rv-floating-textbox') && !sib.classList.contains('rv-resizable-image')) {
            rootClone.appendChild(sib.cloneNode(true));
          }
          sib = sib.nextElementSibling;
        }
      } else {
        // No table on this sheet (e.g. final sheet containing statistics, signatures, notes)
        Array.from(sheetDoc.children).forEach(child => {
          if (!child.classList.contains('rv-page-badge') && !child.classList.contains('rv-floating-textbox') && !child.classList.contains('rv-resizable-image')) {
            rootClone.appendChild(child.cloneNode(true));
          }
        });
      }
    }

    return rootClone.outerHTML;
  }

  /**
   * Re-paginate content reconstructed from existing multi-page sheets
   */
  repaginateFromCurrentSheets() {
    if (!this.scalerElement) return;
    const sheets = Array.from(this.scalerElement.querySelectorAll('.a4-sheet-page, .report-viewer-sheet'));
    if (sheets.length === 0) return;

    const imagesSnapshot = this.getFloatingImagesSnapshot();
    const staging = document.createElement('div');
    staging.className = 'w-full';

    // Handle explicit multi-page templates (e.g. Teacher CV)
    const isExplicitMultiPage = sheets.some(sh => sh.querySelector('.teacher-cv-page, [class*="teacher-cv"]') || sh.classList.contains('teacher-cv-page'));
    if (isExplicitMultiPage) {
      const pageHtmls = sheets.map((sh, idx) => {
        const inner = sh.querySelector('.rv-paper-content') || sh;
        return `<div class="teacher-cv-page teacher-cv-page-${idx + 1} a4-sheet-page relative bg-white mx-auto box-border">${inner.innerHTML}</div>`;
      });
      staging.innerHTML = `<div class="teacher-cv-document font-siemreap text-black text-[13px] leading-[1.65] select-text">${pageHtmls.join('\n')}</div>`;
      this.paginateReportContent(staging);
      this.restoreFloatingImagesFromSnapshot(imagesSnapshot);
      this.bindAllResizableImages();
      this.bindAllFloatingTextBoxes();
      this.applyPageSetup();
      return;
    }

    const firstDoc = sheets[0].querySelector('.moeys-report-document') || sheets[0].querySelector('.rv-paper-content');
    if (!firstDoc) return;

    const rootClone = firstDoc.cloneNode(true);
    const tableInRoot = rootClone.querySelector('table');
    const tbodyInRoot = tableInRoot ? tableInRoot.querySelector('tbody') : null;

    if (tbodyInRoot && sheets.length > 1) {
      for (let i = 1; i < sheets.length; i++) {
        const nextSheetTable = sheets[i].querySelector('table');
        if (nextSheetTable) {
          const nextTbody = nextSheetTable.querySelector('tbody');
          if (nextTbody) {
            Array.from(nextTbody.children).forEach(tr => {
              tbodyInRoot.appendChild(tr.cloneNode(true));
            });
          }
        }
        if (i === sheets.length - 1) {
          const lastDoc = sheets[i].querySelector('.moeys-report-document') || sheets[i].querySelector('.rv-paper-content');
          if (lastDoc) {
            const tableWrap = lastDoc.querySelector('table')?.closest('.overflow-x-auto') || lastDoc.querySelector('table');
            if (tableWrap && tableWrap.nextElementSibling) {
              let sib = tableWrap.nextElementSibling;
              while (sib) {
                rootClone.appendChild(sib.cloneNode(true));
                sib = sib.nextElementSibling;
              }
            }
          }
        }
      }
    }

    staging.appendChild(rootClone);
    this.paginateReportContent(staging);
    this.restoreFloatingImagesFromSnapshot(imagesSnapshot);
    this.bindAllResizableImages();
    this.bindAllFloatingTextBoxes();
    this.applyPageSetup();
  }

  /**
   * Render or restore report content
   */
  async refreshContent(forceFresh = false) {
    if (!this.scalerElement) return;

    if (forceFresh) {
      this.savedHtmlContent = null;
    }

    if (this.options.renderContent) {
      const staging = document.createElement('div');
      staging.className = 'w-full';
      await this.options.renderContent(staging, this);
      this.paginateContent(staging);
      this.normalizeContentText();
      this.applyPageSetup();
      // Re-apply persisted table row height & column widths across all sheets
      this.applySavedTableFormatting();
      this.restoreSavedFloatingImages(forceFresh);
      this.restoreSavedFloatingTextBoxes(forceFresh);
      this.bindAllResizableImages();
      this.bindAllFloatingTextBoxes();
      return;
    }

    // Fallback for static HTML without renderContent callback
    if (this.savedHtmlContent) {
      if (this.savedHtmlContent.includes('report-viewer-sheet')) {
        this.scalerElement.innerHTML = typeof this.savedHtmlContent === 'string' ? this.savedHtmlContent.normalize('NFC') : this.savedHtmlContent;
        this.paperElement = this.scalerElement.querySelector('.report-viewer-sheet');
        this.contentElement = this.paperElement ? this.paperElement.querySelector('.rv-paper-content') : null;
      } else {
        const staging = document.createElement('div');
        staging.innerHTML = typeof this.savedHtmlContent === 'string' ? this.savedHtmlContent.normalize('NFC') : this.savedHtmlContent;
        this.paginateContent(staging);
      }
      this.normalizeContentText();
      this.applyPageSetup();
      // Re-apply persisted table row height & column widths across all sheets
      this.applySavedTableFormatting();
      this.restoreSavedFloatingImages(forceFresh);
      this.restoreSavedFloatingTextBoxes(forceFresh);
      this.bindAllResizableImages();
      this.bindAllFloatingTextBoxes();
      return;
    }
  }

  /**
   * Restore saved floating images (stamps, signatures, logos) onto paper canvas
   * @param {boolean} forceFresh
   */
  restoreSavedFloatingImages(forceFresh = false) {
    if (!this.scalerElement) return;

    const sheets = this.scalerElement.querySelectorAll('.report-viewer-sheet');
    if (sheets.length === 0) return;

    // Clear any existing floating images if restoring
    sheets.forEach(sh => sh.querySelectorAll('.rv-resizable-image').forEach(w => w.remove()));

    if (forceFresh || !Array.isArray(this.savedImages) || this.savedImages.length === 0) {
      return;
    }

    this.savedImages.forEach(imgData => {
      if (!imgData || !imgData.src) return;
      const targetSheet = sheets[imgData.pageIndex || 0] || sheets[0];
      const wrapper = document.createElement('div');
      wrapper.className = 'rv-resizable-image group select-none';
      wrapper.style.position = 'absolute';
      wrapper.style.left = imgData.left || '100px';
      wrapper.style.top = imgData.top || '100px';
      wrapper.style.width = imgData.width || '140px';
      wrapper.style.zIndex = '30';
      wrapper.contentEditable = 'false';
      wrapper.innerHTML = `
        <img src="${imgData.src}" class="w-full h-auto object-contain select-none block pointer-events-none" />
        <div class="rv-image-toolbar absolute -top-8 left-0 hidden group-hover:flex items-center gap-1 bg-popover/95 backdrop-blur border border-border rounded shadow-md px-1.5 py-0.5 text-xs z-30">
          <button type="button" class="rv-img-delete-btn px-2 py-0.5 rounded hover:bg-destructive/20 text-destructive text-[11px] font-bold cursor-pointer" title="Delete Image">✕ លុប</button>
        </div>
        <span class="rv-resize-handle absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary border-2 border-white rounded-full cursor-se-resize shadow opacity-0 group-hover:opacity-100 transition-opacity z-20" title="Drag to resize"></span>
      `;
      targetSheet.appendChild(wrapper);
      this.bindResizableImage(wrapper);
    });
  }

  /**
   * Restore floating textboxes from saved metadata
   */
  restoreSavedFloatingTextBoxes(forceFresh = false) {
    if (!this.scalerElement) return;

    const sheets = this.scalerElement.querySelectorAll('.report-viewer-sheet');
    if (sheets.length === 0) return;

    // Clear existing textboxes to avoid duplicate accumulation
    sheets.forEach(sh => sh.querySelectorAll('.rv-floating-textbox').forEach(w => w.remove()));

    if (forceFresh || !Array.isArray(this.savedTextBoxes) || this.savedTextBoxes.length === 0) {
      return;
    }

    this.savedTextBoxes.forEach(boxData => {
      if (!boxData || boxData.html === undefined) return;
      const targetSheet = sheets[boxData.pageIndex || 0] || sheets[0];
      const wrapper = document.createElement('div');
      wrapper.className = 'rv-floating-textbox group select-none relative';
      wrapper.style.position = 'absolute';
      wrapper.style.zIndex = '35';
      wrapper.style.left = boxData.left || '100px';
      wrapper.style.top = boxData.top || '100px';
      if (boxData.width) {
        wrapper.style.width = boxData.width;
      } else {
        wrapper.style.minWidth = boxData.minWidth || '140px';
      }

      const fontSize = boxData.fontSize ? (boxData.fontSize.includes('px') ? boxData.fontSize : `${boxData.fontSize}px !important`) : `${this.settings.defaultFontSize || 10}px !important`;
      const fontFamily = boxData.fontFamily || "'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif";
      const lineHeight = boxData.lineHeight || '1.5';

      wrapper.innerHTML = `
        <div class="rv-textbox-toolbar absolute -top-8 left-0 hidden group-hover:flex items-center gap-1 bg-popover/95 backdrop-blur border border-border rounded shadow-md px-1.5 py-0.5 text-xs z-40 select-none print:hidden">
          <span class="rv-drag-handle cursor-move px-1 py-0.5 text-muted-foreground hover:text-foreground font-mono text-[11px]" title="Drag to move">⋮⋮</span>
          <div class="h-3 w-px bg-border"></div>
          <button type="button" class="rv-textbox-delete-btn px-1.5 py-0.5 rounded hover:bg-destructive/20 text-destructive text-[10px] font-bold cursor-pointer" title="Delete Textbox">✕ លុប</button>
        </div>
        <div class="rv-textbox-content p-1.5 rounded border border-dashed border-primary/40 hover:border-primary focus-within:border-primary bg-background/80 hover:bg-background outline-none transition-colors"
             contenteditable="true"
             spellcheck="false"
             style="font-size: ${fontSize}; font-family: ${fontFamily}; line-height: ${lineHeight};">
          ${boxData.html}
        </div>
        <span class="rv-textbox-resize-handle absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-primary/80 hover:bg-primary border-2 border-white rounded-full cursor-se-resize shadow opacity-0 group-hover:opacity-100 transition-opacity z-20 print:hidden" title="Drag to resize"></span>
      `;

      targetSheet.appendChild(wrapper);
      this.bindFloatingTextBox(wrapper);
    });
  }

  /**
   * Unicode NFC Normalization: normalizes text nodes to fix detached subscript feet & vowels
   * @param {Node} [root=this.contentElement]
   */
  normalizeContentText(root = this.contentElement) {
    if (!root) return;
    try {
      if (root.nodeType === Node.TEXT_NODE) {
        if (root.nodeValue) root.nodeValue = root.nodeValue.normalize('NFC');
        return;
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      let textNode;
      while ((textNode = walker.nextNode())) {
        if (textNode.nodeValue) {
          textNode.nodeValue = textNode.nodeValue.normalize('NFC');
        }
      }
    } catch (err) {
      console.warn('Text normalization failed:', err);
    }
  }

  /**
   * Clear all multi-selected elements
   */
  clearMultiSelection() {
    this.multiSelectedElements.forEach(el => {
      if (el && el.classList) {
        el.classList.remove('rv-multi-selected');
      }
    });
    this.multiSelectedElements.clear();
    this.updateSelectionStatus(this.currentRange && !this.currentRange.collapsed ? this.currentRange.toString().trim() : '');
  }

  /**
   * Capture active selection Range
   */
  captureSelection() {
    if (this.isApplyingStyle) return;

    // If multiSelectedElements has elements and range is collapsed or empty, retain multi-select status
    if (this.multiSelectedElements.size > 0) {
      this.updateSelectionStatus();
      return;
    }

    const sel = window.getSelection();
    const container = this.scalerElement || this.paperElement;
    if (sel && sel.rangeCount > 0 && container && container.contains(sel.anchorNode)) {
      this.currentRange = sel.getRangeAt(0).cloneRange();

      if (!sel.isCollapsed && sel.toString().trim().length > 0) {
        this.hasActiveSelection = true;
        this.updateSelectionStatus(sel.toString().trim());

        // Auto-detect font family, font size, bold/italic/color, and nudge position
        const targetNode = this.currentRange.startContainer;
        const targetEl = targetNode.nodeType === Node.TEXT_NODE ? targetNode.parentElement : targetNode;
        if (targetEl) {
          const cell = targetEl.closest('td, th');
          if (cell) {
            this.currentTableCell = cell;
            this.currentTableRow = cell.closest('tr');
            this.currentTable = cell.closest('table');
            this.updateCellInfoUI();
          }
          this.syncSelectionStyles(targetEl);
        }
        return;
      }

      // If clicked inside text with a collapsed caret
      this.hasActiveSelection = false;
      const targetNode = sel.anchorNode;
      const targetEl = targetNode ? (targetNode.nodeType === Node.TEXT_NODE ? targetNode.parentElement : targetNode) : null;
      if (targetEl) {
        const cell = targetEl.closest('td, th');
        if (cell) {
          this.currentTableCell = cell;
          this.currentTableRow = cell.closest('tr');
          this.currentTable = cell.closest('table');
          this.updateCellInfoUI();
        }
        this.syncSelectionStyles(targetEl);
      }
      return;
    }

    // If click inside paper collapsed caret
    if (document.activeElement === this.paperElement) {
      this.currentRange = null;
      this.hasActiveSelection = false;
      this.updateSelectionStatus('');
    }
  }

  /**
   * Restore active selection Range
   */
  restoreSelection() {
    if (this.currentRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(this.currentRange.cloneRange());
    }
  }

  /**
   * Update selection indicator in UI
   */
  updateSelectionStatus() {
    // Selection indicator badge removed per user request
  }

  /**
   * Update active table cell indicator info
   */
  updateCellInfoUI() {
    const info = this.overlay?.querySelector('#rv-selected-cell-info');
    const colInfo = this.overlay?.querySelector('#rv-selected-col-info');
    const display = this.overlay?.querySelector('#rv-tb-col-width-display');
    const isKm = i18n.getLocale() === 'km';

    if (this.currentTableCell) {
      const colIdx = this.currentTableCell.cellIndex !== undefined ? this.currentTableCell.cellIndex : 0;
      const rowIdx = this.currentTableRow?.rowIndex !== undefined ? this.currentTableRow.rowIndex + 1 : '';
      if (info) info.textContent = `(Row ${rowIdx}, Col ${colIdx + 1})`;
      
      const savedWidth = this.savedColumnWidths && this.savedColumnWidths[colIdx];
      const actualWidth = savedWidth || this.currentTableCell.style.width || `${this.currentTableCell.offsetWidth}px`;
      
      if (colInfo) {
        colInfo.textContent = `(Col ${colIdx + 1}: ${actualWidth})`;
      }
      if (display) {
        display.textContent = savedWidth || (isKm ? 'ស្វ័យប្រវត្តិ' : 'Auto');
      }
    } else {
      if (info) info.textContent = '';
      if (colInfo) colInfo.textContent = '';
      if (display) display.textContent = isKm ? 'ស្វ័យប្រវត្តិ' : 'Auto';
    }
  }

  /**
   * Save snapshot of content, floating images, and floating textboxes for Undo
   */
  saveStateForUndo() {
    if (!this.scalerElement) return;
    const currentHtml = this.scalerElement.innerHTML;
    const currentImages = this.getFloatingImagesSnapshot();
    const currentTextBoxes = this.getFloatingTextBoxesSnapshot();
    const snapshot = {
      html: currentHtml,
      images: currentImages,
      textBoxes: currentTextBoxes
    };

    if (this.undoStack.length > 0) {
      const last = this.undoStack[this.undoStack.length - 1];
      const lastHtml = typeof last === 'string' ? last : last.html;
      const lastImagesJson = typeof last === 'object' && Array.isArray(last.images) ? JSON.stringify(last.images) : '[]';
      const lastBoxesJson = typeof last === 'object' && Array.isArray(last.textBoxes) ? JSON.stringify(last.textBoxes) : '[]';
      if (lastHtml === snapshot.html && lastImagesJson === JSON.stringify(snapshot.images) && lastBoxesJson === JSON.stringify(snapshot.textBoxes)) {
        return;
      }
    }
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateUndoRedoUI();
  }

  /**
   * Get serialized array of all floating resizable images across all page sheets
   */
  getFloatingImagesSnapshot() {
    if (!this.scalerElement) return [];
    const images = [];
    const sheets = this.scalerElement.querySelectorAll('.report-viewer-sheet');
    sheets.forEach((sheet, pageIdx) => {
      sheet.querySelectorAll('.rv-resizable-image').forEach(imgWrapper => {
        const img = imgWrapper.querySelector('img');
        if (img && img.src) {
          images.push({
            src: img.src,
            left: imgWrapper.style.left || '0px',
            top: imgWrapper.style.top || '0px',
            width: imgWrapper.style.width || '140px',
            pageIndex: pageIdx
          });
        }
      });
    });
    return images;
  }

  /**
   * Restore floating resizable images from serialized snapshot
   */
  restoreFloatingImagesFromSnapshot(images) {
    this.savedImages = Array.isArray(images) ? JSON.parse(JSON.stringify(images)) : [];
    this.restoreSavedFloatingImages(false);
  }

  /**
   * Get serialized array of all floating textboxes across all page sheets
   */
  getFloatingTextBoxesSnapshot() {
    if (!this.scalerElement) return [];
    const boxes = [];
    const sheets = this.scalerElement.querySelectorAll('.report-viewer-sheet');
    sheets.forEach((sheet, pageIdx) => {
      sheet.querySelectorAll('.rv-floating-textbox').forEach(boxWrapper => {
        const contentEl = boxWrapper.querySelector('.rv-textbox-content');
        if (contentEl) {
          boxes.push({
            html: contentEl.innerHTML,
            left: boxWrapper.style.left || '0px',
            top: boxWrapper.style.top || '0px',
            width: boxWrapper.style.width || '',
            minWidth: boxWrapper.style.minWidth || '140px',
            fontSize: contentEl.style.fontSize || '',
            fontFamily: contentEl.style.fontFamily || '',
            lineHeight: contentEl.style.lineHeight || '',
            pageIndex: pageIdx
          });
        }
      });
    });
    return boxes;
  }

  /**
   * Restore floating textboxes from serialized snapshot
   */
  restoreFloatingTextBoxesFromSnapshot(boxes) {
    this.savedTextBoxes = Array.isArray(boxes) ? JSON.parse(JSON.stringify(boxes)) : [];
    this.restoreSavedFloatingTextBoxes(false);
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.undoStack.length === 0 || !this.scalerElement) return;
    const currentSnapshot = {
      html: this.scalerElement.innerHTML,
      images: this.getFloatingImagesSnapshot(),
      textBoxes: this.getFloatingTextBoxesSnapshot()
    };
    this.redoStack.push(currentSnapshot);
    const prevState = this.undoStack.pop();
    if (prevState) {
      this.scalerElement.innerHTML = typeof prevState === 'string' ? prevState : (prevState.html || '');
      this.paperElement = this.scalerElement.querySelector('.report-viewer-sheet');
      this.contentElement = this.paperElement ? this.paperElement.querySelector('.rv-paper-content') : null;
      this.normalizeContentText();
      if (typeof prevState === 'object' && Array.isArray(prevState.images)) {
        this.restoreFloatingImagesFromSnapshot(prevState.images);
      }
      if (typeof prevState === 'object' && Array.isArray(prevState.textBoxes)) {
        this.restoreFloatingTextBoxesFromSnapshot(prevState.textBoxes);
      }
      this.bindAllResizableImages();
      this.bindAllFloatingTextBoxes();
      this.updateUndoRedoUI();
      this.autoSaveIfEnabled();
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'មិនធ្វើវិញ (Undo)' : 'Undo');
    }
  }

  /**
   * Redo previously undone action
   */
  redo() {
    if (this.redoStack.length === 0 || !this.scalerElement) return;
    const currentSnapshot = {
      html: this.scalerElement.innerHTML,
      images: this.getFloatingImagesSnapshot(),
      textBoxes: this.getFloatingTextBoxesSnapshot()
    };
    this.undoStack.push(currentSnapshot);
    const nextState = this.redoStack.pop();
    if (nextState) {
      this.scalerElement.innerHTML = typeof nextState === 'string' ? nextState : (nextState.html || '');
      this.paperElement = this.scalerElement.querySelector('.report-viewer-sheet');
      this.contentElement = this.paperElement ? this.paperElement.querySelector('.rv-paper-content') : null;
      this.normalizeContentText();
      if (typeof nextState === 'object' && Array.isArray(nextState.images)) {
        this.restoreFloatingImagesFromSnapshot(nextState.images);
      }
      if (typeof nextState === 'object' && Array.isArray(nextState.textBoxes)) {
        this.restoreFloatingTextBoxesFromSnapshot(nextState.textBoxes);
      }
      this.bindAllResizableImages();
      this.bindAllFloatingTextBoxes();
      this.updateUndoRedoUI();
      this.autoSaveIfEnabled();
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'ធ្វើវិញ (Redo)' : 'Redo');
    }
  }

  /**
   * Update Undo/Redo button disabled states
   */
  updateUndoRedoUI() {
    const btnUndo = this.overlay?.querySelector('#rv-btn-undo');
    const btnRedo = this.overlay?.querySelector('#rv-btn-redo');
    if (btnUndo) {
      btnUndo.disabled = this.undoStack.length === 0;
    }
    if (btnRedo) {
      btnRedo.disabled = this.redoStack.length === 0;
    }
  }

  /**
   * 1. TABLE CELL / ROW SHADING TOOL
   * Apply background color shading strictly to selected table cell, row, or multi-selected cells
   * @param {string} color
   */
  applyShading(color) {
    this.saveStateForUndo();

    // If multiple elements are selected via Ctrl/Cmd/Shift+click
    if (this.multiSelectedElements.size > 0) {
      let appliedCount = 0;
      this.multiSelectedElements.forEach(el => {
        const cell = el.closest('td, th') || (el.tagName === 'TD' || el.tagName === 'TH' ? el : null);
        if (cell) {
          if (color === 'transparent') {
            cell.style.removeProperty('background-color');
          } else {
            cell.style.setProperty('background-color', color, 'important');
            cell.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
            cell.style.setProperty('print-color-adjust', 'exact', 'important');
          }
          appliedCount++;
        }
      });
      if (appliedCount > 0) {
        this.autoSaveIfEnabled();
        return;
      }
    }

    // Resolve target cell / row from current tracking or selection
    if (!this.currentTableCell && !this.currentTableRow) {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const node = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode;
        this.currentTableCell = node?.closest('td, th');
        this.currentTableRow = this.currentTableCell?.closest('tr');
        this.currentTable = this.currentTableCell?.closest('table');
      }
    }

    if (!this.currentTableCell && !this.currentTableRow) {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមចុចលើក្រឡា ឬជួរដេកនៃតារាងជាមុនសិន' : 'Please click on a table cell or row first');
      return;
    }

    if (this.shadingTargetMode === 'row' && this.currentTableRow) {
      const cells = this.currentTableRow.querySelectorAll('td, th');
      cells.forEach(c => {
        if (color === 'transparent') {
          c.style.removeProperty('background-color');
        } else {
          c.style.setProperty('background-color', color, 'important');
          c.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
          c.style.setProperty('print-color-adjust', 'exact', 'important');
        }
      });
    } else if (this.currentTableCell) {
      if (color === 'transparent') {
        this.currentTableCell.style.removeProperty('background-color');
      } else {
        this.currentTableCell.style.setProperty('background-color', color, 'important');
        this.currentTableCell.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
        this.currentTableCell.style.setProperty('print-color-adjust', 'exact', 'important');
      }
    }

    this.autoSaveIfEnabled();
  }

  /**
   * Apply all saved table styles (row padding, column widths) across all tables in all sheets
   */
  applySavedTableFormatting() {
    if (!this.scalerElement) return;
    const tables = this.scalerElement.querySelectorAll('table');
    if (tables.length === 0) return;

    const pad = Math.max(2, Math.min(40, parseInt(this.currentRowPadding, 10) || 8));
    this.currentRowPadding = pad;

    const hasColWidths = this.savedColumnWidths && typeof this.savedColumnWidths === 'object' && Object.keys(this.savedColumnWidths).length > 0;

    tables.forEach(table => {
      // 1. Apply Row Padding
      table.querySelectorAll('th, td').forEach(c => {
        c.style.setProperty('padding-top', `${pad}px`, 'important');
        c.style.setProperty('padding-bottom', `${pad}px`, 'important');
      });

      // 2. Apply Column Widths
      if (hasColWidths) {
        table.style.setProperty('table-layout', 'auto', 'important');
        const entries = Object.entries(this.savedColumnWidths);
        for (let r = 0; r < table.rows.length; r++) {
          const row = table.rows[r];
          entries.forEach(([cIdxStr, widthStr]) => {
            const cIdx = parseInt(cIdxStr, 10);
            if (!isNaN(cIdx) && row.cells[cIdx]) {
              const cell = row.cells[cIdx];
              cell.style.setProperty('width', widthStr, 'important');
              cell.style.setProperty('min-width', widthStr, 'important');
              cell.style.setProperty('max-width', widthStr, 'important');
            }
          });
        }
      }
    });

    // Update Toolbar Display
    const rowDisplay = this.overlay?.querySelector('#rv-row-height-val');
    const tbRowDisplay = this.overlay?.querySelector('#rv-tb-row-pad-display');
    if (rowDisplay) rowDisplay.textContent = `${pad}px`;
    if (tbRowDisplay) tbRowDisplay.textContent = `${pad}px`;
  }

  /**
   * 2. ROW / TABLE HEIGHT ADJUSTER
   * Adjust vertical padding / row height of table
   * @param {number|string} padPx
   */
  applyRowPadding(padPx) {
    this.saveStateForUndo();

    const pad = Math.max(2, Math.min(40, parseInt(padPx, 10) || 8));
    this.currentRowPadding = pad;

    this.applySavedTableFormatting();
    this.checkAndRepaginateIfNeeded();
    this.autoSaveIfEnabled();
  }

  /**
   * 2b. COLUMN WIDTH ADJUSTER
   * Adjust width of focused / selected table column(s)
   * @param {number|string} widthVal - 'auto' or pixel number
   */
  applyColumnWidth(widthVal) {
    let table = this.currentTable;
    if (!table && this.scalerElement) {
      table = this.scalerElement.querySelector('table');
    }
    if (!table) {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមចុចលើតារាងជាមុនសិន' : 'Please click on a table first');
      return;
    }

    this.saveStateForUndo();

    let targetCols = new Set();
    if (this.currentTableCell && this.currentTableCell.cellIndex !== undefined) {
      targetCols.add(this.currentTableCell.cellIndex);
    }
    if (this.multiSelectedElements.size > 0) {
      this.multiSelectedElements.forEach(el => {
        const c = el.closest('td, th');
        if (c && c.cellIndex !== undefined) targetCols.add(c.cellIndex);
      });
    }
    if (targetCols.size === 0) {
      targetCols.add(0);
    }

    if (!this.savedColumnWidths || typeof this.savedColumnWidths !== 'object') {
      this.savedColumnWidths = {};
    }

    const isAuto = widthVal === 'auto';
    const parsedWidth = isAuto ? null : Math.max(25, Math.min(800, parseInt(widthVal, 10) || 100));

    targetCols.forEach(colIdx => {
      if (isAuto) {
        delete this.savedColumnWidths[colIdx];
      } else {
        this.savedColumnWidths[colIdx] = `${parsedWidth}px`;
      }
    });

    if (isAuto) {
      const tables = this.scalerElement ? this.scalerElement.querySelectorAll('table') : [table];
      tables.forEach(t => {
        for (let r = 0; r < t.rows.length; r++) {
          const row = t.rows[r];
          targetCols.forEach(colIdx => {
            const cell = row.cells[colIdx];
            if (cell) {
              cell.style.removeProperty('width');
              cell.style.removeProperty('min-width');
              cell.style.removeProperty('max-width');
            }
          });
        }
      });
    }

    this.applySavedTableFormatting();
    this.updateCellInfoUI();
    this.checkAndRepaginateIfNeeded();
    this.autoSaveIfEnabled();
  }

  /**
   * 3. INTERACTIVE IMAGE INSERTER (Stamps / Signatures / Logos)
   * Insert resizable image into report canvas
   * @param {string} dataUrl
   */
  insertImageFromDataUrl(dataUrl) {
    if (!dataUrl || !this.scalerElement) return;

    const sheets = this.scalerElement.querySelectorAll('.report-viewer-sheet');
    const targetSheet = sheets[sheets.length - 1] || this.paperElement;
    if (!targetSheet) return;

    this.saveStateForUndo();

    const wrapper = document.createElement('div');
    wrapper.className = 'rv-resizable-image group select-none';
    wrapper.style.position = 'absolute';
    wrapper.style.width = '140px';
    wrapper.style.zIndex = '30';

    // Position image in comfortable visible center-top area of target paper sheet
    const paperW = targetSheet.clientWidth || 794;
    const paperH = targetSheet.clientHeight || 1123;
    const initLeft = Math.max(20, Math.round((paperW - 140) / 2));
    const initTop = Math.max(40, Math.min(paperH - 180, 160));

    wrapper.style.left = `${initLeft}px`;
    wrapper.style.top = `${initTop}px`;
    wrapper.contentEditable = 'false';
    wrapper.innerHTML = `
      <img src="${dataUrl}" class="w-full h-auto object-contain select-none block pointer-events-none" />
      <div class="rv-image-toolbar absolute -top-8 left-0 hidden group-hover:flex items-center gap-1 bg-popover/95 backdrop-blur border border-border rounded shadow-md px-1.5 py-0.5 text-xs z-30">
        <button type="button" class="rv-img-delete-btn px-2 py-0.5 rounded hover:bg-destructive/20 text-destructive text-[11px] font-bold cursor-pointer" title="Delete Image">✕ លុប</button>
      </div>
      <span class="rv-resize-handle absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary border-2 border-white rounded-full cursor-se-resize shadow opacity-0 group-hover:opacity-100 transition-opacity z-20" title="Drag to resize"></span>
    `;

    // Always attach to sheet as an overlay layer so it NEVER affects text flow or paper dimensions
    targetSheet.appendChild(wrapper);

    this.bindResizableImage(wrapper);
    this.autoSaveIfEnabled();
    const isKm = i18n.getLocale() === 'km';
    toast.success(isKm ? 'បានបញ្ចូលរូបភាពដោយជោគជ័យ' : 'Image inserted successfully');
  }

  /**
   * Bind event handlers for all resizable images in report sheets
   */
  bindAllResizableImages() {
    if (!this.scalerElement) return;
    this.scalerElement.querySelectorAll('.rv-resizable-image').forEach(w => {
      this.bindResizableImage(w);
    });
  }

  /**
   * Bind resize drag and control events to a resizable image wrapper
   * @param {HTMLElement} wrapper
   */
  bindResizableImage(wrapper) {
    if (!wrapper || wrapper.dataset.bound === 'true') return;
    wrapper.dataset.bound = 'true';

    // Mouse drag-to-move repositioning event
    wrapper.addEventListener('mousedown', (e) => {
      // Don't drag if clicking resize handle or toolbar buttons
      if (e.target.closest('.rv-resize-handle') || e.target.closest('.rv-image-toolbar')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const allImages = this.scalerElement ? this.scalerElement.querySelectorAll('.rv-resizable-image') : [];
      allImages.forEach(w => w.classList.remove('rv-selected-image'));
      wrapper.classList.add('rv-selected-image');

      const startClientX = e.clientX;
      const startClientY = e.clientY;

      // Read current position offsets
      const initialLeft = parseFloat(wrapper.style.left) || 0;
      const initialTop = parseFloat(wrapper.style.top) || 0;

      // Ensure absolute positioning overlay so it NEVER alters text flow or paper dimensions
      if (wrapper.style.position !== 'absolute') {
        wrapper.style.position = 'absolute';
      }

      let hasMoved = false;

      const onMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startClientX;
        const deltaY = moveEvent.clientY - startClientY;

        if (!hasMoved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
          hasMoved = true;
          this.saveStateForUndo();
          wrapper.classList.add('rv-is-dragging');
        }

        if (hasMoved) {
          const parentSheet = wrapper.closest('.report-viewer-sheet') || this.paperElement;
          const maxLeft = Math.max(0, (parentSheet.clientWidth || 800) - wrapper.offsetWidth);
          const maxTop = Math.max(0, (parentSheet.clientHeight || 1100) - wrapper.offsetHeight);
          const newLeft = Math.max(0, Math.min(maxLeft, initialLeft + deltaX));
          const newTop = Math.max(0, Math.min(maxTop, initialTop + deltaY));
          wrapper.style.left = `${newLeft}px`;
          wrapper.style.top = `${newTop}px`;
        }
      };

      const onMouseUp = () => {
        wrapper.classList.remove('rv-is-dragging');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (hasMoved) {
          this.autoSaveIfEnabled();
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Corner resize handle drag event
    const handle = wrapper.querySelector('.rv-resize-handle');
    if (handle) {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const parentSheet = wrapper.closest('.report-viewer-sheet') || this.paperElement;
        const startX = e.clientX;
        const startWidth = wrapper.offsetWidth;
        const currentLeft = parseFloat(wrapper.style.left) || 0;
        const paperW = parentSheet.clientWidth || 800;
        const maxAllowedWidth = Math.max(50, paperW - currentLeft - 10);

        const onMouseMove = (moveEvent) => {
          if (!wrapper.dataset.undoSaved) {
            this.saveStateForUndo();
            wrapper.dataset.undoSaved = 'true';
          }
          const deltaX = moveEvent.clientX - startX;
          const newWidth = Math.max(30, Math.min(maxAllowedWidth, startWidth + deltaX));
          wrapper.style.width = `${newWidth}px`;
        };

        const onMouseUp = () => {
          delete wrapper.dataset.undoSaved;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          this.autoSaveIfEnabled();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }

    // Delete button click
    wrapper.querySelector('.rv-img-delete-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.saveStateForUndo();
      wrapper.remove();
      this.autoSaveIfEnabled();
    });

    // Highlight on click
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      const allImages = this.scalerElement ? this.scalerElement.querySelectorAll('.rv-resizable-image') : [];
      allImages.forEach(w => w.classList.remove('rv-selected-image'));
      wrapper.classList.add('rv-selected-image');
    });
  }

  /**
   * Insert a movable, editable floating textbox into the active sheet
   * @param {Object} options
   * @param {string} [options.text] - Initial text content
   * @param {number} [options.left] - Absolute X position in px
   * @param {number} [options.top] - Absolute Y position in px
   * @param {number} [options.width] - Initial width in px
   * @param {number} [options.fontSize] - Font size in px (default 10)
   * @param {string} [options.fontFamily] - Font family stack
   * @param {number} [options.sheetIndex=0] - Target sheet index
   * @returns {HTMLElement} The created textbox wrapper
   */
  insertFloatingTextBox(options = {}) {
    if (!this.scalerElement) return null;

    const sheets = this.scalerElement.querySelectorAll('.report-viewer-sheet');
    if (sheets.length === 0) return null;

    const targetSheet = sheets[options.sheetIndex || 0] || sheets[0];
    const wrapper = document.createElement('div');
    wrapper.className = 'rv-floating-textbox group select-none relative';
    wrapper.style.position = 'absolute';
    wrapper.style.zIndex = '35';

    // Stagger position if multiple boxes are inserted
    const existingBoxes = targetSheet.querySelectorAll('.rv-floating-textbox').length;
    const offset = (existingBoxes % 8) * 24;

    const paperW = targetSheet.clientWidth || 794;
    const paperH = targetSheet.clientHeight || 1123;
    const initLeft = options.left !== undefined ? options.left : Math.max(30, Math.round(paperW / 2 - 120) + offset);
    const initTop = options.top !== undefined ? options.top : Math.max(50, Math.round(paperH - 240) + offset);

    wrapper.style.left = `${initLeft}px`;
    wrapper.style.top = `${initTop}px`;
    if (options.width) wrapper.style.width = `${options.width}px`;
    else wrapper.style.minWidth = '140px';

    const text = options.text || (i18n.getLocale() === 'km' ? 'ប្រអប់អត្ថបទ...' : 'Text box...');
    const fontSize = options.fontSize || this.settings.defaultFontSize || 10;
    const fontFamily = options.fontFamily || "'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif";

    wrapper.innerHTML = `
      <div class="rv-textbox-toolbar absolute -top-8 left-0 hidden group-hover:flex items-center gap-1 bg-popover/95 backdrop-blur border border-border rounded shadow-md px-1.5 py-0.5 text-xs z-40 select-none print:hidden">
        <span class="rv-drag-handle cursor-move px-1 py-0.5 text-muted-foreground hover:text-foreground font-mono text-[11px]" title="Drag to move">⋮⋮</span>
        <div class="h-3 w-px bg-border"></div>
        <button type="button" class="rv-textbox-delete-btn px-1.5 py-0.5 rounded hover:bg-destructive/20 text-destructive text-[10px] font-bold cursor-pointer" title="Delete Textbox">✕ លុប</button>
      </div>
      <div class="rv-textbox-content p-1.5 rounded border border-dashed border-primary/40 hover:border-primary focus-within:border-primary bg-background/80 hover:bg-background outline-none transition-colors"
           contenteditable="true"
           spellcheck="false"
           style="font-size: ${fontSize}px !important; font-family: ${fontFamily}; line-height: 1.5;">
        ${text}
      </div>
      <span class="rv-textbox-resize-handle absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-primary/80 hover:bg-primary border-2 border-white rounded-full cursor-se-resize shadow opacity-0 group-hover:opacity-100 transition-opacity z-20 print:hidden" title="Drag to resize"></span>
    `;

    targetSheet.appendChild(wrapper);
    this.bindFloatingTextBox(wrapper);
    this.savedTextBoxes = this.getFloatingTextBoxesSnapshot();
    this.autoSaveIfEnabled();

    // Focus into the content for immediate editing
    const contentEl = wrapper.querySelector('.rv-textbox-content');
    if (contentEl) {
      setTimeout(() => {
        contentEl.focus();
        const range = document.createRange();
        range.selectNodeContents(contentEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        this.currentRange = range;
        this.activeEditableElement = contentEl;
      }, 50);
    }

    const isKm = i18n.getLocale() === 'km';
    toast.success(isKm ? 'បានបញ្ចូលប្រអប់អត្ថបទ' : 'Textbox inserted');
    return wrapper;
  }

  /**
   * Insert text or HTML directly at current cursor position or replace highlighted text
   * in the active report sheet.
   * @param {string} textOrHtml - Text string or HTML markup to insert
   * @param {Object} [options]
   * @param {boolean} [options.isHtml] - Treat as HTML fragment if true
   * @returns {boolean} True if insertion succeeded, false if no active cursor/selection
   */
  insertTextAtSelection(textOrHtml, options = {}) {
    if (!textOrHtml) return false;

    const container = this.scalerElement || this.paperElement;
    if (!container) return false;

    let range = null;
    const sel = window.getSelection();

    // 1. Check current window selection within report container
    if (sel && sel.rangeCount > 0 && sel.anchorNode && container.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    } else if (this.currentRange) {
      // 2. Fallback to saved currentRange if within report container
      const startNode = this.currentRange.startContainer;
      if (startNode && container.contains(startNode)) {
        range = this.currentRange;
        if (sel) {
          try {
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (e) {}
        }
      }
    }

    if (!range) {
      return false;
    }

    this.saveStateForUndo();

    const fontFamily = options.fontFamily || "'Khmer OS Siemreap', 'Siemreap', sans-serif";
    const fontSize = options.fontSize || 10;
    const fontSizePx = typeof fontSize === 'number' ? `${fontSize}px` : fontSize;

    let contentToInsert = String(textOrHtml);
    // Wrap in Khmer OS Siemreap 10px styled span by default
    if (options.wrapSpan !== false && !contentToInsert.includes('font-family')) {
      contentToInsert = `<span class="rv-inserted-text" style="font-family: ${fontFamily}; font-size: ${fontSizePx} !important; line-height: 1.6;">${contentToInsert}</span>`;
    }

    const isHtml = options.isHtml !== undefined ? options.isHtml : (/<[a-z][\s\S]*>/i.test(contentToInsert) || contentToInsert.includes('<br>'));

    let insertedSuccessfully = false;

    // Try document.execCommand first for rich text & native undo stack integration
    try {
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      const command = isHtml ? 'insertHTML' : 'insertText';
      insertedSuccessfully = document.execCommand(command, false, contentToInsert);
    } catch (err) {
      insertedSuccessfully = false;
    }

    // Robust Range-based DOM insertion fallback
    if (!insertedSuccessfully) {
      try {
        range.deleteContents();

        if (isHtml) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = contentToInsert;
          const frag = document.createDocumentFragment();
          let node;
          let lastNode = null;
          while ((node = tempDiv.firstChild)) {
            lastNode = frag.appendChild(node);
          }
          range.insertNode(frag);
          if (lastNode && sel) {
            const newRange = document.createRange();
            newRange.setStartAfter(lastNode);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            this.currentRange = newRange.cloneRange();
          }
        } else {
          const textNode = document.createTextNode(contentToInsert);
          range.insertNode(textNode);
          if (sel) {
            const newRange = document.createRange();
            newRange.setStartAfter(textNode);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            this.currentRange = newRange.cloneRange();
          }
        }
        insertedSuccessfully = true;
      } catch (domErr) {
        console.error('insertTextAtSelection DOM fallback error:', domErr);
      }
    }

    // Normalize Unicode text to prevent Khmer font rendering issues
    this.normalizeContentText();
    this.autoSaveIfEnabled();

    // Update currentRange after insertion
    if (sel && sel.rangeCount > 0) {
      this.currentRange = sel.getRangeAt(0).cloneRange();
    }

    return true;
  }

  /**
   * Bind event handlers for all floating textboxes in report sheets
   */
  bindAllFloatingTextBoxes() {
    if (!this.scalerElement) return;
    this.scalerElement.querySelectorAll('.rv-floating-textbox').forEach(w => {
      this.bindFloatingTextBox(w);
    });
  }

  /**
   * Bind drag, resize, delete, and editing events to a floating textbox wrapper
   * @param {HTMLElement} wrapper
   */
  bindFloatingTextBox(wrapper) {
    if (!wrapper || wrapper.dataset.bound === 'true') return;
    wrapper.dataset.bound = 'true';

    const contentEl = wrapper.querySelector('.rv-textbox-content');
    const deleteBtn = wrapper.querySelector('.rv-textbox-delete-btn');
    const dragHandle = wrapper.querySelector('.rv-drag-handle');
    const resizeHandle = wrapper.querySelector('.rv-textbox-resize-handle');

    // 1. Delete button
    deleteBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.saveStateForUndo();
      wrapper.remove();
      this.savedTextBoxes = this.getFloatingTextBoxesSnapshot();
      this.autoSaveIfEnabled();
      const isKm = i18n.getLocale() === 'km';
      toast.success(isKm ? 'បានលុបប្រអប់អត្ថបទ' : 'Textbox removed');
    });

    // 2. Drag to move repositioning
    const onMouseDown = (e) => {
      if (e.target.closest('.rv-textbox-resize-handle') || e.target.closest('.rv-textbox-delete-btn')) return;
      if (e.target === contentEl && !e.altKey) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const allBoxes = this.scalerElement ? this.scalerElement.querySelectorAll('.rv-floating-textbox') : [];
      allBoxes.forEach(b => b.classList.remove('ring-2', 'ring-primary'));
      wrapper.classList.add('ring-2', 'ring-primary');

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const initialLeft = parseFloat(wrapper.style.left) || 0;
      const initialTop = parseFloat(wrapper.style.top) || 0;

      let hasMoved = false;

      const onMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startClientX;
        const deltaY = moveEvent.clientY - startClientY;

        if (!hasMoved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
          hasMoved = true;
          this.saveStateForUndo();
          wrapper.classList.add('rv-is-dragging');
        }

        if (hasMoved) {
          const parentSheet = wrapper.closest('.report-viewer-sheet') || this.paperElement;
          const maxLeft = Math.max(0, (parentSheet.clientWidth || 800) - wrapper.offsetWidth);
          const maxTop = Math.max(0, (parentSheet.clientHeight || 1100) - wrapper.offsetHeight);
          const newLeft = Math.max(0, Math.min(maxLeft, initialLeft + deltaX));
          const newTop = Math.max(0, Math.min(maxTop, initialTop + deltaY));
          wrapper.style.left = `${newLeft}px`;
          wrapper.style.top = `${newTop}px`;
        }
      };

      const onMouseUp = () => {
        wrapper.classList.remove('rv-is-dragging');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (hasMoved) {
          this.savedTextBoxes = this.getFloatingTextBoxesSnapshot();
          this.autoSaveIfEnabled();
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    dragHandle?.addEventListener('mousedown', onMouseDown);
    wrapper.addEventListener('mousedown', onMouseDown);

    // 3. Resize handling
    resizeHandle?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const startClientX = e.clientX;
      const initialWidth = wrapper.offsetWidth;
      let hasResized = false;

      const onResizeMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startClientX;
        if (!hasResized && Math.abs(deltaX) > 2) {
          hasResized = true;
          this.saveStateForUndo();
        }
        if (hasResized) {
          const newW = Math.max(80, initialWidth + deltaX);
          wrapper.style.width = `${newW}px`;
        }
      };

      const onResizeUp = () => {
        window.removeEventListener('mousemove', onResizeMove);
        window.removeEventListener('mouseup', onResizeUp);
        if (hasResized) {
          this.savedTextBoxes = this.getFloatingTextBoxesSnapshot();
          this.autoSaveIfEnabled();
        }
      };

      window.addEventListener('mousemove', onResizeMove);
      window.addEventListener('mouseup', onResizeUp);
    });

    // 4. Content editing listeners & toolbar selection sync
    contentEl?.addEventListener('input', () => {
      this.savedTextBoxes = this.getFloatingTextBoxesSnapshot();
      this.autoSaveIfEnabled();
    });

    contentEl?.addEventListener('focus', () => {
      this.activeEditableElement = contentEl;
    });

    contentEl?.addEventListener('mouseup', () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        this.currentRange = sel.getRangeAt(0);
        this.updateFormattingControlsStatus();
      }
    });

    contentEl?.addEventListener('keyup', () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        this.currentRange = sel.getRangeAt(0);
        this.updateFormattingControlsStatus();
      }
    });
  }

  /**
   * Apply targeted inline style strictly to highlighted slice or multi-selected elements.
   * NEVER changes global document styles as a fallback.
   * @param {Object} styles - Key/value pairs of CSS properties
   */
  applyInlineStyleToSelection(styles) {
    this.saveStateForUndo();
    this.isApplyingStyle = true;

    // Enforce line-height 1.8 and normal letter-spacing for Khmer Muol to prevent clipped ascenders/descenders and broken shaping
    const fontFamilyVal = styles['font-family'] || '';
    const isMuol = fontFamilyVal.includes('Muol') || fontFamilyVal.includes('Moul') || fontFamilyVal.includes('font-khmer-muol');
    if (isMuol) {
      styles['line-height'] = '1.8';
      styles['letter-spacing'] = 'normal';
      styles['font-feature-settings'] = 'normal';
      styles['-webkit-font-feature-settings'] = 'normal';
      styles['font-variant-ligatures'] = 'normal';
      styles['text-rendering'] = 'optimizeLegibility';
    }

    // CASE 0: Multiple elements selected via Ctrl/Cmd/Shift+Click
    if (this.multiSelectedElements.size > 0) {
      this.multiSelectedElements.forEach(el => {
        if (!el || !this.paperElement.contains(el)) return;
        Object.entries(styles).forEach(([prop, val]) => {
          el.style.setProperty(prop, val, 'important');
        });
        this.normalizeContentText(el);
        // Also apply to any inner spans, fonts, or children so nested elements inherit immediately
        el.querySelectorAll('.rv-highlight-span, font, span').forEach(childSpan => {
          Object.entries(styles).forEach(([prop, val]) => {
            childSpan.style.setProperty(prop, val, 'important');
          });
          this.normalizeContentText(childSpan);
        });
      });

      this.autoSaveIfEnabled();
      setTimeout(() => {
        this.isApplyingStyle = false;
      }, 150);
      return;
    }

    // 1. Resolve targeted range or element
    let range = this.currentRange;
    const sel = window.getSelection();

    if (!range) {
      if (sel && sel.rangeCount > 0 && this.paperElement.contains(sel.anchorNode)) {
        range = sel.getRangeAt(0).cloneRange();
        this.currentRange = range;
      }
    }

    if (!range) {
      this.isApplyingStyle = false;
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមចុច ឬជ្រើសរើសអត្ថបទជាមុនសិន' : 'Please click or highlight text first');
      return;
    }

    // 2. CHECK TABLE SELECTION (Prevents DOM table corruption, extractContents row splitting, or inserting invalid <tr>)
    const targetedCells = new Set();
    const allCells = this.paperElement.querySelectorAll('td, th');
    allCells.forEach(cell => {
      try {
        if (range.intersectsNode(cell)) {
          targetedCells.add(cell);
        }
      } catch (e) {}
    });

    const startNode = range.startContainer;
    const endNode = range.endContainer;
    const ancestor = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer;

    if (startNode.nodeType !== Node.TEXT_NODE && startNode.tagName === 'TR') {
      startNode.querySelectorAll('td, th').forEach(c => targetedCells.add(c));
    }
    if (endNode.nodeType !== Node.TEXT_NODE && endNode.tagName === 'TR') {
      endNode.querySelectorAll('td, th').forEach(c => targetedCells.add(c));
    }
    if (ancestor && ancestor.tagName === 'TR') {
      ancestor.querySelectorAll('td, th').forEach(c => targetedCells.add(c));
    }

    const startCell = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement?.closest('td, th') : startNode.closest?.('td, th');
    const endCell = endNode.nodeType === Node.TEXT_NODE ? endNode.parentElement?.closest('td, th') : endNode.closest?.('td, th');
    if (startCell && endCell && startCell !== endCell) {
      targetedCells.add(startCell);
      targetedCells.add(endCell);
    }

    const isWholeCell = targetedCells.size === 1 && range.toString().trim().length > 0 && range.toString().trim() === Array.from(targetedCells)[0].innerText.trim();

    // If selection spans multiple table cells or entire cell/row:
    if (targetedCells.size > 1 || isWholeCell) {
      const affectedRows = new Set();
      targetedCells.forEach(cell => {
        Object.entries(styles).forEach(([prop, val]) => {
          cell.style.setProperty(prop, val, 'important');
        });
        cell.querySelectorAll('.rv-highlight-span, font, span, div, p, b, strong, em, i, a').forEach(child => {
          Object.entries(styles).forEach(([prop, val]) => {
            child.style.setProperty(prop, val, 'important');
          });
          this.normalizeContentText(child);
        });
        this.normalizeContentText(cell);
        const row = cell.closest('tr');
        if (row) affectedRows.add(row);
      });

      affectedRows.forEach(row => {
        Object.entries(styles).forEach(([prop, val]) => {
          row.style.setProperty(prop, val, 'important');
        });
      });

      this.autoSaveIfEnabled();
      setTimeout(() => {
        this.isApplyingStyle = false;
      }, 150);
      return;
    }

    // 3. Multi-block selection (paragraphs, headings, list items outside tables)
    const isMultiBlock = () => {
      try {
        let s = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode;
        let e = endNode.nodeType === Node.TEXT_NODE ? endNode.parentElement : endNode;
        const b1 = s ? s.closest('p, h1, h2, h3, h4, h5, h6, li') : null;
        const b2 = e ? e.closest('p, h1, h2, h3, h4, h5, h6, li') : null;
        return b1 && b2 && b1 !== b2;
      } catch (err) {
        return false;
      }
    };

    if (!range.collapsed && range.toString().trim().length > 0 && isMultiBlock()) {
      const candidates = this.paperElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, span.rv-highlight-span');
      candidates.forEach(cand => {
        try {
          if (range.intersectsNode(cand)) {
            Object.entries(styles).forEach(([prop, val]) => {
              cand.style.setProperty(prop, val, 'important');
            });
            this.normalizeContentText(cand);
            cand.querySelectorAll('.rv-highlight-span, font, span').forEach(child => {
              Object.entries(styles).forEach(([prop, val]) => {
                child.style.setProperty(prop, val, 'important');
              });
              this.normalizeContentText(child);
            });
          }
        } catch (e) {}
      });

      this.autoSaveIfEnabled();
      setTimeout(() => {
        this.isApplyingStyle = false;
      }, 150);
      return;
    }

    // 4. Single-block highlighted text slice (strictly within a single text block or single cell)
    if (!range.collapsed && range.toString().trim().length > 0) {
      sel.removeAllRanges();
      sel.addRange(range);

      let node = range.commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const existingSpan = node.closest('.rv-highlight-span');

      if (existingSpan && existingSpan.innerText.trim() === range.toString().trim()) {
        Object.entries(styles).forEach(([prop, val]) => {
          existingSpan.style.setProperty(prop, val, 'important');
        });
        if (!styles['line-height']) {
          existingSpan.style.setProperty('line-height', 'normal');
        }
        this.normalizeContentText(existingSpan);
      } else {
        // Table safeguard: ensure extracted slice cannot split table structures
        const testClone = range.cloneContents();
        if (testClone.querySelector('table, tbody, thead, tr, td, th')) {
          testClone.querySelectorAll('td, th').forEach(c => {
            Object.entries(styles).forEach(([prop, val]) => c.style.setProperty(prop, val, 'important'));
          });
          this.autoSaveIfEnabled();
          setTimeout(() => {
            this.isApplyingStyle = false;
          }, 150);
          return;
        }

        const span = document.createElement('span');
        span.className = 'rv-highlight-span';
        Object.entries(styles).forEach(([prop, val]) => {
          span.style.setProperty(prop, val, 'important');
        });
        if (!styles['line-height']) {
          span.style.setProperty('line-height', 'normal');
        }

        try {
          const fragment = range.extractContents();
          this.normalizeContentText(fragment);
          span.appendChild(fragment);
          this.normalizeContentText(span);
          range.insertNode(span);

          // Re-select newly wrapped span so highlight remains active
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          sel.removeAllRanges();
          sel.addRange(newRange);
          this.currentRange = newRange.cloneRange();
          this.hasActiveSelection = true;
          this.updateSelectionStatus(sel.toString().trim());
        } catch (err) {
          console.warn('extractContents failed:', err);
          let targetEl = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
          if (targetEl) {
            Object.entries(styles).forEach(([prop, val]) => {
              targetEl.style.setProperty(prop, val, 'important');
            });
            this.normalizeContentText(targetEl);
          }
        }
      }
    } 
    // 5. Caret is collapsed (user clicked on a title, heading, cell, or word)
    else {
      let targetNode = range.startContainer;
      let targetEl = targetNode.nodeType === Node.TEXT_NODE ? targetNode.parentElement : targetNode;

      if (targetEl && targetEl !== this.paperElement && this.paperElement.contains(targetEl)) {
        Object.entries(styles).forEach(([prop, val]) => {
          targetEl.style.setProperty(prop, val, 'important');
        });
        if (!styles['line-height']) {
          targetEl.style.setProperty('line-height', 'normal');
        }

        // If inside a table cell, ensure the cell and its inner children receive the style
        const cell = targetEl.closest('td, th');
        if (cell) {
          Object.entries(styles).forEach(([prop, val]) => {
            cell.style.setProperty(prop, val, 'important');
          });
          cell.querySelectorAll('.rv-highlight-span, font, span').forEach(c => {
            Object.entries(styles).forEach(([prop, val]) => {
              c.style.setProperty(prop, val, 'important');
            });
          });
        }
        this.normalizeContentText(targetEl);
      } else {
        this.isApplyingStyle = false;
        const isKm = i18n.getLocale() === 'km';
        toast.info(isKm ? 'សូមចុច ឬជ្រើសរើសអត្ថបទជាមុនសិន' : 'Please click or highlight text first');
        return;
      }
    }

    this.autoSaveIfEnabled();

    setTimeout(() => {
      this.isApplyingStyle = false;
    }, 150);
  }

  /**
   * REQUIREMENT 1: Text Position Nudge Controls strictly for HIGHLIGHTED text or MULTI-SELECTED elements
   * Wraps in `<span class="report-nudge-box" style="display: inline-block; position: relative; left: 0px; top: 0px;">`
   * and adjusts left/top by step amount.
   * @param {'left'|'right'|'up'|'down'|'reset'} direction
   */
  nudgeSelectedText(direction) {
    this.saveStateForUndo();
    if (this.multiSelectedElements.size > 0) {
      const step = 1;

      let lastLeft = 0;
      let lastTop = 0;

      this.multiSelectedElements.forEach(el => {
        if (!el || !this.paperElement.contains(el)) return;

        let nudgeBox = el.classList.contains('report-nudge-box') ? el : el.querySelector('.report-nudge-box');
        if (!nudgeBox) {
          el.style.position = 'relative';
          nudgeBox = el;
        }

        let currentLeft = parseFloat(nudgeBox.style.left) || 0;
        let currentTop = parseFloat(nudgeBox.style.top) || 0;

        if (direction === 'left') currentLeft -= step;
        else if (direction === 'right') currentLeft += step;
        else if (direction === 'up') currentTop -= step;
        else if (direction === 'down') currentTop += step;
        else if (direction === 'reset') {
          currentLeft = 0;
          currentTop = 0;
        }

        nudgeBox.style.left = `${currentLeft}px`;
        nudgeBox.style.top = `${currentTop}px`;
        lastLeft = currentLeft;
        lastTop = currentTop;
      });

      this.updateNudgeUI({ style: { left: `${lastLeft}px`, top: `${lastTop}px` } });
      this.autoSaveIfEnabled();
      return;
    }

    if (!this.currentRange || this.currentRange.collapsed) {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមជ្រើសរើសអត្ថបទជាមុនសិន' : 'Please highlight text first');
      return;
    }

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(this.currentRange);

    const range = this.currentRange;
    if (range.collapsed || range.toString().trim().length === 0) {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមជ្រើសរើសអត្ថបទជាមុនសិន' : 'Please highlight text first');
      return;
    }

    // Check if range is already inside a .report-nudge-box
    let nudgeBox = null;
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    nudgeBox = node.closest('.report-nudge-box');

    if (!nudgeBox) {
      nudgeBox = document.createElement('span');
      nudgeBox.className = 'report-nudge-box';
      nudgeBox.style.display = 'inline-block';
      nudgeBox.style.position = 'relative';
      nudgeBox.style.left = '0px';
      nudgeBox.style.top = '0px';
      nudgeBox.style.lineHeight = 'normal';

      try {
        const fragment = range.extractContents();
        nudgeBox.appendChild(fragment);
        range.insertNode(nudgeBox);

        // Re-select contents of nudgeBox so subsequent nudges continue smoothly
        const newRange = document.createRange();
        newRange.selectNodeContents(nudgeBox);
        sel.removeAllRanges();
        sel.addRange(newRange);
        this.currentRange = newRange.cloneRange();
        this.hasActiveSelection = true;
      } catch (err) {
        console.warn('Could not wrap selection in nudge box:', err);
        return;
      }
    }

    // Default step size: 1px
    const step = 1;

    let currentLeft = parseFloat(nudgeBox.style.left) || 0;
    let currentTop = parseFloat(nudgeBox.style.top) || 0;

    if (direction === 'left') {
      currentLeft -= step;
    } else if (direction === 'right') {
      currentLeft += step;
    } else if (direction === 'up') {
      currentTop -= step;
    } else if (direction === 'down') {
      currentTop += step;
    } else if (direction === 'reset') {
      currentLeft = 0;
      currentTop = 0;
    }

    nudgeBox.style.left = `${currentLeft}px`;
    nudgeBox.style.top = `${currentTop}px`;

    // Update readouts & sliders in sidebar and toolbar
    this.updateNudgeUI(nudgeBox);
    this.autoSaveIfEnabled();
  }

  /**
   * Set Nudge position via X or Y slider
   * @param {'x'|'y'} axis
   * @param {number|string} value
   */
  setNudgePosition(axis, value) {
    this.saveStateForUndo();
    const num = Math.max(-150, Math.min(150, Number(value) || 0));

    if (this.multiSelectedElements.size > 0) {
      this.multiSelectedElements.forEach(el => {
        if (!el || !this.paperElement.contains(el)) return;
        let nudgeBox = el.classList.contains('report-nudge-box') ? el : el.querySelector('.report-nudge-box');
        if (!nudgeBox) {
          el.style.position = 'relative';
          nudgeBox = el;
        }
        if (axis === 'x') nudgeBox.style.left = `${num}px`;
        else if (axis === 'y') nudgeBox.style.top = `${num}px`;
      });
      const firstEl = Array.from(this.multiSelectedElements)[0];
      this.updateNudgeUI(firstEl);
      this.autoSaveIfEnabled();
      return;
    }

    if (!this.currentRange || this.currentRange.collapsed) {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមជ្រើសរើសអត្ថបទជាមុនសិន' : 'Please highlight text first');
      return;
    }

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(this.currentRange);

    const range = this.currentRange;
    if (range.collapsed || range.toString().trim().length === 0) {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមជ្រើសរើសអត្ថបទជាមុនសិន' : 'Please highlight text first');
      return;
    }

    let nudgeBox = null;
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    nudgeBox = node.closest('.report-nudge-box');

    if (!nudgeBox) {
      nudgeBox = document.createElement('span');
      nudgeBox.className = 'report-nudge-box';
      nudgeBox.style.display = 'inline-block';
      nudgeBox.style.position = 'relative';
      nudgeBox.style.left = '0px';
      nudgeBox.style.top = '0px';
      nudgeBox.style.lineHeight = 'normal';

      try {
        const fragment = range.extractContents();
        nudgeBox.appendChild(fragment);
        range.insertNode(nudgeBox);

        const newRange = document.createRange();
        newRange.selectNodeContents(nudgeBox);
        sel.removeAllRanges();
        sel.addRange(newRange);
        this.currentRange = newRange.cloneRange();
        this.hasActiveSelection = true;
      } catch (err) {
        console.warn('Could not wrap selection in nudge box:', err);
        return;
      }
    }

    if (axis === 'x') {
      nudgeBox.style.left = `${num}px`;
    } else if (axis === 'y') {
      nudgeBox.style.top = `${num}px`;
    }

    this.updateNudgeUI(nudgeBox);
    this.autoSaveIfEnabled();
  }

  /**
   * Update Text Position Nudge UI (sliders, readouts, labels)
   * @param {HTMLElement|null} nudgeBox
   */
  updateNudgeUI(nudgeBox) {
    let left = 0;
    let top = 0;
    if (nudgeBox) {
      left = parseFloat(nudgeBox.style.left) || 0;
      top = parseFloat(nudgeBox.style.top) || 0;
    }
    const formattedX = `${left >= 0 ? '+' : ''}${left}px`;
    const formattedY = `${top >= 0 ? '+' : ''}${top}px`;

    const tbXVal = this.overlay.querySelector('#rv-tb-nudge-x-val');
    if (tbXVal) tbXVal.textContent = formattedX;

    const tbYVal = this.overlay.querySelector('#rv-tb-nudge-y-val');
    if (tbYVal) tbYVal.textContent = formattedY;

    const tbXSlider = this.overlay.querySelector('#rv-tb-nudge-x-slider');
    if (tbXSlider) tbXSlider.value = left;

    const tbYSlider = this.overlay.querySelector('#rv-tb-nudge-y-slider');
    if (tbYSlider) tbYSlider.value = top;
  }

  /**
   * Helper: Convert rgb/rgba string to hex (#rrggbb)
   */
  rgbToHex(rgbStr) {
    if (!rgbStr) return '#000000';
    if (rgbStr.startsWith('#')) return rgbStr;
    const match = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return '#000000';
    const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  /**
   * Automatically detect and synchronize font family, font size, bold, italic, color,
   * and text position nudges from the active selected or clicked element.
   * @param {HTMLElement} element
   */
  syncSelectionStyles(element) {
    if (!element || this.isApplyingStyle) return;

    try {
      const computed = window.getComputedStyle(element);

      // 1. Detect & Sync Font Family
      const fontSelect = this.overlay.querySelector('#rv-font-family');
      if (fontSelect) {
        const rawFamily = element.style.fontFamily || computed.fontFamily || '';
        const cleanFamily = rawFamily.replace(/['"]/g, '').toLowerCase().trim();
        const primaryFont = cleanFamily.split(',')[0].trim();
        let matchedFont = '';

        if (primaryFont.includes('muol') || primaryFont.includes('moul') || cleanFamily.startsWith('khmer os muol') || cleanFamily.startsWith('khmer os moul') || cleanFamily.startsWith('moul')) {
          const muolOpt = Array.from(fontSelect.options).find(o => o.value && (o.value.includes('Muol') || o.value.includes('Moul')));
          if (muolOpt) matchedFont = muolOpt.value;
        } else if (primaryFont.includes('siemreap')) {
          const srOpt = Array.from(fontSelect.options).find(o => o.value && o.value.includes('Siemreap'));
          if (srOpt) matchedFont = srOpt.value;
        } else if (primaryFont.includes('kantumruy')) {
          const kpOpt = Array.from(fontSelect.options).find(o => o.value && o.value.includes('Kantumruy'));
          if (kpOpt) matchedFont = kpOpt.value;
        } else if (primaryFont.includes('inter')) {
          const opt = Array.from(fontSelect.options).find(o => o.value && o.value.toLowerCase().includes('inter'));
          if (opt) matchedFont = opt.value;
        } else if (primaryFont.includes('roboto')) {
          const opt = Array.from(fontSelect.options).find(o => o.value && o.value.toLowerCase().includes('roboto'));
          if (opt) matchedFont = opt.value;
        } else if (primaryFont.includes('plus jakarta')) {
          const opt = Array.from(fontSelect.options).find(o => o.value && o.value.toLowerCase().includes('plus jakarta'));
          if (opt) matchedFont = opt.value;
        } else {
          // Check other options by primary font name ONLY
          for (const opt of fontSelect.options) {
            if (!opt.value) continue;
            const optPrimary = opt.value.replace(/['"]/g, '').toLowerCase().split(',')[0].trim();
            if (optPrimary && cleanFamily.includes(optPrimary)) {
              matchedFont = opt.value;
              break;
            }
          }
        }

        fontSelect.value = matchedFont || '';
      }

      // 2. Detect & Sync Font Size
      let detectedPt = null;
      // Check inline style first (e.g. "14pt" or "16px")
      let inlineSize = element.style.fontSize;
      let checkEl = element;
      while (!inlineSize && checkEl && checkEl !== this.paperElement) {
        if (checkEl.style && checkEl.style.fontSize) {
          inlineSize = checkEl.style.fontSize;
          break;
        }
        checkEl = checkEl.parentElement;
      }

      if (inlineSize) {
        detectedPt = Math.round(parseFloat(inlineSize));
      }

      if (!detectedPt) {
        const computedSize = computed.fontSize;
        if (computedSize) {
          const pxVal = parseFloat(computedSize);
          detectedPt = Math.round(pxVal);
        }
      }

      if (detectedPt && detectedPt >= 6 && detectedPt <= 72) {
        this.currentHighlightPt = detectedPt;
        const fontValInput = this.overlay.querySelector('#rv-tb-font-size-input');
        if (fontValInput) {
          fontValInput.value = detectedPt;
        }
        const fontValElem = this.overlay.querySelector('#rv-tb-font-size-val');
        if (fontValElem) {
          fontValElem.textContent = `${detectedPt}px`;
        }
      }

      // 3. Detect & Sync Bold / Italic / Color
      const btnBold = this.overlay.querySelector('#rv-btn-bold');
      if (btnBold) {
        const weight = computed.fontWeight;
        const isBold = weight === 'bold' || parseInt(weight, 10) >= 600;
        if (isBold) {
          btnBold.classList.add('border-primary', 'bg-primary/20', 'text-primary');
        } else {
          btnBold.classList.remove('border-primary', 'bg-primary/20', 'text-primary');
        }
      }

      const btnItalic = this.overlay.querySelector('#rv-btn-italic');
      if (btnItalic) {
        const isItalic = computed.fontStyle === 'italic';
        if (isItalic) {
          btnItalic.classList.add('border-primary', 'bg-primary/20', 'text-primary');
        } else {
          btnItalic.classList.remove('border-primary', 'bg-primary/20', 'text-primary');
        }
      }

      const colorPicker = this.overlay.querySelector('#rv-color-picker');
      if (colorPicker && computed.color) {
        const hex = this.rgbToHex(computed.color);
        if (hex) colorPicker.value = hex;
      }

      // 4. Detect & Sync Text Position Nudge (X and Y offsets)
      const nudgeBox = element.closest('.report-nudge-box');
      this.updateNudgeUI(nudgeBox);

    } catch (err) {
      console.warn('Could not sync selection styles:', err);
    }
  }

  /**
   * Toggle bold on highlighted selection or multi-selected elements
   */
  toggleBold() {
    if (this.multiSelectedElements.size > 0) {
      let anyNotBold = false;
      this.multiSelectedElements.forEach(el => {
        const weight = window.getComputedStyle(el).fontWeight;
        if (weight !== 'bold' && parseInt(weight, 10) < 600) {
          anyNotBold = true;
        }
      });
      const newWeight = anyNotBold ? 'bold' : 'normal';
      this.applyInlineStyleToSelection({ 'font-weight': newWeight });
      return;
    }

    if (!this.currentRange || (this.currentRange.collapsed && !this.currentTableCell && !this.currentTableRow)) {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមជ្រើសរើសអត្ថបទជាមុនសិន' : 'Please highlight text first');
      return;
    }

    // Check if range is inside or touches a table
    const startNode = this.currentRange.startContainer;
    const isTable = (startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement?.closest('table') : startNode.closest?.('table')) || this.currentTableCell || this.currentTableRow;
    if (isTable) {
      let isBold = false;
      const targetEl = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode;
      if (targetEl) {
        const weight = window.getComputedStyle(targetEl).fontWeight;
        if (weight === 'bold' || parseInt(weight, 10) >= 600) isBold = true;
      }
      this.applyInlineStyleToSelection({ 'font-weight': isBold ? 'normal' : 'bold' });
      return;
    }

    this.restoreSelection();
    document.execCommand('bold', false, null);
    this.captureSelection();
    this.autoSaveIfEnabled();
  }

  /**
   * Toggle italic on highlighted selection or multi-selected elements
   */
  toggleItalic() {
    if (this.multiSelectedElements.size > 0) {
      let anyNotItalic = false;
      this.multiSelectedElements.forEach(el => {
        const style = window.getComputedStyle(el).fontStyle;
        if (style !== 'italic') {
          anyNotItalic = true;
        }
      });
      const newStyle = anyNotItalic ? 'italic' : 'normal';
      this.applyInlineStyleToSelection({ 'font-style': newStyle });
      return;
    }

    if (!this.currentRange || (this.currentRange.collapsed && !this.currentTableCell && !this.currentTableRow)) {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមជ្រើសរើសអត្ថបទជាមុនសិន' : 'Please highlight text first');
      return;
    }

    // Check if range is inside or touches a table
    const startNode = this.currentRange.startContainer;
    const isTable = (startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement?.closest('table') : startNode.closest?.('table')) || this.currentTableCell || this.currentTableRow;
    if (isTable) {
      let isItalic = false;
      const targetEl = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode;
      if (targetEl) {
        const style = window.getComputedStyle(targetEl).fontStyle;
        if (style === 'italic') isItalic = true;
      }
      this.applyInlineStyleToSelection({ 'font-style': isItalic ? 'normal' : 'italic' });
      return;
    }

    this.restoreSelection();
    document.execCommand('italic', false, null);
    this.captureSelection();
    this.autoSaveIfEnabled();
  }

  /**
   * Apply text alignment to current block or multi-selected elements
   */
  applyAlignment(command) {
    this.saveStateForUndo();
    const alignMap = {
      justifyLeft: 'left',
      justifyCenter: 'center',
      justifyRight: 'right',
      justifyFull: 'justify'
    };
    const align = alignMap[command] || 'left';

    if (this.multiSelectedElements.size > 0) {
      this.applyInlineStyleToSelection({ 'text-align': align });
      return;
    }

    if (!this.currentRange && !this.currentTableCell && !this.currentTableRow) {
      const isKm = i18n.getLocale() === 'km';
      toast.info(isKm ? 'សូមជ្រើសរើសអត្ថបទជាមុនសិន' : 'Please highlight text first');
      return;
    }

    const startNode = this.currentRange?.startContainer;
    const isTable = (startNode && (startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement?.closest('table') : startNode.closest?.('table'))) || this.currentTableCell || this.currentTableRow;
    if (isTable) {
      this.applyInlineStyleToSelection({ 'text-align': align });
      return;
    }

    this.restoreSelection();
    document.execCommand(command, false, null);
    this.captureSelection();
    this.autoSaveIfEnabled();
  }

  /**
   * Save preset & custom HTML to IndexedDB
   */
  async savePreset(showToast = true) {
    try {
      const pad = this.settings.padding || this.settings.margins;

      // Extract metadata of all floating inserted images so they persist across report reloads
      const savedImages = this.getFloatingImagesSnapshot();
      this.savedImages = savedImages;

      // Extract metadata of all floating inserted textboxes so they persist across report reloads
      const savedTextBoxes = this.getFloatingTextBoxesSnapshot();
      this.savedTextBoxes = savedTextBoxes;

      const currentHtml = this.getCurrentDocumentHtml();
      this.savedHtmlContent = currentHtml;

      const payload = {
        ...this.settings,
        padding: pad,
        margins: pad,
        reportKey: this.options.reportKey,
        savedHtmlContent: currentHtml,
        savedImages,
        savedTextBoxes,
        currentRowPadding: this.currentRowPadding,
        savedColumnWidths: this.savedColumnWidths,
        customFilterValues: this.customFilterValues,
        updatedAt: new Date().toISOString()
      };
      await reportService.saveReportSettings(this.options.reportKey, payload);
      if (showToast) {
        toast.success(t('reportViewer.presetSaved') || 'Format preset saved successfully');
      }
    } catch (err) {
      console.error('Failed to save report preset:', err);
      toast.error('Failed to save preset');
    }
  }

  /**
   * Auto save preset if enabled
   */
  autoSaveIfEnabled() {
    if (this.isAutoSave) {
      this.savePreset(false);
    }
  }

  /**
   * Reset preset and clear custom HTML to system default
   */
  async resetPreset() {
    try {
      await reportService.resetReportSettings(this.options.reportKey);
      this.settings.paperSize = (this.options.defaultPaperSize || 'A4').toUpperCase();
      this.settings.padding = { ...this.options.defaultMargins };
      this.settings.margins = { ...this.options.defaultMargins };
      this.settings.orientation = this.options.defaultOrientation;
      this.settings.zoom = 100;
      this.settings.defaultFontFamily = this.options.defaultFontFamily;
      this.settings.defaultFontSize = this.options.defaultFontSize;
      this.savedHtmlContent = null;
      this.savedImages = [];
      this.savedTextBoxes = [];
      this.currentRowPadding = 8;
      this.savedColumnWidths = {};
      this.customFilterValues = {};
      if (this.paperElement) {
        this.paperElement.querySelectorAll('.rv-resizable-image').forEach(w => w.remove());
        this.paperElement.querySelectorAll('.rv-floating-textbox').forEach(w => w.remove());
      }
      if (this.scalerElement) {
        this.scalerElement.querySelectorAll('.rv-floating-textbox').forEach(w => w.remove());
      }

      if (typeof this.options.onResetFilters === 'function') {
        try {
          await this.options.onResetFilters(this);
        } catch (e) {
          console.warn('Error in onResetFilters:', e);
        }
      }

      // Re-render fresh report content
      await this.refreshContent(true);

      // Re-apply outer page setup
      this.applyPageSetup();

      toast.success(t('reportViewer.presetReset') || 'Format preset reset to default');
    } catch (err) {
      console.error('Failed to reset preset:', err);
    }
  }

  /**
   * Trigger browser print
   */
  print() {
    this.updatePrintStyles();
    document.body.classList.add('printing-report-viewer');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-report-viewer');
    }, 1000);
  }

  /**
   * 4. EXPORT REPORT TO PDF
   * Offline PDF generation:
   * - In Electron: opens native system Save File Dialog to choose location and file name, then writes PDF directly.
   * - In Web Browser: opens print-to-PDF / save dialog with optimized report layout.
   */
  async exportPDF() {
    const isKm = i18n.getLocale() === 'km';
    const cleanTitle = (this.options.title || 'report').replace(/[\\/:*?"<>|]/g, '_').trim();
    const defaultFilename = `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;

    this.updatePrintStyles();
    document.body.classList.add('printing-report-viewer');

    try {
      // 1. Electron Desktop App: Native Save Dialog & Direct PDF Generation
      if (window.electronAPI && typeof window.electronAPI.savePdfDialog === 'function') {
        const res = await window.electronAPI.savePdfDialog({
          title: isKm ? 'រក្សាទុករបាយការណ៍ជា PDF (Save Report as PDF)' : 'Save Report as PDF',
          defaultFilename,
          landscape: this.settings.orientation === 'landscape',
          pageSize: (this.settings.paperSize || 'A4').toUpperCase()
        });

        if (res && res.success) {
          toast.success(isKm ? `បានរក្សាទុក PDF ដោយជោគជ័យ: ${res.filePath}` : `Saved PDF successfully: ${res.filePath}`);
        } else if (res && res.canceled) {
          // User canceled file dialog
        } else if (res && res.error) {
          console.warn('Electron savePdfDialog error:', res.error);
          toast.error(isKm ? 'បរាជ័យក្នុងការរក្សាទុក PDF' : 'Failed to save PDF');
        }
        return;
      }

      // 2. Standard Web Browser: Native Print/Save dialog
      const originalTitle = document.title;
      document.title = `${cleanTitle}_${new Date().toISOString().slice(0, 10)}`;
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    } catch (err) {
      console.error('exportPDF failed:', err);
      toast.error(isKm ? 'បរាជ័យក្នុងការនាំចេញ PDF' : 'Failed to export PDF');
    } finally {
      setTimeout(() => {
        document.body.classList.remove('printing-report-viewer');
      }, 1000);
    }
  }

  /**
   * Close the viewer modal safely
   */
  async close() {
    if (this.isAutoSave) {
      this.savedTextBoxes = this.getFloatingTextBoxesSnapshot();
      try {
        await this.savePreset(false);
      } catch (err) {
        console.warn('Error saving preset on close:', err);
      }
    }
    this.clearMultiSelection();
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.beforePrintListener) {
      window.removeEventListener('beforeprint', this.beforePrintListener);
      this.beforePrintListener = null;
    }
    if (this.afterPrintListener) {
      window.removeEventListener('afterprint', this.afterPrintListener);
      this.afterPrintListener = null;
    }
    document.body.classList.remove('printing-report-viewer');
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  /**
   * Attach all event listeners with focus-stealing prevention
   */
  attachEventListeners() {
    // 1. Close actions
    this.overlay.querySelector('#rv-btn-close')?.addEventListener('click', () => this.close());

    // Native browser print (Ctrl+P) synchronization
    this.beforePrintListener = () => {
      this.updatePrintStyles();
      document.body.classList.add('printing-report-viewer');
    };
    this.afterPrintListener = () => {
      document.body.classList.remove('printing-report-viewer');
    };
    window.addEventListener('beforeprint', this.beforePrintListener);
    window.addEventListener('afterprint', this.afterPrintListener);

    // Close on Escape key
    const escListener = (e) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', escListener);
      }
    };
    document.addEventListener('keydown', escListener);

    // 1b. Undo & Redo buttons
    this.overlay.querySelector('#rv-btn-undo')?.addEventListener('click', () => this.undo());
    this.overlay.querySelector('#rv-btn-redo')?.addEventListener('click', () => this.redo());

    // Keyboard shortcuts (Ctrl+Z for Undo, Ctrl+Y or Ctrl+Shift+Z for Redo)
    this.overlay.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      }
    });

    // 2. Selection tracking & Unicode normalization: Store Range on selectionchange and mouseup/keyup
    const handleSelection = () => this.captureSelection();
    document.addEventListener('selectionchange', handleSelection);
    const eventContainer = this.scalerElement || this.paperElement;
    eventContainer?.addEventListener('mouseup', handleSelection);
    eventContainer?.addEventListener('keyup', handleSelection);
    eventContainer?.addEventListener('touchend', handleSelection);

    // Capture undo snapshot before text input mutations
    eventContainer?.addEventListener('beforeinput', () => {
      this.saveStateForUndo();
    });

    // Normalize text on paste & input to prevent broken codepoints and dotted artifacts
    eventContainer?.addEventListener('paste', () => {
      setTimeout(() => {
        this.normalizeContentText();
        this.autoSaveIfEnabled();
      }, 0);
    });

    // Auto-save on user input/typing anywhere in the report sheets
    let autoSaveTimer = null;
    const triggerDebouncedAutoSave = () => {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        this.autoSaveIfEnabled();
      }, 500);
    };

    eventContainer?.addEventListener('input', () => {
      try {
        const sel = window.getSelection();
        if (sel && sel.anchorNode && sel.anchorNode.nodeType === Node.TEXT_NODE) {
          const val = sel.anchorNode.nodeValue;
          const norm = val.normalize('NFC');
          if (val !== norm) {
            const offset = sel.anchorOffset;
            sel.anchorNode.nodeValue = norm;
            sel.collapse(sel.anchorNode, Math.min(offset, norm.length));
          }
        }
      } catch (err) {}
      triggerDebouncedAutoSave();
    });

    // Save immediately on focus loss / blur
    eventContainer?.addEventListener('focusout', () => {
      this.autoSaveIfEnabled();
    });

    // Multi-Selection support: Ctrl/Cmd/Shift+Click toggling
    eventContainer?.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        let el = target.closest('td, th, h1, h2, h3, h4, h5, h6, p, .report-nudge-box, .rv-highlight-span, strong, em, b, i, span');
        if (!el || el === this.paperElement || el === this.contentElement) {
          if (target !== this.paperElement && target !== this.contentElement) {
            el = target;
          }
        }

        if (el) {
          if (this.multiSelectedElements.has(el)) {
            el.classList.remove('rv-multi-selected');
            this.multiSelectedElements.delete(el);
          } else {
            el.classList.add('rv-multi-selected');
            this.multiSelectedElements.add(el);
            this.syncSelectionStyles(el);
          }
          this.updateSelectionStatus();
        }
        return;
      }

      // Normal click without Ctrl/Cmd/Shift: clear multi-selection if clicked outside selected items
      if (this.multiSelectedElements.size > 0 && !e.target.closest('.rv-multi-selected')) {
        this.clearMultiSelection();
      }
    });

    // Track clicked table cell, row, and table for shading and row height adjustments
    eventContainer?.addEventListener('click', (e) => {
      const cell = e.target.closest('td, th');
      if (cell) {
        this.currentTableCell = cell;
        this.currentTableRow = cell.closest('tr');
        this.currentTable = cell.closest('table');
        this.updateCellInfoUI();
      }
    });

    // 3. Focus-stealing prevention: Add mousedown e.preventDefault() on formatting buttons (excluding input range)
    const formatButtons = this.overlay.querySelectorAll('.rv-format-btn, .rv-nudge-step-btn, .rv-shade-preset-btn, .rv-row-preset-btn, .rv-col-preset-btn, .rv-margin-preset-btn, .rv-margin-step-btn, #rv-btn-margin-toggle, #rv-btn-size-a4, #rv-btn-size-a3, #rv-btn-undo, #rv-btn-redo, #rv-btn-bold, #rv-btn-italic, #rv-tb-btn-font-dec, #rv-tb-btn-font-inc, #rv-btn-align-left, #rv-btn-align-center, #rv-btn-align-right, #rv-btn-align-justify, #rv-btn-col-width-toggle, #rv-btn-col-width-dec, #rv-btn-col-width-inc, #rv-btn-nudge-x-toggle, #rv-btn-nudge-y-toggle, #rv-btn-shading-toggle, #rv-btn-row-height-toggle, #rv-btn-insert-image');
    formatButtons.forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        // Prevents browser from blurring/clearing the highlighted text in the paper sheet!
        if (e.target.tagName !== 'INPUT') {
          e.preventDefault();
        }
      });
    });

    // 4. Font Family (Applies STRICTLY to highlighted text & keeps selection visible)
    const fontSelect = this.overlay.querySelector('#rv-font-family');
    const applyFontFamily = (val) => {
      if (!val) return;
      const fontObj = KHMER_FONTS[val] || ENGLISH_FONTS[val] || Object.values(KHMER_FONTS).find(f => f.name === val) || Object.values(ENGLISH_FONTS).find(f => f.name === val);
      const stack = fontObj ? fontObj.stack : (val.includes(',') ? val : `'${val}', sans-serif`);
      const isMuol = val.includes('Muol') || val.includes('Moul') || stack.includes('Muol') || stack.includes('Moul');
      const stylesToApply = { 'font-family': stack };
      if (isMuol) {
        stylesToApply['line-height'] = '1.8';
        stylesToApply['letter-spacing'] = 'normal';
        stylesToApply['font-feature-settings'] = 'normal';
        stylesToApply['-webkit-font-feature-settings'] = 'normal';
        stylesToApply['font-variant-ligatures'] = 'normal';
        stylesToApply['text-rendering'] = 'optimizeLegibility';
      }
      this.applyInlineStyleToSelection(stylesToApply);
    };

    fontSelect?.addEventListener('change', (e) => {
      applyFontFamily(e.target.value);
    });
    fontSelect?.addEventListener('input', (e) => {
      applyFontFamily(e.target.value);
    });

    // 5. Font Size Steppers & Direct Input
    const setFontSizeDirect = (pt) => {
      const num = Math.max(6, Math.min(72, parseInt(pt, 10) || 10));
      this.currentHighlightPt = num;
      const input = this.overlay.querySelector('#rv-tb-font-size-input');
      if (input) input.value = num;
      const valElem = this.overlay.querySelector('#rv-tb-font-size-val');
      if (valElem) valElem.textContent = `${num}px`;
      this.applyInlineStyleToSelection({ 'font-size': `${num}px` });
    };

    const adjustFontSize = (delta) => {
      const cur = this.currentHighlightPt || 10;
      setFontSizeDirect(cur + delta);
    };

    this.overlay.querySelector('#rv-tb-btn-font-dec')?.addEventListener('click', () => adjustFontSize(-1));
    this.overlay.querySelector('#rv-tb-btn-font-inc')?.addEventListener('click', () => adjustFontSize(1));

    const fontSizeInput = this.overlay.querySelector('#rv-tb-font-size-input');
    if (fontSizeInput) {
      fontSizeInput.addEventListener('change', (e) => setFontSizeDirect(e.target.value));
      fontSizeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          setFontSizeDirect(e.target.value);
          fontSizeInput.blur();
        }
      });
    }

    // 6. Bold, Italic, Color
    this.overlay.querySelector('#rv-btn-bold')?.addEventListener('click', () => this.toggleBold());
    this.overlay.querySelector('#rv-btn-italic')?.addEventListener('click', () => this.toggleItalic());
    this.overlay.querySelector('#rv-color-picker')?.addEventListener('input', (e) => {
      this.applyInlineStyleToSelection({ 'color': e.target.value });
    });

    // 7. Text Alignment
    this.overlay.querySelector('#rv-btn-align-left')?.addEventListener('click', () => this.applyAlignment('justifyLeft'));
    this.overlay.querySelector('#rv-btn-align-center')?.addEventListener('click', () => this.applyAlignment('justifyCenter'));
    this.overlay.querySelector('#rv-btn-align-right')?.addEventListener('click', () => this.applyAlignment('justifyRight'));
    this.overlay.querySelector('#rv-btn-align-justify')?.addEventListener('click', () => this.applyAlignment('justifyFull'));

    // 8. TEXT POSITION NUDGE (Horizontal & Vertical Arrow Buttons with Sliders)
    const btnNudgeX = this.overlay.querySelector('#rv-btn-nudge-x-toggle');
    const popoverNudgeX = this.overlay.querySelector('#rv-popover-nudge-x');
    const btnNudgeY = this.overlay.querySelector('#rv-btn-nudge-y-toggle');
    const popoverNudgeY = this.overlay.querySelector('#rv-popover-nudge-y');

    const togglePopoverX = (forceState = null) => {
      if (!popoverNudgeX) return;
      const isOpen = forceState !== null ? forceState : popoverNudgeX.classList.contains('hidden');
      if (isOpen) {
        popoverNudgeX.classList.remove('hidden');
        btnNudgeX?.classList.add('border-primary', 'bg-primary/15', 'text-primary');
        if (typeof togglePopoverY === 'function') togglePopoverY(false);
        if (typeof togglePopoverMargin === 'function') togglePopoverMargin(false);
        if (typeof togglePopoverShading === 'function') togglePopoverShading(false);
        if (typeof togglePopoverRowHeight === 'function') togglePopoverRowHeight(false);
        if (typeof togglePopoverColWidth === 'function') togglePopoverColWidth(false);
      } else {
        popoverNudgeX.classList.add('hidden');
        btnNudgeX?.classList.remove('border-primary', 'bg-primary/15', 'text-primary');
      }
    };

    const togglePopoverY = (forceState = null) => {
      if (!popoverNudgeY) return;
      const isOpen = forceState !== null ? forceState : popoverNudgeY.classList.contains('hidden');
      if (isOpen) {
        popoverNudgeY.classList.remove('hidden');
        btnNudgeY?.classList.add('border-primary', 'bg-primary/15', 'text-primary');
        if (typeof togglePopoverX === 'function') togglePopoverX(false);
        if (typeof togglePopoverMargin === 'function') togglePopoverMargin(false);
        if (typeof togglePopoverShading === 'function') togglePopoverShading(false);
        if (typeof togglePopoverRowHeight === 'function') togglePopoverRowHeight(false);
        if (typeof togglePopoverColWidth === 'function') togglePopoverColWidth(false);
      } else {
        popoverNudgeY.classList.add('hidden');
        btnNudgeY?.classList.remove('border-primary', 'bg-primary/15', 'text-primary');
      }
    };

    btnNudgeX?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopoverX();
    });

    btnNudgeY?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopoverY();
    });

    // 8b. TABLE CELL / ROW SHADING TOOL CONTROLS
    const btnShading = this.overlay.querySelector('#rv-btn-shading-toggle');
    const popoverShading = this.overlay.querySelector('#rv-popover-shading');
    const togglePopoverShading = (forceState = null) => {
      if (!popoverShading) return;
      const isOpen = forceState !== null ? forceState : popoverShading.classList.contains('hidden');
      if (isOpen) {
        popoverShading.classList.remove('hidden');
        btnShading?.classList.add('border-primary', 'bg-primary/15', 'text-primary');
        if (typeof togglePopoverColWidth === 'function') togglePopoverColWidth(false);
        if (typeof togglePopoverRowHeight === 'function') togglePopoverRowHeight(false);
        if (typeof togglePopoverMargin === 'function') togglePopoverMargin(false);
        if (typeof togglePopoverX === 'function') togglePopoverX(false);
        if (typeof togglePopoverY === 'function') togglePopoverY(false);
        this.updateCellInfoUI();
      } else {
        popoverShading.classList.add('hidden');
        btnShading?.classList.remove('border-primary', 'bg-primary/15', 'text-primary');
      }
    };

    btnShading?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopoverShading();
    });

    // Shading scope toggle (cell vs row)
    const targetCellBtn = this.overlay.querySelector('#rv-shading-target-cell');
    const targetRowBtn = this.overlay.querySelector('#rv-shading-target-row');
    targetCellBtn?.addEventListener('click', () => {
      this.shadingTargetMode = 'cell';
      targetCellBtn.className = 'flex-1 py-1 rounded-md text-center font-medium transition-colors bg-card shadow-xs text-foreground cursor-pointer';
      targetRowBtn.className = 'flex-1 py-1 rounded-md text-center font-medium transition-colors text-muted-foreground hover:text-foreground cursor-pointer';
    });
    targetRowBtn?.addEventListener('click', () => {
      this.shadingTargetMode = 'row';
      targetRowBtn.className = 'flex-1 py-1 rounded-md text-center font-medium transition-colors bg-card shadow-xs text-foreground cursor-pointer';
      targetCellBtn.className = 'flex-1 py-1 rounded-md text-center font-medium transition-colors text-muted-foreground hover:text-foreground cursor-pointer';
    });

    // Preset shade colors
    this.overlay.querySelectorAll('.rv-shade-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const color = btn.dataset.color;
        if (color) this.applyShading(color);
      });
    });

    // Custom cell background color picker
    this.overlay.querySelector('#rv-cell-color-picker')?.addEventListener('input', (e) => {
      this.applyShading(e.target.value);
    });

    // Clear shading button
    this.overlay.querySelector('#rv-btn-clear-shading')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.applyShading('transparent');
    });

    // 8c. ROW HEIGHT / CELL PADDING TOOL CONTROLS
    const btnRowHeight = this.overlay.querySelector('#rv-btn-row-height-toggle');
    const popoverRowHeight = this.overlay.querySelector('#rv-popover-row-height');
    const togglePopoverRowHeight = (forceState = null) => {
      if (!popoverRowHeight) return;
      const isOpen = forceState !== null ? forceState : popoverRowHeight.classList.contains('hidden');
      if (isOpen) {
        popoverRowHeight.classList.remove('hidden');
        btnRowHeight?.classList.add('border-primary', 'bg-primary/15', 'text-primary');
        if (typeof togglePopoverColWidth === 'function') togglePopoverColWidth(false);
        if (typeof togglePopoverMargin === 'function') togglePopoverMargin(false);
        if (typeof togglePopoverShading === 'function') togglePopoverShading(false);
        if (typeof togglePopoverX === 'function') togglePopoverX(false);
        if (typeof togglePopoverY === 'function') togglePopoverY(false);
      } else {
        popoverRowHeight.classList.add('hidden');
        btnRowHeight?.classList.remove('border-primary', 'bg-primary/15', 'text-primary');
      }
    };

    btnRowHeight?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopoverRowHeight();
    });

    // Row Height presets
    this.overlay.querySelectorAll('.rv-row-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const pad = Number(btn.dataset.padding);
        if (pad) {
          this.applyRowPadding(pad);
          this.overlay.querySelectorAll('.rv-row-preset-btn').forEach(b => {
            b.classList.remove('font-bold', 'text-primary');
          });
          btn.classList.add('font-bold', 'text-primary');
        }
      });
    });

    // Steppers
    this.overlay.querySelector('#rv-btn-row-pad-dec')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.applyRowPadding(Math.max(2, this.currentRowPadding - 2));
    });
    this.overlay.querySelector('#rv-btn-row-pad-inc')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.applyRowPadding(Math.min(40, this.currentRowPadding + 2));
    });

    // 8c2. COLUMN WIDTH TOOL CONTROLS
    const btnColWidth = this.overlay.querySelector('#rv-btn-col-width-toggle');
    const popoverColWidth = this.overlay.querySelector('#rv-popover-col-width');
    const togglePopoverColWidth = (forceState = null) => {
      if (!popoverColWidth) return;
      const isOpen = forceState !== null ? forceState : popoverColWidth.classList.contains('hidden');
      if (isOpen) {
        popoverColWidth.classList.remove('hidden');
        btnColWidth?.classList.add('border-primary', 'bg-primary/15', 'text-primary');
        if (typeof togglePopoverRowHeight === 'function') togglePopoverRowHeight(false);
        if (typeof togglePopoverMargin === 'function') togglePopoverMargin(false);
        if (typeof togglePopoverShading === 'function') togglePopoverShading(false);
        if (typeof togglePopoverX === 'function') togglePopoverX(false);
        if (typeof togglePopoverY === 'function') togglePopoverY(false);
        this.updateCellInfoUI();
      } else {
        popoverColWidth.classList.add('hidden');
        btnColWidth?.classList.remove('border-primary', 'bg-primary/15', 'text-primary');
      }
    };

    btnColWidth?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopoverColWidth();
    });

    // Column Width Presets
    this.overlay.querySelectorAll('.rv-col-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const width = btn.dataset.width;
        if (width) {
          this.applyColumnWidth(width);
          this.overlay.querySelectorAll('.rv-col-preset-btn').forEach(b => {
            b.classList.remove('font-bold', 'text-primary');
          });
          btn.classList.add('font-bold', 'text-primary');
        }
      });
    });

    // Column Width Steppers (-10 / +10)
    const adjustColWidth = (delta) => {
      let cur = 100;
      const colIdx = this.currentTableCell && this.currentTableCell.cellIndex !== undefined ? this.currentTableCell.cellIndex : 0;
      if (this.savedColumnWidths && this.savedColumnWidths[colIdx]) {
        cur = parseInt(this.savedColumnWidths[colIdx], 10) || 100;
      } else if (this.currentTableCell) {
        cur = this.currentTableCell.offsetWidth || 100;
      }
      const newWidth = Math.max(30, Math.min(800, cur + delta));
      this.applyColumnWidth(newWidth);
    };

    this.overlay.querySelector('#rv-btn-col-width-dec')?.addEventListener('click', (e) => {
      e.preventDefault();
      adjustColWidth(-10);
    });
    this.overlay.querySelector('#rv-btn-col-width-inc')?.addEventListener('click', (e) => {
      e.preventDefault();
      adjustColWidth(10);
    });

    // 8d. INTERACTIVE IMAGE INSERTER CONTROLS
    const btnInsertImage = this.overlay.querySelector('#rv-btn-insert-image');
    const imageFileInput = this.overlay.querySelector('#rv-image-file-input');
    btnInsertImage?.addEventListener('click', (e) => {
      e.preventDefault();
      imageFileInput?.click();
    });

    imageFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target?.result;
        if (dataUrl) {
          this.insertImageFromDataUrl(dataUrl);
        }
        imageFileInput.value = '';
      };
      reader.readAsDataURL(file);
    });

    // 8e. INTERACTIVE TEXT BOX INSERTER
    const btnInsertTextbox = this.overlay.querySelector('#rv-btn-insert-textbox');
    btnInsertTextbox?.addEventListener('click', (e) => {
      e.preventDefault();
      this.insertFloatingTextBox();
    });

    // 8f. PAPER MARGIN TOOL CONTROLS
    const btnMargin = this.overlay.querySelector('#rv-btn-margin-toggle');
    const popoverMargin = this.overlay.querySelector('#rv-popover-margin');
    const togglePopoverMargin = (forceState = null) => {
      if (!popoverMargin) return;
      const isOpen = forceState !== null ? forceState : popoverMargin.classList.contains('hidden');
      if (isOpen) {
        popoverMargin.classList.remove('hidden');
        btnMargin?.classList.add('border-primary', 'bg-primary/15', 'text-primary');
        if (typeof togglePopoverRowHeight === 'function') togglePopoverRowHeight(false);
        if (typeof togglePopoverColWidth === 'function') togglePopoverColWidth(false);
        if (typeof togglePopoverShading === 'function') togglePopoverShading(false);
        if (typeof togglePopoverX === 'function') togglePopoverX(false);
        if (typeof togglePopoverY === 'function') togglePopoverY(false);
      } else {
        popoverMargin.classList.add('hidden');
        btnMargin?.classList.remove('border-primary', 'bg-primary/15', 'text-primary');
      }
    };

    btnMargin?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopoverMargin();
    });

    const setMarginValue = async (side, value) => {
      const pad = { ...(this.settings.padding || this.settings.margins || { top: 15, bottom: 15, left: 15, right: 15 }) };
      const val = Math.max(0, Math.min(60, Number(value) || 0));
      if (side === 'all') {
        pad.top = val;
        pad.bottom = val;
        pad.left = val;
        pad.right = val;
      } else if (side in pad) {
        pad[side] = val;
      }
      this.settings.padding = { ...pad };
      this.settings.margins = { ...pad };
      this.applyPageSetup();
      await this.refreshContent(false);
      this.autoSaveIfEnabled();
    };

    // Margin Presets
    this.overlay.querySelectorAll('.rv-margin-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const m = Number(btn.dataset.margin);
        if (m) setMarginValue('all', m);
      });
    });

    // Margin Steppers (-2 / +2)
    this.overlay.querySelectorAll('.rv-margin-step-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const side = btn.dataset.side;
        const delta = Number(btn.dataset.delta) || 0;
        const pad = this.settings.padding || this.settings.margins || { top: 15, bottom: 15, left: 15, right: 15 };
        const cur = Number(pad[side]) || 15;
        setMarginValue(side, cur + delta);
      });
    });

    // Close popovers on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#rv-nudge-x-group')) {
        togglePopoverX(false);
      }
      if (!e.target.closest('#rv-nudge-y-group')) {
        togglePopoverY(false);
      }
      if (!e.target.closest('#rv-shading-group')) {
        togglePopoverShading(false);
      }
      if (!e.target.closest('#rv-row-height-group')) {
        togglePopoverRowHeight(false);
      }
      if (!e.target.closest('#rv-col-width-group')) {
        togglePopoverColWidth(false);
      }
      if (!e.target.closest('#rv-margin-group')) {
        togglePopoverMargin(false);
      }
    });

    // Range Sliders input listeners (Real-time live nudge)
    this.overlay.querySelector('#rv-tb-nudge-x-slider')?.addEventListener('input', (e) => {
      this.setNudgePosition('x', e.target.value);
    });
    this.overlay.querySelector('#rv-tb-nudge-y-slider')?.addEventListener('input', (e) => {
      this.setNudgePosition('y', e.target.value);
    });

    // Quick Stepper Buttons for Nudge
    this.overlay.querySelectorAll('.rv-nudge-step-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const axis = btn.dataset.axis;
        if (btn.dataset.set !== undefined) {
          this.setNudgePosition(axis, Number(btn.dataset.set));
        } else if (btn.dataset.delta !== undefined) {
          const slider = this.overlay.querySelector(axis === 'x' ? '#rv-tb-nudge-x-slider' : '#rv-tb-nudge-y-slider');
          const cur = Number(slider ? slider.value : 0);
          this.setNudgePosition(axis, cur + Number(btn.dataset.delta));
        }
      });
    });

    // 9. PAGE SETUP (Orientation & Paper Size)
    const setOrientation = async (orient) => {
      if (this.settings.orientation === orient) return;
      this.settings.orientation = orient;
      this.applyPageSetup();
      await this.refreshContent(false);
      this.autoSaveIfEnabled();
    };

    this.overlay.querySelector('#rv-btn-orient-portrait')?.addEventListener('click', () => setOrientation('portrait'));
    this.overlay.querySelector('#rv-btn-orient-landscape')?.addEventListener('click', () => setOrientation('landscape'));

    // Paper Size (A4, A3)
    const setPaperSize = async (sz) => {
      const normalized = String(sz).toUpperCase();
      if (this.settings.paperSize === normalized) return;
      this.settings.paperSize = normalized;
      this.applyPageSetup();
      await this.refreshContent(false);
      this.autoSaveIfEnabled();
    };

    ['a4', 'a3'].forEach(sz => {
      this.overlay.querySelector(`#rv-btn-size-${sz}`)?.addEventListener('click', () => setPaperSize(sz));
    });

    // Zoom Controls
    const setZoom = (z) => {
      this.settings.zoom = Math.max(30, Math.min(200, Math.round(Number(z) || 100)));
      this.applyPageSetup();
      this.autoSaveIfEnabled();
    };

    const zoomStep = (direction) => {
      const cur = Number(this.settings.zoom) || 100;
      let next;
      if (direction > 0) {
        // Zoom In
        const snaps = [30, 50, 65, 75, 85, 90, 100, 110, 125, 150, 175, 200];
        next = snaps.find(z => z > cur);
        if (!next) next = Math.min(200, cur + 10);
      } else {
        // Zoom Out
        const snaps = [200, 175, 150, 125, 110, 100, 90, 85, 75, 65, 50, 30];
        next = snaps.find(z => z < cur);
        if (!next) next = Math.max(30, cur - 10);
      }
      setZoom(next);
    };

    this.overlay.querySelector('#rv-btn-zoom-in')?.addEventListener('click', () => zoomStep(1));
    this.overlay.querySelector('#rv-btn-zoom-out')?.addEventListener('click', () => zoomStep(-1));
    this.overlay.querySelector('#rv-zoom-label')?.addEventListener('click', () => setZoom(100));

    // Mouse Wheel Zoom:
    // 1. Direct wheel scrolling when hovering over zoom toolbar controls
    const zoomControls = this.overlay.querySelector('#rv-zoom-controls');
    zoomControls?.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomStep(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    // 2. Ctrl + Mouse Wheel (or Cmd + Wheel / Trackpad pinch) anywhere inside the report viewer
    this.overlay.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomStep(e.deltaY < 0 ? 1 : -1);
      }
    }, { passive: false });

    // Preset Actions
    this.overlay.querySelector('#rv-btn-save-preset')?.addEventListener('click', () => this.savePreset(true));
    this.overlay.querySelector('#rv-btn-reset-preset')?.addEventListener('click', () => this.resetPreset());

    // Export PDF action
    this.overlay.querySelector('#rv-btn-export-pdf')?.addEventListener('click', () => this.exportPDF());

    // Print action
    this.overlay.querySelector('#rv-btn-print')?.addEventListener('click', () => this.print());
  }
}
