/**
 * Tax Calculation Engine
 * Detailed breakdown with income sources, tax liability, deductions, and final reconciliation.
 */

import { CA_STANDARD_DEDUCTION_2025, calculateStateTax, calculateCASDI } from '../stateTax';

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_household';

export interface TaxCalculationInput {
  w2Income: number;
  selfEmployedIncome: number;
  capitalGains: number;
  filingStatus?: FilingStatus;
  /** W-2 federal withholding + 1099 withholding */
  withholding?: number;
  /** Estimated tax payments made during the year */
  estimatedPayments?: number;
  /** State code for state tax (default CA) */
  state?: string;
}

export interface TaxCalculationOutput {
  incomeBreakdown: {
    w2: number;
    selfEmployed: number;
    capitalGains: number;
    totalGross: number;
  };
  taxLiability: {
    federal: number;
    state: number;
    selfEmployment: number;
    /** CA only: State Disability Insurance (1.2% on W-2 gross). Shown as "CA SDI Tax". */
    caSdiTax?: number;
    totalLiability: number;
  };
  deductions: {
    standardDeduction: number;
    qbiDeduction: number;
    totalDeductions: number;
  };
  finalCalculation: {
    totalTax: number;
    totalPaid: number;
    amountDueOrRefund: number;
  };
}

/** IRS 2025 Standard Deduction (Rev. Proc. 2024-40) */
const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 15_000,
  married_joint: 30_000,
  married_separate: 15_000,
  head_household: 22_500,
};

/** IRS 2025 Ordinary Income Tax Brackets */
const FEDERAL_BRACKETS: Record<FilingStatus, Array<{ min: number; max: number; rate: number }>> = {
  single: [
    { min: 0, max: 11_925, rate: 0.1 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 626_350, rate: 0.35 },
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { min: 0, max: 23_850, rate: 0.1 },
    { min: 23_850, max: 96_950, rate: 0.12 },
    { min: 96_950, max: 206_700, rate: 0.22 },
    { min: 206_700, max: 394_600, rate: 0.24 },
    { min: 394_600, max: 501_050, rate: 0.32 },
    { min: 501_050, max: 751_600, rate: 0.35 },
    { min: 751_600, max: Infinity, rate: 0.37 },
  ],
  married_separate: [
    { min: 0, max: 11_925, rate: 0.1 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 375_800, rate: 0.35 },
    { min: 375_800, max: Infinity, rate: 0.37 },
  ],
  head_household: [
    { min: 0, max: 17_000, rate: 0.1 },
    { min: 17_000, max: 64_850, rate: 0.12 },
    { min: 64_850, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_500, rate: 0.32 },
    { min: 250_500, max: 626_350, rate: 0.35 },
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
};

/** 2025 LTCG Brackets (0%, 15%, 20%) - stacked on ordinary income */
const LTCG_BRACKETS: Record<FilingStatus, Array<{ min: number; max: number; rate: number }>> = {
  single: [
    { min: 0, max: 48_350, rate: 0 },
    { min: 48_350, max: 533_400, rate: 0.15 },
    { min: 533_400, max: Infinity, rate: 0.2 },
  ],
  married_joint: [
    { min: 0, max: 96_700, rate: 0 },
    { min: 96_700, max: 600_050, rate: 0.15 },
    { min: 600_050, max: Infinity, rate: 0.2 },
  ],
  married_separate: [
    { min: 0, max: 48_350, rate: 0 },
    { min: 48_350, max: 533_400, rate: 0.15 },
    { min: 533_400, max: Infinity, rate: 0.2 },
  ],
  head_household: [
    { min: 0, max: 64_950, rate: 0 },
    { min: 64_950, max: 551_350, rate: 0.15 },
    { min: 551_350, max: Infinity, rate: 0.2 },
  ],
};

/** Self-employment tax: 92.35% of net * 15.3% */
const SE_MULTIPLIER = 0.9235;
const SE_RATE = 0.153;

/** QBI deduction: up to 20% of qualified business income (simplified) */
const QBI_RATE = 0.2;

function calculateOrdinaryTax(amount: number, status: FilingStatus): number {
  if (amount <= 0) return 0;
  const brackets = FEDERAL_BRACKETS[status];
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

function calculateLTCGTax(ltcgAmount: number, stackedOrdinaryIncome: number, status: FilingStatus): number {
  if (ltcgAmount <= 0) return 0;
  const brackets = LTCG_BRACKETS[status];
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

/**
 * Calculate detailed tax breakdown from income sources.
 */
export function calculateTax(input: TaxCalculationInput): TaxCalculationOutput {
  const {
    w2Income,
    selfEmployedIncome,
    capitalGains,
    filingStatus = 'single',
    withholding = 0,
    estimatedPayments = 0,
    state = 'CA',
  } = input;

  const totalGross = w2Income + selfEmployedIncome + capitalGains;

  // Deductions
  const standardDeduction = STANDARD_DEDUCTION[filingStatus];
  const qbiDeduction = Math.min(
    selfEmployedIncome * QBI_RATE,
    Math.max(0, (w2Income + selfEmployedIncome) * 0.2) // Simplified QBI limit
  );
  const totalDeductions = standardDeduction + qbiDeduction;

  // Taxable income (ordinary portion: W2 + SE - deductions; LTCG stacks on top)
  // Simplified: treat all capital gains as mix; for accuracy we'd split ST vs LT
  const ordinaryIncome = Math.max(0, w2Income + selfEmployedIncome - totalDeductions);
  const taxableOrdinary = Math.max(0, ordinaryIncome);
  const ltcgAmount = Math.max(0, capitalGains);

  // Federal ordinary income tax
  const federalOrdinaryTax = calculateOrdinaryTax(taxableOrdinary, filingStatus);
  const federalLTCGTax = calculateLTCGTax(ltcgAmount, taxableOrdinary, filingStatus);
  const federalIncomeTax = federalOrdinaryTax + federalLTCGTax;

  // Self-employment tax (only on self-employed income)
  const seTaxBase = Math.max(0, selfEmployedIncome) * SE_MULTIPLIER;
  const selfEmploymentTax = seTaxBase * SE_RATE;

  // State income tax (FTB 2025 progressive for CA; flat/zero for others via stateTax.ts)
  const stateTaxableIncome =
    state === 'CA'
      ? Math.max(0, totalGross - CA_STANDARD_DEDUCTION_2025[filingStatus])
      : Math.max(0, totalGross);
  const stateIncomeTax = calculateStateTax(state, stateTaxableIncome, filingStatus);
  // CA SDI: 1.2% on gross W-2 income (no cap). MHSA (1% on income > $1M) is inside stateIncomeTax.
  const caSdiTax = state === 'CA' ? calculateCASDI(w2Income) : undefined;
  const stateTotal = stateIncomeTax + (caSdiTax ?? 0);

  const totalLiability = federalIncomeTax + stateTotal + selfEmploymentTax;
  const totalPaid = withholding + estimatedPayments;
  const amountDueOrRefund = totalLiability - totalPaid;

  return {
    incomeBreakdown: {
      w2: w2Income,
      selfEmployed: selfEmployedIncome,
      capitalGains,
      totalGross,
    },
    taxLiability: {
      federal: federalIncomeTax,
      state: stateTotal,
      selfEmployment: selfEmploymentTax,
      ...(caSdiTax !== undefined && { caSdiTax }),
      totalLiability,
    },
    deductions: {
      standardDeduction,
      qbiDeduction,
      totalDeductions,
    },
    finalCalculation: {
      totalTax: totalLiability,
      totalPaid,
      amountDueOrRefund,
    },
  };
}
