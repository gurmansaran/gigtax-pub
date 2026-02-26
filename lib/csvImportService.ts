/**
 * CSV Import Service
 * Parses and imports earnings CSV files from Uber, Lyft, DoorDash
 */

import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export type GigPlatform =
  | 'uber'
  | 'lyft'
  | 'doordash'
  | 'instacart'
  | 'amazonflex'
  | 'grubhub'
  | 'other';

export interface ParsedEarningsRecord {
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  platform: GigPlatform;
}

export interface CSVImportResult {
  platform: GigPlatform;
  records: ParsedEarningsRecord[];
  totalAmount: number;
  dateRange: { start: string; end: string };
  skippedRows: number;
  errors: string[];
}

export interface ImportSaveResult {
  saved: number;
  duplicates: number;
}

// ============================================================================
// PLATFORM DISPLAY HELPERS
// ============================================================================

export const PLATFORM_LABELS: Record<GigPlatform, string> = {
  uber: 'Uber',
  lyft: 'Lyft',
  doordash: 'DoorDash',
  instacart: 'Instacart',
  amazonflex: 'Amazon Flex',
  grubhub: 'Grubhub',
  other: 'Other',
};

export const PLATFORM_COLORS: Record<GigPlatform, string> = {
  uber: '#000000',
  lyft: '#FF00BF',
  doordash: '#FF3008',
  instacart: '#43B02A',
  amazonflex: '#FF9900',
  grubhub: '#F63440',
  other: '#8E8E93',
};

// ============================================================================
// CSV PARSING
// ============================================================================

/**
 * Parse CSV text into a 2D array of strings.
 * Handles quoted fields, commas within quotes, escaped quotes (""),
 * and both CRLF and LF line endings.
 */
export function parseCSVText(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < csvText.length && csvText[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      currentField += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
      } else if (char === '\r') {
        // Handle CRLF
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        if (i < csvText.length && csvText[i] === '\n') i++;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Handle last field/row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Detect the gig platform from CSV header row.
 */
export function detectPlatform(headerRow: string[]): GigPlatform | null {
  const headerLower = headerRow.map((h) => h.toLowerCase());
  const headerJoined = headerLower.join(' ');

  // Uber: look for "driver uuid", "trip or order uuid", "fare"
  if (
    headerJoined.includes('driver uuid') ||
    headerJoined.includes('trip or order uuid') ||
    (headerJoined.includes('fare') && headerJoined.includes('trip'))
  ) {
    return 'uber';
  }

  // Lyft: look for "ride type", "ride id", "ride earnings"
  if (
    headerJoined.includes('ride type') ||
    headerJoined.includes('ride id') ||
    headerJoined.includes('ride earnings')
  ) {
    return 'lyft';
  }

  // DoorDash: look for "delivery id", "dash", "doordash pay"
  if (
    headerJoined.includes('delivery id') ||
    headerJoined.includes('doordash pay') ||
    (headerJoined.includes('dash') && headerJoined.includes('pay'))
  ) {
    return 'doordash';
  }

  // Instacart
  if (headerJoined.includes('batch') && headerJoined.includes('instacart')) {
    return 'instacart';
  }

  // Grubhub
  if (headerJoined.includes('grubhub') || headerJoined.includes('delivery offer')) {
    return 'grubhub';
  }

  return null;
}

// ============================================================================
// DATE PARSING
// ============================================================================

/**
 * Normalize a date string into YYYY-MM-DD format.
 * Supports: MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD, MM-DD-YYYY, M/D/YY
 */
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleaned)) {
    const [y, m, d] = cleaned.split('-').map(Number);
    if (isValidDate(y, m, d)) return formatDate(y, m, d);
  }

  // MM/DD/YYYY or M/D/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
    const [m, d, y] = cleaned.split('/').map(Number);
    if (isValidDate(y, m, d)) return formatDate(y, m, d);
  }

  // MM-DD-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleaned)) {
    const [m, d, y] = cleaned.split('-').map(Number);
    if (isValidDate(y, m, d)) return formatDate(y, m, d);
  }

  // M/D/YY
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(cleaned)) {
    const parts = cleaned.split('/').map(Number);
    const y = parts[2] + 2000;
    if (isValidDate(y, parts[0], parts[1])) return formatDate(y, parts[0], parts[1]);
  }

  // Try native Date parse as last resort
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return formatDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return null;
}

function isValidDate(y: number, m: number, d: number): boolean {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ============================================================================
// AMOUNT PARSING
// ============================================================================

function parseAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  // Remove $, commas, spaces
  const cleaned = amountStr.replace(/[$,\s]/g, '');
  // Handle parenthetical negatives: (123.45) -> -123.45
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    const num = parseFloat(cleaned.slice(1, -1));
    return isNaN(num) ? null : -num;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ============================================================================
// COLUMN FINDER HELPERS
// ============================================================================

function findColumnIndex(headers: string[], candidates: string[]): number {
  const headersLower = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = headersLower.indexOf(candidate.toLowerCase());
    if (idx !== -1) return idx;
  }
  // Partial match
  for (const candidate of candidates) {
    const idx = headersLower.findIndex((h) => h.includes(candidate.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ============================================================================
// PLATFORM-SPECIFIC PARSERS
// ============================================================================

function parseUberCSV(rows: string[][]): { records: ParsedEarningsRecord[]; skipped: number } {
  if (rows.length < 2) return { records: [], skipped: 0 };

  const headers = rows[0];
  const dateCol = findColumnIndex(headers, ['Date', 'Trip Date', 'Request Date', 'Date/Time']);
  const totalCol = findColumnIndex(headers, ['Total', 'Driver Total', 'Your Earnings', 'Amount']);
  const fareCol = findColumnIndex(headers, ['Fare', 'Trip Fare']);
  const tipsCol = findColumnIndex(headers, ['Tips', 'Tip']);
  const tripIdCol = findColumnIndex(headers, ['Trip', 'Trip ID', 'Trip or Order UUID']);

  // Use total if available, otherwise sum fare + tips
  const amountCol = totalCol !== -1 ? totalCol : -1;

  if (dateCol === -1 || (amountCol === -1 && fareCol === -1)) {
    return { records: [], skipped: rows.length - 1 };
  }

  const records: ParsedEarningsRecord[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(dateCol, amountCol, fareCol)) {
      skipped++;
      continue;
    }

    const date = normalizeDate(row[dateCol]);
    let amount: number | null;

    if (amountCol !== -1) {
      amount = parseAmount(row[amountCol]);
    } else {
      const fare = parseAmount(row[fareCol]) || 0;
      const tips = tipsCol !== -1 ? parseAmount(row[tipsCol]) || 0 : 0;
      amount = fare + tips;
    }

    if (!date || amount === null || amount <= 0) {
      skipped++;
      continue;
    }

    const tripId = tripIdCol !== -1 ? row[tripIdCol]?.trim() : '';
    records.push({
      amount,
      date,
      description: tripId ? `Uber Trip ${tripId}` : 'Uber Trip',
      platform: 'uber',
    });
  }

  return { records, skipped };
}

function parseLyftCSV(rows: string[][]): { records: ParsedEarningsRecord[]; skipped: number } {
  if (rows.length < 2) return { records: [], skipped: 0 };

  const headers = rows[0];
  const dateCol = findColumnIndex(headers, ['Date', 'Pickup Time', 'Ride Date']);
  const totalCol = findColumnIndex(headers, ['Total', 'Ride Earnings', 'Total Earnings', 'Amount']);
  const tipsCol = findColumnIndex(headers, ['Tips', 'Tip']);
  const rideIdCol = findColumnIndex(headers, ['Ride ID', 'Ride']);

  if (dateCol === -1 || totalCol === -1) {
    return { records: [], skipped: rows.length - 1 };
  }

  const records: ParsedEarningsRecord[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(dateCol, totalCol)) {
      skipped++;
      continue;
    }

    const date = normalizeDate(row[dateCol]);
    const amount = parseAmount(row[totalCol]);

    if (!date || amount === null || amount <= 0) {
      skipped++;
      continue;
    }

    const rideId = rideIdCol !== -1 ? row[rideIdCol]?.trim() : '';
    records.push({
      amount,
      date,
      description: rideId ? `Lyft Ride ${rideId}` : 'Lyft Ride',
      platform: 'lyft',
    });
  }

  return { records, skipped };
}

function parseDoorDashCSV(rows: string[][]): { records: ParsedEarningsRecord[]; skipped: number } {
  if (rows.length < 2) return { records: [], skipped: 0 };

  const headers = rows[0];
  const dateCol = findColumnIndex(headers, ['Date', 'Delivery Date', 'Order Date']);
  const totalCol = findColumnIndex(headers, ['Total', 'Total Pay', 'Total Earnings', 'Amount']);
  const basePayCol = findColumnIndex(headers, ['Base Pay', 'DoorDash Pay']);
  const tipsCol = findColumnIndex(headers, ['Tips', 'Tip', 'Customer Tip']);
  const orderIdCol = findColumnIndex(headers, ['Order ID', 'Delivery ID']);

  const amountCol = totalCol !== -1 ? totalCol : -1;

  if (dateCol === -1 || (amountCol === -1 && basePayCol === -1)) {
    return { records: [], skipped: rows.length - 1 };
  }

  const records: ParsedEarningsRecord[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(dateCol, amountCol, basePayCol)) {
      skipped++;
      continue;
    }

    const date = normalizeDate(row[dateCol]);
    let amount: number | null;

    if (amountCol !== -1) {
      amount = parseAmount(row[amountCol]);
    } else {
      const base = parseAmount(row[basePayCol]) || 0;
      const tips = tipsCol !== -1 ? parseAmount(row[tipsCol]) || 0 : 0;
      amount = base + tips;
    }

    if (!date || amount === null || amount <= 0) {
      skipped++;
      continue;
    }

    const orderId = orderIdCol !== -1 ? row[orderIdCol]?.trim() : '';
    records.push({
      amount,
      date,
      description: orderId ? `DoorDash Order ${orderId}` : 'DoorDash Delivery',
      platform: 'doordash',
    });
  }

  return { records, skipped };
}

function parseGenericCSV(
  rows: string[][],
  platform: GigPlatform
): { records: ParsedEarningsRecord[]; skipped: number } {
  if (rows.length < 2) return { records: [], skipped: 0 };

  const headers = rows[0];
  const dateCol = findColumnIndex(headers, ['Date', 'date', 'Transaction Date']);
  const amountCol = findColumnIndex(headers, [
    'Total',
    'Amount',
    'Earnings',
    'Total Pay',
    'total',
    'amount',
    'earnings',
  ]);

  if (dateCol === -1 || amountCol === -1) {
    return { records: [], skipped: rows.length - 1 };
  }

  const records: ParsedEarningsRecord[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(dateCol, amountCol)) {
      skipped++;
      continue;
    }

    const date = normalizeDate(row[dateCol]);
    const amount = parseAmount(row[amountCol]);

    if (!date || amount === null || amount <= 0) {
      skipped++;
      continue;
    }

    const label = PLATFORM_LABELS[platform] || 'Earnings';
    records.push({
      amount,
      date,
      description: `${label} - CSV Import`,
      platform,
    });
  }

  return { records, skipped };
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

/**
 * Read and parse a CSV file from a URI.
 * Optionally provide a platform hint; auto-detects if not given.
 */
export async function importCSVFile(
  fileUri: string,
  platformHint?: GigPlatform
): Promise<CSVImportResult> {
  const errors: string[] = [];

  // Read file
  let csvText: string;
  try {
    csvText = await FileSystem.readAsStringAsync(fileUri);
  } catch (err) {
    return {
      platform: platformHint || 'other',
      records: [],
      totalAmount: 0,
      dateRange: { start: '', end: '' },
      skippedRows: 0,
      errors: ['Could not read file. Make sure it is a valid CSV file.'],
    };
  }

  if (!csvText.trim()) {
    return {
      platform: platformHint || 'other',
      records: [],
      totalAmount: 0,
      dateRange: { start: '', end: '' },
      skippedRows: 0,
      errors: ['File is empty.'],
    };
  }

  // Parse CSV
  const rows = parseCSVText(csvText);
  if (rows.length < 2) {
    return {
      platform: platformHint || 'other',
      records: [],
      totalAmount: 0,
      dateRange: { start: '', end: '' },
      skippedRows: 0,
      errors: ['File contains no data rows.'],
    };
  }

  // Detect or use hint
  const detected = detectPlatform(rows[0]);
  const platform = platformHint || detected || 'other';

  if (!detected && !platformHint) {
    errors.push('Could not auto-detect platform. Using generic parser.');
  }

  // Parse based on platform
  let result: { records: ParsedEarningsRecord[]; skipped: number };

  switch (platform) {
    case 'uber':
      result = parseUberCSV(rows);
      break;
    case 'lyft':
      result = parseLyftCSV(rows);
      break;
    case 'doordash':
      result = parseDoorDashCSV(rows);
      break;
    default:
      result = parseGenericCSV(rows, platform);
      break;
  }

  // Validate date range (warn if dates are more than 2 years old)
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const oldRecords = result.records.filter((r) => new Date(r.date) < twoYearsAgo);
  if (oldRecords.length > 0) {
    errors.push(`${oldRecords.length} records are more than 2 years old.`);
  }

  // Calculate totals
  const totalAmount = result.records.reduce((sum, r) => sum + r.amount, 0);
  const dates = result.records.map((r) => r.date).sort();
  const dateRange = {
    start: dates[0] || '',
    end: dates[dates.length - 1] || '',
  };

  return {
    platform,
    records: result.records,
    totalAmount,
    dateRange,
    skippedRows: result.skipped,
    errors,
  };
}

// ============================================================================
// SAVE TO SUPABASE
// ============================================================================

/**
 * Save parsed records to Supabase, skipping duplicates.
 * Inserts in batches of 50.
 */
export async function saveImportedRecords(
  userId: string,
  records: ParsedEarningsRecord[]
): Promise<ImportSaveResult> {
  if (records.length === 0) return { saved: 0, duplicates: 0 };

  let saved = 0;
  let duplicates = 0;

  // Get existing records for duplicate detection
  const dates = [...new Set(records.map((r) => r.date))];
  const { data: existing } = await supabase
    .from('user_income')
    .select('amount, date, platform')
    .eq('user_id', userId)
    .in('date', dates);

  const existingSet = new Set(
    (existing || []).map((e) => `${e.date}_${e.amount}_${e.platform || ''}`)
  );

  // Filter out duplicates
  const newRecords = records.filter((r) => {
    const key = `${r.date}_${r.amount}_${r.platform}`;
    if (existingSet.has(key)) {
      duplicates++;
      return false;
    }
    return true;
  });

  // Insert in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
    const batch = newRecords.slice(i, i + BATCH_SIZE).map((r) => ({
      user_id: userId,
      amount: r.amount,
      date: r.date,
      source: 'csv' as const,
      description: r.description,
      platform: r.platform,
      status: 'verified',
    }));

    const { error } = await supabase.from('user_income').insert(batch);
    if (error) {
      console.error('Error inserting CSV batch:', error);
      // Continue with other batches
    } else {
      saved += batch.length;
    }
  }

  return { saved, duplicates };
}

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================

/**
 * Export earnings data to CSV format.
 */
export async function exportEarningsCSV(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_income')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (error || !data || data.length === 0) return null;

    const header = 'Date,Platform,Amount,Source,Description';
    const rows = data.map((r) => {
      const platform = r.platform || 'Unknown';
      const desc = (r.description || '').replace(/,/g, ';').replace(/"/g, '""');
      return `${r.date},${platform},$${r.amount},${r.source},"${desc}"`;
    });

    return [header, ...rows].join('\n');
  } catch (err) {
    console.error('Error exporting earnings CSV:', err);
    return null;
  }
}

/**
 * Map a description or source string to a GigPlatform.
 * Useful for mapping screenshot analysis results to a platform.
 */
export function mapDescriptionToPlatform(description: string): GigPlatform | null {
  if (!description) return null;
  const lower = description.toLowerCase();

  if (lower.includes('uber')) return 'uber';
  if (lower.includes('lyft')) return 'lyft';
  if (lower.includes('doordash') || lower.includes('door dash')) return 'doordash';
  if (lower.includes('instacart')) return 'instacart';
  if (lower.includes('amazon flex') || lower.includes('amazonflex')) return 'amazonflex';
  if (lower.includes('grubhub')) return 'grubhub';

  return null;
}
