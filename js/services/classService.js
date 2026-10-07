import { db } from '../database/db.js';
import { authService } from './authService.js';
import { syncStateManager } from './syncStateManager.js';
import { WorkspaceSetupService } from './workspaceSetupService.js';

export const ClassService = {
  /**
   * Helper: Check if a classroom is owned by / associated with a user
   */
  isClassOwnedByUser(cls, user, teacherProfileIds = []) {
    if (!cls || !user) return false;
    if (user.classId && cls.id === user.classId) return true;
    if (user.assignedClassId && cls.id === user.assignedClassId) return true;
    if (cls.userId && (cls.userId === user.id || cls.accountId === user.id)) return true;
    if (cls.teacherId && (cls.teacherId === user.id || teacherProfileIds.includes(cls.teacherId))) return true;
    return false;
  },

  /**
   * Helper: Get all teacher profile IDs associated with a user account
   */
  async getTeacherProfileIdsForUser(userId) {
    if (!userId) return [];
    try {
      const teachers = await db.getAll('teachers');
      return teachers
        .filter(t => t.userId === userId || t.accountId === userId)
        .map(t => t.id);
    } catch {
      return [];
    }
  },

  /**
   * Get all classes linked to a teacher
   */
  async getClassesForTeacher(user = authService.getCurrentUser()) {
    if (!user) return [];
    const allClasses = await db.getAll('classes');
    const teacherProfileIds = await this.getTeacherProfileIdsForUser(user.id);
    return allClasses.filter(cls => this.isClassOwnedByUser(cls, user, teacherProfileIds));
  },

  /**
   * Count classes associated with a teacher user (used to enforce the 1-class limit)
   */
  async countByTeacher(user = authService.getCurrentUser()) {
    if (!user) return 0;
    const teacherClasses = await this.getClassesForTeacher(user);
    if (teacherClasses.length > 0) return teacherClasses.length;
    if (user.classId || user.assignedClassId) return 1;
    return 0;
  },

  /**
   * Get all classes (scoped to 1 class for TEACHER; all classes for DIRECTOR/ADMIN)
   */
  async getAll(user = authService.getCurrentUser()) {
    const currentUser = user || authService.getCurrentUser();
    const allClasses = await db.getAll('classes');
    if (currentUser && currentUser.role === 'TEACHER') {
      const teacherProfileIds = await this.getTeacherProfileIdsForUser(currentUser.id);
      const owned = allClasses.filter(cls => this.isClassOwnedByUser(cls, currentUser, teacherProfileIds));
      return owned.length > 0 ? owned : allClasses;
    }
    return allClasses;
  },

  /**
   * Alias for getAll with optional currentUser parameter
   */
  async getClasses(currentUser = authService.getCurrentUser()) {
    return await this.getAll(currentUser);
  },

  async getById(id, user = authService.getCurrentUser()) {
    const cls = await db.get('classes', id);
    if (!cls) return null;
    const currentUser = user || authService.getCurrentUser();
    if (currentUser && currentUser.role === 'TEACHER') {
      const teacherProfileIds = await this.getTeacherProfileIdsForUser(currentUser.id);
      if (!this.isClassOwnedByUser(cls, currentUser, teacherProfileIds)) {
        throw new Error('Access denied: You can only view your assigned classroom.');
      }
    }
    return cls;
  },

  /**
   * Create a classroom
   * - DIRECTOR: Unlimited creation.
   * - TEACHER: Restricted to exactly ONE classroom.
   */
  async create(cls, user = authService.getCurrentUser()) {
    const currentUser = user || authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';
    const isDirector = currentUser?.role === 'DIRECTOR';
    const isAdmin = currentUser?.role === 'ADMIN';

    if (!authService.can('classes.create') && !isDirector && !isAdmin && !isTeacher) {
      throw new Error('Access denied: You do not have permission to create classes.');
    }

    // Teacher single classroom limit enforcement
    if (isTeacher) {
      const existingCount = await this.countByTeacher(currentUser);
      if (existingCount >= 1) {
        throw new Error('Teachers are restricted to a single classroom.');
      }

      // Associate classroom record with the teacher account
      cls.userId = currentUser.id;
      cls.accountId = currentUser.id;

      // Link teacherId if available
      const teacherProfileIds = await this.getTeacherProfileIdsForUser(currentUser.id);
      if (!cls.teacherId || cls.teacherId === '') {
        cls.teacherId = teacherProfileIds[0] || currentUser.id;
      }
    } else if (currentUser) {
      cls.createdBy = currentUser.id;
    }

    if (!cls.id) {
      cls.id = 'cls-' + Date.now();
    }
    if (!cls.createdAt) {
      cls.createdAt = new Date().toISOString();
    }
    await db.add('classes', cls);
    syncStateManager.markDirty('classes.create');
    WorkspaceSetupService.notifySetupChange();

    // Sync current user's classId in database and session for seamless offline workflows
    if (isTeacher && currentUser) {
      try {
        await authService.setAssignedClassId(cls.id);
      } catch (err) {
        console.warn('Could not sync teacher classId:', err);
      }
    }

    return cls;
  },

  /**
   * Alias for create(classData, currentUser)
   */
  async createClass(classData, currentUser) {
    return await this.create(classData, currentUser);
  },

  async update(id, data, user = authService.getCurrentUser()) {
    const currentUser = user || authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';
    const isDirector = currentUser?.role === 'DIRECTOR';
    const isAdmin = currentUser?.role === 'ADMIN';

    if (!authService.can('classes.edit') && !isDirector && !isAdmin && !isTeacher) {
      throw new Error('Access denied: You do not have permission to edit classes.');
    }

    const existing = await db.get('classes', id);
    if (!existing) throw new Error(`Class ${id} not found`);

    if (isTeacher) {
      const teacherProfileIds = await this.getTeacherProfileIdsForUser(currentUser.id);
      if (!this.isClassOwnedByUser(existing, currentUser, teacherProfileIds)) {
        throw new Error('Access denied: Teachers can only edit their own assigned classroom.');
      }
      // Prevent changing teacher assignment away to someone else
      if (data.teacherId !== undefined && data.teacherId !== existing.teacherId) {
        if (!teacherProfileIds.includes(data.teacherId) && data.teacherId !== currentUser.id) {
          delete data.teacherId;
        }
      }
    }

    const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
    await db.put('classes', updated);
    syncStateManager.markDirty('classes.update');
    WorkspaceSetupService.notifySetupChange();

    if (isTeacher && currentUser) {
      try {
        await authService.setAssignedClassId(id);
      } catch (err) {
        console.warn('Could not sync teacher classId:', err);
      }
    }

    return updated;
  },

  async delete(id, user = authService.getCurrentUser()) {
    const currentUser = user || authService.getCurrentUser();
    const isTeacher = currentUser?.role === 'TEACHER';
    if (!isTeacher && !authService.can('classes.delete')) {
      throw new Error('Access denied: You do not have permission to delete classes.');
    }
    const res = await db.delete('classes', id);
    if (isTeacher && authService.getAssignedClassId() === id) {
      await authService.setAssignedClassId(null);
    }
    syncStateManager.markDirty('classes.delete');
    WorkspaceSetupService.notifySetupChange();
    return res;
  },

  async count() {
    return await db.count('classes');
  },

  /**
   * Get students enrolled in a class
   */
  async getEnrolledStudents(classId) {
    const [students, cls] = await Promise.all([
      db.getAll('students'),
      db.get('classes', classId)
    ]);
    const className = cls?.name ? String(cls.name).trim().toLowerCase() : '';
    return students.filter(s => 
      s.classId === classId || 
      (className && s.classId && String(s.classId).trim().toLowerCase() === className)
    );
  },

  /**
   * Get classes enriched with teacher name and enrolled student counts
   * - Scoped to the single classroom for TEACHER
   * - Unlimited all classes for DIRECTOR and ADMIN
   */
  async getClassesWithDetails(user = authService.getCurrentUser()) {
    const currentUser = user || authService.getCurrentUser();
    let [classes, teachers, students] = await Promise.all([
      db.getAll('classes'),
      db.getAll('teachers'),
      db.getAll('students')
    ]);

    if (currentUser && currentUser.role === 'TEACHER') {
      const teacherProfileIds = teachers
        .filter(t => t.userId === currentUser.id || t.accountId === currentUser.id)
        .map(t => t.id);
      const owned = classes.filter(cls => this.isClassOwnedByUser(cls, currentUser, teacherProfileIds));
      if (owned.length > 0) classes = owned;
    }

    const teacherMap = new Map(teachers.map(t => [t.id, t]));

    return classes.map(cls => {
      const teacher = teacherMap.get(cls.teacherId) || 
        teachers.find(t => t.teacherId === cls.teacherId || t.id === cls.teacherId || t.userId === cls.teacherId || t.accountId === cls.teacherId);
      const className = cls.name ? String(cls.name).trim().toLowerCase() : '';
      const enrolled = students.filter(s => 
        s.classId === cls.id || 
        (className && s.classId && String(s.classId).trim().toLowerCase() === className)
      );
      return {
        ...cls,
        teacherNameKhmer: teacher?.khmerName || '',
        teacherNameEnglish: teacher?.englishName || '',
        studentCount: enrolled.length,
        activeStudentCount: enrolled.filter(s => s.status === 'Active').length
      };
    });
  },

  // ----------------------------------------------------
  // Groups Management (Section 14)
  // ----------------------------------------------------

  async getAllGroups() {
    return await db.getAll('groups');
  },

  async getGroupsByClass(classId) {
    const groups = await db.getAll('groups');
    if (!classId || classId === 'all') return groups;
    return groups.filter(g => g.classId === classId);
  },

  async getGroupById(id) {
    return await db.get('groups', id);
  },

  async createGroup(grp) {
    if (!grp.id) {
      grp.id = 'grp-' + Date.now();
    }
    if (!Array.isArray(grp.studentIds)) {
      grp.studentIds = [];
    }
    grp.createdAt = new Date().toISOString();
    await db.add('groups', grp);
    return grp;
  },

  async updateGroup(id, data) {
    const existing = await db.get('groups', id);
    if (!existing) throw new Error(`Group ${id} not found`);
    const updated = { ...existing, ...data, id };
    await db.put('groups', updated);
    return updated;
  },

  async deleteGroup(id) {
    return await db.delete('groups', id);
  },

  async addStudentToGroup(groupId, studentId) {
    const group = await db.get('groups', groupId);
    if (!group) throw new Error('Group not found');
    if (!group.studentIds) group.studentIds = [];
    if (!group.studentIds.includes(studentId)) {
      group.studentIds.push(studentId);
      // If group has no leader yet, the first student can optionally become leader
      if (!group.leaderStudentId) {
        group.leaderStudentId = studentId;
      }
      await db.put('groups', group);
    }
    return group;
  },

  async removeStudentFromGroup(groupId, studentId) {
    const group = await db.get('groups', groupId);
    if (!group || !group.studentIds) return;
    group.studentIds = group.studentIds.filter(id => id !== studentId);
    if (group.leaderStudentId === studentId) {
      group.leaderStudentId = group.studentIds[0] || null;
    }
    await db.put('groups', group);
    return group;
  },

  async setGroupLeader(groupId, studentId) {
    const group = await db.get('groups', groupId);
    if (!group) throw new Error('Group not found');
    group.leaderStudentId = studentId;
    await db.put('groups', group);
    return group;
  }
};
