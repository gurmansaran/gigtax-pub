/**
 * File Now Tax Engine 2025
 * Uses TaxData (primary/spouse split), IRS 2025 constants, and specified calculation order.
 */

import type { TaxData, FilingStatus, W2Form, Form1099, CapitalGains } from './types';
import { CA_STANDARD_DEDUCTION_2025, calculateStateTax } from './stateTax';

/** IRS 2025 Standard Deduction (Revenue Procedure 2024-40, IR-2024-273) */
export const IRS_2025_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 15_000,
  married_joint: 30_000,
  married_separate: 15_000,
  head_household: 22_500,
};

/** IRS 2025 Ordinary Income Tax Brackets */
const ORDINARY_BRACKETS_2025: Record<FilingStatus, Array<{ min: number; max: number; rate: number }>> = {
  single: [
    { min: 0, max: 11_925, rate: 0.10 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 626_350, rate: 0.35 },
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { min: 0, max: 23_850, rate: 0.10 },
    { min: 23_850, max: 96_950, rate: 0.12 },
    { min: 96_950, max: 206_700, rate: 0.22 },
    { min: 206_700, max: 394_600, rate: 0.24 },
    { min: 394_600, max: 501_050, rate: 0.32 },
    { min: 501_050, max: 751_600, rate: 0.35 },
    { min: 751_600, max: Infinity, rate: 0.37 },
  ],
  married_separate: [
    { min: 0, max: 11_925, rate: 0.10 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 375_800, rate: 0.35 },
    { min: 375_800, max: Infinity, rate: 0.37 },
  ],
  head_household: [
    { min: 0, max: 17_000, rate: 0.10 },
    { min: 17_000, max: 64_850, rate: 0.12 },
    { min: 64_850, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_500, rate: 0.32 },
    { min: 250_500, max: 626_350, rate: 0.35 },
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
};

/** 2025 Long-Term Capital Gains Brackets (0%, 15%, 20%) */
const LTCG_BRACKETS_2025: Record<FilingStatus, Array<{ min: number; max: number; rate: number }>> = {
  single: [
    { min: 0, max: 48_350, rate: 0 },
    { min: 48_350, max: 533_400, rate: 0.15 },
    { min: 533_400, max: Infinity, rate: 0.20 },
  ],
  married_joint: [
    { min: 0, max: 96_700, rate: 0 },
    { min: 96_700, max: 600_050, rate: 0.15 },
    { min: 600_050, max: Infinity, rate: 0.20 },
  ],
  married_separate: [
    { min: 0, max: 48_350, rate: 0 },
    { min: 48_350, max: 533_400, rate: 0.15 },
    { min: 533_400, max: Infinity, rate: 0.20 },
  ],
  head_household: [
    { min: 0, max: 64_950, rate: 0 },
    { min: 64_950, max: 551_350, rate: 0.15 },
    { min: 551_350, max: Infinity, rate: 0.20 },
  ],
};

const SE_MULTIPLIER = 0.9235;
const SE_RATE = 0.153;

/** Silver & Sight: +$2,000 (Single/HoH) or +$1,600 (MFJ/MFS) per 65+ or blind (2025) */
const SENIOR_BLIND_BOOST_SINGLE_HOH = 2_000;
const SENIOR_BLIND_BOOST_MFJ = 1_600;
const CHILD_TAX_CREDIT = 2_000;
const OTHER_DEPENDENT_CREDIT = 500;

function ageAsOfDec31_2025(dateOfBirth: string | undefined): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [y] = dateOfBirth.split('-').map(Number);
  return 2025 - y;
}

/** CTC $2,000: under 17 and son/daughter/sibling/other. ODC $500: 17+ or parent. */
function splitDependentCredits(
  dependentDetails: Array<{ dateOfBirth?: string; relationship?: string }> | undefined
): { ctCredits: number; odcCredits: number } {
  if (!dependentDetails?.length) return { ctCredits: 0, odcCredits: 0 };
  const ctRelationships = new Set(['son', 'daughter', 'sibling', 'other']);
  let ctCredits = 0;
  let odcCredits = 0;
  for (const dep of dependentDetails) {
    const age = ageAsOfDec31_2025(dep.dateOfBirth);
    const rel = (dep.relationship ?? 'other').toLowerCase();
    if (rel === 'parent') {
      odcCredits += 1;
    } else if (age !== null && age < 17 && ctRelationships.has(rel)) {
      ctCredits += 1;
    } else {
      odcCredits += 1;
    }
  }
  return { ctCredits, odcCredits };
}

function sumW2(w2s: W2Form[]): { wages: number; withheld: number } {
  return w2s.reduce(
    (acc, w) => ({
      wages: acc.wages + (w.box1_wages ?? 0),
      withheld: acc.withheld + (w.box2_fedWithheld ?? 0),
    }),
    { wages: 0, withheld: 0 }
  );
}

function sum1099(forms: Form1099[]): { gross: number; withheld: number } {
  return forms.reduce(
    (acc, f) => ({
      gross: acc.gross + (f.box1_compensation ?? 0),
      withheld: acc.withheld + (f.box4_fedWithheld ?? 0),
    }),
    { gross: 0, withheld: 0 }
  );
}

function sumCapitalGains(p: CapitalGains, s: CapitalGains): { shortTerm: number; longTerm: number } {
  return {
    shortTerm: (p.shortTerm ?? 0) + (s.shortTerm ?? 0),
    longTerm: (p.longTerm ?? 0) + (s.longTerm ?? 0),
  };
}

export interface TaxDataEngineOutput {
  netBusinessIncome: number;
  seTax: number;
  grossIncome: number;
  agi: number;
  taxableIncome: number;
  ordinaryTax: number;
  ltcgTax: number;
  finalTaxBill: number;
  totalPayments: number;
  /** Positive = refund, negative = amount due */
  refundOrDue: number;
  standardDeduction: number;
  /** Detailed breakdown for reconciliation UI */
  incomeBreakdown: { w2: number; selfEmployed: number; capitalGains: number; totalGross: number };
  taxLiability: { federal: number; state: number; selfEmployment: number; totalLiability: number };
  paymentsBreakdown: { withholding: number; estimatedPayments: number; totalPayments: number };
}

/**
 * Calculate tax from TaxData using IRS 2025 rules and the specified order.
 *
 * 1. Net Business Income = 1099 Income - Expenses
 * 2. SE Tax = Net Business Income * 0.9235 * 0.153
 * 3. Gross Income = W2 + Net Business Income + ShortTermGains
 * 4. AGI = Gross Income - (SE Tax * 0.5)
 * 5. Taxable Income = AGI - Standard Deduction
 * 6. Ordinary Tax = 2025 brackets on (Taxable Income - LTCG)
 * 7. LTCG Tax = 0/15/20% on LTCG stacked on ordinary
 * 8. Final Tax Bill = Ordinary Tax + LTCG Tax + SE Tax
 * 9. Refund/Due = (W2 Withholding + 1099 Withholding + Estimated Payments) - Final Tax Bill
 *
 * @param additional1099Income - Extra 1099 income (e.g. tracked gig) not in forms1099
 * @param stateCode - State of residence (e.g. 'CA') for state tax; uses FTB 2025 brackets for CA.
 * @param options - Optional senior/blind standard deduction boost and dependent details for CTC/ODC.
 */
export function calculateTaxFromTaxData(
  taxData: TaxData,
  expenses: number,
  estimatedPayments: number,
  additional1099Income = 0,
  stateCode = 'CA',
  options?: {
    primary65Plus?: boolean;
    primaryBlind?: boolean;
    spouse65Plus?: boolean;
    spouseBlind?: boolean;
    dependentDetails?: Array<{ dateOfBirth?: string; relationship?: string }>;
  }
): TaxDataEngineOutput {
  const status = taxData.filingStatus;
  const primary = taxData.primary;
  const spouse = taxData.spouse;

  const w2Primary = sumW2(primary.w2s);
  const w2Spouse = sumW2(spouse.w2s);
  const w21099Primary = sum1099(primary.forms1099);
  const w21099Spouse = sum1099(spouse.forms1099);

  const total1099 = w21099Primary.gross + w21099Spouse.gross + additional1099Income;
  const totalWithheld1099 = w21099Primary.withheld + w21099Spouse.withheld;
  const totalW2Withheld = w2Primary.withheld + w2Spouse.withheld;

  const gains = sumCapitalGains(primary.capitalGains, spouse.capitalGains);

  let standardDeduction = IRS_2025_STANDARD_DEDUCTION[status];
  if (options) {
    const isMFJ = status === 'married_joint' || status === 'married_separate';
    const boostPerBox = isMFJ ? SENIOR_BLIND_BOOST_MFJ : SENIOR_BLIND_BOOST_SINGLE_HOH;
    let boost = 0;
    if (options.primary65Plus) boost += boostPerBox;
    if (options.primaryBlind) boost += boostPerBox;
    if (options.spouse65Plus) boost += boostPerBox;
    if (options.spouseBlind) boost += boostPerBox;
    standardDeduction += boost;
  }

  // 1. Net Business Income
  const netBusinessIncome = Math.max(0, total1099 - expenses);

  // 2. SE Tax
  const seTax = netBusinessIncome * SE_MULTIPLIER * SE_RATE;

  // 3. Gross Income
  const w2Total = w2Primary.wages + w2Spouse.wages;
  const grossIncome = w2Total + netBusinessIncome + gains.shortTerm;

  // 4. AGI
  const agi = grossIncome - seTax * 0.5;

  // 5. Taxable Income (ordinary only; Gross = W2 + NetBiz + ST, no LTCG)
  const taxableIncome = Math.max(0, agi - standardDeduction);

  // 6. Ordinary tax on taxable income; LTCG stacked on top for 0/15/20%
  const ordinaryTax = calculateOrdinaryTax(taxableIncome, status);
  const ltcgTax = calculateLTCGTax(gains.longTerm, taxableIncome, status);

  // 7. Dependent credits (CTC $2,000 / ODC $500) – reduce income tax only
  const tentativeIncomeTax = ordinaryTax + ltcgTax;
  let dependentCredits = 0;
  if (options?.dependentDetails?.length) {
    const { ctCredits, odcCredits } = splitDependentCredits(options.dependentDetails);
    const totalCredits = ctCredits * CHILD_TAX_CREDIT + odcCredits * OTHER_DEPENDENT_CREDIT;
    dependentCredits = Math.min(totalCredits, tentativeIncomeTax);
  }
  const federalTaxAfterCredits = Math.max(0, tentativeIncomeTax - dependentCredits) + seTax;

  // 8. State Tax (FTB 2025 progressive for CA; flat/zero for others)
  const caTaxableIncome = Math.max(0, agi - CA_STANDARD_DEDUCTION_2025[status]);
  const stateTax = calculateStateTax(stateCode, caTaxableIncome, status);

  // 9. Final Tax Bill
  const federalTax = federalTaxAfterCredits;
  const finalTaxBill = federalTax + stateTax;

  // 10. Refund/Due
  const totalPayments = totalW2Withheld + totalWithheld1099 + estimatedPayments;
  const refundOrDue = totalPayments - finalTaxBill;

  const capitalGainsTotal = gains.shortTerm + gains.longTerm;
  return {
    netBusinessIncome,
    seTax,
    grossIncome,
    agi,
    taxableIncome,
    ordinaryTax,
    ltcgTax,
    finalTaxBill,
    totalPayments,
    refundOrDue,
    standardDeduction,
    incomeBreakdown: {
      w2: w2Total,
      selfEmployed: netBusinessIncome,
      capitalGains: capitalGainsTotal,
      totalGross: grossIncome,
    },
    taxLiability: {
      federal: federalTax,
      state: stateTax,
      selfEmployment: seTax,
      totalLiability: finalTaxBill,
    },
    paymentsBreakdown: {
      withholding: totalW2Withheld + totalWithheld1099,
      estimatedPayments,
      totalPayments,
    },
  };
}

function calculateOrdinaryTax(amount: number, status: FilingStatus): number {
  if (amount <= 0) return 0;
  const brackets = ORDINARY_BRACKETS_2025[status];
  let tax = 0;
  let remaining = amount;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const inBracket = Math.min(remaining, b.max - b.min);
    tax += inBracket * b.rate;
    remaining -= inBracket;
  }
  return tax;
}

function calculateLTCGTax(
  ltcgAmount: number,
  stackedOrdinaryIncome: number,
  status: FilingStatus
): number {
  if (ltcgAmount <= 0) return 0;
  const brackets = LTCG_BRACKETS_2025[status];
  let tax = 0;
  let remaining = ltcgAmount;
  let base = stackedOrdinaryIncome;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const bracketBottom = Math.max(b.min, base);
    if (b.max <= bracketBottom) continue;
    const space = b.max - bracketBottom;
    const inBracket = Math.min(remaining, space);
    tax += inBracket * b.rate;
    remaining -= inBracket;
    base = b.max;
  }
  return tax;
}
