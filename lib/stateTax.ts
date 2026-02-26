/**
 * State income tax – official 2025/2026 rules.
 * CA: FTB 2025 Tax Rate Schedules (Schedule X, Y, Z) + MHSA surcharge.
 * Bracket math: each bracket is [min, max); width = max - min = dollars taxed at that rate.
 *
 * State categories (2026):
 * - Bracketed (27 + DC): AL, AR, CA, CT, DE, HI (12 brackets), KS, ME, MD, MA, MN, MO, MT, NE, NJ, NM, NY, ND, OK (3 in 2026), OR, RI, SC, VT, VA, WV, WI, DC.
 * - Flat rate: OH 2.75%, AZ, CO, GA, ID, IL, IN, IA, KY, LA, MI, MS, NC, PA, UT.
 * - No wage income tax (9): AK, FL, NV, NH, SD, TN, TX, WA, WY. (WA taxes high-earner capital gains.)
 */

export type StateFilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_household';

/** CA 2025 Standard Deduction (FTB) – Single/MFS $5,706; MJ/HOH $11,412 */
export const CA_STANDARD_DEDUCTION_2025: Record<StateFilingStatus, number> = {
  single: 5_706,
  married_joint: 11_412,
  married_separate: 5_706,
  head_household: 11_412,
};

/** CA MHSA (Mental Health Services Act) – 1% on taxable income over $1,000,000 */
export const CA_MHSA_THRESHOLD = 1_000_000;
export const CA_MHSA_RATE = 0.01;

/** CA SDI (State Disability Insurance) – Official 2025 rate 1.2% on gross W-2 income, no cap */
export const CA_SDI_RATE = 0.012;

/**
 * CA SDI tax: 1.2% of gross W-2 income (no cap).
 * Add to total tax liability and label as "CA SDI Tax".
 */
export function calculateCASDI(w2GrossIncome: number): number {
  if (w2GrossIncome <= 0) return 0;
  return Math.round(w2GrossIncome * CA_SDI_RATE * 100) / 100;
}

/**
 * Schedule X – Single or Married/RDP Filing Separately (FTB 2025).
 * Bracket i: income in [min, max) taxed at rate. Width = max - min (exact dollar count).
 * FTB "over $11,079 but not over $26,264" => dollars 11,080–26,264 => width 15,185.
 */
const CA_BRACKETS_SINGLE_MFS: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 11_080, rate: 0.01 },       // $0–$11,079 (11,080 dollars)
  { min: 11_080, max: 26_265, rate: 0.02 },   // $11,080–$26,264 (15,185 dollars)
  { min: 26_265, max: 41_453, rate: 0.04 },   // 15,188
  { min: 41_453, max: 57_543, rate: 0.06 },  // 16,090
  { min: 57_543, max: 72_725, rate: 0.08 },  // 15,182
  { min: 72_725, max: 371_480, rate: 0.093 }, // 298,755
  { min: 371_480, max: 445_772, rate: 0.103 },
  { min: 445_772, max: 742_954, rate: 0.113 },
  { min: 742_954, max: Infinity, rate: 0.123 },
];

/** Schedule Y – Married/RDP Filing Jointly or QSS (FTB 2025) */
const CA_BRACKETS_MARRIED_JOINT: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 22_159, rate: 0.01 },
  { min: 22_159, max: 52_529, rate: 0.02 },
  { min: 52_529, max: 82_905, rate: 0.04 },
  { min: 82_905, max: 115_085, rate: 0.06 },
  { min: 115_085, max: 145_449, rate: 0.08 },
  { min: 145_449, max: 742_959, rate: 0.093 },
  { min: 742_959, max: 891_543, rate: 0.103 },
  { min: 891_543, max: 1_485_907, rate: 0.113 },
  { min: 1_485_907, max: Infinity, rate: 0.123 },
];

/** Schedule Z – Head of Household (FTB 2025) */
const CA_BRACKETS_HOH: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 22_174, rate: 0.01 },
  { min: 22_174, max: 52_531, rate: 0.02 },
  { min: 52_531, max: 67_717, rate: 0.04 },
  { min: 67_717, max: 83_806, rate: 0.06 },
  { min: 83_806, max: 98_991, rate: 0.08 },
  { min: 98_991, max: 505_209, rate: 0.093 },
  { min: 505_209, max: 606_252, rate: 0.103 },
  { min: 606_252, max: 1_010_418, rate: 0.113 },
  { min: 1_010_418, max: Infinity, rate: 0.123 },
];

// ─── NEW YORK (NY) 2025 ────────────────────────────────────────────────────

const NY_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 8_500, rate: 0.04 },
  { min: 8_500, max: 11_700, rate: 0.045 },
  { min: 11_700, max: 13_900, rate: 0.0525 },
  { min: 13_900, max: 80_650, rate: 0.055 },
  { min: 80_650, max: 215_400, rate: 0.06 },
  { min: 215_400, max: 1_077_550, rate: 0.0685 },
  { min: 1_077_550, max: 5_000_000, rate: 0.0965 },
  { min: 5_000_000, max: 25_000_000, rate: 0.103 },
  { min: 25_000_000, max: Infinity, rate: 0.109 },
];

const NY_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 17_150, rate: 0.04 },
  { min: 17_150, max: 23_600, rate: 0.045 },
  { min: 23_600, max: 27_900, rate: 0.0525 },
  { min: 27_900, max: 161_550, rate: 0.055 },
  { min: 161_550, max: 323_200, rate: 0.06 },
  { min: 323_200, max: 2_155_350, rate: 0.0685 },
  { min: 2_155_350, max: 5_000_000, rate: 0.0965 },
  { min: 5_000_000, max: 25_000_000, rate: 0.103 },
  { min: 25_000_000, max: Infinity, rate: 0.109 },
];

export const NY_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 8_000,
  married_joint: 16_050,
  married_separate: 8_000,
  head_household: 11_200,
};

// ─── NEW JERSEY (NJ) 2025 ──────────────────────────────────────────────────

const NJ_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 20_000, rate: 0.014 },
  { min: 20_000, max: 35_000, rate: 0.0175 },
  { min: 35_000, max: 40_000, rate: 0.035 },
  { min: 40_000, max: 75_000, rate: 0.05525 },
  { min: 75_000, max: 500_000, rate: 0.0637 },
  { min: 500_000, max: 1_000_000, rate: 0.0897 },
  { min: 1_000_000, max: Infinity, rate: 0.1075 },
];

const NJ_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 20_000, rate: 0.014 },
  { min: 20_000, max: 50_000, rate: 0.0175 },
  { min: 50_000, max: 70_000, rate: 0.0245 },
  { min: 70_000, max: 80_000, rate: 0.035 },
  { min: 80_000, max: 150_000, rate: 0.05525 },
  { min: 150_000, max: 500_000, rate: 0.0637 },
  { min: 500_000, max: 1_000_000, rate: 0.0897 },
  { min: 1_000_000, max: Infinity, rate: 0.1075 },
];

export const NJ_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 1_000,
  married_joint: 2_000,
  married_separate: 1_000,
  head_household: 1_000,
};

// ─── MASSACHUSETTS (MA) 2025 ───────────────────────────────────────────────
// Flat 5% on all income; personal exemptions used as effective deduction.

const MA_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: Infinity, rate: 0.05 },
];

const MA_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: Infinity, rate: 0.05 },
];

/** MA uses personal exemptions as effective standard deduction */
export const MA_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 4_400,
  married_joint: 8_800,
  married_separate: 4_400,
  head_household: 4_400,
};

// ─── OREGON (OR) 2025 ──────────────────────────────────────────────────────

const OR_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 4_050, rate: 0.0475 },
  { min: 4_050, max: 10_200, rate: 0.0675 },
  { min: 10_200, max: 125_000, rate: 0.0875 },
  { min: 125_000, max: Infinity, rate: 0.099 },
];

const OR_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 8_100, rate: 0.0475 },
  { min: 8_100, max: 20_400, rate: 0.0675 },
  { min: 20_400, max: 250_000, rate: 0.0875 },
  { min: 250_000, max: Infinity, rate: 0.099 },
];

export const OR_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 2_605,
  married_joint: 5_210,
  married_separate: 2_605,
  head_household: 4_700,
};

// ─── CONNECTICUT (CT) 2025 ─────────────────────────────────────────────────
// CT uses a personal exemption credit instead of a standard deduction.

const CT_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 10_000, rate: 0.03 },
  { min: 10_000, max: 50_000, rate: 0.05 },
  { min: 50_000, max: 100_000, rate: 0.055 },
  { min: 100_000, max: 200_000, rate: 0.06 },
  { min: 200_000, max: 250_000, rate: 0.065 },
  { min: 250_000, max: 500_000, rate: 0.069 },
  { min: 500_000, max: Infinity, rate: 0.0699 },
];

const CT_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 20_000, rate: 0.03 },
  { min: 20_000, max: 100_000, rate: 0.05 },
  { min: 100_000, max: 200_000, rate: 0.055 },
  { min: 200_000, max: 400_000, rate: 0.06 },
  { min: 400_000, max: 500_000, rate: 0.065 },
  { min: 500_000, max: 1_000_000, rate: 0.069 },
  { min: 1_000_000, max: Infinity, rate: 0.0699 },
];

/** CT has no standard deduction; uses personal exemption credit instead */
export const CT_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 0,
  married_joint: 0,
  married_separate: 0,
  head_household: 0,
};

// ─── MINNESOTA (MN) 2025 ───────────────────────────────────────────────────

const MN_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 31_690, rate: 0.0535 },
  { min: 31_690, max: 104_090, rate: 0.068 },
  { min: 104_090, max: 183_340, rate: 0.0785 },
  { min: 183_340, max: Infinity, rate: 0.0985 },
];

const MN_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 46_430, rate: 0.0535 },
  { min: 46_430, max: 184_510, rate: 0.068 },
  { min: 184_510, max: 304_970, rate: 0.0785 },
  { min: 304_970, max: Infinity, rate: 0.0985 },
];

export const MN_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 14_000,
  married_joint: 28_000,
  married_separate: 14_000,
  head_household: 21_000,
};

// ─── VIRGINIA (VA) 2025 ────────────────────────────────────────────────────
// Same brackets for all filing statuses.

const VA_BRACKETS_ALL: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 3_000, rate: 0.02 },
  { min: 3_000, max: 5_000, rate: 0.03 },
  { min: 5_000, max: 17_000, rate: 0.05 },
  { min: 17_000, max: Infinity, rate: 0.0575 },
];

export const VA_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 4_500,
  married_joint: 9_000,
  married_separate: 4_500,
  head_household: 4_500,
};

// ─── HAWAII (HI) 2025 ──────────────────────────────────────────────────────
// 12 brackets, 1.4%–11%. From hawaii.gov 2025 tax rate schedules.

const HI_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 9_600, rate: 0.014 },
  { min: 9_600, max: 14_400, rate: 0.032 },
  { min: 14_400, max: 19_200, rate: 0.055 },
  { min: 19_200, max: 24_000, rate: 0.064 },
  { min: 24_000, max: 36_000, rate: 0.068 },
  { min: 36_000, max: 48_000, rate: 0.072 },
  { min: 48_000, max: 125_000, rate: 0.076 },
  { min: 125_000, max: 175_000, rate: 0.079 },
  { min: 175_000, max: 225_000, rate: 0.0825 },
  { min: 225_000, max: 275_000, rate: 0.09 },
  { min: 275_000, max: 325_000, rate: 0.10 },
  { min: 325_000, max: Infinity, rate: 0.11 },
];

const HI_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 19_200, rate: 0.014 },
  { min: 19_200, max: 28_800, rate: 0.032 },
  { min: 28_800, max: 38_400, rate: 0.055 },
  { min: 38_400, max: 48_000, rate: 0.064 },
  { min: 48_000, max: 72_000, rate: 0.068 },
  { min: 72_000, max: 96_000, rate: 0.072 },
  { min: 96_000, max: 250_000, rate: 0.076 },
  { min: 250_000, max: 350_000, rate: 0.079 },
  { min: 350_000, max: 450_000, rate: 0.0825 },
  { min: 450_000, max: 550_000, rate: 0.09 },
  { min: 550_000, max: 650_000, rate: 0.10 },
  { min: 650_000, max: Infinity, rate: 0.11 },
];

export const HI_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 4_400, married_joint: 8_800, married_separate: 4_400, head_household: 6_688,
};

// ─── WISCONSIN (WI) 2025 ───────────────────────────────────────────────────

const WI_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 14_680, rate: 0.035 },
  { min: 14_680, max: 50_480, rate: 0.044 },
  { min: 50_480, max: 323_290, rate: 0.053 },
  { min: 323_290, max: Infinity, rate: 0.0765 },
];

const WI_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 19_580, rate: 0.035 },
  { min: 19_580, max: 67_300, rate: 0.044 },
  { min: 67_300, max: 430_900, rate: 0.053 },
  { min: 430_900, max: Infinity, rate: 0.0765 },
];

export const WI_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 14_260, married_joint: 26_510, married_separate: 12_180, head_household: 14_260,
};

// ─── SOUTH CAROLINA (SC) 2025 ──────────────────────────────────────────────

const SC_BRACKETS_ALL: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 3_560, rate: 0.00 },
  { min: 3_560, max: 17_830, rate: 0.03 },
  { min: 17_830, max: Infinity, rate: 0.06 },
];

export const SC_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 15_000, married_joint: 30_000, married_separate: 15_000, head_household: 15_000,
};

// ─── MARYLAND (MD) 2025 ────────────────────────────────────────────────────

const MD_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 1_000, rate: 0.02 },
  { min: 1_000, max: 2_000, rate: 0.03 },
  { min: 2_000, max: 3_000, rate: 0.04 },
  { min: 3_000, max: 100_000, rate: 0.0475 },
  { min: 100_000, max: 125_000, rate: 0.05 },
  { min: 125_000, max: 150_000, rate: 0.0525 },
  { min: 150_000, max: 250_000, rate: 0.055 },
  { min: 250_000, max: 500_000, rate: 0.0575 },
  { min: 500_000, max: 1_000_000, rate: 0.0625 },
  { min: 1_000_000, max: Infinity, rate: 0.065 },
];

const MD_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 1_000, rate: 0.02 },
  { min: 1_000, max: 2_000, rate: 0.03 },
  { min: 2_000, max: 3_000, rate: 0.04 },
  { min: 3_000, max: 150_000, rate: 0.0475 },
  { min: 150_000, max: 175_000, rate: 0.05 },
  { min: 175_000, max: 225_000, rate: 0.0525 },
  { min: 225_000, max: 300_000, rate: 0.055 },
  { min: 300_000, max: 600_000, rate: 0.0575 },
  { min: 600_000, max: 1_200_000, rate: 0.0625 },
  { min: 1_200_000, max: Infinity, rate: 0.065 },
];

export const MD_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 2_550, married_joint: 5_150, married_separate: 2_550, head_household: 2_550,
};

// ─── OKLAHOMA (OK) 2025 ────────────────────────────────────────────────────

const OK_BRACKETS_ALL: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 1_000, rate: 0.0025 },
  { min: 1_000, max: 2_500, rate: 0.0075 },
  { min: 2_500, max: 3_750, rate: 0.0175 },
  { min: 3_750, max: 4_900, rate: 0.0275 },
  { min: 4_900, max: 7_200, rate: 0.0375 },
  { min: 7_200, max: Infinity, rate: 0.0475 },
];

export const OK_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 7_350, married_joint: 14_700, married_separate: 7_350, head_household: 7_350,
};

// ─── NEBRASKA (NE) 2025 ────────────────────────────────────────────────────

const NE_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 3_700, rate: 0.0246 },
  { min: 3_700, max: 22_170, rate: 0.0351 },
  { min: 22_170, max: 38_870, rate: 0.0501 },
  { min: 38_870, max: Infinity, rate: 0.052 },
];

const NE_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 7_390, rate: 0.0246 },
  { min: 7_390, max: 44_350, rate: 0.0351 },
  { min: 44_350, max: 77_730, rate: 0.0501 },
  { min: 77_730, max: Infinity, rate: 0.052 },
];

export const NE_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 7_900, married_joint: 15_800, married_separate: 7_900, head_household: 11_600,
};

// ─── KANSAS (KS) 2025 ──────────────────────────────────────────────────────

const KS_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 23_000, rate: 0.052 },
  { min: 23_000, max: Infinity, rate: 0.0558 },
];

const KS_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 46_000, rate: 0.052 },
  { min: 46_000, max: Infinity, rate: 0.0558 },
];

export const KS_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 9_765, married_joint: 26_540, married_separate: 9_765, head_household: 9_765,
};

// ─── DELAWARE (DE) 2025 ────────────────────────────────────────────────────

const DE_BRACKETS_ALL: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 2_000, rate: 0.00 },
  { min: 2_000, max: 5_000, rate: 0.022 },
  { min: 5_000, max: 10_000, rate: 0.039 },
  { min: 10_000, max: 20_000, rate: 0.048 },
  { min: 20_000, max: 25_000, rate: 0.052 },
  { min: 25_000, max: 60_000, rate: 0.0555 },
  { min: 60_000, max: Infinity, rate: 0.066 },
];

export const DE_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 3_250, married_joint: 6_500, married_separate: 3_250, head_household: 3_250,
};

// ─── MAINE (ME) 2025 ───────────────────────────────────────────────────────

const ME_BRACKETS_SINGLE: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 27_400, rate: 0.058 },
  { min: 27_400, max: 64_850, rate: 0.0675 },
  { min: 64_850, max: Infinity, rate: 0.0715 },
];

const ME_BRACKETS_MFJ: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 54_850, rate: 0.058 },
  { min: 54_850, max: 129_750, rate: 0.0675 },
  { min: 129_750, max: Infinity, rate: 0.0715 },
];

export const ME_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 15_000, married_joint: 30_000, married_separate: 15_000, head_household: 22_500,
};

// ─── ARKANSAS (AR) 2025 ────────────────────────────────────────────────────

const AR_BRACKETS_ALL: Array<{ min: number; max: number; rate: number }> = [
  { min: 0, max: 5_100, rate: 0.00 },
  { min: 5_100, max: 25_700, rate: 0.02 },
  { min: 25_700, max: Infinity, rate: 0.039 },
];

export const AR_STANDARD_DEDUCTION: Record<StateFilingStatus, number> = {
  single: 2_410, married_joint: 4_820, married_separate: 2_410, head_household: 2_410,
};

// ─── Bracket lookup helpers ────────────────────────────────────────────────

function getCABrackets(status: StateFilingStatus): Array<{ min: number; max: number; rate: number }> {
  switch (status) {
    case 'married_joint':
      return CA_BRACKETS_MARRIED_JOINT;
    case 'head_household':
      return CA_BRACKETS_HOH;
    case 'single':
    case 'married_separate':
    default:
      return CA_BRACKETS_SINGLE_MFS;
  }
}

/**
 * Get progressive brackets for a state + filing status.
 * Returns null if the state is not modeled with full brackets (excluding CA which has its own path).
 * For HoH / MFS where no specific schedule exists, falls back to Single brackets.
 */
function getStateBrackets(
  state: string,
  filingStatus: StateFilingStatus,
): Array<{ min: number; max: number; rate: number }> | null {
  const useMFJ = filingStatus === 'married_joint';
  // HoH and MFS fall back to single brackets where specific schedules are not provided
  switch (state) {
    case 'NY':
      return useMFJ ? NY_BRACKETS_MFJ : NY_BRACKETS_SINGLE;
    case 'NJ':
      return useMFJ ? NJ_BRACKETS_MFJ : NJ_BRACKETS_SINGLE;
    case 'MA':
      return useMFJ ? MA_BRACKETS_MFJ : MA_BRACKETS_SINGLE;
    case 'OR':
      return useMFJ ? OR_BRACKETS_MFJ : OR_BRACKETS_SINGLE;
    case 'CT':
      return useMFJ ? CT_BRACKETS_MFJ : CT_BRACKETS_SINGLE;
    case 'MN':
      return useMFJ ? MN_BRACKETS_MFJ : MN_BRACKETS_SINGLE;
    case 'VA':
      return VA_BRACKETS_ALL;
    // ── New states ──────────────────────────────────────────────
    case 'HI':
      return useMFJ ? HI_BRACKETS_MFJ : HI_BRACKETS_SINGLE;
    case 'WI':
      return useMFJ ? WI_BRACKETS_MFJ : WI_BRACKETS_SINGLE;
    case 'SC':
      return SC_BRACKETS_ALL;
    case 'MD':
      return useMFJ ? MD_BRACKETS_MFJ : MD_BRACKETS_SINGLE;
    case 'OK':
      return OK_BRACKETS_ALL;
    case 'NE':
      return useMFJ ? NE_BRACKETS_MFJ : NE_BRACKETS_SINGLE;
    case 'KS':
      return useMFJ ? KS_BRACKETS_MFJ : KS_BRACKETS_SINGLE;
    case 'DE':
      return DE_BRACKETS_ALL;
    case 'ME':
      return useMFJ ? ME_BRACKETS_MFJ : ME_BRACKETS_SINGLE;
    case 'AR':
      return AR_BRACKETS_ALL;
    default:
      return null;
  }
}

/**
 * Generic progressive-bracket tax calculation.
 * Same algorithm as CA: each bracket taxes min(remaining, width) dollars at that rate.
 */
function calculateProgressiveTax(
  taxableIncome: number,
  brackets: Array<{ min: number; max: number; rate: number }>,
): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let remaining = taxableIncome;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const width = b.max - b.min;
    const inBracket = Math.min(remaining, width);
    tax += inBracket * b.rate;
    remaining -= inBracket;
  }
  return Math.round(tax * 100) / 100;
}

/**
 * CA state tax using FTB 2025 Tax Rate Schedules + MHSA surcharge.
 * Top marginal: 12.3% (income) + 1% MHSA on income > $1M. SDI (1.2% on W-2 gross) is separate – use calculateCASDI.
 * Brackets applied in order: each bracket taxes min(remaining, width) dollars at that rate.
 * @param caTaxableIncome – CA taxable income (after CA standard deduction).
 * @param filingStatus – Used to pick Schedule X, Y, or Z.
 */
export function calculateCAStateTax(
  caTaxableIncome: number,
  filingStatus: StateFilingStatus
): number {
  if (caTaxableIncome <= 0) return 0;
  const brackets = getCABrackets(filingStatus);
  let tax = 0;
  let remaining = caTaxableIncome;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const width = b.max - b.min; // exact count of dollars in this bracket
    const inBracket = Math.min(remaining, width);
    tax += inBracket * b.rate;
    remaining -= inBracket;
  }
  if (caTaxableIncome > CA_MHSA_THRESHOLD) {
    tax += (caTaxableIncome - CA_MHSA_THRESHOLD) * CA_MHSA_RATE;
  }
  return Math.round(tax * 100) / 100; // match FTB two-decimal rounding
}

/** No wage income tax (2026): AK, FL, NV, NH, SD, TN, TX, WA, WY. WA has capital-gains tax for high earners. */
const NO_TAX_STATES = new Set([
  'AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY',
]);

/**
 * Flat-rate states (2026): OH 2.75%, AZ, CO, GA, ID, IL, IN, IA, KY, LA, MI, MS, NC, PA, UT.
 * States with full progressive brackets modeled above are NOT in this list.
 */
const STATE_FLAT_ESTIMATE: Record<string, number> = {
  OH: 0.0275,
  AZ: 0.025,
  CO: 0.044,
  GA: 0.0549,
  ID: 0.058,
  IL: 0.0495,
  IN: 0.0315,
  IA: 0.06,
  KY: 0.045,
  LA: 0.0425,
  MI: 0.0425,
  MS: 0.05,
  NC: 0.0475,
  PA: 0.0307,
  UT: 0.0485,
  DC: 0.065,
  ND: 0.029,
  MO: 0.048,
  WV: 0.065,
  AL: 0.05,
  RI: 0.0599,
  VT: 0.0875,
  MT: 0.068,
  NM: 0.049,
};

/**
 * State tax for a given state and filing status.
 * CA: full progressive + MHSA.
 * NY, NJ, MA, OR, CT, MN, VA: progressive bracket calculation.
 * IL, PA, and remaining states: flat-rate estimate.
 * No-tax states: 0.
 */
export function calculateStateTax(
  stateCode: string,
  stateTaxableIncome: number,
  filingStatus: StateFilingStatus,
): number {
  if (stateTaxableIncome <= 0) return 0;
  const state = (stateCode || 'CA').toUpperCase();

  // CA has its own calculation with MHSA surcharge
  if (state === 'CA') {
    return calculateCAStateTax(stateTaxableIncome, filingStatus);
  }

  // No wage income tax states
  if (NO_TAX_STATES.has(state)) return 0;

  // Progressive bracket states (NY, NJ, MA, OR, CT, MN, VA)
  const brackets = getStateBrackets(state, filingStatus);
  if (brackets) {
    return calculateProgressiveTax(stateTaxableIncome, brackets);
  }

  // Flat-rate states and remaining estimates
  const rate = STATE_FLAT_ESTIMATE[state] ?? 0;
  return Math.round(stateTaxableIncome * rate * 100) / 100;
}

/**
 * Calculate nonresident state tax using the income ratio method.
 * Most states compute: (full-year tax on total income) × (state-source income / total income).
 * This is the standard method for individual nonresident returns (Schedule NR).
 *
 * @param stateCode – The work state (where income was earned).
 * @param stateSourceIncome – Income earned in the work state.
 * @param totalIncome – Total income from all sources.
 * @param filingStatus – Filing status.
 * @returns Nonresident tax owed to the work state.
 */
export function calculateNonresidentStateTax(
  stateCode: string,
  stateSourceIncome: number,
  totalIncome: number,
  filingStatus: StateFilingStatus,
): number {
  if (stateSourceIncome <= 0 || totalIncome <= 0) return 0;

  const state = (stateCode || '').toUpperCase();
  if (NO_TAX_STATES.has(state)) return 0;

  // Get standard deduction for the work state
  const stateStdDed = getStateStandardDeduction(state, filingStatus);

  // Calculate tax as if all income were in this state
  const fullStateTaxableIncome = Math.max(0, totalIncome - stateStdDed);
  const fullStateTax = calculateStateTax(state, fullStateTaxableIncome, filingStatus);

  // Prorate by income ratio
  const ratio = Math.min(1, stateSourceIncome / totalIncome);
  return Math.round(fullStateTax * ratio * 100) / 100;
}

/**
 * Returns the standard deduction for a given state and filing status.
 * States without a standard deduction (e.g. CT) return 0.
 * States not explicitly modeled return 0.
 */
export function getStateStandardDeduction(
  stateCode: string,
  filingStatus: StateFilingStatus,
): number {
  const state = (stateCode || 'CA').toUpperCase();
  switch (state) {
    case 'CA': return CA_STANDARD_DEDUCTION_2025[filingStatus];
    case 'NY': return NY_STANDARD_DEDUCTION[filingStatus];
    case 'NJ': return NJ_STANDARD_DEDUCTION[filingStatus];
    case 'MA': return MA_STANDARD_DEDUCTION[filingStatus];
    case 'OR': return OR_STANDARD_DEDUCTION[filingStatus];
    case 'CT': return CT_STANDARD_DEDUCTION[filingStatus];
    case 'MN': return MN_STANDARD_DEDUCTION[filingStatus];
    case 'VA': return VA_STANDARD_DEDUCTION[filingStatus];
    case 'HI': return HI_STANDARD_DEDUCTION[filingStatus];
    case 'WI': return WI_STANDARD_DEDUCTION[filingStatus];
    case 'SC': return SC_STANDARD_DEDUCTION[filingStatus];
    case 'MD': return MD_STANDARD_DEDUCTION[filingStatus];
    case 'OK': return OK_STANDARD_DEDUCTION[filingStatus];
    case 'NE': return NE_STANDARD_DEDUCTION[filingStatus];
    case 'KS': return KS_STANDARD_DEDUCTION[filingStatus];
    case 'DE': return DE_STANDARD_DEDUCTION[filingStatus];
    case 'ME': return ME_STANDARD_DEDUCTION[filingStatus];
    case 'AR': return AR_STANDARD_DEDUCTION[filingStatus];
    default: return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE-SPECIFIC AGI ADJUSTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CA AGI adjustments:
 *  - CA taxes ALL capital gains as ordinary income (no preferential LTCG rate)
 *  - CA does not conform to federal SALT deduction (irrelevant for state calc,
 *    but affects what's "income" if user itemized with SALT on federal)
 *  - CA does not allow NOL deduction in most cases (suspended through 2026 for
 *    taxpayers with >= $1M of net business income or modified AGI)
 *
 * @param federalAGI – The federal AGI.
 * @param federalSaltDeducted – The federal SALT deduction the user took (add back for CA).
 * @returns CA-adjusted AGI for use with CA standard deduction and brackets.
 */
export function calculateCAAdjustedAGI(
  federalAGI: number,
  federalSaltDeducted: number,
): number {
  // CA starts with federal AGI but adds back the federal SALT deduction
  // (CA doesn't allow deducting state taxes on the state return)
  // Note: in practice, the engine already computes state tax on (agi - stateStdDed),
  // so this function can be used for more precise CA AGI if needed.
  return federalAGI + federalSaltDeducted;
}

/**
 * NY AGI adjustments:
 *  - NY adds back SALT (state/local income tax) deducted on federal Schedule A
 *  - NY does NOT tax Social Security benefits
 *  - NY has its own standard deduction (already modeled above)
 *
 * @param federalAGI – The federal AGI.
 * @param federalSaltDeducted – The federal SALT deduction taken on Schedule A.
 * @param socialSecurityIncome – Total Social Security income (excluded from NY AGI).
 * @returns NY-adjusted AGI.
 */
export function calculateNYAdjustedAGI(
  federalAGI: number,
  federalSaltDeducted: number,
  socialSecurityIncome: number,
): number {
  // NY starts with federal AGI, adds back SALT, and subtracts Social Security
  return federalAGI + federalSaltDeducted - socialSecurityIncome;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECIPROCAL AGREEMENTS (v1.5 Multi-State)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * State reciprocal tax agreements for 2025.
 * If state A has reciprocity with state B, a resident of A working in B
 * only needs to file/pay income tax in their home state (A).
 * DC has unilateral reciprocity (doesn't tax any non-resident wages).
 */
const RECIPROCAL_AGREEMENTS: Record<string, Set<string>> = {
  AZ: new Set(['CA', 'IN', 'OR', 'VA']),
  DC: new Set([]), // DC has unilateral reciprocity — doesn't tax non-resident wages
  IL: new Set(['IA', 'KY', 'MI', 'WI']),
  IN: new Set(['KY', 'MI', 'OH', 'PA', 'WI']),
  IA: new Set(['IL']),
  KY: new Set(['IL', 'IN', 'MI', 'OH', 'VA', 'WI', 'WV']),
  MD: new Set(['DC', 'PA', 'VA', 'WV']),
  MI: new Set(['IL', 'IN', 'KY', 'MN', 'OH', 'WI']),
  MN: new Set(['MI', 'ND']),
  MT: new Set(['ND']),
  NJ: new Set(['PA']),
  ND: new Set(['MN', 'MT']),
  OH: new Set(['IN', 'KY', 'MI', 'PA', 'WV']),
  PA: new Set(['IN', 'MD', 'NJ', 'OH', 'VA', 'WV']),
  VA: new Set(['DC', 'KY', 'MD', 'PA', 'WV']),
  WV: new Set(['KY', 'MD', 'OH', 'PA', 'VA']),
  WI: new Set(['IL', 'IN', 'KY', 'MI']),
};

export interface ReciprocityResult {
  /** Whether a reciprocal agreement exists */
  hasReciprocity: boolean;
  /** Human-readable message for the user */
  message: string;
  /** Whether the work state doesn't tax non-resident wages at all (DC, no-tax states) */
  workStateExempt: boolean;
}

/**
 * Check if a reciprocal agreement exists between the resident state and work state.
 * Returns a result with a user-friendly message.
 *
 * @param residentState — The state where the taxpayer lives (2-letter code).
 * @param workState — The state where the taxpayer earned income (2-letter code).
 */
export function checkReciprocity(
  residentState: string,
  workState: string,
): ReciprocityResult {
  const home = (residentState || '').toUpperCase();
  const work = (workState || '').toUpperCase();

  if (home === work) {
    return { hasReciprocity: true, message: 'Same state — no multi-state filing needed.', workStateExempt: false };
  }

  // Work state has no income tax at all
  if (NO_TAX_STATES.has(work)) {
    return {
      hasReciprocity: true,
      message: `${work} has no state income tax. You only file in ${home}.`,
      workStateExempt: true,
    };
  }

  // DC doesn't tax non-resident wages (unilateral reciprocity)
  if (work === 'DC') {
    return {
      hasReciprocity: true,
      message: 'DC does not tax non-resident wages. You only file in your home state.',
      workStateExempt: true,
    };
  }

  // Check reciprocal agreement
  const homeAgreements = RECIPROCAL_AGREEMENTS[home];
  if (homeAgreements?.has(work)) {
    return {
      hasReciprocity: true,
      message: `${home} and ${work} have a reciprocal agreement. You only need to file in your home state (${home}). File an exemption form with your ${work} employer.`,
      workStateExempt: false,
    };
  }

  // Check reverse direction too (agreements are bilateral)
  const workAgreements = RECIPROCAL_AGREEMENTS[work];
  if (workAgreements?.has(home)) {
    return {
      hasReciprocity: true,
      message: `${home} and ${work} have a reciprocal agreement. You only need to file in your home state (${home}). File an exemption form with your ${work} employer.`,
      workStateExempt: false,
    };
  }

  // No reciprocity — multi-state filing needed
  return {
    hasReciprocity: false,
    message: `No reciprocal agreement between ${home} and ${work}. You may need to file a nonresident return in ${work} and claim a credit in ${home}. Consider consulting a tax professional for multi-state filing.`,
    workStateExempt: false,
  };
}

/**
 * Get all states that have reciprocal agreements with the given state.
 * Returns empty array for states without any agreements.
 */
export function getReciprocalStates(stateCode: string): string[] {
  const state = (stateCode || '').toUpperCase();
  const direct = RECIPROCAL_AGREEMENTS[state];
  const result = new Set<string>(direct || []);

  // Also find states that list this state in their agreements
  for (const [otherState, partners] of Object.entries(RECIPROCAL_AGREEMENTS)) {
    if (partners.has(state)) result.add(otherState);
  }

  // No-tax states effectively have reciprocity with everyone
  // DC has unilateral reciprocity
  return Array.from(result).sort();
}

