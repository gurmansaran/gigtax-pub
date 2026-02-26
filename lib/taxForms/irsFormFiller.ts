/**
 * IRS Form Filler — Fills the real IRS Accessible Form 1040 PDF
 *
 * Uses pdf-lib to load the official IRS AcroForm PDF, fill text fields
 * and checkboxes with the user's tax data, flatten, and return as bytes.
 *
 * This produces the ACTUAL IRS form that a user can print, sign, and mail.
 * Schedules (C, SE, 1, 2, 3, A) continue to use the replica renderer
 * since the IRS does not publish accessible AcroForm versions for those.
 */

import { PDFDocument } from 'pdf-lib';
import { loadPdfAsBase64 } from '../formLoader';
import { F1040_TEXT, F1040_CHECKBOX } from './f1040AcroFields';
import { formNum, formatSSN } from './types';
import type { TaxFormInput } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Split SSN into 3-2-4 parts */
function splitSSN(ssn: string): { p1: string; p2: string; p3: string } {
  const digits = (ssn ?? '').replace(/\D/g, '');
  if (digits.length !== 9) return { p1: '', p2: '', p3: '' };
  return {
    p1: digits.slice(0, 3),
    p2: digits.slice(3, 5),
    p3: digits.slice(5),
  };
}

// ─── Main Filler ────────────────────────────────────────────────────────────

/**
 * Fill the official IRS Form 1040 (Accessible AcroForm PDF) with user data.
 * Returns the filled, flattened PDF as a Uint8Array.
 */
export async function fillIRS1040(input: TaxFormInput): Promise<Uint8Array> {
  const { taxReturn: d, result: r, profile: p } = input;

  // Load the bundled IRS Form 1040 PDF
  const base64 = await loadPdfAsBase64('f1040');
  const pdfBytes = base64ToUint8Array(base64);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  // ── Helper to safely set text fields ────────────────────────────────────
  const setText = (fieldName: string, value: string | undefined | null) => {
    if (!value && value !== '0') return;
    try {
      const field = form.getTextField(fieldName);
      field.setText(String(value));
    } catch (e) {
      // Field not found — skip silently
      console.warn(`1040 field not found: ${fieldName}`);
    }
  };

  const setNum = (fieldName: string, value: number | undefined | null) => {
    setText(fieldName, formNum(value));
  };

  const setCheck = (fieldName: string, checked: boolean) => {
    if (!checked) return;
    try {
      form.getCheckBox(fieldName).check();
    } catch (e) {
      console.warn(`1040 checkbox not found: ${fieldName}`);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 1 — TAXPAYER INFORMATION
  // ═════════════════════════════════════════════════════════════════════════

  // Name
  setText(F1040_TEXT.firstName, p.firstName);
  setText(F1040_TEXT.lastName, p.lastName);

  // Primary SSN
  const ssn = splitSSN(p.ssn);
  setText(F1040_TEXT.primarySSN_1, ssn.p1);
  setText(F1040_TEXT.primarySSN_2, ssn.p2);
  setText(F1040_TEXT.primarySSN_3, ssn.p3);

  // Spouse info (if married filing jointly)
  if (d.filingStatus === 'married_joint' && p.spouseName) {
    const spouseNames = p.spouseName.split(' ');
    setText(F1040_TEXT.spouseFirstName, spouseNames[0] || '');
    if (spouseNames.length > 1) {
      setText(F1040_TEXT.spouseLastName, spouseNames[spouseNames.length - 1]);
    }
    if (p.spouseSSN) {
      const sssn = splitSSN(p.spouseSSN);
      setText(F1040_TEXT.spouseSSN_1, sssn.p1);
      setText(F1040_TEXT.spouseSSN_2, sssn.p2);
      setText(F1040_TEXT.spouseSSN_3, sssn.p3);
    }
  }

  // Address
  setText(F1040_TEXT.homeAddress, p.address);
  setText(F1040_TEXT.city, p.city);
  setText(F1040_TEXT.state, p.state);
  setText(F1040_TEXT.zip, p.zip);

  // ── Filing Status ───────────────────────────────────────────────────────
  setCheck(F1040_CHECKBOX.single, d.filingStatus === 'single');
  setCheck(F1040_CHECKBOX.marriedJoint, d.filingStatus === 'married_joint');
  setCheck(F1040_CHECKBOX.marriedSeparate, d.filingStatus === 'married_separate');
  setCheck(F1040_CHECKBOX.headOfHousehold, d.filingStatus === 'head_household');

  // Digital assets — default to No
  setCheck(F1040_CHECKBOX.digitalAssetsNo, true);

  // Age/blind checkboxes
  if (d.primary65Plus) setCheck(F1040_CHECKBOX.youBornBefore, true);
  if (d.primaryBlind) setCheck(F1040_CHECKBOX.youBlind, true);
  if (d.spouse65Plus) setCheck(F1040_CHECKBOX.spouseBornBefore, true);

  // ── Dependents ──────────────────────────────────────────────────────────
  if (d.dependentDetails && d.dependentDetails.length > 0) {
    // Currently we don't have full dependent name/SSN in the data model,
    // but fill the count. If names become available, map them here.
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 1 — INCOME (Lines 1–11)
  // ═════════════════════════════════════════════════════════════════════════

  // Computed values
  const w2Wages = d.w2Incomes.reduce((s, w) => s + w.wages, 0);
  const w2Withholding = d.w2Incomes.reduce((s, w) => s + w.withheld, 0);
  const withholding1099 = d.income1099.reduce((s, i) => s + (i.withheld ?? 0), 0);
  const totalCapitalGains = (d.capitalGainsShortTerm ?? 0) + (d.capitalGainsLongTerm ?? 0);

  // Schedule 1 income (business + other)
  const schedule1Income = r.netBusinessIncome + (d.unemploymentIncome ?? 0) +
    (d.rentalIncome ?? 0) + (d.alimonyReceived ?? 0) + (d.gamblingWinnings ?? 0);

  // Schedule 1 adjustments (above-the-line deductions)
  const healthInsDeduction = Math.min(d.healthInsurancePremiums ?? 0, Math.max(0, r.netBusinessIncome));
  const schedule1Adjustments = r.seTaxDeduction + r.iraDeduction + r.hsaDeduction +
    r.sepIraDeduction + r.homeOfficeDeduction +
    Math.min(d.studentLoanInterest ?? 0, 2500) + healthInsDeduction;

  // Line 1a — Wages
  setNum(F1040_TEXT.line1a, w2Wages);

  // Line 1z — Total wages (same as 1a for most filers)
  setNum(F1040_TEXT.line1z, w2Wages);

  // Line 2b — Taxable interest
  if ((d.interestIncome ?? 0) > 0) {
    setNum(F1040_TEXT.line2b, d.interestIncome);
  }

  // Line 3b — Ordinary dividends
  if ((d.dividendIncome ?? 0) > 0) {
    setNum(F1040_TEXT.line3b, d.dividendIncome);
  }

  // Line 6a — Social security benefits (gross)
  if ((d.socialSecurityIncome ?? 0) > 0) {
    setNum(F1040_TEXT.line6a, d.socialSecurityIncome);
    // Line 6b — Taxable SS amount
    setNum(F1040_TEXT.line6b, r.taxableSocialSecurity);
  }

  // Line 7 — Capital gains
  if (totalCapitalGains !== 0) {
    setNum(F1040_TEXT.line7, totalCapitalGains);
    // Check if Schedule D is attached
    setCheck(F1040_CHECKBOX.line7_schedD, true);
  }

  // Line 8 — Other income from Schedule 1
  if (schedule1Income > 0) {
    setNum(F1040_TEXT.line8, schedule1Income);
  }

  // Line 9 — Total income
  setNum(F1040_TEXT.line9, r.grossIncome);

  // Line 10 — Adjustments from Schedule 1
  if (schedule1Adjustments > 0) {
    setNum(F1040_TEXT.line10, schedule1Adjustments);
  }

  // Line 11 — AGI
  setNum(F1040_TEXT.line11, r.agi);

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 2 — TAX AND CREDITS (Lines 12–24)
  // ═════════════════════════════════════════════════════════════════════════

  // Line 12 — Standard or Itemized deduction
  setNum(F1040_TEXT.line12, r.deductionAmount);
  setCheck(F1040_CHECKBOX.line12_standard, r.deductionMethod === 'Standard');
  setCheck(F1040_CHECKBOX.line12_itemized, r.deductionMethod === 'Itemized');

  // Line 13 — QBI deduction
  setNum(F1040_TEXT.line13, r.qbiDeduction);

  // Line 14 — Total deductions (12 + 13)
  setNum(F1040_TEXT.line14, r.deductionAmount + r.qbiDeduction);

  // Line 15 — Taxable income
  setNum(F1040_TEXT.line15, r.taxableIncome);

  // Lines 16–24 intermediate calculations
  const line16 = r.tentativeTax;
  const line17 = r.seTax + r.niit;   // From Schedule 2
  const line18 = line16 + line17;
  const line19 = r.childTaxCredit;
  const line20 = r.educationCredit + r.childCareCredit + r.saversCredit; // Schedule 3
  const line21 = line19 + line20;
  const line22 = Math.max(0, line18 - line21);
  const line24 = r.federalTax + r.seTax + r.niit;

  // Line 16 — Tax
  setNum(F1040_TEXT.line16, line16);

  // Line 17 — Schedule 2 amount
  if (line17 > 0) {
    setNum(F1040_TEXT.line17, line17);
  }

  // Line 18 — Total (16 + 17)
  setNum(F1040_TEXT.line18, line18);

  // Line 19 — Child tax credit
  if (line19 > 0) {
    setNum(F1040_TEXT.line19, line19);
  }

  // Line 20 — Schedule 3 credits
  if (line20 > 0) {
    setNum(F1040_TEXT.line20, line20);
  }

  // Line 21 — Total credits (19 + 20)
  if (line21 > 0) {
    setNum(F1040_TEXT.line21, line21);
  }

  // Line 22 — Tax after credits
  setNum(F1040_TEXT.line22, line22);

  // Line 24 — Total tax
  setNum(F1040_TEXT.line24, line24);

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 2 — PAYMENTS (Lines 25–33)
  // ═════════════════════════════════════════════════════════════════════════

  const totalWithheld = w2Withholding + withholding1099 + (d.spouseWithholding ?? 0);

  // Line 25a — W-2 withholding
  if (w2Withholding > 0) {
    setNum(F1040_TEXT.line25a, w2Withholding);
  }

  // Line 25b — 1099 withholding
  if (withholding1099 > 0) {
    setNum(F1040_TEXT.line25b, withholding1099);
  }

  // Line 25d — Total withholding
  if (totalWithheld > 0) {
    setNum(F1040_TEXT.line25d, totalWithheld);
  }

  // Line 26 — Estimated tax payments
  if ((d.estimatedTaxesPaid ?? 0) > 0) {
    setNum(F1040_TEXT.line26, d.estimatedTaxesPaid);
  }

  // Line 27 — EIC
  if (r.eitc > 0) {
    setNum(F1040_TEXT.line27, r.eitc);
  }

  // Line 30 — Schedule 3 other payments
  const sched3Payments = (d.estimatedTaxesPaid ?? 0) > 0 ? 0 : 0; // Already counted in line 26
  // Premium tax credit goes here if applicable
  if (r.premiumTaxCredit > 0) {
    setNum(F1040_TEXT.line30, r.premiumTaxCredit);
  }

  // Line 31 — Total other payments (27 + 28 + 29 + 30)
  const line31 = r.eitc + r.premiumTaxCredit;
  if (line31 > 0) {
    setNum(F1040_TEXT.line31, line31);
  }

  // Line 33 — Total payments
  const line33 = totalWithheld + (d.estimatedTaxesPaid ?? 0) + r.eitc + r.premiumTaxCredit;
  setNum(F1040_TEXT.line33, line33);

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 2 — REFUND / AMOUNT OWED (Lines 34–38)
  // ═════════════════════════════════════════════════════════════════════════

  const isRefund = r.finalBillOrRefund < 0;
  const refundAmount = isRefund ? Math.abs(r.finalBillOrRefund) : 0;
  const owedAmount = r.finalBillOrRefund > 0 ? r.finalBillOrRefund : 0;

  if (isRefund) {
    // Line 34 — Amount overpaid
    setNum(F1040_TEXT.line34, refundAmount);
    // Line 35a — Refunded to you
    setNum(F1040_TEXT.line35a, refundAmount);
  } else if (owedAmount > 0) {
    // Line 37 — Amount you owe
    setNum(F1040_TEXT.line37, owedAmount);
  }

  // Line 38 — Estimated penalty (if applicable)
  if (r.penaltyRisk.estimatedPenalty > 0) {
    setNum(F1040_TEXT.line38, r.penaltyRisk.estimatedPenalty);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SIGNATURE SECTION
  // ═════════════════════════════════════════════════════════════════════════

  // Occupation
  setText(F1040_TEXT.yourOccupation, 'Self-Employed / Gig Worker');

  // Third-party designee — No
  setCheck(F1040_CHECKBOX.designeeNo, true);

  // Self-prepared
  setCheck(F1040_CHECKBOX.selfPrepared, true);

  // ═════════════════════════════════════════════════════════════════════════
  // FLATTEN & RETURN
  // ═════════════════════════════════════════════════════════════════════════

  try {
    form.updateFieldAppearances();
  } catch {
    // Some fonts may not be embedded — skip appearance update
  }

  form.flatten();

  return await pdfDoc.save();
}
