/**
 * Unified 29-Field Student & Applicant Form Modal Component
 * Inspired by shadcn/ui.
 * 
 * Used across:
 * 1. Mode: 'STUDENT_MANAGEMENT' -> Direct Add/Edit in official `students` store.
 * 2. Mode: 'ADMISSION_VERIFICATION' -> Staging Add/Edit/Verify in `registration_queue` with Document Checklist.
 */
import { StudentService } from '../services/studentService.js';
import { RegistrationService } from '../services/registrationService.js';
import { ClassService } from '../services/classService.js';
import { SchoolService } from '../services/schoolService.js';
import { SettingsService } from '../services/settingsService.js';
import { LocationService } from '../services/locationService.js';
import { photoService } from '../services/photoService.js';
import { authService } from '../services/authService.js';
import { Modal } from './modal.js';
import { toast } from './toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from './icons.js';
import { calculateAge, toInputDateFormat, formatDisplayDate } from '../utils/dateUtils.js';

export { calculateAge };

function openDeleteLocationConfirm({ title, message, isKm, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in';
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

export const StudentFormModal = {
  /**
   * Open the unified 29-field modal form
   * @param {Object} options
   * @param {string} [options.mode='STUDENT_MANAGEMENT'] - 'STUDENT_MANAGEMENT' | 'ADMISSION_VERIFICATION'
   * @param {Object} [options.student=null] - Existing student/applicant record
   * @param {Function} options.onSave - Callback when saved
   * @param {Function} [options.onEnroll=null] - Callback when "Push to School" is clicked in admissions mode
   */
  async open({
    mode = 'STUDENT_MANAGEMENT',
    student = null,
    onSave,
    onEnroll = null
  }) {
    const isEdit = !!student;
    const isKm = i18n.getLocale() === 'km';
    const isAdmissionMode = mode === 'ADMISSION_VERIFICATION';

    let title = isEdit ? t('students.editStudent') : t('students.addStudent');
    if (isAdmissionMode) {
      title = isEdit ? (isKm ? 'ផ្ទៀងផ្ទាត់ និងកែប្រែពាក្យសុំ' : 'Verify & Edit Application') : t('registration.addApplicantBtn');
    }

    // Photo state
    let tempBlob = student?.photoBlob || null;
    let previewUrl = tempBlob ? photoService.getUrlForBlob(tempBlob) : (student?.photo && student.photo.startsWith('data:') ? student.photo : null);

    const classes = await ClassService.getAll();
    const activeYear = await SettingsService.getActiveAcademicYear();

    const schoolsList = await SchoolService.getAll();
    let academicYearsList = await SettingsService.getAcademicYears();
    if (!academicYearsList || academicYearsList.length === 0) {
      academicYearsList = [{ id: 'ay-2024-2025', name: activeYear || '2024–2025', isActive: true }];
    }

    const isTeacher = authService.isTeacher();
    let teacherSchoolName = '';
    let assignedCls = null;
    let teacherClassId = null;

    if (isTeacher) {
      teacherClassId = authService.getAssignedClassId();
      assignedCls = classes.find(c => c.id === teacherClassId);
      if (teacherClassId && !assignedCls) {
        try { assignedCls = await ClassService.getById(teacherClassId); } catch (_) {}
      }
      const currentUser = authService.getCurrentUser();
      teacherSchoolName = await SchoolService.getSchoolForTeacher(currentUser, assignedCls);
    }

    const rawDob = student?.dateOfBirth || student?.dob || (isEdit ? '' : '2016-05-15');
    const initialDob = toInputDateFormat(rawDob);
    const initialAge = student?.age || calculateAge(rawDob);

    // Harvest & load customizable locations
    try {
      const allStudentsForHarvest = await StudentService.getAll();
      await LocationService.harvestFromStudents(allStudentsForHarvest);
    } catch (_) {}
    const locationsData = await LocationService.getAll();

    // Render Academic Year Dropdown (Strictly from Settings only)
    const renderAcademicYearDropdown = (currentValue) => {
      const currentVal = (currentValue || activeYear || '2024–2025').trim();
      const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
      const isConfigured = academicYearsList.some(y => normDash(y.name) === normDash(currentVal));

      return `
        <div>
          <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
            ${t('students.academicYear')} <span class="text-destructive">*</span>
          </label>
          <select id="form-academicYear" class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium box-border shadow-xs ${isKm ? 'font-khmer' : ''}">
            ${!isConfigured && currentVal ? `
              <option value="${currentVal}" selected>${currentVal} (${isKm ? 'គ្មានក្នុង Settings' : 'Unconfigured'})</option>
            ` : ''}
            ${academicYearsList.map(y => {
              const isSelected = normDash(y.name) === normDash(currentVal);
              return `<option value="${y.name}" ${isSelected ? 'selected' : ''}>${y.name}${y.isActive ? ` (${isKm ? 'សកម្ម' : 'Active'})` : ''}</option>`;
            }).join('')}
          </select>
        </div>
      `;
    };

    // Render Location Dropdown
    const renderLocationField = (fieldId, category, label, currentValue) => {
      const items = locationsData[category] || [];
      const trimmedVal = (currentValue || '').trim();
      const allItems = (trimmedVal && !items.some(i => i.toLowerCase() === trimmedVal.toLowerCase()))
        ? [trimmedVal, ...items]
        : items;

      let placeholder = isKm ? 'បញ្ចូលឈ្មោះថ្មី...' : 'Add new...';
      if (category === 'villages') placeholder = isKm ? 'បញ្ចូលឈ្មោះភូមិថ្មី...' : 'Add village...';
      else if (category === 'communes') placeholder = isKm ? 'បញ្ចូលឈ្មោះឃុំ/សង្កាត់ថ្មី...' : 'Add commune...';
      else if (category === 'districts') placeholder = isKm ? 'បញ្ចូលឈ្មោះស្រុក/ខណ្ឌថ្មី...' : 'Add district...';
      else if (category === 'provinces') placeholder = isKm ? 'បញ្ចូលឈ្មោះខេត្ត/រាជធានីថ្មី...' : 'Add province...';
      else if (category === 'lastYearSchools') placeholder = isKm ? 'បញ្ចូលឈ្មោះសាលាចាស់ថ្មី...' : 'Add last year school...';

      return `
        <div class="custom-location-dropdown relative" data-field-id="${fieldId}" data-category="${category}">
          <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
            ${label}
          </label>
          <input type="hidden" id="${fieldId}" value="${trimmedVal}" />

          <div class="dropdown-trigger flex items-center justify-between w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground cursor-pointer shadow-xs hover:border-ring transition-colors box-border select-none">
            <span class="selected-text truncate ${!trimmedVal ? 'text-muted-foreground' : 'font-medium text-foreground ${isKm ? \"font-khmer\" : \"\"}'}">
              ${trimmedVal || t('locations.selectPrompt')}
            </span>
            <div class="flex items-center gap-1 ml-2 text-muted-foreground flex-shrink-0">
              ${getIcon('chevronDown', 'w-4 h-4 transition-transform duration-200 trigger-chevron')}
            </div>
          </div>

          <div class="dropdown-menu hidden absolute left-0 right-0 top-[calc(100%+4px)] z-[80] bg-popover border border-border rounded-lg shadow-xl flex flex-col overflow-hidden animate-slide-down">
            <div class="p-1.5 border-b border-border bg-muted/40 flex items-center gap-1.5">
              <input type="text" style="height: 32px; box-sizing: border-box;" class="input-new-item flex-1 min-w-0 h-8 px-2.5 py-0 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${isKm ? 'font-khmer' : ''}" placeholder="${placeholder}" />
              <button type="button" style="height: 32px; box-sizing: border-box;" class="btn-add-item h-8 px-3 py-0 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shadow-xs flex-shrink-0 cursor-pointer ${isKm ? 'font-khmer' : ''}">
                ${getIcon('plus', 'w-3.5 h-3.5')}
                <span>${t('locations.add')}</span>
              </button>
            </div>

            <div class="items-list overflow-y-auto p-1 max-h-52 divide-y divide-border/20">
              <div class="item-row flex items-center px-2.5 py-1.5 rounded-md hover:bg-accent text-xs text-muted-foreground italic cursor-pointer transition-colors" data-value="">
                <span>${t('locations.selectPrompt')}</span>
              </div>
              ${allItems.map(opt => `
                <div class="item-row flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-accent text-sm text-foreground group cursor-pointer transition-colors ${trimmedVal.toLowerCase() === opt.toLowerCase() ? 'bg-accent/60 font-semibold text-primary' : ''}" data-value="${opt}">
                  <span class="item-label flex-1 truncate pr-2 ${isKm ? 'font-khmer' : ''}">${opt}</span>
                  <button type="button" class="btn-delete-item p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0" title="${t('locations.delete')}" data-value="${opt}">
                    ${getIcon('trash', 'w-3.5 h-3.5')}
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    };

    const subtitleText = isEdit 
      ? (isKm ? (student.khmerName || student.name || student.studentId || student.tempStudentId) : (student.englishName || student.khmerName || student.studentId || student.tempStudentId))
      : (isAdmissionMode ? (isKm ? 'បំពេញព័ត៌មានពាក្យសុំចុះឈ្មោះចូលរៀនថ្មី' : 'Fill in new student application details') : t('students.formSubtitleNew'));

    const headerContent = `
      <div class="flex items-center gap-3">
        <div id="modal-header-photo" class="w-9 h-9 rounded-full border border-border overflow-hidden bg-muted/80 flex items-center justify-center text-muted-foreground flex-shrink-0 shadow-xs">
          ${previewUrl 
            ? `<img src="${previewUrl}" class="w-full h-full object-cover" />` 
            : getIcon(isAdmissionMode ? 'fileCheck' : 'user', 'w-4 h-4')}
        </div>
        <div>
          <h3 class="text-base sm:text-lg font-bold tracking-tight text-foreground leading-tight ${isKm ? 'font-khmer' : ''}">${title}</h3>
          <p class="text-[11px] text-muted-foreground ${isKm ? 'font-khmer' : ''}">${subtitleText}</p>
        </div>
      </div>
    `;

    // Document Checklist section for Admissions Mode
    const docs = student?.documentsChecked || {};
    const checklistSection = isAdmissionMode ? `
      <!-- Admissions Verification Checklist Section -->
      <div class="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 sm:p-5 shadow-xs space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-purple-500/20">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold font-mono">✓</span>
            <h4 class="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-300 ${isKm ? 'font-khmer' : ''}">
              ${t('registration.checklistSectionTitle')}
            </h4>
          </div>
          <span class="text-[11px] text-purple-600/80 dark:text-purple-400/80 font-medium ${isKm ? 'font-khmer' : ''}">
            ផ្ទៀងផ្ទាត់ជាមួយឯកសាររឹង
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label class="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-card hover:bg-accent/40 cursor-pointer transition-colors select-none">
            <input type="checkbox" id="form-doc-hardcopy" ${docs.hardcopyForm ? 'checked' : ''} class="mt-0.5 rounded border-border text-purple-600 focus:ring-purple-500 cursor-pointer">
            <div class="text-xs">
              <span class="font-semibold text-foreground ${isKm ? 'font-khmer' : ''}">${t('registration.docHardcopyForm')}</span>
              <p class="text-[10px] text-muted-foreground mt-0.5">Original hard copy form</p>
            </div>
          </label>

          <label class="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-card hover:bg-accent/40 cursor-pointer transition-colors select-none">
            <input type="checkbox" id="form-doc-birth" ${docs.birthCertificate ? 'checked' : ''} class="mt-0.5 rounded border-border text-purple-600 focus:ring-purple-500 cursor-pointer">
            <div class="text-xs">
              <span class="font-semibold text-foreground ${isKm ? 'font-khmer' : ''}">${t('registration.docBirthCertificate')}</span>
              <p class="text-[10px] text-muted-foreground mt-0.5">Birth Certificate / Copy</p>
            </div>
          </label>

          <label class="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-card hover:bg-accent/40 cursor-pointer transition-colors select-none">
            <input type="checkbox" id="form-doc-transfer" ${docs.transferLetter ? 'checked' : ''} class="mt-0.5 rounded border-border text-purple-600 focus:ring-purple-500 cursor-pointer">
            <div class="text-xs">
              <span class="font-semibold text-foreground ${isKm ? 'font-khmer' : ''}">${t('registration.docTransferLetter')}</span>
              <p class="text-[10px] text-muted-foreground mt-0.5">Transfer letter from prior school</p>
            </div>
          </label>

          <label class="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-card hover:bg-accent/40 cursor-pointer transition-colors select-none">
            <input type="checkbox" id="form-doc-transcripts" ${docs.transcripts ? 'checked' : ''} class="mt-0.5 rounded border-border text-purple-600 focus:ring-purple-500 cursor-pointer">
            <div class="text-xs">
              <span class="font-semibold text-foreground ${isKm ? 'font-khmer' : ''}">${t('registration.docTranscripts')}</span>
              <p class="text-[10px] text-muted-foreground mt-0.5">Score book / Transcript</p>
            </div>
          </label>
        </div>
      </div>
    ` : '';

    const modalContent = `
      <form id="student-form" class="max-h-[75vh] sm:max-h-[80vh] overflow-y-auto pr-2 space-y-5 scroll-smooth">
        ${checklistSection}

        <!-- Section 1 — General Information -->
        <div class="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-border/80">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold font-mono">1</span>
              <h4 class="text-xs sm:text-sm font-bold text-foreground ${isKm ? 'font-khmer' : ''}">${t('students.sec1General')}</h4>
            </div>
            <span class="text-[11px] text-muted-foreground ${isKm ? 'font-khmer' : 'font-mono'}">${isKm ? 'ជួរឈរ ១–១០' : 'Fields 1–10'}</span>
          </div>

          <!-- Photo Upload & General Fields Layout -->
          <div class="flex flex-col lg:flex-row gap-5 items-start">
            <!-- Student Photo Upload & Preview Card -->
            <div class="w-full lg:w-48 flex-shrink-0 flex flex-col items-center justify-center p-4 rounded-lg border border-dashed border-border bg-muted/20">
              <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block leading-relaxed text-center ${isKm ? 'font-khmer' : ''}">
                ${t('students.photoLabel')}
              </label>
              <div id="photo-preview-container" class="w-28 h-32 rounded-lg overflow-hidden border border-border bg-card flex items-center justify-center mb-3 shadow-xs">
                ${previewUrl 
                  ? `<img id="form-photo-img" src="${previewUrl}" class="w-full h-full object-cover" />` 
                  : `<span class="text-muted-foreground">${getIcon('user', 'w-10 h-10')}</span>`}
              </div>
              <div class="flex items-center gap-2 w-full">
                <label class="cursor-pointer flex-1 py-1.5 px-2 rounded-md bg-primary text-primary-foreground text-center text-xs font-medium shadow-xs hover:bg-primary/90 transition-colors">
                  ${getIcon('upload', 'w-3 h-3 inline mr-1')}
                  <span class="${isKm ? 'font-khmer' : ''}">${t('students.choosePhoto')}</span>
                  <input type="file" id="form-photo-file-input" accept="image/*" class="hidden" />
                </label>
                <button type="button" id="btn-remove-photo" class="p-1.5 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-destructive transition-colors ${previewUrl ? '' : 'hidden'}" title="${t('students.removePhoto')}">
                  ${getIcon('x', 'w-3.5 h-3.5')}
                </button>
              </div>
              <p class="text-[10px] text-muted-foreground mt-1.5 text-center ${isKm ? 'font-khmer' : ''}">${t('students.photoHint')}</p>
            </div>

            <!-- Identity and Name Grid -->
            <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <!-- 1. Status -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.status')} <span class="text-destructive">*</span>
                </label>
                <select id="form-status" class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium box-border shadow-xs ${isKm ? 'font-khmer' : ''}">
                  <option value="Active" ${student?.status === 'Active' || !student ? 'selected' : ''}>${t('common.active')}</option>
                  <option value="Inactive" ${student?.status === 'Inactive' ? 'selected' : ''}>${t('common.inactive')}</option>
                  <option value="Transferred" ${student?.status === 'Transferred' ? 'selected' : ''}>${t('common.transferred')}</option>
                  <option value="Graduated" ${student?.status === 'Graduated' ? 'selected' : ''}>${t('common.graduated')}</option>
                </select>
              </div>

              <!-- 4. Student ID -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${isAdmissionMode ? (isKm ? 'អត្តលេខសិស្ស / ID ស្នើសុំ' : 'Student ID / Temp ID') : t('students.studentId')} <span class="text-destructive">*</span>
                </label>
                <div class="flex items-center gap-1.5">
                  <input type="text" 
                         id="form-studentId" 
                         required 
                         value="${student?.studentId || student?.tempStudentId || ''}" 
                         placeholder="${isKm ? 'ឧ. STU-001' : 'e.g. STU-001'}"
                         class="flex-1 h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono font-bold box-border shadow-xs" />
                  ${isAdmissionMode ? `
                    <button type="button" id="btn-modal-autogen-id" title="${t('registration.autoGenerateId')}" class="h-10 px-2.5 rounded-md border border-border bg-card hover:bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex-shrink-0">
                      ${getIcon('rotateCw', 'w-3.5 h-3.5')}
                    </button>
                  ` : ''}
                </div>
                <p id="err-studentId" class="text-[11px] text-destructive mt-1 hidden"></p>
              </div>

              <!-- 9. Gender -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.gender')} <span class="text-destructive">*</span>
                </label>
                <select id="form-gender" class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}">
                  <option value="Male" ${student?.gender === 'Male' || !student ? 'selected' : ''}>${t('common.male')}</option>
                  <option value="Female" ${student?.gender === 'Female' ? 'selected' : ''}>${t('common.female')}</option>
                </select>
              </div>

              <!-- 5. Last Name KH -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.lastNameKh')} <span class="text-destructive">*</span>
                </label>
                <input type="text" 
                       id="form-lastNameKh" 
                       required 
                       value="${student?.lastNameKh || ''}" 
                       placeholder="${isKm ? 'ឧ. សោម' : 'e.g. Som'}"
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-khmer font-medium box-border shadow-xs" />
              </div>

              <!-- 6. First Name KH -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.firstNameKh')} <span class="text-destructive">*</span>
                </label>
                <input type="text" 
                       id="form-firstNameKh" 
                       required 
                       value="${student?.firstNameKh || student?.name || ''}" 
                       placeholder="${isKm ? 'ឧ. ដារ៉ា' : 'e.g. Dara'}"
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-khmer font-medium box-border shadow-xs" />
              </div>

              <!-- 10. Date of Birth -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.dateOfBirth')}
                </label>
                <input type="date" 
                       id="form-dob" 
                       value="${initialDob}" 
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs" />
              </div>

              <!-- 7. Latin Last Name -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.lastNameLatin')}
                </label>
                <input type="text" 
                       id="form-lastNameLatin" 
                       value="${student?.lastNameLatin || ''}" 
                       placeholder="${isKm ? 'ឧ. Som' : 'e.g. Som'}"
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium font-mono uppercase box-border shadow-xs" />
              </div>

              <!-- 8. Latin First Name -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.firstNameLatin')}
                </label>
                <input type="text" 
                       id="form-firstNameLatin" 
                       value="${student?.firstNameLatin || ''}" 
                       placeholder="${isKm ? 'ឧ. Dara' : 'e.g. Dara'}"
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium font-mono uppercase box-border shadow-xs" />
              </div>

              <!-- Age (អាយុ / Age) -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.age')}
                </label>
                <input type="text" 
                       id="form-age" 
                       value="${initialAge}" 
                       placeholder="${isKm ? 'ឧ. 10' : 'e.g. 10'}"
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2 — Place of Birth -->
        <div class="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-border/80">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">2</span>
              <h4 class="text-xs sm:text-sm font-bold text-foreground ${isKm ? 'font-khmer' : ''}">${t('students.sec2Birthplace')}</h4>
            </div>
            <span class="text-[11px] text-muted-foreground ${isKm ? 'font-khmer' : 'font-mono'}">${isKm ? 'ជួរឈរ ១១–១៤' : 'Fields 11–14'}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- 11. Birth Village -->
            ${renderLocationField('form-birthVillage', 'villages', t('students.birthVillage'), student?.birthVillage)}

            <!-- 12. Birth Commune -->
            ${renderLocationField('form-birthCommune', 'communes', t('students.birthCommune'), student?.birthCommune)}

            <!-- 13. Birth District -->
            ${renderLocationField('form-birthDistrict', 'districts', t('students.birthDistrict'), student?.birthDistrict)}

            <!-- 14. Birth Province -->
            ${renderLocationField('form-birthProvince', 'provinces', t('students.birthProvince'), student?.birthProvince)}
          </div>
        </div>

        <!-- Section 3 — Current Address -->
        <div class="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-border/80">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold font-mono">3</span>
              <h4 class="text-xs sm:text-sm font-bold text-foreground ${isKm ? 'font-khmer' : ''}">${t('students.sec3CurrentAddress')}</h4>
            </div>
            <span class="text-[11px] text-muted-foreground ${isKm ? 'font-khmer' : 'font-mono'}">${isKm ? 'ជួរឈរ ១៥–១៨' : 'Fields 15–18'}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- 15. Current Village -->
            ${renderLocationField('form-currentVillage', 'villages', t('students.currentVillage'), student?.currentVillage)}

            <!-- 16. Current Commune -->
            ${renderLocationField('form-currentCommune', 'communes', t('students.currentCommune'), student?.currentCommune)}

            <!-- 17. Current District -->
            ${renderLocationField('form-currentDistrict', 'districts', t('students.currentDistrict'), student?.currentDistrict)}

            <!-- 18. Current Province -->
            ${renderLocationField('form-currentProvince', 'provinces', t('students.currentProvince'), student?.currentProvince)}
          </div>
        </div>

        <!-- Section 4 — Academic & Contact -->
        <div class="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-border/80">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold font-mono">4</span>
              <h4 class="text-xs sm:text-sm font-bold text-foreground ${isKm ? 'font-khmer' : ''}">${t('students.sec4AcademicContact')}</h4>
            </div>
            <span class="text-[11px] text-muted-foreground ${isKm ? 'font-khmer' : 'font-mono'}">${isKm ? 'ជួរឈរ ១៩–២៣' : 'Fields 19–23'}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <!-- 19. Academic Year -->
            ${renderAcademicYearDropdown(student?.academicYear || activeYear)}

            <!-- 20. Last Year School -->
            ${renderLocationField('form-lastYearSchool', 'lastYearSchools', t('students.lastYearSchool'), student?.lastYearSchool)}

            <!-- 21. School -->
            ${isTeacher ? `
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.school')}
                </label>
                <div class="relative">
                  <input type="text" 
                         id="form-school-display" 
                         value="${student?.school || teacherSchoolName}" 
                         readonly 
                         disabled 
                         class="w-full h-10 px-3 py-2 rounded-md border border-input bg-muted text-muted-foreground cursor-not-allowed opacity-90 box-border shadow-xs font-medium ${isKm ? 'font-khmer' : ''}" />
                  <input type="hidden" id="form-school" value="${student?.school || teacherSchoolName}" />
                </div>
              </div>
            ` : `
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.school')}
                </label>
                <select id="form-school" class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium box-border shadow-xs ${isKm ? 'font-khmer' : ''}">
                  <option value="">${isKm ? 'ជ្រើសរើសសាលារៀន...' : 'Select School...'}</option>
                  ${schoolsList.map(s => {
                    const isSelected = (student?.school === s.name || student?.school === s.nameEn || (!student?.school && s.id === 'sch-1'));
                    const disp = isKm ? (s.name || s.nameEn) : (s.nameEn || s.name);
                    return `<option value="${s.name}" ${isSelected ? 'selected' : ''}>${disp}</option>`;
                  }).join('')}
                </select>
              </div>
            `}

            <!-- 21. Class / Target Classroom -->
            <div>
              <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                ${isAdmissionMode ? (isKm ? 'ថ្នាក់រៀនគោលដៅ' : 'Destination Class') : t('students.classId')} <span class="text-destructive">*</span>
              </label>
              ${isTeacher ? `
                <div class="relative">
                  <input type="text" 
                         id="form-class-display" 
                         value="${assignedCls ? assignedCls.name : (teacherClassId || (isKm ? 'ថ្នាក់ដែលបានចាត់តាំង' : 'Assigned Classroom'))}" 
                         readonly 
                         disabled 
                         class="w-full h-10 px-3 py-2 rounded-md border border-input bg-muted text-muted-foreground cursor-not-allowed opacity-90 font-medium box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
                  <input type="hidden" id="form-classId" value="${teacherClassId || ''}" />
                </div>
              ` : `
                <select id="form-classId" class="w-full h-10 px-3 py-2 pr-9 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium box-border shadow-xs ${isKm ? 'font-khmer' : ''}">
                  <option value="">${t('common.selectClass') || (isKm ? 'ជ្រើសរើសថ្នាក់រៀន...' : 'Select Class...')}</option>
                  ${classes.map(c => `
                    <option value="${c.id}" ${(student?.classId === c.id || student?.assignedClassId === c.id) ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              `}
            </div>

            <!-- 22. Student Phone -->
            <div>
              <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                ${t('students.studentPhone')}
              </label>
              <input type="tel" 
                     id="form-studentPhone" 
                     value="${student?.studentPhone || student?.phone || ''}" 
                     placeholder="012 345 678" 
                     class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono box-border shadow-xs" />
            </div>
          </div>
        </div>

        <!-- Section 5 — Parents Information -->
        <div class="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-border/80">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold font-mono">5</span>
              <h4 class="text-xs sm:text-sm font-bold text-foreground ${isKm ? 'font-khmer' : ''}">${t('students.sec5ParentsInfo')}</h4>
            </div>
            <span class="text-[11px] text-muted-foreground ${isKm ? 'font-khmer' : 'font-mono'}">${isKm ? 'ជួរឈរ ២៣–២៨' : 'Fields 23–28'}</span>
          </div>

          <!-- Father Details -->
          <div class="space-y-2">
            <span class="text-[11px] font-bold text-foreground flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
              ${getIcon('user', 'w-3.5 h-3.5 text-primary')}
              <span>${t('students.fatherDetails')}</span>
            </span>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- 23. Father Name -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.fatherName')}
                </label>
                <input type="text" 
                       id="form-fatherName" 
                       value="${student?.fatherName || ''}" 
                       placeholder="${t('students.fatherName')}" 
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
              </div>
              <!-- 24. Father Occupation -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.fatherOccupationLabel')}
                </label>
                <input type="text" 
                       id="form-fatherOccupation" 
                       value="${student?.fatherOccupation || student?.fatherJob || ''}" 
                       placeholder="${t('students.fatherOccupationLabel')}" 
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
              </div>
              <!-- 25. Father Phone -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.fatherPhoneLabel')}
                </label>
                <input type="tel" 
                       id="form-fatherPhone" 
                       value="${student?.fatherPhone || student?.parentPhone || ''}" 
                       placeholder="012 345 678" 
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono box-border shadow-xs" />
              </div>
            </div>
          </div>

          <!-- Mother Details -->
          <div class="space-y-2 pt-2 border-t border-border/60">
            <span class="text-[11px] font-bold text-foreground flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
              ${getIcon('user', 'w-3.5 h-3.5 text-primary')}
              <span>${t('students.motherDetails')}</span>
            </span>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- 26. Mother Name -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.motherName')}
                </label>
                <input type="text" 
                       id="form-motherName" 
                       value="${student?.motherName || ''}" 
                       placeholder="${t('students.motherName')}" 
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
              </div>
              <!-- 27. Mother Occupation -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.motherOccupationLabel')}
                </label>
                <input type="text" 
                       id="form-motherOccupation" 
                       value="${student?.motherOccupation || student?.motherJob || ''}" 
                       placeholder="${t('students.motherOccupationLabel')}" 
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
              </div>
              <!-- 28. Mother Phone -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.motherPhoneLabel')}
                </label>
                <input type="tel" 
                       id="form-motherPhone" 
                       value="${student?.motherPhone || ''}" 
                       placeholder="012 345 678" 
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono box-border shadow-xs" />
              </div>
            </div>
          </div>

          <!-- Guardian Details -->
          <div class="space-y-2 pt-2 border-t border-border/60">
            <span class="text-[11px] font-bold text-foreground flex items-center gap-1.5 ${isKm ? 'font-khmer' : ''}">
              ${getIcon('userCheck', 'w-3.5 h-3.5 text-primary')}
              <span>${t('students.guardianName') || 'អាណាព្យាបាល'}</span>
            </span>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- Guardian Name -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.guardianName') || 'អាណាព្យាបាល'}
                </label>
                <input type="text" 
                       id="form-guardianName" 
                       value="${student?.guardianName || student?.guardian || ''}" 
                       placeholder="${t('students.guardianName') || 'អាណាព្យាបាល'}" 
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
              </div>
              <!-- Guardian Occupation -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.fatherOccupationLabel') || 'មុខរបរ'}
                </label>
                <input type="text" 
                       id="form-guardianOccupation" 
                       value="${student?.guardianOccupation || student?.guardianJob || ''}" 
                       placeholder="${t('students.fatherOccupationLabel') || 'មុខរបរ'}" 
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring box-border shadow-xs ${isKm ? 'font-khmer' : ''}" />
              </div>
              <!-- Guardian Phone -->
              <div>
                <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${t('students.parentPhone') || 'លេខទូរស័ព្ទ'}
                </label>
                <input type="tel" 
                       id="form-guardianPhone" 
                       value="${student?.guardianPhone || ''}" 
                       placeholder="012 345 678" 
                       class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono box-border shadow-xs" />
              </div>
            </div>
          </div>
        </div>

        <!-- Section 6 — Notes / Remarks -->
        <div class="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-border/80">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-md bg-gray-500/10 text-muted-foreground flex items-center justify-center text-xs font-bold font-mono">6</span>
              <h4 class="text-xs sm:text-sm font-bold text-foreground ${isKm ? 'font-khmer' : ''}">${t('students.sec6Notes')}</h4>
            </div>
            <span class="text-[11px] text-muted-foreground ${isKm ? 'font-khmer' : 'font-mono'}">${isKm ? 'ជួរឈរ ២៩' : 'Field 29'}</span>
          </div>

          <!-- 29. Notes -->
          <div>
            <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block leading-relaxed ${isKm ? 'font-khmer' : ''}">
              ${t('students.notes')}
            </label>
            <textarea id="form-notes" 
                      rows="3" 
                      placeholder="${t('students.notesPlaceholder')}" 
                      class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none leading-relaxed ${isKm ? 'font-khmer' : ''}">${student?.notes || ''}</textarea>
          </div>
        </div>
      </form>
    `;

    // Action Footer
    let footer = '';
    if (isAdmissionMode) {
      footer = `
        <div class="flex flex-wrap items-center justify-between w-full gap-2 select-none">
          <button id="btn-cancel-form" type="button" class="h-10 px-4 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer">
            ${t('common.cancel')}
          </button>
          <div class="flex items-center gap-2 ml-auto">
            <button id="btn-save-student" type="button" class="h-10 px-4 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer" title="${isEdit ? t('registration.btnMarkVerified') : t('registration.btnSavePending')}">
              ${getIcon('fileCheck', 'w-4 h-4 text-purple-600')}
              <span>${isEdit ? t('registration.btnMarkVerified') : (t('registration.btnSavePending') || 'រក្សាទុកជាពាក្យសុំ')}</span>
            </button>
            <button id="btn-enroll-push" type="button" class="h-10 px-4 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer" title="${isEdit ? t('registration.btnApproveAndEnroll') : t('registration.btnSaveAndApproveDirectly')}">
              ${getIcon('badgeCheck', 'w-4 h-4')}
              <span>${isEdit ? t('registration.btnApproveAndEnroll') : (t('registration.btnSaveAndApproveDirectly') || 'រក្សាទុក និងអនុម័តភ្លាមៗ')}</span>
            </button>
          </div>
        </div>
      `;
    } else {
      footer = `
        <div class="flex items-center justify-between w-full select-none">
          <span class="text-xs text-muted-foreground hidden sm:inline-block ${isKm ? 'font-khmer' : ''}">
            ${isEdit ? t('students.formSubtitleEdit') : t('students.formSubtitleNew')}
          </span>
          <div class="flex items-center gap-2.5 ml-auto">
            <button id="btn-cancel-form" type="button" class="h-10 px-4 rounded-lg border border-border hover:bg-muted text-xs sm:text-sm font-medium transition-colors ${isKm ? 'font-khmer' : ''}">
              ${t('common.cancel')}
            </button>
            <button id="btn-save-student" type="button" class="h-10 px-5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center gap-2 ${isKm ? 'font-khmer' : ''}">
              ${getIcon('check', 'w-4 h-4')}
              <span>${t('common.save')}</span>
            </button>
          </div>
        </div>
      `;
    }

    const modal = Modal.open({
      title: headerContent,
      content: modalContent,
      footer,
      maxWidth: 'max-w-4xl',
      backdropClose: false,
      preventUnsavedClose: true
    });

    const updateHeaderPhoto = (url) => {
      const headerPhotoEl = modal.element.querySelector('#modal-header-photo');
      if (headerPhotoEl) {
        headerPhotoEl.innerHTML = url 
          ? `<img src="${url}" class="w-full h-full object-cover" />` 
          : getIcon(isAdmissionMode ? 'fileCheck' : 'user', 'w-4 h-4');
      }
    };

    const photoFileInput = modal.element.querySelector('#form-photo-file-input');
    const removePhotoBtn = modal.element.querySelector('#btn-remove-photo');
    const previewContainer = modal.element.querySelector('#photo-preview-container');

    photoFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        tempBlob = await photoService.processImageFile(file);
        previewUrl = photoService.getUrlForBlob(tempBlob);
        previewContainer.innerHTML = `<img id="form-photo-img" src="${previewUrl}" class="w-full h-full object-cover" />`;
        removePhotoBtn?.classList.remove('hidden');
        updateHeaderPhoto(previewUrl);
      } catch (err) {
        toast.error(err.message, 'Photo Upload Failed');
      }
    });

    removePhotoBtn?.addEventListener('click', () => {
      tempBlob = null;
      previewUrl = null;
      previewContainer.innerHTML = `<span class="text-muted-foreground">${getIcon('user', 'w-10 h-10')}</span>`;
      removePhotoBtn.classList.add('hidden');
      if (photoFileInput) photoFileInput.value = '';
      updateHeaderPhoto(null);
    });

    const dobInput = modal.element.querySelector('#form-dob');
    const ageInput = modal.element.querySelector('#form-age');
    const syncAgeWithDob = () => {
      if (ageInput && dobInput) {
        ageInput.value = calculateAge(dobInput.value);
      }
    };
    dobInput?.addEventListener('input', syncAgeWithDob);
    dobInput?.addEventListener('change', syncAgeWithDob);

    // Auto-generate ID in admissions mode
    modal.element.querySelector('#btn-modal-autogen-id')?.addEventListener('click', async () => {
      const sid = await RegistrationService.generateNextStudentId('STU');
      const sidInput = modal.element.querySelector('#form-studentId');
      if (sidInput) sidInput.value = sid;
    });

    // Automatically sync academic year dropdown with the selected class's academic year
    modal.element.querySelector('#form-classId')?.addEventListener('change', (e) => {
      const selectedClassId = e.target.value;
      const selectedCls = classes.find(c => c.id === selectedClassId);
      if (selectedCls && selectedCls.academicYear) {
        const aySelect = modal.element.querySelector('#form-academicYear');
        if (aySelect) {
          const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
          const targetNorm = normDash(selectedCls.academicYear);
          let matched = false;
          for (const opt of aySelect.options) {
            if (normDash(opt.value) === targetNorm) {
              opt.selected = true;
              matched = true;
              break;
            }
          }
          if (!matched) {
            const newOpt = new Option(selectedCls.academicYear, selectedCls.academicYear, true, true);
            aySelect.add(newOpt);
          }
        }
      }
    });

    // Sync location dropdowns
    const syncLocationDropdowns = (cat) => {
      const dropdowns = modal.element.querySelectorAll(`.custom-location-dropdown[data-category="${cat}"]`);
      const items = locationsData[cat] || [];

      dropdowns.forEach(dd => {
        const fieldId = dd.getAttribute('data-field-id');
        const hiddenInput = dd.querySelector(`#${fieldId}`);
        const currentVal = (hiddenInput?.value || '').trim();
        const triggerText = dd.querySelector('.selected-text');
        const itemsList = dd.querySelector('.items-list');

        const stillExists = items.some(i => i.toLowerCase() === currentVal.toLowerCase());
        if (currentVal && !stillExists) {
          if (hiddenInput) hiddenInput.value = '';
          if (triggerText) {
            triggerText.textContent = t('locations.selectPrompt');
            triggerText.className = 'selected-text truncate text-muted-foreground';
          }
        }

        const effectiveVal = hiddenInput?.value || '';
        if (itemsList) {
          itemsList.innerHTML = `
            <div class="item-row flex items-center px-2.5 py-1.5 rounded-md hover:bg-accent text-xs text-muted-foreground italic cursor-pointer transition-colors" data-value="">
              <span>${t('locations.selectPrompt')}</span>
            </div>
            ${items.map(opt => `
              <div class="item-row flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-accent text-sm text-foreground group cursor-pointer transition-colors ${effectiveVal.toLowerCase() === opt.toLowerCase() ? 'bg-accent/60 font-semibold text-primary' : ''}" data-value="${opt}">
                <span class="item-label flex-1 truncate pr-2 ${isKm ? 'font-khmer' : ''}">${opt}</span>
                <button type="button" class="btn-delete-item p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0" title="${t('locations.delete')}" data-value="${opt}">
                  ${getIcon('trash', 'w-3.5 h-3.5')}
                </button>
              </div>
            `).join('')}
          `;
        }
      });
    };

    // Custom location dropdown event delegation
    modal.element.addEventListener('click', (e) => {
      const trigger = e.target.closest('.dropdown-trigger');
      if (trigger) {
        e.stopPropagation();
        const dd = trigger.closest('.custom-location-dropdown');
        const menu = dd?.querySelector('.dropdown-menu');
        const chevron = trigger.querySelector('.trigger-chevron');
        const isOpen = !menu?.classList.contains('hidden');

        modal.element.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
        modal.element.querySelectorAll('.trigger-chevron').forEach(c => c.classList.remove('rotate-180'));

        if (!isOpen && menu) {
          menu.classList.remove('hidden');
          chevron?.classList.add('rotate-180');
          const input = menu.querySelector('.input-new-item');
          setTimeout(() => input?.focus(), 50);
        }
        return;
      }

      const menu = e.target.closest('.dropdown-menu');
      if (menu) {
        const dd = menu.closest('.custom-location-dropdown');
        const fieldId = dd?.getAttribute('data-field-id');
        const category = dd?.getAttribute('data-category');
        const hiddenInput = dd?.querySelector(`#${fieldId}`);
        const triggerText = dd?.querySelector('.selected-text');

        const deleteBtn = e.target.closest('.btn-delete-item');
        if (deleteBtn) {
          e.stopPropagation();
          const valToDelete = deleteBtn.getAttribute('data-value');
          if (!valToDelete) return;

          openDeleteLocationConfirm({
            title: t('locations.delete'),
            message: t('locations.confirmDelete').replace('{name}', valToDelete),
            isKm,
            onConfirm: async () => {
              const updated = await LocationService.deleteItem(category, valToDelete);
              locationsData[category] = updated;
              syncLocationDropdowns(category);
              toast.success(t('locations.deletedSuccess'));
            }
          });
          return;
        }

        const addBtn = e.target.closest('.btn-add-item');
        if (addBtn) {
          e.stopPropagation();
          const input = menu.querySelector('.input-new-item');
          const valToAdd = input?.value?.trim();
          if (!valToAdd) return;
          (async () => {
            try {
              const updated = await LocationService.addItem(category, valToAdd);
              locationsData[category] = updated;
              syncLocationDropdowns(category);
              if (hiddenInput) hiddenInput.value = valToAdd;
              if (triggerText) triggerText.textContent = valToAdd;
              if (input) input.value = '';
              menu.classList.add('hidden');
              dd?.querySelector('.trigger-chevron')?.classList.remove('rotate-180');
            } catch (err) {
              toast.error(err.message);
            }
          })();
          return;
        }

        const itemRow = e.target.closest('.item-row');
        if (itemRow) {
          const selectedVal = itemRow.getAttribute('data-value') || '';
          if (hiddenInput) hiddenInput.value = selectedVal;
          if (triggerText) {
            triggerText.textContent = selectedVal || t('locations.selectPrompt');
            triggerText.className = `selected-text truncate ${!selectedVal ? 'text-muted-foreground' : 'font-medium text-foreground ' + (isKm ? 'font-khmer' : '')}`;
          }
          menu.classList.add('hidden');
          dd?.querySelector('.trigger-chevron')?.classList.remove('rotate-180');
          return;
        }
      }
    });

    // Collect all 29 fields from form
    const collectFormData = () => {
      const getVal = (id) => (modal.element.querySelector(`#${id}`)?.value || '').trim();

      const studentId = getVal('form-studentId');
      const lastNameKh = getVal('form-lastNameKh');
      const firstNameKh = getVal('form-firstNameKh');
      const lastNameLatin = getVal('form-lastNameLatin');
      const firstNameLatin = getVal('form-firstNameLatin');
      const gender = getVal('form-gender') || 'Male';
      const status = getVal('form-status') || 'Active';
      const dateOfBirth = getVal('form-dob');
      const birthVillage = getVal('form-birthVillage');
      const birthCommune = getVal('form-birthCommune');
      const birthDistrict = getVal('form-birthDistrict');
      const birthProvince = getVal('form-birthProvince');
      const currentVillage = getVal('form-currentVillage');
      const currentCommune = getVal('form-currentCommune');
      const currentDistrict = getVal('form-currentDistrict');
      const currentProvince = getVal('form-currentProvince');
      const academicYear = getVal('form-academicYear') || activeYear;
      const lastYearSchool = getVal('form-lastYearSchool');
      const school = getVal('form-school');
      const classId = getVal('form-classId');
      const studentPhone = getVal('form-studentPhone');
      const fatherName = getVal('form-fatherName');
      const fatherOccupation = getVal('form-fatherOccupation');
      const fatherPhone = getVal('form-fatherPhone');
      const motherName = getVal('form-motherName');
      const motherOccupation = getVal('form-motherOccupation');
      const motherPhone = getVal('form-motherPhone');
      const guardianName = getVal('form-guardianName');
      const guardianOccupation = getVal('form-guardianOccupation');
      const guardianPhone = getVal('form-guardianPhone');
      const notes = getVal('form-notes');

      // Check admissions documents
      const hardcopyForm = modal.element.querySelector('#form-doc-hardcopy')?.checked || false;
      const birthCertificate = modal.element.querySelector('#form-doc-birth')?.checked || false;
      const transferLetter = modal.element.querySelector('#form-doc-transfer')?.checked || false;
      const transcripts = modal.element.querySelector('#form-doc-transcripts')?.checked || false;

      const khmerName = [lastNameKh, firstNameKh].filter(Boolean).join(' ');
      const englishName = [lastNameLatin, firstNameLatin].filter(Boolean).join(' ');

      const record = {
        studentId,
        tempStudentId: student?.tempStudentId || studentId,
        lastNameKh,
        firstNameKh,
        lastNameLatin,
        firstNameLatin,
        khmerName,
        englishName,
        name: khmerName || englishName,
        gender,
        status,
        dateOfBirth,
        dob: dateOfBirth,
        birthVillage,
        birthCommune,
        birthDistrict,
        birthProvince,
        currentVillage,
        currentCommune,
        currentDistrict,
        currentProvince,
        academicYear,
        lastYearSchool,
        school,
        classId,
        assignedClassId: classId,
        studentPhone,
        fatherName,
        fatherOccupation,
        fatherJob: fatherOccupation,
        fatherPhone,
        motherName,
        motherOccupation,
        motherJob: motherOccupation,
        motherPhone,
        guardianName,
        guardian: guardianName,
        guardianOccupation,
        guardianJob: guardianOccupation,
        guardianPhone,
        notes,
        photoBlob: tempBlob,
        photo: tempBlob ? '(Photo attached)' : (student?.photo || '')
      };

      if (isAdmissionMode) {
        record.documentsChecked = { hardcopyForm, birthCertificate, transferLetter, transcripts };
        const isVerified = Object.values(record.documentsChecked).some(Boolean);
        record.verificationStatus = isVerified ? 'VERIFIED' : 'PENDING';
      }

      return record;
    };

    // Save button click
    modal.element.querySelector('#btn-save-student')?.addEventListener('click', async () => {
      const data = collectFormData();

      if (!data.studentId) {
        toast.error({ message: t('registration.studentIdRequiredError') || 'Student ID is required.' });
        modal.element.querySelector('#form-studentId')?.focus();
        return;
      }
      if (!data.firstNameKh && !data.lastNameKh && !data.firstNameLatin) {
        toast.error({ message: 'Student name is required.' });
        modal.element.querySelector('#form-firstNameKh')?.focus();
        return;
      }

      try {
        if (onSave) {
          await onSave(data, modal);
        }
      } catch (err) {
        toast.error({ message: err.message });
      }
    });

    // Push to School button click (Admissions mode)
    modal.element.querySelector('#btn-enroll-push')?.addEventListener('click', async () => {
      const data = collectFormData();

      if (!data.studentId) {
        toast.error({ message: t('registration.studentIdRequiredError') });
        modal.element.querySelector('#form-studentId')?.focus();
        return;
      }
      if (!data.classId) {
        toast.error({ message: t('registration.classRequiredError') });
        modal.element.querySelector('#form-classId')?.focus();
        return;
      }

      try {
        if (onEnroll) {
          await onEnroll(data, modal);
        }
      } catch (err) {
        toast.error({ message: err.message });
      }
    });

    modal.element.querySelector('#btn-cancel-form')?.addEventListener('click', () => {
      modal.close();
    });

    return modal;
  }
};
