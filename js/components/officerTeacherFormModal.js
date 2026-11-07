/**
 * Dedicated Teacher Form Modal for OFFICER Account
 * Faithfully matches official MoEYS HR Civil Servant structure shown in the specification:
 * - Profile header banner with avatar, verified badge, role, unit, civil servant ID & phone
 * - Account status notification banner (Status 5 / Active in unit)
 * - 8 Tabs navigation (ព័ត៌មានអេឡិចត្រូនិក active)
 * - Card 1: ព័ត៌មានអត្តសញ្ញាណផ្ទាល់ខ្លួន (Khmer name, Latin name, Gender, DOB, Ethnicity, Photo)
 * - Card 2: ព័ត៌មានទំនាក់ទំនង និងហិរញ្ញវត្ថុ (National ID, ID document upload & preview, Bank account)
 * - Card 3: អាសយដ្ឋាន ទំនាក់ទំនង (Birthplace: Province, District, Commune, Village & Current Residence: Phone, Email, House, Group, Street, Province, District, Commune, Village)
 * - Card 4: ព័ត៌មានការងារបម្រើ (Civil Servant ID, Joined date, Permanent appointment date)
 * - Card 5: ព័ត៌មានពិការភាព និងសមាជិកភាពពិសេស (Disability checkbox, type, description, NSSF member & card number)
 * - Secondary tabs: Employment history, Training, Family, Teaching load, etc.
 * 
 * Completely separated and isolated from Director & Teacher account forms.
 */

import { TeacherService } from '../services/teacherService.js';
import { photoService } from '../services/photoService.js';
import { toast } from './toast.js';
import { t, i18n } from '../i18n/i18n.js';
import { getIcon } from './icons.js';
import { toInputDateFormat } from '../utils/dateUtils.js';

const CAMBODIA_PROVINCES = [
  'ភ្នំពេញ',
  'កណ្តាល',
  'កំពង់ចាម',
  'កំពង់ឆ្នាំង',
  'កំពង់ស្ពឺ',
  'កំពង់ធំ',
  'កំពត',
  'កោះកុង',
  'ក្រចេះ',
  'កែប',
  'តាកែវ',
  'ត្បូងឃ្មុំ',
  'បន្ទាយមានជ័យ',
  'បាត់ដំបង',
  'ប៉ៃលិន',
  'ពោធិ៍សាត់',
  'ព្រះវិហារ',
  'ព្រះសីហនុ',
  'ព្រៃវែង',
  'មណ្ឌលគិរី',
  'រតនគិរី',
  'សៀមរាប',
  'ស្ទឹងត្រែង',
  'ស្វាយរៀង',
  'ឧត្តរមានជ័យ'
];

export const OfficerTeacherFormModal = {
  /**
   * Open the dedicated Officer teacher form
   * @param {Object} options
   * @param {Object} [options.teacher=null] - Existing teacher record (if editing)
   * @param {Function} options.onSave - Callback when saved
   */
  async open({ teacher = null, onSave, container = null, close = null }) {
    const isEdit = !!teacher;
    const isKm = i18n.getLocale() === 'km';
    const title = isEdit 
      ? (isKm ? 'កែប្រែព័ត៌មានមន្ត្រី/គ្រូបង្រៀន (ការិយាល័យ)' : 'Edit Teacher Record (Office)') 
      : (isKm ? 'បន្ថែមមន្ត្រី/គ្រូបង្រៀនថ្មី (ការិយាល័យ)' : 'Add New Teacher (Office)');

    let tempPhotoBlob = teacher?.photoBlob || null;
    if (!tempPhotoBlob && teacher?.photo && teacher.photo.startsWith('data:')) {
      try {
        tempPhotoBlob = await photoService.dataUrlToBlob(teacher.photo);
      } catch (_) {}
    }
    let previewPhotoUrl = photoService.getUrlForBlob(tempPhotoBlob || teacher?.photo);

    let tempIdDocBlob = null;
    let previewIdDocUrl = teacher?.idCardDoc || '';

    // Initial values
    const initialLastNameKm = teacher?.lastNameKhmer || teacher?.lastNameKh || '';
    const initialFirstNameKm = teacher?.firstNameKhmer || teacher?.firstNameKh || '';
    const initialLastNameEn = (teacher?.lastNameLatin || '').toUpperCase();
    const initialFirstNameEn = (teacher?.firstNameLatin || '').toUpperCase();
    const initialTeacherId = teacher?.teacherId || teacher?.code || '';
    const initialCivilId = teacher?.civilServantId || '';
    const initialPhone = teacher?.phone || teacher?.phone1 || '';
    const initialEmail = teacher?.email || '';
    const initialUnit = teacher?.unit || 'ការិយាល័យ អប់រំ យុវជន និងកីឡា';
    const initialDob = toInputDateFormat(teacher?.dob || teacher?.dateOfBirth || '');
    const initialJoinedDate = toInputDateFormat(teacher?.joinedDate || '');
    const initialPermanentDate = toInputDateFormat(teacher?.permanentAppointmentDate || '');
    const initialGender = teacher?.gender === 'ស្រី' || teacher?.gender === 'Female' ? 'ស្រី' : 'ប្រុស';
    const initialEthnicity = teacher?.ethnicity || 'ខ្មែរ';
    const initialNationalId = teacher?.nationalId || '';
    const initialBankAccount = teacher?.bankAccount || '';
    const initialBirthProvince = teacher?.birthProvince || 'បាត់ដំបង';
    const initialBirthDistrict = teacher?.birthDistrict || '';
    const initialBirthCommune = teacher?.birthCommune || '';
    const initialBirthVillage = teacher?.birthVillage || '';
    const initialCurrentProvince = teacher?.currentProvince || 'សៀមរាប';
    const initialCurrentDistrict = teacher?.currentDistrict || '';
    const initialCurrentCommune = teacher?.currentCommune || '';
    const initialCurrentVillage = teacher?.currentVillage || '';
    const initialHouseNumber = teacher?.houseNumber || '';
    const initialGroup = teacher?.group || '';
    const initialStreet = teacher?.street || '';
    const initialIsDisability = teacher?.isDisability === true || teacher?.isDisability === 'true';
    const initialDisabilityType = teacher?.disabilityType || '';
    const initialDisabilityDesc = teacher?.disabilityDescription || '';
    const initialIsNssf = teacher?.isNssf === true || teacher?.isNssf === 'true';
    const initialNssfNumber = teacher?.nssfNumber || '';

    const isDrawer = !!container;
    const overlay = isDrawer ? container : document.createElement('div');
    if (!isDrawer) {
      overlay.className = 'dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-sm animate-fade-in overflow-y-auto';
      overlay.id = 'officer-teacher-form-modal-overlay';
    }

    overlay.innerHTML = `
      <div class="relative w-full max-w-6xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col my-auto overflow-hidden animate-slide-down max-h-[94vh]">
        
        <!-- Top Sticky Action Bar -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-border bg-card/95 backdrop-blur z-20 flex-shrink-0">
          <div class="flex items-center gap-2.5">
            <span class="p-2 rounded-xl bg-primary/10 text-primary">
              ${getIcon('teachers', 'w-5 h-5')}
            </span>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-foreground ${isKm ? 'font-khmer' : ''}">
                ${title}
              </h3>
              <p class="text-[11px] text-muted-foreground hidden sm:block">
                ${isKm ? 'ទម្រង់បំពេញព័ត៌មានលម្អិតតាមបទដ្ឋាន MoEYS សម្រាប់គណនីមន្ត្រីការិយាល័យ' : 'Official MoEYS Civil Servant Teacher Profile Form (Officer Account)'}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-officer-modal-close" class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Close">
              ${getIcon('close', 'w-5 h-5')}
            </button>
          </div>
        </div>

        <!-- Scrollable Form Body -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-muted/15" id="officer-modal-scroll-body">

          <form id="officer-main-form" class="space-y-5">
              
              <!-- CARD 1: ព័ត៌មានអត្តសញ្ញាណផ្ទាល់ខ្លួន (Personal Identity) -->
              <div class="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-2xs space-y-4">
                <div class="flex items-center gap-2 pb-2.5 border-b border-border text-foreground font-bold">
                  <span class="p-1.5 rounded-lg bg-primary/10 text-primary">
                    ${getIcon('user', 'w-4 h-4')}
                  </span>
                  <span class="${isKm ? 'font-khmer' : ''}">
                    ${isKm ? 'ព័ត៌មានអត្តសញ្ញាណផ្ទាល់ខ្លួន' : 'Personal Identity Information'}
                  </span>
                </div>

                <!-- Dedicated Photo Uploader Card -->
                <div class="p-4 rounded-xl border border-dashed border-border bg-muted/20 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <div id="officer-photo-preview-container" class="w-24 h-28 sm:w-28 sm:h-32 rounded-xl overflow-hidden border-2 border-border bg-card flex items-center justify-center flex-shrink-0 shadow-xs relative group cursor-pointer hover:border-primary transition-all" title="${isKm ? 'ចុចដើម្បីជ្រើសរើសរូបថត' : 'Click to select photo'}">
                    <img id="officer-photo-preview" src="${previewPhotoUrl || ''}" class="${previewPhotoUrl ? '' : 'hidden'} w-full h-full object-cover" alt="Officer Photo" />
                    <div id="officer-photo-preview-placeholder" class="${previewPhotoUrl ? 'hidden' : 'flex'} flex-col items-center justify-center text-muted-foreground p-2 text-center">
                      ${getIcon('user', 'w-9 h-9 text-muted-foreground/60 mb-1')}
                      <span class="text-[11px] font-medium font-khmer">${isKm ? 'គ្មានរូបថត' : 'No photo'}</span>
                    </div>
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-medium gap-1 pointer-events-none">
                      ${getIcon('camera', 'w-5 h-5')}
                      <span class="font-khmer">${isKm ? 'ប្តូររូបថត' : 'Change'}</span>
                    </div>
                  </div>
                  <div class="flex-1 min-w-0 space-y-1.5 text-center sm:text-left">
                    <div class="flex items-center justify-center sm:justify-start gap-2">
                      <label class="text-xs sm:text-sm font-bold text-foreground font-khmer">
                        ${isKm ? 'រូបថតបច្ចុប្បន្នភាព / រូបថតមន្ត្រី-គ្រូបង្រៀន' : 'Portrait / Profile Photo'}
                      </label>
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">4x6</span>
                    </div>
                    <p class="text-[11px] text-muted-foreground font-khmer">
                      ${isKm ? 'ទំហំស្តង់ដារ 4x6 ឬរូបថតផ្ទាល់ខ្លួនច្បាស់ (JPG, PNG, WebP) - សម្រាប់បង្ហាញលើកាត និងជីវប្រវត្តិ' : 'Standard 4x6 passport size or portrait (JPG, PNG, WebP) - used on ID cards and dossiers'}
                    </p>
                    <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1.5">
                      <label class="cursor-pointer px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all inline-flex items-center gap-1.5 cursor-pointer">
                        ${getIcon('upload', 'w-3.5 h-3.5')}
                        <span class="font-khmer">${isKm ? 'ជ្រើសរើសរូបថត' : 'Upload Photo'}</span>
                        <input type="file" id="officer-contest-photo-input" accept="image/*" class="hidden" />
                      </label>
                      <button type="button" id="officer-photo-remove-btn" class="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-xs text-muted-foreground font-medium transition-colors font-khmer cursor-pointer ${previewPhotoUrl ? '' : 'hidden'}">
                        ${getIcon('trash2', 'w-3.5 h-3.5 inline mr-1')}
                        ${isKm ? 'លុបរូប' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <!-- លេខកូដ (Teacher Code) * -->
                  <div>
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'លេខកូដ' : 'Code'} <span class="text-rose-500 font-bold">*</span>
                    </label>
                    <input type="text" id="officer-teacher-id" required
                           value="${initialTeacherId}"
                           placeholder="${isKm ? 'ឧ. TCH-001' : 'e.g. TCH-001'}"
                           class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono shadow-2xs font-semibold" />
                  </div>

                  <!-- អត្តលេខមន្រ្តីរាជការ (Civil Servant ID) -->
                  <div>
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'អត្តលេខមន្រ្តីរាជការ' : 'Civil Servant ID'}
                    </label>
                    <input type="text" id="officer-civil-servant-id"
                           value="${initialCivilId}"
                           placeholder="1950200078"
                           class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono shadow-2xs font-semibold text-primary" />
                  </div>

                  <!-- នាមត្រកូល * -->
                  <div>
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'នាមត្រកូល' : 'Khmer Surname'} <span class="text-rose-500 font-bold">*</span>
                    </label>
                    <input type="text" id="officer-last-name-km" required
                           value="${initialLastNameKm}"
                           placeholder="${isKm ? 'ឧ. សុខ' : 'e.g. SOK'}"
                           class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-khmer shadow-2xs" />
                  </div>

                  <!-- នាមខ្លួន * -->
                  <div>
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'នាមខ្លួន' : 'Khmer First Name'} <span class="text-rose-500 font-bold">*</span>
                    </label>
                    <input type="text" id="officer-first-name-km" required
                           value="${initialFirstNameKm}"
                           placeholder="${isKm ? 'ឧ. សុផល' : 'e.g. SOPHAL'}"
                           class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-khmer shadow-2xs" />
                  </div>

                  <!-- នាមត្រកូល (ឡាតាំង) -->
                  <div>
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'នាមត្រកូល (ឡាតាំង)' : 'Latin Surname'}
                    </label>
                    <input type="text" id="officer-last-name-en"
                           value="${initialLastNameEn}"
                           placeholder="SOK"
                           class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary uppercase font-mono shadow-2xs" />
                  </div>

                  <!-- នាមខ្លួន (ឡាតាំង) -->
                  <div>
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'នាមខ្លួន (ឡាតាំង)' : 'Latin First Name'}
                    </label>
                    <input type="text" id="officer-first-name-en"
                           value="${initialFirstNameEn}"
                           placeholder="SOPHAL"
                           class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary uppercase font-mono shadow-2xs" />
                  </div>

                  <!-- ភេទ * -->
                  <div>
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'ភេទ' : 'Gender'} <span class="text-rose-500 font-bold">*</span>
                    </label>
                    <select id="officer-gender" required
                            class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs">
                      <option value="ប្រុស" ${initialGender === 'ប្រុស' ? 'selected' : ''}>${isKm ? 'ប្រុស' : 'Male'}</option>
                      <option value="ស្រី" ${initialGender === 'ស្រី' ? 'selected' : ''}>${isKm ? 'ស្រី' : 'Female'}</option>
                    </select>
                  </div>

                  <!-- ថ្ងៃខែឆ្នាំកំណើត * -->
                  <div>
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'ថ្ងៃខែឆ្នាំកំណើត' : 'Date of Birth'} <span class="text-rose-500 font-bold">*</span>
                    </label>
                    <input type="date" id="officer-dob" required
                           value="${initialDob}"
                           class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-mono" />
                  </div>

                  <!-- ជនជាតិ -->
                  <div class="sm:col-span-2">
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'ជនជាតិ' : 'Ethnicity'}
                    </label>
                    <select id="officer-ethnicity"
                            class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs">
                      <option value="ខ្មែរ" ${initialEthnicity === 'ខ្មែរ' ? 'selected' : ''}>ខ្មែរ (Khmer)</option>
                      <option value="ចិន" ${initialEthnicity === 'ចិន' ? 'selected' : ''}>ចិន (Chinese)</option>
                      <option value="វៀតណាម" ${initialEthnicity === 'វៀតណាម' ? 'selected' : ''}>វៀតណាម (Vietnamese)</option>
                      <option value="ចាម" ${initialEthnicity === 'ចាម' ? 'selected' : ''}>ចាម (Cham)</option>
                      <option value="ជនជាតិដើមភាគតិច" ${initialEthnicity === 'ជនជាតិដើមភាគតិច' ? 'selected' : ''}>ជនជាតិដើមភាគតិច (Indigenous)</option>
                      <option value="ផ្សេងៗ" ${initialEthnicity === 'ផ្សេងៗ' ? 'selected' : ''}>ផ្សេងៗ (Other)</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- CARD 2: ព័ត៌មានទំនាក់ទំនង និងហិរញ្ញវត្ថុ (Contact & Finance) -->
              <div class="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-2xs space-y-4">
                <div class="flex items-center gap-2 pb-2.5 border-b border-border text-foreground font-bold">
                  <span class="p-1.5 rounded-lg bg-primary/10 text-primary">
                    ${getIcon('creditCard', 'w-4 h-4')}
                  </span>
                  <span class="${isKm ? 'font-khmer' : ''}">
                    ${isKm ? 'ព័ត៌មានទំនាក់ទំនង និងហិរញ្ញវត្ថុ' : 'Contact & Financial Information'}
                  </span>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  
                  <!-- Left: Inputs (7 cols) -->
                  <div class="lg:col-span-7 space-y-3.5">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <!-- អត្តសញ្ញាណប័ណ្ណ -->
                      <div>
                        <label class="block text-xs font-semibold text-foreground mb-1">
                          ${isKm ? 'អត្តសញ្ញាណប័ណ្ណ' : 'National ID'}
                        </label>
                        <input type="text" id="officer-national-id"
                               value="${initialNationalId}"
                               placeholder="170 736 181"
                               class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono shadow-2xs" />
                      </div>

                      <!-- គណនីធនាគារ -->
                      <div>
                        <label class="block text-xs font-semibold text-foreground mb-1">
                          ${isKm ? 'គណនីធនាគារ' : 'Bank Account Number'}
                        </label>
                        <input type="text" id="officer-bank-account"
                               value="${initialBankAccount}"
                               placeholder="0300 03 216893 13"
                               class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono shadow-2xs" />
                      </div>
                    </div>

                    <!-- ឯកសារអត្តសញ្ញាណប័ណ្ណ ឬសំបុត្រកំណើតបញ្ជាក់សញ្ជាតិ -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ឯកសារអត្តសញ្ញាណប័ណ្ណ ឬសំបុត្រកំណើតបញ្ជាក់សញ្ជាតិ' : 'National ID or Birth Certificate Document'}
                      </label>
                      <input type="file" id="officer-id-doc-input" accept="image/*,.pdf"
                             class="w-full text-xs text-muted-foreground file:mr-2.5 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer border border-input rounded-lg h-9 bg-background flex items-center px-1.5 shadow-2xs" />
                    </div>
                  </div>

                  <!-- Right: Document Preview Box (5 cols) -->
                  <div class="lg:col-span-5 flex flex-col space-y-1.5">
                    <div class="flex items-center justify-between">
                      <label class="block text-xs font-semibold text-foreground font-khmer">
                        ${isKm ? 'មើលឯកសារអត្តសញ្ញាណប័ណ្ណ' : 'Preview Document'}
                      </label>
                      <button type="button" id="officer-id-doc-remove-btn" class="text-[11px] text-destructive hover:underline font-khmer cursor-pointer ${previewIdDocUrl ? '' : 'hidden'}">
                        ${isKm ? 'លុបឯកសារ' : 'Remove Doc'}
                      </button>
                    </div>
                    <div id="officer-id-doc-preview-container" class="w-full h-28 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center p-2 overflow-hidden text-center transition-colors">
                      <div id="officer-id-doc-placeholder" class="${previewIdDocUrl ? 'hidden' : 'flex'} flex-col items-center justify-center text-muted-foreground text-xs p-2">
                        ${getIcon('fileText', 'w-6 h-6 mb-1 text-muted-foreground/60')}
                        <span class="font-khmer">${isKm ? 'គ្មានឯកសារអត្តសញ្ញាណប័ណ្ណ' : 'No document uploaded'}</span>
                      </div>
                      <img id="officer-id-doc-img" src="${previewIdDocUrl || ''}" class="${previewIdDocUrl ? '' : 'hidden'} max-h-full max-w-full object-contain rounded" alt="ID Document Preview" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- CARD 3: អាសយដ្ឋាន ទំនាក់ទំនង (Address & Contact) -->
              <div class="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-2xs space-y-5">
                
                <!-- Main Header -->
                <div class="flex items-center gap-2 pb-2.5 border-b border-border text-foreground font-bold">
                  <span class="p-1.5 rounded-lg bg-primary/10 text-primary">
                    ${getIcon('mapPin', 'w-4 h-4')}
                  </span>
                  <span class="${isKm ? 'font-khmer' : ''}">
                    ${isKm ? 'អាសយដ្ឋាន ទំនាក់ទំនង' : 'Address & Contact Information'}
                  </span>
                </div>

                <!-- SUBSECTION 1: ទីកន្លែងកំណើត (Place of Birth) -->
                <div class="space-y-2.5">
                  <div class="flex items-center gap-2 text-xs font-bold text-primary">
                    ${getIcon('home', 'w-3.5 h-3.5')}
                    <span>${isKm ? 'ទីកន្លែងកំណើត' : 'Place of Birth'}</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <!-- រាជធានី/ខេត្ត * -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'រាជធានី/ខេត្ត' : 'Birth Province'} <span class="text-rose-500 font-bold">*</span>
                      </label>
                      <select id="officer-birth-province" required
                              class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-khmer">
                        ${CAMBODIA_PROVINCES.map(p => `
                          <option value="${p}" ${initialBirthProvince === p ? 'selected' : ''}>${p}</option>
                        `).join('')}
                      </select>
                    </div>

                    <!-- ស្រុក/ខណ្ឌ/ក្រុង * -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ស្រុក/ខណ្ឌ/ក្រុង' : 'Birth District'} <span class="text-rose-500 font-bold">*</span>
                      </label>
                      <input type="text" id="officer-birth-district" required
                             value="${initialBirthDistrict}"
                             placeholder="${isKm ? 'ស្វាយប៉ោ' : 'District'}"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-khmer" />
                    </div>

                    <!-- ឃុំ/សង្កាត់ -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ឃុំ/សង្កាត់' : 'Birth Commune'}
                      </label>
                      <input type="text" id="officer-birth-commune"
                             value="${initialBirthCommune}"
                             placeholder="${isKm ? 'ស្វាយប៉ោ' : 'Commune'}"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-khmer" />
                    </div>

                    <!-- ភូមិ -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ភូមិ' : 'Birth Village'}
                      </label>
                      <input type="text" id="officer-birth-village"
                             value="${initialBirthVillage}"
                             placeholder="${isKm ? 'ព្រែកព្រះស្តេច' : 'Village'}"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-khmer" />
                    </div>
                  </div>
                </div>

                <!-- SUBSECTION 2: អាសយដ្ឋាន ទំនាក់ទំនង (Contact Address & Current Residence) -->
                <div class="space-y-2.5 pt-3 border-t border-border/60">
                  <div class="flex items-center gap-2 text-xs font-bold text-primary">
                    ${getIcon('mapPin', 'w-3.5 h-3.5')}
                    <span>${isKm ? 'អាសយដ្ឋានបច្ចុប្បន្ន និងទំនាក់ទំនង' : 'Current Residence & Contacts'}</span>
                  </div>

                  <!-- Row 1: Phone, Email, House, Group, Street -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                    <!-- ទូរស័ព្ទផ្ទាល់ខ្លួន -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ទូរស័ព្ទផ្ទាល់ខ្លួន' : 'Phone Number'}
                      </label>
                      <input type="text" id="officer-phone"
                             value="${initialPhone}"
                             placeholder="086816114"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono shadow-2xs" />
                    </div>

                    <!-- អ៊ីមែល -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'អ៊ីមែល' : 'Email Address'}
                      </label>
                      <input type="email" id="officer-email"
                             value="${initialEmail}"
                             placeholder="veasnawb@gmail.com"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-mono" />
                    </div>

                    <!-- ផ្ទះលេខ -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ផ្ទះលេខ' : 'House No.'}
                      </label>
                      <input type="text" id="officer-house-number"
                             value="${initialHouseNumber}"
                             placeholder="N/A"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs" />
                    </div>

                    <!-- ក្រុម -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ក្រុម' : 'Group'}
                      </label>
                      <input type="text" id="officer-group"
                             value="${initialGroup}"
                             placeholder="1"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs" />
                    </div>

                    <!-- ផ្លូវ (លេខឬឈ្មោះ) -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ផ្លូវ (លេខឬឈ្មោះ)' : 'Street'}
                      </label>
                      <input type="text" id="officer-street"
                             value="${initialStreet}"
                             placeholder="${isKm ? 'ឧ. ផ្លូវជាតិលេខ ៥' : 'Street name'}"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-khmer" />
                    </div>
                  </div>

                  <!-- Row 2: Current Province, District, Commune, Village -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
                    <!-- រាជធានី/ខេត្ត -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'រាជធានី/ខេត្ត' : 'Current Province'}
                      </label>
                      <select id="officer-current-province"
                              class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-khmer">
                        ${CAMBODIA_PROVINCES.map(p => `
                          <option value="${p}" ${initialCurrentProvince === p ? 'selected' : ''}>${p}</option>
                        `).join('')}
                      </select>
                    </div>

                    <!-- ស្រុក/ខណ្ឌ/ក្រុង -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ស្រុក/ខណ្ឌ/ក្រុង' : 'Current District'}
                      </label>
                      <input type="text" id="officer-current-district"
                             value="${initialCurrentDistrict}"
                             placeholder="${isKm ? 'ក្រុងសៀមរាប' : 'District'}"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-khmer" />
                    </div>

                    <!-- ឃុំ/សង្កាត់ -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ឃុំ/សង្កាត់' : 'Current Commune'}
                      </label>
                      <input type="text" id="officer-current-commune"
                             value="${initialCurrentCommune}"
                             placeholder="${isKm ? 'សង្កាត់សៀមរាប' : 'Commune'}"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-khmer" />
                    </div>

                    <!-- ភូមិ -->
                    <div>
                      <label class="block text-xs font-semibold text-foreground mb-1">
                        ${isKm ? 'ភូមិ' : 'Current Village'}
                      </label>
                      <input type="text" id="officer-current-village"
                             value="${initialCurrentVillage}"
                             placeholder="${isKm ? 'ស្លក្រាម' : 'Village'}"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-khmer" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- CARD 4: ព័ត៌មានការងារបម្រើ (Employment Info) -->
              <div class="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-2xs space-y-4">
                <div class="flex items-center gap-2 pb-2.5 border-b border-border text-foreground font-bold">
                  <span class="p-1.5 rounded-lg bg-primary/10 text-primary">
                    ${getIcon('briefcase', 'w-4 h-4')}
                  </span>
                  <span class="${isKm ? 'font-khmer' : ''}">
                    ${isKm ? 'ព័ត៌មានការងារបម្រើ' : 'Civil Service Employment Information'}
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <!-- ថ្ងៃខែឆ្នាំចូលបម្រើការងារ * -->
                  <div>
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'ថ្ងៃខែឆ្នាំចូលបម្រើការងារ' : 'Joined Date'} <span class="text-rose-500 font-bold">*</span>
                    </label>
                    <input type="date" id="officer-joined-date" required
                           value="${initialJoinedDate}"
                           class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono shadow-2xs" />
                  </div>

                  <!-- ថ្ងៃតាំងស៊ប់ក្នុងក្របខ័ណ្ឌ -->
                  <div>
                    <label class="block text-xs font-semibold text-foreground mb-1">
                      ${isKm ? 'ថ្ងៃតាំងស៊ប់ក្នុងក្របខ័ណ្ឌ' : 'Permanent Appointment Date'}
                    </label>
                    <input type="date" id="officer-permanent-date"
                           value="${initialPermanentDate}"
                           class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono shadow-2xs" />
                  </div>
                </div>
              </div>

              <!-- CARD 5: ព័ត៌មានពិការភាព និងសមាជិកភាពពិសេស (Disability & Special Membership) -->
              <div class="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-2xs space-y-4">
                <div class="flex items-center gap-2 pb-2.5 border-b border-border text-foreground font-bold">
                  <span class="p-1.5 rounded-lg bg-primary/10 text-primary">
                    ${getIcon('award', 'w-4 h-4')}
                  </span>
                  <span class="${isKm ? 'font-khmer' : ''}">
                    ${isKm ? 'ព័ត៌មានពិការភាព និងសមាជិកភាពពិសេស' : 'Disability & Special Membership'}
                  </span>
                </div>

                <div class="space-y-4">
                  <!-- Row 1: Disability Toggle, Type, Description -->
                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center">
                    <!-- Checkbox -->
                    <div class="sm:col-span-3 flex items-center gap-2 pt-1">
                      <input type="checkbox" id="officer-is-disability" ${initialIsDisability ? 'checked' : ''}
                             class="w-4 h-4 rounded text-primary focus:ring-primary border-input cursor-pointer" />
                      <label for="officer-is-disability" class="text-xs font-semibold text-foreground cursor-pointer select-none ${isKm ? 'font-khmer' : ''}">
                        ${isKm ? 'គ្រូបង្រៀនពិការ' : 'Disabled Teacher'}
                      </label>
                    </div>

                    <!-- ប្រភេទពិការ -->
                    <div class="sm:col-span-4">
                      <label class="block text-[11px] font-medium text-muted-foreground mb-1">
                        ${isKm ? 'ប្រភេទពិការ' : 'Disability Type'}
                      </label>
                      <select id="officer-disability-type"
                              class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs ${initialIsDisability ? '' : 'opacity-60'}">
                        <option value="">${isKm ? 'ជ្រើសរើស...' : 'Select type...'}</option>
                        <option value="គថ្លង់" ${initialDisabilityType === 'គថ្លង់' ? 'selected' : ''}>គថ្លង់ (Mute/Deaf)</option>
                        <option value="ពិការភ្នែក" ${initialDisabilityType === 'ពិការភ្នែក' ? 'selected' : ''}>ពិការភ្នែក (Visual Impairment)</option>
                        <option value="ពិការដៃជើង" ${initialDisabilityType === 'ពិការដៃជើង' ? 'selected' : ''}>ពិការដៃជើង (Physical Disability)</option>
                        <option value="បញ្ញាស្មារតី" ${initialDisabilityType === 'បញ្ញាស្មារតី' ? 'selected' : ''}>បញ្ញាស្មារតី (Intellectual)</option>
                        <option value="ផ្សេងៗ" ${initialDisabilityType === 'ផ្សេងៗ' ? 'selected' : ''}>ផ្សេងៗ (Other)</option>
                      </select>
                    </div>

                    <!-- បរិយាយ -->
                    <div class="sm:col-span-5">
                      <label class="block text-[11px] font-medium text-muted-foreground mb-1">
                        ${isKm ? 'បរិយាយ' : 'Description'}
                      </label>
                      <input type="text" id="officer-disability-desc"
                             value="${initialDisabilityDesc}"
                             placeholder="${isKm ? 'ព័ត៌មានលម្អិតពិការភាព...' : 'Disability description...'}"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs ${initialIsDisability ? '' : 'opacity-60'}" />
                    </div>
                  </div>

                  <!-- Row 2: NSSF Member & Card No -->
                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center pt-2 border-t border-border/50">
                    <!-- Checkbox -->
                    <div class="sm:col-span-5 flex items-center gap-2 pt-1">
                      <input type="checkbox" id="officer-is-nssf" ${initialIsNssf ? 'checked' : ''}
                             class="w-4 h-4 rounded text-primary focus:ring-primary border-input cursor-pointer" />
                      <label for="officer-is-nssf" class="text-xs font-semibold text-foreground cursor-pointer select-none ${isKm ? 'font-khmer' : ''}">
                        ${isKm ? 'សមាជិកបេឡាជាតិរបបសន្តិសុខសង្គម (ប.ស.ស.)' : 'NSSF Member'}
                      </label>
                    </div>

                    <!-- Spacer -->
                    <div class="hidden sm:block sm:col-span-2"></div>

                    <!-- លេខកាតសមាជិក -->
                    <div class="sm:col-span-5">
                      <label class="block text-[11px] font-medium text-muted-foreground mb-1">
                        ${isKm ? 'លេខកាតសមាជិក' : 'NSSF Card Number'}
                      </label>
                      <input type="text" id="officer-nssf-number"
                             value="${initialNssfNumber}"
                             placeholder="13981100"
                             class="w-full h-9 px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono shadow-2xs ${initialIsNssf ? '' : 'opacity-60'}" />
                    </div>
                  </div>
                </div>
              </div>

            </form>
        </div>

        <!-- Sticky Footer -->
        <div class="flex items-center justify-between px-5 py-3.5 border-t border-border bg-card/95 backdrop-blur z-20 flex-shrink-0">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <span class="p-1 rounded bg-primary/10 text-primary">
              ${getIcon('lock', 'w-3.5 h-3.5')}
            </span>
            <span class="hidden sm:inline ${isKm ? 'font-khmer' : ''}">
              ${isKm ? 'ទម្រង់ផ្ទាល់ខ្លួនរបស់ Officer (MoEYS Standard)' : 'Dedicated Officer Teacher Profile'}
            </span>
          </div>

          <div class="flex items-center gap-2.5">
            <button id="btn-officer-modal-cancel" type="button" class="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer ${isKm ? 'font-khmer' : ''}">
              ${t('common.cancel')}
            </button>
            <button id="btn-officer-modal-submit" type="button" class="btn-primary inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer ${isKm ? 'font-khmer' : ''}">
              ${getIcon('check', 'w-4 h-4')}
              <span>${isEdit ? (isKm ? 'រក្សាទុកការកែប្រែ' : 'Update Profile') : (isKm ? 'រក្សាទុកទិន្នន័យ' : 'Save Profile')}</span>
            </button>
          </div>
        </div>

      </div>
    `;

    if (!isDrawer) {
      document.body.appendChild(overlay);
    }

    const closeModal = () => {
      if (typeof close === 'function') {
        close();
      } else if (isDrawer && window.UI?.drawer?.close) {
        window.UI.drawer.close();
      } else {
        overlay.classList.add('animate-fade-out');
        setTimeout(() => overlay.remove(), 150);
      }
    };

    // Close handlers
    overlay.querySelector('#btn-officer-modal-close')?.addEventListener('click', closeModal);
    overlay.querySelector('#btn-officer-modal-cancel')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Tabs removed - direct single form

    

    // Photo input handling
    const contestPhotoInput = overlay.querySelector('#officer-contest-photo-input');
    const photoPreviewContainer = overlay.querySelector('#officer-photo-preview-container');
    const photoPreview = overlay.querySelector('#officer-photo-preview');
    const photoPlaceholder = overlay.querySelector('#officer-photo-preview-placeholder');
    const photoRemoveBtn = overlay.querySelector('#officer-photo-remove-btn');

    const handlePhotoFile = async (file) => {
      if (!file) return;
      try {
        tempPhotoBlob = await photoService.processImageFile(file);
        previewPhotoUrl = photoService.getUrlForBlob(tempPhotoBlob);
        if (photoPreview) {
          photoPreview.src = previewPhotoUrl;
          photoPreview.classList.remove('hidden');
        }
        if (photoPlaceholder) {
          photoPlaceholder.classList.add('hidden');
        }
        if (photoRemoveBtn) {
          photoRemoveBtn.classList.remove('hidden');
        }
        toast.success(isKm ? 'បានផ្ទុករូបថតដោយជោគជ័យ' : 'Photo uploaded successfully');
      } catch (err) {
        toast.error(err.message || 'Error processing photo');
      }
    };

    contestPhotoInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      handlePhotoFile(file);
    });

    // Clicking avatar box triggers photo picker
    photoPreviewContainer?.addEventListener('click', (e) => {
      if (e.target.closest('#officer-photo-remove-btn')) return;
      contestPhotoInput?.click();
    });

    // Drag and drop photo onto preview container
    ['dragenter', 'dragover'].forEach(eventName => {
      photoPreviewContainer?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoPreviewContainer.classList.add('border-primary', 'bg-primary/5');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      photoPreviewContainer?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoPreviewContainer.classList.remove('border-primary', 'bg-primary/5');
      });
    });
    photoPreviewContainer?.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      handlePhotoFile(file);
    });

    // Remove photo
    photoRemoveBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      tempPhotoBlob = null;
      previewPhotoUrl = null;
      if (photoPreview) {
        photoPreview.src = '';
        photoPreview.classList.add('hidden');
      }
      if (photoPlaceholder) {
        photoPlaceholder.classList.remove('hidden');
      }
      photoRemoveBtn.classList.add('hidden');
      if (contestPhotoInput) contestPhotoInput.value = '';
    });

    // ID Card Document Preview handling
    const idDocInput = overlay.querySelector('#officer-id-doc-input');
    const idDocPlaceholder = overlay.querySelector('#officer-id-doc-placeholder');
    const idDocImg = overlay.querySelector('#officer-id-doc-img');
    const idDocRemoveBtn = overlay.querySelector('#officer-id-doc-remove-btn');

    idDocInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      tempIdDocBlob = file;
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (re) => {
          previewIdDocUrl = re.target.result;
          if (idDocImg) {
            idDocImg.src = previewIdDocUrl;
            idDocImg.classList.remove('hidden');
          }
          if (idDocPlaceholder) {
            idDocPlaceholder.classList.add('hidden');
          }
          idDocRemoveBtn?.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      } else {
        // PDF or other document
        previewIdDocUrl = file.name;
        if (idDocPlaceholder) {
          idDocPlaceholder.innerHTML = `
            <div class="text-xs text-primary font-semibold flex flex-col items-center gap-1">
              ${getIcon('fileText', 'w-7 h-7')}
              <span class="truncate max-w-[180px]">${file.name}</span>
            </div>
          `;
          idDocPlaceholder.classList.remove('hidden');
        }
        if (idDocImg) idDocImg.classList.add('hidden');
        idDocRemoveBtn?.classList.remove('hidden');
      }
    });

    idDocRemoveBtn?.addEventListener('click', () => {
      tempIdDocBlob = null;
      previewIdDocUrl = '';
      if (idDocImg) {
        idDocImg.src = '';
        idDocImg.classList.add('hidden');
      }
      if (idDocPlaceholder) {
        idDocPlaceholder.innerHTML = `
          ${getIcon('fileText', 'w-6 h-6 mb-1 text-muted-foreground/60')}
          <span class="font-khmer">${isKm ? 'គ្មានឯកសារអត្តសញ្ញាណប័ណ្ណ' : 'No document uploaded'}</span>
        `;
        idDocPlaceholder.classList.remove('hidden');
      }
      idDocRemoveBtn.classList.add('hidden');
      if (idDocInput) idDocInput.value = '';
    });

    // Checkbox toggles styling
    const disabilityCheckbox = overlay.querySelector('#officer-is-disability');
    const disabilityTypeSelect = overlay.querySelector('#officer-disability-type');
    const disabilityDescInput = overlay.querySelector('#officer-disability-desc');

    disabilityCheckbox?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      if (disabilityTypeSelect) disabilityTypeSelect.classList.toggle('opacity-60', !checked);
      if (disabilityDescInput) disabilityDescInput.classList.toggle('opacity-60', !checked);
    });

    const nssfCheckbox = overlay.querySelector('#officer-is-nssf');
    const nssfInput = overlay.querySelector('#officer-nssf-number');

    nssfCheckbox?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      if (nssfInput) nssfInput.classList.toggle('opacity-60', !checked);
    });

    // Save / Submit handler
    overlay.querySelector('#btn-officer-modal-submit')?.addEventListener('click', async () => {
      const form = overlay.querySelector('#officer-main-form');
      if (!form.reportValidity()) return;

      const teacherId = overlay.querySelector('#officer-teacher-id')?.value.trim();
      const civilServantId = overlay.querySelector('#officer-civil-servant-id')?.value.trim() || '';
      const lastNameKhmer = overlay.querySelector('#officer-last-name-km')?.value.trim();
      const firstNameKhmer = overlay.querySelector('#officer-first-name-km')?.value.trim();

      if (!teacherId) {
        toast.error(isKm ? 'សូមបំពេញលេខកូដសម្គាល់គ្រូ (*)' : 'Please fill Teacher Code (*)');
        return;
      }

      if (!lastNameKhmer || !firstNameKhmer) {
        toast.error(isKm ? 'សូមបំពេញគោត្តនាម និងនាមខ្លួនជាភាសាខ្មែរ (*)' : 'Please fill Khmer Last and First names (*)');
        return;
      }

      const lastNameLatin = overlay.querySelector('#officer-last-name-en')?.value.trim().toUpperCase() || '';
      const firstNameLatin = overlay.querySelector('#officer-first-name-en')?.value.trim().toUpperCase() || '';
      const fullNameKm = `${lastNameKhmer} ${firstNameKhmer}`.trim();
      const fullNameEn = `${lastNameLatin} ${firstNameLatin}`.trim();

      const payload = {
        // Basic Identity
        lastNameKhmer,
        firstNameKhmer,
        khmerName: fullNameKm,
        lastNameLatin,
        firstNameLatin,
        englishName: fullNameEn,
        gender: overlay.querySelector('#officer-gender')?.value || 'ប្រុស',
        dob: overlay.querySelector('#officer-dob')?.value || '',
        ethnicity: overlay.querySelector('#officer-ethnicity')?.value || 'ខ្មែរ',

        // Finance & National ID
        nationalId: overlay.querySelector('#officer-national-id')?.value.trim() || '',
        bankAccount: overlay.querySelector('#officer-bank-account')?.value.trim() || '',
        idCardDoc: previewIdDocUrl || '',

        // Birthplace
        birthProvince: overlay.querySelector('#officer-birth-province')?.value || '',
        birthDistrict: overlay.querySelector('#officer-birth-district')?.value.trim() || '',
        birthCommune: overlay.querySelector('#officer-birth-commune')?.value.trim() || '',
        birthVillage: overlay.querySelector('#officer-birth-village')?.value.trim() || '',

        // Current Address & Contact
        phone: overlay.querySelector('#officer-phone')?.value.trim() || '',
        email: overlay.querySelector('#officer-email')?.value.trim() || '',
        houseNumber: overlay.querySelector('#officer-house-number')?.value.trim() || '',
        group: overlay.querySelector('#officer-group')?.value.trim() || '',
        street: overlay.querySelector('#officer-street')?.value.trim() || '',
        currentProvince: overlay.querySelector('#officer-current-province')?.value || '',
        currentDistrict: overlay.querySelector('#officer-current-district')?.value.trim() || '',
        currentCommune: overlay.querySelector('#officer-current-commune')?.value.trim() || '',
        currentVillage: overlay.querySelector('#officer-current-village')?.value.trim() || '',

        // Employment & Identity Code
        teacherId,
        code: teacherId,
        civilServantId,
        joinedDate: overlay.querySelector('#officer-joined-date')?.value || '',
        permanentAppointmentDate: overlay.querySelector('#officer-permanent-date')?.value || '',
        position: overlay.querySelector('#officer-position')?.value.trim() || teacher?.position || 'គ្រូបង្រៀន',
        framework: overlay.querySelector('#officer-framework')?.value.trim() || teacher?.framework || '',
        rankAndGrade: overlay.querySelector('#officer-rank-grade')?.value.trim() || teacher?.rankAndGrade || '',
        status: overlay.querySelector('#officer-work-status')?.value || teacher?.status || 'សកម្ម',
        unit: overlay.querySelector('#officer-unit')?.value.trim() || initialUnit,

        // Disability & Special Membership
        isDisability: overlay.querySelector('#officer-is-disability')?.checked || false,
        disabilityType: overlay.querySelector('#officer-disability-type')?.value || '',
        disabilityDescription: overlay.querySelector('#officer-disability-desc')?.value.trim() || '',
        isNssf: overlay.querySelector('#officer-is-nssf')?.checked || false,
        nssfNumber: overlay.querySelector('#officer-nssf-number')?.value.trim() || '',

        // Secondary Tabs Data
        generalEducationLevel: overlay.querySelector('#officer-gen-edu-level')?.value.trim() || teacher?.generalEducationLevel || '',
        highestDegree: overlay.querySelector('#officer-highest-degree')?.value.trim() || teacher?.highestDegree || '',
        highestDegreeMajor: overlay.querySelector('#officer-degree-major')?.value.trim() || teacher?.highestDegreeMajor || '',
        maritalStatus: overlay.querySelector('#officer-marital-status')?.value || teacher?.maritalStatus || 'Single',
        spouseName: overlay.querySelector('#officer-spouse-name')?.value.trim() || teacher?.spouseName || '',
        spouseJob: overlay.querySelector('#officer-spouse-job')?.value.trim() || teacher?.spouseJob || '',
        subject1: overlay.querySelector('#officer-subject1')?.value.trim() || teacher?.subject1 || '',
        hoursPerWeek1: overlay.querySelector('#officer-hours1')?.value ? Number(overlay.querySelector('#officer-hours1')?.value) : (teacher?.hoursPerWeek1 || 18)
      };

      if (tempPhotoBlob) {
        payload.photoBlob = tempPhotoBlob;
        try {
          payload.photo = await photoService.blobToDataUrl(tempPhotoBlob);
        } catch (_) {
          payload.photo = teacher?.photo || '';
        }
      } else if (previewPhotoUrl === null) {
        payload.photoBlob = null;
        payload.photo = '';
      } else {
        payload.photoBlob = teacher?.photoBlob || null;
        payload.photo = teacher?.photo || '';
      }

      if (tempIdDocBlob) {
        payload.idCardDocBlob = tempIdDocBlob;
      }
      if (previewIdDocUrl) {
        payload.idCardDoc = previewIdDocUrl;
      } else if (previewIdDocUrl === '') {
        payload.idCardDoc = '';
      }

      const submitBtn = overlay.querySelector('#btn-officer-modal-submit');
      submitBtn.disabled = true;

      try {
        if (isEdit) {
          await TeacherService.update(teacher.id, payload);
          toast.success(isKm ? 'បានកែប្រែព័ត៌មានមន្ត្រី/គ្រូបង្រៀនដោយជោគជ័យ' : 'Teacher profile updated successfully!');
        } else {
          await TeacherService.create(payload);
          toast.success(isKm ? 'បានបញ្ចូលមន្ត្រី/គ្រូបង្រៀនថ្មីដោយជោគជ័យ' : 'Teacher profile created successfully!');
        }
        closeModal();
        if (onSave) await onSave();
      } catch (err) {
        toast.error(err.message || 'Error saving teacher profile');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
};
