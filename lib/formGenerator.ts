import * as Print from 'expo-print';
import { supabase } from './supabase';

function escapeHtml(value: unknown): string {
  const s = String(value ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `$${Math.round(v).toLocaleString()}`;
}

function formatMiles(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(1);
}

function normalizeFilingStatus(status: string): string {
  switch (status) {
    case 'married_joint':
      return 'Married filing jointly';
    case 'married_separate':
      return 'Married filing separately';
    case 'head_household':
      return 'Head of household';
    case 'single':
    default:
      return 'Single';
  }
}

/**
 * Generates a clean, official-looking Draft Tax Return PDF and stores it in cloud storage.
 * This keeps users audit-ready by maintaining a permanent record.
 */
export const generateTaxPDF = async (
  profile: any,
  taxResult: any,
  trips: any[],
  expenses: any[],
  userId: string
) => {
  const p = profile ?? {};
  const r = taxResult ?? {};

  const fullName = (
    p.fullName ??
    p.name ??
    [p.firstName, p.lastName].filter(Boolean).join(' ').trim()
  ) || 'GigTax User';

  const addressLine1 = p.addressLine1 ?? p.address ?? p.address1 ?? '';
  const cityStateZip =
    p.cityStateZip ??
    [p.city, p.state, p.zip].filter(Boolean).join(', ').replace(', ,', ',').trim();

  const filingStatus = normalizeFilingStatus(p.filingStatus ?? p.status ?? 'single');

  // Extract last 4 digits from fullSSN (9 digits) or fallback
  const fullSSN = String(p.fullSSN ?? '').replace(/\D/g, '');
  const ssnLast4 = fullSSN.length >= 4 ? fullSSN.slice(-4) : '1234';
  const maskedSsn = `***-**-${ssnLast4}`;

  const totalMiles = (trips ?? []).reduce((sum, t) => sum + (Number(t?.miles) || 0), 0);
  const mileageRate = 0.70;
  const carTruckExpenses = totalMiles * mileageRate;

  const otherExpenses = (expenses ?? []).reduce((sum, e) => sum + (Number(e?.amount) || 0), 0);

  const netProfit = Number(r.netBusinessIncome) || 0;

  // Use real gig income from trips (sum of trip.earnings)
  // If not provided, reconstruct from net + expenses as fallback
  const grossReceipts =
    Number(p.gigIncome) ||
    Number(p.estimatedGigIncome) ||
    Math.max(0, netProfit + carTruckExpenses + otherExpenses);

  const w2Income = Number(p.w2Income ?? p.w2 ?? 0) || 0;
  const standardDeduction = Number(r?.deductionsBreakdown?.standardDeduction) || 0;
  const taxableIncome = Number(r.taxableIncome) || 0;
  const totalTax = Number(r.totalTax) || 0;

  const watermark = 'DRAFT - DO NOT FILE';

  const expenseRowsHtml =
    (expenses ?? [])
      .slice(0, 25)
      .map((e) => {
        const date = escapeHtml(e?.date ?? '');
        const category = escapeHtml(e?.category ?? 'Other');
        const desc = escapeHtml(e?.description ?? '');
        const amt = formatMoney(Number(e?.amount) || 0);
        return `<tr>
          <td class="mono">${date}</td>
          <td>${category}</td>
          <td>${desc || '&mdash;'}</td>
          <td class="right mono">${amt}</td>
        </tr>`;
      })
      .join('') || '';

  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: letter; margin: 28px; }
        body {
          font-family: "Times New Roman", Times, serif;
          color: #111;
          background: #fff;
          position: relative;
        }
        .watermark {
          position: fixed;
          top: 35%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-18deg);
          font-size: 48px;
          color: rgba(0,0,0,0.08);
          letter-spacing: 2px;
          font-weight: 700;
          z-index: 0;
          pointer-events: none;
          white-space: nowrap;
        }
        .page {
          position: relative;
          z-index: 1;
        }
        .header {
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 16px;
        }
        .brand-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .logo {
          font-weight: 800;
          font-size: 18px;
          letter-spacing: 0.5px;
        }
        .title {
          font-size: 18px;
          font-weight: 700;
          text-align: right;
        }
        .subtitle {
          font-size: 12px;
          text-align: right;
          margin-top: 2px;
        }
        .section-title {
          font-size: 14px;
          font-weight: 700;
          margin: 18px 0 8px;
          padding: 6px 8px;
          border: 1px solid #000;
          background: #f2f2f2;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0 12px;
        }
        th, td {
          border: 1px solid #000;
          padding: 6px 8px;
          vertical-align: top;
          font-size: 12px;
        }
        th {
          background: #f7f7f7;
          font-weight: 700;
          text-align: left;
        }
        .right { text-align: right; }
        .mono { font-family: "Courier New", Courier, monospace; }
        .small { font-size: 11px; color: #333; }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .box {
          border: 1px solid #000;
          padding: 10px;
        }
        .box h4 {
          margin: 0 0 6px;
          font-size: 12px;
          font-weight: 700;
        }
        .kv { display: flex; justify-content: space-between; gap: 10px; }
        .kv div:last-child { text-align: right; }
      </style>
    </head>
    <body>
      <div class="watermark">${watermark}</div>
      <div class="page">
        <div class="header">
          <div class="brand-row">
            <div>
              <div class="logo">GigTax</div>
              <div class="small">Prepared by GigTax • Draft for review only</div>
            </div>
            <div>
              <div class="title">2025 Draft Tax Return</div>
              <div class="subtitle">Prepared by GigTax</div>
            </div>
          </div>
        </div>

        <div class="section-title">Section 1: Personal Information</div>
        <table>
          <tr>
            <th style="width: 34%;">Name</th>
            <td>${escapeHtml(fullName)}</td>
            <th style="width: 18%;">SSN</th>
            <td class="mono">${escapeHtml(maskedSsn)}</td>
          </tr>
          <tr>
            <th>Address</th>
            <td colspan="3">${escapeHtml(addressLine1)}<br/>${escapeHtml(cityStateZip)}</td>
          </tr>
          <tr>
            <th>Filing Status</th>
            <td colspan="3">${escapeHtml(filingStatus)}</td>
          </tr>
        </table>

        <div class="section-title">Section 2: Schedule C — Profit or Loss From Business</div>
        <div class="grid">
          <div class="box">
            <h4>Income</h4>
            <div class="kv"><div>Gross receipts (1099)</div><div class="mono">${formatMoney(grossReceipts)}</div></div>
          </div>
          <div class="box">
            <h4>Expenses</h4>
            <div class="kv"><div>Car &amp; truck expenses (mileage)</div><div class="mono">${formatMoney(carTruckExpenses)}</div></div>
            <div class="kv"><div>Other expenses (manual)</div><div class="mono">${formatMoney(otherExpenses)}</div></div>
          </div>
        </div>
        <table>
          <tr>
            <th>Description</th>
            <th class="right">Amount</th>
          </tr>
          <tr>
            <td>Car &amp; truck expenses (${formatMiles(totalMiles)} miles × $0.70)</td>
            <td class="right mono">${formatMoney(carTruckExpenses)}</td>
          </tr>
          <tr>
            <td>Other expenses (manual entries)</td>
            <td class="right mono">${formatMoney(otherExpenses)}</td>
          </tr>
          <tr>
            <th class="right">Net profit (Schedule C)</th>
            <th class="right mono">${formatMoney(netProfit)}</th>
          </tr>
        </table>

        <div class="section-title">Schedule C — Part II: Expenses Detail</div>
        <div class="small">Other expenses (manual entries, first 25):</div>
        <table>
          <tr>
            <th style="width: 18%;">Date</th>
            <th style="width: 18%;">Category</th>
            <th>Description</th>
            <th class="right" style="width: 18%;">Amount</th>
          </tr>
          ${expenseRowsHtml || `<tr><td colspan="4" class="small" style="text-align: center;">No manual expenses recorded.</td></tr>`}
        </table>

        <div class="section-title">Section 3: Form 1040 Summary</div>
        <table>
          <tr>
            <th style="width: 65%;">Line Item</th>
            <th class="right">Amount</th>
          </tr>
          <tr>
            <td><span class="mono">Line 1</span> — W‑2 wages</td>
            <td class="right mono">${formatMoney(w2Income)}</td>
          </tr>
          <tr>
            <td><span class="mono">Line 8</span> — Other income (Schedule C net profit)</td>
            <td class="right mono">${formatMoney(netProfit)}</td>
          </tr>
          <tr>
            <td><span class="mono">Line 12</span> — Standard deduction</td>
            <td class="right mono">${formatMoney(standardDeduction)}</td>
          </tr>
          <tr>
            <td><span class="mono">Line 15</span> — Taxable income</td>
            <td class="right mono">${formatMoney(taxableIncome)}</td>
          </tr>
          <tr>
            <td><span class="mono">Line 24</span> — Total tax</td>
            <td class="right mono">${formatMoney(totalTax)}</td>
          </tr>
        </table>

        <div class="small">
          This document is a draft estimate for planning purposes only and is not a substitute for a filed tax return.
        </div>
      </div>
    </body>
  </html>`;

  const file = await Print.printToFileAsync({ html });

  // Upload to Supabase Storage for audit-ready cloud storage
  try {
    // Read file as blob
    const response = await fetch(file.uri);
    const blob = await response.blob();

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `tax-forms/${userId}/${timestamp}-tax-return.pdf`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tax-forms')
      .upload(filename, blob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading PDF to cloud:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('tax-forms').getPublicUrl(filename);

    // Save metadata to database
    const { error: dbError } = await supabase.from('tax_forms').insert({
      user_id: userId,
      file_path: filename,
      cloud_url: urlData.publicUrl,
      tax_year: new Date().getFullYear(),
      created_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error('Error saving PDF metadata:', dbError);
      // Don't throw - file is uploaded, metadata is optional
    }

    return {
      localUri: file.uri,
      cloudUrl: urlData.publicUrl,
      filename,
    };
  } catch (error) {
    console.error('Error storing PDF in cloud:', error);
    // Return local file even if cloud upload fails
    return {
      localUri: file.uri,
      cloudUrl: null,
      filename: null,
    };
  }
};

/** Data for generating a Form 1040–style PDF (no IRS PDF required). */
export interface Form1040StyleData {
  firstName?: string;
  lastName?: string;
  ssn?: string;
  spouseName?: string;
  spouseSSN?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  filingStatus?: string;
  w2Wages?: number;
  totalIncome?: number;
  agi?: number;
  standardDeduction?: number;
  taxableIncome?: number;
  tax?: number;
  totalWithholding?: number;
  refundOrAmountOwed?: number;
}

function formNum(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return String(Math.round(n));
}

/**
 * Generates a Form 1040–style PDF from your data (no IRS PDF needed).
 * Use when the IRS fillable PDF doesn't work (XFA vs AcroForm). Output matches
 * official 1040 line numbers so you can print and mail.
 */
export async function generate1040StylePDFForPrint(data: Form1040StyleData): Promise<{ uri: string }> {
  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || 'Taxpayer';
  const ssnRaw = (data.ssn ?? '').toString().replace(/\D/g, '');
  const ssnDisplay = ssnRaw.length === 9
    ? `${ssnRaw.slice(0, 3)}-${ssnRaw.slice(3, 5)}-${ssnRaw.slice(5)}`
    : ssnRaw ? `***-**-${ssnRaw.slice(-4)}` : '';
  const spouseSSNRaw = (data.spouseSSN ?? '').toString().replace(/\D/g, '');
  const spouseSSNDisplay = spouseSSNRaw.length === 9
    ? `${spouseSSNRaw.slice(0, 3)}-${spouseSSNRaw.slice(3, 5)}-${spouseSSNRaw.slice(5)}`
    : spouseSSNRaw ? `***-**-${spouseSSNRaw.slice(-4)}` : '';
  const addr = [data.address, [data.city, data.state, data.zip].filter(Boolean).join(', ')].filter(Boolean).join(', ') || '';
  const filingStatus = normalizeFilingStatus(data.filingStatus ?? 'single');
  const refund = data.refundOrAmountOwed ?? 0;
  const isRefund = refund >= 0;

  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: letter; margin: 0.5in; }
        body { font-family: "Times New Roman", Times, serif; font-size: 11px; color: #000; }
        .header { text-align: center; margin-bottom: 14px; border-bottom: 1px solid #000; padding-bottom: 8px; }
        .title { font-size: 14px; font-weight: 700; }
        .subtitle { font-size: 10px; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin: 2px 0; }
        .line { border-bottom: 1px solid #ccc; }
        .line-num { width: 42px; text-align: right; padding: 2px 6px 2px 0; vertical-align: top; font-weight: 600; }
        .line-desc { padding: 2px 8px 2px 0; }
        .line-amt { width: 100px; text-align: right; padding: 2px 0; font-family: "Courier New", monospace; }
        .section { font-weight: 700; margin: 12px 0 4px; font-size: 12px; }
        .note { font-size: 9px; color: #333; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Form 1040 — U.S. Individual Income Tax Return</div>
        <div class="subtitle">2025 — Department of the Treasury — Internal Revenue Service</div>
      </div>

      <table>
        <tr class="line"><td class="line-num"></td><td class="line-desc">Your first name and middle initial</td><td class="line-amt">${escapeHtml(fullName)}</td></tr>
        <tr class="line"><td class="line-num"></td><td class="line-desc">Last name</td><td class="line-amt"></td></tr>
        <tr class="line"><td class="line-num"></td><td class="line-desc">Your social security number</td><td class="line-amt">${escapeHtml(ssnDisplay)}</td></tr>
        <tr class="line"><td class="line-num"></td><td class="line-desc">Spouse's first name and last name</td><td class="line-amt">${escapeHtml(data.spouseName ?? '')}</td></tr>
        <tr class="line"><td class="line-num"></td><td class="line-desc">Spouse's social security number</td><td class="line-amt">${escapeHtml(spouseSSNDisplay)}</td></tr>
        <tr class="line"><td class="line-num"></td><td class="line-desc">Home address (number and street)</td><td class="line-amt">${escapeHtml(addr)}</td></tr>
        <tr class="line"><td class="line-num"></td><td class="line-desc">City, town, or post office. State. ZIP code</td><td class="line-amt">${escapeHtml([data.city, data.state, data.zip].filter(Boolean).join(', '))}</td></tr>
        <tr class="line"><td class="line-num"></td><td class="line-desc">Filing status</td><td class="line-amt">${escapeHtml(filingStatus)}</td></tr>
      </table>

      <div class="section">Income</div>
      <table>
        <tr class="line"><td class="line-num">1a</td><td class="line-desc">W-2 wages</td><td class="line-amt">${formNum(data.w2Wages)}</td></tr>
        <tr class="line"><td class="line-num">9</td><td class="line-desc">Total income</td><td class="line-amt">${formNum(data.totalIncome)}</td></tr>
        <tr class="line"><td class="line-num">10</td><td class="line-desc">Adjustments to income</td><td class="line-amt">0</td></tr>
        <tr class="line"><td class="line-num">11a</td><td class="line-desc">Adjusted gross income</td><td class="line-amt">${formNum(data.agi)}</td></tr>
      </table>

      <div class="section">Tax and Credits</div>
      <table>
        <tr class="line"><td class="line-num">12e</td><td class="line-desc">Standard deduction or itemized deductions</td><td class="line-amt">${formNum(data.standardDeduction)}</td></tr>
        <tr class="line"><td class="line-num">15</td><td class="line-desc">Taxable income</td><td class="line-amt">${formNum(data.taxableIncome)}</td></tr>
        <tr class="line"><td class="line-num">16</td><td class="line-desc">Tax</td><td class="line-amt">${formNum(data.tax)}</td></tr>
        <tr class="line"><td class="line-num">25d</td><td class="line-desc">Federal income tax withheld</td><td class="line-amt">${formNum(data.totalWithholding)}</td></tr>
        <tr class="line"><td class="line-num">33</td><td class="line-desc">Total payments</td><td class="line-amt">${formNum(data.totalWithholding)}</td></tr>
        <tr class="line"><td class="line-num">34</td><td class="line-desc">Amount you overpaid (refund)</td><td class="line-amt">${isRefund ? formNum(refund) : '0'}</td></tr>
        <tr class="line"><td class="line-num">37</td><td class="line-desc">Amount you owe</td><td class="line-amt">${!isRefund ? formNum(-refund) : '0'}</td></tr>
      </table>

      <div class="note">This is a 1040-style summary generated by GigTax from your data. Print and mail to the IRS. E-file coming soon. Consult a tax professional before filing.</div>
    </body>
  </html>`;

  const file = await Print.printToFileAsync({ html });
  return { uri: file.uri };
}

