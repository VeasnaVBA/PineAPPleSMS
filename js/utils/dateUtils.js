/**
 * Global Date Formatting Utilities
 * Enforces DD-MM-YYYY (dd-mm-yyyy) format across all application views.
 */

/**
 * Format any date input (ISO string, YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, Date object)
 * into standard dd-mm-yyyy (e.g. 25-09-2026).
 *
 * @param {string|Date|number|null|undefined} dateInput
 * @returns {string} Formatted as dd-mm-yyyy or empty string
 */
export function formatDisplayDate(dateInput) {
  if (!dateInput) return '';

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    const d = String(dateInput.getDate()).padStart(2, '0');
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const y = String(dateInput.getFullYear());
    return `${d}-${m}-${y}`;
  }

  const str = String(dateInput).trim();
  if (!str || str === '—' || str === '-' || str === 'null' || str === 'undefined') return '';

  // 1. ISO format with time e.g. 2012-10-27T17:00:00.000Z or 2012-10-27 17:00:00
  // Parse date part directly if starts with YYYY-MM-DD to avoid timezone shifting
  const isoPrefixMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)/);
  if (isoPrefixMatch) {
    const [, y, m, d] = isoPrefixMatch;
    return `${d}-${m}-${y}`;
  }

  // 2. YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(ymdMatch[2]).padStart(2, '0');
    const d = String(ymdMatch[3]).padStart(2, '0');
    return `${d}-${m}-${y}`;
  }

  // 3. DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return `${d}-${m}-${y}`;
  }

  // 4. Fallback Date object parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = String(parsed.getFullYear());
    return `${d}-${m}-${y}`;
  }

  return str;
}

/**
 * Normalizes any date string to YYYY-MM-DD for native <input type="date">
 *
 * @param {string|Date|null|undefined} dateInput
 * @returns {string} YYYY-MM-DD
 */
export function toInputDateFormat(dateInput) {
  if (!dateInput) return '';

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(dateInput).trim();
  if (!str) return '';

  // 1. ISO string with time
  const isoPrefixMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)/);
  if (isoPrefixMatch) {
    const [, y, m, d] = isoPrefixMatch;
    return `${y}-${m}-${d}`;
  }

  // 2. YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(ymdMatch[2]).padStart(2, '0');
    const d = String(ymdMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 3. DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

/**
 * Convert numbers to Khmer numerals (e.g. 2026 -> ២០២៦)
 */
export function toKhmerNumerals(num) {
  if (num === null || num === undefined) return '';
  const kmDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(num).replace(/[0-9]/g, d => kmDigits[Number(d)]);
}

/**
 * Format date in Khmer solar format (e.g. ថ្ងៃទី១៣ ខែកញ្ញា ឆ្នាំ២០២៦)
 */
export function formatKhmerSolarDate(dateInput = new Date()) {
  const dateObj = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(dateObj.getTime())) return '';
  const kmMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const day = toKhmerNumerals(dateObj.getDate());
  const month = kmMonths[dateObj.getMonth()];
  const year = toKhmerNumerals(dateObj.getFullYear());
  return `ថ្ងៃទី${day} ខែ${month} ឆ្នាំ${year}`;
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dob) {
  if (!dob) return '';
  const iso = toInputDateFormat(dob);
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : '';
}

/**
 * Calculate MoEYS civil servant retirement date (DOB + 60 Years)
 * Returns YYYY-MM-DD for date picker input compatibility.
 */
export function calculateRetirementDate(dob) {
  if (!dob) return '';
  const iso = toInputDateFormat(dob);
  if (!iso) return '';
  const parts = iso.split('-').map(Number);
  if (parts.length < 3) return '';
  const [y, m, d] = parts;
  const birth = new Date(y, m - 1, d);
  if (isNaN(birth.getTime())) return '';
  const retirement = new Date(birth);
  retirement.setFullYear(retirement.getFullYear() + 60);
  const ry = retirement.getFullYear();
  const rm = String(retirement.getMonth() + 1).padStart(2, '0');
  const rd = String(retirement.getDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}
