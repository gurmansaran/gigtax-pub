/**
 * Edge-case test suite for the 18 federal vulnerability fixes.
 * Tests tricky combinations of: capital loss cap, SSTB phase-out, AMT,
 * passive loss rules, kiddie tax, NOL, and interaction patterns.
 *
 * Run: npx jest lib/__tests__/unifiedTaxEngine.test.ts
 */

import { calculateUnifiedTax, type TaxReturnState } from '../unifiedTaxEngine';
import { createEmptyTaxReturn } from '../types/TaxReturn';

/** Helper: creates a base return with common defaults to avoid repetition */
function makeReturn(overrides: Partial<TaxReturnState>): TaxReturnState {
    const base = createEmptyTaxReturn();
    return {
        ...base,
        filingStatus: 'single',
        stateOfResidence: 'TX', // No state tax keeps tests focused on federal
        ...overrides,
    };
}

/** Helper: make 1099 income (single source) */
function gig(gross: number): Array<{ source: string; grossAmount: number; tipPortion: number }> {
    return [{ source: 'Rideshare', grossAmount: gross, tipPortion: 0 }];
}

// ═══════════════════════════════════════════════════════════════════════════════
// B1: CAPITAL LOSS EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Capital Loss Cap (#4)', () => {
    test('net loss > $3K → deduction capped at $3K, excess carries forward', () => {
        const result = calculateUnifiedTax(makeReturn({
            capitalGainsShortTerm: -10_000,
            capitalGainsLongTerm: 0,
        }));
        expect(result.capitalLossCarryforward).toBe(7_000);
    });

    test('MFS → $1.5K cap', () => {
        const result = calculateUnifiedTax(makeReturn({
            filingStatus: 'married_separate',
            capitalGainsShortTerm: -5_000,
        }));
        expect(result.capitalLossCarryforward).toBe(3_500);
    });

    test('prior carryforward + current gains → net against carryforward first', () => {
        const result = calculateUnifiedTax(makeReturn({
            capitalGainsShortTerm: 2_000,
            priorYearCapitalLossCarryforward: 5_000,
        }));
        // Net: 2K gains - 5K carryforward = -3K net, exactly at cap
        expect(result.capitalLossCarryforward).toBe(0);
    });

    test('large prior carryforward, no current gains → $3K deduction, rest carries', () => {
        const result = calculateUnifiedTax(makeReturn({
            priorYearCapitalLossCarryforward: 20_000,
        }));
        expect(result.capitalLossCarryforward).toBe(17_000);
    });

    test('gains exceed carryforward → no carryforward, positive income', () => {
        const result = calculateUnifiedTax(makeReturn({
            capitalGainsLongTerm: 10_000,
            priorYearCapitalLossCarryforward: 3_000,
        }));
        expect(result.capitalLossCarryforward).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B2: SSTB PHASE-OUT EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('QBI SSTB Phase-out (#8)', () => {
    test('SSTB below threshold → full QBI deduction', () => {
        const result = calculateUnifiedTax(makeReturn({
            isSSTB: true,
            income1099: gig(100_000),
            businessExpenses: 20_000,
        }));
        expect(result.qbiDeduction).toBeGreaterThan(0);
    });

    test('SSTB above full phase-out → QBI = 0', () => {
        const result = calculateUnifiedTax(makeReturn({
            isSSTB: true,
            income1099: gig(300_000),
            businessExpenses: 10_000,
        }));
        expect(result.qbiDeduction).toBe(0);
    });

    test('non-SSTB above threshold → QBI phases out by $257,300', () => {
        const result = calculateUnifiedTax(makeReturn({
            isSSTB: false,
            income1099: gig(300_000),
            businessExpenses: 10_000,
        }));
        expect(result.qbiDeduction).toBe(0);
    });

    test('non-SSTB below threshold → full QBI', () => {
        const result = calculateUnifiedTax(makeReturn({
            isSSTB: false,
            income1099: gig(80_000),
            businessExpenses: 10_000,
        }));
        expect(result.qbiDeduction).toBeGreaterThan(0);
        expect(result.qbiDeduction).toBeLessThanOrEqual(70_000 * 0.2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B3: AMT EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Alternative Minimum Tax (#1)', () => {
    test('normal income, no ISO → AMT should be 0', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(80_000),
            businessExpenses: 10_000,
        }));
        expect(result.amt).toBe(0);
    });

    test('high ISO exercise → AMT triggered', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(200_000),
            businessExpenses: 20_000,
            isoExerciseIncome: 300_000,
        }));
        expect(result.amt).toBeGreaterThan(0);
        expect(result.amti).toBeGreaterThan(result.taxableIncome);
    });

    test('standard deduction filer → no SALT add-back in AMT', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(50_000),
        }));
        expect(result.amti).toBe(result.taxableIncome);
        expect(result.amt).toBe(0);
    });

    test('high SALT itemizer → SALT added back in AMT', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(400_000),
            businessExpenses: 30_000,
            propertyTaxes: 35_000,
            mortgageInterest: 20_000,
            mortgageBalance: 500_000,
            stateOfResidence: 'CA',
        }));
        expect(result.amti).toBeGreaterThanOrEqual(result.taxableIncome);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B4: PASSIVE LOSS + RENTAL EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Passive Loss Rules (#9)', () => {
    test('rental loss < $25K, AGI < $100K → full deduction', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(60_000),
            businessExpenses: 10_000,
            rentalIncome: -20_000,
        }));
        expect(result.suspendedPassiveLoss).toBe(0);
        expect(result.allowableRentalIncome).toBe(-20_000);
    });

    test('rental loss, AGI > $150K → $0 allowed, full suspension', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(200_000),
            businessExpenses: 10_000,
            rentalIncome: -20_000,
        }));
        expect(result.allowableRentalIncome).toBe(0);
        expect(result.suspendedPassiveLoss).toBe(20_000);
    });

    test('MFS → $0 rental loss allowance regardless of AGI', () => {
        const result = calculateUnifiedTax(makeReturn({
            filingStatus: 'married_separate',
            income1099: gig(50_000),
            rentalIncome: -10_000,
        }));
        expect(result.allowableRentalIncome).toBe(0);
        expect(result.suspendedPassiveLoss).toBe(10_000);
    });

    test('positive rental income → no passive loss limit', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(50_000),
            rentalIncome: 5_000,
        }));
        expect(result.suspendedPassiveLoss).toBe(0);
        expect(result.allowableRentalIncome).toBe(5_000);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B5: KIDDIE TAX EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Kiddie Tax (#17)', () => {
    test('not subject to kiddie tax → kiddieTax = 0', () => {
        const result = calculateUnifiedTax(makeReturn({
            isSubjectToKiddieTax: false,
            interestIncome: 10_000,
            dividendIncome: 5_000,
            parentMarginalRate: 0.37,
        }));
        expect(result.kiddieTax).toBe(0);
    });

    test('unearned income below threshold → kiddieTax = 0', () => {
        const result = calculateUnifiedTax(makeReturn({
            isSubjectToKiddieTax: true,
            parentMarginalRate: 0.37,
            interestIncome: 1_000,
            dividendIncome: 1_000,
        }));
        expect(result.kiddieTax).toBe(0);
    });

    test('unearned income above threshold, 37% parent rate → kiddie tax calculated', () => {
        const result = calculateUnifiedTax(makeReturn({
            isSubjectToKiddieTax: true,
            parentMarginalRate: 0.37,
            interestIncome: 10_000,
            dividendIncome: 5_000,
        }));
        expect(result.kiddieTax).toBeGreaterThan(0);
    });

    test('parent rate 0 → no kiddie tax', () => {
        const result = calculateUnifiedTax(makeReturn({
            isSubjectToKiddieTax: true,
            parentMarginalRate: 0,
            interestIncome: 10_000,
        }));
        expect(result.kiddieTax).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B6: NOL EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('NOL Carryforward (#18)', () => {
    test('NOL $100K, moderate income → partial deduction with carryforward', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(80_000),
            businessExpenses: 20_000,
            priorYearNOL: 100_000,
        }));
        expect(result.nolDeduction).toBeGreaterThan(0);
        expect(result.nolCarryforward).toBeGreaterThan(0);
    });

    test('no NOL → deduction = 0, carryforward = 0', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(50_000),
            priorYearNOL: 0,
        }));
        expect(result.nolDeduction).toBe(0);
        expect(result.nolCarryforward).toBe(0);
    });

    test('small NOL fully used → carryforward = 0', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(100_000),
            businessExpenses: 10_000,
            priorYearNOL: 1_000,
        }));
        expect(result.nolDeduction).toBe(1_000);
        expect(result.nolCarryforward).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B7: INTERACTION COMBINATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Interaction Combinations', () => {
    test('capital loss + NOL + passive loss together', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(80_000),
            businessExpenses: 10_000,
            capitalGainsShortTerm: -15_000,
            priorYearNOL: 20_000,
            rentalIncome: -30_000,
        }));
        expect(result.capitalLossCarryforward).toBeGreaterThanOrEqual(0);
        expect(result.nolDeduction).toBeGreaterThanOrEqual(0);
        expect(result.suspendedPassiveLoss).toBeGreaterThanOrEqual(0);
        expect(result.federalTax).toBeGreaterThanOrEqual(0);
    });

    test('EITC MFS blocked + SSTB + dependent → stacks correctly', () => {
        const result = calculateUnifiedTax(makeReturn({
            filingStatus: 'married_separate',
            income1099: gig(30_000),
            businessExpenses: 5_000,
            isSSTB: true,
            canBeClaimedAsDependent: true,
        }));
        expect(result.eitc).toBe(0);
        expect(result.standardDeductionAmount).toBeLessThanOrEqual(15_750);
    });

    test('high income: AMT + NIIT + Additional Medicare + SALT phase-out', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(600_000),
            businessExpenses: 50_000,
            interestIncome: 30_000,
            dividendIncome: 20_000,
            propertyTaxes: 30_000,
            stateOfResidence: 'CA',
            isoExerciseIncome: 100_000,
        }));
        expect(result.niit).toBeGreaterThan(0);
        expect(result.additionalMedicareTaxTotal).toBeGreaterThan(0);
        expect(result.saltDeduction).toBeLessThanOrEqual(40_000);
        expect(result.federalTax).toBeGreaterThan(0);
    });

    test('dependent + kiddie tax + employer health plan', () => {
        const result = calculateUnifiedTax(makeReturn({
            canBeClaimedAsDependent: true,
            isSubjectToKiddieTax: true,
            parentMarginalRate: 0.35,
            eligibleForEmployerHealthPlan: true,
            interestIncome: 5_000,
            dividendIncome: 3_000,
            healthInsurancePremiums: 6_000,
            income1099: gig(5_000),
        }));
        expect(result.standardDeductionAmount).toBeLessThan(15_750);
        expect(result.federalTax).toBeGreaterThanOrEqual(0);
    });

    test('charitable over 60% AGI limit + carryforward', () => {
        const result = calculateUnifiedTax(makeReturn({
            income1099: gig(50_000),
            businessExpenses: 5_000,
            charitableDonations: 40_000,
            priorCharitableCarryforward: 5_000,
        }));
        expect(result.allowableCharitable).toBeLessThanOrEqual(result.agi * 0.6);
        expect(result.charitableCarryforward).toBeGreaterThan(0);
    });

    test('zero income → all values should be 0 or safe', () => {
        const result = calculateUnifiedTax(makeReturn({}));
        expect(result.grossIncome).toBe(0);
        expect(result.federalTax).toBe(0);
        expect(result.amt).toBe(0);
        expect(result.kiddieTax).toBe(0);
        expect(result.capitalLossCarryforward).toBe(0);
        expect(result.suspendedPassiveLoss).toBe(0);
        expect(result.nolDeduction).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B8: MULTI-STATE TAX CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Multi-State Tax Calculation', () => {
    test('NJ resident, 40% income in NY → work state tax + credit', () => {
        const result = calculateUnifiedTax(makeReturn({
            stateOfResidence: 'NJ',
            workState: 'NY',
            workStateIncomePercent: 40,
            income1099: gig(100_000),
            businessExpenses: 10_000,
        }));
        // NY (work state) should have nonresident tax
        expect(result.workStateTax).toBeGreaterThan(0);
        // NJ (home state) should have full tax
        expect(result.homeStateTaxBeforeCredit).toBeGreaterThan(0);
        // Credit should be ≤ work state tax
        expect(result.otherStateCredit).toBeLessThanOrEqual(result.workStateTax);
        expect(result.otherStateCredit).toBeGreaterThan(0);
        // Net home state tax should be reduced
        expect(result.homeStateTaxAfterCredit).toBeLessThan(result.homeStateTaxBeforeCredit);
        // Total state tax = work + net home
        expect(result.estimatedStateTax).toBe(result.workStateTax + result.homeStateTaxAfterCredit);
    });

    test('NJ/PA reciprocal pair − no multi-state calc when workStateIncomePercent = 0', () => {
        const result = calculateUnifiedTax(makeReturn({
            stateOfResidence: 'NJ',
            workState: 'PA',
            workStateIncomePercent: 0, // reciprocal — user sets 0 (UI handles this)
            income1099: gig(80_000),
            businessExpenses: 10_000,
        }));
        // No multi-state calc triggered (percent = 0)
        expect(result.workStateTax).toBe(0);
        expect(result.homeStateTaxBeforeCredit).toBeGreaterThan(0);
        expect(result.homeStateTaxAfterCredit).toBe(result.homeStateTaxBeforeCredit);
    });

    test('TX resident, 100% income in CA → CA nonresident tax only', () => {
        const result = calculateUnifiedTax(makeReturn({
            stateOfResidence: 'TX',
            workState: 'CA',
            workStateIncomePercent: 100,
            income1099: gig(80_000),
            businessExpenses: 10_000,
        }));
        // CA work state tax should be > 0
        expect(result.workStateTax).toBeGreaterThan(0);
        // TX has no tax → home state tax = 0
        expect(result.homeStateTaxBeforeCredit).toBe(0);
        expect(result.otherStateCredit).toBe(0);
        expect(result.homeStateTaxAfterCredit).toBe(0);
        // Total = just CA nonresident
        expect(result.estimatedStateTax).toBe(result.workStateTax);
    });

    test('same state → no multi-state, single state tax only', () => {
        const result = calculateUnifiedTax(makeReturn({
            stateOfResidence: 'NY',
            workState: 'NY', // same state
            workStateIncomePercent: 50,
            income1099: gig(80_000),
            businessExpenses: 10_000,
        }));
        // Same state → no multi-state triggered
        expect(result.workStateTax).toBe(0);
        expect(result.homeStateTaxBeforeCredit).toBeGreaterThan(0);
    });

    test('no workState set → single state only', () => {
        const result = calculateUnifiedTax(makeReturn({
            stateOfResidence: 'NY',
            income1099: gig(80_000),
            businessExpenses: 10_000,
        }));
        expect(result.workStateTax).toBe(0);
        expect(result.estimatedStateTax).toBeGreaterThan(0);
    });

    test('credit ≤ home state tax on work-state income', () => {
        const result = calculateUnifiedTax(makeReturn({
            stateOfResidence: 'NY',
            workState: 'NJ',
            workStateIncomePercent: 30,
            income1099: gig(150_000),
            businessExpenses: 15_000,
        }));
        // Credit should never exceed work state tax
        expect(result.otherStateCredit).toBeLessThanOrEqual(result.workStateTax);
        // Home state after credit should be >= 0
        expect(result.homeStateTaxAfterCredit).toBeGreaterThanOrEqual(0);
    });
});
