/**
 * Teacher Class Statistics Service (តារាងចំនួនសិស្សតាមថ្នាក់ សម្រាប់គ្រូ)
 * Official MoEYS Teacher's Classroom Demographic & Statistical Report (PRI Standard).
 *
 * Gathers:
 * 1. Assigned Teacher Information (Section ១)
 * 2. Student Age & Repetition Distribution (Section ២.ខ)
 * 3. Early Childhood / Preschool Background (Section ២.ក)
 * 4. Students with Disabilities, Health, and Vulnerabilities (Section ៣)
 * 5. Ethnic Minority Students (Section ៤)
 */

import { db } from '../database/db.js';
import { SettingsService } from './settingsService.js';
import { SchoolService } from './schoolService.js';
import { authService } from './authService.js';
import { normalizeStudentRecord } from './studentService.js';
import { normalizeTeacherRecord } from './teacherService.js';
import { isStudentActive } from './scoreService.js';
import { formatKhmerLunarDate, formatKhmerSolarDate, toKhmerNumerals } from '../utils/khmerLunar.js';

export const TeacherClassStatsService = {
  /**
   * Helper: Calculate student age based on dateOfBirth and target academic year
   */
  calculateStudentAge(dobString, baseYear = new Date().getFullYear()) {
    if (!dobString) return null;
    try {
      const parts = String(dobString).trim().split(/[-/]/);
      let birthYear = null;
      if (parts[0] && parts[0].length === 4) {
        birthYear = parseInt(parts[0], 10);
      } else if (parts[2] && parts[2].length === 4) {
        birthYear = parseInt(parts[2], 10);
      }
      if (!birthYear || isNaN(birthYear)) {
        const d = new Date(dobString);
        if (!isNaN(d.getFullYear())) birthYear = d.getFullYear();
      }
      if (!birthYear) return null;
      const age = baseYear - birthYear;
      return age > 0 ? age : null;
    } catch {
      return null;
    }
  },

  /**
   * Helper: Check if student is female
   */
  isFemaleStudent(stu) {
    const g = String(stu?.gender || '').trim().toLowerCase();
    return g === 'female' || g === 'f' || g === 'ស្រី' || g.includes('female') || g.includes('ស្រី');
  },

  /**
   * Helper: Check if student is repeating the grade
   */
  isRepeatingStudent(stu) {
    if (!stu) return false;
    if (stu.isRepeating === true || stu.repeating === true) return true;
    const stat = String(stu.status || '').toLowerCase();
    if (stat.includes('repeat') || stat.includes('ត្រួត')) return true;
    const notes = String(stu.notes || '').toLowerCase();
    if (notes.includes('ត្រួតថ្នាក់') || notes.includes('repeater') || notes.includes('repeat')) return true;
    return false;
  },

  /**
   * Helper: Check if student is an ethnic minority
   */
  isEthnicMinorityStudent(stu) {
    if (!stu) return false;
    if (stu.isEthnicMinority === true || stu.ethnicMinority === true) return true;
    const eth = String(stu.ethnicity || stu.ethnic || '').trim().toLowerCase();
    if (eth && eth !== 'khmer' && eth !== 'ខ្មែរ') return true;
    const notes = String(stu.notes || '').toLowerCase();
    return notes.includes('ជនជាតិដើម') || notes.includes('ភាគតិច');
  },

  /**
   * Fetch complete data structure for the Teacher Classroom Statistics Report
   */
  async getClassStatsReportData({ classId, academicYear }) {
    const [
      classes, rawStudents, teachers, schoolCatalog,
      settingsProv, settingsDist, settingsComm, settingsSchoolNameKm
    ] = await Promise.all([
      db.getAll('classes'),
      db.getAll('students'),
      db.getAll('teachers').catch(() => []),
      SchoolService.getAllSchools().catch(() => []),
      SettingsService.get('school_province').catch(() => ''),
      SettingsService.get('school_district').catch(() => ''),
      SettingsService.get('school_commune').catch(() => ''),
      SettingsService.get('school_name_km').catch(() => '')
    ]);

    // 1. Target Class
    const targetClass = (classes || []).find(c => c.id === classId) || { id: classId, name: '—' };
    const classStudents = (rawStudents || [])
      .map(normalizeStudentRecord)
      .filter(s => s.classId === classId && isStudentActive(s))
      .sort((a, b) => (a.khmerName || '').localeCompare(b.khmerName || '', 'km'));

    // 2. School Info
    let matchedSchool = null;
    const allSchools = Array.isArray(schoolCatalog) ? schoolCatalog : [];
    if (targetClass.schoolId) {
      matchedSchool = allSchools.find(s => s.id === targetClass.schoolId);
    }
    if (!matchedSchool && allSchools.length > 0) {
      matchedSchool = allSchools[0];
    }

    const province = matchedSchool?.province || settingsProv || 'បាត់ដំបង';
    const district = matchedSchool?.district || settingsDist || 'រុក្ខគិរី';
    const commune = matchedSchool?.commune || settingsComm || 'ជង្រ្កា';
    const schoolName = matchedSchool?.name || matchedSchool?.nameKm || settingsSchoolNameKm || 'សាលាបឋមសិក្សា ជង្រ្កា';

    // 3. Teacher In Charge
    let teacher = null;
    const normalizedTeachers = (teachers || []).map(normalizeTeacherRecord);
    if (targetClass.teacherId) {
      teacher = normalizedTeachers.find(t => t.id === targetClass.teacherId || t.teacherId === targetClass.teacherId);
    }
    if (!teacher && targetClass.userId) {
      teacher = normalizedTeachers.find(t => t.userId === targetClass.userId || t.accountId === targetClass.userId);
    }
    if (!teacher && authService.isTeacher()) {
      const curUser = authService.getCurrentUser();
      if (curUser) {
        teacher = normalizedTeachers.find(t => t.userId === curUser.id || t.id === curUser.id) || {
          khmerName: curUser.name || curUser.username,
          gender: curUser.gender || 'Male'
        };
      }
    }
    if (!teacher && normalizedTeachers.length > 0) {
      teacher = normalizedTeachers[0];
    }

    const teacherName = teacher?.khmerName || teacher?.name || 'សេត ពុទ្ធី';
    const teacherGender = teacher?.gender === 'Female' || teacher?.gender === 'ស្រី' ? 'ស្រី' : 'ប្រុស';
    const teacherAge = teacher?.age ? `${toKhmerNumerals(teacher.age)} ឆ្នាំ` : '២៦ ឆ្នាំ';
    const teacherIsEthnicMinority = teacher?.isEthnicMinority || teacher?.ethnicMinority ? 'ពិតមែន' : 'ទេ';
    const teacherDegree = teacher?.highestDegree || teacher?.generalEducationDegree || 'បរិញ្ញាបត្រ';
    let serviceYears = '៦ ឆ្នាំ';
    if (teacher?.joinedDate) {
      const startY = parseInt(String(teacher.joinedDate).slice(0, 4), 10);
      if (startY && !isNaN(startY)) {
        const diff = new Date().getFullYear() - startY;
        if (diff > 0) serviceYears = `${toKhmerNumerals(diff)} ឆ្នាំ`;
      }
    }
    const teacherPedagogy = teacher?.trainingLevel || teacher?.framework || 'គ.ល';

    // 4. Academic Year
    const yearString = academicYear || targetClass.academicYear || (await SettingsService.getActiveAcademicYear()) || '2024–2025';
    let baseYear = 2024;
    const matchYear = String(yearString).match(/\d{4}/);
    if (matchYear) baseYear = parseInt(matchYear[0], 10);

    const formatAcademicYearKm = (yr) => {
      const parts = String(yr || '').replace(/[–—_]/g, '-').split('-');
      if (parts.length >= 2) {
        return `${toKhmerNumerals(parts[0].trim())}_ ${toKhmerNumerals(parts[1].trim())}`;
      }
      return toKhmerNumerals(yr);
    };
    const academicYearFormatted = formatAcademicYearKm(yearString);

    // 5. Section ២.(ខ) Age Statistics (Ages 6 to 15+)
    const ageKeys = ['6', '7', '8', '9', '10', '11', '12', '13', '14', '15+'];
    const ageStats = {};
    ageKeys.forEach(k => {
      ageStats[k] = {
        ageLabel: k,
        newTot: 0,
        newFem: 0,
        repTot: 0,
        repFem: 0,
        totTot: 0,
        totFem: 0
      };
    });

    classStudents.forEach(stu => {
      const age = TeacherClassStatsService.calculateStudentAge(stu.dateOfBirth, baseYear);
      let bucket = '10'; // default median fallback if dob missing
      if (age !== null) {
        if (age <= 6) bucket = '6';
        else if (age >= 15) bucket = '15+';
        else bucket = String(age);
      }
      if (!ageStats[bucket]) bucket = '10';

      const isFem = TeacherClassStatsService.isFemaleStudent(stu);
      const isRep = TeacherClassStatsService.isRepeatingStudent(stu);

      if (isRep) {
        ageStats[bucket].repTot += 1;
        if (isFem) ageStats[bucket].repFem += 1;
      } else {
        ageStats[bucket].newTot += 1;
        if (isFem) ageStats[bucket].newFem += 1;
      }

      ageStats[bucket].totTot += 1;
      if (isFem) ageStats[bucket].totFem += 1;
    });

    // Sum row for Section ២.(ខ)
    const ageStatsTotal = {
      newTot: 0,
      newFem: 0,
      repTot: 0,
      repFem: 0,
      totTot: 0,
      totFem: 0
    };
    ageKeys.forEach(k => {
      ageStatsTotal.newTot += ageStats[k].newTot;
      ageStatsTotal.newFem += ageStats[k].newFem;
      ageStatsTotal.repTot += ageStats[k].repTot;
      ageStatsTotal.repFem += ageStats[k].repFem;
      ageStatsTotal.totTot += ageStats[k].totTot;
      ageStatsTotal.totFem += ageStats[k].totFem;
    });

    // 6. Section ៤: Ethnic Minority Students by Age Group (6, 7-11, 12+)
    const ethnicStats = {
      '6': { tot: 0, fem: 0 },
      '7-11': { tot: 0, fem: 0 },
      '12+': { tot: 0, fem: 0 }
    };

    classStudents.forEach(stu => {
      if (TeacherClassStatsService.isEthnicMinorityStudent(stu)) {
        const age = TeacherClassStatsService.calculateStudentAge(stu.dateOfBirth, baseYear) || 9;
        const isFem = TeacherClassStatsService.isFemaleStudent(stu);
        let group = '7-11';
        if (age <= 6) group = '6';
        else if (age >= 12) group = '12+';

        ethnicStats[group].tot += 1;
        if (isFem) ethnicStats[group].fem += 1;
      }
    });

    const ethnicTotal = {
      tot: ethnicStats['6'].tot + ethnicStats['7-11'].tot + ethnicStats['12+'].tot,
      fem: ethnicStats['6'].fem + ethnicStats['7-11'].fem + ethnicStats['12+'].fem
    };

    // 7. Section ២.(ក): Grade 1 Early Childhood / Preschool Program
    const isGrade1 = String(targetClass.name || targetClass.grade || '').includes('1') || String(targetClass.name || '').includes('១');
    const preschoolRows = [
      { id: 'state', label: 'មត្តេយ្យរដ្ឋ', newTot: 0, newFem: 0, repTot: 0, repFem: 0 },
      { id: 'private', label: 'មត្តេយ្យឯកជន', newTot: 0, newFem: 0, repTot: 0, repFem: 0 },
      { id: 'community', label: 'មត្តេយ្យសហគមន៍', newTot: 0, newFem: 0, repTot: 0, repFem: 0 },
      { id: 'home', label: 'ការអប់រំតាមផ្ទះ/ខ្នងផ្ទះ', newTot: 0, newFem: 0, repTot: 0, repFem: 0 },
      { id: 'prep', label: 'កម្មវិធីត្រៀមថ្នាក់ទី១', newTot: 0, newFem: 0, repTot: 0, repFem: 0 }
    ];

    if (isGrade1) {
      classStudents.forEach(stu => {
        const isFem = TeacherClassStatsService.isFemaleStudent(stu);
        const isRep = TeacherClassStatsService.isRepeatingStudent(stu);
        const pType = String(stu.preschoolType || stu.earlyEducation || stu.notes || '').toLowerCase();

        let targetRow = preschoolRows[0]; // fallback to state preschool
        if (pType.includes('ឯកជន') || pType.includes('private')) targetRow = preschoolRows[1];
        else if (pType.includes('សហគមន៍') || pType.includes('community')) targetRow = preschoolRows[2];
        else if (pType.includes('ផ្ទះ') || pType.includes('home')) targetRow = preschoolRows[3];
        else if (pType.includes('ត្រៀម') || pType.includes('prep')) targetRow = preschoolRows[4];

        if (isRep) {
          targetRow.repTot += 1;
          if (isFem) targetRow.repFem += 1;
        } else {
          targetRow.newTot += 1;
          if (isFem) targetRow.newFem += 1;
        }
      });
    }

    const preschoolTotal = preschoolRows.reduce((acc, cur) => {
      acc.newTot += cur.newTot;
      acc.newFem += cur.newFem;
      acc.repTot += cur.repTot;
      acc.repFem += cur.repFem;
      return acc;
    }, { newTot: 0, newFem: 0, repTot: 0, repFem: 0 });

    // 8. Section ៣: Students with Disabilities, Health Issues & Vulnerable Situations
    const disabilityItems = [
      { id: 'dis_motion', label: 'ពិបាកក្នុងការធ្វើចលនា', tot: 0, fem: 0 },
      { id: 'dis_hearing', label: 'ពិបាកក្នុងការស្តាប់', tot: 0, fem: 0 },
      { id: 'dis_speech', label: 'ពិបាកក្នុងការនិយាយ', tot: 0, fem: 0 },
      { id: 'dis_vision', label: 'ពិបាកក្នុងការមើល', tot: 0, fem: 0 },
      { id: 'dis_learning', label: 'ពិបាករៀនខាងក្នុង', tot: 0, fem: 0 },
      { id: 'dis_intellect', label: 'ពិបាកសតិបញ្ញា', tot: 0, fem: 0 },
      { id: 'dis_mental', label: 'ពិបាកខាងផ្លូវចិត្ត', tot: 0, fem: 0 },
      { id: 'dis_other', label: 'ពិបាកផ្សេងៗ (ក្រៅពីខាងលើ)', tot: 0, fem: 0 }
    ];

    const healthItems = [
      { id: 'health_malnutrition', label: 'ខ្វះអាហារូបត្ថម្ភធ្ងន់ធ្ងរ', tot: 0, fem: 0 },
      { id: 'health_chronic', label: 'សុខភាព/ជំងឺប្រចាំកាយ', tot: 0, fem: 0 }
    ];

    const situationItems = [
      { id: 'sit_migrant', label: 'មកពីគ្រួសារផ្លាស់ប្តូរទីលំនៅ', tot: 0, fem: 0 },
      { id: 'sit_orphan', label: 'កុមារកំព្រា', tot: 0, fem: 0 },
      { id: 'sit_hiv', label: 'កុមាររងគ្រោះដោយ HIV/AIDS', tot: 0, fem: 0 },
      { id: 'sit_violence', label: 'កុមាររងអំពើហិង្សាក្នុងគ្រួសារ', tot: 0, fem: 0 },
      { id: 'sit_labor', label: 'កុមាររងការកេងប្រវ័ញ្ចពលកម្ម', tot: 0, fem: 0 },
      { id: 'sit_poor', label: 'កុមារមកពីគ្រួសារក្រីក្រ', tot: 0, fem: 0 }
    ];

    // Tally based on student record tags/notes
    classStudents.forEach(stu => {
      const isFem = TeacherClassStatsService.isFemaleStudent(stu);
      const notes = String(stu.notes || stu.specialNeeds || stu.healthStatus || '').toLowerCase();
      const dis = String(stu.disability || '').toLowerCase();
      const vul = String(stu.vulnerability || stu.povertyStatus || stu.idPoor || '').toLowerCase();

      // Check Disabilities
      if (dis.includes('ចលនា') || dis.includes('motion') || dis.includes('walking')) { disabilityItems[0].tot++; if (isFem) disabilityItems[0].fem++; }
      if (dis.includes('ស្តាប់') || dis.includes('hearing') || dis.includes('deaf')) { disabilityItems[1].tot++; if (isFem) disabilityItems[1].fem++; }
      if (dis.includes('និយាយ') || dis.includes('speech') || dis.includes('mute')) { disabilityItems[2].tot++; if (isFem) disabilityItems[2].fem++; }
      if (dis.includes('មើល') || dis.includes('vision') || dis.includes('blind') || dis.includes('ភ្នែក')) { disabilityItems[3].tot++; if (isFem) disabilityItems[3].fem++; }
      if (dis.includes('រៀន') || dis.includes('learning')) { disabilityItems[4].tot++; if (isFem) disabilityItems[4].fem++; }
      if (dis.includes('សតិបញ្ញា') || dis.includes('intellect')) { disabilityItems[5].tot++; if (isFem) disabilityItems[5].fem++; }
      if (dis.includes('ផ្លូវចិត្ត') || dis.includes('mental')) { disabilityItems[6].tot++; if (isFem) disabilityItems[6].fem++; }
      if (dis.includes('ផ្សេងៗ') || dis.includes('other')) { disabilityItems[7].tot++; if (isFem) disabilityItems[7].fem++; }

      // Check Health
      if (notes.includes('អាហារូបត្ថម្ភ') || notes.includes('malnutrition')) { healthItems[0].tot++; if (isFem) healthItems[0].fem++; }
      if (notes.includes('ជំងឺ') || notes.includes('chronic') || notes.includes('សុខភាព')) { healthItems[1].tot++; if (isFem) healthItems[1].fem++; }

      // Check Vulnerable Situations
      if (notes.includes('ទីលំនៅ') || notes.includes('migrant')) { situationItems[0].tot++; if (isFem) situationItems[0].fem++; }
      if (notes.includes('កំព្រា') || notes.includes('orphan')) { situationItems[1].tot++; if (isFem) situationItems[1].fem++; }
      if (notes.includes('hiv') || notes.includes('aids')) { situationItems[2].tot++; if (isFem) situationItems[2].fem++; }
      if (notes.includes('ហិង្សា') || notes.includes('violence')) { situationItems[3].tot++; if (isFem) situationItems[3].fem++; }
      if (notes.includes('ពលកម្ម') || notes.includes('labor')) { situationItems[4].tot++; if (isFem) situationItems[4].fem++; }
      if (vul.includes('poor') || vul.includes('ក្រីក្រ') || vul.includes('1') || vul.includes('2')) { situationItems[5].tot++; if (isFem) situationItems[5].fem++; }
    });

    const sumGroup = (items) => items.reduce((acc, c) => ({ tot: acc.tot + c.tot, fem: acc.fem + c.fem }), { tot: 0, fem: 0 });
    const disabilityTotal = sumGroup(disabilityItems);
    const healthTotal = sumGroup(healthItems);
    const situationTotal = sumGroup(situationItems);

    // 9. Dates
    const today = new Date();
    const lunarDateText = formatKhmerLunarDate(today);
    const solarDateText = formatKhmerSolarDate(today);

    return {
      className: targetClass.name || targetClass.grade || '៦ គ',
      academicYear: academicYearFormatted,
      schoolInfo: {
        province,
        district,
        commune,
        schoolName
      },
      teacherInfo: {
        name: teacherName,
        gender: teacherGender,
        age: teacherAge,
        isEthnicMinority: teacherIsEthnicMinority,
        degree: teacherDegree,
        serviceYears,
        pedagogy: teacherPedagogy
      },
      section2B: {
        keys: ageKeys,
        rows: ageStats,
        total: ageStatsTotal
      },
      section4: {
        rows: ethnicStats,
        total: ethnicTotal
      },
      section2A: {
        rows: preschoolRows,
        total: preschoolTotal,
        isGrade1
      },
      section3: {
        disabilities: {
          items: disabilityItems,
          total: disabilityTotal
        },
        health: {
          items: healthItems,
          total: healthTotal
        },
        situations: {
          items: situationItems,
          total: situationTotal
        }
      },
      dates: {
        lunarText: lunarDateText,
        solarText: solarDateText,
        location: commune
      }
    };
  },

  /**
   * Generates the complete pixel-perfect HTML template matching the official MoEYS PRI form
   */
  generateReportHtml(data) {
    if (!data) return '<div class="p-8 text-center text-muted-foreground text-xs font-khmer">មិនមានទិន្នន័យឡើយ</div>';

    return `
      <div class="report-explicit-page teacher-class-stats-page bg-white text-black font-khmer mx-auto select-none box-border relative" style="width: 100%; max-width: 210mm; min-height: 297mm; padding: 8mm 9mm; font-family: 'Kantumruy Pro', 'Khmer OS Siemreap', sans-serif; font-size: 8px; line-height: 1.25; color: #000000; background: #ffffff;">
        <style>
          .teacher-class-stats-page {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .stats-tbl {
            width: 100% !important;
            border-collapse: collapse !important;
            border: 1.2px solid #1e3a8a !important;
            font-size: 8px !important;
            color: #000000 !important;
          }
          .stats-tbl th, .stats-tbl td {
            border: 1px solid #1e3a8a !important;
            padding: 1.5px 2px !important;
            height: 17px !important;
            box-sizing: border-box !important;
            vertical-align: middle !important;
            text-align: center !important;
          }
          .stats-tbl td[contenteditable="true"]:focus {
            outline: 2px solid #2563eb !important;
            background-color: #eff6ff !important;
          }
          .stats-shaded {
            background-color: #cbd5e1 !important;
            font-weight: bold !important;
          }
          @media print {
            .teacher-class-stats-page {
              padding: 5mm 6mm !important;
              max-width: 100% !important;
              width: 100% !important;
            }
          }
        </style>

        <!-- Top Right Badge PRI -->
        <div style="position: absolute; right: 9mm; top: 7mm; border: 1.2px solid #1e3a8a; border-radius: 9999px; padding: 2px 14px; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #1e3a8a;">
          PRI
        </div>

        <!-- Center Header: Title & Academic Year -->
        <div style="text-align: center; margin-bottom: 8px; padding-top: 2px;">
          <h1 style="font-weight: 800; font-size: 15px; color: #1e3a8a; margin: 0; padding: 0; letter-spacing: -0.2px;">
            តារាងចំនួនសិស្សតាមថ្នាក់(សម្រាប់គ្រូ)
          </h1>
          <div style="font-weight: 800; font-size: 13px; color: #1e3a8a; margin-top: 2px;">
            ឆ្នាំសិក្សា ${data.academicYear}
          </div>
        </div>

        <!-- Top Meta Information: Province, District, School -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; font-size: 9px; line-height: 1.4;">
          <div style="width: 55%;">
            <div>
              <span>រាជធានី/ខេត្ត:</span>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <strong style="color: #1e3a8a; font-size: 9.5px;" contenteditable="true">${data.schoolInfo.province}</strong>
            </div>
            <div>
              <span>សាលា</span>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <strong style="color: #1e3a8a; font-size: 9.5px;" contenteditable="true">${data.schoolInfo.schoolName}</strong>
            </div>
          </div>
          <div style="width: 45%; text-align: left; padding-left: 10px;">
            <div>
              <span>ស្រុក/ខណ្ឌ</span>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <strong style="color: #1e3a8a; font-size: 9.5px;" contenteditable="true">${data.schoolInfo.district}</strong>
            </div>
          </div>
        </div>

        <!-- Main 2-Column Grid Layout -->
        <div style="display: grid; grid-template-columns: 46% 54%; gap: 10px; align-items: start;">
          
          <!-- ==================== LEFT COLUMN ==================== -->
          <div style="display: flex; flex-direction: column;">
            
            <!-- Section 1 Header: Teacher Info -->
            <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 8.5px; font-weight: bold; margin-bottom: 2px;">
              <span>១. ព័ត៌មានសេវាគ្រូទទួលបន្ទុក</span>
              <span style="font-size: 9px; color: #1e3a8a;">ថ្នាក់ទី ${data.className}</span>
            </div>

            <!-- Section 1 Table -->
            <table class="stats-tbl">
              <tbody>
                <tr>
                  <td style="text-align: left !important; padding-left: 6px !important; width: 56%; font-weight: 500;">ឈ្មោះជាអក្សរខ្មែរ</td>
                  <td style="font-weight: bold; width: 44%;" contenteditable="true">${data.teacherInfo.name}</td>
                </tr>
                <tr>
                  <td style="text-align: left !important; padding-left: 6px !important; font-weight: 500;">ភេទ(សូមគូសរង្វង់)</td>
                  <td contenteditable="true">${data.teacherInfo.gender === 'ស្រី' ? 'ប្រុស/<span style="border: 1px solid #1e3a8a; border-radius: 50%; padding: 0 4px;">ស្រី</span>' : '<span style="border: 1px solid #1e3a8a; border-radius: 50%; padding: 0 4px;">ប្រុស</span>/ស្រី'}</td>
                </tr>
                <tr>
                  <td style="text-align: left !important; padding-left: 6px !important; font-weight: 500;">អាយុ(សូមគូសរង្វង់)</td>
                  <td contenteditable="true">${data.teacherInfo.age}</td>
                </tr>
                <tr>
                  <td style="text-align: left !important; padding-left: 6px !important; font-weight: 500;">ជនជាតិដើមភាគតិច</td>
                  <td contenteditable="true">${data.teacherInfo.isEthnicMinority === 'ពិតមែន' ? '<span style="border: 1px solid #1e3a8a; border-radius: 50%; padding: 0 4px;">ពិតមែន</span>/ទេ' : 'ពិតមែន/<span style="border: 1px solid #1e3a8a; border-radius: 50%; padding: 0 4px;">ទេ</span>'}</td>
                </tr>
                <tr>
                  <td style="text-align: left !important; padding-left: 6px !important; font-weight: 500;">កម្រិតវប្បធម៌</td>
                  <td contenteditable="true">${data.teacherInfo.degree}</td>
                </tr>
                <tr>
                  <td style="text-align: left !important; padding-left: 6px !important; font-weight: 500;">រយៈពេលបម្រើការងារអប់រំ</td>
                  <td contenteditable="true">${data.teacherInfo.serviceYears}</td>
                </tr>
                <tr>
                  <td style="text-align: left !important; padding-left: 6px !important; font-weight: 500;">កម្រិតគរុកោសល្យ</td>
                  <td contenteditable="true">${data.teacherInfo.pedagogy}</td>
                </tr>
              </tbody>
            </table>

            <!-- Section 2.(ខ) Header -->
            <div style="font-weight: bold; font-size: 8px; margin-top: 5px; margin-bottom: 2px; line-height: 1.25;">
              <div>២.(ខ) សិស្សថ្មី សិស្សឡើងថ្នាក់ និង សិស្សត្រួតថ្នាក់</div>
              <div style="font-weight: normal; font-size: 7.5px;">
                ក្នុងឆ្នាំសិក្សា ${data.academicYear} ចំនួនសិស្សរាប់ត្រឹមថ្ងៃទី................
              </div>
            </div>

            <!-- Section 2.(ខ) Table -->
            <table class="stats-tbl">
              <thead>
                <tr>
                  <th rowspan="3" style="width: 14%; font-weight: bold;">អាយុ<br>ឆ្នាំ</th>
                  <th colspan="6" style="font-weight: bold;">ចំនួនសិស្ស</th>
                </tr>
                <tr>
                  <th colspan="2" style="width: 28%; font-weight: bold;">សិស្សថ្មី</th>
                  <th colspan="2" style="width: 28%; font-weight: bold;">សិស្សត្រួតថ្នាក់</th>
                  <th colspan="2" style="width: 30%; font-weight: bold;">សរុប</th>
                </tr>
                <tr>
                  <th style="font-weight: 500; font-size: 7.5px;">សរុប</th>
                  <th style="font-weight: 500; font-size: 7.5px;">ស្រី</th>
                  <th style="font-weight: 500; font-size: 7.5px;">សរុប</th>
                  <th style="font-weight: 500; font-size: 7.5px;">ស្រី</th>
                  <th style="font-weight: 500; font-size: 7.5px;">សរុប</th>
                  <th style="font-weight: 500; font-size: 7.5px;">ស្រី</th>
                </tr>
              </thead>
              <tbody>
                ${data.section2B.keys.map(k => {
                  const r = data.section2B.rows[k];
                  return `
                    <tr>
                      <td style="font-weight: bold;">${k}</td>
                      <td contenteditable="true">${r.newTot}</td>
                      <td contenteditable="true">${r.newFem}</td>
                      <td contenteditable="true">${r.repTot}</td>
                      <td contenteditable="true">${r.repFem}</td>
                      <td style="font-weight: bold;" contenteditable="true">${r.totTot}</td>
                      <td style="font-weight: bold;" contenteditable="true">${r.totFem}</td>
                    </tr>
                  `;
                }).join('')}
                <tr style="font-weight: bold;">
                  <td>សរុប</td>
                  <td contenteditable="true">${data.section2B.total.newTot}</td>
                  <td contenteditable="true">${data.section2B.total.newFem}</td>
                  <td contenteditable="true">${data.section2B.total.repTot}</td>
                  <td contenteditable="true">${data.section2B.total.repFem}</td>
                  <td contenteditable="true">${data.section2B.total.totTot}</td>
                  <td contenteditable="true">${data.section2B.total.totFem}</td>
                </tr>
              </tbody>
            </table>

            <!-- Section 4 Header: Ethnic Minorities -->
            <div style="font-weight: bold; font-size: 8px; margin-top: 5px; margin-bottom: 2px;">
              ៤.សិស្សតាមជនជាតិដើមភាគតិច
            </div>

            <!-- Section 4 Table -->
            <table class="stats-tbl">
              <thead>
                <tr>
                  <th rowspan="2" style="width: 44%; font-weight: bold;">ក្រុមអាយុ</th>
                  <th colspan="2" style="font-weight: bold;">សិស្សជនជាតិដើមភាគតិច</th>
                </tr>
                <tr>
                  <th style="width: 28%; font-weight: 500; font-size: 7.5px;">សរុប</th>
                  <th style="width: 28%; font-weight: 500; font-size: 7.5px;">ស្រី</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: bold;">6</td>
                  <td contenteditable="true">${data.section4.rows['6'].tot}</td>
                  <td contenteditable="true">${data.section4.rows['6'].fem}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">7-11</td>
                  <td contenteditable="true">${data.section4.rows['7-11'].tot}</td>
                  <td contenteditable="true">${data.section4.rows['7-11'].fem}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">12+</td>
                  <td contenteditable="true">${data.section4.rows['12+'].tot}</td>
                  <td contenteditable="true">${data.section4.rows['12+'].fem}</td>
                </tr>
                <tr style="font-weight: bold;">
                  <td>សរុប</td>
                  <td contenteditable="true">${data.section4.total.tot}</td>
                  <td contenteditable="true">${data.section4.total.fem}</td>
                </tr>
              </tbody>
            </table>

            <!-- Left Signatures Block -->
            <div style="margin-top: 10px; font-size: 8px; line-height: 1.35; text-align: center;">
              <div>${data.dates.lunarText}</div>
              <div>ធ្វើនៅ ${data.dates.location} ${data.dates.solarText}</div>
              <div style="margin-top: 6px; display: flex; justify-content: space-between; align-items: baseline; padding: 0 4px;">
                <span>ហត្ថលេខាគ្រូទទួលបន្ទុក</span>
                <span style="font-weight: bold; min-width: 80px; border-bottom: 1px dotted #94a3b8; display: inline-block;" contenteditable="true">${data.teacherInfo.name}</span>
              </div>
            </div>

          </div>

          <!-- ==================== RIGHT COLUMN ==================== -->
          <div style="display: flex; flex-direction: column;">
            
            <!-- Section 2.(ក) Header -->
            <div style="font-weight: bold; font-size: 8px; margin-bottom: 2px; line-height: 1.25;">
              <div>២. (ក) ចំនួនសិស្សថ្នាក់ទី១ បានឆ្លងកម្ពវិធីកុមារតូច</div>
              <div style="font-weight: normal; font-size: 7.5px; color: #334155;">
                (ក្រៅពីថ្នាក់ទី១មិនបាច់បំពេញតារាង ២.(ក) នេះទេ)
              </div>
            </div>

            <!-- Section 2.(ក) Table -->
            <table class="stats-tbl">
              <thead>
                <tr>
                  <th rowspan="3" style="width: 38%; font-weight: bold;">ប្រភេទ</th>
                  <th colspan="4" style="font-weight: bold;">ថ្នាក់ទី១ (សិស្សម្នាក់អាចរាប់អានបានតែមួយដង)</th>
                </tr>
                <tr>
                  <th colspan="2" style="width: 31%; font-weight: bold;">សិស្សថ្មី</th>
                  <th colspan="2" style="width: 31%; font-weight: bold;">សិស្សត្រួតថ្នាក់</th>
                </tr>
                <tr>
                  <th style="font-weight: 500; font-size: 7.5px;">សរុប</th>
                  <th style="font-weight: 500; font-size: 7.5px;">ស្រី</th>
                  <th style="font-weight: 500; font-size: 7.5px;">សរុប</th>
                  <th style="font-weight: 500; font-size: 7.5px;">ស្រី</th>
                </tr>
              </thead>
              <tbody>
                ${data.section2A.rows.map(r => `
                  <tr>
                    <td style="text-align: left !important; padding-left: 4px !important;">${r.label}</td>
                    <td contenteditable="true">${r.newTot}</td>
                    <td contenteditable="true">${r.newFem}</td>
                    <td contenteditable="true">${r.repTot}</td>
                    <td contenteditable="true">${r.repFem}</td>
                  </tr>
                `).join('')}
                <tr style="font-weight: bold;">
                  <td>សរុប</td>
                  <td contenteditable="true">${data.section2A.total.newTot}</td>
                  <td contenteditable="true">${data.section2A.total.newFem}</td>
                  <td contenteditable="true">${data.section2A.total.repTot}</td>
                  <td contenteditable="true">${data.section2A.total.repFem}</td>
                </tr>
              </tbody>
            </table>

            <!-- Section 3 Header -->
            <div style="font-weight: bold; font-size: 7.5px; margin-top: 5px; margin-bottom: 2px; line-height: 1.2;">
              ៣.ចំនួនសិស្សជួបការលំបាកតាមកម្រិតថ្នាក់(សិស្សម្នាក់អាចរាប់ច្រើនដងបាន តាមភាពជាក់ស្តែង បើសិស្សនោះពិការ ឬមានប៉ះពាល់ចំណុចច្រើនក្នុងបរិយាយ)
            </div>

            <!-- Section 3 Table -->
            <table class="stats-tbl">
              <thead>
                <tr>
                  <th colspan="2" style="width: 66%; font-weight: bold;">បរិយាយ</th>
                  <th colspan="2" style="width: 34%; font-weight: bold;">ចំណុចជួបការលំបាក</th>
                </tr>
                <tr>
                  <th colspan="2" style="display: none;"></th>
                  <th style="width: 17%; font-weight: 500; font-size: 7.5px;">សរុប</th>
                  <th style="width: 17%; font-weight: 500; font-size: 7.5px;">ស្រី</th>
                </tr>
              </thead>
              <tbody>
                <!-- Subcategory 1: Disabilities Banner -->
                <tr class="stats-shaded">
                  <td colspan="2" style="text-align: left !important; padding-left: 4px !important;">សិស្សពិការ*</td>
                  <td contenteditable="true">${data.section3.disabilities.total.tot}</td>
                  <td contenteditable="true">${data.section3.disabilities.total.fem}</td>
                </tr>
                ${data.section3.disabilities.items.map((item, idx) => `
                  <tr>
                    ${idx === 0 ? `
                      <td rowspan="8" style="width: 14px !important; padding: 1px !important; font-weight: bold; vertical-align: middle !important; font-size: 7px; line-height: 1.1; letter-spacing: -0.2px;">
                        <div>ពិ</div>
                        <div>ការ</div>
                        <div>**</div>
                      </td>
                    ` : ''}
                    <td style="text-align: left !important; padding-left: 4px !important;">${item.label}</td>
                    <td contenteditable="true">${item.tot}</td>
                    <td contenteditable="true">${item.fem}</td>
                  </tr>
                `).join('')}

                <!-- Subcategory 2: Health Banner -->
                <tr class="stats-shaded">
                  <td colspan="2" style="text-align: left !important; padding-left: 4px !important;">សិស្សជួបការលំបាកផ្នែកសុខភាព*</td>
                  <td contenteditable="true">${data.section3.health.total.tot}</td>
                  <td contenteditable="true">${data.section3.health.total.fem}</td>
                </tr>
                ${data.section3.health.items.map((item, idx) => `
                  <tr>
                    ${idx === 0 ? `
                      <td rowspan="2" style="width: 14px !important; padding: 1px !important; font-weight: bold; vertical-align: middle !important; font-size: 7px; line-height: 1.1; letter-spacing: -0.2px;">
                        <div>សុខ</div>
                        <div>ភាព</div>
                        <div>**</div>
                      </td>
                    ` : ''}
                    <td style="text-align: left !important; padding-left: 4px !important;">${item.label}</td>
                    <td contenteditable="true">${item.tot}</td>
                    <td contenteditable="true">${item.fem}</td>
                  </tr>
                `).join('')}

                <!-- Subcategory 3: Vulnerabilities Banner -->
                <tr class="stats-shaded">
                  <td colspan="2" style="text-align: left !important; padding-left: 4px !important;">សិស្សជួបការលំបាក**</td>
                  <td contenteditable="true">${data.section3.situations.total.tot}</td>
                  <td contenteditable="true">${data.section3.situations.total.fem}</td>
                </tr>
                ${data.section3.situations.items.map((item, idx) => `
                  <tr>
                    ${idx === 0 ? `
                      <td rowspan="6" style="width: 14px !important; padding: 1px !important; font-weight: bold; vertical-align: middle !important; font-size: 7px; line-height: 1.1; letter-spacing: -0.2px;">
                        <div>ស្ថាន</div>
                        <div>ភាព</div>
                        <div>**</div>
                      </td>
                    ` : ''}
                    <td style="text-align: left !important; padding-left: 4px !important;">${item.label}</td>
                    <td contenteditable="true">${item.tot}</td>
                    <td contenteditable="true">${item.fem}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Footnotes -->
            <div style="font-size: 7px; margin-top: 4px; line-height: 1.3; color: #000000;">
              <div>* សំដៅលើចំនួនសិស្ស (ដោយរាប់សិស្សម្នាក់តែមួយដងគត់ទោះបីសិស្សនោះមានពិការភាពច្រើនប្រភេទក៏ដោយ)</div>
              <div>** សំដៅលើចំនួនសិស្សសរុបតាមប្រភេទ (ដោយរាប់សិស្សម្នាក់បានច្រើនដង តាមប្រភេទពិការភាពជាក់ស្ដែងរបស់សិស្សនោះ ប្រសិនបើសិស្សម្នាក់នោះមានពិការភាពច្រើនប្រភេទ)</div>
            </div>

          </div>

        </div>

      </div>
    `;
  }
};

