/**
 * Student Management Module
 * Comprehensive data table, search, filters, pagination, photo blob handling,
 * Add/Edit modal, Profile view, bulk actions, and JSON export/import.
 */
import { StudentService } from '../services/studentService.js';
import { StudentExcelService } from '../services/studentExcelService.js';
import { ClassService } from '../services/classService.js';
import { SettingsService } from '../services/settingsService.js';
import { photoService } from '../services/photoService.js';
import { authService } from '../services/authService.js';
import { LocationService } from '../services/locationService.js';
import { SchoolService } from '../services/schoolService.js';
import { db } from '../database/db.js';
import { Modal } from '../components/modal.js';
import { StudentFormModal } from '../components/studentFormModal.js';
import { toast } from '../components/toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { ReportViewer } from '../components/reportViewer.js';
import { IDCardStudioModal } from '../components/idCardStudioModal.js';
import { renderActionDropdown } from '../components/actionDropdown.js';
import { formatKhmerLunarDate, getKhmerDateDetails } from '../utils/khmerLunar.js';
export { formatKhmerLunarDate, getKhmerDateDetails };

import { 
  formatDisplayDate, 
  toInputDateFormat, 
  toKhmerNumerals, 
  formatKhmerSolarDate, 
  calculateAge 
} from '../utils/dateUtils.js';

export { 
  formatDisplayDate, 
  toInputDateFormat, 
  toKhmerNumerals, 
  formatKhmerSolarDate, 
  calculateAge 
};

/**
 * Clean overlay prompt for "មូលហេតុនៃការបោះបង់ (Inactive Reason)" dialog (matching Image 2)
 */
function openInactiveReasonPrompt({ initialData = null, isKm = true, onConfirm, onCancel }) {
  const defaultDate = toInputDateFormat(initialData?.dropoutDate);
  const currentSemester = initialData?.dropoutSemester || 'ឆមាសទី១';
  const currentReason = initialData?.dropoutReason || '';
  const currentRemarks = initialData?.dropoutRemarks || '';

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in select-none';
  overlay.innerHTML = `
    <div class="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-down">
      <!-- Header: Graduation Cap icon + Title + Close (X) button -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-border select-none">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            ${getIcon('graduationCap', 'w-5 h-5')}
          </div>
          <h3 class="text-base font-bold tracking-tight text-foreground font-khmer">
            មូលហេតុនៃការបោះបង់ <span class="text-xs font-normal text-muted-foreground font-sans">(Inactive Reason)</span>
          </h3>
        </div>
        <button type="button" id="btn-dropout-close" class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer" title="Close">
          ${getIcon('x', 'w-4 h-4')}
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4 text-foreground">
        <!-- Date & Semester Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-border/60">
          <!-- Calendar icon + Date input -->
          <div class="space-y-1.5">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-foreground font-khmer">
              ${getIcon('calendar', 'w-3.5 h-3.5 text-primary')}
              <span>កាលបរិច្ឆេទ (ថ្ងៃនេះ):</span>
            </label>
            <input type="date" 
                   id="input-dropout-date" 
                   value="${defaultDate}" 
                   class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs font-mono font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs" />
          </div>

          <!-- Semester Selector (ឆមាសទី១ / ឆមាសទី២) -->
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-foreground font-khmer">
              ឆមាស <span class="text-destructive">*</span>
            </label>
            <div class="grid grid-cols-2 gap-2 h-10">
              <button type="button" 
                      id="btn-semester-1" 
                      class="semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer ${currentSemester === 'ឆមាសទី១' ? 'border-primary bg-primary text-primary-foreground font-bold' : 'border-input bg-background hover:bg-muted text-foreground'}">
                <span>ឆមាសទី១</span>
              </button>
              <button type="button" 
                      id="btn-semester-2" 
                      class="semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer ${currentSemester === 'ឆមាសទី២' ? 'border-primary bg-primary text-primary-foreground font-bold' : 'border-input bg-background hover:bg-muted text-foreground'}">
                <span>ឆមាសទី២</span>
              </button>
            </div>
            <input type="hidden" id="input-dropout-semester" value="${currentSemester}" />
          </div>
        </div>

        <!-- Main Input: Reason (Required) -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-foreground font-khmer">
            មូលហេតុបោះបង់ការសិក្សា <span class="text-destructive font-bold">*</span>
          </label>
          <textarea id="input-dropout-reason" 
                    rows="3" 
                    placeholder="បញ្ចូលមូលហេតុនៃការបោះបង់ (ឧ. ជីវភាពគ្រួសារ, ផ្លាស់ប្តូរទីលំនៅ, ទៅធ្វើការ...)" 
                    class="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-khmer resize-none box-border shadow-xs leading-relaxed">${currentReason}</textarea>
          <p id="err-dropout-reason" class="text-xs text-destructive font-khmer hidden">សូមបញ្ចូលមូលហេតុនៃការបោះបង់ការសិក្សា</p>
        </div>

        <!-- Secondary Input: Remarks (Optional) -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-muted-foreground font-khmer">
            សម្គាល់ផ្សេងៗ (ប្រសិនបើមាន)
          </label>
          <input type="text" 
                 id="input-dropout-remarks" 
                 value="${currentRemarks}" 
                 placeholder="សម្គាល់ផ្សេងៗ..." 
                 class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-khmer box-border shadow-xs" />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20 select-none">
        <button type="button" 
                id="btn-dropout-cancel" 
                class="px-4 py-2 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors font-khmer shadow-xs cursor-pointer">
          បោះបង់
        </button>
        <button type="button" 
                id="btn-dropout-submit" 
                class="px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground shadow-xs transition-colors font-khmer flex items-center gap-1.5 cursor-pointer">
          ${getIcon('check', 'w-3.5 h-3.5')}
          <span>យល់ព្រម</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const reasonInput = overlay.querySelector('#input-dropout-reason');
  const remarksInput = overlay.querySelector('#input-dropout-remarks');
  const dateInput = overlay.querySelector('#input-dropout-date');
  const semInput = overlay.querySelector('#input-dropout-semester');
  const errReason = overlay.querySelector('#err-dropout-reason');
  const btnSem1 = overlay.querySelector('#btn-semester-1');
  const btnSem2 = overlay.querySelector('#btn-semester-2');

  setTimeout(() => reasonInput?.focus(), 50);

  btnSem1?.addEventListener('click', () => {
    semInput.value = 'ឆមាសទី១';
    btnSem1.className = 'semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs border-primary bg-primary text-primary-foreground font-bold cursor-pointer';
    btnSem2.className = 'semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs border-input bg-background hover:bg-muted text-foreground cursor-pointer';
  });

  btnSem2?.addEventListener('click', () => {
    semInput.value = 'ឆមាសទី២';
    btnSem2.className = 'semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs border-primary bg-primary text-primary-foreground font-bold cursor-pointer';
    btnSem1.className = 'semester-toggle-btn h-full px-2 rounded-md border text-xs font-medium font-khmer transition-all flex items-center justify-center gap-1 shadow-xs border-input bg-background hover:bg-muted text-foreground cursor-pointer';
  });

  // Modal safety: do NOT close on click outside or mouseleave!
  const handleCancel = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };

  overlay.querySelector('#btn-dropout-close')?.addEventListener('click', handleCancel);
  overlay.querySelector('#btn-dropout-cancel')?.addEventListener('click', handleCancel);

  overlay.querySelector('#btn-dropout-submit')?.addEventListener('click', () => {
    const reasonVal = reasonInput?.value.trim();
    if (!reasonVal) {
      errReason?.classList.remove('hidden');
      reasonInput?.focus();
      return;
    }
    errReason?.classList.add('hidden');

    const result = {
      dropoutDate: dateInput?.value || defaultDate,
      dropoutSemester: semInput?.value || 'ឆមាសទី១',
      dropoutReason: reasonVal,
      dropoutRemarks: remarksInput?.value.trim() || ''
    };

    overlay.remove();
    if (onConfirm) onConfirm(result);
  });
}

/**
 * Clean overlay prompt to add a new location item
 */
function openAddLocationPrompt({ title, placeholder, isKm, onAdd }) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in';
  overlay.innerHTML = `
    <div class="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden animate-slide-down">
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-border select-none">
        <h3 class="text-sm font-semibold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">${title}</h3>
        <button id="btn-prompt-close" class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Close">
          ${getIcon('x', 'w-4 h-4')}
        </button>
      </div>
      <div class="p-5 space-y-3">
        <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide ${isKm ? 'font-khmer' : ''}">
          ${isKm ? 'ឈ្មោះទីតាំង' : 'Location Name'}
        </label>
        <input type="text" id="prompt-input" placeholder="${placeholder}" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
        <p id="prompt-error" class="text-[11px] text-destructive hidden"></p>
      </div>
      <div class="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/20">
        <button id="btn-prompt-cancel" type="button" class="px-3.5 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors ${isKm ? 'font-khmer' : ''}">
          ${t('common.cancel')}
        </button>
        <button id="btn-prompt-submit" type="button" class="px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
          ${getIcon('plus', 'w-3.5 h-3.5')}
          <span>${t('locations.add')}</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const input = overlay.querySelector('#prompt-input');
  const errorEl = overlay.querySelector('#prompt-error');
  setTimeout(() => input?.focus(), 50);

  const closePrompt = () => {
    overlay.remove();
  };

  overlay.querySelector('#btn-prompt-close')?.addEventListener('click', closePrompt);
  overlay.querySelector('#btn-prompt-cancel')?.addEventListener('click', closePrompt);

  const handleSubmit = async () => {
    const val = input?.value.trim();
    if (!val) {
      if (errorEl) {
        errorEl.textContent = isKm ? 'សូមបញ្ចូលឈ្មោះទីតាំង' : 'Please enter a location name';
        errorEl.classList.remove('hidden');
      }
      input?.focus();
      return;
    }
    try {
      await onAdd(val);
      closePrompt();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message === 'ALREADY_EXISTS' ? t('locations.alreadyExists') : err.message;
        errorEl.classList.remove('hidden');
      }
    }
  };

  overlay.querySelector('#btn-prompt-submit')?.addEventListener('click', handleSubmit);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      closePrompt();
    }
  });
}

/**
 * Clean overlay confirmation to delete a location item
 */
function openDeleteLocationConfirm({ title, message, isKm, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in';
  overlay.innerHTML = `
    <div class="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden animate-slide-down">
      <div class="flex items-start gap-3 p-5">
        <div class="p-2.5 rounded-full bg-destructive/10 text-destructive flex-shrink-0">
          ${getIcon('trash', 'w-5 h-5')}
        </div>
        <div class="space-y-1">
          <h4 class="text-sm font-semibold text-foreground ${isKm ? 'font-khmer' : ''}">${title}</h4>
          <p class="text-xs text-muted-foreground leading-relaxed ${isKm ? 'font-khmer' : ''}">${message}</p>
        </div>
      </div>
      <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20">
        <button id="btn-del-cancel" type="button" class="px-3.5 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors ${isKm ? 'font-khmer' : ''}">
          ${t('common.cancel')}
        </button>
        <button id="btn-del-confirm" type="button" class="px-4 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
          ${getIcon('trash', 'w-3.5 h-3.5')}
          <span>${t('locations.delete')}</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const closeConfirm = () => overlay.remove();

  overlay.querySelector('#btn-del-cancel')?.addEventListener('click', closeConfirm);
  overlay.querySelector('#btn-del-confirm')?.addEventListener('click', async () => {
    closeConfirm();
    if (onConfirm) await onConfirm();
  });
}

export const StudentsPage = {
  state: {
    search: '',
    status: 'all',
    classId: 'all',
    academicYear: 'all',
    filterField: '',
    filterValue: 'all',
    sortBy: 'lastNameKh',
    sortDir: 'asc',
    page: 1,
    pageSize: 10,
    selectedIds: new Set(),
    classes: [],
    academicYears: [],
    activeYear: '2024–2025'
  },

  async render(container) {
    this.container = container;
    this.state.search = '';
    this.state.status = 'all';
    this.state.classId = 'all';
    this.state.academicYear = 'all';
    this.state.filterField = '';
    this.state.filterValue = 'all';
    this.state.page = 1;
    this.state.selectedIds.clear();

    const [allStudents, classes, academicYears, activeYear] = await Promise.all([
      StudentService.getAll(),
      ClassService.getAll(),
      SettingsService.getAcademicYears().then(r => r || []),
      SettingsService.getActiveAcademicYear()
    ]);

    this.cachedStudents = allStudents || [];
    this.state.classes = classes || [];
    this.state.academicYears = academicYears || [];
    this.state.activeYear = activeYear || '2024–2025';

    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        this.state.classId = teacherClassId;
      }
    }

    this.renderLayout();
    this.populateFilterValuesDropdown();
    await this.loadData();

    // Listen for data refresh events (e.g. Cloud Sync restore) to immediately reload in-place
    if (!this._refreshListenerBound) {
      this._refreshListenerBound = true;
      window.addEventListener('app:refresh-data', async () => {
        this.cachedStudents = await StudentService.getAll();
        if (this.container && document.body.contains(this.container)) {
          this.state.classes = await ClassService.getAll();
          this.state.academicYears = await SettingsService.getAcademicYears() || [];
          await this.loadData();
          this.populateFilterValuesDropdown();
        }
      });
    }

    // Harvest any existing student location values so they are available in dropdowns
    try {
      if (allStudents && allStudents.length > 0) {
        await LocationService.harvestFromStudents(allStudents);
      }
    } catch (_) {}
  },

  renderLayout() {
    const isKm = i18n.getLocale() === 'km';

    this.container.innerHTML = `
      <div class="space-y-5 pb-12">
        <!-- Page Header & Action Buttons -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">${t('students.title')}</h1>
            <p class="text-sm text-muted-foreground mt-1">${t('students.subtitle')}</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Excel Dropdown (Export & Import) -->
            <div class="relative inline-block text-left" id="excel-dropdown-wrapper">
              <button id="btn-excel-dropdown" 
                      type="button" 
                      class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/70 text-xs sm:text-sm font-medium transition-colors shadow-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                ${getIcon('fileSpreadsheet', 'w-4 h-4 text-emerald-600 dark:text-emerald-400')}
                <span>${t('students.excel')}</span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground ml-0.5')}
              </button>
              <div id="excel-dropdown-menu" class="hidden absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-52 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg z-50 p-1 text-xs sm:text-sm animate-in fade-in-0 zoom-in-95">
                <button id="btn-export-excel" type="button" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  ${getIcon('download', 'w-4 h-4 text-emerald-600 dark:text-emerald-400')}
                  <span>${t('students.exportExcel')}</span>
                </button>
                <button id="btn-import-excel" type="button" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  ${getIcon('upload', 'w-4 h-4 text-emerald-600 dark:text-emerald-400')}
                  <span>${t('students.importExcel')}</span>
                </button>
              </div>
            </div>

            <!-- JSON Dropdown (Export & Import) -->
            <div class="relative inline-block text-left" id="json-dropdown-wrapper">
              <button id="btn-json-dropdown" 
                      type="button" 
                      class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/70 text-xs sm:text-sm font-medium transition-colors shadow-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                ${getIcon('fileJson', 'w-4 h-4 text-blue-500')}
                <span>${t('students.json')}</span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground ml-0.5')}
              </button>
              <div id="json-dropdown-menu" class="hidden absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-48 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg z-50 p-1 text-xs sm:text-sm animate-in fade-in-0 zoom-in-95">
                <button id="btn-export-students" type="button" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  ${getIcon('download', 'w-4 h-4 text-blue-500')}
                  <span>${t('students.exportJSON')}</span>
                </button>
                <button id="btn-import-students" type="button" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  ${getIcon('upload', 'w-4 h-4 text-blue-500')}
                  <span>${t('students.importJSON')}</span>
                </button>
              </div>
            </div>
            <!-- Generate Student ID Cards Button -->
            <button id="btn-generate-id-card" 
                    type="button"
                    title="${t('students.generateIdCard')}"
                    class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/70 text-xs sm:text-sm font-semibold transition-colors shadow-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-khmer cursor-pointer">
              ${getIcon('idCard', 'w-4 h-4 text-primary')}
              <span>${t('students.generateIdCard')}</span>
            </button>

            <!-- Add Student Primary Button -->
            <button id="btn-add-student" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors">
              ${getIcon('plus', 'w-4 h-4')}
              <span>${t('students.addStudent')}</span>
            </button>
          </div>
        </div>

        <!-- Persistent Interactive Unassigned Classroom Banner -->
        <div id="unassigned-classroom-banner" class="hidden p-3.5 sm:p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div class="flex items-center gap-2.5 text-amber-700 dark:text-amber-300">
            ${getIcon('alertTriangle', 'w-5 h-5 shrink-0')}
            <div>
              <p class="font-semibold text-xs sm:text-sm" id="unassigned-banner-count-text">
                ${t('students.unassignedBannerText', { count: 0 })}
              </p>
              <p class="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                ${t('students.assignModalDesc')}
              </p>
            </div>
          </div>
          <button type="button" id="btn-banner-assign-classroom" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-sm shrink-0 cursor-pointer">
            ${getIcon('users', 'w-4 h-4')}
            <span>${t('students.btnAssignNow')}</span>
          </button>
        </div>

        <!-- Persistent Interactive Unconfigured Academic Year Alert Banner -->
        <div id="unconfigured-ay-banner" class="hidden p-3.5 sm:p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div class="flex items-center gap-2.5 text-amber-700 dark:text-amber-300">
            ${getIcon('alertTriangle', 'w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400')}
            <div>
              <p class="font-semibold text-xs sm:text-sm" id="unconfigured-ay-count-text">
                ${t('students.unconfiguredAyBannerText', { count: 0, years: '' })}
              </p>
              <p class="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5" id="unconfigured-ay-desc-text">
                ${t('students.unconfiguredAyBannerDesc')}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0 flex-wrap">
            <button type="button" id="btn-banner-apply-unconfigured-ay" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer">
              ${getIcon('check', 'w-3.5 h-3.5')}
              <span>${t('students.applyAllAcademicYears')}</span>
            </button>
            <button type="button" id="btn-banner-filter-unconfigured-ay" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 border border-amber-500/30 font-semibold text-xs transition-colors cursor-pointer">
              ${getIcon('filter', 'w-3.5 h-3.5')}
              <span>${t('students.filterUnconfiguredAyBtn')}</span>
            </button>
            <a href="#settings" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input bg-card hover:bg-muted text-foreground font-semibold text-xs transition-colors shadow-xs shrink-0 cursor-pointer">
              ${getIcon('settings', 'w-3.5 h-3.5')}
              <span>${isKm ? 'ការកំណត់' : 'Settings'}</span>
            </a>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="p-3 sm:p-4 rounded-xl border border-border bg-card shadow-sm flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 w-full box-border">
          <!-- Left: Search & Two-Step Drill-Down Filter -->
          <div class="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <!-- Search Bar -->
            <div class="relative w-full sm:w-auto sm:min-w-[150px] sm:max-w-[210px] flex-1">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                ${getIcon('search', 'w-4 h-4')}
              </span>
              <input type="text" 
                     id="student-search-input" 
                     value="${this.state.search}"
                     placeholder="${t('students.searchPlaceholder')}"
                     class="w-full h-10 pl-9 pr-3 py-2 bg-background border border-input rounded-md text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs transition-all leading-relaxed" />
            </div>

            <!-- Two-Step Drill-down Filter Group -->
            <div class="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
              <!-- 1. Filter By Field Dropdown -->
              <div class="relative flex-1 sm:flex-initial min-w-[125px] sm:w-36">
                <select id="select-filter-field" 
                        class="w-full h-10 px-2.5 py-2 pr-7 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs leading-relaxed truncate">
                  <option value="">${t('students.filterSelectField')}</option>
                  <option value="academicYear" ${this.state.filterField === 'academicYear' ? 'selected' : ''}>${t('students.filterFieldStudyYear')}</option>
                  <option value="classId" ${this.state.filterField === 'classId' ? 'selected' : ''}>${t('students.filterFieldClass')}</option>
                  <option value="gender" ${this.state.filterField === 'gender' ? 'selected' : ''}>${t('students.filterFieldGender')}</option>
                  <option value="village" ${this.state.filterField === 'village' ? 'selected' : ''}>${t('students.filterFieldVillage')}</option>
                  <option value="commune" ${this.state.filterField === 'commune' ? 'selected' : ''}>${t('students.filterFieldCommune')}</option>
                  <option value="district" ${this.state.filterField === 'district' ? 'selected' : ''}>${t('students.filterFieldDistrict')}</option>
                  <option value="province" ${this.state.filterField === 'province' ? 'selected' : ''}>${t('students.filterFieldProvince')}</option>
                </select>
              </div>

              <!-- 2. Select Specific Value Dropdown -->
              <div class="relative flex-1 sm:flex-initial min-w-[130px] sm:w-40">
                <select id="select-filter-value" 
                        ${!this.state.filterField ? 'disabled' : ''}
                        class="w-full h-10 px-2.5 py-2 pr-7 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed truncate">
                  <option value="all">${t('students.filterSelectValue')}</option>
                </select>
              </div>

              <!-- Clear Drilldown Filter Button -->
              <button id="btn-clear-drilldown-filter" 
                      type="button" 
                      title="${t('students.filterClear')}"
                      class="${!this.state.filterField ? 'hidden' : ''} h-10 px-2 sm:px-2.5 rounded-md border border-border bg-card hover:bg-muted text-xs font-normal text-muted-foreground hover:text-foreground transition-colors shadow-xs flex items-center gap-1 shrink-0 cursor-pointer select-none">
                ${getIcon('x', 'w-3.5 h-3.5')}
                <span class="hidden sm:inline font-normal">${t('students.filterClear')}</span>
              </button>
            </div>
          </div>

          <!-- Right: Inactive Students & Bulk Import Photos Button & Hidden Folder Input -->
          <div class="flex items-center gap-2 shrink-0">
            <!-- Inactive Students Report Button (Part 2.1) -->
            <button type="button" 
                    id="btn-inactive-students-report"
                    title="${isKm ? 'បញ្ជីឈ្មោះសិស្សបោះបង់' : 'Inactive Student Report'}"
                    class="h-10 px-3 sm:px-3.5 rounded-md border border-input bg-card hover:bg-muted text-xs sm:text-sm font-normal text-foreground transition-colors shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
              ${getIcon('graduationCap', 'w-4 h-4 text-amber-600 dark:text-amber-400')}
              <span class="font-khmer font-normal">${isKm ? 'សិស្សបោះបង់' : 'Inactive Students'}</span>
            </button>

            <!-- Monthly Score Sheet / Student List Button -->
            <button type="button" 
                    id="btn-monthly-score-sheet"
                    title="${isKm ? 'តារាងស្រង់ពិន្ទុប្រចាំខែ' : 'Monthly Score Sheet'}"
                    class="h-10 px-3 sm:px-3.5 rounded-md border border-input bg-card hover:bg-muted text-xs sm:text-sm font-normal text-foreground transition-colors shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
              ${getIcon('clipboardList', 'w-4 h-4 text-blue-600 dark:text-blue-400')}
              <span class="font-khmer font-normal">${isKm ? 'តារាងស្រង់ពិន្ទុ' : 'Score Sheet'}</span>
            </button>

            <button type="button" 
                    id="btn-bulk-import-photos"
                    title="${t('students.bulkImportPhotosTooltip')}"
                    class="h-10 px-3.5 rounded-md border border-input bg-card hover:bg-muted text-xs sm:text-sm font-normal text-foreground transition-colors shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
              ${getIcon('folderImage', 'w-4 h-4 text-primary')}
              <span class="font-khmer font-normal">${t('students.bulkImportPhotos')}</span>
            </button>
            <input type="file" 
                   id="input-bulk-photo-folder" 
                   webkitdirectory="" 
                   directory="" 
                   multiple 
                   accept="image/*" 
                   class="hidden" />
          </div>
        </div>

        <!-- Bulk Action Floating Bar (shown when rows are selected) -->
        <div id="bulk-actions-bar" class="hidden p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between gap-4 animate-fade-in">
          <div class="flex items-center gap-2 text-xs font-semibold text-primary">
            ${getIcon('check', 'w-4 h-4')}
            <span id="selected-count-label">0 students selected</span>
          </div>
          <div class="flex items-center gap-2">
            <!-- Change Status -->
            <select id="bulk-status-select" class="h-8 px-2.5 py-1 pr-7 rounded-md bg-background border border-input text-xs text-foreground box-border shadow-xs">
              <option value="">${t('students.bulkChangeStatus')}...</option>
              <option value="Active">${t('common.active')}</option>
              <option value="Inactive">${t('common.inactive')}</option>
              <option value="Transferred">${t('common.transferred')}</option>
              <option value="Graduated">${t('common.graduated')}</option>
            </select>

            <!-- Generate Selected ID Cards -->
            <button id="btn-bulk-id-cards" type="button" class="px-3 py-1 rounded bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors flex items-center gap-1.5 font-khmer cursor-pointer">
              ${getIcon('idCard', 'w-3.5 h-3.5')}
              <span>${t('students.generateIdCard')}</span>
            </button>

            ${authService.can('students.delete') ? `
              <button id="btn-bulk-delete" class="px-3 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium transition-colors">
                ${t('students.bulkDelete')}
              </button>
            ` : ''}
            <button id="btn-clear-selection" class="px-2.5 py-1 rounded border border-border bg-card hover:bg-muted text-xs text-muted-foreground transition-colors">
              ${t('common.cancel')}
            </button>
          </div>
        </div>

        <!-- Student Data Table Card -->
        <div class="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div class="overflow-x-auto max-w-full">
            <table class="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr class="border-b border-border bg-muted/50 text-muted-foreground font-semibold select-none">
                  <th class="w-10 px-3 py-3 text-center">
                    <input type="checkbox" id="select-all-checkbox" class="rounded border-input text-primary focus:ring-primary h-4 w-4" />
                  </th>
                  <!-- 1. ស្ថានភាព -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="status">
                    <div class="flex items-center gap-1">
                      <span>${t('students.status')}</span>
                      <span class="sort-icon">${this.getSortIcon('status')}</span>
                    </div>
                  </th>
                  <!-- 2. ល.រ -->
                  <th class="px-3 py-3 text-center">
                    <span>${t('students.rowNumber')}</span>
                  </th>
                  <!-- 3. រូបថតសិស្ស -->
                  <th class="px-3 py-3 text-center">
                    <span>${t('students.photo')}</span>
                  </th>
                  <!-- 4. អត្តលេខ -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="studentId">
                    <div class="flex items-center gap-1">
                      <span>${t('students.studentId')}</span>
                      <span class="sort-icon">${this.getSortIcon('studentId')}</span>
                    </div>
                  </th>
                  <!-- 5. ត្រកូលនាម -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="lastNameKh">
                    <div class="flex items-center gap-1">
                      <span>${t('students.lastNameKh')}</span>
                      <span class="sort-icon">${this.getSortIcon('lastNameKh')}</span>
                    </div>
                  </th>
                  <!-- 6. ខ្លួនត្រកូល -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="firstNameKh">
                    <div class="flex items-center gap-1">
                      <span>${t('students.firstNameKh')}</span>
                      <span class="sort-icon">${this.getSortIcon('firstNameKh')}</span>
                    </div>
                  </th>
                  <!-- 7. ឡាតាំងនាម -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="lastNameLatin">
                    <div class="flex items-center gap-1">
                      <span>${t('students.lastNameLatin')}</span>
                      <span class="sort-icon">${this.getSortIcon('lastNameLatin')}</span>
                    </div>
                  </th>
                  <!-- 8. ខ្លួនឡាតាំង -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="firstNameLatin">
                    <div class="flex items-center gap-1">
                      <span>${t('students.firstNameLatin')}</span>
                      <span class="sort-icon">${this.getSortIcon('firstNameLatin')}</span>
                    </div>
                  </th>
                  <!-- 9. ភេទ -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="gender">
                    <div class="flex items-center gap-1">
                      <span>${t('students.gender')}</span>
                      <span class="sort-icon">${this.getSortIcon('gender')}</span>
                    </div>
                  </th>
                  <!-- 10. ថ្ងៃខែឆ្នាំកំណើត -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="dateOfBirth">
                    <div class="flex items-center gap-1">
                      <span>${t('students.dob')}</span>
                      <span class="sort-icon">${this.getSortIcon('dateOfBirth')}</span>
                    </div>
                  </th>
                  <!-- 11. ភូមិកំណើត -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="birthVillage">
                    <div class="flex items-center gap-1">
                      <span>${t('students.birthVillage')}</span>
                      <span class="sort-icon">${this.getSortIcon('birthVillage')}</span>
                    </div>
                  </th>
                  <!-- 12. ឃុំកំណើត -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="birthCommune">
                    <div class="flex items-center gap-1">
                      <span>${t('students.birthCommune')}</span>
                      <span class="sort-icon">${this.getSortIcon('birthCommune')}</span>
                    </div>
                  </th>
                  <!-- 13. ស្រុកកំណើត -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="birthDistrict">
                    <div class="flex items-center gap-1">
                      <span>${t('students.birthDistrict')}</span>
                      <span class="sort-icon">${this.getSortIcon('birthDistrict')}</span>
                    </div>
                  </th>
                  <!-- 14. ខេត្តកំណើត -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="birthProvince">
                    <div class="flex items-center gap-1">
                      <span>${t('students.birthProvince')}</span>
                      <span class="sort-icon">${this.getSortIcon('birthProvince')}</span>
                    </div>
                  </th>
                  <!-- 15. ភូមិបច្ចុប្បន្ន -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="currentVillage">
                    <div class="flex items-center gap-1">
                      <span>${t('students.currentVillage')}</span>
                      <span class="sort-icon">${this.getSortIcon('currentVillage')}</span>
                    </div>
                  </th>
                  <!-- 16. ឃុំបច្ចុប្បន្ន -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="currentCommune">
                    <div class="flex items-center gap-1">
                      <span>${t('students.currentCommune')}</span>
                      <span class="sort-icon">${this.getSortIcon('currentCommune')}</span>
                    </div>
                  </th>
                  <!-- 17. ស្រុកបច្ចុប្បន្ន -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="currentDistrict">
                    <div class="flex items-center gap-1">
                      <span>${t('students.currentDistrict')}</span>
                      <span class="sort-icon">${this.getSortIcon('currentDistrict')}</span>
                    </div>
                  </th>
                  <!-- 18. ខេត្តបច្ចុប្បន្ន -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="currentProvince">
                    <div class="flex items-center gap-1">
                      <span>${t('students.currentProvince')}</span>
                      <span class="sort-icon">${this.getSortIcon('currentProvince')}</span>
                    </div>
                  </th>
                  <!-- 19. ឆ្នាំសិក្សា -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="academicYear">
                    <div class="flex items-center gap-1">
                      <span>${t('students.academicYear')}</span>
                      <span class="sort-icon">${this.getSortIcon('academicYear')}</span>
                    </div>
                  </th>
                  <!-- 20. សាលាចាស់ -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="lastYearSchool">
                    <div class="flex items-center gap-1">
                      <span>${t('students.lastYearSchool')}</span>
                      <span class="sort-icon">${this.getSortIcon('lastYearSchool')}</span>
                    </div>
                  </th>
                  <!-- 21. សាលារៀន -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="school">
                    <div class="flex items-center gap-1">
                      <span>${t('students.school')}</span>
                      <span class="sort-icon">${this.getSortIcon('school')}</span>
                    </div>
                  </th>
                  <!-- 22. ថ្នាក់លេខ -->
                  <th class="px-3 py-3 cursor-pointer hover:text-foreground transition-colors" data-sort="classId">
                    <div class="flex items-center gap-1">
                      <span>${t('students.classId')}</span>
                      <span class="sort-icon">${this.getSortIcon('classId')}</span>
                    </div>
                  </th>
                  <!-- 23. ទូរសព្ទសិស្ស -->
                  <th class="px-3 py-3">${t('students.studentPhone')}</th>
                  <!-- 24. ឈ្មោះឪពុក -->
                  <th class="px-3 py-3">${t('students.fatherName')}</th>
                  <!-- 25. មុខរបរ -->
                  <th class="px-3 py-3">${t('students.fatherOccupation')}</th>
                  <!-- 26. លេខទូរសព្ទ -->
                  <th class="px-3 py-3">${t('students.fatherPhone')}</th>
                  <!-- 27. ឈ្មោះម្តាយ -->
                  <th class="px-3 py-3">${t('students.motherName')}</th>
                  <!-- 28. មុខរបរ -->
                  <th class="px-3 py-3">${t('students.motherOccupation')}</th>
                  <!-- 29. លេខទូរសព្ទ -->
                  <th class="px-3 py-3">${t('students.motherPhone')}</th>
                  <!-- 30. ផ្សេងៗ -->
                  <th class="px-3 py-3">${t('students.notes')}</th>
                  <!-- Actions (sticky right) -->
                  <th class="w-[50px] px-2 py-3 text-center sticky right-0 bg-muted z-30">${t('common.actions')}</th>
                </tr>
              </thead>
              <tbody id="student-table-body" class="divide-y divide-border">
                <tr>
                  <td colspan="32" class="py-12 text-center text-muted-foreground">
                    <div class="flex items-center justify-center gap-2">
                      <div class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                      <span>${t('common.loading')}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Footer -->
          <div id="pagination-footer" class="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground select-none">
            <div id="pagination-info">Showing records...</div>
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                <span>${t('students.rowsPerPage')}</span>
                <select id="select-page-size" class="h-8 px-2 py-1 pr-6 rounded-md border border-input bg-card text-foreground box-border shadow-xs">
                  <option value="10" ${this.state.pageSize === 10 ? 'selected' : ''}>10</option>
                  <option value="25" ${this.state.pageSize === 25 ? 'selected' : ''}>25</option>
                  <option value="50" ${this.state.pageSize === 50 ? 'selected' : ''}>50</option>
                </select>
              </div>
              <div id="pagination-nav-buttons" class="flex items-center gap-1"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindStaticEvents();
  },

  getUniqueValuesForField(students, fieldKey) {
    if (!students || !fieldKey) return [];
    const classMap = new Map(this.state.classes.map(c => [c.id, c.name]));
    const set = new Set();

    if (fieldKey === 'village') {
      students.forEach(s => {
        if (s.currentVillage?.trim()) set.add(s.currentVillage.trim());
        if (s.birthVillage?.trim()) set.add(s.birthVillage.trim());
      });
    } else if (fieldKey === 'commune') {
      students.forEach(s => {
        if (s.currentCommune?.trim()) set.add(s.currentCommune.trim());
        if (s.birthCommune?.trim()) set.add(s.birthCommune.trim());
      });
    } else if (fieldKey === 'district') {
      students.forEach(s => {
        if (s.currentDistrict?.trim()) set.add(s.currentDistrict.trim());
        if (s.birthDistrict?.trim()) set.add(s.birthDistrict.trim());
      });
    } else if (fieldKey === 'province') {
      students.forEach(s => {
        if (s.currentProvince?.trim()) set.add(s.currentProvince.trim());
        if (s.birthProvince?.trim()) set.add(s.birthProvince.trim());
      });
    } else if (fieldKey === 'gender') {
      students.forEach(s => {
        if (s.gender?.trim()) set.add(s.gender.trim());
      });
    } else if (fieldKey === 'classId') {
      students.forEach(s => {
        if (s.classId?.trim()) set.add(s.classId.trim());
      });
    } else {
      students.forEach(s => {
        const val = s[fieldKey];
        if (val && typeof val === 'string' && val.trim() !== '') {
          set.add(val.trim());
        }
      });
    }

    const items = Array.from(set).map(val => {
      let label = val;
      if (fieldKey === 'classId') {
        label = classMap.get(val) || val;
      } else if (fieldKey === 'gender') {
        if (val.toLowerCase() === 'female' || val === 'ស្រី') label = t('common.female');
        else if (val.toLowerCase() === 'male' || val === 'ប្រុស') label = t('common.male');
      }
      return { value: val, label };
    });

    return items.sort((a, b) =>
      a.label.localeCompare(b.label, ['km', 'en'], { numeric: true, sensitivity: 'base' })
    );
  },

  populateFilterValuesDropdown() {
    const valueSelect = document.getElementById('select-filter-value');
    const clearBtn = document.getElementById('btn-clear-drilldown-filter');
    if (!valueSelect) return;

    if (!this.state.filterField) {
      valueSelect.disabled = true;
      valueSelect.innerHTML = `<option value="all">${t('students.filterSelectValue')}</option>`;
      clearBtn?.classList.add('hidden');
      return;
    }

    valueSelect.disabled = false;
    clearBtn?.classList.remove('hidden');

    const uniqueOptions = this.getUniqueValuesForField(this.cachedStudents || [], this.state.filterField);

    let html = `<option value="all">${t('students.filterAllValues')} (${uniqueOptions.length})</option>`;
    uniqueOptions.forEach(opt => {
      const isSelected = this.state.filterValue === opt.value;
      html += `<option value="${opt.value}" ${isSelected ? 'selected' : ''}>${opt.label}</option>`;
    });

    valueSelect.innerHTML = html;
  },

  getSortIcon(col) {
    if (this.state.sortBy !== col) {
      return `<span class="opacity-30 inline-flex">${getIcon('arrowUpDown', 'w-3 h-3')}</span>`;
    }
    return this.state.sortDir === 'asc'
      ? `<span class="text-primary font-bold inline-flex">${getIcon('arrowUp', 'w-3 h-3')}</span>`
      : `<span class="text-primary font-bold inline-flex">${getIcon('arrowDown', 'w-3 h-3')}</span>`;
  },

  updateSortUI() {
    // 1. Sync toolbar dropdown
    const selectSort = document.getElementById('select-sort-by');
    if (selectSort && selectSort.value !== this.state.sortBy) {
      selectSort.value = this.state.sortBy;
    }

    // 2. Sync toolbar direction button
    const btnDir = document.getElementById('btn-toggle-sort-dir');
    if (btnDir) {
      btnDir.title = this.state.sortDir === 'asc' ? t('students.sortAsc') : t('students.sortDesc');
      btnDir.innerHTML = this.state.sortDir === 'asc'
        ? getIcon('arrowUp', 'w-4 h-4 text-primary')
        : getIcon('arrowDown', 'w-4 h-4 text-primary');
    }

    // 3. Sync table header indicators
    this.container?.querySelectorAll('th[data-sort]').forEach(th => {
      const col = th.getAttribute('data-sort');
      const iconSpan = th.querySelector('.sort-icon');
      if (iconSpan) {
        iconSpan.innerHTML = this.getSortIcon(col);
      }
    });
  },

  async loadData(forceRefresh = false) {
    if (!this.cachedStudents || forceRefresh) {
      this.cachedStudents = await StudentService.getAll();
    }

    let items = [...this.cachedStudents];

    // 1. Search Filter across all 29 fields
    if (this.state.search && this.state.search.trim()) {
      const q = this.state.search.trim().toLowerCase();
      items = items.filter(s => {
        return (
          (s.studentId && s.studentId.toLowerCase().includes(q)) ||
          (s.lastNameKh && s.lastNameKh.toLowerCase().includes(q)) ||
          (s.firstNameKh && s.firstNameKh.toLowerCase().includes(q)) ||
          (s.lastNameLatin && s.lastNameLatin.toLowerCase().includes(q)) ||
          (s.firstNameLatin && s.firstNameLatin.toLowerCase().includes(q)) ||
          (s.khmerName && s.khmerName.toLowerCase().includes(q)) ||
          (s.englishName && s.englishName.toLowerCase().includes(q)) ||
          (s.gender && s.gender.toLowerCase() === q) ||
          (s.classId && s.classId.toLowerCase().includes(q)) ||
          (s.academicYear && s.academicYear.toLowerCase().includes(q)) ||
          (s.lastYearSchool && s.lastYearSchool.toLowerCase().includes(q)) ||
          (s.school && s.school.toLowerCase().includes(q)) ||
          (s.studentPhone && s.studentPhone.includes(q)) ||
          (s.fatherName && s.fatherName.toLowerCase().includes(q)) ||
          (s.fatherPhone && s.fatherPhone.includes(q)) ||
          (s.motherName && s.motherName.toLowerCase().includes(q)) ||
          (s.motherPhone && s.motherPhone.includes(q)) ||
          (s.birthVillage && s.birthVillage.toLowerCase().includes(q)) ||
          (s.birthCommune && s.birthCommune.toLowerCase().includes(q)) ||
          (s.birthDistrict && s.birthDistrict.toLowerCase().includes(q)) ||
          (s.birthProvince && s.birthProvince.toLowerCase().includes(q)) ||
          (s.currentVillage && s.currentVillage.toLowerCase().includes(q)) ||
          (s.currentCommune && s.currentCommune.toLowerCase().includes(q)) ||
          (s.currentDistrict && s.currentDistrict.toLowerCase().includes(q)) ||
          (s.currentProvince && s.currentProvince.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q))
        );
      });
    }

    // 2. Status Filter
    if (this.state.status && this.state.status !== 'all') {
      const targetStatus = this.state.status.trim().toLowerCase();
      items = items.filter(s => {
        if (!s.status) return false;
        if (targetStatus === 'inactive') {
          const st = s.status.trim().toLowerCase();
          return st === 'inactive' || st === 'dropout' || s.status === 'អសកម្ម' || s.status === 'បោះបង់' || s.status === 'បោះបង់ការសិក្សា';
        }
        return s.status.trim().toLowerCase() === targetStatus;
      });
    }

    // 3. Class Filter
    if (this.state.classId && this.state.classId !== 'all') {
      items = items.filter(s => String(s.classId || '').trim() === String(this.state.classId).trim());
    }

    // 4. Academic Year Filter
    if (this.state.academicYear && this.state.academicYear !== 'all') {
      const normDash = y => String(y || '').replace(/[–—−]/g, '-').trim().toLowerCase();
      items = items.filter(s => normDash(s.academicYear) === normDash(this.state.academicYear));
    }

    // 5. Two-step drill-down filter (Village, Commune, District, Province, Gender, Class, Academic Year)
    if (this.state.filterField && this.state.filterValue && this.state.filterValue !== 'all') {
      const field = this.state.filterField;
      const targetVal = this.state.filterValue.trim().toLowerCase();

      items = items.filter(s => {
        if (field === 'village') {
          return (s.currentVillage && s.currentVillage.trim().toLowerCase() === targetVal) ||
                 (s.birthVillage && s.birthVillage.trim().toLowerCase() === targetVal);
        }
        if (field === 'commune') {
          return (s.currentCommune && s.currentCommune.trim().toLowerCase() === targetVal) ||
                 (s.birthCommune && s.birthCommune.trim().toLowerCase() === targetVal);
        }
        if (field === 'district') {
          return (s.currentDistrict && s.currentDistrict.trim().toLowerCase() === targetVal) ||
                 (s.birthDistrict && s.birthDistrict.trim().toLowerCase() === targetVal);
        }
        if (field === 'province') {
          return (s.currentProvince && s.currentProvince.trim().toLowerCase() === targetVal) ||
                 (s.birthProvince && s.birthProvince.trim().toLowerCase() === targetVal);
        }
        if (field === 'gender') {
          return s.gender && s.gender.trim().toLowerCase() === targetVal;
        }
        if (field === 'classId') {
          return s.classId && s.classId.trim() === this.state.filterValue.trim();
        }
        if (field === 'academicYear') {
          return s.academicYear && s.academicYear.trim().toLowerCase() === targetVal;
        }
        return s[field] && String(s[field]).trim().toLowerCase() === targetVal;
      });
    }

    // 5. In-Memory Sorting (Ascending A-Z always on Khmer last name lastNameKh, with multi-field tie-breaking)
    const classMap = new Map(this.state.classes.map(c => [c.id, c.name]));
    const sortField = this.state.sortBy || 'lastNameKh';
    const sortDir = this.state.sortDir || 'asc';

    items.sort((a, b) => {
      // Primary Sort: If a specific column other than lastNameKh is selected
      if (sortField !== 'lastNameKh' && sortField !== 'none') {
        let valA = a[sortField] ?? '';
        let valB = b[sortField] ?? '';

        if (sortField === 'classId') {
          valA = classMap.get(valA) || valA;
          valB = classMap.get(valB) || valB;
        }

        valA = String(valA);
        valB = String(valB);

        const comp = valA.localeCompare(valB, ['km', 'en'], { numeric: true, sensitivity: 'base' });
        if (comp !== 0) {
          return sortDir === 'asc' ? comp : -comp;
        }
      }

      // Secondary / Default Sort: ALWAYS Ascending A-Z on Khmer last name (lastNameKh)
      const lastA = String(a.lastNameKh || '');
      const lastB = String(b.lastNameKh || '');
      const lastComp = lastA.localeCompare(lastB, ['km', 'en'], { numeric: true, sensitivity: 'base' });

      if (sortField === 'lastNameKh') {
        if (lastComp !== 0) return sortDir === 'asc' ? lastComp : -lastComp;
      } else if (lastComp !== 0) {
        return lastComp; // Always ascending on Khmer last name
      }

      // Tertiary Sort: Khmer first name (firstNameKh) ascending
      const firstA = String(a.firstNameKh || '');
      const firstB = String(b.firstNameKh || '');
      const firstComp = firstA.localeCompare(firstB, ['km', 'en'], { numeric: true, sensitivity: 'base' });
      if (firstComp !== 0) return firstComp;

      // Quaternary tie-breaker: Student ID
      return String(a.studentId || '').localeCompare(String(b.studentId || ''), ['km', 'en'], { numeric: true, sensitivity: 'base' });
    });

    // 6. Pagination
    const totalRecords = items.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / this.state.pageSize));
    const validPage = Math.min(Math.max(1, this.state.page), totalPages);
    this.state.page = validPage;
    const startIdx = (validPage - 1) * this.state.pageSize;
    const pagedItems = items.slice(startIdx, startIdx + this.state.pageSize);

    // 7. Render view
    this.renderTableRows(pagedItems);
    this.renderPagination({
      total: totalRecords,
      page: validPage,
      pageSize: this.state.pageSize,
      totalPages
    });
    this.updateBulkBar();
    this.updateSortUI();
    this.updateUnassignedBanner();
    this.updateUnconfiguredAyBanner();
  },

  updateUnassignedBanner() {
    const banner = document.getElementById('unassigned-classroom-banner');
    if (!banner) return;
    if (authService.isTeacher()) {
      banner.classList.add('hidden');
      return;
    }

    const unassigned = (this.cachedStudents || []).filter(s => !s.classId || String(s.classId).trim() === '');
    if (unassigned.length > 0) {
      banner.classList.remove('hidden');
      const textEl = document.getElementById('unassigned-banner-count-text');
      if (textEl) {
        textEl.textContent = t('students.unassignedBannerText', { count: unassigned.length });
      }
      const btn = document.getElementById('btn-banner-assign-classroom');
      if (btn) {
        btn.onclick = () => this.openAssignClassroomModal(unassigned);
      }
    } else {
      banner.classList.add('hidden');
    }
  },

  updateUnconfiguredAyBanner() {
    const banner = document.getElementById('unconfigured-ay-banner');
    if (!banner) return;

    const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
    const configuredSet = new Set((this.state.academicYears || []).map(y => normDash(typeof y === 'string' ? y : y.name)));

    const unconfiguredStudents = (this.cachedStudents || []).filter(s => {
      const ay = String(s.academicYear || '').trim();
      return ay !== '' && !configuredSet.has(normDash(ay));
    });

    if (unconfiguredStudents.length > 0) {
      banner.classList.remove('hidden');
      const uniqueYears = Array.from(new Set(unconfiguredStudents.map(s => String(s.academicYear).trim())));
      const yearsText = uniqueYears.join(', ');

      const countTextEl = document.getElementById('unconfigured-ay-count-text');
      if (countTextEl) {
        countTextEl.textContent = t('students.unconfiguredAyBannerText', { count: unconfiguredStudents.length, years: yearsText });
      }

      const descTextEl = document.getElementById('unconfigured-ay-desc-text');
      if (descTextEl) {
        descTextEl.textContent = t('students.unconfiguredAyBannerDesc');
      }

      const applyBtn = document.getElementById('btn-banner-apply-unconfigured-ay');
      if (applyBtn) {
        applyBtn.onclick = async () => {
          applyBtn.disabled = true;
          applyBtn.innerHTML = `<div class="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></div> <span>...</span>`;
          const isKm = i18n.getLocale() === 'km';
          try {
            for (const yr of uniqueYears) {
              const created = await SettingsService.createAcademicYear({ name: yr });
              const toUpdate = unconfiguredStudents.filter(s => normDash(s.academicYear) === normDash(yr));
              for (const s of toUpdate) {
                await StudentService.update(s.id, { academicYear: created.name });
              }
            }
            toast.success(isKm 
              ? `បានបង្កើតឆ្នាំសិក្សា និងអនុវត្តជូនសិស្សចំនួន ${unconfiguredStudents.length} នាក់ដោយជោគជ័យ!`
              : `Successfully added academic years to Settings and applied to ${unconfiguredStudents.length} students!`);
            window.dispatchEvent(new CustomEvent('app:refresh-data'));
            await this.loadData(true);
          } catch (err) {
            toast.error(err.message || 'Failed to apply academic years');
            applyBtn.disabled = false;
          }
        };
      }

      const filterBtn = document.getElementById('btn-banner-filter-unconfigured-ay');
      if (filterBtn) {
        filterBtn.onclick = () => {
          this.state.filterField = 'academicYear';
          this.state.filterValue = uniqueYears[0] || 'all';
          this.populateFilterValuesDropdown();
          const selectField = document.getElementById('select-filter-field');
          if (selectField) selectField.value = 'academicYear';
          const selectVal = document.getElementById('select-filter-value');
          if (selectVal) selectVal.value = this.state.filterValue;
          this.state.page = 1;
          this.loadData();
        };
      }
    } else {
      banner.classList.add('hidden');
    }
  },

  renderTableRows(students) {
    const tbody = document.getElementById('student-table-body');
    if (!tbody) return;

    if (!students || students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="32" class="py-12 text-center text-muted-foreground">
            <div class="max-w-xs mx-auto space-y-2">
              <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                ${getIcon('search', 'w-5 h-5')}
              </div>
              <p class="text-xs font-medium">${t('students.emptyList')}</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const classMap = new Map(this.state.classes.map(c => [c.id, c.name]));
    const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
    const configuredSet = new Set((this.state.academicYears || []).map(y => normDash(typeof y === 'string' ? y : y.name)));
    const isKm = i18n.getLocale() === 'km';

    tbody.innerHTML = students.map((student, index) => {
      const isChecked = this.state.selectedIds.has(student.id);
      const className = classMap.get(student.classId) || student.classId || '—';
      const rowNumber = (this.state.page - 1) * this.state.pageSize + index + 1;
      const studentAy = String(student.academicYear || '').trim();
      const isAyUnconfigured = studentAy !== '' && !configuredSet.has(normDash(studentAy));

      // Status pill styling
      let statusBadgeClasses = 'bg-muted text-muted-foreground';
      if (student.status === 'Active') {
        statusBadgeClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      } else if (student.status === 'Inactive') {
        statusBadgeClasses = 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20';
      } else if (student.status === 'Transferred') {
        statusBadgeClasses = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      } else if (student.status === 'Graduated') {
        statusBadgeClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      }

      // Gender representation
      const genderLabel = student.gender === 'Female' ? t('common.female') : t('common.male');
      const photoUrl = student.photoBlob ? photoService.getUrlForBlob(student.photoBlob) : null;
      const initialLetter = student.firstNameLatin ? student.firstNameLatin.charAt(0).toUpperCase() : (student.firstNameKh ? student.firstNameKh.charAt(0) : 'S');

      return `
        <tr class="hover:bg-muted/40 transition-colors ${isChecked ? 'bg-primary/5' : ''}" data-student-id="${student.id}">
          <!-- 0. Checkbox -->
          <td class="px-3 py-2.5 text-center">
            <input type="checkbox" 
                   class="row-select-checkbox rounded border-input text-primary focus:ring-primary h-4 w-4" 
                   data-id="${student.id}" 
                   ${isChecked ? 'checked' : ''} />
          </td>

          <!-- 1. ស្ថានភាព (status) -->
          <td class="px-3 py-2.5">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClasses}">
              ${student.status || 'Active'}
            </span>
          </td>

          <!-- 2. ល.រ (rowNumber) -->
          <td class="px-3 py-2.5 text-center font-mono text-muted-foreground font-medium">
            ${rowNumber}
          </td>

          <!-- 3. រូបថតសិស្ស (photo) -->
          <td class="px-3 py-2.5 text-center">
            <div class="w-8 h-8 rounded-full overflow-hidden mx-auto flex-shrink-0 bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs border border-border">
              ${photoUrl 
                ? `<img src="${photoUrl}" alt="${student.firstNameLatin || ''}" class="w-full h-full object-cover" />` 
                : initialLetter}
            </div>
          </td>

          <!-- 4. អត្តលេខ (studentId) -->
          <td class="px-3 py-2.5 font-mono font-semibold text-foreground">
            ${student.studentId || '—'}
          </td>

          <!-- 5. ត្រកូលនាម (lastNameKh) -->
          <td class="px-3 py-2.5 font-khmer text-foreground">
            ${student.lastNameKh || '—'}
          </td>

          <!-- 6. ខ្លួនត្រកូល (firstNameKh) -->
          <td class="px-3 py-2.5 font-khmer font-medium text-foreground">
            ${student.firstNameKh || '—'}
          </td>

          <!-- 7. ឡាតាំងនាម (lastNameLatin) -->
          <td class="px-3 py-2.5 text-foreground">
            ${student.lastNameLatin || '—'}
          </td>

          <!-- 8. ខ្លួនឡាតាំង (firstNameLatin) -->
          <td class="px-3 py-2.5 font-medium text-foreground">
            ${student.firstNameLatin || '—'}
          </td>

          <!-- 9. ភេទ (gender) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-muted">
              ${genderLabel}
            </span>
          </td>

          <!-- 10. ថ្ងៃខែឆ្នាំកំណើត (dob) -->
          <td class="px-3 py-2.5 font-mono text-muted-foreground">
            ${formatDisplayDate(student.dateOfBirth) || '—'}
          </td>

          <!-- 11. ភូមិកំណើត (birthVillage) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.birthVillage || '—'}
          </td>

          <!-- 12. ឃុំកំណើត (birthCommune) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.birthCommune || '—'}
          </td>

          <!-- 13. ស្រុកកំណើត (birthDistrict) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.birthDistrict || '—'}
          </td>

          <!-- 14. ខេត្តកំណើត (birthProvince) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.birthProvince || '—'}
          </td>

          <!-- 15. ភូមិបច្ចុប្បន្ន (currentVillage) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.currentVillage || '—'}
          </td>

          <!-- 16. ឃុំបច្ចុប្បន្ន (currentCommune) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.currentCommune || '—'}
          </td>

          <!-- 17. ស្រុកបច្ចុប្បន្ន (currentDistrict) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.currentDistrict || '—'}
          </td>

          <!-- 18. ខេត្តបច្ចុប្បន្ន (currentProvince) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.currentProvince || '—'}
          </td>

          <!-- 19. ឆ្នាំសិក្សា (academicYear) -->
          <td class="px-3 py-2.5">
            ${isAyUnconfigured ? `
              <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 select-none" title="${t('students.notInSettingsTooltip')}">
                ${getIcon('alertTriangle', 'w-3 h-3 text-amber-500 shrink-0')}
                <span class="font-mono font-medium text-xs">${studentAy}</span>
                <span class="text-[10px] opacity-80 font-khmer">(${t('students.notInSettingsTag')})</span>
              </div>
            ` : `
              <span class="font-mono text-muted-foreground">${studentAy || '—'}</span>
            `}
          </td>

          <!-- 20. សាលាចាស់ (lastYearSchool) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.lastYearSchool || '—'}
          </td>

          <!-- 21. សាលារៀន (school) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.school || '—'}
          </td>

          <!-- 21. ថ្នាក់លេខ (classId) -->
          <td class="px-3 py-2.5 text-foreground font-medium">
            ${className}
          </td>

          <!-- 22. ទូរសព្ទសិស្ស (studentPhone) -->
          <td class="px-3 py-2.5 font-mono text-muted-foreground">
            ${student.studentPhone || student.phone || '—'}
          </td>

          <!-- 23. ឈ្មោះឪពុក (fatherName) -->
          <td class="px-3 py-2.5 text-foreground">
            ${student.fatherName || '—'}
          </td>

          <!-- 24. មុខរបរ (fatherOccupation) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.fatherOccupation || '—'}
          </td>

          <!-- 25. លេខទូរសព្ទ (fatherPhone) -->
          <td class="px-3 py-2.5 font-mono text-muted-foreground">
            ${student.fatherPhone || student.parentPhone || '—'}
          </td>

          <!-- 26. ឈ្មោះម្តាយ (motherName) -->
          <td class="px-3 py-2.5 text-foreground">
            ${student.motherName || '—'}
          </td>

          <!-- 27. មុខរបរ (motherOccupation) -->
          <td class="px-3 py-2.5 text-muted-foreground">
            ${student.motherOccupation || '—'}
          </td>

          <!-- 28. លេខទូរសព្ទ (motherPhone) -->
          <td class="px-3 py-2.5 font-mono text-muted-foreground">
            ${student.motherPhone || '—'}
          </td>

          <!-- 29. ផ្សេងៗ (notes) -->
          <td class="px-3 py-2.5 text-muted-foreground max-w-xs truncate" title="${student.notes || ''}">
            ${student.notes || '—'}
          </td>

          <!-- Actions (sticky right) -->
          <td class="w-[50px] px-2 py-2 text-center sticky right-0 bg-card/95 backdrop-blur z-10">
            ${renderActionDropdown({
              id: student.id,
              title: isKm ? 'ជម្រើសសកម្មភាព' : 'Actions',
              actions: [
                {
                  label: isKm ? 'កាតសិស្ស' : 'ID Card',
                  icon: 'idCard',
                  onClick: async () => {
                    let s = (this.cachedStudents || []).find(st => st.id === student.id) || await StudentService.getById(student.id);
                    if (s) IDCardStudioModal.open([s], this.state.classes || []);
                  }
                },
                {
                  label: isKm ? 'ព័ត៌មានលម្អិត' : 'View Profile',
                  icon: 'user',
                  onClick: async () => {
                    const s = await StudentService.getById(student.id);
                    if (s) this.openStudentProfileModal(s);
                  }
                },
                {
                  label: isKm ? 'កែប្រែ' : 'Edit',
                  icon: 'pencil',
                  onClick: async () => {
                    const s = await StudentService.getById(student.id);
                    if (s) this.openStudentFormModal(s);
                  }
                },
                {
                  label: isKm ? 'លុប' : 'Delete',
                  icon: 'trash2',
                  destructive: true,
                  show: authService.can('students.delete'),
                  onClick: async () => {
                    const s = await StudentService.getById(student.id);
                    if (!s) return;
                    Modal.confirm({
                      title: t('common.delete'),
                      message: t('students.confirmDelete', { name: `${s.khmerName || ''} (${s.englishName || ''})` }),
                      destructive: true,
                      onConfirm: async () => {
                        await StudentService.delete(student.id);
                        this.state.selectedIds.delete(student.id);
                        toast.success(t('students.deletedSuccess'));
                        await this.loadData();
                      }
                    });
                  }
                }
              ]
            })}
          </td>
        </tr>
      `;
    }).join('');

    this.bindTableEvents();
  },

  renderPagination({ total, page, pageSize, totalPages }) {
    const infoEl = document.getElementById('pagination-info');
    const navEl = document.getElementById('pagination-nav-buttons');
    if (!infoEl || !navEl) return;

    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    infoEl.textContent = t('students.paginationInfo', { start, end, total });

    let buttonsHtml = `
      <button id="btn-page-prev" class="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors" ${page <= 1 ? 'disabled' : ''}>
        ${getIcon('chevronLeft', 'w-3.5 h-3.5')}
      </button>
    `;

    // Page pills
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages <= 7 || p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
        const isCurrent = p === page;
        buttonsHtml += `
          <button class="btn-page-num px-2.5 py-1 rounded text-xs font-medium transition-colors ${isCurrent ? 'bg-primary text-primary-foreground font-bold' : 'border border-border bg-card hover:bg-muted text-foreground'}" data-page="${p}">
            ${p}
          </button>
        `;
      } else if (p === page - 2 || p === page + 2) {
        buttonsHtml += `<span class="px-1 text-muted-foreground">...</span>`;
      }
    }

    buttonsHtml += `
      <button id="btn-page-next" class="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors" ${page >= totalPages ? 'disabled' : ''}>
        ${getIcon('chevronRight', 'w-3.5 h-3.5')}
      </button>
    `;

    navEl.innerHTML = buttonsHtml;

    document.getElementById('btn-page-prev')?.addEventListener('click', () => {
      if (this.state.page > 1) {
        this.state.page--;
        this.loadData();
      }
    });

    document.getElementById('btn-page-next')?.addEventListener('click', () => {
      if (this.state.page < totalPages) {
        this.state.page++;
        this.loadData();
      }
    });

    navEl.querySelectorAll('.btn-page-num').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.page = parseInt(btn.getAttribute('data-page'));
        this.loadData();
      });
    });
  },

  bindStaticEvents() {
    // Search (debounced)
    let searchTimeout = null;
    const searchInput = document.getElementById('student-search-input');
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.state.search = e.target.value;
        this.state.page = 1;
        this.loadData();
      }, 250);
    });

    // Two-step Drill-down Filter: Field Dropdown
    document.getElementById('select-filter-field')?.addEventListener('change', (e) => {
      this.state.filterField = e.target.value;
      this.state.filterValue = 'all';
      this.state.page = 1;
      this.populateFilterValuesDropdown();
      this.loadData();
    });

    // Two-step Drill-down Filter: Value Dropdown
    document.getElementById('select-filter-value')?.addEventListener('change', (e) => {
      this.state.filterValue = e.target.value;
      this.state.page = 1;
      this.loadData();
    });

    // Two-step Drill-down Filter: Clear Button
    document.getElementById('btn-clear-drilldown-filter')?.addEventListener('click', () => {
      this.state.filterField = '';
      this.state.filterValue = 'all';
      this.state.page = 1;
      const fieldSelect = document.getElementById('select-filter-field');
      if (fieldSelect) fieldSelect.value = '';
      this.populateFilterValuesDropdown();
      this.loadData();
    });

    // Class filter
    document.getElementById('filter-class')?.addEventListener('change', (e) => {
      this.state.classId = e.target.value;
      this.state.page = 1;
      this.loadData();
    });

    // Status filter
    document.getElementById('filter-status')?.addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.loadData();
    });

    // Page size
    document.getElementById('select-page-size')?.addEventListener('change', (e) => {
      this.state.pageSize = parseInt(e.target.value);
      this.state.page = 1;
      this.loadData();
    });

    // Toolbar Sort By dropdown (Method B)
    document.getElementById('select-sort-by')?.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.state.page = 1;
      this.loadData();
    });

    // Toolbar Sort Direction toggle button
    document.getElementById('btn-toggle-sort-dir')?.addEventListener('click', () => {
      this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
      this.loadData();
    });

    // Clickable Table Headers (Method A: 3-state cycle Asc -> Desc -> Clear)
    this.container.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (this.state.sortBy === col) {
          if (this.state.sortDir === 'asc') {
            this.state.sortDir = 'desc';
          } else if (this.state.sortDir === 'desc') {
            // Cycle to Clear Sort (defaults to lastNameKh asc)
            this.state.sortBy = 'lastNameKh';
            this.state.sortDir = 'asc';
          }
        } else {
          this.state.sortBy = col;
          this.state.sortDir = 'asc';
        }
        this.loadData();
      });
    });

    // Select all
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    selectAllCheckbox?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const checkboxes = this.container.querySelectorAll('.row-select-checkbox');
      checkboxes.forEach(cb => {
        const id = cb.getAttribute('data-id');
        if (isChecked) this.state.selectedIds.add(id);
        else this.state.selectedIds.delete(id);
        cb.checked = isChecked;
      });
      this.updateBulkBar();
    });

    // Generate Student ID Cards Studio button
    document.getElementById('btn-generate-id-card')?.addEventListener('click', () => {
      this.openIDCardStudio();
    });

    // Bulk ID Cards button
    document.getElementById('btn-bulk-id-cards')?.addEventListener('click', () => {
      this.openIDCardStudio();
    });

    // Add Student button
    document.getElementById('btn-add-student')?.addEventListener('click', () => {
      this.openStudentFormModal();
    });

    // Inactive Students Report button
    document.getElementById('btn-inactive-students-report')?.addEventListener('click', () => {
      this.openInactiveStudentsReportModal();
    });

    // Monthly Score Sheet / Student List button
    document.getElementById('btn-monthly-score-sheet')?.addEventListener('click', () => {
      this.openMonthlyScoreSheetModal();
    });

    // Excel Dropdown Toggle
    const excelBtn = document.getElementById('btn-excel-dropdown');
    const excelMenu = document.getElementById('excel-dropdown-menu');
    excelBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      excelMenu?.classList.toggle('hidden');
      document.getElementById('json-dropdown-menu')?.classList.add('hidden');
    });

    // JSON Dropdown Toggle
    const jsonBtn = document.getElementById('btn-json-dropdown');
    const jsonMenu = document.getElementById('json-dropdown-menu');
    jsonBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      jsonMenu?.classList.toggle('hidden');
      document.getElementById('excel-dropdown-menu')?.classList.add('hidden');
    });

    // Close dropdowns when clicking option buttons
    excelMenu?.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        excelMenu.classList.add('hidden');
      });
    });
    jsonMenu?.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        jsonMenu.classList.add('hidden');
      });
    });

    // Close dropdowns on outside click or Escape key
    document.addEventListener('click', () => {
      excelMenu?.classList.add('hidden');
      jsonMenu?.classList.add('hidden');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        excelMenu?.classList.add('hidden');
        jsonMenu?.classList.add('hidden');
      }
    });

    // Export to Excel (.xlsx)
    const exportBtn = document.getElementById('btn-export-excel');
    exportBtn?.addEventListener('click', async () => {
      const isKm = i18n.getLocale() === 'km';
      const originalHtml = exportBtn.innerHTML;

      try {
        // 1. Get students based on current filters / roles
        const result = await StudentService.query({
          search: this.state.search,
          classId: this.state.classId,
          academicYear: this.state.academicYear,
          status: this.state.status,
          sortBy: this.state.sortBy,
          sortDir: this.state.sortDir,
          page: 1,
          pageSize: 100000 // Get all matching rows
        });

        let studentsToExport = result.data || [];

        // Apply drill-down filter if active
        if (this.state.filterField && this.state.filterValue && this.state.filterValue !== 'all') {
          const field = this.state.filterField;
          const targetVal = this.state.filterValue.trim().toLowerCase();
          studentsToExport = studentsToExport.filter(s => {
            if (field === 'village') {
              return (s.currentVillage && s.currentVillage.trim().toLowerCase() === targetVal) ||
                     (s.birthVillage && s.birthVillage.trim().toLowerCase() === targetVal);
            }
            if (field === 'commune') {
              return (s.currentCommune && s.currentCommune.trim().toLowerCase() === targetVal) ||
                     (s.birthCommune && s.birthCommune.trim().toLowerCase() === targetVal);
            }
            if (field === 'district') {
              return (s.currentDistrict && s.currentDistrict.trim().toLowerCase() === targetVal) ||
                     (s.birthDistrict && s.birthDistrict.trim().toLowerCase() === targetVal);
            }
            if (field === 'province') {
              return (s.currentProvince && s.currentProvince.trim().toLowerCase() === targetVal) ||
                     (s.birthProvince && s.birthProvince.trim().toLowerCase() === targetVal);
            }
            if (field === 'gender') {
              return s.gender && s.gender.trim().toLowerCase() === targetVal;
            }
            if (field === 'classId') {
              return s.classId && s.classId.trim() === this.state.filterValue.trim();
            }
            if (field === 'academicYear') {
              return s.academicYear && s.academicYear.trim().toLowerCase() === targetVal;
            }
            return s[field] && String(s[field]).trim().toLowerCase() === targetVal;
          });
        }

        // Check if dataset is empty
        if (!studentsToExport || studentsToExport.length === 0) {
          toast.warning(isKm ? 'មិនមានទិន្នន័យសម្រាប់នាំចេញទេ' : 'No data to export');
          return;
        }

        // Show button loading state
        exportBtn.disabled = true;
        exportBtn.innerHTML = `
          <div class="w-4 h-4 rounded-full border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent animate-spin shrink-0"></div>
          <span>${isKm ? 'កំពុងរៀបចំឯកសារ Excel...' : 'Preparing Excel file...'}</span>
        `;

        // Extract active filter attributes for dynamic naming
        let activeClassName = '';
        if (this.state.classId && this.state.classId !== 'all') {
          const cls = this.state.classes?.find(c => c.id === this.state.classId);
          activeClassName = cls ? cls.name : this.state.classId;
        } else if (this.state.filterField === 'classId' && this.state.filterValue && this.state.filterValue !== 'all') {
          const cls = this.state.classes?.find(c => c.id === this.state.filterValue);
          activeClassName = cls ? cls.name : this.state.filterValue;
        }

        let activeAcademicYear = '';
        if (this.state.academicYear && this.state.academicYear !== 'all') {
          activeAcademicYear = this.state.academicYear;
        } else if (this.state.filterField === 'academicYear' && this.state.filterValue && this.state.filterValue !== 'all') {
          activeAcademicYear = this.state.filterValue;
        }

        let activeGrade = '';
        if (this.state.filterField === 'grade' && this.state.filterValue && this.state.filterValue !== 'all') {
          activeGrade = this.state.filterValue;
        }

        const activeFilters = {
          className: activeClassName,
          classId: this.state.classId !== 'all' ? this.state.classId : '',
          academicYear: activeAcademicYear,
          grade: activeGrade
        };

        const { filename } = await StudentExcelService.exportStudentsToExcel(studentsToExport, {
          activeFilters,
          classLabel: activeClassName,
          academicYear: activeAcademicYear,
          grade: activeGrade,
          lang: isKm ? 'km' : 'en'
        });

        toast.success(isKm 
          ? `បានទាញយកឯកសារ ${filename} ដោយជោគជ័យ!` 
          : `Successfully downloaded ${filename}!`);
      } catch (err) {
        console.error('Excel Export Error:', err);
        toast.error(err.message || (isKm ? 'បរាជ័យក្នុងការនាំចេញជា Excel' : 'Export to Excel failed.'));
      } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalHtml;
      }
    });

    // Bulk Import Photos from Folder Trigger
    const bulkPhotoInput = document.getElementById('input-bulk-photo-folder');
    document.getElementById('btn-bulk-import-photos')?.addEventListener('click', () => {
      bulkPhotoInput?.click();
    });

    bulkPhotoInput?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      await this.handleBulkPhotoFolder(files);
      bulkPhotoInput.value = '';
    });

    // Import from Excel (.xlsx) Modal Trigger
    document.getElementById('btn-import-excel')?.addEventListener('click', () => {
      this.openExcelImportModal();
    });

    // JSON Backup Export
    document.getElementById('btn-export-students')?.addEventListener('click', async () => {
      try {
        const json = await StudentService.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `SchoolManagement_Students_Backup_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t('students.exportSuccess'));
      } catch (err) {
        toast.error(err.message, 'Export Error');
      }
    });

    // Import Students
    const importInput = document.getElementById('file-import-input');
    document.getElementById('btn-import-students')?.addEventListener('click', () => {
      importInput?.click();
    });

    importInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const result = await StudentService.importJSON(text);
        await this.loadData(true);
        this.showImportSummaryModal(result);
      } catch (err) {
        console.error('JSON import error:', err);
        toast.error(t('students.importError') || err.message);
      }
      importInput.value = '';
    });

    // Bulk actions
    document.getElementById('btn-clear-selection')?.addEventListener('click', () => {
      this.state.selectedIds.clear();
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      this.loadData();
    });

    document.getElementById('btn-bulk-delete')?.addEventListener('click', () => {
      const count = this.state.selectedIds.size;
      if (count === 0) return;

      Modal.confirm({
        title: t('students.bulkDelete'),
        message: t('students.confirmBulkDelete', { count }),
        destructive: true,
        onConfirm: async () => {
          await StudentService.bulkDelete(Array.from(this.state.selectedIds));
          this.state.selectedIds.clear();
          if (selectAllCheckbox) selectAllCheckbox.checked = false;
          toast.success(t('students.bulkDeleteSuccess', { count }));
          await this.loadData(true);
        }
      });
    });

    document.getElementById('bulk-status-select')?.addEventListener('change', async (e) => {
      const status = e.target.value;
      if (!status) return;
      const ids = Array.from(this.state.selectedIds);
      await StudentService.bulkUpdateStatus(ids, status);
      toast.success(`Updated status of ${ids.length} students to ${status}`);
      e.target.value = '';
      await this.loadData(true);
    });
  },

  bindTableEvents() {
    // Individual row checkbox selection
    this.container.querySelectorAll('.row-select-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = cb.getAttribute('data-id');
        if (e.target.checked) this.state.selectedIds.add(id);
        else this.state.selectedIds.delete(id);
        this.updateBulkBar();
      });
    });

    // Print Student Card (Single Row)
    this.container.querySelectorAll('.btn-print-student-card').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        let student = (this.cachedStudents || []).find(s => s.id === id);
        if (!student) {
          student = await StudentService.getById(id);
        }
        if (student) {
          IDCardStudioModal.open([student], this.state.classes || []);
        }
      });
    });

    // View Profile
    this.container.querySelectorAll('.btn-view-profile').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const student = await StudentService.getById(id);
        if (student) this.openStudentProfileModal(student);
      });
    });

    // Edit Student
    this.container.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const student = await StudentService.getById(id);
        if (student) this.openStudentFormModal(student);
      });
    });

    // Delete Student
    this.container.querySelectorAll('.btn-delete-student').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const student = await StudentService.getById(id);
        if (!student) return;

        Modal.confirm({
          title: t('common.delete'),
          message: t('students.confirmDelete', { name: `${student.khmerName || ''} (${student.englishName || ''})` }),
          destructive: true,
          onConfirm: async () => {
            await StudentService.delete(id);
            this.state.selectedIds.delete(id);
            toast.success(t('students.deletedSuccess'));
            await this.loadData();
          }
        });
      });
    });
  },

  updateBulkBar() {
    const bulkBar = document.getElementById('bulk-actions-bar');
    const countLabel = document.getElementById('selected-count-label');
    const count = this.state.selectedIds.size;

    if (!bulkBar) return;

    if (count > 0) {
      bulkBar.classList.remove('hidden');
      if (countLabel) countLabel.textContent = t('students.selectedCount', { count });
    } else {
      bulkBar.classList.add('hidden');
    }
  },

  /**
   * Open Add or Edit Student Modal with unified vertical scrolling sectional layout containing all 29 fields
   */
  async openStudentFormModal(existingStudent = null) {
    await StudentFormModal.open({
      mode: 'STUDENT_MANAGEMENT',
      student: existingStudent,
      onSave: async (data, modal) => {
        const isEdit = !!existingStudent;
        if (isEdit) {
          await StudentService.update(existingStudent.id, data);
          toast.success(t('students.updatedSuccess'));
        } else {
          await StudentService.create(data);
          toast.success(t('students.savedSuccess'));
        }
        modal.close();
        await this.loadData(true);
        this.populateFilterValuesDropdown();
      }
    });
  },

  /**
   * Open Student Profile View Modal displaying all 29 fields organized into sections A-H
   */
  openStudentProfileModal(student) {
    const isKm = i18n.getLocale() === 'km';
    const classObj = this.state.classes.find(c => c.id === student.classId);
    const className = classObj ? classObj.name : student.classId || '—';
    const photoUrl = student.photoBlob ? photoService.getUrlForBlob(student.photoBlob) : null;
    const genderLabel = student.gender === 'Female' ? t('common.female') : t('common.male');
    const initialLetter = student.firstNameLatin ? student.firstNameLatin.charAt(0).toUpperCase() : (student.firstNameKh ? student.firstNameKh.charAt(0) : 'S');
    const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
    const configuredSet = new Set((this.state.academicYears || []).map(y => normDash(typeof y === 'string' ? y : y.name)));
    const studentAy = String(student.academicYear || '').trim();
    const isAyUnconfigured = studentAy !== '' && !configuredSet.has(normDash(studentAy));

    // Status styling
    let statusBadgeClasses = 'bg-muted text-muted-foreground';
    if (student.status === 'Active') {
      statusBadgeClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    } else if (student.status === 'Inactive') {
      statusBadgeClasses = 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20';
    } else if (student.status === 'Transferred') {
      statusBadgeClasses = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
    } else if (student.status === 'Graduated') {
      statusBadgeClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
    }

    const profileContent = `
      <div class="space-y-5 text-xs" id="printable-student-profile">
        <!-- Identity Card Header -->
        <div class="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
          <div class="w-20 h-20 rounded-xl overflow-hidden border-2 border-primary/20 bg-card flex items-center justify-center font-bold text-2xl text-primary shadow-sm flex-shrink-0">
            ${photoUrl 
              ? `<img src="${photoUrl}" class="w-full h-full object-cover" />` 
              : initialLetter}
          </div>
          <div class="space-y-1 text-center sm:text-left flex-1 min-w-0">
            <div class="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary text-primary-foreground">${student.studentId}</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClasses}">${student.status === 'Active' ? t('common.active') : student.status === 'Inactive' ? t('common.inactive') : student.status === 'Transferred' ? t('common.transferred') : student.status === 'Graduated' ? t('common.graduated') : (student.status || 'Active')}</span>
              ${isAyUnconfigured 
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-medium" title="${t('students.notInSettingsTooltip')}">${getIcon('alertTriangle', 'w-3 h-3 text-amber-500')}${student.academicYear} (${t('students.notInSettingsTag')})</span>` 
                : `<span class="px-2 py-0.5 rounded text-xs bg-muted font-medium text-muted-foreground">${student.academicYear || ''}</span>`}
              <span class="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-semibold">${className}</span>
            </div>
            <h3 class="text-base sm:text-lg font-bold font-khmer text-foreground truncate mt-1">
              ${student.lastNameKh || ''} ${student.firstNameKh || ''}
            </h3>
            <p class="text-xs font-medium text-muted-foreground truncate">
              ${student.lastNameLatin || ''} ${student.firstNameLatin || ''}
            </p>
            ${student.school ? `<p class="text-[11px] text-muted-foreground">${student.school}</p>` : ''}
          </div>
        </div>

        ${student.status === 'Inactive' ? `
          <!-- Dropout Information Card -->
          <div class="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2 select-none">
            <div class="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-xs sm:text-sm">
              ${getIcon('graduationCap', 'w-4 h-4')}
              <span class="font-khmer">${isKm ? 'ព័ត៌មាននៃការបោះបង់ការសិក្សា' : 'Dropout Information'}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div><span class="text-muted-foreground font-khmer">កាលបរិច្ឆេទបោះបង់៖</span> <strong class="font-mono text-foreground">${formatDisplayDate(student.dropoutDate) || '—'}</strong></div>
              <div><span class="text-muted-foreground font-khmer">ឆមាស៖</span> <strong class="font-khmer text-foreground">${student.dropoutSemester || 'ឆមាសទី១'}</strong></div>
              <div class="sm:col-span-2"><span class="text-muted-foreground font-khmer">មូលហេតុបោះបង់៖</span> <span class="font-medium text-foreground font-khmer">${student.dropoutReason || '—'}</span></div>
              ${student.dropoutRemarks ? `<div class="sm:col-span-2"><span class="text-muted-foreground font-khmer">សម្គាល់ផ្សេងៗ៖</span> <span class="text-foreground font-khmer">${student.dropoutRemarks}</span></div>` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Details Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Section A: Student Information -->
          <div class="p-3.5 rounded-lg border border-border bg-card space-y-2">
            <h5 class="font-semibold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
              <span>${isKm ? 'ផ្នែក A ៖ ' : 'Section A: '}${t('students.secStudentInfo')}</span>
            </h5>
            <div class="space-y-1.5 pt-1 divide-y divide-border/40">
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.studentId')}:</span> <span class="font-mono font-bold text-foreground">${student.studentId}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.lastNameKh')}:</span> <span class="font-khmer text-foreground">${student.lastNameKh || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.firstNameKh')}:</span> <span class="font-khmer font-medium text-foreground">${student.firstNameKh || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.lastNameLatin')}:</span> <span class="text-foreground">${student.lastNameLatin || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.firstNameLatin')}:</span> <span class="text-foreground">${student.firstNameLatin || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.gender')}:</span> <span class="text-foreground ${isKm ? 'font-khmer' : ''}">${genderLabel}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.dob')}:</span> <span class="font-mono text-foreground">${formatDisplayDate(student.dateOfBirth) || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.age')}:</span> <span class="font-mono text-foreground">${student.age || (student.dateOfBirth ? calculateAge(student.dateOfBirth) : '—')}${student.age || student.dateOfBirth ? (isKm ? ' ឆ្នាំ' : ' years') : ''}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.status')}:</span> <span class="font-medium text-foreground ${isKm ? 'font-khmer' : ''}">${student.status === 'Active' ? t('common.active') : student.status === 'Inactive' ? t('common.inactive') : student.status === 'Transferred' ? t('common.transferred') : student.status === 'Graduated' ? t('common.graduated') : (student.status || 'Active')}</span></div>
            </div>
          </div>

          <!-- Section D & E: Academic Information & Contact -->
          <div class="p-3.5 rounded-lg border border-border bg-card space-y-2">
            <h5 class="font-semibold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
              <span>${isKm ? 'ផ្នែក D & E ៖ ' : 'Section D & E: '}${t('students.secAcademicInfo')} & ${isKm ? 'ទំនាក់ទំនង' : 'Contact'}</span>
            </h5>
            <div class="space-y-1.5 pt-1 divide-y divide-border/40">
              <div class="flex justify-between py-0.5 items-center">
                <span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.academicYear')}:</span> 
                <span class="font-mono text-foreground flex items-center gap-1.5">
                  ${student.academicYear || '—'}
                  ${isAyUnconfigured ? `<span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">${getIcon('alertTriangle', 'w-3 h-3 text-amber-500')}${t('students.notInSettingsTag')}</span>` : ''}
                </span>
              </div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.lastYearSchool')}:</span> <span class="text-foreground">${student.lastYearSchool || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.school')}:</span> <span class="text-foreground">${student.school || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.classId')}:</span> <span class="font-medium text-foreground">${className}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.studentPhone')}:</span> <span class="font-mono text-foreground">${student.studentPhone || student.phone || '—'}</span></div>
            </div>

            <h5 class="font-semibold text-primary uppercase tracking-wider text-[11px] pt-3 flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
              <span>${isKm ? 'ផ្នែក H ៖ ' : 'Section H: '}${t('students.secOtherNotes')}</span>
            </h5>
            <div class="pt-1">
              <p class="text-muted-foreground bg-muted/40 p-2.5 rounded-md text-[11px] leading-relaxed ${isKm ? 'font-khmer' : ''}">
                ${student.notes || (isKm ? 'គ្មានកំណត់សម្គាល់បន្ថែម' : 'No additional notes recorded.')}
              </p>
            </div>
          </div>

          <!-- Section B: Place of Birth -->
          <div class="p-3.5 rounded-lg border border-border bg-card space-y-2">
            <h5 class="font-semibold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
              <span>${isKm ? 'ផ្នែក B ៖ ' : 'Section B: '}${t('students.secBirthPlace')}</span>
            </h5>
            <div class="space-y-1.5 pt-1 divide-y divide-border/40">
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.birthVillage')}:</span> <span class="text-foreground">${student.birthVillage || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.birthCommune')}:</span> <span class="text-foreground">${student.birthCommune || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.birthDistrict')}:</span> <span class="text-foreground">${student.birthDistrict || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.birthProvince')}:</span> <span class="text-foreground">${student.birthProvince || '—'}</span></div>
            </div>
          </div>

          <!-- Section C: Current Residence -->
          <div class="p-3.5 rounded-lg border border-border bg-card space-y-2">
            <h5 class="font-semibold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
              <span>${isKm ? 'ផ្នែក C ៖ ' : 'Section C: '}${t('students.secCurrentResidence')}</span>
            </h5>
            <div class="space-y-1.5 pt-1 divide-y divide-border/40">
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.currentVillage')}:</span> <span class="text-foreground">${student.currentVillage || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.currentCommune')}:</span> <span class="text-foreground">${student.currentCommune || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.currentDistrict')}:</span> <span class="text-foreground">${student.currentDistrict || '—'}</span></div>
              <div class="flex justify-between py-0.5"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.currentProvince')}:</span> <span class="text-foreground">${student.currentProvince || '—'}</span></div>
            </div>
          </div>

          <!-- Section F & G: Father and Mother Information -->
          <div class="sm:col-span-2 p-3.5 rounded-lg border border-border bg-card space-y-2">
            <h5 class="font-semibold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
              <span>${isKm ? 'ផ្នែក F & G ៖ ' : 'Section F & G: '}${t('students.secFatherInfo')} & ${t('students.secMotherInfo')}</span>
            </h5>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <!-- Father -->
              <div class="p-2.5 rounded-md bg-muted/30 border border-border/60 space-y-1">
                <span class="text-[11px] font-bold text-foreground block mb-1 ${isKm ? 'font-khmer' : ''}">${t('students.secFatherInfo')}</span>
                <div class="flex justify-between"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.fatherName')}:</span> <span class="font-medium text-foreground">${student.fatherName || '—'}</span></div>
                <div class="flex justify-between"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.fatherOccupation')}:</span> <span class="text-foreground">${student.fatherOccupation || '—'}</span></div>
                <div class="flex justify-between"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.fatherPhone')}:</span> <span class="font-mono text-foreground">${student.fatherPhone || student.parentPhone || '—'}</span></div>
              </div>

              <!-- Mother -->
              <div class="p-2.5 rounded-md bg-muted/30 border border-border/60 space-y-1">
                <span class="text-[11px] font-bold text-foreground block mb-1 ${isKm ? 'font-khmer' : ''}">${t('students.secMotherInfo')}</span>
                <div class="flex justify-between"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.motherName')}:</span> <span class="font-medium text-foreground">${student.motherName || '—'}</span></div>
                <div class="flex justify-between"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.motherOccupation')}:</span> <span class="text-foreground">${student.motherOccupation || '—'}</span></div>
                <div class="flex justify-between"><span class="text-muted-foreground ${isKm ? 'font-khmer' : ''}">${t('students.motherPhone')}:</span> <span class="font-mono text-foreground">${student.motherPhone || '—'}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <button id="btn-profile-print-id-card" class="px-4 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${isKm ? 'font-khmer' : ''}">
        ${getIcon('idCard', 'w-4 h-4')}
        <span>${isKm ? 'បង្កើតកាតសិស្ស' : 'Print ID Card'}</span>
      </button>
      <button onclick="window.print()" class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs sm:text-sm font-medium transition-colors ${isKm ? 'font-khmer' : ''}">
        ${getIcon('download', 'w-3.5 h-3.5 inline mr-1')}
        ${isKm ? 'បោះពុម្ពប័ណ្ណសិស្ស' : 'Print Profile'}
      </button>
      <button class="btn-close-profile px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm font-medium transition-colors ${isKm ? 'font-khmer' : ''}">
        ${isKm ? 'បិទ' : 'Close'}
      </button>
    `;

    const modal = Modal.open({
      title: t('students.studentProfile'),
      content: profileContent,
      footer,
      maxWidth: 'max-w-3xl'
    });

    modal.element.querySelector('#btn-profile-print-id-card')?.addEventListener('click', () => {
      IDCardStudioModal.open([student], this.state.classes || []);
    });

    modal.element.querySelector('.btn-close-profile')?.addEventListener('click', () => modal.close());
  },

  /**
   * Open MoEYS Official Inactive Student Report Modal (បញ្ជីឈ្មោះសិស្សបោះបង់)
   * Matches exact Ministry of Education layout with filtering, statistics calculations,
   * percentages, A4 landscape printing, and Excel export.
   */
  async openInactiveStudentsReportModal() {
    const isKm = i18n.getLocale() === 'km';
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();

    let classes = [];
    try {
      classes = await ClassService.getAll();
    } catch (_) {}
    if (!classes || classes.length === 0) {
      classes = this.state.classes || [];
    }
    let academicYears = [];
    try {
      academicYears = await SettingsService.getAcademicYears() || [];
    } catch (_) {}
    const activeYear = await SettingsService.getActiveAcademicYear() || this.state.activeYear || '2024–2025';

    let allSchools = [];
    let allProvinces = [];
    let schoolName = '';
    let schoolProvince = 'រាជធានីភ្នំពេញ';

    const cleanProvinceName = (prov) => {
      if (!prov) return '';
      return String(prov).replace(/\s*\([^)]*\)/g, '').trim();
    };

    const getDisplayProvince = (prov) => {
      const clean = cleanProvinceName(prov);
      if (!clean) return '';
      if (clean.startsWith('រាជធានី') || clean.startsWith('ខេត្ត')) {
        return clean;
      }
      if (clean === 'ភ្នំពេញ') {
        return 'រាជធានីភ្នំពេញ';
      }
      return `ខេត្ត ${clean}`;
    };

    const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);

    try {
      // 1. Fetch only from 'schools' table
      allSchools = await SchoolService.getAllSchools();
      
      // 2. Fetch provinces from LocationService
      allProvinces = await LocationService.getItems('provinces');
      if (!allProvinces || allProvinces.length === 0) {
        const locData = await LocationService.getAll();
        allProvinces = locData.provinces || [];
      }
    } catch (_) {}

    // Dropdown strictly gets school name values only from the schools table
    const schoolOptions = Array.from(new Set((allSchools || []).map(s => s.name?.trim()).filter(Boolean)));

    // Resolve active school selection strictly from the school table records
    try {
      const savedSchool = await SettingsService.get('moeys_report_school_name');
      if (savedSchool && schoolOptions.includes(savedSchool)) {
        schoolName = savedSchool;
      } else if (schoolOptions.length > 0) {
        schoolName = schoolOptions[0];
      }
    } catch (_) {
      schoolName = schoolOptions[0] || '';
    }

    // Resolve province
    try {
      const savedProvince = await SettingsService.get('moeys_report_province');
      if (savedProvince) {
        schoolProvince = savedProvince;
      } else {
        const matchedSchool = allSchools.find(s => s.name?.trim() === schoolName);
        if (matchedSchool && matchedSchool.address) {
          schoolProvince = matchedSchool.address.split(',').pop().trim();
        } else if (allProvinces && allProvinces.length > 0) {
          schoolProvince = allProvinces[0];
        }
      }
    } catch (_) {}

    if (schoolProvince && !allProvinces.some(p => p.trim().toLowerCase() === schoolProvince.trim().toLowerCase())) {
      allProvinces.unshift(schoolProvince.trim());
    }

    // Helper to get student display name reliably
    const getStudentDisplayName = (s) => {
      if (!s) return '—';
      const khName = (s.khmerName || `${s.lastNameKh || ''} ${s.firstNameKh || ''}`).trim();
      if (khName) return khName;
      const enName = (s.englishName || `${s.lastNameLatin || ''} ${s.firstNameLatin || ''}`).trim();
      if (enName) return enName;
      return s.name || s.fullName || s['ឈ្មោះ'] || s['ឈ្មោះសិស្ស'] || s['គោត្តនាម និងនាម'] || '—';
    };

    // Helper to check if student has inactive/dropout status
    const isStudentInactive = (s) => {
      if (!s) return false;
      const st = String(s.status || '').trim().toLowerCase();
      if (st === 'inactive' || st === 'dropout' || st === 'dropped' || st === 'left') return true;
      const rawStatus = String(s.status || '').trim();
      if (rawStatus.includes('អសកម្ម') || rawStatus.includes('បោះបង់') || rawStatus.includes('ឈប់រៀន') || rawStatus.includes('ផ្អាក')) return true;
      if (s.dropoutDate || s.dropoutReason) return true;
      return false;
    };

    // Helper to check if student is female
    const isStudentFemale = (s) => {
      if (!s) return false;
      const g = String(s.gender || '').trim().toLowerCase();
      return g === 'female' || g === 'f' || s.gender === 'ស្រី';
    };

    // Default class filter selection: if teacher, assigned class; otherwise 'all' by default (or active class filter if set)
    let selectedClassId = isTeacher 
      ? (teacherClassId || (classes[0] ? classes[0].id : '')) 
      : ((this.state.classId && this.state.classId !== 'all' && classes.some(c => String(c.id).trim() === String(this.state.classId).trim())) 
          ? this.state.classId 
          : 'all');
    let selectedYear = (this.state.academicYear && this.state.academicYear !== 'all') ? this.state.academicYear : 'all';

    let currentDroppedStudents = [];
    let currentTotalStart = 0;
    let currentFemaleStart = 0;
    let currentTotalDropout = 0;
    let currentFemaleDropout = 0;
    let currentS1Total = 0;
    let currentS1Female = 0;
    let currentS2Total = 0;
    let currentS2Female = 0;
    let currentTotalPercent = '0.00';
    let currentFemalePercent = '0.00';
    let currentS1Percent = '0.00';
    let currentS1FemalePercent = '0.00';
    let currentS2Percent = '0.00';
    let currentS2FemalePercent = '0.00';
    let currentClassName = '';
    let selectedReportDate = new Date();

    // Save system default filter values for resetPreset
    const defaultSchoolName = schoolName;
    const defaultSchoolProvince = schoolProvince;
    const defaultSelectedClassId = selectedClassId;
    const defaultSelectedYear = selectedYear;
    const defaultSelectedReportDate = new Date();

    await ReportViewer.open({
      reportKey: 'inactive_student_report',
      title: isKm ? 'បញ្ជីឈ្មោះសិស្សបោះបង់' : 'Inactive Student Report',
      alwaysFresh: true,
      defaultOrientation: 'landscape',
      defaultMargins: { top: 15, bottom: 15, left: 15, right: 15 },
      defaultFontFamily: 'Kantumruy Pro',
      defaultFontSize: 10,
      onResetFilters: async (viewer) => {
        schoolName = defaultSchoolName;
        schoolProvince = defaultSchoolProvince;
        selectedClassId = defaultSelectedClassId;
        selectedYear = defaultSelectedYear;
        selectedReportDate = new Date();
        if (viewer) viewer.customFilterValues = {};

        // Update Header UI controls directly
        const schoolSelect = viewer?.overlay?.querySelector('#rv-moeys-filter-school');
        if (schoolSelect) schoolSelect.value = schoolName;

        const provTriggerText = viewer?.overlay?.querySelector('#rv-province-trigger-text');
        if (provTriggerText) provTriggerText.textContent = schoolProvince || (isKm ? 'ជ្រើសរើសខេត្ត' : 'Select Province');

        const classSelect = viewer?.overlay?.querySelector('#rv-moeys-filter-class');
        if (classSelect) classSelect.value = selectedClassId;

        const yearTriggerText = viewer?.overlay?.querySelector('#rv-year-trigger-text');
        if (yearTriggerText) yearTriggerText.textContent = selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear;

        const dateInput = viewer?.overlay?.querySelector('#rv-input-report-date');
        const dateTriggerText = viewer?.overlay?.querySelector('#rv-date-trigger-text');
        const iso = selectedReportDate.toISOString().split('T')[0];
        if (dateInput) dateInput.value = iso;
        if (dateTriggerText) dateTriggerText.textContent = toKhmerNumerals(formatDisplayDate(iso));
      },
      renderHeaderControls: (controlsContainer, viewer) => {
        // Hydrate from saved customFilterValues if present in viewer preset
        if (viewer?.customFilterValues) {
          if (viewer.customFilterValues.schoolName && schoolOptions.includes(viewer.customFilterValues.schoolName)) {
            schoolName = viewer.customFilterValues.schoolName;
          }
          if (viewer.customFilterValues.schoolProvince) {
            schoolProvince = viewer.customFilterValues.schoolProvince;
          }
          if (viewer.customFilterValues.selectedClassId !== undefined) {
            selectedClassId = viewer.customFilterValues.selectedClassId;
          }
          if (viewer.customFilterValues.selectedYear !== undefined) {
            selectedYear = viewer.customFilterValues.selectedYear;
          }
          if (viewer.customFilterValues.selectedReportDate) {
            const parsedD = new Date(viewer.customFilterValues.selectedReportDate);
            if (!isNaN(parsedD.getTime())) {
              selectedReportDate = parsedD;
            }
          }
        }

        const syncFiltersToViewer = () => {
          if (!viewer) return;
          viewer.customFilterValues = {
            schoolName,
            schoolProvince,
            selectedClassId,
            selectedYear,
            selectedReportDate: (selectedReportDate instanceof Date) ? selectedReportDate.toISOString() : selectedReportDate
          };
          viewer.autoSaveIfEnabled?.();
        };

        controlsContainer.innerHTML = `
          <!-- Choose School Name strictly from School Table -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground">${isKm ? 'សាលារៀន:' : 'School:'}</span>
            <select id="rv-moeys-filter-school" class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs truncate max-w-[150px] sm:max-w-[180px] cursor-pointer box-border" title="${isKm ? 'ជ្រើសរើសសាលារៀន' : 'Select School'}">
              ${schoolOptions.length === 0 ? `
                <option value="" disabled selected>${isKm ? 'គ្មានសាលារៀន' : 'No schools'}</option>
              ` : schoolOptions.map(name => `
                <option value="${escapeHtml(name)}" ${name === schoolName ? 'selected' : ''}>${escapeHtml(name)}</option>
              `).join('')}
            </select>
          </div>

          <!-- Choose Province (Interactive Dropdown with Add & Delete) -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground">${isKm ? 'ខេត្ត/រាជធានី:' : 'Province:'}</span>
            <div id="rv-province-dropdown-container" class="relative">
              <!-- Trigger Button -->
              <button type="button" 
                      id="rv-btn-province-trigger" 
                      class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center justify-between gap-1.5 shadow-xs cursor-pointer min-w-[125px] max-w-[170px] box-border" 
                      title="${isKm ? 'ជ្រើសរើស ឬកែប្រែខេត្ត/រាជធានី' : 'Select or manage province'}">
                <span id="rv-province-trigger-text" class="truncate">${escapeHtml(schoolProvince || (isKm ? 'ជ្រើសរើសខេត្ត' : 'Select Province'))}</span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 rv-prov-chevron')}
              </button>

              <!-- Dropdown Popover Menu -->
              <div id="rv-popover-province-menu" 
                   class="hidden absolute left-0 top-[calc(100%+4px)] z-[80] w-72 p-2.5 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl space-y-2 font-khmer select-none animate-slide-down box-border">
                
                <!-- Quick Add Input Bar -->
                <div class="flex items-center gap-1.5 w-full box-border">
                  <input type="text" 
                         id="rv-input-new-province" 
                         class="flex-1 min-w-0 h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border" 
                         placeholder="${isKm ? 'បញ្ចូលឈ្មោះខេត្តថ្មី...' : 'Add new province...'}" />
                  <button type="button" 
                          id="rv-btn-add-province" 
                          class="h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors flex-shrink-0 cursor-pointer whitespace-nowrap" 
                          title="${isKm ? 'បន្ថែមខេត្ត' : 'Add Province'}">
                    ${getIcon('plus', 'w-3.5 h-3.5')}
                    <span>${isKm ? 'បន្ថែម' : 'Add'}</span>
                  </button>
                </div>

                <!-- Scrollable List of Provinces with Delete Buttons -->
                <div id="rv-province-items-list" class="max-h-48 overflow-y-auto divide-y divide-border/20 rounded-md border border-border/40 bg-background/50 p-0.5"></div>
              </div>
            </div>
          </div>

          <!-- Filter by Class: Strictly from classes table, with 'all' option supported -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground">ថ្នាក់រៀន:</span>
            ${isTeacher ? `
              <span class="h-8 py-0 leading-[30px] px-3 rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary flex items-center box-border">
                ${classes.find(c => c.id === teacherClassId)?.name || 'Assigned Class'}
              </span>
            ` : `
              <select id="rv-moeys-filter-class" class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs truncate max-w-[140px] cursor-pointer box-border">
                <option value="all" ${selectedClassId === 'all' ? 'selected' : ''}>${isKm ? 'គ្រប់ថ្នាក់ទាំងអស់' : 'All Classes'}</option>
                ${classes.map(c => `
                  <option value="${c.id}" ${String(selectedClassId).trim() === String(c.id).trim() ? 'selected' : ''}>${escapeHtml(c.name)}</option>
                `).join('')}
              </select>
            `}
          </div>

          <!-- Choose Academic Year (Interactive Dropdown with Add & Delete) -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground">${isKm ? 'ឆ្នាំសិក្សា:' : 'Year:'}</span>
            <div id="rv-year-dropdown-container" class="relative">
              <!-- Trigger Button -->
              <button type="button" 
                      id="rv-btn-year-trigger" 
                      class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center justify-between gap-1.5 shadow-xs cursor-pointer min-w-[110px] max-w-[160px] box-border" 
                      title="${isKm ? 'ជ្រើសរើស ឬកែប្រែឆ្នាំសិក្សា' : 'Select or manage academic year'}">
                <span id="rv-year-trigger-text" class="truncate">${escapeHtml(selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear)}</span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 rv-year-chevron')}
              </button>

              <!-- Dropdown Popover Menu -->
              <div id="rv-popover-year-menu" 
                   class="hidden absolute right-0 top-[calc(100%+4px)] z-[80] w-72 p-2.5 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl space-y-2 font-khmer select-none animate-slide-down box-border">
                
                <!-- Quick Add Input Bar -->
                <div class="flex items-center gap-1.5 w-full box-border">
                  <input type="text" 
                         id="rv-input-new-year" 
                         class="flex-1 min-w-0 h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border" 
                         placeholder="${isKm ? 'បញ្ចូលឆ្នាំថ្មី... (2024-2025)' : 'New year (e.g. 2024-2025)...'}" />
                  <button type="button" 
                          id="rv-btn-add-year" 
                          class="h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors flex-shrink-0 cursor-pointer whitespace-nowrap" 
                          title="${isKm ? 'បន្ថែមឆ្នាំសិក្សា' : 'Add Year'}">
                    ${getIcon('plus', 'w-3.5 h-3.5')}
                    <span>${isKm ? 'បន្ថែម' : 'Add'}</span>
                  </button>
                </div>

                <!-- Scrollable List of Academic Years with Delete Buttons -->
                <div id="rv-year-items-list" class="max-h-48 overflow-y-auto divide-y divide-border/20 rounded-md border border-border/40 bg-background/50 p-0.5"></div>
              </div>
            </div>
          </div>

          <!-- Choose Report Date (Khmer Lunar & Solar Date Picker) -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground">${isKm ? 'កាលបរិច្ឆេទ:' : 'Date:'}</span>
            <div id="rv-date-dropdown-container" class="relative">
              <!-- Trigger Button -->
              <button type="button" 
                      id="rv-btn-date-trigger" 
                      class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center justify-between gap-1.5 shadow-xs cursor-pointer min-w-[125px] max-w-[170px] box-border" 
                      title="${isKm ? 'ជ្រើសរើសកាលបរិច្ឆេទ (ចន្ទគតិ & សុរិយគតិ)' : 'Select Date (Khmer Lunar & Solar)'}">
                <span class="flex items-center gap-1.5 truncate">
                  ${getIcon('calendar', 'w-3.5 h-3.5 text-primary flex-shrink-0')}
                  <span id="rv-date-trigger-text" class="truncate">${toKhmerNumerals(formatDisplayDate(selectedReportDate.toISOString().split('T')[0]))}</span>
                </span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 rv-date-chevron')}
              </button>

              <!-- Dropdown Popover Menu -->
              <div id="rv-popover-date-menu" 
                   class="hidden absolute right-0 top-[calc(100%+4px)] z-[80] w-80 p-3 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl space-y-3 font-khmer select-none animate-slide-down box-border">
                
                <div class="flex items-center justify-between border-b border-border/50 pb-2">
                  <span class="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    ${getIcon('calendar', 'w-4 h-4 text-primary')}
                    <span>${isKm ? 'ជ្រើសរើសកាលបរិច្ឆេទ' : 'Select Report Date'}</span>
                  </span>
                  <button type="button" 
                          id="rv-btn-date-today" 
                          class="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer">
                    ${isKm ? 'ថ្ងៃនេះ' : 'Today'}
                  </button>
                </div>

                <!-- Date Input -->
                <div class="space-y-1">
                  <label class="text-[11px] text-muted-foreground">${isKm ? 'កាលបរិច្ឆេទសុរិយគតិ:' : 'Solar Date:'}</label>
                  <input type="date" 
                         id="rv-input-report-date" 
                         value="${selectedReportDate.toISOString().split('T')[0]}"
                         class="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border cursor-pointer" />
                </div>

                <!-- Live Preview Cards -->
                <div class="space-y-2 pt-1">
                  <!-- Lunar Preview -->
                  <div class="p-2.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-primary font-semibold">
                      <span>${isKm ? 'ចន្ទគតិ' : 'Khmer Lunar Date'}</span>
                      ${getIcon('moon', 'w-3.5 h-3.5')}
                    </div>
                    <p id="rv-preview-lunar-text" class="text-xs text-foreground font-medium break-words leading-relaxed">
                      ${formatKhmerLunarDate(selectedReportDate)}
                    </p>
                    <button type="button" 
                            id="rv-btn-insert-lunar-text" 
                            class="mt-1.5 w-full py-1 px-2 rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="${isKm ? 'បញ្ចូលត្រង់ទស្សន៍ទ្រនិច ឬជំនួសអត្ថបទដែលបាន Highlight ក្នុងរបាយការណ៍' : 'Insert at cursor or replace highlighted text in report'}">
                      ${getIcon('plus', 'w-3 h-3')}
                      <span>${isKm ? '+ បញ្ចូលត្រង់ទស្សន៍ទ្រនិច' : '+ Insert at Cursor'}</span>
                    </button>
                  </div>

                  <!-- Solar Preview -->
                  <div class="p-2.5 rounded-lg border border-border/60 bg-muted/30 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                      <span>${isKm ? 'សុរិយគតិ' : 'Khmer Solar Date'}</span>
                      ${getIcon('sun', 'w-3.5 h-3.5')}
                    </div>
                    <p id="rv-preview-solar-text" class="text-xs text-foreground font-medium break-words leading-relaxed">
                      ${schoolName ? `${schoolName}, ` : ''}${formatKhmerSolarDate(selectedReportDate)}
                    </p>
                    <button type="button" 
                            id="rv-btn-insert-solar-text" 
                            class="mt-1.5 w-full py-1 px-2 rounded border border-border bg-card hover:bg-muted text-foreground text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="${isKm ? 'បញ្ចូលត្រង់ទស្សន៍ទ្រនិច ឬជំនួសអត្ថបទដែលបាន Highlight ក្នុងរបាយការណ៍' : 'Insert at cursor or replace highlighted text in report'}">
                      ${getIcon('plus', 'w-3 h-3')}
                      <span>${isKm ? '+ បញ្ចូលត្រង់ទស្សន៍ទ្រនិច' : '+ Insert at Cursor'}</span>
                    </button>
                  </div>
                </div>

                <div class="pt-1 flex flex-col gap-1.5">
                  <button type="button" 
                          id="rv-btn-insert-both-text" 
                          class="w-full h-7 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="${isKm ? 'បញ្ចូលកាលបរិច្ឆេទទាំង២ ត្រង់ទស្សន៍ទ្រនិច ឬជំនួសអត្ថបទដែលបាន Highlight' : 'Insert both dates at cursor or replace highlighted text'}">
                    ${getIcon('type', 'w-3.5 h-3.5')}
                    <span>${isKm ? '+ បញ្ចូលទាំង២ ត្រង់ទស្សន៍ទ្រនិច' : '+ Insert Both at Cursor'}</span>
                  </button>
                  <button type="button" 
                          id="rv-btn-date-apply" 
                          class="w-full h-8 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer">
                    ${getIcon('check', 'w-3.5 h-3.5')}
                    <span>${isKm ? 'យល់ព្រម (Apply)' : 'Apply'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Export to Excel Button -->
          <button type="button" 
                  id="rv-btn-moeys-export-excel" 
                  class="h-8 py-0 leading-[30px] px-3 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center gap-1.5 font-khmer shadow-xs cursor-pointer box-border">
            ${getIcon('fileSpreadsheet', 'w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400')}
            <span>Excel</span>
          </button>
        `;

        // 1. School Selector Event Listener
        controlsContainer.querySelector('#rv-moeys-filter-school')?.addEventListener('change', async (e) => {
          schoolName = e.target.value;
          await SettingsService.set('moeys_report_school_name', schoolName);
          syncFiltersToViewer();
          viewer.refreshContent(true);
        });

        // 2. Province Dropdown Elements and Logic
        const provContainer = controlsContainer.querySelector('#rv-province-dropdown-container');
        const provTriggerBtn = controlsContainer.querySelector('#rv-btn-province-trigger');
        const provTriggerText = controlsContainer.querySelector('#rv-province-trigger-text');
        const provChevron = controlsContainer.querySelector('.rv-prov-chevron');
        const provMenu = controlsContainer.querySelector('#rv-popover-province-menu');
        const provListEl = controlsContainer.querySelector('#rv-province-items-list');
        const provInputEl = controlsContainer.querySelector('#rv-input-new-province');
        const provAddBtn = controlsContainer.querySelector('#rv-btn-add-province');

        const updateProvTrigger = () => {
          if (provTriggerText) {
            provTriggerText.textContent = schoolProvince || (isKm ? 'ជ្រើសរើសខេត្ត' : 'Select Province');
          }
        };

        const renderProvinceList = () => {
          if (!provListEl) return;
          if (!allProvinces || allProvinces.length === 0) {
            provListEl.innerHTML = `
              <div class="px-3 py-2 text-center text-xs text-muted-foreground italic">
                ${isKm ? 'គ្មានទិន្នន័យខេត្ត' : 'No provinces available'}
              </div>
            `;
            return;
          }

          provListEl.innerHTML = allProvinces.map(prov => {
            const isSelected = schoolProvince.trim().toLowerCase() === prov.trim().toLowerCase();
            return `
              <div class="rv-province-row flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent text-xs group cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}" data-value="${escapeHtml(prov)}">
                <span class="rv-prov-label truncate flex-1 pr-1.5">${escapeHtml(prov)}</span>
                <button type="button" 
                        class="rv-btn-delete-prov p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100 cursor-pointer" 
                        title="${isKm ? 'លុបខេត្តនេះ' : 'Delete province'}" 
                        data-value="${escapeHtml(prov)}">
                  ${getIcon('trash', 'w-3 h-3')}
                </button>
              </div>
            `;
          }).join('');
        };

        renderProvinceList();
        updateProvTrigger();

        // Toggle Province Menu
        provTriggerBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = provMenu.classList.contains('hidden');
          if (isHidden) {
            provMenu.classList.remove('hidden');
            provChevron?.classList.add('rotate-180');
            provInputEl?.focus();
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
          } else {
            provMenu.classList.add('hidden');
            provChevron?.classList.remove('rotate-180');
          }
        });

        // Prevent closing when clicking inside popover menu
        provMenu?.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        // Add Province Action
        const handleAddProvince = async () => {
          const valToAdd = provInputEl?.value?.trim();
          if (!valToAdd) {
            provInputEl?.focus();
            return;
          }
          try {
            const updated = await LocationService.addItem('provinces', valToAdd);
            allProvinces = updated;
            schoolProvince = valToAdd;
            await SettingsService.set('moeys_report_province', schoolProvince);
            syncFiltersToViewer();
            if (provInputEl) provInputEl.value = '';
            updateProvTrigger();
            renderProvinceList();
            provMenu.classList.add('hidden');
            provChevron?.classList.remove('rotate-180');
            viewer.refreshContent();
            toast.success(isKm ? 'បានបន្ថែមខេត្តដោយជោគជ័យ' : 'Province added successfully');
          } catch (err) {
            toast.error(err.message === 'ALREADY_EXISTS' ? (isKm ? 'ខេត្តនេះមានរួចហើយ' : 'This province already exists') : err.message);
          }
        };

        provAddBtn?.addEventListener('click', handleAddProvince);
        provInputEl?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddProvince();
          }
        });

        // Province List Action: Select or Delete
        provListEl?.addEventListener('click', async (e) => {
          const delBtn = e.target.closest('.rv-btn-delete-prov');
          if (delBtn) {
            e.stopPropagation();
            const valToDelete = delBtn.getAttribute('data-value');
            if (!valToDelete) return;

            openDeleteLocationConfirm({
              title: isKm ? 'លុបខេត្ត' : 'Delete Province',
              message: isKm ? `តើអ្នកពិតជាចង់លុប "${valToDelete}" ចេញពីទិន្នន័យមែនទេ?` : `Are you sure you want to delete "${valToDelete}" from data?`,
              isKm,
              onConfirm: async () => {
                try {
                  const updated = await LocationService.deleteItem('provinces', valToDelete);
                  allProvinces = updated;
                  if (schoolProvince.trim().toLowerCase() === valToDelete.trim().toLowerCase()) {
                    schoolProvince = allProvinces[0] || '';
                    await SettingsService.set('moeys_report_province', schoolProvince);
                    syncFiltersToViewer();
                    updateProvTrigger();
                    viewer.refreshContent();
                  }
                  renderProvinceList();
                  toast.success(isKm ? 'បានលុបខេត្តដោយជោគជ័យ' : 'Province deleted successfully');
                } catch (err) {
                  toast.error(err.message);
                }
              }
            });
            return;
          }

          const row = e.target.closest('.rv-province-row');
          if (row) {
            const val = row.getAttribute('data-value');
            if (val) {
              schoolProvince = val;
              await SettingsService.set('moeys_report_province', schoolProvince);
              syncFiltersToViewer();
              updateProvTrigger();
              renderProvinceList();
              provMenu.classList.add('hidden');
              provChevron?.classList.remove('rotate-180');
              viewer.refreshContent();
            }
          }
        });

        // 3. Academic Year Dropdown Elements and Logic
        const yearContainer = controlsContainer.querySelector('#rv-year-dropdown-container');
        const yearTriggerBtn = controlsContainer.querySelector('#rv-btn-year-trigger');
        const yearTriggerText = controlsContainer.querySelector('#rv-year-trigger-text');
        const yearChevron = controlsContainer.querySelector('.rv-year-chevron');
        const yearMenu = controlsContainer.querySelector('#rv-popover-year-menu');
        const yearListEl = controlsContainer.querySelector('#rv-year-items-list');
        const yearInputEl = controlsContainer.querySelector('#rv-input-new-year');
        const yearAddBtn = controlsContainer.querySelector('#rv-btn-add-year');

        const updateYearTrigger = () => {
          if (yearTriggerText) {
            yearTriggerText.textContent = selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear;
          }
        };

        const renderYearList = () => {
          if (!yearListEl) return;
          const isAllSelected = selectedYear === 'all';
          let html = `
            <div class="rv-year-row flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent text-xs group cursor-pointer transition-colors ${isAllSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground italic'}" data-value="all">
              <span class="rv-year-label truncate flex-1">${isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years'}</span>
            </div>
          `;

          html += academicYears.map(y => {
            const yName = typeof y === 'string' ? y : y.name;
            const isSelected = String(selectedYear).trim().toLowerCase() === String(yName).trim().toLowerCase();
            return `
              <div class="rv-year-row flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent text-xs group cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}" data-value="${escapeHtml(yName)}">
                <span class="rv-year-label truncate flex-1 pr-1.5">${escapeHtml(yName)}</span>
                <button type="button" 
                        class="rv-btn-delete-year p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100 cursor-pointer" 
                        title="${isKm ? 'លុបឆ្នាំសិក្សានេះ' : 'Delete academic year'}" 
                        data-value="${escapeHtml(yName)}">
                  ${getIcon('trash', 'w-3 h-3')}
                </button>
              </div>
            `;
          }).join('');

          yearListEl.innerHTML = html;
        };

        renderYearList();
        updateYearTrigger();

        // Toggle Academic Year Menu
        yearTriggerBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = yearMenu.classList.contains('hidden');
          if (isHidden) {
            yearMenu.classList.remove('hidden');
            yearChevron?.classList.add('rotate-180');
            yearInputEl?.focus();
            provMenu?.classList.add('hidden');
            provChevron?.classList.remove('rotate-180');
          } else {
            yearMenu.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
          }
        });

        // Prevent closing when clicking inside academic year popover
        yearMenu?.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        // Add Academic Year Action
        const handleAddYear = async () => {
          const valToAdd = yearInputEl?.value?.trim();
          if (!valToAdd) {
            yearInputEl?.focus();
            return;
          }
          try {
            const created = await SettingsService.createAcademicYear({ name: valToAdd });
            academicYears = await SettingsService.getAcademicYears() || [];
            selectedYear = created?.name || valToAdd;
            syncFiltersToViewer();
            if (yearInputEl) yearInputEl.value = '';
            updateYearTrigger();
            renderYearList();
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
            viewer.refreshContent();
            toast.success(isKm ? 'បានបន្ថែមឆ្នាំសិក្សាដោយជោគជ័យ' : 'Academic year added successfully');
          } catch (err) {
            toast.error(err.message);
          }
        };

        yearAddBtn?.addEventListener('click', handleAddYear);
        yearInputEl?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddYear();
          }
        });

        // Academic Year List Action: Select or Delete
        yearListEl?.addEventListener('click', async (e) => {
          const delBtn = e.target.closest('.rv-btn-delete-year');
          if (delBtn) {
            e.stopPropagation();
            const valToDelete = delBtn.getAttribute('data-value');
            if (!valToDelete) return;

            openDeleteLocationConfirm({
              title: isKm ? 'លុបឆ្នាំសិក្សា' : 'Delete Academic Year',
              message: isKm ? `តើអ្នកពិតជាចង់លុប "${valToDelete}" ចេញពីទិន្នន័យមែនទេ?` : `Are you sure you want to delete "${valToDelete}" from data?`,
              isKm,
              onConfirm: async () => {
                try {
                  await SettingsService.deleteAcademicYear(valToDelete);
                  academicYears = await SettingsService.getAcademicYears() || [];
                  if (String(selectedYear).trim().toLowerCase() === String(valToDelete).trim().toLowerCase()) {
                    selectedYear = academicYears.length > 0 ? (academicYears[0].name || academicYears[0]) : 'all';
                    syncFiltersToViewer();
                    updateYearTrigger();
                    viewer.refreshContent();
                  }
                  renderYearList();
                  toast.success(isKm ? 'បានលុបឆ្នាំសិក្សាដោយជោគជ័យ' : 'Academic year deleted successfully');
                } catch (err) {
                  toast.error(err.message);
                }
              }
            });
            return;
          }

          const row = e.target.closest('.rv-year-row');
          if (row) {
            const val = row.getAttribute('data-value');
            if (val !== null && val !== undefined) {
              selectedYear = val;
              syncFiltersToViewer();
              updateYearTrigger();
              renderYearList();
              yearMenu.classList.add('hidden');
              yearChevron?.classList.remove('rotate-180');
              viewer.refreshContent();
            }
          }
        });

        // 4. Date Dropdown Elements and Logic
        const dateContainer = controlsContainer.querySelector('#rv-date-dropdown-container');
        const dateTriggerBtn = controlsContainer.querySelector('#rv-btn-date-trigger');
        const dateTriggerText = controlsContainer.querySelector('#rv-date-trigger-text');
        const dateChevron = controlsContainer.querySelector('.rv-date-chevron');
        const dateMenu = controlsContainer.querySelector('#rv-popover-date-menu');
        const dateInput = controlsContainer.querySelector('#rv-input-report-date');
        const dateTodayBtn = controlsContainer.querySelector('#rv-btn-date-today');
        const dateApplyBtn = controlsContainer.querySelector('#rv-btn-date-apply');
        const previewLunarText = controlsContainer.querySelector('#rv-preview-lunar-text');
        const previewSolarText = controlsContainer.querySelector('#rv-preview-solar-text');

        const updateDateDisplay = (newDate) => {
          selectedReportDate = (newDate instanceof Date) ? newDate : new Date(newDate);
          if (isNaN(selectedReportDate.getTime())) selectedReportDate = new Date();
          const iso = selectedReportDate.toISOString().split('T')[0];
          if (dateInput) dateInput.value = iso;
          if (dateTriggerText) {
            dateTriggerText.textContent = toKhmerNumerals(formatDisplayDate(iso));
          }
          const lunarStr = formatKhmerLunarDate(selectedReportDate);
          const rawSolar = formatKhmerSolarDate(selectedReportDate);
          const solarStr = schoolName ? `${schoolName}, ${rawSolar}` : rawSolar;
          if (previewLunarText) previewLunarText.textContent = lunarStr;
          if (previewSolarText) previewSolarText.textContent = solarStr;

          // Update document directly in real-time
          if (viewer && viewer.overlay) {
            const docLunar = viewer.overlay.querySelector('#rv-report-lunar-date');
            if (docLunar) docLunar.textContent = lunarStr;
            const docSolar = viewer.overlay.querySelector('#rv-report-solar-date');
            if (docSolar) {
              docSolar.textContent = solarStr;
            }
          }
        };

        // Prevent focus loss so document caret/highlight isn't lost when interacting with date controls
        const insertLunarBtn = controlsContainer.querySelector('#rv-btn-insert-lunar-text, #rv-btn-insert-lunar-textbox');
        const insertSolarBtn = controlsContainer.querySelector('#rv-btn-insert-solar-text, #rv-btn-insert-solar-textbox');
        const insertBothBtn = controlsContainer.querySelector('#rv-btn-insert-both-text, #rv-btn-insert-both-textboxes');

        [dateTriggerBtn, dateTodayBtn, dateApplyBtn, insertLunarBtn, insertSolarBtn, insertBothBtn].forEach(btn => {
          btn?.addEventListener('mousedown', (e) => {
            e.preventDefault();
          });
        });

        dateTriggerBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          provMenu?.classList.add('hidden');
          provChevron?.classList.remove('rotate-180');
          yearMenu?.classList.add('hidden');
          yearChevron?.classList.remove('rotate-180');

          const isClosed = dateMenu?.classList.contains('hidden');
          dateMenu?.classList.toggle('hidden');
          dateChevron?.classList.toggle('rotate-180', isClosed);
        });

        dateInput?.addEventListener('input', () => {
          if (dateInput.value) {
            const [y, m, d] = dateInput.value.split('-').map(Number);
            const dObj = new Date(y, m - 1, d);
            updateDateDisplay(dObj);
            syncFiltersToViewer();
          }
        });

        dateTodayBtn?.addEventListener('click', () => {
          updateDateDisplay(new Date());
          syncFiltersToViewer();
        });

        dateApplyBtn?.addEventListener('click', () => {
          dateMenu?.classList.add('hidden');
          dateChevron?.classList.remove('rotate-180');
          updateDateDisplay(selectedReportDate);
          syncFiltersToViewer();
          viewer.saveStateForUndo?.();
          viewer.autoSaveIfEnabled?.();
        });

        // 5. Date Text Insertion Handlers (Inserts at cursor position or replaces highlighted text)
        insertLunarBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          const lunarStr = formatKhmerLunarDate(selectedReportDate);
          let handled = false;
          if (viewer && typeof viewer.insertTextAtSelection === 'function') {
            handled = viewer.insertTextAtSelection(lunarStr);
          }
          if (!handled) {
            const docLunar = viewer?.overlay?.querySelector('#rv-report-lunar-date');
            if (docLunar) {
              viewer?.saveStateForUndo?.();
              docLunar.style.fontFamily = "'Khmer OS Siemreap', 'Siemreap', sans-serif";
              docLunar.style.setProperty('font-size', '10px', 'important');
              docLunar.textContent = lunarStr;
              viewer?.normalizeContentText?.();
              handled = true;
            }
          }

          if (handled) {
            syncFiltersToViewer();
            viewer?.savePreset?.(false);
            toast.success(isKm ? 'បានបញ្ចូលកាលបរិច្ឆេទចន្ទគតិ' : 'Inserted Khmer Lunar date');
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          } else {
            toast.info(isKm ? 'សូមចុចលើទីតាំង ឬជ្រើសរើស (Highlight) អត្ថបទក្នុងរបាយការណ៍ជាមុនសិន' : 'Please click where you want to insert or highlight text first');
          }
        });

        insertSolarBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          const rawSolar = formatKhmerSolarDate(selectedReportDate);
          const solarStr = schoolName ? `${schoolName}, ${rawSolar}` : rawSolar;
          let handled = false;
          if (viewer && typeof viewer.insertTextAtSelection === 'function') {
            handled = viewer.insertTextAtSelection(solarStr);
          }
          if (!handled) {
            const docSolar = viewer?.overlay?.querySelector('#rv-report-solar-date');
            if (docSolar) {
              viewer?.saveStateForUndo?.();
              docSolar.style.fontFamily = "'Khmer OS Siemreap', 'Siemreap', sans-serif";
              docSolar.style.setProperty('font-size', '10px', 'important');
              docSolar.textContent = solarStr;
              viewer?.normalizeContentText?.();
              handled = true;
            }
          }

          if (handled) {
            syncFiltersToViewer();
            viewer?.savePreset?.(false);
            toast.success(isKm ? 'បានបញ្ចូលកាលបរិច្ឆេទសុរិយគតិ' : 'Inserted Khmer Solar date');
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          } else {
            toast.info(isKm ? 'សូមចុចលើទីតាំង ឬជ្រើសរើស (Highlight) អត្ថបទក្នុងរបាយការណ៍ជាមុនសិន' : 'Please click where you want to insert or highlight text first');
          }
        });

        insertBothBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          const lunarStr = formatKhmerLunarDate(selectedReportDate);
          const rawSolar = formatKhmerSolarDate(selectedReportDate);
          const solarStr = schoolName ? `${schoolName}, ${rawSolar}` : rawSolar;
          const bothHtml = `${lunarStr}<br>${solarStr}`;

          let handled = false;
          if (viewer && typeof viewer.insertTextAtSelection === 'function') {
            handled = viewer.insertTextAtSelection(bothHtml, { isHtml: true });
          }
          if (!handled) {
            const docLunar = viewer?.overlay?.querySelector('#rv-report-lunar-date');
            const docSolar = viewer?.overlay?.querySelector('#rv-report-solar-date');
            if (docLunar || docSolar) {
              viewer?.saveStateForUndo?.();
              if (docLunar) {
                docLunar.style.fontFamily = "'Khmer OS Siemreap', 'Siemreap', sans-serif";
                docLunar.style.setProperty('font-size', '10px', 'important');
                docLunar.textContent = lunarStr;
              }
              if (docSolar) {
                docSolar.style.fontFamily = "'Khmer OS Siemreap', 'Siemreap', sans-serif";
                docSolar.style.setProperty('font-size', '10px', 'important');
                docSolar.textContent = solarStr;
              }
              viewer?.normalizeContentText?.();
              handled = true;
            }
          }

          if (handled) {
            syncFiltersToViewer();
            viewer?.savePreset?.(false);
            toast.success(isKm ? 'បានបញ្ចូលកាលបរិច្ឆេទទាំង២' : 'Inserted both dates');
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          } else {
            toast.info(isKm ? 'សូមចុចលើទីតាំង ឬជ្រើសរើស (Highlight) អត្ថបទក្នុងរបាយការណ៍ជាមុនសិន' : 'Please click where you want to insert or highlight text first');
          }
        });

        // Outside Click Listener to dismiss popover menus
        const handleOutsideClick = (e) => {
          if (!document.body.contains(provContainer) && !document.body.contains(yearContainer) && !document.body.contains(dateContainer)) {
            document.removeEventListener('click', handleOutsideClick);
            return;
          }
          if (provContainer && !provContainer.contains(e.target)) {
            provMenu?.classList.add('hidden');
            provChevron?.classList.remove('rotate-180');
          }
          if (yearContainer && !yearContainer.contains(e.target)) {
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
          }
          if (dateContainer && !dateContainer.contains(e.target)) {
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          }
        };
        document.addEventListener('click', handleOutsideClick);

        // 4. Class filter listener
        controlsContainer.querySelector('#rv-moeys-filter-class')?.addEventListener('change', (e) => {
          selectedClassId = e.target.value;
          syncFiltersToViewer();
          viewer.refreshContent(true);
        });

        // 4. Export to Excel
        controlsContainer.querySelector('#rv-btn-moeys-export-excel')?.addEventListener('click', () => {
          if (typeof XLSX === 'undefined') {
            toast.error('SheetJS library is not available');
            return;
          }
          const headers = ['ល.រ', 'គោត្តនាម និងនាម', 'ថ្នាក់', 'ភេទ', 'ថ្ងៃខែឆ្នាំកំណើត', 'ថ្ងៃខែឆ្នាំបោះបង់', 'ឆមាស', 'មូលហេតុ', 'ផ្សេងៗ'];
          const dataRows = currentDroppedStudents.map((s, i) => {
            const studentClass = classes.find(c => String(c.id).trim() === String(s.classId).trim());
            const studentClassName = studentClass ? studentClass.name : (s.classId || '—');
            return [
              i + 1,
              getStudentDisplayName(s),
              studentClassName,
              isStudentFemale(s) ? 'ស្រី' : 'ប្រុស',
              formatDisplayDate(s.dateOfBirth) || '',
              formatDisplayDate(s.dropoutDate) || '',
              s.dropoutSemester || 'ឆមាសទី១',
              s.dropoutReason || '',
              s.dropoutRemarks || ''
            ];
          });

          const displayYear = selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear;
          const displayProv = getDisplayProvince(schoolProvince);
          const ws = XLSX.utils.aoa_to_sheet([
            [`${isKm ? 'បញ្ជីឈ្មោះសិស្សបោះបង់' : 'Inactive Student Report'} - ថ្នាក់ទី ${currentClassName} ឆ្នាំសិក្សា ${displayYear}`],
            [`សាលារៀន: ${schoolName} / ${displayProv}`],
            [`ចំនួនសិស្សដើមឆ្នាំ: ${currentTotalStart} នាក់ / ស្រី: ${currentFemaleStart} នាក់`],
            [],
            headers,
            ...dataRows,
            [],
            ['ស្ថិតិសង្ខេប:'],
            [`ចំនួនសិស្សបោះបង់: ${currentTotalDropout} នាក់ (ស្រី: ${currentFemaleDropout} នាក់)`, `គិតជាភាគរយ: ${currentTotalPercent} % (ស្រី: ${currentFemalePercent} %)`],
            [`បោះបង់ក្នុងឆមាសទី១: ${currentS1Total} នាក់ (ស្រី: ${currentS1Female} នាក់)`, `គិតជាភាគរយ: ${currentS1Percent} % (ស្រី: ${currentS1FemalePercent} %)`],
            [`បោះបង់ក្នុងឆមាសទី២: ${currentS2Total} នាក់ (ស្រី: ${currentS2Female} នាក់)`, `គិតជាភាគរយ: ${currentS2Percent} % (ស្រី: ${currentS2FemalePercent} %)`]
          ]);

          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, isKm ? 'សិស្សបោះបង់' : 'Inactive Students');
          XLSX.writeFile(wb, `${isKm ? 'បញ្ជីឈ្មោះសិស្សបោះបង់' : 'Inactive_Student_Report'}_${schoolName}_${currentClassName}_${selectedYear}.xlsx`);
          toast.success(isKm ? 'បានទាញយក Excel ដោយជោគជ័យ' : 'Excel exported successfully');
        });
      },
      renderContent: async (contentContainer, viewer) => {
        contentContainer.innerHTML = `
          <div class="py-12 flex items-center justify-center gap-2 text-muted-foreground text-xs font-khmer">
            <div class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            <span>កំពុងទាញយកទិន្នន័យ...</span>
          </div>
        `;

        const allStudents = await StudentService.getAll();

        const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();

        let studentsInScope = allStudents;
        if (selectedClassId && selectedClassId !== 'all') {
          studentsInScope = studentsInScope.filter(s => String(s.classId || '').trim() === String(selectedClassId).trim());
        }
        if (selectedYear && selectedYear !== 'all') {
          studentsInScope = studentsInScope.filter(s => normDash(s.academicYear) === normDash(selectedYear));
        }

        currentTotalStart = studentsInScope.length;
        currentFemaleStart = studentsInScope.filter(isStudentFemale).length;

        currentDroppedStudents = studentsInScope.filter(isStudentInactive);
        currentTotalDropout = currentDroppedStudents.length;
        currentFemaleDropout = currentDroppedStudents.filter(isStudentFemale).length;

        const s1List = currentDroppedStudents.filter(s => s.dropoutSemester === 'ឆមាសទី១' || s.dropoutSemester === 'Semester 1');
        currentS1Total = s1List.length;
        currentS1Female = s1List.filter(isStudentFemale).length;

        const s2List = currentDroppedStudents.filter(s => s.dropoutSemester === 'ឆមាសទី២' || s.dropoutSemester === 'Semester 2');
        currentS2Total = s2List.length;
        currentS2Female = s2List.filter(isStudentFemale).length;

        currentTotalPercent = currentTotalStart > 0 ? ((currentTotalDropout / currentTotalStart) * 100).toFixed(2) : '0.00';
        currentFemalePercent = currentFemaleStart > 0 ? ((currentFemaleDropout / currentFemaleStart) * 100).toFixed(2) : '0.00';

        currentS1Percent = currentTotalStart > 0 ? ((currentS1Total / currentTotalStart) * 100).toFixed(2) : '0.00';
        currentS1FemalePercent = currentFemaleStart > 0 ? ((currentS1Female / currentFemaleStart) * 100).toFixed(2) : '0.00';

        currentS2Percent = currentTotalStart > 0 ? ((currentS2Total / currentTotalStart) * 100).toFixed(2) : '0.00';
        currentS2FemalePercent = currentFemaleStart > 0 ? ((currentS2Female / currentFemaleStart) * 100).toFixed(2) : '0.00';

        const foundClass = classes.find(c => String(c.id).trim() === String(selectedClassId).trim());
        currentClassName = foundClass ? foundClass.name : (selectedClassId === 'all' ? (isKm ? 'គ្រប់ថ្នាក់ទាំងអស់' : 'All Classes') : selectedClassId);

        const buildRowHtml = (s, idx, existingRow = null) => {
          const rowStyle = existingRow?.getAttribute('style') || "font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;";
          const cellStyles = Array.from(existingRow?.cells || []).map(c => c.getAttribute('style') || '');
          const nameSpan = existingRow?.cells?.[1]?.querySelector('span');
          const nameSpanStyle = nameSpan?.getAttribute('style') || "font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;";

          // Row padding
          const pad = viewer?.currentRowPadding ? Math.max(2, Math.min(40, parseInt(viewer.currentRowPadding, 10) || 8)) : 8;
          const padStyle = `padding-top: ${pad}px !important; padding-bottom: ${pad}px !important;`;

          // Custom column width helper
          const getColStyle = (cIdx, defaultStyle) => {
            if (cellStyles[cIdx]) return cellStyles[cIdx];
            const customW = viewer?.savedColumnWidths?.[cIdx];
            if (customW) {
              return `${defaultStyle} ${padStyle} width: ${customW} !important; min-width: ${customW} !important; max-width: ${customW} !important;`;
            }
            return `${defaultStyle} ${padStyle}`;
          };

          // Preserve any custom text or remarks user typed directly into the row cells
          const reasonContent = existingRow?.cells?.[6]?.innerHTML?.trim() || s.dropoutReason || '—';
          const remarksContent = existingRow?.cells?.[7]?.innerHTML?.trim() || s.dropoutRemarks || '—';

          return `
          <tr class="hover:bg-muted/30 transition-colors" data-student-id="${s.studentId || ''}" style="${rowStyle}">
            <td class="py-2 px-1 text-center border border-foreground/30" style="${getColStyle(0, "font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important; word-break: break-word !important;")}">
              ${toKhmerNumerals(idx + 1)}
            </td>
            <td class="py-2 px-2 font-semibold text-foreground border border-foreground/30" style="${getColStyle(1, "font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important; word-break: break-word !important;")}">
              <span style="${nameSpanStyle}">${getStudentDisplayName(s)}</span>
            </td>
            <td class="py-2 px-1 text-center border border-foreground/30" style="${getColStyle(2, "font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important; word-break: break-word !important;")}">
              ${isStudentFemale(s) ? 'ស្រី' : 'ប្រុស'}
            </td>
            <td class="py-2 px-1 text-center border border-foreground/30" style="${getColStyle(3, "font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important; word-break: break-word !important;")}">
              ${formatDisplayDate(s.dateOfBirth) || '—'}
            </td>
            <td class="py-2 px-1 text-center border border-foreground/30" style="${getColStyle(4, "font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important; word-break: break-word !important;")}">
              ${formatDisplayDate(s.dropoutDate) || '—'}
            </td>
            <td class="py-2 px-1 text-center font-medium border border-foreground/30" style="${getColStyle(5, "font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important; word-break: break-word !important;")}">
              ${s.dropoutSemester || 'ឆមាសទី១'}
            </td>
            <td class="py-2 px-2 border border-foreground/30 text-left" style="${getColStyle(6, "font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important; word-break: break-word !important;")}">
              ${reasonContent}
            </td>
            <td class="py-2 px-1 text-center text-muted-foreground border border-foreground/30" style="${getColStyle(7, "font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important; word-break: break-word !important;")}">
              ${remarksContent}
            </td>
          </tr>
        `;
        };

        // If viewer already has saved HTML content (preserving user customized colors, font sizes, etc.), merge live data into it
        if (viewer && viewer.savedHtmlContent) {
          try {
            const staging = document.createElement('div');
            staging.innerHTML = viewer.savedHtmlContent;
            const targetTbody = staging.querySelector('.moeys-table tbody') || staging.querySelector('tbody');
            if (targetTbody) {
              const rowsHtml = currentDroppedStudents.length === 0 ? `
                <tr style="font-size: 10px !important;">
                  <td colspan="8" class="py-10 text-center text-muted-foreground italic border border-foreground/30" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                    ${isKm ? 'គ្មានទិន្នន័យសិស្សបោះបង់ទេ' : 'No inactive students found'}
                  </td>
                </tr>
              ` : currentDroppedStudents.map((s, idx) => {
                const existingRow = targetTbody.querySelector(`tr[data-student-id="${s.studentId}"]`);
                return buildRowHtml(s, idx, existingRow);
              }).join('');

              targetTbody.innerHTML = rowsHtml;

              const topCountEl = staging.querySelector('#moeys-count-start') ||
                Array.from(staging.querySelectorAll('div')).find(d => d.textContent.includes('ចំនួនសិស្សដើមឆ្នាំ:'));
              if (topCountEl) {
                topCountEl.innerHTML = `
                  <span>ចំនួនសិស្សដើមឆ្នាំ: </span>
                  <span class="font-bold text-foreground" style="font-size: 10px !important;">${toKhmerNumerals(currentTotalStart)}</span>
                  <span> នាក់ / ស្រី: </span>
                  <span class="font-bold text-foreground" style="font-size: 10px !important;">${toKhmerNumerals(currentFemaleStart)}</span>
                  <span> នាក់</span>
                `;
              }

              const footerStatsEl = staging.querySelector('#moeys-stats-footer');
              if (footerStatsEl) {
                footerStatsEl.innerHTML = `
                  <div class="flex flex-wrap items-start justify-start gap-x-8 sm:gap-x-12 gap-y-1" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                    <!-- Left column: Total Inactive counts -->
                    <div class="space-y-0.5" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                      <div style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                        <span>ចំនួនសិស្សបោះបង់: </span>
                        <span class="font-normal" style="font-size: 10px !important;">${toKhmerNumerals(currentTotalDropout)} នាក់ / ស្រី: ${toKhmerNumerals(currentFemaleDropout)} នាក់</span>
                      </div>
                      <div style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                        <span>បោះបង់ក្នុងឆមាសទី១: </span>
                        <span class="font-normal" style="font-size: 10px !important;">${toKhmerNumerals(currentS1Total)} នាក់ / ស្រី: ${toKhmerNumerals(currentS1Female)} នាក់</span>
                      </div>
                      <div style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                        <span>បោះបង់ក្នុងឆមាសទី២: </span>
                        <span class="font-normal" style="font-size: 10px !important;">${toKhmerNumerals(currentS2Total)} នាក់ / ស្រី: ${toKhmerNumerals(currentS2Female)} នាក់</span>
                      </div>
                    </div>

                    <!-- Right column: Percentage calculations -->
                    <div class="space-y-0.5" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                      <div style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                        <span>គិតជាភាគរយ: </span>
                        <span class="font-normal" style="font-size: 10px !important;">${currentTotalPercent} % ស្រី: ${currentFemalePercent} %</span>
                      </div>
                      <div style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                        <span>គិតជាភាគរយ: </span>
                        <span class="font-normal" style="font-size: 10px !important;">${currentS1Percent} % ស្រី: ${currentS1FemalePercent} %</span>
                      </div>
                      <div style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                        <span>គិតជាភាគរយ: </span>
                        <span class="font-normal" style="font-size: 10px !important;">${currentS2Percent} % ស្រី: ${currentS2FemalePercent} %</span>
                      </div>
                    </div>
                  </div>
                `;
              }

              const classTitleEl = staging.querySelector('#moeys-title-class-name');
              if (classTitleEl) {
                classTitleEl.textContent = currentClassName;
              }

              const displayYear = selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear;
              const yearTitleEl = staging.querySelector('#moeys-title-academic-year');
              if (yearTitleEl) {
                yearTitleEl.textContent = displayYear;
              } else {
                // If saved HTML didn't have id, find title paragraph and update year
                const titleP = staging.querySelector('.moeys-report-document .text-center p') ||
                               Array.from(staging.querySelectorAll('p')).find(p => p.textContent.includes('ថ្នាក់ទី') && p.textContent.includes('ឆ្នាំសិក្សា'));
                if (titleP) {
                  titleP.innerHTML = `ថ្នាក់ទី <span id="moeys-title-class-name" class="font-bold text-primary" style="font-size: 10px !important;">${currentClassName}</span> ឆ្នាំសិក្សា <span id="moeys-title-academic-year" class="font-bold" style="font-size: 10px !important;">${displayYear}</span>`;
                }
              }

              const docLunar = staging.querySelector('#rv-report-lunar-date');
              if (docLunar) {
                docLunar.textContent = formatKhmerLunarDate(selectedReportDate);
              }
              const docSolar = staging.querySelector('#rv-report-solar-date');
              if (docSolar) {
                const rawSolar = formatKhmerSolarDate(selectedReportDate);
                docSolar.textContent = schoolName ? `${schoolName}, ${rawSolar}` : rawSolar;
              }

              // Ensure top-left header block (មន្ទីរអប់រំ..., ខេត្ត..., សាលា...) has default nudge +30px bottom/down
              const topLeftBlock = staging.querySelector('.moeys-report-document .text-left.space-y-0\\.5') || staging.querySelector('.text-left.space-y-0\\.5');
              if (topLeftBlock) {
                Array.from(topLeftBlock.querySelectorAll('p')).forEach(p => {
                  let nudgeBox = p.querySelector('.report-nudge-box') || (p.classList.contains('report-nudge-box') ? p : null);
                  if (!nudgeBox) {
                    const span = document.createElement('span');
                    span.className = 'report-nudge-box';
                    span.style.display = 'inline-block';
                    span.style.position = 'relative';
                    span.style.left = '0px';
                    span.style.top = '30px';
                    span.innerHTML = p.innerHTML;
                    p.innerHTML = '';
                    p.appendChild(span);
                  } else {
                    if (nudgeBox.style.left === '20px') {
                      nudgeBox.style.left = '0px';
                    }
                    if (!nudgeBox.style.top || nudgeBox.style.top === '0px' || nudgeBox.style.top === '20px' || nudgeBox.style.top === '50px') {
                      nudgeBox.style.position = 'relative';
                      nudgeBox.style.top = '30px';
                    }
                  }
                });
              }

              // Sanitize any existing Muol/Moul elements from saved template to ensure flawless Khmer Unicode shaping
              Array.from(staging.querySelectorAll('.font-khmer-muol, [style*="Khmer OS Moul Light"], [style*="Khmer OS Muol Light"], [style*="Moul"]')).forEach(el => {
                el.classList.remove('tracking-wide', 'tracking-tight', 'tracking-wider');
                el.style.setProperty('letter-spacing', 'normal', 'important');
                el.style.removeProperty('font-feature-settings');
                el.style.removeProperty('-webkit-font-feature-settings');
                el.style.removeProperty('font-variant-ligatures');
              });

              // Clean up any unwanted bold styling on parent containers
              Array.from(staging.querySelectorAll('.moeys-report-document, .grid, .flex, div')).forEach(el => {
                el.classList.remove('font-bold');
              });

              // Ensure signature labels: ONLY "ហត្ថលេខាគ្រូបន្ទុកថ្នាក់" is bold, others remain normal
              Array.from(staging.querySelectorAll('p, span')).forEach(el => {
                const text = (el.textContent || '').trim();
                const cleanText = text.replace(/[\s\u200B\u00A0]/g, '');
                if (cleanText === 'នាយក') {
                  el.classList.add('font-khmer-muol');
                  el.classList.remove('font-bold', 'tracking-wide', 'tracking-tight', 'tracking-wider');
                  el.style.setProperty('font-family', "'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif", 'important');
                  el.style.setProperty('font-size', '10px', 'important');
                  el.style.setProperty('line-height', '1.8', 'important');
                  el.style.setProperty('font-weight', 'normal', 'important');
                  el.style.setProperty('letter-spacing', 'normal', 'important');
                } else if (cleanText === 'បានឃើញនិងឯកភាព') {
                  el.classList.remove('font-khmer-muol', 'font-bold');
                  el.style.setProperty('font-family', "'Khmer OS Siemreap', 'Siemreap', sans-serif", 'important');
                  el.style.setProperty('font-size', '10px', 'important');
                  el.style.setProperty('font-weight', 'normal', 'important');
                  if (el.innerHTML.includes('<b>') || el.innerHTML.includes('<strong>')) {
                    el.innerHTML = text;
                  }
                } else if (cleanText === 'ហត្ថលេខាគ្រូបន្ទុកថ្នាក់') {
                  el.classList.remove('font-khmer-muol');
                  el.classList.add('font-bold');
                  el.style.setProperty('font-family', "'Khmer OS Siemreap', 'Siemreap', sans-serif", 'important');
                  el.style.setProperty('font-size', '10px', 'important');
                  el.style.setProperty('font-weight', '700', 'important');
                  if (!el.innerHTML.includes('<b>') && !el.innerHTML.includes('<strong>')) {
                    el.innerHTML = `<b>${text}</b>`;
                  }
                }
              });

              // Ensure report title (បញ្ជីឈ្មោះសិស្សបោះបង់) has no underline and is 12px default
              Array.from(staging.querySelectorAll('h1, h2, h3, p, div')).forEach(el => {
                const cleanText = (el.textContent || '').replace(/[\s\u200B\u00A0]/g, '');
                if (cleanText.includes('បញ្ជីឈ្មោះសិស្សបោះបង់') || cleanText.includes('InactiveStudentReport')) {
                  el.classList.remove('underline', 'decoration-1', 'underline-offset-8');
                  el.style.setProperty('text-decoration', 'none', 'important');
                  el.style.setProperty('font-size', '12px', 'important');
                }
              });

              // Ensure table header text color defaults to pure black (#000000)
              Array.from(staging.querySelectorAll('.moeys-table thead th, .moeys-table thead tr, thead th')).forEach(th => {
                th.classList.remove('text-foreground', 'text-muted-foreground');
                th.classList.add('text-black');
                th.style.setProperty('color', '#000000', 'important');
              });

              // Ensure table layout is 100% responsive across both Landscape and Portrait orientations
              const savedTable = staging.querySelector('.moeys-table') || staging.querySelector('table');
              if (savedTable) {
                savedTable.classList.add('w-full');
                savedTable.style.setProperty('width', '100%', 'important');
                savedTable.style.setProperty('max-width', '100%', 'important');
                savedTable.style.setProperty('table-layout', 'fixed', 'important');
                
                const tableParent = savedTable.parentElement;
                if (tableParent && tableParent.classList.contains('overflow-x-auto')) {
                  tableParent.classList.remove('overflow-x-auto');
                  tableParent.classList.add('w-full');
                }

                // Ensure headers have percentage-based responsive widths
                const ths = savedTable.querySelectorAll('thead th');
                const defaultColWidths = ['5%', '24%', '6%', '13%', '13%', '9%', '18%', '12%'];
                ths.forEach((th, i) => {
                  th.classList.remove('min-w-[150px]', 'min-w-[180px]', 'w-10', 'w-14', 'w-24', 'w-28');
                  th.style.removeProperty('min-width');
                  th.style.removeProperty('max-width');
                  const curW = th.style.width || '';
                  if (!curW || curW.includes('px')) {
                    th.style.setProperty('width', defaultColWidths[i] || 'auto', 'important');
                  }
                });

                savedTable.querySelectorAll('th, td').forEach(cell => {
                  cell.style.setProperty('word-break', 'break-word', 'important');
                  cell.style.setProperty('overflow-wrap', 'break-word', 'important');
                  cell.style.removeProperty('min-width');
                  cell.style.removeProperty('max-width');
                });
              }

              contentContainer.innerHTML = staging.innerHTML;
              return;
            }
          } catch (e) {
            console.warn('Error merging live data into saved template:', e);
          }
        }

        contentContainer.innerHTML = `
          <div class="moeys-report-document max-w-full mx-auto space-y-4 text-[10px]" style="font-size: 10px !important;">
            <!-- Top Header Section (Matching Image 1) -->
            <div class="flex items-start justify-between font-khmer select-none leading-relaxed text-[10px]" style="font-size: 10px !important;">
              <!-- Top Left -->
              <div class="text-left space-y-0.5">
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;"><span class="report-nudge-box" style="display: inline-block; position: relative; left: 0px; top: 30px;">មន្ទីរអប់រំ យុវជន និងកីឡា</span></p>
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;"><span class="report-nudge-box" style="display: inline-block; position: relative; left: 0px; top: 30px;">${getDisplayProvince(schoolProvince)}</span></p>
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;"><span class="report-nudge-box" style="display: inline-block; position: relative; left: 0px; top: 30px;">${schoolName}</span></p>
              </div>

              <!-- Top Right -->
              <div class="text-center space-y-0.5">
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;">ព្រះរាជាណាចក្រកម្ពុជា</p>
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
                <div class="flex justify-center text-muted-foreground font-serif pt-0.5" style="font-size: 10px !important;">~ ~ ~ 🙞 🙞 🙞 ~ ~ ~</div>
              </div>
            </div>

            <!-- Center Title Section -->
            <div class="text-center space-y-1 pt-1 pb-1 font-khmer text-[10px]" style="font-size: 10px !important;">
              <h2 class="font-khmer-muol text-foreground" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 12px !important; letter-spacing: normal !important; line-height: 1.8; text-decoration: none !important;">
                ${isKm ? 'បញ្ជីឈ្មោះសិស្សបោះបង់' : 'Inactive Student Report'}
              </h2>
              <p class="font-semibold text-foreground pt-1" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                ថ្នាក់ទី <span id="moeys-title-class-name" class="font-bold text-primary" style="font-size: 10px !important;">${currentClassName}</span> ឆ្នាំសិក្សា <span id="moeys-title-academic-year" class="font-bold" style="font-size: 10px !important;">${selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear}</span>
              </p>
            </div>

            <!-- Total Beginning of Year (Matching Image 2: Left aligned directly above table with Khmer numerals) -->
            <div id="moeys-count-start" class="font-khmer text-[10px] text-foreground font-medium text-left pt-2 pb-0.5 select-none" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
              <span>ចំនួនសិស្សដើមឆ្នាំ: </span>
              <span class="font-bold text-foreground" style="font-size: 10px !important;">${toKhmerNumerals(currentTotalStart)}</span>
              <span> នាក់ / ស្រី: </span>
              <span class="font-bold text-foreground" style="font-size: 10px !important;">${toKhmerNumerals(currentFemaleStart)}</span>
              <span> នាក់</span>
            </div>

            <!-- Table Structure: Exact 8 Columns with Responsive Percentage Widths -->
            <div class="w-full">
              <table class="moeys-table w-full border-collapse border border-foreground/30 text-[10px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important; width: 100% !important; max-width: 100% !important; table-layout: fixed !important;">
                <thead>
                  <tr class="bg-muted/70 text-black border-b border-foreground/30 font-bold text-center" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-weight: bold !important; font-size: 10px !important; color: #000000 !important;">
                    <th class="px-1 border border-foreground/30 font-bold text-black" style="${viewer?.savedColumnWidths?.[0] ? `width: ${viewer.savedColumnWidths[0]} !important; min-width: ${viewer.savedColumnWidths[0]} !important; max-width: ${viewer.savedColumnWidths[0]} !important;` : 'width: 5% !important;'} font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-weight: bold !important; font-size: 10px !important; color: #000000 !important; word-break: break-word !important;">ល.រ</th>
                    <th class="px-2 border border-foreground/30 text-left font-bold text-black" style="${viewer?.savedColumnWidths?.[1] ? `width: ${viewer.savedColumnWidths[1]} !important; min-width: ${viewer.savedColumnWidths[1]} !important; max-width: ${viewer.savedColumnWidths[1]} !important;` : 'width: 24% !important;'} font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-weight: bold !important; font-size: 10px !important; color: #000000 !important; word-break: break-word !important;">គោត្តនាម និងនាម</th>
                    <th class="px-1 border border-foreground/30 font-bold text-black" style="${viewer?.savedColumnWidths?.[2] ? `width: ${viewer.savedColumnWidths[2]} !important; min-width: ${viewer.savedColumnWidths[2]} !important; max-width: ${viewer.savedColumnWidths[2]} !important;` : 'width: 6% !important;'} font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-weight: bold !important; font-size: 10px !important; color: #000000 !important; word-break: break-word !important;">ភេទ</th>
                    <th class="px-1 border border-foreground/30 font-bold text-black" style="${viewer?.savedColumnWidths?.[3] ? `width: ${viewer.savedColumnWidths[3]} !important; min-width: ${viewer.savedColumnWidths[3]} !important; max-width: ${viewer.savedColumnWidths[3]} !important;` : 'width: 13% !important;'} font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-weight: bold !important; font-size: 10px !important; color: #000000 !important; word-break: break-word !important;">ថ្ងៃខែឆ្នាំកំណើត</th>
                    <th class="px-1 border border-foreground/30 font-bold text-black" style="${viewer?.savedColumnWidths?.[4] ? `width: ${viewer.savedColumnWidths[4]} !important; min-width: ${viewer.savedColumnWidths[4]} !important; max-width: ${viewer.savedColumnWidths[4]} !important;` : 'width: 13% !important;'} font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-weight: bold !important; font-size: 10px !important; color: #000000 !important; word-break: break-word !important;">ថ្ងៃខែឆ្នាំបោះបង់</th>
                    <th class="px-1 border border-foreground/30 font-bold text-black" style="${viewer?.savedColumnWidths?.[5] ? `width: ${viewer.savedColumnWidths[5]} !important; min-width: ${viewer.savedColumnWidths[5]} !important; max-width: ${viewer.savedColumnWidths[5]} !important;` : 'width: 9% !important;'} font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-weight: bold !important; font-size: 10px !important; color: #000000 !important; word-break: break-word !important;">ឆមាស</th>
                    <th class="px-2 border border-foreground/30 text-left font-bold text-black" style="${viewer?.savedColumnWidths?.[6] ? `width: ${viewer.savedColumnWidths[6]} !important; min-width: ${viewer.savedColumnWidths[6]} !important; max-width: ${viewer.savedColumnWidths[6]} !important;` : 'width: 18% !important;'} font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-weight: bold !important; font-size: 10px !important; color: #000000 !important; word-break: break-word !important;">មូលហេតុ</th>
                    <th class="px-1 border border-foreground/30 font-bold text-black" style="${viewer?.savedColumnWidths?.[7] ? `width: ${viewer.savedColumnWidths[7]} !important; min-width: ${viewer.savedColumnWidths[7]} !important; max-width: ${viewer.savedColumnWidths[7]} !important;` : 'width: 12% !important;'} font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-weight: bold !important; font-size: 10px !important; color: #000000 !important; word-break: break-word !important;">ផ្សេងៗ</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-foreground/20" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                  ${currentDroppedStudents.length === 0 ? `
                    <tr style="font-size: 10px !important;">
                      <td colspan="8" class="py-10 text-center text-muted-foreground italic border border-foreground/30" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                        ${isKm ? 'គ្មានទិន្នន័យសិស្សបោះបង់ទេ' : 'No inactive students found'}
                      </td>
                    </tr>
                  ` : currentDroppedStudents.map((s, idx) => buildRowHtml(s, idx)).join('')}
                </tbody>
              </table>
            </div>

            <!-- Footer Statistics Section (Matching Image 2: compact, borderless, natural inline spacing) -->
            <div id="moeys-stats-footer" class="mt-1.5 font-khmer text-[10px] text-foreground select-none leading-normal" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
              <div class="flex flex-wrap items-start justify-start gap-x-8 sm:gap-x-12 gap-y-1" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                <!-- Left column: Total Inactive counts -->
                <div class="space-y-0.5" style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                  <div style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                    <span>ចំនួនសិស្សបោះបង់: </span>
                    <span class="font-normal" style="font-size: 10px !important;">${toKhmerNumerals(currentTotalDropout)} នាក់ / ស្រី: ${toKhmerNumerals(currentFemaleDropout)} នាក់</span>
                  </div>
                  <div style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                    <span>បោះបង់ក្នុងឆមាសទី១: </span>
                    <span class="font-normal" style="font-size: 10px !important;">${toKhmerNumerals(currentS1Total)} នាក់ / ស្រី: ${toKhmerNumerals(currentS1Female)} នាក់</span>
                  </div>
                  <div style="font-family: 'Khmer OS Siemreap', 'Siemreap', 'Kantumruy Pro', sans-serif; font-size: 10px !important;">
                    <span>បោះបង់ក្នុងឆមាសទី២: </span>
                    <span class="font-normal" style="font-size: 10px !important;">${toKhmerNumerals(currentS2Total)} នាក់ / ស្រី: ${toKhmerNumerals(currentS2Female)} នាក់</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    });
  },

  /**
   * Open MoEYS Monthly Score Sheet Modal (តារាងស្រង់ពិន្ទុប្រចាំខែ) in ReportViewer
   */
  async openMonthlyScoreSheetModal() {
    const isKm = i18n.getLocale() === 'km';
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();
    const currentUser = authService.getCurrentUser();

    let classes = [];
    try {
      classes = await ClassService.getAll();
    } catch (_) {}
    if (!classes || classes.length === 0) {
      classes = this.state?.classes || [];
    }

    let academicYears = [];
    try {
      academicYears = await SettingsService.getAcademicYears() || [];
    } catch (_) {}
    if (!academicYears || academicYears.length === 0) {
      academicYears = [{ id: 'ay-1', name: '2025–2026' }, { id: 'ay-2', name: '2024–2025' }];
    }

    let allSchools = [];
    let allProvinces = [];
    let schoolName = '';
    let schoolProvince = 'សៀមរាប';

    const cleanProvinceName = (prov) => {
      if (!prov) return '';
      return String(prov).replace(/\s*\([^)]*\)/g, '').trim();
    };

    const getDisplayProvince = (prov) => {
      const clean = cleanProvinceName(prov);
      if (!clean) return '';
      if (clean.startsWith('រាជធានី') || clean.startsWith('ខេត្ត')) {
        return clean;
      }
      if (clean === 'ភ្នំពេញ') {
        return 'រាជធានីភ្នំពេញ';
      }
      return `ខេត្ត ${clean}`;
    };

    const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);

    try {
      allSchools = await SchoolService.getAllSchools();
      allProvinces = await LocationService.getItems('provinces');
      if (!allProvinces || allProvinces.length === 0) {
        const locData = await LocationService.getAll();
        allProvinces = locData?.provinces || [];
      }
    } catch (_) {}

    if (!allSchools || allSchools.length === 0) {
      allSchools = [
        { name: isKm ? 'សាលាបឋមសិក្សា វត្តបូព៌' : 'Wat Bo Primary School', province: 'សៀមរាប' },
        { name: isKm ? 'អនុវិទ្យាល័យ ហ៊ុន សែន ស្វាយធំ' : 'Hun Sen Svay Thom Secondary School', province: 'សៀមរាប' }
      ];
    }
    if (!allProvinces || allProvinces.length === 0) {
      allProvinces = ['បន្ទាយមានជ័យ', 'បាត់ដំបង', 'កំពង់ចាម', 'កំពង់ឆ្នាំង', 'កំពង់ស្ពឺ', 'កំពង់ធំ', 'កំពត', 'កណ្តាល', 'កោះកុង', 'ក្រចេះ', 'មណ្ឌលគិរី', 'រាជធានីភ្នំពេញ', 'ព្រះវិហារ', 'ព្រៃវែង', 'ពោធិ៍សាត់', 'រតនគិរី', 'សៀមរាប', 'ព្រះសីហនុ', 'ស្ទឹងត្រែង', 'ស្វាយរៀង', 'តាកែវ', 'កែប', 'ប៉ៃលិន', 'ឧត្តរមានជ័យ', 'ត្បូងឃ្មុំ'];
    }

    let savedFilters = {};
    try {
      const rawStored = localStorage.getItem('scoresheet_saved_filters');
      if (rawStored) savedFilters = JSON.parse(rawStored);
    } catch (_) {}

    const defaultSchoolName = (savedFilters.schoolName && allSchools.some(s => s.name === savedFilters.schoolName))
      ? savedFilters.schoolName
      : (currentUser?.school || (allSchools[0]?.name) || (isKm ? 'សាលាបឋមសិក្សា វត្តបូព៌' : 'Wat Bo Primary School'));
    const matchedSchool = allSchools.find(s => s.name === defaultSchoolName);
    const defaultSchoolProvince = matchedSchool?.province || currentUser?.province || (allSchools[0]?.province) || 'សៀមរាប';
    schoolName = defaultSchoolName;
    schoolProvince = defaultSchoolProvince;

    const firstYear = academicYears[0];
    const defaultSelectedYear = (savedFilters.academicYear !== undefined && savedFilters.academicYear !== '')
      ? savedFilters.academicYear
      : ((this.state?.academicYear && this.state.academicYear !== 'all')
          ? this.state.academicYear
          : (typeof firstYear === 'string' ? firstYear : (firstYear?.name || '2025–2026')));
    let selectedYear = defaultSelectedYear;

    let defaultSelectedClassId = isTeacher
      ? (teacherClassId || currentUser?.assignedClass || currentUser?.classId || (classes[0]?.id || 'all'))
      : ((savedFilters.classId !== undefined && savedFilters.classId !== '')
          ? savedFilters.classId
          : ((this.state?.classId && this.state.classId !== 'all') ? this.state.classId : 'all'));
    let selectedClassId = defaultSelectedClassId;

    let selectedMonth = savedFilters.month !== undefined ? savedFilters.month : '';
    let selectedSubject = savedFilters.subject !== undefined ? savedFilters.subject : '';
    let selectedReportDate = new Date();
    if (savedFilters.selectedReportDate) {
      const parsedD = new Date(savedFilters.selectedReportDate);
      if (!isNaN(parsedD.getTime())) {
        selectedReportDate = parsedD;
      }
    }
    let currentClassName = '';

    const persistFilters = () => {
      try {
        localStorage.setItem('scoresheet_saved_filters', JSON.stringify({
          schoolName,
          schoolProvince,
          classId: selectedClassId,
          academicYear: selectedYear,
          month: selectedMonth,
          subject: selectedSubject,
          selectedReportDate: (selectedReportDate instanceof Date) ? selectedReportDate.toISOString() : selectedReportDate
        }));
      } catch (_) {}
    };

    const isStudentInactive = (s) => {
      if (!s) return false;
      const st = String(s.status || '').trim().toLowerCase();
      if (st === 'inactive' || st === 'dropout' || st === 'dropped' || st === 'left') return true;
      const rawStatus = String(s.status || '').trim();
      if (rawStatus.includes('អសកម្ម') || rawStatus.includes('បោះបង់') || rawStatus.includes('ឈប់រៀន') || rawStatus.includes('ផ្អាក')) return true;
      if (s.dropoutDate || s.dropoutReason) return true;
      return false;
    };

    const getStudentDisplayName = (s) => {
      if (!s) return '—';
      const khName = (s.khmerName || `${s.lastName || ''} ${s.firstName || ''}`).trim();
      if (khName) return khName;
      const enName = (s.englishName || `${s.lastNameLatin || ''} ${s.firstNameLatin || ''}`).trim();
      if (enName) return enName;
      return s.name || s.fullName || s['ឈ្មោះ'] || s['ឈ្មោះសិស្ស'] || s['គោត្តនាម និងនាម'] || '—';
    };

    const getGenderAbbr = (s) => {
      if (!s) return '—';
      const g = String(s.gender || '').trim().toLowerCase();
      if (g === 'female' || g === 'f' || s.gender === 'ស្រី') return 'ស';
      if (g === 'male' || g === 'm' || s.gender === 'ប្រុស') return 'ប';
      return s.gender || '—';
    };

    await ReportViewer.open({
      reportKey: 'monthly_score_sheet',
      title: isKm ? 'តារាងស្រង់ពិន្ទុប្រចាំខែ' : 'Monthly Score Sheet',
      alwaysFresh: true,
      defaultOrientation: 'portrait',
      defaultPaperSize: 'A4',
      defaultMargins: { top: 10, bottom: 10, left: 10, right: 10 },
      defaultFontFamily: 'Khmer OS Siemreap',
      defaultFontSize: 10,
      onResetFilters: async (viewer) => {
        try {
          localStorage.removeItem('scoresheet_saved_filters');
        } catch (_) {}
        schoolName = currentUser?.school || (allSchools[0]?.name) || (isKm ? 'សាលាបឋមសិក្សា វត្តបូព៌' : 'Wat Bo Primary School');
        const sch = allSchools.find(s => s.name === schoolName);
        schoolProvince = sch?.province || currentUser?.province || 'សៀមរាប';
        selectedClassId = isTeacher
          ? (teacherClassId || currentUser?.assignedClass || currentUser?.classId || (classes[0]?.id || 'all'))
          : 'all';
        selectedYear = typeof firstYear === 'string' ? firstYear : (firstYear?.name || '2025–2026');
        selectedMonth = '';
        selectedSubject = '';
        selectedReportDate = new Date();
        if (viewer) viewer.customFilterValues = {};

        const schoolSelect = viewer?.overlay?.querySelector('#rv-scoresheet-filter-school');
        if (schoolSelect) schoolSelect.value = schoolName;
        const classSelect = viewer?.overlay?.querySelector('#rv-scoresheet-filter-class');
        if (classSelect) classSelect.value = selectedClassId;
        const yearTriggerText = viewer?.overlay?.querySelector('#rv-scoresheet-year-text');
        if (yearTriggerText) yearTriggerText.textContent = selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear;
        const monthInput = viewer?.overlay?.querySelector('#rv-scoresheet-input-month');
        if (monthInput) monthInput.value = '';
        const subjectInput = viewer?.overlay?.querySelector('#rv-scoresheet-input-subject');
        if (subjectInput) subjectInput.value = '';
        const dateInput = viewer?.overlay?.querySelector('#rv-scoresheet-input-report-date');
        const dateTriggerText = viewer?.overlay?.querySelector('#rv-scoresheet-date-trigger-text');
        const iso = selectedReportDate.toISOString().split('T')[0];
        if (dateInput) dateInput.value = iso;
        if (dateTriggerText) dateTriggerText.textContent = toKhmerNumerals(formatDisplayDate(iso));
      },
      renderHeaderControls: (controlsContainer, viewer) => {
        if (viewer?.customFilterValues) {
          if (viewer.customFilterValues.schoolName && (allSchools.some(s => s.name === viewer.customFilterValues.schoolName) || viewer.customFilterValues.schoolName)) {
            schoolName = viewer.customFilterValues.schoolName;
          }
          if (viewer.customFilterValues.schoolProvince) {
            schoolProvince = viewer.customFilterValues.schoolProvince;
          }
          if (viewer.customFilterValues.classId !== undefined) {
            selectedClassId = viewer.customFilterValues.classId;
          }
          if (viewer.customFilterValues.academicYear !== undefined) {
            selectedYear = viewer.customFilterValues.academicYear;
          }
          if (viewer.customFilterValues.month !== undefined) {
            selectedMonth = viewer.customFilterValues.month;
          }
          if (viewer.customFilterValues.subject !== undefined) {
            selectedSubject = viewer.customFilterValues.subject;
          }
          if (viewer.customFilterValues.selectedReportDate) {
            const parsedD = new Date(viewer.customFilterValues.selectedReportDate);
            if (!isNaN(parsedD.getTime())) {
              selectedReportDate = parsedD;
            }
          }
        }

        const schoolOptsHtml = (allSchools || []).map(s => {
          const isSel = s.name === schoolName;
          return `<option value="${escapeHtml(s.name)}" ${isSel ? 'selected' : ''}>${escapeHtml(s.name)}</option>`;
        }).join('');

        const classOptionsHtml = isTeacher
          ? `<option value="${selectedClassId}">${escapeHtml(classes.find(c => String(c.id).trim() === String(selectedClassId).trim())?.name || selectedClassId)}</option>`
          : `<option value="all">${isKm ? 'គ្រប់ថ្នាក់ទាំងអស់' : 'All Classes'}</option>` +
            classes.map(c => `<option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

        controlsContainer.className = 'flex items-center gap-2 sm:gap-3 flex-wrap font-khmer';
        controlsContainer.innerHTML = `
          <!-- Choose School Name -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'សាលារៀន:' : 'School:'}</span>
            <select id="rv-scoresheet-filter-school" class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs truncate max-w-[150px] sm:max-w-[180px] cursor-pointer box-border" title="${isKm ? 'ជ្រើសរើសសាលារៀន' : 'Select School'}">
              ${schoolOptsHtml || `<option value="${escapeHtml(schoolName)}">${escapeHtml(schoolName || 'វិទ្យាល័យ')}</option>`}
            </select>
          </div>

          <!-- Class Filter -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'ថ្នាក់រៀន:' : 'Class:'}</span>
            <select id="rv-scoresheet-filter-class" class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs truncate cursor-pointer box-border" title="${isKm ? 'ជ្រើសរើសថ្នាក់' : 'Select Class'}">
              ${classOptionsHtml}
            </select>
          </div>

          <!-- Academic Year Trigger & Popover -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'ឆ្នាំសិក្សា:' : 'Year:'}</span>
            <div id="rv-scoresheet-year-group" class="relative">
              <button type="button" 
                      id="rv-btn-year-trigger" 
                      class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center justify-between gap-1.5 shadow-xs cursor-pointer min-w-[110px] max-w-[160px] box-border" 
                      title="${isKm ? 'ជ្រើសរើស ឬបន្ថែមឆ្នាំសិក្សា' : 'Select or Add Academic Year'}">
                <span id="rv-scoresheet-year-text" class="truncate">${selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear}</span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 rv-year-chevron')}
              </button>
              <div id="rv-popover-year-menu" class="hidden absolute top-9 left-0 z-50 w-72 p-2.5 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-2 font-khmer select-none box-border animate-slide-down">
                <div class="flex items-center gap-1.5 border-b border-border pb-1.5 w-full box-border">
                  <input type="text" id="rv-input-new-year" placeholder="${isKm ? 'បញ្ចូលឆ្នាំថ្មី... (2025–2026)' : 'New year (2025–2026)...'}" class="flex-1 min-w-0 h-8 px-2.5 bg-background border border-input rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border" />
                  <button type="button" id="rv-btn-add-year" class="h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors flex-shrink-0 cursor-pointer whitespace-nowrap">${getIcon('plus', 'w-3.5 h-3.5')}<span>${isKm ? 'បន្ថែម' : 'Add'}</span></button>
                </div>
                <div class="max-h-48 overflow-y-auto divide-y divide-border/20 rounded-md border border-border/40 bg-background/50 p-0.5 space-y-0.5" id="rv-scoresheet-year-list"></div>
              </div>
            </div>
          </div>

          <!-- Choose Report Date (Khmer Lunar & Solar Date Picker) -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'កាលបរិច្ឆេទ:' : 'Date:'}</span>
            <div id="rv-scoresheet-date-dropdown-container" class="relative">
              <!-- Trigger Button -->
              <button type="button" 
                      id="rv-scoresheet-btn-date-trigger" 
                      class="h-8 py-0 leading-[30px] px-2.5 rounded-md border border-input bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center justify-between gap-1.5 shadow-xs cursor-pointer min-w-[125px] max-w-[170px] box-border" 
                      title="${isKm ? 'ជ្រើសរើសកាលបរិច្ឆេទ (ចន្ទគតិ & សុរិយគតិ)' : 'Select Date (Khmer Lunar & Solar)'}">
                <span class="flex items-center gap-1.5 truncate">
                  ${getIcon('calendar', 'w-3.5 h-3.5 text-primary flex-shrink-0')}
                  <span id="rv-scoresheet-date-trigger-text" class="truncate">${toKhmerNumerals(formatDisplayDate(selectedReportDate.toISOString().split('T')[0]))}</span>
                </span>
                ${getIcon('chevronDown', 'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 rv-scoresheet-date-chevron')}
              </button>

              <!-- Dropdown Popover Menu -->
              <div id="rv-scoresheet-popover-date-menu" 
                   class="hidden absolute right-0 top-[calc(100%+4px)] z-[80] w-80 p-3 bg-card text-card-foreground border border-border rounded-xl shadow-xl space-y-3 font-khmer select-none animate-slide-down box-border">
                
                <div class="flex items-center justify-between border-b border-border/50 pb-2">
                  <span class="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    ${getIcon('calendar', 'w-4 h-4 text-primary')}
                    <span>${isKm ? 'ជ្រើសរើសកាលបរិច្ឆេទ' : 'Select Report Date'}</span>
                  </span>
                  <button type="button" 
                          id="rv-scoresheet-btn-date-today" 
                          class="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer">
                    ${isKm ? 'ថ្ងៃនេះ' : 'Today'}
                  </button>
                </div>

                <!-- Date Input -->
                <div class="space-y-1">
                  <label class="text-[11px] text-muted-foreground">${isKm ? 'កាលបរិច្ឆេទសុរិយគតិ:' : 'Solar Date:'}</label>
                  <input type="date" 
                         id="rv-scoresheet-input-report-date" 
                         value="${selectedReportDate.toISOString().split('T')[0]}"
                         class="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary box-border cursor-pointer" />
                </div>

                <!-- Live Preview Cards -->
                <div class="space-y-2 pt-1">
                  <!-- Lunar Preview -->
                  <div class="p-2.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-primary font-semibold">
                      <span>${isKm ? 'ចន្ទគតិ' : 'Khmer Lunar Date'}</span>
                      ${getIcon('moon', 'w-3.5 h-3.5')}
                    </div>
                    <p id="rv-scoresheet-preview-lunar-text" class="text-xs text-foreground font-medium break-words leading-relaxed">
                      ${formatKhmerLunarDate(selectedReportDate)}
                    </p>
                    <button type="button" 
                            id="rv-scoresheet-btn-insert-lunar-text" 
                            class="mt-1.5 w-full py-1 px-2 rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="${isKm ? 'បញ្ចូលត្រង់ទស្សន៍ទ្រនិច ឬជំនួសអត្ថបទដែលបាន Highlight ក្នុងរបាយការណ៍' : 'Insert at cursor or replace highlighted text in report'}">
                      ${getIcon('plus', 'w-3 h-3')}
                      <span>${isKm ? '+ បញ្ចូលត្រង់ទស្សន៍ទ្រនិច' : '+ Insert at Cursor'}</span>
                    </button>
                  </div>

                  <!-- Solar Preview -->
                  <div class="p-2.5 rounded-lg border border-border/60 bg-muted/30 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                      <span>${isKm ? 'សុរិយគតិ' : 'Khmer Solar Date'}</span>
                      ${getIcon('sun', 'w-3.5 h-3.5')}
                    </div>
                    <p id="rv-scoresheet-preview-solar-text" class="text-xs text-foreground font-medium break-words leading-relaxed">
                      ${schoolName ? `${schoolName}, ` : ''}${formatKhmerSolarDate(selectedReportDate)}
                    </p>
                    <button type="button" 
                            id="rv-scoresheet-btn-insert-solar-text" 
                            class="mt-1.5 w-full py-1 px-2 rounded border border-border bg-card hover:bg-muted text-foreground text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="${isKm ? 'បញ្ចូលត្រង់ទស្សន៍ទ្រនិច ឬជំនួសអត្ថបទដែលបាន Highlight ក្នុងរបាយការណ៍' : 'Insert at cursor or replace highlighted text in report'}">
                      ${getIcon('plus', 'w-3 h-3')}
                      <span>${isKm ? '+ បញ្ចូលត្រង់ទស្សន៍ទ្រនិច' : '+ Insert at Cursor'}</span>
                    </button>
                  </div>
                </div>

                <div class="pt-1 flex flex-col gap-1.5">
                  <button type="button" 
                          id="rv-scoresheet-btn-insert-both-text" 
                          class="w-full h-7 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="${isKm ? 'បញ្ចូលកាលបរិច្ឆេទទាំង២ ត្រង់ទស្សន៍ទ្រនិច ឬជំនួសអត្ថបទដែលបាន Highlight' : 'Insert both dates at cursor or replace highlighted text'}">
                    ${getIcon('type', 'w-3.5 h-3.5')}
                    <span>${isKm ? '+ បញ្ចូលទាំង២ ត្រង់ទស្សន៍ទ្រនិច' : '+ Insert Both at Cursor'}</span>
                  </button>
                  <button type="button" 
                          id="rv-scoresheet-btn-date-apply" 
                          class="w-full h-8 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer">
                    ${getIcon('check', 'w-3.5 h-3.5')}
                    <span>${isKm ? 'យល់ព្រម (Apply)' : 'Apply'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Month Input -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'ប្រចាំខែ:' : 'Month:'}</span>
            <input type="text" 
                   id="rv-scoresheet-input-month" 
                   placeholder="${isKm ? 'ខែ...' : 'Month...'}" 
                   value="${escapeHtml(selectedMonth)}"
                   class="h-8 py-0 leading-[30px] w-20 px-2 rounded-md border border-input bg-card text-xs font-medium text-foreground placeholder:text-muted-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-ring box-border" />
          </div>

          <!-- Subject Input -->
          <div class="flex items-center gap-1.5 text-xs font-khmer">
            <span class="text-muted-foreground whitespace-nowrap">${isKm ? 'មុខវិជ្ជា:' : 'Subject:'}</span>
            <input type="text" 
                   id="rv-scoresheet-input-subject" 
                   placeholder="${isKm ? 'មុខវិជ្ជា...' : 'Subject...'}" 
                   value="${escapeHtml(selectedSubject)}"
                   class="h-8 py-0 leading-[30px] w-28 px-2 rounded-md border border-input bg-card text-xs font-medium text-foreground placeholder:text-muted-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-ring box-border" />
          </div>

          <!-- Export Excel Button -->
          <button type="button" 
                  id="rv-btn-scoresheet-export-excel" 
                  class="h-8 py-0 leading-[30px] px-3 rounded-md border border-input bg-card hover:bg-muted text-emerald-600 dark:text-emerald-400 text-xs font-medium transition-colors flex items-center gap-1.5 font-khmer shadow-xs cursor-pointer select-none box-border"
                  title="${isKm ? 'ទាញយកតារាងពិន្ទុជា Excel' : 'Export Score Sheet to Excel'}">
            ${getIcon('fileSpreadsheet', 'w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400')}
            <span>Excel</span>
          </button>
        `;

        // School select binding
        const schoolSelect = controlsContainer.querySelector('#rv-scoresheet-filter-school');
        schoolSelect?.addEventListener('change', async (e) => {
          schoolName = e.target.value;
          const matched = allSchools.find(s => s.name === schoolName);
          if (matched && matched.province) {
            schoolProvince = matched.province;
            if (viewer) viewer.customFilterValues.schoolProvince = schoolProvince;
          }
          persistFilters();
          updateDateDisplay(selectedReportDate);
          if (viewer) {
            viewer.customFilterValues.schoolName = schoolName;
            await viewer.refreshContent(false);
          }
        });

        // Class select
        const classSelect = controlsContainer.querySelector('#rv-scoresheet-filter-class');
        classSelect?.addEventListener('change', async (e) => {
          selectedClassId = e.target.value;
          persistFilters();
          if (viewer) {
            viewer.customFilterValues.classId = selectedClassId;
            await viewer.refreshContent(false);
          }
        });

        // Academic Year Popover Setup
        const yearTriggerBtn = controlsContainer.querySelector('#rv-btn-year-trigger');
        const yearTriggerText = controlsContainer.querySelector('#rv-scoresheet-year-text');
        const yearChevron = controlsContainer.querySelector('.rv-year-chevron');
        const yearMenu = controlsContainer.querySelector('#rv-popover-year-menu');
        const yearListEl = controlsContainer.querySelector('#rv-scoresheet-year-list');
        const yearInputEl = controlsContainer.querySelector('#rv-input-new-year');
        const yearAddBtn = controlsContainer.querySelector('#rv-btn-add-year');

        const updateYearTrigger = () => {
          if (yearTriggerText) {
            yearTriggerText.textContent = selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear;
          }
        };

        const renderYearList = () => {
          if (!yearListEl) return;
          const isAllSelected = selectedYear === 'all';
          let html = `
            <div class="rv-scoresheet-year-item flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent text-xs group cursor-pointer transition-colors ${isAllSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground italic'}" data-year="all">
              <span class="truncate flex-1">${isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years'}</span>
            </div>
          `;

          html += academicYears.map(y => {
            const yName = typeof y === 'string' ? y : (y.name || y.id || '');
            const isSelected = String(selectedYear).trim().toLowerCase() === String(yName).trim().toLowerCase();
            return `
              <div class="rv-scoresheet-year-item flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent text-xs group cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}" data-year="${escapeHtml(yName)}">
                <span class="truncate flex-1 pr-1.5">${escapeHtml(yName)}</span>
                <button type="button" 
                        class="rv-btn-delete-year p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100 cursor-pointer" 
                        title="${isKm ? 'លុបឆ្នាំសិក្សា' : 'Delete'}" 
                        data-year="${escapeHtml(yName)}">
                  ${getIcon('trash', 'w-3 h-3')}
                </button>
              </div>
            `;
          }).join('');

          yearListEl.innerHTML = html;
        };

        renderYearList();
        updateYearTrigger();

        yearTriggerBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          dateMenu?.classList.add('hidden');
          dateChevron?.classList.remove('rotate-180');
          const isHidden = yearMenu?.classList.contains('hidden');
          if (isHidden) {
            yearMenu?.classList.remove('hidden');
            yearChevron?.classList.add('rotate-180');
            yearInputEl?.focus();
          } else {
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
          }
        });

        yearMenu?.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        const handleAddYear = async () => {
          const val = (yearInputEl?.value || '').trim();
          if (!val) {
            yearInputEl?.focus();
            return;
          }
          try {
            const created = await SettingsService.createAcademicYear({ name: val });
            academicYears = await SettingsService.getAcademicYears() || [];
            selectedYear = created?.name || val;
            persistFilters();
            if (yearInputEl) yearInputEl.value = '';
            updateYearTrigger();
            renderYearList();
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
            if (viewer) {
              viewer.customFilterValues.academicYear = selectedYear;
              await viewer.refreshContent(false);
            }
            toast.success(isKm ? 'បានបន្ថែមឆ្នាំសិក្សាដោយជោគជ័យ' : 'Academic year added successfully');
          } catch (err) {
            toast.error(err.message || String(err));
          }
        };

        yearAddBtn?.addEventListener('click', handleAddYear);
        yearInputEl?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddYear();
          }
        });

        yearListEl?.addEventListener('click', async (e) => {
          const delBtn = e.target.closest('.rv-btn-delete-year');
          if (delBtn) {
            e.stopPropagation();
            const valToDelete = delBtn.getAttribute('data-year');
            if (!valToDelete) return;
            try {
              await SettingsService.deleteAcademicYear(valToDelete);
              academicYears = await SettingsService.getAcademicYears() || [];
              if (String(selectedYear).trim().toLowerCase() === String(valToDelete).trim().toLowerCase()) {
                const first = academicYears[0];
                selectedYear = first ? (typeof first === 'string' ? first : (first.name || 'all')) : 'all';
                persistFilters();
                if (viewer) viewer.customFilterValues.academicYear = selectedYear;
                updateYearTrigger();
                if (viewer) await viewer.refreshContent(false);
              }
              renderYearList();
              toast.success(isKm ? 'បានលុបឆ្នាំសិក្សាដោយជោគជ័យ' : 'Academic year deleted successfully');
            } catch (err) {
              toast.error(err.message || String(err));
            }
            return;
          }

          const row = e.target.closest('.rv-scoresheet-year-item');
          if (row) {
            const val = row.getAttribute('data-year');
            if (val !== null && val !== undefined) {
              selectedYear = val;
              persistFilters();
              updateYearTrigger();
              renderYearList();
              yearMenu?.classList.add('hidden');
              yearChevron?.classList.remove('rotate-180');
              if (viewer) {
                viewer.customFilterValues.academicYear = selectedYear;
                await viewer.refreshContent(false);
              }
            }
          }
        });

        // 4. Date Dropdown Elements and Logic (Khmer Lunar & Solar)
        const dateTriggerBtn = controlsContainer.querySelector('#rv-scoresheet-btn-date-trigger');
        const dateTriggerText = controlsContainer.querySelector('#rv-scoresheet-date-trigger-text');
        const dateChevron = controlsContainer.querySelector('.rv-scoresheet-date-chevron');
        const dateMenu = controlsContainer.querySelector('#rv-scoresheet-popover-date-menu');
        const dateInput = controlsContainer.querySelector('#rv-scoresheet-input-report-date');
        const dateTodayBtn = controlsContainer.querySelector('#rv-scoresheet-btn-date-today');
        const dateApplyBtn = controlsContainer.querySelector('#rv-scoresheet-btn-date-apply');
        const previewLunarText = controlsContainer.querySelector('#rv-scoresheet-preview-lunar-text');
        const previewSolarText = controlsContainer.querySelector('#rv-scoresheet-preview-solar-text');

        const updateDateDisplay = (newDate) => {
          selectedReportDate = (newDate instanceof Date) ? newDate : new Date(newDate);
          if (isNaN(selectedReportDate.getTime())) selectedReportDate = new Date();
          const iso = selectedReportDate.toISOString().split('T')[0];
          if (dateInput) dateInput.value = iso;
          if (dateTriggerText) {
            dateTriggerText.textContent = toKhmerNumerals(formatDisplayDate(iso));
          }
          const lunarStr = formatKhmerLunarDate(selectedReportDate);
          const rawSolar = formatKhmerSolarDate(selectedReportDate);
          const solarStr = schoolName ? `${schoolName}, ${rawSolar}` : rawSolar;
          if (previewLunarText) previewLunarText.textContent = lunarStr;
          if (previewSolarText) previewSolarText.textContent = solarStr;

          if (viewer && viewer.overlay) {
            const docLunar = viewer.overlay.querySelector('#score-sheet-lunar-date, #rv-report-lunar-date');
            if (docLunar) {
              docLunar.textContent = lunarStr;
              docLunar.classList.remove('text-muted-foreground');
              docLunar.classList.add('text-foreground');
              docLunar.style.setProperty('color', '#000000', 'important');
            }
            const docSolar = viewer.overlay.querySelector('#score-sheet-solar-date, #rv-report-solar-date');
            if (docSolar) {
              docSolar.textContent = solarStr;
              docSolar.classList.remove('text-muted-foreground');
              docSolar.classList.add('text-foreground');
              docSolar.style.setProperty('color', '#000000', 'important');
            }
          }
          persistFilters();
        };

        const insertLunarBtn = controlsContainer.querySelector('#rv-scoresheet-btn-insert-lunar-text');
        const insertSolarBtn = controlsContainer.querySelector('#rv-scoresheet-btn-insert-solar-text');
        const insertBothBtn = controlsContainer.querySelector('#rv-scoresheet-btn-insert-both-text');

        [dateTriggerBtn, dateTodayBtn, dateApplyBtn, insertLunarBtn, insertSolarBtn, insertBothBtn].forEach(btn => {
          btn?.addEventListener('mousedown', (e) => {
            e.preventDefault();
          });
        });

        dateTriggerBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          yearMenu?.classList.add('hidden');
          yearChevron?.classList.remove('rotate-180');

          const isClosed = dateMenu?.classList.contains('hidden');
          dateMenu?.classList.toggle('hidden');
          dateChevron?.classList.toggle('rotate-180', isClosed);
        });

        dateMenu?.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        dateInput?.addEventListener('input', () => {
          if (dateInput.value) {
            const [y, m, d] = dateInput.value.split('-').map(Number);
            const dObj = new Date(y, m - 1, d);
            updateDateDisplay(dObj);
            if (viewer) viewer.customFilterValues.selectedReportDate = selectedReportDate.toISOString();
          }
        });

        dateTodayBtn?.addEventListener('click', () => {
          updateDateDisplay(new Date());
          if (viewer) viewer.customFilterValues.selectedReportDate = selectedReportDate.toISOString();
        });

        dateApplyBtn?.addEventListener('click', () => {
          dateMenu?.classList.add('hidden');
          dateChevron?.classList.remove('rotate-180');
          updateDateDisplay(selectedReportDate);
          if (viewer) viewer.customFilterValues.selectedReportDate = selectedReportDate.toISOString();
          viewer?.saveStateForUndo?.();
          viewer?.autoSaveIfEnabled?.();
        });

        insertLunarBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          const lunarStr = formatKhmerLunarDate(selectedReportDate);
          let handled = false;
          if (viewer && typeof viewer.insertTextAtSelection === 'function') {
            handled = viewer.insertTextAtSelection(lunarStr);
          }
          if (!handled) {
            const docLunar = viewer?.overlay?.querySelector('#score-sheet-lunar-date, #rv-report-lunar-date');
            if (docLunar) {
              viewer?.saveStateForUndo?.();
              docLunar.textContent = lunarStr;
              handled = true;
            }
          }
          if (handled) {
            persistFilters();
            viewer?.savePreset?.(false);
            toast.success(isKm ? 'បានបញ្ចូលកាលបរិច្ឆេទចន្ទគតិ' : 'Inserted Khmer Lunar date');
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          } else {
            toast.info(isKm ? 'សូមចុចលើទីតាំង ឬជ្រើសរើស (Highlight) អត្ថបទក្នុងរបាយការណ៍ជាមុនសិន' : 'Please click where you want to insert or highlight text first');
          }
        });

        insertSolarBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          const rawSolar = formatKhmerSolarDate(selectedReportDate);
          const solarStr = schoolName ? `${schoolName}, ${rawSolar}` : rawSolar;
          let handled = false;
          if (viewer && typeof viewer.insertTextAtSelection === 'function') {
            handled = viewer.insertTextAtSelection(solarStr);
          }
          if (!handled) {
            const docSolar = viewer?.overlay?.querySelector('#score-sheet-solar-date, #rv-report-solar-date');
            if (docSolar) {
              viewer?.saveStateForUndo?.();
              docSolar.textContent = solarStr;
              handled = true;
            }
          }
          if (handled) {
            persistFilters();
            viewer?.savePreset?.(false);
            toast.success(isKm ? 'បានបញ្ចូលកាលបរិច្ឆេទសុរិយគតិ' : 'Inserted Khmer Solar date');
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          } else {
            toast.info(isKm ? 'សូមចុចលើទីតាំង ឬជ្រើសរើស (Highlight) អត្ថបទក្នុងរបាយការណ៍ជាមុនសិន' : 'Please click where you want to insert or highlight text first');
          }
        });

        insertBothBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          const lunarStr = formatKhmerLunarDate(selectedReportDate);
          const rawSolar = formatKhmerSolarDate(selectedReportDate);
          const solarStr = schoolName ? `${schoolName}, ${rawSolar}` : rawSolar;
          const bothHtml = `${lunarStr}<br>${solarStr}`;
          let handled = false;
          if (viewer && typeof viewer.insertTextAtSelection === 'function') {
            handled = viewer.insertTextAtSelection(bothHtml, { isHtml: true });
          }
          if (handled) {
            persistFilters();
            viewer?.savePreset?.(false);
            toast.success(isKm ? 'បានបញ្ចូលកាលបរិច្ឆេទទាំង២' : 'Inserted both dates');
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          } else {
            toast.info(isKm ? 'សូមចុចលើទីតាំង ឬជ្រើសរើស (Highlight) អត្ថបទក្នុងរបាយការណ៍ជាមុនសិន' : 'Please click where you want to insert or highlight text first');
          }
        });

        // Month & Subject inputs (Persisted automatically until user clears the textbox)
        const monthInput = controlsContainer.querySelector('#rv-scoresheet-input-month');
        monthInput?.addEventListener('input', (e) => {
          selectedMonth = e.target.value.trim();
          persistFilters();
          if (viewer) viewer.customFilterValues.month = selectedMonth;
          const mLabel = viewer?.overlay?.querySelector('#score-sheet-month-label');
          if (mLabel) mLabel.textContent = selectedMonth ? selectedMonth : '.........................';
          viewer?.saveStateForUndo?.();
          viewer?.autoSaveIfEnabled?.();
        });

        const subjectInput = controlsContainer.querySelector('#rv-scoresheet-input-subject');
        subjectInput?.addEventListener('input', (e) => {
          selectedSubject = e.target.value.trim();
          persistFilters();
          if (viewer) viewer.customFilterValues.subject = selectedSubject;
          const sLabel = viewer?.overlay?.querySelector('#score-sheet-subject-label');
          if (sLabel) sLabel.textContent = selectedSubject ? selectedSubject : '...........................';
          viewer?.saveStateForUndo?.();
          viewer?.autoSaveIfEnabled?.();
        });

        // 5. Excel export button
        const btnExcel = controlsContainer.querySelector('#rv-btn-scoresheet-export-excel, #rv-scoresheet-btn-export-excel');
        btnExcel?.addEventListener('click', async () => {
          let allStudents = [];
          try {
            allStudents = await StudentService.getAll();
          } catch (_) {}
          if (!allStudents || allStudents.length === 0) {
            allStudents = this.state?.students || [];
          }
          const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
          let studentsInScope = allStudents;
          if (selectedClassId && selectedClassId !== 'all') {
            studentsInScope = studentsInScope.filter(s => String(s.classId || '').trim() === String(selectedClassId).trim());
          }
          if (selectedYear && selectedYear !== 'all') {
            studentsInScope = studentsInScope.filter(s => normDash(s.academicYear) === normDash(selectedYear));
          }
          const activeStudents = studentsInScope.filter(s => !isStudentInactive(s));
          const sortedStudents = [...activeStudents].sort((a, b) => {
            const nameA = getStudentDisplayName(a);
            const nameB = getStudentDisplayName(b);
            return nameA.localeCompare(nameB, 'km');
          });

          const foundClass = classes.find(c => String(c.id).trim() === String(selectedClassId).trim());
          const className = foundClass ? foundClass.name : (selectedClassId === 'all' ? (isKm ? 'គ្រប់ថ្នាក់ទាំងអស់' : 'All Classes') : selectedClassId);
          const displayYear = selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear;

          const headers = ['ល.រ', 'អត្តលេខ', 'គោត្តនាម និងនាម', 'ភេទ', 'ពិន្ទុ', 'ផ្សេងៗ'];
          const dataRows = sortedStudents.map((s, idx) => [
            idx + 1,
            s.student_id || s.code || s.studentId || '',
            getStudentDisplayName(s),
            s.gender === 'female' || s.gender === 'F' ? 'ស្រី' : 'ប្រុស',
            '',
            ''
          ]);

          const ws = XLSX.utils.aoa_to_sheet([
            [`${isKm ? 'តារាងស្រង់ពិន្ទុប្រចាំខែ' : 'Monthly Score Sheet'} ${selectedMonth ? `ប្រចាំខែ ${selectedMonth}` : ''}`],
            [`សាលារៀន: ${schoolName} / ${getDisplayProvince(schoolProvince)}`],
            [`មុខវិជ្ជា: ${selectedSubject || '—'} | ថ្នាក់ទី: ${className} | ឆ្នាំសិក្សា: ${displayYear}`],
            [],
            headers,
            ...dataRows
          ]);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, isKm ? 'តារាងពិន្ទុ' : 'Score Sheet');
          XLSX.writeFile(wb, `Score_Sheet_${className}_${selectedMonth || 'month'}.xlsx`);
          toast.success(isKm ? 'បានទាញយក Excel ដោយជោគជ័យ' : 'Excel exported successfully');
        });

        // Global dismiss for custom dropdown menus on click outside
        const onGlobalClick = (e) => {
          if (!controlsContainer.contains(e.target)) {
            yearMenu?.classList.add('hidden');
            yearChevron?.classList.remove('rotate-180');
            dateMenu?.classList.add('hidden');
            dateChevron?.classList.remove('rotate-180');
          }
        };
        document.addEventListener('click', onGlobalClick);
      },
      renderContent: async (contentContainer, viewer) => {
        contentContainer.innerHTML = `
          <div class="py-12 flex items-center justify-center gap-2 text-muted-foreground text-xs font-khmer">
            <div class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            <span>កំពុងទាញយកទិន្នន័យ...</span>
          </div>
        `;

        let allStudents = [];
        try {
          allStudents = await StudentService.getAll();
        } catch (_) {}
        if (!allStudents || allStudents.length === 0) {
          allStudents = this.state?.students || [];
        }

        const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();

        let studentsInScope = allStudents;
        if (selectedClassId && selectedClassId !== 'all') {
          studentsInScope = studentsInScope.filter(s => String(s.classId || '').trim() === String(selectedClassId).trim());
        }
        if (selectedYear && selectedYear !== 'all') {
          studentsInScope = studentsInScope.filter(s => normDash(s.academicYear) === normDash(selectedYear));
        }

        // Active students only
        const activeStudents = studentsInScope.filter(s => !isStudentInactive(s));

        // Sort students alphabetically by Khmer name
        const sortedStudents = [...activeStudents].sort((a, b) => {
          const nameA = getStudentDisplayName(a);
          const nameB = getStudentDisplayName(b);
          return nameA.localeCompare(nameB, 'km');
        });

        const foundClass = classes.find(c => String(c.id).trim() === String(selectedClassId).trim());
        currentClassName = foundClass ? foundClass.name : (selectedClassId === 'all' ? (isKm ? 'គ្រប់ថ្នាក់ទាំងអស់' : 'All Classes') : selectedClassId);
        const displayYear = selectedYear === 'all' ? (isKm ? 'គ្រប់ឆ្នាំសិក្សា' : 'All Years') : selectedYear;

        // Build row helper function
        const buildRow = (s, idx) => {
          const khmerNum = toKhmerNumerals(idx + 1);
          const studentCode = s.student_id || s.code || s.studentId || '';
          const fullName = getStudentDisplayName(s);
          const genderText = s.gender === 'female' || s.gender === 'F' ? 'ស្រី' : 'ប្រុស';

          return `
            <tr class="score-sheet-row hover:bg-muted/30 border-b border-border/50 text-[10px]" data-student-id="${s.id || ''}" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-size: 10px !important;">
              <td class="px-1 py-1 text-center font-khmer font-medium border border-black select-none whitespace-nowrap" style="width: 9% !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;">${khmerNum}</td>
              <td class="px-1 py-1 text-center font-mono border border-black select-none whitespace-nowrap" style="width: 17% !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;">${studentCode}</td>
              <td class="px-1.5 py-1 text-left font-khmer border border-black truncate" style="width: 38% !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;" title="${fullName}">${fullName}</td>
              <td class="px-1 py-1 text-center font-khmer border border-black whitespace-nowrap" style="width: 9% !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;">${genderText}</td>
              <td class="px-1 py-1 text-center font-medium border border-black whitespace-nowrap" style="width: 13% !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;"></td>
              <td class="px-1 py-1 text-center font-medium border border-black whitespace-nowrap" style="width: 14% !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;"></td>
            </tr>
          `;
        };

        // Build table rows: split into dual columns (left & right)
        const halfCount = Math.max(1, Math.ceil(sortedStudents.length / 2));
        const leftStudents = sortedStudents.slice(0, halfCount);
        const rightStudents = sortedStudents.slice(halfCount);

        const leftRowsHtml = leftStudents.length === 0 ? `
          <tr class="border-b border-border/50" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-size: 10px !important;">
            <td colspan="6" class="py-6 text-center text-muted-foreground italic border border-black text-[10px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;">
              ${isKm ? 'គ្មានទិន្នន័យសិស្សទេ' : 'No student data'}
            </td>
          </tr>
        ` : leftStudents.map((s, idx) => buildRow(s, idx)).join('');

        const rightRowsHtml = rightStudents.map((s, idx) => buildRow(s, halfCount + idx)).join('');

        const theadHtml = `
          <tr style="background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important;">
            <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 9% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;">ល.រ</th>
            <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 17% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;">អត្តលេខ</th>
            <th class="px-1.5 py-1 text-center whitespace-nowrap" style="width: 38% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;">គោត្តនាម និងនាម</th>
            <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 9% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;">ភេទ</th>
            <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 13% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;">ពិន្ទុ</th>
            <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 14% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; padding: 4px !important; border: 1px solid #000000 !important;">ផ្សេងៗ</th>
          </tr>
        `;

        // If saved HTML exists, merge dynamic data into it
        if (viewer && (viewer.savedHtmlContent || viewer.savedHtml)) {
          try {
            const staging = document.createElement('div');
            staging.innerHTML = viewer.savedHtmlContent || viewer.savedHtml;

            const leftTable = staging.querySelector('#score-sheet-left-table');
            const rightTable = staging.querySelector('#score-sheet-right-table');

            if (leftTable && rightTable) {
              const leftThead = leftTable.querySelector('thead');
              if (leftThead) leftThead.innerHTML = theadHtml;
              const rightThead = rightTable.querySelector('thead');
              if (rightThead) rightThead.innerHTML = theadHtml;

              const leftTbody = leftTable.querySelector('tbody');
              const rightTbody = rightTable.querySelector('tbody');
              if (leftTbody) leftTbody.innerHTML = leftRowsHtml;
              if (rightTbody) rightTbody.innerHTML = rightRowsHtml;

              Array.from(staging.querySelectorAll('.score-sheet-table th')).forEach(el => {
                el.style.setProperty('background-color', '#0045ff', 'important');
                el.style.setProperty('color', '#ffffff', 'important');
                el.style.setProperty('font-family', "'Khmer OS Siemreap', 'Siemreap', sans-serif", 'important');
                el.style.setProperty('font-size', '10px', 'important');
                el.style.setProperty('padding', '4px', 'important');
              });

              Array.from(staging.querySelectorAll('.score-sheet-table, .score-sheet-table td')).forEach(el => {
                el.style.setProperty('font-family', "'Khmer OS Siemreap', 'Siemreap', sans-serif", 'important');
                el.style.setProperty('font-size', '10px', 'important');
                el.style.setProperty('padding', '4px', 'important');
              });

              const titleEl = staging.querySelector('h2');
              if (titleEl) {
                const monthSpan = titleEl.querySelector('#score-sheet-month-label') || titleEl;
                if (monthSpan) monthSpan.textContent = selectedMonth ? selectedMonth : '.........................';
              }

              const metaRow = staging.querySelector('.score-sheet-container .flex.items-center.justify-center') || staging.querySelector('.flex.items-center.justify-center');
              if (metaRow) {
                const clsLabel = metaRow.querySelector('#score-sheet-class-label');
                if (clsLabel) clsLabel.textContent = currentClassName;
                const yrLabel = metaRow.querySelector('#score-sheet-year-label');
                if (yrLabel) yrLabel.textContent = displayYear;
                const mLabel = metaRow.querySelector('#score-sheet-month-label');
                if (mLabel) mLabel.textContent = selectedMonth ? selectedMonth : '.........................';
                const sLabel = metaRow.querySelector('#score-sheet-subject-label');
                if (sLabel) sLabel.textContent = selectedSubject ? selectedSubject : '...........................';
              } else {
                const clsLabel = staging.querySelector('#score-sheet-class-label');
                if (clsLabel) clsLabel.textContent = currentClassName;
                const yrLabel = staging.querySelector('#score-sheet-year-label');
                if (yrLabel) yrLabel.textContent = displayYear;
                const mLabel = staging.querySelector('#score-sheet-month-label');
                if (mLabel) mLabel.textContent = selectedMonth ? selectedMonth : '.........................';
                const sLabel = staging.querySelector('#score-sheet-subject-label');
                if (sLabel) sLabel.textContent = selectedSubject ? selectedSubject : '...........................';
              }

              const topLeftBlock = staging.querySelector('.text-left.space-y-0\\.5') || staging.querySelector('.text-left');
              if (topLeftBlock) {
                const pTags = topLeftBlock.querySelectorAll('p');
                if (pTags.length >= 1) {
                  const schSpan = pTags[0].querySelector('.report-nudge-box') || pTags[0];
                  if (schSpan) {
                    schSpan.textContent = schoolName;
                    if (schSpan.style.top === '0px' || !schSpan.style.top) {
                      schSpan.style.top = '20px';
                    }
                  }
                }
              }

              const docLunar = staging.querySelector('#score-sheet-lunar-date, #rv-report-lunar-date');
              if (docLunar) {
                docLunar.textContent = formatKhmerLunarDate(selectedReportDate);
                docLunar.classList.remove('text-muted-foreground');
                docLunar.classList.add('text-foreground');
                docLunar.style.setProperty('color', '#000000', 'important');
              }
              const docSolar = staging.querySelector('#score-sheet-solar-date, #rv-report-solar-date');
              if (docSolar) {
                docSolar.textContent = `${schoolName ? `${schoolName}, ` : ''}${formatKhmerSolarDate(selectedReportDate)}`;
                docSolar.classList.remove('text-muted-foreground');
                docSolar.classList.add('text-foreground');
                docSolar.style.setProperty('color', '#000000', 'important');
              }

              contentContainer.innerHTML = staging.innerHTML;
              return;
            }
          } catch (e) {
            console.warn('Error merging into saved score sheet template:', e);
          }
        }

        contentContainer.innerHTML = `
          <div class="moeys-report-document score-sheet-container max-w-full mx-auto space-y-2 text-[10px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important; box-sizing: border-box !important; width: 100% !important;">
            <!-- Top Header Section -->
            <div class="flex items-start justify-between font-khmer select-none leading-tight text-[10px]" style="font-size: 10px !important;">
              <!-- Top Left -->
              <div class="text-left space-y-0.5">
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;"><span class="report-nudge-box" style="display: inline-block; position: relative; left: 0px; top: 20px;">${schoolName}</span></p>
              </div>

              <!-- Top Right -->
              <div class="text-center space-y-0.5">
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;">ព្រះរាជាណាចក្រកម្ពុជា</p>
                <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; letter-spacing: normal !important; line-height: 1.8;">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
                <div class="flex justify-center text-muted-foreground font-serif pt-0.5" style="font-size: 10px !important;">~ ~ ~ 🙞 🙞 🙞 ~ ~ ~</div>
              </div>
            </div>

            <!-- Center Title Section -->
            <div class="text-center space-y-1.5 pt-1 pb-1 font-khmer text-[10px]" style="font-size: 10px !important;">
              <h2 class="font-khmer-muol text-foreground" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 12px !important; letter-spacing: normal !important; line-height: 1.8; text-decoration: none !important;">
                តារាងស្រង់ពិន្ទុប្រចាំខែ <span id="score-sheet-month-label">${selectedMonth ? selectedMonth : '.........................'}</span>
              </h2>
              
              <!-- Meta Row: Subject, Class, Academic Year (In one line, near each other) -->
              <div class="flex items-center justify-center flex-wrap gap-x-6 gap-y-1 text-[10px] font-khmer text-foreground pt-0.5" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important;">
                <div class="whitespace-nowrap">
                  <span>មុខវិជ្ជា៖ </span>
                  <span id="score-sheet-subject-label">${selectedSubject ? selectedSubject : '...........................'}</span>
                </div>
                <div class="whitespace-nowrap">
                  <span>ថ្នាក់ទី៖ </span>
                  <span id="score-sheet-class-label" class="font-bold">${currentClassName}</span>
                </div>
                <div class="whitespace-nowrap">
                  <span>ឆ្នាំសិក្សា៖ </span>
                  <span id="score-sheet-year-label" class="font-bold">${displayYear}</span>
                </div>
              </div>
            </div>

            <!-- Dual-Column Side-by-Side Table Layout -->
            <div class="score-sheet-dual-grid grid grid-cols-2 gap-2 w-full max-w-full box-border">
              <!-- Left Table (Column 1) -->
              <div class="w-full max-w-full min-w-0 box-border">
                <table id="score-sheet-left-table" class="score-sheet-table moeys-table border-collapse text-[10px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important; width: 100% !important; table-layout: fixed !important; border: 1px solid #000000 !important;">
                  <thead>
                    <tr style="background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important;">
                      <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 9% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">ល.រ</th>
                      <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 17% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">អត្តលេខ</th>
                      <th class="px-1.5 py-1 text-center whitespace-nowrap" style="width: 38% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">គោត្តនាម និងនាម</th>
                      <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 9% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">ភេទ</th>
                      <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 13% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">ពិន្ទុ</th>
                      <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 14% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">ផ្សេងៗ</th>
                    </tr>
                  </thead>
                  <tbody style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important;">
                    ${leftRowsHtml}
                  </tbody>
                </table>
              </div>

              <!-- Right Table (Column 2) -->
              <div class="w-full max-w-full min-w-0 box-border">
                <table id="score-sheet-right-table" class="score-sheet-table moeys-table border-collapse text-[10px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important; width: 100% !important; table-layout: fixed !important; border: 1px solid #000000 !important;">
                  <thead>
                    <tr style="background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important;">
                      <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 9% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">ល.រ</th>
                      <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 17% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">អត្តលេខ</th>
                      <th class="px-1.5 py-1 text-center whitespace-nowrap" style="width: 38% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">គោត្តនាម និងនាម</th>
                      <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 9% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">ភេទ</th>
                      <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 13% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">ពិន្ទុ</th>
                      <th class="px-1 py-1 text-center whitespace-nowrap" style="width: 14% !important; background-color: #0045ff !important; color: #ffffff !important; font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif !important; font-weight: bold !important; font-size: 10px !important; border: 1px solid #000000 !important;">ផ្សេងៗ</th>
                    </tr>
                  </thead>
                  <tbody style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important;">
                    ${rightRowsHtml}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Footer Signatures & Date Block -->
            <div class="mt-6 pt-2 grid grid-cols-2 gap-8 font-khmer text-[10px] text-center select-none" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important;">
              <!-- Bottom Left -->
              <div class="flex flex-col items-center justify-between min-h-[110px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important;">
                <div class="space-y-1" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important;">
                  <p class="font-normal" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important; font-weight: normal !important; color: #000000 !important;">បានឃើញ និងឯកភាព</p>
                  <p class="font-khmer-muol" style="font-family: 'Khmer OS Moul Light', 'Khmer OS Muol Light', 'Moul', cursive, sans-serif; font-size: 10px !important; line-height: 1.8; font-weight: normal !important; color: #000000 !important;">នាយក</p>
                </div>
                <div class="h-14 w-40 mx-auto"></div>
              </div>

              <!-- Bottom Right -->
              <div class="flex flex-col items-center justify-between min-h-[110px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important;">
                <div class="space-y-0.5" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important;">
                  <p id="score-sheet-lunar-date" class="font-normal text-foreground text-[10px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important; color: #000000 !important;">${formatKhmerLunarDate(selectedReportDate)}</p>
                  <p id="score-sheet-solar-date" class="font-medium text-foreground text-[10px]" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important; font-weight: 500 !important; color: #000000 !important;">${schoolName ? `${schoolName}, ` : ''}${formatKhmerSolarDate(selectedReportDate)}</p>
                  <p class="font-bold pt-1 text-foreground" style="font-family: 'Khmer OS Siemreap', 'Siemreap', sans-serif; font-size: 10px !important; font-weight: 700 !important; color: #000000 !important;"><b>ហត្ថលេខាគ្រូមុខវិជ្ជា</b></p>
                </div>
                <div class="h-14 w-40 mx-auto"></div>
              </div>
            </div>
          </div>
        `;
      }
    });
  },

    /**
   * Open Excel Import Modal with file upload, sample template download,
   * 29-column data preview, and conflict resolution (skip vs overwrite).
   */
  openExcelImportModal() {
    const isKm = i18n.getLocale() === 'km';
    const isTeacher = authService.isTeacher();
    let parsedResult = null;

    const content = `
      <div class="space-y-4 text-xs sm:text-sm">
        <p class="text-xs text-muted-foreground">
          ${t('students.importExcelDesc')}
        </p>

        ${isTeacher ? `
          <div class="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs">
            ${t('students.teacherClassNotice')}
          </div>
        ` : ''}

        <!-- Template Download & File Upload Area -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-muted/20">
          <div>
            <p class="font-semibold text-foreground text-xs">${isKm ? 'ទម្រង់ឯកសារគំរូ (Template)' : 'Standard Format Template'}</p>
            <p class="text-[11px] text-muted-foreground mt-0.5">${isKm ? 'ទាញយកឯកសារគំរូដែលមាន ២៩ ជួរឈរត្រឹមត្រូវ' : 'Get standard 29-column template'}</p>
          </div>
          <button type="button" id="btn-download-sample-template" class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors shadow-sm whitespace-nowrap">
            ${getIcon('download', 'w-3.5 h-3.5 text-primary')}
            <span>${t('students.downloadTemplate')}</span>
          </button>
        </div>

        <!-- Drag and Drop / File Input Box -->
        <div id="drop-zone-excel" class="p-6 border-2 border-dashed border-border hover:border-primary/60 rounded-xl bg-card hover:bg-muted/10 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer text-center">
          <div class="p-3 rounded-full bg-primary/10 text-primary">
            ${getIcon('fileSpreadsheet', 'w-6 h-6')}
          </div>
          <div>
            <p class="font-semibold text-foreground text-xs sm:text-sm" id="excel-file-label">
              ${t('students.dragDropExcel')}
            </p>
            <p class="text-[11px] text-muted-foreground mt-0.5">Supports .xlsx, .xls (Max 10MB)</p>
          </div>
          <input type="file" id="excel-file-input" accept=".xlsx, .xls" class="hidden" />
        </div>

        <!-- Duplicate Skipping Information Banner -->
        <div class="p-3 rounded-lg border border-border bg-card flex items-center gap-2.5 text-xs text-muted-foreground">
          ${getIcon('info', 'w-4 h-4 text-primary shrink-0')}
          <span>${isKm ? 'អត្តលេខសិស្សដែលមានរួចហើយនៅក្នុងប្រព័ន្ធ នឹងត្រូវរំលងដោយស្វ័យប្រវត្តិដើម្បីការពារទិន្នន័យចាស់។' : 'Duplicate student IDs already in the system will automatically be skipped to preserve existing data.'}</span>
        </div>

        <!-- Error & Validation Banner -->
        <div id="excel-error-box" class="hidden p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1"></div>

        <!-- Parsed Data Preview Table Container -->
        <div id="excel-preview-container" class="hidden space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-xs text-foreground" id="excel-preview-summary">
              ${t('students.previewParsedTitle', { count: 0 })}
            </span>
            <span class="text-[11px] text-muted-foreground">Showing top 10 preview rows</span>
          </div>
          <div class="border border-border rounded-lg overflow-x-auto max-h-56">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="bg-muted/60 border-b border-border sticky top-0 text-muted-foreground">
                <tr>
                  <th class="px-2.5 py-2">${t('students.previewRowNo')}</th>
                  <th class="px-2.5 py-2">${t('students.previewStudentId')}</th>
                  <th class="px-2.5 py-2">${t('students.previewKhmerName')}</th>
                  <th class="px-2.5 py-2">${t('students.previewLatinName')}</th>
                  <th class="px-2.5 py-2">${t('students.previewGender')}</th>
                  <th class="px-2.5 py-2">${t('students.previewDob')}</th>
                  <th class="px-2.5 py-2">${t('students.previewClass')}</th>
                  <th class="px-2.5 py-2">${t('students.previewStatus')}</th>
                </tr>
              </thead>
              <tbody id="excel-preview-tbody" class="divide-y divide-border bg-card">
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <button type="button" id="btn-cancel-excel-import" class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs sm:text-sm font-medium transition-colors">
        ${t('common.cancel')}
      </button>
      <button type="button" id="btn-confirm-excel-import" disabled class="px-4 py-2 rounded-lg bg-primary text-primary-foreground opacity-50 cursor-not-allowed hover:bg-primary/90 text-xs sm:text-sm font-semibold shadow-sm transition-all">
        ${t('students.btnConfirmImport', { count: 0 })}
      </button>
    `;

    const modal = Modal.open({
      title: t('students.importExcelTitle'),
      content,
      footer,
      maxWidth: 'max-w-3xl'
    });

    const dropZone = modal.element.querySelector('#drop-zone-excel');
    const fileInput = modal.element.querySelector('#excel-file-input');
    const fileLabel = modal.element.querySelector('#excel-file-label');
    const previewContainer = modal.element.querySelector('#excel-preview-container');
    const previewSummary = modal.element.querySelector('#excel-preview-summary');
    const previewTbody = modal.element.querySelector('#excel-preview-tbody');
    const confirmBtn = modal.element.querySelector('#btn-confirm-excel-import');
    const cancelBtn = modal.element.querySelector('#btn-cancel-excel-import');
    const errorBox = modal.element.querySelector('#excel-error-box');

    // Download Sample Template
    modal.element.querySelector('#btn-download-sample-template')?.addEventListener('click', () => {
      try {
        StudentExcelService.downloadSampleTemplate(isKm ? 'km' : 'en');
        toast.info(isKm ? 'បានទាញយកទម្រង់គំរូ Excel' : 'Sample template downloaded.');
      } catch (err) {
        toast.error(err.message);
      }
    });

    // Drag & Drop & Click file picker
    dropZone?.addEventListener('click', () => fileInput?.click());

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-primary', 'bg-primary/5');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-primary', 'bg-primary/5');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-primary', 'bg-primary/5');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0]);
      }
    });

    const processFile = async (file) => {
      if (errorBox) {
        errorBox.classList.add('hidden');
        errorBox.innerHTML = '';
      }

      fileLabel.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      try {
        const buffer = await file.arrayBuffer();
        parsedResult = await StudentExcelService.parseExcelFile(buffer);

        if (parsedResult.totalRows === 0) {
          throw new Error('No student data rows found in spreadsheet.');
        }

        // Display preview rows (up to 10)
        previewSummary.textContent = t('students.previewParsedTitle', { count: parsedResult.totalRows });
        const previewRows = parsedResult.allRows.slice(0, 10);
        previewTbody.innerHTML = previewRows.map(r => `
          <tr class="hover:bg-muted/40">
            <td class="px-2.5 py-1.5 font-mono">${r.rowNum}</td>
            <td class="px-2.5 py-1.5 font-mono font-medium">${r.studentId || '—'}</td>
            <td class="px-2.5 py-1.5">${r.lastNameKh} ${r.firstNameKh}</td>
            <td class="px-2.5 py-1.5">${r.lastNameLatin || ''} ${r.firstNameLatin || ''}</td>
            <td class="px-2.5 py-1.5">${r.gender}</td>
            <td class="px-2.5 py-1.5 font-mono">${formatDisplayDate(r.dateOfBirth) || '—'}</td>
            <td class="px-2.5 py-1.5">${r.classId || '<span class="text-amber-500 font-medium">Unassigned</span>'}</td>
            <td class="px-2.5 py-1.5">
              <span class="text-emerald-600 dark:text-emerald-400 font-medium">${r.status}</span>
            </td>
          </tr>
        `).join('');

        previewContainer.classList.remove('hidden');

        // Validation notices for missing IDs
        if (parsedResult.missingIdRows && parsedResult.missingIdRows.length > 0 && errorBox) {
          errorBox.innerHTML = `
            <p class="font-bold text-amber-600 dark:text-amber-400">Notice: ${parsedResult.missingIdRows.length} rows have missing Student IDs and will be skipped.</p>
            <ul class="list-disc list-inside mt-0.5 space-y-0.5 text-muted-foreground">
              ${parsedResult.missingIdRows.slice(0, 3).map(e => `<li>Row ${e.rowNum}: ${e.name}</li>`).join('')}
              ${parsedResult.missingIdRows.length > 3 ? `<li>...and ${parsedResult.missingIdRows.length - 3} more</li>` : ''}
            </ul>
          `;
          errorBox.classList.remove('hidden');
        }

        // Enable confirm button
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        confirmBtn.textContent = t('students.btnConfirmImport', { count: parsedResult.validRows.length });
      } catch (err) {
        console.error('Excel parse error:', err);
        if (errorBox) {
          errorBox.textContent = err.message || 'Failed to parse Excel file.';
          errorBox.classList.remove('hidden');
        }
        confirmBtn.disabled = true;
        confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    };

    // Cancel Button
    cancelBtn?.addEventListener('click', () => modal.close());

    // Confirm Import
    confirmBtn?.addEventListener('click', async () => {
      if (!parsedResult || parsedResult.validRows.length === 0) {
        toast.warning(t('students.noFileSelected'));
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Importing...';

      try {
        const result = await StudentExcelService.commitImport(parsedResult.validRows, parsedResult.missingIdRows);
        modal.close();
        await this.loadData(true);
        this.showImportSummaryModal(result);
      } catch (err) {
        console.error('Import commit error:', err);
        toast.error(err.message || 'Failed to save imported records.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = t('students.btnConfirmImport', { count: parsedResult.validRows.length });
      }
    });
  },

  /**
   * Post-Import Summary Report Modal:
   * Displays comprehensive metrics for total records, imported count,
   * skipped duplicate IDs, rejected missing IDs, and unassigned classroom count.
   */
  showImportSummaryModal(summaryResult) {
    if (!summaryResult) return;
    const isKm = i18n.getLocale() === 'km';
    const isTeacher = authService.isTeacher();
    const hasUnassigned = !isTeacher && summaryResult.unassignedCount > 0;

    const content = `
      <div class="space-y-4 text-xs sm:text-sm">
        <p class="text-xs text-muted-foreground">
          ${t('students.summaryReportDesc')}
        </p>

        <!-- Metric Stat Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <!-- 1. Total In File -->
          <div class="p-3.5 rounded-xl border border-border bg-card shadow-xs">
            <span class="text-[11px] text-muted-foreground font-medium">${t('students.totalInFile')}</span>
            <div class="text-xl font-bold text-foreground mt-1">${summaryResult.totalRecords}</div>
          </div>

          <!-- 2. Successfully Imported -->
          <div class="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-xs">
            <span class="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">${t('students.importedSuccess')}</span>
            <div class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${summaryResult.importedCount}</div>
          </div>

          <!-- 3. Skipped Duplicates -->
          <div class="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 shadow-xs">
            <span class="text-[11px] text-amber-700 dark:text-amber-400 font-medium">${t('students.skippedDuplicates')}</span>
            <div class="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">${summaryResult.skippedDuplicatesCount}</div>
          </div>

          <!-- 4. Rejected Missing ID -->
          <div class="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 shadow-xs">
            <span class="text-[11px] text-rose-700 dark:text-rose-400 font-medium">${t('students.rejectedMissingId')}</span>
            <div class="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">${summaryResult.missingIdCount}</div>
          </div>
        </div>

        ${hasUnassigned ? `
          <!-- Unassigned Classroom Notice with Direct Action Button -->
          <div class="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <div class="flex items-center gap-2.5 text-amber-700 dark:text-amber-300">
              ${getIcon('alertTriangle', 'w-5 h-5 shrink-0')}
              <div>
                <p class="font-semibold text-xs sm:text-sm">
                  ${t('students.unassignedBannerText', { count: summaryResult.unassignedCount })}
                </p>
                <p class="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  ${isKm ? 'សិស្សទាំងនេះត្រូវបានបញ្ចូលក្នុងប្រព័ន្ធរួចរាល់ ប៉ុន្តែមិនទាន់បានបែងចែកថ្នាក់រៀន។' : 'These students are imported in the database but have no classroom assigned yet.'}
                </p>
              </div>
            </div>
            <button type="button" id="btn-summary-assign-classroom" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-sm shrink-0 cursor-pointer">
              ${getIcon('users', 'w-4 h-4')}
              <span>${t('students.btnAssignNow')}</span>
            </button>
          </div>
        ` : ''}

        <!-- Skipped Duplicates Breakdown (if any) -->
        ${summaryResult.skippedDuplicatesCount > 0 ? `
          <div class="space-y-1.5">
            <span class="font-semibold text-xs flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              ${getIcon('info', 'w-3.5 h-3.5')}
              <span>${t('students.skippedDuplicatesDetails')} (${summaryResult.skippedDuplicatesCount})</span>
            </span>
            <div class="border border-border rounded-lg max-h-36 overflow-y-auto bg-muted/20">
              <table class="w-full text-left text-xs">
                <thead class="bg-muted/60 border-b border-border text-muted-foreground sticky top-0">
                  <tr>
                    <th class="px-3 py-1.5 w-16">#</th>
                    <th class="px-3 py-1.5 font-mono">${t('students.studentId')}</th>
                    <th class="px-3 py-1.5">${t('students.studentName')}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  ${summaryResult.skippedDuplicates.map((d, i) => `
                    <tr class="hover:bg-muted/40">
                      <td class="px-3 py-1.5 text-muted-foreground font-mono">${i + 1}</td>
                      <td class="px-3 py-1.5 font-mono font-medium text-amber-600 dark:text-amber-400">${d.studentId}</td>
                      <td class="px-3 py-1.5 text-foreground">${d.name}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- Rejected Missing ID Breakdown (if any) -->
        ${summaryResult.missingIdCount > 0 ? `
          <div class="space-y-1.5">
            <span class="font-semibold text-xs flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              ${getIcon('x', 'w-3.5 h-3.5')}
              <span>${t('students.rejectedMissingIdDetails')} (${summaryResult.missingIdCount})</span>
            </span>
            <div class="border border-border rounded-lg max-h-36 overflow-y-auto bg-muted/20">
              <table class="w-full text-left text-xs">
                <thead class="bg-muted/60 border-b border-border text-muted-foreground sticky top-0">
                  <tr>
                    <th class="px-3 py-1.5 w-20 font-mono">${t('students.rowNum')}</th>
                    <th class="px-3 py-1.5">${t('students.studentName')}</th>
                    <th class="px-3 py-1.5 text-rose-500">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  ${summaryResult.missingIdRows.map(m => `
                    <tr class="hover:bg-muted/40">
                      <td class="px-3 py-1.5 font-mono text-muted-foreground">Row ${m.rowNum}</td>
                      <td class="px-3 py-1.5 text-foreground font-medium">${m.name}</td>
                      <td class="px-3 py-1.5 text-rose-500 font-medium">Missing Student ID (Rejected)</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    const footer = `
      <button type="button" id="btn-close-summary-report" class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-colors shadow-xs cursor-pointer">
        ${t('common.close')}
      </button>
    `;

    const summaryModal = Modal.open({
      title: t('students.summaryReportTitle'),
      content,
      footer,
      maxWidth: 'max-w-2xl'
    });

    summaryModal.element.querySelector('#btn-close-summary-report')?.addEventListener('click', () => {
      summaryModal.close();
    });

    summaryModal.element.querySelector('#btn-summary-assign-classroom')?.addEventListener('click', () => {
      summaryModal.close();
      this.openAssignClassroomModal(summaryResult.unassignedClassStudents);
    });

    // Interactive Toast Notification for Unassigned Students
    if (hasUnassigned) {
      toast.show({
        title: isKm ? 'មិនទាន់កំណត់ថ្នាក់រៀន' : 'Unassigned Classrooms',
        message: t('students.unassignedBannerText', { count: summaryResult.unassignedCount }),
        type: 'info',
        duration: 12000,
        action: {
          label: t('students.btnAssignNow'),
          onClick: () => this.openAssignClassroomModal(summaryResult.unassignedClassStudents)
        }
      });
    }
  },

  /**
   * Interactive Unassigned Classroom Resolution Dialog:
   * Option A: Bulk Assign with single classroom select and 1-click apply.
   * Option B: Individual Assignment table with per-student dropdown selection.
   */
  async openAssignClassroomModal(unassignedStudents = []) {
    if (!unassignedStudents || unassignedStudents.length === 0) return;

    const isKm = i18n.getLocale() === 'km';
    const classes = this.state.classes || (await db.getAll('classes')) || [];

    const classOptionsHtml = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const content = `
      <div class="space-y-5 text-xs sm:text-sm">
        <p class="text-xs text-muted-foreground leading-relaxed">
          ${t('students.assignModalDesc')}
        </p>

        <!-- Option A: Bulk Assign -->
        <div class="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
          <div>
            <h4 class="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-2">
              <span class="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">A</span>
              <span>${t('students.optionABulkTitle')}</span>
            </h4>
            <p class="text-xs text-muted-foreground mt-0.5">${t('students.optionABulkDesc')}</p>
          </div>
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <select id="select-bulk-target-class" class="flex-1 h-10 px-3 py-2 pr-8 rounded-lg border border-input bg-background text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs">
              <option value="">${t('students.selectTargetClass')}</option>
              ${classOptionsHtml}
            </select>
            <button type="button" id="btn-apply-bulk-assign" class="inline-flex items-center justify-center gap-1.5 px-4 py-2 h-10 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-colors shadow-xs whitespace-nowrap cursor-pointer">
              ${getIcon('check', 'w-4 h-4')}
              <span>${t('students.btnApplyToAll')}</span>
            </button>
          </div>
        </div>

        <!-- Option B: Individual Assignment Table -->
        <div class="p-4 rounded-xl border border-border bg-card space-y-3">
          <div>
            <h4 class="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-2">
              <span class="flex items-center justify-center w-5 h-5 rounded-full bg-muted-foreground/30 text-foreground text-xs font-bold">B</span>
              <span>${t('students.optionBIndividualTitle')}</span>
            </h4>
            <p class="text-xs text-muted-foreground mt-0.5">${t('students.optionBIndividualDesc')}</p>
          </div>

          <div class="border border-border rounded-lg overflow-x-auto max-h-64">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="bg-muted/60 border-b border-border text-muted-foreground sticky top-0">
                <tr>
                  <th class="px-3 py-2 w-12 text-center">#</th>
                  <th class="px-3 py-2 font-mono">${t('students.studentId')}</th>
                  <th class="px-3 py-2">${t('students.studentName')}</th>
                  <th class="px-3 py-2">${t('students.previewGender')}</th>
                  <th class="px-3 py-2">${t('students.previewClass')}</th>
                </tr>
              </thead>
              <tbody id="individual-assign-tbody" class="divide-y divide-border">
                ${unassignedStudents.map((s, idx) => `
                  <tr class="hover:bg-muted/30">
                    <td class="px-3 py-2 text-center text-muted-foreground font-mono">${idx + 1}</td>
                    <td class="px-3 py-2 font-mono font-medium text-foreground">${s.studentId || '—'}</td>
                    <td class="px-3 py-2 font-medium text-foreground">${s.lastNameKh || ''} ${s.firstNameKh || ''}</td>
                    <td class="px-3 py-2">${s.gender === 'Female' ? t('common.female') : t('common.male')}</td>
                    <td class="px-3 py-1.5">
                      <select class="individual-student-class-select h-8 px-2 py-1 pr-6 rounded-md border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs" data-student-id="${s.id}">
                        <option value="">${t('students.selectTargetClass')}</option>
                        ${classes.map(c => `<option value="${c.id}" ${s.classId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                      </select>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <button type="button" id="btn-cancel-assign-classroom" class="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs sm:text-sm font-medium transition-colors cursor-pointer">
        ${t('common.cancel')}
      </button>
      <button type="button" id="btn-save-individual-assignments" class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-colors shadow-xs cursor-pointer">
        ${t('students.btnSaveAssignments')}
      </button>
    `;

    const modal = Modal.open({
      title: t('students.assignModalTitle'),
      content,
      footer,
      maxWidth: 'max-w-3xl'
    });

    // Option A: Bulk Assign
    modal.element.querySelector('#btn-apply-bulk-assign')?.addEventListener('click', async () => {
      const selectedClassId = modal.element.querySelector('#select-bulk-target-class')?.value;
      if (!selectedClassId) {
        toast.warning(t('students.selectClassRequired'));
        return;
      }

      try {
        for (const st of unassignedStudents) {
          st.classId = selectedClassId;
          st.updatedAt = new Date().toISOString();
          await db.put('students', st);
        }

        toast.success(t('students.bulkAssignSuccess', { count: unassignedStudents.length }));
        modal.close();
        await this.loadData(true);
      } catch (err) {
        console.error('Bulk assignment error:', err);
        toast.error(err.message || 'Failed to update classroom assignments.');
      }
    });

    // Option B: Individual Assign
    modal.element.querySelector('#btn-save-individual-assignments')?.addEventListener('click', async () => {
      const selects = modal.element.querySelectorAll('.individual-student-class-select');
      let updatedCount = 0;

      try {
        for (const sel of selects) {
          const sid = sel.getAttribute('data-student-id');
          const chosenClassId = sel.value;
          if (chosenClassId) {
            const student = unassignedStudents.find(s => s.id === sid);
            if (student && student.classId !== chosenClassId) {
              student.classId = chosenClassId;
              student.updatedAt = new Date().toISOString();
              await db.put('students', student);
              updatedCount++;
            }
          }
        }

        toast.success(t('students.individualAssignSuccess'));
        modal.close();
        await this.loadData(true);
      } catch (err) {
        console.error('Individual assignment error:', err);
        toast.error(err.message || 'Failed to save individual assignments.');
      }
    });

    modal.element.querySelector('#btn-cancel-assign-classroom')?.addEventListener('click', () => {
      modal.close();
    });
  },

  /**
   * Progress modal for bulk photo folder processing
   */
  showBulkPhotoProgressModal(total) {
    const overlay = document.createElement('div');
    overlay.id = 'bulk-photo-progress-overlay';
    overlay.className = 'fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in select-none';
    overlay.innerHTML = `
      <div class="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-down p-6 space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            ${getIcon('folderImage', 'w-5 h-5')}
          </div>
          <div>
            <h3 class="text-sm sm:text-base font-semibold text-foreground">
              ${t('students.bulkPhotoProgressTitle')}
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5">
              ${t('students.bulkPhotoProgressDesc')}
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <div class="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div id="bulk-photo-progress-bar" class="bg-primary h-full transition-all duration-150 rounded-full" style="width: 0%"></div>
          </div>
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span id="bulk-photo-progress-text">
              ${t('students.bulkPhotoProgressStatus', { processed: 0, total, percent: 0 })}
            </span>
            <span id="bulk-photo-progress-percent" class="font-mono font-medium text-foreground">0%</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    return {
      update: (processed, currentTotal) => {
        const percent = Math.min(100, Math.round((processed / currentTotal) * 100));
        const bar = overlay.querySelector('#bulk-photo-progress-bar');
        const text = overlay.querySelector('#bulk-photo-progress-text');
        const pct = overlay.querySelector('#bulk-photo-progress-percent');
        if (bar) bar.style.width = `${percent}%`;
        if (text) text.textContent = t('students.bulkPhotoProgressStatus', { processed, total: currentTotal, percent });
        if (pct) pct.textContent = `${percent}%`;
      },
      close: () => {
        overlay.remove();
      }
    };
  },

  /**
   * Summary modal for bulk photo folder import results
   */
  showBulkPhotoSummaryModal({ totalScanned, updatedCount, unmatchedList }) {
    const isKm = i18n.getLocale() === 'km';
    const isTeacher = authService.isTeacher();
    const unmatchedCount = (unmatchedList || []).length;

    const content = `
      <div class="space-y-4 text-xs sm:text-sm">
        <p class="text-xs text-muted-foreground">
          ${t('students.bulkPhotoSummaryDesc')}
        </p>

        ${isTeacher ? `
          <div class="p-3 rounded-lg border border-primary/20 bg-primary/5 text-primary text-xs flex items-center gap-2">
            ${getIcon('shield', 'w-4 h-4 shrink-0')}
            <span>${t('students.bulkPhotoTeacherScopeNotice')}</span>
          </div>
        ` : ''}

        <!-- 3 Stat Cards -->
        <div class="grid grid-cols-3 gap-3">
          <!-- 1. Total Scanned -->
          <div class="p-3.5 rounded-xl border border-border bg-card shadow-xs">
            <span class="text-[11px] text-muted-foreground font-medium">${t('students.bulkPhotoTotalScanned')}</span>
            <div class="text-xl font-bold text-foreground mt-1">${totalScanned}</div>
          </div>

          <!-- 2. Successfully Linked -->
          <div class="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-xs">
            <span class="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">${t('students.bulkPhotoUpdated')}</span>
            <div class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${updatedCount}</div>
          </div>

          <!-- 3. Unmatched / Skipped -->
          <div class="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 shadow-xs">
            <span class="text-[11px] text-amber-700 dark:text-amber-400 font-medium">${t('students.bulkPhotoUnmatched')}</span>
            <div class="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">${unmatchedCount}</div>
          </div>
        </div>

        <!-- Unmatched Filenames Collapsible Breakdown (if any) -->
        ${unmatchedCount > 0 ? `
          <div class="space-y-2 pt-1">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-xs flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                ${getIcon('alertTriangle', 'w-3.5 h-3.5 shrink-0')}
                <span>${t('students.bulkPhotoUnmatchedListTitle')} (${unmatchedCount})</span>
              </span>
              <button type="button" id="btn-toggle-unmatched-list" class="text-xs text-primary hover:underline font-medium cursor-pointer flex items-center gap-1">
                <span id="toggle-unmatched-text">${t('students.bulkPhotoShowUnmatched', { count: unmatchedCount })}</span>
                <span id="toggle-unmatched-icon" class="inline-block transition-transform duration-200">
                  ${getIcon('chevronDown', 'w-3.5 h-3.5')}
                </span>
              </button>
            </div>
            
            <div id="unmatched-list-container" class="hidden border border-border rounded-lg max-h-48 overflow-y-auto bg-muted/20 animate-fade-in">
              <table class="w-full text-left text-xs">
                <thead class="bg-muted/60 border-b border-border text-muted-foreground sticky top-0">
                  <tr>
                    <th class="px-3 py-1.5 w-12 text-muted-foreground font-mono">#</th>
                    <th class="px-3 py-1.5">${isKm ? 'ឈ្មោះឯកសារ' : 'Filename'}</th>
                    <th class="px-3 py-1.5 font-mono">${isKm ? 'អត្តលេខស្វែងរក' : 'Extracted ID'}</th>
                    <th class="px-3 py-1.5 text-right text-muted-foreground">${isKm ? 'មូលហេតុ' : 'Reason'}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  ${unmatchedList.map((item, idx) => `
                    <tr class="hover:bg-muted/40">
                      <td class="px-3 py-1.5 text-muted-foreground font-mono">${idx + 1}</td>
                      <td class="px-3 py-1.5 text-foreground font-medium truncate max-w-[160px]" title="${item.filename}">${item.filename}</td>
                      <td class="px-3 py-1.5 font-mono text-amber-600 dark:text-amber-400">${item.extractedId || '—'}</td>
                      <td class="px-3 py-1.5 text-right text-muted-foreground text-[11px]">${item.reason || (isKm ? 'រកមិនឃើញអត្តលេខ' : 'Student ID not found')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    const footer = `
      <button type="button" id="btn-close-photo-summary" class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-colors shadow-xs cursor-pointer">
        ${t('common.close')}
      </button>
    `;

    const summaryModal = Modal.open({
      title: t('students.bulkPhotoSummaryTitle'),
      content,
      footer,
      maxWidth: 'max-w-xl'
    });

    summaryModal.element.querySelector('#btn-close-photo-summary')?.addEventListener('click', () => {
      summaryModal.close();
    });

    const toggleBtn = summaryModal.element.querySelector('#btn-toggle-unmatched-list');
    const container = summaryModal.element.querySelector('#unmatched-list-container');
    const toggleText = summaryModal.element.querySelector('#toggle-unmatched-text');
    const toggleIcon = summaryModal.element.querySelector('#toggle-unmatched-icon');

    toggleBtn?.addEventListener('click', () => {
      const isHidden = container.classList.contains('hidden');
      if (isHidden) {
        container.classList.remove('hidden');
        if (toggleText) toggleText.textContent = t('students.bulkPhotoHideUnmatched');
        if (toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
      } else {
        container.classList.add('hidden');
        if (toggleText) toggleText.textContent = t('students.bulkPhotoShowUnmatched', { count: unmatchedCount });
        if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';
      }
    });
  },

  /**
   * Main handler for bulk importing student photos from a picked folder
   */
  async handleBulkPhotoFolder(rawFiles) {
    const files = Array.from(rawFiles || []);
    if (files.length === 0) return;

    // Filter valid image files, ignoring system/hidden files
    const isImage = (f) => {
      const name = f.name || '';
      if (name.startsWith('.') || name === 'Thumbs.db' || name === 'desktop.ini') return false;
      if (f.type && f.type.startsWith('image/')) return true;
      return /\.(jpe?g|png|webp|bmp|gif|jfif)$/i.test(name);
    };

    const imageFiles = files.filter(isImage);
    if (imageFiles.length === 0) {
      toast.error(t('students.bulkPhotoNoImagesFound'));
      return;
    }

    // Role-scoped student querying:
    // Teachers only match students within their assigned classroom
    // Admins and Directors match all students across the school
    let candidateStudents = await StudentService.getAll();
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();

    if (isTeacher && teacherClassId) {
      candidateStudents = candidateStudents.filter(s => s.classId === teacherClassId);
    }

    // Build lookup map of normalized studentId -> student record
    const studentMap = new Map();
    candidateStudents.forEach(s => {
      if (s.studentId) {
        studentMap.set(String(s.studentId).trim().toLowerCase(), s);
      }
    });

    // Display progress overlay
    const progress = this.showBulkPhotoProgressModal(imageFiles.length);
    let processed = 0;
    let updatedCount = 0;
    const unmatchedList = [];

    // Process each image file
    for (const file of imageFiles) {
      processed++;
      progress.update(processed, imageFiles.length);

      // Yield event loop periodically to allow UI rendering
      if (processed % 2 === 0 || processed === imageFiles.length) {
        await new Promise(r => setTimeout(r, 0));
      }

      // Extract filename without extension and normalize casing & whitespace
      const baseName = (file.name || '').replace(/\.[^/.]+$/, '').trim();
      const normalizedKey = baseName.toLowerCase();

      const matchedStudent = studentMap.get(normalizedKey);
      if (!matchedStudent) {
        unmatchedList.push({
          filename: file.name,
          extractedId: baseName,
          reason: isTeacher ? (i18n.getLocale() === 'km' ? 'មិនស្ថិតក្នុងថ្នាក់របស់អ្នក' : 'Not in your assigned class') : undefined
        });
        continue;
      }

      // Found matching student! Optimize image before saving
      try {
        const compressedBlob = await photoService.processImageFile(file, {
          maxWidth: 400,
          maxHeight: 500,
          quality: 0.82
        });

        // Update student record via StudentService (updates updatedAt & normalizes)
        await StudentService.update(matchedStudent.id, {
          photoBlob: compressedBlob,
          photo: '(Photo attached)'
        });

        updatedCount++;
      } catch (err) {
        console.error(`Failed to process photo for student ${baseName}:`, err);
        unmatchedList.push({
          filename: file.name,
          extractedId: baseName,
          reason: err.message || 'Image processing failed'
        });
      }
    }

    // Close progress modal
    progress.close();

    // Instantly refresh student table to show newly linked photos
    await this.loadData(true);

    // Show completion summary modal
    this.showBulkPhotoSummaryModal({
      totalScanned: imageFiles.length,
      updatedCount,
      unmatchedList
    });

    if (updatedCount > 0) {
      toast.success(i18n.getLocale() === 'km' 
        ? `បានភ្ជាប់រូបថតសិស្សចំនួន ${updatedCount} នាក់ដោយជោគជ័យ!` 
        : `Successfully linked photos for ${updatedCount} students!`);
    } else {
      toast.warning(i18n.getLocale() === 'km'
        ? `មិនមានរូបថតណាត្រូវនឹងអត្តលេខសិស្សឡើយ (${imageFiles.length} រូបភាពត្រូវបានស្កេន)`
        : `No photos matched student IDs (${imageFiles.length} images scanned)`);
    }
  },

  /**
   * Open the Student ID Card Studio for selected or filtered students
   */
  async openIDCardStudio() {
    const isKm = i18n.getLocale() === 'km';
    let studentsForCards = [];

    // 1. If rows are specifically checked via checkboxes
    if (this.state.selectedIds && this.state.selectedIds.size > 0) {
      if (!this.cachedStudents) {
        this.cachedStudents = await StudentService.getAll();
      }
      studentsForCards = (this.cachedStudents || []).filter(s => this.state.selectedIds.has(s.id));
    } else {
      // 2. Query currently filtered dataset
      const result = await StudentService.query({
        search: this.state.search,
        classId: this.state.classId,
        academicYear: this.state.academicYear,
        status: this.state.status,
        sortBy: this.state.sortBy,
        sortDir: this.state.sortDir,
        page: 1,
        pageSize: 100000
      });

      studentsForCards = result.data || [];

      // Drill-down filter
      if (this.state.filterField && this.state.filterValue && this.state.filterValue !== 'all') {
        const field = this.state.filterField;
        const targetVal = this.state.filterValue.trim().toLowerCase();
        studentsForCards = studentsForCards.filter(s => {
          if (field === 'village') {
            return (s.currentVillage && s.currentVillage.trim().toLowerCase() === targetVal) ||
                   (s.birthVillage && s.birthVillage.trim().toLowerCase() === targetVal);
          }
          if (field === 'commune') {
            return (s.currentCommune && s.currentCommune.trim().toLowerCase() === targetVal) ||
                   (s.birthCommune && s.birthCommune.trim().toLowerCase() === targetVal);
          }
          if (field === 'district') {
            return (s.currentDistrict && s.currentDistrict.trim().toLowerCase() === targetVal) ||
                   (s.birthDistrict && s.birthDistrict.trim().toLowerCase() === targetVal);
          }
          if (field === 'province') {
            return (s.currentProvince && s.currentProvince.trim().toLowerCase() === targetVal) ||
                   (s.birthProvince && s.birthProvince.trim().toLowerCase() === targetVal);
          }
          if (field === 'gender') {
            return s.gender && s.gender.trim().toLowerCase() === targetVal;
          }
          if (field === 'classId') {
            return s.classId && s.classId.trim() === this.state.filterValue.trim();
          }
          if (field === 'academicYear') {
            return s.academicYear && s.academicYear.trim().toLowerCase() === targetVal;
          }
          return s[field] && String(s[field]).trim().toLowerCase() === targetVal;
        });
      }
    }

    if (!studentsForCards || studentsForCards.length === 0) {
      toast.warning(isKm ? 'មិនមានទិន្នន័យសិស្សសម្រាប់បង្កើតកាតទេ' : 'No students found to generate ID cards');
      return;
    }

    IDCardStudioModal.open(studentsForCards, this.state.classes || []);
  }
};


