/**
 * Offline Synchronization & Role-Specific Distribution Service
 *
 * Facilitates offline file-based package exchange (.schoolpkg / .json):
 * 1. Admin generates role-specific configuration packages (Director or Teacher).
 * 2. Director imports full school setup and aggregates Teacher return data packages.
 * 3. Teacher imports class-scoped setup package (locks assigned classId) and exports class results return packages.
 * 4. Includes SHA-256 integrity checksum verification to detect file corruption or role tampering.
 */

import { db } from '../database/db.js';
import { authService } from './authService.js';
import { BackupService } from './backupService.js';
import { SettingsService } from './settingsService.js';
import { i18n, t } from '../i18n/i18n.js';
import { getIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

const SALT = 'smartschool_sync_v1_offline_';

/**
 * SHA-256 Hash utility using Web Crypto API with fallback
 */
async function hashString(str) {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('SubtleCrypto error, falling back:', e);
    }
  }
  // Simple deterministic fallback
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 'fb_' + Math.abs(hash).toString(16);
}

export const SyncService = {
  /**
   * 1. ADMIN: Generate Configuration Package for DIRECTOR
   * Packs: School profile, all academic years, all classes, subjects, director permissions, and active year
   */
  async generateDirectorPackage(directorUser) {
    if (!directorUser || directorUser.role !== 'DIRECTOR') {
      throw new Error('Target user must have DIRECTOR role.');
    }

    const schools = await db.getAll('schools');
    const academicYears = await db.getAll('academicYears');
    const classes = await db.getAll('classes');
    const subjects = await db.getAll('subjects');
    const activeYear = await SettingsService.getActiveAcademicYear();
    const schoolNameKm = await SettingsService.get('school_name_km');
    const schoolNameEn = await SettingsService.get('school_name_en');
    const rolePermsRecord = await db.get('settings', 'role_permissions');

    const meta = {
      app: 'SmartSchool Management System',
      version: '1.0.0',
      packageType: 'DIRECTOR_SETUP',
      exportDate: new Date().toISOString(),
      targetUserId: directorUser.id,
      targetUsername: directorUser.username,
      targetRole: 'DIRECTOR',
      classId: null,
      className: null,
      totalClasses: classes.length,
      totalYears: academicYears.length
    };

    const payload = {
      schools,
      academicYears,
      classes,
      subjects,
      activeAcademicYear: activeYear,
      settings: [
        { key: 'school_name_km', value: schoolNameKm },
        { key: 'school_name_en', value: schoolNameEn },
        { key: 'active_academic_year', value: activeYear }
      ],
      directorPermissions: rolePermsRecord?.value?.DIRECTOR || {}
    };

    const checksum = await this.computeChecksum(meta, payload);
    const fullPackage = { meta: { ...meta, checksum }, payload };

    const filename = `director_${directorUser.username}_school_config.schoolpkg`;
    BackupService.downloadJSON(JSON.stringify(fullPackage, null, 2), filename);

    // Audit Log
    await this.logActivity('GENERATE_SYNC_PACKAGE', `Generated full school setup package for Director @${directorUser.username}`);
    return { filename, package: fullPackage };
  },

  /**
   * 2. ADMIN: Generate Configuration Package for TEACHER
   * Packs ONLY: The assigned classroom, teacher's profile, enrolled students for that class, subjects, active year
   */
  async generateTeacherPackage(teacherUser) {
    if (!teacherUser || teacherUser.role !== 'TEACHER') {
      throw new Error('Target user must have TEACHER role.');
    }

    const classId = teacherUser.classId || teacherUser.assignedClassId;
    if (!classId) {
      throw new Error(t('sync.unassignedTeacherWarning'));
    }

    const allClasses = await db.getAll('classes');
    const targetClass = allClasses.find(c => c.id === classId);
    if (!targetClass) {
      throw new Error(`Assigned class with ID '${classId}' not found in database.`);
    }

    // Load only students in this specific classroom
    const allStudents = await db.getAll('students');
    const classStudents = allStudents.filter(s => s.classId === classId);

    // Load teacher profile if available
    const allTeachers = await db.getAll('teachers');
    const teacherProfile = allTeachers.find(t => 
      t.id === teacherUser.id || 
      (t.englishName && teacherUser.displayName && t.englishName.toLowerCase() === teacherUser.displayName.toLowerCase()) ||
      (targetClass.teacherId && t.id === targetClass.teacherId)
    ) || null;

    const subjects = await db.getAll('subjects');
    const activeYear = await SettingsService.getActiveAcademicYear();
    const schoolNameKm = await SettingsService.get('school_name_km');
    const schoolNameEn = await SettingsService.get('school_name_en');
    const rolePermsRecord = await db.get('settings', 'role_permissions');

    const meta = {
      app: 'SmartSchool Management System',
      version: '1.0.0',
      packageType: 'TEACHER_SETUP',
      exportDate: new Date().toISOString(),
      targetUserId: teacherUser.id,
      targetUsername: teacherUser.username,
      targetRole: 'TEACHER',
      classId: targetClass.id,
      className: targetClass.name,
      studentCount: classStudents.length
    };

    // Serialize photo blobs if present
    const serializableStudents = await Promise.all(classStudents.map(async (s) => {
      const copy = { ...s };
      if (copy.photoBlob instanceof Blob) {
        copy.photoBase64 = await BackupService.blobToBase64(copy.photoBlob);
        delete copy.photoBlob;
      }
      return copy;
    }));

    const payload = {
      class: targetClass,
      teacherProfile,
      students: serializableStudents,
      subjects,
      activeAcademicYear: activeYear,
      school: {
        nameKm: schoolNameKm,
        nameEn: schoolNameEn
      },
      teacherPermissions: rolePermsRecord?.value?.TEACHER || {}
    };

    const checksum = await this.computeChecksum(meta, payload);
    const fullPackage = { meta: { ...meta, checksum }, payload };

    const cleanClassName = (targetClass.name || 'class').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `teacher_${cleanClassName}_${teacherUser.username}_config.schoolpkg`;
    BackupService.downloadJSON(JSON.stringify(fullPackage, null, 2), filename);

    // Audit Log
    await this.logActivity('GENERATE_SYNC_PACKAGE', `Generated class config package for Teacher @${teacherUser.username} (Class: ${targetClass.name})`);
    return { filename, package: fullPackage };
  },

  /**
   * 3. TEACHER: Export Class Data Return Package to Director/Admin
   * Packs: Updated attendance, scores, and student edits for the teacher's locked class ONLY
   */
  async generateTeacherReturnPackage() {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'TEACHER') {
      throw new Error('Only TEACHER role can export class data return packages.');
    }

    const classId = authService.getAssignedClassId();
    if (!classId) {
      throw new Error('No assigned classroom configured for this teacher account.');
    }

    const allClasses = await db.getAll('classes');
    const assignedClass = allClasses.find(c => c.id === classId) || { id: classId, name: 'Assigned Class' };

    // 1. Students in this class
    const allStudents = await db.getAll('students');
    const classStudents = allStudents.filter(s => s.classId === classId);

    // 2. Attendance for this class
    const allAttendance = await db.getAll('attendance');
    const classAttendance = allAttendance.filter(a => a.classId === classId);

    // 3. Scores for this class
    const allScores = await db.getAll('scores');
    const classScores = allScores.filter(sc => sc.classId === classId);

    const meta = {
      app: 'SmartSchool Management System',
      version: '1.0.0',
      packageType: 'TEACHER_DATA_RETURN',
      exportDate: new Date().toISOString(),
      senderUserId: currentUser.id,
      senderUsername: currentUser.username,
      senderRole: 'TEACHER',
      classId: assignedClass.id,
      className: assignedClass.name,
      counts: {
        students: classStudents.length,
        attendance: classAttendance.length,
        scores: classScores.length
      }
    };

    // Serialize photo blobs
    const serializableStudents = await Promise.all(classStudents.map(async (s) => {
      const copy = { ...s };
      if (copy.photoBlob instanceof Blob) {
        copy.photoBase64 = await BackupService.blobToBase64(copy.photoBlob);
        delete copy.photoBlob;
      }
      return copy;
    }));

    const payload = {
      classId: assignedClass.id,
      className: assignedClass.name,
      students: serializableStudents,
      attendance: classAttendance,
      scores: classScores
    };

    const checksum = await this.computeChecksum(meta, payload);
    const fullPackage = { meta: { ...meta, checksum }, payload };

    const cleanClassName = (assignedClass.name || 'class').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `return_${cleanClassName}_${dateStamp}.schoolpkg`;

    BackupService.downloadJSON(JSON.stringify(fullPackage, null, 2), filename);

    // Record last exported date in settings
    await SettingsService.set('last_exported_return_date', new Date().toISOString());
    await this.logActivity('EXPORT_CLASS_RETURN', `Exported class return package for ${assignedClass.name} (${classStudents.length} students, ${classScores.length} scores, ${classAttendance.length} attendance)`);

    return { filename, package: fullPackage };
  },

  /**
   * Compute package SHA-256 checksum over canonical string
   */
  async computeChecksum(meta, payload) {
    const raw = JSON.stringify({ meta, payload });
    return await hashString(SALT + raw);
  },

  /**
   * Validate uploaded package file: format, tamper check, role compatibility
   */
  async validatePackage(fileContent) {
    let parsed;
    try {
      parsed = JSON.parse(fileContent);
    } catch (err) {
      throw new Error(t('sync.invalidPackage') + ': Not a valid JSON structure.');
    }

    if (!parsed.meta || !parsed.payload) {
      throw new Error(t('sync.invalidPackage') + ': Missing package metadata or payload.');
    }

    const { checksum, ...metaWithoutChecksum } = parsed.meta;
    if (!checksum) {
      throw new Error(t('sync.invalidPackage') + ': Missing security checksum.');
    }

    // 1. Verify Checksum (Tamper detection)
    const expectedChecksum = await this.computeChecksum(metaWithoutChecksum, parsed.payload);
    if (checksum !== expectedChecksum) {
      throw new Error(t('sync.tamperedError'));
    }

    const currentUser = authService.getCurrentUser();
    const currentRole = currentUser?.role || 'UNKNOWN';

    // 2. Role validation
    let isValidForCurrentRole = false;
    let roleError = null;

    if (parsed.meta.packageType === 'DIRECTOR_SETUP') {
      if (currentRole === 'DIRECTOR' || currentRole === 'ADMIN') {
        isValidForCurrentRole = true;
      } else {
        roleError = t('sync.roleMismatch')
          .replace('{targetRole}', 'DIRECTOR')
          .replace('{currentRole}', currentRole);
      }
    } else if (parsed.meta.packageType === 'TEACHER_SETUP') {
      if (currentRole === 'TEACHER') {
        isValidForCurrentRole = true;
      } else {
        roleError = t('sync.roleMismatch')
          .replace('{targetRole}', 'TEACHER')
          .replace('{currentRole}', currentRole);
      }
    } else if (parsed.meta.packageType === 'TEACHER_DATA_RETURN') {
      if (currentRole === 'DIRECTOR' || currentRole === 'ADMIN') {
        isValidForCurrentRole = true;
      } else {
        roleError = t('sync.roleMismatch')
          .replace('{targetRole}', 'DIRECTOR / ADMIN')
          .replace('{currentRole}', currentRole);
      }
    } else {
      throw new Error(t('sync.invalidPackage') + `: Unknown package type '${parsed.meta.packageType}'.`);
    }

    return {
      isValid: isValidForCurrentRole,
      roleError,
      meta: parsed.meta,
      payload: parsed.payload
    };
  },

  /**
   * Apply & Import a verified package
   */
  async applyPackage(verifiedPkg) {
    const { meta, payload } = verifiedPkg;
    const currentUser = authService.getCurrentUser();

    if (meta.packageType === 'DIRECTOR_SETUP') {
      return await this.importDirectorPackage(payload, meta);
    } else if (meta.packageType === 'TEACHER_SETUP') {
      return await this.importTeacherPackage(payload, meta, currentUser);
    } else if (meta.packageType === 'TEACHER_DATA_RETURN') {
      return await this.mergeTeacherReturnPackage(payload, meta);
    } else {
      throw new Error(`Unsupported package type '${meta.packageType}'.`);
    }
  },

  /**
   * Import Director Setup Package
   */
  async importDirectorPackage(payload, meta) {
    if (payload.schools && Array.isArray(payload.schools)) {
      for (const s of payload.schools) {
        await db.put('schools', s);
      }
    }

    if (payload.academicYears && Array.isArray(payload.academicYears)) {
      for (const y of payload.academicYears) {
        await db.put('academicYears', y);
      }
    }

    if (payload.classes && Array.isArray(payload.classes)) {
      for (const c of payload.classes) {
        await db.put('classes', c);
      }
    }

    if (payload.subjects && Array.isArray(payload.subjects)) {
      for (const sub of payload.subjects) {
        await db.put('subjects', sub);
      }
    }

    if (payload.settings && Array.isArray(payload.settings)) {
      for (const set of payload.settings) {
        if (set && set.key) {
          await db.put('settings', set);
        }
      }
    }

    // Save sync date
    await SettingsService.set('last_synced_from_admin', meta.exportDate || new Date().toISOString());
    await this.logActivity('IMPORT_SYNC_PACKAGE', `Imported Director setup package from Admin (Package date: ${meta.exportDate})`);

    return {
      success: true,
      type: 'DIRECTOR_SETUP',
      message: t('sync.importSuccess')
    };
  },

  /**
   * Import Teacher Setup Package & Hard-Lock Classroom
   */
  async importTeacherPackage(payload, meta, currentUser) {
    if (!payload.class || !payload.class.id) {
      throw new Error('Package does not contain classroom definition.');
    }

    const targetClass = payload.class;
    const classId = targetClass.id;

    // 1. Put class record
    await db.put('classes', targetClass);

    // 2. Put teacher profile if available
    if (payload.teacherProfile && payload.teacherProfile.id) {
      await db.put('teachers', payload.teacherProfile);
    }

    // 3. Put subjects
    if (payload.subjects && Array.isArray(payload.subjects)) {
      for (const sub of payload.subjects) {
        await db.put('subjects', sub);
      }
    }

    // 4. Populate students of this class
    if (payload.students && Array.isArray(payload.students)) {
      for (const s of payload.students) {
        const studentRecord = { ...s };
        if (studentRecord.photoBase64) {
          try {
            studentRecord.photoBlob = await BackupService.base64ToBlob(studentRecord.photoBase64);
          } catch (e) {
            console.warn('Could not reconstruct photo blob:', e);
          }
          delete studentRecord.photoBase64;
        }
        studentRecord.classId = classId;
        await db.put('students', studentRecord);
      }
    }

    // 5. Hard-lock Teacher account to this assigned classId
    if (currentUser) {
      currentUser.classId = classId;
      currentUser.assignedClassId = classId;
      // Persist to user record in DB
      const userInDb = await db.get('users', currentUser.id);
      if (userInDb) {
        userInDb.classId = classId;
        userInDb.assignedClassId = classId;
        await db.put('users', userInDb);
      }
      // Update session storage
      try {
        localStorage.setItem('auth_user', JSON.stringify(currentUser));
      } catch (_) {}
    }

    // 6. Record metadata in settings
    await SettingsService.set('assigned_class_id', classId);
    await SettingsService.set('assigned_class_name', targetClass.name);
    await SettingsService.set('last_synced_from_admin', meta.exportDate || new Date().toISOString());

    await this.logActivity('IMPORT_SYNC_PACKAGE', `Imported Teacher setup package for ${targetClass.name} (${payload.students?.length || 0} students enrolled)`);

    return {
      success: true,
      type: 'TEACHER_SETUP',
      className: targetClass.name,
      studentCount: payload.students?.length || 0,
      message: t('sync.importSuccess')
    };
  },

  /**
   * Merge Teacher Class Return Package into Director's master database
   * Matches students by studentId; upserts scores and attendance for this class without touching others
   */
  async mergeTeacherReturnPackage(payload, meta) {
    const classId = payload.classId || meta.classId;
    const className = payload.className || meta.className || 'Class';

    let updatedStudents = 0;
    let mergedScores = 0;
    let mergedAttendance = 0;

    // 1. Merge Students: match by studentId
    if (payload.students && Array.isArray(payload.students)) {
      const existingStudents = await db.getAll('students');
      const studentMap = new Map(existingStudents.map(s => [s.studentId, s]));

      for (const incoming of payload.students) {
        const studentRecord = { ...incoming };
        if (studentRecord.photoBase64) {
          try {
            studentRecord.photoBlob = await BackupService.base64ToBlob(studentRecord.photoBase64);
          } catch (_) {}
          delete studentRecord.photoBase64;
        }

        const existing = studentMap.get(studentRecord.studentId);
        if (existing) {
          // Merge fields while preserving master ID
          const merged = { ...existing, ...studentRecord, id: existing.id };
          await db.put('students', merged);
        } else {
          // New student registered by teacher
          await db.put('students', studentRecord);
        }
        updatedStudents++;
      }
    }

    // 2. Merge Scores: upsert records for this class
    if (payload.scores && Array.isArray(payload.scores)) {
      for (const sc of payload.scores) {
        if (sc && (!classId || sc.classId === classId)) {
          await db.put('scores', sc);
          mergedScores++;
        }
      }
    }

    // 3. Merge Attendance: upsert records for this class
    if (payload.attendance && Array.isArray(payload.attendance)) {
      for (const att of payload.attendance) {
        if (att && (!classId || att.classId === classId)) {
          await db.put('attendance', att);
          mergedAttendance++;
        }
      }
    }

    // Record last merge in settings
    await SettingsService.set(`last_merged_${classId}`, new Date().toISOString());
    await this.logActivity('MERGE_TEACHER_RETURN', `Merged class return from ${className} (@${meta.senderUsername}): ${updatedStudents} students, ${mergedScores} scores, ${mergedAttendance} attendance`);

    return {
      success: true,
      type: 'TEACHER_DATA_RETURN',
      className,
      updatedStudents,
      mergedScores,
      mergedAttendance,
      message: t('sync.mergeSuccess')
        .replace('{students}', updatedStudents)
        .replace('{scores}', mergedScores)
        .replace('{attendance}', mergedAttendance)
    };
  },

  /**
   * Helper to write to activityLogs
   */
  async logActivity(action, details) {
    try {
      await db.put('activityLogs', {
        id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        action,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Could not log activity:', e);
    }
  },

  /**
   * Open the interactive Sync & Offline Distribution Modal (shadcn/ui style)
   */
  async openSyncModal() {
    const isKm = i18n.getLocale() === 'km';
    const currentUser = authService.getCurrentUser();
    const currentRole = currentUser?.role || 'TEACHER';
    const isTeacher = currentRole === 'TEACHER';
    const isDirector = currentRole === 'DIRECTOR';
    const isAdmin = currentRole === 'ADMIN';

    const lastSynced = await SettingsService.get('last_synced_from_admin');
    const assignedClassId = isTeacher ? authService.getAssignedClassId() : null;
    let assignedClassName = null;
    if (assignedClassId) {
      const cls = await db.get('classes', assignedClassId);
      assignedClassName = cls?.name || (await SettingsService.get('assigned_class_name')) || assignedClassId;
    }

    const lastExported = isTeacher ? await SettingsService.get('last_exported_return_date') : null;

    const formatTime = (ts) => {
      if (!ts) return isKm ? 'មិនទាន់មាន' : 'Never';
      try {
        const d = new Date(ts);
        return d.toLocaleDateString(isKm ? 'km-KH' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return ts;
      }
    };

    const content = `
      <div class="space-y-5 p-6 select-text">
        <!-- Hero Status Card -->
        <div class="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
              ${getIcon('rotateCw', 'w-6 h-6')}
            </div>
            <div>
              <h3 class="text-base font-bold text-foreground tracking-tight ${isKm ? 'font-khmer' : ''}">
                ${t('sync.title')}
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5 ${isKm ? 'font-khmer' : ''}">
                ${t('sync.subtitle')}
              </p>
            </div>
          </div>

          <!-- Status Badges -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            ${isTeacher && assignedClassName ? `
              <span class="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold flex items-center gap-1.5 shadow-2xs">
                ${getIcon('classes', 'w-3.5 h-3.5')}
                <span>${isKm ? 'ថ្នាក់រៀន:' : 'Class:'} ${assignedClassName}</span>
              </span>
            ` : ''}
            <span class="px-2.5 py-1 rounded-md bg-background border border-border text-muted-foreground font-medium flex items-center gap-1.5 shadow-2xs">
              ${getIcon('clock', 'w-3.5 h-3.5')}
              <span>${isKm ? 'សមកាលកម្មចុងក្រោយ:' : 'Last Synced:'} ${formatTime(lastSynced)}</span>
            </span>
          </div>
        </div>

        ${isTeacher && assignedClassName ? `
          <div class="p-3.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2.5 leading-relaxed">
            ${getIcon('lock', 'w-4 h-4 flex-shrink-0')}
            <span>${t('sync.teacherLockedNotice').replace('{className}', assignedClassName)}</span>
          </div>
        ` : ''}

        <!-- 2-Action Grid for Teacher / Director -->
        <div class="grid grid-cols-1 ${isTeacher ? 'sm:grid-cols-2' : ''} gap-4">
          <!-- Action 1: Import Setup / Return Package -->
          <div class="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 pb-2 border-b border-border text-xs font-semibold text-foreground uppercase tracking-wide ${isKm ? 'font-khmer' : ''}">
                ${getIcon('upload', 'w-3.5 h-3.5 text-primary')}
                <span>${isDirector ? (isKm ? 'នាំចូលកញ្ចប់ទិន្នន័យ' : 'Import Package (Admin or Teacher)') : t('sync.importPackage')}</span>
              </div>
              <p class="text-xs text-muted-foreground mt-2 leading-relaxed ${isKm ? 'font-khmer' : ''}">
                ${isTeacher 
                  ? (isKm ? 'នាំចូលកញ្ចប់កំណត់រចនាសម្ព័ន្ធពី Admin ដើម្បីកំណត់ថ្នាក់រៀន និងបញ្ជីសិស្សរបស់អ្នក។' : 'Import configuration package from Admin to set up your assigned class and students.') 
                  : (isKm ? 'នាំចូលកញ្ចប់រចនាសម្ព័ន្ធសាលាពី Admin ឬកញ្ចប់លទ្ធផលទិន្នន័យផ្ញើពីគ្រូបង្រៀន។' : 'Import full school setup from Admin or merge classroom return packages from Teachers.')}
              </p>
            </div>

            <!-- Drag & Drop Zone -->
            <div id="sync-dropzone"
                 class="mt-3 p-6 border-2 border-dashed border-border hover:border-primary/50 rounded-xl bg-muted/10 hover:bg-muted/20 transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-2 group">
              <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                ${getIcon('fileJson', 'w-5 h-5')}
              </div>
              <div class="space-y-1">
                <p class="text-xs font-semibold text-foreground ${isKm ? 'font-khmer' : ''}">
                  ${t('sync.dragDropTitle')}
                </p>
                <p class="text-[11px] text-muted-foreground ${isKm ? 'font-khmer' : ''}">
                  ${t('sync.dragDropSubtitle')}
                </p>
              </div>
              <input type="file" id="sync-file-input" accept=".schoolpkg,.json" class="hidden" />
            </div>

            <!-- Live Inspection Card (Hidden by default) -->
            <div id="sync-package-card" class="hidden p-3.5 rounded-lg border border-border bg-background space-y-2.5 text-xs">
              <div class="flex items-center justify-between gap-2 border-b border-border/80 pb-2">
                <span class="font-bold text-foreground flex items-center gap-1.5" id="pkg-card-title">
                  ${getIcon('shield', 'w-3.5 h-3.5 text-emerald-500')}
                  <span>Verified Package</span>
                </span>
                <span id="pkg-card-badge" class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Ready
                </span>
              </div>
              <div class="space-y-1 text-muted-foreground text-[11px]" id="pkg-card-details">
                <!-- Injected live -->
              </div>
              <div id="pkg-card-error" class="hidden text-destructive font-medium text-[11px]"></div>
              <button type="button" id="btn-apply-sync"
                      class="w-full mt-2 py-2 px-3 rounded-lg bg-primary text-primary-foreground font-semibold text-xs shadow-xs hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 cursor-pointer ${isKm ? 'font-khmer' : ''}">
                ${getIcon('check', 'w-4 h-4')}
                <span id="btn-apply-sync-text">${t('sync.applyImport')}</span>
              </button>
            </div>
          </div>

          <!-- Action 2: Export Return Package (Only for Teachers) -->
          ${isTeacher ? `
            <div class="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div class="flex items-center gap-2 pb-2 border-b border-border text-xs font-semibold text-foreground uppercase tracking-wide ${isKm ? 'font-khmer' : ''}">
                  ${getIcon('download', 'w-3.5 h-3.5 text-primary')}
                  <span>${t('sync.exportReturn')}</span>
                </div>
                <p class="text-xs text-muted-foreground mt-2 leading-relaxed ${isKm ? 'font-khmer' : ''}">
                  ${isKm 
                    ? 'ទាញយកកញ្ចប់លទ្ធផលទិន្នន័យ (វត្តមាន ពិន្ទុ និងព័ត៌មានសិស្ស) សម្រាប់ថ្នាក់របស់អ្នក ដើម្បីផ្ញើទៅនាយក ឬ Admin ។' 
                    : 'Download class results package (attendance, scores, student updates) to return to Director or Admin.'}
                </p>
                <div class="mt-4 p-3 rounded-lg bg-muted/40 border border-border/80 space-y-1 text-xs">
                  <div class="flex items-center justify-between text-muted-foreground">
                    <span>${isKm ? 'ថ្នាក់រៀន:' : 'Class:'}</span>
                    <span class="font-semibold text-foreground font-mono">${assignedClassName || '—'}</span>
                  </div>
                  <div class="flex items-center justify-between text-muted-foreground">
                    <span>${isKm ? 'នាំចេញចុងក្រោយ:' : 'Last Exported:'}</span>
                    <span class="font-medium text-foreground">${formatTime(lastExported)}</span>
                  </div>
                </div>
              </div>

              <button type="button" id="btn-export-teacher-return"
                      class="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-xs sm:text-sm shadow-xs hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 cursor-pointer ${isKm ? 'font-khmer' : ''}">
                ${getIcon('download', 'w-4 h-4')}
                <span>${t('sync.exportReturn')}</span>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const footer = `
      <div class="flex items-center justify-end px-6 py-4 border-t border-border bg-muted/20">
        <button type="button" id="btn-close-sync-modal"
                class="px-4 py-2 rounded-md border border-border hover:bg-muted text-xs sm:text-sm font-medium text-foreground transition-colors cursor-pointer ${isKm ? 'font-khmer' : ''}">
          ${t('common.close') || 'Close'}
        </button>
      </div>
    `;

    const modal = Modal.open({
      title: t('sync.title'),
      content,
      footer,
      maxWidth: isTeacher ? 'max-w-3xl' : 'max-w-xl',
      backdropClose: false
    });

    modal.element.querySelector('#btn-close-sync-modal')?.addEventListener('click', () => modal.close());

    // Drag and Drop Zone Binding
    const dropzone = modal.element.querySelector('#sync-dropzone');
    const fileInput = modal.element.querySelector('#sync-file-input');
    const pkgCard = modal.element.querySelector('#sync-package-card');
    const pkgCardDetails = modal.element.querySelector('#pkg-card-details');
    const pkgCardBadge = modal.element.querySelector('#pkg-card-badge');
    const pkgCardError = modal.element.querySelector('#pkg-card-error');
    const btnApply = modal.element.querySelector('#btn-apply-sync');
    const btnApplyText = modal.element.querySelector('#btn-apply-sync-text');

    let activeVerifiedPackage = null;

    const handleFile = async (file) => {
      if (!file) return;
      try {
        toast.info(t('sync.validating'));
        const text = await file.text();
        const res = await this.validatePackage(text);

        pkgCard.classList.remove('hidden');
        pkgCardError.classList.add('hidden');
        activeVerifiedPackage = res;

        // Details formatting
        const meta = res.meta;
        let typeLabel = meta.packageType;
        if (meta.packageType === 'DIRECTOR_SETUP') typeLabel = t('sync.typeDirectorSetup');
        if (meta.packageType === 'TEACHER_SETUP') typeLabel = t('sync.typeTeacherSetup');
        if (meta.packageType === 'TEACHER_DATA_RETURN') typeLabel = t('sync.typeTeacherReturn');

        pkgCardDetails.innerHTML = `
          <div class="flex items-center justify-between font-medium text-foreground">
            <span>Type:</span>
            <span class="font-semibold">${typeLabel}</span>
          </div>
          ${meta.className ? `
            <div class="flex items-center justify-between">
              <span>${isKm ? 'ថ្នាក់:' : 'Class:'}</span>
              <span class="font-bold text-primary">${meta.className}</span>
            </div>
          ` : ''}
          <div class="flex items-center justify-between">
            <span>Target / Sender:</span>
            <span class="font-mono">@${meta.targetUsername || meta.senderUsername || 'system'}</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Date:</span>
            <span>${new Date(meta.exportDate).toLocaleString()}</span>
          </div>
        `;

        if (!res.isValid) {
          pkgCardBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
          pkgCardBadge.textContent = 'Role Mismatch';
          pkgCardError.textContent = res.roleError || 'Incompatible role package';
          pkgCardError.classList.remove('hidden');
          btnApply.disabled = true;
          btnApply.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
          pkgCardBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
          pkgCardBadge.textContent = 'Verified & Ready';
          btnApply.disabled = false;
          btnApply.classList.remove('opacity-50', 'cursor-not-allowed');
          if (meta.packageType === 'TEACHER_DATA_RETURN') {
            btnApplyText.textContent = t('sync.applyMerge');
          } else {
            btnApplyText.textContent = t('sync.applyImport');
          }
        }
      } catch (err) {
        pkgCard.classList.remove('hidden');
        pkgCardBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        pkgCardBadge.textContent = 'Corrupted / Invalid';
        pkgCardError.textContent = err.message;
        pkgCardError.classList.remove('hidden');
        pkgCardDetails.innerHTML = '';
        btnApply.disabled = true;
        btnApply.classList.add('opacity-50', 'cursor-not-allowed');
        toast.error(err.message);
      }
    };

    dropzone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-primary', 'bg-primary/5');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-primary', 'bg-primary/5');
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-primary', 'bg-primary/5');
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    });

    btnApply?.addEventListener('click', async () => {
      if (!activeVerifiedPackage || !activeVerifiedPackage.isValid) return;
      try {
        btnApply.disabled = true;
        btnApplyText.textContent = isKm ? 'កំពុងដំណើរការ...' : 'Applying package...';
        const result = await this.applyPackage(activeVerifiedPackage);
        toast.success(result.message || t('sync.importSuccess'));
        modal.close();
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (err) {
        toast.error(err.message);
        btnApply.disabled = false;
        btnApplyText.textContent = t('sync.applyImport');
      }
    });

    // Teacher Return Export
    modal.element.querySelector('#btn-export-teacher-return')?.addEventListener('click', async () => {
      try {
        await this.generateTeacherReturnPackage();
        toast.success(t('sync.exportSuccess'));
        modal.close();
      } catch (err) {
        toast.error(err.message);
      }
    });
  }
};
