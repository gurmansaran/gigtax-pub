/**
 * Unified Tax Engine v2.0 — Single Source of Truth for GigTax
 * Consolidates fileNowTaxEngine.ts + fileNowEngine2025.ts + taxEngine.ts
 *
 * Tax Year 2025 · IRS Rev. Proc. 2024-40 · SSA Wage Base $176,100
 * Accuracy Target: 10/10
 */

import { CA_STANDARD_DEDUCTION_2025, calculateStateTax, calculateNonresidentStateTax, getStateStandardDeduction, calculateCASDI } from './stateTax';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_household';

/**
 * Wizard-compatible state for a full 1040 return.
 * Backward-compatible with fileNowTaxEngine.ts TaxReturnState.
 */
export interface TaxReturnState {
  filingStatus: FilingStatus;
  w2Incomes: Array<{ employer: string; wages: number; withheld: number }>;
  income1099: Array<{ source: string; grossAmount: number; tipPortion: number; withheld?: number; formType?: '1099-NEC' | '1099-K' | '1099-MISC' }>;
  capitalGains: number;              // Legacy combined field (backward compat)
  capitalGainsShortTerm: number;
  capitalGainsLongTerm: number;
  spouseIncome: number;
  spouseWithholding: number;
  dependents: number;
  iraContribution: number;
  estimatedTaxesPaid: number;
  studentLoanInterest: number;
  healthInsurancePremiums: number;
  stateOfResidence: string;
  mortgageInterest: number;
  mortgageBalance?: number;         // Outstanding mortgage principal (for $750K cap)
  propertyTaxes: number;
  charitableDonations: number;
  deductionType: 'Standard' | 'Itemized';
  unemploymentIncome: number;
  interestIncome: number;
  dividendIncome: number;
  socialSecurityIncome: number;
  rentalIncome: number;
  alimonyReceived: number;
  gamblingWinnings: number;
  educationExpenses: number;
  homeOffice: { sqFtUsed: number; method: 'simplified' | 'actual' } | null;
  lastYearTaxLiability: number;
  businessExpenses: number;
  parkingAndTolls: number;
  sepIraContribution: number;
  hsaContribution: number;
  hsaFamilyPlan: boolean;
  primary65Plus?: boolean;
  primaryBlind?: boolean;
  spouse65Plus?: boolean;
  spouseBlind?: boolean;
  dependentDetails?: Array<{ dateOfBirth?: string; relationship?: string }>;
  // Task 4: IRA phase-out
  coveredByWorkplacePlan?: boolean;
  spouseCoveredByWorkplacePlan?: boolean;
  // Task 5: Child Care Credit
  childCareExpenses: number;
  // Phone/Internet business use
  phoneMonthlyBill?: number;
  phoneBusinessUsePercent?: number; // 0-100
  internetMonthlyBill?: number;
  internetBusinessUsePercent?: number; // 0-100
  // Vehicle business use
  totalMilesDriven?: number; // Total miles (business + personal)
  businessMilesDriven?: number; // Business miles only
  actualVehicleExpenses?: number; // Total actual vehicle expenses before business %
  // Additional gig worker expense categories
  carWashExpenses?: number;
  roadsideAssistanceExpenses?: number;
  backgroundCheckExpenses?: number;
  workAppExpenses?: number;
  equipmentExpenses?: number;
  bankFeeExpenses?: number;
  // Vehicle depreciation
  vehicleDepreciation?: {
    purchasePrice: number;
    purchaseDate: string; // ISO date
    vehicleWeight: 'under6000' | '6000to14000' | 'over14000';
    depreciationMethod: 'macrs' | 'section179' | 'none';
    priorYearDepreciation: number; // Total depreciation already taken
    yearInService: number; // Which year of MACRS (1-5)
  };
  // Premium Tax Credit
  premiumTaxCredit?: {
    annualPremium: number;
    slcsp: number; // Second Lowest Cost Silver Plan
    aptcReceived: number; // Advance Premium Tax Credit received
    householdSize: number;
    householdIncome: number; // For FPL calculation
  };
  // ── Vulnerability Fix Fields ───────────────────────────────────────────────
  // #7: Qualified Dividends (subset of dividendIncome taxed at LTCG rates)
  qualifiedDividends?: number;
  // #8: QBI SSTB flag (Specified Service Trade or Business)
  isSSTB?: boolean;
  // #12: Dependent filing — limits standard deduction
  canBeClaimedAsDependent?: boolean;
  // #11: Employer health plan eligibility — blocks SE health insurance deduction
  eligibleForEmployerHealthPlan?: boolean;
  // #4: Capital loss carryforward from prior years
  priorYearCapitalLossCarryforward?: number;
  // #18: Net Operating Loss carryforward from prior years
  priorYearNOL?: number;
  // #1: ISO exercise income for AMT
  isoExerciseIncome?: number;
  // #17: Kiddie tax fields
  isSubjectToKiddieTax?: boolean;
  parentMarginalRate?: number; // Parent's top marginal rate (0.10–0.37)
  // #10: Prior year charitable carryforward
  priorCharitableCarryforward?: number;
  // v1.5: Multi-state
  workState?: string; // State where gig income is earned (if different from residence)
  workStateIncomePercent?: number; // % of gig/1099 income earned in work state (0–100)
}

export interface FinalTaxResult {
  grossIncome: number;
  totalTips: number;
  tipDeduction: number;
  agi: number;
  taxableIncome: number;
  tentativeTax: number;
  seTax: number;
  seTaxOnTips: number;
  seTaxDeduction: number;
  netBusinessIncome: number;
  qbiDeduction: number;
  ltcgTax: number;
  childTaxCredit: number;
  federalTax: number;
  estimatedStateTax: number;
  totalTax: number;
  totalWithholding: number;
  finalBillOrRefund: number;
  deductionMethod: 'Standard' | 'Itemized';
  deductionAmount: number;
  standardDeductionAmount: number;
  itemizedDeductionAmount: number;
  deductionSavings: number;
  saltDeduction: number;
  mortgageInterestCapped: number;
  homeOfficeDeduction: number;
  educationCredit: number;
  eitc: number;
  taxableSocialSecurity: number;
  penaltyRisk: {
    isAtRisk: boolean;
    requiredPayment: number;
    currentPayment: number;
    shortfall: number;
    estimatedPenalty: number; // Form 2210 dollar amount
    annualizedRate: number; // IRS underpayment rate
  };
  // New fields
  iraDeduction: number;
  sepIraDeduction: number;
  hsaDeduction: number;
  saversCredit: number;
  childCareCredit: number;
  niit: number;
  caSDI: number;
  vehicleDepreciationDeduction: number;
  premiumTaxCredit: number;
  excessAPTC: number; // Amount to repay if APTC > PTC
  effectiveFederalRate: number;
  effectiveStateRate: number;
  effectiveTotalRate: number;
  quarterlyEstimate: number;
  // ── Vulnerability Fix Output Fields ─────────────────────────────────────────
  // #1: AMT
  amt: number;
  amti: number;
  // #4: Capital loss cap
  capitalLossCarryforward: number;
  // #10: Charitable limits
  charitableCarryforward: number;
  allowableCharitable: number;
  // #9: Passive loss
  suspendedPassiveLoss: number;
  allowableRentalIncome: number;
  // #18: NOL
  nolDeduction: number;
  nolCarryforward: number;
  // #3/#15: Additional Medicare Tax breakdown
  additionalMedicareTaxTotal: number;
  additionalMedicareWithholding: number;
  // #17: Kiddie tax
  kiddieTax: number;
  // #7: Qualified dividend tax (taxed at preferential rates)
  qualifiedDividendTax: number;
  // v1.5: Multi-state tax breakdown
  workStateTax: number;
  homeStateTaxBeforeCredit: number;
  otherStateCredit: number;
  homeStateTaxAfterCredit: number;
  // Debug log (only populated when debug=true)
  debugLog?: TaxDebugStep[];
}

/** Individual debug step with calculation details */
export interface TaxDebugStep {
  step: string;
  label: string;
  inputs: Record<string, number | string | boolean>;
  output: number | string | Record<string, number | string | boolean>;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — IRS Rev. Proc. 2024-40 / SSA 2025
// ═══════════════════════════════════════════════════════════════════════════════

const STANDARD_DEDUCTION_BASE: Record<FilingStatus, number> = {
  single: 15_750,
  married_joint: 31_500,
  married_separate: 15_750,
  head_household: 23_625,
};

const SENIOR_BLIND_BOOST_SINGLE_HOH = 2_000;
const SENIOR_BLIND_BOOST_MFJ = 1_600;

// SALT cap: $40K for most filers ($20K MFS), with income-based phase-out
// Phase-out: -30% per $ of MAGI over $500K ($250K MFS), floor $10K
const SALT_CAP_BASE = 40_000;
const SALT_CAP_MFS = 20_000;
const SALT_CAP_FLOOR = 10_000;
const SALT_PHASEOUT_START = 500_000;
const SALT_PHASEOUT_START_MFS = 250_000;
const SALT_PHASEOUT_RATE = 0.30;
const CHILD_TAX_CREDIT = 2_200;
const OTHER_DEPENDENT_CREDIT = 500;
const SS_WAGE_BASE = 176_100;
const SS_TAX_RATE = 0.124;
const MEDICARE_TAX_RATE = 0.029;
const ADDITIONAL_MEDICARE_RATE = 0.009;
const ADDITIONAL_MEDICARE_THRESHOLD_SINGLE = 200_000;
const ADDITIONAL_MEDICARE_THRESHOLD_MARRIED = 250_000;
const SE_DEDUCTION_MULTIPLIER = 0.9235;

const QBI_RATE = 0.20;
const QBI_PHASE_OUT_START_SINGLE = 197_300;
const QBI_PHASE_OUT_END_SINGLE = 257_300;
const QBI_PHASE_OUT_START_MFJ = 394_600;
const QBI_PHASE_OUT_END_MFJ = 514_600;

const HSA_LIMIT_SELF = 4_300;
const HSA_LIMIT_FAMILY = 8_550;
const SEP_IRA_MAX = 69_000;
const IRA_MAX = 7_000;

// IRA Phase-out ranges (Task 4)
const IRA_PHASEOUT: Record<FilingStatus, { start: number; end: number }> = {
  single: { start: 79_000, end: 89_000 },
  married_joint: { start: 126_000, end: 146_000 },
  married_separate: { start: 0, end: 10_000 },
  head_household: { start: 79_000, end: 89_000 },
};

// State tax: used only for SALT approximation when computing itemized deductions
const STATE_TAX_RATES: Record<string, number> = {
  CA: 0.093, NY: 0.06, TX: 0.00, FL: 0.00, WA: 0.00,
  NV: 0.00, TN: 0.00, SD: 0.00, WY: 0.00, NH: 0.00,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAX BRACKETS — IRS Rev. Proc. 2024-40
// ═══════════════════════════════════════════════════════════════════════════════

const TAX_BRACKETS: Record<FilingStatus, Array<{ min: number; max: number; rate: number }>> = {
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

const LTCG_BRACKETS: Record<FilingStatus, Array<{ min: number; max: number; rate: number }>> = {
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
    { min: 48_350, max: 300_000, rate: 0.15 },
    { min: 300_000, max: Infinity, rate: 0.20 },
  ],
  head_household: [
    { min: 0, max: 64_750, rate: 0 },
    { min: 64_750, max: 566_700, rate: 0.15 },
    { min: 566_700, max: Infinity, rate: 0.20 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// EITC 2025 Full Table (Task 3)
// ═══════════════════════════════════════════════════════════════════════════════

const EITC_2025 = {
  maxCredit: { 0: 649, 1: 4_328, 2: 7_152, 3: 8_046 } as Record<number, number>,
  phaseInRate: { 0: 0.0765, 1: 0.34, 2: 0.40, 3: 0.45 } as Record<number, number>,
  phaseOutRate: { 0: 0.0765, 1: 0.1598, 2: 0.2106, 3: 0.2106 } as Record<number, number>,
  earnedIncomeAmount: { 0: 8_490, 1: 12_730, 2: 17_880, 3: 17_880 } as Record<number, number>,
  phaseOutStart: {
    single: { 0: 10_620, 1: 22_700, 2: 22_700, 3: 22_700 } as Record<number, number>,
    married_joint: { 0: 17_740, 1: 29_820, 2: 29_820, 3: 29_820 } as Record<number, number>,
  },
  investmentIncomeLimit: 11_950,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Saver's Credit 2025 (Task 5)
// ═══════════════════════════════════════════════════════════════════════════════

const SAVERS_CREDIT_2025: Record<string, Array<{ maxAGI: number; rate: number }>> = {
  single: [
    { maxAGI: 23_750, rate: 0.50 },
    { maxAGI: 25_750, rate: 0.20 },
    { maxAGI: 39_500, rate: 0.10 },
  ],
  married_joint: [
    { maxAGI: 47_500, rate: 0.50 },
    { maxAGI: 51_500, rate: 0.20 },
    { maxAGI: 79_000, rate: 0.10 },
  ],
  head_household: [
    { maxAGI: 35_625, rate: 0.50 },
    { maxAGI: 38_625, rate: 0.20 },
    { maxAGI: 59_250, rate: 0.10 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// NIIT Thresholds (Task 7)
// ═══════════════════════════════════════════════════════════════════════════════

const NIIT_RATE = 0.038;
const NIIT_THRESHOLD: Record<FilingStatus, number> = {
  single: 200_000,
  married_joint: 250_000,
  married_separate: 125_000,
  head_household: 200_000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (private)
// ═══════════════════════════════════════════════════════════════════════════════

/** Generic progressive tax calculator */
function calculateProgressiveTax(
  income: number,
  brackets: Array<{ min: number; max: number; rate: number }>
): number {
  if (income <= 0) return 0;
  let tax = 0;
  let remaining = income;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const inBracket = Math.min(remaining, b.max - b.min);
    tax += inBracket * b.rate;
    remaining -= inBracket;
  }
  return tax;
}

/** Age as of Dec 31 of the given tax year from YYYY-MM-DD.
 *  Since Dec 31 is the last day of the year, every birthday has occurred by then,
 *  so age = taxYear - birthYear. */
function ageAsOfDec31(dateOfBirth: string | undefined, taxYear: number = 2025): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const y = parseInt(dateOfBirth.split('-')[0], 10);
  const age = taxYear - y;
  if (age < 0) return 0;
  return age;
}

/** @deprecated Use ageAsOfDec31 with explicit taxYear instead */
function ageAsOfDec31_2025(dateOfBirth: string | undefined): number | null {
  return ageAsOfDec31(dateOfBirth, 2025);
}

/** CTC $2,000: under 17 and child/sibling/other. ODC $500: 17+ or parent. */
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

/**
 * Self-employment tax with SS cap, Medicare, and Additional Medicare.
 * FIX #2: Unified SE base — prevents tip overcounting (total never exceeds netBiz × 0.9235)
 * FIX #3: Returns Additional Medicare Tax separately for Form 8959 reconciliation
 */
function calculateSelfEmploymentTax(
  netBusinessIncome: number,
  totalTips: number,
  w2Total: number,
  filingStatus: FilingStatus
): {
  seTax: number; seTaxOnTips: number; additionalMedicareTax: number;
  additionalMedicareTaxTotal: number; employerAdditionalMedicareWithheld: number
} {
  // FIX #2: Compute total SE base as a single unified value
  const totalSEBase = Math.max(0, netBusinessIncome) * SE_DEDUCTION_MULTIPLIER;

  // Apportion tips within the total (not additive — prevents overcounting)
  const tipRatio = netBusinessIncome > 0 ? Math.min(1, totalTips / netBusinessIncome) : 0;
  const tipSEBase = totalSEBase * tipRatio;
  const nonTipSEBase = totalSEBase * (1 - tipRatio);

  // Core SE tax (12.4% SS + 2.9% Medicare)
  const remainingSSBase = Math.max(0, SS_WAGE_BASE - w2Total);
  const ssTaxable = Math.min(totalSEBase, remainingSSBase);
  const coreSETax = (ssTaxable * SS_TAX_RATE) + (totalSEBase * MEDICARE_TAX_RATE);

  // Split SE tax on tips proportionally for display
  const seTaxOnTips = totalSEBase > 0 ? coreSETax * tipRatio : 0;

  // Additional Medicare Tax (0.9%) — computed on combined wages + SE above threshold
  const additionalMedicareThreshold =
    filingStatus === 'married_separate' ? 125_000 :
      filingStatus === 'married_joint' ? ADDITIONAL_MEDICARE_THRESHOLD_MARRIED :
        ADDITIONAL_MEDICARE_THRESHOLD_SINGLE;
  const totalForAdditionalMedicare = w2Total + totalSEBase;
  const additionalMedicareBase = Math.max(0, totalForAdditionalMedicare - additionalMedicareThreshold);
  const additionalMedicareTaxTotal = additionalMedicareBase * ADDITIONAL_MEDICARE_RATE;

  // FIX #3: Employer withholding credit — employers withhold 0.9% on W-2 wages > $200K
  const employerAdditionalMedicareWithheld = Math.max(0, w2Total - 200_000) * ADDITIONAL_MEDICARE_RATE;
  const additionalMedicareTax = Math.max(0, additionalMedicareTaxTotal - employerAdditionalMedicareWithheld);

  const seTax = coreSETax + additionalMedicareTax;
  return {
    seTax, seTaxOnTips, additionalMedicareTax,
    additionalMedicareTaxTotal, employerAdditionalMedicareWithheld
  };
}

/**
 * QBI deduction (Section 199A) with phase-out.
 * FIX #8: Handles SSTB vs non-SSTB with correct thresholds.
 * SSTB phase-out: $197,300–$247,300 Single | $394,600–$494,600 MFJ (50K/100K range)
 * Non-SSTB phase-out: $197,300–$257,300 Single | $394,600–$514,600 MFJ (60K/120K range)
 */
function calculateQBIDeduction(
  filingStatus: FilingStatus,
  agi: number,
  netBusinessIncome: number,
  deductionAmount: number,
  isSSTB: boolean = false
): number {
  const taxableBeforeQbi = Math.max(0, agi - deductionAmount);
  const rawQbi = netBusinessIncome * QBI_RATE;
  const cap = Math.min(rawQbi, taxableBeforeQbi);
  if (cap <= 0) return 0;

  const isMFJ = filingStatus === 'married_joint';
  const start = isMFJ ? QBI_PHASE_OUT_START_MFJ : QBI_PHASE_OUT_START_SINGLE;
  // FIX #8: SSTB uses shorter phase-out range
  const end = isSSTB
    ? (isMFJ ? 494_600 : 247_300)  // SSTB: 50K/100K range
    : (isMFJ ? QBI_PHASE_OUT_END_MFJ : QBI_PHASE_OUT_END_SINGLE); // Non-SSTB: 60K/120K range
  if (taxableBeforeQbi <= start) return cap;
  if (taxableBeforeQbi >= end) {
    if (isSSTB) return 0; // SSTB: completely eliminated above threshold
    return 0; // Non-SSTB: also 0 (simplified — full W-2/UBIA logic would allow partial)
  }
  const phaseOutFraction = (taxableBeforeQbi - start) / (end - start);
  if (isSSTB) {
    // For SSTB: reduce both the QBI and the deduction percentage
    const reducedQBI = netBusinessIncome * (1 - phaseOutFraction);
    return Math.round(Math.min(reducedQBI * QBI_RATE, taxableBeforeQbi) * (1 - phaseOutFraction) * 100) / 100;
  }
  return Math.round(cap * (1 - phaseOutFraction) * 100) / 100;
}

/** LTCG preferential tax (0/15/20%) stacked on ordinary income */
function calculateLTCGTax(
  ltcgAmount: number,
  stackedOrdinaryIncome: number,
  filingStatus: FilingStatus
): number {
  if (ltcgAmount <= 0) return 0;
  const ltcgBrackets = LTCG_BRACKETS[filingStatus];
  let tax = 0;
  let remaining = ltcgAmount;
  let base = stackedOrdinaryIncome;
  for (const b of ltcgBrackets) {
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
 * Social Security 0-85% taxation.
 * Single/HoH: $25k/$34k thresholds. MFJ: $32k/$44k. MFS: 85% always.
 */
function calculateTaxableSocialSecurity(
  ssIncome: number,
  otherIncome: number,
  filingStatus: FilingStatus
): number {
  if (ssIncome <= 0) return 0;
  if (filingStatus === 'married_separate') return ssIncome * 0.85;

  const combinedIncome = otherIncome + ssIncome * 0.5;
  const isMFJ = filingStatus === 'married_joint';
  const tier1Threshold = isMFJ ? 32_000 : 25_000;
  const tier2Threshold = isMFJ ? 44_000 : 34_000;

  if (combinedIncome <= tier1Threshold) return 0;

  if (combinedIncome <= tier2Threshold) {
    const excess = combinedIncome - tier1Threshold;
    return Math.min(ssIncome * 0.50, excess * 0.50);
  }

  const tier1Amount = Math.min((tier2Threshold - tier1Threshold) * 0.50, ssIncome * 0.50);
  const tier2Excess = combinedIncome - tier2Threshold;
  const tier2Amount = tier2Excess * 0.85;
  return Math.min(ssIncome * 0.85, tier1Amount + tier2Amount);
}

/**
 * EITC with full 2025 table.
 * 1. Investment income disqualification (>$11,600)
 * 2. Phase-in: credit = min(earnedIncome * phaseInRate, maxCredit)
 * 3. Phase-out: reduction = (AGI - phaseOutStart) * phaseOutRate
 * 4. Final = max(0, phaseInCredit - reduction)
 * 5. Cap qualifying children at 3
 * 6. Use 'single' rates for HoH and MFS
 */
function calculateEITC(
  agi: number,
  earnedIncome: number,
  investmentIncome: number,
  filingStatus: FilingStatus,
  numChildren: number
): number {
  // FIX #6: MFS filers are ineligible for EITC (IRC § 32(d))
  if (filingStatus === 'married_separate') return 0;

  // Investment income disqualification
  if (investmentIncome > EITC_2025.investmentIncomeLimit) return 0;

  // Cap children at 3
  const kids = Math.min(Math.max(numChildren, 0), 3);

  const maxCredit = EITC_2025.maxCredit[kids] ?? 0;
  const phaseInRate = EITC_2025.phaseInRate[kids] ?? 0;
  const phaseOutRate = EITC_2025.phaseOutRate[kids] ?? 0;

  // Phase-in: credit = min(earnedIncome * phaseInRate, maxCredit)
  const phaseInCredit = Math.min(earnedIncome * phaseInRate, maxCredit);

  // Determine phase-out start – use 'single' for HoH and MFS
  const statusKey = filingStatus === 'married_joint' ? 'married_joint' : 'single';
  const phaseOutStart = EITC_2025.phaseOutStart[statusKey][kids] ?? 0;

  // Phase-out reduction
  let reduction = 0;
  if (agi > phaseOutStart) {
    reduction = (agi - phaseOutStart) * phaseOutRate;
  }

  return Math.max(0, phaseInCredit - reduction);
}

/** American Opportunity Tax Credit (AOTC) */
function calculateEducationCredit(
  expenses: number,
  agi: number,
  filingStatus: FilingStatus
): number {
  if (expenses <= 0) return 0;

  const phaseOutStart = filingStatus === 'married_joint' ? 160_000 : 80_000;
  const phaseOutEnd = filingStatus === 'married_joint' ? 180_000 : 90_000;

  if (agi >= phaseOutEnd) return 0;

  const fullCredit = Math.min(2_000, expenses) +
    Math.min(500, Math.max(0, expenses - 2_000) * 0.25);
  const maxCredit = Math.min(2_500, fullCredit);

  if (agi <= phaseOutStart) return maxCredit;

  const reduction = (agi - phaseOutStart) / (phaseOutEnd - phaseOutStart);
  return Math.max(0, maxCredit * (1 - reduction));
}

/**
 * Saver's Credit (Task 5)
 * Credit = rate × min(total retirement contributions, $2,000 single / $4,000 MFJ)
 */
function calculateSaversCredit(
  agi: number,
  retirementContributions: number,
  filingStatus: FilingStatus
): number {
  if (retirementContributions <= 0) return 0;

  // MFS not eligible for Saver's Credit
  const statusKey = filingStatus === 'married_separate' ? 'single' : filingStatus;
  const tiers = SAVERS_CREDIT_2025[statusKey];
  if (!tiers) return 0;

  let rate = 0;
  for (const tier of tiers) {
    if (agi <= tier.maxAGI) {
      rate = tier.rate;
      break;
    }
  }
  if (rate === 0) return 0;

  const maxEligible = filingStatus === 'married_joint' ? 4_000 : 2_000;
  return rate * Math.min(retirementContributions, maxEligible);
}

/**
 * Child Care Credit (Task 5)
 * Expenses capped at $3,000 (1 dependent under 13) or $6,000 (2+).
 * Rate starts at 35%, decreases by 1% for each $2,000 over $15,000, minimum 20%.
 */
function calculateChildCareCredit(
  expenses: number,
  agi: number,
  dependentsUnder13: number
): number {
  if (expenses <= 0 || dependentsUnder13 <= 0) return 0;

  const expenseCap = dependentsUnder13 >= 2 ? 6_000 : 3_000;
  const eligibleExpenses = Math.min(expenses, expenseCap);

  // Rate starts at 35%, decreases by 1% per $2,000 over $15,000, min 20%
  let rate = 0.35;
  if (agi > 15_000) {
    const reduction = Math.floor((agi - 15_000) / 2_000) * 0.01;
    rate = Math.max(0.20, 0.35 - reduction);
  }

  return eligibleExpenses * rate;
}

/**
 * Net Investment Income Tax (Task 7)
 * 3.8% on min(investment income, AGI - threshold)
 */
function calculateNIIT(
  investmentIncome: number,
  magi: number,
  filingStatus: FilingStatus
): number {
  if (investmentIncome <= 0) return 0;
  const threshold = NIIT_THRESHOLD[filingStatus];
  const excess = magi - threshold;
  if (excess <= 0) return 0;
  return Math.min(investmentIncome, excess) * NIIT_RATE;
}

/**
 * IRA Deduction with phase-out (Task 4)
 * If not covered by workplace plan, full deduction up to IRA_MAX.
 * If covered, apply linear phase-out based on MAGI.
 */
function calculateIRADeduction(
  contribution: number,
  magi: number,
  filingStatus: FilingStatus,
  coveredByWorkplacePlan: boolean
): number {
  if (contribution <= 0) return 0;
  const capped = Math.min(contribution, IRA_MAX);

  if (!coveredByWorkplacePlan) return capped;

  const phaseout = IRA_PHASEOUT[filingStatus];
  if (magi <= phaseout.start) return capped;
  if (magi >= phaseout.end) return 0;

  const fraction = (magi - phaseout.start) / (phaseout.end - phaseout.start);
  const allowed = IRA_MAX * (1 - fraction);
  return Math.min(capped, Math.max(0, Math.round(allowed)));
}

/**
 * Vehicle Depreciation — MACRS 5-year and Section 179
 * IRS 2025 limits for passenger vehicles (under 6,000 lbs GVW):
 *   Year 1: $12,400 (with bonus) / $12,400; Year 2: $19,800; Year 3: $11,900; Year 4+: $7,160
 * Heavy SUVs (6,000–14,000 lbs): Section 179 up to $30,500, then MACRS on remainder
 * Over 14,000 lbs: Full Section 179 (up to $1,220,000 for 2025)
 */
const MACRS_5YEAR_RATES = [0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576]; // Half-year convention
const VEHICLE_DEPRECIATION_CAPS = {
  year1: 12_400,
  year2: 19_800,
  year3: 11_900,
  year4Plus: 7_160,
};
const SECTION_179_MAX_2025 = 1_220_000;
const SECTION_179_SUV_CAP = 30_500;

function calculateVehicleDepreciation(
  vehicleDepreciation: NonNullable<TaxReturnState['vehicleDepreciation']>,
  businessUsePercent: number
): { depreciationDeduction: number; method: string } {
  if (!vehicleDepreciation || vehicleDepreciation.depreciationMethod === 'none') {
    return { depreciationDeduction: 0, method: 'none' };
  }

  const { purchasePrice, vehicleWeight, depreciationMethod, yearInService } = vehicleDepreciation;
  const businessFraction = Math.min(1, Math.max(0, businessUsePercent / 100));

  if (depreciationMethod === 'section179') {
    let maxDeduction: number;
    if (vehicleWeight === 'over14000') {
      maxDeduction = Math.min(purchasePrice, SECTION_179_MAX_2025);
    } else if (vehicleWeight === '6000to14000') {
      maxDeduction = Math.min(purchasePrice, SECTION_179_SUV_CAP);
    } else {
      // Under 6,000 lbs — subject to luxury vehicle caps
      maxDeduction = Math.min(purchasePrice, VEHICLE_DEPRECIATION_CAPS.year1);
    }
    const deduction = Math.round(maxDeduction * businessFraction);
    return { depreciationDeduction: deduction, method: 'Section 179' };
  }

  // MACRS 5-year schedule
  const year = Math.max(1, Math.min(6, yearInService));
  const yearIndex = year - 1;

  if (vehicleWeight === 'under6000') {
    // Subject to luxury vehicle limits
    const cap = year === 1 ? VEHICLE_DEPRECIATION_CAPS.year1
      : year === 2 ? VEHICLE_DEPRECIATION_CAPS.year2
        : year === 3 ? VEHICLE_DEPRECIATION_CAPS.year3
          : VEHICLE_DEPRECIATION_CAPS.year4Plus;
    const rawDepreciation = purchasePrice * (MACRS_5YEAR_RATES[yearIndex] ?? 0);
    const capped = Math.min(rawDepreciation, cap);
    return { depreciationDeduction: Math.round(capped * businessFraction), method: `MACRS Year ${year}` };
  }

  // Heavy vehicle — no luxury caps
  const rawDepreciation = purchasePrice * (MACRS_5YEAR_RATES[yearIndex] ?? 0);
  return { depreciationDeduction: Math.round(rawDepreciation * businessFraction), method: `MACRS Year ${year}` };
}

/**
 * Premium Tax Credit (PTC) — ACA Marketplace, Form 8962
 * 2025 FPL for contiguous 48 states: $15,060 base + $5,380 per additional person
 * Applicable percentage table (IRA extended through 2025):
 *   100-150% FPL: 0% - 0%
 *   150-200%: 0% - 2.0%
 *   200-250%: 2.0% - 4.0%
 *   250-300%: 4.0% - 6.0%
 *   300-400%: 6.0% - 8.5%
 *   400%+: 8.5% (IRA extension — previously cliff at 400%)
 */
const FPL_2025_BASE = 15_060;
const FPL_2025_PER_PERSON = 5_380;

function getFPL2025(householdSize: number): number {
  return FPL_2025_BASE + (Math.max(0, householdSize - 1)) * FPL_2025_PER_PERSON;
}

function getApplicablePercentage(fplPercent: number): number {
  if (fplPercent < 100) return 0; // Not eligible below 100% FPL (Medicaid range)
  if (fplPercent <= 150) return 0;
  if (fplPercent <= 200) return 0.02 * ((fplPercent - 150) / 50);
  if (fplPercent <= 250) return 0.02 + 0.02 * ((fplPercent - 200) / 50);
  if (fplPercent <= 300) return 0.04 + 0.02 * ((fplPercent - 250) / 50);
  if (fplPercent <= 400) return 0.06 + 0.025 * ((fplPercent - 300) / 100);
  return 0.085; // 400%+ FPL (IRA extension keeps eligibility)
}

function calculatePremiumTaxCredit(
  ptcData: NonNullable<TaxReturnState['premiumTaxCredit']>,
  householdIncome: number
): { premiumTaxCredit: number; excessAPTC: number } {
  if (!ptcData || ptcData.annualPremium <= 0 || ptcData.slcsp <= 0) {
    // No marketplace insurance — if APTC was received, it must be repaid
    if (ptcData?.aptcReceived > 0) {
      return { premiumTaxCredit: 0, excessAPTC: ptcData.aptcReceived };
    }
    return { premiumTaxCredit: 0, excessAPTC: 0 };
  }

  const fpl = getFPL2025(ptcData.householdSize || 1);
  const incomeForFPL = ptcData.householdIncome > 0 ? ptcData.householdIncome : householdIncome;
  const fplPercent = fpl > 0 ? (incomeForFPL / fpl) * 100 : 0;

  if (fplPercent < 100) {
    // Below 100% FPL — not eligible for PTC (Medicaid eligible)
    return { premiumTaxCredit: 0, excessAPTC: ptcData.aptcReceived ?? 0 };
  }

  const applicablePercent = getApplicablePercentage(fplPercent);
  const expectedContribution = incomeForFPL * applicablePercent;
  const maxPTC = Math.max(0, ptcData.slcsp - expectedContribution);
  const actualPTC = Math.min(maxPTC, ptcData.annualPremium); // Can't exceed actual premium

  const excessAPTC = Math.max(0, (ptcData.aptcReceived ?? 0) - actualPTC);

  return { premiumTaxCredit: Math.round(actualPTC), excessAPTC: Math.round(excessAPTC) };
}

/**
 * Form 2210 Underpayment Penalty Calculation
 * IRS underpayment rate for 2025: 7% annually (federal short-term rate + 3%)
 * Penalty = shortfall × rate × days_late / 365
 *
 * Quarterly due dates: Q1 Apr 15, Q2 Jun 16, Q3 Sep 15, Q4 Jan 15 (next year)
 * Simplified: assumes equal quarterly payments and calculates per-quarter penalty
 * Exception: No penalty if total tax < $1,000 or if 100%/110% safe harbor met
 */
const IRS_UNDERPAYMENT_RATE_2025 = 0.07;

// Days between each quarterly due date and the filing deadline (Apr 15 next year)
const QUARTERLY_PENALTY_DAYS = [365, 303, 213, 90]; // Q1-Q4 approximation

function calculateUnderpaymentPenalty(
  totalTax: number,
  totalPaid: number,
  estimatedTaxesPaid: number,
  lastYearTaxLiability: number,
  filingStatus: FilingStatus,
  agi: number
): { estimatedPenalty: number; annualizedRate: number } {
  // Exception 1: No penalty if total tax < $1,000
  if (totalTax < 1_000) {
    return { estimatedPenalty: 0, annualizedRate: IRS_UNDERPAYMENT_RATE_2025 };
  }

  // Safe harbor: 90% of current year OR 100%/110% of prior year
  const requiredPayment90 = totalTax * 0.90;
  const highIncomeThreshold = filingStatus === 'married_separate' ? 75_000 : 150_000;
  const safeHarborMultiplier = agi > highIncomeThreshold ? 1.10 : 1.00;
  const requiredPaymentPrior = lastYearTaxLiability > 0
    ? lastYearTaxLiability * safeHarborMultiplier
    : totalTax * 0.90;
  const requiredPayment = Math.min(requiredPayment90, requiredPaymentPrior);

  if (totalPaid >= requiredPayment) {
    return { estimatedPenalty: 0, annualizedRate: IRS_UNDERPAYMENT_RATE_2025 };
  }

  // Calculate quarterly underpayment
  // Assume withholding is spread evenly across 4 quarters
  const requiredPerQuarter = requiredPayment / 4;
  const withholding = totalPaid - estimatedTaxesPaid;
  const withholdingPerQuarter = withholding / 4;
  const estimatedPerQuarter = estimatedTaxesPaid / 4;
  const paidPerQuarter = withholdingPerQuarter + estimatedPerQuarter;

  let totalPenalty = 0;
  for (let q = 0; q < 4; q++) {
    const shortfall = Math.max(0, requiredPerQuarter - paidPerQuarter);
    if (shortfall > 0) {
      const days = QUARTERLY_PENALTY_DAYS[q];
      totalPenalty += shortfall * IRS_UNDERPAYMENT_RATE_2025 * (days / 365);
    }
  }

  return {
    estimatedPenalty: Math.round(totalPenalty),
    annualizedRate: IRS_UNDERPAYMENT_RATE_2025,
  };
}

/** Calculate tax savings from tip exemption */
function calculateTipTaxSavings(tips: number, filingStatus: FilingStatus): number {
  return calculateProgressiveTax(tips, TAX_BRACKETS[filingStatus]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CALCULATION — calculateUnifiedTax
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateUnifiedTax(data: TaxReturnState, debug: boolean = false): FinalTaxResult {
  const log: TaxDebugStep[] = [];
  const d = (step: string, label: string, inputs: Record<string, any>, output: any, notes?: string) => {
    if (debug) log.push({ step, label, inputs, output, notes });
  };

  const brackets = TAX_BRACKETS[data.filingStatus];

  d('0', 'Filing Status & Config', {
    filingStatus: data.filingStatus,
    dependents: data.dependents ?? 0,
    stateOfResidence: data.stateOfResidence,
    deductionType: data.deductionType,
    primary65Plus: !!data.primary65Plus,
    primaryBlind: !!data.primaryBlind,
  }, data.filingStatus);

  // ── Standard Deduction (with senior/blind boost) ──────────────────────────
  const baseDeduction = STANDARD_DEDUCTION_BASE[data.filingStatus];
  const isMFJorMFS = data.filingStatus === 'married_joint' || data.filingStatus === 'married_separate';
  const boostPerBox = isMFJorMFS ? SENIOR_BLIND_BOOST_MFJ : SENIOR_BLIND_BOOST_SINGLE_HOH;
  let seniorBlindBoost = 0;
  if (data.primary65Plus) seniorBlindBoost += boostPerBox;
  if (data.primaryBlind) seniorBlindBoost += boostPerBox;
  if (data.spouse65Plus) seniorBlindBoost += boostPerBox;
  if (data.spouseBlind) seniorBlindBoost += boostPerBox;
  const standardDeductionAmountBase = baseDeduction + seniorBlindBoost;

  // FIX #12: Dependent standard deduction — limited if claimed as dependent
  let standardDeductionAmount = standardDeductionAmountBase;
  if (data.canBeClaimedAsDependent) {
    const w2TotalForDep = data.w2Incomes.reduce((sum, w2) => sum + w2.wages, 0);
    const income1099TotalForDep = data.income1099.reduce((sum, i) => sum + i.grossAmount, 0);
    const earnedIncomeForDep = w2TotalForDep + income1099TotalForDep;
    const dependentStdDed = Math.min(
      standardDeductionAmountBase, // Can't exceed normal amount
      Math.max(1_350, earnedIncomeForDep + 450)
    );
    standardDeductionAmount = dependentStdDed + seniorBlindBoost;
  }

  d('0a', 'Standard Deduction', {
    baseDeduction,
    seniorBlindBoost,
    boostPerBox,
  }, standardDeductionAmount);

  // ── Step 1: Sum W-2 wages and withholding ─────────────────────────────────
  const w2Total = data.w2Incomes.reduce((sum, w2) => sum + w2.wages, 0);
  const w2Withholding = data.w2Incomes.reduce((sum, w2) => sum + w2.withheld, 0);

  d('1', 'W-2 Income', {
    w2Count: data.w2Incomes.length,
    wages: data.w2Incomes.map(w => w.wages),
    withheld: data.w2Incomes.map(w => w.withheld),
  }, { w2Total, w2Withholding });

  // ── Step 2: Sum 1099 gross income, tips, withholding ──────────────────────
  const income1099Total = data.income1099.reduce((sum, i) => sum + i.grossAmount, 0);
  const totalTips = data.income1099.reduce((sum, i) => sum + i.tipPortion, 0);
  const withholding1099 = data.income1099.reduce((sum, i) => sum + (i.withheld ?? 0), 0);

  d('2', '1099 Income', {
    count1099: data.income1099.length,
    grossAmounts: data.income1099.map(i => i.grossAmount),
    tips: data.income1099.map(i => i.tipPortion),
  }, { income1099Total, totalTips, withholding1099 });

  // ── Step 3: Net business income (gross 1099 − expenses − parking/tolls − depreciation) ───
  // Calculate vehicle depreciation if applicable
  const vehicleBusinessPercent = (data.totalMilesDriven ?? 0) > 0 && (data.businessMilesDriven ?? 0) > 0
    ? Math.round(((data.businessMilesDriven ?? 0) / (data.totalMilesDriven ?? 1)) * 100)
    : 0;
  const vehicleDepResult = data.vehicleDepreciation
    ? calculateVehicleDepreciation(data.vehicleDepreciation, vehicleBusinessPercent)
    : { depreciationDeduction: 0, method: 'none' };
  const totalBusinessExpenses = (data.businessExpenses ?? 0) + (data.parkingAndTolls ?? 0) + vehicleDepResult.depreciationDeduction;
  const netBusinessIncome = Math.max(0, income1099Total - totalBusinessExpenses);

  d('3', 'Net Business Income', {
    income1099Total,
    businessExpenses: data.businessExpenses ?? 0,
    parkingAndTolls: data.parkingAndTolls ?? 0,
    vehicleDepreciation: vehicleDepResult.depreciationDeduction,
    vehicleDepMethod: vehicleDepResult.method,
    totalBusinessExpenses,
  }, netBusinessIncome, 'max(0, gross1099 - expenses - depreciation)');

  // ── Step 4: Capital gains (backward compat for legacy capitalGains) ───────
  //    FIX #4: Apply $3K capital loss cap and carryforward
  const shortTermCG = data.capitalGainsShortTerm ?? 0;
  const longTermCG = data.capitalGainsLongTerm ?? 0;
  const hasNewCGFields = shortTermCG !== 0 || longTermCG !== 0;
  const effectiveSTCG = hasNewCGFields ? shortTermCG : (data.capitalGains ?? 0);
  const effectiveLTCG = hasNewCGFields ? longTermCG : 0;

  // Apply prior-year carryforward to reduce net capital
  const priorCarryforward = data.priorYearCapitalLossCarryforward ?? 0;
  const rawNetCapitalGainLoss = effectiveSTCG + effectiveLTCG - priorCarryforward;

  // FIX #4: Cap net capital losses at $3K ($1,500 for MFS)
  const capLossLimit = data.filingStatus === 'married_separate' ? 1_500 : 3_000;
  let capitalGainsForGross: number;
  let capitalLossDeduction: number;
  let capitalLossCarryforward: number;

  if (rawNetCapitalGainLoss >= 0) {
    capitalGainsForGross = rawNetCapitalGainLoss;
    capitalLossDeduction = 0;
    capitalLossCarryforward = 0;
  } else {
    capitalGainsForGross = 0;
    capitalLossDeduction = Math.min(Math.abs(rawNetCapitalGainLoss), capLossLimit);
    capitalLossCarryforward = Math.abs(rawNetCapitalGainLoss) - capitalLossDeduction;
  }
  const totalCapitalGains = capitalGainsForGross - capitalLossDeduction;

  d('4', 'Capital Gains (with $3K loss cap)', {
    shortTermCG,
    longTermCG,
    priorCarryforward,
    rawNetCapitalGainLoss,
    capLossLimit,
    capitalLossDeduction,
    capitalLossCarryforward,
  }, { totalCapitalGains, capitalGainsForGross });

  // ── Step 5: Taxable social security (0-85% rule) ──────────────────────────
  const ssIncome = data.socialSecurityIncome ?? 0;
  const otherIncomeForSS =
    w2Total + netBusinessIncome + effectiveSTCG + effectiveLTCG + data.spouseIncome +
    (data.unemploymentIncome ?? 0) + (data.interestIncome ?? 0) + (data.dividendIncome ?? 0) +
    (data.rentalIncome ?? 0) + (data.alimonyReceived ?? 0) + (data.gamblingWinnings ?? 0);
  const taxableSocialSecurity = calculateTaxableSocialSecurity(ssIncome, otherIncomeForSS, data.filingStatus);

  d('5', 'Taxable Social Security', {
    ssIncome,
    otherIncomeForSS,
  }, taxableSocialSecurity, '0-85% rule based on combined income');

  // ── Step 6: Gross income ──────────────────────────────────────────────────
  //    FIX #9: Apply passive loss rules to rental income
  const rawRentalIncome = data.rentalIncome ?? 0;
  let allowableRentalIncome = rawRentalIncome;
  let suspendedPassiveLoss = 0;

  if (rawRentalIncome < 0) {
    const rentalLoss = Math.abs(rawRentalIncome);
    // MFS filers generally get $0 allowance
    const maxPassiveAllowance = data.filingStatus === 'married_separate' ? 0 : 25_000;
    // AGI phase-out ($100K–$150K) — use preliminary AGI estimate
    const prelimAgi = w2Total + netBusinessIncome + totalCapitalGains + (data.spouseIncome ?? 0) +
      (data.unemploymentIncome ?? 0) + (data.interestIncome ?? 0) + (data.dividendIncome ?? 0) +
      taxableSocialSecurity + (data.alimonyReceived ?? 0) + (data.gamblingWinnings ?? 0);
    let passiveAllowance: number;
    if (prelimAgi <= 100_000) {
      passiveAllowance = maxPassiveAllowance;
    } else if (prelimAgi >= 150_000) {
      passiveAllowance = 0;
    } else {
      const reduction = (prelimAgi - 100_000) * 0.50;
      passiveAllowance = Math.max(0, maxPassiveAllowance - reduction);
    }
    const allowableRentalLoss = Math.min(rentalLoss, passiveAllowance);
    allowableRentalIncome = -allowableRentalLoss || 0;
    suspendedPassiveLoss = rentalLoss - allowableRentalLoss;
  }

  const grossIncome =
    w2Total + netBusinessIncome + totalCapitalGains + (data.spouseIncome ?? 0) +
    (data.unemploymentIncome ?? 0) + (data.interestIncome ?? 0) + (data.dividendIncome ?? 0) +
    taxableSocialSecurity + allowableRentalIncome + (data.alimonyReceived ?? 0) +
    (data.gamblingWinnings ?? 0);

  d('6', 'Gross Income (with passive loss rules)', {
    w2Total,
    netBusinessIncome,
    totalCapitalGains,
    rawRentalIncome,
    allowableRentalIncome,
    suspendedPassiveLoss,
    spouseIncome: data.spouseIncome ?? 0,
  }, grossIncome);

  // ── Step 7: SE tax ────────────────────────────────────────────────────────
  const seResult = calculateSelfEmploymentTax(netBusinessIncome, totalTips, w2Total, data.filingStatus);
  const seTax = seResult.seTax;
  const seTaxOnTips = seResult.seTaxOnTips;

  d('7', 'Self-Employment Tax', {
    netBusinessIncome,
    totalTips,
    w2Total,
    seBase: netBusinessIncome * SE_DEDUCTION_MULTIPLIER,
    ssWageBase: SS_WAGE_BASE,
    remainingSSBase: Math.max(0, SS_WAGE_BASE - w2Total),
  }, { seTax: seTax, seTaxOnTips, additionalMedicare: seResult.additionalMedicareTax },
    `SE base = netBizIncome × ${SE_DEDUCTION_MULTIPLIER}`);

  // ── Step 8: SE tax deduction (50%) ────────────────────────────────────────
  const seTaxDeduction = seTax * 0.5;

  d('8', 'SE Tax Deduction (50%)', { seTax }, seTaxDeduction);

  // ── Step 9: Home office deduction ─────────────────────────────────────────
  let homeOfficeDeduction = 0;
  if (data.homeOffice?.method === 'simplified' && data.homeOffice.sqFtUsed > 0) {
    homeOfficeDeduction = Math.min(data.homeOffice.sqFtUsed, 300) * 5;
  }

  d('9', 'Home Office Deduction', {
    method: data.homeOffice?.method ?? 'none',
    sqFtUsed: data.homeOffice?.sqFtUsed ?? 0,
    maxSqFt: 300,
    ratePerSqFt: 5,
  }, homeOfficeDeduction);

  // ── Step 10: Health insurance deduction (capped at net business income) ───
  //    FIX #11: Block deduction if eligible for employer health plan
  let healthInsuranceDeduction = 0;
  if (data.eligibleForEmployerHealthPlan) {
    healthInsuranceDeduction = 0; // Cannot deduct SE health insurance (IRC §162(l))
  } else {
    healthInsuranceDeduction = Math.min(
      data.healthInsurancePremiums ?? 0,
      Math.max(0, netBusinessIncome)
    );
  }

  d('10', 'Health Insurance Deduction', {
    premiums: data.healthInsurancePremiums ?? 0,
    capAtNetBizIncome: netBusinessIncome,
    eligibleForEmployerPlan: !!data.eligibleForEmployerHealthPlan,
  }, healthInsuranceDeduction, data.eligibleForEmployerHealthPlan ? 'Blocked: eligible for employer plan' : 'Capped at net business income');

  // ── Step 11: HSA deduction (capped at IRS limits) ─────────────────────────
  const hsaLimit = (data.hsaFamilyPlan ?? false) ? HSA_LIMIT_FAMILY : HSA_LIMIT_SELF;
  const hsaDeduction = Math.min(data.hsaContribution ?? 0, hsaLimit);

  d('11', 'HSA Deduction', {
    contribution: data.hsaContribution ?? 0,
    isFamilyPlan: data.hsaFamilyPlan ?? false,
    limit: hsaLimit,
  }, hsaDeduction);

  // ── Step 12: SEP-IRA deduction ────────────────────────────────────────────
  const sepIraLimit = Math.min(netBusinessIncome * 0.25, SEP_IRA_MAX);
  const sepIraDeduction = Math.min(data.sepIraContribution ?? 0, sepIraLimit);

  d('12', 'SEP-IRA Deduction', {
    contribution: data.sepIraContribution ?? 0,
    netBizIncomeX25: netBusinessIncome * 0.25,
    sepIraMax: SEP_IRA_MAX,
    limit: sepIraLimit,
  }, sepIraDeduction);

  // ── Step 13: IRA deduction WITH phase-out (Task 4) ────────────────────────
  // MAGI for IRA phase-out computed before IRA deduction
  const magiForIRA =
    grossIncome - seTaxDeduction - healthInsuranceDeduction - homeOfficeDeduction -
    hsaDeduction - sepIraDeduction - (data.studentLoanInterest ?? 0);
  const iraDeduction = calculateIRADeduction(
    data.iraContribution ?? 0,
    magiForIRA,
    data.filingStatus,
    data.coveredByWorkplacePlan ?? false
  );

  d('13', 'IRA Deduction', {
    contribution: data.iraContribution ?? 0,
    magiForIRA,
    coveredByWorkplacePlan: data.coveredByWorkplacePlan ?? false,
    phaseOutStart: IRA_PHASEOUT[data.filingStatus].start,
    phaseOutEnd: IRA_PHASEOUT[data.filingStatus].end,
    iraMax: IRA_MAX,
  }, iraDeduction);

  // ── Step 14: AGI ──────────────────────────────────────────────────────────
  const agi =
    grossIncome - seTaxDeduction - iraDeduction - (data.studentLoanInterest ?? 0) -
    healthInsuranceDeduction - homeOfficeDeduction - hsaDeduction - sepIraDeduction;

  d('14', 'Adjusted Gross Income (AGI)', {
    grossIncome,
    seTaxDeduction,
    iraDeduction,
    studentLoanInterest: data.studentLoanInterest ?? 0,
    healthInsuranceDeduction,
    homeOfficeDeduction,
    hsaDeduction,
    sepIraDeduction,
    formula: 'grossIncome - all above-the-line deductions',
  }, agi);

  // ── Step 15: Standard vs Itemized deductions (with SALT convergence + charitable cap)
  //    FIX #16: SALT convergence loop (iterates until state tax estimate stabilizes)
  //    FIX #10: Charitable donation limit (60% of AGI for cash to public charities)
  const totalCharitableInput = (data.charitableDonations ?? 0) + (data.priorCharitableCarryforward ?? 0);
  const charitableLimit = agi * 0.60;
  const allowableCharitable = Math.min(totalCharitableInput, charitableLimit);
  const charitableCarryforward = Math.max(0, totalCharitableInput - charitableLimit);

  // FIX #16: SALT convergence loop
  const stateRate = STATE_TAX_RATES[data.stateOfResidence] || 0;
  let prevEstimatedStateTax = 0;
  let saltDeduction = 0;
  let mortgageInterestCapped: number;
  let itemizedDeductionAmount: number;

  const MORTGAGE_DEBT_CAP = 750_000;
  const rawMortgageInterest = data.mortgageInterest ?? 0;
  mortgageInterestCapped = rawMortgageInterest;
  if ((data.mortgageBalance ?? 0) > MORTGAGE_DEBT_CAP && rawMortgageInterest > 0) {
    mortgageInterestCapped = Math.round(rawMortgageInterest * (MORTGAGE_DEBT_CAP / data.mortgageBalance!));
  }

  // FIX: SALT cap with income-based phase-out (2025 legislation)
  const isMFS = data.filingStatus === 'married_separate';
  const saltCapBase = isMFS ? SALT_CAP_MFS : SALT_CAP_BASE;
  const saltPhaseOutStart = isMFS ? SALT_PHASEOUT_START_MFS : SALT_PHASEOUT_START;
  let effectiveSaltCap = saltCapBase;
  if (agi > saltPhaseOutStart) {
    const reduction = (agi - saltPhaseOutStart) * SALT_PHASEOUT_RATE;
    effectiveSaltCap = Math.max(SALT_CAP_FLOOR, saltCapBase - reduction);
  }

  for (let iter = 0; iter < 10; iter++) {
    saltDeduction = Math.min(effectiveSaltCap, (data.propertyTaxes ?? 0) + prevEstimatedStateTax);
    itemizedDeductionAmount = mortgageInterestCapped + allowableCharitable + saltDeduction;
    const tempTaxableIncome = Math.max(0, agi - Math.max(itemizedDeductionAmount, standardDeductionAmount));
    const stateStdDedTemp = getStateStandardDeduction(data.stateOfResidence, data.filingStatus);
    const stateTaxableIncomeTemp = Math.max(0, agi - stateStdDedTemp);
    const estimatedStateTax = calculateStateTax(data.stateOfResidence, stateTaxableIncomeTemp, data.filingStatus);
    if (Math.abs(estimatedStateTax - prevEstimatedStateTax) < 1) break;
    prevEstimatedStateTax = estimatedStateTax;
  }
  // Final SALT after convergence
  saltDeduction = Math.min(effectiveSaltCap, (data.propertyTaxes ?? 0) + prevEstimatedStateTax);
  itemizedDeductionAmount = mortgageInterestCapped + allowableCharitable + saltDeduction;

  let deductionMethod: 'Standard' | 'Itemized';
  let deductionAmount: number;
  let deductionSavings = 0;

  if (itemizedDeductionAmount > standardDeductionAmount) {
    deductionMethod = 'Itemized';
    deductionAmount = itemizedDeductionAmount;
    deductionSavings = itemizedDeductionAmount - standardDeductionAmount;
  } else {
    deductionMethod = 'Standard';
    deductionAmount = standardDeductionAmount;
  }

  d('15', 'Deduction Method (SALT converged, charitable capped)', {
    standardDeductionAmount,
    itemizedDeductionAmount,
    allowableCharitable,
    charitableCarryforward,
    saltDeduction,
    saltConverged: prevEstimatedStateTax,
  }, { deductionMethod, deductionAmount, deductionSavings });

  // ── Step 16: QBI deduction with phase-out ─────────────────────────────────
  //    FIX #8: Pass SSTB flag to QBI calculation
  const qbiDeduction = calculateQBIDeduction(data.filingStatus, agi, netBusinessIncome, deductionAmount, data.isSSTB ?? false);

  d('16', 'QBI Deduction (Section 199A)', {
    netBusinessIncome,
    isSSTB: data.isSSTB ?? false,
    rawQbi: netBusinessIncome * QBI_RATE,
    agi,
  }, qbiDeduction, data.isSSTB ? 'SSTB: shorter phase-out range' : 'Non-SSTB');

  // ── Step 16a: NOL Deduction ───────────────────────────────────────────────
  //    FIX #18: NOL carryforward (80% of taxable income limit)
  const priorYearNOL = data.priorYearNOL ?? 0;
  const taxableIncomeBeforeNOL = Math.max(0, agi - deductionAmount - qbiDeduction);
  const nolLimit = taxableIncomeBeforeNOL * 0.80;
  const nolDeduction = Math.min(priorYearNOL, nolLimit);
  const nolCarryforward = priorYearNOL - nolDeduction;

  // ── Step 17: Taxable income ───────────────────────────────────────────────
  const taxableIncomeBeforeTips = Math.max(0, agi - deductionAmount - qbiDeduction - nolDeduction);
  const taxableIncome = Math.max(0, taxableIncomeBeforeTips - totalTips);

  d('17', 'Taxable Income', {
    agi,
    deductionAmount,
    qbiDeduction,
    nolDeduction,
    totalTips,
    taxableIncomeBeforeTips,
  }, taxableIncome, 'max(0, AGI - deduction - QBI - NOL - tips)');

  // ── Step 18: Split ordinary vs LTCG vs qualified dividends ────────────────
  //    FIX #7: Qualified dividends taxed at LTCG rates, not ordinary
  const qualifiedDivs = Math.min(data.qualifiedDividends ?? 0, data.dividendIncome ?? 0);
  const preferentialIncome = Math.max(0, effectiveLTCG) + qualifiedDivs;
  const ordinaryTaxableIncome = Math.max(0, taxableIncome - preferentialIncome);
  const ltcgInTaxableIncome = Math.min(preferentialIncome, taxableIncome);

  // ── Step 19: Ordinary tax via brackets ────────────────────────────────────
  const ordinaryTax = calculateProgressiveTax(ordinaryTaxableIncome, brackets);

  d('18-19', 'Ordinary Tax (Progressive Brackets)', {
    ordinaryTaxableIncome,
    ltcgInTaxableIncome,
    bracketCount: brackets.length,
  }, ordinaryTax);

  // ── Step 20: LTCG tax stacked on ordinary ─────────────────────────────────
  const ltcgTax = calculateLTCGTax(ltcgInTaxableIncome, ordinaryTaxableIncome, data.filingStatus);
  const tentativeTax = ordinaryTax + ltcgTax;

  d('20', 'LTCG Tax (Stacked)', {
    ltcgInTaxableIncome,
    stackedOnOrdinary: ordinaryTaxableIncome,
    ordinaryTax,
    ltcgTax,
  }, tentativeTax, 'tentativeTax = ordinaryTax + ltcgTax');

  // ── Step 21: CTC with phase-out ───────────────────────────────────────────
  const { ctCredits, odcCredits } = splitDependentCredits(data.dependentDetails);
  const rawDependentCredits = ctCredits * CHILD_TAX_CREDIT + odcCredits * OTHER_DEPENDENT_CREDIT;
  const totalDependentCreditsRaw = data.dependentDetails?.length
    ? rawDependentCredits
    : (data.dependents ?? 0) * CHILD_TAX_CREDIT;

  const ctcPhaseOutThreshold = data.filingStatus === 'married_joint' ? 400_000 : 200_000;
  const ctcExcess = Math.max(0, agi - ctcPhaseOutThreshold);
  const ctcReduction = Math.floor(ctcExcess / 1_000) * 50;
  const totalDependentCredits = Math.max(0, totalDependentCreditsRaw - ctcReduction);
  const childTaxCredit = Math.min(totalDependentCredits, tentativeTax);

  d('21', 'Child Tax Credit', {
    ctCredits,
    odcCredits,
    rawDependentCredits,
    ctcPhaseOutThreshold,
    ctcExcess,
    ctcReduction,
    totalDependentCreditsAfterPhaseout: totalDependentCredits,
    cappedAtTentativeTax: tentativeTax,
  }, childTaxCredit);

  // ── Step 22: Education credit (AOTC) ──────────────────────────────────────
  const educationCredit = calculateEducationCredit(data.educationExpenses ?? 0, agi, data.filingStatus);

  d('22', 'Education Credit (AOTC)', {
    educationExpenses: data.educationExpenses ?? 0,
    agi,
    phaseOutStart: data.filingStatus === 'married_joint' ? 160_000 : 80_000,
    phaseOutEnd: data.filingStatus === 'married_joint' ? 180_000 : 90_000,
  }, educationCredit);

  // ── Step 23: EITC with full 2025 table ────────────────────────────────────
  const earnedIncome = w2Total + netBusinessIncome + data.spouseIncome;
  const investmentIncome = (data.interestIncome ?? 0) + (data.dividendIncome ?? 0) + totalCapitalGains;
  const eitc = calculateEITC(agi, earnedIncome, investmentIncome, data.filingStatus, data.dependents ?? 0);

  d('23', 'Earned Income Tax Credit (EITC)', {
    earnedIncome,
    investmentIncome,
    investmentIncomeLimit: EITC_2025.investmentIncomeLimit,
    dependents: data.dependents ?? 0,
    agi,
  }, eitc);

  // ── Step 24: Saver's Credit ───────────────────────────────────────────────
  const totalRetirementContributions =
    (data.iraContribution ?? 0) + (data.sepIraContribution ?? 0);
  const saversCredit = calculateSaversCredit(agi, totalRetirementContributions, data.filingStatus);

  d('24', 'Saver\'s Credit', {
    totalRetirementContributions,
    agi,
  }, saversCredit);

  // ── Step 25: Child Care Credit ────────────────────────────────────────────
  // Count dependents under 13 from dependentDetails
  let dependentsUnder13 = 0;
  if (data.dependentDetails?.length) {
    for (const dep of data.dependentDetails) {
      const age = ageAsOfDec31_2025(dep.dateOfBirth);
      if (age !== null && age < 13) dependentsUnder13++;
    }
  } else if ((data.dependents ?? 0) > 0) {
    // Fallback: assume all dependents qualify if no details
    dependentsUnder13 = data.dependents ?? 0;
  }
  const childCareCredit = calculateChildCareCredit(data.childCareExpenses ?? 0, agi, dependentsUnder13);

  d('25', 'Child Care Credit', {
    childCareExpenses: data.childCareExpenses ?? 0,
    dependentsUnder13,
    agi,
  }, childCareCredit);

  // ── Step 26: NIIT (3.8% surtax) ──────────────────────────────────────────
  const niit = calculateNIIT(investmentIncome, agi, data.filingStatus);

  d('26', 'Net Investment Income Tax (NIIT)', {
    investmentIncome,
    agi,
    threshold: NIIT_THRESHOLD[data.filingStatus],
    rate: NIIT_RATE,
  }, niit);

  // ── Step 26a: Premium Tax Credit (ACA) ───────────────────────────────────
  const ptcResult = data.premiumTaxCredit
    ? calculatePremiumTaxCredit(data.premiumTaxCredit, agi)
    : { premiumTaxCredit: 0, excessAPTC: 0 };
  const premiumTaxCredit = ptcResult.premiumTaxCredit;
  const excessAPTC = ptcResult.excessAPTC;

  d('26a', 'Premium Tax Credit (ACA)', {
    annualPremium: data.premiumTaxCredit?.annualPremium ?? 0,
    slcsp: data.premiumTaxCredit?.slcsp ?? 0,
    aptcReceived: data.premiumTaxCredit?.aptcReceived ?? 0,
    householdSize: data.premiumTaxCredit?.householdSize ?? 0,
    agi,
  }, { premiumTaxCredit, excessAPTC });

  // ── Step 26b: AMT (Alternative Minimum Tax) — FIX #1 ─────────────────────
  // AMT exemptions and thresholds for 2025 (Rev. Proc. 2024-40)
  const AMT_EXEMPTION: Record<FilingStatus, number> = {
    single: 88_100, head_household: 88_100,
    married_joint: 137_000, married_separate: 68_500,
  };
  const AMT_PHASEOUT_START: Record<FilingStatus, number> = {
    single: 626_350, head_household: 626_350,
    married_joint: 1_252_700, married_separate: 626_350,
  };
  const AMT_28_BREAKPOINT: Record<FilingStatus, number> = {
    single: 239_100, head_household: 239_100,
    married_joint: 239_100, married_separate: 119_550,
  };

  // Compute AMTI: start with taxable income, add back preference items
  const saltAddBack = deductionMethod === 'Itemized' ? saltDeduction : 0;
  const isoAdjustment = data.isoExerciseIncome ?? 0;
  const amti = taxableIncome + saltAddBack + isoAdjustment;

  // Apply exemption with phase-out
  const grossExemption = AMT_EXEMPTION[data.filingStatus];
  const amtPhaseOutStart = AMT_PHASEOUT_START[data.filingStatus];
  let netExemption: number;
  if (amti <= amtPhaseOutStart) {
    netExemption = grossExemption;
  } else {
    const reduction = (amti - amtPhaseOutStart) * 0.25;
    netExemption = Math.max(0, grossExemption - reduction);
  }
  const netAMTI = Math.max(0, amti - netExemption);

  // Tentative minimum tax at 26%/28% (preferential income taxed at LTCG rates)
  const amtBreakpoint = AMT_28_BREAKPOINT[data.filingStatus];
  const preferentialIncomeForAMT = Math.min(preferentialIncome, netAMTI);
  const ordinaryAMTI = Math.max(0, netAMTI - preferentialIncomeForAMT);
  const tentativeMinTax_ordinary =
    Math.min(ordinaryAMTI, amtBreakpoint) * 0.26 +
    Math.max(0, ordinaryAMTI - amtBreakpoint) * 0.28;
  const tentativeMinTax_pref = calculateLTCGTax(preferentialIncomeForAMT, ordinaryAMTI, data.filingStatus);
  const tentativeMinTax = tentativeMinTax_ordinary + tentativeMinTax_pref;

  // AMT = excess of tentative minimum tax over regular tax
  const regularTaxBeforeCredits = ordinaryTax + ltcgTax;
  const amt = Math.max(0, tentativeMinTax - regularTaxBeforeCredits);

  d('26b', 'Alternative Minimum Tax (AMT)', {
    amti, saltAddBack, isoAdjustment,
    grossExemption, netExemption, netAMTI,
    tentativeMinTax, regularTaxBeforeCredits,
  }, amt, amt > 0 ? 'AMT TRIGGERED' : 'No AMT owed');

  // ── Step 26c: Kiddie Tax — FIX #17 ────────────────────────────────────────
  // Form 8615: unearned income > $2,700 taxed at parent's rate
  let kiddieTax = 0;
  if (data.isSubjectToKiddieTax && (data.parentMarginalRate ?? 0) > 0) {
    const unearnedIncome = (data.interestIncome ?? 0) + (data.dividendIncome ?? 0) +
      capitalGainsForGross;
    const kiddieTaxThreshold = 2_700; // 2025 threshold
    if (unearnedIncome > kiddieTaxThreshold) {
      const kiddieTaxBase = unearnedIncome - kiddieTaxThreshold;
      const regularTaxOnKiddieBase = calculateProgressiveTax(kiddieTaxBase, brackets);
      const parentRateTax = kiddieTaxBase * (data.parentMarginalRate ?? 0.37);
      kiddieTax = Math.max(0, parentRateTax - regularTaxOnKiddieBase);
    }
  }

  d('26c', 'Kiddie Tax', {
    isSubject: !!data.isSubjectToKiddieTax,
    parentRate: data.parentMarginalRate ?? 0,
  }, kiddieTax);

  // ── Step 27: Federal tax (now includes AMT + kiddie tax) ──────────────────
  const federalTax = Math.max(
    0,
    ordinaryTax + ltcgTax + seTax + niit + excessAPTC + amt + kiddieTax -
    childTaxCredit - educationCredit - eitc - saversCredit - childCareCredit - premiumTaxCredit
  );

  d('27', 'Federal Tax', {
    ordinaryTax,
    ltcgTax,
    seTax,
    niit,
    amt,
    kiddieTax,
    excessAPTC,
    totalCredits: childTaxCredit + educationCredit + eitc + saversCredit + childCareCredit + premiumTaxCredit,
    childTaxCredit,
    educationCredit,
    eitc,
    saversCredit,
    childCareCredit,
    premiumTaxCredit,
    beforeCredits: ordinaryTax + ltcgTax + seTax + niit + excessAPTC + amt + kiddieTax,
  }, federalTax, 'max(0, taxes + AMT + kiddie + excessAPTC - credits)');

  // ── Step 28: State tax via stateTax.ts ────────────────────────────────────
  const stateStdDed = getStateStandardDeduction(data.stateOfResidence, data.filingStatus);
  const stateTaxableIncome = Math.max(0, agi - stateStdDed);

  // Multi-state calculation
  const hasMultiState = data.workState && data.workState !== data.stateOfResidence
    && (data.workStateIncomePercent ?? 0) > 0;

  let workStateTax = 0;
  let homeStateTaxBeforeCredit = 0;
  let otherStateCredit = 0;
  let homeStateTaxAfterCredit = 0;
  let stateIncomeTax: number;

  if (hasMultiState) {
    // Calculate gig/1099 income allocated to work state
    const total1099Gross = data.income1099.reduce((s, i) => s + i.grossAmount, 0);
    const workStateIncome = Math.round(total1099Gross * ((data.workStateIncomePercent ?? 0) / 100));

    // 1. Nonresident tax in work state (income ratio method)
    workStateTax = calculateNonresidentStateTax(
      data.workState!, workStateIncome, agi, data.filingStatus);

    // 2. Full resident tax in home state (on ALL income)
    homeStateTaxBeforeCredit = Math.max(0,
      calculateStateTax(data.stateOfResidence, stateTaxableIncome, data.filingStatus));

    // 3. Credit: lesser of (work-state tax paid) or (home-state tax on work-state income)
    //    Home-state tax attributable to work-state income ≈ homeStateTax × (workStateIncome / AGI)
    const homeStatePortionOnWorkIncome = agi > 0
      ? homeStateTaxBeforeCredit * (workStateIncome / agi)
      : 0;
    otherStateCredit = Math.min(workStateTax, homeStatePortionOnWorkIncome);

    // 4. Net home state tax
    homeStateTaxAfterCredit = Math.max(0, homeStateTaxBeforeCredit - otherStateCredit);

    // Total state tax = work state + net home state
    stateIncomeTax = workStateTax + homeStateTaxAfterCredit;
  } else {
    stateIncomeTax = Math.max(0,
      calculateStateTax(data.stateOfResidence, stateTaxableIncome, data.filingStatus));
    homeStateTaxBeforeCredit = stateIncomeTax;
    homeStateTaxAfterCredit = stateIncomeTax;
  }

  // CA SDI: 1.2% on W-2 gross income (separate from income tax)
  const stateCode = (data.stateOfResidence || 'CA').toUpperCase();
  const caSDI = stateCode === 'CA' ? calculateCASDI(w2Total) : 0;
  const estimatedStateTax = stateIncomeTax + caSDI;

  d('28', 'State Tax', {
    state: data.stateOfResidence,
    workState: data.workState || 'same',
    workStateIncomePercent: data.workStateIncomePercent ?? 0,
    stateStdDed,
    stateTaxableIncome,
    stateIncomeTax,
    workStateTax,
    homeStateTaxBeforeCredit,
    otherStateCredit,
    homeStateTaxAfterCredit,
    caSDI,
    agi,
  }, estimatedStateTax, hasMultiState ? 'MULTI-STATE' : (caSDI > 0 ? `Includes CA SDI $${caSDI.toLocaleString()}` : undefined));

  // ── Step 29: Total tax ────────────────────────────────────────────────────
  const totalTax = federalTax + estimatedStateTax;

  d('29', 'Total Tax', { federalTax, estimatedStateTax }, totalTax);

  // ── Step 30: Withholding & Payments (W-2 + 1099 + spouse + estimated) ────
  const employerWithholding = w2Withholding + withholding1099 + (data.spouseWithholding ?? 0);
  const totalWithholding = employerWithholding + (data.estimatedTaxesPaid ?? 0);
  const totalPaid = totalWithholding;

  // ── Step 31: Refund/owed ──────────────────────────────────────────────────
  const finalBillOrRefund = totalTax - totalPaid;

  d('30-31', 'Withholding & Refund/Owed', {
    w2Withholding,
    withholding1099,
    spouseWithholding: data.spouseWithholding ?? 0,
    estimatedTaxesPaid: data.estimatedTaxesPaid ?? 0,
    employerWithholding,
    totalWithholding,
    totalPaid,
    totalTax,
  }, finalBillOrRefund, finalBillOrRefund > 0 ? 'TAX OWED' : finalBillOrRefund < 0 ? 'REFUND' : 'EVEN');

  // ── Step 32: Safe harbor + Form 2210 underpayment penalty ────────────────
  const requiredPayment90 = totalTax * 0.90;
  const highIncomeThreshold = data.filingStatus === 'married_separate' ? 75_000 : 150_000;
  const safeHarborMultiplier = agi > highIncomeThreshold ? 1.10 : 1.00;
  const requiredPayment100 = (data.lastYearTaxLiability ?? 0) > 0
    ? (data.lastYearTaxLiability ?? 0) * safeHarborMultiplier
    : totalTax * 0.90;
  const requiredPayment = Math.min(requiredPayment90, requiredPayment100);

  // Form 2210 penalty calculation
  const penaltyCalc = calculateUnderpaymentPenalty(
    totalTax,
    totalPaid,
    data.estimatedTaxesPaid ?? 0,
    data.lastYearTaxLiability ?? 0,
    data.filingStatus,
    agi
  );

  const penaltyRisk = {
    isAtRisk: totalPaid < requiredPayment,
    requiredPayment,
    currentPayment: totalPaid,
    shortfall: Math.max(0, requiredPayment - totalPaid),
    estimatedPenalty: penaltyCalc.estimatedPenalty,
    annualizedRate: penaltyCalc.annualizedRate,
  };

  // ── Step 33: Effective rates and quarterly estimate ───────────────────────
  const totalGrossForRate = grossIncome > 0 ? grossIncome : 1; // avoid division by zero
  const effectiveFederalRate = federalTax / totalGrossForRate;
  const effectiveStateRate = estimatedStateTax / totalGrossForRate;
  const effectiveTotalRate = totalTax / totalGrossForRate;

  // Quarterly estimate: remaining tax after employer withholding ÷ 4
  const remainingForQuarterly = Math.max(0, totalTax - employerWithholding);
  const quarterlyEstimate = remainingForQuarterly / 4;

  // Tip deduction — the full amount excluded from taxable income
  const tipDeduction = totalTips;

  d('32-33', 'Effective Rates & Quarterly Estimate', {
    effectiveFederalRate: +(effectiveFederalRate * 100).toFixed(2),
    effectiveStateRate: +(effectiveStateRate * 100).toFixed(2),
    effectiveTotalRate: +(effectiveTotalRate * 100).toFixed(2),
    remainingForQuarterly,
    quarterlyEstimate,
    penaltyRiskAtRisk: penaltyRisk.isAtRisk,
    penaltyShortfall: penaltyRisk.shortfall,
  }, { effectiveTotalRate: +(effectiveTotalRate * 100).toFixed(2), quarterlyEstimate });

  // ── RETURN ────────────────────────────────────────────────────────────────
  return {
    grossIncome,
    totalTips,
    tipDeduction,
    agi,
    taxableIncome,
    tentativeTax,
    seTax,
    seTaxOnTips,
    seTaxDeduction,
    netBusinessIncome,
    qbiDeduction,
    ltcgTax,
    childTaxCredit,
    federalTax,
    estimatedStateTax,
    totalTax,
    totalWithholding,
    finalBillOrRefund,
    deductionMethod,
    deductionAmount,
    standardDeductionAmount,
    itemizedDeductionAmount,
    deductionSavings,
    saltDeduction,
    mortgageInterestCapped,
    homeOfficeDeduction,
    educationCredit,
    eitc,
    taxableSocialSecurity,
    penaltyRisk,
    iraDeduction,
    sepIraDeduction,
    hsaDeduction,
    saversCredit,
    childCareCredit,
    niit,
    caSDI,
    vehicleDepreciationDeduction: vehicleDepResult.depreciationDeduction,
    premiumTaxCredit,
    excessAPTC,
    effectiveFederalRate,
    effectiveStateRate,
    effectiveTotalRate,
    quarterlyEstimate,
    // ── Vulnerability fix output fields ─────────────────────────────────────
    amt,
    amti,
    capitalLossCarryforward,
    charitableCarryforward,
    allowableCharitable,
    suspendedPassiveLoss,
    allowableRentalIncome,
    nolDeduction,
    nolCarryforward,
    additionalMedicareTaxTotal: seResult.additionalMedicareTaxTotal,
    additionalMedicareWithholding: seResult.employerAdditionalMedicareWithheld,
    kiddieTax,
    qualifiedDividendTax: qualifiedDivs > 0
      ? calculateLTCGTax(qualifiedDivs, ordinaryTaxableIncome, data.filingStatus)
      : 0,
    // v1.5: Multi-state breakdown
    workStateTax,
    homeStateTaxBeforeCredit,
    otherStateCredit,
    homeStateTaxAfterCredit,
    ...(debug ? { debugLog: log } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTED HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** IRA optimization suggestion */
export function calculateIRASuggestion(
  currentAGI: number,
  filingStatus: FilingStatus,
  isRetirementPlanActive: boolean
): { maxContribution: number; taxSavings: number } {
  if (isRetirementPlanActive) {
    const phaseOut = IRA_PHASEOUT[filingStatus];

    if (currentAGI >= phaseOut.end) {
      return { maxContribution: 0, taxSavings: 0 };
    }

    if (currentAGI > phaseOut.start) {
      const range = phaseOut.end - phaseOut.start;
      const excess = currentAGI - phaseOut.start;
      const reduction = (excess / range) * IRA_MAX;
      const maxContribution = Math.max(0, IRA_MAX - reduction);
      const marginalRate = getMarginalRate(currentAGI, filingStatus);
      const taxSavings = maxContribution * marginalRate;
      return { maxContribution: Math.round(maxContribution), taxSavings: Math.round(taxSavings) };
    }
  }

  const marginalRate = getMarginalRate(currentAGI, filingStatus);
  const taxSavings = IRA_MAX * marginalRate;
  return { maxContribution: IRA_MAX, taxSavings: Math.round(taxSavings) };
}

/** Returns marginal bracket rate for the given income */
export function getMarginalRate(income: number, filingStatus: FilingStatus): number {
  const brackets = TAX_BRACKETS[filingStatus];
  for (const bracket of brackets) {
    if (income >= bracket.min && income < bracket.max) {
      return bracket.rate;
    }
  }
  return 0.37; // Top bracket
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTER: TaxInput → FinalTaxResult (for analysis.tsx backward compat)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TaxInput {
  filingStatus: FilingStatus;
  gigIncome: number;
  gigExpenses: { miles: number; actual: number; other: number };
  w2Income: { self: number; spouse: number };
  capitalGains: { shortTerm: number; longTerm: number };
  iraContributions: { self: number; spouse: number };
  isRetirementPlanActive: { self: boolean; spouse: boolean };
  state?: string;
}

/** Return shape matching the old TaxOutput for backward compat */
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
  seTaxAmount: number;
  netBusinessIncome: number;
  agi: number;
  taxableIncome: number;
}

/** Adapter: Convert TaxInput (analysis.tsx) to TaxReturnState for unified calculation */
export function calculateFromTaxInput(input: TaxInput): FinalTaxResult {
  const MILEAGE_RATE = 0.70;
  const mileageDeduction = input.gigExpenses.miles * MILEAGE_RATE;
  const higherExpense = Math.max(mileageDeduction, input.gigExpenses.actual);
  const businessExpenses = higherExpense + input.gigExpenses.other;

  const state: TaxReturnState = {
    filingStatus: input.filingStatus,
    w2Incomes: [
      { employer: 'Self W-2', wages: input.w2Income.self, withheld: 0 },
      ...(input.w2Income.spouse > 0
        ? [{ employer: 'Spouse W-2', wages: input.w2Income.spouse, withheld: 0 }]
        : []),
    ],
    income1099: input.gigIncome > 0
      ? [{ source: 'Gig Income', grossAmount: input.gigIncome, tipPortion: 0, withheld: 0, formType: '1099-NEC' as const }]
      : [],
    capitalGains: 0,
    capitalGainsShortTerm: input.capitalGains.shortTerm,
    capitalGainsLongTerm: input.capitalGains.longTerm,
    spouseIncome: 0, // Already included in w2Incomes
    spouseWithholding: 0,
    dependents: 0,
    iraContribution: input.iraContributions.self + input.iraContributions.spouse,
    estimatedTaxesPaid: 0,
    studentLoanInterest: 0,
    healthInsurancePremiums: 0,
    stateOfResidence: input.state || 'CA',
    mortgageInterest: 0,
    propertyTaxes: 0,
    charitableDonations: 0,
    deductionType: 'Standard',
    unemploymentIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    socialSecurityIncome: 0,
    rentalIncome: 0,
    alimonyReceived: 0,
    gamblingWinnings: 0,
    educationExpenses: 0,
    homeOffice: null,
    lastYearTaxLiability: 0,
    businessExpenses,
    parkingAndTolls: 0,
    sepIraContribution: 0,
    hsaContribution: 0,
    hsaFamilyPlan: false,
    coveredByWorkplacePlan: input.isRetirementPlanActive.self,
    spouseCoveredByWorkplacePlan: input.isRetirementPlanActive.spouse,
    childCareExpenses: 0,
  };

  return calculateUnifiedTax(state);
}

/**
 * Adapter: Convert TaxInput → TaxOutput (backward compat for analysis/deductions/paywall)
 */
export function calculateTaxReturn(input: TaxInput): TaxOutput {
  const result = calculateFromTaxInput(input);

  const MILEAGE_RATE = 0.70;
  const mileageDeduction = input.gigExpenses.miles * MILEAGE_RATE;
  const higherExpense = Math.max(mileageDeduction, input.gigExpenses.actual);
  const businessExpenses = higherExpense + input.gigExpenses.other;
  const totalW2 = input.w2Income.self + input.w2Income.spouse;

  const totalIncome = totalW2 + input.gigIncome +
    input.capitalGains.shortTerm + input.capitalGains.longTerm;
  const effectiveRate = totalIncome > 0 ? (result.totalTax / totalIncome) * 100 : 0;

  // Quarterly estimate: (SE tax + net gig income * marginal rate) / 4
  const marginalRate = getMarginalRate(totalIncome, input.filingStatus);
  const gigIncomeTax = result.netBusinessIncome * marginalRate;
  const quarterlyPayment = (result.seTax + gigIncomeTax) / 4;

  return {
    totalTax: result.totalTax,
    federalTax: result.federalTax,
    stateTax: result.estimatedStateTax,
    quarterlyPayment,
    effectiveRate,
    deductionsBreakdown: {
      businessExpenses,
      standardDeduction: result.standardDeductionAmount,
      qbiDeduction: result.qbiDeduction,
      deductibleIra: result.iraDeduction,
      seTaxDeduction: result.seTaxDeduction,
    },
    seTaxAmount: result.seTax,
    netBusinessIncome: result.netBusinessIncome,
    agi: result.agi,
    taxableIncome: result.taxableIncome,
  };
}

/**
 * Returns the GREATER of (miles × $0.70) OR sum of actual expenses.
 * IRS 2025 standard mileage rate: $0.70/mile.
 */
export function getOptimalDeduction(miles: number, expenses: number): number {
  const mileageDeduction = miles * 0.70;
  return Math.max(mileageDeduction, expenses);
}

/**
 * Run tax calculation with debug logging and print a formatted summary.
 * Usage: const summary = debugTaxCalculation(myData);
 * Returns a formatted string for console output.
 */
export function debugTaxCalculation(data: TaxReturnState): string {
  const result = calculateUnifiedTax(data, true);
  const lines: string[] = ['═══ TAX ENGINE DEBUG LOG ═══', ''];

  if (result.debugLog) {
    for (const step of result.debugLog) {
      lines.push(`── Step ${step.step}: ${step.label} ──`);
      const inputs = Object.entries(step.inputs)
        .map(([k, v]) => `  ${k}: ${typeof v === 'number' ? v.toLocaleString() : v}`)
        .join('\n');
      lines.push(`Inputs:\n${inputs}`);
      if (typeof step.output === 'object') {
        const outputs = Object.entries(step.output)
          .map(([k, v]) => `  ${k}: ${typeof v === 'number' ? v.toLocaleString() : v}`)
          .join('\n');
        lines.push(`Output:\n${outputs}`);
      } else {
        lines.push(`Output: ${typeof step.output === 'number' ? step.output.toLocaleString() : step.output}`);
      }
      if (step.notes) lines.push(`Note: ${step.notes}`);
      lines.push('');
    }
  }

  lines.push('═══ FINAL RESULT ═══');
  lines.push(`Gross Income:      $${result.grossIncome.toLocaleString()}`);
  lines.push(`AGI:               $${result.agi.toLocaleString()}`);
  lines.push(`Taxable Income:    $${result.taxableIncome.toLocaleString()}`);
  lines.push(`SE Tax:            $${result.seTax.toLocaleString()}`);
  lines.push(`Federal Tax:       $${result.federalTax.toLocaleString()}`);
  lines.push(`State Tax:         $${result.estimatedStateTax.toLocaleString()}`);
  lines.push(`Total Tax:         $${result.totalTax.toLocaleString()}`);
  lines.push(`Total Paid:        $${result.totalWithholding.toLocaleString()}`);
  lines.push(`Refund/Owed:       $${result.finalBillOrRefund.toLocaleString()}`);
  lines.push(`Effective Rate:    ${(result.effectiveTotalRate * 100).toFixed(2)}%`);
  lines.push(`Quarterly Est:     $${result.quarterlyEstimate.toLocaleString()}`);

  return lines.join('\n');
}
