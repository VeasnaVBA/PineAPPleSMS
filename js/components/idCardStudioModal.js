/**
 * Student ID Card Studio & Printing Modal
 * Comprehensive, interactive live studio with A4 multi-page pagination,
 * Portrait and Landscape orientation toggles, customizable card dimensions,
 * theme color schemes, signature & stamp uploaders, toggleable field checklist,
 * and 1-to-1 A4 print fidelity.
 */
import { DEFAULT_CARD_CONFIG, DEFAULT_FIELD_STYLES, DIMENSION_PRESETS, THEME_COLOR_PRESETS, renderCardSheetHtml, renderIDCardHtml, chunkStudentsForPages, resolveCardDateText } from './idCardTemplate.js';
import { formatKhmerLunarDate, formatKhmerSolarDate } from '../utils/khmerLunar.js';
import { SettingsService } from '../services/settingsService.js';
import { SchoolService } from '../services/schoolService.js';
import { toast } from './toast.js';
import { getIcon } from './icons.js';
import { i18n } from '../i18n/i18n.js';

export const IDCardStudioModal = {
  activeOverlay: null,
  students: [],
  selectedStudentIds: new Set(),
  classMap: new Map(),
  classesList: [],
  config: { ...DEFAULT_CARD_CONFIG },
  currentPage: 0,
  previewStudentIndex: 0,
  viewMode: 'card', // 'card' (Single Card Design Focus) | 'sheet' (Full A4 Sheet Layout)
  zoomScale: 1.75, // Default zoom scale for single card view
  studentSearchQuery: '',
  studentClassFilter: 'all',
  onlyShowSelectedInSheet: true,

  /**
   * Helper to get unique student identifier key
   */
  getStudentKey(student) {
    if (!student) return '';
    return String(student.id || student.studentId || student._id || '');
  },

  /**
   * Get array of all currently checked/selected students
   */
  getSelectedStudents() {
    return this.students.filter(s => this.selectedStudentIds.has(this.getStudentKey(s)));
  },

  /**
   * Filter students by search keyword and class filter for the student checklist
   */
  getFilteredStudentsForList() {
    const q = (this.studentSearchQuery || '').trim().toLowerCase();
    const cFilter = this.studentClassFilter || 'all';

    return this.students.filter(s => {
      if (cFilter !== 'all') {
        const matchesId = s.classId && String(s.classId) === String(cFilter);
        const matchesName = s.className && String(s.className).toLowerCase() === String(cFilter).toLowerCase();
        if (!matchesId && !matchesName) return false;
      }
      if (!q) return true;
      const khName = `${s.lastNameKh || ''} ${s.firstNameKh || ''} ${s.khmerName || ''}`.toLowerCase();
      const enName = `${s.lastNameLatin || ''} ${s.firstNameLatin || ''} ${s.englishName || ''}`.toLowerCase();
      const id = String(s.studentId || s.id || '').toLowerCase();
      const cName = String(this.classMap.get(s.classId) || s.className || '').toLowerCase();
      return khName.includes(q) || enName.includes(q) || id.includes(q) || cName.includes(q);
    });
  },

  /**
   * Render HTML checklist of students for the Students tab
   */
  renderStudentsChecklistHtml() {
    const isKm = i18n.getLocale() === 'km';
    const filtered = this.getFilteredStudentsForList();

    if (filtered.length === 0) {
      return `
        <div class="p-8 text-center text-muted-foreground font-khmer text-xs space-y-1.5 bg-muted/10 rounded-2xl border border-dashed border-border/80">
          <div class="w-10 h-10 mx-auto rounded-xl bg-muted flex items-center justify-center text-muted-foreground mb-1">
            ${getIcon('search', 'w-5 h-5')}
          </div>
          <div class="font-semibold text-foreground">${isKm ? 'រកមិនឃើញសិស្សទេ' : 'No students found'}</div>
          <div class="text-[11px]">${isKm ? 'សូមសាកល្បងពាក្យគន្លឹះ ឬជ្រើសរើសថ្នាក់ផ្សេង' : 'Try searching another name, ID or class'}</div>
        </div>
      `;
    }

    return filtered.map((s) => {
      const origIndex = this.students.indexOf(s);
      const studentKey = this.getStudentKey(s);
      const isSelected = this.selectedStudentIds.has(studentKey);
      const isPreview = this.previewStudentIndex === origIndex;
      const lastNameKh = s.lastNameKh || '';
      const firstNameKh = s.firstNameKh || '';
      const nameKh = `${lastNameKh} ${firstNameKh}`.trim() || s.khmerName || '—';
      const lastNameLatin = s.lastNameLatin || '';
      const firstNameLatin = s.firstNameLatin || '';
      const nameLatin = `${lastNameLatin} ${firstNameLatin}`.trim() || s.englishName || '';
      const className = this.classMap.get(s.classId) || s.className || '—';
      const studentId = s.studentId || s.id || '—';
      const hasPhoto = !!(s.photoBlob || s.photo);
      const photoSrc = s.photoBlob 
        ? (typeof s.photoBlob === 'string' ? s.photoBlob : URL.createObjectURL(s.photoBlob)) 
        : (s.photo && s.photo !== '(Photo attached)' ? s.photo : null);

      return `
        <div class="student-item-row group relative p-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-2.5 select-none cursor-pointer ${
          isSelected 
            ? 'bg-primary/[0.04] border-primary/40 shadow-xs ring-1 ring-primary/20' 
            : 'bg-card/70 border-border/70 hover:bg-muted/40 hover:border-border opacity-75 hover:opacity-100'
        } ${
          isPreview 
            ? 'border-l-4 border-l-primary ring-1 ring-primary/40 shadow-xs opacity-100' 
            : ''
        }" data-student-index="${origIndex}" data-student-key="${studentKey}">
          
          <!-- Left: Checkbox & Avatar & Info -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1 student-row-clickable">
            <input type="checkbox" data-student-key="${studentKey}" class="student-select-checkbox h-4 w-4 rounded-md border-input text-primary focus:ring-primary cursor-pointer shrink-0 accent-primary" ${isSelected ? 'checked' : ''} />
            
            <div class="w-9 h-9 rounded-xl overflow-hidden border border-border/80 bg-muted/60 flex items-center justify-center shrink-0 shadow-2xs relative">
              ${photoSrc ? `
                <img src="${photoSrc}" class="w-full h-full object-cover" onerror="this.style.display='none'" />
              ` : `
                <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 via-primary/10 to-muted/40 text-primary font-khmer font-bold text-xs">
                  ${nameKh ? nameKh.charAt(0) : 'S'}
                </div>
              `}
              ${hasPhoto ? `
                <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card shadow-2xs" title="${isKm ? 'មានរូបថត' : 'Has Photo'}"></span>
              ` : ''}
            </div>

            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="flex items-center gap-1.5 truncate">
                <span class="font-bold text-xs font-khmer text-foreground group-hover:text-primary transition-colors truncate">${nameKh}</span>
                ${nameLatin ? `<span class="text-[10px] text-muted-foreground/80 font-sans uppercase font-medium truncate shrink-0">(${nameLatin})</span>` : ''}
              </div>
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="font-mono font-semibold px-1.5 py-0.2 rounded-md bg-secondary/80 text-foreground border border-border/50">${studentId}</span>
                <span class="font-khmer font-medium px-1.5 py-0.2 rounded-md bg-primary/10 text-primary border border-primary/15 truncate max-w-[110px]">${className}</span>
              </div>
            </div>
          </div>

          <!-- Right: Actions (Preview & Quick Print) -->
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-student-index="${origIndex}" title="${isKm ? 'មើលកាតនេះ' : 'Preview Card'}" class="btn-preview-student-row w-7 h-7 rounded-lg border border-input bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center justify-center cursor-pointer shadow-2xs">
              ${getIcon('eye', 'w-3.5 h-3.5')}
            </button>
            <button type="button" data-student-index="${origIndex}" title="${isKm ? 'បោះពុម្ពកាតនេះ' : 'Print This Card'}" class="btn-print-student-row w-7 h-7 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary transition-all flex items-center justify-center cursor-pointer shadow-2xs">
              ${getIcon('printer', 'w-3.5 h-3.5')}
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Open the ID Card Studio for the given students list
   * @param {Array} studentsList 
   * @param {Array} classesList 
   */
  async open(studentsList = [], classesList = []) {
    if (!studentsList || studentsList.length === 0) {
      toast.warning(i18n.getLocale() === 'km' ? 'សូមជ្រើសរើសសិស្សយ៉ាងហោចណាស់ម្នាក់' : 'Please select at least one student');
      return;
    }

    this.students = [...studentsList];
    this.classesList = [...classesList];
    this.classMap = new Map(classesList.map(c => [c.id, c.name]));
    this.selectedStudentIds = new Set(this.students.map(s => this.getStudentKey(s)));
    this.currentPage = 0;
    this.previewStudentIndex = 0;
    this.studentSearchQuery = '';
    this.studentClassFilter = 'all';
    this.onlyShowSelectedInSheet = true;
    this.viewMode = this.viewMode || 'card';
    this.zoomScale = this.viewMode === 'card' ? 1.75 : (this.config.sheetOrientation === 'landscape' ? 0.55 : 0.65);

    // Load persisted settings from IndexedDB
    await this.loadPersistedSettings();

    this.renderModal();
  },

  /**
   * Load saved studio configuration from IndexedDB
   */
  async loadPersistedSettings() {
    try {
      // Resolve registered school from app database
      let appSchoolKh = '';
      let appSchoolEn = '';
      let appSchoolLogo = '';

      try {
        const schools = await SchoolService.getAllSchools();
        if (schools && schools.length > 0) {
          const first = schools[0];
          appSchoolKh = first.name || first.schoolNameKh || '';
          appSchoolEn = first.latinName || first.nameLatin || first.schoolNameEn || '';
          appSchoolLogo = first.logo || './assets/images/school_logo.png';
        }
        if (!appSchoolKh) {
          appSchoolKh = (await SettingsService.get('school_name_km')) || (await SettingsService.get('moeys_report_school_name')) || '';
        }
        if (!appSchoolEn) {
          appSchoolEn = (await SettingsService.get('school_name_en')) || '';
        }
        if (!appSchoolLogo) {
          appSchoolLogo = './assets/images/school_logo.png';
        }
      } catch (_) {}

      const defaultSchoolKh = appSchoolKh || 'ឈ្មោះសាលារៀន';
      const defaultSchoolEn = appSchoolEn || 'SCHOOL NAME';

      const saved = await SettingsService.get('id_card_studio_config');
      if (saved && typeof saved === 'object') {
        this.config = {
          ...DEFAULT_CARD_CONFIG,
          ...saved,
          fields: {
            ...DEFAULT_CARD_CONFIG.fields,
            ...(saved.fields || {})
          },
          fieldStyles: {
            ...DEFAULT_FIELD_STYLES,
            ...(saved.fieldStyles || {})
          }
        };

        // If saved still has old placeholder names, replace with app school or default
        if (!this.config.schoolNameKh || this.config.schoolNameKh === 'សាលារៀនអន្តរជាតិ ស្មាតស្គូល' || this.config.schoolNameKh === 'សាលារៀន ស្មាតស្គូល') {
          this.config.schoolNameKh = defaultSchoolKh;
        }
        if (!this.config.schoolNameEn || this.config.schoolNameEn === 'SMART SCHOOL INTERNATIONAL' || this.config.schoolNameEn === 'SMART SCHOOL') {
          this.config.schoolNameEn = defaultSchoolEn;
        }
        if (!this.config.schoolLogo && appSchoolLogo) {
          this.config.schoolLogo = appSchoolLogo;
        }
      } else {
        this.config.schoolNameKh = defaultSchoolKh;
        this.config.schoolNameEn = defaultSchoolEn;
        if (appSchoolLogo) {
          this.config.schoolLogo = appSchoolLogo;
        }
      }

      if (!this.config.cardDateLocation) {
        this.config.cardDateLocation = this.config.schoolNameKh && this.config.schoolNameKh !== 'ឈ្មោះសាលារៀន' ? this.config.schoolNameKh : '';
      }
    } catch (err) {
      console.warn('Failed to load ID card studio settings, using defaults:', err);
    }
  },

  /**
   * Persist current studio configuration to IndexedDB
   */
  async savePersistedSettings() {
    try {
      await SettingsService.set('id_card_studio_config', this.config);
    } catch (err) {
      console.warn('Failed to save ID card studio settings:', err);
    }
  },

  /**
   * Render the full Studio Modal interface
   */
  renderModal() {
    if (this.activeOverlay) {
      this.activeOverlay.remove();
    }

    const isKm = i18n.getLocale() === 'km';
    const isCardLandscape = this.config.cardOrientation === 'landscape';
    const isSheetLandscape = this.config.sheetOrientation === 'landscape';
    const totalStudents = this.students.length;
    const selectedStudents = this.getSelectedStudents();
    const selectedCount = selectedStudents.length;
    const currentStudent = this.students[this.previewStudentIndex] || {};
    const currentStudentKey = this.getStudentKey(currentStudent);
    const isCurrentSelected = this.selectedStudentIds.has(currentStudentKey);
    const currentStudentName = `${currentStudent.lastNameKh || ''} ${currentStudent.firstNameKh || ''}`.trim() || currentStudent.khmerName || 'Student';

    const pages = chunkStudentsForPages(this.onlyShowSelectedInSheet && selectedCount > 0 ? selectedStudents : this.students, this.config.cardsPerSheet);
    const totalPages = pages.length;
    const totalPagesAll = chunkStudentsForPages(this.students, this.config.cardsPerSheet).length;

    const overlay = document.createElement('div');
    overlay.id = 'id-card-studio-overlay';
    overlay.className = 'fixed inset-0 z-[80] flex flex-col bg-background/95 backdrop-blur-md text-foreground select-none overflow-hidden animate-fade-in font-sans';

    this.activeTab = this.activeTab || 'layout';

    const tabMeta = {
      layout: { titleKm: 'ប្លង់ទំព័រ & ខ្នាត', titleEn: 'Layout & Size' },
      style: { titleKm: 'រចនាប័ទ្ម & រូបថត', titleEn: 'Theme & Photo' },
      branding: { titleKm: 'សាលារៀន & ឡូហ្គោ', titleEn: 'School & Logo' },
      signature: { titleKm: 'ហត្ថលេខា ត្រា & កាលបរិច្ឆេទ', titleEn: 'Signature, Stamp & Date' },
      fields: { titleKm: 'ទិន្នន័យលើកាត', titleEn: 'Card Fields' },
      students: { titleKm: 'ជ្រើសរើសសិស្សបោះពុម្ព', titleEn: 'Select Students' }
    };
    const currentTab = tabMeta[this.activeTab] || tabMeta.layout;

    const rawCardDate = this.config.cardDateValue ? new Date(this.config.cardDateValue) : new Date();
    const validCardDate = isNaN(rawCardDate.getTime()) ? new Date() : rawCardDate;
    const cardDateIso = validCardDate.toISOString().split('T')[0];
    const defaultLunar = formatKhmerLunarDate(validCardDate);
    const locPrefix = this.config.cardDateLocation && this.config.cardDateLocation.trim() ? `${this.config.cardDateLocation.trim()}, ` : '';
    const defaultSolar = `${locPrefix}${formatKhmerSolarDate(validCardDate)}`;
    const dateLine1 = this.config.cardDateCustomLine1 !== undefined && this.config.cardDateCustomLine1 !== '' ? this.config.cardDateCustomLine1 : defaultLunar;
    const dateLine2 = this.config.cardDateCustomLine2 !== undefined && this.config.cardDateCustomLine2 !== '' ? this.config.cardDateCustomLine2 : defaultSolar;

    overlay.innerHTML = `
      <!-- 1. Top Navbar Header Bar -->
      <header class="h-16 px-4 sm:px-6 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
        <!-- Title & Count Badges -->
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            ${getIcon('idCard', 'w-5 h-5')}
          </div>
          <div class="min-w-0">
            <h2 class="text-base font-bold text-foreground font-khmer flex items-center gap-2 flex-wrap truncate">
              <span>${isKm ? (i18n.t('students.idCardStudioTitle') || 'ប័ណ្ណសម្គាល់ខ្លួនសិស្ស') : 'Student ID Card Studio'}</span>
              <span id="header-selected-count-badge" class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                ${isKm ? `បានជ្រើស ${selectedCount}/${totalStudents} សិស្ស` : `Selected ${selectedCount}/${totalStudents}`}
              </span>
            </h2>
          </div>
        </div>

        <!-- Header Actions: Reset, PDF, Print Dropdown, Close -->
        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <!-- Reset Card Design Button -->
          <button id="btn-studio-reset" type="button" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input bg-card hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 text-xs sm:text-sm font-medium transition-all shadow-2xs cursor-pointer font-khmer" title="${isKm ? 'កំណត់ការរចនាកាតឡើងវិញទៅលំនាំដើម' : 'Reset Card Design to Defaults'}">
            ${getIcon('rotateCcw', 'w-4 h-4')}
            <span class="hidden md:inline">${isKm ? 'កំណត់ឡើងវិញ' : 'Reset Design'}</span>
          </button>

          <!-- Export PDF Button -->
          <button id="btn-studio-pdf" type="button" class="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-input bg-card hover:bg-muted text-xs sm:text-sm font-medium transition-all shadow-2xs cursor-pointer font-khmer" title="${isKm ? 'នាំចេញជាទម្រង់ PDF' : 'Export PDF'}">
            ${getIcon('download', 'w-4 h-4')}
            <span>PDF</span>
          </button>

          <!-- Print Dropdown Component -->
          <div class="relative inline-block text-left" id="print-dropdown-wrapper">
            <div class="inline-flex rounded-lg shadow-sm">
              <button id="btn-studio-print-primary" type="button" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-l-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm cursor-pointer font-khmer">
                ${getIcon('printer', 'w-4 h-4')}
                <span id="btn-studio-print-label">${isKm ? `បោះពុម្ព (${selectedCount})` : `Print (${selectedCount})`}</span>
              </button>
              <button id="btn-studio-print-dropdown-toggle" type="button" class="px-2 py-2 rounded-r-lg bg-primary text-primary-foreground hover:bg-primary/80 border-l border-primary-foreground/20 cursor-pointer transition-all" title="${isKm ? 'ជម្រើសបោះពុម្ពបន្ថែម' : 'More Print Options'}">
                ${getIcon('chevronDown', 'w-3.5 h-3.5')}
              </button>
            </div>

            <!-- Print Dropdown Menu Options -->
            <div id="print-dropdown-menu" class="hidden absolute right-0 mt-2 w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl z-50 p-1.5 text-xs font-khmer animate-fade-in">
              <button type="button" id="btn-print-option-selected" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                <span class="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold">✓</span>
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-foreground">${isKm ? 'បោះពុម្ពសិស្សដែលបានជ្រើស' : 'Print Selected Students'}</div>
                  <div class="text-[10px] text-muted-foreground">${isKm ? `ចំនួន ${selectedCount} សិស្ស (${totalPages} ទំព័រ A4)` : `${selectedCount} students (${totalPages} A4 pages)`}</div>
                </div>
              </button>

              <button type="button" id="btn-print-option-current" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                <span class="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">📇</span>
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-foreground">${isKm ? 'បោះពុម្ពកាតសិស្សបច្ចុប្បន្ន' : 'Print Current Card'}</div>
                  <div class="text-[10px] text-muted-foreground truncate">${currentStudentName} (1 ${isKm ? 'កាត' : 'card'})</div>
                </div>
              </button>

              <div class="my-1 border-t border-border/60"></div>

              <button type="button" id="btn-print-option-all" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                <span class="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">👥</span>
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-foreground">${isKm ? 'បោះពុម្ពសិស្សទាំងអស់' : 'Print All Students'}</div>
                  <div class="text-[10px] text-muted-foreground">${totalStudents} ${isKm ? 'សិស្ស' : 'students'} (${totalPagesAll} ${isKm ? 'ទំព័រ A4' : 'A4 pages'})</div>
                </div>
              </button>
            </div>
          </div>

          <!-- Close Modal (X) -->
          <button id="btn-studio-close" type="button" class="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ml-1 cursor-pointer">
            ${getIcon('x', 'w-5 h-5')}
          </button>
        </div>
      </header>

      <!-- 2. Main Menu Under Navbar -->
      <nav class="min-h-[52px] py-2 px-4 sm:px-6 border-b border-border bg-card/95 flex items-center justify-between shrink-0 select-none overflow-x-auto gap-3 z-10">
        <div class="flex items-center gap-2">
          <button type="button" data-tab="layout" class="studio-tab-btn px-3.5 py-1.5 rounded-lg ${this.activeTab === 'layout' ? 'bg-primary text-primary-foreground font-bold shadow-xs border border-primary' : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-medium border border-input shadow-2xs'} font-khmer transition-all cursor-pointer text-xs whitespace-nowrap">
            <span>${isKm ? 'ប្លង់ទំព័រ & ខ្នាត' : 'Layout & Size'}</span>
          </button>
          <button type="button" data-tab="style" class="studio-tab-btn px-3.5 py-1.5 rounded-lg ${this.activeTab === 'style' ? 'bg-primary text-primary-foreground font-bold shadow-xs border border-primary' : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-medium border border-input shadow-2xs'} font-khmer transition-all cursor-pointer text-xs whitespace-nowrap">
            <span>${isKm ? 'រចនាប័ទ្ម & រូបថត' : 'Theme & Photo'}</span>
          </button>
          <button type="button" data-tab="branding" class="studio-tab-btn px-3.5 py-1.5 rounded-lg ${this.activeTab === 'branding' ? 'bg-primary text-primary-foreground font-bold shadow-xs border border-primary' : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-medium border border-input shadow-2xs'} font-khmer transition-all cursor-pointer text-xs whitespace-nowrap">
            <span>${isKm ? 'សាលារៀន & ឡូហ្គោ' : 'School & Logo'}</span>
          </button>
          <button type="button" data-tab="signature" class="studio-tab-btn px-3.5 py-1.5 rounded-lg ${this.activeTab === 'signature' ? 'bg-primary text-primary-foreground font-bold shadow-xs border border-primary' : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-medium border border-input shadow-2xs'} font-khmer transition-all cursor-pointer text-xs whitespace-nowrap">
            <span>${isKm ? 'ហត្ថលេខា & ត្រា' : 'Signature & Stamp'}</span>
          </button>
          <button type="button" data-tab="fields" class="studio-tab-btn px-3.5 py-1.5 rounded-lg ${this.activeTab === 'fields' ? 'bg-primary text-primary-foreground font-bold shadow-xs border border-primary' : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-medium border border-input shadow-2xs'} font-khmer transition-all cursor-pointer text-xs whitespace-nowrap">
            <span>${isKm ? 'ទិន្នន័យលើកាត' : 'Card Fields'}</span>
          </button>
          <button type="button" data-tab="students" class="studio-tab-btn px-3.5 py-1.5 rounded-lg ${this.activeTab === 'students' ? 'bg-primary text-primary-foreground font-bold shadow-xs border border-primary' : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-medium border border-input shadow-2xs'} font-khmer transition-all cursor-pointer text-xs whitespace-nowrap flex items-center gap-1.5">
            <span>${isKm ? 'ជ្រើសរើសសិស្ស' : 'Select Students'}</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-primary/20 text-primary-foreground border border-primary-foreground/30">${selectedCount}</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" id="btn-toggle-tools-sidebar" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-input bg-card hover:bg-muted text-xs font-medium transition-colors cursor-pointer text-foreground font-khmer shadow-2xs" title="${isKm ? 'បើក/បិទផ្ទាំងឧបករណ៍' : 'Toggle Tools Panel'}">
            ${getIcon('sliders', 'w-3.5 h-3.5 text-primary')}
            <span class="hidden sm:inline">${isKm ? 'ផ្ទាំងឧបករណ៍' : 'Tools Panel'}</span>
          </button>
        </div>
      </nav>

      <!-- 3. MAIN WORKSPACE WITH CANVAS AND RIGHT SIDEBAR -->
      <div class="flex-1 flex flex-row min-h-0 overflow-hidden relative">
        
        <!-- Left / Center: Full Canvas Workspace -->
        <main class="flex-1 flex flex-col min-w-0 bg-muted/40 relative overflow-hidden">
          
          <!-- Sheet & View Mode Navigation Sub-toolbar -->
          <div class="h-12 px-3 sm:px-6 border-b border-border/60 bg-background/90 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0 text-xs text-muted-foreground z-10">
            
            <!-- Left: View Mode Segmented Switcher & Scope Toggle -->
            <div class="flex items-center gap-2">
              <div class="flex items-center h-8 bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
                <button type="button" id="btn-view-mode-card" class="h-7 px-3 rounded-md flex items-center gap-1.5 transition-all font-khmer cursor-pointer text-xs ${this.viewMode === 'card' ? 'bg-background text-primary font-bold shadow-2xs border border-border/50' : 'text-muted-foreground hover:text-foreground'}">
                  ${getIcon('idCard', 'w-3.5 h-3.5')}
                  <span class="hidden xs:inline">${isKm ? 'រចនាកាតទោល' : 'Single Card'}</span>
                  <span class="xs:hidden">${isKm ? 'កាតទោល' : 'Single'}</span>
                </button>
                <button type="button" id="btn-view-mode-sheet" class="h-7 px-3 rounded-md flex items-center gap-1.5 transition-all font-khmer cursor-pointer text-xs ${this.viewMode === 'sheet' ? 'bg-background text-primary font-bold shadow-2xs border border-border/50' : 'text-muted-foreground hover:text-foreground'}">
                  ${getIcon('layoutGrid', 'w-3.5 h-3.5')}
                  <span class="hidden xs:inline">${isKm ? 'ប្លង់សន្លឹក A4' : 'A4 Sheet Layout'}</span>
                  <span class="xs:hidden">${isKm ? 'សន្លឹក A4' : 'Sheet'}</span>
                </button>
              </div>

              ${this.viewMode === 'card' ? `
                <div class="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
                  <!-- Single Card Select Toggle -->
                  <label class="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input bg-card hover:bg-muted text-xs font-khmer cursor-pointer transition-colors shadow-2xs">
                    <input type="checkbox" id="chk-current-student-selected" class="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary cursor-pointer accent-primary" ${isCurrentSelected ? 'checked' : ''} />
                    <span class="font-medium text-foreground">${isKm ? 'ជ្រើសសម្រាប់បោះពុម្ព' : 'Selected for Print'}</span>
                  </label>

                  <!-- Print This Card Button -->
                  <button type="button" id="btn-print-current-card-sub" class="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input bg-card hover:bg-muted hover:border-primary/40 hover:text-primary text-foreground text-xs font-khmer font-medium transition-colors shadow-2xs cursor-pointer">
                    ${getIcon('printer', 'w-3.5 h-3.5')}
                    <span>${isKm ? 'បោះពុម្ពកាតនេះ' : 'Print This Card'}</span>
                  </button>
                </div>
              ` : `
                <div class="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
                  <div class="flex items-center h-8 bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
                    <button type="button" id="btn-sheet-toggle-selected" class="h-7 px-2.5 rounded-md font-khmer transition-all cursor-pointer text-xs ${this.onlyShowSelectedInSheet ? 'bg-background text-primary font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground'}">
                      ${isKm ? `សិស្សដែលបានជ្រើស (${selectedCount})` : `Selected (${selectedCount})`}
                    </button>
                    <button type="button" id="btn-sheet-toggle-all" class="h-7 px-2.5 rounded-md font-khmer transition-all cursor-pointer text-xs ${!this.onlyShowSelectedInSheet ? 'bg-background text-primary font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground'}">
                      ${isKm ? `ទាំងអស់ (${totalStudents})` : `All (${totalStudents})`}
                    </button>
                  </div>
                </div>
              `}
            </div>

            <!-- Center/Right: Zoom Controls & Pager -->
            <div class="flex items-center gap-3">
              <!-- Zoom Controls -->
              <div class="flex items-center h-8 gap-0.5 border border-input rounded-lg p-0.5 bg-background shadow-2xs">
                <button id="btn-studio-zoom-out" type="button" title="Zoom Out" class="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors">
                  ${getIcon('zoomOut', 'w-3.5 h-3.5')}
                </button>
                <span id="label-studio-zoom" class="text-xs font-mono font-semibold px-1 min-w-[38px] text-center text-foreground">
                  ${Math.round(this.zoomScale * 100)}%
                </span>
                <button id="btn-studio-zoom-in" type="button" title="Zoom In" class="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors">
                  ${getIcon('zoomIn', 'w-3.5 h-3.5')}
                </button>
                <button id="btn-studio-zoom-fit" type="button" title="Fit Window" class="h-7 px-2 text-xs rounded-md hover:bg-muted text-muted-foreground hover:text-foreground font-medium flex items-center justify-center cursor-pointer font-khmer transition-colors">
                  Fit
                </button>
              </div>

              <!-- Pager / Student Selector -->
              <div class="flex items-center h-8 gap-1.5 border-l border-border pl-3">
                <button id="btn-prev-sheet" type="button" class="h-8 w-8 rounded-lg border border-input bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs">
                  ${getIcon('chevronLeft', 'w-4 h-4')}
                </button>
                <span id="sheet-pager-label" class="font-khmer font-semibold text-foreground text-xs truncate max-w-[200px] sm:max-w-[320px] text-center px-1"></span>
                <button id="btn-next-sheet" type="button" class="h-8 w-8 rounded-lg border border-input bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs">
                  ${getIcon('chevronRight', 'w-4 h-4')}
                </button>
              </div>
            </div>
          </div>

          <!-- Zoomable Scroll Container -->
          <div class="flex-1 overflow-auto p-4 sm:p-8 flex items-start justify-center" id="a4-scroll-viewport">
            <div id="a4-canvas-transform-wrapper" class="transition-transform duration-150 origin-top flex flex-col items-center">
              <!-- Rendered A4 Sheet / Single Card Container -->
              <div id="a4-sheet-container"></div>
            </div>
          </div>
        </main>

        <!-- Right: Tools Sidebar Panel -->
        <aside id="studio-sidebar-panel" class="w-80 sm:w-96 border-l border-border bg-card flex flex-col shrink-0 overflow-hidden shadow-xl z-20 transition-all duration-200">
          
          <!-- Sidebar Header: Active Tab Title & Close Button -->
          <div class="h-11 px-4 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
            <h3 id="sidebar-tab-title" class="text-xs font-bold text-foreground font-khmer">
              ${isKm ? currentTab.titleKm : currentTab.titleEn}
            </h3>
            <button id="btn-close-sidebar-panel" type="button" class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer" title="${isKm ? 'បិទផ្ទាំងឧបករណ៍' : 'Close Tools Panel'}">
              ${getIcon('x', 'w-4 h-4')}
            </button>
          </div>

          <!-- Sidebar Form Content -->
          <div class="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-foreground" id="studio-tab-content">
            
            <!-- Tab 1: Layout & Size Controls -->
            <div id="tab-panel-layout" class="tab-panel ${this.activeTab === 'layout' ? '' : 'hidden'} space-y-4">
              <!-- Card Orientation -->
              <div class="space-y-1.5">
                <label class="block font-semibold font-khmer text-xs">${isKm ? 'ទិសដៅកាតសិស្ស' : 'Card Orientation'}</label>
                <div class="grid grid-cols-2 gap-2">
                  <button type="button" id="btn-orient-card-portrait" class="py-2 px-3 rounded-lg border text-xs font-semibold font-khmer transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${!isCardLandscape ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card hover:bg-muted text-foreground'}">
                    <span>▯ ${isKm ? 'បញ្ឈរ' : 'Portrait'}</span>
                  </button>
                  <button type="button" id="btn-orient-card-landscape" class="py-2 px-3 rounded-lg border text-xs font-semibold font-khmer transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${isCardLandscape ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card hover:bg-muted text-foreground'}">
                    <span>▭ ${isKm ? 'បណ្តោយ' : 'Landscape'}</span>
                  </button>
                </div>
              </div>

              <!-- Sheet Orientation -->
              <div class="space-y-1.5">
                <label class="block font-semibold font-khmer text-xs">${isKm ? 'ទិសដៅក្រដាស A4' : 'A4 Orientation'}</label>
                <div class="grid grid-cols-2 gap-2">
                  <button type="button" id="btn-orient-sheet-portrait" class="py-2 px-3 rounded-lg border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${!isSheetLandscape ? 'border-primary bg-primary text-primary-foreground font-semibold' : 'border-input bg-card hover:bg-muted text-foreground'}">
                    <span>▯ ${isKm ? 'បញ្ឈរ' : 'Portrait'}</span>
                  </button>
                  <button type="button" id="btn-orient-sheet-landscape" class="py-2 px-3 rounded-lg border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${isSheetLandscape ? 'border-primary bg-primary text-primary-foreground font-semibold' : 'border-input bg-card hover:bg-muted text-foreground'}">
                    <span>▭ ${isKm ? 'បណ្តោយ' : 'Landscape'}</span>
                  </button>
                </div>
              </div>

              <!-- Cards per Sheet -->
              <div class="space-y-1.5">
                <label class="block font-semibold font-khmer text-xs">${isKm ? 'ចំនួនកាតក្នុងមួយទំព័រ A4' : 'Cards per A4 Sheet'}</label>
                <select id="select-cards-per-sheet" class="w-full h-9 px-3 rounded-lg border border-input bg-card text-foreground box-border shadow-2xs font-khmer font-medium text-xs">
                  <option value="4" ${this.config.cardsPerSheet === 4 ? 'selected' : ''}>4 ${isKm ? 'កាត (2×2)' : 'Cards (2×2)'}</option>
                  <option value="6" ${this.config.cardsPerSheet === 6 ? 'selected' : ''}>6 ${isKm ? 'កាត' : 'Cards'}</option>
                  <option value="8" ${this.config.cardsPerSheet === 8 ? 'selected' : ''}>8 ${isKm ? 'កាត' : 'Cards'}</option>
                  <option value="10" ${this.config.cardsPerSheet === 10 ? 'selected' : ''}>10 ${isKm ? 'កាត' : 'Cards'}</option>
                </select>
              </div>

              <!-- Card Dimension Presets -->
              <div class="space-y-1.5">
                <label class="block font-semibold font-khmer text-xs">${isKm ? 'ខ្នាតទំហំកាត' : 'Card Dimension'}</label>
                <select id="select-dimension-preset" class="w-full h-9 px-3 rounded-lg border border-input bg-card text-foreground box-border shadow-2xs font-khmer font-medium text-xs">
                  <option value="cr80" ${this.config.dimensions === 'cr80' ? 'selected' : ''}>${isKm ? 'CR80 ស្តង់ដារ (54×85.6mm)' : 'CR80 Standard (54×85.6mm)'}</option>
                  <option value="medium" ${this.config.dimensions === 'medium' ? 'selected' : ''}>${isKm ? 'មធ្យម (60×90mm)' : 'Medium (60×90mm)'}</option>
                  <option value="badge" ${this.config.dimensions === 'badge' ? 'selected' : ''}>${isKm ? 'ប័ណ្ណធំ (65×95mm)' : 'Badge (65×95mm)'}</option>
                  <option value="custom" ${this.config.dimensions === 'custom' ? 'selected' : ''}>${isKm ? 'ផ្ទាល់ខ្លួន (Custom mm)' : 'Custom (mm)'}</option>
                </select>
                <div id="custom-dimension-inputs" class="${this.config.dimensions === 'custom' ? '' : 'hidden'} grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label class="block text-[10px] text-muted-foreground mb-0.5">Width (mm)</label>
                    <input type="number" id="input-custom-width" min="40" max="140" step="0.5" value="${this.config.widthMm}" placeholder="W mm" class="w-full h-8 px-2 rounded-md border border-input bg-background font-mono text-xs" />
                  </div>
                  <div>
                    <label class="block text-[10px] text-muted-foreground mb-0.5">Height (mm)</label>
                    <input type="number" id="input-custom-height" min="40" max="140" step="0.5" value="${this.config.heightMm}" placeholder="H mm" class="w-full h-8 px-2 rounded-md border border-input bg-background font-mono text-xs" />
                  </div>
                </div>
              </div>

              <!-- Spacing Gap -->
              <div class="space-y-1.5">
                <label class="block font-semibold font-khmer text-xs">${isKm ? 'គម្លាតរវាងកាត (Card Gap)' : 'Card Spacing Gap'}</label>
                <div class="grid grid-cols-4 gap-1.5">
                  ${[2, 4, 6, 8].map(g => `
                    <button type="button" data-gap="${g}" class="btn-gap-select py-1.5 rounded-lg border text-xs font-mono font-medium transition-all ${this.config.gapMm === g ? 'border-primary bg-primary text-primary-foreground font-bold' : 'border-input bg-card hover:bg-muted text-foreground'}">
                      ${g}mm
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Paper Margins -->
              <div class="space-y-1.5">
                <div class="flex justify-between items-center">
                  <label class="block font-semibold font-khmer text-xs">${isKm ? 'គម្លាតគែមក្រដាស A4 (Margin)' : 'A4 Paper Margin'}</label>
                  <span id="label-sheet-margin" class="font-mono text-xs font-bold text-foreground">${this.config.sheetMarginMm !== undefined ? this.config.sheetMarginMm : 8}mm</span>
                </div>
                <div class="grid grid-cols-4 gap-1.5">
                  ${[0, 5, 8, 12].map(m => `
                    <button type="button" data-margin="${m}" class="btn-margin-select py-1.5 rounded-lg border text-xs font-mono font-medium transition-all ${(this.config.sheetMarginMm !== undefined ? this.config.sheetMarginMm : 8) === m ? 'border-primary bg-primary text-primary-foreground font-bold' : 'border-input bg-card hover:bg-muted text-foreground'}">
                      ${m === 0 ? (isKm ? '0mm' : '0mm') : m + 'mm'}
                    </button>
                  `).join('')}
                </div>
                <input type="range" id="input-sheet-margin-slider" min="0" max="25" step="1" value="${this.config.sheetMarginMm !== undefined ? this.config.sheetMarginMm : 8}" class="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary mt-2" />
              </div>

              <!-- Crop Marks -->
              <div class="pt-1">
                <label class="flex items-center gap-2.5 p-2.5 rounded-lg border border-input bg-card hover:bg-muted cursor-pointer transition-colors">
                  <input type="checkbox" id="toggle-crop-marks" class="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer" ${this.config.showCropMarks ? 'checked' : ''} />
                  <span class="text-xs font-semibold font-khmer">${isKm ? 'បង្ហាញសញ្ញាកាត់ (Crop Marks)' : 'Show Cutting Guides / Crop Marks'}</span>
                </label>
              </div>
            </div>

            <!-- Tab 2: Theme & Photo Controls -->
            <div id="tab-panel-style" class="tab-panel ${this.activeTab === 'style' ? '' : 'hidden'} space-y-4">
              <!-- Custom Card Background Image Upload -->
              <div class="space-y-2 p-3 rounded-xl border border-border bg-muted/20">
                <div class="flex items-center justify-between">
                  <label class="block font-semibold font-khmer text-xs">${isKm ? 'រូបភាពផ្ទៃខាងក្រោយកាត' : 'Card Background Image'}</label>
                  <span class="text-[10px] text-muted-foreground font-khmer">${isKm ? 'រចនាស្មើទំហំកាត (100% Fit)' : 'Exact 1:1 Fit'}</span>
                </div>
                <div class="flex items-center gap-3">
                  <div class="w-16 h-12 rounded-lg border border-dashed border-border bg-background flex items-center justify-center overflow-hidden shrink-0 shadow-2xs" id="bg-preview-box">
                    ${this.config.backgroundImage ? `
                      <img src="${this.config.backgroundImage}" class="w-full h-full object-cover" />
                    ` : `
                      <span class="text-muted-foreground text-[10px] font-khmer">${isKm ? 'គ្មាន' : 'Default'}</span>
                    `}
                  </div>
                  <div class="space-y-1 flex-1 min-w-0">
                    <button type="button" id="btn-upload-bg-image" class="px-3 py-1.5 rounded-lg border border-input bg-card hover:bg-muted text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer font-khmer">
                      ${getIcon('upload', 'w-3.5 h-3.5')}
                      <span>${isKm ? 'បញ្ចូលរូបផ្ទៃខាងក្រោយ' : 'Upload Background'}</span>
                    </button>
                    ${this.config.backgroundImage ? `
                      <button type="button" id="btn-remove-bg-image" class="text-[11px] text-destructive hover:underline font-khmer block cursor-pointer pt-0.5">
                        ${isKm ? 'លុបរូបផ្ទៃខាងក្រោយ' : 'Remove Background'}
                      </button>
                    ` : ''}
                  </div>
                  <input type="file" id="input-file-bg-image" accept="image/*" class="hidden" />
                </div>
                
                ${this.config.backgroundImage ? `
                  <div class="space-y-1 pt-2 border-t border-border/50">
                    <div class="flex justify-between items-center text-[11px]">
                      <span class="text-muted-foreground font-khmer">${isKm ? 'ភាពច្បាស់ (Opacity)' : 'Opacity'}</span>
                      <span id="label-bg-opacity" class="font-mono font-bold">${this.config.backgroundOpacity !== undefined ? this.config.backgroundOpacity : 100}%</span>
                    </div>
                    <input type="range" id="input-bg-opacity" min="10" max="100" step="5" value="${this.config.backgroundOpacity !== undefined ? this.config.backgroundOpacity : 100}" class="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary" />
                  </div>
                ` : ''}
              </div>

              <!-- Accent Color Palette -->
              <div class="space-y-2">
                <label class="block font-semibold font-khmer text-xs">${isKm ? 'ពណ៌ស្បែកកាត (Theme Accent Color)' : 'Theme Accent Color'}</label>
                <div class="grid grid-cols-3 gap-1.5">
                  ${THEME_COLOR_PRESETS.map(c => `
                    <button type="button" data-color="${c.hex}" class="btn-theme-color flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${this.config.accentColor.toLowerCase() === c.hex.toLowerCase() ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border hover:bg-muted'}">
                      <span class="w-4 h-4 rounded-full shrink-0 shadow-2xs" style="background: ${c.hex};"></span>
                      <span class="text-[10px] truncate font-medium">${c.name.split(' ')[0]}</span>
                    </button>
                  `).join('')}
                </div>
                <div class="flex items-center gap-2 pt-1">
                  <input type="color" id="input-accent-color-picker" value="${this.config.accentColor}" class="w-8 h-8 rounded-lg cursor-pointer border border-border p-0.5 bg-background shrink-0" />
                  <input type="text" id="input-accent-color-hex" value="${this.config.accentColor}" class="w-full h-8 px-2.5 rounded-lg border border-input bg-background font-mono text-xs uppercase" />
                </div>
              </div>

              <!-- Student Photo Zoom & Position Widget -->
              <div class="pt-2 border-t border-border">
                ${this.renderTransformWidget({
                  targetKey: 'photo',
                  titleKh: 'ទំហំ & ទីតាំងរូបថតសិស្ស (Frame)',
                  titleEn: 'Photo Frame Zoom & Position',
                  isKm,
                  scale: this.config.photoScale || 100,
                  offsetX: this.config.photoOffsetX || 0,
                  offsetY: this.config.photoOffsetY || 0,
                  minScale: 20,
                  maxScale: 600,
                  minOffset: -600,
                  maxOffset: 600
                })}
              </div>
            </div>

            <!-- Tab 3: School Branding Controls -->
            <div id="tab-panel-branding" class="tab-panel ${this.activeTab === 'branding' ? '' : 'hidden'} space-y-4">
              <!-- School Names & Typography -->
              <div class="space-y-3">
                <!-- Khmer School Name -->
                <div class="p-2.5 rounded-xl bg-muted/20 border border-border space-y-2">
                  <div>
                    <label class="block font-semibold font-khmer text-xs mb-1">${isKm ? 'ឈ្មោះសាលារៀន (ភាសាខ្មែរ)' : 'School Name (Khmer)'}</label>
                    <input type="text" id="input-school-name-kh" value="${this.config.schoolNameKh || ''}" placeholder="សាលារៀន..." class="w-full h-8 px-2.5 rounded-lg border border-input bg-background text-foreground font-khmer text-xs" />
                  </div>
                  <!-- Font, Size, Color, Bold Controls -->
                  <div class="grid grid-cols-12 gap-1.5 pt-1 border-t border-border/50 items-center">
                    <div class="col-span-5">
                      <select id="select-school-kh-font" class="w-full h-7 px-1.5 rounded-md border border-input bg-background text-[10px] font-medium text-foreground cursor-pointer shadow-2xs">
                        <option value="Kantumruy Pro" ${(this.config.schoolNameKhFont || 'Kantumruy Pro') === 'Kantumruy Pro' ? 'selected' : ''}>Kantumruy</option>
                        <option value="Siemreap" ${this.config.schoolNameKhFont === 'Siemreap' ? 'selected' : ''}>Siemreap</option>
                        <option value="Moul" ${this.config.schoolNameKhFont === 'Moul' ? 'selected' : ''}>Moul (មូល)</option>
                        <option value="Inter" ${this.config.schoolNameKhFont === 'Inter' ? 'selected' : ''}>Inter</option>
                        <option value="Roboto" ${this.config.schoolNameKhFont === 'Roboto' ? 'selected' : ''}>Roboto</option>
                        <option value="Plus Jakarta Sans" ${this.config.schoolNameKhFont === 'Plus Jakarta Sans' ? 'selected' : ''}>Jakarta</option>
                        <option value="monospace" ${this.config.schoolNameKhFont === 'monospace' ? 'selected' : ''}>Monospace</option>
                      </select>
                    </div>
                    <div class="col-span-3">
                      <input type="number" min="4" max="28" step="0.5" id="input-school-kh-size" value="${this.config.schoolNameKhSize !== undefined ? this.config.schoolNameKhSize : 8}" title="${isKm ? 'ទំហំអក្សរ (px)' : 'Font Size (px)'}" class="w-full h-7 px-1.5 rounded-md border border-input bg-background font-mono text-[11px] text-center shadow-2xs" />
                    </div>
                    <div class="col-span-2 flex items-center justify-center">
                      <input type="color" id="input-school-kh-color" value="${this.config.schoolNameKhColor || '#0f172a'}" title="${isKm ? 'ពណ៌អក្សរ' : 'Text Color'}" class="w-7 h-7 rounded-md cursor-pointer border border-input p-0.5 bg-background shrink-0 shadow-2xs" />
                    </div>
                    <div class="col-span-2 flex items-center justify-center">
                      <button type="button" id="btn-school-kh-bold" class="w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs ${this.config.schoolNameKhBold !== false ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-foreground border-input'}" title="Bold">
                        B
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Latin School Name -->
                <div class="p-2.5 rounded-xl bg-muted/20 border border-border space-y-2">
                  <div>
                    <label class="block font-semibold text-xs mb-1">${isKm ? 'ឈ្មោះសាលារៀន (ឡាតាំង)' : 'School Name (Latin)'}</label>
                    <input type="text" id="input-school-name-en" value="${this.config.schoolNameEn || ''}" placeholder="SMART SCHOOL..." class="w-full h-8 px-2.5 rounded-lg border border-input bg-background text-foreground uppercase font-medium text-xs" />
                  </div>
                  <!-- Font, Size, Color, Bold Controls -->
                  <div class="grid grid-cols-12 gap-1.5 pt-1 border-t border-border/50 items-center">
                    <div class="col-span-5">
                      <select id="select-school-en-font" class="w-full h-7 px-1.5 rounded-md border border-input bg-background text-[10px] font-medium text-foreground cursor-pointer shadow-2xs">
                        <option value="Inter" ${(this.config.schoolNameEnFont || 'Inter') === 'Inter' ? 'selected' : ''}>Inter</option>
                        <option value="Roboto" ${this.config.schoolNameEnFont === 'Roboto' ? 'selected' : ''}>Roboto</option>
                        <option value="Plus Jakarta Sans" ${this.config.schoolNameEnFont === 'Plus Jakarta Sans' ? 'selected' : ''}>Jakarta</option>
                        <option value="Kantumruy Pro" ${this.config.schoolNameEnFont === 'Kantumruy Pro' ? 'selected' : ''}>Kantumruy</option>
                        <option value="Siemreap" ${this.config.schoolNameEnFont === 'Siemreap' ? 'selected' : ''}>Siemreap</option>
                        <option value="Moul" ${this.config.schoolNameEnFont === 'Moul' ? 'selected' : ''}>Moul (មូល)</option>
                        <option value="monospace" ${this.config.schoolNameEnFont === 'monospace' ? 'selected' : ''}>Monospace</option>
                      </select>
                    </div>
                    <div class="col-span-3">
                      <input type="number" min="4" max="28" step="0.5" id="input-school-en-size" value="${this.config.schoolNameEnSize !== undefined ? this.config.schoolNameEnSize : 6.5}" title="${isKm ? 'ទំហំអក្សរ (px)' : 'Font Size (px)'}" class="w-full h-7 px-1.5 rounded-md border border-input bg-background font-mono text-[11px] text-center shadow-2xs" />
                    </div>
                    <div class="col-span-2 flex items-center justify-center">
                      <input type="color" id="input-school-en-color" value="${this.config.schoolNameEnColor || '#64748b'}" title="${isKm ? 'ពណ៌អក្សរ' : 'Text Color'}" class="w-7 h-7 rounded-md cursor-pointer border border-input p-0.5 bg-background shrink-0 shadow-2xs" />
                    </div>
                    <div class="col-span-2 flex items-center justify-center">
                      <button type="button" id="btn-school-en-bold" class="w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs ${this.config.schoolNameEnBold !== false ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-foreground border-input'}" title="Bold">
                        B
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Header Transform Widget (Move & Zoom School Title) -->
              <div class="pt-2 border-t border-border">
                ${this.renderTransformWidget({
                  targetKey: 'header',
                  titleKh: 'ទំហំ & ទីតាំងចំណងជើងសាលា (Header)',
                  titleEn: 'School Header Zoom & Position',
                  isKm,
                  scale: this.config.headerScale || 100,
                  offsetX: this.config.headerOffsetX || 0,
                  offsetY: this.config.headerOffsetY || 0,
                  minScale: 20,
                  maxScale: 600,
                  minOffset: -600,
                  maxOffset: 600
                })}
              </div>

              <!-- Logo Upload Box -->
              <div class="space-y-1.5 pt-2 border-t border-border">
                <label class="block font-semibold font-khmer text-xs">${isKm ? 'រូបសញ្ញាសាលារៀន (Logo)' : 'School Logo'}</label>
                <div class="flex items-center gap-3">
                  <div class="w-14 h-14 rounded-xl border border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0" id="logo-preview-box">
                    ${this.config.schoolLogo ? `
                      <img src="${this.config.schoolLogo}" class="w-full h-full object-contain" />
                    ` : `
                      <span class="text-muted-foreground text-[10px] font-khmer">${isKm ? 'គ្មាន' : 'No Logo'}</span>
                    `}
                  </div>
                  <div class="space-y-1 flex-1 min-w-0">
                    <button type="button" id="btn-upload-logo" class="px-3 py-1.5 rounded-lg border border-input bg-background hover:bg-muted text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer font-khmer">
                      ${getIcon('upload', 'w-3.5 h-3.5')}
                      <span>${isKm ? 'ផ្ទុកឡូហ្គោ' : 'Upload Logo'}</span>
                    </button>
                    ${this.config.schoolLogo ? `
                      <button type="button" id="btn-remove-logo" class="text-[11px] text-destructive hover:underline font-khmer block cursor-pointer pt-0.5">
                        ${isKm ? 'លុបឡូហ្គោចេញ' : 'Remove Logo'}
                      </button>
                    ` : ''}
                  </div>
                  <input type="file" id="input-file-logo" accept="image/*" class="hidden" />
                </div>
              </div>

              <!-- Logo Transform Widget -->
              <div class="pt-2 border-t border-border">
                ${this.renderTransformWidget({
                  targetKey: 'logo',
                  titleKh: 'ទំហំ & ទីតាំងឡូហ្គោ',
                  titleEn: 'Logo Zoom & Position',
                  isKm,
                  scale: this.config.logoScale || 100,
                  offsetX: this.config.logoOffsetX || 0,
                  offsetY: this.config.logoOffsetY || 0,
                  minScale: 20,
                  maxScale: 600,
                  minOffset: -600,
                  maxOffset: 600
                })}
              </div>
            </div>

            <!-- Tab 4: Signatures & Seal Controls -->
            <div id="tab-panel-signature" class="tab-panel ${this.activeTab === 'signature' ? '' : 'hidden'} space-y-4">
              <!-- 1. Signatory Title / Custom Name Text & Transform -->
              <div class="space-y-2 p-3 rounded-xl border border-border bg-muted/20">
                <div class="flex items-center justify-between">
                  <label class="font-semibold font-khmer text-xs">${isKm ? 'ឈ្មោះ / តួនាទីអ្នកចុះហត្ថលេខា' : 'Signatory Title / Name'}</label>
                  <input type="checkbox" id="toggle-director-title" class="h-4 w-4 rounded border-input text-primary cursor-pointer" ${this.config.showDirectorTitle !== false ? 'checked' : ''} />
                </div>
                <div>
                  <input type="text" id="input-director-title" value="${this.config.directorTitle !== undefined ? this.config.directorTitle : 'នាយកសាលា'}" placeholder="${isKm ? 'ឈ្មោះ / តួនាទី...' : 'Signatory Title / Name...'}" class="w-full h-8 px-2.5 rounded-lg border border-input bg-background text-foreground font-khmer text-xs" />
                </div>
                <!-- Font, Size, Color, Bold Controls -->
                <div class="grid grid-cols-12 gap-1.5 pt-1 border-t border-border/50 items-center">
                  <div class="col-span-5">
                    <select id="select-director-title-font" class="w-full h-7 px-1.5 rounded-md border border-input bg-background text-[10px] font-medium text-foreground cursor-pointer shadow-2xs">
                      <option value="Kantumruy Pro" ${(this.config.directorTitleFont || 'Kantumruy Pro') === 'Kantumruy Pro' ? 'selected' : ''}>Kantumruy</option>
                      <option value="Siemreap" ${this.config.directorTitleFont === 'Siemreap' ? 'selected' : ''}>Siemreap</option>
                      <option value="Moul" ${this.config.directorTitleFont === 'Moul' ? 'selected' : ''}>Moul (មូល)</option>
                      <option value="Inter" ${this.config.directorTitleFont === 'Inter' ? 'selected' : ''}>Inter</option>
                      <option value="Roboto" ${this.config.directorTitleFont === 'Roboto' ? 'selected' : ''}>Roboto</option>
                      <option value="Plus Jakarta Sans" ${this.config.directorTitleFont === 'Plus Jakarta Sans' ? 'selected' : ''}>Jakarta</option>
                      <option value="monospace" ${this.config.directorTitleFont === 'monospace' ? 'selected' : ''}>Monospace</option>
                    </select>
                  </div>
                  <div class="col-span-3">
                    <input type="number" min="3" max="24" step="0.5" id="input-director-title-size" value="${this.config.directorTitleSize !== undefined ? this.config.directorTitleSize : 6}" title="${isKm ? 'ទំហំអក្សរ (px)' : 'Font Size (px)'}" class="w-full h-7 px-1.5 rounded-md border border-input bg-background font-mono text-[11px] text-center shadow-2xs" />
                  </div>
                  <div class="col-span-2 flex items-center justify-center">
                    <input type="color" id="input-director-title-color" value="${this.config.directorTitleColor || '#475569'}" title="${isKm ? 'ពណ៌អក្សរ' : 'Text Color'}" class="w-7 h-7 rounded-md cursor-pointer border border-input p-0.5 bg-background shrink-0 shadow-2xs" />
                  </div>
                  <div class="col-span-2 flex items-center justify-center">
                    <button type="button" id="btn-director-title-bold" class="w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs ${this.config.directorTitleBold !== false ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-foreground border-input'}" title="Bold">
                      B
                    </button>
                  </div>
                </div>

                <!-- Title Transform Widget -->
                ${this.renderTransformWidget({
                  targetKey: 'title',
                  titleKh: 'ទំហំ & ទីតាំងតួនាទី / ឈ្មោះ (Title)',
                  titleEn: 'Title / Name Zoom & Position',
                  isKm,
                  scale: this.config.titleScale || 100,
                  offsetX: this.config.titleOffsetX || 0,
                  offsetY: this.config.titleOffsetY || 0,
                  minScale: 20,
                  maxScale: 600,
                  minOffset: -600,
                  maxOffset: 600
                })}
              </div>

              <!-- 2. Signature Upload & Transform Widget -->
              <div class="space-y-2 p-3 rounded-xl border border-border bg-muted/20">
                <div class="flex items-center justify-between">
                  <label class="font-semibold font-khmer text-xs">${isKm ? 'បង្ហាញហត្ថលេខា' : 'Show Signature'}</label>
                  <input type="checkbox" id="toggle-signature" class="h-4 w-4 rounded border-input text-primary cursor-pointer" ${this.config.showSignature ? 'checked' : ''} />
                </div>
                <div class="flex items-center gap-2.5">
                  <div class="w-16 h-8 rounded-lg border border-dashed border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                    ${this.config.signatureImage ? `<img src="${this.config.signatureImage}" class="w-full h-full object-contain" />` : `<span class="text-[10px] text-muted-foreground">${isKm ? 'ហត្ថលេខា' : 'Sig'}</span>`}
                  </div>
                  <button type="button" id="btn-upload-signature" class="px-2.5 py-1 rounded-lg border border-input bg-background hover:bg-muted text-xs font-medium flex items-center gap-1.5 cursor-pointer font-khmer shadow-2xs">
                    ${getIcon('upload', 'w-3 h-3')}
                    <span>${isKm ? 'ផ្ទុកហត្ថលេខា' : 'Upload PNG'}</span>
                  </button>
                  ${this.config.signatureImage ? `<button type="button" id="btn-remove-signature" class="text-[11px] text-destructive hover:underline font-khmer cursor-pointer">${isKm ? 'លុប' : 'Remove'}</button>` : ''}
                  <input type="file" id="input-file-signature" accept="image/*" class="hidden" />
                </div>
                
                ${this.renderTransformWidget({
                  targetKey: 'signature',
                  titleKh: 'ទំហំ & ទីតាំងហត្ថលេខា',
                  titleEn: 'Signature Zoom & Position',
                  isKm,
                  scale: this.config.signatureScale || 100,
                  offsetX: this.config.signatureOffsetX || 0,
                  offsetY: this.config.signatureOffsetY || 0,
                  minScale: 20,
                  maxScale: 600,
                  minOffset: -600,
                  maxOffset: 600
                })}
              </div>

              <!-- Stamp Upload & Transform Widget -->
              <div class="space-y-2 p-3 rounded-xl border border-border bg-muted/20">
                <div class="flex items-center justify-between">
                  <label class="font-semibold font-khmer text-xs">${isKm ? 'បង្ហាញត្រាសាលារៀន' : 'Show Stamp'}</label>
                  <input type="checkbox" id="toggle-stamp" class="h-4 w-4 rounded border-input text-primary cursor-pointer" ${this.config.showStamp ? 'checked' : ''} />
                </div>
                <div class="flex items-center gap-2.5">
                  <div class="w-10 h-10 rounded-full border border-dashed border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                    ${this.config.stampImage ? `<img src="${this.config.stampImage}" class="w-full h-full object-contain" />` : `<span class="text-[10px] text-muted-foreground">${isKm ? 'ត្រា' : 'Stamp'}</span>`}
                  </div>
                  <button type="button" id="btn-upload-stamp" class="px-2.5 py-1 rounded-lg border border-input bg-background hover:bg-muted text-xs font-medium flex items-center gap-1.5 cursor-pointer font-khmer shadow-2xs">
                    ${getIcon('upload', 'w-3 h-3')}
                    <span>${isKm ? 'ផ្ទុកត្រា' : 'Upload PNG'}</span>
                  </button>
                  ${this.config.stampImage ? `<button type="button" id="btn-remove-stamp" class="text-[11px] text-destructive hover:underline font-khmer cursor-pointer">${isKm ? 'លុប' : 'Remove'}</button>` : ''}
                  <input type="file" id="input-file-stamp" accept="image/*" class="hidden" />
                </div>
                
                ${this.renderTransformWidget({
                  targetKey: 'stamp',
                  titleKh: 'ទំហំ & ទីតាំងត្រា',
                  titleEn: 'Stamp Zoom & Position',
                  isKm,
                  scale: this.config.stampScale || 100,
                  offsetX: this.config.stampOffsetX || 0,
                  offsetY: this.config.stampOffsetY || 0,
                  minScale: 20,
                  maxScale: 600,
                  minOffset: -600,
                  maxOffset: 600
                })}
              </div>

              <!-- 3. Khmer Lunar & Solar Date Settings Widget -->
              <div class="space-y-2.5 p-3 rounded-xl border border-border bg-muted/20">
                <div class="flex items-center justify-between">
                  <label class="font-semibold font-khmer text-xs flex items-center gap-1.5 cursor-pointer" for="toggle-card-date">
                    <span>${getIcon('calendar', 'w-3.5 h-3.5 text-primary')}</span>
                    <span>${isKm ? 'កាលបរិច្ឆេទលើកាត (ចន្ទគតិ & សុរិយគតិ)' : 'Card Date (Khmer Lunar & Solar)'}</span>
                  </label>
                  <input type="checkbox" id="toggle-card-date" class="h-4 w-4 rounded border-input text-primary cursor-pointer" ${this.config.showCardDate ? 'checked' : ''} />
                </div>

                <div id="card-date-settings-panel" class="${this.config.showCardDate ? 'space-y-2.5' : 'hidden'} pt-1 border-t border-border/50">
                  <!-- Date Picker & Format Type -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label class="block text-[11px] text-muted-foreground font-khmer mb-1">${isKm ? 'ជ្រើសរើសថ្ងៃខែឆ្នាំ' : 'Pick Date'}</label>
                      <input type="date" id="input-card-date-picker" value="${cardDateIso}" class="w-full h-8 px-2 rounded-lg border border-input bg-background text-foreground text-xs cursor-pointer shadow-2xs" />
                    </div>
                    <div>
                      <label class="block text-[11px] text-muted-foreground font-khmer mb-1">${isKm ? 'ទម្រង់កាលបរិច្ឆេទ' : 'Display Format'}</label>
                      <select id="select-card-date-type" class="w-full h-8 px-2 rounded-lg border border-input bg-background text-foreground text-xs cursor-pointer shadow-2xs">
                        <option value="lunar_solar" ${this.config.cardDateType === 'lunar_solar' ? 'selected' : ''}>${isKm ? 'ចន្ទគតិ & សុរិយគតិ (២ បន្ទាត់)' : 'Lunar & Solar (2 lines)'}</option>
                        <option value="lunar" ${this.config.cardDateType === 'lunar' ? 'selected' : ''}>${isKm ? 'តែចន្ទគតិប៉ុណ្ណោះ' : 'Lunar Only'}</option>
                        <option value="solar" ${this.config.cardDateType === 'solar' ? 'selected' : ''}>${isKm ? 'តែសុរិយគតិប៉ុណ្ណោះ' : 'Solar Only'}</option>
                        <option value="custom" ${this.config.cardDateType === 'custom' ? 'selected' : ''}>${isKm ? 'កែសម្រួលដោយដៃ' : 'Custom Text'}</option>
                      </select>
                    </div>
                  </div>

                  <!-- Location Prefix for Solar Date -->
                  <div>
                    <label class="block text-[11px] text-muted-foreground font-khmer mb-1">${isKm ? 'ទីតាំង / ឈ្មោះសាលារៀន (សម្រាប់សុរិយគតិ)' : 'Location / School Name (for Solar Date)'}</label>
                    <input type="text" id="input-card-date-location" value="${this.config.cardDateLocation || ''}" placeholder="${isKm ? 'ឧទាហរណ៍៖ អនុវិទ្យាល័យព្រៃតូច' : 'e.g. Prey Touch Secondary School'}" class="w-full h-8 px-2.5 rounded-lg border border-input bg-background text-foreground font-khmer text-xs shadow-2xs" />
                  </div>

                  <!-- Live Preview & Editable Lines -->
                  <div class="space-y-2 bg-background/80 p-2.5 rounded-lg border border-border text-[11px]">
                    <div class="space-y-1">
                      <div class="flex items-center justify-between text-muted-foreground font-khmer text-[10px]">
                        <span class="font-medium text-foreground">${isKm ? 'បន្ទាត់ទី១ (ចន្ទគតិ) ៖' : 'Line 1 (Lunar):'}</span>
                        <button type="button" id="btn-refresh-card-date-lunar" class="text-primary hover:underline cursor-pointer flex items-center gap-0.5" title="${isKm ? 'គណនាឡើងវិញដោយស្វ័យប្រវត្តិ' : 'Auto-calculate'}">
                          ${getIcon('rotateCcw', 'w-2.5 h-2.5')} <span>${isKm ? 'ស្វ័យប្រវត្តិ' : 'Auto'}</span>
                        </button>
                      </div>
                      <input type="text" id="input-card-date-line1" value="${dateLine1}" class="w-full h-7 px-2 rounded border border-input bg-card text-foreground font-khmer text-[11px] shadow-2xs" placeholder="${isKm ? 'ថ្ងៃព្រហស្បតិ៍ ៦កើត ខែភទ្របទ...' : 'Khmer lunar date...'}" />
                    </div>

                        <div class="col-span-2 flex items-center justify-center">
                      <button type="button" id="btn-card-date-bold" class="w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs ${this.config.cardDateBold ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-foreground border-input'}" title="Bold">
                        B
                      </button>
                    </div>
                  </div>

                  <!-- Transform Widget -->
                  <div class="pt-1 border-t border-border/50">
                    ${this.renderTransformWidget({
                      targetKey: 'cardDate',
                      titleKh: 'ទំហំ & ទីតាំងកាលបរិច្ឆេទ (Date)',
                      titleEn: 'Date Zoom & Position',
                      isKm,
                      scale: this.config.cardDateScale || 100,
                      offsetX: this.config.cardDateOffsetX || 0,
                      offsetY: this.config.cardDateOffsetY || 0,
                      minScale: 20,
                      maxScale: 600,
                      minOffset: -600,
                      maxOffset: 600
                    })}
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab 5: Card Fields Visibility & Styling -->
            <div id="tab-panel-fields" class="tab-panel ${this.activeTab === 'fields' ? '' : 'hidden'} space-y-3">
              <!-- Fields Group Move & Zoom Transform Widget -->
              ${this.renderTransformWidget({
                targetKey: 'fields',
                titleKh: 'ទំហំ & ទីតាំងប្លុកទិន្នន័យ (Fields Group)',
                titleEn: 'Fields Group Zoom & Position',
                isKm,
                scale: this.config.fieldsScale || 100,
                offsetX: this.config.fieldsOffsetX || 0,
                offsetY: this.config.fieldsOffsetY || 0,
                minScale: 20,
                maxScale: 600,
                minOffset: -600,
                maxOffset: 600
              })}

              <div class="pt-2 border-t border-border space-y-2.5">
                <p class="text-[11px] text-muted-foreground font-khmer">${isKm ? 'កំណត់ពុម្ពអក្សរ ទំហំ ពណ៌ និងការបង្ហាញទិន្នន័យនីមួយៗ៖' : 'Customize Font, Size, Color & Visibility for each field:'}</p>
              ${[
                { key: 'nameKh', labelKh: 'ឈ្មោះភាសាខ្មែរ', labelEn: 'Khmer Name', fixed: true },
                { key: 'nameLatin', labelKh: 'ឈ្មោះឡាតាំង', labelEn: 'Latin Name' },
                { key: 'className', labelKh: 'ថ្នាក់រៀន', labelEn: 'Class Name' },
                { key: 'studentId', labelKh: 'អត្តលេខសិស្ស', labelEn: 'Student ID' },
                { key: 'academicYear', labelKh: 'ឆ្នាំសិក្សា', labelEn: 'Academic Year' },
                { key: 'dob', labelKh: 'ថ្ងៃខែឆ្នាំកំណើត', labelEn: 'Date of Birth' },
                { key: 'gender', labelKh: 'ភេទ', labelEn: 'Gender' },
                { key: 'fatherName', labelKh: 'ឈ្មោះឪពុក', labelEn: 'Father Name' },
                { key: 'motherName', labelKh: 'ឈ្មោះម្តាយ', labelEn: 'Mother Name' },
                { key: 'phone', labelKh: 'លេខទូរសព្ទ', labelEn: 'Phone Number' }
              ].map(f => {
                const fs = (this.config.fieldStyles && this.config.fieldStyles[f.key]) || (DEFAULT_FIELD_STYLES[f.key] || { font: 'Kantumruy Pro', size: 7.5, color: '#0f172a', bold: false });
                const isChecked = this.config.fields[f.key] !== false;
                return `
                  <div class="p-2.5 rounded-xl bg-muted/20 border border-border space-y-2">
                    <!-- Top row: Checkbox & Name -->
                    <div class="flex items-center justify-between">
                      <label class="flex items-center gap-2 cursor-pointer font-khmer text-xs select-none">
                        <input type="checkbox" data-field="${f.key}" class="field-toggle-checkbox h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer" ${isChecked ? 'checked' : ''} ${f.fixed ? 'disabled' : ''} />
                        <span class="font-semibold ${f.fixed ? 'text-primary font-bold' : 'text-foreground'}">
                          ${isKm ? f.labelKh : f.labelEn} ${f.fixed ? (isKm ? '*(ជាប់)' : '*(Req)') : ''}
                        </span>
                      </label>
                      <span class="text-[10px] text-muted-foreground font-mono font-medium">
                        ${fs.size}px
                      </span>
                    </div>

                    <!-- Bottom row: Font dropdown, Size input, Color picker, Bold toggle -->
                    <div class="grid grid-cols-12 gap-1.5 pt-1 border-t border-border/50 items-center">
                      <!-- Font selector -->
                      <div class="col-span-5">
                        <select data-style-field="${f.key}" data-style-prop="font" class="input-field-style-font w-full h-7 px-1.5 rounded-md border border-input bg-background text-[10px] font-medium text-foreground cursor-pointer shadow-2xs">
                          <option value="Kantumruy Pro" ${fs.font === 'Kantumruy Pro' ? 'selected' : ''}>Kantumruy</option>
                          <option value="Siemreap" ${fs.font === 'Siemreap' ? 'selected' : ''}>Siemreap</option>
                          <option value="Moul" ${fs.font === 'Moul' ? 'selected' : ''}>Moul (មូល)</option>
                          <option value="Inter" ${fs.font === 'Inter' ? 'selected' : ''}>Inter</option>
                          <option value="Roboto" ${fs.font === 'Roboto' ? 'selected' : ''}>Roboto</option>
                          <option value="Plus Jakarta Sans" ${fs.font === 'Plus Jakarta Sans' ? 'selected' : ''}>Jakarta</option>
                          <option value="monospace" ${fs.font === 'monospace' ? 'selected' : ''}>Monospace</option>
                        </select>
                      </div>

                      <!-- Size selector -->
                      <div class="col-span-3">
                        <input type="number" min="4" max="24" step="0.5" data-style-field="${f.key}" data-style-prop="size" value="${fs.size}" title="${isKm ? 'ទំហំអក្សរ (px)' : 'Font Size (px)'}" class="input-field-style-size w-full h-7 px-1.5 rounded-md border border-input bg-background font-mono text-[11px] text-center shadow-2xs" />
                      </div>

                      <!-- Color picker -->
                      <div class="col-span-2 flex items-center justify-center">
                        <input type="color" data-style-field="${f.key}" data-style-prop="color" value="${fs.color || '#0f172a'}" title="${isKm ? 'ពណ៌អក្សរ' : 'Text Color'}" class="input-field-style-color w-7 h-7 rounded-md cursor-pointer border border-input p-0.5 bg-background shrink-0 shadow-2xs" />
                      </div>

                      <!-- Bold toggle button -->
                      <div class="col-span-2 flex items-center justify-center">
                        <button type="button" data-style-field="${f.key}" data-style-prop="bold" class="btn-field-style-bold w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs ${fs.bold ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-foreground border-input'}" title="Bold">
                          B
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
              </div>
            </div>

            <!-- Tab 6: Student Selection & Printing Manager -->
            <div id="tab-panel-students" class="tab-panel ${this.activeTab === 'students' ? '' : 'hidden'} space-y-3.5">
              <!-- Summary Card -->
              <div class="p-3.5 rounded-2xl bg-gradient-to-br from-card via-card to-muted/40 border border-border/80 shadow-xs space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                      ${getIcon('users', 'w-4 h-4')}
                    </div>
                    <div>
                      <span class="font-bold text-xs font-khmer text-foreground block">${isKm ? 'ការជ្រើសរើសសិស្ស' : 'Student Selection'}</span>
                      <span class="text-[10px] text-muted-foreground font-khmer block">${isKm ? 'ជ្រើសរើសសិស្សដែលត្រូវបោះពុម្ព' : 'Choose students to generate cards'}</span>
                    </div>
                  </div>
                  <span id="label-student-selected-summary" class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary text-primary-foreground font-mono shadow-xs">
                    ${selectedCount} / ${totalStudents}
                  </span>
                </div>
                
                <!-- Quick Selection Actions -->
                <div class="grid grid-cols-3 gap-1.5 pt-0.5">
                  <button type="button" id="btn-select-all-students" class="py-1.5 px-2 rounded-xl border border-input bg-card hover:bg-primary/10 hover:border-primary/40 hover:text-primary text-[11px] font-khmer font-semibold transition-all shadow-2xs text-center cursor-pointer flex items-center justify-center gap-1">
                    ${getIcon('check', 'w-3.5 h-3.5 text-primary')}
                    <span>${isKm ? 'ជ្រើសទាំងអស់' : 'Select All'}</span>
                  </button>
                  <button type="button" id="btn-deselect-all-students" class="py-1.5 px-2 rounded-xl border border-input bg-card hover:bg-muted text-[11px] font-khmer font-medium transition-all shadow-2xs text-center cursor-pointer text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
                    ${getIcon('x', 'w-3.5 h-3.5')}
                    <span>${isKm ? 'ដោះការជ្រើស' : 'Clear'}</span>
                  </button>
                  <button type="button" id="btn-select-photo-only-students" class="py-1.5 px-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/15 text-[11px] font-khmer font-semibold transition-all shadow-2xs text-center cursor-pointer text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                    ${getIcon('image', 'w-3.5 h-3.5')}
                    <span>${isKm ? 'មានរូបថត' : 'With Photo'}</span>
                  </button>
                </div>
              </div>

              <!-- Search and Class Filter -->
              <div class="space-y-2">
                <div class="relative">
                  <input type="text" id="input-student-search" placeholder="${isKm ? 'ស្វែងរកឈ្មោះ ឬអត្តលេខសិស្ស...' : 'Search student name or ID...'}" value="${this.studentSearchQuery || ''}" class="w-full h-9 pl-9 pr-8 rounded-xl border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground shadow-2xs font-khmer transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                  <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    ${getIcon('search', 'w-3.5 h-3.5')}
                  </div>
                  ${this.studentSearchQuery ? `
                    <button type="button" id="btn-clear-student-search" class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted cursor-pointer transition-colors">
                      ${getIcon('x', 'w-3.5 h-3.5')}
                    </button>
                  ` : ''}
                </div>

                <!-- Class Filter -->
                <div class="relative">
                  <select id="select-student-class-filter" class="w-full h-9 px-3 pr-8 rounded-xl border border-input bg-card text-foreground text-xs font-khmer shadow-2xs cursor-pointer appearance-none transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                    <option value="all">${isKm ? 'ថ្នាក់រៀនទាំងអស់ (All Classes)' : 'All Classes'}</option>
                    ${Array.from(this.classMap.entries()).map(([cid, cname]) => `
                      <option value="${cid}" ${this.studentClassFilter === cid ? 'selected' : ''}>${cname}</option>
                    `).join('')}
                  </select>
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    ${getIcon('chevronDown', 'w-3.5 h-3.5')}
                  </div>
                </div>
              </div>

              <!-- Sheet View Filter Toggle -->
              <div>
                <label class="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card hover:bg-muted/40 cursor-pointer transition-all shadow-2xs group">
                  <div class="flex items-center gap-2.5 min-w-0 pr-2">
                    <div class="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      ${getIcon('printer', 'w-3.5 h-3.5')}
                    </div>
                    <div class="min-w-0">
                      <span class="text-xs font-semibold font-khmer text-foreground block truncate">${isKm ? 'បោះពុម្ពតែសិស្សដែលបានជ្រើស' : 'Print Only Selected'}</span>
                      <span class="text-[10px] text-muted-foreground font-khmer block truncate">${isKm ? 'បង្ហាញលើសន្លឹក A4 តែសិស្សដែលបានគូស' : 'A4 layout shows only checked students'}</span>
                    </div>
                  </div>
                  <input type="checkbox" id="toggle-sheet-show-selected" class="h-4 w-4 rounded-md border-input text-primary focus:ring-primary cursor-pointer shrink-0 accent-primary" ${this.onlyShowSelectedInSheet ? 'checked' : ''} />
                </label>
              </div>

              <!-- Student Item Checklist -->
              <div class="space-y-1.5 max-h-[calc(100vh-390px)] overflow-y-auto pr-1" id="students-checklist-container">
                ${this.renderStudentsChecklistHtml()}
              </div>
            </div>

          </div>
        </aside>
      </div>
    `;

    document.body.appendChild(overlay);
    this.activeOverlay = overlay;

    this.bindEvents();
    this.updatePreview();
  },

  /**
   * Update the live preview canvas based on current viewMode (Single Card Design or Full A4 Sheet)
   */
  updatePreview() {
    const sheetContainer = this.activeOverlay?.querySelector('#a4-sheet-container');
    if (!sheetContainer) return;

    const isKm = i18n.getLocale() === 'km';
    const isCardLandscape = this.config.cardOrientation === 'landscape';
    const totalStudents = this.students.length || 1;
    const selectedStudents = this.getSelectedStudents();
    const selectedCount = selectedStudents.length;

    // Update Header Badges and Print button label
    const headerCountBadge = this.activeOverlay?.querySelector('#header-selected-count-badge');
    if (headerCountBadge) {
      headerCountBadge.textContent = isKm ? `បានជ្រើស ${selectedCount}/${totalStudents} សិស្ស` : `Selected ${selectedCount}/${totalStudents}`;
    }

    const printLabel = this.activeOverlay?.querySelector('#btn-studio-print-label');
    if (printLabel) {
      printLabel.textContent = isKm ? `បោះពុម្ព (${selectedCount})` : `Print (${selectedCount})`;
    }

    const studentTabBadge = this.activeOverlay?.querySelector('.studio-tab-btn[data-tab="students"] span.font-mono');
    if (studentTabBadge) {
      studentTabBadge.textContent = `${selectedCount}`;
    }

    const summaryCount = this.activeOverlay?.querySelector('#label-student-selected-summary');
    if (summaryCount) {
      summaryCount.textContent = `${selectedCount} / ${totalStudents}`;
    }

    if (this.viewMode === 'card') {
      // SINGLE CARD DESIGN FOCUS VIEW
      if (this.previewStudentIndex >= totalStudents) {
        this.previewStudentIndex = 0;
      }
      const currentStudent = this.students[this.previewStudentIndex] || {
        studentId: 'STU-001',
        lastNameKh: 'សុក',
        firstNameKh: 'សុខា',
        lastNameLatin: 'SOK',
        firstNameLatin: 'SOKHA',
        className: 'ថ្នាក់ទី 7A',
        academicYear: '2024-2025',
        dateOfBirth: '15/05/2012',
        gender: 'Female'
      };

      const currentStudentKey = this.getStudentKey(currentStudent);
      const isCurrentSelected = this.selectedStudentIds.has(currentStudentKey);

      // Update Sub-toolbar Checkbox
      const chkCurrent = this.activeOverlay?.querySelector('#chk-current-student-selected');
      if (chkCurrent) {
        chkCurrent.checked = isCurrentSelected;
      }

      const lastNameKh = currentStudent.lastNameKh || '';
      const firstNameKh = currentStudent.firstNameKh || '';
      const studentName = `${lastNameKh} ${firstNameKh}`.trim() || currentStudent.khmerName || currentStudent.englishName || 'Student';

      // Update Sub-toolbar for Single Card Focus
      const pagerLabel = this.activeOverlay?.querySelector('#sheet-pager-label');
      if (pagerLabel) {
        pagerLabel.textContent = isKm 
          ? `សិស្ស ${this.previewStudentIndex + 1} / ${totalStudents}: ${studentName}`
          : `Student ${this.previewStudentIndex + 1} of ${totalStudents}: ${studentName}`;
      }

      const infoText = this.activeOverlay?.querySelector('#sheet-cards-info-text');
      if (infoText) {
        infoText.innerHTML = `
          <span class="inline-flex items-center gap-1 font-semibold text-primary font-khmer">
            ${isKm ? 'គំរូរចនាគោល (អនុវត្តលើកាតទាំងអស់)' : 'Master Design (Applies to all cards)'}
          </span>
        `;
      }

      // Update Prev / Next buttons state for students
      const btnPrev = this.activeOverlay?.querySelector('#btn-prev-sheet');
      const btnNext = this.activeOverlay?.querySelector('#btn-next-sheet');
      if (btnPrev) btnPrev.disabled = this.previewStudentIndex <= 0;
      if (btnNext) btnNext.disabled = this.previewStudentIndex >= totalStudents - 1;

      // Render Single Card with Master Framing Wrapper
      const cardHtml = renderIDCardHtml(currentStudent, this.config, this.classMap);

      sheetContainer.innerHTML = `
        <div class="single-card-focus-wrapper flex flex-col items-center justify-center p-6">
          <!-- Master Single Card Container -->
          <div class="single-card-viewport shadow-2xl rounded-sm transition-all bg-white relative">
            ${cardHtml}
          </div>
        </div>
      `;

    } else {
      // FULL A4 SHEET MULTI-CARD LAYOUT VIEW
      const targetStudents = this.onlyShowSelectedInSheet && selectedCount > 0 ? selectedStudents : (this.onlyShowSelectedInSheet && selectedCount === 0 ? [] : this.students);

      if (targetStudents.length === 0) {
        sheetContainer.innerHTML = `
          <div class="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-dashed border-border shadow-sm max-w-md mx-auto my-8">
            <div class="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
              ${getIcon('users', 'w-6 h-6')}
            </div>
            <h3 class="font-bold text-sm font-khmer text-foreground mb-1">
              ${isKm ? 'មិនមានសិស្សដែលបានជ្រើសរើសទេ' : 'No Students Selected'}
            </h3>
            <p class="text-xs text-muted-foreground font-khmer mb-4 max-w-xs">
              ${isKm ? 'សូមចូលទៅផ្ទាំង "ជ្រើសរើសសិស្ស" ដើម្បីធីកជ្រើសរើសសិស្សដែលអ្នកចង់បោះពុម្ព ឬចុច "ជ្រើសទាំងអស់"។' : 'Please select students from the "Select Students" tab or click "Select All" to view and print ID cards.'}
            </p>
            <div class="flex items-center gap-2">
              <button type="button" id="btn-empty-select-all" class="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all font-khmer cursor-pointer">
                ${isKm ? 'ជ្រើសទាំងអស់' : 'Select All'}
              </button>
              <button type="button" id="btn-empty-show-all" class="px-3.5 py-1.5 rounded-lg border border-input bg-card hover:bg-muted text-xs font-medium font-khmer cursor-pointer">
                ${isKm ? 'បង្ហាញសិស្សទាំងអស់' : 'Show All Students'}
              </button>
            </div>
          </div>
        `;
        const pagerLabel = this.activeOverlay?.querySelector('#sheet-pager-label');
        if (pagerLabel) pagerLabel.textContent = isKm ? 'ទំព័រ 0 / 0' : 'Page 0 of 0';

        // Bind empty state buttons
        sheetContainer.querySelector('#btn-empty-select-all')?.addEventListener('click', () => {
          this.selectedStudentIds = new Set(this.students.map(s => this.getStudentKey(s)));
          this.refreshStudentsChecklistUI();
          this.updatePreview();
        });
        sheetContainer.querySelector('#btn-empty-show-all')?.addEventListener('click', () => {
          this.onlyShowSelectedInSheet = false;
          this.updatePreview();
        });
        return;
      }

      const pages = chunkStudentsForPages(targetStudents, this.config.cardsPerSheet);
      const totalPages = pages.length;

      if (this.currentPage >= totalPages) {
        this.currentPage = Math.max(0, totalPages - 1);
      }

      const currentSlice = pages[this.currentPage] || [];
      sheetContainer.innerHTML = renderCardSheetHtml(currentSlice, this.config, this.currentPage, totalPages, this.classMap);

      // Update pagination label
      const pagerLabel = this.activeOverlay?.querySelector('#sheet-pager-label');
      if (pagerLabel) {
        pagerLabel.textContent = isKm 
          ? `ទំព័រ ${this.currentPage + 1} / ${totalPages}` 
          : `Page ${this.currentPage + 1} of ${totalPages}`;
      }

      // Update info text
      const infoText = this.activeOverlay?.querySelector('#sheet-cards-info-text');
      if (infoText) {
        infoText.textContent = `${this.config.cardsPerSheet} ${isKm ? 'កាតក្នុងមួយទំព័រ' : 'cards per page'} (${isCardLandscape ? (isKm ? 'បណ្តោយ' : 'Landscape') : (isKm ? 'បញ្ឈរ' : 'Portrait')})`;
      }

      // Update Prev / Next buttons state
      const btnPrev = this.activeOverlay?.querySelector('#btn-prev-sheet');
      const btnNext = this.activeOverlay?.querySelector('#btn-next-sheet');
      if (btnPrev) btnPrev.disabled = this.currentPage <= 0;
      if (btnNext) btnNext.disabled = this.currentPage >= totalPages - 1;
    }

    // Apply Canvas Zoom Scale
    const transformWrapper = this.activeOverlay?.querySelector('#a4-canvas-transform-wrapper');
    if (transformWrapper) {
      transformWrapper.style.transform = `scale(${this.zoomScale})`;
    }

    const zoomLabel = this.activeOverlay?.querySelector('#label-studio-zoom');
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(this.zoomScale * 100)}%`;
    }

    // Attach mouse drag & wheel zoom handlers to cards
    this.bindMouseDraggableAssets();
  },

  /**
   * Bind all interactive events for the studio
   */
  bindEvents() {
    const overlay = this.activeOverlay;
    if (!overlay) return;
    const isKm = i18n.getLocale() === 'km';

    // Close studio
    overlay.querySelector('#btn-studio-close')?.addEventListener('click', () => {
      this.close();
    });

    // Reset Design buttons
    overlay.querySelector('#btn-studio-reset')?.addEventListener('click', () => {
      this.resetToDefault();
    });

    overlay.querySelector('#btn-studio-reset-sidebar')?.addEventListener('click', () => {
      this.resetToDefault();
    });

    // View Mode Toggle (Single Card Design vs A4 Sheet Layout)
    overlay.querySelector('#btn-view-mode-card')?.addEventListener('click', () => {
      if (this.viewMode !== 'card') {
        this.viewMode = 'card';
        this.zoomScale = 1.75;
        this.renderModal();
      }
    });

    overlay.querySelector('#btn-view-mode-sheet')?.addEventListener('click', () => {
      if (this.viewMode !== 'sheet') {
        this.viewMode = 'sheet';
        this.zoomScale = this.config.sheetOrientation === 'landscape' ? 0.55 : 0.65;
        this.renderModal();
      }
    });

    // Zoom buttons
    overlay.querySelector('#btn-studio-zoom-in')?.addEventListener('click', () => {
      const maxLimit = this.viewMode === 'card' ? 3.5 : 1.5;
      this.zoomScale = Math.min(this.zoomScale + 0.15, maxLimit);
      this.updatePreview();
    });

    overlay.querySelector('#btn-studio-zoom-out')?.addEventListener('click', () => {
      const minLimit = this.viewMode === 'card' ? 0.8 : 0.35;
      this.zoomScale = Math.max(this.zoomScale - 0.15, minLimit);
      this.updatePreview();
    });

    overlay.querySelector('#btn-studio-zoom-fit')?.addEventListener('click', () => {
      this.zoomScale = this.viewMode === 'card' ? 1.75 : (this.config.sheetOrientation === 'landscape' ? 0.55 : 0.65);
      this.updatePreview();
    });

    // Pager / Navigation (Student in Card mode or Page in Sheet mode)
    overlay.querySelector('#btn-prev-sheet')?.addEventListener('click', () => {
      if (this.viewMode === 'card') {
        if (this.previewStudentIndex > 0) {
          this.previewStudentIndex--;
          this.updatePreview();
        }
      } else {
        if (this.currentPage > 0) {
          this.currentPage--;
          this.updatePreview();
        }
      }
    });

    overlay.querySelector('#btn-next-sheet')?.addEventListener('click', () => {
      if (this.viewMode === 'card') {
        if (this.previewStudentIndex < this.students.length - 1) {
          this.previewStudentIndex++;
          this.updatePreview();
        }
      } else {
        const targetStudents = this.onlyShowSelectedInSheet && this.getSelectedStudents().length > 0 ? this.getSelectedStudents() : this.students;
        const pages = chunkStudentsForPages(targetStudents, this.config.cardsPerSheet);
        if (this.currentPage < pages.length - 1) {
          this.currentPage++;
          this.updatePreview();
        }
      }
    });

    // Tab switching & sidebar open
    const tabMeta = {
      layout: { titleKm: 'ប្លង់ទំព័រ & ខ្នាត', titleEn: 'Layout & Size' },
      style: { titleKm: 'រចនាប័ទ្ម & រូបថត', titleEn: 'Theme & Photo' },
      branding: { titleKm: 'សាលារៀន & ឡូហ្គោ', titleEn: 'School & Logo' },
      signature: { titleKm: 'ហត្ថលេខា ត្រា & កាលបរិច្ឆេទ', titleEn: 'Signature, Stamp & Date' },
      fields: { titleKm: 'ទិន្នន័យលើកាត', titleEn: 'Card Fields' },
      students: { titleKm: 'ជ្រើសរើសសិស្សបោះពុម្ព', titleEn: 'Select Students' }
    };

    const sidebarPanel = overlay.querySelector('#studio-sidebar-panel');
    const sidebarTitle = overlay.querySelector('#sidebar-tab-title');

    overlay.querySelectorAll('.studio-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabKey = btn.getAttribute('data-tab');
        this.activeTab = tabKey;

        const activeClass = 'studio-tab-btn px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold shadow-xs border border-primary font-khmer transition-all cursor-pointer flex items-center gap-1.5 text-xs whitespace-nowrap';
        const inactiveClass = 'studio-tab-btn px-3.5 py-1.5 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-medium border border-input shadow-2xs font-khmer transition-all cursor-pointer flex items-center gap-1.5 text-xs whitespace-nowrap';

        overlay.querySelectorAll('.studio-tab-btn').forEach(b => {
          b.className = inactiveClass;
        });
        btn.className = activeClass;

        if (sidebarTitle && tabMeta[tabKey]) {
          const meta = tabMeta[tabKey];
          sidebarTitle.textContent = isKm ? meta.titleKm : meta.titleEn;
        }

        sidebarPanel?.classList.remove('hidden');

        overlay.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
        overlay.querySelector(`#tab-panel-${tabKey}`)?.classList.remove('hidden');
      });
    });

    // Close & Toggle Tools Sidebar
    overlay.querySelector('#btn-close-sidebar-panel')?.addEventListener('click', () => {
      sidebarPanel?.classList.add('hidden');
    });

    overlay.querySelector('#btn-toggle-tools-sidebar')?.addEventListener('click', () => {
      sidebarPanel?.classList.toggle('hidden');
    });

    // Card Orientation Toggles
    const btnCardPort = overlay.querySelector('#btn-orient-card-portrait');
    const btnCardLand = overlay.querySelector('#btn-orient-card-landscape');

    btnCardPort?.addEventListener('click', () => {
      if (this.config.cardOrientation !== 'portrait') {
        this.config.cardOrientation = 'portrait';
        const preset = DIMENSION_PRESETS.portrait[this.config.dimensions] || DIMENSION_PRESETS.portrait.cr80;
        if (this.config.dimensions !== 'custom') {
          this.config.widthMm = preset.widthMm;
          this.config.heightMm = preset.heightMm;
        } else if (this.config.widthMm > this.config.heightMm) {
          const temp = this.config.widthMm;
          this.config.widthMm = this.config.heightMm;
          this.config.heightMm = temp;
        }
        this.savePersistedSettings();
        this.renderModal();
      }
    });

    btnCardLand?.addEventListener('click', () => {
      if (this.config.cardOrientation !== 'landscape') {
        this.config.cardOrientation = 'landscape';
        const preset = DIMENSION_PRESETS.landscape[this.config.dimensions] || DIMENSION_PRESETS.landscape.cr80;
        if (this.config.dimensions !== 'custom') {
          this.config.widthMm = preset.widthMm;
          this.config.heightMm = preset.heightMm;
        } else if (this.config.widthMm < this.config.heightMm) {
          const temp = this.config.widthMm;
          this.config.widthMm = this.config.heightMm;
          this.config.heightMm = temp;
        }
        this.savePersistedSettings();
        this.renderModal();
      }
    });

    // Sheet Orientation Toggles
    const btnSheetPort = overlay.querySelector('#btn-orient-sheet-portrait');
    const btnSheetLand = overlay.querySelector('#btn-orient-sheet-landscape');

    btnSheetPort?.addEventListener('click', () => {
      if (this.config.sheetOrientation !== 'portrait') {
        this.config.sheetOrientation = 'portrait';
        this.savePersistedSettings();
        this.renderModal();
      }
    });

    btnSheetLand?.addEventListener('click', () => {
      if (this.config.sheetOrientation !== 'landscape') {
        this.config.sheetOrientation = 'landscape';
        this.savePersistedSettings();
        this.renderModal();
      }
    });

    // Cards per Sheet selector
    overlay.querySelector('#select-cards-per-sheet')?.addEventListener('change', (e) => {
      this.config.cardsPerSheet = parseInt(e.target.value, 10);
      this.currentPage = 0;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Dimension preset selector
    overlay.querySelector('#select-dimension-preset')?.addEventListener('change', (e) => {
      const val = e.target.value;
      this.config.dimensions = val;
      const customInputs = overlay.querySelector('#custom-dimension-inputs');
      const orientKey = this.config.cardOrientation === 'landscape' ? 'landscape' : 'portrait';

      if (val === 'custom') {
        customInputs?.classList.remove('hidden');
      } else {
        customInputs?.classList.add('hidden');
        const preset = DIMENSION_PRESETS[orientKey][val];
        if (preset) {
          this.config.widthMm = preset.widthMm;
          this.config.heightMm = preset.heightMm;
        }
      }
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Custom Width & Height
    overlay.querySelector('#input-custom-width')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val > 0) {
        this.config.widthMm = val;
        this.savePersistedSettings();
        this.updatePreview();
      }
    });

    overlay.querySelector('#input-custom-height')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val > 0) {
        this.config.heightMm = val;
        this.savePersistedSettings();
        this.updatePreview();
      }
    });

    // Gap buttons
    overlay.querySelectorAll('.btn-gap-select').forEach(btn => {
      btn.addEventListener('click', () => {
        const gap = parseInt(btn.getAttribute('data-gap'), 10);
        this.config.gapMm = gap;
        overlay.querySelectorAll('.btn-gap-select').forEach(b => {
          b.className = 'btn-gap-select py-1.5 rounded border text-xs font-mono font-medium transition-all border-input bg-background hover:bg-muted text-foreground cursor-pointer';
        });
        btn.className = 'btn-gap-select py-1.5 rounded border text-xs font-mono font-bold transition-all border-primary bg-primary text-primary-foreground cursor-pointer';
        this.savePersistedSettings();
        this.updatePreview();
      });
    });

    // Sheet Margin buttons
    overlay.querySelectorAll('.btn-margin-select').forEach(btn => {
      btn.addEventListener('click', () => {
        const margin = parseInt(btn.getAttribute('data-margin'), 10);
        this.config.sheetMarginMm = margin;
        this.savePersistedSettings();
        this.renderModal();
      });
    });

    // Sheet Margin slider
    overlay.querySelector('#input-sheet-margin-slider')?.addEventListener('input', (e) => {
      const margin = parseInt(e.target.value, 10);
      this.config.sheetMarginMm = margin;
      const label = overlay.querySelector('#label-sheet-margin');
      if (label) label.textContent = `${margin}mm`;
      overlay.querySelectorAll('.btn-margin-select').forEach(b => {
        const bMargin = parseInt(b.getAttribute('data-margin'), 10);
        if (bMargin === margin) {
          b.className = 'btn-margin-select py-1.5 rounded border text-xs font-mono font-bold transition-all border-primary bg-primary text-primary-foreground cursor-pointer';
        } else {
          b.className = 'btn-margin-select py-1.5 rounded border text-xs font-mono font-medium transition-all border-input bg-background hover:bg-muted text-foreground cursor-pointer';
        }
      });
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Crop marks toggle
    overlay.querySelector('#toggle-crop-marks')?.addEventListener('change', (e) => {
      this.config.showCropMarks = e.target.checked;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Preset color buttons
    overlay.querySelectorAll('.btn-theme-color').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        this.config.accentColor = color;
        const hexInput = overlay.querySelector('#input-accent-color-hex');
        const pickerInput = overlay.querySelector('#input-accent-color-picker');
        if (hexInput) hexInput.value = color;
        if (pickerInput) pickerInput.value = color;
        this.savePersistedSettings();
        this.updatePreview();
      });
    });

    // Color picker
    overlay.querySelector('#input-accent-color-picker')?.addEventListener('input', (e) => {
      this.config.accentColor = e.target.value;
      const hexInput = overlay.querySelector('#input-accent-color-hex');
      if (hexInput) hexInput.value = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    overlay.querySelector('#input-accent-color-hex')?.addEventListener('change', (e) => {
      this.config.accentColor = e.target.value;
      const pickerInput = overlay.querySelector('#input-accent-color-picker');
      if (pickerInput) pickerInput.value = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Custom Background Image Upload & Opacity
    const bgImageInput = overlay.querySelector('#input-file-bg-image');
    overlay.querySelector('#btn-upload-bg-image')?.addEventListener('click', () => bgImageInput?.click());
    bgImageInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.config.backgroundImage = ev.target.result;
          this.savePersistedSettings();
          this.renderModal();
        };
        reader.readAsDataURL(file);
      }
    });

    overlay.querySelector('#btn-remove-bg-image')?.addEventListener('click', () => {
      this.config.backgroundImage = '';
      this.savePersistedSettings();
      this.renderModal();
    });

    overlay.querySelector('#input-bg-opacity')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.config.backgroundOpacity = val;
      const label = overlay.querySelector('#label-bg-opacity');
      if (label) label.textContent = `${val}%`;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Ribbon text
    overlay.querySelector('#input-ribbon-text')?.addEventListener('input', (e) => {
      this.config.ribbonText = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // School names
    overlay.querySelector('#input-school-name-kh')?.addEventListener('input', (e) => {
      this.config.schoolNameKh = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    overlay.querySelector('#input-school-name-en')?.addEventListener('input', (e) => {
      this.config.schoolNameEn = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // School Name Khmer Typography
    overlay.querySelector('#select-school-kh-font')?.addEventListener('change', (e) => {
      this.config.schoolNameKhFont = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    overlay.querySelector('#input-school-kh-size')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val > 0) {
        this.config.schoolNameKhSize = val;
        this.savePersistedSettings();
        this.updatePreview();
      }
    });

    overlay.querySelector('#input-school-kh-color')?.addEventListener('input', (e) => {
      this.config.schoolNameKhColor = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    overlay.querySelector('#btn-school-kh-bold')?.addEventListener('click', () => {
      const isBold = this.config.schoolNameKhBold === false;
      this.config.schoolNameKhBold = isBold;
      const btn = overlay.querySelector('#btn-school-kh-bold');
      if (btn) {
        btn.className = `w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs ${isBold ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-foreground border-input'}`;
      }
      this.savePersistedSettings();
      this.updatePreview();
    });

    // School Name Latin Typography
    overlay.querySelector('#select-school-en-font')?.addEventListener('change', (e) => {
      this.config.schoolNameEnFont = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    overlay.querySelector('#input-school-en-size')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val > 0) {
        this.config.schoolNameEnSize = val;
        this.savePersistedSettings();
        this.updatePreview();
      }
    });

    overlay.querySelector('#input-school-en-color')?.addEventListener('input', (e) => {
      this.config.schoolNameEnColor = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    overlay.querySelector('#btn-school-en-bold')?.addEventListener('click', () => {
      const isBold = this.config.schoolNameEnBold === false;
      this.config.schoolNameEnBold = isBold;
      const btn = overlay.querySelector('#btn-school-en-bold');
      if (btn) {
        btn.className = `w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs ${isBold ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-foreground border-input'}`;
      }
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Logo Upload
    const logoInput = overlay.querySelector('#input-file-logo');
    overlay.querySelector('#btn-upload-logo')?.addEventListener('click', () => logoInput?.click());
    logoInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.config.schoolLogo = ev.target.result;
          this.savePersistedSettings();
          this.renderModal();
        };
        reader.readAsDataURL(file);
      }
    });

    overlay.querySelector('#btn-remove-logo')?.addEventListener('click', () => {
      this.config.schoolLogo = '';
      this.savePersistedSettings();
      this.renderModal();
    });

    // Director / Signatory Title
    overlay.querySelector('#toggle-director-title')?.addEventListener('change', (e) => {
      this.config.showDirectorTitle = e.target.checked;
      this.savePersistedSettings();
      this.updatePreview();
    });

    overlay.querySelector('#input-director-title')?.addEventListener('input', (e) => {
      this.config.directorTitle = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    overlay.querySelector('#select-director-title-font')?.addEventListener('change', (e) => {
      this.config.directorTitleFont = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    overlay.querySelector('#input-director-title-size')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val > 0) {
        this.config.directorTitleSize = val;
        this.savePersistedSettings();
        this.updatePreview();
      }
    });

    overlay.querySelector('#input-director-title-color')?.addEventListener('input', (e) => {
      this.config.directorTitleColor = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    overlay.querySelector('#btn-director-title-bold')?.addEventListener('click', () => {
      const isBold = this.config.directorTitleBold === false;
      this.config.directorTitleBold = isBold;
      const btn = overlay.querySelector('#btn-director-title-bold');
      if (btn) {
        btn.className = `w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs ${isBold ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-foreground border-input'}`;
      }
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Signature Upload
    const sigInput = overlay.querySelector('#input-file-signature');
    overlay.querySelector('#btn-upload-signature')?.addEventListener('click', () => sigInput?.click());
    sigInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.config.signatureImage = ev.target.result;
          this.config.showSignature = true;
          this.savePersistedSettings();
          this.renderModal();
        };
        reader.readAsDataURL(file);
      }
    });

    overlay.querySelector('#btn-remove-signature')?.addEventListener('click', () => {
      this.config.signatureImage = '';
      this.savePersistedSettings();
      this.renderModal();
    });

    overlay.querySelector('#toggle-signature')?.addEventListener('change', (e) => {
      this.config.showSignature = e.target.checked;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Stamp Upload
    const stampInput = overlay.querySelector('#input-file-stamp');
    overlay.querySelector('#btn-upload-stamp')?.addEventListener('click', () => stampInput?.click());
    stampInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.config.stampImage = ev.target.result;
          this.config.showStamp = true;
          this.savePersistedSettings();
          this.renderModal();
        };
        reader.readAsDataURL(file);
      }
    });

    overlay.querySelector('#btn-remove-stamp')?.addEventListener('click', () => {
      this.config.stampImage = '';
      this.savePersistedSettings();
      this.renderModal();
    });

    overlay.querySelector('#toggle-stamp')?.addEventListener('change', (e) => {
      this.config.showStamp = e.target.checked;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Card Date Toggle
    overlay.querySelector('#toggle-card-date')?.addEventListener('change', (e) => {
      this.config.showCardDate = e.target.checked;
      const panel = overlay.querySelector('#card-date-settings-panel');
      if (panel) {
        if (e.target.checked) {
          panel.classList.remove('hidden');
          panel.classList.add('space-y-2.5');
        } else {
          panel.classList.add('hidden');
          panel.classList.remove('space-y-2.5');
        }
      }
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Card Date Picker
    overlay.querySelector('#input-card-date-picker')?.addEventListener('change', (e) => {
      this.config.cardDateValue = e.target.value;
      this.recalculateCardDateLines();
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Card Date Type Selector
    overlay.querySelector('#select-card-date-type')?.addEventListener('change', (e) => {
      this.config.cardDateType = e.target.value;
      this.recalculateCardDateLines();
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Card Date Location Prefix
    overlay.querySelector('#input-card-date-location')?.addEventListener('input', (e) => {
      this.config.cardDateLocation = e.target.value;
      this.recalculateCardDateLines();
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Custom Line 1 (Khmer Lunar)
    overlay.querySelector('#input-card-date-line1')?.addEventListener('input', (e) => {
      this.config.cardDateCustomLine1 = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Custom Line 2 (Khmer Solar)
    overlay.querySelector('#input-card-date-line2')?.addEventListener('input', (e) => {
      this.config.cardDateCustomLine2 = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Auto-calculate Lunar Line 1 button
    overlay.querySelector('#btn-refresh-card-date-lunar')?.addEventListener('click', () => {
      const rawDate = this.config.cardDateValue ? new Date(this.config.cardDateValue) : new Date();
      const validDate = isNaN(rawDate.getTime()) ? new Date() : rawDate;
      const lunar = formatKhmerLunarDate(validDate);
      this.config.cardDateCustomLine1 = lunar;
      const inp = overlay.querySelector('#input-card-date-line1');
      if (inp) inp.value = lunar;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Auto-calculate Solar Line 2 button
    overlay.querySelector('#btn-refresh-card-date-solar')?.addEventListener('click', () => {
      const rawDate = this.config.cardDateValue ? new Date(this.config.cardDateValue) : new Date();
      const validDate = isNaN(rawDate.getTime()) ? new Date() : rawDate;
      const loc = this.config.cardDateLocation && this.config.cardDateLocation.trim() ? `${this.config.cardDateLocation.trim()}, ` : '';
      const solar = `${loc}${formatKhmerSolarDate(validDate)}`;
      this.config.cardDateCustomLine2 = solar;
      const inp = overlay.querySelector('#input-card-date-line2');
      if (inp) inp.value = solar;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Card Date Font
    overlay.querySelector('#select-card-date-font')?.addEventListener('change', (e) => {
      this.config.cardDateFont = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Card Date Size
    overlay.querySelector('#input-card-date-size')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val > 0) {
        this.config.cardDateSize = val;
        this.savePersistedSettings();
        this.updatePreview();
      }
    });

    // Card Date Color
    overlay.querySelector('#input-card-date-color')?.addEventListener('input', (e) => {
      this.config.cardDateColor = e.target.value;
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Card Date Bold
    overlay.querySelector('#btn-card-date-bold')?.addEventListener('click', () => {
      const isBold = !this.config.cardDateBold;
      this.config.cardDateBold = isBold;
      const btn = overlay.querySelector('#btn-card-date-bold');
      if (btn) {
        btn.className = `w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs ${isBold ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-foreground border-input'}`;
      }
      this.savePersistedSettings();
      this.updatePreview();
    });

    // Field Toggles
    overlay.querySelectorAll('.field-toggle-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const fieldKey = cb.getAttribute('data-field');
        if (fieldKey) {
          this.config.fields[fieldKey] = cb.checked;
          this.savePersistedSettings();
          this.updatePreview();
        }
      });
    });

    // Field Font Style
    overlay.querySelectorAll('.input-field-style-font').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const field = sel.getAttribute('data-style-field');
        if (!this.config.fieldStyles) this.config.fieldStyles = { ...DEFAULT_FIELD_STYLES };
        if (!this.config.fieldStyles[field]) this.config.fieldStyles[field] = { ...(DEFAULT_FIELD_STYLES[field] || {}) };
        this.config.fieldStyles[field].font = e.target.value;
        this.savePersistedSettings();
        this.updatePreview();
      });
    });

    // Field Font Size
    overlay.querySelectorAll('.input-field-style-size').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const field = inp.getAttribute('data-style-field');
        const val = parseFloat(e.target.value);
        if (val > 0) {
          if (!this.config.fieldStyles) this.config.fieldStyles = { ...DEFAULT_FIELD_STYLES };
          if (!this.config.fieldStyles[field]) this.config.fieldStyles[field] = { ...(DEFAULT_FIELD_STYLES[field] || {}) };
          this.config.fieldStyles[field].size = val;
          this.savePersistedSettings();
          this.updatePreview();
        }
      });
    });

    // Field Color Picker
    overlay.querySelectorAll('.input-field-style-color').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const field = inp.getAttribute('data-style-field');
        if (!this.config.fieldStyles) this.config.fieldStyles = { ...DEFAULT_FIELD_STYLES };
        if (!this.config.fieldStyles[field]) this.config.fieldStyles[field] = { ...(DEFAULT_FIELD_STYLES[field] || {}) };
        this.config.fieldStyles[field].color = e.target.value;
        this.savePersistedSettings();
        this.updatePreview();
      });
    });

    // Field Bold Toggle
    overlay.querySelectorAll('.btn-field-style-bold').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.getAttribute('data-style-field');
        if (!this.config.fieldStyles) this.config.fieldStyles = { ...DEFAULT_FIELD_STYLES };
        if (!this.config.fieldStyles[field]) this.config.fieldStyles[field] = { ...(DEFAULT_FIELD_STYLES[field] || {}) };
        const isBold = !this.config.fieldStyles[field].bold;
        this.config.fieldStyles[field].bold = isBold;
        if (isBold) {
          btn.className = 'btn-field-style-bold w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs bg-primary text-primary-foreground border-primary';
        } else {
          btn.className = 'btn-field-style-bold w-7 h-7 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs bg-background hover:bg-muted text-foreground border-input';
        }
        this.savePersistedSettings();
        this.updatePreview();
      });
    });

    // Asset Move & Zoom transform sliders
    overlay.querySelectorAll('.input-transform-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const target = e.target.getAttribute('data-transform-target');
        const prop = e.target.getAttribute('data-transform-prop');
        const val = parseFloat(e.target.value);
        const configKey = target + prop;
        this.config[configKey] = val;

        // Update corresponding label
        if (prop === 'Scale') {
          const label = overlay.querySelector(`#label-scale-${target}`);
          if (label) label.textContent = `${Math.round(val)}%`;
        } else if (prop === 'OffsetX') {
          const label = overlay.querySelector(`#label-offsetx-${target}`);
          if (label) label.textContent = `${val > 0 ? '+' : ''}${val}px`;
        } else if (prop === 'OffsetY') {
          const label = overlay.querySelector(`#label-offsety-${target}`);
          if (label) label.textContent = `${val > 0 ? '+' : ''}${val}px`;
        }

        this.savePersistedSettings();
        this.updatePreview();
      });
    });

    // Zoom Step buttons (+ / -)
    overlay.querySelectorAll('.btn-step-zoom').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-zoom-target');
        const step = parseInt(btn.getAttribute('data-zoom-step'), 10);
        const configKey = target + 'Scale';
        const currentVal = this.config[configKey] !== undefined ? this.config[configKey] : 100;
        const minVal = 20;
        const maxVal = 600;
        const newVal = Math.max(minVal, Math.min(maxVal, currentVal + step));

        this.config[configKey] = newVal;
        const input = overlay.querySelector(`#input-scale-${target}`);
        if (input) input.value = newVal;
        const label = overlay.querySelector(`#label-scale-${target}`);
        if (label) label.textContent = `${newVal}%`;

        this.savePersistedSettings();
        this.updatePreview();
      });
    });

    // Directional Nudge buttons (Left, Up, Down, Right)
    overlay.querySelectorAll('.btn-nudge').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-nudge-target');
        const dir = btn.getAttribute('data-nudge-dir');
        const step = 2; // 2px per click

        if (dir === 'left') {
          const key = target + 'OffsetX';
          this.config[key] = Math.max(-600, (this.config[key] || 0) - step);
          const input = overlay.querySelector(`#input-offsetx-${target}`);
          if (input) input.value = this.config[key];
          const label = overlay.querySelector(`#label-offsetx-${target}`);
          if (label) label.textContent = `${this.config[key] > 0 ? '+' : ''}${this.config[key]}px`;
        } else if (dir === 'right') {
          const key = target + 'OffsetX';
          this.config[key] = Math.min(600, (this.config[key] || 0) + step);
          const input = overlay.querySelector(`#input-offsetx-${target}`);
          if (input) input.value = this.config[key];
          const label = overlay.querySelector(`#label-offsetx-${target}`);
          if (label) label.textContent = `${this.config[key] > 0 ? '+' : ''}${this.config[key]}px`;
        } else if (dir === 'up') {
          const key = target + 'OffsetY';
          this.config[key] = Math.max(-600, (this.config[key] || 0) - step);
          const input = overlay.querySelector(`#input-offsety-${target}`);
          if (input) input.value = this.config[key];
          const label = overlay.querySelector(`#label-offsety-${target}`);
          if (label) label.textContent = `${this.config[key] > 0 ? '+' : ''}${this.config[key]}px`;
        } else if (dir === 'down') {
          const key = target + 'OffsetY';
          this.config[key] = Math.min(600, (this.config[key] || 0) + step);
          const input = overlay.querySelector(`#input-offsety-${target}`);
          if (input) input.value = this.config[key];
          const label = overlay.querySelector(`#label-offsety-${target}`);
          if (label) label.textContent = `${this.config[key] > 0 ? '+' : ''}${this.config[key]}px`;
        }

        this.savePersistedSettings();
        this.updatePreview();
      });
    });

    // Reset transform buttons
    overlay.querySelectorAll('.btn-reset-transform').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-reset-target');
        this.config[target + 'Scale'] = 100;
        this.config[target + 'OffsetX'] = 0;
        this.config[target + 'OffsetY'] = 0;

        const inputScale = overlay.querySelector(`#input-scale-${target}`);
        if (inputScale) inputScale.value = 100;
        const labelScale = overlay.querySelector(`#label-scale-${target}`);
        if (labelScale) labelScale.textContent = '100%';

        const inputX = overlay.querySelector(`#input-offsetx-${target}`);
        if (inputX) inputX.value = 0;
        const labelX = overlay.querySelector(`#label-offsetx-${target}`);
        if (labelX) labelX.textContent = '0px';

        const inputY = overlay.querySelector(`#input-offsety-${target}`);
        if (inputY) inputY.value = 0;
        const labelY = overlay.querySelector(`#label-offsety-${target}`);
        if (labelY) labelY.textContent = '0px';

        this.savePersistedSettings();
        this.updatePreview();
      });
    });

    // Print Dropdown Toggle
    const printDropdownWrapper = overlay.querySelector('#print-dropdown-wrapper');
    const printDropdownMenu = overlay.querySelector('#print-dropdown-menu');
    const btnPrintDropdownToggle = overlay.querySelector('#btn-studio-print-dropdown-toggle');

    btnPrintDropdownToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      printDropdownMenu?.classList.toggle('hidden');
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (printDropdownWrapper && !printDropdownWrapper.contains(e.target)) {
        printDropdownMenu?.classList.add('hidden');
      }
    });

    // Print Primary Button (Prints selected students)
    overlay.querySelector('#btn-studio-print-primary')?.addEventListener('click', () => {
      printDropdownMenu?.classList.add('hidden');
      this.executePrint('selected');
    });

    // Print Option 1: Selected Students
    overlay.querySelector('#btn-print-option-selected')?.addEventListener('click', () => {
      printDropdownMenu?.classList.add('hidden');
      this.executePrint('selected');
    });

    // Print Option 2: Current Student Card
    overlay.querySelector('#btn-print-option-current')?.addEventListener('click', () => {
      printDropdownMenu?.classList.add('hidden');
      this.executePrint('current');
    });

    // Print Option 3: All Students
    overlay.querySelector('#btn-print-option-all')?.addEventListener('click', () => {
      printDropdownMenu?.classList.add('hidden');
      this.executePrint('all');
    });

    // PDF Button
    overlay.querySelector('#btn-studio-pdf')?.addEventListener('click', () => {
      this.executePrint('selected');
    });

    // Sub-toolbar: Checkbox for current preview student
    overlay.querySelector('#chk-current-student-selected')?.addEventListener('change', (e) => {
      const currentStudent = this.students[this.previewStudentIndex];
      if (currentStudent) {
        const key = this.getStudentKey(currentStudent);
        if (e.target.checked) {
          this.selectedStudentIds.add(key);
        } else {
          this.selectedStudentIds.delete(key);
        }
        this.updatePreview();
        this.refreshStudentsChecklistUI();
      }
    });

    // Sub-toolbar: Print current card button
    overlay.querySelector('#btn-print-current-card-sub')?.addEventListener('click', () => {
      this.executePrint('current');
    });

    // Sub-toolbar: Sheet layout toggle (Selected vs All)
    overlay.querySelector('#btn-sheet-toggle-selected')?.addEventListener('click', () => {
      this.onlyShowSelectedInSheet = true;
      this.currentPage = 0;
      this.renderModal();
    });

    overlay.querySelector('#btn-sheet-toggle-all')?.addEventListener('click', () => {
      this.onlyShowSelectedInSheet = false;
      this.currentPage = 0;
      this.renderModal();
    });

    // Tab 6: Students Tab Controls
    // Search input
    overlay.querySelector('#input-student-search')?.addEventListener('input', (e) => {
      this.studentSearchQuery = e.target.value;
      this.refreshStudentsChecklistUI();
    });

    // Clear search
    overlay.querySelector('#btn-clear-student-search')?.addEventListener('click', () => {
      this.studentSearchQuery = '';
      const input = overlay.querySelector('#input-student-search');
      if (input) input.value = '';
      this.refreshStudentsChecklistUI();
    });

    // Class Filter
    overlay.querySelector('#select-student-class-filter')?.addEventListener('change', (e) => {
      this.studentClassFilter = e.target.value;
      this.refreshStudentsChecklistUI();
    });

    // Select All
    overlay.querySelector('#btn-select-all-students')?.addEventListener('click', () => {
      const filtered = this.getFilteredStudentsForList();
      filtered.forEach(s => this.selectedStudentIds.add(this.getStudentKey(s)));
      this.refreshStudentsChecklistUI();
      this.updatePreview();
    });

    // Deselect All
    overlay.querySelector('#btn-deselect-all-students')?.addEventListener('click', () => {
      const filtered = this.getFilteredStudentsForList();
      filtered.forEach(s => this.selectedStudentIds.delete(this.getStudentKey(s)));
      this.refreshStudentsChecklistUI();
      this.updatePreview();
    });

    // Select With Photo Only
    overlay.querySelector('#btn-select-photo-only-students')?.addEventListener('click', () => {
      this.students.forEach(s => {
        const hasPhoto = !!(s.photoBlob || s.photo);
        const key = this.getStudentKey(s);
        if (hasPhoto) {
          this.selectedStudentIds.add(key);
        } else {
          this.selectedStudentIds.delete(key);
        }
      });
      this.refreshStudentsChecklistUI();
      this.updatePreview();
    });

    // Toggle Sheet Show Selected
    overlay.querySelector('#toggle-sheet-show-selected')?.addEventListener('change', (e) => {
      this.onlyShowSelectedInSheet = e.target.checked;
      this.currentPage = 0;
      this.updatePreview();
    });

    // Bind Student Checklist Item Events
    this.bindStudentsChecklistEvents();
  },

  /**
   * Re-render student checklist in the Students tab
   */
  refreshStudentsChecklistUI() {
    const listContainer = this.activeOverlay?.querySelector('#students-checklist-container');
    if (listContainer) {
      listContainer.innerHTML = this.renderStudentsChecklistHtml();
      this.bindStudentsChecklistEvents();
    }
  },

  /**
   * Bind events for interactive student checklist rows
   */
  bindStudentsChecklistEvents() {
    const overlay = this.activeOverlay;
    if (!overlay) return;

    // Student selection checkboxes
    overlay.querySelectorAll('.student-select-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        const key = cb.getAttribute('data-student-key');
        if (cb.checked) {
          this.selectedStudentIds.add(key);
        } else {
          this.selectedStudentIds.delete(key);
        }
        this.updatePreview();
        this.refreshStudentsChecklistUI();
      });
    });

    // Student row preview click
    overlay.querySelectorAll('.btn-preview-student-row, .student-row-clickable').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('student-select-checkbox')) return;
        const row = el.closest('.student-item-row');
        const idx = parseInt(row?.getAttribute('data-student-index'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.students.length) {
          this.previewStudentIndex = idx;
          if (this.viewMode !== 'card') {
            this.viewMode = 'card';
            this.zoomScale = 1.75;
            this.renderModal();
          } else {
            this.updatePreview();
            this.refreshStudentsChecklistUI();
          }
        }
      });
    });

    // Student row quick print single card
    overlay.querySelectorAll('.btn-print-student-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-student-index'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.students.length) {
          this.previewStudentIndex = idx;
          this.executePrint('current');
        }
      });
    });
  },

  /**
   * Helper to render Move & Zoom transform controls box for any asset (Logo, Photo, Signature, Stamp)
   */
  renderTransformWidget({ targetKey, titleKh, titleEn, isKm, scale = 100, offsetX = 0, offsetY = 0, minScale = 20, maxScale = 600, minOffset = -600, maxOffset = 600 }) {
    return `
      <div class="mt-2.5 p-2.5 rounded-lg bg-muted/40 border border-border space-y-2" id="transform-widget-${targetKey}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold font-khmer text-foreground flex items-center gap-1.5">
            ${getIcon('move', 'w-3.5 h-3.5 text-primary')}
            <span>${isKm ? titleKh : titleEn}</span>
          </span>
          <button type="button" data-reset-target="${targetKey}" class="btn-reset-transform text-[11px] text-primary hover:underline font-khmer cursor-pointer">
            ${isKm ? 'កំណត់ឡើងវិញ' : 'Reset'}
          </button>
        </div>

        <!-- Zoom Slider -->
        <div class="space-y-1">
          <div class="flex justify-between text-[11px] text-muted-foreground">
            <span class="font-khmer">${isKm ? 'ទំហំពង្រីក / បង្រួម' : 'Zoom / Scale'}</span>
            <span id="label-scale-${targetKey}" class="font-mono font-bold text-foreground text-xs">${scale}%</span>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" data-zoom-step="-5" data-zoom-target="${targetKey}" class="btn-step-zoom w-6 h-6 flex items-center justify-center rounded border border-input bg-background hover:bg-muted text-xs cursor-pointer font-bold leading-none select-none">-</button>
            <input type="range" id="input-scale-${targetKey}" data-transform-target="${targetKey}" data-transform-prop="Scale" min="${minScale}" max="${maxScale}" step="5" value="${scale}" class="input-transform-slider flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary" />
            <button type="button" data-zoom-step="5" data-zoom-target="${targetKey}" class="btn-step-zoom w-6 h-6 flex items-center justify-center rounded border border-input bg-background hover:bg-muted text-xs cursor-pointer font-bold leading-none select-none">+</button>
          </div>
        </div>

        <!-- Move X and Y Sliders -->
        <div class="grid grid-cols-2 gap-2 pt-0.5">
          <div class="space-y-1">
            <div class="flex justify-between text-[11px] text-muted-foreground">
              <span class="font-khmer">${isKm ? 'ឆ្វេង-ស្តាំ (X)' : 'Move X'}</span>
              <span id="label-offsetx-${targetKey}" class="font-mono text-foreground text-xs">${offsetX > 0 ? '+' : ''}${offsetX}px</span>
            </div>
            <input type="range" id="input-offsetx-${targetKey}" data-transform-target="${targetKey}" data-transform-prop="OffsetX" min="${minOffset}" max="${maxOffset}" step="1" value="${offsetX}" class="input-transform-slider w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary" />
          </div>
          <div class="space-y-1">
            <div class="flex justify-between text-[11px] text-muted-foreground">
              <span class="font-khmer">${isKm ? 'លើ-ក្រោម (Y)' : 'Move Y'}</span>
              <span id="label-offsety-${targetKey}" class="font-mono text-foreground text-xs">${offsetY > 0 ? '+' : ''}${offsetY}px</span>
            </div>
            <input type="range" id="input-offsety-${targetKey}" data-transform-target="${targetKey}" data-transform-prop="OffsetY" min="${minOffset}" max="${maxOffset}" step="1" value="${offsetY}" class="input-transform-slider w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary" />
          </div>
        </div>

        <!-- Directional Nudge Buttons -->
        <div class="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
          <span class="font-khmer">${isKm ? 'ចុចរំកិលទីតាំង:' : 'Nudge:'}</span>
          <div class="flex items-center gap-1">
            <button type="button" data-nudge-dir="left" data-nudge-target="${targetKey}" class="btn-nudge p-1 rounded border border-input bg-background hover:bg-muted cursor-pointer transition-colors" title="Left">
              ${getIcon('chevronLeft', 'w-3 h-3')}
            </button>
            <button type="button" data-nudge-dir="up" data-nudge-target="${targetKey}" class="btn-nudge p-1 rounded border border-input bg-background hover:bg-muted cursor-pointer transition-colors" title="Up">
              ${getIcon('chevronUp', 'w-3 h-3')}
            </button>
            <button type="button" data-nudge-dir="down" data-nudge-target="${targetKey}" class="btn-nudge p-1 rounded border border-input bg-background hover:bg-muted cursor-pointer transition-colors" title="Down">
              ${getIcon('chevronDown', 'w-3 h-3')}
            </button>
            <button type="button" data-nudge-dir="right" data-nudge-target="${targetKey}" class="btn-nudge p-1 rounded border border-input bg-background hover:bg-muted cursor-pointer transition-colors" title="Right">
              ${getIcon('chevronRight', 'w-3 h-3')}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Bind direct mouse drag & wheel interactions for all card assets (Photo, Logo, Signature, Stamp)
   */
  bindMouseDraggableAssets() {
    const sheetContainer = this.activeOverlay?.querySelector('#a4-sheet-container');
    if (!sheetContainer) return;

    const draggableElements = sheetContainer.querySelectorAll('.draggable-card-asset');

    draggableElements.forEach(el => {
      // Primary Mouse Down for Drag
      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left click
        e.preventDefault();
        e.stopPropagation();

        const assetType = el.getAttribute('data-asset-type');
        if (!assetType) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const startOffsetX = this.config[assetType + 'OffsetX'] || 0;
        const startOffsetY = this.config[assetType + 'OffsetY'] || 0;
        const currentZoom = this.zoomScale || 0.75;

        // Auto-switch sidebar tab to corresponding settings tab
        const tabMap = {
          header: 'branding',
          logo: 'branding',
          photo: 'style',
          fields: 'fields',
          title: 'signature',
          signature: 'signature',
          stamp: 'signature',
          cardDate: 'signature'
        };
        const targetTab = tabMap[assetType];
        if (targetTab && this.activeOverlay) {
          this.activeOverlay.querySelectorAll('.studio-tab-btn').forEach(b => {
            if (b.getAttribute('data-tab') === targetTab) {
              b.click();
            }
          });
        }

        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        el.classList.add('ring-2', 'ring-primary');

        let hasMoved = false;

        const onMouseMove = (ev) => {
          hasMoved = true;
          const deltaX = (ev.clientX - startX) / currentZoom;
          const deltaY = (ev.clientY - startY) / currentZoom;

          const minOffset = -600;
          const maxOffset = 600;

          const newX = Math.max(minOffset, Math.min(maxOffset, Math.round(startOffsetX + deltaX)));
          const newY = Math.max(minOffset, Math.min(maxOffset, Math.round(startOffsetY + deltaY)));

          this.config[assetType + 'OffsetX'] = newX;
          this.config[assetType + 'OffsetY'] = newY;

          // Realtime 60fps update of all matching assets on the A4 canvas
          const scale = (this.config[assetType + 'Scale'] || 100) / 100;
          const origin = (assetType === 'signature' || assetType === 'cardDate') ? 'center bottom' : (assetType === 'header' ? 'center top' : 'center center');
          sheetContainer.querySelectorAll(`[data-asset-type="${assetType}"]`).forEach(asset => {
            asset.style.transform = `translate(${newX}px, ${newY}px) scale(${scale})`;
            asset.style.transformOrigin = origin;
          });

          // Update sidebar inputs and labels in sync
          const inputX = this.activeOverlay?.querySelector(`#input-offsetx-${assetType}`);
          if (inputX) inputX.value = newX;
          const labelX = this.activeOverlay?.querySelector(`#label-offsetx-${assetType}`);
          if (labelX) labelX.textContent = `${newX > 0 ? '+' : ''}${newX}px`;

          const inputY = this.activeOverlay?.querySelector(`#input-offsety-${assetType}`);
          if (inputY) inputY.value = newY;
          const labelY = this.activeOverlay?.querySelector(`#label-offsety-${assetType}`);
          if (labelY) labelY.textContent = `${newY > 0 ? '+' : ''}${newY}px`;
        };

        const onMouseUp = () => {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          el.classList.remove('ring-2', 'ring-primary');
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);

          if (hasMoved) {
            this.savePersistedSettings();
          }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      // Mouse Wheel for instant zooming on the asset
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const assetType = el.getAttribute('data-asset-type');
        if (!assetType) return;

        const zoomDelta = e.deltaY < 0 ? 5 : -5;
        const currentScale = this.config[assetType + 'Scale'] || 100;
        const minScale = 20;
        const maxScale = 600;
        const newScale = Math.max(minScale, Math.min(maxScale, currentScale + zoomDelta));

        this.config[assetType + 'Scale'] = newScale;

        // Realtime update all matching assets on the canvas
        const offsetX = this.config[assetType + 'OffsetX'] || 0;
        const offsetY = this.config[assetType + 'OffsetY'] || 0;
        const origin = (assetType === 'signature' || assetType === 'cardDate') ? 'center bottom' : (assetType === 'header' ? 'center top' : 'center center');
        sheetContainer.querySelectorAll(`[data-asset-type="${assetType}"]`).forEach(asset => {
          asset.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${newScale / 100})`;
          asset.style.transformOrigin = origin;
        });

        // Update sidebar input and label
        const inputScale = this.activeOverlay?.querySelector(`#input-scale-${assetType}`);
        if (inputScale) inputScale.value = newScale;
        const labelScale = this.activeOverlay?.querySelector(`#label-scale-${assetType}`);
        if (labelScale) labelScale.textContent = `${newScale}%`;

        this.savePersistedSettings();
      }, { passive: false });
    });
  },

  /**
   * Recalculates card date strings based on current date, location and type
   */
  recalculateCardDateLines() {
    const rawDate = this.config.cardDateValue ? new Date(this.config.cardDateValue) : new Date();
    const validDate = isNaN(rawDate.getTime()) ? new Date() : rawDate;
    const lunar = formatKhmerLunarDate(validDate);
    const loc = this.config.cardDateLocation && this.config.cardDateLocation.trim() ? `${this.config.cardDateLocation.trim()}, ` : '';
    const solar = `${loc}${formatKhmerSolarDate(validDate)}`;

    if (this.config.cardDateType === 'lunar') {
      this.config.cardDateCustomLine1 = lunar;
      this.config.cardDateCustomLine2 = '';
    } else if (this.config.cardDateType === 'solar') {
      this.config.cardDateCustomLine1 = '';
      this.config.cardDateCustomLine2 = solar;
    } else {
      this.config.cardDateCustomLine1 = lunar;
      this.config.cardDateCustomLine2 = solar;
    }

    const overlay = this.activeOverlay;
    if (overlay) {
      const inp1 = overlay.querySelector('#input-card-date-line1');
      if (inp1) inp1.value = this.config.cardDateCustomLine1;
      const inp2 = overlay.querySelector('#input-card-date-line2');
      if (inp2) inp2.value = this.config.cardDateCustomLine2;
    }
  },

  /**
   * Generates full printable DOM containing selected, current or all students and triggers window.print()
   * @param {'selected'|'current'|'all'} scope
   */
  executePrint(scope = 'selected') {
    const isKm = i18n.getLocale() === 'km';
    let targetStudents = [];

    if (scope === 'current') {
      const current = this.students[this.previewStudentIndex];
      if (!current) {
        toast.warning(isKm ? 'មិនមានទិន្នន័យសិស្សបច្ចុប្បន្នទេ' : 'No current student found');
        return;
      }
      targetStudents = [current];
    } else if (scope === 'all') {
      targetStudents = [...this.students];
    } else {
      // Default: 'selected'
      targetStudents = this.getSelectedStudents();
      if (targetStudents.length === 0) {
        if (this.students[this.previewStudentIndex]) {
          targetStudents = [this.students[this.previewStudentIndex]];
        } else {
          toast.warning(isKm ? 'សូមជ្រើសរើសសិស្សយ៉ាងហោចណាស់ម្នាក់ដើម្បីបោះពុម្ព' : 'Please select at least one student to print');
          return;
        }
      }
    }

    const pages = chunkStudentsForPages(targetStudents, this.config.cardsPerSheet);
    const totalPages = pages.length;
    const isSheetLandscape = this.config.sheetOrientation === 'landscape';

    // Remove any previous print container or dynamic print styles
    document.getElementById('id-card-print-container')?.remove();
    document.getElementById('id-card-print-page-style')?.remove();

    // Inject dynamic @page rule for Chromium / Electron print preview
    const printStyle = document.createElement('style');
    printStyle.id = 'id-card-print-page-style';
    printStyle.innerHTML = `
      @media print {
        @page {
          size: A4 ${isSheetLandscape ? 'landscape' : 'portrait'};
          margin: 0;
        }
      }
    `;
    document.head.appendChild(printStyle);

    const printContainer = document.createElement('div');
    printContainer.id = 'id-card-print-container';
    printContainer.className = `id-card-print-container ${isSheetLandscape ? 'sheet-landscape' : 'sheet-portrait'}`;

    let allSheetsHtml = '';
    pages.forEach((slice, idx) => {
      allSheetsHtml += renderCardSheetHtml(slice, this.config, idx, totalPages, this.classMap);
    });

    printContainer.innerHTML = allSheetsHtml;
    document.body.appendChild(printContainer);

    document.body.classList.add('printing-id-cards');
    if (isSheetLandscape) {
      document.body.classList.add('landscape-print');
    }

    // Trigger print
    setTimeout(() => {
      window.print();
      
      const cleanup = () => {
        document.body.classList.remove('printing-id-cards');
        document.body.classList.remove('landscape-print');
        printContainer.remove();
        printStyle.remove();
        window.removeEventListener('afterprint', cleanup);
      };

      window.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 2500); // Fallback cleanup
    }, 150);
  },

  /**
   * Reset all card customizations to pristine DEFAULT_CARD_CONFIG
   */
  async resetToDefault() {
    const isKm = i18n.getLocale() === 'km';
    const confirmMsg = isKm
      ? 'តើអ្នកពិតជាចង់កំណត់ការរចនាកាតទាំងអស់ឡើងវិញទៅតាមលំនាំដើមមែនទេ?'
      : 'Are you sure you want to reset all card design settings to default?';

    if (!window.confirm(confirmMsg)) return;

    // Reset configuration to pristine DEFAULT_CARD_CONFIG
    this.config = JSON.parse(JSON.stringify(DEFAULT_CARD_CONFIG));
    
    // Auto-populate from app registered school if available
    try {
      const schools = await SchoolService.getAllSchools();
      if (schools && schools.length > 0) {
        const first = schools[0];
        this.config.schoolNameKh = first.name || first.schoolNameKh || this.config.schoolNameKh;
        this.config.schoolNameEn = first.latinName || first.nameLatin || first.schoolNameEn || this.config.schoolNameEn;
        if (first.logo) this.config.schoolLogo = first.logo;
      }
    } catch (_) {}

    this.currentPage = 0;
    this.zoomScale = this.config.sheetOrientation === 'landscape' ? 0.55 : 0.65;
    
    // Save to IndexedDB
    await this.savePersistedSettings();

    // Re-render modal to refresh all form controls and preview canvas
    this.renderModal();
  },

  /**
   * Close and destroy the modal
   */
  close() {
    if (this.activeOverlay) {
      this.activeOverlay.remove();
      this.activeOverlay = null;
    }
  }
};
