import { db } from '../database/db.js';
import { authService } from './authService.js';
import { syncStateManager } from './syncStateManager.js';

/**
 * Normalizes any student record (legacy or newly created) so that all 29 fields
 * exist consistently in memory without deleting or breaking old IndexedDB entries.
 */
export function normalizeStudentRecord(raw) {
  if (!raw) return raw;
  const s = { ...raw };

  // 1. Status
  s.status = s.status || 'Active';

  // 2. Photo
  s.photo = s.photo || '';
  // photoBlob is preserved for client-side blob storage

  // 3. Names: lastNameKh, firstNameKh, lastNameLatin, firstNameLatin
  const rawKhName = s.khmerName || s.name || s.fullName || s['ឈ្មោះ'] || s['ឈ្មោះសិស្ស'] || s['គោត្តនាម និងនាម'] || '';
  if (!s.lastNameKh && !s.firstNameKh && rawKhName) {
    const parts = rawKhName.trim().split(/\s+/);
    s.lastNameKh = parts[0] || '';
    s.firstNameKh = parts.slice(1).join(' ') || '';
  } else {
    s.lastNameKh = s.lastNameKh || '';
    s.firstNameKh = s.firstNameKh || '';
  }

  const rawEnName = s.englishName || (!s.khmerName && s.name ? s.name : '') || '';
  if (!s.lastNameLatin && !s.firstNameLatin && rawEnName) {
    const parts = rawEnName.trim().split(/\s+/);
    s.lastNameLatin = parts[0] || '';
    s.firstNameLatin = parts.slice(1).join(' ') || '';
  } else {
    s.lastNameLatin = s.lastNameLatin || '';
    s.firstNameLatin = s.firstNameLatin || '';
  }

  // Composite compatibility properties for other modules (Attendance, Scores, Reports)
  s.khmerName = [s.lastNameKh, s.firstNameKh].filter(Boolean).join(' ') || s.khmerName || rawKhName || '';
  s.englishName = [s.lastNameLatin, s.firstNameLatin].filter(Boolean).join(' ') || s.englishName || rawEnName || '';

  // 4. Gender & Date of Birth
  s.gender = s.gender || 'Male';
  s.dateOfBirth = s.dateOfBirth || '';

  // 5. Birthplace
  s.birthVillage = s.birthVillage || '';
  s.birthCommune = s.birthCommune || '';
  s.birthDistrict = s.birthDistrict || '';
  s.birthProvince = s.birthProvince || '';

  // 6. Current Residence
  s.currentVillage = s.currentVillage || '';
  s.currentCommune = s.currentCommune || '';
  s.currentDistrict = s.currentDistrict || '';
  s.currentProvince = s.currentProvince || '';

  // 7. Academic
  s.academicYear = s.academicYear || '2024–2025';
  s.lastYearSchool = s.lastYearSchool || raw.lastYearSchool || raw['សាលាចាស់'] || raw['សាលារៀនឆ្នាំមុន'] || '';
  s.school = s.school || '';
  s.classId = s.classId || '';

  // 8. Contact
  s.studentPhone = s.studentPhone || '';

  // 9. Parents
  s.fatherName = s.fatherName || '';
  s.fatherOccupation = s.fatherOccupation || '';
  s.fatherPhone = s.fatherPhone || s.parentPhone || '';

  s.motherName = s.motherName || '';
  s.motherOccupation = s.motherOccupation || '';
  s.motherPhone = s.motherPhone || '';

  // 10. Notes
  s.notes = s.notes || '';

  // 11. Inactive / Dropout Metadata
  const statusStr = String(s.status || '').trim().toLowerCase();
  const rawStatus = String(s.status || '').trim();
  const isInactive = statusStr === 'inactive' || statusStr === 'dropout' || statusStr === 'dropped' || statusStr === 'left' ||
    rawStatus.includes('អសកម្ម') || rawStatus.includes('បោះបង់') || rawStatus.includes('ឈប់រៀន') || rawStatus.includes('ផ្អាក') ||
    Boolean(s.dropoutDate);
  if (isInactive) {
    const todayKh = new Date().toISOString().split('T')[0];
    s.dropoutDate = s.dropoutDate || todayKh;
    s.dropoutSemester = s.dropoutSemester || 'ឆមាសទី១';
    s.dropoutReason = s.dropoutReason || 'បោះបង់ការសិក្សា';
    s.dropoutRemarks = s.dropoutRemarks || '';
  } else {
    s.dropoutDate = s.dropoutDate || null;
    s.dropoutSemester = s.dropoutSemester || null;
    s.dropoutReason = s.dropoutReason || null;
    s.dropoutRemarks = s.dropoutRemarks || null;
  }

  return s;
}

export const StudentService = {
  async getAll() {
    let list = await db.getAll('students');
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        list = list.filter(s => s.classId === teacherClassId);
      }
    }
    const normalized = list.map(normalizeStudentRecord);
    normalized.sort((a, b) => {
      const comp = String(a.lastNameKh || '').localeCompare(String(b.lastNameKh || ''), ['km', 'en'], { numeric: true, sensitivity: 'base' });
      if (comp !== 0) return comp;
      return String(a.firstNameKh || '').localeCompare(String(b.firstNameKh || ''), ['km', 'en'], { numeric: true, sensitivity: 'base' });
    });
    return normalized;
  },

  async getById(id) {
    const student = await db.get('students', id);
    if (!student) return null;
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId && student.classId !== teacherClassId) {
        throw new Error('Access denied: Student does not belong to your assigned classroom.');
      }
    }
    return normalizeStudentRecord(student);
  },

  async getByStudentId(studentId) {
    const list = await db.queryByIndex('students', 'studentId', studentId);
    const student = list[0] || null;
    if (student && authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId && student.classId !== teacherClassId) {
        return null;
      }
    }
    return student ? normalizeStudentRecord(student) : null;
  },

  /**
   * Check whether a student ID already exists (excluding a specific student record when editing)
   */
  async checkDuplicateStudentId(studentId, excludeId = null) {
    const match = await this.getByStudentId(studentId.trim());
    if (!match) return false;
    if (excludeId && match.id === excludeId) return false;
    return true;
  },

  async create(student) {
    if (!student.id) {
      student.id = 'stu-' + Date.now();
    }
    if (!student.createdAt) {
      student.createdAt = new Date().toISOString();
    }
    // Enforce teacher assigned classroom
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        student.classId = teacherClassId;
      }
    }

    const normalized = normalizeStudentRecord(student);
    await db.add('students', normalized);
    syncStateManager.markDirty('students.create');
    return normalized;
  },

  async update(id, data) {
    const existing = await db.get('students', id);
    if (!existing) throw new Error(`Student ${id} not found`);

    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId && existing.classId !== teacherClassId) {
        throw new Error('Access denied: Cannot edit student from another classroom.');
      }
      // Cannot reassign to another classroom
      delete data.classId;
    }

    const merged = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
    const normalized = normalizeStudentRecord(merged);
    await db.put('students', normalized);
    syncStateManager.markDirty('students.update');
    return normalized;
  },

  async delete(id) {
    if (!authService.can('students.delete')) {
      throw new Error('Access denied: You do not have permission to delete students.');
    }
    if (authService.isTeacher()) {
      const existing = await db.get('students', id);
      const teacherClassId = authService.getAssignedClassId();
      if (existing && teacherClassId && existing.classId !== teacherClassId) {
        throw new Error('Access denied: Cannot delete student from another classroom.');
      }
    }
    const res = await db.delete('students', id);
    syncStateManager.markDirty('students.delete');
    return res;
  },

  async bulkDelete(ids) {
    for (const id of ids) {
      await this.delete(id);
    }
    return true;
  },

  async bulkUpdateStatus(ids, status) {
    for (const id of ids) {
      const student = await this.getById(id);
      if (student) {
        student.status = status;
        await db.put('students', normalizeStudentRecord(student));
      }
    }
    if (ids.length > 0) {
      syncStateManager.markDirty('students.bulkUpdateStatus');
    }
    return true;
  },

  async count() {
    if (authService.isTeacher()) {
      const items = await this.getAll();
      return items.length;
    }
    return await db.count('students');
  },

  async getStats() {
    let students = await db.getAll('students');
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        students = students.filter(s => s.classId === teacherClassId);
      }
    }
    const total = students.length;
    const active = students.filter(s => s.status === 'Active').length;
    const inactive = students.filter(s => s.status === 'Inactive').length;
    const graduated = students.filter(s => s.status === 'Graduated').length;
    const transferred = students.filter(s => s.status === 'Transferred').length;
    return { total, active, inactive, graduated, transferred };
  },

  /**
   * Powerful query engine with search, filters, column sort, and pagination
   */
  async query({
    search = '',
    status = '',
    classId = '',
    academicYear = '',
    sortBy = 'lastNameKh',
    sortDir = 'asc',
    page = 1,
    pageSize = 10
  } = {}) {
    let rawItems = await db.getAll('students');

    // 0. Enforce Teacher Classroom restriction
    if (authService.isTeacher()) {
      const teacherClassId = authService.getAssignedClassId();
      if (teacherClassId) {
        classId = teacherClassId;
      }
    }

    let items = rawItems.map(normalizeStudentRecord);

    // 1. Search Filter across all relevant fields
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(s => {
        return (
          (s.studentId && s.studentId.toLowerCase().includes(q)) ||
          (s.lastNameKh && s.lastNameKh.toLowerCase().includes(q)) ||
          (s.firstNameKh && s.firstNameKh.toLowerCase().includes(q)) ||
          (s.lastNameLatin && s.lastNameLatin.toLowerCase().includes(q)) ||
          (s.firstNameLatin && s.firstNameLatin.toLowerCase().includes(q)) ||
          (s.khmerName && s.khmerName.toLowerCase().includes(q)) ||
          (s.englishName && s.englishName.toLowerCase().includes(q)) ||
          (s.gender && s.gender.toLowerCase() === q) ||
          (s.classId && s.classId.toLowerCase().includes(q)) ||
          (s.academicYear && s.academicYear.toLowerCase().includes(q)) ||
          (s.school && s.school.toLowerCase().includes(q)) ||
          (s.studentPhone && s.studentPhone.includes(q)) ||
          (s.fatherName && s.fatherName.toLowerCase().includes(q)) ||
          (s.fatherPhone && s.fatherPhone.includes(q)) ||
          (s.motherName && s.motherName.toLowerCase().includes(q)) ||
          (s.motherPhone && s.motherPhone.includes(q)) ||
          (s.birthVillage && s.birthVillage.toLowerCase().includes(q)) ||
          (s.birthProvince && s.birthProvince.toLowerCase().includes(q)) ||
          (s.currentVillage && s.currentVillage.toLowerCase().includes(q)) ||
          (s.currentProvince && s.currentProvince.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q))
        );
      });
    }

    // 2. Status Filter
    if (status && status !== 'all') {
      items = items.filter(s => s.status === status);
    }

    // 3. Class Filter
    if (classId && classId !== 'all') {
      items = items.filter(s => s.classId === classId);
    }

    // 4. Academic Year Filter
    if (academicYear && academicYear !== 'all') {
      items = items.filter(s => s.academicYear === academicYear);
    }

    // 5. Sorting (Ascending A-Z always on Khmer last name lastNameKh, with multi-field tie-breaking)
    let classMap = null;
    const sortField = sortBy || 'lastNameKh';
    if (sortField === 'classId') {
      try {
        const classes = await db.getAll('classes');
        classMap = new Map(classes.map(c => [c.id, c.name]));
      } catch (_) {}
    }

    items.sort((a, b) => {
      if (sortField !== 'lastNameKh' && sortField !== 'none') {
        let valA = a[sortField] ?? '';
        let valB = b[sortField] ?? '';
        if (sortField === 'classId' && classMap) {
          valA = classMap.get(valA) || valA;
          valB = classMap.get(valB) || valB;
        }
        valA = String(valA);
        valB = String(valB);

        const comparison = valA.localeCompare(valB, ['km', 'en'], { numeric: true, sensitivity: 'base' });
        if (comparison !== 0) {
          return sortDir === 'asc' ? comparison : -comparison;
        }
      }

      // Secondary / Default Sort: ALWAYS Ascending A-Z on Khmer last name (lastNameKh)
      const lastA = String(a.lastNameKh || '');
      const lastB = String(b.lastNameKh || '');
      const lastComp = lastA.localeCompare(lastB, ['km', 'en'], { numeric: true, sensitivity: 'base' });

      if (sortField === 'lastNameKh') {
        if (lastComp !== 0) return sortDir === 'asc' ? lastComp : -lastComp;
      } else if (lastComp !== 0) {
        return lastComp; // Always ascending on Khmer last name
      }

      // Tertiary: Khmer first name ascending
      const firstA = String(a.firstNameKh || '');
      const firstB = String(b.firstNameKh || '');
      const firstComp = firstA.localeCompare(firstB, ['km', 'en'], { numeric: true, sensitivity: 'base' });
      if (firstComp !== 0) return firstComp;

      // Quaternary: Student ID
      return String(a.studentId || '').localeCompare(String(b.studentId || ''), ['km', 'en'], { numeric: true, sensitivity: 'base' });
    });

    // 6. Pagination
    const totalRecords = items.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const validPage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (validPage - 1) * pageSize;
    const pagedItems = items.slice(startIdx, startIdx + pageSize);

    return {
      data: pagedItems,
      total: totalRecords,
      totalPages,
      page: validPage,
      pageSize
    };
  },

  /**
   * Export students to a JSON string containing all 29 fields
   */
  async exportJSON() {
    const students = await this.getAll();
    const exportable = students.map(s => {
      const copy = { ...s };
      // Blobs cannot be JSON serialized directly; omit binary blob from raw JSON text
      delete copy.photoBlob;
      return copy;
    });
    return JSON.stringify(exportable, null, 2);
  },

  /**
   * Import students from a JSON string, with duplicate skipping, missing-ID rejection,
   * unassigned classroom tracking, and teacher role enforcement.
   */
  async importJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid student backup file: Expected an array of student records.');
    }

    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();

    const existingStudents = await db.getAll('students');
    const existingByStudentIdMap = new Map();
    existingStudents.forEach(s => {
      if (s.studentId) {
        existingByStudentIdMap.set(String(s.studentId).trim().toLowerCase(), s);
      }
    });

    const classes = await db.getAll('classes');
    const validClassIds = new Set(classes.map(c => c.id));
    const classNameToIdMap = new Map();
    classes.forEach(c => {
      classNameToIdMap.set(c.name.trim().toLowerCase(), c.id);
      classNameToIdMap.set(c.id.trim().toLowerCase(), c.id);
    });

    let insertedCount = 0;
    const skippedDuplicates = [];
    const missingIdRows = [];
    const unassignedClassStudents = [];
    const importedStudents = [];
    const seenInBatch = new Set();

    parsed.forEach((raw, idx) => {
      if (!raw || typeof raw !== 'object') return;
      const rowNum = idx + 1;
      const studentId = raw.studentId ? String(raw.studentId).trim() : '';
      const lastNameKh = raw.lastNameKh ? String(raw.lastNameKh).trim() : '';
      const firstNameKh = raw.firstNameKh ? String(raw.firstNameKh).trim() : '';
      const studentName = `${lastNameKh} ${firstNameKh}`.trim() || raw.khmerName || raw.englishName || raw.lastNameLatin || `Item #${rowNum}`;

      // 1. Reject missing ID
      if (!studentId) {
        missingIdRows.push({
          rowNum,
          name: studentName,
          reason: 'Missing Student ID'
        });
        return;
      }

      const cleanSid = studentId.toLowerCase();

      // 2. Skip duplicates: DO NOT overwrite
      if (existingByStudentIdMap.has(cleanSid) || seenInBatch.has(cleanSid)) {
        skippedDuplicates.push({
          studentId,
          name: studentName,
          rowNum
        });
        return;
      }

      seenInBatch.add(cleanSid);

      const normalized = normalizeStudentRecord(raw);
      normalized.studentId = studentId;

      // Ensure primary key id
      if (!normalized.id) {
        normalized.id = 'stu-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
      }

      // 3. Class handling & Teacher security
      if (isTeacher && teacherClassId) {
        normalized.classId = teacherClassId;
      } else {
        let rawClass = normalized.classId ? String(normalized.classId).trim() : '';
        if (rawClass && validClassIds.has(rawClass)) {
          normalized.classId = rawClass;
        } else if (rawClass && classNameToIdMap.has(rawClass.toLowerCase())) {
          normalized.classId = classNameToIdMap.get(rawClass.toLowerCase());
        } else {
          normalized.classId = '';
        }
      }

      normalized.createdAt = normalized.createdAt || new Date().toISOString();
      normalized.updatedAt = new Date().toISOString();

      importedStudents.push(normalized);
      if (!isTeacher && (!normalized.classId || !validClassIds.has(normalized.classId))) {
        unassignedClassStudents.push(normalized);
      }
    });

    // Save imported records to IndexedDB
    for (const st of importedStudents) {
      await db.put('students', st);
      existingByStudentIdMap.set(st.studentId.toLowerCase(), st);
      insertedCount++;
    }

    if (insertedCount > 0) {
      syncStateManager.markDirty('students.importJSON');
    }

    return {
      totalRecords: parsed.length,
      importedCount: insertedCount,
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
