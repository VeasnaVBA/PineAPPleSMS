/**
 * Khmer Lunar Calendar (Chhankitek / ចន្ទគតិ) & Cambodian Public Holidays Utility
 * Standalone, 100% offline-capable calculation of Khmer lunar dates, Buddhist holy days (ថ្ងៃសីល),
 * and Cambodian national + lunar holidays for any Gregorian month and year.
 */

const LunarMonthNames = [
  'មិគសិរ', 'បុស្ស', 'មាឃ', 'ផល្គុន', 'ចេត្រ', 'ពិសាខ',
  'ជេស្ឋ', 'អាសាឍ', 'ស្រាពណ៍', 'ភទ្របទ', 'អស្សុជ', 'កត្តិក',
  'បឋមាសាឍ', 'ទុតិយាសាឍ'
];

const AnimalYearNames = [
  'ជូត', 'ឆ្លូវ', 'ខាល', 'ថោះ', 'រោង', 'ម្សាញ់',
  'មមី', 'មមែ', 'វក', 'រកា', 'ច', 'កុរ'
];

const SakNames = [
  'សំរឹទ្ធិស័ក', 'ឯកស័ក', 'ទោស័ក', 'ត្រីស័ក', 'ចត្វាស័ក',
  'បញ្ចស័ក', 'ឆស័ក', 'សប្តស័ក', 'អដ្ឋស័ក', 'នព្វស័ក'
];

const WeekdayNames = [
  'អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'
];

const MoonPhaseNames = ['កើត', 'រោច'];
const MoonPhaseShort = ['ក', 'រ'];

const KhmerNumerals = {
  '0': '០', '1': '១', '2': '២', '3': '៣', '4': '៤',
  '5': '៥', '6': '៦', '7': '៧', '8': '៨', '9': '៩'
};

const khNewYearMoments = {
  '1879': '12-04-1879 11:36',
  '1897': '13-04-1897 02:00',
  '2011': '14-04-2011 13:12',
  '2012': '14-04-2012 19:11',
  '2013': '14-04-2013 02:12',
  '2014': '14-04-2014 08:07',
  '2015': '14-04-2015 14:02',
  '2024': '13-04-2024 22:17'
};

export function toKhmerNumeral(num) {
  return String(num).replace(/\d/g, d => KhmerNumerals[d] || d);
}

function gregorianToJulianDay(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function julianDayToGregorian(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

function getDayOfWeek(year, month, day) {
  const jdn = gregorianToJulianDay(year, month, day);
  return (jdn + 1) % 7;
}

function adToJs(adYear) {
  return adYear - 638;
}

function beToJs(beYear) {
  return beYear - 1182;
}

function getAharkun(beYear) {
  return Math.floor((beYear * 292207 + 499) / 800) + 4;
}

function getAharkunMod(beYear) {
  return (beYear * 292207 + 499) % 800;
}

function getKromthupul(beYear) {
  return 800 - getAharkunMod(beYear);
}

function getAvoman(beYear) {
  return (getAharkun(beYear) * 11 + 25) % 692;
}

function getBodithey(beYear) {
  const aharkun = getAharkun(beYear);
  return (Math.floor((aharkun * 11 + 25) / 692) + aharkun + 29) % 30;
}

function isKhmerSolarLeap(beYear) {
  return getKromthupul(beYear) <= 207;
}

function isKhmerLeapDayByCalculation(beYear) {
  const avoman = getAvoman(beYear);
  const isSolarLeap = isKhmerSolarLeap(beYear);
  if (avoman === 0 && getAvoman(beYear - 1) === 137) {
    return true;
  } else if (isSolarLeap) {
    return avoman < 127;
  } else if (avoman === 137 && getAvoman(beYear + 1) === 0) {
    return false;
  } else if (avoman < 138) {
    return true;
  }
  return false;
}

function isKhmerLeapMonth(beYear) {
  const bodithey = getBodithey(beYear);
  const boditheyNextYear = getBodithey(beYear + 1);
  if (bodithey === 25 && boditheyNextYear === 5) {
    return false;
  }
  return (bodithey === 24 && boditheyNextYear === 6) ||
    (bodithey >= 25) ||
    (bodithey < 6);
}

function getLeapType(beYear) {
  if (isKhmerLeapMonth(beYear)) {
    return 1; // Leap month (អធិកមាស)
  } else if (isKhmerLeapDayByCalculation(beYear)) {
    return 2; // Leap day (ចន្ទ្រាធិមាស)
  } else if (isKhmerLeapMonth(beYear - 1)) {
    let previousYear = beYear - 1;
    while (true) {
      if (isKhmerLeapDayByCalculation(previousYear)) {
        return 2;
      }
      previousYear -= 1;
      if (!isKhmerLeapMonth(previousYear)) {
        return 0;
      }
    }
  }
  return 0;
}

function getNumberOfDaysInKhmerMonth(monthIndex, beYear) {
  const leapType = getLeapType(beYear);
  if (monthIndex === 6 && leapType === 2) { // ជេស្ឋ with leap day
    return 30;
  }
  if (monthIndex === 12 || monthIndex === 13) { // បឋមាសាឍ, ទុតិយាសាឍ
    return leapType === 1 ? 30 : 0;
  }
  return monthIndex % 2 === 0 ? 29 : 30;
}

function getNumberOfDaysInKhmerYear(beYear) {
  const leapType = getLeapType(beYear);
  if (leapType === 1) return 384;
  if (leapType === 2) return 355;
  return 354;
}

function nextMonthOf(monthIndex, beYear) {
  const leapType = getLeapType(beYear);
  if (monthIndex === 6 && leapType === 1) return 12; // ជេស្ឋ -> បឋមាសាឍ
  if (monthIndex === 11) return 0; // កត្តិក -> មិគសិរ
  if (monthIndex === 12) return 13; // បឋមាសាឍ -> ទុតិយាសាឍ
  if (monthIndex === 13) return 8; // ទុតិយាសាឍ -> ស្រាពណ៍
  return monthIndex + 1;
}

function getAharkunJs(jsYear) {
  const h = jsYear * 292207 + 373;
  return Math.floor(h / 800) + 1;
}

function getAvomanJs(jsYear) {
  return (getAharkunJs(jsYear) * 11 + 650) % 692;
}

function getKromthupulJs(jsYear) {
  return 800 - ((292207 * jsYear + 373) % 800);
}

function getBoditheyJs(jsYear) {
  const aharkun = getAharkunJs(jsYear);
  const a = 11 * aharkun + 650;
  return (aharkun + Math.floor(a / 692)) % 30;
}

function isAdhikameas(jsYear) {
  const bodithey = getBoditheyJs(jsYear);
  const boditheyNext = getBoditheyJs(jsYear + 1);
  if (bodithey === 24 && boditheyNext === 6) return true;
  if (bodithey === 25 && boditheyNext === 5) return false;
  return bodithey > 24 || bodithey < 6;
}

function isChantrathimeas(jsYear) {
  const avoman = getAvomanJs(jsYear);
  const avomanNext = getAvomanJs(jsYear + 1);
  const avomanPrev = getAvomanJs(jsYear - 1);
  const isSolarLeap = getKromthupulJs(jsYear) <= 207;
  if (avoman === 0 && avomanPrev === 137) return true;
  if (isSolarLeap) return avoman < 127;
  if (avoman === 137 && avomanNext === 0) return false;
  if (!isSolarLeap && avoman < 138) return true;
  if (avomanPrev === 137 && avoman === 0) return true;
  return false;
}

function has366Days(jsYear) {
  return getKromthupulJs(jsYear) <= 207;
}

function getSunInfo(jsYear, sotin) {
  const kromathopol = getKromthupulJs(jsYear - 1);
  const r2 = 800 * sotin + kromathopol;
  const reasey = Math.floor(r2 / 24350);
  const r3 = r2 % 24350;
  const angsar = Math.floor(r3 / 811);
  const r4 = r3 % 811;
  const l1 = Math.floor(r4 / 14);
  const libda = l1 - 3;
  const sunAverageAsLibda = (30 * 60 * reasey) + (60 * angsar) + libda;

  const s1 = (30 * 60 * 2) + (60 * 20);
  let leftOver = sunAverageAsLibda - s1;
  if (sunAverageAsLibda < s1) {
    leftOver += 30 * 60 * 12;
  }
  const kaen = Math.floor(leftOver / (30 * 60));

  let rs = -1;
  if ([0, 1, 2].includes(kaen)) {
    rs = kaen;
  } else if ([3, 4, 5].includes(kaen)) {
    rs = (30 * 60 * 6) - leftOver;
  } else if ([6, 7, 8].includes(kaen)) {
    rs = leftOver - (30 * 60 * 6);
  } else if ([9, 10, 11].includes(kaen)) {
    rs = ((30 * 60 * 11) + (60 * 29) + 60) - leftOver;
  }

  const lastLeftOver = {
    reasey: Math.floor(rs / (30 * 60)),
    angsar: Math.floor((rs % (30 * 60)) / 60),
    libda: rs % 60
  };

  let khan, pouichalip;
  if (lastLeftOver.angsar >= 15) {
    khan = 2 * lastLeftOver.reasey + 1;
    pouichalip = 60 * (lastLeftOver.angsar - 15) + lastLeftOver.libda;
  } else {
    khan = 2 * lastLeftOver.reasey;
    pouichalip = 60 * lastLeftOver.angsar + lastLeftOver.libda;
  }

  const chhayaSunMap = [
    { multiplicity: 35, chhaya: 0 },
    { multiplicity: 32, chhaya: 35 },
    { multiplicity: 27, chhaya: 67 },
    { multiplicity: 22, chhaya: 94 },
    { multiplicity: 13, chhaya: 116 },
    { multiplicity: 5, chhaya: 129 }
  ];
  const chhayaSun = khan <= 5 ? chhayaSunMap[khan] : { multiplicity: 0, chhaya: 134 };
  const q = Math.floor((pouichalip * chhayaSun.multiplicity) / 900);
  const pholAsLibda = q + chhayaSun.chhaya;

  const sunInaugurationAsLibda = kaen <= 5
    ? sunAverageAsLibda - pholAsLibda
    : sunAverageAsLibda + pholAsLibda;

  return {
    sunInaugurationAsLibda,
    reasey: Math.floor(sunInaugurationAsLibda / (30 * 60)),
    angsar: Math.floor((sunInaugurationAsLibda % (30 * 60)) / 60),
    libda: sunInaugurationAsLibda % 60
  };
}

function getNewYearInfo(jsYear) {
  const sotins = has366Days(jsYear - 1)
    ? [363, 364, 365, 366]
    : [362, 363, 364, 365];
  const newYearsDaySotins = sotins.map(sotin => getSunInfo(jsYear, sotin));
  let timeOfNewYear = { hour: 0, minute: 0 };
  for (const sotin of newYearsDaySotins) {
    if (sotin.angsar === 0) {
      const minutes = (24 * 60) - (sotin.libda * 24);
      timeOfNewYear = {
        hour: Math.floor(minutes / 60) % 24,
        minute: minutes % 60
      };
      break;
    }
  }
  const numberOfVanabatDays = (newYearsDaySotins[0].angsar === 0) ? 2 : 1;
  return {
    timeOfNewYear,
    numberOfVanabatDays,
    newYearsDaySotins
  };
}

function getMaybeBEYear(year, month) {
  return month <= 4 ? year + 543 : year + 544;
}

const visakhaBocheaCache = {};
const newYearInfoCache = {};

function fromDayNumber(dayNum) {
  if (dayNum < 15) {
    return { day: dayNum + 1, moonPhase: 0 }; // កើត
  }
  return { day: (dayNum - 15) + 1, moonPhase: 1 }; // រោច
}

function getPisakhaBochea(year) {
  if (visakhaBocheaCache[year]) {
    return visakhaBocheaCache[year];
  }
  for (let searchMonth = 4; searchMonth <= 6; searchMonth++) {
    const daysInMonth = new Date(year, searchMonth, 0).getDate();
    for (let searchDay = 1; searchDay <= daysInMonth; searchDay++) {
      const result = gregorianToKhmerInternal(year, searchMonth, searchDay, 12, 0, 0, true);
      if (result.khmer.monthIndex === 5 && result.khmer.dayNumber === 15) {
        const timestamp = new Date(year, searchMonth - 1, searchDay, 0, 0, 0, 0).getTime();
        visakhaBocheaCache[year] = timestamp;
        return timestamp;
      }
    }
  }
  const fallback = new Date(year, 3, 15, 0, 0, 0, 0).getTime();
  visakhaBocheaCache[year] = fallback;
  return fallback;
}

function getNewYearFullInfo(ceYear) {
  if (newYearInfoCache[ceYear]) {
    return newYearInfoCache[ceYear];
  }
  const jsYear = adToJs(ceYear);
  const newYearInfo = getNewYearInfo(jsYear);
  let bodithey = getBoditheyJs(jsYear);
  const isAthikameasPrev = isAdhikameas(jsYear - 1);
  const isChantrathimeasPrev = isChantrathimeas(jsYear - 1);
  if (isAthikameasPrev && isChantrathimeasPrev) {
    bodithey = (bodithey + 1) % 30;
  }
  const lunarDateLerngSak = {
    day: bodithey >= 6 ? bodithey - 1 : bodithey,
    month: bodithey >= 6 ? 4 : 5
  };
  const numberNewYearDay = newYearInfo.newYearsDaySotins[0].angsar === 0 ? 4 : 3;
  const khEpoch = gregorianToKhmerInternal(ceYear, 4, 17, 12, 0, 0, true).khmer;
  const diffFromEpoch = ((khEpoch.monthIndex - 4) * 29 + khEpoch.dayNumber) -
    ((lunarDateLerngSak.month - 4) * 29 + lunarDateLerngSak.day);
  const daysToSubtract = diffFromEpoch + numberNewYearDay - 1;
  const epochJdn = gregorianToJulianDay(ceYear, 4, 17);
  let newYearJdn = epochJdn - daysToSubtract;

  if (khNewYearMoments[ceYear]) {
    const [datePart, timePart] = khNewYearMoments[ceYear].split(' ');
    const [d, m, y] = datePart.split('-').map(Number);
    const [hr, min] = timePart.split(':').map(Number);
    newYearInfo.timeOfNewYear = { hour: hr, minute: min };
    newYearJdn = gregorianToJulianDay(y, m, d);
  }

  const newYearDate = julianDayToGregorian(newYearJdn);
  const newYearMoment = new Date(
    newYearDate.year,
    newYearDate.month - 1,
    newYearDate.day,
    newYearInfo.timeOfNewYear.hour,
    newYearInfo.timeOfNewYear.minute
  );
  const lerngSakJdn = newYearJdn + numberNewYearDay - 1;
  const lerngSakDate = julianDayToGregorian(lerngSakJdn);
  const lerngSakMoment = new Date(lerngSakDate.year, lerngSakDate.month - 1, lerngSakDate.day, 0, 0, 0);

  const result = {
    newYearMoment,
    lerngSakMoment,
    numberNewYearDay,
    newYearInfo: {
      year: newYearDate.year,
      month: newYearDate.month,
      day: newYearDate.day,
      hour: newYearInfo.timeOfNewYear.hour,
      minute: newYearInfo.timeOfNewYear.minute
    }
  };
  newYearInfoCache[ceYear] = result;
  return result;
}

function gregorianToKhmerInternal(year, month, day, hour = 12, minute = 0, second = 0, isSearching = false) {
  let epochJdn = gregorianToJulianDay(1900, 1, 1);
  const targetJdn = gregorianToJulianDay(year, month, day);
  let khmerMonth = 1; // បុស្ស
  let diffDays = targetJdn - epochJdn;

  if (diffDays > 0) {
    while (true) {
      const epochGreg = julianDayToGregorian(epochJdn);
      const nextYearBE = getMaybeBEYear(epochGreg.year + 1, epochGreg.month);
      const daysInNextYear = getNumberOfDaysInKhmerYear(nextYearBE);
      if (diffDays > daysInNextYear) {
        diffDays -= daysInNextYear;
        epochJdn += daysInNextYear;
      } else {
        break;
      }
    }
  } else if (diffDays < 0) {
    while (diffDays < 0) {
      const epochGreg = julianDayToGregorian(epochJdn);
      const currentYearBE = getMaybeBEYear(epochGreg.year, epochGreg.month);
      const daysInCurrentYear = getNumberOfDaysInKhmerYear(currentYearBE);
      diffDays += daysInCurrentYear;
      epochJdn -= daysInCurrentYear;
    }
  }

  while (diffDays > 0) {
    const epochGreg = julianDayToGregorian(epochJdn);
    const currentBE = getMaybeBEYear(epochGreg.year, epochGreg.month);
    const daysInMonth = getNumberOfDaysInKhmerMonth(khmerMonth, currentBE);
    if (diffDays > daysInMonth) {
      diffDays -= daysInMonth;
      epochJdn += daysInMonth;
      khmerMonth = nextMonthOf(khmerMonth, currentBE);
    } else {
      break;
    }
  }

  let khmerDayNumber = diffDays;
  const finalBE = getMaybeBEYear(year, month);
  const totalDaysInMonth = getNumberOfDaysInKhmerMonth(khmerMonth, finalBE);
  if (khmerDayNumber >= totalDaysInMonth) {
    khmerDayNumber = khmerDayNumber % totalDaysInMonth;
    khmerMonth = nextMonthOf(khmerMonth, finalBE);
  }

  const khmerDayInfo = fromDayNumber(khmerDayNumber);
  let beYear;
  if (isSearching) {
    beYear = month <= 4 ? year + 543 : year + 544;
  } else {
    const inputTimestamp = new Date(year, month - 1, day, hour, minute, second).getTime();
    const beYearTransitionTimestamp = getPisakhaBochea(year);
    beYear = inputTimestamp >= beYearTransitionTimestamp ? year + 544 : year + 543;
  }

  let jsYear = beToJs(beYear);
  let animalYearIndex = ((beYear + 4) % 12 + 12) % 12;

  if (!isSearching) {
    const newYearInfo = getNewYearFullInfo(year);
    const inputTimestamp = new Date(year, month - 1, day, hour, minute, second).getTime();
    const visakhaBocheaTimestamp = getPisakhaBochea(year);
    if (inputTimestamp >= newYearInfo.newYearMoment.getTime() && inputTimestamp <= visakhaBocheaTimestamp) {
      animalYearIndex = (animalYearIndex + 1) % 12;
    }
    if (inputTimestamp >= newYearInfo.lerngSakMoment.getTime() && inputTimestamp <= visakhaBocheaTimestamp) {
      jsYear++;
    }
  }

  const sakIndex = ((jsYear % 10) + 10) % 10;
  const dayOfWeek = getDayOfWeek(year, month, day);
  const daysInThisLunarMonth = getNumberOfDaysInKhmerMonth(khmerMonth, finalBE);

  return {
    gregorian: { year, month, day, dayOfWeek },
    khmer: {
      day: khmerDayInfo.day,
      dayKh: toKhmerNumeral(khmerDayInfo.day),
      dayNumber: khmerDayNumber,
      moonPhase: khmerDayInfo.moonPhase,
      moonPhaseName: MoonPhaseNames[khmerDayInfo.moonPhase],
      moonPhaseShort: MoonPhaseShort[khmerDayInfo.moonPhase],
      monthIndex: khmerMonth,
      monthName: LunarMonthNames[khmerMonth],
      daysInLunarMonth: daysInThisLunarMonth,
      beYear,
      beYearKh: toKhmerNumeral(beYear),
      jsYear,
      animalYear: animalYearIndex,
      animalYearName: AnimalYearNames[animalYearIndex],
      sak: sakIndex,
      sakName: SakNames[sakIndex],
      dayOfWeek,
      dayOfWeekName: WeekdayNames[dayOfWeek]
    }
  };
}

/**
 * Fixed-date Cambodian Public Holidays (Solar / National)
 */
const FIXED_SOLAR_HOLIDAYS = {
  '1-1': {
    nameKm: 'ទិវាចូលឆ្នាំសកល',
    nameEn: 'International New Year Day',
    type: 'national'
  },
  '1-7': {
    nameKm: 'ទិវាជ័យជម្នះលើរបបប្រល័យពូជសាសន៍',
    nameEn: 'Victory over Genocide Day',
    type: 'national'
  },
  '3-8': {
    nameKm: 'ទិវានារីអន្តរជាតិ',
    nameEn: "International Women's Day",
    type: 'national'
  },
  '4-14': {
    nameKm: 'បុណ្យចូលឆ្នាំថ្មីប្រពៃណីជាតិ (មហាសង្ក្រាន្ត)',
    nameEn: 'Khmer New Year (Maha Songkran)',
    type: 'lunar'
  },
  '4-15': {
    nameKm: 'បុណ្យចូលឆ្នាំថ្មីប្រពៃណីជាតិ (វារៈវនបត)',
    nameEn: 'Khmer New Year (Virak Vanabat)',
    type: 'lunar'
  },
  '4-16': {
    nameKm: 'បុណ្យចូលឆ្នាំថ្មីប្រពៃណីជាតិ (ថ្ងៃឡើងស័ក)',
    nameEn: 'Khmer New Year (Thngai Laeung Sak)',
    type: 'lunar'
  },
  '5-1': {
    nameKm: 'ទិវាពលកម្មអន្តរជាតិ',
    nameEn: 'International Labor Day',
    type: 'national'
  },
  '5-14': {
    nameKm: 'ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម ព្រះមហាក្សត្រ',
    nameEn: "King Norodom Sihamoni's Birthday",
    type: 'national'
  },
  '6-18': {
    nameKm: 'ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម សម្តេចព្រះមហាក្សត្រី',
    nameEn: "Queen Mother's Birthday",
    type: 'national'
  },
  '9-24': {
    nameKm: 'ទិវាប្រកាសរដ្ឋធម្មនុញ្ញ',
    nameEn: 'Constitution Day',
    type: 'national'
  },
  '10-15': {
    nameKm: 'ទិវាគោរពព្រះវិញ្ញាណក្ខន្ធ ព្រះបរមរតនកោដ្ឋ',
    nameEn: 'Commemoration Day of King Father',
    type: 'national'
  },
  '10-29': {
    nameKm: 'ព្រះរាជពិធីគ្រងព្រះបរមរាជសម្បត្តិ',
    nameEn: "King's Coronation Day",
    type: 'national'
  },
  '11-9': {
    nameKm: 'ទិវាបុណ្យឯករាជ្យជាតិ',
    nameEn: 'National Independence Day',
    type: 'national'
  },
  '12-29': {
    nameKm: 'ទិវាសន្តិភាពនៅកម្ពុជា',
    nameEn: 'Peace Day in Cambodia',
    type: 'national'
  }
};

/**
 * Evaluate Khmer Lunar Holidays (បុណ្យប្រពៃណីតាមប្រតិទិនចន្ទគតិ) from Chhankitek lunar date
 */
function getLunarHolidaysForDate(khmer) {
  const list = [];
  const { monthIndex, moonPhase, day, daysInLunarMonth } = khmer;

  // 1. Meak Bochea Day (បុណ្យមាឃបូជា): 15 កើត ខែមាឃ (monthIndex = 2)
  if (monthIndex === 2 && moonPhase === 0 && day === 15) {
    list.push({
      nameKm: 'បុណ្យមាឃបូជា',
      nameEn: 'Meak Bochea Day',
      type: 'lunar'
    });
  }

  // 2. Visak Bochea Day (បុណ្យវិសាខបូជា): 15 កើត ខែពិសាខ (monthIndex = 5)
  if (monthIndex === 5 && moonPhase === 0 && day === 15) {
    list.push({
      nameKm: 'បុណ្យវិសាខបូជា',
      nameEn: 'Visak Bochea Day',
      type: 'lunar'
    });
  }

  // 3. Royal Plowing Ceremony (ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល): 4 រោច ខែពិសាខ (monthIndex = 5)
  if (monthIndex === 5 && moonPhase === 1 && day === 4) {
    list.push({
      nameKm: 'ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល',
      nameEn: 'Royal Plowing Ceremony',
      type: 'lunar'
    });
  }

  // 4. Pchum Ben Festival (ពិធីបុណ្យភ្ជុំបិណ្ឌ): 14 រោច - 15 រោច ខែភទ្របទ & 1 កើត ខែអស្សុជ
  // Note: Phathrabot (monthIndex = 9) has 30 days (15 រោច), or if 29 days then 13-14 រោច
  const lastWaningPhatrabot = daysInLunarMonth === 29 ? 14 : 15;
  if (
    (monthIndex === 9 && moonPhase === 1 && (day === lastWaningPhatrabot - 1 || day === lastWaningPhatrabot)) ||
    (monthIndex === 10 && moonPhase === 0 && day === 1)
  ) {
    list.push({
      nameKm: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ',
      nameEn: 'Pchum Ben Festival',
      type: 'lunar'
    });
  }

  // 5. Water Festival (ព្រះរាជពិធីបុណ្យអុំទូក បណ្តែតប្រទីប និងសំពះព្រះខែ អកអំបុក):
  // 14 កើត, 15 កើត, 1 រោច ខែកត្តិក (monthIndex = 11)
  if (
    monthIndex === 11 &&
    ((moonPhase === 0 && (day === 14 || day === 15)) || (moonPhase === 1 && day === 1))
  ) {
    list.push({
      nameKm: 'ព្រះរាជពិធីបុណ្យអុំទូក បណ្តែតប្រទីប និងសំពះព្រះខែ អកអំបុក',
      nameEn: 'Water Festival (Bon Om Touk)',
      type: 'lunar'
    });
  }

  return list;
}

/**
 * Get complete Khmer Lunar Calendar & Holiday metadata for a single Gregorian date
 */
export function getKhmerLunarDayInfo(year, month, day) {
  const { khmer } = gregorianToKhmerInternal(Number(year), Number(month), Number(day), 12, 0, 0, false);

  // Buddhist Holy Day (ថ្ងៃសីល): 8កើត, 15កើត, 8រោច, and last waning day (14រោច or 15រោច)
  const lastWaningDay = khmer.daysInLunarMonth === 29 ? 14 : 15;
  const isHolyDay =
    khmer.day === 8 ||
    (khmer.moonPhase === 0 && khmer.day === 15) ||
    (khmer.moonPhase === 1 && khmer.day === lastWaningDay);

  const holidays = [];
  const fixedHoliday = FIXED_SOLAR_HOLIDAYS[`${Number(month)}-${Number(day)}`];
  if (fixedHoliday) {
    holidays.push(fixedHoliday);
  }

  const lunarHolidays = getLunarHolidaysForDate(khmer);
  for (const lh of lunarHolidays) {
    if (!holidays.some(h => h.nameKm === lh.nameKm)) {
      holidays.push(lh);
    }
  }

  const isHoliday = holidays.length > 0;
  const holidayTitleKm = holidays.map(h => h.nameKm).join(' / ');
  const holidayTitleEn = holidays.map(h => h.nameEn).join(' / ');

  // Short lunar text for column headers: e.g. "១៥កើត" or "៤រោច"
  const lunarShort = `${khmer.dayKh}${khmer.moonPhaseName}`;
  // Medium lunar text: e.g. "១៥កើត ពិសាខ"
  const lunarMedium = `${khmer.dayKh}${khmer.moonPhaseName} ខែ${khmer.monthName}`;
  // Full traditional Khmer lunar date
  const lunarFull = `ថ្ងៃ${khmer.dayOfWeekName} ${khmer.dayKh}${khmer.moonPhaseName} ខែ${khmer.monthName} ឆ្នាំ${khmer.animalYearName} ${khmer.sakName} ព.ស.${khmer.beYearKh}`;

  return {
    day: Number(day),
    month: Number(month),
    year: Number(year),
    khmer,
    lunarShort,
    lunarMedium,
    lunarFull,
    isHolyDay,
    isHoliday,
    holidays,
    holidayTitleKm,
    holidayTitleEn
  };
}

/**
 * Get Khmer Lunar Calendar & Holidays map for an entire Gregorian month
 */
export function getMonthKhmerCalendarMap(year, month, daysInMonth) {
  const y = Number(year);
  const m = Number(month);
  const totalDays = Number(daysInMonth) || new Date(y, m, 0).getDate();

  const daysMap = {};
  const holidaysList = [];
  const lunarMonthsSet = new Set();
  let animalYearName = '';
  let sakName = '';
  let beYearKh = '';

  for (let d = 1; d <= totalDays; d++) {
    const info = getKhmerLunarDayInfo(y, m, d);
    daysMap[d] = info;
    lunarMonthsSet.add(info.khmer.monthName);
    animalYearName = info.khmer.animalYearName;
    sakName = info.khmer.sakName;
    beYearKh = info.khmer.beYearKh;

    if (info.isHoliday) {
      holidaysList.push({
        day: d,
        dayKh: toKhmerNumeral(d),
        lunarMedium: info.lunarMedium,
        holidayTitleKm: info.holidayTitleKm,
        holidayTitleEn: info.holidayTitleEn,
        holidays: info.holidays
      });
    }
  }

  const lunarMonthsLabel = Array.from(lunarMonthsSet).join(' – ');
  const lunarYearHeaderKm = `ខែ${lunarMonthsLabel} ឆ្នាំ${animalYearName} ${sakName} ព.ស.${beYearKh}`;

  return {
    daysMap,
    holidaysList,
    lunarYearHeaderKm
  };
}
