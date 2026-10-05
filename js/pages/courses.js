/**
 * Courses Management Page
 * Displays curriculum course list with G7-G12 grade scores and A-F grading scale calculation.
 */

import { CourseService, GRADE_KEYS } from '../services/courseService.js';
import { authService } from '../services/authService.js';
import { i18n, t } from '../i18n/i18n.js';
import { toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { getIcon } from '../components/icons.js';

export const CoursesPage = {
  container: null,
  state: {
    courses: [],
    loading: false,
    searchQuery: '',
    activeGrade: 'G8' // Default active grade preview matching reference screenshot
  },

  async render(containerId = 'main-content') {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    // 1. Instant render if courses are already present in memory (eliminates language change & tab switch flicker)
    if (this.state.courses && this.state.courses.length > 0) {
      this.renderLayout();
    }

    // 2. Fetch fresh data and render smoothly
    await this.loadData();
    this.renderLayout();
  },

  async loadData() {
    try {
      this.state.courses = await CourseService.getAll();
      const currentUser = authService.getCurrentUser();
      if (currentUser && !this.state.activeGrade) {
        this.state.activeGrade = await CourseService.resolveActiveGradeForUser(currentUser);
      }
    } catch (err) {
      console.error('Error loading courses:', err);
      if (!this.state.courses || this.state.courses.length === 0) {
        toast.error(t('common.errorLoading') || 'Failed to load courses');
        this.state.courses = [];
      }
    }
  },

  renderLayout() {
    if (!this.container) return;
    const isKm = i18n.getLocale() === 'km';
    const fontClass = isKm ? 'font-khmer' : '';
    const q = (this.state.searchQuery || '').trim().toLowerCase();

    // Filter courses by search query
    const filtered = this.state.courses.filter(c => {
      if (!q) return true;
      return (
        (c.courseId && c.courseId.toLowerCase().includes(q)) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.nameEn && c.nameEn.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q))
      );
    });

    const formatGradeLabel = (g) => {
      const num = g.replace(/\D/g, '');
      if (isKm) {
        const kmDigits = { '7': '៧', '8': '៨', '9': '៩', '10': '១០', '11': '១១', '12': '១២' };
        return `ថ្នាក់ទី ${kmDigits[num] || num} (${g})`;
      }
      return `Grade ${num} (${g})`;
    };

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12">
        <!-- Top Title Bar & Settings Bar -->
        <div class="flex items-center justify-between gap-4 pt-1">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground ${fontClass}">
              ${t('courses.title') || 'គ្រប់គ្រងមុខវិជ្ជា'}
            </h1>
          </div>
          
          <div class="flex items-center gap-3">
            <!-- Active Grade Context Selector / Settings -->
            <div class="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg shadow-xs">
              <span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
              <span class="text-xs text-muted-foreground font-medium flex items-center gap-1 ${fontClass}">
                ${getIcon('settings', 'w-3.5 h-3.5')}
                ${t('courses.actions') || 'ការកំណត់'}:
              </span>
              <select id="select-active-grade" class="bg-transparent text-xs font-bold text-primary focus:outline-none cursor-pointer ${fontClass}">
                ${GRADE_KEYS.map(g => `
                  <option value="${g}" ${this.state.activeGrade === g ? 'selected' : ''}>
                    ${formatGradeLabel(g)}
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Add Course Button -->
            <button id="btn-add-course"
                    type="button"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 active:bg-primary/95 text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer ${fontClass}">
              ${getIcon('plus', 'w-4 h-4')}
              <span>${t('courses.addCourse') || 'មុខវិជ្ជាថ្មី'}</span>
            </button>
          </div>
        </div>

        <!-- Search Bar Section -->
        <div class="relative w-full">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
            ${getIcon('search', 'w-4 h-4')}
          </div>
          <input type="text"
                 id="input-course-search"
                 value="${this.state.searchQuery || ''}"
                 placeholder="${t('courses.searchPlaceholder') || 'ស្វែងរកមុខវិជ្ជា...'}"
                 class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs transition-all ${fontClass}" />
        </div>

        <!-- Courses Table -->
        <div class="border border-border/80 rounded-xl bg-card overflow-hidden shadow-2xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs sm:text-sm ${fontClass}">
              <!-- Table Header with Sub-headers for Grade Scores -->
              <thead class="bg-muted/40 text-muted-foreground text-[11px] sm:text-xs font-semibold uppercase tracking-wider select-none border-b border-border ${fontClass}">
                <tr>
                  <th scope="col" rowspan="2" class="w-12 px-3 py-3 text-center border-r border-border/50">
                    <div class="flex justify-center text-muted-foreground/80">
                      ${getIcon('graduationCap', 'w-4 h-4')}
                    </div>
                  </th>
                  <th scope="col" rowspan="2" class="px-4 py-3 min-w-[110px] font-semibold text-foreground border-r border-border/50 ${fontClass}">
                    ${t('courses.courseId') || 'លេខកូដមុខវិជ្ជា'}
                  </th>
                  <th scope="col" rowspan="2" class="px-4 py-3 min-w-[160px] font-semibold text-foreground border-r border-border/50 ${fontClass}">
                    ${t('courses.courseName') || 'ឈ្មោះមុខវិជ្ជា'}
                  </th>
                  <th scope="col" colspan="6" class="px-4 py-2 text-center font-bold text-foreground bg-muted/20 border-r border-border/50 ${fontClass}">
                    ${t('courses.scoreByGrade') || 'ពិន្ទុតាមកម្រិតថ្នាក់'}
                  </th>
                  <th scope="col" rowspan="2" class="px-4 py-3 min-w-[280px] font-semibold text-foreground border-r border-border/50 ${fontClass}">
                    ${t('courses.gradingScale') || 'កម្រិតពិន្ទុតាមនិទ្ទេស'}
                  </th>
                  <th scope="col" rowspan="2" class="px-4 py-3 text-center min-w-[90px] font-semibold text-foreground ${fontClass}">
                    ${t('courses.actions') || 'ការកំណត់'}
                  </th>
                </tr>
                <tr class="border-t border-border/40 text-[10px] sm:text-[11px] font-bold">
                  <th class="px-2.5 py-1.5 text-center border-r border-border/40 ${this.state.activeGrade === 'G7' ? 'bg-primary/10 text-primary font-extrabold' : ''}">G7</th>
                  <th class="px-2.5 py-1.5 text-center border-r border-border/40 ${this.state.activeGrade === 'G8' ? 'bg-primary/10 text-primary font-extrabold' : ''}">G8</th>
                  <th class="px-2.5 py-1.5 text-center border-r border-border/40 ${this.state.activeGrade === 'G9' ? 'bg-primary/10 text-primary font-extrabold' : ''}">G9</th>
                  <th class="px-2.5 py-1.5 text-center border-r border-border/40 ${this.state.activeGrade === 'G10' ? 'bg-primary/10 text-primary font-extrabold' : ''}">G10</th>
                  <th class="px-2.5 py-1.5 text-center border-r border-border/40 ${this.state.activeGrade === 'G11' ? 'bg-primary/10 text-primary font-extrabold' : ''}">G11</th>
                  <th class="px-2.5 py-1.5 text-center border-r border-border/50 ${this.state.activeGrade === 'G12' ? 'bg-primary/10 text-primary font-extrabold' : ''}">G12</th>
                </tr>
              </thead>

              <!-- Table Body -->
              <tbody class="divide-y divide-border/60 ${fontClass}">
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="11" class="text-center py-12 text-muted-foreground ${fontClass}">
                      <div class="flex flex-col items-center justify-center gap-2">
                        ${getIcon('inbox', 'w-8 h-8 text-muted-foreground/50')}
                        <span>${t('courses.noData') || 'មិនទាន់មានមុខវិជ្ជាណាមួយនៅឡើយទេ'}</span>
                      </div>
                    </td>
                  </tr>
                ` : filtered.map(item => {
                  const scores = item.scores || {};
                  const activeScore = scores[this.state.activeGrade] !== undefined ? scores[this.state.activeGrade] : 0;
                  const scaleText = CourseService.getGradingScaleText(this.state.activeGrade, activeScore);
                  const mainName = isKm ? item.name : (item.nameEn || item.name);
                  const subName = isKm ? item.nameEn : (item.nameEn ? item.name : '');

                  return `
                    <tr class="hover:bg-muted/20 transition-colors group">
                      <!-- Icon -->
                      <td class="px-3 py-3.5 text-center text-muted-foreground border-r border-border/40">
                        <div class="flex justify-center group-hover:text-primary transition-colors">
                          ${getIcon('graduationCap', 'w-4 h-4')}
                        </div>
                      </td>

                      <!-- Course ID -->
                      <td class="px-4 py-3.5 font-semibold text-foreground border-r border-border/40 whitespace-nowrap">
                        <span class="font-mono text-xs text-foreground tracking-tight">${item.courseId}</span>
                      </td>

                      <!-- Course Name -->
                      <td class="px-4 py-3.5 border-r border-border/40 ${fontClass}">
                        <div class="font-medium text-foreground text-sm">${mainName}</div>
                        ${subName ? `<div class="text-[11px] text-muted-foreground/80">${subName}</div>` : ''}
                      </td>

                      <!-- G7 Score -->
                      <td class="px-2.5 py-3.5 text-center border-r border-border/40 text-xs ${this.state.activeGrade === 'G7' ? 'font-bold text-primary bg-primary/5' : 'text-muted-foreground'}">
                        ${scores.G7 !== undefined ? scores.G7 : 0}
                      </td>

                      <!-- G8 Score -->
                      <td class="px-2.5 py-3.5 text-center border-r border-border/40 text-xs ${this.state.activeGrade === 'G8' ? 'font-bold text-primary bg-primary/5' : 'text-muted-foreground'}">
                        ${scores.G8 !== undefined ? scores.G8 : 0}
                      </td>

                      <!-- G9 Score -->
                      <td class="px-2.5 py-3.5 text-center border-r border-border/40 text-xs ${this.state.activeGrade === 'G9' ? 'font-bold text-primary bg-primary/5' : 'text-muted-foreground'}">
                        ${scores.G9 !== undefined ? scores.G9 : 0}
                      </td>

                      <!-- G10 Score -->
                      <td class="px-2.5 py-3.5 text-center border-r border-border/40 text-xs ${this.state.activeGrade === 'G10' ? 'font-bold text-primary bg-primary/5' : 'text-muted-foreground'}">
                        ${scores.G10 !== undefined ? scores.G10 : 0}
                      </td>

                      <!-- G11 Score -->
                      <td class="px-2.5 py-3.5 text-center border-r border-border/40 text-xs ${this.state.activeGrade === 'G11' ? 'font-bold text-primary bg-primary/5' : 'text-muted-foreground'}">
                        ${scores.G11 !== undefined ? scores.G11 : 0}
                      </td>

                      <!-- G12 Score -->
                      <td class="px-2.5 py-3.5 text-center border-r border-border/50 text-xs ${this.state.activeGrade === 'G12' ? 'font-bold text-primary bg-primary/5' : 'text-muted-foreground'}">
                        ${scores.G12 !== undefined ? scores.G12 : 0}
                      </td>

                      <!-- Grading Scale (A-F) -->
                      <td class="px-4 py-3.5 text-xs text-foreground border-r border-border/40 leading-relaxed ${fontClass}">
                        <span class="text-muted-foreground ${fontClass}">${scaleText}</span>
                      </td>

                      <!-- Actions -->
                      <td class="px-4 py-3.5 text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1.5">
                          <button type="button"
                                  data-action="edit"
                                  data-id="${item.id}"
                                  title="${t('common.edit') || 'Edit'}"
                                  class="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer">
                            ${getIcon('pencil', 'w-3.5 h-3.5')}
                          </button>
                          <button type="button"
                                  data-action="delete"
                                  data-id="${item.id}"
                                  title="${t('common.delete') || 'Delete'}"
                                  class="p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer">
                            ${getIcon('trash2', 'w-3.5 h-3.5')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    if (!this.container) return;

    // Search input handler
    const searchInput = this.container.querySelector('#input-course-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value;
        this.renderLayout();
        const freshInput = this.container.querySelector('#input-course-search');
        if (freshInput) {
          freshInput.focus();
          freshInput.setSelectionRange(freshInput.value.length, freshInput.value.length);
        }
      });
    }

    // Active Grade Selector
    const gradeSelect = this.container.querySelector('#select-active-grade');
    if (gradeSelect) {
      gradeSelect.addEventListener('change', (e) => {
        this.state.activeGrade = e.target.value;
        this.renderLayout();
      });
    }

    // Add Course button
    const addBtn = this.container.querySelector('#btn-add-course');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.openCourseModal();
      });
    }

    // Edit and Delete buttons on table rows
    this.container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const course = this.state.courses.find(c => c.id === id);

        if (action === 'edit' && course) {
          this.openCourseModal(course);
        } else if (action === 'delete' && course) {
          this.confirmDeleteCourse(course);
        }
      });
    });
  },

  /**
   * Add / Edit Course Modal
   */
  async openCourseModal(existingCourse = null) {
    const isKm = i18n.getLocale() === 'km';
    const fontClass = isKm ? 'font-khmer' : '';
    const isEdit = Boolean(existingCourse);

    const defaultId = isEdit ? existingCourse.courseId : await CourseService.generateCourseId();
    const scores = existingCourse?.scores || { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 };

    const activeGradeName = isKm ? 'ថ្នាក់ទី ៨' : 'Grade 8';
    const scalePreviewLabel = (t('courses.scalePreviewTitle') || (isKm ? 'ការគណនាកម្រិតពិន្ទុតាមនិទ្ទេស (A-F) គំរូ {grade}:' : 'Grading Scale Calculation Preview (A-F) for {grade}:')).replace('{grade}', activeGradeName);

    const modalContent = `
      <div class="space-y-4 p-5 select-none ${fontClass}">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Course ID -->
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">
              ${t('courses.courseId') || (isKm ? 'លេខកូដមុខវិជ្ជា' : 'Course ID')} <span class="text-rose-500">*</span>
            </label>
            <input type="text"
                   id="modal-course-id"
                   value="${defaultId}"
                   class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase font-mono" />
            <p id="modal-id-err" class="text-[11px] text-rose-500 mt-1 hidden"></p>
          </div>

          <!-- Category -->
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">
              ${t('courses.category') || 'ក្រុមមុខវិជ្ជា'}
            </label>
            <input type="text"
                   id="modal-course-category"
                   value="${existingCourse?.category || (isKm ? 'វិទ្យាសាស្ត្រពិត' : 'Natural Science')}"
                   list="category-presets"
                   class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <datalist id="category-presets">
              <option value="${t('courses.catKhmer') || 'ភាសាខ្មែរ'}"></option>
              <option value="${t('courses.catScience') || 'វិទ្យាសាស្ត្រពិត'}"></option>
              <option value="${t('courses.catSocial') || 'វិទ្យាសាស្ត្រសង្គម'}"></option>
              <option value="${t('courses.catForeign') || 'ភាសាបរទេស'}"></option>
              <option value="${t('courses.catLifeSkill') || 'បំណិនជីវិត'}"></option>
              <option value="${t('courses.catTech') || 'បច្ចេកវិទ្យា'}"></option>
              <option value="${t('courses.catSportArt') || 'កីឡា និងសិល្បៈ'}"></option>
              <option value="${t('courses.catGeneral') || 'ទូទៅ'}"></option>
            </datalist>
          </div>

          <!-- Course Name (Khmer) -->
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-foreground mb-1">
              ${t('courses.courseNameKhmer') || (isKm ? 'ឈ្មោះមុខវិជ្ជា (ខ្មែរ)' : 'Course Name (Khmer)')} <span class="text-rose-500">*</span>
            </label>
            <input type="text"
                   id="modal-course-name"
                   value="${existingCourse?.name || ''}"
                   placeholder="${isKm ? 'ឧ. គណិតវិទ្យា' : 'e.g. គណិតវិទ្យា'}"
                   class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <p id="modal-name-err" class="text-[11px] text-rose-500 mt-1 hidden"></p>
          </div>

          <!-- English Name -->
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-foreground mb-1">
              ${t('courses.courseNameEn') || (isKm ? 'ឈ្មោះជាភាសាអង់គ្លេស (English Name)' : 'English Name')}
            </label>
            <input type="text"
                   id="modal-course-name-en"
                   value="${existingCourse?.nameEn || ''}"
                   placeholder="${isKm ? 'ឧ. Mathematics' : 'e.g. Mathematics'}"
                   class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>

        <!-- Scores per Grade level (G7-G12) -->
        <div class="pt-2 border-t border-border">
          <label class="block text-xs font-bold text-foreground mb-2">
            ${t('courses.scoreByGradeSubtitle') || (isKm ? 'ពិន្ទុតាមកម្រិតថ្នាក់' : 'Maximum Score by Grade Level (G7-G12)')}
          </label>
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
            ${GRADE_KEYS.map(g => `
              <div class="bg-muted/30 p-2 rounded-lg border border-border text-center">
                <span class="block text-[11px] font-bold text-primary mb-1">${g}</span>
                <input type="number"
                       min="0"
                       max="200"
                       data-grade="${g}"
                       id="modal-score-${g}"
                       value="${scores[g] !== undefined ? scores[g] : 0}"
                       class="score-input w-full text-center px-1.5 py-1 text-xs font-semibold rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${fontClass}" />
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Dynamic Grading Scale Live Preview -->
        <div class="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs space-y-1">
          <div class="font-bold text-primary flex items-center gap-1.5">
            ${getIcon('badgeCheck', 'w-3.5 h-3.5')}
            <span>${scalePreviewLabel}</span>
          </div>
          <p id="modal-preview-scale" class="text-xs text-foreground leading-relaxed ${fontClass}">
            ${CourseService.getGradingScaleText('G8', scores.G8 || 50)}
          </p>
        </div>

        <!-- Modal Actions -->
        <div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <button type="button"
                  id="modal-btn-cancel"
                  class="px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer">
            ${t('common.cancel') || 'បោះបង់'}
          </button>
          <button type="button"
                  id="modal-btn-save"
                  class="px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors cursor-pointer">
            ${t('common.save') || 'រក្សាទុក'}
          </button>
        </div>
      </div>
    `;

    const modal = Modal.show({
      title: isEdit ? (t('courses.editCourse') || 'កែប្រែមុខវិជ្ជា') : (t('courses.addCourse') || 'បន្ថែមមុខវិជ្ជាថ្មី'),
      content: modalContent,
      width: 'max-w-xl',
      onClose: () => {}
    });

    const modalEl = document.getElementById(modal.id);
    if (!modalEl) return;

    // Live update grading scale preview when score inputs change
    const updatePreview = () => {
      const g8Input = modalEl.querySelector('#modal-score-G8');
      const previewEl = modalEl.querySelector('#modal-preview-scale');
      if (g8Input && previewEl) {
        const val = Number(g8Input.value) || 0;
        previewEl.textContent = CourseService.getGradingScaleText('G8', val);
      }
    };

    modalEl.querySelectorAll('.score-input').forEach(input => {
      input.addEventListener('input', updatePreview);
    });

    // Cancel button
    modalEl.querySelector('#modal-btn-cancel')?.addEventListener('click', () => {
      modal.close();
    });

    // Save button
    modalEl.querySelector('#modal-btn-save')?.addEventListener('click', async () => {
      const idInput = modalEl.querySelector('#modal-course-id');
      const nameInput = modalEl.querySelector('#modal-course-name');
      const nameEnInput = modalEl.querySelector('#modal-course-name-en');
      const catInput = modalEl.querySelector('#modal-course-category');
      const idErr = modalEl.querySelector('#modal-id-err');
      const nameErr = modalEl.querySelector('#modal-name-err');

      if (idErr) idErr.classList.add('hidden');
      if (nameErr) nameErr.classList.add('hidden');

      const courseId = idInput?.value.trim().toUpperCase();
      const name = nameInput?.value.trim();

      if (!courseId) {
        if (idErr) {
          idErr.textContent = t('courses.enterCourseId') || (isKm ? 'សូមបញ្ចូល Course ID' : 'Please enter Course ID');
          idErr.classList.remove('hidden');
        }
        idInput?.focus();
        return;
      }

      if (!name) {
        if (nameErr) {
          nameErr.textContent = t('courses.nameRequired') || 'សូមបញ្ចូលឈ្មោះមុខវិជ្ជា';
          nameErr.classList.remove('hidden');
        }
        nameInput?.focus();
        return;
      }

      const rawScores = {};
      GRADE_KEYS.forEach(g => {
        const input = modalEl.querySelector(`#modal-score-${g}`);
        rawScores[g] = input ? Number(input.value) || 0 : 0;
      });

      const courseData = {
        courseId,
        name,
        nameEn: nameEnInput?.value.trim() || '',
        category: catInput?.value.trim() || (isKm ? 'ទូទៅ' : 'General'),
        scores: rawScores
      };

      try {
        if (isEdit) {
          await CourseService.update(existingCourse.id, courseData);
          toast.success(t('courses.updatedSuccess') || 'បានកែប្រែមុខវិជ្ជាដោយជោគជ័យ');
        } else {
          await CourseService.create(courseData);
          toast.success(t('courses.savedSuccess') || 'បានរក្សាទុកមុខវិជ្ជាដោយជោគជ័យ');
        }
        modal.close();
        await this.loadData();
        this.renderLayout();
      } catch (err) {
        toast.error(err.message);
        if (err.message.includes('already exists') || err.message.includes('already used')) {
          if (idErr) {
            idErr.textContent = t('courses.duplicateId') || 'Course ID នេះមានរួចហើយ';
            idErr.classList.remove('hidden');
          }
          idInput?.focus();
        }
      }
    });
  },

  /**
   * Delete confirmation
   */
  async confirmDeleteCourse(course) {
    const isKm = i18n.getLocale() === 'km';
    const fontClass = isKm ? 'font-khmer' : '';

    const courseDisplayName = isKm ? course.name : (course.nameEn || course.name);
    const confirmMessage = (t('courses.deleteConfirmMessage') || 'តើអ្នកពិតជាចង់លុបមុខវិជ្ជា "{name}" ({code}) នេះមែនទេ?')
      .replace('{name}', courseDisplayName)
      .replace('{code}', course.courseId);

    const content = `
      <div class="p-5 space-y-4 select-none ${fontClass}">
        <p class="text-sm text-foreground leading-relaxed">
          ${confirmMessage}
        </p>
        <div class="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1">
          <div class="font-bold text-foreground">${course.name}${course.nameEn ? ` (${course.nameEn})` : ''}</div>
          <div class="font-mono text-muted-foreground">${course.courseId} • ${course.category || ''}</div>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button"
                  id="confirm-del-cancel"
                  class="px-4 py-2 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer">
            ${t('common.cancel') || 'បោះបង់'}
          </button>
          <button type="button"
                  id="confirm-del-proceed"
                  class="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors cursor-pointer">
            ${t('common.delete') || 'លុបមុខវិជ្ជា'}
          </button>
        </div>
      </div>
    `;

    const modal = Modal.show({
      title: t('courses.deleteConfirmTitle') || (isKm ? 'បញ្ជាក់ការលុបមុខវិជ្ជា' : 'Confirm Course Deletion'),
      content,
      width: 'max-w-md',
      onClose: () => {}
    });

    const modalEl = document.getElementById(modal.id);
    if (!modalEl) return;

    modalEl.querySelector('#confirm-del-cancel')?.addEventListener('click', () => {
      modal.close();
    });

    modalEl.querySelector('#confirm-del-proceed')?.addEventListener('click', async () => {
      try {
        await CourseService.delete(course.id);
        toast.success(t('courses.deletedSuccess') || 'បានលុបមុខវិជ្ជាដោយជោគជ័យ');
        modal.close();
        await this.loadData();
        this.renderLayout();
      } catch (err) {
        toast.error(err.message);
      }
    });
  }
};
