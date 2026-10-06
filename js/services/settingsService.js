import { db } from '../database/db.js';
import { authService } from './authService.js';

export const SettingsService = {
  async get(key) {
    const item = await db.get('settings', key);
    return item ? item.value : null;
  },

  async set(key, value) {
    return await db.put('settings', { key, value });
  },

  async getAcademicYears() {
    const years = await db.getAll('academicYears');
    if (!years || years.length === 0) {
      const defaultYear = {
        id: 'ay-2024-2025',
        name: '2024–2025',
        isActive: true,
        startDate: '2024-09-01',
        endDate: '2025-06-30'
      };
      await db.put('academicYears', defaultYear);
      await this.set('active_academic_year', '2024–2025');
      return [defaultYear];
    }
    return years;
  },

  async getActiveAcademicYear() {
    const years = await this.getAcademicYears();
    const active = years.find(y => y.isActive);
    if (active) return active.name;
    const fromSettings = await this.get('active_academic_year');
    if (fromSettings) {
      const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
      const match = years.find(y => normDash(y.name) === normDash(fromSettings));
      if (match) return match.name;
    }
    return years[0]?.name || '2024–2025';
  },

  async createAcademicYear({ name, startDate = '', endDate = '' }) {
    if (!name || !name.trim()) {
      throw new Error('Academic year name is required');
    }
    const trimmed = name.trim();
    const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
    const years = await db.getAll('academicYears');
    const existing = years.find(y => normDash(y.name || y) === normDash(trimmed));
    if (existing) {
      return existing;
    }

    // Teacher role rule: Teacher account can create/have only 1 academic year
    const isTeacher = authService.isTeacher();
    if (isTeacher && years && years.length >= 1) {
      throw new Error('គណនីគ្រូបង្រៀនអាចបង្កើតឆ្នាំសិក្សាបានត្រឹមតែ ១ ប៉ុណ្ណោះ (Teacher accounts can create only 1 study year).');
    }

    const cleanSlug = trimmed.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    const uniqueSuffix = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const newId = cleanSlug ? `ay-${cleanSlug}-${uniqueSuffix}` : `ay-${uniqueSuffix}`;

    const newYear = {
      id: newId,
      name: trimmed,
      isActive: years.length === 0, // Automatically active if first year
      startDate,
      endDate,
      createdAt: new Date().toISOString()
    };
    await db.put('academicYears', newYear);
    if (newYear.isActive) {
      await this.set('active_academic_year', trimmed);
    }
    return newYear;
  },

  async updateAcademicYear(idOrName, { name, startDate = '', endDate = '' }) {
    if (!idOrName) throw new Error('Academic year identifier is required for update');
    if (!name || !name.trim()) throw new Error('Academic year name is required');
    const trimmed = name.trim();
    const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
    const years = await db.getAll('academicYears');
    const target = years.find(y => y.id === idOrName || y.name === idOrName || normDash(y.name) === normDash(idOrName));
    if (!target) throw new Error('Academic year not found');

    const oldName = target.name;
    target.name = trimmed;
    target.startDate = startDate;
    target.endDate = endDate;
    target.updatedAt = new Date().toISOString();
    await db.put('academicYears', target);

    if (target.isActive || normDash(oldName) === normDash(await this.getActiveAcademicYear())) {
      await this.set('active_academic_year', trimmed);
    }

    // Cascade update in student & class records if renamed
    if (normDash(oldName) !== normDash(trimmed)) {
      try {
        const students = await db.getAll('students');
        for (const s of students) {
          if (normDash(s.academicYear) === normDash(oldName)) {
            s.academicYear = trimmed;
            await db.put('students', s);
          }
        }
        const classes = await db.getAll('classes');
        for (const c of classes) {
          if (normDash(c.academicYear) === normDash(oldName)) {
            c.academicYear = trimmed;
            await db.put('classes', c);
          }
        }
      } catch (_) {}
    }

    return target;
  },

  async deleteAcademicYear(idOrName) {
    if (!idOrName) return false;
    const years = await this.getAcademicYears();
    if (years.length <= 1) {
      throw new Error('Cannot delete the only academic year in the system.');
    }
    const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
    const target = years.find(y => y.id === idOrName || y.name === idOrName || normDash(y.name) === normDash(idOrName));
    if (!target) return false;
    await db.delete('academicYears', target.id);

    // If deleted year was active, activate first available remaining year
    const activeYear = await this.getActiveAcademicYear();
    if (target.isActive || normDash(target.name) === normDash(activeYear)) {
      const remaining = await db.getAll('academicYears');
      if (remaining && remaining.length > 0) {
        await this.setActiveAcademicYear(remaining[0].name);
      }
    }
    return true;
  },

  async setActiveAcademicYear(yearName) {
    if (!yearName) return null;
    const normDash = (str) => String(str || '').replace(/[–—−]/g, '-').trim().toLowerCase();
    const targetNorm = normDash(yearName);
    const years = await db.getAll('academicYears');
    let matchedName = yearName;
    for (const y of years) {
      const isMatch = (y.name === yearName) || (normDash(y.name) === targetNorm) || (y.id === yearName);
      y.isActive = isMatch;
      if (isMatch) matchedName = y.name;
      await db.put('academicYears', y);
    }
    await this.set('active_academic_year', matchedName);
    return matchedName;
  },

  async getActivityLogs(limit = 10) {
    const logs = await db.getAll('activityLogs');
    return logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  },

  async logActivity(action, description) {
    return await db.add('activityLogs', {
      id: 'log-' + Date.now(),
      action,
      description,
      timestamp: new Date().toISOString()
    });
  },

  async getDatabaseInfo() {
    const info = db.getInfo();
    const studentsCount = await db.count('students');
    const teachersCount = await db.count('teachers');
    const classesCount = await db.count('classes');
    const attendanceCount = await db.count('attendance');

    return {
      ...info,
      counts: {
        students: studentsCount,
        teachers: teachersCount,
        classes: classesCount,
        attendance: attendanceCount
      }
    };
  }
};
