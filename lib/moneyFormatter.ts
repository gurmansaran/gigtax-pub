/**
 * Money formatting utilities for tax forms
 */

/**
 * Format a number as currency with commas (e.g., 10000 -> "10,000")
 */
export function formatMoneyInput(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(num) || num === 0) return '';
  return Math.round(num).toLocaleString('en-US');
}

/**
 * Parse a formatted money string back to a number (removes commas)
 */
export function parseMoneyInput(formatted: string): number {
  const cleaned = formatted.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Format EIN: XX-XXXXXXX
 */
export function formatEIN(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2, 9)}`;
}
