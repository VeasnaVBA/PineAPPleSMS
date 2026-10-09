/**
 * Academic Year Promotion & Class Progression Page (ការឡើងថ្នាក់ និងផ្លាស់ប្តូរឆ្នាំសិក្សា)
 * Director & Admin module to advance student cohorts between academic years with Direct Section or Auto-Balanced placement.
 */
import { db } from '../database/db.js';
import { PromotionService } from '../services/promotionService.js';
import { ClassService } from '../services/classService.js';
import { StudentService } from '../services/studentService.js';
import { SettingsService } from '../services/settingsService.js';
import { photoService } from '../services/photoService.js';
import { Modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';

export const PromotionPage = {
  state: {
    currentStep: 1, // 1: Source, 2: Target & Mode, 3: Preview & Override, 4: Complete
    sourceAcademicYear: '',
    sourceGrade: '7',
    sourceClassId: 'ALL',
    selectedStudentIds: new Set(),
    
    targetAcademicYear: '',
    targetGrade: '8',
    isGraduation: false,
    progressionMode: 'DIRECT_SECTION', // 'DIRECT_SECTION' or 'AUTO_BALANCE'
    selectedTargetClassIds: new Set(),
    
    manualOverrides: new Map(), // studentId -> targetClassId
    
    classes: [],
    students: [],
    academicYears: [],
    isLoading: false
  },

  cachedData: {
    sourceStudents: [],
    targetClasses: [],
    computedAssignments: []
  },

  async render(container) {
    this.container = container;
    this.state.currentStep = 1;
    this.state.selectedStudentIds.clear();
    this.state.selectedTargetClassIds.clear();
    this.state.manualOverrides.clear();

    await this.loadInitialData();
    this.renderLayout();
  },

  async loadInitialData() {
    this.state.isLoading = true;
    try {
      const [allClasses, allStudents, settingsAcademicYears, activeAcademicYear] = await Promise.all([
        ClassService.getAll(),
        StudentService.getAll(),
        SettingsService.getAcademicYears(),
        SettingsService.getActiveAcademicYear()
      ]);

      this.state.classes = allClasses || [];
      this.state.students = allStudents || [];

      // Academic years are strictly retrieved from Settings only
      const configuredYears = (settingsAcademicYears || [])
        .map(y => (typeof y === 'string' ? y : y?.name))
        .filter(Boolean);

      if (configuredYears.length === 0 && activeAcademicYear) {
        configuredYears.push(activeAcademicYear);
      } else if (configuredYears.length === 0) {
        configuredYears.push('2024–2025');
      }

      this.state.academicYears = configuredYears;

      const normY = y => String(y || '').replace(/[–—−]/g, '-').trim();
      const activeMatch = configuredYears.find(y => normY(y) === normY(activeAcademicYear));
      this.state.sourceAcademicYear = activeMatch || configuredYears[0] || '2024–2025';

      // Default target academic year is next year (e.g. 2024-2025 -> 2025-2026)
      this.state.targetAcademicYear = this.computeNextAcademicYear(this.state.sourceAcademicYear);

      // Initialize source grade based on active students in students table
      const availableSrc = this.getAvailableSourceGrades();
      if (availableSrc.length > 0 && !availableSrc.some(g => String(g.value) === String(this.state.sourceGrade))) {
        this.state.sourceGrade = String(availableSrc[0].value);
      }
      this.syncTargetGradeWithAvailable();

      this.loadSourceStudents();
    } catch (err) {
      console.error('Error loading promotion initial data:', err);
      toast.error({ message: 'Failed to load promotion data: ' + err.message });
    } finally {
      this.state.isLoading = false;
    }
  },

  /**
   * Helper: Get available grades from classes table
   */
  getAvailableGrades(filterAcademicYear = null) {
    const gradesMap = new Map();
    const normY = y => String(y || '').replace(/[–—−]/g, '-').trim();
    const filterY = filterAcademicYear ? normY(filterAcademicYear) : null;

    let list = this.state.classes || [];
    if (filterY) {
      const yearFiltered = list.filter(c => c.academicYear && normY(c.academicYear) === filterY);
      if (yearFiltered.length > 0) {
        list = yearFiltered;
      }
    }

    list.forEach(c => {
      const gNum = PromotionService.parseGradeNumber(c.grade || c.name);
      if (gNum !== null) {
        const key = String(gNum);
        if (!gradesMap.has(key)) {
          gradesMap.set(key, {
            value: key,
            order: gNum,
            labelKm: `ថ្នាក់ទី ${gNum}`,
            labelEn: `Grade ${gNum}`,
            targetLabelKm: `ឡើងទៅថ្នាក់ទី ${gNum}`,
            targetLabelEn: `Advance to Grade ${gNum}`
          });
        }
      } else if (c.grade && c.grade.trim()) {
        const key = c.grade.trim();
        if (!gradesMap.has(key)) {
          gradesMap.set(key, {
            value: key,
            order: 999,
            labelKm: `ថ្នាក់ ${key}`,
            labelEn: key,
            targetLabelKm: `ឡើងទៅថ្នាក់ ${key}`,
            targetLabelEn: `Advance to ${key}`
          });
        }
      } else if (c.name && c.name.trim()) {
        const key = c.name.trim();
        if (!gradesMap.has(key)) {
          gradesMap.set(key, {
            value: key,
            order: 999,
            labelKm: `ថ្នាក់ ${key}`,
            labelEn: key,
            targetLabelKm: `ឡើងទៅថ្នាក់ ${key}`,
            targetLabelEn: `Advance to ${key}`
          });
        }
      }
    });

    const result = Array.from(gradesMap.values());
    result.sort((a, b) => a.order - b.order);
    return result;
  },

  getAvailableSourceGrades() {
    const gradesMap = new Map();
    const normY = y => String(y || '').replace(/[–—−]/g, '-').trim();
    const srcY = normY(this.state.sourceAcademicYear);

    (this.state.students || []).forEach(s => {
      if (s.status === 'Inactive' || s.status === 'Graduated' || s.status === 'Dropout') return;
      if (srcY && s.academicYear && normY(s.academicYear) !== srcY) return;

      let gNum = PromotionService.parseGradeNumber(s.grade);
      if (gNum === null && s.classId) {
        const cls = this.state.classes.find(c => c.id === s.classId);
        if (cls) {
          gNum = PromotionService.parseGradeNumber(cls.grade || cls.name);
        }
      }

      if (gNum !== null) {
        const key = String(gNum);
        if (!gradesMap.has(key)) {
          gradesMap.set(key, {
            value: key,
            order: gNum,
            labelKm: `ថ្នាក់ទី ${gNum}`,
            labelEn: `Grade ${gNum}`
          });
        }
      }
    });

    const result = Array.from(gradesMap.values());
    result.sort((a, b) => a.order - b.order);
    return result;
  },

  /**
   * Get source classes that active students in the student table actually belong to
   */
  getSourceClassesWithStudents() {
    const normY = y => String(y || '').replace(/[–—−]/g, '-').trim();
    const srcY = normY(this.state.sourceAcademicYear);
    const gNum = PromotionService.parseGradeNumber(this.state.sourceGrade);

    // Count active students per class in the selected academic year and grade
    const classStudentCounts = new Map();
    (this.state.students || []).forEach(s => {
      if (s.status === 'Inactive' || s.status === 'Graduated' || s.status === 'Dropout') return;
      if (srcY && s.academicYear && normY(s.academicYear) !== srcY) return;

      let sGrade = PromotionService.parseGradeNumber(s.grade);
      const cls = this.state.classes.find(c => c.id === s.classId);
      if (sGrade === null && cls) {
        sGrade = PromotionService.parseGradeNumber(cls.grade || cls.name);
      }

      if (gNum === null || sGrade === gNum) {
        if (s.classId) {
          classStudentCounts.set(s.classId, (classStudentCounts.get(s.classId) || 0) + 1);
        }
      }
    });

    const sourceClasses = [];
    classStudentCounts.forEach((count, cid) => {
      const cls = this.state.classes.find(c => c.id === cid);
      if (cls) {
        sourceClasses.push({
          ...cls,
          studentCount: count
        });
      } else {
        sourceClasses.push({
          id: cid,
          name: cid,
          studentCount: count
        });
      }
    });

    return sourceClasses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },

  getAvailableTargetGrades() {
    return this.getAvailableGrades(this.state.targetAcademicYear);
  },

  syncTargetGradeWithAvailable() {
    const computedNext = PromotionService.computeNextGrade(this.state.sourceGrade);
    const availableTarget = this.getAvailableTargetGrades();

    if (computedNext === 'Graduated') {
      this.state.targetGrade = 'Graduated';
      this.state.isGraduation = true;
    } else if (availableTarget.some(g => String(g.value) === String(computedNext))) {
      this.state.targetGrade = computedNext;
      this.state.isGraduation = false;
    } else if (availableTarget.length > 0) {
      this.state.targetGrade = String(availableTarget[0].value);
      this.state.isGraduation = false;
    } else {
      this.state.targetGrade = computedNext || 'Graduated';
      this.state.isGraduation = this.state.targetGrade === 'Graduated';
    }
  },

  computeNextAcademicYear(currentYear) {
    if (!currentYear) return '2025–2026';
    const match = currentYear.match(/(\d{4})[^\d]+(\d{4})/);
    if (match) {
      const y1 = parseInt(match[1], 10) + 1;
      const y2 = parseInt(match[2], 10) + 1;
      return `${y1}–${y2}`;
    }
    return '2025–2026';
  },

  loadSourceStudents() {
    const { sourceAcademicYear, sourceGrade, sourceClassId } = this.state;
    const gNum = PromotionService.parseGradeNumber(sourceGrade);

    let list = this.state.students.filter(s => {
      // 1. Status: only active or ungraduated
      if (s.status === 'Inactive' || s.status === 'Graduated' || s.status === 'Dropout') return false;

      // 2. Academic Year
      if (sourceAcademicYear && s.academicYear) {
        const normY = y => String(y || '').replace(/[–—−]/g, '-').trim();
        if (normY(s.academicYear) !== normY(sourceAcademicYear)) return false;
      }

      // 3. Grade
      if (gNum !== null) {
        const sGradeNum = PromotionService.parseGradeNumber(s.grade);
        if (sGradeNum !== gNum) {
          // Check if student's class matches grade
          const cls = this.state.classes.find(c => c.id === s.classId);
          const cGradeNum = cls ? PromotionService.parseGradeNumber(cls.grade || cls.name) : null;
          if (cGradeNum !== gNum) return false;
        }
      }

      // 4. Specific Class ID (if not 'ALL')
      if (sourceClassId && sourceClassId !== 'ALL') {
        if (s.classId !== sourceClassId) return false;
      }

      return true;
    });

    // Sort alphabetically by first name
    this.cachedData.sourceStudents = PromotionService.sortStudentsAlphabetically(list);

    // Select all by default
    this.state.selectedStudentIds = new Set(this.cachedData.sourceStudents.map(s => s.id));
  },

  renderLayout() {
    const isKm = i18n.getLocale() === 'km';

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-16">
        <!-- Top Title & Navigation Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground ${isKm ? 'font-khmer' : ''}">
              ${t('promotion.title')}
            </h1>
            <p class="text-xs sm:text-sm text-muted-foreground mt-0.5 ${isKm ? 'font-khmer' : ''}">
              ${t('promotion.subtitle')}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-reload-promotion"
                    type="button"
                    class="h-9 px-3 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs font-medium transition-colors shadow-xs cursor-pointer flex items-center gap-1.5">
              ${getIcon('refresh', 'w-3.5 h-3.5')}
              <span>${t('common.refresh')}</span>
            </button>
          </div>
        </div>

        <!-- Step Indicator Progress Bar -->
        <div class="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-xs select-none">
          <div class="max-w-2xl mx-auto">
            <div class="relative flex items-center justify-between">
              <!-- Background Connecting Line (Centered with circle: 36px circle -> top-[18px]) -->
              <div class="absolute left-[12%] right-[12%] top-[18px] -translate-y-1/2 h-[2px] bg-border z-0"></div>
              
              <!-- Active Progress Connecting Line Fill -->
              <div class="absolute left-[12%] top-[18px] -translate-y-1/2 h-[2px] bg-primary z-0 transition-all duration-300" style="width: ${
                this.state.currentStep === 1 ? '0%' : this.state.currentStep === 2 ? '38%' : '76%'
              }"></div>

              <!-- Step 1 -->
              <div class="relative z-10 flex flex-col items-center group cursor-pointer" id="step-nav-1">
                <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 border-2 ${
                  this.state.currentStep > 1 
                    ? 'bg-primary border-primary text-primary-foreground shadow-xs' 
                    : this.state.currentStep === 1
                    ? 'bg-primary border-primary text-primary-foreground shadow-md ring-4 ring-primary/20'
                    : 'bg-card border-border text-muted-foreground'
                }">
                  ${this.state.currentStep > 1 ? getIcon('check', 'w-4 h-4') : '1'}
                </div>
                <span class="mt-2 text-xs sm:text-sm font-semibold transition-colors text-center ${
                  this.state.currentStep >= 1 ? 'text-foreground font-bold' : 'text-muted-foreground'
                } ${isKm ? 'font-khmer' : ''}">
                  ${t('promotion.step1Title')}
                </span>
              </div>

              <!-- Step 2 -->
              <div class="relative z-10 flex flex-col items-center group cursor-pointer" id="step-nav-2">
                <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 border-2 ${
                  this.state.currentStep > 2 
                    ? 'bg-primary border-primary text-primary-foreground shadow-xs' 
                    : this.state.currentStep === 2
                    ? 'bg-primary border-primary text-primary-foreground shadow-md ring-4 ring-primary/20'
                    : 'bg-card border-muted-foreground/30 text-muted-foreground'
                }">
                  ${this.state.currentStep > 2 ? getIcon('check', 'w-4 h-4') : '2'}
                </div>
                <span class="mt-2 text-xs sm:text-sm font-semibold transition-colors text-center ${
                  this.state.currentStep >= 2 ? 'text-foreground font-bold' : 'text-muted-foreground'
                } ${isKm ? 'font-khmer' : ''}">
                  ${t('promotion.step2Title')}
                </span>
              </div>

              <!-- Step 3 -->
              <div class="relative z-10 flex flex-col items-center group cursor-pointer" id="step-nav-3">
                <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 border-2 ${
                  this.state.currentStep === 3
                    ? 'bg-primary border-primary text-primary-foreground shadow-md ring-4 ring-primary/20'
                    : 'bg-card border-muted-foreground/30 text-muted-foreground'
                }">
                  3
                </div>
                <span class="mt-2 text-xs sm:text-sm font-semibold transition-colors text-center ${
                  this.state.currentStep >= 3 ? 'text-foreground font-bold' : 'text-muted-foreground'
                } ${isKm ? 'font-khmer' : ''}">
                  ${t('promotion.step3Title')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Step Content Container -->
        <div id="promotion-step-content" class="min-h-[400px]">
          <!-- Rendered dynamically based on currentStep -->
        </div>
      </div>
    `;

    this.renderCurrentStep();
    this.bindGlobalEvents();
  },

  renderCurrentStep() {
    const container = document.getElementById('promotion-step-content');
    if (!container) return;

    if (this.state.currentStep === 1) {
      this.renderStep1(container);
    } else if (this.state.currentStep === 2) {
      this.renderStep2(container);
    } else if (this.state.currentStep === 3) {
      this.renderStep3(container);
    }
  },

  /**
   * STEP 1: Source Selection & Student Roster Checkbox Filtering
   */
  renderStep1(container) {
    const isKm = i18n.getLocale() === 'km';
    const students = this.cachedData.sourceStudents || [];
    const sourceClasses = this.getSourceClassesWithStudents();
    const availableSrc = this.getAvailableSourceGrades();
    const srcGradesToRender = availableSrc.length > 0
      ? availableSrc
      : [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6].map(g => ({
          value: String(g),
          labelKm: `ថ្នាក់ទី ${g}`,
          labelEn: `Grade ${g}`
        }));

    container.innerHTML = `
      <div class="space-y-4 animate-fade-in">
        <!-- Filter Controls Card -->
        <div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-4">
          <h3 class="text-sm font-bold text-foreground flex items-center gap-2 ${isKm ? 'font-khmer' : ''}">
            ${getIcon('filter', 'w-4 h-4 text-primary')}
            <span>${t('promotion.sourceSelectionHeading')}</span>
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <!-- Source Academic Year -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1.5 ${isKm ? 'font-khmer' : ''}">
                ${t('promotion.sourceAcademicYearLabel')}
              </label>
              <select id="select-source-year" class="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary/20 cursor-pointer">
                ${this.state.academicYears.map(y => `
                  <option value="${y}" ${y === this.state.sourceAcademicYear ? 'selected' : ''}>${y}</option>
                `).join('')}
              </select>
            </div>

            <!-- Source Grade -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1.5 ${isKm ? 'font-khmer' : ''}">
                ${t('promotion.sourceGradeLabel')}
              </label>
              <select id="select-source-grade" class="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary/20 cursor-pointer">
                ${srcGradesToRender.map(g => `
                  <option value="${g.value}" ${String(g.value) === String(this.state.sourceGrade) ? 'selected' : ''}>${isKm ? g.labelKm : g.labelEn}</option>
                `).join('')}
              </select>
            </div>

            <!-- Source Class Section -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1.5 ${isKm ? 'font-khmer' : ''}">
                ${t('promotion.sourceClassLabel')}
              </label>
              <select id="select-source-class" class="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary/20 cursor-pointer">
                <option value="ALL">${isKm ? 'គ្រប់ថ្នាក់ទាំងអស់' : 'All Classes in Grade'}</option>
                ${sourceClasses.map(c => `
                  <option value="${c.id}" ${c.id === this.state.sourceClassId ? 'selected' : ''}>${c.name} (${c.studentCount} ${isKm ? 'សិស្ស' : 'students'})</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Student Roster Table Card -->
        <div class="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
          <!-- Table Toolbar -->
          <div class="p-3 bg-muted/30 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2">
              <span class="font-bold text-foreground ${isKm ? 'font-khmer' : ''}">
                ${t('promotion.studentsToPromoteLabel')}:
              </span>
              <span id="p-selected-count-badge" class="px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20">
                ${this.state.selectedStudentIds.size} / ${students.length}
              </span>
            </div>

            <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
              <button type="button" id="btn-p-select-all" class="text-primary hover:underline font-medium cursor-pointer">
                ${isKm ? 'ជ្រើសទាំងអស់' : 'Select All'}
              </button>
              <span>|</span>
              <button type="button" id="btn-p-deselect-all" class="hover:underline font-medium cursor-pointer">
                ${isKm ? 'ដោះធីកទាំងអស់' : 'Deselect All'}
              </button>
            </div>
          </div>

          <!-- Roster Table -->
          <div class="overflow-x-auto max-h-[480px]">
            <table class="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead class="sticky top-0 z-10 bg-muted/95 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th class="w-10 py-2.5 px-3 text-center">
                    <input type="checkbox" id="check-p-select-all" class="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer" ${
                      students.length > 0 && this.state.selectedStudentIds.size === students.length ? 'checked' : ''
                    }>
                  </th>
                  <th class="w-12 py-2.5 px-2 text-center">#</th>
                  <th class="w-14 py-2.5 px-2 text-center">${t('students.photo')}</th>
                  <th class="py-2.5 px-3 min-w-[100px]">${t('students.studentId')}</th>
                  <th class="py-2.5 px-3 min-w-[150px]">${t('students.nameKhmer')}</th>
                  <th class="py-2.5 px-3 min-w-[140px]">${t('students.nameLatin')}</th>
                  <th class="w-16 py-2.5 px-3 text-center">${t('students.gender')}</th>
                  <th class="py-2.5 px-3 min-w-[120px]">${t('classes.class')}</th>
                  <th class="py-2.5 px-3 min-w-[120px] text-center">${t('students.status')}</th>
                </tr>
              </thead>
              <tbody id="source-students-tbody" class="divide-y divide-border text-foreground">
                ${students.length === 0 ? `
                  <tr>
                    <td colspan="9" class="py-12 text-center text-muted-foreground">
                      <div class="max-w-xs mx-auto space-y-2">
                        <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                          ${getIcon('search', 'w-5 h-5')}
                        </div>
                        <p class="text-xs font-medium">${t('students.emptyList')}</p>
                      </div>
                    </td>
                  </tr>
                ` : students.map((s, idx) => {
                  const isChecked = this.state.selectedStudentIds.has(s.id);
                  const isMale = !((s.gender || '').toLowerCase().includes('female') || (s.gender || '').includes('ស្រី'));
                  const cls = this.state.classes.find(c => c.id === s.classId);
                  const className = cls ? cls.name : (s.classId || '-');
                  const khmerName = [s.lastNameKh, s.firstNameKh].filter(Boolean).join(' ') || s.khmerName || s.name || '-';
                  const latinName = [s.lastNameLatin, s.firstNameLatin].filter(Boolean).join(' ') || s.englishName || '';

                  let photoSrc = null;
                  if (s.photoBlob) {
                    photoSrc = photoService.getUrlForBlob(s.photoBlob);
                  } else if (s.photo && s.photo.startsWith('data:')) {
                    photoSrc = s.photo;
                  }

                  return `
                    <tr class="hover:bg-accent/30 transition-colors ${isChecked ? 'bg-primary/5' : ''}" data-student-id="${s.id}">
                      <td class="py-2 px-3 text-center">
                        <input type="checkbox" class="check-p-row rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer" data-id="${s.id}" ${isChecked ? 'checked' : ''}>
                      </td>
                      <td class="py-2 px-2 text-center font-mono text-[11px] text-muted-foreground">${idx + 1}</td>
                      <td class="py-2 px-2 text-center">
                        <div class="w-7 h-7 rounded-md overflow-hidden bg-muted flex items-center justify-center mx-auto border border-border">
                          ${photoSrc ? `<img src="${photoSrc}" alt="" class="w-full h-full object-cover">` : `<span class="font-bold text-[10px] ${isMale ? 'text-blue-600' : 'text-pink-600'}">${(s.firstNameKh || s.name || 'S').charAt(0).toUpperCase()}</span>`}
                        </div>
                      </td>
                      <td class="py-2 px-3 font-mono text-[11px] font-semibold">${s.studentId || '-'}</td>
                      <td class="py-2 px-3 font-semibold text-foreground">${this.escapeHtml(khmerName)}</td>
                      <td class="py-2 px-3 font-mono text-[11px] text-muted-foreground uppercase">${this.escapeHtml(latinName)}</td>
                      <td class="py-2 px-3 text-center">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${isMale ? 'bg-blue-500/10 text-blue-600' : 'bg-pink-500/10 text-pink-600'}">
                          ${isMale ? (isKm ? 'ប្រុស' : 'M') : (isKm ? 'ស្រី' : 'F')}
                        </span>
                      </td>
                      <td class="py-2 px-3 font-semibold text-primary">${this.escapeHtml(className)}</td>
                      <td class="py-2 px-3 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          ${s.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Step 1 Bottom Action Bar -->
        <div class="flex items-center justify-between p-4 bg-card border border-border rounded-xl shadow-xs">
          <div class="text-xs text-muted-foreground ${isKm ? 'font-khmer' : ''}">
            ${t('promotion.step1Tip')}
          </div>
          <button id="btn-p-step1-next"
                  type="button"
                  class="h-10 inline-flex items-center gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer ${
                    this.state.selectedStudentIds.size === 0 ? 'opacity-50 pointer-events-none' : ''
                  }">
            <span>${t('promotion.btnNextStep')}</span>
            ${getIcon('arrowRight', 'w-4 h-4')}
          </button>
        </div>
      </div>
    `;

    this.bindStep1Events();
  },

  bindStep1Events() {
    // 1. Source year change
    document.getElementById('select-source-year')?.addEventListener('change', (e) => {
      this.state.sourceAcademicYear = e.target.value;
      this.state.targetAcademicYear = this.computeNextAcademicYear(this.state.sourceAcademicYear);
      const availableSrc = this.getAvailableSourceGrades();
      if (availableSrc.length > 0 && !availableSrc.some(g => String(g.value) === String(this.state.sourceGrade))) {
        this.state.sourceGrade = String(availableSrc[0].value);
      }
      this.syncTargetGradeWithAvailable();
      this.state.sourceClassId = 'ALL';
      this.loadSourceStudents();
      this.renderStep1(document.getElementById('promotion-step-content'));
    });

    // 2. Source grade change
    document.getElementById('select-source-grade')?.addEventListener('change', (e) => {
      this.state.sourceGrade = e.target.value;
      this.syncTargetGradeWithAvailable();
      this.state.sourceClassId = 'ALL';
      this.loadSourceStudents();
      this.renderStep1(document.getElementById('promotion-step-content'));
    });

    // 3. Source class change
    document.getElementById('select-source-class')?.addEventListener('change', (e) => {
      this.state.sourceClassId = e.target.value;
      this.loadSourceStudents();
      this.renderStep1(document.getElementById('promotion-step-content'));
    });

    // 4. Select All checkbox
    document.getElementById('check-p-select-all')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (isChecked) {
        this.cachedData.sourceStudents.forEach(s => this.state.selectedStudentIds.add(s.id));
      } else {
        this.state.selectedStudentIds.clear();
      }
      this.updateStep1Checkboxes();
    });

    // 5. Select All text button
    document.getElementById('btn-p-select-all')?.addEventListener('click', () => {
      this.cachedData.sourceStudents.forEach(s => this.state.selectedStudentIds.add(s.id));
      this.updateStep1Checkboxes();
    });

    // 6. Deselect All text button
    document.getElementById('btn-p-deselect-all')?.addEventListener('click', () => {
      this.state.selectedStudentIds.clear();
      this.updateStep1Checkboxes();
    });

    // 7. Individual row checkboxes
    document.querySelectorAll('.check-p-row').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = cb.getAttribute('data-id');
        const tr = cb.closest('tr');
        if (e.target.checked) {
          this.state.selectedStudentIds.add(id);
          tr?.classList.add('bg-primary/5');
        } else {
          this.state.selectedStudentIds.delete(id);
          tr?.classList.remove('bg-primary/5');
        }
        this.updateStep1Checkboxes();
      });
    });

    // 8. Next button
    document.getElementById('btn-p-step1-next')?.addEventListener('click', () => {
      if (this.state.selectedStudentIds.size === 0) {
        toast.error({ message: t('promotion.noStudentsSelectedError') });
        return;
      }
      this.syncTargetGradeWithAvailable();
      this.state.currentStep = 2;
      this.renderLayout();
    });
  },

  updateStep1Checkboxes() {
    const total = this.cachedData.sourceStudents.length;
    const selected = this.state.selectedStudentIds.size;
    const badge = document.getElementById('p-selected-count-badge');
    const checkAll = document.getElementById('check-p-select-all');
    const nextBtn = document.getElementById('btn-p-step1-next');

    if (badge) badge.textContent = `${selected} / ${total}`;
    if (checkAll) checkAll.checked = total > 0 && selected === total;
    if (nextBtn) {
      if (selected > 0) {
        nextBtn.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        nextBtn.classList.add('opacity-50', 'pointer-events-none');
      }
    }
  },

  /**
   * Fetch strictly existing target classes for selected targetGrade and targetAcademicYear
   */
  getTargetClasses() {
    const gNum = PromotionService.parseGradeNumber(this.state.targetGrade);
    if (gNum === null) return [];
    const normY = y => String(y || '').replace(/[–—−]/g, '-').trim();
    const targetY = normY(this.state.targetAcademicYear);

    return this.state.classes.filter(c => {
      const cGradeNum = PromotionService.parseGradeNumber(c.grade || c.name);
      if (cGradeNum !== gNum) return false;
      if (targetY && c.academicYear) {
        if (normY(c.academicYear) !== targetY) return false;
      }
      return true;
    });
  },

  /**
   * Analyze Section Mapping for Option A (Direct Section Mapping)
   */
  getDirectSectionMapping(targetClasses = []) {
    const selectedStudents = this.cachedData.sourceStudents.filter(s => this.state.selectedStudentIds.has(s.id));
    const sourceClassMap = new Map(); // sourceClassName -> students array

    selectedStudents.forEach(s => {
      const oldClass = this.state.classes.find(c => c.id === s.classId);
      const oldClassName = oldClass ? oldClass.name : (s.classId || 'Unknown');
      if (!sourceClassMap.has(oldClassName)) {
        sourceClassMap.set(oldClassName, []);
      }
      sourceClassMap.get(oldClassName).push(s);
    });

    const mappings = [];
    let hasUnmappedSections = false;
    const unmappedList = [];

    sourceClassMap.forEach((students, srcName) => {
      const expectedTargetName = PromotionService.computeSameSectionClassName(srcName, this.state.targetGrade);
      const matchingTargetClass = PromotionService.findMatchingClassSection(srcName, this.state.targetGrade, targetClasses);
      const isMatched = !!matchingTargetClass;
      if (!isMatched) {
        hasUnmappedSections = true;
        unmappedList.push(expectedTargetName);
      }
      mappings.push({
        sourceName: srcName,
        expectedTargetName,
        targetClass: matchingTargetClass,
        isMatched,
        studentCount: students.length
      });
    });

    return {
      mappings,
      hasUnmappedSections,
      unmappedList
    };
  },

  /**
   * STEP 2: Destination Setup & Mode Selection with Strict Validation
   */
  renderStep2(container) {
    const isKm = i18n.getLocale() === 'km';
    const availableTargetGrades = this.getAvailableTargetGrades();

    // Ensure valid target grade
    if (!this.state.targetGrade) {
      this.syncTargetGradeWithAvailable();
    }

    const nextGrade = this.state.targetGrade;
    const isGrad = nextGrade === 'Graduated' || this.state.isGraduation;
    const targetClasses = isGrad ? [] : this.getTargetClasses();
    const hasNoTargetClasses = !isGrad && targetClasses.length === 0;

    // Prune and keep only valid target class IDs in state
    if (!isGrad && targetClasses.length > 0) {
      const validTargetIds = new Set(targetClasses.map(c => c.id));
      const currentSelected = Array.from(this.state.selectedTargetClassIds).filter(id => validTargetIds.has(id));
      if (currentSelected.length === 0) {
        this.state.selectedTargetClassIds = new Set(targetClasses.map(c => c.id));
      } else {
        this.state.selectedTargetClassIds = new Set(currentSelected);
      }
    } else if (hasNoTargetClasses) {
      this.state.selectedTargetClassIds.clear();
    }

    // Check Option A section mappings
    const sectionAnalysis = (!isGrad && !hasNoTargetClasses) ? this.getDirectSectionMapping(targetClasses) : { mappings: [], hasUnmappedSections: false, unmappedList: [] };

    // Determine if Next button should be blocked
    let isNextBlocked = false;
    if (!isGrad) {
      if (hasNoTargetClasses) {
        isNextBlocked = true;
      } else if (this.state.progressionMode === 'DIRECT_SECTION' && sectionAnalysis.hasUnmappedSections) {
        isNextBlocked = true;
      } else if (this.state.progressionMode === 'AUTO_BALANCE' && this.state.selectedTargetClassIds.size === 0) {
        isNextBlocked = true;
      }
    }

    container.innerHTML = `
      <div class="space-y-5 animate-fade-in max-w-4xl mx-auto">
        <!-- Target Settings Card -->
        <div class="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
          <h3 class="text-sm font-bold text-foreground flex items-center gap-2 ${isKm ? 'font-khmer' : ''}">
            ${getIcon('graduationCap', 'w-4 h-4 text-primary')}
            <span>${t('promotion.step2Heading')}</span>
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Target Academic Year -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1.5 ${isKm ? 'font-khmer' : ''}">
                ${t('promotion.targetAcademicYearLabel')} <span class="text-destructive">*</span>
              </label>
              <select id="select-target-year" class="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary/20 cursor-pointer">
                ${this.state.academicYears.map(y => `
                  <option value="${y}" ${y === this.state.targetAcademicYear ? 'selected' : ''}>${y}</option>
                `).join('')}
                ${!this.state.academicYears.includes(this.state.targetAcademicYear) && this.state.targetAcademicYear ? `
                  <option value="${this.state.targetAcademicYear}" selected>${this.state.targetAcademicYear}</option>
                ` : ''}
              </select>
            </div>

            <!-- Target Grade / Graduation Option -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1.5 ${isKm ? 'font-khmer' : ''}">
                ${t('promotion.targetGradeLabel')} <span class="text-destructive">*</span>
              </label>
              <select id="select-target-grade" class="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary/20 cursor-pointer">
                ${availableTargetGrades.length === 0 ? `
                  <option value="" disabled ${!isGrad ? 'selected' : ''}>${isKm ? 'គ្មានថ្នាក់ក្នុងបញ្ជីថ្នាក់រៀនទេ' : 'No classes in classes table'}</option>
                ` : availableTargetGrades.map(g => `
                  <option value="${g.value}" ${String(g.value) === String(nextGrade) ? 'selected' : ''}>${isKm ? g.targetLabelKm : g.targetLabelEn}</option>
                `).join('')}
                <option value="Graduated" ${nextGrade === 'Graduated' ? 'selected' : ''}>🎓 ${isKm ? 'បញ្ចប់ការសិក្សា' : 'Graduated / Completed School'}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 1. EMPTY / BLOCKED STATE: Missing Target Classes in IndexedDB Classes Store -->
        ${hasNoTargetClasses ? `
          <div class="bg-amber-500/10 dark:bg-amber-950/30 border-2 border-amber-500/40 rounded-xl p-5 shadow-xs space-y-3 animate-fade-in">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                ${getIcon('alertTriangle', 'w-5 h-5')}
              </div>
              <div class="space-y-1">
                <h4 class="text-sm font-bold text-amber-800 dark:text-amber-300 ${isKm ? 'font-khmer' : ''}">
                  ${t('promotion.noTargetClassesAlertTitle')}
                </h4>
                <p class="text-xs text-amber-700 dark:text-amber-400 leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('promotion.noTargetClassesAlertDesc')
                    .replace(/\{grade\}/g, nextGrade)
                    .replace(/\{year\}/g, this.state.targetAcademicYear)}
                </p>
              </div>
            </div>

            <div class="pt-2 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
              <span class="text-[11px] font-medium text-amber-600 dark:text-amber-400 italic">
                ${isKm ? '⚠️ ការឡើងថ្នាក់ត្រូវបានផ្អាករហូតដល់អ្នកបង្កើតថ្នាក់រៀនគោលដៅរួចរាល់។' : '⚠️ Promotion is blocked until target classrooms are created.'}
              </span>
              <a href="#classes"
                 id="btn-shortcut-classes"
                 class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer">
                ${getIcon('plus', 'w-3.5 h-3.5')}
                <span>${t('promotion.btnCreateTargetClass').replace(/\{grade\}/g, nextGrade)}</span>
              </a>
            </div>
          </div>
        ` : ''}

        <!-- 2. Progression Mode Selection (When Target Classes Exist & Not Graduating) -->
        ${(!isGrad && !hasNoTargetClasses) ? `
          <div class="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-foreground ${isKm ? 'font-khmer' : ''}">
                ${t('promotion.selectProgressionModeLabel')}
              </label>
              <span class="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                ${isKm ? `រកឃើញ ${targetClasses.length} ថ្នាក់ក្នុងប្រព័ន្ធ` : `${targetClasses.length} classrooms found in Classes module`}
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Mode A: Direct Section Progression -->
              <label class="relative flex flex-col justify-between p-4 rounded-xl border-2 transition-all cursor-pointer select-none ${
                this.state.progressionMode === 'DIRECT_SECTION' ? 'border-primary bg-primary/5 shadow-xs' : 'border-border bg-card hover:bg-muted/50'
              }">
                <div class="flex items-start gap-3">
                  <input type="radio" name="progression-mode" value="DIRECT_SECTION" class="mt-1 text-primary focus:ring-primary" ${
                    this.state.progressionMode === 'DIRECT_SECTION' ? 'checked' : ''
                  }>
                  <div>
                    <div class="font-bold text-foreground text-xs sm:text-sm ${isKm ? 'font-khmer' : ''}">
                      ${t('promotion.modeDirectTitle')}
                    </div>
                    <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
                      ${t('promotion.modeDirectDesc')}
                    </p>
                  </div>
                </div>
                <div class="mt-3 pt-3 border-t border-border/60 text-[11px] font-mono text-primary">
                  e.g. 7A ➔ 8A, 7B ➔ 8B, 7C ➔ 8C
                </div>
              </label>

              <!-- Mode B: Auto-Balanced Distribution -->
              <label class="relative flex flex-col justify-between p-4 rounded-xl border-2 transition-all cursor-pointer select-none ${
                this.state.progressionMode === 'AUTO_BALANCE' ? 'border-primary bg-primary/5 shadow-xs' : 'border-border bg-card hover:bg-muted/50'
              }">
                <div class="flex items-start gap-3">
                  <input type="radio" name="progression-mode" value="AUTO_BALANCE" class="mt-1 text-primary focus:ring-primary" ${
                    this.state.progressionMode === 'AUTO_BALANCE' ? 'checked' : ''
                  }>
                  <div>
                    <div class="font-bold text-foreground text-xs sm:text-sm ${isKm ? 'font-khmer' : ''}">
                      ${t('promotion.modeAutoBalanceTitle')}
                    </div>
                    <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
                      ${t('promotion.modeAutoBalanceDesc')}
                    </p>
                  </div>
                </div>
                <div class="mt-3 pt-3 border-t border-border/60 text-[11px] font-mono text-purple-600 dark:text-purple-400">
                  A-Z (ក-អ) Round-Robin + 50/50 Gender Balance
                </div>
              </label>
            </div>

            <!-- Mode A Section Mapping Details & Unmapped Section Alerts -->
            ${this.state.progressionMode === 'DIRECT_SECTION' ? `
              <div class="mt-4 p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs text-foreground ${isKm ? 'font-khmer' : ''}">
                    ${isKm ? 'ស្ថានភាពសមមូលនៃថ្នាក់រៀន (Section Mapping Status):' : 'Section Mapping Verification:'}
                  </span>
                </div>

                <div class="flex flex-wrap gap-2">
                  ${sectionAnalysis.mappings.map(m => {
                    if (m.isMatched) {
                      return `
                        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold shadow-xs">
                          ${getIcon('check', 'w-3.5 h-3.5')}
                          <span>${this.escapeHtml(m.sourceName)} ➔ ${this.escapeHtml(m.targetClass.name)} (${m.studentCount} ${isKm ? 'នាក់' : 'students'})</span>
                        </div>
                      `;
                    } else {
                      return `
                        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold shadow-xs">
                          ${getIcon('alertTriangle', 'w-3.5 h-3.5')}
                          <span>${this.escapeHtml(m.sourceName)} ➔ ${this.escapeHtml(m.expectedTargetName)} (${t('promotion.unmappedSectionBadge').replace('{className}', m.expectedTargetName)})</span>
                        </div>
                      `;
                    }
                  }).join('')}
                </div>

                ${sectionAnalysis.hasUnmappedSections ? `
                  <div class="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                    <p class="font-bold flex items-center gap-1.5">
                      ${getIcon('alertTriangle', 'w-3.5 h-3.5')}
                      <span>${t('promotion.missingSectionWarningTitle')}</span>
                    </p>
                    <p class="leading-relaxed">
                      ${t('promotion.missingSectionWarningDesc')
                        .replace('{year}', this.state.targetAcademicYear)
                        .replace('{missingList}', sectionAnalysis.unmappedList.join(', '))}
                    </p>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <!-- Mode B: Target Classes Checkbox / Tag Picker (Strictly Existing Classes Only) -->
            ${this.state.progressionMode === 'AUTO_BALANCE' ? `
              <div id="auto-balance-classes-section" class="mt-4 p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs text-foreground ${isKm ? 'font-khmer' : ''}">
                    ${t('promotion.selectDestinationClassesLabel')} (Grade ${nextGrade}):
                  </span>
                  <span class="text-[11px] text-primary font-semibold">
                    ${this.state.selectedTargetClassIds.size} ${isKm ? 'ថ្នាក់បានជ្រើសរើស' : 'classes selected'}
                  </span>
                </div>

                <!-- Available Target Class Chips -->
                <div class="flex flex-wrap gap-2">
                  ${targetClasses.map(cls => {
                    const isSelected = this.state.selectedTargetClassIds.has(cls.id);
                    return `
                      <button type="button"
                              class="btn-target-class-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                                isSelected ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-card text-foreground border-border hover:bg-muted'
                              }"
                              data-class-id="${cls.id}">
                        ${getIcon(isSelected ? 'check' : 'plus', 'w-3 h-3')}
                        <span>${this.escapeHtml(cls.name)}</span>
                      </button>
                    `;
                  }).join('')}
                </div>

                ${this.state.selectedTargetClassIds.size === 0 ? `
                  <p class="text-xs text-destructive font-medium">
                    ⚠️ ${t('promotion.selectAtLeastOneClassError')}
                  </p>
                ` : ''}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- 3. Graduation Mode Info (When graduating) -->
        ${isGrad ? `
          <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-3">
            <span class="text-2xl">🎓</span>
            <div>
              <p class="font-bold">${isKm ? 'សិស្សនឹងត្រូវបានកំណត់ជា "បញ្ចប់ការសិក្សា" (Graduated)' : 'Students will be marked as "Graduated"'}</p>
              <p class="text-[11px] opacity-80 mt-0.5">${isKm ? 'សិស្សនឹងត្រូវបញ្ចប់កម្រិតសិក្សាផ្លូវការក្នុងឆ្នាំសិក្សាថ្មីនេះ។' : 'Students will be officially archived as graduates for the new academic year.'}</p>
            </div>
          </div>
        ` : ''}

        <!-- Step 2 Navigation Footer -->
        <div class="flex items-center justify-between p-4 bg-card border border-border rounded-xl shadow-xs">
          <button id="btn-p-step2-back" type="button" class="h-10 inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer">
            ${getIcon('arrowLeft', 'w-4 h-4')}
            <span>${t('common.back')}</span>
          </button>

          <button id="btn-p-step2-next"
                  type="button"
                  ${isNextBlocked ? 'disabled' : ''}
                  class="h-10 inline-flex items-center gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-semibold transition-all shadow-xs ${
                    isNextBlocked ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                  }">
            <span>${t('promotion.btnPreviewStep')}</span>
            ${getIcon('arrowRight', 'w-4 h-4')}
          </button>
        </div>
      </div>
    `;

    this.bindStep2Events();
  },

  bindStep2Events() {
    // 1. Target year change
    document.getElementById('select-target-year')?.addEventListener('change', (e) => {
      this.state.targetAcademicYear = e.target.value;
      this.syncTargetGradeWithAvailable();
      this.renderStep2(document.getElementById('promotion-step-content'));
    });

    // 2. Target grade change
    document.getElementById('select-target-grade')?.addEventListener('change', (e) => {
      this.state.targetGrade = e.target.value;
      this.state.isGraduation = this.state.targetGrade === 'Graduated';
      this.state.selectedTargetClassIds.clear();
      this.renderStep2(document.getElementById('promotion-step-content'));
    });

    // 3. Progression mode change
    document.querySelectorAll('input[name="progression-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.state.progressionMode = e.target.value;
        this.renderStep2(document.getElementById('promotion-step-content'));
      });
    });

    // 4. Target class chip toggles (Mode B)
    document.querySelectorAll('.btn-target-class-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cid = chip.getAttribute('data-class-id');
        if (this.state.selectedTargetClassIds.has(cid)) {
          this.state.selectedTargetClassIds.delete(cid);
        } else {
          this.state.selectedTargetClassIds.add(cid);
        }
        this.renderStep2(document.getElementById('promotion-step-content'));
      });
    });

    // 5. Back button
    document.getElementById('btn-p-step2-back')?.addEventListener('click', () => {
      this.state.currentStep = 1;
      this.renderLayout();
    });

    // 6. Next / Preview button
    document.getElementById('btn-p-step2-next')?.addEventListener('click', async () => {
      const year = (this.state.targetAcademicYear || '').trim();
      if (!year) {
        toast.error({ message: t('promotion.targetYearRequiredError') });
        return;
      }

      const isGrad = this.state.isGraduation || this.state.targetGrade === 'Graduated';
      if (!isGrad) {
        const targetClasses = this.getTargetClasses();
        if (targetClasses.length === 0) {
          toast.error({ message: t('promotion.noTargetClassesAlertTitle') });
          return;
        }

        if (this.state.progressionMode === 'DIRECT_SECTION') {
          const sectionAnalysis = this.getDirectSectionMapping(targetClasses);
          if (sectionAnalysis.hasUnmappedSections) {
            toast.error({
              message: t('promotion.noMatchingSectionFoundError').replace('{missingList}', sectionAnalysis.unmappedList.join(', '))
            });
            return;
          }
        } else if (this.state.progressionMode === 'AUTO_BALANCE') {
          if (this.state.selectedTargetClassIds.size === 0) {
            toast.error({ message: t('promotion.selectAtLeastOneClassError') });
            return;
          }
        }
      }

      try {
        await this.computePromotionPreview();
        this.state.currentStep = 3;
        this.renderLayout();
      } catch (err) {
        console.error('Error computing promotion preview:', err);
        toast.error({ message: err.message });
      }
    });
  },

  /**
   * Compute Assignments for Step 3 Preview (Strict Validation against classes store)
   */
  async computePromotionPreview() {
    const selectedStudents = this.cachedData.sourceStudents.filter(s => this.state.selectedStudentIds.has(s.id));
    const targetGrade = this.state.targetGrade;
    const isGrad = this.state.isGraduation || targetGrade === 'Graduated';

    if (isGrad) {
      this.cachedData.computedAssignments = selectedStudents.map(s => {
        return {
          studentId: s.id,
          student: s,
          oldClassName: this.state.classes.find(c => c.id === s.classId)?.name || s.classId || '-',
          targetClassId: null,
          targetClassName: 'Graduated'
        };
      });
      return;
    }

    const targetClasses = this.getTargetClasses();
    if (targetClasses.length === 0) {
      throw new Error(t('promotion.noTargetClassesAlertTitle'));
    }

    if (this.state.progressionMode === 'DIRECT_SECTION') {
      const sectionAnalysis = this.getDirectSectionMapping(targetClasses);
      if (sectionAnalysis.hasUnmappedSections) {
        throw new Error(t('promotion.noMatchingSectionFoundError').replace('{missingList}', sectionAnalysis.unmappedList.join(', ')));
      }

      const assignments = [];
      for (const s of selectedStudents) {
        const oldClass = this.state.classes.find(c => c.id === s.classId);
        const oldClassName = oldClass ? oldClass.name : (s.classId || '');
        const matchingClass = PromotionService.findMatchingClassSection(oldClassName, targetGrade, targetClasses);
        if (!matchingClass) {
          throw new Error(`Target classroom for section "${oldClassName}" does not exist.`);
        }

        assignments.push({
          studentId: s.id,
          student: s,
          oldClassName,
          targetClassId: matchingClass.id,
          targetClassName: matchingClass.name
        });
      }

      this.cachedData.computedAssignments = assignments;
    } else {
      // Auto-Balanced Mode across chosen classes
      const chosenClasses = targetClasses.filter(c => this.state.selectedTargetClassIds.has(c.id));
      if (chosenClasses.length === 0) {
        throw new Error(t('promotion.selectAtLeastOneClassError'));
      }

      const distributed = PromotionService.distributeStudentsBalanced(selectedStudents, chosenClasses);
      this.cachedData.computedAssignments = distributed.map(item => {
        return {
          studentId: item.student.id,
          student: item.student,
          oldClassName: this.state.classes.find(c => c.id === item.student.classId)?.name || item.student.classId || '-',
          targetClassId: item.targetClassId,
          targetClassName: item.targetClassName
        };
      });
    }
  },

  /**
   * STEP 3: Interactive Preview, Manual Reassignment, and Execution
   */
  renderStep3(container) {
    const isKm = i18n.getLocale() === 'km';
    const assignments = this.cachedData.computedAssignments || [];
    const isGrad = this.state.isGraduation || this.state.targetGrade === 'Graduated';
    const targetClasses = isGrad ? [] : this.getTargetClasses();

    // Compute live stats breakdown
    const statsMap = new Map();
    assignments.forEach(item => {
      const effClassId = this.state.manualOverrides.get(item.studentId) || item.targetClassId;
      const cls = this.state.classes.find(c => c.id === effClassId);
      const cName = cls ? cls.name : (isGrad ? 'Graduated' : 'Unassigned');

      if (!statsMap.has(cName)) {
        statsMap.set(cName, { name: cName, total: 0, female: 0, male: 0 });
      }
      const st = statsMap.get(cName);
      st.total++;
      const isFem = (item.student.gender || '').toLowerCase().includes('female') || (item.student.gender || '').includes('ស្រី');
      if (isFem) st.female++;
      else st.male++;
    });

    container.innerHTML = `
      <div class="space-y-4 animate-fade-in">
        <!-- Summary Cards Header -->
        <div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-bold text-foreground flex items-center gap-2 ${isKm ? 'font-khmer' : ''}">
                ${getIcon('badgeCheck', 'w-4 h-4 text-emerald-600')}
                <span>${t('promotion.previewHeading')}</span>
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                ${isKm ? `សិស្សសរុបចំនួន ${assignments.length} នាក់នឹងត្រូវឡើងទៅឆ្នាំសិក្សា ${this.state.targetAcademicYear}` : `Total ${assignments.length} students advancing to Academic Year ${this.state.targetAcademicYear}`}
              </p>
            </div>

            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                ${this.state.progressionMode === 'DIRECT_SECTION' ? t('promotion.modeDirectTitle') : t('promotion.modeAutoBalanceTitle')}
              </span>
            </div>
          </div>

          <!-- Class Distribution Cards -->
          <div class="flex flex-wrap gap-2 pt-1">
            ${Array.from(statsMap.values()).map(st => `
              <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-xs shadow-xs">
                <span class="font-bold text-foreground">${this.escapeHtml(st.name)}:</span>
                <span class="font-bold text-primary">${st.total} ${isKm ? 'នាក់' : ''}</span>
                <span class="text-[10px] font-semibold text-pink-600 bg-pink-500/10 px-1.5 py-0.5 rounded">${isKm ? 'ស្រី' : 'F'}: ${st.female}</span>
                <span class="text-[10px] font-semibold text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">${isKm ? 'ប្រុស' : 'M'}: ${st.male}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Preview Table Card -->
        <div class="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div class="overflow-x-auto max-h-[500px]">
            <table class="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead class="sticky top-0 z-10 bg-muted/95 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th class="w-12 py-2.5 px-2 text-center">#</th>
                  <th class="py-2.5 px-3 min-w-[100px]">${t('students.studentId')}</th>
                  <th class="py-2.5 px-3 min-w-[150px]">${t('students.nameKhmer')}</th>
                  <th class="py-2.5 px-3 min-w-[140px]">${t('students.nameLatin')}</th>
                  <th class="w-16 py-2.5 px-3 text-center">${t('students.gender')}</th>
                  <th class="py-2.5 px-3 min-w-[100px] text-center">${t('promotion.tableColOldClass')}</th>
                  <th class="py-2.5 px-3 min-w-[180px]">${t('promotion.tableColNewClass')}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border text-foreground">
                ${assignments.map((item, idx) => {
                  const s = item.student;
                  const effClassId = this.state.manualOverrides.get(s.id) || item.targetClassId;
                  const isMale = !((s.gender || '').toLowerCase().includes('female') || (s.gender || '').includes('ស្រី'));
                  const khmerName = [s.lastNameKh, s.firstNameKh].filter(Boolean).join(' ') || s.khmerName || s.name || '-';
                  const latinName = [s.lastNameLatin, s.firstNameLatin].filter(Boolean).join(' ') || s.englishName || '';

                  return `
                    <tr class="hover:bg-accent/30 transition-colors">
                      <td class="py-2 px-2 text-center font-mono text-[11px] text-muted-foreground">${idx + 1}</td>
                      <td class="py-2 px-3 font-mono text-[11px] font-semibold">${s.studentId || '-'}</td>
                      <td class="py-2 px-3 font-semibold text-foreground">${this.escapeHtml(khmerName)}</td>
                      <td class="py-2 px-3 font-mono text-[11px] text-muted-foreground uppercase">${this.escapeHtml(latinName)}</td>
                      <td class="py-2 px-3 text-center">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${isMale ? 'bg-blue-500/10 text-blue-600' : 'bg-pink-500/10 text-pink-600'}">
                          ${isMale ? (isKm ? 'ប្រុស' : 'M') : (isKm ? 'ស្រី' : 'F')}
                        </span>
                      </td>
                      <td class="py-2 px-3 text-center font-semibold text-muted-foreground">
                        <span class="px-2 py-0.5 rounded bg-muted text-foreground border border-border">${this.escapeHtml(item.oldClassName)}</span>
                      </td>
                      <td class="py-2 px-3">
                        ${isGrad ? `
                          <span class="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                            🎓 Graduated
                          </span>
                        ` : `
                          <select class="select-preview-class h-8 px-2 rounded-md border border-border bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary/20 cursor-pointer w-full max-w-[200px]"
                                  data-student-id="${s.id}">
                            ${targetClasses.map(cls => `
                              <option value="${cls.id}" ${cls.id === effClassId ? 'selected' : ''}>
                                ${cls.name} (${cls.academicYear || this.state.targetAcademicYear})
                              </option>
                            `).join('')}
                          </select>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Step 3 Action Footer -->
        <div class="flex items-center justify-between p-4 bg-card border border-border rounded-xl shadow-xs">
          <button id="btn-p-step3-back" type="button" class="h-10 inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer">
            ${getIcon('arrowLeft', 'w-4 h-4')}
            <span>${t('common.back')}</span>
          </button>

          <button id="btn-p-confirm-promote"
                  type="button"
                  class="h-10 inline-flex items-center gap-2 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer">
            ${getIcon('badgeCheck', 'w-4 h-4')}
            <span>${t('promotion.btnConfirmPromotion')}</span>
          </button>
        </div>
      </div>
    `;

    this.bindStep3Events();
  },

  bindStep3Events() {
    // 1. Back button
    document.getElementById('btn-p-step3-back')?.addEventListener('click', () => {
      this.state.currentStep = 2;
      this.renderLayout();
    });

    // 2. Individual dropdown changes
    document.querySelectorAll('.select-preview-class').forEach(select => {
      select.addEventListener('change', (e) => {
        const sid = select.getAttribute('data-student-id');
        this.state.manualOverrides.set(sid, e.target.value);
        this.renderStep3(document.getElementById('promotion-step-content'));
      });
    });

    // 3. Confirm Promotion execution
    document.getElementById('btn-p-confirm-promote')?.addEventListener('click', () => {
      this.executePromotion();
    });
  },

  async executePromotion() {
    const assignments = this.cachedData.computedAssignments || [];
    const isGrad = this.state.isGraduation || this.state.targetGrade === 'Graduated';
    const isKm = i18n.getLocale() === 'km';

    Modal.confirm({
      title: t('promotion.confirmDialogTitle'),
      message: isKm 
        ? `តើអ្នកពិតជាចង់ដំឡើងថ្នាក់សិស្សចំនួន ${assignments.length} នាក់ទៅឆ្នាំសិក្សា ${this.state.targetAcademicYear} មែនដែរឬទេ?` 
        : `Are you sure you want to promote ${assignments.length} students to Academic Year ${this.state.targetAcademicYear}?`,
      confirmText: t('promotion.btnConfirmPromotion'),
      type: 'info',
      onConfirm: async () => {
        const confirmBtn = document.getElementById('btn-p-confirm-promote');
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.innerHTML = `<span>⏳ ${t('common.processing')}</span>`;
        }

        try {
          const promotionsPayload = assignments.map(item => {
            const effClassId = this.state.manualOverrides.get(item.studentId) || item.targetClassId;
            const cls = this.state.classes.find(c => c.id === effClassId);
            return {
              studentId: item.studentId,
              targetClassId: effClassId,
              targetClassName: cls ? cls.name : item.targetClassName,
              oldClassName: item.oldClassName
            };
          });

          const result = await PromotionService.executePromotion({
            promotions: promotionsPayload,
            targetAcademicYear: this.state.targetAcademicYear,
            targetGrade: this.state.targetGrade,
            isGraduation: isGrad
          });

          toast.success({
            message: t('promotion.promotionSuccessToast').replace('{count}', result.promoted.length)
          });

          // Show Completion modal
          this.showCompletionModal(result);
        } catch (err) {
          console.error('Promotion execution error:', err);
          toast.error({ message: 'Error executing promotion: ' + err.message });
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `${getIcon('badgeCheck', 'w-4 h-4')} <span>${t('promotion.btnConfirmPromotion')}</span>`;
          }
        }
      }
    });
  },

  showCompletionModal(result) {
    const isKm = i18n.getLocale() === 'km';
    const breakdownArray = Array.from(result.classBreakdown.entries());

    const content = `
      <div class="space-y-4 text-xs text-center py-2">
        <div class="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl shadow-xs">
          ${getIcon('badgeCheck', 'w-8 h-8 text-emerald-500')}
        </div>

        <div>
          <h3 class="text-base font-bold text-foreground ${isKm ? 'font-khmer' : ''}">
            ${t('promotion.completedModalTitle')}
          </h3>
          <p class="text-xs text-muted-foreground mt-1">
            ${isKm ? `បានដំឡើងថ្នាក់សិស្សចំនួន ${result.promoted.length} នាក់ទៅឆ្នាំសិក្សា ${this.state.targetAcademicYear} ដោយជោគជ័យ!` : `Successfully promoted ${result.promoted.length} students to Academic Year ${this.state.targetAcademicYear}!`}
          </p>
        </div>

        <div class="p-3 bg-muted/40 rounded-xl border border-border space-y-2 text-left">
          <span class="font-bold text-foreground text-xs block mb-1">
            ${isKm ? 'ស្ថិតិតាមថ្នាក់រៀនថ្មី:' : 'Classroom Breakdown:'}
          </span>
          <div class="grid grid-cols-2 gap-2">
            ${breakdownArray.map(([cName, count]) => `
              <div class="p-2 bg-card rounded-lg border border-border flex items-center justify-between">
                <span class="font-semibold text-foreground">${this.escapeHtml(cName)}</span>
                <span class="font-bold text-primary">${count} ${isKm ? 'នាក់' : ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const footer = `
      <div class="flex items-center justify-end gap-2 w-full">
        <button id="btn-finish-promotion" type="button" class="h-10 px-5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all shadow-xs cursor-pointer">
          ${t('common.done') || 'Done'}
        </button>
      </div>
    `;

    const modal = Modal.open({
      title: t('promotion.completedModalTitle'),
      content,
      footer,
      maxWidth: 'max-w-md'
    });

    document.getElementById('btn-finish-promotion')?.addEventListener('click', () => {
      modal.forceClose();
      // Reload promotion page
      this.render(this.container);
    });
  },

  bindGlobalEvents() {
    document.getElementById('btn-reload-promotion')?.addEventListener('click', () => {
      this.render(this.container);
    });

    // Step navigators
    document.getElementById('step-nav-1')?.addEventListener('click', () => {
      this.state.currentStep = 1;
      this.renderLayout();
    });

    document.getElementById('step-nav-2')?.addEventListener('click', () => {
      if (this.state.selectedStudentIds.size > 0) {
        this.state.currentStep = 2;
        this.renderLayout();
      }
    });

    document.getElementById('step-nav-3')?.addEventListener('click', async () => {
      if (this.state.selectedStudentIds.size > 0 && this.state.targetAcademicYear) {
        await this.computePromotionPreview();
        this.state.currentStep = 3;
        this.renderLayout();
      }
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
