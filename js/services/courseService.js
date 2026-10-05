/**
 * Course Management Service
 * Manages school curriculum courses/subjects, max scores per grade level (G7-G12),
 * and standard MoEYS grading scale computation (A-F).
 */

import { db } from '../database/db.js';
import { SettingsService } from './settingsService.js';
import { syncStateManager } from './syncStateManager.js';
import { i18n } from '../i18n/i18n.js';

export const DEFAULT_COURSES = [
  {
    id: 'crs_544',
    courseId: 'CRS-544',
    name: 'សរសេរតាមអាន',
    nameEn: 'Dictation',
    category: 'ភាសាខ្មែរ',
    scores: { G7: 40, G8: 40, G9: 40, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_466',
    courseId: 'CRS-466',
    name: 'តែងសេចក្តី',
    nameEn: 'Essay Writing',
    category: 'ភាសាខ្មែរ',
    scores: { G7: 60, G8: 60, G9: 60, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_929',
    courseId: 'CRS-929',
    name: 'ភាសាខ្មែរ',
    nameEn: 'Khmer Literature',
    category: 'ភាសាខ្មែរ',
    scores: { G7: 100, G8: 100, G9: 100, G10: 0, G11: 0, G12: 0 },
    creditHours: 4,
    notes: ''
  },
  {
    id: 'crs_197',
    courseId: 'CRS-197',
    name: 'គណិតវិទ្យា',
    nameEn: 'Mathematics',
    category: 'វិទ្យាសាស្ត្រពិត',
    scores: { G7: 100, G8: 100, G9: 100, G10: 0, G11: 0, G12: 0 },
    creditHours: 6,
    notes: ''
  },
  {
    id: 'crs_648',
    courseId: 'CRS-648',
    name: 'រូបវិទ្យា',
    nameEn: 'Physics',
    category: 'វិទ្យាសាស្ត្រពិត',
    scores: { G7: 50, G8: 50, G9: 35, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_341',
    courseId: 'CRS-341',
    name: 'គីមីវិទ្យា',
    nameEn: 'Chemistry',
    category: 'វិទ្យាសាស្ត្រពិត',
    scores: { G7: 50, G8: 50, G9: 25, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_104',
    courseId: 'CRS-104',
    name: 'ជីវវិទ្យា',
    nameEn: 'Biology',
    category: 'វិទ្យាសាស្ត្រពិត',
    scores: { G7: 50, G8: 50, G9: 35, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_767',
    courseId: 'CRS-767',
    name: 'ប្រវត្តិវិទ្យា',
    nameEn: 'History',
    category: 'វិទ្យាសាស្ត្រសង្គម',
    scores: { G7: 50, G8: 50, G9: 33, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_358',
    courseId: 'CRS-358',
    name: 'ព័ត៌មានវិទ្យា',
    nameEn: 'Information Technology',
    category: 'បច្ចេកវិទ្យា',
    scores: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_404',
    courseId: 'CRS-404',
    name: 'សីលធម៌-ពលរដ្ឋវិទ្យា',
    nameEn: 'Moral & Civics',
    category: 'វិទ្យាសាស្ត្រសង្គម',
    scores: { G7: 50, G8: 50, G9: 35, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_954',
    courseId: 'CRS-954',
    name: 'ផែនដីវិទ្យា',
    nameEn: 'Earth Science',
    category: 'វិទ្យាសាស្ត្រពិត',
    scores: { G7: 50, G8: 50, G9: 25, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_445',
    courseId: 'CRS-445',
    name: 'ភូមិវិទ្យា',
    nameEn: 'Geography',
    category: 'វិទ្យាសាស្ត្រសង្គម',
    scores: { G7: 50, G8: 50, G9: 32, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_338',
    courseId: 'CRS-338',
    name: 'គេហវិជ្ជា',
    nameEn: 'Home Economics',
    category: 'បំណិនជីវិត',
    scores: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_948',
    courseId: 'CRS-948',
    name: 'អប់រំកាយ',
    nameEn: 'Physical Education',
    category: 'កីឡា និងសិល្បៈ',
    scores: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_447',
    courseId: 'CRS-447',
    name: 'បំណិនជីវិត',
    nameEn: 'Life Skills',
    category: 'បំណិនជីវិត',
    scores: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_111',
    courseId: 'CRS-111',
    name: 'សេដ្ឋកិច្ច',
    nameEn: 'Economics',
    category: 'វិទ្យាសាស្ត្រសង្គម',
    scores: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_760',
    courseId: 'CRS-760',
    name: 'សិល្បៈ',
    nameEn: 'Arts',
    category: 'កីឡា និងសិល្បៈ',
    scores: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_647',
    courseId: 'CRS-647',
    name: 'កសិកម្ម',
    nameEn: 'Agriculture',
    category: 'បំណិនជីវិត',
    scores: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    creditHours: 2,
    notes: ''
  },
  {
    id: 'crs_845',
    courseId: 'CRS-845',
    name: 'ភាសាបរទេស',
    nameEn: 'Foreign Languages',
    category: 'ភាសាបរទេស',
    scores: { G7: 50, G8: 50, G9: 50, G10: 0, G11: 0, G12: 0 },
    creditHours: 4,
    notes: ''
  }
];

export const GRADE_KEYS = ['G7', 'G8', 'G9', 'G10', 'G11', 'G12'];

export const CourseService = {
  /**
   * Helper to format grading scale string based on full score
   * e.g. Grade 8 (Full: 40): A≥36 | B≥32 | C≥28 | D≥24 | E≥20 | F<20
   */
  getGradingScaleText(gradeKey = 'G8', fullScore = 0) {
    const isKm = i18n?.getLocale?.() === 'km';
    const gradeNum = String(gradeKey).replace(/\D/g, '') || '8';
    const score = Number(fullScore) || 0;
    const gradePrefix = isKm ? `ថ្នាក់ទី ${gradeNum}` : `Grade ${gradeNum}`;
    const fullPrefix = isKm ? `ពិន្ទុពេញ: ${score}` : `Full: ${score}`;

    if (score <= 0) {
      return `${gradePrefix} (${fullPrefix}): —`;
    }

    const fmt = (num) => (num % 1 === 0 ? String(num) : num.toFixed(1));

    const a = fmt(score * 0.9);
    const b = fmt(score * 0.8);
    const c = fmt(score * 0.7);
    const d = fmt(score * 0.6);
    const e = fmt(score * 0.5);

    return `${gradePrefix} (${fullPrefix}): A≥${a} | B≥${b} | C≥${c} | D≥${d} | E≥${e} | F<${e}`;
  },

  /**
   * Automatically resolve the appropriate grade level (G7-G12) for a user account
   * based on their assigned classroom (e.g. 7B -> G7, 8A -> G8, 9C -> G9, etc.)
   */
  async resolveActiveGradeForUser(user) {
    if (!user) return 'G8';
    
    // 1. Check user.assignedClassId or user.classId
    const classId = user.classId || user.assignedClassId;
    let className = '';

    if (classId) {
      try {
        const cls = await db.get('classes', classId);
        if (cls?.name) className = cls.name;
        else if (cls?.grade) {
          const num = String(cls.grade).replace(/\D/g, '');
          if (num && GRADE_KEYS.includes(`G${num}`)) return `G${num}`;
        }
      } catch (_) {}
    }

    if (!className && user.className) {
      className = user.className;
    }

    if (className) {
      const match = className.match(/(?:ថ្នាក់ទី|Grade|\b)?\s*([7-9]|1[0-2])\b/i) || className.match(/\b([7-9]|1[0-2])/);
      if (match && match[1]) {
        return `G${match[1]}`;
      }
    }

    // 2. If teacher account, check classes store for classes associated with this teacher
    if (user.role === 'TEACHER') {
      try {
        const allClasses = await db.getAll('classes');
        const teacherClass = allClasses.find(c => c.userId === user.id || c.accountId === user.id || c.teacherId === user.id);
        if (teacherClass?.name) {
          const match = teacherClass.name.match(/\b([7-9]|1[0-2])/);
          if (match && match[1]) return `G${match[1]}`;
        }
      } catch (_) {}
    }

    return 'G8';
  },

  /**
   * Generate next Course ID (e.g. CRS-544)
   */
  async generateCourseId() {
    const courses = await this.getAll();
    const existingIds = new Set(courses.map(c => String(c.courseId).toUpperCase()));
    let rand = Math.floor(100 + Math.random() * 900);
    let code = `CRS-${rand}`;
    while (existingIds.has(code)) {
      rand = Math.floor(100 + Math.random() * 900);
      code = `CRS-${rand}`;
    }
    return code;
  },

  /**
   * Get all courses, automatically seeding full 19 MoEYS catalog if store is newly initialized
   */
  async getAll() {
    try {
      const database = await db.open();
      if (database.objectStoreNames.contains('courses')) {
        const list = await db.getAll('courses');
        if (list && list.length > 0) {
          return list;
        }

        // Seed default initial courses if empty
        for (const item of DEFAULT_COURSES) {
          try {
            await db.add('courses', {
              ...item,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } catch (_) {}
        }
        return await db.getAll('courses');
      }
    } catch (err) {
      console.warn('Courses store access error, falling back:', err);
    }

    // Fallback using workspace settings store
    try {
      const stored = await SettingsService.get('courses_catalog');
      if (Array.isArray(stored) && stored.length > 0) {
        return stored;
      }
      await SettingsService.set('courses_catalog', DEFAULT_COURSES);
      return DEFAULT_COURSES;
    } catch (_) {}

    return DEFAULT_COURSES;
  },

  /**
   * Get course by internal ID or Course ID
   */
  async getById(idOrCode) {
    if (!idOrCode) return null;
    const courses = await this.getAll();
    return courses.find(c => c.id === idOrCode || c.courseId === idOrCode || c.name === idOrCode) || null;
  },

  /**
   * Create a new course record
   */
  async create(data) {
    if (!data || !data.name?.trim()) {
      throw new Error('Course Name is required.');
    }

    const cleanName = data.name.trim();
    let cleanCourseId = (data.courseId || '').trim().toUpperCase();
    if (!cleanCourseId) {
      cleanCourseId = await this.generateCourseId();
    }

    const courses = await this.getAll();
    const duplicate = courses.find(c => c.courseId?.toUpperCase() === cleanCourseId);
    if (duplicate) {
      throw new Error(`Course ID "${cleanCourseId}" already exists.`);
    }

    const parseScores = (rawScores = {}) => {
      const res = {};
      GRADE_KEYS.forEach(g => {
        const val = rawScores[g];
        res[g] = val !== undefined && val !== '' && !isNaN(val) ? Number(val) : 0;
      });
      return res;
    };

    const now = new Date().toISOString();
    const newCourse = {
      id: data.id || ('crs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
      courseId: cleanCourseId,
      name: cleanName,
      nameEn: data.nameEn?.trim() || '',
      category: data.category?.trim() || 'ទូទៅ',
      scores: parseScores(data.scores),
      creditHours: Number(data.creditHours) || 2,
      notes: data.notes?.trim() || '',
      createdAt: data.createdAt || now,
      updatedAt: now
    };

    try {
      const database = await db.open();
      if (database.objectStoreNames.contains('courses')) {
        await db.add('courses', newCourse);
      }
    } catch (err) {
      console.warn('Could not add course to IndexedDB:', err);
    }

    try {
      const updatedList = [...courses, newCourse];
      await SettingsService.set('courses_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('courses.create');
    return newCourse;
  },

  /**
   * Update an existing course record
   */
  async update(id, data) {
    if (!id) throw new Error('Course ID is required for update.');
    const courses = await this.getAll();
    const existing = courses.find(c => c.id === id || c.courseId === id);
    if (!existing) {
      throw new Error('Course not found.');
    }

    const cleanName = (data.name !== undefined ? data.name : existing.name).trim();
    if (!cleanName) {
      throw new Error('Course Name is required.');
    }

    const cleanCourseId = (data.courseId !== undefined ? data.courseId : existing.courseId).trim().toUpperCase();
    const duplicate = courses.find(c => c.id !== existing.id && c.courseId?.toUpperCase() === cleanCourseId);
    if (duplicate) {
      throw new Error(`Course ID "${cleanCourseId}" is already used by another course.`);
    }

    const parseScores = (rawScores = {}) => {
      const res = { ...existing.scores };
      GRADE_KEYS.forEach(g => {
        if (rawScores[g] !== undefined) {
          const val = rawScores[g];
          res[g] = val !== '' && !isNaN(val) ? Number(val) : 0;
        }
      });
      return res;
    };

    const updatedCourse = {
      ...existing,
      courseId: cleanCourseId,
      name: cleanName,
      nameEn: data.nameEn !== undefined ? data.nameEn.trim() : existing.nameEn,
      category: data.category !== undefined ? data.category.trim() : existing.category,
      scores: data.scores ? parseScores(data.scores) : existing.scores,
      creditHours: data.creditHours !== undefined ? Number(data.creditHours) || 0 : existing.creditHours,
      notes: data.notes !== undefined ? data.notes.trim() : existing.notes,
      updatedAt: new Date().toISOString()
    };

    try {
      const database = await db.open();
      if (database.objectStoreNames.contains('courses')) {
        await db.put('courses', updatedCourse);
      }
    } catch (err) {
      console.warn('Could not update course in IndexedDB:', err);
    }

    try {
      const updatedList = courses.map(c => c.id === existing.id ? updatedCourse : c);
      await SettingsService.set('courses_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('courses.update');
    return updatedCourse;
  },

  /**
   * Delete a course record
   */
  async delete(id) {
    if (!id) return false;
    const courses = await this.getAll();
    const target = courses.find(c => c.id === id || c.courseId === id);
    if (!target) return false;

    try {
      const database = await db.open();
      if (database.objectStoreNames.contains('courses')) {
        await db.delete('courses', target.id);
      }
    } catch (err) {
      console.warn('Could not delete course from IndexedDB:', err);
    }

    try {
      const updatedList = courses.filter(c => c.id !== target.id);
      await SettingsService.set('courses_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('courses.delete');
    return true;
  }
};
