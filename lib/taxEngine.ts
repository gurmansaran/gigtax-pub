/**
 * 2025 Tax Calculator (Tax Year 2025, Filing Due April 2026)
 * Verified constants: IRS Rev. Proc. 24-40, SSA 2025 Wage Base, FTB CA 2025.
 * Strict order: SE Tax → Federal Income Tax → State Tax.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CA_STANDARD_DEDUCTION_2025, calculateStateTax } from './stateTax';

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_household';

const QUARTERLY_PAYMENTS_KEY = 'quarterly_payments_2025';
const DRAFT_RETURN_KEY = 'draft_tax_return';

export interface TaxInput {
  filingStatus: FilingStatus;
  gigIncome: number; // 1099-NEC total
  gigExpenses: {
    miles: number;
    actual: number;
    other: number;
  };
  w2Income: {
    self: number;
    spouse: number;
  };
  capitalGains: {
    shortTerm: number;
    longTerm: number;
  };
  iraContributions: {
    self: number;
    spouse: number;
  };
  isRetirementPlanActive: {
    self: boolean;
    spouse: boolean;
  };
  state?: string; // e.g. 'CA' for California state tax
}

export interface TaxOutput {
  totalTax: number;
  federalTax: number;
  stateTax: number;
  quarterlyPayment: number;
  effectiveRate: number;
  deductionsBreakdown: {
    businessExpenses: number;
    standardDeduction: number;
    qbiDeduction: number;
    deductibleIra: number;
    seTaxDeduction: number;
  };
  availableIraSpace: {
    self: number;
    spouse: number;
  };
  seTaxAmount: number;
  ssTaxAmount: number;
  medicareTaxAmount: number;
  additionalMedicareAmount: number;
  netBusinessIncome: number;
  agi: number;
  taxableIncome: number;
}

// ---------- Phase 1: Verified 2025 Constants (IRS Rev. Proc. 24-40, SSA, FTB) ----------
// IRS Rev. Proc. 24-40: Standard deduction single $15,000; MFJ $30,000; HOH $22,500 (Oct 2024).
// SSA: 2025 Social Security wage base $176,100 (max SS tax self-employed ~$21,836).
// FTB: 2025 CA standard deduction single $5,706.
const TAX_CONSTANTS = {
  STANDARD_DEDUCTION: {
    single: 15_000,
    married_joint: 30_000,
    married_separate: 15_000,
    head_household: 22_500,
  },
  MILEAGE_RATE: 0.70,
  SS_WAGE_BASE: 176_100, // SSA 2025 (stop taxing SS after this)
  SS_TAX_RATE: 0.124,
  MEDICARE_TAX_RATE: 0.029,
  ADDITIONAL_MEDICARE_RATE: 0.009,
  ADDITIONAL_MEDICARE_THRESHOLD_SINGLE: 200_000,
  ADDITIONAL_MEDICARE_THRESHOLD_MARRIED: 250_000,
  SE_DEDUCTION_MULTIPLIER: 0.9235, // 92.35% rule
  QBI_RATE: 0.20,
  QBI_PHASE_OUT_START_SINGLE: 197_300,
  QBI_PHASE_OUT_END_SINGLE: 257_300,
  QBI_PHASE_OUT_START_MFJ: 394_600,
  QBI_PHASE_OUT_END_MFJ: 514_600,
  IRA_MAX_CONTRIBUTION: 7000,
  IRA_PHASEOUT: {
    married_joint: { start: 126000, end: 146000 },
    single: { start: 77000, end: 87000 },
    married_separate: { start: 0, end: 10000 },
    head_household: { start: 77000, end: 87000 },
  },
  // IRS Rev. Proc. 24-40: 2025 single brackets (exact split points)
  ORDINARY_BRACKETS: {
    married_joint: [
      { min: 0, max: 23_850, rate: 0.10 },
      { min: 23_850, max: 96_950, rate: 0.12 },
      { min: 96_950, max: 206_700, rate: 0.22 },
      { min: 206_700, max: 394_600, rate: 0.24 },
      { min: 394_600, max: 501_050, rate: 0.32 },
      { min: 501_050, max: 751_600, rate: 0.35 },
      { min: 751_600, max: Infinity, rate: 0.37 },
    ],
    single: [
      { min: 0, max: 11_925, rate: 0.10 },
      { min: 11_925, max: 48_475, rate: 0.12 },
      { min: 48_475, max: 103_350, rate: 0.22 },
      { min: 103_350, max: 197_300, rate: 0.24 },
      { min: 197_300, max: 250_525, rate: 0.32 },
      { min: 250_525, max: 626_350, rate: 0.35 },
      { min: 626_350, max: Infinity, rate: 0.37 },
    ],
    // Bug #2 FIX: Corrected MFS 35% bracket (was $313,175, should be $375,800)
    married_separate: [
      { min: 0, max: 11_925, rate: 0.10 },
      { min: 11_925, max: 48_475, rate: 0.12 },
      { min: 48_475, max: 103_350, rate: 0.22 },
      { min: 103_350, max: 197_300, rate: 0.24 },
      { min: 197_300, max: 250_525, rate: 0.32 },
      { min: 250_525, max: 375_800, rate: 0.35 },
      { min: 375_800, max: Infinity, rate: 0.37 },
    ],
    // Bug #2 FIX: Corrected HoH brackets (IRS Rev. Proc. 2024-40)
    head_household: [
      { min: 0, max: 17_000, rate: 0.10 },       // Was 16,800
      { min: 17_000, max: 64_850, rate: 0.12 },   // Was 68,250
      { min: 64_850, max: 103_350, rate: 0.22 },  // Was 110,700
      { min: 103_350, max: 197_300, rate: 0.24 },
      { min: 197_300, max: 250_500, rate: 0.32 },
      { min: 250_500, max: 626_350, rate: 0.35 },
      { min: 626_350, max: Infinity, rate: 0.37 },
    ],
  },
  CAPITAL_GAINS_BRACKETS: {
    married_joint: [
      { min: 0, max: 96_700, rate: 0.0 },
      { min: 96_700, max: 600_050, rate: 0.15 },
      { min: 600_050, max: Infinity, rate: 0.20 },
    ],
    single: [
      { min: 0, max: 48_350, rate: 0.0 },
      { min: 48_350, max: 533_850, rate: 0.15 },
      { min: 533_850, max: Infinity, rate: 0.20 },
    ],
    married_separate: [
      { min: 0, max: 48_350, rate: 0.0 },
      { min: 48_350, max: 533_850, rate: 0.15 },
      { min: 533_850, max: Infinity, rate: 0.20 },
    ],
    head_household: [
      { min: 0, max: 54_100, rate: 0.0 },
      { min: 54_100, max: 533_850, rate: 0.15 },
      { min: 533_850, max: Infinity, rate: 0.20 },
    ],
  },
  // CA state tax: see stateTax.ts (FTB 2025 Schedules X/Y/Z + MHSA)
} as const;

/**
 * Calculate tax return (strict order: SE Tax → Federal → CA State).
 * Verified 2025: IRS Rev. Proc. 24-40, SSA Wage Base $176,100, FTB CA $5,706.
 *
 * Validation (Phase 3): Net Profit $1,344,119 (single, no W2):
 * - SE Tax ≈ $67k (NOT $172k). SS tax capped at $21,836.40.
 * - SS = 12.4% × min(SE_Taxable, $176,100); Medicare 2.9% on all; Addl 0.9% on excess over $200k.
 */
export function calculateTaxReturn(input: TaxInput): TaxOutput {
  const totalW2 = input.w2Income.self + input.w2Income.spouse;

  // ---------- 1. Net Profit (Schedule C) ----------
  const mileageDeduction = input.gigExpenses.miles * TAX_CONSTANTS.MILEAGE_RATE;
  const higherExpense = Math.max(mileageDeduction, input.gigExpenses.actual);
  const netBusinessIncome = Math.max(0, input.gigIncome - higherExpense - input.gigExpenses.other);
  const businessExpenses = higherExpense + input.gigExpenses.other;

  // ---------- 2. Self-Employment Tax (strict order) ----------
  // SE_Taxable = Net_Profit * 0.9235 (92.35% rule)
  const seTaxable = netBusinessIncome * TAX_CONSTANTS.SE_DEDUCTION_MULTIPLIER;
  // Social Security: 12.4% on min(SE_Taxable, 176100 - W2). CRITICAL: stop after $176,100 total.
  const ssTaxableBase = Math.max(0, Math.min(TAX_CONSTANTS.SS_WAGE_BASE - totalW2, seTaxable));
  const ssTaxAmount = ssTaxableBase * TAX_CONSTANTS.SS_TAX_RATE;
  // Medicare: 2.9% on all SE_Taxable
  const medicareTaxAmount = seTaxable * TAX_CONSTANTS.MEDICARE_TAX_RATE;
  // Additional Medicare: +0.9% on (W2 + SE_Taxable) > $200k single / $250k married
  // Bug #7 FIX: MFS uses $125,000 threshold (not $250,000) per IRS Form 8959
  const addlThreshold =
    input.filingStatus === 'married_separate' ? 125_000 :
    input.filingStatus === 'married_joint'
      ? TAX_CONSTANTS.ADDITIONAL_MEDICARE_THRESHOLD_MARRIED
      : TAX_CONSTANTS.ADDITIONAL_MEDICARE_THRESHOLD_SINGLE;
  const totalForAddlMedicare = totalW2 + seTaxable;
  const additionalMedicareAmount = Math.max(0, totalForAddlMedicare - addlThreshold) * TAX_CONSTANTS.ADDITIONAL_MEDICARE_RATE;
  const seTaxAmount = ssTaxAmount + medicareTaxAmount + additionalMedicareAmount;

  // ---------- 3. Federal Income Tax ----------
  const deductibleSE = seTaxAmount / 2;
  // IRA (unchanged)
  const magiBeforeIra = totalW2 + netBusinessIncome + input.capitalGains.shortTerm + input.capitalGains.longTerm - deductibleSE;
  const iraResults = calculateIraDeduction(
    input.filingStatus,
    magiBeforeIra,
    input.isRetirementPlanActive,
    input.iraContributions
  );
  const deductibleIraTotal = iraResults.self.deductible + iraResults.spouse.deductible;
  const agi = totalW2 + netBusinessIncome + input.capitalGains.shortTerm + input.capitalGains.longTerm - deductibleSE - deductibleIraTotal;

  const standardDeduction = TAX_CONSTANTS.STANDARD_DEDUCTION[input.filingStatus];
  // QBI: 20% of QBI if below threshold; phase-out above $197,300 (single) / $394,600 (MFJ)
  const qbiDeduction = calculateQBIDeduction(input.filingStatus, agi, netBusinessIncome, standardDeduction);
  const taxableIncome = Math.max(0, agi - standardDeduction - qbiDeduction);

  const ordinaryTaxable = Math.max(0, taxableIncome - input.capitalGains.longTerm);
  const longTermGainsTaxable = Math.min(input.capitalGains.longTerm, taxableIncome);
  const ordinaryTax = calculateOrdinaryTax(ordinaryTaxable, input.filingStatus);
  const capitalGainsTax = calculateCapitalGainsTax(longTermGainsTaxable, ordinaryTaxable, input.filingStatus);
  const federalTax = ordinaryTax + capitalGainsTax;

  // ---------- 4. State Tax (FTB 2025 progressive for CA; flat/zero for others) ----------
  const stateCode = input.state || 'CA';
  const stateTaxable =
    stateCode === 'CA'
      ? Math.max(0, agi - CA_STANDARD_DEDUCTION_2025[input.filingStatus])
      : Math.max(0, agi);
  const stateTax = calculateStateTax(stateCode, stateTaxable, input.filingStatus);

  const totalTax = federalTax + seTaxAmount + stateTax;

  const totalHouseholdIncome = totalW2 + netBusinessIncome + input.capitalGains.shortTerm + input.capitalGains.longTerm;
  const marginalRate = getMarginalTaxRate(totalHouseholdIncome, input.filingStatus);
  const gigIncomeTax = netBusinessIncome * marginalRate;
  const quarterlyPayment = (seTaxAmount + gigIncomeTax) / 4;

  const totalIncome = totalW2 + input.gigIncome + input.capitalGains.shortTerm + input.capitalGains.longTerm;
  const effectiveRate = totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0;

  const availableIraSpace = {
    self: Math.max(0, iraResults.self.maxAllowed - input.iraContributions.self),
    spouse: Math.max(0, iraResults.spouse.maxAllowed - input.iraContributions.spouse),
  };

  return {
    totalTax,
    federalTax,
    stateTax,
    quarterlyPayment,
    effectiveRate,
    deductionsBreakdown: {
      businessExpenses,
      standardDeduction,
      qbiDeduction,
      deductibleIra: deductibleIraTotal,
      seTaxDeduction: deductibleSE,
    },
    availableIraSpace,
    seTaxAmount,
    ssTaxAmount,
    medicareTaxAmount,
    additionalMedicareAmount,
    netBusinessIncome,
    agi,
    taxableIncome,
  };
}

/**
 * QBI deduction: 20% of qualified business income; phase-out above threshold (Rev. Proc. 24-40).
 * Single: full below $197,300; phase-out $197,300–$257,300. MFJ: full below $394,600; phase-out to $514,600.
 */
function calculateQBIDeduction(
  filingStatus: FilingStatus,
  agi: number,
  netBusinessIncome: number,
  standardDeduction: number
): number {
  const taxableBeforeQbi = Math.max(0, agi - standardDeduction);
  const rawQbi = netBusinessIncome * TAX_CONSTANTS.QBI_RATE;
  const cap = Math.min(rawQbi, taxableBeforeQbi);
  if (cap <= 0) return 0;

  const isMFJ = filingStatus === 'married_joint';
  const start = isMFJ ? TAX_CONSTANTS.QBI_PHASE_OUT_START_MFJ : TAX_CONSTANTS.QBI_PHASE_OUT_START_SINGLE;
  const end = isMFJ ? TAX_CONSTANTS.QBI_PHASE_OUT_END_MFJ : TAX_CONSTANTS.QBI_PHASE_OUT_END_SINGLE;
  if (agi <= start) return cap;
  if (agi >= end) return 0;
  const phaseOutFraction = (agi - start) / (end - start);
  return Math.round(cap * (1 - phaseOutFraction) * 100) / 100;
}

/**
 * Calculate IRA deduction and limits
 */
function calculateIraDeduction(
  filingStatus: FilingStatus,
  magi: number,
  isRetirementPlanActive: { self: boolean; spouse: boolean },
  iraContributions: { self: number; spouse: number }
): {
  self: { deductible: number; maxAllowed: number };
  spouse: { deductible: number; maxAllowed: number };
} {
  const phaseout = TAX_CONSTANTS.IRA_PHASEOUT[filingStatus];
  const maxContribution = TAX_CONSTANTS.IRA_MAX_CONTRIBUTION;

  const calculateForPerson = (hasActivePlan: boolean, contributed: number): { deductible: number; maxAllowed: number } => {
    if (!hasActivePlan) {
      // Fully deductible up to max
      const maxAllowed = maxContribution;
      const deductible = Math.min(contributed, maxAllowed);
      return { deductible, maxAllowed };
    }

    // Has active plan - apply phase-out
    if (magi <= phaseout.start) {
      // Fully deductible
      const maxAllowed = maxContribution;
      const deductible = Math.min(contributed, maxAllowed);
      return { deductible, maxAllowed };
    }

    if (magi >= phaseout.end) {
      // Not deductible
      return { deductible: 0, maxAllowed: 0 };
    }

    // Linear phase-out
    const phaseoutRange = phaseout.end - phaseout.start;
    const excessOverStart = magi - phaseout.start;
    const phaseoutPercentage = excessOverStart / phaseoutRange;
    const maxAllowed = maxContribution * (1 - phaseoutPercentage);
    const deductible = Math.min(contributed, maxAllowed);
    
    return { deductible, maxAllowed };
  };

  // For married filing joint, if one spouse has active plan, both are subject to phase-out
  let selfActivePlan = isRetirementPlanActive.self;
  let spouseActivePlan = isRetirementPlanActive.spouse;
  
  if (filingStatus === 'married_joint') {
    // If either spouse has active plan, both are subject to phase-out
    const eitherHasPlan = selfActivePlan || spouseActivePlan;
    selfActivePlan = eitherHasPlan;
    spouseActivePlan = eitherHasPlan;
  }

  return {
    self: calculateForPerson(selfActivePlan, iraContributions.self),
    spouse: calculateForPerson(spouseActivePlan, iraContributions.spouse),
  };
}

/**
 * Get marginal tax rate for a given income level
 */
function getMarginalTaxRate(income: number, filingStatus: FilingStatus): number {
  if (income <= 0) return 0;

  const brackets = TAX_CONSTANTS.ORDINARY_BRACKETS[filingStatus];
  
  for (const bracket of brackets) {
    if (income >= bracket.min && income < bracket.max) {
      return bracket.rate;
    }
  }
  
  // If income exceeds all brackets, return highest rate
  return brackets[brackets.length - 1].rate;
}

/**
 * Calculate ordinary income tax based on brackets
 */
function calculateOrdinaryTax(taxable: number, filingStatus: FilingStatus): number {
  if (taxable <= 0) return 0;

  const brackets = TAX_CONSTANTS.ORDINARY_BRACKETS[filingStatus];
  let tax = 0;
  let remaining = taxable;

  for (const bracket of brackets) {
    if (remaining <= 0) break;

    const bracketAmount = Math.min(remaining, bracket.max - bracket.min);
    tax += bracketAmount * bracket.rate;
    remaining -= bracketAmount;
  }

  return tax;
}

/**
 * Calculate capital gains tax (stacked on top of ordinary income)
 */
function calculateCapitalGainsTax(
  longTermGains: number,
  stackedOrdinaryIncome: number,
  filingStatus: FilingStatus
): number {
  if (longTermGains <= 0) return 0;

  const brackets = TAX_CONSTANTS.CAPITAL_GAINS_BRACKETS[filingStatus];
  let tax = 0;
  let remaining = longTermGains;
  
  // Start at the bracket that contains the stacked ordinary income
  let currentBase = stackedOrdinaryIncome;

  for (const bracket of brackets) {
    if (remaining <= 0) break;

    // Determine how much of the long-term gains falls in this bracket
    const bracketTop = bracket.max;
    const bracketBottom = Math.max(bracket.min, currentBase);
    
    if (bracketTop <= currentBase) {
      // This bracket is already covered by ordinary income
      continue;
    }

    const availableInBracket = bracketTop - bracketBottom;
    const gainsInBracket = Math.min(remaining, availableInBracket);
    
    tax += gainsInBracket * bracket.rate;
    remaining -= gainsInBracket;
    currentBase = bracketTop;
  }

  return tax;
}

// ---------- Phase 2: Quarterly Estimates ----------

export interface QuarterlyPayment {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  amount: number;
  datePaid: string;
}

/**
 * Estimated tax ≈ 25–30% of net profit. Use 0.275 as default.
 */
export function estimatedTaxFromNetProfit(netProfit: number, rate = 0.275): number {
  return Math.max(0, netProfit * rate);
}

/**
 * Store a quarterly estimated tax payment.
 */
export async function addQuarterlyPayment(payment: QuarterlyPayment): Promise<void> {
  const raw = await AsyncStorage.getItem(QUARTERLY_PAYMENTS_KEY);
  const list: QuarterlyPayment[] = raw ? JSON.parse(raw) : [];
  list.push(payment);
  await AsyncStorage.setItem(QUARTERLY_PAYMENTS_KEY, JSON.stringify(list));
}

/**
 * Get all quarterly payments for 2025.
 */
export async function getQuarterlyPayments(): Promise<QuarterlyPayment[]> {
  try {
    const raw = await AsyncStorage.getItem(QUARTERLY_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Total estimated tax payments (credit) to deduct from final tax bill.
 */
export async function getEstimatedTaxCredit(): Promise<number> {
  const payments = await getQuarterlyPayments();
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

// ---------- Phase 2: Mileage vs Actual Optimizer ----------

/**
 * Returns the GREATER of (miles * 0.70) OR sum of expenses.
 * Bug #8 FIX: Updated from $0.67 (2024) to $0.70 (2025) per IRS standard mileage rate.
 */
export function getOptimalDeduction(miles: number, expenses: number): number {
  const mileageDeduction = miles * 0.70;
  return Math.max(mileageDeduction, expenses);
}

// ---------- Phase 2: Draft Persistence ----------

export interface DraftReturnData {
  step: number;
  data: Record<string, unknown>;
}

export async function saveDraftReturn(step: number, data: Record<string, unknown>): Promise<void> {
  await AsyncStorage.setItem(DRAFT_RETURN_KEY, JSON.stringify({ step, data }));
}

export async function loadDraftReturn(): Promise<DraftReturnData | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { step?: number; data?: Record<string, unknown> };
    if (typeof parsed?.step !== 'number' || !parsed.data) return null;
    return { step: parsed.step, data: parsed.data };
  } catch {
    return null;
  }
}

export async function clearDraftReturn(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_RETURN_KEY);
}

// ---------- Advanced Tax Logic: calculateTaxLiability ----------

export type TaxLiabilityFilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_household';

export interface TaxLiabilityInput {
  filingStatus: TaxLiabilityFilingStatus;
  w2Incomes: { wages: number; withheld: number }[];
  income1099: { grossAmount: number; withheld?: number }[];
  expenses: number;
  estimatedPayments: number;
}

export interface TaxLiabilityOutput {
  totalIncome: number;
  standardDeduction: number;
  seTax: number;
  withholdingPayments: number;
  finalRefundOrDue: number;
  taxOnTaxable: number;
  totalTax: number;
}

/**
 * Advanced tax liability calculation for Review breakdown.
 * 2025: Standard deduction $15,000 single / $30,000 MFJ (Rev. Proc. 24-40).
 * SE tax: SS 12.4% capped at $176,100; Medicare 2.9%; Addl Medicare 0.9% over $200k/$250k.
 */
export function calculateTaxLiability(taxData: TaxLiabilityInput): TaxLiabilityOutput {
  const standardDeduction = taxData.filingStatus === 'married_joint' ? 30_000 : 15_000;
  const grossIncome =
    taxData.w2Incomes.reduce((s, w) => s + w.wages, 0) +
    taxData.income1099.reduce((s, i) => s + i.grossAmount, 0);
  const sum1099 = taxData.income1099.reduce((s, i) => s + i.grossAmount, 0);
  const netGigProfit = Math.max(0, sum1099 - taxData.expenses);
  const w2Total = taxData.w2Incomes.reduce((s, w) => s + w.wages, 0);
  const seTaxable = netGigProfit * TAX_CONSTANTS.SE_DEDUCTION_MULTIPLIER;
  const ssBase = Math.max(0, Math.min(TAX_CONSTANTS.SS_WAGE_BASE - w2Total, seTaxable));
  const ssTax = ssBase * TAX_CONSTANTS.SS_TAX_RATE;
  const medicareTax = seTaxable * TAX_CONSTANTS.MEDICARE_TAX_RATE;
  // Bug #7 FIX: MFS uses $125,000 threshold per IRS Form 8959
  const addlThreshold =
    (taxData.filingStatus as string) === 'married_separate' ? 125_000 :
    taxData.filingStatus === 'married_joint' ? TAX_CONSTANTS.ADDITIONAL_MEDICARE_THRESHOLD_MARRIED :
    TAX_CONSTANTS.ADDITIONAL_MEDICARE_THRESHOLD_SINGLE;
  const addlMedicare = Math.max(0, w2Total + seTaxable - addlThreshold) * TAX_CONSTANTS.ADDITIONAL_MEDICARE_RATE;
  const seTax = ssTax + medicareTax + addlMedicare;
  const taxableIncome = Math.max(
    0,
    grossIncome - taxData.expenses - standardDeduction - seTax * 0.5
  );
  const taxOnTaxable = calculateOrdinaryTax(taxableIncome, taxData.filingStatus as FilingStatus);
  const totalTax = taxOnTaxable + seTax;
  const withholdingPayments =
    taxData.w2Incomes.reduce((s, w) => s + w.withheld, 0) +
    taxData.income1099.reduce((s, i) => s + (i.withheld ?? 0), 0) +
    taxData.estimatedPayments;
  const finalRefundOrDue = totalTax - withholdingPayments;

  return {
    totalIncome: grossIncome,
    standardDeduction,
    seTax,
    withholdingPayments,
    finalRefundOrDue,
    taxOnTaxable,
    totalTax,
  };
}
