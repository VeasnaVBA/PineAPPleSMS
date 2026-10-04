import { db } from '../database/db.js';
import { authService } from './authService.js';

export const SearchService = {
  /**
   * Fast global search across IndexedDB (Students, Teachers, Classes)
   * Enforces role-based filtering and teacher classroom restrictions.
   */
  async search(query) {
    if (!query || query.trim().length === 0) {
      return { students: [], teachers: [], classes: [], totalCount: 0 };
    }

    const q = query.trim().toLowerCase();
    const isTeacher = authService.isTeacher();
    const teacherClassId = authService.getAssignedClassId();

    const [students, teachers, classes] = await Promise.all([
      db.getAll('students'),
      isTeacher ? Promise.resolve([]) : db.getAll('teachers'),
      isTeacher ? Promise.resolve([]) : db.getAll('classes')
    ]);

    // If teacher, filter students to assigned class
    let targetStudents = students;
    if (isTeacher && teacherClassId) {
      targetStudents = students.filter(s => s.classId === teacherClassId);
    }

    const matchedStudents = targetStudents.filter(s => {
      return (
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        (s.lastNameKh && s.lastNameKh.toLowerCase().includes(q)) ||
        (s.firstNameKh && s.firstNameKh.toLowerCase().includes(q)) ||
        (s.lastNameLatin && s.lastNameLatin.toLowerCase().includes(q)) ||
        (s.firstNameLatin && s.firstNameLatin.toLowerCase().includes(q)) ||
        (s.khmerName && s.khmerName.toLowerCase().includes(q)) ||
        (s.englishName && s.englishName.toLowerCase().includes(q)) ||
        (s.parentPhone && s.parentPhone.includes(q)) ||
        (s.fatherPhone && s.fatherPhone.includes(q)) ||
        (s.studentPhone && s.studentPhone.includes(q)) ||
        (s.fatherName && s.fatherName.toLowerCase().includes(q)) ||
        (s.motherName && s.motherName.toLowerCase().includes(q))
      );
    }).slice(0, 6);

    const matchedTeachers = teachers.filter(t => {
      return (
        (t.teacherId && t.teacherId.toLowerCase().includes(q)) ||
        (t.khmerName && t.khmerName.toLowerCase().includes(q)) ||
        (t.englishName && t.englishName.toLowerCase().includes(q)) ||
        (t.phone && t.phone.includes(q)) ||
        (t.subject && t.subject.toLowerCase().includes(q))
      );
    }).slice(0, 5);

    const matchedClasses = classes.filter(c => {
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.room && c.room.toLowerCase().includes(q))
      );
    }).slice(0, 4);

    return {
      students: matchedStudents,
      teachers: matchedTeachers,
      classes: matchedClasses,
      totalCount: matchedStudents.length + matchedTeachers.length + matchedClasses.length
    };
  }
};
