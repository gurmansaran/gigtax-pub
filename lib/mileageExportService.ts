/**
 * Mileage Export Service
 * Generates IRS-compliant mileage logs in PDF and CSV formats
 */

import { printToFileAsync } from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { getTrips, type Trip } from './tripStore';

// ============================================================================
// TYPES
// ============================================================================

export interface MileageExportOptions {
  format: 'pdf' | 'csv';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface MileageExportResult {
  filePath: string;
  fileName: string;
  totalMiles: number;
  totalTrips: number;
  totalHours: number;
  deductionAmount: number;
}

export interface MileageLogEntry {
  date: string;
  startTime: string;
  endTime: string;
  duration: string;
  miles: number;
  businessPurpose: string;
  startLocation: string;
  endLocation: string;
}

// ============================================================================
// IRS RATES
// ============================================================================

const IRS_MILEAGE_RATES: Record<number, number> = {
  2024: 0.67,
  2025: 0.70,
  2026: 0.70, // Placeholder until IRS publishes 2026 rate
};

export function getIRSMileageRate(year: number): number {
  return IRS_MILEAGE_RATES[year] || 0.70;
}

// ============================================================================
// BUSINESS PURPOSE OPTIONS
// ============================================================================

export const BUSINESS_PURPOSE_OPTIONS = [
  'Rideshare driving',
  'Food delivery',
  'Package delivery',
  'Grocery delivery',
  'Between gig pickups',
  'Supply run',
  'Gig driving',
];

// ============================================================================
// PREPARE LOG ENTRIES
// ============================================================================

function formatLocation(lat?: number, lng?: number): string {
  if (lat !== undefined && lng !== undefined) {
    return 'GPS tracked';
  }
  return 'N/A';
}

export function prepareMileageLog(
  trips: Trip[],
  options: MileageExportOptions
): MileageLogEntry[] {
  const start = new Date(options.startDate);
  const end = new Date(options.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return trips
    .filter((trip) => {
      const tripDate = new Date(trip.date);
      return tripDate >= start && tripDate <= end && trip.miles > 0;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((trip) => ({
      date: formatDateForDisplay(trip.date),
      startTime: trip.startTime || 'N/A',
      endTime: trip.endTime || 'N/A',
      duration: trip.duration || 'N/A',
      miles: trip.miles,
      businessPurpose: trip.businessPurpose || 'Gig driving',
      startLocation: formatLocation(trip.startLat, trip.startLng),
      endLocation: formatLocation(trip.endLat, trip.endLng),
    }));
}

function formatDateForDisplay(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function parseDurationToHours(duration: string): number {
  if (!duration || duration === 'N/A') return 0;
  const parts = duration.split(':');
  if (parts.length === 3) {
    return (parseInt(parts[0]) || 0) + (parseInt(parts[1]) || 0) / 60 + (parseInt(parts[2]) || 0) / 3600;
  }
  if (parts.length === 2) {
    return (parseInt(parts[0]) || 0) + (parseInt(parts[1]) || 0) / 60;
  }
  return 0;
}

// ============================================================================
// CSV EXPORT
// ============================================================================

export async function exportMileageCSV(
  options: MileageExportOptions,
  userName?: string
): Promise<MileageExportResult> {
  const trips = await getTrips();
  const entries = prepareMileageLog(trips, options);

  const year = new Date(options.startDate).getFullYear();
  const rate = getIRSMileageRate(year);
  const totalMiles = entries.reduce((sum, e) => sum + e.miles, 0);
  const totalHours = trips
    .filter((t) => {
      const d = new Date(t.date);
      return d >= new Date(options.startDate) && d <= new Date(options.endDate);
    })
    .reduce((sum, t) => sum + parseDurationToHours(t.duration), 0);
  const deductionAmount = totalMiles * rate;

  const lines: string[] = [];
  lines.push(`GigTax Mileage Log`);
  if (userName) lines.push(`Driver: ${userName}`);
  lines.push(`Tax Year: ${year}`);
  lines.push(`IRS Standard Mileage Rate: $${rate.toFixed(2)}/mile`);
  lines.push(`Date Range: ${formatDateForDisplay(options.startDate)} - ${formatDateForDisplay(options.endDate)}`);
  lines.push('');
  lines.push('Date,Start Time,End Time,Duration,Miles,Business Purpose,Start Location,End Location');

  for (const entry of entries) {
    const purpose = entry.businessPurpose.replace(/,/g, ';');
    lines.push(
      `${entry.date},${entry.startTime},${entry.endTime},${entry.duration},${entry.miles.toFixed(1)},${purpose},${entry.startLocation},${entry.endLocation}`
    );
  }

  lines.push('');
  lines.push(`Total Miles: ${totalMiles.toFixed(1)}`);
  lines.push(`Total Deduction (x $${rate.toFixed(2)}): $${deductionAmount.toFixed(2)}`);

  const csvContent = lines.join('\n');
  const fileName = `GigTax_Mileage_Log_${year}.csv`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csvContent);

  return {
    filePath,
    fileName,
    totalMiles,
    totalTrips: entries.length,
    totalHours,
    deductionAmount,
  };
}

// ============================================================================
// PDF EXPORT
// ============================================================================

export async function exportMileagePDF(
  options: MileageExportOptions,
  userName?: string,
  userAddress?: string
): Promise<MileageExportResult> {
  const trips = await getTrips();
  const entries = prepareMileageLog(trips, options);

  const year = new Date(options.startDate).getFullYear();
  const rate = getIRSMileageRate(year);
  const totalMiles = entries.reduce((sum, e) => sum + e.miles, 0);
  const totalHours = trips
    .filter((t) => {
      const d = new Date(t.date);
      return d >= new Date(options.startDate) && d <= new Date(options.endDate);
    })
    .reduce((sum, t) => sum + parseDurationToHours(t.duration), 0);
  const deductionAmount = totalMiles * rate;

  const tableRows = entries
    .map(
      (e) => `
      <tr>
        <td>${e.date}</td>
        <td>${e.startTime}</td>
        <td>${e.endTime}</td>
        <td>${e.duration}</td>
        <td class="num">${e.miles.toFixed(1)}</td>
        <td>${e.businessPurpose}</td>
        <td>${e.startLocation}</td>
        <td>${e.endLocation}</td>
      </tr>`
    )
    .join('');

  const html = `
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, system-ui, 'Helvetica Neue', sans-serif; padding: 40px; color: #111; font-size: 11px; }
        h1 { text-align: center; font-size: 22px; margin-bottom: 4px; }
        h2 { text-align: center; font-size: 13px; color: #666; margin-bottom: 20px; font-weight: 400; }
        .info { margin-bottom: 20px; }
        .info-row { display: flex; margin-bottom: 4px; }
        .info-label { font-weight: 600; width: 160px; }
        .info-value { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f5f5f5; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 600; border-bottom: 2px solid #ddd; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
        tr:nth-child(even) { background: #fafafa; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .summary { margin-top: 16px; padding: 16px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .summary-label { font-weight: 600; }
        .summary-value { font-weight: 700; font-variant-numeric: tabular-nums; }
        .highlight { color: #2d7d2d; font-size: 16px; }
        .footer { margin-top: 24px; font-size: 9px; color: #999; text-align: center; line-height: 1.5; }
        .disclaimer { margin-top: 16px; padding: 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 9px; color: #666; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>Mileage Log</h1>
      <h2>Tax Year ${year} &mdash; Generated by GigTax</h2>

      <div class="info">
        ${userName ? `<div class="info-row"><span class="info-label">Driver:</span><span class="info-value">${escapeHtml(userName)}</span></div>` : ''}
        ${userAddress ? `<div class="info-row"><span class="info-label">Address:</span><span class="info-value">${escapeHtml(userAddress)}</span></div>` : ''}
        <div class="info-row"><span class="info-label">Date Range:</span><span class="info-value">${formatDateForDisplay(options.startDate)} &ndash; ${formatDateForDisplay(options.endDate)}</span></div>
        <div class="info-row"><span class="info-label">IRS Standard Mileage Rate:</span><span class="info-value">$${rate.toFixed(2)} per mile</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Start</th>
            <th>End</th>
            <th>Duration</th>
            <th style="text-align:right">Miles</th>
            <th>Business Purpose</th>
            <th>From</th>
            <th>To</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr style="font-weight:700; border-top:2px solid #333;">
            <td colspan="4" style="text-align:right; padding-top:10px;">TOTALS</td>
            <td class="num" style="padding-top:10px;">${totalMiles.toFixed(1)}</td>
            <td colspan="3" style="padding-top:10px;">${entries.length} trips</td>
          </tr>
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-row">
          <span class="summary-label">Total Business Miles:</span>
          <span class="summary-value">${totalMiles.toFixed(1)} miles</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total Driving Hours:</span>
          <span class="summary-value">${totalHours.toFixed(1)} hours</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">IRS Standard Mileage Rate (${year}):</span>
          <span class="summary-value">$${rate.toFixed(2)}/mile</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Estimated Mileage Deduction:</span>
          <span class="summary-value highlight">$${deductionAmount.toFixed(2)}</span>
        </div>
      </div>

      <div class="disclaimer">
        <strong>IRS Compliance Notice:</strong> This mileage log is maintained per IRS Publication 463 requirements
        for business vehicle expenses. The standard mileage rate is used to calculate deductions. Retain this log
        with your tax records. Consult a tax professional for guidance specific to your situation.
      </div>

      <div class="footer">
        Generated by GigTax on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        &bull; This document is for record-keeping purposes.
      </div>
    </body>
    </html>
  `;

  const { uri } = await printToFileAsync({ html });
  const fileName = `GigTax_Mileage_Log_${year}.pdf`;

  return {
    filePath: uri,
    fileName,
    totalMiles,
    totalTrips: entries.length,
    totalHours,
    deductionAmount,
  };
}

/**
 * Share the exported file
 */
export async function shareMileageExport(result: MileageExportResult, format: 'pdf' | 'csv'): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device. The file was saved to: ' + result.filePath);
  }
  await Sharing.shareAsync(result.filePath, {
    mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
    dialogTitle: 'Save Mileage Log',
    UTI: format === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
  });
}

/**
 * Get a quick preview of the export stats without generating the file
 */
export async function getExportPreview(
  startDate: string,
  endDate: string
): Promise<{ totalTrips: number; totalMiles: number; deduction: number; totalHours: number }> {
  const trips = await getTrips();
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const filtered = trips.filter((t) => {
    const d = new Date(t.date);
    return d >= start && d <= end && t.miles > 0;
  });

  const totalMiles = filtered.reduce((sum, t) => sum + (t.miles || 0), 0);
  const totalHours = filtered.reduce((sum, t) => sum + parseDurationToHours(t.duration), 0);
  const year = start.getFullYear();
  const rate = getIRSMileageRate(year);

  return {
    totalTrips: filtered.length,
    totalMiles,
    deduction: totalMiles * rate,
    totalHours,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
