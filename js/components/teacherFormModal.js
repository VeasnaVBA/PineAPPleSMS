/**
 * Unified 44-Field Teacher Form Modal Component
 * Matches official MoEYS civil servant structure with live DOB -> Age & Retirement Date engine
 * and interactive, customizable dropdowns (Add/Delete/Select) for:
 * - Birthplace & Current Residence (Villages, Communes, Districts, Provinces)
 * - Civil Service & Rank (Work Status, Framework, Rank & Grade, Position, Training Level, Specializations, Degrees, Degree Majors, Task Assignment, Additional Duties)
 * - Teaching Load (Subjects 1, 2, 3)
 */

import { TeacherService, calculateAge, calculateRetirementDate, toInputDateFormat } from '../services/teacherService.js';
import { StudentService } from '../services/studentService.js';
import { LocationService } from '../services/locationService.js';
import { TeacherCatalogService } from '../services/teacherCatalogService.js';
import { photoService } from '../services/photoService.js';
import { Modal } from './modal.js';
import { toast } from './toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from './icons.js';

function openDeleteCatalogConfirm({ title, message, isKm, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in';
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

export const TeacherFormModal = {
  /**
   * Open the unified 44-field teacher modal form
   * @param {Object} options
   * @param {Object} [options.teacher=null] - Existing teacher record (if editing)
   * @param {Function} options.onSave - Callback when saved
   */
  async open({ teacher = null, onSave }) {
    const isEdit = !!teacher;
    const isKm = i18n.getLocale() === 'km';
    const title = isEdit ? (isKm ? 'កែប្រែព័ត៌មានគ្រូបង្រៀន' : 'Edit Teacher Profile') : (isKm ? 'បន្ថែមគ្រូបង្រៀនថ្មី' : 'Add New Teacher');

    let tempBlob = teacher?.photoBlob || null;
    let previewUrl = tempBlob ? photoService.getUrlForBlob(tempBlob) : (teacher?.photo && teacher.photo.startsWith('data:') ? teacher.photo : null);

    // Harvest existing locations and teacher catalogs
    try {
      const allTeachers = await TeacherService.getAll();
      await LocationService.harvestFromTeachers(allTeachers);
      await TeacherCatalogService.harvestFromTeachers(allTeachers);
      const allStudents = await StudentService.getAll();
      await LocationService.harvestFromStudents(allStudents);
    } catch (_) {}

    const locationsData = await LocationService.getAll();
    const teacherCatalogs = await TeacherCatalogService.getAll();

    // Pre-calculate age & retirement if editing
    const rawDob = teacher?.dob || teacher?.dateOfBirth || '';
    const initialDob = toInputDateFormat(rawDob);
    const initialAge = rawDob ? calculateAge(rawDob) : (teacher?.age || '');
    const initialRetirement = rawDob ? calculateRetirementDate(rawDob) : (teacher?.retirementDate ? toInputDateFormat(teacher.retirementDate) : '');

    // Universal Dropdown Renderer (Supports 'location' or 'teacher' catalogs)
    const renderCustomDropdown = ({ fieldId, label, type = 'teacher', category, currentValue, placeholder }) => {
      const dataSource = type === 'location' ? locationsData : teacherCatalogs;
      const allItems = dataSource[category] || [];
      const trimmedVal = (currentValue || '').trim();

      return `
        <div class="custom-catalog-dropdown relative flex flex-col space-y-1" data-type="${type}" data-category="${category}" data-field-id="${fieldId}">
          <label class="block text-[11px] font-medium text-muted-foreground ${isKm ? 'font-khmer' : ''}">
            ${label}
          </label>
          
          <input type="hidden" id="${fieldId}" value="${trimmedVal}" />

          <div class="dropdown-trigger h-10 px-3.5 py-2 rounded-lg border border-input bg-background flex items-center justify-between text-xs sm:text-sm cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-all shadow-2xs">
            <span class="selected-text truncate ${!trimmedVal ? 'text-muted-foreground font-normal' : 'font-medium text-foreground ' + (isKm ? 'font-khmer' : '')}">
              ${trimmedVal || t('locations.selectPrompt')}
            </span>
            <div class="flex items-center gap-1 ml-2 text-muted-foreground flex-shrink-0">
              ${getIcon('chevronDown', 'w-4 h-4 transition-transform duration-200 trigger-chevron')}
            </div>
          </div>

          <div class="dropdown-menu hidden absolute left-0 right-0 w-full top-[calc(100%+2px)] z-[90] bg-popover border border-border rounded-lg shadow-lg flex flex-col overflow-hidden animate-slide-down">
            <div class="p-1.5 border-b border-border bg-muted/40 flex items-center gap-1.5">
              <input type="text" style="height: 32px; box-sizing: border-box;" class="input-new-item flex-1 min-w-0 h-8 px-2.5 py-0 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${isKm ? 'font-khmer' : ''}" placeholder="${placeholder}" />
              <button type="button" style="height: 32px; box-sizing: border-box;" class="btn-add-item h-8 px-3 py-0 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shadow-xs flex-shrink-0 cursor-pointer ${isKm ? 'font-khmer' : ''}">
                ${getIcon('plus', 'w-3.5 h-3.5')}
                <span>${isKm ? 'បន្ថែម' : 'Add'}</span>
              </button>
            </div>

            <div class="items-list overflow-y-auto p-1 max-h-48 divide-y divide-border/20">
              <div class="item-row flex items-center px-2.5 py-1 rounded hover:bg-accent text-xs text-muted-foreground italic cursor-pointer transition-colors" data-value="">
                <span>${t('locations.selectPrompt')}</span>
              </div>
              ${allItems.map(opt => `
                <div class="item-row flex items-center justify-between px-2.5 py-1 rounded hover:bg-accent text-xs text-foreground group cursor-pointer transition-colors ${trimmedVal.toLowerCase() === opt.toLowerCase() ? 'bg-primary/10 font-semibold text-primary' : ''}" data-value="${opt}">
                  <span class="item-label truncate pr-1.5 ${isKm ? 'font-khmer' : ''}">${opt}</span>
                  <button type="button" class="btn-delete-item p-1 rounded opacity-50 hover:opacity-100 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 cursor-pointer" title="${t('locations.delete')}" data-value="${opt}">
                    ${getIcon('trash', 'w-3 h-3')}
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    };

    const modalContent = `
      <form id="unified-teacher-form" class="space-y-6 text-xs sm:text-sm">
        
        <!-- ផ្នែកទី ១: ព័ត៌មានអត្តសញ្ញាណ និងផ្ទាល់ខ្លួន -->
        <div class="p-4 sm:p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-border text-foreground font-bold">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('user', 'w-4 h-4')}</span>
            <span>${isKm ? 'ផ្នែកទី ១: ព័ត៌មានអត្តសញ្ញាណ និងផ្ទាល់ខ្លួន' : 'Section 1: Identity & Personal Information'}</span>
          </div>

          <!-- Photo Uploader -->
          <div class="p-3.5 rounded-lg border border-dashed border-border bg-muted/20 flex items-center gap-4">
            <div id="t-form-photo-preview" class="w-16 h-20 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center flex-shrink-0 shadow-2xs">
              ${previewUrl 
                ? `<img src="${previewUrl}" class="w-full h-full object-cover" />` 
                : `<span class="text-muted-foreground">${getIcon('user', 'w-7 h-7')}</span>`}
            </div>
            <div class="flex-1 min-w-0 space-y-1">
              <p class="text-xs font-semibold text-foreground">${isKm ? 'រូបថតគ្រូបង្រៀន' : 'Teacher Photo'}</p>
              <p class="text-[11px] text-muted-foreground">${isKm ? 'ទំហំ 4x6 ឬរូបថតផ្ទាល់ខ្លួន' : 'Standard 4x6 passport size or portrait'}</p>
              <div class="flex items-center gap-2 pt-1">
                <label class="cursor-pointer px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium shadow-xs hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5">
                  ${getIcon('upload', 'w-3.5 h-3.5')}
                  <span>${isKm ? 'ជ្រើសរើសរូបថត' : 'Upload Photo'}</span>
                  <input type="file" id="t-form-photo-input" accept="image/*" class="hidden" />
                </label>
                <button type="button" id="t-form-photo-remove" class="px-2.5 py-1.5 rounded-md border border-border hover:bg-muted text-xs text-muted-foreground ${previewUrl ? '' : 'hidden'}">
                  ${isKm ? 'លុបរូប' : 'Remove'}
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            <!-- 1. Status -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">${isKm ? 'ស្ថានភាព' : 'Status'}</label>
              <select id="form-t-status" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring">
                <option value="Active" ${(teacher?.status || 'Active') === 'Active' ? 'selected' : ''}>${isKm ? 'សកម្ម' : 'Active'}</option>
                <option value="On Leave" ${teacher?.status === 'On Leave' ? 'selected' : ''}>${isKm ? 'ទំនេរគ្មានបៀវត្ស' : 'On Leave'}</option>
                <option value="Transferred" ${teacher?.status === 'Transferred' ? 'selected' : ''}>${isKm ? 'ផ្ទេរចេញ' : 'Transferred'}</option>
                <option value="Retired" ${teacher?.status === 'Retired' ? 'selected' : ''}>${isKm ? 'ចូលនិវត្តន៍' : 'Retired'}</option>
                <option value="Inactive" ${teacher?.status === 'Inactive' ? 'selected' : ''}>${isKm ? 'អសកម្ម' : 'Inactive'}</option>
              </select>
            </div>

            <!-- 2. Teacher ID -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'លេខសម្គាល់គ្រូ' : 'Teacher ID'} <span class="text-destructive">*</span>
              </label>
              <input type="text" id="form-t-teacherId" required value="${teacher?.teacherId || ''}" placeholder="TCH-001" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring" />
            </div>

            <!-- 3. Civil Servant ID -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'អត្តលេខមន្ត្រីរាជការ' : 'Civil Servant ID'}
              </label>
              <input type="text" id="form-t-civilServantId" value="${teacher?.civilServantId || ''}" placeholder="19900100234" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring" />
            </div>

            <!-- 4. National ID -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'លេខអត្តសញ្ញាណប័ណ្ណ' : 'National ID'}
              </label>
              <input type="text" id="form-t-nationalId" value="${teacher?.nationalId || ''}" placeholder="010234567" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring" />
            </div>

            <!-- Bank Account Number -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'លេខគណនីធនាគារ' : 'Bank Account Number'}
              </label>
              <input type="text" id="form-t-bankAccount" value="${teacher?.bankAccount || ''}" placeholder="0300-03216893-13" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring" />
            </div>

            <!-- 5. Khmer Surname -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'ត្រកូល' : 'Khmer Surname'} <span class="text-destructive">*</span>
              </label>
              <input type="text" id="form-t-lastNameKhmer" required value="${teacher?.lastNameKhmer || teacher?.lastNameKh || ''}" placeholder="សុក" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-khmer text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring" />
            </div>

            <!-- 6. Khmer First Name -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'នាមខ្លួន' : 'Khmer First Name'} <span class="text-destructive">*</span>
              </label>
              <input type="text" id="form-t-firstNameKhmer" required value="${teacher?.firstNameKhmer || teacher?.firstNameKh || ''}" placeholder="សុផល" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-khmer text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring" />
            </div>

            <!-- 7. Latin Surname -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'ត្រកូលឡាតាំង' : 'Latin Surname'}
              </label>
              <input type="text" id="form-t-lastNameLatin" value="${teacher?.lastNameLatin || ''}" placeholder="SOK" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background uppercase text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring" />
            </div>

            <!-- 8. Latin First Name -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'នាមខ្លួនឡាតាំង' : 'Latin First Name'}
              </label>
              <input type="text" id="form-t-firstNameLatin" value="${teacher?.firstNameLatin || ''}" placeholder="Sophal" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring" />
            </div>

            <!-- 9. Gender -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">${isKm ? 'ភេទ' : 'Gender'}</label>
              <select id="form-t-gender" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring">
                <option value="Male" ${(teacher?.gender || 'Male') === 'Male' ? 'selected' : ''}>${isKm ? 'ប្រុស' : 'Male'}</option>
                <option value="Female" ${teacher?.gender === 'Female' ? 'selected' : ''}>${isKm ? 'ស្រី' : 'Female'}</option>
              </select>
            </div>

            <!-- 10. Date of Birth -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'ថ្ងៃខែឆ្នាំកំណើត' : 'Date of Birth'} <span class="text-destructive">*</span>
              </label>
              <input type="date" id="form-t-dob" required value="${initialDob}" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring" />
            </div>

            <!-- 11. Age (Auto-computed) -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'អាយុ (គណនាស្វ័យប្រវត្តិ)' : 'Age (Auto-computed)'}
              </label>
              <input type="text" id="form-t-age" readonly value="${initialAge}" placeholder="—" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-muted text-xs sm:text-sm text-foreground font-mono font-bold cursor-not-allowed" />
            </div>
          </div>
        </div>

        <!-- ផ្នែកទី ២: ទីកន្លែងកំណើត និងអាសយដ្ឋានបច្ចុប្បន្ន (Birthplace & Current Address Dropdowns) -->
        <div class="p-4 sm:p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-border text-foreground font-bold">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('school', 'w-4 h-4')}</span>
            <span>${isKm ? 'ផ្នែកទី ២: ទីកន្លែងកំណើត និងអាសយដ្ឋានបច្ចុប្បន្ន' : 'Section 2: Birthplace & Current Address'}</span>
          </div>

          <!-- Birthplace Sub-grid -->
          <div class="space-y-2">
            <h5 class="text-xs font-semibold text-primary uppercase tracking-wider">${isKm ? 'ទីកន្លែងកំណើត' : 'Place of Birth'}</h5>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              ${renderCustomDropdown({
                fieldId: 'form-t-birthVillage',
                label: isKm ? 'ភូមិកំណើត' : 'Birth Village',
                type: 'location',
                category: 'villages',
                currentValue: teacher?.birthVillage || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះភូមិថ្មី...' : 'New village name...'
              })}
              ${renderCustomDropdown({
                fieldId: 'form-t-birthCommune',
                label: isKm ? 'ឃុំ/សង្កាត់កំណើត' : 'Birth Commune',
                type: 'location',
                category: 'communes',
                currentValue: teacher?.birthCommune || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះឃុំថ្មី...' : 'New commune name...'
              })}
              ${renderCustomDropdown({
                fieldId: 'form-t-birthDistrict',
                label: isKm ? 'ស្រុក/ខណ្ឌកំណើត' : 'Birth District',
                type: 'location',
                category: 'districts',
                currentValue: teacher?.birthDistrict || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះស្រុកថ្មី...' : 'New district name...'
              })}
              ${renderCustomDropdown({
                fieldId: 'form-t-birthProvince',
                label: isKm ? 'ខេត្ត/រាជធានីកំណើត' : 'Birth Province',
                type: 'location',
                category: 'provinces',
                currentValue: teacher?.birthProvince || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះខេត្តថ្មី...' : 'New province name...'
              })}
            </div>
          </div>

          <!-- Current Address Sub-grid -->
          <div class="space-y-2 pt-2 border-t border-border/50">
            <h5 class="text-xs font-semibold text-primary uppercase tracking-wider">${isKm ? 'អាសយដ្ឋានបច្ចុប្បន្ន' : 'Current Residence'}</h5>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              ${renderCustomDropdown({
                fieldId: 'form-t-currentVillage',
                label: isKm ? 'ភូមិបច្ចុប្បន្ន' : 'Current Village',
                type: 'location',
                category: 'villages',
                currentValue: teacher?.currentVillage || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះភូមិថ្មី...' : 'New village name...'
              })}
              ${renderCustomDropdown({
                fieldId: 'form-t-currentCommune',
                label: isKm ? 'ឃុំ/សង្កាត់បច្ចុប្បន្ន' : 'Current Commune',
                type: 'location',
                category: 'communes',
                currentValue: teacher?.currentCommune || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះឃុំថ្មី...' : 'New commune name...'
              })}
              ${renderCustomDropdown({
                fieldId: 'form-t-currentDistrict',
                label: isKm ? 'ស្រុក/ខណ្ឌបច្ចុប្បន្ន' : 'Current District',
                type: 'location',
                category: 'districts',
                currentValue: teacher?.currentDistrict || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះស្រុកថ្មី...' : 'New district name...'
              })}
              ${renderCustomDropdown({
                fieldId: 'form-t-currentProvince',
                label: isKm ? 'ខេត្ត/រាជធានីបច្ចុប្បន្ន' : 'Current Province',
                type: 'location',
                category: 'provinces',
                currentValue: teacher?.currentProvince || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះខេត្តថ្មី...' : 'New province name...'
              })}
            </div>
          </div>
        </div>

        <!-- ផ្នែកទី ៣: ក្របខណ្ឌ មុខតំណែង និងកម្រិតបណ្តុះបណ្តាល (Civil Service Dropdowns) -->
        <div class="p-4 sm:p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-border text-foreground font-bold">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('graduationCap', 'w-4 h-4')}</span>
            <span>${isKm ? 'ផ្នែកទី ៣: ក្របខណ្ឌ មុខតំណែង និងកម្រិតបណ្តុះបណ្តាល' : 'Section 3: Civil Service Framework & Position'}</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            <!-- Joined Date -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'ថ្ងៃចូលបម្រើការងារ' : 'Date Joined'}
              </label>
              <input type="date" id="form-t-joinedDate" value="${toInputDateFormat(teacher?.joinedDate)}" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
            </div>

            <!-- Permanent Civil Servant Appointment Date -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'ថ្ងៃតាំងស៊ប់ក្នុងក្របខណ្ឌ' : 'Permanent Appointment Date'}
              </label>
              <input type="date" id="form-t-permanentAppointmentDate" value="${toInputDateFormat(teacher?.permanentAppointmentDate)}" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
            </div>

            <!-- Retirement Date (Auto-computed) -->
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">
                ${isKm ? 'ថ្ងៃចូលនិវត្តន៍ (៦០ ឆ្នាំ)' : 'Retirement Date (Age 60)'}
              </label>
              <input type="date" id="form-t-retirementDate" readonly value="${initialRetirement}" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-muted text-xs sm:text-sm text-foreground font-mono font-bold cursor-not-allowed" />
            </div>

            <!-- 1. Work Status Dropdown -->
            ${renderCustomDropdown({
              fieldId: 'form-t-workStatus',
              label: isKm ? 'ស្ថានភាពការងារ' : 'Work Status',
              type: 'teacher',
              category: 'workStatuses',
              currentValue: teacher?.workStatus || '',
              placeholder: isKm ? 'បញ្ចូលស្ថានភាពការងារថ្មី...' : 'New work status...'
            })}

            <!-- 2. Framework Dropdown -->
            ${renderCustomDropdown({
              fieldId: 'form-t-framework',
              label: isKm ? 'ក្របខណ្ឌ' : 'Framework',
              type: 'teacher',
              category: 'frameworks',
              currentValue: teacher?.framework || '',
              placeholder: isKm ? 'បញ្ចូលក្របខណ្ឌថ្មី...' : 'New framework...'
            })}

            <!-- 3. Rank & Grade Dropdown -->
            ${renderCustomDropdown({
              fieldId: 'form-t-rankAndGrade',
              label: isKm ? 'ឋានន្តរស័ក្តិ និងថ្នាក់' : 'Rank & Grade',
              type: 'teacher',
              category: 'rankAndGrades',
              currentValue: teacher?.rankAndGrade || '',
              placeholder: isKm ? 'បញ្ចូលឋានន្តរស័ក្តិ/ថ្នាក់ថ្មី...' : 'New rank & grade...'
            })}

            <!-- 4. Position Dropdown -->
            ${renderCustomDropdown({
              fieldId: 'form-t-position',
              label: isKm ? 'មុខតំណែង' : 'Position',
              type: 'teacher',
              category: 'positions',
              currentValue: teacher?.position || '',
              placeholder: isKm ? 'បញ្ចូលមុខតំណែងថ្មី...' : 'New position...'
            })}

            <!-- 5. Training Level Dropdown -->
            ${renderCustomDropdown({
              fieldId: 'form-t-trainingLevel',
              label: isKm ? 'កម្រិតបណ្តុះបណ្តាល' : 'Training Level',
              type: 'teacher',
              category: 'trainingLevels',
              currentValue: teacher?.trainingLevel || '',
              placeholder: isKm ? 'បញ្ចូលកម្រិតបណ្តុះបណ្តាលថ្មី...' : 'New training level...'
            })}

            <!-- 6. Specialization 1 Dropdown -->
            ${renderCustomDropdown({
              fieldId: 'form-t-specialization1',
              label: isKm ? 'ឯកទេសទី១' : 'Specialization 1',
              type: 'teacher',
              category: 'specializations',
              currentValue: teacher?.specialization1 || '',
              placeholder: isKm ? 'បញ្ចូលឯកទេសថ្មី...' : 'New specialization...'
            })}

            <!-- 7. Specialization 2 Dropdown -->
            ${renderCustomDropdown({
              fieldId: 'form-t-specialization2',
              label: isKm ? 'ឯកទេសទី២' : 'Specialization 2',
              type: 'teacher',
              category: 'specializations',
              currentValue: teacher?.specialization2 || '',
              placeholder: isKm ? 'បញ្ចូលឯកទេសថ្មី...' : 'New specialization...'
            })}

            <!-- 8. Highest Degree Dropdown -->
            ${renderCustomDropdown({
              fieldId: 'form-t-highestDegree',
              label: isKm ? 'សញ្ញាបត្រចុងក្រោយ' : 'Highest Degree',
              type: 'teacher',
              category: 'degrees',
              currentValue: teacher?.highestDegree || '',
              placeholder: isKm ? 'បញ្ចូលសញ្ញាបត្រថ្មី...' : 'New degree...'
            })}

            <!-- 9. Degree Major Dropdown -->
            ${renderCustomDropdown({
              fieldId: 'form-t-highestDegreeMajor',
              label: isKm ? 'ឯកទេសសញ្ញាបត្រ' : 'Degree Major',
              type: 'teacher',
              category: 'degreeMajors',
              currentValue: teacher?.highestDegreeMajor || '',
              placeholder: isKm ? 'បញ្ចូលឯកទេសសញ្ញាបត្រថ្មី...' : 'New degree major...'
            })}

            <!-- 10. Task Assignment Dropdown -->
            ${renderCustomDropdown({
              fieldId: 'form-t-taskAssignment',
              label: isKm ? 'បំណែងចែកភារកិច្ច' : 'Task Assignment',
              type: 'teacher',
              category: 'taskAssignments',
              currentValue: teacher?.taskAssignment || '',
              placeholder: isKm ? 'បញ្ចូលបំណែងចែកភារកិច្ចថ្មី...' : 'New task assignment...'
            })}

            <!-- 11. Additional Duties Dropdown (Span full on large) -->
            <div class="sm:col-span-2 md:col-span-3">
              ${renderCustomDropdown({
                fieldId: 'form-t-additionalDuties',
                label: isKm ? 'ភារកិច្ចបន្ថែម' : 'Additional Duties',
                type: 'teacher',
                category: 'additionalDuties',
                currentValue: teacher?.additionalDuties || '',
                placeholder: isKm ? 'បញ្ចូលភារកិច្ចបន្ថែមថ្មី...' : 'New additional duty...'
              })}
            </div>
          </div>

          <!-- General Education Sub-block -->
          <div class="pt-3 border-t border-border/50 space-y-2">
            <h5 class="text-xs font-semibold text-primary uppercase tracking-wider">${isKm ? 'កម្រិតវប្បធម៌ទូទៅ (General Education History)' : 'General Education History'}</h5>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'កម្រិតវប្បធម៌ទូទៅ' : 'General Edu Level'}</label>
                <input type="text" id="form-t-generalEducationLevel" value="${teacher?.generalEducationLevel || ''}" placeholder="បរិញ្ញាបត្រ / បាក់ឌុប" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'គ្រឹះស្ថានសិក្សា/ទីកន្លែងសិក្សា' : 'School / Institution'}</label>
                <input type="text" id="form-t-generalEducationSchool" value="${teacher?.generalEducationSchool || ''}" placeholder="សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
              </div>
              <div>
                <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'សញ្ញាបត្រទទួលបាន' : 'Degree Obtained'}</label>
                <input type="text" id="form-t-generalEducationDegree" value="${teacher?.generalEducationDegree || ''}" placeholder="បរិញ្ញាបត្រ" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
              </div>
              <div class="grid grid-cols-2 gap-1.5 md:col-span-1">
                <div>
                  <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'ចូលរៀន' : 'Start'}</label>
                  <input type="date" id="form-t-generalEducationStart" value="${toInputDateFormat(teacher?.generalEducationStart)}" class="w-full h-10 px-1.5 py-2 rounded-md border border-input bg-background text-[11px] text-foreground" />
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'បញ្ចប់' : 'End'}</label>
                  <input type="date" id="form-t-generalEducationEnd" value="${toInputDateFormat(teacher?.generalEducationEnd)}" class="w-full h-10 px-1.5 py-2 rounded-md border border-input bg-background text-[11px] text-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ផ្នែកទី ៤: បន្ទុកបង្រៀន និងម៉ោងបង្រៀនប្រចាំសប្តាហ៍ -->
        <div class="p-4 sm:p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-border text-foreground font-bold">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('clipboardList', 'w-4 h-4')}</span>
            <span>${isKm ? 'ផ្នែកទី ៤: បន្ទុកបង្រៀន និងម៉ោងបង្រៀនប្រចាំសប្តាហ៍' : 'Section 4: Teaching Subjects & Weekly Load'}</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            <!-- Subject 1 & Hours -->
            <div class="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
              <span class="font-bold text-xs text-primary">${isKm ? 'មុខវិជ្ជាទី១' : 'Subject 1'}</span>
              ${renderCustomDropdown({
                fieldId: 'form-t-subject1',
                label: isKm ? 'ឈ្មោះមុខវិជ្ជា' : 'Subject Name',
                type: 'teacher',
                category: 'subjects',
                currentValue: teacher?.subject1 || teacher?.subject || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះមុខវិជ្ជាថ្មី...' : 'New subject...'
              })}
              <div>
                <label class="block text-[11px] text-muted-foreground mb-1">${isKm ? 'ម៉ោងក្នុងមួយសប្តាហ៍' : 'Hours/Week'}</label>
                <input type="number" id="form-t-hours1" min="0" max="60" value="${teacher?.hoursPerWeek1 !== undefined ? teacher.hoursPerWeek1 : ''}" placeholder="18" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs sm:text-sm text-foreground" />
              </div>
            </div>

            <!-- Subject 2 & Hours -->
            <div class="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
              <span class="font-bold text-xs text-primary">${isKm ? 'មុខវិជ្ជាទី២' : 'Subject 2'}</span>
              ${renderCustomDropdown({
                fieldId: 'form-t-subject2',
                label: isKm ? 'ឈ្មោះមុខវិជ្ជា' : 'Subject Name',
                type: 'teacher',
                category: 'subjects',
                currentValue: teacher?.subject2 || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះមុខវិជ្ជាថ្មី...' : 'New subject...'
              })}
              <div>
                <label class="block text-[11px] text-muted-foreground mb-1">${isKm ? 'ម៉ោងក្នុងមួយសប្តាហ៍' : 'Hours/Week'}</label>
                <input type="number" id="form-t-hours2" min="0" max="60" value="${teacher?.hoursPerWeek2 !== undefined ? teacher.hoursPerWeek2 : ''}" placeholder="6" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs sm:text-sm text-foreground" />
              </div>
            </div>

            <!-- Subject 3 & Hours -->
            <div class="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
              <span class="font-bold text-xs text-primary">${isKm ? 'មុខវិជ្ជាទី៣' : 'Subject 3'}</span>
              ${renderCustomDropdown({
                fieldId: 'form-t-subject3',
                label: isKm ? 'ឈ្មោះមុខវិជ្ជា' : 'Subject Name',
                type: 'teacher',
                category: 'subjects',
                currentValue: teacher?.subject3 || '',
                placeholder: isKm ? 'បញ្ចូលឈ្មោះមុខវិជ្ជាថ្មី...' : 'New subject...'
              })}
              <div>
                <label class="block text-[11px] text-muted-foreground mb-1">${isKm ? 'ម៉ោងក្នុងមួយសប្តាហ៍' : 'Hours/Week'}</label>
                <input type="number" id="form-t-hours3" min="0" max="60" value="${teacher?.hoursPerWeek3 !== undefined ? teacher.hoursPerWeek3 : ''}" placeholder="0" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs sm:text-sm text-foreground" />
              </div>
            </div>
          </div>
        </div>

        <!-- ផ្នែកទី ៥: ព័ត៌មានទំនាក់ទំនង និងផ្សេងៗ -->
        <div class="p-4 sm:p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-border text-foreground font-bold">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('contact2', 'w-4 h-4')}</span>
            <span>${isKm ? 'ផ្នែកទី ៥: ព័ត៌មានទំនាក់ទំនង និងផ្សេងៗ' : 'Section 5: Contact & Additional Notes'}</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            <div>
              <label class="block text-xs font-medium text-foreground mb-1">${isKm ? 'លេខទូរសព្ទទី១' : 'Phone 1'}</label>
              <input type="tel" id="form-t-phone1" value="${teacher?.phone1 || teacher?.phone || ''}" placeholder="012 345 678" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs sm:text-sm text-foreground" />
            </div>

            <div>
              <label class="block text-xs font-medium text-foreground mb-1">${isKm ? 'លេខទូរសព្ទទី២' : 'Phone 2'}</label>
              <input type="tel" id="form-t-phone2" value="${teacher?.phone2 || ''}" placeholder="098 765 432" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs sm:text-sm text-foreground" />
            </div>

            <div>
              <label class="block text-xs font-medium text-foreground mb-1">${isKm ? 'តេឡេក្រាម' : 'Telegram'}</label>
              <input type="text" id="form-t-telegram" value="${teacher?.telegram || ''}" placeholder="${isKm ? 'ឈ្មោះ ឬ លេខទូរសព្ទ' : '@username or phone'}" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
            </div>

            <div>
              <label class="block text-xs font-medium text-foreground mb-1">${isKm ? 'អ៊ីមែល' : 'Email'}</label>
              <input type="email" id="form-t-email" value="${teacher?.email || ''}" placeholder="teacher@school.edu.kh" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
            </div>

            <div class="sm:col-span-2 md:col-span-4">
              <label class="block text-xs font-medium text-foreground mb-1">${isKm ? 'ផ្សេងៗ' : 'Notes'}</label>
              <textarea id="form-t-notes" rows="2" placeholder="${isKm ? 'ចំណាំផ្សេងៗ...' : 'Additional notes...'}" class="w-full p-3 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus:ring-1 focus:ring-ring">${teacher?.notes || ''}</textarea>
            </div>
          </div>
        </div>

        <!-- ផ្នែកទី ៦: ព័ត៌មានគ្រួសារ (Spouse & Children Details) -->
        <div class="p-4 sm:p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-border text-foreground font-bold">
            <span class="p-1 rounded bg-primary/10 text-primary">${getIcon('users', 'w-4 h-4')}</span>
            <span>${isKm ? 'ផ្នែកទី ៦: ព័ត៌មានគ្រួសារ (Spouse & Children Details)' : 'Section 6: Family & Spouse Profile'}</span>
          </div>

          <div class="space-y-4">
            <!-- Marital Status Selector -->
            <div class="p-3.5 rounded-lg bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label for="form-t-maritalStatus" class="block text-xs font-semibold text-foreground">${isKm ? 'ស្ថានភាពគ្រួសារ' : 'Marital Status'}</label>
                <p class="text-[11px] text-muted-foreground">${isKm ? 'ជ្រើសរើសដើម្បីបង្ហាញ ឬលាក់ព័ត៌មានប្តី/ប្រពន្ធ និងកូន' : 'Choose status to toggle spouse and children fields'}</p>
              </div>
              <div class="w-full sm:w-60">
                <select id="form-t-maritalStatus" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground font-medium focus:ring-2 focus:ring-primary">
                  <option value="Single" ${(teacher?.maritalStatus || (teacher?.spouseName ? 'Married' : 'Single')) === 'Single' ? 'selected' : ''}>${isKm ? 'នៅលីវ (Single)' : 'Single'}</option>
                  <option value="Married" ${(teacher?.maritalStatus || (teacher?.spouseName ? 'Married' : 'Single')) === 'Married' ? 'selected' : ''}>${isKm ? 'រៀបការរួច (Married)' : 'Married'}</option>
                  <option value="Divorced" ${teacher?.maritalStatus === 'Divorced' ? 'selected' : ''}>${isKm ? 'លែងលះ (Divorced)' : 'Divorced'}</option>
                  <option value="Widowed" ${teacher?.maritalStatus === 'Widowed' ? 'selected' : ''}>${isKm ? 'ពោះម៉ាយ / មេម៉ាយ (Widowed)' : 'Widowed'}</option>
                </select>
              </div>
            </div>

            <!-- Spouse & Children Sub-grid (Hidden when Single) -->
            <div id="spouse-children-container" class="space-y-4 transition-all duration-200 ${(teacher?.maritalStatus || (teacher?.spouseName ? 'Married' : 'Single')) === 'Single' ? 'hidden' : ''}">
              <!-- 1. Spouse Info -->
              <div class="space-y-2">
                <h5 class="text-xs font-semibold text-primary uppercase tracking-wider">${isKm ? 'ព័ត៌មានប្តី / ប្រពន្ធ' : 'Spouse Information'}</h5>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'ឈ្មោះប្តី/ប្រពន្ធ' : 'Spouse Name'}</label>
                    <input type="text" id="form-t-spouseName" value="${teacher?.spouseName || ''}" placeholder="${isKm ? 'ឈ្មោះប្តី/ប្រពន្ធ' : 'Spouse Name'}" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'ថ្ងៃខែឆ្នាំកំណើតប្តី/ប្រពន្ធ' : 'Spouse DOB'}</label>
                    <input type="date" id="form-t-spouseDob" value="${toInputDateFormat(teacher?.spouseDob)}" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'មុខរបរប្តី/ប្រពន្ធ' : 'Spouse Occupation'}</label>
                    <input type="text" id="form-t-spouseJob" value="${teacher?.spouseJob || ''}" placeholder="${isKm ? 'មុខរបរ...' : 'Occupation...'}" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
                  </div>
                  <div class="sm:col-span-2">
                    <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'អាសយដ្ឋានបច្ចុប្បន្នប្តី/ប្រពន្ធ' : 'Spouse Current Address'}</label>
                    <input type="text" id="form-t-spouseAddress" value="${teacher?.spouseAddress || ''}" placeholder="${isKm ? 'ភូមិ... ឃុំ... ស្រុក... ខេត្ត...' : 'Village... Commune... District... Province...'}" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'លេខទូរសព្ទប្តី/ប្រពន្ធ' : 'Spouse Phone'}</label>
                    <input type="tel" id="form-t-spousePhone" value="${teacher?.spousePhone || ''}" placeholder="012 345 678" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs sm:text-sm text-foreground" />
                  </div>
                </div>
              </div>

              <!-- 2. Children Count -->
              <div class="pt-3 border-t border-border/50 space-y-2">
                <h5 class="text-xs font-semibold text-primary uppercase tracking-wider">${isKm ? 'ចំនួនកូនក្នុងបន្ទុក' : 'Children Information'}</h5>
                <div>
                  <label class="block text-[11px] font-medium text-muted-foreground mb-1">${isKm ? 'ចំនួនកូនក្នុងបន្ទុក (ស្រី...នាក់, ប្រុស...នាក់)' : 'Children Count'}</label>
                  <input type="text" id="form-t-childrenCount" value="${teacher?.childrenCount || ''}" placeholder="២ នាក់ (ស្រី ១ នាក់, ប្រុស ១ នាក់)" class="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>

      </form>
    `;

    const footer = `
      <div class="flex items-center justify-end w-full gap-2">
        <button id="btn-t-modal-cancel" type="button" class="h-10 px-4 rounded-md border border-border bg-card hover:bg-muted text-xs sm:text-sm font-medium transition-colors cursor-pointer">
          ${t('common.cancel')}
        </button>
        <button id="btn-t-modal-save" type="button" class="h-10 px-5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer">
          ${getIcon('save', 'w-4 h-4')}
          <span>${t('common.save')}</span>
        </button>
      </div>
    `;

    const modal = Modal.open({
      title,
      content: modalContent,
      footer,
      maxWidth: 'max-w-4xl'
    });

    // 1. Live DOB Engine -> Age and Retirement Date Auto-calculation
    const dobInput = modal.element.querySelector('#form-t-dob');
    const ageInput = modal.element.querySelector('#form-t-age');
    const retirementInput = modal.element.querySelector('#form-t-retirementDate');

    const updateAgeAndRetirement = () => {
      const dobVal = dobInput?.value?.trim();
      if (dobVal) {
        const computedAge = calculateAge(dobVal);
        const computedRet = calculateRetirementDate(dobVal);
        if (ageInput) ageInput.value = computedAge !== '' ? computedAge : '—';
        if (retirementInput) retirementInput.value = computedRet || '';
      } else {
        if (ageInput) ageInput.value = '—';
        if (retirementInput) retirementInput.value = '';
      }
    };

    dobInput?.addEventListener('input', updateAgeAndRetirement);
    dobInput?.addEventListener('change', updateAgeAndRetirement);

    // 2. Custom Catalog Dropdown Sync & Event Delegation
    const syncCatalogDropdowns = (type, categoryToSync) => {
      const dataSource = type === 'location' ? locationsData : teacherCatalogs;
      modal.element.querySelectorAll(`.custom-catalog-dropdown[data-type="${type}"][data-category="${categoryToSync}"]`).forEach(dd => {
        const listContainer = dd.querySelector('.items-list');
        const fieldId = dd.getAttribute('data-field-id');
        const currentVal = dd.querySelector(`#${fieldId}`)?.value || '';
        const items = dataSource[categoryToSync] || [];

        if (listContainer) {
          listContainer.innerHTML = `
            <div class="item-row flex items-center px-2.5 py-1 rounded hover:bg-accent text-xs text-muted-foreground italic cursor-pointer transition-colors" data-value="">
              <span>${t('locations.selectPrompt')}</span>
            </div>
            ${items.map(opt => `
              <div class="item-row flex items-center justify-between px-2.5 py-1 rounded hover:bg-accent text-xs text-foreground group cursor-pointer transition-colors ${currentVal.toLowerCase() === opt.toLowerCase() ? 'bg-primary/10 font-semibold text-primary' : ''}" data-value="${opt}">
                <span class="item-label truncate pr-1.5 ${isKm ? 'font-khmer' : ''}">${opt}</span>
                <button type="button" class="btn-delete-item p-1 rounded opacity-50 hover:opacity-100 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 cursor-pointer" title="${t('locations.delete')}" data-value="${opt}">
                  ${getIcon('trash', 'w-3 h-3')}
                </button>
              </div>
            `).join('')}
          `;
        }
      });
    };

    modal.element.addEventListener('click', (e) => {
      // 1. Click Trigger -> Open/Close dropdown menu
      const trigger = e.target.closest('.dropdown-trigger');
      if (trigger) {
        e.stopPropagation();
        const dd = trigger.closest('.custom-catalog-dropdown');
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

      // 2. Click inside dropdown menu
      const menu = e.target.closest('.dropdown-menu');
      if (menu) {
        const dd = menu.closest('.custom-catalog-dropdown');
        const fieldId = dd?.getAttribute('data-field-id');
        const type = dd?.getAttribute('data-type');
        const category = dd?.getAttribute('data-category');
        const hiddenInput = dd?.querySelector(`#${fieldId}`);
        const triggerText = dd?.querySelector('.selected-text');
        const service = type === 'location' ? LocationService : TeacherCatalogService;
        const dataSource = type === 'location' ? locationsData : teacherCatalogs;

        // Delete button clicked
        const deleteBtn = e.target.closest('.btn-delete-item');
        if (deleteBtn) {
          e.stopPropagation();
          const valToDelete = deleteBtn.getAttribute('data-value');
          if (!valToDelete) return;

          openDeleteCatalogConfirm({
            title: t('locations.delete'),
            message: t('locations.confirmDelete').replace('{name}', valToDelete),
            isKm,
            onConfirm: async () => {
              const updated = await service.deleteItem(category, valToDelete);
              dataSource[category] = updated;
              syncCatalogDropdowns(type, category);
              toast.success(t('locations.deletedSuccess'));
            }
          });
          return;
        }

        // Add button clicked
        const addBtn = e.target.closest('.btn-add-item');
        if (addBtn) {
          e.stopPropagation();
          const input = menu.querySelector('.input-new-item');
          const valToAdd = input?.value?.trim();
          if (!valToAdd) return;
          (async () => {
            try {
              const updated = await service.addItem(category, valToAdd);
              dataSource[category] = updated;
              syncCatalogDropdowns(type, category);
              if (hiddenInput) hiddenInput.value = valToAdd;
              if (triggerText) {
                triggerText.textContent = valToAdd;
                triggerText.className = `selected-text truncate font-medium text-foreground ${isKm ? 'font-khmer' : ''}`;
              }
              if (input) input.value = '';
              menu.classList.add('hidden');
              dd?.querySelector('.trigger-chevron')?.classList.remove('rotate-180');
            } catch (err) {
              if (err.message === 'ALREADY_EXISTS') {
                toast.warning(t('locations.alreadyExists'));
              } else {
                toast.error(err.message);
              }
            }
          })();
          return;
        }

        // Item row clicked -> Select
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

      // Click outside dropdowns -> Close all menus
      modal.element.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
      modal.element.querySelectorAll('.trigger-chevron').forEach(c => c.classList.remove('rotate-180'));
    });

    // Enter key support inside dropdown new item input
    modal.element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const input = e.target.closest('.input-new-item');
        if (input) {
          e.preventDefault();
          const addBtn = input.parentElement?.querySelector('.btn-add-item');
          addBtn?.click();
        }
      }
    });

    // 3. Photo upload & remove handling
    const photoInput = modal.element.querySelector('#t-form-photo-input');
    const removeBtn = modal.element.querySelector('#t-form-photo-remove');
    const previewBox = modal.element.querySelector('#t-form-photo-preview');

    photoInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        tempBlob = await photoService.processImageFile(file);
        previewUrl = photoService.getUrlForBlob(tempBlob);
        previewBox.innerHTML = `<img src="${previewUrl}" class="w-full h-full object-cover" />`;
        removeBtn?.classList.remove('hidden');
      } catch (err) {
        toast.error(err.message);
      }
    });

    removeBtn?.addEventListener('click', () => {
      tempBlob = null;
      previewUrl = null;
      previewBox.innerHTML = `<span class="text-muted-foreground">${getIcon('user', 'w-7 h-7')}</span>`;
      removeBtn.classList.add('hidden');
      if (photoInput) photoInput.value = '';
    });

    // 3b. Marital Status Change Listener (Toggle Spouse & Children Fields)
    const maritalSelect = modal.element.querySelector('#form-t-maritalStatus');
    const spouseChildrenContainer = modal.element.querySelector('#spouse-children-container');
    maritalSelect?.addEventListener('change', (e) => {
      const isSingleSelected = e.target.value === 'Single';
      if (isSingleSelected) {
        spouseChildrenContainer?.classList.add('hidden');
      } else {
        spouseChildrenContainer?.classList.remove('hidden');
      }
    });

    // 4. Cancel & Save Buttons
    modal.element.querySelector('#btn-t-modal-cancel')?.addEventListener('click', () => modal.close());

    modal.element.querySelector('#btn-t-modal-save')?.addEventListener('click', async () => {
      const teacherId = modal.element.querySelector('#form-t-teacherId')?.value.trim();
      const lastNameKhmer = modal.element.querySelector('#form-t-lastNameKhmer')?.value.trim();
      const firstNameKhmer = modal.element.querySelector('#form-t-firstNameKhmer')?.value.trim();
      const dob = modal.element.querySelector('#form-t-dob')?.value.trim();

      if (!teacherId) {
        toast.error(isKm ? 'សូមបញ្ចូលលេខសម្គាល់គ្រូ' : 'Teacher ID is required');
        return;
      }
      if (!lastNameKhmer || !firstNameKhmer) {
        toast.error(isKm ? 'សូមបញ្ចូលត្រកូល និងនាមខ្លួន' : 'Khmer Surname and First Name are required');
        return;
      }

      const selectedMaritalStatus = modal.element.querySelector('#form-t-maritalStatus')?.value || 'Single';
      const isSingleSelected = selectedMaritalStatus === 'Single';

      const rawPayload = {
        teacherId,
        civilServantId: modal.element.querySelector('#form-t-civilServantId')?.value.trim(),
        nationalId: modal.element.querySelector('#form-t-nationalId')?.value.trim(),
        bankAccount: modal.element.querySelector('#form-t-bankAccount')?.value.trim(),
        lastNameKhmer,
        firstNameKhmer,
        lastNameLatin: modal.element.querySelector('#form-t-lastNameLatin')?.value.trim(),
        firstNameLatin: modal.element.querySelector('#form-t-firstNameLatin')?.value.trim(),
        gender: modal.element.querySelector('#form-t-gender')?.value,
        dob,
        dateOfBirth: dob,
        status: modal.element.querySelector('#form-t-status')?.value,
        birthVillage: modal.element.querySelector('#form-t-birthVillage')?.value.trim(),
        birthCommune: modal.element.querySelector('#form-t-birthCommune')?.value.trim(),
        birthDistrict: modal.element.querySelector('#form-t-birthDistrict')?.value.trim(),
        birthProvince: modal.element.querySelector('#form-t-birthProvince')?.value.trim(),
        currentVillage: modal.element.querySelector('#form-t-currentVillage')?.value.trim(),
        currentCommune: modal.element.querySelector('#form-t-currentCommune')?.value.trim(),
        currentDistrict: modal.element.querySelector('#form-t-currentDistrict')?.value.trim(),
        currentProvince: modal.element.querySelector('#form-t-currentProvince')?.value.trim(),
        joinedDate: modal.element.querySelector('#form-t-joinedDate')?.value,
        permanentAppointmentDate: modal.element.querySelector('#form-t-permanentAppointmentDate')?.value,
        workStatus: modal.element.querySelector('#form-t-workStatus')?.value.trim(),
        framework: modal.element.querySelector('#form-t-framework')?.value.trim(),
        rankAndGrade: modal.element.querySelector('#form-t-rankAndGrade')?.value.trim(),
        position: modal.element.querySelector('#form-t-position')?.value.trim(),
        trainingLevel: modal.element.querySelector('#form-t-trainingLevel')?.value.trim(),
        specialization1: modal.element.querySelector('#form-t-specialization1')?.value.trim(),
        specialization2: modal.element.querySelector('#form-t-specialization2')?.value.trim(),
        taskAssignment: modal.element.querySelector('#form-t-taskAssignment')?.value.trim(),
        additionalDuties: modal.element.querySelector('#form-t-additionalDuties')?.value.trim(),
        highestDegree: modal.element.querySelector('#form-t-highestDegree')?.value.trim(),
        highestDegreeMajor: modal.element.querySelector('#form-t-highestDegreeMajor')?.value.trim(),
        generalEducationLevel: modal.element.querySelector('#form-t-generalEducationLevel')?.value.trim(),
        generalEducationSchool: modal.element.querySelector('#form-t-generalEducationSchool')?.value.trim(),
        generalEducationDegree: modal.element.querySelector('#form-t-generalEducationDegree')?.value.trim(),
        generalEducationStart: modal.element.querySelector('#form-t-generalEducationStart')?.value,
        generalEducationEnd: modal.element.querySelector('#form-t-generalEducationEnd')?.value,
        subject1: modal.element.querySelector('#form-t-subject1')?.value.trim(),
        hoursPerWeek1: modal.element.querySelector('#form-t-hours1')?.value,
        subject2: modal.element.querySelector('#form-t-subject2')?.value.trim(),
        hoursPerWeek2: modal.element.querySelector('#form-t-hours2')?.value,
        subject3: modal.element.querySelector('#form-t-subject3')?.value.trim(),
        hoursPerWeek3: modal.element.querySelector('#form-t-hours3')?.value,
        maritalStatus: selectedMaritalStatus,
        spouseName: isSingleSelected ? '' : (modal.element.querySelector('#form-t-spouseName')?.value.trim() || ''),
        spouseDob: isSingleSelected ? '' : (modal.element.querySelector('#form-t-spouseDob')?.value || ''),
        spouseJob: isSingleSelected ? '' : (modal.element.querySelector('#form-t-spouseJob')?.value.trim() || ''),
        spouseAddress: isSingleSelected ? '' : (modal.element.querySelector('#form-t-spouseAddress')?.value.trim() || ''),
        spousePhone: isSingleSelected ? '' : (modal.element.querySelector('#form-t-spousePhone')?.value.trim() || ''),
        childrenCount: isSingleSelected ? '' : (modal.element.querySelector('#form-t-childrenCount')?.value.trim() || ''),
        fatherName: '',
        fatherBirthplace: '',
        motherName: '',
        motherBirthplace: '',
        phone1: modal.element.querySelector('#form-t-phone1')?.value.trim(),
        phone2: modal.element.querySelector('#form-t-phone2')?.value.trim(),
        telegram: modal.element.querySelector('#form-t-telegram')?.value.trim(),
        email: modal.element.querySelector('#form-t-email')?.value.trim(),
        notes: modal.element.querySelector('#form-t-notes')?.value.trim(),
        photoBlob: tempBlob
      };

      try {
        if (isEdit) {
          await TeacherService.update(teacher.id, rawPayload);
          toast.success(isKm ? 'បានកែប្រែព័ត៌មានគ្រូបង្រៀនដោយជោគជ័យ' : 'Teacher profile updated successfully');
        } else {
          await TeacherService.create(rawPayload);
          toast.success(isKm ? 'បានបង្កើតព័ត៌មានគ្រូបង្រៀនថ្មីដោយជោគជ័យ' : 'Teacher profile created successfully');
        }
        modal.close();
        if (onSave) await onSave();
      } catch (err) {
        toast.error(err.message);
      }
    });
  }
};
