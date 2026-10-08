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
    selectedClassId: 'all',
    expandedSubjectId: null
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
    const fontClass = isKm ? 'font-khmer' : 'font-sans';
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
      <div class="space-y-6 animate-fade-in pb-12 ${fontClass}">
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
          
          <div class="flex items-center gap-2.5">
            ${!isTeacher ? `
              <!-- Restore Defaults Button -->
              <button id="btn-restore-default-subjects"
                      type="button"
                      title="${isKm ? 'កំណត់បញ្ជីមុខវិជ្ជាតាមលំនាំដើមជាតិ (១៩ មុខវិជ្ជា)' : 'Restore 19 standard default curriculum subjects'}"
                      class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs sm:text-sm font-medium shadow-2xs transition-all cursor-pointer ${fontClass}">
                ${getIcon('rotateCcw', 'w-3.5 h-3.5') || getIcon('refreshCw', 'w-3.5 h-3.5')}
                <span>${isKm ? 'កំណត់លំនាំដើម' : 'Restore Defaults'}</span>
              </button>
            ` : ''}

            <!-- Add Subject Button -->
            <button id="btn-add-subject"
                    type="button"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 active:bg-primary/95 text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer ${fontClass}">
              ${getIcon('plus', 'w-4 h-4')}
              <span>${t('subjects.addSubject') || 'មុខវិជ្ជាថ្មី'}</span>
            </button>
          </div>
        </div>

        <!-- Search Bar & Count -->
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
          <div class="text-xs text-muted-foreground self-end sm:self-center ${fontClass}">
            ${isKm ? `សរុប៖ <span class="font-semibold text-foreground">${filtered.length}</span> មុខវិជ្ជា` : `Total: <span class="font-semibold text-foreground">${filtered.length}</span> Subjects`}
          </div>
        </div>

        <!-- Subjects Table Card -->
        <div class="border border-border rounded-xl bg-card overflow-hidden shadow-2xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs sm:text-sm ${fontClass}">
              <thead class="bg-muted/50 text-muted-foreground select-none border-b border-border">
                <tr>
                  <th scope="col" class="w-16 min-w-[64px] px-2 py-3 text-center font-semibold text-foreground border-r border-border/60">
                    ${isKm ? 'ល.រ' : 'No.'}
                  </th>
                  <th scope="col" class="w-28 px-3.5 py-3 font-semibold text-foreground border-r border-border/60 whitespace-nowrap ${fontClass}">
                    ${t('subjects.code') || 'កូដមុខវិជ្ជា'}
                  </th>
                  <th scope="col" class="px-4 py-3 font-semibold text-foreground border-r border-border/60 min-w-[180px] ${fontClass}">
                    ${isKm ? 'ឈ្មោះមុខវិជ្ជា' : 'Subject Name'}
                  </th>
                  <th scope="col" class="w-32 min-w-[130px] px-3 py-3 text-center font-semibold text-foreground border-r border-border/60 whitespace-nowrap ${fontClass}">
                    ${isKm ? 'បូកសរុបពិន្ទុ' : 'Sum of Courses'}
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
                  <th scope="col" class="w-40 min-w-[160px] px-3 py-3 text-center font-semibold text-foreground whitespace-nowrap ${fontClass}">
                    ${t('common.actions') || 'សកម្មភាព'}
                  </th>
                </tr>
              </thead>

              <tbody class="divide-y divide-border/60 ${fontClass}">
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="12" class="text-center py-12 text-muted-foreground ${fontClass}">
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
                  const isExpanded = this.state.expandedSubjectId === item.id;
                  const activeFullScore = SubjectService.getSubjectFullScore(item, activeGrade);
                  const brackets = SubjectService.getGradingScaleSummary(activeFullScore);

                  return `
                    <tr class="subject-row hover:bg-muted/20 transition-colors group select-none ${isExpanded ? 'bg-muted/10' : ''}" 
                        data-subject-id="${item.id}"
                        data-index="${idx}"
                        draggable="true">
                      <!-- Row No with Move Drag Handle & Reorder Up/Down -->
                      <td class="px-1.5 py-2.5 text-center text-muted-foreground border-r border-border/40 font-mono text-xs select-none">
                        <div class="flex items-center justify-center gap-1">
                          <!-- Drag & Move Handle -->
                          <span class="subject-drag-handle p-1 text-muted-foreground/40 hover:text-primary active:text-primary cursor-grab active:cursor-grabbing touch-none rounded transition-colors inline-flex items-center justify-center select-none"
                                title="${isKm ? 'ចុចហើយអូសដើម្បីផ្លាស់ទីមុខវិជ្ជា (Drag to move)' : 'Drag to move subject'}">
                            ${getIcon('gripVertical', 'w-3.5 h-3.5') || getIcon('move', 'w-3.5 h-3.5')}
                          </span>
                          <span class="font-bold text-foreground/80 min-w-[14px]">${idx + 1}</span>
                          <div class="inline-flex flex-col -space-y-0.5">
                            <button type="button" 
                                    data-action="move-up" 
                                    data-id="${item.id}" 
                                    ${idx === 0 ? 'disabled' : ''} 
                                    class="p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors" 
                                    title="${isKm ? 'ឡើងលើ (Move Up)' : 'Move Up'}">
                              ${getIcon('chevronUp', 'w-3 h-3')}
                            </button>
                            <button type="button" 
                                    data-action="move-down" 
                                    data-id="${item.id}" 
                                    ${idx === filtered.length - 1 ? 'disabled' : ''} 
                                    class="p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors" 
                                    title="${isKm ? 'ទៅបន្ទាប់ / ចុះក្រោម (Move Next)' : 'Move Next'}">
                              ${getIcon('chevronDown', 'w-3 h-3')}
                            </button>
                          </div>
                        </div>
                      </td>

                      <!-- Subject Code -->
                      <td class="px-3 py-3 font-semibold text-foreground border-r border-border/40 whitespace-nowrap">
                        <span class="font-mono text-xs px-2 py-0.5 rounded bg-muted/50 border border-border text-foreground tracking-tight">${item.code || ''}</span>
                      </td>

                      <!-- Subject Name (Khmer & English) -->
                      <td class="px-3.5 py-3 border-r border-border/40 ${fontClass}">
                        <div class="font-semibold text-foreground text-sm flex items-center gap-1.5 cursor-pointer" data-action="toggle-scale" data-id="${item.id}" title="${isKm ? 'ចុចដើម្បីមើលរូបមន្តគណនានិទ្ទេស' : 'Click to view grading scale'}">
                          ${getIcon('bookOpen', 'w-3.5 h-3.5 text-primary flex-shrink-0')}
                          <span class="hover:underline hover:text-primary transition-colors">${mainName}</span>
                        </div>
                        ${subName ? `<div class="text-[11px] text-muted-foreground/80 mt-0.5 pl-5">${subName}</div>` : ''}
                      </td>

                      <!-- Sum of Courses (Dedicated Column) -->
                      <td class="px-2.5 py-3 text-center border-r border-border/40 whitespace-nowrap">
                        ${item.sumOfCourses ? `
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-xs bg-primary/10 text-primary border border-primary/25 shadow-2xs" title="${isKm ? 'បូកសរុបពិន្ទុពី៖ ' + item.sumOfCourses : 'Sum of: ' + item.sumOfCourses}">
                            ∑ ${item.sumOfCourses}
                          </span>
                        ` : `
                          <span class="text-muted-foreground/30 text-xs font-mono">—</span>
                        `}
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
                        <div class="flex items-center justify-center gap-1">
                          <!-- Move to First Button -->
                          <button type="button"
                                  data-action="move-first"
                                  data-id="${item.id}"
                                  ${idx === 0 ? 'disabled' : ''}
                                  title="${isKm ? 'ផ្លាស់ទីទៅដើមគេបង្អស់ (Move to First)' : 'Move to First'}"
                                  class="p-1.5 rounded-md text-primary hover:bg-primary/15 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer">
                            ${getIcon('chevronsUp', 'w-3.5 h-3.5') || getIcon('arrowUpToLine', 'w-3.5 h-3.5')}
                          </button>

                          <!-- Move Up Button -->
                          <button type="button"
                                  data-action="move-up"
                                  data-id="${item.id}"
                                  ${idx === 0 ? 'disabled' : ''}
                                  title="${isKm ? 'ឡើងលើ (Move Up)' : 'Move Up'}"
                                  class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer">
                            ${getIcon('chevronUp', 'w-3.5 h-3.5')}
                          </button>

                          <!-- Move Next / Down Button -->
                          <button type="button"
                                  data-action="move-down"
                                  data-id="${item.id}"
                                  ${idx === filtered.length - 1 ? 'disabled' : ''}
                                  title="${isKm ? 'ទៅបន្ទាប់ / ចុះក្រោម (Move Next)' : 'Move Next'}"
                                  class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer">
                            ${getIcon('chevronDown', 'w-3.5 h-3.5')}
                          </button>

                          <div class="w-px h-4 bg-border/60 mx-0.5"></div>

                          <!-- Toggle Grading Scale Formula Button -->
                          <button type="button"
                                  data-action="toggle-scale"
                                  data-id="${item.id}"
                                  title="${isKm ? 'រូបមន្តគណនានិទ្ទេស' : 'Grading Formula Scale'}"
                                  class="p-1.5 rounded-md ${isExpanded ? 'text-primary bg-primary/15 shadow-2xs' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'} transition-all cursor-pointer">
                            ${getIcon('award', 'w-3.5 h-3.5') || getIcon('clipboardList', 'w-3.5 h-3.5')}
                          </button>

                          <!-- Edit Button -->
                          <button type="button"
                                  data-action="edit"
                                  data-id="${item.id}"
                                  title="${t('common.edit') || 'Edit'}"
                                  class="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer">
                            ${getIcon('pencil', 'w-3.5 h-3.5')}
                          </button>

                          <!-- Delete Button -->
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

                    <!-- Per-Subject Expandable Grading Formula Scale Row -->
                    ${isExpanded ? `
                      <tr class="bg-muted/10 border-b border-border/70 animate-fade-in">
                        <td colspan="12" class="py-2.5 px-3 sm:px-6">
                          <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 p-2.5 sm:px-4 sm:py-2 rounded-lg bg-card/90 border border-border shadow-2xs">
                            
                            <!-- Left: Grade Level & Full Score -->
                            <div class="flex items-center gap-2">
                              <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                              <span class="text-xs font-bold text-foreground ${fontClass}">
                                ${isKm 
                                  ? `ថ្នាក់ទី ${activeGrade.replace('G', '')} ( ពិន្ទុពេញ៖ <span class="font-mono text-primary font-bold">${activeFullScore}</span> )៖` 
                                  : `Grade ${activeGrade.replace('G', '')} ( Full: <span class="font-mono text-primary font-bold">${activeFullScore}</span> ):`}
                              </span>
                              <span class="text-[11px] text-muted-foreground hidden lg:inline truncate max-w-[240px] ${fontClass}">
                                — ${mainName}
                              </span>
                            </div>

                            <!-- Right: Clean Formula Scale (A≥... | B≥... | C≥... | D≥... | E≥... | F<...) -->
                            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-mono select-none">
                              <!-- Grade A -->
                              <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
                                A<span>&ge;</span><span>${brackets[0].minScore}</span>
                              </span>
                              <span class="text-border/80 text-xs">|</span>

                              <!-- Grade B -->
                              <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25">
                                B<span>&ge;</span><span>${brackets[1].minScore}</span>
                              </span>
                              <span class="text-border/80 text-xs">|</span>

                              <!-- Grade C -->
                              <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25">
                                C<span>&ge;</span><span>${brackets[2].minScore}</span>
                              </span>
                              <span class="text-border/80 text-xs">|</span>

                              <!-- Grade D -->
                              <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25">
                                D<span>&ge;</span><span>${brackets[3].minScore}</span>
                              </span>
                              <span class="text-border/80 text-xs">|</span>

                              <!-- Grade E -->
                              <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold border bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25">
                                E<span>&ge;</span><span>${brackets[4].minScore}</span>
                              </span>
                              <span class="text-border/80 text-xs">|</span>

                              <!-- Grade F -->
                              <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25">
                                F<span>&lt;</span><span>${brackets[4].minScore}</span>
                              </span>
                            </div>

                          </div>
                        </td>
                      </tr>
                    ` : ''}
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

    // Restore Defaults button
    const restoreBtn = this.container.querySelector('#btn-restore-default-subjects');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => {
        this.confirmRestoreDefaults();
      });
    }

    // Add Subject button
    const addBtn = this.container.querySelector('#btn-add-subject');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.openSubjectModal();
      });
    }

    // Actions on table rows (toggle-scale, edit, delete, move)
    this.container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const subject = this.state.subjects.find(s => s.id === id);

        const isKm = i18n.getLocale() === 'km';
        if (action === 'move-first' && id) {
          try {
            await SubjectService.moveSubjectToFirst(id);
            toast.success(isKm ? 'បានផ្លាស់ទីមុខវិជ្ជាទៅមុខគេបង្អស់' : 'Moved subject to first position');
            await this.loadData();
            this.renderLayout();
          } catch (err) {
            toast.error(err.message || 'Error moving subject');
          }
        } else if (action === 'move-up' && id) {
          try {
            await SubjectService.moveSubject(id, 'up');
            await this.loadData();
            this.renderLayout();
          } catch (err) {
            toast.error(err.message || 'Error moving subject');
          }
        } else if (action === 'move-down' && id) {
          try {
            await SubjectService.moveSubject(id, 'down');
            await this.loadData();
            this.renderLayout();
          } catch (err) {
            toast.error(err.message || 'Error moving subject');
          }
        } else if (action === 'toggle-scale' && id) {
          this.state.expandedSubjectId = this.state.expandedSubjectId === id ? null : id;
          this.renderLayout();
        } else if (action === 'edit' && subject) {
          this.openSubjectModal(subject);
        } else if (action === 'delete' && subject) {
          this.confirmDeleteSubject(subject);
        }
      });
    });

    this.bindDragAndDropEvents();
  },

  /**
   * Bind Desktop HTML5 Drag & Drop and Mobile Touch-to-move events
   */
  bindDragAndDropEvents() {
    if (!this.container) return;
    const tableBody = this.container.querySelector('tbody');
    if (!tableBody) return;

    let draggedId = null;
    let draggedRow = null;

    const rows = tableBody.querySelectorAll('tr[data-subject-id]');

    // 1. Desktop HTML5 Drag & Drop
    rows.forEach(row => {
      row.addEventListener('dragstart', (e) => {
        draggedRow = row;
        draggedId = row.getAttribute('data-subject-id');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedId);
        row.classList.add('opacity-40', 'bg-primary/10');
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (row !== draggedRow) {
          row.classList.add('border-t-2', 'border-primary');
        }
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('border-t-2', 'border-primary');
      });

      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        row.classList.remove('border-t-2', 'border-primary');
        const targetId = row.getAttribute('data-subject-id');
        if (draggedId && targetId && draggedId !== targetId) {
          await this.handleReorder(draggedId, targetId);
        }
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('opacity-40', 'bg-primary/10');
        rows.forEach(r => r.classList.remove('border-t-2', 'border-primary'));
        draggedRow = null;
        draggedId = null;
      });
    });

    // 2. Mobile Touch Move Support on .subject-drag-handle
    const handles = tableBody.querySelectorAll('.subject-drag-handle');
    let touchRow = null;
    let touchId = null;
    let currentOverRow = null;

    handles.forEach(handle => {
      handle.addEventListener('touchstart', (e) => {
        const row = handle.closest('tr[data-subject-id]');
        if (!row) return;
        touchRow = row;
        touchId = row.getAttribute('data-subject-id');
        touchRow.classList.add('bg-primary/15');
      }, { passive: true });

      handle.addEventListener('touchmove', (e) => {
        if (!touchRow || !e.touches || e.touches.length === 0) return;
        const touch = e.touches[0];
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const overRow = elUnder?.closest('tr[data-subject-id]');

        if (currentOverRow && currentOverRow !== overRow) {
          currentOverRow.classList.remove('border-t-2', 'border-primary');
        }

        if (overRow && overRow !== touchRow) {
          currentOverRow = overRow;
          currentOverRow.classList.add('border-t-2', 'border-primary');
        }
      }, { passive: false });

      handle.addEventListener('touchend', async () => {
        if (touchRow) {
          touchRow.classList.remove('bg-primary/15');
        }
        if (currentOverRow) {
          currentOverRow.classList.remove('border-t-2', 'border-primary');
          const targetId = currentOverRow.getAttribute('data-subject-id');
          if (touchId && targetId && touchId !== targetId) {
            await this.handleReorder(touchId, targetId);
          }
        }
        touchRow = null;
        touchId = null;
        currentOverRow = null;
      });

      handle.addEventListener('touchcancel', () => {
        if (touchRow) touchRow.classList.remove('bg-primary/15');
        if (currentOverRow) currentOverRow.classList.remove('border-t-2', 'border-primary');
        touchRow = null;
        touchId = null;
        currentOverRow = null;
      });
    });
  },

  /**
   * Reorder subject from sourceId to targetId position
   */
  async handleReorder(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const isKm = i18n.getLocale() === 'km';
    const list = [...this.state.subjects];
    const sourceIdx = list.findIndex(s => s.id === sourceId);
    const targetIdx = list.findIndex(s => s.id === targetId);

    if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return;

    const [moved] = list.splice(sourceIdx, 1);
    list.splice(targetIdx, 0, moved);

    const orderedIds = list.map(s => s.id);
    try {
      await SubjectService.reorderSubjects(orderedIds);
      toast.success(isKm ? 'បានផ្លាស់ទីមុខវិជ្ជាដោយជោគជ័យ' : 'Subject moved successfully');
      await this.loadData();
      this.renderLayout();
    } catch (err) {
      toast.error(err.message || 'Error moving subject');
    }
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
  },

  /**
   * Restore defaults confirmation
   */
  async confirmRestoreDefaults() {
    const isKm = i18n.getLocale() === 'km';
    const fontClass = isKm ? 'font-khmer' : '';

    const content = `
      <div class="p-5 space-y-4 select-none ${fontClass}">
        <p class="text-sm text-foreground leading-relaxed">
          ${isKm 
            ? 'តើអ្នកពិតជាចង់កំណត់បញ្ជីមុខវិជ្ជាឡើងវិញតាមលំនាំដើមស្តង់ដារជាតិ (១៩ មុខវិជ្ជា) មែនទេ? រាល់មុខវិជ្ជាដែលបានកែសម្រួលនឹងត្រូវបានកំណត់ឡើងវិញតាមលំនាំដើម។' 
            : 'Are you sure you want to restore the 19 standard curriculum default subjects? Custom subjects will be replaced with standard defaults.'}
        </p>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button"
                  id="confirm-restore-cancel"
                  class="px-4 py-2 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer">
            ${t('common.cancel') || 'បោះបង់'}
          </button>
          <button type="button"
                  id="confirm-restore-proceed"
                  class="px-4 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors cursor-pointer">
            ${isKm ? 'យល់ព្រមកំណត់ឡើងវិញ' : 'Confirm Restore'}
          </button>
        </div>
      </div>
    `;

    const modal = Modal.open({
      title: isKm ? 'កំណត់មុខវិជ្ជាលំនាំដើមឡើងវិញ' : 'Restore Default Subjects',
      content,
      maxWidth: 'max-w-md'
    });

    const modalEl = modal.element;
    if (!modalEl) return;

    modalEl.querySelector('#confirm-restore-cancel')?.addEventListener('click', () => {
      modal.close();
    });

    modalEl.querySelector('#confirm-restore-proceed')?.addEventListener('click', async () => {
      try {
        await SubjectService.restoreDefaults();
        toast.success(isKm ? 'បានកំណត់មុខវិជ្ជាលំនាំដើមទាំង ១៩ ដោយជោគជ័យ' : 'Successfully restored 19 default subjects');
        modal.close();
        await this.loadData();
        this.renderLayout();
      } catch (err) {
        toast.error(err.message);
      }
    });
  }
};
