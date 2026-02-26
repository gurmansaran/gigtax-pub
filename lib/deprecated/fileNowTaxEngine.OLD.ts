/**
 * File Now Tax Engine
 * Comprehensive 1040 tax calculation for the File Now wizard
 *
 * Bug fixes applied (P0):
 *  #1 SE Tax Deduction in AGI
 *  #2 Corrected 2025 tax brackets (IRS Rev. Proc. 2024-40)
 *  #3 SE tax on net profit (gross − expenses), not gross
 *  #4 QBI deduction (Section 199A)
 *  #5 1099 withholding included
 *  #6 LTCG preferential rates (0/15/20%)
 *  #7 MFS Additional Medicare threshold $125k
 *  #8 2025 mileage rate $0.70
 *
 * P1 additions: parking/tolls, SEP-IRA, HSA, CTC phase-out,
 *   SS 0-85% taxation, Safe Harbor 110% rule
 */

import { CA_STANDARD_DEDUCTION_2025, calculateStateTax } from '../stateTax';

export interface TaxReturnState {
  filingStatus: 'single' | 'married_joint' | 'married_separate' | 'head_household';
  w2Incomes: Array<{ employer: string; wages: number; withheld: number }>;
  income1099: Array<{ source: string; grossAmount: number; tipPortion: number; withheld?: number }>;
  capitalGains: number; // Legacy combined field (still accepted for backward compat)
  capitalGainsShortTerm: number;  // Bug #6: split from capitalGains
  capitalGainsLongTerm: number;   // Bug #6: split from capitalGains
  spouseIncome: number;
  spouseWithholding: number; // Spouse's federal tax withheld
  dependents: number;
  iraContribution: number;
  estimatedTaxesPaid: number;
  studentLoanInterest: number;
  healthInsurancePremiums: number;
  stateOfResidence: string; // Two-letter state code
  mortgageInterest: number; // From Form 1098, Box 1
  propertyTaxes: number; // Real Estate Tax
  charitableDonations: number; // Cash or goods value
  deductionType: 'Standard' | 'Itemized'; // Determined by optimizer
  unemploymentIncome: number; // Form 1099-G
  interestIncome: number; // Form 1099-INT
  dividendIncome: number; // Form 1099-DIV
  socialSecurityIncome: number; // SSA-1099 (total, before 0-85% inclusion)
  rentalIncome: number; // Schedule E / 1099-MISC
  alimonyReceived: number; // Post-2018 divorce: not deductible by payer, taxable to recipient
  gamblingWinnings: number; // W-2G
  educationExpenses: number; // Tuition/Books (Form 1098-T)
  homeOffice: { sqFtUsed: number; method: 'simplified' | 'actual' } | null;
  lastYearTaxLiability: number; // For Safe Harbor check
  businessExpenses: number;      // Bug #3: Schedule C expenses (mileage + other)
  parkingAndTolls: number;       // P1: deductible even with standard mileage
  sepIraContribution: number;    // P1: SEP-IRA / Solo 401(k)
  hsaContribution: number;       // P1: HSA contributions
  hsaFamilyPlan: boolean;        // P1: HSA family vs self plan
  /** Silver & Sight: 65+ or blind – boost standard deduction (2025: +$2,000 Single/HoH, +$1,600 MFJ each) */
  primary65Plus?: boolean;
  primaryBlind?: boolean;
  spouse65Plus?: boolean;
  spouseBlind?: boolean;
  /** For CTC ($2,000) vs ODC ($500): age as of Dec 31, 2025 and relationship */
  dependentDetails?: Array<{ dateOfBirth?: string; relationship?: string }>;
}

export interface FinalTaxResult {
  grossIncome: number;
  totalTips: number;
  tipDeduction: number; // Amount saved from tip exemption
  agi: number;
  taxableIncome: number;
  tentativeTax: number;
  seTax: number;
  seTaxOnTips: number; // FICA still applies to tips
  seTaxDeduction: number;     // Bug #1: 50% of SE tax
  netBusinessIncome: number;  // Bug #3: gross 1099 − expenses
  qbiDeduction: number;       // Bug #4: Section 199A deduction
  ltcgTax: number;            // Bug #6: preferential LTCG tax
  childTaxCredit: number;
  federalTax: number;
  estimatedStateTax: number;
  totalTax: number;
  totalWithholding: number;
  finalBillOrRefund: number; // Positive = refund, Negative = amount owed
  deductionMethod: 'Standard' | 'Itemized';
  deductionAmount: number;
  standardDeductionAmount: number;
  itemizedDeductionAmount: number;
  deductionSavings: number; // Extra savings from itemizing (if applicable)
  homeOfficeDeduction: number;
  educationCredit: number;
  eitc: number; // Earned Income Tax Credit
  taxableSocialSecurity: number; // P1: 0-85% of SS included
  penaltyRisk: {
    isAtRisk: boolean;
    requiredPayment: number;
    currentPayment: number;
    shortfall: number;
  };
}

// 2025 Tax Constants – base standard deduction (Rev. Proc. 2024-40)
const STANDARD_DEDUCTION_BASE: Record<TaxReturnState['filingStatus'], number> = {
  single: 15_000,
  married_joint: 30_000,
  married_separate: 15_000,
  head_household: 22_500,
};
// Silver & Sight: +$2,000 (Single/HoH) or +$1,600 (MFJ/MFS) per 65+ or blind (2025)
const SENIOR_BLIND_BOOST_SINGLE_HOH = 2_000;
const SENIOR_BLIND_BOOST_MFJ = 1_600;

const SALT_CAP = 10000; // State and Local Tax deduction cap

const CHILD_TAX_CREDIT = 2000; // Per qualifying child under 17 (child/sibling/descendant)
const OTHER_DEPENDENT_CREDIT = 500; // Per other dependent (17+ or parent/other)
const SS_WAGE_BASE = 176100; // 2025 Social Security wage base
const SS_TAX_RATE = 0.124; // 12.4% Social Security (on first SS_WAGE_BASE only)
const MEDICARE_TAX_RATE = 0.029; // 2.9% Medicare (on all income)
const ADDITIONAL_MEDICARE_RATE = 0.009; // 0.9% on income over threshold
const ADDITIONAL_MEDICARE_THRESHOLD_SINGLE = 200000;
const ADDITIONAL_MEDICARE_THRESHOLD_MARRIED = 250000;
const SE_DEDUCTION_MULTIPLIER = 0.9235; // 92.35% of net profit

// State tax: CA uses FTB 2025 progressive (see stateTax.ts); others use flat estimate for SALT approx only
const STATE_TAX_RATES: Record<string, number> = {
  CA: 0.093, // Used only for SALT approximation; actual CA tax from stateTax.ts
  NY: 0.06,
  TX: 0.00,
  FL: 0.00,
  WA: 0.00,
  NV: 0.00,
  TN: 0.00,
  SD: 0.00,
  WY: 0.00,
  NH: 0.00,
};

// Bug #2 FIX: Corrected 2025 IRS tax brackets (Rev. Proc. 2024-40)
const TAX_BRACKETS = {
  single: [
    { min: 0, max: 11_925, rate: 0.10 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 626_350, rate: 0.35 },  // Was 375,800 – off by $250,550!
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
    { min: 48_475, max: 103_350, rate: 0.22 },  // Was 103,375
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },  // Was 250,550
    { min: 250_525, max: 375_800, rate: 0.35 },
    { min: 375_800, max: Infinity, rate: 0.37 },
  ],
  head_household: [
    { min: 0, max: 17_000, rate: 0.10 },   // Was 17,850 (off $850)
    { min: 17_000, max: 64_850, rate: 0.12 },   // Was 72,800 (off $7,950)
    { min: 64_850, max: 103_350, rate: 0.22 },  // Was 104,050 (off $700)
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_500, rate: 0.32 },  // Was 250,550
    { min: 250_500, max: 626_350, rate: 0.35 },  // Was 375,800
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
};

// Bug #6 FIX: Long-Term Capital Gains preferential brackets (0/15/20%)
const LTCG_BRACKETS: Record<TaxReturnState['filingStatus'], Array<{ min: number; max: number; rate: number }>> = {
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

// Bug #4: QBI deduction constants (Section 199A)
const QBI_RATE = 0.20;
const QBI_PHASE_OUT_START_SINGLE = 197_300;
const QBI_PHASE_OUT_END_SINGLE = 257_300;
const QBI_PHASE_OUT_START_MFJ = 394_600;
const QBI_PHASE_OUT_END_MFJ = 514_600;

// P1: HSA contribution limits (2025)
const HSA_LIMIT_SELF = 4_300;
const HSA_LIMIT_FAMILY = 8_550;

// P1: SEP-IRA max (lesser of 25% of net SE income or $69,000)
const SEP_IRA_MAX = 69_000;

/** Age as of Dec 31, 2025 from YYYY-MM-DD */
function ageAsOfDec31_2025(dateOfBirth: string | undefined): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  let age = 2025 - y;
  if (m > 12 || (m === 12 && d > 31)) age -= 1;
  if (age < 0) return 0;
  return age;
}

/** CTC $2,000: under 17 and son/daughter/sibling/other (descendant). ODC $500: 17+ or parent. */
function splitDependentCredits(
  dependentDetails: Array<{ dateOfBirth?: string; relationship?: string }> | undefined
): { ctCredits: number; odcCredits: number } {
  if (!dependentDetails?.length) return { ctCredits: 0, odcCredits: 0 };
  const ctRelationships = new Set(['son', 'daughter', 'sibling', 'other']); // parent => ODC only
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
 * Calculate final tax return
 */
export function calculateFinalTax(data: TaxReturnState): FinalTaxResult {
  // ============================================================================
  // STEP 1: Define Constants (stateRate, brackets, standard deduction with senior/blind)
  // ============================================================================
  const stateRate = STATE_TAX_RATES[data.stateOfResidence] || 0;
  const brackets = TAX_BRACKETS[data.filingStatus];
  const baseDeduction = STANDARD_DEDUCTION_BASE[data.filingStatus];
  const isMFJ = data.filingStatus === 'married_joint' || data.filingStatus === 'married_separate';
  const boostPerBox = isMFJ ? SENIOR_BLIND_BOOST_MFJ : SENIOR_BLIND_BOOST_SINGLE_HOH;
  let seniorBlindBoost = 0;
  if (data.primary65Plus) seniorBlindBoost += boostPerBox;
  if (data.primaryBlind) seniorBlindBoost += boostPerBox;
  if (data.spouse65Plus) seniorBlindBoost += boostPerBox;
  if (data.spouseBlind) seniorBlindBoost += boostPerBox;
  const standardDeductionAmount = baseDeduction + seniorBlindBoost;

  // ============================================================================
  // STEP 2: Calculate Gross Income
  // ============================================================================
  const w2Total = data.w2Incomes.reduce((sum, w2) => sum + w2.wages, 0);
  const income1099Total = data.income1099.reduce((sum, income) => sum + income.grossAmount, 0);
  const totalTips = data.income1099.reduce((sum, income) => sum + income.tipPortion, 0);

  // Bug #3 FIX: Calculate net business income (gross 1099 − Schedule C expenses)
  // businessExpenses includes mileage deduction + other expenses + parking/tolls (P1)
  const totalBusinessExpenses = (data.businessExpenses ?? 0) + (data.parkingAndTolls ?? 0);
  const netBusinessIncome = Math.max(0, income1099Total - totalBusinessExpenses);

  // Bug #6 FIX: Split capital gains into short-term and long-term
  // Backward compat: if new fields are zero/missing, fall back to legacy capitalGains
  const shortTermCG = (data.capitalGainsShortTerm ?? 0);
  const longTermCG = (data.capitalGainsLongTerm ?? 0);
  const hasNewCGFields = shortTermCG !== 0 || longTermCG !== 0;
  const effectiveSTCG = hasNewCGFields ? shortTermCG : (data.capitalGains ?? 0);
  const effectiveLTCG = hasNewCGFields ? longTermCG : 0;
  const totalCapitalGains = effectiveSTCG + effectiveLTCG;

  // P1 FIX: Social Security 0-85% taxation
  // "Combined income" = AGI (without SS) + nontaxable interest + 50% of SS
  const ssIncome = data.socialSecurityIncome ?? 0;
  const taxableSocialSecurity = calculateTaxableSocialSecurity(
    ssIncome,
    w2Total + netBusinessIncome + effectiveSTCG + effectiveLTCG + data.spouseIncome +
      data.unemploymentIncome + data.interestIncome + data.dividendIncome +
      (data.rentalIncome ?? 0) + (data.alimonyReceived ?? 0) + (data.gamblingWinnings ?? 0),
    data.filingStatus
  );

  // Gross income uses net business income (Bug #3), LTCG included, and taxable SS (P1)
  const grossIncome = w2Total + netBusinessIncome + totalCapitalGains + data.spouseIncome +
    data.unemploymentIncome + data.interestIncome + data.dividendIncome +
    taxableSocialSecurity + (data.rentalIncome ?? 0) + (data.alimonyReceived ?? 0) + (data.gamblingWinnings ?? 0);

  // ============================================================================
  // STEP 3: Calculate Self-Employment Tax (on NET profit, not gross – Bug #3)
  // ============================================================================
  const nonTipNetIncome = Math.max(0, netBusinessIncome - totalTips);
  const nonTipSEBase = nonTipNetIncome * SE_DEDUCTION_MULTIPLIER;

  // SE Tax on non-tip net gig income
  let seTaxOnNonTips = 0;
  if (nonTipSEBase > 0) {
    const w2PlusNonTipGig = w2Total + nonTipNetIncome;
    if (w2PlusNonTipGig <= SS_WAGE_BASE) {
      seTaxOnNonTips = nonTipSEBase * (SS_TAX_RATE + MEDICARE_TAX_RATE);
    } else {
      const remainingSSBase = Math.max(0, SS_WAGE_BASE - w2Total);
      const ssTaxable = Math.min(nonTipSEBase, remainingSSBase);
      seTaxOnNonTips = (ssTaxable * SS_TAX_RATE) + (nonTipSEBase * MEDICARE_TAX_RATE);
    }
  }

  // SE Tax on tips (FICA still applies, but no federal income tax)
  const tipSEBase = totalTips * SE_DEDUCTION_MULTIPLIER;
  let seTaxOnTips = 0;
  if (tipSEBase > 0) {
    const w2PlusNonTipGig = w2Total + nonTipNetIncome;
    if (w2PlusNonTipGig < SS_WAGE_BASE) {
      const remainingSSBase = SS_WAGE_BASE - w2PlusNonTipGig;
      const tipSSTaxable = Math.min(tipSEBase, remainingSSBase);
      seTaxOnTips = (tipSSTaxable * SS_TAX_RATE) + (tipSEBase * MEDICARE_TAX_RATE);
    } else {
      seTaxOnTips = tipSEBase * MEDICARE_TAX_RATE;
    }
  }

  // Bug #7 FIX: Additional Medicare Tax – MFS threshold is $125,000, not $250,000
  const additionalMedicareThreshold =
    data.filingStatus === 'married_separate' ? 125_000 :          // Bug #7 FIX
    data.filingStatus === 'married_joint' ? ADDITIONAL_MEDICARE_THRESHOLD_MARRIED :
    ADDITIONAL_MEDICARE_THRESHOLD_SINGLE;
  const totalSEBase = nonTipSEBase + tipSEBase;
  const totalForAdditionalMedicare = w2Total + totalSEBase;
  const additionalMedicareBase = Math.max(0, totalForAdditionalMedicare - additionalMedicareThreshold);
  const additionalMedicareTax = additionalMedicareBase * ADDITIONAL_MEDICARE_RATE;

  const seTax = seTaxOnNonTips + seTaxOnTips + additionalMedicareTax;

  // ============================================================================
  // STEP 4: Calculate Adjustments (SE deduction, Home Office, Health Insurance, etc.)
  // ============================================================================
  // Bug #1 FIX: 50% of SE tax is deductible from gross income to calculate AGI
  const seTaxDeduction = seTax * 0.5;

  // Home Office Deduction
  let homeOfficeDeduction = 0;
  if (data.homeOffice?.method === 'simplified' && data.homeOffice.sqFtUsed > 0) {
    const sqFt = Math.min(data.homeOffice.sqFtUsed, 300);
    homeOfficeDeduction = sqFt * 5;
  }

  // Health Insurance Deduction (limited to net gig profit)
  const healthInsuranceDeduction = Math.min(data.healthInsurancePremiums, Math.max(0, netBusinessIncome));

  // P1: HSA Deduction (capped at IRS limits)
  const hsaLimit = (data.hsaFamilyPlan ?? false) ? HSA_LIMIT_FAMILY : HSA_LIMIT_SELF;
  const hsaDeduction = Math.min(data.hsaContribution ?? 0, hsaLimit);

  // P1: SEP-IRA Deduction (lesser of 25% of net SE income or $69,000)
  const sepIraLimit = Math.min(netBusinessIncome * 0.25, SEP_IRA_MAX);
  const sepIraDeduction = Math.min(data.sepIraContribution ?? 0, sepIraLimit);

  // Bug #1 FIX: AGI now includes SE tax deduction, SEP-IRA, HSA
  const agi = grossIncome - seTaxDeduction - data.iraContribution - data.studentLoanInterest -
    healthInsuranceDeduction - homeOfficeDeduction - hsaDeduction - sepIraDeduction;

  // ============================================================================
  // STEP 5: Determine Deductions (Standard vs Itemized Optimizer)
  // ============================================================================
  const tempTaxableIncome = Math.max(0, agi - standardDeductionAmount);
  const estimatedStateTaxForSALT = tempTaxableIncome * stateRate;

  const saltDeduction = Math.min(SALT_CAP, data.propertyTaxes + estimatedStateTaxForSALT);
  const itemizedDeductionAmount = data.mortgageInterest + data.charitableDonations + saltDeduction;

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

  data.deductionType = deductionMethod;

  // ============================================================================
  // STEP 6: Calculate QBI Deduction (Bug #4 FIX)
  // ============================================================================
  const qbiDeduction = calculateQBIDeduction(data.filingStatus, agi, netBusinessIncome, deductionAmount);

  // ============================================================================
  // STEP 7: Calculate Taxable Income
  // ============================================================================
  // Taxable Income = AGI - Deduction - QBI - Tips (OBBA exemption)
  const taxableIncomeBeforeTips = Math.max(0, agi - deductionAmount - qbiDeduction);
  const taxableIncome = Math.max(0, taxableIncomeBeforeTips - totalTips);

  // ============================================================================
  // STEP 8: Calculate Federal Tax (Ordinary + LTCG at preferential rates – Bug #6)
  // ============================================================================
  // Ordinary income = taxable income minus LTCG (LTCG taxed separately at 0/15/20%)
  const ordinaryTaxableIncome = Math.max(0, taxableIncome - effectiveLTCG);
  const ltcgInTaxableIncome = Math.min(effectiveLTCG, taxableIncome);

  // Ordinary tax on non-LTCG income
  let tentativeTax = 0;
  let remainingIncome = ordinaryTaxableIncome;
  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;
    const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
    tentativeTax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
  }

  // Bug #6 FIX: LTCG taxed at preferential 0/15/20% rates, stacked on ordinary income
  const ltcgTax = calculateLTCGTax(ltcgInTaxableIncome, ordinaryTaxableIncome, data.filingStatus);
  tentativeTax += ltcgTax;

  // ============================================================================
  // STEP 9: Calculate Credits (CTC with phase-out, Education, EITC)
  // ============================================================================
  const { ctCredits, odcCredits } = splitDependentCredits(data.dependentDetails);
  const rawDependentCredits = ctCredits * CHILD_TAX_CREDIT + odcCredits * OTHER_DEPENDENT_CREDIT;
  const totalDependentCreditsRaw = data.dependentDetails?.length
    ? rawDependentCredits
    : data.dependents * CHILD_TAX_CREDIT;

  // P1 FIX: CTC phase-out – reduce by $50 per $1,000 over threshold
  const ctcPhaseOutThreshold =
    data.filingStatus === 'married_joint' ? 400_000 : 200_000;
  const ctcExcess = Math.max(0, agi - ctcPhaseOutThreshold);
  const ctcReduction = Math.floor(ctcExcess / 1_000) * 50;
  const totalDependentCredits = Math.max(0, totalDependentCreditsRaw - ctcReduction);
  const childTaxCredit = Math.min(totalDependentCredits, tentativeTax);

  const educationCredit = calculateEducationCredit(data.educationExpenses, agi, data.filingStatus);

  // Include spouse earned income for EITC (spouse W-2 + 1099 is earned income)
  const earnedIncome = w2Total + netBusinessIncome + data.spouseIncome;
  const investmentIncome = data.interestIncome + data.dividendIncome + totalCapitalGains;
  const eitc = calculateEITC(agi, earnedIncome, investmentIncome, data.filingStatus, data.dependents);

  // ============================================================================
  // STEP 10: Calculate Final Federal Tax
  // ============================================================================
  const federalTax = Math.max(0, tentativeTax + seTax - childTaxCredit - educationCredit - eitc);

  // ============================================================================
  // STEP 11: Calculate Estimated State Tax (FTB 2025 progressive for CA; flat for others)
  // ============================================================================
  const stateTaxableIncome =
    data.stateOfResidence === 'CA'
      ? Math.max(0, agi - CA_STANDARD_DEDUCTION_2025[data.filingStatus])
      : Math.max(0, agi);
  const estimatedStateTax = Math.max(0, calculateStateTax(data.stateOfResidence, stateTaxableIncome, data.filingStatus));

  // ============================================================================
  // STEP 12: Calculate Total Tax
  // ============================================================================
  const totalTax = federalTax + estimatedStateTax;

  // ============================================================================
  // STEP 13: Calculate Withholding and Payments (Bug #5 FIX: include 1099 withholding)
  // ============================================================================
  const withholding1099 = data.income1099.reduce((sum, i) => sum + (i.withheld ?? 0), 0);
  const totalWithholding = data.w2Incomes.reduce((sum, w2) => sum + w2.withheld, 0) +
    data.spouseWithholding + withholding1099;
  const totalPaid = totalWithholding + data.estimatedTaxesPaid;

  // ============================================================================
  // STEP 14: Calculate Final Bill/Refund
  // ============================================================================
  const finalBillOrRefund = totalTax - totalPaid;

  // ============================================================================
  // STEP 15: Calculate Tip Deduction Savings
  // ============================================================================
  const tipDeduction = totalTips > 0 ? calculateTipTaxSavings(totalTips, data.filingStatus) : 0;

  // ============================================================================
  // STEP 16: Safe Harbor Penalty Check (P1 FIX: 110% rule for AGI > $150k)
  // ============================================================================
  const requiredPayment90 = totalTax * 0.90;
  // P1: If prior-year AGI > $150k ($75k MFS), safe harbor requires 110% of prior-year tax
  const highIncomeThreshold = data.filingStatus === 'married_separate' ? 75_000 : 150_000;
  const safeHarborMultiplier = (agi > highIncomeThreshold) ? 1.10 : 1.00;
  const requiredPayment100 = data.lastYearTaxLiability > 0
    ? data.lastYearTaxLiability * safeHarborMultiplier
    : totalTax * 0.90;
  const requiredPayment = Math.min(requiredPayment90, requiredPayment100);
  const penaltyRisk = {
    isAtRisk: totalPaid < requiredPayment,
    requiredPayment,
    currentPayment: totalPaid,
    shortfall: Math.max(0, requiredPayment - totalPaid),
  };

  // ============================================================================
  // RETURN RESULT
  // ============================================================================
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
    homeOfficeDeduction,
    educationCredit,
    eitc,
    taxableSocialSecurity,
    penaltyRisk,
  };
}

/**
 * Bug #4 FIX: QBI Deduction (Section 199A)
 * 20% of qualified business income; phase-out above threshold (Rev. Proc. 24-40).
 * Single: full below $197,300; phase-out $197,300–$257,300.
 * MFJ: full below $394,600; phase-out to $514,600.
 */
function calculateQBIDeduction(
  filingStatus: TaxReturnState['filingStatus'],
  agi: number,
  netBusinessIncome: number,
  deductionAmount: number
): number {
  const taxableBeforeQbi = Math.max(0, agi - deductionAmount);
  const rawQbi = netBusinessIncome * QBI_RATE;
  const cap = Math.min(rawQbi, taxableBeforeQbi);
  if (cap <= 0) return 0;

  const isMFJ = filingStatus === 'married_joint';
  const start = isMFJ ? QBI_PHASE_OUT_START_MFJ : QBI_PHASE_OUT_START_SINGLE;
  const end = isMFJ ? QBI_PHASE_OUT_END_MFJ : QBI_PHASE_OUT_END_SINGLE;
  if (agi <= start) return cap;
  if (agi >= end) return 0;
  const phaseOutFraction = (agi - start) / (end - start);
  return Math.round(cap * (1 - phaseOutFraction) * 100) / 100;
}

/**
 * Bug #6 FIX: LTCG preferential tax (0/15/20%) stacked on ordinary income
 */
function calculateLTCGTax(
  ltcgAmount: number,
  stackedOrdinaryIncome: number,
  filingStatus: TaxReturnState['filingStatus']
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
 * P1 FIX: Social Security 0-85% taxation
 * IRS uses "combined income" = other AGI + nontaxable interest + 50% of SS benefits
 * Single/HoH: $25k/$34k thresholds. MFJ: $32k/$44k thresholds. MFS: all taxable.
 */
function calculateTaxableSocialSecurity(
  ssIncome: number,
  otherIncome: number,
  filingStatus: TaxReturnState['filingStatus']
): number {
  if (ssIncome <= 0) return 0;

  // MFS living with spouse: 85% always taxable (simplified assumption)
  if (filingStatus === 'married_separate') {
    return ssIncome * 0.85;
  }

  const combinedIncome = otherIncome + ssIncome * 0.5;
  const isMFJ = filingStatus === 'married_joint';
  const tier1Threshold = isMFJ ? 32_000 : 25_000;
  const tier2Threshold = isMFJ ? 44_000 : 34_000;

  if (combinedIncome <= tier1Threshold) return 0;

  if (combinedIncome <= tier2Threshold) {
    // Up to 50% taxable
    const excess = combinedIncome - tier1Threshold;
    return Math.min(ssIncome * 0.50, excess * 0.50);
  }

  // Up to 85% taxable
  const tier1Amount = Math.min((tier2Threshold - tier1Threshold) * 0.50, ssIncome * 0.50);
  const tier2Excess = combinedIncome - tier2Threshold;
  const tier2Amount = tier2Excess * 0.85;
  return Math.min(ssIncome * 0.85, tier1Amount + tier2Amount);
}

/**
 * Calculate tax savings from tip exemption
 */
function calculateTipTaxSavings(tips: number, filingStatus: TaxReturnState['filingStatus']): number {
  const brackets = TAX_BRACKETS[filingStatus];
  let taxOnTips = 0;
  let remainingTips = tips;

  for (const bracket of brackets) {
    if (remainingTips <= 0) break;
    const tipsInBracket = Math.min(remainingTips, bracket.max - bracket.min);
    taxOnTips += tipsInBracket * bracket.rate;
    remainingTips -= tipsInBracket;
  }

  return taxOnTips;
}

/**
 * Calculate IRA optimization suggestion
 */
export function calculateIRASuggestion(
  currentAGI: number,
  filingStatus: TaxReturnState['filingStatus'],
  isRetirementPlanActive: boolean
): { maxContribution: number; taxSavings: number } {
  const IRA_MAX = 7000;
  
  if (isRetirementPlanActive) {
    // Phase-out logic (simplified)
    const phaseOut = filingStatus === 'married_joint' 
      ? { start: 126000, end: 146000 }
      : { start: 77000, end: 87000 };
    
    if (currentAGI >= phaseOut.end) {
      return { maxContribution: 0, taxSavings: 0 };
    }
    
    if (currentAGI > phaseOut.start) {
      const phaseOutRange = phaseOut.end - phaseOut.start;
      const phaseOutAmount = currentAGI - phaseOut.start;
      const reduction = (phaseOutAmount / phaseOutRange) * IRA_MAX;
      const maxContribution = Math.max(0, IRA_MAX - reduction);
      
      // Estimate tax savings (simplified - uses marginal rate)
      const marginalRate = getMarginalRate(currentAGI, filingStatus);
      const taxSavings = maxContribution * marginalRate;
      
      return { maxContribution: Math.round(maxContribution), taxSavings: Math.round(taxSavings) };
    }
  }
  
  // Not in phase-out, full deduction
  const marginalRate = getMarginalRate(currentAGI, filingStatus);
  const taxSavings = IRA_MAX * marginalRate;
  
  return { maxContribution: IRA_MAX, taxSavings: Math.round(taxSavings) };
}

function getMarginalRate(income: number, filingStatus: TaxReturnState['filingStatus']): number {
  const brackets = TAX_BRACKETS[filingStatus];
  for (const bracket of brackets) {
    if (income >= bracket.min && income < bracket.max) {
      return bracket.rate;
    }
  }
  return 0.37; // Top bracket
}

/**
 * Calculate American Opportunity Tax Credit
 * Simplified: 100% of first $2,000 + 25% of next $2,000 (Max $2,500)
 */
function calculateEducationCredit(expenses: number, agi: number, filingStatus: TaxReturnState['filingStatus']): number {
  if (expenses <= 0) return 0;

  // Phase-out thresholds (2025 estimates)
  const phaseOutStart = filingStatus === 'married_joint' ? 160000 : 80000;
  const phaseOutEnd = filingStatus === 'married_joint' ? 180000 : 90000;

  // Check if in phase-out range
  if (agi >= phaseOutEnd) return 0;
  if (agi <= phaseOutStart) {
    // Full credit
    const credit = Math.min(2000, expenses) + Math.min(500, Math.max(0, expenses - 2000) * 0.25);
    return Math.min(2500, credit);
  }

  // Phase-out calculation
  const phaseOutRange = phaseOutEnd - phaseOutStart;
  const phaseOutAmount = agi - phaseOutStart;
  const reduction = (phaseOutAmount / phaseOutRange);
  
  const fullCredit = Math.min(2000, expenses) + Math.min(500, Math.max(0, expenses - 2000) * 0.25);
  const maxCredit = Math.min(2500, fullCredit);
  
  return Math.max(0, maxCredit * (1 - reduction));
}

/**
 * Calculate Earned Income Tax Credit (EITC)
 * 2025 estimates (simplified)
 */
function calculateEITC(
  agi: number,
  earnedIncome: number,
  investmentIncome: number,
  filingStatus: TaxReturnState['filingStatus'],
  numChildren: number
): number {
  // Investment income limit
  const INVESTMENT_INCOME_LIMIT = 11000;
  if (investmentIncome > INVESTMENT_INCOME_LIMIT) return 0;

  // EITC amounts by number of children (2025 estimates)
  const eitcAmounts = {
    0: { max: 600, phaseOutStart: 17000, phaseOutEnd: 25000 },
    1: { max: 4000, phaseOutStart: 25000, phaseOutEnd: 50000 },
    2: { max: 6600, phaseOutStart: 25000, phaseOutEnd: 55000 },
    3: { max: 7800, phaseOutStart: 25000, phaseOutEnd: 60000 },
  };

  // Adjust for married filing jointly
  const adjustedPhaseOut = filingStatus === 'married_joint' 
    ? { start: eitcAmounts[numChildren as keyof typeof eitcAmounts]?.phaseOutStart + 7000 || 0,
        end: eitcAmounts[numChildren as keyof typeof eitcAmounts]?.phaseOutEnd + 7000 || 0 }
    : { start: eitcAmounts[numChildren as keyof typeof eitcAmounts]?.phaseOutStart || 0,
        end: eitcAmounts[numChildren as keyof typeof eitcAmounts]?.phaseOutEnd || 0 };

  const maxCredit = eitcAmounts[numChildren as keyof typeof eitcAmounts]?.max || 0;

  // Use earned income or AGI, whichever is lower
  const eitcIncome = Math.min(earnedIncome, agi);

  // Check if income is too high
  if (eitcIncome >= adjustedPhaseOut.end) return 0;

  // Calculate credit (simplified - using phase-out)
  if (eitcIncome <= adjustedPhaseOut.start) {
    return maxCredit;
  }

  // Phase-out calculation
  const phaseOutRange = adjustedPhaseOut.end - adjustedPhaseOut.start;
  const phaseOutAmount = eitcIncome - adjustedPhaseOut.start;
  const reduction = phaseOutAmount / phaseOutRange;

  return Math.max(0, maxCredit * (1 - reduction));
}
