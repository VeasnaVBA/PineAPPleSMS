/**
 * Student Excel (XLSX) Service
 * Manages client-side export and import of all 29 student columns using SheetJS (XLSX).
 * Fully offline-first, preserving Khmer Unicode (UTF-8) and enforcing role/classroom scoping.
 */
import { db } from '../database/db.js';
import { authService } from './authService.js';
import { normalizeStudentRecord } from './studentService.js';
import { syncStateManager } from './syncStateManager.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

/**
 * The Exact 29 Student Columns definition in requested sequence:
 *  1. ស្ថានភាព (Status)
 *  2. ល.រ (No.)
 *  3. រូបថតសិស្ស (Photo)
 *  4. អត្តលេខ (Student ID)
 *  5. ត្រកូលនាម (Khmer Last Name)
 *  6. ខ្លួនត្រកូល (Khmer First Name)
 *  7. ឡាតាំងនាម (Latin Last Name)
 *  8. ខ្លួនឡាតាំង (Latin First Name)
 *  9. ភេទ (Gender)
 * 10. ថ្ងៃខែឆ្នាំកំណើត (Date of Birth)
 * 11. ភូមិកំណើត (Birth Village)
 * 12. ឃុំកំណើត (Birth Commune)
 * 13. ស្រុកកំណើត (Birth District)
 * 14. ខេត្តកំណើត (Birth Province)
 * 15. ភូមិបច្ចុប្បន្ន (Current Village)
 * 16. ឃុំបច្ចុប្បន្ន (Current Commune)
 * 17. ស្រុកបច្ចុប្បន្ន (Current District)
 * 18. ខេត្តបច្ចុប្បន្ន (Current Province)
 * 19. ឆ្នាំសិក្សា (Academic Year)
 * 20. សាលារៀន (School)
 * 21. ថ្នាក់លេខ (Class)
 * 22. ទូរសព្ទសិស្ស (Student Phone)
 * 23. ឈ្មោះឪពុក (Father Name)
 * 24. មុខរបរ (Father Occupation)
 * 25. លេខទូរសព្ទ (Father Phone)
 * 26. ឈ្មោះម្តាយ (Mother Name)
 * 27. មុខរបរ (Mother Occupation)
 * 28. លេខទូរសព្ទ (Mother Phone)
 * 29. ផ្សេងៗ (Notes)
 */
export const STUDENT_EXCEL_COLUMNS = [
  { index: 1,  key: 'status',           headerKm: 'ស្ថានភាព',               headerEn: 'Status',             required: false, default: 'Active' },
  { index: 2,  key: 'rowNo',            headerKm: 'ល.រ',                    headerEn: 'No.',                required: false, isVirtual: true },
  { index: 3,  key: 'photo',            headerKm: 'រូបថតសិស្ស',              headerEn: 'Photo',              required: false },
  { index: 4,  key: 'studentId',        headerKm: 'អត្តលេខ',                headerEn: 'Student ID',         required: true },
  { index: 5,  key: 'lastNameKh',       headerKm: 'ត្រកូលនាម',               headerEn: 'Khmer Last Name',    required: true },
  { index: 6,  key: 'firstNameKh',      headerKm: 'ខ្លួនត្រកូល',              headerEn: 'Khmer First Name',   required: true },
  { index: 7,  key: 'lastNameLatin',    headerKm: 'ឡាតាំងនាម',               headerEn: 'Latin Last Name',    required: false },
  { index: 8,  key: 'firstNameLatin',   headerKm: 'ខ្លួនឡាតាំង',              headerEn: 'Latin First Name',   required: false },
  { index: 9,  key: 'gender',           headerKm: 'ភេទ',                    headerEn: 'Gender',             required: true, default: 'Male' },
  { index: 10, key: 'dateOfBirth',      headerKm: 'ថ្ងៃខែឆ្នាំកំណើត',       headerEn: 'Date of Birth',      required: true },
  { index: 11, key: 'birthVillage',     headerKm: 'ភូមិកំណើត',               headerEn: 'Birth Village',      required: false },
  { index: 12, key: 'birthCommune',     headerKm: 'ឃុំកំណើត',                headerEn: 'Birth Commune',      required: false },
  { index: 13, key: 'birthDistrict',    headerKm: 'ស្រុកកំណើត',              headerEn: 'Birth District',     required: false },
  { index: 14, key: 'birthProvince',    headerKm: 'ខេត្តកំណើត',              headerEn: 'Birth Province',     required: false },
  { index: 15, key: 'currentVillage',   headerKm: 'ភូមិបច្ចុប្បន្ន',          headerEn: 'Current Village',    required: false },
  { index: 16, key: 'currentCommune',   headerKm: 'ឃុំបច្ចុប្បន្ន',           headerEn: 'Current Commune',    required: false },
  { index: 17, key: 'currentDistrict',  headerKm: 'ស្រុកបច្ចុប្បន្ន',         headerEn: 'Current District',   required: false },
  { index: 18, key: 'currentProvince',  headerKm: 'ខេត្តបច្ចុប្បន្ន',         headerEn: 'Current Province',   required: false },
  { index: 19, key: 'academicYear',     headerKm: 'ឆ្នាំសិក្សា',             headerEn: 'Academic Year',      required: true, default: '2024–2025' },
  { index: 20, key: 'lastYearSchool',   headerKm: 'សាលាចាស់',                headerEn: 'Last Year School',   required: false, default: '' },
  { index: 21, key: 'school',           headerKm: 'សាលារៀន',                headerEn: 'School',             required: false, default: '' },
  { index: 22, key: 'classId',          headerKm: 'ថ្នាក់លេខ',               headerEn: 'Class',              required: true },
  { index: 23, key: 'studentPhone',     headerKm: 'ទូរសព្ទសិស្ស',           headerEn: 'Student Phone',      required: false },
  { index: 24, key: 'fatherName',       headerKm: 'ឈ្មោះឪពុក',               headerEn: 'Father Name',        required: false },
  { index: 25, key: 'fatherOccupation', headerKm: 'មុខរបរ',                 headerEn: 'Father Occupation',  required: false },
  { index: 26, key: 'fatherPhone',      headerKm: 'លេខទូរសព្ទ',              headerEn: 'Father Phone',       required: false },
  { index: 27, key: 'motherName',       headerKm: 'ឈ្មោះម្តាយ',              headerEn: 'Mother Name',        required: false },
  { index: 28, key: 'motherOccupation', headerKm: 'មុខរបរ',                 headerEn: 'Mother Occupation',  required: false },
  { index: 29, key: 'motherPhone',      headerKm: 'លេខទូរសព្ទ',              headerEn: 'Mother Phone',       required: false },
  { index: 30, key: 'notes',            headerKm: 'ផ្សេងៗ',                  headerEn: 'Notes',              required: false }
];

export const StudentExcelService = {
  /**
   * Get the active ExcelJS library instance (window.ExcelJS or global ExcelJS)
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
   * Get the active XLSX library instance (window.XLSX)
   */
  getXLSX() {
    if (typeof window !== 'undefined' && window.XLSX) {
      return window.XLSX;
    }
    throw new Error('SheetJS library (XLSX) is not loaded.');
  },

  /**
   * Build human readable headers list for Excel output
   */
  getHeaders(lang = 'km') {
    return STUDENT_EXCEL_COLUMNS.map(col => lang === 'en' ? col.headerEn : col.headerKm);
  },

  /**
   * Generate clean dynamic filename according to active filters and dataset
   */
  generateExportFilename(activeFilters = {}, filteredStudents = []) {
    const cleanStr = (str) => (str || '').toString().trim().replace(/[\/\\:*?"<>|]/g, '_');
    
    // 1. Determine Academic Year
    let academicYear = '';
    if (activeFilters.academicYear && activeFilters.academicYear !== 'all') {
      academicYear = cleanStr(activeFilters.academicYear);
    } else if (filteredStudents.length > 0 && filteredStudents[0]?.academicYear) {
      academicYear = cleanStr(filteredStudents[0].academicYear);
    }
    academicYear = academicYear.replace(/\s+/g, '');

    // 2. Determine Class Name
    let className = '';
    if (activeFilters.className && activeFilters.className !== 'all' && activeFilters.className !== 'All') {
      className = cleanStr(activeFilters.className);
    } else if (activeFilters.classId && activeFilters.classId !== 'all') {
      className = cleanStr(activeFilters.classId);
    }

    // 3. Determine Grade
    let grade = '';
    if (activeFilters.grade && activeFilters.grade !== 'all') {
      const rawGrade = cleanStr(activeFilters.grade);
      grade = rawGrade.startsWith('ថ្នាក់ទី') ? rawGrade : `ថ្នាក់ទី${rawGrade}`;
    }

    if (className) {
      return academicYear ? `${className}_${academicYear}.xlsx` : `${className}.xlsx`;
    }
    if (grade) {
      return academicYear ? `${grade}_${academicYear}.xlsx` : `${grade}.xlsx`;
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    return `បញ្ជីឈ្មោះសិស្ស_ទាំងអស់_${dateStr}.xlsx`;
  },

  /**
   * Export an array of student objects to a stylized .xlsx file using ExcelJS
   */
  async exportStudentsToExcel(studentsList = [], { activeFilters = {}, classLabel = '', academicYear = '', grade = '', lang = 'km' } = {}) {
    const ExcelJS = this.getExcelJS();

    // 1. Role enforcement: If teacher, restrict to assigned class
    let exportable = [...studentsList];
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        exportable = exportable.filter(s => s.classId === teacherClassId);
      }
    }

    // 2. Fetch classes lookup map for class display names
    let classMap = new Map();
    try {
      const classes = await db.getAll('classes');
      if (Array.isArray(classes)) {
        classMap = new Map(classes.map(c => [c.id, c.name]));
      }
    } catch (_) {}

    // 3. Prepare headers
    const headers = this.getHeaders(lang);

    // 4. Map rows matching the 29 column sequence
    const rows = exportable.map((student, idx) => {
      const norm = normalizeStudentRecord(student);
      const rowNo = idx + 1;
      const className = classMap.get(norm.classId) || norm.classId || '';

      return [
        norm.status || 'Active',                                  // 1. ស្ថានភាព
        rowNo,                                                    // 2. ល.រ
        norm.photo ? '(Photo attached)' : '',                     // 3. រូបថតសិស្ស
        norm.studentId || '',                                     // 4. អត្តលេខ
        norm.lastNameKh || '',                                    // 5. ត្រកូលនាម
        norm.firstNameKh || '',                                   // 6. ខ្លួនត្រកូល
        norm.lastNameLatin || '',                                 // 7. ឡាតាំងនាម
        norm.firstNameLatin || '',                                // 8. ខ្លួនឡាតាំង
        norm.gender || 'Male',                                    // 9. ភេទ
        formatDisplayDate(norm.dateOfBirth) || '',                // 10. ថ្ងៃខែឆ្នាំកំណើត
        norm.birthVillage || '',                                  // 11. ភូមិកំណើត
        norm.birthCommune || '',                                  // 12. ឃុំកំណើត
        norm.birthDistrict || '',                                 // 13. ស្រុកកំណើត
        norm.birthProvince || '',                                 // 14. ខេត្តកំណើត
        norm.currentVillage || '',                                // 15. ភូមិបច្ចុប្បន្ន
        norm.currentCommune || '',                                // 16. ឃុំបច្ចុប្បន្ន
        norm.currentDistrict || '',                               // 17. ស្រុកបច្ចុប្បន្ន
        norm.currentProvince || '',                               // 18. ខេត្តបច្ចុប្បន្ន
        norm.academicYear || '',                                  // 19. ឆ្នាំសិក្សា
        norm.lastYearSchool || '',                                // 20. សាលាចាស់
        norm.school || '',                                        // 21. សាលារៀន
        className,                                                // 22. ថ្នាក់លេខ
        norm.studentPhone || '',                                  // 23. ទូរសព្ទសិស្ស
        norm.fatherName || '',                                    // 24. ឈ្មោះឪពុក
        norm.fatherOccupation || '',                              // 25. មុខរបរ
        norm.fatherPhone || '',                                   // 26. លេខទូរសព្ទ
        norm.motherName || '',                                    // 27. ឈ្មោះម្តាយ
        norm.motherOccupation || '',                              // 28. មុខរបរ
        norm.motherPhone || '',                                   // 29. លេខទូរសព្ទ
        norm.notes || ''                                          // 30. ផ្សេងៗ
      ];
    });

    // 5. Create Workbook and Worksheet
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SmartSchool Management System';
    workbook.lastModifiedBy = 'SmartSchool';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheetName = lang === 'km' ? 'បញ្ជីឈ្មោះសិស្ស' : 'Students';
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }]
    });

    // 6. Header Row (Row 1) with Khmer OS Siemreap, 30pt height, Solid Blue fill #1E40AF, Bold White text
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

    // 7. Data Rows (Row 2+) with 24pt height, Khmer OS Siemreap 11pt, zebra striping, and clean alignments
    const centerAlignedCols = new Set([1, 2, 4, 9, 10, 19, 22]); // Status, No., ID, Gender, DOB, Academic Year, Class

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

        const isCentered = centerAlignedCols.has(colNumber);
        cell.alignment = {
          vertical: 'middle',
          horizontal: isCentered ? 'center' : 'left',
          wrapText: false
        };
      });
    });

    // 8. Auto Column Widths calculation (Header length & max content length + padding of 4-6 units)
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

    // 9. Generate dynamic filename
    const filtersForNaming = {
      className: classLabel,
      academicYear,
      grade,
      ...activeFilters
    };
    const filename = this.generateExportFilename(filtersForNaming, exportable);

    // 10. Write to Buffer and Trigger Download
    const buffer = await workbook.xlsx.writeBuffer();
    this.saveBufferAsFile(buffer, filename);

    return { filename, count: exportable.length };
  },

  /**
   * Universal Buffer to Blob file downloader
   */
  saveBufferAsFile(buffer, filename) {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
   * Legacy universal workbook saver supporting XLSX.writeFile and Blob anchor trigger
   */
  saveWorkbookFile(workbook, filename) {
    const XLSX = this.getXLSX();
    try {
      if (typeof XLSX.writeFile === 'function') {
        XLSX.writeFile(workbook, filename);
        return;
      }
    } catch (e) {
      console.warn('XLSX.writeFile failed, falling back to Blob download:', e);
    }

    // Direct binary blob download fallback
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveBufferAsFile(excelBuffer, filename);
  },

  /**
   * Generate and download empty sample import template with all 29 columns and 1 guide row
   */
  async downloadSampleTemplate(lang = 'km') {
    const ExcelJS = this.getExcelJS();
    const headers = this.getHeaders(lang);

    // Sample example row demonstrating expected formats
    const sampleRow = [
      'Active',                                 // 1. Status
      1,                                        // 2. No.
      '',                                       // 3. Photo
      'STU-001',                                // 4. Student ID
      'សុក',                                    // 5. Khmer Last Name
      'សុផល',                                   // 6. Khmer First Name
      'SOK',                                    // 7. Latin Last Name
      'Sophal',                                 // 8. Latin First Name
      'Male',                                   // 9. Gender (Male/Female)
      '2010-05-15',                             // 10. Date of Birth (YYYY-MM-DD)
      'ភូមិ១',                                  // 11. Birth Village
      'សង្កាត់បឹងកក់១',                        // 12. Birth Commune
      'ខណ្ឌទួលគោក',                            // 13. Birth District
      'រាជធានីភ្នំពេញ',                         // 14. Birth Province
      'ភូមិ១',                                  // 15. Current Village
      'សង្កាត់បឹងកក់១',                        // 16. Current Commune
      'ខណ្ឌទួលគោក',                            // 17. Current District
      'រាជធានីភ្នំពេញ',                         // 18. Current Province
      '2024–2025',                              // 19. Academic Year
      'សាលាបឋមសិក្សា វត្តភ្នំ',                  // 20. Last Year School (សាលាចាស់)
      'សាលារៀនអន្តរជាតិ ស្មាតស្គូល',           // 21. School
      '7A',                                     // 22. Class Name or Class ID
      '012345678',                              // 23. Student Phone
      'សុក សារ៉េត',                             // 24. Father Name
      'មន្ត្រីរាជការ',                           // 25. Father Occupation
      '012999888',                              // 26. Father Phone
      'ម៉ៅ សុខា',                               // 27. Mother Name
      'អាជីវករ',                                // 28. Mother Occupation
      '012777666',                              // 29. Mother Phone
      'សិស្សពូកែគណិតវិទ្យា'                     // 30. Notes
    ];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Student_Template', {
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
      column.width = 16;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    this.saveBufferAsFile(buffer, 'SmartSchool_Student_Import_Template.xlsx');
  },

  /**
   * Parse uploaded ArrayBuffer from Excel file and map rows to student objects
   */
  async parseExcelFile(arrayBuffer) {
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

    // Map column index by Khmer header or English header or key name
    const colIndexMap = {};
    STUDENT_EXCEL_COLUMNS.forEach((col, idx) => {
      // Direct position match fallback
      let matchedIdx = idx;

      // Header name search
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

      if (foundIdx === -1 && col.key === 'lastYearSchool') {
        foundIdx = headerRow.findIndex(h =>
          h.includes('សាលារៀនឆ្នាំមុន') ||
          h.includes('last year') ||
          h.includes('previous school')
        );
      }

      if (foundIdx !== -1) {
        matchedIdx = foundIdx;
      }
      colIndexMap[col.key] = matchedIdx;
    });

    // Fetch classes and active academic year to match class names or default
    const classes = await db.getAll('classes');
    const validClassIds = new Set(classes.map(c => c.id));
    const classNameToIdMap = new Map();
    classes.forEach(c => {
      classNameToIdMap.set(c.name.trim().toLowerCase(), c.id);
      classNameToIdMap.set(c.id.trim().toLowerCase(), c.id);
    });

    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();

    const parsedStudents = [];
    const missingIdRows = [];

    // Parse data rows (skipping header)
    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      // Skip completely empty rows
      if (!row || row.every(val => String(val || '').trim() === '')) {
        continue;
      }

      const getVal = (key) => {
        const cIdx = colIndexMap[key];
        const val = (cIdx !== undefined && row[cIdx] !== undefined) ? row[cIdx] : '';
        return String(val).trim();
      };

      const rowNum = r + 1;
      const studentId = getVal('studentId');
      const lastNameKh = getVal('lastNameKh');
      const firstNameKh = getVal('firstNameKh');
      const studentName = `${lastNameKh} ${firstNameKh}`.trim() || getVal('lastNameLatin') || `Row ${rowNum}`;

      // 1. Missing ID Check: Reject row if studentId is empty or whitespace
      if (!studentId) {
        missingIdRows.push({
          rowNum,
          name: studentName,
          reason: 'Missing Student ID'
        });
        continue;
      }

      const gender = getVal('gender') || 'Male';
      const rawDob = getVal('dateOfBirth');
      let academicYear = getVal('academicYear') || '2024–2025';
      let classRaw = getVal('classId');

      // 2. Resolve class ID (Enforce teacher role, or check against existing classes)
      let resolvedClassId = '';
      if (isTeacher && teacherClassId) {
        resolvedClassId = teacherClassId;
      } else if (classRaw) {
        const lookup = classNameToIdMap.get(classRaw.toLowerCase());
        if (lookup) {
          resolvedClassId = lookup;
        } else if (validClassIds.has(classRaw)) {
          resolvedClassId = classRaw;
        } else {
          // Classroom doesn't match any existing class -> unassigned
          resolvedClassId = '';
        }
      }

      // Format date if SheetJS gave Excel serial or string
      let formattedDob = rawDob;
      if (typeof rawDob === 'number' || (!isNaN(rawDob) && Number(rawDob) > 20000 && Number(rawDob) < 60000)) {
        try {
          const jsDate = XLSX.SSF.parse_date_code(Number(rawDob));
          if (jsDate) {
            const m = String(jsDate.m).padStart(2, '0');
            const d = String(jsDate.d).padStart(2, '0');
            formattedDob = `${jsDate.y}-${m}-${d}`;
          }
        } catch (e) {
          formattedDob = String(rawDob);
        }
      }

      const studentObj = {
        rowNum,
        studentId,
        status: getVal('status') || 'Active',
        lastNameKh,
        firstNameKh,
        lastNameLatin: getVal('lastNameLatin'),
        firstNameLatin: getVal('firstNameLatin'),
        gender: (gender.toLowerCase() === 'female' || gender === 'ស្រី' || gender.toLowerCase() === 'f') ? 'Female' : 'Male',
        dateOfBirth: formatDisplayDate(formattedDob) || formattedDob,
        birthVillage: getVal('birthVillage'),
        birthCommune: getVal('birthCommune'),
        birthDistrict: getVal('birthDistrict'),
        birthProvince: getVal('birthProvince'),
        currentVillage: getVal('currentVillage'),
        currentCommune: getVal('currentCommune'),
        currentDistrict: getVal('currentDistrict'),
        currentProvince: getVal('currentProvince'),
        academicYear,
        lastYearSchool: getVal('lastYearSchool') || '',
        school: getVal('school') || '',
        classId: resolvedClassId,
        studentPhone: getVal('studentPhone'),
        fatherName: getVal('fatherName'),
        fatherOccupation: getVal('fatherOccupation'),
        fatherPhone: getVal('fatherPhone'),
        motherName: getVal('motherName'),
        motherOccupation: getVal('motherOccupation'),
        motherPhone: getVal('motherPhone'),
        notes: getVal('notes')
      };

      parsedStudents.push(studentObj);
    }

    return {
      totalRows: parsedStudents.length + missingIdRows.length,
      validRows: parsedStudents,
      missingIdRows,
      allRows: parsedStudents
    };
  },

  /**
   * Commit parsed students batch to IndexedDB with strict duplicate skipping,
   * classroom & study year confirmation/override, and unassigned classroom tracking.
   * @param {Array} validRows 
   * @param {Array} missingIdRows 
   * @param {Object} [options={}] - { targetClassId, targetAcademicYear }
   */
  async commitImport(validRows = [], missingIdRows = [], options = {}) {
    const { targetClassId, targetAcademicYear } = options;
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();
    const effectiveClassId = targetClassId !== undefined ? targetClassId : (isTeacher ? teacherClassId : null);

    const existingStudents = await db.getAll('students');
    const existingByStudentIdMap = new Map();
    existingStudents.forEach(s => {
      if (s.studentId) {
        existingByStudentIdMap.set(String(s.studentId).trim().toLowerCase(), s);
      }
    });

    const classes = await db.getAll('classes');
    const validClassIds = new Set(classes.map(c => c.id));

    let importedCount = 0;
    const skippedDuplicates = [];
    const unassignedClassStudents = [];
    const importedStudents = [];
    const seenInBatch = new Set();

    for (const record of validRows) {
      const cleanSid = String(record.studentId).trim().toLowerCase();

      // Duplicate skipping rule: If studentId already exists in DB or in current batch, skip completely
      if (existingByStudentIdMap.has(cleanSid) || seenInBatch.has(cleanSid)) {
        skippedDuplicates.push({
          studentId: record.studentId,
          name: `${record.lastNameKh || ''} ${record.firstNameKh || ''}`.trim() || record.lastNameLatin || '—',
          rowNum: record.rowNum
        });
        continue;
      }

      seenInBatch.add(cleanSid);

      // Target classroom confirmation / teacher role enforcement
      if (effectiveClassId) {
        record.classId = effectiveClassId;
      } else {
        // If classroom does not exist in system, leave blank for unassigned resolution
        if (!record.classId || !validClassIds.has(record.classId)) {
          record.classId = '';
        }
      }

      // Target study year confirmation
      if (targetAcademicYear) {
        record.academicYear = targetAcademicYear;
      }

      // Create fresh record in IndexedDB
      const newId = 'stu-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
      const fresh = normalizeStudentRecord({
        ...record,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await db.put('students', fresh);
      existingByStudentIdMap.set(cleanSid, fresh);
      importedStudents.push(fresh);
      importedCount++;

      // Track unassigned classroom students (Admins / Directors only)
      if (!isTeacher && (!fresh.classId || !validClassIds.has(fresh.classId))) {
        unassignedClassStudents.push(fresh);
      }
    }

    if (importedCount > 0) {
      syncStateManager.markDirty('students.excelImport');
    }

    return {
      totalRecords: validRows.length + missingIdRows.length,
      importedCount,
      skippedDuplicatesCount: skippedDuplicates.length,
      skippedDuplicates,
      missingIdCount: missingIdRows.length,
      missingIdRows,
      unassignedCount: unassignedClassStudents.length,
      unassignedClassStudents,
      importedStudents
    };
  }
};
