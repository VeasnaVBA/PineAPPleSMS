/**
 * Academic Year Promotion & Progression Service
 * Handles student promotion between academic years, section mapping, and balanced auto-distribution.
 */
import { db } from '../database/db.js';
import { StudentService } from './studentService.js';
import { ClassService } from './classService.js';
import { syncStateManager } from './syncStateManager.js';

export const PromotionService = {
  /**
   * Extract numeric grade from grade string (e.g. "Grade 7" -> 7, "ថ្នាក់ទី ៨" -> 8, "ថ្នាក់ទី ៩" -> 9, "7" -> 7)
   */
  parseGradeNumber(gradeStr) {
    if (!gradeStr) return null;
    const khmerDigits = { '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4', '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9' };
    const normalized = String(gradeStr).replace(/[០-៩]/g, d => khmerDigits[d] || d);
    const match = normalized.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  },

  /**
   * Determine next target grade (e.g. 7 -> 8, 8 -> 9, 12 -> Graduated)
   */
  computeNextGrade(sourceGrade) {
    const num = this.parseGradeNumber(sourceGrade);
    if (num === null) return '';
    if (num >= 12) return 'Graduated';
    return String(num + 1);
  },

  /**
   * Extract suffix or section code from class name (e.g. "7A" -> "A", "ថ្នាក់ 8B" -> "B", "7ក" -> "ក", "Grade 7-1" -> "1")
   */
  extractClassSuffix(className) {
    if (!className) return '';
    const clean = String(className).trim();
    // Match single letter or digit suffix at the end (e.g. 7A -> A, 7-1 -> 1, 7ក -> ក)
    const match = clean.match(/[\d]+[\s\-_]*([A-Za-z\u1780-\u17D3\d]+)$/);
    if (match && match[1]) {
      return match[1];
    }
    // Fallback: take last word or character
    const words = clean.split(/\s+/);
    return words[words.length - 1] || '';
  },

  /**
   * Generate destination class name in same section format (e.g. source 7A + target grade 8 -> "8A")
   */
  computeSameSectionClassName(sourceClassName, targetGrade) {
    const suffix = this.extractClassSuffix(sourceClassName);
    const targetGradeNum = this.parseGradeNumber(targetGrade) || targetGrade;
    if (!suffix) {
      return `Grade ${targetGradeNum}`;
    }
    // If source had "Grade 7A" or "ថ្នាក់ 7A"
    if (sourceClassName.includes('ថ្នាក់')) {
      return `ថ្នាក់ ${targetGradeNum}${suffix}`;
    }
    return `${targetGradeNum}${suffix}`;
  },

  /**
   * Sort students alphabetically by first name with Khmer Unicode and Latin collation
   */
  sortStudentsAlphabetically(students = []) {
    const kmCollator = new Intl.Collator('km', { sensitivity: 'base', numeric: true });
    return [...students].sort((a, b) => {
      // 1. Primary sort: Khmer First Name
      const khNameA = (a.firstNameKh || a.nameKhmer || a.name || '').trim();
      const khNameB = (b.firstNameKh || b.nameKhmer || b.name || '').trim();
      
      const cmp = kmCollator.compare(khNameA, khNameB);
      if (cmp !== 0) return cmp;

      // 2. Secondary sort: Latin First Name
      const enNameA = (a.firstNameLatin || a.nameLatin || a.englishName || '').trim();
      const enNameB = (b.firstNameLatin || b.nameLatin || b.englishName || '').trim();
      return enNameA.localeCompare(enNameB);
    });
  },

  /**
   * Fetch strictly existing target classes for a specific grade and academic year from IndexedDB
   */
  async getTargetClasses({ grade, academicYear }) {
    const allClasses = await ClassService.getAll();
    const targetGradeNum = this.parseGradeNumber(grade);
    if (targetGradeNum === null) return [];

    return allClasses.filter(c => {
      const cGradeNum = this.parseGradeNumber(c.grade || c.name);
      if (cGradeNum !== targetGradeNum) return false;
      if (academicYear && c.academicYear) {
        const normY = y => String(y || '').replace(/[–—−]/g, '-').trim();
        if (normY(c.academicYear) !== normY(academicYear)) return false;
      }
      return true;
    });
  },

  /**
   * Find matching counterpart class section from existing target classes (e.g. 7A -> 8A, 7B -> 8B)
   */
  findMatchingClassSection(sourceClassName, targetGrade, existingTargetClasses = []) {
    const expectedName = this.computeSameSectionClassName(sourceClassName, targetGrade);
    const expectedSuffix = this.extractClassSuffix(sourceClassName).toLowerCase();

    // 1. Exact name match
    const exact = existingTargetClasses.find(c => 
      c.name.trim().toLowerCase() === expectedName.trim().toLowerCase()
    );
    if (exact) return exact;

    // 2. Suffix match (e.g. source 7A matches any Grade 8 class ending with A or having section A)
    if (expectedSuffix) {
      const suffixMatch = existingTargetClasses.find(c => {
        const sSuffix = this.extractClassSuffix(c.name).toLowerCase();
        return sSuffix === expectedSuffix;
      });
      if (suffixMatch) return suffixMatch;
    }

    return null;
  },

  /**
   * Auto-distribute students across target classes evenly with Alphabetical + Gender balance
   */
  distributeStudentsBalanced(students = [], targetClasses = []) {
    if (!students.length || !targetClasses.length) return [];

    // Separate by gender
    const females = [];
    const males = [];

    students.forEach(s => {
      const g = (s.gender || '').toLowerCase();
      if (g.includes('female') || g.includes('ស្រី') || g === 'f') {
        females.push(s);
      } else {
        males.push(s);
      }
    });

    // Sort both groups alphabetically
    const sortedFemales = this.sortStudentsAlphabetically(females);
    const sortedMales = this.sortStudentsAlphabetically(males);

    const assignments = new Map(); // studentId -> { student, targetClass }

    // 1. Distribute females across target classes (Round-Robin)
    sortedFemales.forEach((student, idx) => {
      const targetClass = targetClasses[idx % targetClasses.length];
      assignments.set(student.id, {
        student,
        targetClassId: targetClass.id,
        targetClassName: targetClass.name
      });
    });

    // 2. Distribute males across target classes (offset to maintain balance if classes have different sizes)
    const maleOffset = sortedFemales.length % targetClasses.length;
    sortedMales.forEach((student, idx) => {
      const targetClass = targetClasses[(idx + maleOffset) % targetClasses.length];
      assignments.set(student.id, {
        student,
        targetClassId: targetClass.id,
        targetClassName: targetClass.name
      });
    });

    // Return list in alphabetical order
    const allSorted = this.sortStudentsAlphabetically(students);
    return allSorted.map(s => assignments.get(s.id));
  },

  /**
   * Execute Promotion: update all promoted students in the students store
   */
  async executePromotion({ promotions = [], targetAcademicYear, targetGrade, isGraduation = false }) {
    if (!promotions.length) {
      throw new Error('No students selected for promotion.');
    }

    // Verify all non-graduating students have a valid targetClassId from classes store
    if (!isGraduation && targetGrade !== 'Graduated') {
      const allClasses = await ClassService.getAll();
      const validClassIds = new Set(allClasses.map(c => c.id));

      for (const item of promotions) {
        if (!item.targetClassId || !validClassIds.has(item.targetClassId)) {
          throw new Error(`Target class ID "${item.targetClassId}" is invalid or does not exist in the Classes module.`);
        }
      }
    }

    const results = {
      promoted: [],
      failed: [],
      classBreakdown: new Map() // className -> count
    };

    for (const item of promotions) {
      try {
        const { studentId, targetClassId, targetClassName, oldClassName } = item;
        const student = await db.get('students', studentId);
        if (!student) {
          results.failed.push({ studentId, reason: 'Student not found' });
          continue;
        }

        if (isGraduation || targetGrade === 'Graduated') {
          // Mark student as Graduated
          student.status = 'Graduated';
          student.grade = 'Graduated';
          student.classId = null;
          student.academicYear = targetAcademicYear;
          student.notes = (student.notes ? student.notes + '\n' : '') + `[Graduated]: Completed Grade ${student.grade || ''} in Academic Year ${targetAcademicYear}`;
        } else {
          // Promote to new grade and class
          student.academicYear = targetAcademicYear;
          student.grade = String(targetGrade);
          student.classId = targetClassId;
          student.status = 'Active';
          if (oldClassName) {
            student.lastYearSchool = student.lastYearSchool || student.school || '';
          }
        }

        student.updatedAt = new Date().toISOString();
        await db.put('students', student);
        results.promoted.push(student);

        // Update stats breakdown
        const cName = targetClassName || (isGraduation ? 'Graduated' : 'Unassigned');
        results.classBreakdown.set(cName, (results.classBreakdown.get(cName) || 0) + 1);
      } catch (err) {
        results.failed.push({ studentId: item.studentId, reason: err.message });
      }
    }

    syncStateManager.markDirty('students.update');
    return results;
  }
};
