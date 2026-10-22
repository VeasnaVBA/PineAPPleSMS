/**
 * School Service
 * Manages school records stored in the 'schools' IndexedDB store,
 * providing full CRUD with unique code validation and fallback mechanisms.
 */
import { db } from '../database/db.js';
import { SettingsService } from './settingsService.js';
import { authService } from './authService.js';
import { syncStateManager } from './syncStateManager.js';
import { WorkspaceSetupService } from './workspaceSetupService.js';

const DEFAULT_SCHOOLS = [];

export const SchoolService = {
  async clearCache() {
    try {
      await SettingsService.delete('schools_catalog');
      await SettingsService.delete('schools_initialized');
    } catch (_) {}
  },

  /**
   * Get all registered schools
   */
  async getAllSchools() {
    try {
      const database = await db.open();
      if (database.objectStoreNames.contains('schools')) {
        const list = await db.getAll('schools');
        if (list && list.length > 0) {
          return list;
        }
        return [];
      }
    } catch (err) {
      console.warn('Schools store access error, falling back:', err);
    }

    // Fallback using workspace settings store
    try {
      const stored = await SettingsService.get('schools_catalog');
      if (Array.isArray(stored)) {
        return stored;
      }
    } catch (_) {}

    return [];
  },

  /**
   * Alias for getAllSchools
   */
  async getAll() {
    return await this.getAllSchools();
  },

  /**
   * Get a single school by ID or name
   */
  async getSchoolById(idOrName) {
    if (!idOrName) return null;
    const schools = await this.getAllSchools();
    return schools.find(s => s.id === idOrName || s.code === idOrName || s.name === idOrName) || null;
  },

  /**
   * Alias for getSchoolById
   */
  async getById(idOrName) {
    return await this.getSchoolById(idOrName);
  },

  /**
   * Create a new school record
   */
  async createSchool(data, currentUser = null) {
    const user = currentUser || authService.getCurrentUser();
    if (user && user.role === 'TEACHER') {
      const existingSchools = await this.getAllSchools();
      if (existingSchools && existingSchools.length >= 1) {
        throw new Error('Teacher accounts are limited to 1 school profile.');
      }
    }
    // If user.role === 'DIRECTOR' (or ADMIN), allow unlimited creations without restrictions.

    if (!data || !data.name?.trim()) {
      throw new Error('School Name is required.');
    }
    const cleanName = data.name.trim();
    const cleanCode = (data.code || '').trim();

    if (!cleanCode) {
      throw new Error('School Code is required.');
    }

    const schools = await this.getAllSchools();

    // Check code uniqueness
    const duplicateCode = schools.find(s => s.code?.toLowerCase() === cleanCode.toLowerCase());
    if (duplicateCode) {
      throw new Error(`School Code "${cleanCode}" already exists.`);
    }

    const village = data.village !== undefined ? String(data.village).trim() : '';
    const commune = data.commune !== undefined ? String(data.commune).trim() : '';
    const district = data.district !== undefined ? String(data.district).trim() : '';
    const province = data.province !== undefined ? String(data.province).trim() : '';
    let address = data.address !== undefined ? String(data.address).trim() : '';

    if (!address && (village || commune || district || province)) {
      address = [
        village ? `ភូមិ${village}` : '',
        commune ? `ឃុំ/សង្កាត់${commune}` : '',
        district ? `ស្រុក/ខណ្ឌ${district}` : '',
        province ? `រាជធានី/ខេត្ត${province}` : ''
      ].filter(Boolean).join(' ');
    }

    const now = new Date().toISOString();
    const newSchool = {
      id: data.id || ('sch-' + Date.now()),
      code: cleanCode,
      name: cleanName,
      nameEn: data.nameEn ? String(data.nameEn).trim() : '',
      village,
      commune,
      district,
      province,
      address,
      director: data.director?.trim() || '',
      phone: data.phone?.trim() || '',
      notes: data.notes?.trim() || '',
      createdAt: data.createdAt || now,
      updatedAt: now
    };

    try {
      const database = await db.open();
      if (database.objectStoreNames.contains('schools')) {
        await db.add('schools', newSchool);
      }
    } catch (err) {
      console.warn('Could not add school to IndexedDB store:', err);
    }

    // Persist in fallback settings cache
    try {
      const updated = [...schools, newSchool];
      await SettingsService.set('schools_catalog', updated);
    } catch (_) {}

    syncStateManager.markDirty('schools.create');
    WorkspaceSetupService.notifySetupChange();
    return newSchool;
  },

  /**
   * Alias for createSchool
   */
  async add(data, currentUser = null) {
    return await this.createSchool(data, currentUser);
  },

  /**
   * Update an existing school record
   */
  async updateSchool(id, data) {
    if (!id) throw new Error('School ID is required for update.');
    const schools = await this.getAllSchools();
    const existing = schools.find(s => s.id === id);
    if (!existing) {
      throw new Error('School not found.');
    }

    const cleanCode = (data.code !== undefined ? data.code : existing.code).trim();
    const cleanName = (data.name !== undefined ? data.name : existing.name).trim();

    if (!cleanCode) {
      throw new Error('School Code is required.');
    }
    if (!cleanName) {
      throw new Error('School Name is required.');
    }

    // Check code uniqueness against other schools
    const duplicateCode = schools.find(s => s.id !== id && s.code?.toLowerCase() === cleanCode.toLowerCase());
    if (duplicateCode) {
      throw new Error(`School Code "${cleanCode}" is already in use by another school.`);
    }

    const village = data.village !== undefined ? String(data.village).trim() : (existing.village || '');
    const commune = data.commune !== undefined ? String(data.commune).trim() : (existing.commune || '');
    const district = data.district !== undefined ? String(data.district).trim() : (existing.district || '');
    const province = data.province !== undefined ? String(data.province).trim() : (existing.province || '');
    let address = data.address !== undefined ? String(data.address).trim() : (existing.address || '');

    if ((data.village !== undefined || data.commune !== undefined || data.district !== undefined || data.province !== undefined) || !address) {
      const generated = [
        village ? `ភូមិ${village}` : '',
        commune ? `ឃុំ/សង្កាត់${commune}` : '',
        district ? `ស្រុក/ខណ្ឌ${district}` : '',
        province ? `រាជធានី/ខេត្ត${province}` : ''
      ].filter(Boolean).join(' ');
      if (generated) address = generated;
    }

    const updatedSchool = {
      ...existing,
      code: cleanCode,
      name: cleanName,
      nameEn: data.nameEn !== undefined ? String(data.nameEn).trim() : (existing.nameEn || ''),
      village,
      commune,
      district,
      province,
      address,
      director: data.director !== undefined ? data.director.trim() : existing.director,
      phone: data.phone !== undefined ? data.phone.trim() : existing.phone,
      notes: data.notes !== undefined ? data.notes.trim() : existing.notes,
      updatedAt: new Date().toISOString()
    };

    try {
      const database = await db.open();
      if (database.objectStoreNames.contains('schools')) {
        await db.put('schools', updatedSchool);
      }
    } catch (err) {
      console.warn('Could not update school in IndexedDB:', err);
    }

    try {
      const updatedList = schools.map(s => s.id === id ? updatedSchool : s);
      await SettingsService.set('schools_catalog', updatedList);
    } catch (_) {}

    syncStateManager.markDirty('schools.update');
    WorkspaceSetupService.notifySetupChange();
    return updatedSchool;
  },

  /**
   * Check if a school is currently referenced by active students or classes
   */
  async checkSchoolUsage(idOrCode) {
    if (!idOrCode) return { isUsed: false, studentCount: 0, classCount: 0 };
    const school = await this.getSchoolById(idOrCode);
    if (!school) return { isUsed: false, studentCount: 0, classCount: 0 };

    let studentCount = 0;
    let classCount = 0;

    try {
      const allStudents = await db.getAll('students');
      studentCount = allStudents.filter(s => 
        (s.school && (s.school.toLowerCase() === school.name.toLowerCase() || s.school.toLowerCase() === school.code.toLowerCase()))
      ).length;
    } catch (_) {}

    try {
      const allClasses = await db.getAll('classes');
      classCount = allClasses.filter(c => 
        (c.school && (c.school.toLowerCase() === school.name.toLowerCase() || c.school.toLowerCase() === school.code.toLowerCase())) ||
        (c.schoolId && c.schoolId === school.id)
      ).length;
    } catch (_) {}

    return {
      isUsed: (studentCount > 0 || classCount > 0),
      studentCount,
      classCount
    };
  },

  /**
   * Delete a school record (with safety guard against deleting schools linked to students/classes)
   */
  async deleteSchool(id, force = false) {
    if (!id) return false;
    const schools = await this.getAllSchools();
    const target = schools.find(s => s.id === id || s.code === id || s.name === id);
    if (!target) return false;

    if (!force) {
      const usage = await this.checkSchoolUsage(target.id);
      if (usage.isUsed) {
        const details = [];
        if (usage.studentCount > 0) details.push(`${usage.studentCount} student(s)`);
        if (usage.classCount > 0) details.push(`${usage.classCount} class(es)`);
        throw new Error(`CANNOT_DELETE_IN_USE:${details.join(', ')}`);
      }
    }

    try {
      const database = await db.open();
      if (database.objectStoreNames.contains('schools')) {
        await db.delete('schools', target.id);
      }
    } catch (err) {
      console.warn('Could not delete school from IndexedDB:', err);
    }

    try {
      const updatedList = schools.filter(s => s.id !== target.id);
      if (updatedList.length === 0) {
        await SettingsService.delete('schools_catalog');
        await SettingsService.delete('schools_initialized');
      } else {
        await SettingsService.set('schools_catalog', updatedList);
        await SettingsService.set('schools_initialized', true);
      }
    } catch (_) {}

    syncStateManager.markDirty('schools.delete');
    WorkspaceSetupService.notifySetupChange();
    return true;
  },

  /**
   * Unlink a school from any students or classes referencing it
   */
  async unlinkSchoolFromReferences(school) {
    if (!school) return;
    try {
      const allStudents = await db.getAll('students');
      for (const s of allStudents) {
        if (s.school && (s.school.toLowerCase() === school.name?.toLowerCase() || s.school.toLowerCase() === school.code?.toLowerCase())) {
          s.school = '';
          await db.put('students', s);
        }
      }
    } catch (e) {
      console.warn('Could not unlink school from students:', e);
    }

    try {
      const allClasses = await db.getAll('classes');
      for (const c of allClasses) {
        let changed = false;
        if (c.school && (c.school.toLowerCase() === school.name?.toLowerCase() || c.school.toLowerCase() === school.code?.toLowerCase())) {
          c.school = '';
          changed = true;
        }
        if (c.schoolId && c.schoolId === school.id) {
          c.schoolId = '';
          changed = true;
        }
        if (changed) {
          await db.put('classes', c);
        }
      }
    } catch (e) {
      console.warn('Could not unlink school from classes:', e);
    }
  },

  /**
   * Alias for deleteSchool
   */
  async delete(id) {
    return await this.deleteSchool(id);
  },

  /**
   * Resolve school name for a Teacher account
   */
  async getSchoolForTeacher(user, assignedClass = null, teacherProfile = null) {
    if (assignedClass?.school) return assignedClass.school;
    if (teacherProfile?.school) return teacherProfile.school;
    if (user?.school) return user.school;
    if (user?.schoolName) return user.schoolName;

    const schools = await this.getAllSchools();
    if (schools.length > 0 && schools[0].name) {
      return schools[0].name;
    }

    try {
      const nameKm = await SettingsService.get('school_name_km');
      if (nameKm) return nameKm;
    } catch (_) {}

    return '';
  },

  /**
   * Helper: Parse a combined address string into village, commune, district, province parts
   */
  parseAddressToParts(address) {
    if (!address || typeof address !== 'string') {
      return { village: '', commune: '', district: '', province: '' };
    }
    const str = address.trim();
    let village = '';
    let commune = '';
    let district = '';
    let province = '';

    const vMatch = str.match(/ភូមិ\s*([^,\s/]+)/);
    if (vMatch) village = vMatch[1].trim();

    const cMatch = str.match(/(?:ឃុំ|សង្កាត់)\s*([^,\s/]+)/);
    if (cMatch) commune = cMatch[1].trim();

    const dMatch = str.match(/(?:ស្រុក|ខណ្ឌ)\s*([^,\s/]+)/);
    if (dMatch) district = dMatch[1].trim();

    const pMatch = str.match(/(?:ខេត្ត|រាជធានី)\s*([^,\s/]+)/);
    if (pMatch) province = pMatch[1].trim();

    // Fallback: If no explicit Khmer prefix matched, but commas exist
    if (!village && !commune && !district && !province && str.includes(',')) {
      const parts = str.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length === 2) {
        district = parts[0];
        province = parts[1];
      } else if (parts.length === 3) {
        commune = parts[0];
        district = parts[1];
        province = parts[2];
      } else if (parts.length >= 4) {
        village = parts[0];
        commune = parts[1];
        district = parts[2];
        province = parts[3];
      }
    }

    return { village, commune, district, province };
  }
};
