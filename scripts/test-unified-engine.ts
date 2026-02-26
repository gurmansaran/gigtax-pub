/**
 * Test script for Unified Tax Engine v2.0
 * Verifies all 3 original test cases + EITC, LTCG, State tax tests
 *
 * Run: npx tsx scripts/test-unified-engine.ts
 */

import { calculateUnifiedTax, type TaxReturnState } from '../lib/unifiedTaxEngine';

function defaultState(): TaxReturnState {
  return {
    filingStatus: 'single',
    w2Incomes: [],
    income1099: [],
    capitalGains: 0,
    capitalGainsShortTerm: 0,
    capitalGainsLongTerm: 0,
    spouseIncome: 0,
    spouseWithholding: 0,
    dependents: 0,
    iraContribution: 0,
    estimatedTaxesPaid: 0,
    studentLoanInterest: 0,
    healthInsurancePremiums: 0,
    stateOfResidence: 'CA',
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
    businessExpenses: 0,
    parkingAndTolls: 0,
    sepIraContribution: 0,
    hsaContribution: 0,
    hsaFamilyPlan: false,
    childCareExpenses: 0,
  };
}

function formatMoney(n: number): string {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let passed = 0;
let failed = 0;

function assert(label: string, actual: number, expected: number, tolerance: number) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`  ✓ ${label}: ${formatMoney(actual)} (expected ${formatMoney(expected)}, diff ${formatMoney(diff)})`);
    passed++;
  } else {
    console.log(`  ✗ ${label}: ${formatMoney(actual)} (expected ${formatMoney(expected)}, diff ${formatMoney(diff)} > tolerance ${formatMoney(tolerance)})`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST CASE 1: Single Gig Worker — $60k 1099 / $15k expenses / CA
// ═══════════════════════════════════════════════════════════════════════
console.log('\n════ Test Case 1: Single Gig Worker ($60k/$15k, CA) ════');
const tc1 = defaultState();
tc1.filingStatus = 'single';
tc1.stateOfResidence = 'CA';
tc1.income1099 = [{ source: 'Uber', grossAmount: 60000, tipPortion: 0, withheld: 0 }];
tc1.businessExpenses = 15000;

const r1 = calculateUnifiedTax(tc1);
console.log('  Net Business Income:', formatMoney(r1.netBusinessIncome));
console.log('  SE Tax:', formatMoney(r1.seTax));
console.log('  SE Tax Deduction:', formatMoney(r1.seTaxDeduction));
console.log('  QBI Deduction:', formatMoney(r1.qbiDeduction));
console.log('  AGI:', formatMoney(r1.agi));
console.log('  Federal Tax:', formatMoney(r1.federalTax));
console.log('  State Tax:', formatMoney(r1.estimatedStateTax));
console.log('  Total Tax:', formatMoney(r1.totalTax));
console.log('  NIIT:', formatMoney(r1.niit));
console.log('  Effective Rate:', (r1.effectiveTotalRate * 100).toFixed(1) + '%');

assert('Net Business Income', r1.netBusinessIncome, 45000, 0);
assert('SE Tax', r1.seTax, 6353, 50);
assert('SE Tax Deduction', r1.seTaxDeduction, 3177, 50);
assert('QBI Deduction', r1.qbiDeduction, 9000, 100);
assert('Federal Tax', r1.federalTax, 8253, 200);
assert('Total Tax', r1.totalTax, 9500, 500);

// ═══════════════════════════════════════════════════════════════════════
// TEST CASE 2: MFJ — W-2 Spouse $50k + Gig $40k / 2 kids / CA
// ═══════════════════════════════════════════════════════════════════════
console.log('\n════ Test Case 2: MFJ ($50k W-2 + $40k Gig, 2 kids, CA) ════');
const tc2 = defaultState();
tc2.filingStatus = 'married_joint';
tc2.stateOfResidence = 'CA';
tc2.w2Incomes = [{ employer: 'Company', wages: 50000, withheld: 5000 }];
tc2.income1099 = [{ source: 'Uber', grossAmount: 40000, tipPortion: 0, withheld: 0 }];
tc2.businessExpenses = 10000;
tc2.dependents = 2;
tc2.dependentDetails = [
  { dateOfBirth: '2020-03-15', relationship: 'son' },
  { dateOfBirth: '2017-06-20', relationship: 'daughter' },
];
tc2.estimatedTaxesPaid = 2000;

const r2 = calculateUnifiedTax(tc2);
console.log('  Net Business Income:', formatMoney(r2.netBusinessIncome));
console.log('  SE Tax:', formatMoney(r2.seTax));
console.log('  CTC:', formatMoney(r2.childTaxCredit));
console.log('  QBI Deduction:', formatMoney(r2.qbiDeduction));
console.log('  AGI:', formatMoney(r2.agi));
console.log('  Federal Tax:', formatMoney(r2.federalTax));
console.log('  State Tax:', formatMoney(r2.estimatedStateTax));
console.log('  Total Tax:', formatMoney(r2.totalTax));
console.log('  Refund/Owed:', r2.finalBillOrRefund > 0 ? 'Owed ' + formatMoney(r2.finalBillOrRefund) : 'Refund ' + formatMoney(r2.finalBillOrRefund));

assert('Net Business Income', r2.netBusinessIncome, 30000, 0);
assert('CTC', r2.childTaxCredit, 4000, 100);
assert('QBI Deduction', r2.qbiDeduction, 6000, 100);

// ═══════════════════════════════════════════════════════════════════════
// TEST CASE 3: HoH — $120k Gig / $25k expenses / 1 kid / CA
// ═══════════════════════════════════════════════════════════════════════
console.log('\n════ Test Case 3: HoH ($120k Gig, $25k expenses, 1 kid, CA) ════');
const tc3 = defaultState();
tc3.filingStatus = 'head_household';
tc3.stateOfResidence = 'CA';
tc3.income1099 = [{ source: 'DoorDash', grossAmount: 120000, tipPortion: 0, withheld: 0 }];
tc3.businessExpenses = 25000;
tc3.dependents = 1;
tc3.dependentDetails = [{ dateOfBirth: '2015-09-01', relationship: 'son' }];
tc3.estimatedTaxesPaid = 20000;

const r3 = calculateUnifiedTax(tc3);
console.log('  Net Business Income:', formatMoney(r3.netBusinessIncome));
console.log('  SE Tax:', formatMoney(r3.seTax));
console.log('  QBI Deduction:', formatMoney(r3.qbiDeduction));
console.log('  AGI:', formatMoney(r3.agi));
console.log('  Federal Tax:', formatMoney(r3.federalTax));
console.log('  State Tax:', formatMoney(r3.estimatedStateTax));
console.log('  Total Tax:', formatMoney(r3.totalTax));
console.log('  Refund/Owed:', r3.finalBillOrRefund > 0 ? 'Owed ' + formatMoney(r3.finalBillOrRefund) : 'Refund ' + formatMoney(r3.finalBillOrRefund));

assert('Net Business Income', r3.netBusinessIncome, 95000, 0);
assert('QBI Deduction', r3.qbiDeduction, 19000, 200);

// ═══════════════════════════════════════════════════════════════════════
// TEST CASE 4: EITC — Low-Income Single with 1 Child
// ═══════════════════════════════════════════════════════════════════════
console.log('\n════ Test Case 4: EITC Low-Income ($18k 1099, 1 child) ════');
const tc4 = defaultState();
tc4.filingStatus = 'single';
tc4.stateOfResidence = 'CA';
tc4.income1099 = [{ source: 'DoorDash', grossAmount: 18000, tipPortion: 0, withheld: 0 }];
tc4.businessExpenses = 5000;
tc4.dependents = 1;
tc4.dependentDetails = [{ dateOfBirth: '2019-05-10', relationship: 'daughter' }];

const r4 = calculateUnifiedTax(tc4);
console.log('  Net Business Income:', formatMoney(r4.netBusinessIncome));
console.log('  EITC:', formatMoney(r4.eitc));
console.log('  CTC:', formatMoney(r4.childTaxCredit));
console.log('  Federal Tax:', formatMoney(r4.federalTax));
console.log('  Total Tax:', formatMoney(r4.totalTax));
console.log('  Refund/Owed:', r4.finalBillOrRefund > 0 ? 'Owed ' + formatMoney(r4.finalBillOrRefund) : 'Refund ' + formatMoney(r4.finalBillOrRefund));

assert('EITC > $3,000', r4.eitc, 4213, 200); // Should get max credit for 1 child
// Note: Person owes small CA state tax even with EITC (EITC only offsets federal)
assert('Federal tax = $0 (EITC covers it)', r4.federalTax, 0, 1);

// ═══════════════════════════════════════════════════════════════════════
// TEST CASE 5: LTCG Preferential Rates
// ═══════════════════════════════════════════════════════════════════════
console.log('\n════ Test Case 5: LTCG Preferential Rates ($50k W-2 + $20k LTCG) ════');
const tc5 = defaultState();
tc5.filingStatus = 'single';
tc5.stateOfResidence = 'CA';
tc5.w2Incomes = [{ employer: 'Corp', wages: 50000, withheld: 8000 }];
tc5.capitalGainsLongTerm = 20000;

const r5 = calculateUnifiedTax(tc5);
console.log('  LTCG Tax:', formatMoney(r5.ltcgTax));
console.log('  Federal Tax:', formatMoney(r5.federalTax));
console.log('  Effective Rate:', (r5.effectiveTotalRate * 100).toFixed(1) + '%');

// $20k LTCG stacks on $35k ordinary: $13,350 at 0%, $6,650 at 15% = $997.50
assert('LTCG stacked correctly', r5.ltcgTax, 997.50, 10);
assert('LTCG < ordinary 22% rate', r5.ltcgTax < 20000 * 0.22 ? 1 : 0, 1, 0);

// ═══════════════════════════════════════════════════════════════════════
// TEST CASE 6: NY State Tax — Single $100k W-2
// ═══════════════════════════════════════════════════════════════════════
console.log('\n════ Test Case 6: NY State Tax (Single $100k W-2) ════');
const tc6 = defaultState();
tc6.filingStatus = 'single';
tc6.stateOfResidence = 'NY';
tc6.w2Incomes = [{ employer: 'Corp', wages: 100000, withheld: 15000 }];

const r6 = calculateUnifiedTax(tc6);
console.log('  AGI:', formatMoney(r6.agi));
console.log('  State Tax (NY):', formatMoney(r6.estimatedStateTax));
console.log('  Federal Tax:', formatMoney(r6.federalTax));

// NY: $100k AGI - $8k std deduction = $92k taxable → progressive brackets = $4,951.75
assert('NY State Tax (progressive)', r6.estimatedStateTax, 4952, 50);

// ═══════════════════════════════════════════════════════════════════════
// TEST CASE 7: MA State Tax with Short-Term Cap Gains
// ═══════════════════════════════════════════════════════════════════════
console.log('\n════ Test Case 7: MA State Tax ($80k W-2 + $10k STCG) ════');
const tc7 = defaultState();
tc7.filingStatus = 'single';
tc7.stateOfResidence = 'MA';
tc7.w2Incomes = [{ employer: 'Corp', wages: 80000, withheld: 12000 }];
tc7.capitalGainsShortTerm = 10000;

const r7 = calculateUnifiedTax(tc7);
console.log('  AGI:', formatMoney(r7.agi));
console.log('  State Tax (MA):', formatMoney(r7.estimatedStateTax));

// MA: flat 5% on all income after personal exemption ($4,400)
// AGI = $90,000. Taxable = $90,000 - $4,400 = $85,600. Tax = $85,600 * 5% = $4,280
assert('MA State Tax ~$4,200-4,400', r7.estimatedStateTax, 4280, 200);

// ═══════════════════════════════════════════════════════════════════════
// TEST CASE 8: NIIT for High Earner
// ═══════════════════════════════════════════════════════════════════════
console.log('\n════ Test Case 8: NIIT ($200k W-2 + $50k investment) ════');
const tc8 = defaultState();
tc8.filingStatus = 'single';
tc8.stateOfResidence = 'CA';
tc8.w2Incomes = [{ employer: 'Corp', wages: 200000, withheld: 40000 }];
tc8.interestIncome = 20000;
tc8.dividendIncome = 15000;
tc8.capitalGainsLongTerm = 15000;

const r8 = calculateUnifiedTax(tc8);
console.log('  AGI:', formatMoney(r8.agi));
console.log('  NIIT:', formatMoney(r8.niit));
console.log('  Investment Income:', formatMoney(20000 + 15000 + 15000));

// AGI = $250k, threshold = $200k. Excess = $50k. Investment = $50k. NIIT = min(50k, 50k) * 3.8% = $1,900
assert('NIIT ~$1,900', r8.niit, 1900, 100);

// ═══════════════════════════════════════════════════════════════════════
// TEST CASE 9: Mortgage Interest Cap ($750K debt limit)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n════ Test Case 9: Mortgage Interest Cap ($1.5M balance, $90K interest) ════');
const tc9 = defaultState();
tc9.filingStatus = 'single';
tc9.stateOfResidence = 'CA';
tc9.w2Incomes = [{ employer: 'Corp', wages: 300000, withheld: 60000 }];
tc9.mortgageInterest = 90000;
tc9.mortgageBalance = 1_500_000; // Exceeds $750K cap
tc9.propertyTaxes = 15000;

const r9 = calculateUnifiedTax(tc9);
console.log('  Mortgage Interest (raw):', formatMoney(90000));
console.log('  Mortgage Interest (capped):', formatMoney(r9.mortgageInterestCapped));
console.log('  SALT Deduction:', formatMoney(r9.saltDeduction));
console.log('  Itemized Deduction:', formatMoney(r9.itemizedDeductionAmount));
console.log('  Deduction Method:', r9.deductionMethod);

// $90K interest × ($750K / $1.5M) = $45K capped
assert('Mortgage capped at 50%', r9.mortgageInterestCapped, 45000, 1);
// SALT should include property taxes + estimated state tax, capped at $10K
assert('SALT = $10,000 cap', r9.saltDeduction, 10000, 1);
// Itemized = $45K mortgage + $10K SALT = $55K (should beat standard $15K)
assert('Itemized chosen', r9.deductionMethod === 'Itemized' ? 1 : 0, 1, 0);

// Also verify: without mortgageBalance, no cap is applied
const tc9b = { ...tc9, mortgageBalance: undefined };
const r9b = calculateUnifiedTax(tc9b as TaxReturnState);
assert('No cap without balance', r9b.mortgageInterestCapped, 90000, 0);

// ═══════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
console.log(`${'═'.repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
