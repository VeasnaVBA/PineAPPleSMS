/**
 * Subjects Management Page
 * Standard curriculum subjects management with max scores and credit hours.
 */

import { SubjectService } from '../services/subjectService.js';
import { authService } from '../services/authService.js';
import { i18n, t } from '../i18n/i18n.js';
import { toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { getIcon } from '../components/icons.js';

export const SubjectsPage = {
  container: null,
  state: {
    subjects: [],
    searchQuery: ''
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
      const list = await SubjectService.getAll();
      this.state.subjects = Array.isArray(list) ? list : [];
    } catch (err) {
      console.error('Error loading subjects:', err);
      this.state.subjects = [];
    }
  },

  renderLayout() {
    if (!this.container) return;
    const isKm = i18n.getLocale() === 'km';
    const fontClass = isKm ? 'font-khmer' : '';
    const q = (this.state.searchQuery || '').trim().toLowerCase();

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

    this.container.innerHTML = `
      <div class="space-y-6 animate-fade-in pb-12">
        <!-- Top Title Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground ${fontClass}">
              ${t('subjects.title') || 'គ្រប់គ្រងមុខវិជ្ជា'}
            </h1>
            <p class="text-xs sm:text-sm text-muted-foreground mt-1 ${fontClass}">
              ${t('subjects.subtitle') || 'បញ្ជីមុខវិជ្ជាកម្មវិធីសិក្សាជាតិ ពិន្ទុពេញ និងចំនួនម៉ោងបង្រៀនប្រចាំសប្តាហ៍'}
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

        <!-- Subjects Table -->
        <div class="border border-border/80 rounded-xl bg-card overflow-hidden shadow-2xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs sm:text-sm ${fontClass}">
              <thead class="bg-muted/40 text-muted-foreground text-[11px] sm:text-xs font-semibold uppercase tracking-wider select-none border-b border-border ${fontClass}">
                <tr>
                  <th scope="col" class="w-12 px-3 py-3 text-center border-r border-border/50">
                    ${t('common.no') || 'ល.រ'}
                  </th>
                  <th scope="col" class="px-4 py-3 min-w-[130px] font-semibold text-foreground border-r border-border/50 ${fontClass}">
                    ${t('subjects.code') || 'កូដមុខវិជ្ជា'}
                  </th>
                  <th scope="col" class="px-4 py-3 min-w-[240px] font-semibold text-foreground border-r border-border/50 ${fontClass}">
                    ${t('subjects.name') || 'ឈ្មោះមុខវិជ្ជា'}
                  </th>
                  <th scope="col" class="px-4 py-3 text-center min-w-[110px] font-semibold text-foreground border-r border-border/50 ${fontClass}">
                    ${t('subjects.maxScore') || 'ពិន្ទុពេញ'}
                  </th>
                  <th scope="col" class="px-4 py-3 text-center min-w-[140px] font-semibold text-foreground border-r border-border/50 ${fontClass}">
                    ${t('subjects.creditHours') || 'ម៉ោងបង្រៀន/សប្តាហ៍'}
                  </th>
                  <th scope="col" class="px-4 py-3 text-center min-w-[100px] font-semibold text-foreground ${fontClass}">
                    ${t('common.actions') || 'សកម្មភាព'}
                  </th>
                </tr>
              </thead>

              <tbody class="divide-y divide-border/60 ${fontClass}">
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="6" class="text-center py-12 text-muted-foreground ${fontClass}">
                      <div class="flex flex-col items-center justify-center gap-2">
                        ${getIcon('inbox', 'w-8 h-8 text-muted-foreground/50')}
                        <span>${t('subjects.noData') || 'មិនទាន់មានមុខវិជ្ជាណាមួយនៅឡើយទេ'}</span>
                      </div>
                    </td>
                  </tr>
                ` : filtered.map((item, idx) => {
                  const mainName = isKm ? item.name : (item.nameEn || item.name);
                  const subName = isKm ? item.nameEn : (item.nameEn ? item.name : '');

                  return `
                    <tr class="hover:bg-muted/20 transition-colors group">
                      <!-- Row No -->
                      <td class="px-3 py-3.5 text-center text-muted-foreground border-r border-border/40 font-mono text-xs">
                        ${idx + 1}
                      </td>

                      <!-- Subject Code -->
                      <td class="px-4 py-3.5 font-semibold text-foreground border-r border-border/40 whitespace-nowrap">
                        <span class="font-mono text-xs px-2 py-0.5 rounded bg-muted/50 border border-border text-foreground tracking-tight">${item.code || ''}</span>
                      </td>

                      <!-- Subject Name (Khmer & English) -->
                      <td class="px-4 py-3.5 border-r border-border/40 ${fontClass}">
                        <div class="font-semibold text-foreground text-sm flex items-center gap-1.5">
                          ${getIcon('bookOpen', 'w-3.5 h-3.5 text-primary flex-shrink-0')}
                          <span>${mainName}</span>
                        </div>
                        ${subName ? `<div class="text-[11px] text-muted-foreground/80 mt-0.5 pl-5">${subName}</div>` : ''}
                      </td>

                      <!-- Max Score -->
                      <td class="px-4 py-3.5 text-center border-r border-border/40 text-xs font-bold text-foreground">
                        <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                          ${item.maxScore || 100}
                        </span>
                      </td>

                      <!-- Weekly Credit Hours -->
                      <td class="px-4 py-3.5 text-center border-r border-border/40 text-xs font-medium text-muted-foreground">
                        <span class="font-mono">${item.creditHours || 2}</span> ${isKm ? 'ម៉ោង' : 'hrs/wk'}
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

    const modalContent = `
      <div class="space-y-4 p-5 select-none ${fontClass}">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Subject Code -->
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-foreground mb-1">
              ${t('subjects.code') || 'កូដមុខវិជ្ជា'} <span class="text-rose-500">*</span>
            </label>
            <input type="text"
                   id="modal-subject-code"
                   value="${defaultCode}"
                   class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase font-mono" />
            <p id="modal-code-err" class="text-[11px] text-rose-500 mt-1 hidden"></p>
          </div>

          <!-- Subject Name (Khmer) -->
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-foreground mb-1">
              ${t('subjects.nameKhmer') || 'ឈ្មោះមុខវិជ្ជា (ខ្មែរ)'} <span class="text-rose-500">*</span>
            </label>
            <input type="text"
                   id="modal-subject-name"
                   value="${existingSubject?.name || ''}"
                   placeholder="${isKm ? 'ឧ. គណិតវិទ្យា' : 'e.g. គណិតវិទ្យា'}"
                   class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <p id="modal-name-err" class="text-[11px] text-rose-500 mt-1 hidden"></p>
          </div>

          <!-- English Name -->
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-foreground mb-1">
              ${t('subjects.nameEn') || 'ឈ្មោះជាភាសាអង់គ្លេស (English Name)'}
            </label>
            <input type="text"
                   id="modal-subject-name-en"
                   value="${existingSubject?.nameEn || ''}"
                   placeholder="${isKm ? 'ឧ. Mathematics' : 'e.g. Mathematics'}"
                   class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>

          <!-- Max Score -->
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">
              ${t('subjects.maxScore') || 'ពិន្ទុពេញ (Max Score)'} <span class="text-rose-500">*</span>
            </label>
            <input type="number"
                   id="modal-subject-score"
                   min="1"
                   max="500"
                   value="${existingSubject?.maxScore || 100}"
                   class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono" />
          </div>

          <!-- Credit Hours -->
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">
              ${t('subjects.creditHours') || 'ម៉ោងបង្រៀន/សប្តាហ៍ (Weekly Hours)'}
            </label>
            <input type="number"
                   id="modal-subject-hours"
                   min="1"
                   max="40"
                   value="${existingSubject?.creditHours || 2}"
                   class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono" />
          </div>
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
      title: isEdit ? (t('subjects.editSubject') || 'កែប្រែមុខវិជ្ជា') : (t('subjects.addSubject') || 'បន្ថែមមុខវិជ្ជាថ្មី'),
      content: modalContent,
      width: 'max-w-lg',
      onClose: () => {}
    });

    const modalEl = document.getElementById(modal.id);
    if (!modalEl) return;

    // Cancel button
    modalEl.querySelector('#modal-btn-cancel')?.addEventListener('click', () => {
      modal.close();
    });

    // Save button
    modalEl.querySelector('#modal-btn-save')?.addEventListener('click', async () => {
      const codeInput = modalEl.querySelector('#modal-subject-code');
      const nameInput = modalEl.querySelector('#modal-subject-name');
      const nameEnInput = modalEl.querySelector('#modal-subject-name-en');
      const scoreInput = modalEl.querySelector('#modal-subject-score');
      const hoursInput = modalEl.querySelector('#modal-subject-hours');
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

      const subjectData = {
        code,
        name,
        nameEn: nameEnInput?.value.trim() || '',
        maxScore: Number(scoreInput?.value) > 0 ? Number(scoreInput.value) : 100,
        creditHours: Number(hoursInput?.value) > 0 ? Number(hoursInput.value) : 2
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
          <div class="font-mono text-muted-foreground">${subject.code} • ${subject.maxScore || 100} pts • ${subject.creditHours || 2} hrs/wk</div>
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
      title: t('subjects.deleteConfirmTitle') || (isKm ? 'បញ្ជាក់ការលុបមុខវិជ្ជា' : 'Confirm Subject Deletion'),
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
