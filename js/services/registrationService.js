/**
 * Registration & Admissions Service
 * Isolated Staging Queue for Director role to verify incoming transfer & new student applicants
 * against physical paper hard-copy documents before official enrollment into the school.
 */
import { db } from '../database/db.js';
import { authService } from './authService.js';
import { StudentService, normalizeStudentRecord } from './studentService.js';
import { ClassService } from './classService.js';
import { syncStateManager } from './syncStateManager.js';
import { StudentExcelService } from './studentExcelService.js';

export const RegistrationService = {
  /**
   * Helper: Normalize applicant staging item with exhaustive Khmer & English alias mapping
   */
  normalizeApplicant(raw = {}) {
    if (!raw) return null;
    const item = { ...raw };

    item.id = item.id || 'reg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    // 1. Khmer Names
    const rawKhLast = item.lastNameKh || item['ត្រកូលនាម'] || item['គោត្តនាម'] || item['Khmer Last Name'] || item['Last Name'] || '';
    const rawKhFirst = item.firstNameKh || item['ខ្លួនត្រកូល'] || item['នាម'] || item['Khmer First Name'] || item['First Name'] || '';
    const rawKhFull = item.khmerName || item.name || item.fullName || item['ឈ្មោះ'] || item['ឈ្មោះសិស្ស'] || item['គោត្តនាម និងនាម'] || item['Full Name'] || '';

    if (!rawKhLast && !rawKhFirst && rawKhFull) {
      const parts = String(rawKhFull).trim().split(/\s+/);
      item.lastNameKh = parts[0] || '';
      item.firstNameKh = parts.slice(1).join(' ') || '';
    } else {
      item.lastNameKh = String(rawKhLast || '').trim();
      item.firstNameKh = String(rawKhFirst || '').trim();
    }

    // 2. Latin Names
    const rawEnLast = item.lastNameLatin || item['ឡាតាំងនាម'] || item['ត្រកូលឡាតាំង'] || item['Latin Last Name'] || '';
    const rawEnFirst = item.firstNameLatin || item['ខ្លួនឡាតាំង'] || item['នាមឡាតាំង'] || item['Latin First Name'] || '';
    const rawEnFull = item.englishName || item['English Name'] || item['Latin Name'] || (!rawKhFull && item.name && /^[A-Za-z\s]+$/.test(item.name) ? item.name : '') || '';

    if (!rawEnLast && !rawEnFirst && rawEnFull) {
      const parts = String(rawEnFull).trim().split(/\s+/);
      item.lastNameLatin = (parts[0] || '').toUpperCase();
      item.firstNameLatin = (parts.slice(1).join(' ') || '').toUpperCase();
    } else {
      item.lastNameLatin = String(rawEnLast || '').trim().toUpperCase();
      item.firstNameLatin = String(rawEnFirst || '').trim().toUpperCase();
    }

    // Display / Composite Names
    item.name = [item.lastNameKh, item.firstNameKh].filter(Boolean).join(' ') || String(rawKhFull || '').trim() || [item.lastNameLatin, item.firstNameLatin].filter(Boolean).join(' ') || String(rawEnFull || '').trim();
    item.khmerName = [item.lastNameKh, item.firstNameKh].filter(Boolean).join(' ') || item.name;
    item.englishName = [item.lastNameLatin, item.firstNameLatin].filter(Boolean).join(' ') || String(rawEnFull || '').trim().toUpperCase();

    // 3. Gender
    let rawGender = String(item.gender || item['ភេទ'] || item['Gender'] || item['Sex'] || 'Male').trim().toLowerCase();
    if (rawGender === 'f' || rawGender === 'female' || rawGender.includes('ស្រី') || rawGender.includes('female')) {
      item.gender = 'Female';
    } else {
      item.gender = 'Male';
    }

    // 4. Date of Birth (handling Excel serials, ISO dates, or Date objects)
    let rawDob = item.dob || item.dateOfBirth || item['ថ្ងៃខែឆ្នាំកំណើត'] || item['ថ្ងៃកំណើត'] || item['Date of Birth'] || item['DOB'] || '';
    if (typeof rawDob === 'number' || (!isNaN(rawDob) && String(rawDob).trim() !== '' && Number(rawDob) > 20000 && Number(rawDob) < 60000)) {
      try {
        const serial = Number(rawDob);
        const utcDays = serial - 25569;
        const utcValue = utcDays * 86400 * 1000;
        const date = new Date(utcValue);
        if (!isNaN(date.getTime())) {
          const y = date.getUTCFullYear();
          const m = String(date.getUTCMonth() + 1).padStart(2, '0');
          const d = String(date.getUTCDate()).padStart(2, '0');
          rawDob = `${y}-${m}-${d}`;
        }
      } catch (_) {
        rawDob = String(rawDob);
      }
    } else if (rawDob instanceof Date) {
      const y = rawDob.getFullYear();
      const m = String(rawDob.getMonth() + 1).padStart(2, '0');
      const d = String(rawDob.getDate()).padStart(2, '0');
      rawDob = `${y}-${m}-${d}`;
    }
    item.dob = String(rawDob || '').trim();
    item.dateOfBirth = item.dob;

    // 5. School & Grade
    item.lastYearSchool = String(item.lastYearSchool || item['សាលាចាស់'] || item['សាលារៀនឆ្នាំមុន'] || item['មកពីសាលា'] || item.fromSchool || item['Last Year School'] || item['Previous School'] || '').trim();
    item.school = String(item.school || item['សាលារៀន'] || item['សាលា'] || item['School'] || '').trim();
    item.targetGrade = String(item.targetGrade || item.grade || item['ថ្នាក់ស្នើសុំ'] || item['ថ្នាក់'] || item['កម្រិតថ្នាក់'] || item['Grade'] || item['Target Grade'] || '').trim();
    item.assignedClassId = item.assignedClassId || item.classId || item['ថ្នាក់លេខ'] || null;
    item.tempStudentId = String(item.tempStudentId || item.tempId || item.studentId || item['អត្តលេខ'] || item['អត្តលេខសិស្ស'] || item['Student ID'] || item['ID'] || '').trim();
    item.studentId = String(item.studentId || item['អត្តលេខ'] || item['អត្តលេខសិស្ស'] || item['Student ID'] || '').trim();

    // 6. Status
    item.verificationStatus = String(item.verificationStatus || 'PENDING').toUpperCase();

    // 7. Document checklist
    const docs = item.documentsChecked || {};
    item.documentsChecked = {
      hardcopyForm: Boolean(docs.hardcopyForm || item['ពាក្យសុំចូលរៀន'] || item['ពាក្យសុំ'] || item.hardcopyForm),
      birthCertificate: Boolean(docs.birthCertificate || item['សំបុត្រកំណើត'] || item.birthCertificate),
      transferLetter: Boolean(docs.transferLetter || item['លិខិតផ្ទេរការសិក្សា'] || item['លិខិតផ្ទេរ'] || item.transferLetter),
      transcripts: Boolean(docs.transcripts || item['ព្រឹត្តិបត្រពិន្ទុ'] || item['ព្រឹត្តិបត្រ'] || item['សៀវភៅតាមដាន'] || item.transcripts)
    };

    // 8. Location & Contact
    item.birthVillage = String(item.birthVillage || item['ភូមិកំណើត'] || item['Birth Village'] || '').trim();
    item.birthCommune = String(item.birthCommune || item['ឃុំកំណើត'] || item['សង្កាត់កំណើត'] || item['Birth Commune'] || '').trim();
    item.birthDistrict = String(item.birthDistrict || item['ស្រុកកំណើត'] || item['ខណ្ឌកំណើត'] || item['ក្រុងកំណើត'] || item['Birth District'] || '').trim();
    item.birthProvince = String(item.birthProvince || item['ខេត្តកំណើត'] || item['រាជធានីកំណើត'] || item['Birth Province'] || '').trim();

    item.currentVillage = String(item.currentVillage || item['ភូមិបច្ចុប្បន្ន'] || item['ភូមិ'] || item['Current Village'] || '').trim();
    item.currentCommune = String(item.currentCommune || item['ឃុំបច្ចុប្បន្ន'] || item['ឃុំ'] || item['សង្កាត់'] || item['Current Commune'] || '').trim();
    item.currentDistrict = String(item.currentDistrict || item['ស្រុកបច្ចុប្បន្ន'] || item['ស្រុក'] || item['ខណ្ឌ'] || item['Current District'] || '').trim();
    item.currentProvince = String(item.currentProvince || item['ខេត្តបច្ចុប្បន្ន'] || item['ខេត្ត'] || item['Current Province'] || '').trim();

    item.academicYear = String(item.academicYear || item['ឆ្នាំសិក្សា'] || item['Academic Year'] || '2024–2025').trim();
    item.studentPhone = String(item.studentPhone || item.phone || item['ទូរសព្ទសិស្ស'] || item['លេខទូរសព្ទ'] || item['ទូរសព្ទ'] || item['Student Phone'] || item['Phone'] || '').trim();

    // 9. Parents
    item.fatherName = String(item.fatherName || item['ឈ្មោះឪពុក'] || item['ឪពុក'] || item['Father Name'] || '').trim();
    item.fatherOccupation = String(item.fatherOccupation || item.fatherJob || item['មុខរបរឪពុក'] || item['មុខរបរ'] || item['Father Occupation'] || '').trim();
    item.fatherPhone = String(item.fatherPhone || item['ទូរសព្ទឪពុក'] || item['លេខទូរសព្ទឪពុក'] || item['Father Phone'] || '').trim();

    item.motherName = String(item.motherName || item['ឈ្មោះម្តាយ'] || item['ម្តាយ'] || item['Mother Name'] || '').trim();
    item.motherOccupation = String(item.motherOccupation || item.motherJob || item['មុខរបរម្តាយ'] || item['Mother Occupation'] || '').trim();
    item.motherPhone = String(item.motherPhone || item['ទូរសព្ទម្តាយ'] || item['លេខទូរសព្ទម្តាយ'] || item['Mother Phone'] || '').trim();

    item.notes = String(item.notes || item['ផ្សេងៗ'] || item['កំណត់សម្គាល់'] || item['Notes'] || '').trim();
    item.importedAt = item.importedAt || new Date().toISOString();
    item.verifiedAt = item.verifiedAt || null;
    item.enrolledAt = item.enrolledAt || null;

    return item;
  },

  /**
   * Fetch all applicants from registration queue with optional filtering
   */
  async getAll({ status = 'ALL', grade = 'ALL', search = '' } = {}) {
    let list = [];
    try {
      list = await db.getAll('registration_queue');
    } catch (err) {
      console.warn('Error reading registration_queue:', err);
      return [];
    }

    let normalized = list.map(item => this.normalizeApplicant(item));

    // Filter by status
    if (status && status !== 'ALL') {
      normalized = normalized.filter(item => item.verificationStatus === status);
    }

    // Filter by grade
    if (grade && grade !== 'ALL') {
      normalized = normalized.filter(item => {
        const itemGrade = String(item.targetGrade || '').toLowerCase();
        return itemGrade.includes(String(grade).toLowerCase());
      });
    }

    // Filter by search term (name, tempId, fromSchool)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      normalized = normalized.filter(item => {
        return (
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.englishName && item.englishName.toLowerCase().includes(q)) ||
          (item.tempStudentId && item.tempStudentId.toLowerCase().includes(q)) ||
          (item.studentId && item.studentId.toLowerCase().includes(q)) ||
          (item.lastYearSchool && item.lastYearSchool.toLowerCase().includes(q)) ||
          (item.studentPhone && item.studentPhone.includes(q))
        );
      });
    }

    // Sort descending by importedAt
    normalized.sort((a, b) => {
      const timeA = new Date(a.importedAt || 0).getTime();
      const timeB = new Date(b.importedAt || 0).getTime();
      return timeB - timeA;
    });

    return normalized;
  },

  /**
   * Get applicant by ID
   */
  async getById(id) {
    if (!id) return null;
    const item = await db.get('registration_queue', id);
    return item ? this.normalizeApplicant(item) : null;
  },

  /**
   * Add a single applicant into staging queue
   */
  async create(data) {
    const item = this.normalizeApplicant(data);
    if (!item.tempStudentId) {
      item.tempStudentId = await this.generateTempId();
    }
    await db.add('registration_queue', item);
    return item;
  },

  /**
   * Update applicant details
   */
  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Applicant ${id} not found in registration queue`);

    const merged = { ...existing, ...data, id };
    const normalized = this.normalizeApplicant(merged);
    await db.put('registration_queue', normalized);
    return normalized;
  },

  /**
   * Delete applicant record from staging
   */
  async delete(id) {
    await db.delete('registration_queue', id);
    return true;
  },

  /**
   * Clear all applicants in staging queue
   */
  async clearQueue() {
    await db.clear('registration_queue');
    return true;
  },

  /**
   * Generate Next Temporary Registration ID (e.g. REG-2024-001)
   */
  async generateTempId(year = new Date().getFullYear()) {
    const all = await this.getAll({ status: 'ALL' });
    const count = all.length + 1;
    return `REG-${year}-${String(count).padStart(3, '0')}`;
  },

  /**
   * Auto-generate official next Student ID by scanning active students store
   */
  async generateNextStudentId(prefix = 'STU') {
    const students = await db.getAll('students');
    let maxNum = 0;
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');

    for (const s of students) {
      const sid = String(s.studentId || '').trim();
      const match = sid.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  },

  /**
   * Toggle/update document verification checklist and status
   */
  async verifyApplicant(id, { documentsChecked, notes, assignedClassId, studentId, correctedData = {} } = {}) {
    const applicant = await this.getById(id);
    if (!applicant) throw new Error(`Applicant ${id} not found`);

    const updatedDocs = {
      ...applicant.documentsChecked,
      ...(documentsChecked || {})
    };

    // Calculate if verified: if documents are checked
    const isReady = Object.values(updatedDocs).some(val => val === true);
    const newStatus = isReady ? 'VERIFIED' : 'PENDING';

    // If class is assigned or updated, sync academicYear with the class's academicYear
    const targetClassId = assignedClassId !== undefined ? assignedClassId : (correctedData.classId || applicant.assignedClassId);
    let classAcademicYear = correctedData.academicYear || applicant.academicYear;
    if (targetClassId) {
      try {
        const cls = await ClassService.getById(targetClassId);
        if (cls && cls.academicYear?.trim()) {
          classAcademicYear = cls.academicYear.trim();
        }
      } catch (_) {}
    }

    const merged = {
      ...applicant,
      ...correctedData,
      academicYear: classAcademicYear,
      documentsChecked: updatedDocs,
      verificationStatus: newStatus,
      verifiedAt: isReady ? (applicant.verifiedAt || new Date().toISOString()) : null,
      notes: notes !== undefined ? notes : applicant.notes,
      assignedClassId: assignedClassId !== undefined ? assignedClassId : applicant.assignedClassId,
      studentId: studentId !== undefined ? studentId : applicant.studentId
    };

    const normalized = this.normalizeApplicant(merged);
    await db.put('registration_queue', normalized);
    return normalized;
  },

  /**
   * Reject an applicant
   */
  async rejectApplicant(id, reason = '') {
    const applicant = await this.getById(id);
    if (!applicant) throw new Error(`Applicant ${id} not found`);

    applicant.verificationStatus = 'REJECTED';
    applicant.notes = (applicant.notes ? applicant.notes + '\n' : '') + (reason ? `[REJECTED]: ${reason}` : '[REJECTED]');
    applicant.verifiedAt = new Date().toISOString();

    await db.put('registration_queue', applicant);
    return applicant;
  },

  /**
   * Approve & Enroll Applicant into Active Students Store (Push to School)
   */
  async enrollApplicant(id, { studentId, classId, customFields = {} } = {}) {
    const applicant = await this.getById(id);
    if (!applicant) throw new Error(`Applicant ${id} not found in registration queue`);

    const finalStudentId = (studentId || applicant.studentId || '').trim();
    if (!finalStudentId) {
      throw new Error('Student ID is required for enrollment.');
    }

    // Check duplicate studentId in official students store
    const isDup = await StudentService.checkDuplicateStudentId(finalStudentId);
    if (isDup) {
      throw new Error(`Student ID "${finalStudentId}" already exists in the school roster.`);
    }

    const finalClassId = classId || applicant.assignedClassId;
    if (!finalClassId) {
      throw new Error('A destination classroom (classId) must be assigned before enrolling.');
    }

    // Automatically sync academicYear with the assigned class's academicYear
    let finalAcademicYear = applicant.academicYear || '2024–2025';
    if (finalClassId) {
      try {
        const targetClass = await ClassService.getById(finalClassId);
        if (targetClass && targetClass.academicYear?.trim()) {
          finalAcademicYear = targetClass.academicYear.trim();
        }
      } catch (_) {}
    }

    // Build the complete 29-field official student payload
    const studentRecord = {
      id: 'stu-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      status: 'Active',
      photo: applicant.photo || '',
      photoBlob: applicant.photoBlob || null,
      studentId: finalStudentId,
      lastNameKh: applicant.lastNameKh || '',
      firstNameKh: applicant.firstNameKh || '',
      lastNameLatin: applicant.lastNameLatin || '',
      firstNameLatin: applicant.firstNameLatin || '',
      khmerName: applicant.khmerName || applicant.name || '',
      englishName: applicant.englishName || '',
      gender: applicant.gender || 'Male',
      dateOfBirth: applicant.dateOfBirth || applicant.dob || '',
      birthVillage: applicant.birthVillage || '',
      birthCommune: applicant.birthCommune || '',
      birthDistrict: applicant.birthDistrict || '',
      birthProvince: applicant.birthProvince || '',
      currentVillage: applicant.currentVillage || '',
      currentCommune: applicant.currentCommune || '',
      currentDistrict: applicant.currentDistrict || '',
      currentProvince: applicant.currentProvince || '',
      academicYear: finalAcademicYear,
      lastYearSchool: applicant.lastYearSchool || '',
      school: applicant.school || '',
      classId: finalClassId,
      studentPhone: applicant.studentPhone || '',
      fatherName: applicant.fatherName || '',
      fatherOccupation: applicant.fatherOccupation || '',
      fatherPhone: applicant.fatherPhone || '',
      motherName: applicant.motherName || '',
      motherOccupation: applicant.motherOccupation || '',
      motherPhone: applicant.motherPhone || '',
      guardianName: applicant.guardianName || '',
      guardianOccupation: applicant.guardianOccupation || '',
      guardianPhone: applicant.guardianPhone || '',
      notes: applicant.notes || '',
      createdAt: new Date().toISOString(),
      ...customFields
    };

    // 1. Add into active students store
    const createdStudent = await StudentService.create(studentRecord);

    // 2. Remove from staging queue
    await db.delete('registration_queue', id);

    // 3. Mark dirty for sync
    syncStateManager.markDirty('students.create');

    return createdStudent;
  },

  /**
   * Sort applicants by First Name ascending with Khmer Unicode / Latin collation
   */
  sortAlphabetically(applicants = []) {
    const kmCollator = new Intl.Collator('km', { sensitivity: 'base', numeric: true });
    return [...applicants].sort((a, b) => {
      // 1. Primary: Khmer First Name (or fallback to Khmer composite name or raw name)
      const khNameA = (a.firstNameKh || a.nameKhmer || a.name || '').trim();
      const khNameB = (b.firstNameKh || b.nameKhmer || b.name || '').trim();
      
      const cmp = kmCollator.compare(khNameA, khNameB);
      if (cmp !== 0) return cmp;

      // 2. Secondary: Latin First Name
      const enNameA = (a.firstNameLatin || a.nameLatin || a.englishName || '').trim();
      const enNameB = (b.firstNameLatin || b.nameLatin || b.englishName || '').trim();
      return enNameA.localeCompare(enNameB);
    });
  },

  /**
   * Auto-distribute applicants across multiple target classes evenly (Round-Robin)
   */
  distributeStudents(applicants = [], targetClasses = []) {
    if (!applicants.length || !targetClasses.length) return [];
    
    // Sort alphabetically by first name first
    const sorted = this.sortAlphabetically(applicants);

    return sorted.map((student, index) => {
      const targetClass = targetClasses[index % targetClasses.length];
      return {
        applicant: student,
        assignedClassId: targetClass.id,
        assignedClassName: targetClass.name
      };
    });
  },

  /**
   * Batch update assignedClassId for applicants in registration_queue
   */
  async batchAssignClasses(assignments = []) {
    const updated = [];
    let classMap = new Map();
    try {
      const allClasses = await ClassService.getAll();
      classMap = new Map((allClasses || []).map(c => [c.id, c]));
    } catch (_) {}

    for (const item of assignments) {
      const { id, assignedClassId, targetGrade } = item;
      const applicant = await this.getById(id);
      if (!applicant) continue;
      
      applicant.assignedClassId = assignedClassId;
      if (targetGrade) applicant.targetGrade = targetGrade;

      // Automatically sync academicYear with assigned class
      if (assignedClassId) {
        const cls = classMap.get(assignedClassId);
        if (cls && cls.academicYear?.trim()) {
          applicant.academicYear = cls.academicYear.trim();
        }
      }
      
      await db.put('registration_queue', applicant);
      updated.push(applicant);
    }
    return updated;
  },

  /**
   * Bulk enroll multiple applicants
   */
  async bulkEnrollApplicants(applicantIds = [], { defaultClassId = null, classAssignments = {} } = {}) {
    const results = {
      enrolled: [],
      failed: []
    };

    for (const id of applicantIds) {
      try {
        const applicant = await this.getById(id);
        if (!applicant) {
          results.failed.push({ id, reason: 'Applicant not found' });
          continue;
        }

        const classId = classAssignments[id] || applicant.assignedClassId || defaultClassId;
        if (!classId) {
          results.failed.push({ id, name: applicant.name, reason: 'No destination class assigned' });
          continue;
        }

        let studentId = (applicant.studentId || '').trim();
        if (!studentId) {
          studentId = await this.generateNextStudentId('STU');
        }

        const enrolled = await this.enrollApplicant(id, { studentId, classId });
        results.enrolled.push(enrolled);
      } catch (err) {
        results.failed.push({ id, reason: err.message });
      }
    }

    return results;
  },

  /**
   * Import raw rows or JSON objects into registration_queue
   */
  async importApplicants(records = []) {
    if (!Array.isArray(records) || records.length === 0) {
      return { total: 0, imported: 0, skipped: 0 };
    }

    let importedCount = 0;
    const existingQueue = await db.getAll('registration_queue');

    for (let i = 0; i < records.length; i++) {
      const raw = records[i];
      if (!raw) continue;

      const norm = this.normalizeApplicant(raw);
      if (!norm || (!norm.name && !norm.lastNameKh && !norm.firstNameKh && !norm.lastNameLatin && !norm.firstNameLatin)) {
        continue; // skip completely empty rows
      }

      if (!norm.tempStudentId) {
        norm.tempStudentId = `REG-${new Date().getFullYear()}-${String(existingQueue.length + importedCount + 1).padStart(3, '0')}`;
      }

      await db.add('registration_queue', norm);
      importedCount++;
    }

    return {
      total: records.length,
      imported: importedCount,
      skipped: records.length - importedCount
    };
  }
};
