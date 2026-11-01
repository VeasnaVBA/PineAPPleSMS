/**
 * Dedicated Teacher Form Modal for OFFICER Account
 * Completely separated and isolated from Director & Teacher account forms.
 * Any fields, textboxes, or controls added/removed here will NEVER affect other account types.
 */

import { TeacherService } from '../services/teacherService.js';
import { photoService } from '../services/photoService.js';
import { toast } from './toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from './icons.js';

export const OfficerTeacherFormModal = {
  /**
   * Open the dedicated Officer teacher form
   * @param {Object} options
   * @param {Object} [options.teacher=null] - Existing teacher record (if editing)
   * @param {Function} options.onSave - Callback when saved
   */
  async open({ teacher = null, onSave }) {
    const isEdit = !!teacher;
    const isKm = i18n.getLocale() === 'km';
    const title = isEdit 
      ? (isKm ? 'កែប្រែព័ត៌មានគ្រូបង្រៀន (ការិយាល័យ)' : 'Edit Teacher Record (Office)') 
      : (isKm ? 'បន្ថែមគ្រូបង្រៀនថ្មី (ការិយាល័យ)' : 'Add New Teacher (Office)');

    let tempBlob = teacher?.photoBlob || null;
    if (!tempBlob && teacher?.photo && teacher.photo.startsWith('data:')) {
      try {
        tempBlob = await photoService.dataUrlToBlob(teacher.photo);
      } catch (_) {}
    }
    let previewUrl = photoService.getUrlForBlob(tempBlob || teacher?.photo);

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-fade-in overflow-y-auto';
    overlay.id = 'officer-teacher-form-modal-overlay';

    overlay.innerHTML = `
      <div class="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl flex flex-col my-auto overflow-hidden animate-slide-down">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div class="flex items-center gap-2.5">
            <span class="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              ${getIcon('teachers', 'w-5 h-5')}
            </span>
            <div>
              <h3 class="text-base font-bold text-foreground ${isKm ? 'font-khmer' : ''}">
                ${title}
              </h3>
              <p class="text-xs text-muted-foreground">
                ${isKm ? 'ទម្រង់បំពេញទិន្នន័យសម្រាប់មន្ត្រីការិយាល័យ (ឯករាជ្យពីគណនីផ្សេងទៀត)' : 'Dedicated Office Staff Form (Independent from other roles)'}
              </p>
            </div>
          </div>
          <button id="btn-officer-modal-close" class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Close">
            ${getIcon('close', 'w-5 h-5')}
          </button>
        </div>

        <!-- Form Body -->
        <form id="officer-teacher-form" class="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <!-- Photo & Basic Identity -->
          <div class="flex flex-col sm:flex-row gap-5 items-start">
            <!-- Photo Upload Box -->
            <div class="flex flex-col items-center gap-2 flex-shrink-0 self-center sm:self-start">
              <div class="relative w-24 h-28 rounded-lg border-2 border-dashed border-border hover:border-teal-500 overflow-hidden bg-muted/30 flex items-center justify-center group cursor-pointer transition-colors" id="officer-photo-box">
                <img id="officer-photo-preview" src="${previewUrl || ''}" class="${previewUrl ? '' : 'hidden'} w-full h-full object-cover" alt="Teacher photo" />
                <div id="officer-photo-placeholder" class="${previewUrl ? 'hidden' : 'flex'} flex-col items-center justify-center text-muted-foreground group-hover:text-teal-600 transition-colors p-2 text-center">
                  ${getIcon('camera', 'w-6 h-6 mb-1')}
                  <span class="text-[10px] font-medium leading-tight">${isKm ? 'រូបថត 4x6' : 'Photo'}</span>
                </div>
              </div>
              <input type="file" id="officer-photo-input" accept="image/*" class="hidden" />
              <button type="button" id="btn-officer-photo-trigger" class="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium">
                ${previewUrl ? (isKm ? 'ប្តូររូបថត' : 'Change') : (isKm ? 'បញ្ចូលរូបថត' : 'Upload')}
              </button>
            </div>

            <!-- Basic Info Fields -->
            <div class="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <!-- Teacher ID -->
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">
                  ${isKm ? 'លេខសម្គាល់គ្រូ (Teacher ID)' : 'Teacher ID'} *
                </label>
                <input type="text" id="officer-teacher-id" required
                       value="${teacher?.teacherId || ''}"
                       placeholder="${isKm ? 'ឧ. T-001' : 'e.g. T-001'}"
                       class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </div>

              <!-- Civil Servant ID -->
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">
                  ${isKm ? 'អត្តលេខមន្ត្រីរាជការ' : 'Civil Servant ID'}
                </label>
                <input type="text" id="officer-civil-servant-id"
                       value="${teacher?.civilServantId || ''}"
                       placeholder="${isKm ? 'ឧ. 19800101...' : 'e.g. 19800101...'}"
                       class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </div>

              <!-- Khmer Surname -->
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">
                  ${isKm ? 'គោត្តនាម (ត្រកូល)' : 'Khmer Surname'} *
                </label>
                <input type="text" id="officer-last-name-km" required
                       value="${teacher?.lastNameKhmer || ''}"
                       placeholder="${isKm ? 'ឧ. សុខ' : 'Khmer Surname'}"
                       class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 font-khmer" />
              </div>

              <!-- Khmer First Name -->
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">
                  ${isKm ? 'នាមខ្លួន' : 'Khmer First Name'} *
                </label>
                <input type="text" id="officer-first-name-km" required
                       value="${teacher?.firstNameKhmer || ''}"
                       placeholder="${isKm ? 'ឧ. វិបុល' : 'Khmer First Name'}"
                       class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 font-khmer" />
              </div>

              <!-- Latin Surname -->
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">
                  ${isKm ? 'ត្រកូលឡាតាំង (Latin Surname)' : 'Latin Surname'}
                </label>
                <input type="text" id="officer-last-name-en"
                       value="${teacher?.lastNameLatin || ''}"
                       placeholder="e.g. SOK"
                       class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 uppercase" />
              </div>

              <!-- Latin First Name -->
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">
                  ${isKm ? 'នាមខ្លួនឡាតាំង (Latin First Name)' : 'Latin First Name'}
                </label>
                <input type="text" id="officer-first-name-en"
                       value="${teacher?.firstNameLatin || ''}"
                       placeholder="e.g. VIBOL"
                       class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 uppercase" />
              </div>
            </div>
          </div>

          <!-- Second Section: Gender, DOB, Phone, Position, Subject, Status -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t border-border">
            <!-- Gender -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">
                ${isKm ? 'ភេទ' : 'Gender'} *
              </label>
              <select id="officer-gender" required
                      class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500">
                <option value="ស្រី" ${(teacher?.gender === 'ស្រី' || teacher?.gender === 'Female') ? 'selected' : ''}>${isKm ? 'ស្រី' : 'Female'}</option>
                <option value="ប្រុស" ${(teacher?.gender === 'ប្រុស' || teacher?.gender === 'Male' || !teacher) ? 'selected' : ''}>${isKm ? 'ប្រុស' : 'Male'}</option>
              </select>
            </div>

            <!-- Date of Birth -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">
                ${isKm ? 'ថ្ងៃខែឆ្នាំកំណើត' : 'Date of Birth'}
              </label>
              <input type="date" id="officer-dob"
                     value="${teacher?.dob || ''}"
                     class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>

            <!-- Phone Number -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">
                ${isKm ? 'លេខទូរស័ព្ទ' : 'Phone Number'}
              </label>
              <input type="text" id="officer-phone"
                     value="${teacher?.phone || ''}"
                     placeholder="012 345 678"
                     class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>

            <!-- Position -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">
                ${isKm ? 'តួនាទី / មុខតំណែង' : 'Position'}
              </label>
              <input type="text" id="officer-position"
                     value="${teacher?.position || ''}"
                     placeholder="${isKm ? 'ឧ. គ្រូបង្រៀន' : 'e.g. Teacher'}"
                     class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>

            <!-- Primary Subject -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">
                ${isKm ? 'មុខវិជ្ជាឯកទេស' : 'Primary Subject'}
              </label>
              <input type="text" id="officer-subject"
                     value="${teacher?.subject1 || teacher?.subject || ''}"
                     placeholder="${isKm ? 'ឧ. គណិតវិទ្យា' : 'e.g. Mathematics'}"
                     class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </div>

            <!-- Work Status -->
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">
                ${isKm ? 'ស្ថានភាពការងារ' : 'Work Status'}
              </label>
              <select id="officer-status"
                      class="w-full h-9 px-3 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500">
                <option value="សកម្ម" ${(teacher?.status === 'សកម្ម' || teacher?.status === 'Active' || !teacher) ? 'selected' : ''}>${isKm ? 'សកម្ម (Active)' : 'Active'}</option>
                <option value="ទំនេរគ្មានបៀវត្ស" ${teacher?.status === 'ទំនេរគ្មានបៀវត្ស' ? 'selected' : ''}>${isKm ? 'ទំនេរគ្មានបៀវត្ស' : 'On Leave (Unpaid)'}</option>
                <option value="ផ្ទេរចេញ" ${teacher?.status === 'ផ្ទេរចេញ' ? 'selected' : ''}>${isKm ? 'ផ្ទេរចេញ' : 'Transferred Out'}</option>
                <option value="ចូលនិវត្តន៍" ${teacher?.status === 'ចូលនិវត្តន៍' ? 'selected' : ''}>${isKm ? 'ចូលនិវត្តន៍' : 'Retired'}</option>
              </select>
            </div>
          </div>

          <!-- Note / Remarks -->
          <div class="pt-3 border-t border-border">
            <label class="block text-xs font-semibold text-foreground mb-1">
              ${isKm ? 'កំណត់ចំណាំផ្សេងៗ' : 'Office Notes / Remarks'}
            </label>
            <textarea id="officer-notes" rows="2"
                      placeholder="${isKm ? 'បញ្ចូលកំណត់ចំណាំរដ្ឋបាលបន្ថែម...' : 'Additional office remarks...'}"
                      class="w-full p-2.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none">${teacher?.notes || ''}</textarea>
          </div>
        </form>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/20">
          <span class="text-[11px] text-muted-foreground flex items-center gap-1.5">
            ${getIcon('lock', 'w-3.5 h-3.5 text-teal-600')}
            <span>${isKm ? 'ទម្រង់ផ្ទាល់ខ្លួនរបស់ Officer' : 'Dedicated Officer Form'}</span>
          </span>
          <div class="flex items-center gap-2">
            <button id="btn-officer-modal-cancel" type="button" class="px-4 py-2 rounded-md border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer">
              ${t('common.cancel')}
            </button>
            <button id="btn-officer-modal-submit" type="button" class="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer">
              ${getIcon('check', 'w-4 h-4')}
              <span>${isEdit ? (isKm ? 'រក្សាទុកការកែប្រែ' : 'Update Teacher') : (isKm ? 'រក្សាទុកគ្រូថ្មី' : 'Save Teacher')}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
      overlay.classList.add('animate-fade-out');
      setTimeout(() => overlay.remove(), 150);
    };

    // Close handlers
    overlay.querySelector('#btn-officer-modal-close')?.addEventListener('click', closeModal);
    overlay.querySelector('#btn-officer-modal-cancel')?.addEventListener('click', closeModal);

    // Photo input handling
    const photoInput = overlay.querySelector('#officer-photo-input');
    const photoBox = overlay.querySelector('#officer-photo-box');
    const photoTrigger = overlay.querySelector('#btn-officer-photo-trigger');
    const photoPreview = overlay.querySelector('#officer-photo-preview');
    const photoPlaceholder = overlay.querySelector('#officer-photo-placeholder');

    const handlePhotoSelect = (file) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error(isKm ? 'សូមជ្រើសរើសឯកសាររូបភាពត្រឹមត្រូវ' : 'Please select a valid image file');
        return;
      }
      tempBlob = file;
      const url = URL.createObjectURL(file);
      photoPreview.src = url;
      photoPreview.classList.remove('hidden');
      photoPlaceholder.classList.add('hidden');
      photoTrigger.textContent = isKm ? 'ប្តូររូបថត' : 'Change';
    };

    photoBox?.addEventListener('click', () => photoInput?.click());
    photoTrigger?.addEventListener('click', () => photoInput?.click());
    photoInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handlePhotoSelect(file);
    });

    // Submit handler
    overlay.querySelector('#btn-officer-modal-submit')?.addEventListener('click', async () => {
      const form = overlay.querySelector('#officer-teacher-form');
      if (!form.reportValidity()) return;

      const teacherId = overlay.querySelector('#officer-teacher-id')?.value.trim();
      const lastNameKhmer = overlay.querySelector('#officer-last-name-km')?.value.trim();
      const firstNameKhmer = overlay.querySelector('#officer-first-name-km')?.value.trim();

      if (!teacherId || !lastNameKhmer || !firstNameKhmer) {
        toast.error(isKm ? 'សូមបំពេញព័ត៌មានដែលចាំបាច់ (*) ឱ្យបានគ្រប់គ្រាន់' : 'Please fill all required fields (*)');
        return;
      }

      const payload = {
        teacherId,
        civilServantId: overlay.querySelector('#officer-civil-servant-id')?.value.trim() || '',
        lastNameKhmer,
        firstNameKhmer,
        lastNameLatin: overlay.querySelector('#officer-last-name-en')?.value.trim().toUpperCase() || '',
        firstNameLatin: overlay.querySelector('#officer-first-name-en')?.value.trim().toUpperCase() || '',
        gender: overlay.querySelector('#officer-gender')?.value || 'ប្រុស',
        dob: overlay.querySelector('#officer-dob')?.value || '',
        phone: overlay.querySelector('#officer-phone')?.value.trim() || '',
        position: overlay.querySelector('#officer-position')?.value.trim() || '',
        subject1: overlay.querySelector('#officer-subject')?.value.trim() || '',
        status: overlay.querySelector('#officer-status')?.value || 'សកម្ម',
        notes: overlay.querySelector('#officer-notes')?.value.trim() || ''
      };

      if (tempBlob) {
        payload.photoBlob = tempBlob;
      }

      const submitBtn = overlay.querySelector('#btn-officer-modal-submit');
      submitBtn.disabled = true;

      try {
        if (isEdit) {
          await TeacherService.update(teacher.id, payload);
          toast.success(isKm ? 'បានកែប្រែព័ត៌មានគ្រូបង្រៀនដោយជោគជ័យ' : 'Teacher updated successfully!');
        } else {
          await TeacherService.create(payload);
          toast.success(isKm ? 'បានបញ្ចូលគ្រូបង្រៀនថ្មីដោយជោគជ័យ' : 'Teacher created successfully!');
        }
        closeModal();
        if (onSave) await onSave();
      } catch (err) {
        toast.error(err.message || 'Error saving teacher');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
};
