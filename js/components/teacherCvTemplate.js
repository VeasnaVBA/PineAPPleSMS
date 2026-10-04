/**
 * Official MoEYS Teacher Profile / Curriculum Vitae Report ("ជីវប្រវត្តិមន្ត្រីរាជការ")
 * 
 * Exact 2-Page Virtual A4 Portrait Template matching official MoEYS civil servant structure:
 * - Page 1: Royal Kingdom Header, Emblem/Stars, Photo (4x6 portrait), 
 *           Section ក (Personal Information), 3 Rounded ID Badges (Bank Account, Civil ID, National ID),
 *           Section ខ (Education & Pedagogical Training Table), Section គ (Work History Overview)
 * - Page 2: Work Experience History Table, Section ឃ (Honors & Sanctions), 
 *           Section ង (Family & Spouse Information), Legal Affirmation, Dual Signature Block
 */

import { formatDisplayDate } from '../utils/dateUtils.js';
import { SettingsService } from '../services/settingsService.js';
import { photoService } from '../services/photoService.js';

function toKhmerNumerals(num) {
  if (num === null || num === undefined || num === '') return '';
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(num).replace(/[0-9]/g, d => khmerDigits[d]);
}

export const TeacherCvTemplate = {
  /**
   * Render the 2-Page MoEYS Curriculum Vitae HTML
   * @param {Object} teacher - Normalized teacher object
   * @param {Object} [options]
   * @returns {Promise<string>}
   */
  async render(teacher, options = {}) {
    if (!teacher) return '<div class="p-8 text-center text-muted-foreground">គ្មានទិន្នន័យគ្រូបង្រៀន</div>';

    // Retrieve active school name and district
    let schoolName = options.schoolName || '';
    let districtName = options.districtName || '';

    if (!schoolName) {
      try {
        schoolName = await SettingsService.get('school_name_km') || '';
      } catch (_) {}
    }
    if (!schoolName && teacher.currentProvince) {
      schoolName = teacher.currentProvince;
    }

    // Photo URL extraction
    let photoUrl = '';
    if (teacher.photoBlob) {
      try {
        photoUrl = photoService.getUrlForBlob(teacher.photoBlob);
      } catch (_) {}
    }
    if (!photoUrl && teacher.photo && typeof teacher.photo === 'string' && (teacher.photo.startsWith('data:') || teacher.photo.startsWith('blob:') || teacher.photo.startsWith('http'))) {
      photoUrl = teacher.photo;
    }

    // Formatted Values & Fallbacks
    const khmerName = teacher.khmerName || `${teacher.lastNameKhmer || ''} ${teacher.firstNameKhmer || ''}`.trim() || '................................................';
    const latinName = teacher.englishName || `${teacher.lastNameLatin || ''} ${teacher.firstNameLatin || ''}`.trim() || '................................................';
    const genderKhmer = teacher.gender === 'Female' || teacher.gender === 'ស្រី' ? 'ស្រី' : (teacher.gender === 'Male' || teacher.gender === 'ប្រុស' ? 'ប្រុស' : '................');
    const dobFormatted = formatDisplayDate(teacher.dob || teacher.dateOfBirth) || '........................';
    const joinedDateFormatted = formatDisplayDate(teacher.joinedDate) || '........................';
    const permanentDateFormatted = formatDisplayDate(teacher.permanentAppointmentDate) || '........................';

    // Birthplace & Current Address string builders
    const birthAddressParts = [
      teacher.birthVillage ? `ភូមិ ${teacher.birthVillage}` : '',
      teacher.birthCommune ? `ឃុំ/សង្កាត់ ${teacher.birthCommune}` : '',
      teacher.birthDistrict ? `ស្រុក/ខណ្ឌ ${teacher.birthDistrict}` : '',
      teacher.birthProvince ? `ខេត្ត/រាជធានី ${teacher.birthProvince}` : ''
    ].filter(Boolean).join('  ');
    const birthPlaceStr = birthAddressParts || 'ភូមិ................... ឃុំ/សង្កាត់................... ស្រុក/ខណ្ឌ................... ខេត្ត/រាជធានី...................';

    const currentAddressParts = [
      teacher.currentVillage ? `ភូមិ ${teacher.currentVillage}` : '',
      teacher.currentCommune ? `ឃុំ/សង្កាត់ ${teacher.currentCommune}` : '',
      teacher.currentDistrict ? `ស្រុក/ខណ្ឌ ${teacher.currentDistrict}` : '',
      teacher.currentProvince ? `ខេត្ត/រាជធានី ${teacher.currentProvince}` : ''
    ].filter(Boolean).join('  ');
    const currentAddressStr = currentAddressParts || 'ផ្ទះលេខ..... ផ្លូវ..... ភូមិ................... ឃុំ/សង្កាត់................... ស្រុក/ខណ្ឌ................... ខេត្ត/រាជធានី...................';

    const phoneStr = [teacher.phone1 || teacher.phone, teacher.phone2].filter(Boolean).join(' / ') || '................................................';

    return `
      <div class="teacher-cv-document font-siemreap text-black text-[13px] leading-[1.65] select-text">
        
        <!-- ========================================================================= -->
        <!--                               PAGE 1 / ទំព័រទី ១                            -->
        <!-- ========================================================================= -->
        <div class="teacher-cv-page teacher-cv-page-1 a4-sheet-page relative bg-white mx-auto p-[14mm_16mm] box-border shadow-md print:shadow-none print:p-0 print:m-0" style="min-height: 297mm; max-width: 210mm;">
          
          <!-- Header Area -->
          <div class="grid grid-cols-12 gap-2 items-start mb-3">
            <!-- Top Left: Ministry / District Office & School Unit -->
            <div class="col-span-4 text-center text-[12px] font-bold leading-snug">
              <p class="font-khmer-muol text-[11px] text-blue-900">ការិយាល័យអប់រំ យុវជន និងកីឡា</p>
              <p class="text-[11.5px] text-gray-800">នៃរដ្ឋបាល${districtName ? `ក្រុង/ស្រុក ${districtName}` : 'ក្រុង/ស្រុក/ខណ្ឌ'}</p>
              <p class="text-[12px] mt-1 font-semibold text-blue-900">អង្គភាព ៖ <span class="font-bold underline text-black">${schoolName || '................................'}</span></p>
            </div>

            <!-- Top Center: Royal Kingdom Header & Stars -->
            <div class="col-span-5 text-center leading-relaxed">
              <p class="font-khmer-muol text-[13px] text-blue-950 font-bold">ព្រះរាជាណាចក្រកម្ពុជា</p>
              <p class="font-khmer-muol text-[12.5px] text-blue-950 font-bold">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
              <p class="text-amber-600 text-sm tracking-[3px] font-bold">★★★★★</p>
            </div>

            <!-- Top Right: Photo Frame (4x6 / 3x4 ratio) -->
            <div class="col-span-3 flex justify-end">
              <div class="w-[30mm] h-[40mm] border-2 border-blue-700 rounded-sm bg-blue-50/40 flex flex-col items-center justify-center overflow-hidden shadow-2xs relative print:border-blue-800">
                ${photoUrl 
                  ? `<img src="${photoUrl}" alt="Photo" class="w-full h-full object-cover" />` 
                  : `<div class="text-center p-1 text-blue-800 font-khmer-muol text-[10px] leading-tight">
                       <span>រូបថត ៤x៦</span>
                       <span class="block text-[9px] font-normal text-gray-500 mt-1 font-sans">(ផ្ទៃខៀវ)</span>
                     </div>`}
              </div>
            </div>
          </div>

          <!-- Document Title -->
          <div class="text-center my-2">
            <h1 class="font-khmer-muol text-[16px] text-blue-900 tracking-wide font-bold inline-block border-b-2 border-blue-900 pb-0.5">
              ជីវប្រវត្តិមន្ត្រីរាជការ
            </h1>
            <p class="text-blue-900 text-xs tracking-[4px] mt-0.5">★★★★★★</p>
          </div>

          <!-- Section ក: ព័ត៌មានផ្ទាល់ខ្លួន (Personal Information) -->
          <div class="mt-2 space-y-1.5 text-[12.5px]">
            <div class="flex items-center gap-1.5 font-bold text-blue-950">
              <span class="font-khmer-muol text-[13px]">ក- ព័ត៌មានផ្ទាល់ខ្លួន</span>
            </div>

            <div class="pl-2 space-y-1 text-gray-900">
              <div class="flex flex-wrap items-baseline gap-x-2">
                <span>- នាមត្រកូល និងនាមខ្លួន ៖</span>
                <span class="font-bold font-khmer text-[13.5px] text-black">${khmerName}</span>
                <span class="ml-2">ជាអក្សរឡាតាំង ៖</span>
                <span class="font-bold uppercase tracking-wider text-black">${latinName}</span>
                <span class="ml-2">ភេទ ៖</span>
                <span class="font-bold text-black">${genderKhmer}</span>
              </div>

              <div class="flex items-baseline gap-2">
                <span>- ថ្ងៃ ខែ ឆ្នាំកំណើត ៖</span>
                <span class="font-semibold text-black">${dobFormatted}</span>
              </div>

              <div class="flex items-baseline gap-2">
                <span>- ទីកន្លែងកំណើត ៖</span>
                <span class="text-black">${birthPlaceStr}</span>
              </div>

              <div class="flex items-baseline gap-2">
                <span>- អាសយដ្ឋានបច្ចុប្បន្ន ៖</span>
                <span class="text-black">${currentAddressStr}</span>
              </div>

              <div class="flex items-baseline gap-2">
                <span>- លេខទូរសព្ទទំនាក់ទំនង ៖</span>
                <span class="font-semibold text-black font-mono">${phoneStr}</span>
              </div>
            </div>
          </div>

          <!-- 3 Identification Badges / Rounded Cards -->
          <div class="grid grid-cols-3 gap-3 my-3 text-center">
            <!-- Box 1: Bank Account -->
            <div class="p-2 border-2 border-blue-700 rounded-xl bg-blue-50/20 shadow-2xs">
              <p class="text-[11.5px] font-bold text-blue-900 font-khmer-muol">លេខគណនីធនាគារ</p>
              <p class="text-[12px] font-mono font-bold text-black mt-1">
                លេខ ៖ <span class="text-blue-950">${teacher.bankAccount || '........................'}</span>
              </p>
            </div>

            <!-- Box 2: Civil Servant ID -->
            <div class="p-2 border-2 border-blue-700 rounded-xl bg-blue-50/20 shadow-2xs">
              <p class="text-[11.5px] font-bold text-blue-900 font-khmer-muol">អត្តលេខមន្ត្រីរាជការ</p>
              <p class="text-[12px] font-mono font-bold text-black mt-1">
                លេខ ៖ <span class="text-blue-950">${teacher.civilServantId || '........................'}</span>
              </p>
            </div>

            <!-- Box 3: National ID -->
            <div class="p-2 border-2 border-blue-700 rounded-xl bg-blue-50/20 shadow-2xs">
              <p class="text-[11.5px] font-bold text-blue-900 font-khmer-muol">អត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរ</p>
              <p class="text-[12px] font-mono font-bold text-black mt-1">
                លេខ ៖ <span class="text-blue-950">${teacher.nationalId || '........................'}</span>
              </p>
            </div>
          </div>

          <!-- Section ខ: កម្រិតវប្បធម៌ និងការបណ្តុះបណ្តាល (Education & Training Table) -->
          <div class="mt-2 text-[12px]">
            <div class="font-khmer-muol font-bold text-[13px] text-blue-950 mb-1.5">
              ខ- កម្រិតវប្បធម៌ និងការបណ្តុះបណ្តាល
            </div>

            <table class="w-full border-collapse border border-blue-800 text-[11.5px] leading-tight">
              <thead>
                <tr class="bg-blue-800 text-white font-bold text-center">
                  <th class="border border-blue-800 p-1.5 w-[28%] font-khmer-muol text-[11px]">វគ្គ / កម្រិតសិក្សា</th>
                  <th class="border border-blue-800 p-1.5 w-[26%] font-khmer-muol text-[11px]">គ្រឹះស្ថានសិក្សា / បណ្តុះបណ្តាល</th>
                  <th class="border border-blue-800 p-1.5 w-[20%] font-khmer-muol text-[11px]">សញ្ញាបត្រទទួលបាន</th>
                  <th class="border border-blue-800 p-1.5 w-[13%] font-khmer-muol text-[10.5px]">ថ្ងៃចូលរៀន</th>
                  <th class="border border-blue-800 p-1.5 w-[13%] font-khmer-muol text-[10.5px]">ថ្ងៃបញ្ចប់</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-blue-800">
                <!-- Subheader 1: General Education -->
                <tr class="bg-blue-50/60 font-bold text-blue-950">
                  <td colspan="5" class="border border-blue-800 px-2 py-1 font-semibold">
                    - កម្រិតវប្បធម៌ទូទៅ (General Education)
                  </td>
                </tr>
                <tr>
                  <td class="border border-blue-800 px-2 py-1 text-center font-medium">
                    ${teacher.generalEducationLevel || teacher.highestDegree || 'មធ្យមសិក្សាទុតិយភូមិ/បរិញ្ញាបត្រ'}
                  </td>
                  <td class="border border-blue-800 px-2 py-1 text-center">
                    ${teacher.generalEducationSchool || '........................................'}
                  </td>
                  <td class="border border-blue-800 px-2 py-1 text-center">
                    ${teacher.generalEducationDegree || teacher.highestDegree || '........................'}
                  </td>
                  <td class="border border-blue-800 px-1 py-1 text-center font-mono">
                    ${formatDisplayDate(teacher.generalEducationStart) || '............'}
                  </td>
                  <td class="border border-blue-800 px-1 py-1 text-center font-mono">
                    ${formatDisplayDate(teacher.generalEducationEnd) || '............'}
                  </td>
                </tr>

                <!-- Subheader 2: Pedagogical & Professional Training -->
                <tr class="bg-blue-50/60 font-bold text-blue-950">
                  <td colspan="5" class="border border-blue-800 px-2 py-1 font-semibold">
                    - កម្រិតបណ្តុះបណ្តាលមុខវិជ្ជាជីវៈ / មូលដ្ឋាន និងក្រោយមូលដ្ឋាន (Pedagogical Training)
                  </td>
                </tr>
                <tr>
                  <td class="border border-blue-800 px-2 py-1 text-center font-medium">
                    ${teacher.trainingLevel || 'គរុកោសល្យ និងវិជ្ជាជីវៈ'}
                  </td>
                  <td class="border border-blue-800 px-2 py-1 text-center">
                    ${teacher.highestDegreeMajor ? `ឯកទេស ៖ ${teacher.highestDegreeMajor}` : (teacher.specialization1 ? `ឯកទេស ៖ ${teacher.specialization1}` : 'វិទ្យាស្ថានជាតិអប់រំ / សាលាគរុកោសល្យ')}
                  </td>
                  <td class="border border-blue-800 px-2 py-1 text-center">
                    ${teacher.highestDegree || 'គរុកោសល្យ'}
                  </td>
                  <td class="border border-blue-800 px-1 py-1 text-center font-mono">............</td>
                  <td class="border border-blue-800 px-1 py-1 text-center font-mono">............</td>
                </tr>

                <!-- Subheader 3: Foreign Languages -->
                <tr class="bg-blue-50/60 font-bold text-blue-950">
                  <td colspan="5" class="border border-blue-800 px-2 py-1 font-semibold">
                    - ចំណេះដឹងភាសាបរទេស (Foreign Languages)
                  </td>
                </tr>
                <tr>
                  <td class="border border-blue-800 px-2 py-1 text-center">ភាសាអង់គ្លេស / បារាំង</td>
                  <td class="border border-blue-800 px-2 py-1 text-center">........................................</td>
                  <td class="border border-blue-800 px-2 py-1 text-center">........................</td>
                  <td class="border border-blue-800 px-1 py-1 text-center font-mono">............</td>
                  <td class="border border-blue-800 px-1 py-1 text-center font-mono">............</td>
                </tr>

                <!-- Subheader 4: Short Courses / Workshops -->
                <tr class="bg-blue-50/60 font-bold text-blue-950">
                  <td colspan="5" class="border border-blue-800 px-2 py-1 font-semibold">
                    - ការបណ្តុះបណ្តាល និងវគ្គសិក្សាពាក់ព័ន្ធនានា (Short Courses & Workshops)
                  </td>
                </tr>
                <tr>
                  <td class="border border-blue-800 px-2 py-1 text-center">វគ្គបំប៉នសមត្ថភាពគរុកោសល្យ / ICT</td>
                  <td class="border border-blue-800 px-2 py-1 text-center">........................................</td>
                  <td class="border border-blue-800 px-2 py-1 text-center">វិញ្ញាបនបត្រ</td>
                  <td class="border border-blue-800 px-1 py-1 text-center font-mono">............</td>
                  <td class="border border-blue-800 px-1 py-1 text-center font-mono">............</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Section គ: ប្រវត្តិការងារ (Work History Summary) -->
          <div class="mt-2.5 space-y-1.5 text-[12.5px]">
            <div class="font-khmer-muol font-bold text-[13px] text-blue-950">
              គ- ប្រវត្តិការងារ
            </div>

            <div class="pl-2 space-y-1 text-gray-900">
              <div class="flex items-baseline gap-2">
                <span>- ថ្ងៃ ខែ ឆ្នាំចូលបម្រើការងារក្នុងក្របខណ្ឌ ៖</span>
                <span class="font-semibold text-black">${joinedDateFormatted}</span>
              </div>

              <div class="flex items-baseline gap-2">
                <span>- ថ្ងៃ ខែ ឆ្នាំតាំងស៊ប់ក្នុងក្របខណ្ឌបច្ចុប្បន្ន ៖</span>
                <span class="font-semibold text-black">${permanentDateFormatted}</span>
              </div>

              <div class="flex flex-wrap items-baseline gap-x-3">
                <span>- មុខតំណែងបច្ចុប្បន្ន ៖</span>
                <span class="font-bold text-black">${teacher.position || 'គ្រូបង្រៀន'}</span>
                <span class="ml-2">អង្គភាព ៖</span>
                <span class="font-semibold text-black">${schoolName || '................................'}</span>
              </div>

              <div class="flex flex-wrap items-baseline gap-x-3">
                <span>- ប្រភេទក្របខណ្ឌ ៖</span>
                <span class="font-semibold text-black">${teacher.framework || '................................'}</span>
                <span class="ml-2">ឋានន្តរស័ក្តិ និងថ្នាក់ ៖</span>
                <span class="font-semibold text-black">${teacher.rankAndGrade || '................................'}</span>
              </div>
            </div>
          </div>

          <!-- Page 1 Bottom Indicator -->
          <div class="absolute bottom-3 left-0 right-0 text-center text-[10px] text-gray-400 font-mono">
            - ទំព័រទី ១ -
          </div>
        </div>

        <!-- ========================================================================= -->
        <!--                               PAGE 2 / ទំព័រទី ២                            -->
        <!-- ========================================================================= -->
        <div class="teacher-cv-page teacher-cv-page-2 a4-sheet-page relative bg-white mx-auto p-[14mm_16mm] box-border shadow-md print:shadow-none print:p-0 print:m-0 mt-6 print:mt-0" style="min-height: 297mm; max-width: 210mm;">
          
          <!-- Detailed Work Experience History Table -->
          <div class="text-[12px]">
            <p class="font-bold text-blue-950 mb-1.5 font-khmer">
              * ប្រវត្តិការងារកន្លងមក (ក្រសួង ស្ថាប័ន ឬអង្គភាពផ្សេងៗ) ៖
            </p>

            <table class="w-full border-collapse border border-blue-800 text-[11.5px] leading-tight">
              <thead>
                <tr class="bg-blue-800 text-white font-bold text-center">
                  <th class="border border-blue-800 p-1.5 w-[20%] font-khmer-muol text-[10.5px]">ថ្ងៃចូលបម្រើការងារ</th>
                  <th class="border border-blue-800 p-1.5 w-[20%] font-khmer-muol text-[10.5px]">ថ្ងៃបញ្ចប់ការងារ</th>
                  <th class="border border-blue-800 p-1.5 w-[25%] font-khmer-muol text-[11px]">មុខតំណែង</th>
                  <th class="border border-blue-800 p-1.5 w-[35%] font-khmer-muol text-[11px]">ក្រសួង ស្ថាប័ន អង្គភាព</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-blue-800">
                <tr>
                  <td class="border border-blue-800 px-2 py-1.5 text-center font-mono font-medium">${joinedDateFormatted}</td>
                  <td class="border border-blue-800 px-2 py-1.5 text-center font-mono">បច្ចុប្បន្ន</td>
                  <td class="border border-blue-800 px-2 py-1.5 text-center font-semibold">${teacher.position || 'គ្រូបង្រៀន'}</td>
                  <td class="border border-blue-800 px-2 py-1.5 text-center">${schoolName || 'ក្រសួងអប់រំ យុវជន និងកីឡា'}</td>
                </tr>
                <tr>
                  <td class="border border-blue-800 px-2 py-1.5 text-center font-mono">............</td>
                  <td class="border border-blue-800 px-2 py-1.5 text-center font-mono">............</td>
                  <td class="border border-blue-800 px-2 py-1.5 text-center">........................</td>
                  <td class="border border-blue-800 px-2 py-1.5 text-center">ការសាកល្បងដោយក្រសួងមហាផ្ទៃ / រដ្ឋបាលថ្នាក់ក្រោមជាតិ</td>
                </tr>
                <tr>
                  <td class="border border-blue-800 px-2 py-1.5 text-center font-mono">............</td>
                  <td class="border border-blue-800 px-2 py-1.5 text-center font-mono">............</td>
                  <td class="border border-blue-800 px-2 py-1.5 text-center">........................</td>
                  <td class="border border-blue-800 px-2 py-1.5 text-center">ការបម្រើការងារក្នុងវិស័យឯកជន ឬអង្គការក្រៅរដ្ឋាភិបាល</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Section ឃ: ការសរសើរ និងទណ្ឌកម្មវិន័យ (Honors & Sanctions) -->
          <div class="mt-3 text-[12px]">
            <div class="font-khmer-muol font-bold text-[13px] text-blue-950 mb-1.5">
              ឃ- ការសរសើរ និងទណ្ឌកម្មវិន័យ
            </div>

            <!-- 1. Honors / Awards -->
            <p class="font-semibold text-blue-900 mb-1">១- ការសរសើរជូនរង្វាន់ ៖</p>
            <table class="w-full border-collapse border border-blue-800 text-[11px] leading-tight mb-2">
              <thead>
                <tr class="bg-blue-800 text-white font-bold text-center">
                  <th class="border border-blue-800 p-1 w-[20%] font-khmer-muol text-[10px]">ឯកសារបញ្ជាក់</th>
                  <th class="border border-blue-800 p-1 w-[18%] font-khmer-muol text-[10px]">កាលបរិច្ឆេទ</th>
                  <th class="border border-blue-800 p-1 w-[22%] font-khmer-muol text-[10px]">ក្រសួង / ស្ថាប័ន</th>
                  <th class="border border-blue-800 p-1 w-[20%] font-khmer-muol text-[10px]">ប្រភេទរង្វាន់</th>
                  <th class="border border-blue-800 p-1 w-[20%] font-khmer-muol text-[10px]">ខ្លឹមសារ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="border border-blue-800 p-1 text-center">........................</td>
                  <td class="border border-blue-800 p-1 text-center font-mono">............</td>
                  <td class="border border-blue-800 p-1 text-center">........................</td>
                  <td class="border border-blue-800 p-1 text-center">មេដាយការងារ / ប័ណ្ណសរសើរ</td>
                  <td class="border border-blue-800 p-1 text-center">........................</td>
                </tr>
              </tbody>
            </table>

            <!-- 2. Sanctions / Disciplinary -->
            <p class="font-semibold text-blue-900 mb-1">២- ទណ្ឌកម្មវិន័យ ៖</p>
            <table class="w-full border-collapse border border-blue-800 text-[11px] leading-tight">
              <thead>
                <tr class="bg-blue-800 text-white font-bold text-center">
                  <th class="border border-blue-800 p-1 w-[20%] font-khmer-muol text-[10px]">ឯកសារបញ្ជាក់</th>
                  <th class="border border-blue-800 p-1 w-[18%] font-khmer-muol text-[10px]">កាលបរិច្ឆេទ</th>
                  <th class="border border-blue-800 p-1 w-[22%] font-khmer-muol text-[10px]">ក្រសួង / ស្ថាប័ន</th>
                  <th class="border border-blue-800 p-1 w-[20%] font-khmer-muol text-[10px]">ប្រភេទកំហុស</th>
                  <th class="border border-blue-800 p-1 w-[20%] font-khmer-muol text-[10px]">ទណ្ឌកម្ម</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="border border-blue-800 p-1 text-center">គ្មាន</td>
                  <td class="border border-blue-800 p-1 text-center font-mono">............</td>
                  <td class="border border-blue-800 p-1 text-center">........................</td>
                  <td class="border border-blue-800 p-1 text-center">គ្មាន</td>
                  <td class="border border-blue-800 p-1 text-center">គ្មាន</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Section ង: ព័ត៌មានគ្រួសារ (Family & Spouse Information) -->
          <div class="mt-3 space-y-1.5 text-[12.5px]">
            <div class="font-khmer-muol font-bold text-[13px] text-blue-950">
              ង- ព័ត៌មានគ្រួសារ
            </div>

            <div class="pl-2 space-y-1 text-gray-900">
              ${(teacher.maritalStatus === 'Single' || (!teacher.spouseName && teacher.maritalStatus !== 'Married' && teacher.maritalStatus !== 'Divorced' && teacher.maritalStatus !== 'Widowed')) 
                ? `
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <span>- ស្ថានភាពគ្រួសារ ៖</span>
                  <span class="font-bold text-black">នៅលីវ (Single)</span>
                </div>
                ` : `
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <span>- ប្រពន្ធ ឬប្តីឈ្មោះ ៖</span>
                  <span class="font-bold text-black">${teacher.spouseName || '................................................'}</span>
                  <span class="ml-2">ថ្ងៃខែឆ្នាំកំណើត ៖</span>
                  <span class="font-semibold text-black font-mono">${formatDisplayDate(teacher.spouseDob) || '........................'}</span>
                  <span class="ml-2">មុខរបរ ៖</span>
                  <span class="font-semibold text-black">${teacher.spouseJob || '................................'}</span>
                </div>

                <div class="flex flex-wrap items-baseline gap-x-3">
                  <span>- អាសយដ្ឋានបច្ចុប្បន្ន ៖</span>
                  <span class="text-black">${teacher.spouseAddress || currentAddressStr}</span>
                  <span class="ml-2">ទូរសព្ទ ៖</span>
                  <span class="font-mono font-semibold text-black">${teacher.spousePhone || '........................'}</span>
                </div>
                `}

              <div class="flex items-baseline gap-2">
                <span>- ចំនួនកូនក្នុងបន្ទុក ៖</span>
                <span class="font-semibold text-black">${teacher.childrenCount || (teacher.maritalStatus === 'Single' ? 'គ្មាន' : '...... នាក់ (ស្រី ... នាក់, ប្រុស ... នាក់)')}</span>
              </div>

              <div class="flex flex-wrap items-baseline gap-x-2">
                <span>- ឪពុកបង្កើតឈ្មោះ ៖</span>
                <span class="font-bold text-black">${teacher.fatherName || '................................'}</span>
                <span class="ml-2">ទីកន្លែងកំណើត ៖</span>
                <span class="text-black">${teacher.fatherBirthplace || '................................................................'}</span>
              </div>

              <div class="flex flex-wrap items-baseline gap-x-2">
                <span>- ម្តាយបង្កើតឈ្មោះ ៖</span>
                <span class="font-bold text-black">${teacher.motherName || '................................'}</span>
                <span class="ml-2">ទីកន្លែងកំណើត ៖</span>
                <span class="text-black">${teacher.motherBirthplace || '................................................................'}</span>
              </div>
            </div>
          </div>

          <!-- Legal Affirmation Statement -->
          <div class="mt-3 p-2 rounded bg-blue-50/40 border border-blue-200 text-center text-[12px] font-semibold text-blue-950 leading-relaxed">
            « ខ្ញុំសូមធានាអះអាងចំពោះមុខច្បាប់ថា សេចក្តីរាយការណ៍ក្នុងជីវប្រវត្តិខាងលើនេះពិតជាត្រឹមត្រូវទាំងអស់។ »
          </div>

          <!-- Dual Signature Block -->
          <div class="grid grid-cols-2 gap-4 mt-4 pt-1 text-center text-[12px] leading-snug">
            <!-- Left: School Director / Head of Unit Certification -->
            <div class="space-y-1">
              <p class="font-bold font-khmer-muol text-[11.5px] text-blue-950">បានឃើញ និងបញ្ជាក់</p>
              <p class="text-[11.5px] text-gray-700">ថ្ងៃទី......... ខែ......... ឆ្នាំ២០២...</p>
              <p class="font-bold font-khmer-muol text-[11.5px] text-blue-900 mt-1">នាយកសាលា / ប្រធានអង្គភាព</p>
              <div class="h-16 flex items-end justify-center">
                <span class="text-[11px] text-gray-400 italic">(ហត្ថលេខា និងត្រា)</span>
              </div>
            </div>

            <!-- Right: Teacher Self Signature -->
            <div class="space-y-1">
              <p class="text-[11.5px] text-gray-700">ធ្វើនៅ...................., ថ្ងៃទី......... ខែ......... ឆ្នាំ២០២...</p>
              <p class="font-bold font-khmer-muol text-[11.5px] text-blue-900 mt-1">ហត្ថលេខា និងឈ្មោះសាមីខ្លួន</p>
              <div class="h-16 flex items-end justify-center">
                <span class="font-bold font-khmer text-black text-[13px] underline">${khmerName !== '................................................' ? khmerName : ''}</span>
              </div>
            </div>
          </div>

          <!-- Page 2 Bottom Indicator -->
          <div class="absolute bottom-3 left-0 right-0 text-center text-[10px] text-gray-400 font-mono">
            - ទំព័រទី ២ -
          </div>
        </div>

      </div>
    `;
  }
};
