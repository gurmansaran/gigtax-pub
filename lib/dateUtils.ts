/**
 * Shared date helpers: MM/DD/YYYY display/input with validation.
 * No invalid dates (e.g. 54th January, Feb 30).
 */

/** Days in month (1-12); year for Feb leap. */
function daysInMonth(month: number, year: number): number {
  if (month === 2) {
    return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

/** Format raw input to MM/DD/YYYY (digits only, max 8 digits). */
export function formatMMDDYYYY(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Parse MM/DD/YYYY to YYYY-MM-DD. Returns null if invalid.
 * Validates: month 1-12, day 1–last day of month, year 1900-2030.
 */
export function parseMMDDYYYYToISO(mmDdYyyy: string): string | null {
  const trimmed = mmDdYyyy.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const m = parseInt(match[1], 10);
  const d = parseInt(match[2], 10);
  const y = parseInt(match[3], 10);
  if (m < 1 || m > 12 || y < 1900 || y > 2030) return null;
  const maxDay = daysInMonth(m, y);
  if (d < 1 || d > maxDay) return null;
  const month = String(m).padStart(2, '0');
  const day = String(d).padStart(2, '0');
  return `${y}-${month}-${day}`;
}

/** Convert YYYY-MM-DD to MM/DD/YYYY for display. */
export function isoToMMDDYYYY(iso: string): string {
  const trimmed = iso.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return '';
  const [, y, m, d] = match;
  const mm = parseInt(m, 10);
  const dd = parseInt(d, 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return trimmed;
  return `${mm}/${dd}/${y}`;
}

/** True if date (ISO YYYY-MM-DD) is before Jan 2, 1961 (65+ for 2025). */
export function is65PlusFromISO(iso: string): boolean {
  return iso < '1961-01-02';
}

/** Whether string is valid MM/DD/YYYY (and parses to a real date). */
export function isValidMMDDYYYY(s: string): boolean {
  return parseMMDDYYYYToISO(s) !== null;
}
