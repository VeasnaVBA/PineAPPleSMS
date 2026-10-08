/**
 * Subject Management Service
 * Manages school curriculum subjects, max scores per grade level (G7-G12), and weekly credit hours.
 * Includes Grade Detection from Classroom Names (e.g. 7A -> G7) and MoEYS Standard Grading Scale (A-F).
 * Persists data in the isolated user workspace IndexedDB (`subjects` store).
 */

import { db } from '../database/db.js';
import { SettingsService } from './settingsService.js';
import { syncStateManager } from './syncStateManager.js';

export const GRADES = ['G7', 'G8', 'G9', 'G10', 'G11', 'G12'];

export const DEFAULT_SUBJECTS = [
  {
    id: 'sub_dictation',
    code: 'SUB-101',
    name: 'សរសេរតាមអាន',
    nameEn: 'Dictation',
    creditHours: 2,
    maxScore: 40,
    scoreByGrade: { G7: 40, G8: 40, G9: 40, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_essay',
    code: 'SUB-102',
    name: 'តែងសេចក្តី',
    nameEn: 'Essay Writing',
    creditHours: 2,
    maxScore: 60,
    scoreByGrade: { G7: 60, G8: 60, G9: 60, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_khmer_lit',
    code: 'SUB-103',
    name: 'ភាសាខ្មែរ',
    nameEn: 'Khmer Literature',
    creditHours: 4,
    maxScore: 100,
    scoreByGrade: { G7: 100, G8: 100, G9: 100, G10: 0, G11: 0, G12: 0 },
    sumOfCourses: 'SUB-101, SUB-102',
    notes: 'មុខវិជ្ជាស្នូល (សរសេរតាមអាន + តែងសេចក្តី)'
  },
  {
    id: 'sub_math',
    code: 'SUB-104',
    name: 'គណិតវិទ្យា',
    nameEn: 'Mathematics',
    creditHours: 6,
    maxScore: 100,
    scoreByGrade: { G7: 100, G8: 100, G9: 100, G10: 0, G11: 0, G12: 0 },
    notes: 'មុខវិជ្ជាស្នូល'
  },
  {
    id: 'sub_physics',
    code: 'SUB-105',
    name: 'រូបវិទ្យា',
    nameEn: 'Physics',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 35, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_chemistry',
    code: 'SUB-106',
    name: 'គីមីវិទ្យា',
    nameEn: 'Chemistry',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 25, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_biology',
    code: 'SUB-107',
    name: 'ជីវវិទ្យា',
    nameEn: 'Biology',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 35, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_history',
    code: 'SUB-108',
    name: 'ប្រវត្តិវិទ្យា',
    nameEn: 'History',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 33, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_ict',
    code: 'SUB-109',
    name: 'ព័ត៌មានវិទ្យា',
    nameEn: 'Information Technology',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_morals',
    code: 'SUB-110',
    name: 'សីលធម៌-ពលរដ្ឋវិទ្យា',
    nameEn: 'Moral & Civics',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 35, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_earth_science',
    code: 'SUB-111',
    name: 'ផែនដីវិទ្យា',
    nameEn: 'Earth Science',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 25, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_geography',
    code: 'SUB-112',
    name: 'ភូមិវិទ្យា',
    nameEn: 'Geography',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 32, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_home_ec',
    code: 'SUB-113',
    name: 'គេហវិជ្ជា',
    nameEn: 'Home Economics',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_pe',
    code: 'SUB-114',
    name: 'អប់រំកាយ',
    nameEn: 'Physical Education',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_life_skills',
    code: 'SUB-115',
    name: 'បំណិនជីវិត',
    nameEn: 'Life Skills',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_economics',
    code: 'SUB-116',
    name: 'សេដ្ឋកិច្ច',
    nameEn: 'Economics',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_arts',
    code: 'SUB-117',
    name: 'សិល្បៈ',
    nameEn: 'Arts & Music',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_agriculture',
    code: 'SUB-118',
    name: 'កសិកម្ម',
    nameEn: 'Agriculture',
    creditHours: 2,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    notes: ''
  },
  {
    id: 'sub_foreign_lang',
    code: 'SUB-119',
    name: 'ភាសាបរទេស',
    nameEn: 'Foreign Language',
    creditHours: 4,
    maxScore: 50,
    scoreByGrade: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    notes: ''
  }
].map((s, idx) => ({ ...s, order: idx }));

export const SubjectService = {
  /**
   * Extract Grade code (G7 - G12) from Classroom Name or Grade string
   * Examples: '7A' -> 'G7', '8-1' -> 'G8', 'ថ្នាក់ទី ៩ក' -> 'G9', '12A1' -> 'G12'
   */
  extractGradeFromClassName(className) {
    if (!className) return 'G7';
    const str = String(className).trim();

    // Convert Khmer numerals to Western Arabic digits
    const khmerNumMap = { '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4', '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9' };
    const normalized = str.replace(/[០-៩]/g, d => khmerNumMap[d] || d);

    // Direct check G7-G12
    const gMatch = normalized.match(/G\s*(1[0-2]|[7-9])/i);
    if (gMatch) return `G${gMatch[1]}`;

    // Match leading or isolated numbers 7, 8, 9, 10, 11, 12
    const numMatch = normalized.match(/(?:grade|ថ្នាក់ទី|ថ្នាក់)?\s*(1[0-2]|[7-9])/i);
    if (numMatch) return `G${numMatch[1]}`;

    return 'G7';
  },

  /**
   * Get subject full score for a specific classroom or grade level
   */
  getSubjectFullScore(subject, classNameOrGrade = 'G7') {
    if (!subject) return 100;
    const gradeKey = (typeof classNameOrGrade === 'string' && classNameOrGrade.startsWith('G')) 
      ? classNameOrGrade 
      : this.extractGradeFromClassName(classNameOrGrade);

    if (subject.scoreByGrade && subject.scoreByGrade[gradeKey] !== undefined) {
      const val = Number(subject.scoreByGrade[gradeKey]);
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
    return Number(subject.maxScore) > 0 ? Number(subject.maxScore) : 100;
  },

  /**
   * Calculate Letter Grade (A, B, C, D, E, F) and details based on score and full score
   * Formula:
   *  Full average is 50.00 (< 25 is F):
   *  A: >= 85% (>= 42.50) of full score (ល្អប្រសើរ)
   *  B: >= 80% and < 85% (40.00 - 42.49) of full score (ល្អណាស់)
   *  C: >= 70% and < 80% (35.00 - 39.99) of full score (ល្អ)
   *  D: >= 60% and < 70% (30.00 - 34.99) of full score (ល្អបង្គួរ)
   *  E: >= 50% and < 60% (25.00 - 29.99) of full score (មធ្យម)
   *  F: < 50% (< 25.00) of full score (< S/2) (ធ្លាក់ / ខ្សោយ)
   */
  calculateGrade(score, fullScore = 50) {
    const s = Number(score) || 0;
    const fs = Number(fullScore) > 0 ? Number(fullScore) : 50;
    const percentage = Math.max(0, (s / fs) * 100);

    if (percentage >= 85) {
      return { grade: 'A', labelKm: 'ល្អប្រសើរ', labelEn: 'Excellent', color: 'emerald', percentage };
    }
    if (percentage >= 80) {
      return { grade: 'B', labelKm: 'ល្អណាស់', labelEn: 'Very Good', color: 'blue', percentage };
    }
    if (percentage >= 70) {
      return { grade: 'C', labelKm: 'ល្អ', labelEn: 'Good', color: 'indigo', percentage };
    }
    if (percentage >= 60) {
      return { grade: 'D', labelKm: 'ល្អបង្គួរ', labelEn: 'Fair / Satisfactory', color: 'amber', percentage };
    }
    if (percentage >= 50) {
      return { grade: 'E', labelKm: 'មធ្យម', labelEn: 'Passing / Average', color: 'orange', percentage };
    }
    return { grade: 'F', labelKm: 'ធ្លាក់', labelEn: 'Needs Improvement / Fail', color: 'rose', percentage };
  },

  /**
   * Get Grading Scale Ranges for a given full score (for preview & UI documentation)
   */
  getGradingScaleSummary(fullScore = 50) {
    const fs = Number(fullScore) > 0 ? Number(fullScore) : 50;
    const round2 = num => Math.round(num * 100) / 100;

    return [
      { grade: 'A', labelKm: 'ល្អប្រសើរ', labelEn: 'Excellent', percentRange: '85% - 100%', minScore: round2(fs * 0.85), maxScore: fs, color: 'emerald' },
      { grade: 'B', labelKm: 'ល្អណាស់', labelEn: 'Very Good', percentRange: '80% - 84.9%', minScore: round2(fs * 0.80), maxScore: round2(fs * 0.8499), color: 'blue' },
      { grade: 'C', labelKm: 'ល្អ', labelEn: 'Good', percentRange: '70% - 79.9%', minScore: round2(fs * 0.70), maxScore: round2(fs * 0.7999), color: 'indigo' },
      { grade: 'D', labelKm: 'ល្អបង្គួរ', labelEn: 'Satisfactory', percentRange: '60% - 69.9%', minScore: round2(fs * 0.60), maxScore: round2(fs * 0.6999), color: 'amber' },
      { grade: 'E', labelKm: 'មធ្យម', labelEn: 'Passing', percentRange: '50% - 59.9%', minScore: round2(fs * 0.50), maxScore: round2(fs * 0.5999), color: 'orange' },
      { grade: 'F', labelKm: 'ធ្លាក់', labelEn: 'Fail', percentRange: '< 50%', minScore: 0, maxScore: round2(fs * 0.4999), color: 'rose' }
    ];
  },

  /**
   * Helper to normalize scoreByGrade object
   */
  normalizeScoreByGrade(data, defaultScore = 100) {
    const res = {};
    const fallback = Number(defaultScore) > 0 ? Number(defaultScore) : 100;
    GRADES.forEach(g => {
      if (data && data[g] !== undefined && data[g] !== null && data[g] !== '') {
        const val = Number(data[g]);
        res[g] = !isNaN(val) && val >= 0 ? val : fallback;
      } else {
        res[g] = fallback;
      }
    });
    return res;
  },

  /**
   * Generate next Subject Code (e.g. SUB-120)
   */
  async generateCode() {
    const subjects = await this.getAll();
    const existingCodes = new Set(subjects.map(s => String(s.code || '').toUpperCase()));
    let nextNum = subjects.length + 101;
    let code = `SUB-${nextNum}`;
    while (existingCodes.has(code)) {
      nextNum++;
      code = `SUB-${nextNum}`;
    }
    return code;
  },

  /**
   * Get all subjects with auto-seeding if newly initialized, sorted by order
   */
  async getAll() {
    let list = [];
    try {
      const database = await db.open();
      if (database && database.objectStoreNames && database.objectStoreNames.contains('subjects')) {
        const dbList = await db.getAll('subjects');
        if (Array.isArray(dbList) && dbList.length > 0) {
          list = dbList;
        } else {
          // Auto-seed default MoEYS standard subjects with explicit order
          for (let i = 0; i < DEFAULT_SUBJECTS.length; i++) {
            const item = { ...DEFAULT_SUBJECTS[i], order: i };
            try {
              await db.add('subjects', {
                ...item,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            } catch (_) {}
          }
          list = await db.getAll('subjects');
        }
      }
    } catch (err) {
      console.warn('Subjects store access notice, falling back:', err);
    }

    // Fallback using settings store
    if (!list || list.length === 0) {
      try {
        const stored = await SettingsService.get('subjects_catalog');
        if (Array.isArray(stored) && stored.length > 0) {
          list = stored;
        } else {
          const seeded = DEFAULT_SUBJECTS.map((s, idx) => ({ ...s, order: idx }));
          await SettingsService.set('subjects_catalog', seeded);
          list = seeded;
        }
      } catch (_) {
        list = DEFAULT_SUBJECTS.map((s, idx) => ({ ...s, order: idx }));
      }
    }

    // Sort by user-defined order (fallback to array index if missing)
    const sorted = [...list].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 999999;
      const orderB = typeof b.order === 'number' ? b.order : 999999;
      return orderA - orderB;
    });

    return sorted.map((s, idx) => {
      let sumOfCourses = s.sumOfCourses;
      if (!sumOfCourses && (s.id === 'sub_khmer_lit' || s.code === 'SUB-103')) {
        sumOfCourses = 'SUB-101, SUB-102';
      }
      return {
        ...s,
        sumOfCourses,
        order: typeof s.order === 'number' ? s.order : idx,
        scoreByGrade: this.normalizeScoreByGrade(s.scoreByGrade, s.maxScore || 100)
      };
    });
  },

  /**
   * Get subject by ID or Code
   */
  async getById(idOrCode) {
    if (!idOrCode) return null;
    const list = await this.getAll();
    return list.find(s => s.id === idOrCode || s.code === idOrCode || s.name === idOrCode) || null;
  },

  /**
   * Create a new subject
   */
  async create(data) {
    if (!data || !data.name?.trim()) {
      throw new Error('សូមបញ្ចូលឈ្មោះមុខវិជ្ជា (Subject Name is required).');
    }

    const cleanName = data.name.trim();
    let cleanCode = (data.code || '').trim().toUpperCase();
    if (!cleanCode) {
      cleanCode = await this.generateCode();
    }

    const subjects = await this.getAll();
    const duplicate = subjects.find(s => s.code?.toUpperCase() === cleanCode);
    if (duplicate) {
      throw new Error(`កូដមុខវិជ្ជា "${cleanCode}" មានរួចហើយ (Subject code already exists).`);
    }

    const maxScore = Number(data.maxScore) > 0 ? Number(data.maxScore) : 100;
    const scoreByGrade = this.normalizeScoreByGrade(data.scoreByGrade, maxScore);

    const now = new Date().toISOString();
    const newSubject = {
      id: data.id || ('sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
      code: cleanCode,
      order: typeof data.order === 'number' ? data.order : subjects.length,
      name: cleanName,
      nameEn: data.nameEn?.trim() || '',
      maxScore,
      scoreByGrade,
      creditHours: Number(data.creditHours) > 0 ? Number(data.creditHours) : 2,
      sumOfCourses: data.sumOfCourses ? String(data.sumOfCourses).trim() : '',
      description: data.description ? String(data.description).trim() : (data.notes?.trim() || ''),
      notes: data.notes?.trim() || '',
      createdAt: data.createdAt || now,
      updatedAt: now
    };

    try {
      const database = await db.open();
      if (database && database.objectStoreNames && database.objectStoreNames.contains('subjects')) {
        await db.add('subjects', newSubject);
      }
    } catch (err) {
      console.warn('Could not add subject to IndexedDB:', err);
    }

    try {
      const updatedList = [...subjects, newSubject];
      await SettingsService.set('subjects_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('subjects.create');
    return newSubject;
  },

  /**
   * Update an existing subject
   */
  async update(id, data) {
    if (!id) throw new Error('Subject ID is required for update.');
    const subjects = await this.getAll();
    const existing = subjects.find(s => s.id === id || s.code === id);
    if (!existing) {
      throw new Error('រកមិនឃើញមុខវិជ្ជា (Subject not found).');
    }

    const cleanName = (data.name !== undefined ? data.name : existing.name).trim();
    if (!cleanName) {
      throw new Error('សូមបញ្ចូលឈ្មោះមុខវិជ្ជា (Subject Name is required).');
    }

    const cleanCode = (data.code !== undefined ? data.code : existing.code).trim().toUpperCase();
    const duplicate = subjects.find(s => s.id !== existing.id && s.code?.toUpperCase() === cleanCode);
    if (duplicate) {
      throw new Error(`កូដមុខវិជ្ជា "${cleanCode}" ត្រូវបានប្រើប្រាស់រួចហើយ (Subject code is already used).`);
    }

    const maxScore = data.maxScore !== undefined && Number(data.maxScore) > 0 ? Number(data.maxScore) : existing.maxScore;
    const scoreByGrade = this.normalizeScoreByGrade(data.scoreByGrade !== undefined ? data.scoreByGrade : existing.scoreByGrade, maxScore);

    const updatedSubject = {
      ...existing,
      code: cleanCode,
      order: typeof data.order === 'number' ? data.order : (typeof existing.order === 'number' ? existing.order : 0),
      name: cleanName,
      nameEn: data.nameEn !== undefined ? data.nameEn.trim() : (existing.nameEn || ''),
      maxScore,
      scoreByGrade,
      creditHours: data.creditHours !== undefined && Number(data.creditHours) > 0 ? Number(data.creditHours) : existing.creditHours,
      sumOfCourses: data.sumOfCourses !== undefined ? String(data.sumOfCourses).trim() : (existing.sumOfCourses || ''),
      description: data.description !== undefined ? String(data.description).trim() : (existing.description || ''),
      notes: data.notes !== undefined ? data.notes.trim() : (existing.notes || ''),
      updatedAt: new Date().toISOString()
    };

    try {
      const database = await db.open();
      if (database && database.objectStoreNames && database.objectStoreNames.contains('subjects')) {
        await db.put('subjects', updatedSubject);
      }
    } catch (err) {
      console.warn('Could not update subject in IndexedDB:', err);
    }

    try {
      const updatedList = subjects.map(s => s.id === existing.id ? updatedSubject : s);
      await SettingsService.set('subjects_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('subjects.update');
    return updatedSubject;
  },

  /**
   * Delete a subject
   */
  async delete(id) {
    if (!id) return false;
    const subjects = await this.getAll();
    const target = subjects.find(s => s.id === id || s.code === id);
    if (!target) return false;

    try {
      const database = await db.open();
      if (database && database.objectStoreNames && database.objectStoreNames.contains('subjects')) {
        await db.delete('subjects', target.id);
      }
    } catch (err) {
      console.warn('Could not delete subject from IndexedDB:', err);
    }

    try {
      const updatedList = subjects.filter(s => s.id !== target.id);
      await SettingsService.set('subjects_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('subjects.delete');
    return true;
  },

  /**
   * Reorder subjects given an array of subject IDs in desired order
   */
  async reorderSubjects(orderedIds) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return this.getAll();
    const subjects = await this.getAll();

    const idMap = new Map();
    subjects.forEach(s => idMap.set(s.id, s));

    const reordered = [];
    const handled = new Set();

    orderedIds.forEach(id => {
      if (idMap.has(id)) {
        reordered.push(idMap.get(id));
        handled.add(id);
      }
    });

    // Append any subjects not explicitly included in orderedIds
    subjects.forEach(s => {
      if (!handled.has(s.id)) {
        reordered.push(s);
      }
    });

    // Re-index order 0, 1, 2...
    const now = new Date().toISOString();
    const updatedList = reordered.map((s, idx) => ({
      ...s,
      order: idx,
      updatedAt: now
    }));

    try {
      const database = await db.open();
      if (database && database.objectStoreNames && database.objectStoreNames.contains('subjects')) {
        for (const item of updatedList) {
          await db.put('subjects', item);
        }
      }
    } catch (err) {
      console.warn('Could not persist reordered subjects in IndexedDB:', err);
    }

    try {
      await SettingsService.set('subjects_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('subjects.reorder');
    return updatedList;
  },

  /**
   * Move subject to the first (top) position
   */
  async moveSubjectToFirst(subjectId) {
    if (!subjectId) return this.getAll();
    const subjects = await this.getAll();
    const index = subjects.findIndex(s => s.id === subjectId || s.code === subjectId);
    if (index <= 0) return subjects; // Already first or not found

    const target = subjects[index];
    const others = subjects.filter((_, idx) => idx !== index);
    const orderedIds = [target.id, ...others.map(s => s.id)];
    return this.reorderSubjects(orderedIds);
  },

  /**
   * Move subject up (prev) or down (next) by 1 position
   * direction: 'up' (earlier) or 'down' (later)
   */
  async moveSubject(subjectId, direction = 'up') {
    if (!subjectId) return this.getAll();
    const subjects = await this.getAll();
    const index = subjects.findIndex(s => s.id === subjectId || s.code === subjectId);
    if (index === -1) return subjects;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= subjects.length) return subjects; // Cannot move past boundary

    const newOrder = [...subjects];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;

    const orderedIds = newOrder.map(s => s.id);
    return this.reorderSubjects(orderedIds);
  },

  /**
   * Restore standard default curriculum subjects
   */
  async restoreDefaults() {
    try {
      const database = await db.open();
      if (database && database.objectStoreNames && database.objectStoreNames.contains('subjects')) {
        await db.clear('subjects');
        for (let i = 0; i < DEFAULT_SUBJECTS.length; i++) {
          const item = { ...DEFAULT_SUBJECTS[i], order: i };
          await db.add('subjects', {
            ...item,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.warn('Could not clear and re-seed IndexedDB subjects:', err);
    }

    const seeded = DEFAULT_SUBJECTS.map((s, idx) => ({ ...s, order: idx }));
    try {
      await SettingsService.set('subjects_catalog', seeded);
    } catch (_) {}

    syncStateManager.markDirty('subjects.restore');
    return seeded;
  },

  /**
   * Parse comma/space-separated course codes into an array of uppercase codes/IDs
   */
  getSumSubCourseCodes(subject) {
    if (!subject || !subject.sumOfCourses) return [];
    if (Array.isArray(subject.sumOfCourses)) return subject.sumOfCourses;
    return String(subject.sumOfCourses)
      .split(/[,+;\s]+/)
      .map(c => c.trim().toUpperCase())
      .filter(Boolean);
  },

  /**
   * Check if a subject is a calculated/composite subject (sum of other subjects)
   */
  isCalculatedSubject(subject) {
    return this.getSumSubCourseCodes(subject).length > 0;
  },

  /**
   * Calculate composite score for a subject from a map/object of student scores
   */
  calculateCompositeScore(subject, allSubjects, subjectScores) {
    if (!this.isCalculatedSubject(subject)) return null;
    const subCodes = this.getSumSubCourseCodes(subject);
    const componentSubs = allSubjects.filter(other =>
      other.id !== subject.id && (
        subCodes.includes(String(other.code || '').toUpperCase()) ||
        subCodes.includes(String(other.id || '').toUpperCase())
      )
    );

    if (componentSubs.length === 0) return null;

    let sum = 0;
    let hasAnyScore = false;
    componentSubs.forEach(cSub => {
      const v = subjectScores[cSub.id];
      if (v !== null && v !== undefined && v !== '') {
        sum += Number(v);
        hasAnyScore = true;
      }
    });

    return hasAnyScore ? Math.round(sum * 10) / 10 : null;
  }
};
