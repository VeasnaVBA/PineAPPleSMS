/**
 * Excel & JSON Export/Import Service for Teacher Management
 * 
 * Supports full 44 official MoEYS civil servant columns with:
 * - ExcelJS stylized .xlsx workbook generation (Khmer OS Siemreap font, 30pt deep-blue #1E40AF header, auto widths)
 * - Clean JSON export/backup
 * - Resilient Excel & JSON import with automatic age & retirement date (DOB + 60) calculation
 * - Duplicate detection (civilServantId, nationalId, teacherId) with Skip or Overwrite options
 * - RBAC security enforcement (Teachers restricted to single profile; Director/Admin full bulk import)
 * - Automated Google Drive Cloud Sync triggering via syncStateManager.markDirty()
 */

import { db } from '../database/db.js';
import { authService } from './authService.js';
import { normalizeTeacherRecord, calculateAge, calculateRetirementDate } from './teacherService.js';
import { syncStateManager } from './syncStateManager.js';
import { formatDisplayDate, toInputDateFormat } from '../utils/dateUtils.js';

/**
 * Sequential specification of all 44 MoEYS Teacher columns
 */
export const TEACHER_EXCEL_COLUMNS = [
  { index: 1,  key: 'status',                   headerKm: 'ស្ថានភាព',                   headerEn: 'Status',                 center: true,  default: 'Active' },
  { index: 2,  key: 'rowNo',                    headerKm: 'ល.រ',                        headerEn: 'No.',                    center: true,  isVirtual: true },
  { index: 3,  key: 'teacherId',                headerKm: 'លេខសម្គាល់',                 headerEn: 'Teacher ID',             center: true,  required: true },
  { index: 4,  key: 'civilServantId',           headerKm: 'អត្តលេខមន្រ្តីរាជការ',         headerEn: 'Civil Servant ID',       center: true },
  { index: 5,  key: 'nationalId',               headerKm: 'លេខអត្តសញ្ញាណប័ណ្ណ',           headerEn: 'National ID',            center: true },
  { index: 6,  key: 'bankAccount',              headerKm: 'លេខគណនីធនាគារ',              headerEn: 'Bank Account Number',    center: true },
  { index: 7,  key: 'lastNameKhmer',            headerKm: 'ត្រកូល',                     headerEn: 'Khmer Surname',          required: true },
  { index: 8,  key: 'firstNameKhmer',           headerKm: 'នាមខ្លួន',                    headerEn: 'Khmer First Name',       required: true },
  { index: 9,  key: 'lastNameLatin',            headerKm: 'ត្រកូលឡាតាំង',               headerEn: 'Latin Surname' },
  { index: 10, key: 'firstNameLatin',           headerKm: 'នាមខ្លួនឡាតាំង',              headerEn: 'Latin First Name' },
  { index: 11, key: 'gender',                   headerKm: 'ភេទ',                        headerEn: 'Gender',                 center: true,  default: 'Male' },
  { index: 12, key: 'dob',                      headerKm: 'ថ្ងៃខែឆ្នាំកំណើត',           headerEn: 'Date of Birth',          center: true },
  { index: 13, key: 'age',                      headerKm: 'អាយុ',                       headerEn: 'Age',                    center: true },
  { index: 14, key: 'joinedDate',               headerKm: 'ថ្ងៃខែឆ្នាំចូលបម្រើការងារ',   headerEn: 'Date Joined',            center: true },
  { index: 15, key: 'permanentAppointmentDate', headerKm: 'ថ្ងៃតាំងស៊ប់',               headerEn: 'Permanent Date',         center: true },
  { index: 16, key: 'retirementDate',           headerKm: 'ថ្ងៃខែឆ្នាំចូលនិវត្តន៍',       headerEn: 'Retirement Date',        center: true },
  { index: 17, key: 'birthVillage',             headerKm: 'ភូមិកំណើត',                   headerEn: 'Birth Village' },
  { index: 18, key: 'birthCommune',             headerKm: 'ឃុំកំណើត',                    headerEn: 'Birth Commune' },
  { index: 19, key: 'birthDistrict',            headerKm: 'ស្រុកកំណើត',                  headerEn: 'Birth District' },
  { index: 20, key: 'birthProvince',            headerKm: 'ខេត្តកំណើត',                  headerEn: 'Birth Province' },
  { index: 21, key: 'currentVillage',           headerKm: 'ភូមិបច្ចុប្បន្ន',              headerEn: 'Current Village' },
  { index: 22, key: 'currentCommune',           headerKm: 'ឃុំបច្ចុប្បន្ន',               headerEn: 'Current Commune' },
  { index: 23, key: 'currentDistrict',          headerKm: 'ស្រុកបច្ចុប្បន្ន',             headerEn: 'Current District' },
  { index: 24, key: 'currentProvince',          headerKm: 'ខេត្តបច្ចុប្បន្ន',             headerEn: 'Current Province' },
  { index: 25, key: 'workStatus',               headerKm: 'ស្ថានភាពការងារ',             headerEn: 'Work Status' },
  { index: 26, key: 'framework',                headerKm: 'ក្របខណ្ឌ',                   headerEn: 'Framework' },
  { index: 27, key: 'rankAndGrade',             headerKm: 'ឋាន្តរស័ក្តិ និងថ្នាក់',         headerEn: 'Rank and Grade' },
  { index: 28, key: 'position',                 headerKm: 'មុខតំណែង',                   headerEn: 'Position' },
  { index: 29, key: 'trainingLevel',            headerKm: 'កម្រិតបណ្តុះបណ្តាល',           headerEn: 'Training Level' },
  { index: 30, key: 'specialization1',          headerKm: 'ឯកទេសទី១',                   headerEn: 'Specialization 1' },
  { index: 31, key: 'specialization2',          headerKm: 'ឯកទេសទី២',                   headerEn: 'Specialization 2' },
  { index: 32, key: 'taskAssignment',           headerKm: 'បំណែងចែកភារកិច្ច',           headerEn: 'Task Assignment' },
  { index: 33, key: 'additionalDuties',         headerKm: 'ភារកិច្ចបន្ថែម',               headerEn: 'Additional Duties' },
  { index: 34, key: 'highestDegree',            headerKm: 'សញ្ញាបត្រចុងក្រោយ',           headerEn: 'Highest Degree' },
  { index: 35, key: 'highestDegreeMajor',       headerKm: 'ឯកទេសសញ្ញាបត្រចុងក្រោយ',     headerEn: 'Highest Degree Major' },
  { index: 36, key: 'subject1',                 headerKm: 'មុខវិជ្ជាទី១',                 headerEn: 'Subject 1' },
  { index: 37, key: 'hoursPerWeek1',            headerKm: 'ចំនួនម៉ោងទី១',               headerEn: 'Hours 1',                center: true },
  { index: 38, key: 'subject2',                 headerKm: 'មុខវិជ្ជាទី២',                 headerEn: 'Subject 2' },
  { index: 39, key: 'hoursPerWeek2',            headerKm: 'ចំនួនម៉ោងទី២',               headerEn: 'Hours 2',                center: true },
  { index: 40, key: 'subject3',                 headerKm: 'មុខវិជ្ជាទី៣',                 headerEn: 'Subject 3' },
  { index: 41, key: 'hoursPerWeek3',            headerKm: 'ចំនួនម៉ោងទី៣',               headerEn: 'Hours 3',                center: true },
  { index: 42, key: 'phone1',                   headerKm: 'លេខទូរសព្ទទី១',               headerEn: 'Phone 1',                center: true },
  { index: 43, key: 'phone2',                   headerKm: 'លេខទូរសព្ទទី២',               headerEn: 'Phone 2',                center: true },
  { index: 44, key: 'telegram',                 headerKm: 'តេឡេក្រាម',                   headerEn: 'Telegram' },
  { index: 45, key: 'email',                    headerKm: 'អ៊ីមែល',                     headerEn: 'Email' },
  { index: 46, key: 'notes',                    headerKm: 'ផ្សេងៗ',                     headerEn: 'Notes' }
];

export const ExcelExportService = {
  /**
   * Get active ExcelJS instance
   */
  getExcelJS() {
    if (typeof window !== 'undefined' && window.ExcelJS) {
      return window.ExcelJS;
    }
    if (typeof globalThis !== 'undefined' && globalThis.ExcelJS) {
      return globalThis.ExcelJS;
    }
    throw new Error('ExcelJS library is not loaded. Please ensure exceljs.min.js is included.');
  },

  /**
   * Get active XLSX (SheetJS) instance
   */
  getXLSX() {
    if (typeof window !== 'undefined' && window.XLSX) {
      return window.XLSX;
    }
    if (typeof globalThis !== 'undefined' && globalThis.XLSX) {
      return globalThis.XLSX;
    }
    throw new Error('SheetJS (XLSX) library is not loaded.');
  },

  /**
   * Build column headers list
   */
  getHeaders(lang = 'km') {
    return TEACHER_EXCEL_COLUMNS.map(col => lang === 'en' ? col.headerEn : col.headerKm);
  },

  /**
   * Generate dynamic filename for Teacher exports
   */
  generateTeacherExportFilename(activeFilters = {}) {
    const cleanStr = (str) => (str || '').toString().trim().replace(/[\/\\:*?"<>|]/g, '_');
    
    // Check specific filter conditions
    if (activeFilters.academicYear && activeFilters.academicYear !== 'all') {
      const yearStr = cleanStr(activeFilters.academicYear).replace(/\s+/g, '');
      return `បញ្ជីឈ្មោះគ្រូបង្រៀន_${yearStr}.xlsx`;
    }

    if (activeFilters.framework && activeFilters.framework !== 'all') {
      const fwStr = cleanStr(activeFilters.framework);
      return `បញ្ជីឈ្មោះគ្រូបង្រៀន_${fwStr}.xlsx`;
    }

    if (activeFilters.position && activeFilters.position !== 'all') {
      const posStr = cleanStr(activeFilters.position);
      return `បញ្ជីឈ្មោះគ្រូបង្រៀន_${posStr}.xlsx`;
    }

    if (activeFilters.status && activeFilters.status !== 'all') {
      const stStr = cleanStr(activeFilters.status);
      return `បញ្ជីឈ្មោះគ្រូបង្រៀន_${stStr}.xlsx`;
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `បញ្ជីឈ្មោះគ្រូបង្រៀន_ទាំងអស់_${yyyy}-${mm}-${dd}.xlsx`;
  },

  /**
   * Universal Buffer to Blob file downloader
   */
  saveBufferAsFile(buffer, filename, mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  },

  /**
   * Export teachers to stylized Excel (.xlsx) file
   */
  async exportTeachersToExcel(teachersList = [], { activeFilters = {}, lang = 'km' } = {}) {
    const ExcelJS = this.getExcelJS();

    // 1. Role enforcement: If teacher account, restrict export strictly to own profile
    let exportable = [...teachersList];
    const currentUser = authService.getCurrentUser();
    if (currentUser?.role === 'TEACHER') {
      exportable = exportable.filter(t => t.userId === currentUser.id || t.accountId === currentUser.id || t.teacherId === currentUser.username);
    }

    // 2. Prepare headers
    const headers = this.getHeaders(lang);

    // 3. Map rows strictly matching 44 columns
    const rows = exportable.map((teacher, idx) => {
      const norm = normalizeTeacherRecord(teacher);
      const rowNo = idx + 1;

      // Auto ensure age and retirement date are calculated
      const dobVal = norm.dob || norm.dateOfBirth || '';
      const computedAge = dobVal ? calculateAge(dobVal) : (norm.age || '');
      const computedRetirement = dobVal ? calculateRetirementDate(dobVal) : (norm.retirementDate || '');

      return [
        norm.status || 'Active',                                  // 1. ស្ថានភាព
        rowNo,                                                    // 2. ល.រ
        norm.teacherId || '',                                     // 3. លេខសម្គាល់
        norm.civilServantId || '',                                // 4. អត្តលេខមន្រ្តីរាជការ
        norm.nationalId || '',                                    // 5. លេខអត្តសញ្ញាណប័ណ្ណ
        norm.lastNameKhmer || '',                                 // 6. ត្រកូល
        norm.firstNameKhmer || '',                                // 7. នាមខ្លួន
        norm.lastNameLatin || '',                                 // 8. ត្រកូលឡាតាំង
        norm.firstNameLatin || '',                                // 9. នាមខ្លួនឡាតាំង
        norm.gender || 'Male',                                    // 10. ភេទ
        formatDisplayDate(dobVal) || '',                          // 11. ថ្ងៃខែឆ្នាំកំណើត
        computedAge !== '' ? computedAge : '',                    // 12. អាយុ
        formatDisplayDate(norm.joinedDate) || norm.joinedDate || '', // 13. ថ្ងៃខែឆ្នាំចូលបម្រើការងារ
        formatDisplayDate(computedRetirement) || computedRetirement || '', // 14. ថ្ងៃខែឆ្នាំចូលនិវត្តន៍
        norm.birthVillage || '',                                  // 15. ភូមិកំណើត
        norm.birthCommune || '',                                  // 16. ឃុំកំណើត
        norm.birthDistrict || '',                                 // 17. ស្រុកកំណើត
        norm.birthProvince || '',                                 // 18. ខេត្តកំណើត
        norm.currentVillage || '',                                // 19. ភូមិបច្ចុប្បន្ន
        norm.currentCommune || '',                                // 20. ឃុំបច្ចុប្បន្ន
        norm.currentDistrict || '',                               // 21. ស្រុកបច្ចុប្បន្ន
        norm.currentProvince || '',                               // 22. ខេត្តបច្ចុប្បន្ន
        norm.workStatus || '',                                    // 23. ស្ថានភាពការងារ
        norm.framework || '',                                     // 24. ក្របខណ្ឌ
        norm.rankAndGrade || '',                                  // 25. ឋាន្តរស័ក្តិ និងថ្នាក់
        norm.position || '',                                      // 26. មុខតំណែង
        norm.trainingLevel || '',                                 // 27. កម្រិតបណ្តុះបណ្តាល
        norm.specialization1 || '',                               // 28. ឯកទេសទី១
        norm.specialization2 || '',                               // 29. ឯកទេសទី២
        norm.taskAssignment || '',                                // 30. បំណែងចែកភារកិច្ច
        norm.additionalDuties || '',                              // 31. ភារកិច្ចបន្ថែម
        norm.highestDegree || '',                                 // 32. សញ្ញាបត្រចុងក្រោយ
        norm.highestDegreeMajor || '',                            // 33. ឯកទេសសញ្ញាបត្រចុងក្រោយ
        norm.subject1 || norm.subject || '',                      // 34. មុខវិជ្ជាទី១
        norm.hoursPerWeek1 !== undefined && norm.hoursPerWeek1 !== '' ? norm.hoursPerWeek1 : '', // 35. ចំនួនម៉ោងទី១
        norm.subject2 || '',                                      // 36. មុខវិជ្ជាទី២
        norm.hoursPerWeek2 !== undefined && norm.hoursPerWeek2 !== '' ? norm.hoursPerWeek2 : '', // 37. ចំនួនម៉ោងទី២
        norm.subject3 || '',                                      // 38. មុខវិជ្ជាទី៣
        norm.hoursPerWeek3 !== undefined && norm.hoursPerWeek3 !== '' ? norm.hoursPerWeek3 : '', // 39. ចំនួនម៉ោងទី៣
        norm.phone1 || norm.phone || '',                          // 40. លេខទូរសព្ទទី១
        norm.phone2 || '',                                        // 41. លេខទូរសព្ទទី២
        norm.telegram || '',                                      // 42. តេឡេក្រាម
        norm.email || '',                                         // 43. អ៊ីមែល
        norm.notes || ''                                          // 44. ផ្សេងៗ
      ];
    });

    // 4. Create Workbook and Worksheet
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SmartSchool Management System';
    workbook.lastModifiedBy = 'SmartSchool';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheetName = lang === 'km' ? 'បញ្ជីឈ្មោះគ្រូបង្រៀន' : 'Teachers';
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }]
    });

    // 5. Header Row (Row 1): Height: 30pt, Fill: #1E40AF (Deep blue), Font: Khmer OS Siemreap 12pt Bold White, Centered
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Khmer OS Siemreap',
        size: 12,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });

    // 6. Data Rows: Height: 24pt, Font: Khmer OS Siemreap 11pt, Thin Borders, Zebra striping
    const centerIndices = new Set(
      TEACHER_EXCEL_COLUMNS.filter(c => c.center).map(c => c.index)
    );

    rows.forEach((rowData, index) => {
      const row = worksheet.addRow(rowData);
      row.height = 24;
      const isEven = index % 2 === 1;
      const rowFill = isEven ? {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
      } : {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' }
      };

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = {
          name: 'Khmer OS Siemreap',
          size: 11,
          color: { argb: 'FF0F172A' }
        };
        cell.fill = rowFill;
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        const isCentered = centerIndices.has(colNumber);
        cell.alignment = {
          vertical: 'middle',
          horizontal: isCentered ? 'center' : 'left',
          wrapText: false
        };
      });
    });

    // 7. Auto Column Widths: Math.max(headerLength, maxContentLength) + 5
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
        if (val.length > maxLength) {
          maxLength = val.length;
        }
      });
      column.width = Math.min(Math.max(maxLength + 5, 12), 48);
    });

    // 8. Generate dynamic filename and trigger download
    const filename = this.generateTeacherExportFilename(activeFilters);
    const buffer = await workbook.xlsx.writeBuffer();
    this.saveBufferAsFile(buffer, filename);

    return { filename, count: exportable.length };
  },

  /**
   * Export teachers to clean, formatted JSON backup (.json)
   */
  exportTeachersToJSON(teachersList = [], { activeFilters = {} } = {}) {
    let exportable = [...teachersList];
    const currentUser = authService.getCurrentUser();
    if (currentUser?.role === 'TEACHER') {
      exportable = exportable.filter(t => t.userId === currentUser.id || t.accountId === currentUser.id || t.teacherId === currentUser.username);
    }

    const normalizedData = exportable.map(t => {
      const norm = normalizeTeacherRecord(t);
      // Remove local runtime blob handles if any
      const copy = { ...norm };
      delete copy.photoBlob;
      return copy;
    });

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `teachers_backup_${yyyy}-${mm}-${dd}.json`;

    const jsonString = JSON.stringify(normalizedData, null, 2);
    this.saveBufferAsFile(new TextEncoder().encode(jsonString), filename, 'application/json');

    return { filename, count: normalizedData.length };
  },

  /**
   * Download sample 44-column Excel Template
   */
  async downloadSampleTemplate(lang = 'km') {
    const ExcelJS = this.getExcelJS();
    const headers = this.getHeaders(lang);

    const sampleRow = [
      'Active',                             // 1. ស្ថានភាព
      1,                                    // 2. ល.រ
      'TCH-001',                            // 3. លេខសម្គាល់
      '12345678',                           // 4. អត្តលេខមន្រ្តីរាជការ
      '010203040',                          // 5. លេខអត្តសញ្ញាណប័ណ្ណ
      'សុក',                                // 6. ត្រកូល
      'សុផល',                               // 7. នាមខ្លួន
      'SOK',                                // 8. ត្រកូលឡាតាំង
      'Sophal',                             // 9. នាមខ្លួនឡាតាំង
      'Male',                               // 10. ភេទ
      '1985-05-15',                         // 11. ថ្ងៃខែឆ្នាំកំណើត
      41,                                   // 12. អាយុ
      '2010-10-01',                         // 13. ថ្ងៃខែឆ្នាំចូលបម្រើការងារ
      '2045-05-15',                         // 14. ថ្ងៃខែឆ្នាំចូលនិវត្តន៍
      'ភូមិ១',                              // 15. ភូមិកំណើត
      'សង្កាត់បឹងកក់១',                    // 16. ឃុំកំណើត
      'ខណ្ឌទួលគោក',                        // 17. ស្រុកកំណើត
      'រាជធានីភ្នំពេញ',                     // 18. ខេត្តកំណើត
      'ភូមិ១',                              // 19. ភូមិបច្ចុប្បន្ន
      'សង្កាត់បឹងកក់១',                    // 20. ឃុំបច្ចុប្បន្ន
      'ខណ្ឌទួលគោក',                        // 21. ស្រុកបច្ចុប្បន្ន
      'រាជធានីភ្នំពេញ',                     // 22. ខេត្តបច្ចុប្បន្ន
      'បំពេញការងារ',                        // 23. ស្ថានភាពការងារ
      'គ្រូបង្រៀនកម្រិតឧត្តម',               // 24. ក្របខណ្ឌ
      'ក.១.១',                              // 25. ឋាន្តរស័ក្តិ និងថ្នាក់
      'គ្រូបង្រៀន',                         // 26. មុខតំណែង
      'បរិញ្ញាបត្រ+១',                      // 27. កម្រិតបណ្តុះបណ្តាល
      'គណិតវិទ្យា',                         // 28. ឯកទេសទី១
      'រូបវិទ្យា',                          // 29. ឯកទេសទី២
      'បង្រៀនថ្នាក់ទី១០ និងទី១១',            // 30. បំណែងចែកភារកិច្ច
      'ប្រធានក្រុមបច្ចេកទេស',               // 31. ភារកិច្ចបន្ថែម
      'បរិញ្ញាបត្រជាន់ខ្ពស់',                 // 32. សញ្ញាបត្រចុងក្រោយ
      'គណិតវិទ្យាអប់រំ',                    // 33. ឯកទេសសញ្ញាបត្រចុងក្រោយ
      'គណិតវិទ្យា',                         // 34. មុខវិជ្ជាទី១
      16,                                   // 35. ចំនួនម៉ោងទី១
      'រូបវិទ្យា',                          // 36. មុខវិជ្ជាទី២
      4,                                    // 37. ចំនួនម៉ោងទី២
      '',                                   // 38. មុខវិជ្ជាទី៣
      '',                                   // 39. ចំនួនម៉ោងទី៣
      '012345678',                          // 40. លេខទូរសព្ទទី១
      '098765432',                          // 41. លេខទូរសព្ទទី២
      '@soksophal',                         // 42. តេឡេក្រាម
      'sok.sophal@school.edu.kh',           // 43. អ៊ីមែល
      'គ្រូបង្រៀនគំរូ'                      // 44. ផ្សេងៗ
    ];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Teacher_Template', {
      views: [{ showGridLines: true }]
    });

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Khmer OS Siemreap', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });

    const dataRow = worksheet.addRow(sampleRow);
    dataRow.height = 24;
    dataRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Khmer OS Siemreap', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    worksheet.columns.forEach((column) => {
      column.width = 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    this.saveBufferAsFile(buffer, 'SmartSchool_Teacher_Import_Template.xlsx');
  },

  /**
   * Parse uploaded ArrayBuffer from Excel file and map rows to teacher objects
   */
  async parseTeacherExcelFile(arrayBuffer) {
    const XLSX = this.getXLSX();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('The uploaded Excel workbook contains no sheets.');
    }

    const ws = wb.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rawRows || rawRows.length < 2) {
      throw new Error('The spreadsheet is empty or missing data rows.');
    }

    const headerRow = rawRows[0].map(h => String(h || '').trim().toLowerCase());

    // Build matching mapping for the 44 columns
    const colIndexMap = {};
    TEACHER_EXCEL_COLUMNS.forEach((col, idx) => {
      let matchedIdx = idx; // Default fallback index
      const kmLower = col.headerKm.toLowerCase();
      const enLower = col.headerEn.toLowerCase();
      const keyLower = col.key.toLowerCase();

      let foundIdx = headerRow.findIndex(h =>
        h === kmLower ||
        h === enLower ||
        h === keyLower ||
        h.includes(kmLower) ||
        h.includes(enLower)
      );

      // Extra aliases for common variations
      if (foundIdx === -1) {
        if (col.key === 'dob') {
          foundIdx = headerRow.findIndex(h => h.includes('កំណើត') || h.includes('dob') || h.includes('birth'));
        } else if (col.key === 'civilServantId') {
          foundIdx = headerRow.findIndex(h => h.includes('មន្រ្តី') || h.includes('មន្ត្រី') || h.includes('civil'));
        } else if (col.key === 'nationalId') {
          foundIdx = headerRow.findIndex(h => h.includes('អត្តសញ្ញាណប័ណ្ណ') || h.includes('national'));
        } else if (col.key === 'lastNameKhmer') {
          foundIdx = headerRow.findIndex(h => h.includes('ត្រកូល') && !h.includes('ឡាតាំង'));
        } else if (col.key === 'firstNameKhmer') {
          foundIdx = headerRow.findIndex(h => h.includes('នាម') && !h.includes('ឡាតាំង'));
        } else if (col.key === 'retirementDate') {
          foundIdx = headerRow.findIndex(h => h.includes('និវត្តន៍') || h.includes('retire'));
        }
      }

      if (foundIdx !== -1) {
        matchedIdx = foundIdx;
      }
      colIndexMap[col.key] = matchedIdx;
    });

    const existingTeachers = await db.getAll('teachers');
    const existingByIdMap = new Map();
    const existingByCivilMap = new Map();
    const existingByNatMap = new Map();

    existingTeachers.forEach(t => {
      if (t.teacherId) existingByIdMap.set(String(t.teacherId).trim().toLowerCase(), t);
      if (t.civilServantId) existingByCivilMap.set(String(t.civilServantId).trim().toLowerCase(), t);
      if (t.nationalId) existingByNatMap.set(String(t.nationalId).trim().toLowerCase(), t);
    });

    const parsedTeachers = [];
    const missingIdentifierRows = [];
    const duplicateRows = [];
    const seenTeacherIds = new Set();
    const seenCivilIds = new Set();
    const seenNationalIds = new Set();

    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.every(val => String(val || '').trim() === '')) {
        continue;
      }

      const getVal = (key) => {
        const cIdx = colIndexMap[key];
        const val = (cIdx !== undefined && row[cIdx] !== undefined) ? row[cIdx] : '';
        return String(val).trim();
      };

      const rowNum = r + 1;
      let teacherId = getVal('teacherId');
      const civilServantId = getVal('civilServantId');
      const nationalId = getVal('nationalId');
      const lastNameKhmer = getVal('lastNameKhmer');
      const firstNameKhmer = getVal('firstNameKhmer');
      const teacherName = `${lastNameKhmer} ${firstNameKhmer}`.trim() || getVal('lastNameLatin') || `Row ${rowNum}`;

      // If teacherId is missing, fallback to civilServantId or generate
      if (!teacherId && civilServantId) {
        teacherId = civilServantId;
      }

      if (!teacherId && !lastNameKhmer && !firstNameKhmer) {
        missingIdentifierRows.push({
          rowNum,
          name: teacherName,
          reason: 'Missing Teacher ID and Name'
        });
        continue;
      }

      if (!teacherId) {
        // Auto-generate consistent teacherId if missing but name is present
        teacherId = `TCH-${Date.now().toString().slice(-4)}${r}`;
      }

      // Format Date of Birth
      let rawDob = getVal('dob');
      let formattedDob = rawDob;
      if (typeof rawDob === 'number' || (!isNaN(rawDob) && Number(rawDob) > 20000 && Number(rawDob) < 60000)) {
        try {
          const jsDate = XLSX.SSF.parse_date_code(Number(rawDob));
          if (jsDate) {
            const m = String(jsDate.m).padStart(2, '0');
            const d = String(jsDate.d).padStart(2, '0');
            formattedDob = `${jsDate.y}-${m}-${d}`;
          }
        } catch (_) {
          formattedDob = String(rawDob);
        }
      }

      const isoDob = toInputDateFormat(formattedDob);
      
      // Auto-calculate missing age
      let rawAge = getVal('age');
      let age = rawAge !== '' && !isNaN(rawAge) ? Number(rawAge) : '';
      if (age === '' && isoDob) {
        age = calculateAge(isoDob);
      }

      // Auto-calculate missing retirement date (DOB + 60)
      let rawRetirement = getVal('retirementDate');
      let retirementDate = rawRetirement;
      if (!retirementDate && isoDob) {
        retirementDate = calculateRetirementDate(isoDob);
      }

      // Check duplicates
      const cleanTid = teacherId.toLowerCase();
      const cleanCid = civilServantId.toLowerCase();
      const cleanNid = nationalId.toLowerCase();

      let matchedExisting = null;
      let duplicateField = '';

      if (cleanTid && existingByIdMap.has(cleanTid)) {
        matchedExisting = existingByIdMap.get(cleanTid);
        duplicateField = 'teacherId';
      } else if (cleanCid && existingByCivilMap.has(cleanCid)) {
        matchedExisting = existingByCivilMap.get(cleanCid);
        duplicateField = 'civilServantId';
      } else if (cleanNid && existingByNatMap.has(cleanNid)) {
        matchedExisting = existingByNatMap.get(cleanNid);
        duplicateField = 'nationalId';
      } else if (seenTeacherIds.has(cleanTid)) {
        duplicateField = 'batchDuplicateTeacherId';
      } else if (cleanCid && seenCivilIds.has(cleanCid)) {
        duplicateField = 'batchDuplicateCivilServantId';
      }

      if (cleanTid) seenTeacherIds.add(cleanTid);
      if (cleanCid) seenCivilIds.add(cleanCid);
      if (cleanNid) seenNationalIds.add(cleanNid);

      const genderRaw = getVal('gender') || 'Male';
      const isFemale = genderRaw.toLowerCase() === 'female' || genderRaw === 'ស្រី' || genderRaw.toLowerCase() === 'f';

      const teacherObj = {
        rowNum,
        id: matchedExisting ? matchedExisting.id : `tch-${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        status: getVal('status') || 'Active',
        teacherId,
        civilServantId,
        nationalId,
        bankAccount: getVal('bankAccount'),
        lastNameKhmer,
        firstNameKhmer,
        lastNameLatin: getVal('lastNameLatin'),
        firstNameLatin: getVal('firstNameLatin'),
        khmerName: `${lastNameKhmer} ${firstNameKhmer}`.trim(),
        englishName: `${getVal('lastNameLatin')} ${getVal('firstNameLatin')}`.trim(),
        gender: isFemale ? 'Female' : 'Male',
        dob: isoDob || formattedDob,
        dateOfBirth: isoDob || formattedDob,
        age: age !== '' ? Number(age) : '',
        joinedDate: getVal('joinedDate'),
        permanentAppointmentDate: getVal('permanentAppointmentDate'),
        retirementDate: retirementDate ? toInputDateFormat(retirementDate) || retirementDate : '',
        birthVillage: getVal('birthVillage'),
        birthCommune: getVal('birthCommune'),
        birthDistrict: getVal('birthDistrict'),
        birthProvince: getVal('birthProvince'),
        currentVillage: getVal('currentVillage'),
        currentCommune: getVal('currentCommune'),
        currentDistrict: getVal('currentDistrict'),
        currentProvince: getVal('currentProvince'),
        workStatus: getVal('workStatus'),
        framework: getVal('framework'),
        rankAndGrade: getVal('rankAndGrade'),
        position: getVal('position'),
        trainingLevel: getVal('trainingLevel'),
        specialization1: getVal('specialization1'),
        specialization2: getVal('specialization2'),
        taskAssignment: getVal('taskAssignment'),
        additionalDuties: getVal('additionalDuties'),
        highestDegree: getVal('highestDegree'),
        highestDegreeMajor: getVal('highestDegreeMajor'),
        generalEducationLevel: getVal('generalEducationLevel'),
        generalEducationSchool: getVal('generalEducationSchool'),
        generalEducationDegree: getVal('generalEducationDegree'),
        generalEducationStart: getVal('generalEducationStart'),
        generalEducationEnd: getVal('generalEducationEnd'),
        subject1: getVal('subject1'),
        subject: getVal('subject1'),
        hoursPerWeek1: getVal('hoursPerWeek1') !== '' ? Number(getVal('hoursPerWeek1')) : '',
        subject2: getVal('subject2'),
        hoursPerWeek2: getVal('hoursPerWeek2') !== '' ? Number(getVal('hoursPerWeek2')) : '',
        subject3: getVal('subject3'),
        hoursPerWeek3: getVal('hoursPerWeek3') !== '' ? Number(getVal('hoursPerWeek3')) : '',
        maritalStatus: getVal('maritalStatus') || (getVal('spouseName') ? 'Married' : 'Single'),
        spouseName: getVal('spouseName'),
        spouseDob: getVal('spouseDob'),
        spouseJob: getVal('spouseJob'),
        spouseAddress: getVal('spouseAddress'),
        spousePhone: getVal('spousePhone'),
        childrenCount: getVal('childrenCount'),
        fatherName: getVal('fatherName'),
        fatherBirthplace: getVal('fatherBirthplace'),
        motherName: getVal('motherName'),
        motherBirthplace: getVal('motherBirthplace'),
        phone1: getVal('phone1'),
        phone: getVal('phone1'),
        phone2: getVal('phone2'),
        telegram: getVal('telegram'),
        email: getVal('email'),
        notes: getVal('notes'),
        isExistingDuplicate: !!matchedExisting,
        duplicateField,
        existingId: matchedExisting ? matchedExisting.id : null
      };

      if (matchedExisting || duplicateField) {
        duplicateRows.push(teacherObj);
      }

      parsedTeachers.push(teacherObj);
    }

    return {
      totalRows: parsedTeachers.length + missingIdentifierRows.length,
      validRows: parsedTeachers,
      missingIdentifierRows,
      duplicateRows,
      allRows: parsedTeachers
    };
  },

  /**
   * Commit parsed teacher batch to IndexedDB
   * @param {Array} validRows 
   * @param {Object} options 
   * @param {boolean} options.overwriteDuplicates - Whether to overwrite existing duplicate records
   */
  async commitTeacherImport(validRows = [], { overwriteDuplicates = false } = {}) {
    const currentUser = authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';

    // 1. RBAC Check: Teachers can only create/link 1 profile
    if (isTeacher) {
      const existingTeachers = await db.getAll('teachers');
      const userTeacherCount = existingTeachers.filter(t => t.userId === currentUser.id || t.accountId === currentUser.id).length;
      if (userTeacherCount >= 1 && validRows.length > 0) {
        throw new Error('Teacher accounts are limited to one profile. Cannot perform bulk import.');
      }
      if (validRows.length > 1) {
        throw new Error('Teacher accounts cannot import multiple profiles at once.');
      }
    }

    const existingTeachers = await db.getAll('teachers');
    const existingByIdMap = new Map();
    existingTeachers.forEach(t => {
      if (t.teacherId) existingByIdMap.set(String(t.teacherId).trim().toLowerCase(), t);
      if (t.civilServantId) existingByIdMap.set(String(t.civilServantId).trim().toLowerCase(), t);
      if (t.nationalId) existingByIdMap.set(String(t.nationalId).trim().toLowerCase(), t);
    });

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const skippedRecords = [];
    const importedTeachers = [];

    for (const record of validRows) {
      const cleanTid = String(record.teacherId || '').trim().toLowerCase();
      const cleanCid = String(record.civilServantId || '').trim().toLowerCase();
      const cleanNid = String(record.nationalId || '').trim().toLowerCase();

      const existingRecord = (cleanTid && existingByIdMap.get(cleanTid)) ||
                             (cleanCid && existingByIdMap.get(cleanCid)) ||
                             (cleanNid && existingByIdMap.get(cleanNid)) ||
                             null;

      if (existingRecord) {
        if (!overwriteDuplicates) {
          skippedCount++;
          skippedRecords.push({
            teacherId: record.teacherId,
            name: `${record.lastNameKhmer || ''} ${record.firstNameKhmer || ''}`.trim(),
            rowNum: record.rowNum,
            reason: 'Duplicate record (Skipped)'
          });
          continue;
        } else {
          // Overwrite existing record
          const merged = normalizeTeacherRecord({
            ...existingRecord,
            ...record,
            id: existingRecord.id,
            updatedAt: new Date().toISOString()
          });
          await db.put('teachers', merged);
          updatedCount++;
          importedTeachers.push(merged);
          continue;
        }
      }

      // New fresh record
      if (isTeacher) {
        record.userId = currentUser.id;
        record.accountId = currentUser.id;
      }

      const fresh = normalizeTeacherRecord({
        ...record,
        id: record.id || `tch-${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await db.put('teachers', fresh);
      if (cleanTid) existingByIdMap.set(cleanTid, fresh);
      if (cleanCid) existingByIdMap.set(cleanCid, fresh);
      if (cleanNid) existingByIdMap.set(cleanNid, fresh);
      importedTeachers.push(fresh);
      importedCount++;
    }

    // 2. Cloud Sync hook
    if (importedCount > 0 || updatedCount > 0) {
      syncStateManager.markDirty('teachers.import');
    }

    return {
      totalRecords: validRows.length,
      importedCount,
      updatedCount,
      skippedCount,
      skippedRecords,
      importedTeachers
    };
  },

  /**
   * Parse uploaded JSON backup file of teachers
   */
  async parseTeacherJSONFile(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Invalid JSON file format.');
    }

    // Handle both raw array `[...]` and full database backup schema `{ tables: { teachers: [...] } }`
    let rawList = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && parsed.tables && Array.isArray(parsed.tables.teachers)) {
      rawList = parsed.tables.teachers;
    } else if (parsed && Array.isArray(parsed.teachers)) {
      rawList = parsed.teachers;
    } else {
      throw new Error('Unrecognized JSON structure: Missing teacher records array.');
    }

    const existingTeachers = await db.getAll('teachers');
    const existingByIdMap = new Map();
    existingTeachers.forEach(t => {
      if (t.teacherId) existingByIdMap.set(String(t.teacherId).trim().toLowerCase(), t);
      if (t.civilServantId) existingByIdMap.set(String(t.civilServantId).trim().toLowerCase(), t);
      if (t.nationalId) existingByIdMap.set(String(t.nationalId).trim().toLowerCase(), t);
    });

    const parsedTeachers = [];
    const missingIdentifierRows = [];
    const duplicateRows = [];

    rawList.forEach((raw, idx) => {
      const rowNum = idx + 1;
      const norm = normalizeTeacherRecord(raw);

      if (!norm.teacherId && !norm.civilServantId && !norm.khmerName) {
        missingIdentifierRows.push({
          rowNum,
          name: `Index ${rowNum}`,
          reason: 'Missing Teacher ID and Name'
        });
        return;
      }

      const cleanTid = String(norm.teacherId || '').trim().toLowerCase();
      const cleanCid = String(norm.civilServantId || '').trim().toLowerCase();
      const cleanNid = String(norm.nationalId || '').trim().toLowerCase();

      const matchedExisting = (cleanTid && existingByIdMap.get(cleanTid)) ||
                              (cleanCid && existingByIdMap.get(cleanCid)) ||
                              (cleanNid && existingByIdMap.get(cleanNid)) ||
                              null;

      const teacherObj = {
        ...norm,
        rowNum,
        isExistingDuplicate: !!matchedExisting,
        existingId: matchedExisting ? matchedExisting.id : null
      };

      if (matchedExisting) {
        duplicateRows.push(teacherObj);
      }

      parsedTeachers.push(teacherObj);
    });

    return {
      totalRows: parsedTeachers.length + missingIdentifierRows.length,
      validRows: parsedTeachers,
      missingIdentifierRows,
      duplicateRows,
      allRows: parsedTeachers
    };
  }
};
