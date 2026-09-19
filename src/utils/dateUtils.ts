/**
 * Standardized Date Utilities for Hotel Mauli Guest House
 * 
 * Provides timezone-safe local date/time formatting and comparison helpers.
 * Prevents UTC midnight-shift discrepancies where UTC+5:30 (IST) causes
 * `toISOString().split('T')[0]` to report the previous calendar date between 00:00 and 05:30 AM.
 */

/**
 * Converts any date representation (Date, ISO string, localized string)
 * into a local `YYYY-MM-DDTHH:mm` string.
 */
export const toLocalDateTimeString = (dateVal: string | Date | undefined | null): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    // If already in YYYY-MM-DDTHH:mm format without timezone, return directly
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateVal)) {
      return dateVal;
    }
    // If in YYYY-MM-DDTHH:mm:ss... without timezone
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateVal) && !dateVal.endsWith('Z') && !dateVal.includes('+')) {
      return dateVal.slice(0, 16);
    }
  }
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
};

/**
 * Converts any date representation into a local `YYYY-MM-DD` calendar date string.
 */
export const toLocalDateString = (dateVal?: string | Date | null): string => {
  if (!dateVal) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  const dt = toLocalDateTimeString(dateVal);
  if (dt && dt.length >= 10) {
    return dt.slice(0, 10);
  }
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
};

/**
 * Formats a date as DD/MM/YYYY for invoice display.
 * Uses local timezone to prevent UTC midnight-shift.
 */
export const formatDateDDMMYYYY = (dateVal?: string | Date | null): string => {
  if (!dateVal) return '-';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formats a date as DD/MM/YYYY HH:mm for invoice display (with time).
 * Uses local timezone to prevent UTC midnight-shift.
 */
export const formatDateTimeDDMMYYYY = (dateVal?: string | Date | null): string => {
  if (!dateVal) return '-';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

