/**
 * Subjects Management Page
 * Standard curriculum subjects management with scores by grade level (G7-G12) and credit hours.
 * Role-aware behavior:
 * - Teacher: Automatically locked to their single classroom's grade (e.g. 7A -> G7), cannot switch other grades.
 * - Director: Can freely switch and inspect all grade levels (G7 - G12).
 */

import { SubjectService, GRADES } from '../services/subjectService.js';
import { ClassService } from '../services/classService.js';
import { authService } from '../services/authService.js';
import { i18n, t } from '../i18n/i18n.js';
import { toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { getIcon } from '../components/icons.js';

export const SubjectsPage = {
  container: null,
  state: {
    subjects: [],
    classes: [],
    teacherClass: null,
    isTeacher: false,
    searchQuery: '',
    previewScore: 50,
    activeGrade: 'G7',
    selectedClassId: 'all'
  },

  async render(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    if (!this.container) return;

    try {
      await this.loadData();
      this.renderLayout();
    } catch (err) {
      console.error('SubjectsPage render error:', err);
      if (this.container) {
        this.container.innerHTML = `
          <div class="p-6 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            <h4 class="font-bold">Error loading Subjects</h4>
            <p class="mt-1">${err.message}</p>
          </div>
        `;
      }
    }
  },

  async loadData() {
    try {
      const isTeacher = authService.isTeacher();
      this.state.isTeacher = isTeacher;

      const [subjectsList, classesList] = await Promise.all([
        SubjectService.getAll(),
        ClassService.getAll().catch(() => [])
      ]);
      this.state.subjects = Array.isArray(subjectsList) ? subjectsList : [];
      this.state.classes = Array.isArray(classesList) ? classesList : [];

      if (isTeacher) {
        // Teacher has strictly 1 classroom: detect its name & lock to its grade level
        const teacherClasses = await ClassService.getClassesForTeacher().catch(() => []);
        if (teacherClasses.length > 0 && teacherClasses[0]) {
          this.state.teacherClass = teacherClasses[0];
          this.state.selectedClassId = teacherClasses[0].id;
          if (teacherClasses[0].name) {
            this.state.activeGrade = SubjectService.extractGradeFromClassName(teacherClasses[0].name);
          }
        } else {
          this.state.teacherClass = null;
          this.state.activeGrade = 'G7';
        }
      } else {
        // Director / Admin account: can inspect all grades
        this.state.teacherClass = null;
        if (!this.state.activeGrade) {
          if (this.state.classes.length > 0 && this.state.classes[0].name) {
            this.state.activeGrade = SubjectService.extractGradeFromClassName(this.state.classes[0].name);
          } else {
            this.state.activeGrade = 'G7';
          }
        }
      }
    } catch (err) {
      console.error('Error loading subjects data:', err);
      this.state.subjects = [];
      this.state.classes = [];
      this.state.teacherClass = null;
    }
  },

  renderLayout() {
    if (!this.container) return;
    const isKm = i18n.getLocale() === 'km';
    const fontClass = isKm ? 'font-khmer' : '';
    const q = (this.state.searchQuery || '').trim().toLowerCase();
    const isTeacher = this.state.isTeacher;
    const teacherClass = this.state.teacherClass;
    const activeGrade = this.state.activeGrade || 'G7';

    const subjectsList = Array.isArray(this.state.subjects) ? this.state.subjects : [];

    // Filter subjects by search query
    const filtered = subjectsList.filter(s => {
      if (!s) return false;
      return !q || (
        (s.code && String(s.code).toLowerCase().includes(q)) ||
        (s.name && String(s.name).toLowerCase().includes(q)) ||
        (s.nameEn && String(s.nameEn).toLowerCase().includes(q))
      );
    });

    const scalePreview = SubjectService.getGradingScaleSummary(this.state.previewScore || 50);

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12">
        <!-- Top Title Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground ${fontClass}">
              ${t('subjects.title') || 'គ្រប់គ្រងមុខវិជ្ជា'}
            </h1>
            <p class="text-xs sm:text-sm text-muted-foreground mt-1 ${fontClass}">
              ${t('subjects.subtitle') || 'បញ្ជីមុខវិជ្ជាកម្មវិធីសិក្សាជាតិ ពិន្ទុតាមកម្រិតថ្នាក់ (G7-G12) និងចំនួនម៉ោងបង្រៀន'}
            </p>
          </div>
          
          <div class="flex items-center gap-3">
            <!-- Add Subject Button -->
            <button id="btn-add-subject"
                    type="button"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 active:bg-primary/95 text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer ${fontClass}">
              ${getIcon('plus', 'w-4 h-4')}
              <span>${t('subjects.addSubject') || 'មុខវិជ្ជាថ្មី'}</span>
            </button>
          </div>
        </div>

        <!-- Grading Formula & Scale Banner (MoEYS Standard A-F) -->
        <div class="p-4 rounded-xl bg-card border border-border shadow-2xs space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <h3 class="text-xs sm:text-sm font-bold text-foreground ${fontClass}">
                ${isKm ? 'រូបមន្តគណនានិទ្ទេស' : 'Grading Scale Formula (A-F)'}
              </h3>
              <span class="text-[11px] text-muted-foreground hidden sm:inline">•</span>
              <span class="text-[11px] text-muted-foreground hidden sm:inline ${fontClass}">
                ${isTeacher && teacherClass 
                  ? (isKm ? `គណនាផ្អែកលើថ្នាក់ ${teacherClass.name} កម្រិត ${activeGrade}` : `Calculated for class ${teacherClass.name} (${activeGrade})`)
                  : (isKm ? 'យោងតាមកម្រិតថ្នាក់ជាក់ស្តែង' : 'Matched by classroom name (e.g. 7A = Grade 7)')}
              </span>
            </div>

            <!-- Score Preview Selector -->
            <div class="flex items-center gap-1.5 text-xs">
              <span class="text-muted-foreground ${fontClass}">${isKm ? 'គំរូពិន្ទុពេញ៖' : 'Sample Full Score:'}</span>
              ${[100, 50, 40, 60, 35, 25].map(pts => `
                <button type="button"
                        data-score="${pts}"
                        class="btn-preview-score px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${this.state.previewScore === pts ? 'bg-primary text-primary-foreground shadow-2xs' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}">
                  ${pts}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Grade Brackets Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            ${scalePreview.map(item => {
              let badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
              if (item.grade === 'B') badgeColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
              if (item.grade === 'C') badgeColor = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
              if (item.grade === 'D') badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
              if (item.grade === 'E') badgeColor = 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
              if (item.grade === 'F') badgeColor = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';

              return `
                <div class="p-2.5 rounded-lg border bg-muted/20 border-border/80 flex flex-col justify-between space-y-1 text-center">
                  <div class="flex items-center justify-between">
                    <span class="px-2 py-0.5 rounded font-mono font-bold text-xs border ${badgeColor}">
                      ${item.grade}
                    </span>
                    <span class="text-[10px] font-mono text-muted-foreground">${item.percentRange}</span>
                  </div>
                  <div class="font-bold text-xs text-foreground ${fontClass}">
                    ${isKm ? item.labelKm : item.labelEn}
                  </div>
                  <div class="text-[11px] font-mono font-semibold text-primary pt-0.5">
                    ${item.grade === 'F' ? `< ${item.maxScore + 0.1}` : `${item.minScore} - ${item.maxScore}`} pts
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Search Bar -->
        <div class="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div class="relative w-full sm:max-w-md">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
              ${getIcon('search', 'w-4 h-4')}
            </div>
            <input type="text"
                   id="input-subject-search"
                   value="${this.state.searchQuery || ''}"
                   placeholder="${t('subjects.searchPlaceholder') || 'ស្វែងរកមុខវិជ្ជា (ឈ្មោះ, កូដ)...'}"
                   class="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs transition-all ${fontClass}" />
          </div>

          <!-- Total Count Badge -->
          <div class="text-xs text-muted-foreground font-mono self-end sm:self-center">
            ${isKm ? `សរុប៖ ${filtered.length} មុខវិជ្ជា` : `Total: ${filtered.length} Subjects`}
          </div>
        </div>

        <!-- Subjects Table Card -->
        <div class="border border-border rounded-xl bg-card overflow-hidden shadow-2xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs sm:text-sm ${fontClass}">
              <thead class="bg-muted/50 text-muted-foreground select-none border-b border-border">
                <tr>
                  <th scope="col" class="w-12 px-3 py-3 text-center font-semibold text-foreground border-r border-border/60">
                    ${isKm ? 'ល.រ' : 'No.'}
                  </th>
                  <th scope="col" class="w-28 px-3.5 py-3 font-semibold text-foreground border-r border-border/60 whitespace-nowrap ${fontClass}">
                    ${t('subjects.code') || 'កូដមុខវិជ្ជា'}
                  </th>
                  <th scope="col" class="px-4 py-3 font-semibold text-foreground border-r border-border/60 min-w-[200px] ${fontClass}">
                    ${isKm ? 'ឈ្មោះមុខវិជ្ជា' : 'Subject Name'}
                  </th>

                  <!-- Grade Columns G7 to G12 -->
                  ${GRADES.map(g => {
                    const isColActive = g === activeGrade;
                    const canClick = !isTeacher;
                    let headerClasses = 'w-14 min-w-[56px] px-1 py-2.5 text-center border-r border-border/60 transition-colors ';
                    
                    if (isColActive) {
                      headerClasses += 'text-primary font-bold bg-primary/15 ';
                    } else {
                      headerClasses += 'text-muted-foreground ';
                    }

                    if (canClick) {
                      headerClasses += 'cursor-pointer hover:bg-muted/70 hover:text-foreground ';
                    } else {
                      headerClasses += 'cursor-default ';
                    }

                    return `
                      <th scope="col" 
                          data-grade="${g}"
                          title="${isTeacher ? (isColActive ? (isKm ? `ថ្នាក់រៀនរបស់អ្នក កម្រិត ${activeGrade}` : `Your assigned classroom (${activeGrade})`) : (isKm ? 'ថ្នាក់ផ្សេងទៀតត្រូវបានចាក់សោ' : 'Locked for teacher account')) : (isKm ? `ចុចដើម្បីផ្ដោតលើកម្រិតថ្នាក់ ${g}` : `Click to focus on ${g}`)}"
                          class="${canClick ? 'btn-select-grade' : ''} ${headerClasses}">
                        <div class="flex flex-col items-center justify-center leading-tight">
                          <span class="font-mono font-bold text-xs">${g}</span>
                          <span class="text-[9px] ${isColActive ? 'text-primary font-semibold' : 'text-muted-foreground/70'} ${fontClass}">${isKm ? 'ពិន្ទុ' : 'Score'}</span>
                        </div>
                      </th>
                    `;
                  }).join('')}

                  <th scope="col" class="w-24 px-3 py-3 text-center font-semibold text-foreground border-r border-border/60 whitespace-nowrap ${fontClass}">
                    ${isKm ? 'ម៉ោង/សប្តាហ៍' : 'Hours/wk'}
                  </th>
                  <th scope="col" class="w-24 px-3 py-3 text-center font-semibold text-foreground whitespace-nowrap ${fontClass}">
                    ${t('common.actions') || 'សកម្មភាព'}
                  </th>
                </tr>
              </thead>

              <tbody class="divide-y divide-border/60 ${fontClass}">
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="11" class="text-center py-12 text-muted-foreground ${fontClass}">
                      <div class="flex flex-col items-center justify-center gap-2">
                        ${getIcon('inbox', 'w-8 h-8 text-muted-foreground/50')}
                        <span>${t('subjects.noData') || 'មិនទាន់មានមុខវិជ្ជាណាមួយនៅឡើយទេ'}</span>
                      </div>
                    </td>
                  </tr>
                ` : filtered.map((item, idx) => {
                  const mainName = isKm ? item.name : (item.nameEn || item.name);
                  const subName = isKm ? item.nameEn : (item.nameEn ? item.name : '');
                  const scores = item.scoreByGrade || {};

                  return `
                    <tr class="hover:bg-muted/20 transition-colors group">
                      <!-- Row No -->
                      <td class="px-2 py-3 text-center text-muted-foreground border-r border-border/40 font-mono text-xs">
                        ${idx + 1}
                      </td>

                      <!-- Subject Code -->
                      <td class="px-3 py-3 font-semibold text-foreground border-r border-border/40 whitespace-nowrap">
                        <span class="font-mono text-xs px-2 py-0.5 rounded bg-muted/50 border border-border text-foreground tracking-tight">${item.code || ''}</span>
                      </td>

                      <!-- Subject Name (Khmer & English) -->
                      <td class="px-3.5 py-3 border-r border-border/40 ${fontClass}">
                        <div class="font-semibold text-foreground text-sm flex items-center gap-1.5">
                          ${getIcon('bookOpen', 'w-3.5 h-3.5 text-primary flex-shrink-0')}
                          <span class="truncate">${mainName}</span>
                        </div>
                        ${subName ? `<div class="text-[11px] text-muted-foreground/80 mt-0.5 pl-5 truncate">${subName}</div>` : ''}
                      </td>

                      <!-- Grade Scores G7 - G12 with Active Column Highlighting -->
                      ${GRADES.map(g => {
                        const scoreVal = scores[g] !== undefined ? scores[g] : (item.maxScore || 0);
                        const isZero = Number(scoreVal) === 0;
                        const isColActive = g === activeGrade;

                        let cellClasses = 'px-1 py-3 text-center border-r border-border/40 font-mono text-xs transition-colors ';
                        let textClasses = '';

                        if (isColActive) {
                          cellClasses += 'bg-primary/5';
                          textClasses = 'text-primary font-bold text-sm tracking-tight';
                        } else if (isZero) {
                          textClasses = 'text-muted-foreground/35';
                        } else {
                          textClasses = 'text-muted-foreground font-medium';
                        }

                        return `
                          <td class="${cellClasses}">
                            <span class="${textClasses}">
                              ${scoreVal}
                            </span>
                          </td>
                        `;
                      }).join('')}

                      <!-- Weekly Credit Hours -->
                      <td class="px-2 py-3 text-center border-r border-border/40 text-xs font-medium text-muted-foreground">
                        <span class="font-mono text-foreground">${item.creditHours || 2}</span>
                      </td>

                      <!-- Actions -->
                      <td class="px-2 py-3 text-center whitespace-nowrap">
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
    const searchInput = this.container.querySelector('#input-subject-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value;
        this.renderLayout();
        const freshInput = this.container.querySelector('#input-subject-search');
        if (freshInput) {
          freshInput.focus();
          freshInput.setSelectionRange(freshInput.value.length, freshInput.value.length);
        }
      });
    }

    // Grade Level select / focus buttons & header clicks (only active for non-teacher roles)
    if (!this.state.isTeacher) {
      this.container.querySelectorAll('.btn-select-grade').forEach(btn => {
        btn.addEventListener('click', () => {
          const g = btn.getAttribute('data-grade');
          if (g && GRADES.includes(g)) {
            this.state.activeGrade = g;
            this.renderLayout();
          }
        });
      });
    }

    // Preview Score selector buttons
    this.container.querySelectorAll('.btn-preview-score').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-score')) || 50;
        this.state.previewScore = val;
        this.renderLayout();
      });
    });

    // Add Subject button
    const addBtn = this.container.querySelector('#btn-add-subject');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.openSubjectModal();
      });
    }

    // Edit and Delete buttons on table rows
    this.container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const subject = this.state.subjects.find(s => s.id === id);

        if (action === 'edit' && subject) {
          this.openSubjectModal(subject);
        } else if (action === 'delete' && subject) {
          this.confirmDeleteSubject(subject);
        }
      });
    });
  },

  /**
   * Add / Edit Subject Modal
   */
  async openSubjectModal(existingSubject = null) {
    const isKm = i18n.getLocale() === 'km';
    const fontClass = isKm ? 'font-khmer' : '';
    const isEdit = Boolean(existingSubject);

    const defaultCode = isEdit ? existingSubject.code : await SubjectService.generateCode();
    const scores = existingSubject?.scoreByGrade || {
      G7: existingSubject?.maxScore || 0,
      G8: existingSubject?.maxScore || 0,
      G9: existingSubject?.maxScore || 0,
      G10: existingSubject?.maxScore || 0,
      G11: existingSubject?.maxScore || 0,
      G12: existingSubject?.maxScore || 0
    };

    const modalTitleText = isEdit 
      ? (isKm ? 'កែប្រែមុខវិជ្ជា' : 'Edit Course') 
      : (isKm ? 'បន្ថែមមុខវិជ្ជាថ្មី' : 'Add New Course');

    const modalContent = `
      <div class="space-y-4 p-5 select-none ${fontClass}">
        <!-- App Theme Title -->
        <div>
          <h3 class="text-sm sm:text-base font-bold text-primary ${fontClass}">
            ${modalTitleText}
          </h3>
        </div>

        <!-- Row 1: Course ID with Embedded Auto Button & Subject Name -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Course ID with embedded Auto-Generate Button -->
          <div>
            <label class="block text-[11px] font-bold text-muted-foreground mb-1 ${fontClass}">
              ${isKm ? 'លេខកូដមុខវិជ្ជា' : 'Course ID'} <span class="text-rose-500">*</span>
            </label>
            <div class="relative flex items-center">
              <input type="text"
                     id="modal-subject-code"
                     value="${defaultCode}"
                     placeholder="SUB-101"
                     class="w-full pl-3 pr-10 py-2 text-xs sm:text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase font-mono shadow-2xs" />
              <button type="button"
                      id="btn-auto-code"
                      title="${isKm ? 'បង្កើតកូដស្វ័យប្រវត្តិ' : 'Auto-generate ID'}"
                      class="absolute right-1.5 p-1.5 rounded-md hover:bg-muted active:scale-95 text-primary hover:text-primary/80 transition-all cursor-pointer group">
                <span class="group-hover:rotate-12 transition-transform duration-200">
                  ${getIcon('graduationCap', 'w-4 h-4') || getIcon('bookOpen', 'w-4 h-4')}
                </span>
              </button>
            </div>
            <p id="modal-code-err" class="text-[11px] text-rose-500 mt-1 hidden"></p>
          </div>

          <!-- Subject Name (ឈ្មោះមុខវិជ្ជា) -->
          <div>
            <label class="block text-[11px] font-bold text-muted-foreground mb-1 ${fontClass}">
              ${isKm ? 'ឈ្មោះមុខវិជ្ជា' : 'Subject Name'} <span class="text-rose-500">*</span>
            </label>
            <input type="text"
                   id="modal-subject-name"
                   value="${existingSubject?.name || ''}"
                   placeholder="${isKm ? 'ឧ. ភាសាខ្មែរ, គណិតវិទ្យា' : 'e.g. English, Mathematics'}"
                   class="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs ${fontClass}" />
            <p id="modal-name-err" class="text-[11px] text-rose-500 mt-1 hidden"></p>
          </div>
        </div>

        <!-- Row 2: SCORES BY GRADE -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-[11px] font-bold text-muted-foreground ${fontClass}">
              ${isKm ? 'ពិន្ទុតាមកម្រិតថ្នាក់' : 'Scores by Grade'}
            </label>
            <div class="flex items-center gap-1.5 text-[10px]">
              <span class="text-muted-foreground ${fontClass}">${isKm ? 'ដាក់ពិន្ទុរហ័ស៖' : 'Quick fill:'}</span>
              <button type="button" data-fill="50" class="btn-quick-fill px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted font-mono cursor-pointer">50</button>
              <button type="button" data-fill="100" class="btn-quick-fill px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted font-mono cursor-pointer">100</button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <!-- Col 1: G7 and G10 -->
            <div class="flex items-center gap-2">
              <span class="w-8 text-xs font-mono font-bold text-muted-foreground">G7</span>
              <input type="number"
                     id="modal-grade-G7"
                     min="0"
                     max="500"
                     value="${scores.G7 !== undefined ? scores.G7 : 0}"
                     class="flex-1 px-3 py-1.5 text-xs sm:text-sm font-mono rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs" />
            </div>
            <!-- Col 2: G8 and G11 -->
            <div class="flex items-center gap-2">
              <span class="w-8 text-xs font-mono font-bold text-muted-foreground">G8</span>
              <input type="number"
                     id="modal-grade-G8"
                     min="0"
                     max="500"
                     value="${scores.G8 !== undefined ? scores.G8 : 0}"
                     class="flex-1 px-3 py-1.5 text-xs sm:text-sm font-mono rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs" />
            </div>
            <!-- Col 3: G9 and G12 -->
            <div class="flex items-center gap-2">
              <span class="w-8 text-xs font-mono font-bold text-muted-foreground">G9</span>
              <input type="number"
                     id="modal-grade-G9"
                     min="0"
                     max="500"
                     value="${scores.G9 !== undefined ? scores.G9 : 0}"
                     class="flex-1 px-3 py-1.5 text-xs sm:text-sm font-mono rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs" />
            </div>

            <!-- Row 2 of scores: G10, G11, G12 -->
            <div class="flex items-center gap-2">
              <span class="w-8 text-xs font-mono font-bold text-muted-foreground">G10</span>
              <input type="number"
                     id="modal-grade-G10"
                     min="0"
                     max="500"
                     value="${scores.G10 !== undefined ? scores.G10 : 0}"
                     class="flex-1 px-3 py-1.5 text-xs sm:text-sm font-mono rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs" />
            </div>
            <div class="flex items-center gap-2">
              <span class="w-8 text-xs font-mono font-bold text-muted-foreground">G11</span>
              <input type="number"
                     id="modal-grade-G11"
                     min="0"
                     max="500"
                     value="${scores.G11 !== undefined ? scores.G11 : 0}"
                     class="flex-1 px-3 py-1.5 text-xs sm:text-sm font-mono rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs" />
            </div>
            <div class="flex items-center gap-2">
              <span class="w-8 text-xs font-mono font-bold text-muted-foreground">G12</span>
              <input type="number"
                     id="modal-grade-G12"
                     min="0"
                     max="500"
                     value="${scores.G12 !== undefined ? scores.G12 : 0}"
                     class="flex-1 px-3 py-1.5 text-xs sm:text-sm font-mono rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs" />
            </div>
          </div>
        </div>

        <!-- Row 3: Description (ការពិពណ៌នា) -->
        <div>
          <label class="block text-[11px] font-bold text-muted-foreground mb-1 ${fontClass}">
            ${isKm ? 'ការពិពណ៌នា' : 'Description'}
          </label>
          <textarea id="modal-subject-desc"
                    rows="2"
                    placeholder="${isKm ? 'ការពិពណ៌នាមុខវិជ្ជា...' : 'Course description...'}"
                    class="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y shadow-2xs ${fontClass}">${existingSubject?.description || existingSubject?.notes || ''}</textarea>
        </div>

        <!-- Row 4: SUM OF COURSES (optional) -->
        <div>
          <label class="block text-[11px] font-bold text-muted-foreground mb-1 ${fontClass}">
            ${isKm ? 'បូកសរុបពិន្ទុមុខវិជ្ជា (មិនទាមទារ)' : 'Sum of Courses (optional)'}
          </label>
          <input type="text"
                 id="modal-subject-sum"
                 value="${existingSubject?.sumOfCourses || ''}"
                 placeholder="${isKm ? 'ឧ. SUB-001, SUB-002' : 'e.g. CRS-010, CRS-011'}"
                 class="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase font-mono shadow-2xs" />
          <p class="text-[11px] text-muted-foreground mt-1 leading-relaxed ${fontClass}">
            ${isKm 
              ? 'បញ្ចូលកូដមុខវិជ្ជា (បំបែកដោយសញ្ញាក្បៀស ,)។ នៅពេលមានពិន្ទុមុខវិជ្ជាតូចៗ មុខវិជ្ជានេះនឹងបូកសរុបដោយស្វ័យប្រវត្តិ។ ទុកនៅទទេសម្រាប់ការបញ្ចូលពិន្ទុធម្មតា។' 
              : 'Enter course codes (comma-separated). When sub-course scores exist, this course auto-totals them. Leave blank for normal manual entry.'}
          </p>
        </div>

        <!-- Row 5: Modal Actions (Cancel & Create Course) -->
        <div class="flex items-center justify-between sm:justify-end gap-3 pt-3 border-t border-border">
          <button type="button"
                  id="modal-btn-cancel"
                  class="flex-1 sm:flex-none sm:min-w-[120px] px-5 py-2.5 rounded-lg text-xs sm:text-sm font-medium border border-border bg-card hover:bg-muted text-foreground transition-colors text-center cursor-pointer ${fontClass}">
            ${t('common.cancel') || 'បោះបង់'}
          </button>
          <button type="button"
                  id="modal-btn-save"
                  class="flex-1 sm:flex-none sm:min-w-[130px] px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-colors text-center cursor-pointer ${fontClass}">
            ${isEdit ? (isKm ? 'រក្សាទុកមុខវិជ្ជា' : 'Update Course') : (isKm ? 'បង្កើតមុខវិជ្ជា' : 'Create Course')}
          </button>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: '', // Custom styled top header inside content
      content: modalContent,
      maxWidth: 'max-w-lg',
      backdropClose: false
    });

    const modalEl = modal.element;
    if (!modalEl) return;

    // Auto Generate Subject ID Button
    modalEl.querySelector('#btn-auto-code')?.addEventListener('click', async () => {
      const codeInput = modalEl.querySelector('#modal-subject-code');
      if (codeInput) {
        codeInput.value = await SubjectService.generateCode();
        codeInput.classList.add('ring-2', 'ring-primary/40');
        setTimeout(() => codeInput.classList.remove('ring-2', 'ring-primary/40'), 600);
      }
    });

    // Quick fill buttons
    modalEl.querySelectorAll('.btn-quick-fill').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-fill');
        GRADES.forEach(g => {
          const inp = modalEl.querySelector(`#modal-grade-${g}`);
          if (inp) inp.value = val;
        });
      });
    });

    // Cancel button
    modalEl.querySelector('#modal-btn-cancel')?.addEventListener('click', () => {
      modal.close();
    });

    // Save button
    modalEl.querySelector('#modal-btn-save')?.addEventListener('click', async () => {
      const codeInput = modalEl.querySelector('#modal-subject-code');
      const nameInput = modalEl.querySelector('#modal-subject-name');
      const descInput = modalEl.querySelector('#modal-subject-desc');
      const sumInput = modalEl.querySelector('#modal-subject-sum');
      const codeErr = modalEl.querySelector('#modal-code-err');
      const nameErr = modalEl.querySelector('#modal-name-err');

      if (codeErr) codeErr.classList.add('hidden');
      if (nameErr) nameErr.classList.add('hidden');

      const code = codeInput?.value.trim().toUpperCase();
      const name = nameInput?.value.trim();

      if (!code) {
        if (codeErr) {
          codeErr.textContent = t('subjects.enterCode') || 'សូមបញ្ចូលកូដមុខវិជ្ជា';
          codeErr.classList.remove('hidden');
        }
        codeInput?.focus();
        return;
      }

      if (!name) {
        if (nameErr) {
          nameErr.textContent = t('subjects.nameRequired') || 'សូមបញ្ចូលឈ្មោះមុខវិជ្ជា';
          nameErr.classList.remove('hidden');
        }
        nameInput?.focus();
        return;
      }

      // Collect scores per grade
      const scoreByGrade = {};
      let maxScore = 0;
      GRADES.forEach(g => {
        const inp = modalEl.querySelector(`#modal-grade-${g}`);
        const val = Number(inp?.value || 0);
        scoreByGrade[g] = !isNaN(val) && val >= 0 ? val : 0;
        if (scoreByGrade[g] > maxScore) maxScore = scoreByGrade[g];
      });

      const subjectData = {
        code,
        name,
        nameEn: existingSubject?.nameEn || name,
        description: descInput?.value.trim() || '',
        notes: descInput?.value.trim() || '',
        sumOfCourses: sumInput?.value.trim() || '',
        maxScore: maxScore > 0 ? maxScore : 100,
        scoreByGrade,
        creditHours: existingSubject?.creditHours || 2
      };

      try {
        if (isEdit) {
          await SubjectService.update(existingSubject.id, subjectData);
          toast.success(t('subjects.updatedSuccess') || 'បានកែប្រែមុខវិជ្ជាដោយជោគជ័យ');
        } else {
          await SubjectService.create(subjectData);
          toast.success(t('subjects.savedSuccess') || 'បានរក្សាទុកមុខវិជ្ជាដោយជោគជ័យ');
        }
        modal.close();
        await this.loadData();
        this.renderLayout();
      } catch (err) {
        toast.error(err.message);
        if (err.message.includes('already exists') || err.message.includes('already used')) {
          if (codeErr) {
            codeErr.textContent = err.message;
            codeErr.classList.remove('hidden');
          }
          codeInput?.focus();
        }
      }
    });
  },

  /**
   * Delete confirmation
   */
  async confirmDeleteSubject(subject) {
    const isKm = i18n.getLocale() === 'km';
    const fontClass = isKm ? 'font-khmer' : '';

    const subjectDisplayName = isKm ? subject.name : (subject.nameEn || subject.name);
    const confirmMessage = (t('subjects.deleteConfirmMessage') || 'តើអ្នកពិតជាចង់លុបមុខវិជ្ជា "{name}" ({code}) នេះមែនទេ?')
      .replace('{name}', subjectDisplayName)
      .replace('{code}', subject.code);

    const content = `
      <div class="p-5 space-y-4 select-none ${fontClass}">
        <p class="text-sm text-foreground leading-relaxed">
          ${confirmMessage}
        </p>
        <div class="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1">
          <div class="font-bold text-foreground">${subject.name}${subject.nameEn ? ` (${subject.nameEn})` : ''}</div>
          <div class="font-mono text-muted-foreground">${subject.code} • ${subject.creditHours || 2} hrs/wk</div>
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

    const modal = Modal.open({
      title: t('subjects.deleteConfirmTitle') || (isKm ? 'បញ្ជាក់ការលុបមុខវិជ្ជា' : 'Confirm Subject Deletion'),
      content,
      maxWidth: 'max-w-md'
    });

    const modalEl = modal.element;
    if (!modalEl) return;

    modalEl.querySelector('#confirm-del-cancel')?.addEventListener('click', () => {
      modal.close();
    });

    modalEl.querySelector('#confirm-del-proceed')?.addEventListener('click', async () => {
      try {
        await SubjectService.delete(subject.id);
        toast.success(t('subjects.deletedSuccess') || 'បានលុបមុខវិជ្ជាដោយជោគជ័យ');
        modal.close();
        await this.loadData();
        this.renderLayout();
      } catch (err) {
        toast.error(err.message);
      }
    });
  }
};
