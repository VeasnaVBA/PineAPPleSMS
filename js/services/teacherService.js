/**
 * Comprehensive Teacher Management Service
 * Matches official 44-field MoEYS civil servant structure.
 * Supports RBAC isolation (Director/Admin unlimited CRUD, Teacher 1-profile scope).
 */

import { db } from '../database/db.js';
import { authService } from './authService.js';
import { syncStateManager } from './syncStateManager.js';
import { calculateAge, calculateRetirementDate, formatDisplayDate, toInputDateFormat } from '../utils/dateUtils.js';
import { ExcelExportService } from './excelExportService.js';

export { calculateAge, calculateRetirementDate, formatDisplayDate, toInputDateFormat, ExcelExportService };

/**
 * Standardize and normalize teacher object with all 44 fields
 */
export function normalizeTeacherRecord(raw = {}) {
  const lastNameKhmer = (raw.lastNameKhmer || raw.lastNameKh || '').trim();
  const firstNameKhmer = (raw.firstNameKhmer || raw.firstNameKh || '').trim();
  
  let khmerName = (raw.khmerName || '').trim();
  if (!khmerName && (lastNameKhmer || firstNameKhmer)) {
    khmerName = `${lastNameKhmer} ${firstNameKhmer}`.trim();
  } else if (khmerName && (!lastNameKhmer && !firstNameKhmer)) {
    const parts = khmerName.split(/\s+/);
    // Best-effort extraction
    if (parts.length > 1) {
      raw.lastNameKhmer = parts[0];
      raw.firstNameKhmer = parts.slice(1).join(' ');
    } else {
      raw.firstNameKhmer = khmerName;
    }
  }

  const lastNameLatin = (raw.lastNameLatin || '').trim();
  const firstNameLatin = (raw.firstNameLatin || '').trim();
  let englishName = (raw.englishName || raw.latinName || '').trim();
  if (!englishName && (lastNameLatin || firstNameLatin)) {
    englishName = `${lastNameLatin} ${firstNameLatin}`.trim();
  }

  const dob = (raw.dob || raw.dateOfBirth || '').trim();
  const computedAge = dob ? calculateAge(dob) : (raw.age || '');
  const computedRetirement = dob ? calculateRetirementDate(dob) : (raw.retirementDate || '');

  return {
    id: raw.id ? String(raw.id).trim() : `tch-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    status: raw.status || 'Active', // Active (សកម្ម), On Leave (ទំនេរ), Transferred (ផ្ទេរចេញ), Retired (ចូលនិវត្តន៍)
    photo: raw.photo || '',
    photoBlob: raw.photoBlob || null,
    teacherId: raw.teacherId ? String(raw.teacherId).trim() : '',
    civilServantId: raw.civilServantId ? String(raw.civilServantId).trim() : '',
    nationalId: raw.nationalId ? String(raw.nationalId).trim() : '',
    lastNameKhmer: (raw.lastNameKhmer || lastNameKhmer || '').trim(),
    firstNameKhmer: (raw.firstNameKhmer || firstNameKhmer || '').trim(),
    lastNameLatin: (raw.lastNameLatin || lastNameLatin || '').trim(),
    firstNameLatin: (raw.firstNameLatin || firstNameLatin || '').trim(),
    khmerName: khmerName || `${lastNameKhmer} ${firstNameKhmer}`.trim(),
    englishName: englishName || `${lastNameLatin} ${firstNameLatin}`.trim(),
    gender: raw.gender || 'Male',
    dob,
    dateOfBirth: dob,
    age: computedAge !== '' ? Number(computedAge) : '',
    joinedDate: raw.joinedDate || '',
    retirementDate: computedRetirement,
    birthVillage: raw.birthVillage || '',
    birthCommune: raw.birthCommune || '',
    birthDistrict: raw.birthDistrict || '',
    birthProvince: raw.birthProvince || '',
    currentVillage: raw.currentVillage || '',
    currentCommune: raw.currentCommune || '',
    currentDistrict: raw.currentDistrict || '',
    currentProvince: raw.currentProvince || '',
    workStatus: raw.workStatus || '',
    framework: raw.framework || '',
    rankAndGrade: raw.rankAndGrade || '',
    position: raw.position || '',
    trainingLevel: raw.trainingLevel || '',
    specialization1: raw.specialization1 || '',
    specialization2: raw.specialization2 || '',
    taskAssignment: raw.taskAssignment || '',
    additionalDuties: raw.additionalDuties || '',
    highestDegree: raw.highestDegree || '',
    highestDegreeMajor: raw.highestDegreeMajor || '',
    subject1: raw.subject1 || raw.subject || '',
    subject: raw.subject1 || raw.subject || '',
    hoursPerWeek1: raw.hoursPerWeek1 !== undefined && raw.hoursPerWeek1 !== '' ? Number(raw.hoursPerWeek1) : '',
    subject2: raw.subject2 || '',
    hoursPerWeek2: raw.hoursPerWeek2 !== undefined && raw.hoursPerWeek2 !== '' ? Number(raw.hoursPerWeek2) : '',
    subject3: raw.subject3 || '',
    hoursPerWeek3: raw.hoursPerWeek3 !== undefined && raw.hoursPerWeek3 !== '' ? Number(raw.hoursPerWeek3) : '',
    bankAccount: raw.bankAccount ? String(raw.bankAccount).trim() : '',
    permanentAppointmentDate: raw.permanentAppointmentDate || '',
    generalEducationLevel: raw.generalEducationLevel || '',
    generalEducationSchool: raw.generalEducationSchool || '',
    generalEducationDegree: raw.generalEducationDegree || '',
    generalEducationStart: raw.generalEducationStart || '',
    generalEducationEnd: raw.generalEducationEnd || '',
    maritalStatus: raw.maritalStatus || (raw.spouseName ? 'Married' : 'Single'),
    spouseName: raw.spouseName || '',
    spouseDob: raw.spouseDob || '',
    spouseJob: raw.spouseJob || '',
    spouseAddress: raw.spouseAddress || '',
    spousePhone: raw.spousePhone || '',
    childrenCount: raw.childrenCount || '',
    fatherName: raw.fatherName || '',
    fatherBirthplace: raw.fatherBirthplace || '',
    motherName: raw.motherName || '',
    motherBirthplace: raw.motherBirthplace || '',
    phone1: raw.phone1 || raw.phone || '',
    phone: raw.phone1 || raw.phone || '',
    phone2: raw.phone2 || '',
    telegram: raw.telegram || '',
    email: raw.email || '',
    notes: raw.notes || '',
    userId: raw.userId || raw.accountId || null,
    accountId: raw.accountId || raw.userId || null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

export const TeacherService = {
  async getAll() {
    const list = await db.getAll('teachers');
    return list.map(t => normalizeTeacherRecord(t));
  },

  async getById(id) {
    const raw = await db.get('teachers', id);
    return raw ? normalizeTeacherRecord(raw) : null;
  },

  async getByTeacherId(teacherId) {
    if (!teacherId) return null;
    const cleanId = String(teacherId).trim().toLowerCase();
    const all = await this.getAll();
    return all.find(t => t.teacherId.toLowerCase() === cleanId) || null;
  },

  /**
   * Get all teacher profiles associated with a user account ID
   */
  async getByUserId(userId) {
    if (!userId) return [];
    const all = await this.getAll();
    return all.filter(t => t.userId === userId || t.accountId === userId);
  },

  /**
   * Count teacher profiles associated with a user account ID
   */
  async countByUserId(userId) {
    const list = await this.getByUserId(userId);
    return list.length;
  },

  async checkDuplicateTeacherId(teacherId, excludeId = null) {
    if (!teacherId) return false;
    const clean = String(teacherId).trim().toLowerCase();
    const all = await this.getAll();
    const match = all.find(t => t.teacherId.toLowerCase() === clean);
    if (!match) return false;
    if (excludeId && match.id === excludeId) return false;
    return true;
  },

  async create(teacherData) {
    const currentUser = authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';
    const isDirector = currentUser?.role === 'DIRECTOR';
    const isAdmin = currentUser?.role === 'ADMIN';

    // Verify creation permission
    if (!authService.can('teachers.create') && !isDirector && !isAdmin && !isTeacher) {
      throw new Error('Access denied: You do not have permission to create teachers.');
    }

    // Role Enforcement: A Teacher account can link or create only ONE teacher profile
    if (isTeacher) {
      const existingCount = await this.countByUserId(currentUser.id);
      if (existingCount >= 1) {
        throw new Error('Teacher accounts are limited to one profile.');
      }
      teacherData.userId = currentUser.id;
      teacherData.accountId = currentUser.id;
    } else if (currentUser) {
      teacherData.createdBy = currentUser.id;
    }

    const normalized = normalizeTeacherRecord(teacherData);

    // Duplicate Teacher ID check
    if (normalized.teacherId) {
      const isDuplicate = await this.checkDuplicateTeacherId(normalized.teacherId);
      if (isDuplicate) {
        throw new Error(`Teacher ID "${normalized.teacherId}" already exists.`);
      }
    }

    await db.add('teachers', normalized);
    syncStateManager.markDirty('teachers.create');
    return normalized;
  },

  async update(id, data) {
    const currentUser = authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';

    const existing = await this.getById(id);
    if (!existing) throw new Error(`Teacher with ID "${id}" not found.`);

    // If teacher role, verify ownership
    if (isTeacher && existing.userId && existing.userId !== currentUser.id) {
      throw new Error('Access denied: You can only edit your own teacher profile.');
    }

    // Duplicate Teacher ID check if modified
    if (data.teacherId && data.teacherId.trim().toLowerCase() !== existing.teacherId.toLowerCase()) {
      const isDuplicate = await this.checkDuplicateTeacherId(data.teacherId, id);
      if (isDuplicate) {
        throw new Error(`Teacher ID "${data.teacherId}" already exists.`);
      }
    }

    const merged = normalizeTeacherRecord({
      ...existing,
      ...data,
      id,
      updatedAt: new Date().toISOString()
    });

    await db.put('teachers', merged);
    syncStateManager.markDirty('teachers.update');
    return merged;
  },

  async delete(id) {
    const currentUser = authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';

    // Security check: Teachers cannot delete their own profile or any profile
    if (isTeacher) {
      throw new Error('Access denied: Teacher accounts cannot delete teacher records.');
    }

    if (!authService.can('teachers.delete')) {
      throw new Error('Access denied: You do not have permission to delete teachers.');
    }

    const res = await db.delete('teachers', id);
    syncStateManager.markDirty('teachers.delete');
    return res;
  },

  async count() {
    const currentUser = authService.getCurrentUser();
    if (currentUser?.role === 'TEACHER') {
      return await this.countByUserId(currentUser.id);
    }
    return await db.count('teachers');
  },

  /**
   * Query teachers with search, filters, sorting, role-scoping, and pagination
   */
  async query({
    search = '',
    status = '',
    framework = '',
    position = '',
    subject = '',
    filterField = '',
    filterValue = '',
    sortBy = 'teacherId',
    sortDir = 'asc',
    page = 1,
    pageSize = 10
  } = {}) {
    let items = await this.getAll();
    const currentUser = authService.getCurrentUser();

    // 1. Role Scoping: Teachers only see their own profile
    if (currentUser?.role === 'TEACHER') {
      items = items.filter(t => t.userId === currentUser.id || t.accountId === currentUser.id || t.teacherId === currentUser.username);
    }

    // 2. Search query across 44 fields
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(t => {
        return (
          (t.teacherId && t.teacherId.toLowerCase().includes(q)) ||
          (t.civilServantId && t.civilServantId.toLowerCase().includes(q)) ||
          (t.nationalId && t.nationalId.toLowerCase().includes(q)) ||
          (t.khmerName && t.khmerName.toLowerCase().includes(q)) ||
          (t.lastNameKhmer && t.lastNameKhmer.toLowerCase().includes(q)) ||
          (t.firstNameKhmer && t.firstNameKhmer.toLowerCase().includes(q)) ||
          (t.englishName && t.englishName.toLowerCase().includes(q)) ||
          (t.lastNameLatin && t.lastNameLatin.toLowerCase().includes(q)) ||
          (t.firstNameLatin && t.firstNameLatin.toLowerCase().includes(q)) ||
          (t.phone1 && t.phone1.includes(q)) ||
          (t.phone2 && t.phone2.includes(q)) ||
          (t.email && t.email.toLowerCase().includes(q)) ||
          (t.telegram && t.telegram.toLowerCase().includes(q)) ||
          (t.position && t.position.toLowerCase().includes(q)) ||
          (t.framework && t.framework.toLowerCase().includes(q)) ||
          (t.subject1 && t.subject1.toLowerCase().includes(q)) ||
          (t.subject2 && t.subject2.toLowerCase().includes(q)) ||
          (t.subject3 && t.subject3.toLowerCase().includes(q)) ||
          (t.specialization1 && t.specialization1.toLowerCase().includes(q)) ||
          (t.specialization2 && t.specialization2.toLowerCase().includes(q)) ||
          (t.birthProvince && t.birthProvince.toLowerCase().includes(q)) ||
          (t.currentProvince && t.currentProvince.toLowerCase().includes(q))
        );
      });
    }

    // 3. Status filter
    if (status && status !== 'all') {
      items = items.filter(t => t.status === status);
    }

    // 4. Framework filter
    if (framework && framework !== 'all') {
      items = items.filter(t => t.framework === framework);
    }

    // 5. Position filter
    if (position && position !== 'all') {
      items = items.filter(t => t.position === position);
    }

    // 6. Subject filter
    if (subject && subject !== 'all') {
      items = items.filter(t => t.subject1 === subject || t.subject2 === subject || t.subject3 === subject || t.subject === subject);
    }

    // 7. Drill-down Two-step filter (position, framework, workStatus, subject, trainingLevel, highestDegree, gender, village, commune, district, province)
    if (filterField && filterValue && filterValue !== 'all') {
      const field = filterField;
      const targetVal = filterValue.trim().toLowerCase();

      items = items.filter(t => {
        if (field === 'village') {
          return (t.currentVillage && t.currentVillage.trim().toLowerCase() === targetVal) ||
                 (t.birthVillage && t.birthVillage.trim().toLowerCase() === targetVal);
        }
        if (field === 'commune') {
          return (t.currentCommune && t.currentCommune.trim().toLowerCase() === targetVal) ||
                 (t.birthCommune && t.birthCommune.trim().toLowerCase() === targetVal);
        }
        if (field === 'district') {
          return (t.currentDistrict && t.currentDistrict.trim().toLowerCase() === targetVal) ||
                 (t.birthDistrict && t.birthDistrict.trim().toLowerCase() === targetVal);
        }
        if (field === 'province') {
          return (t.currentProvince && t.currentProvince.trim().toLowerCase() === targetVal) ||
                 (t.birthProvince && t.birthProvince.trim().toLowerCase() === targetVal);
        }
        if (field === 'gender') {
          const g = (t.gender || '').trim().toLowerCase();
          return g === targetVal || (targetVal === 'female' && g === 'ស្រី') || (targetVal === 'male' && g === 'ប្រុស');
        }
        if (field === 'subject') {
          return (t.subject1 && t.subject1.trim().toLowerCase() === targetVal) ||
                 (t.subject2 && t.subject2.trim().toLowerCase() === targetVal) ||
                 (t.subject3 && t.subject3.trim().toLowerCase() === targetVal) ||
                 (t.subject && t.subject.trim().toLowerCase() === targetVal);
        }
        if (field === 'specialization') {
          return (t.specialization1 && t.specialization1.trim().toLowerCase() === targetVal) ||
                 (t.specialization2 && t.specialization2.trim().toLowerCase() === targetVal);
        }
        return t[field] && String(t[field]).trim().toLowerCase() === targetVal;
      });
    }

    // 7. Sort
    items.sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pagedItems = items.slice(startIndex, startIndex + pageSize);

    return {
      data: pagedItems,
      total,
      page: safePage,
      pageSize,
      totalPages
    };
  },

  /**
   * Export teachers to Excel (.xlsx)
   */
  async exportToExcel(teachersList = [], options = {}) {
    return await ExcelExportService.exportTeachersToExcel(teachersList, options);
  },

  /**
   * Export teachers to JSON (.json)
   */
  exportToJSON(teachersList = [], options = {}) {
    return ExcelExportService.exportTeachersToJSON(teachersList, options);
  },

  /**
   * Download sample Excel template for teachers
   */
  async downloadSampleTemplate(lang = 'km') {
    return await ExcelExportService.downloadSampleTemplate(lang);
  },

  /**
   * Parse uploaded Excel buffer
   */
  async parseExcelFile(arrayBuffer) {
    return await ExcelExportService.parseTeacherExcelFile(arrayBuffer);
  },

  /**
   * Commit Excel / JSON teacher import batch
   */
  async commitImport(validRows, options = {}) {
    return await ExcelExportService.commitTeacherImport(validRows, options);
  },

  /**
   * Parse JSON string
   */
  async parseJSONFile(jsonString) {
    return await ExcelExportService.parseTeacherJSONFile(jsonString);
  }
};
