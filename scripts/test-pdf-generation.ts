/**
 * Test script for the PDF auto-fill system.
 * Tests form selection logic, field mapping, and PDF generation.
 *
 * Run: npx tsx scripts/test-pdf-generation.ts
 */

import { TaxReturnState, calculateUnifiedTax } from '../lib/unifiedTaxEngine';
import { determineRequiredForms } from '../lib/taxForms/formPackageGenerator';
import { mapForm1040 } from '../lib/taxForms/fieldMaps/form1040';
import { mapScheduleC } from '../lib/taxForms/fieldMaps/scheduleC';
import { mapScheduleSE } from '../lib/taxForms/fieldMaps/scheduleSE';
import { mapSchedule1 } from '../lib/taxForms/fieldMaps/schedule1';
import { mapSchedule2 } from '../lib/taxForms/fieldMaps/schedule2';
import { renderFormPages } from '../lib/taxForms/replicaRenderer';
import { generateMailingInstructions } from '../lib/taxForms/mailingInstructions';
import type { TaxFormInput, TaxProfileData, FormType } from '../lib/taxForms/types';
import { writeFileSync } from 'fs';
import { PDFDocument } from 'pdf-lib';

// ─── Test Profile ────────────────────────────────────────────────────────────

const testProfile: TaxProfileData = {
  firstName: 'Alex',
  lastName: 'Rivera',
  ssn: '123456789',
  address: '456 Oak Street',
  city: 'San Francisco',
  state: 'CA',
  zip: '94102',
  dateOfBirth: '1990-05-15',
  spouseName: '',
  spouseSSN: '',
  phone: '415-555-1234',
  email: 'alex@example.com',
};

// ─── Test Scenarios ──────────────────────────────────────────────────────────

interface TestScenario {
  name: string;
  data: TaxReturnState;
  expectedForms: FormType[];
}

const scenarios: TestScenario[] = [
  {
    name: 'Single gig worker with 1099 income',
    data: {
      filingStatus: 'single',
      w2Incomes: [],
      income1099: [
        { source: 'Uber', grossAmount: 45000, tipPortion: 5000 },
        { source: 'DoorDash', grossAmount: 12000, tipPortion: 2000 },
      ],
      capitalGains: 0,
      capitalGainsShortTerm: 0,
      capitalGainsLongTerm: 0,
      spouseIncome: 0,
      spouseWithholding: 0,
      dependents: 0,
      iraContribution: 0,
      estimatedTaxesPaid: 8000,
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
      homeOffice: { sqFtUsed: 150, method: 'simplified' },
      lastYearTaxLiability: 0,
      businessExpenses: 15000,
      parkingAndTolls: 500,
      sepIraContribution: 0,
      hsaContribution: 0,
      hsaFamilyPlan: false,
      childCareExpenses: 0,
    },
    expectedForms: ['f1040', 'schedule1', 'schedule2', 'schedule3', 'scheduleC', 'scheduleSE'],
  },
  {
    name: 'W-2 + 1099 with dependents and credits',
    data: {
      filingStatus: 'married_joint',
      w2Incomes: [
        { employer: 'Tech Corp', wages: 85000, withheld: 14000 },
      ],
      income1099: [
        { source: 'Lyft', grossAmount: 20000, tipPortion: 3000 },
      ],
      capitalGains: 0,
      capitalGainsShortTerm: 0,
      capitalGainsLongTerm: 0,
      spouseIncome: 0,
      spouseWithholding: 0,
      dependents: 2,
      dependentDetails: [
        { dateOfBirth: '2018-03-10', relationship: 'son' },
        { dateOfBirth: '2020-07-22', relationship: 'daughter' },
      ],
      iraContribution: 6500,
      estimatedTaxesPaid: 2000,
      studentLoanInterest: 1500,
      healthInsurancePremiums: 4800,
      stateOfResidence: 'CA',
      mortgageInterest: 0,
      propertyTaxes: 0,
      charitableDonations: 0,
      deductionType: 'Standard',
      unemploymentIncome: 0,
      interestIncome: 200,
      dividendIncome: 0,
      socialSecurityIncome: 0,
      rentalIncome: 0,
      alimonyReceived: 0,
      gamblingWinnings: 0,
      educationExpenses: 0,
      homeOffice: null,
      lastYearTaxLiability: 0,
      businessExpenses: 5000,
      parkingAndTolls: 200,
      sepIraContribution: 0,
      hsaContribution: 0,
      hsaFamilyPlan: false,
      childCareExpenses: 6000,
      coveredByWorkplacePlan: true,
    },
    expectedForms: ['f1040', 'schedule1', 'schedule2', 'schedule3', 'scheduleC', 'scheduleSE'],
  },
];

// ─── Run Tests ───────────────────────────────────────────────────────────────

async function runTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('  GigTax PDF Auto-Fill System — Test Suite');
  console.log('═══════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  for (const scenario of scenarios) {
    console.log(`\n─── ${scenario.name} ───\n`);

    // 1. Calculate tax
    const result = calculateUnifiedTax(scenario.data);
    console.log(`  AGI: $${Math.round(result.agi).toLocaleString()}`);
    console.log(`  Taxable Income: $${Math.round(result.taxableIncome).toLocaleString()}`);
    console.log(`  Federal Tax: $${Math.round(result.federalTax).toLocaleString()}`);
    console.log(`  SE Tax: $${Math.round(result.seTax).toLocaleString()}`);
    console.log(`  Total Tax: $${Math.round(result.totalTax).toLocaleString()}`);
    console.log(`  Refund/Owed: $${Math.round(result.finalBillOrRefund).toLocaleString()}`);

    // 2. Determine forms
    const input: TaxFormInput = { taxReturn: scenario.data, result, profile: testProfile };
    const forms = determineRequiredForms(input);
    console.log(`  Forms needed: ${forms.join(', ')}`);

    // 3. Verify form selection
    const formsMatch = scenario.expectedForms.length === forms.length &&
      scenario.expectedForms.every(f => forms.includes(f));
    if (formsMatch) {
      console.log('  ✅ Form selection correct');
      passed++;
    } else {
      console.log(`  ❌ Form selection mismatch!`);
      console.log(`     Expected: ${scenario.expectedForms.join(', ')}`);
      console.log(`     Got:      ${forms.join(', ')}`);
      failed++;
    }

    // 4. Generate Form 1040 and verify it renders
    try {
      const f1040Def = mapForm1040(input);
      console.log(`  Form 1040: ${f1040Def.fields.length} dynamic fields, ${f1040Def.staticElements.length} static elements`);

      const pdfBytes = await renderFormPages(f1040Def);
      const doc = await PDFDocument.load(pdfBytes);
      console.log(`  ✅ Form 1040 rendered: ${doc.getPageCount()} pages, ${(pdfBytes.length / 1024).toFixed(1)} KB`);
      passed++;

      // Save to disk for visual inspection
      const filename = `test-1040-${scenario.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      writeFileSync(filename, pdfBytes);
      console.log(`  📄 Saved: ${filename}`);
    } catch (err) {
      console.log(`  ❌ Form 1040 render failed: ${err}`);
      failed++;
    }

    // 5. Generate Schedule C if needed
    if (forms.includes('scheduleC')) {
      try {
        const schedCDef = mapScheduleC(input);
        const pdfBytes = await renderFormPages(schedCDef);
        console.log(`  ✅ Schedule C rendered: ${(pdfBytes.length / 1024).toFixed(1)} KB`);
        passed++;
      } catch (err) {
        console.log(`  ❌ Schedule C render failed: ${err}`);
        failed++;
      }
    }

    // 6. Generate Schedule SE if needed
    if (forms.includes('scheduleSE')) {
      try {
        const schedSEDef = mapScheduleSE(input);
        const pdfBytes = await renderFormPages(schedSEDef);
        console.log(`  ✅ Schedule SE rendered: ${(pdfBytes.length / 1024).toFixed(1)} KB`);
        passed++;
      } catch (err) {
        console.log(`  ❌ Schedule SE render failed: ${err}`);
        failed++;
      }
    }

    // 7. Generate combined package
    try {
      const combinedDoc = await PDFDocument.create();
      for (const formType of forms) {
        const mappers: Record<string, (input: TaxFormInput) => any> = {
          f1040: mapForm1040,
          scheduleC: mapScheduleC,
          scheduleSE: mapScheduleSE,
          schedule1: mapSchedule1,
          schedule2: mapSchedule2,
        };
        const mapper = mappers[formType];
        if (!mapper) continue;
        const def = mapper(input);
        const bytes = await renderFormPages(def);
        const src = await PDFDocument.load(bytes);
        const pages = await combinedDoc.copyPages(src, src.getPageIndices());
        for (const page of pages) combinedDoc.addPage(page);
      }
      const combinedBytes = await combinedDoc.save();
      console.log(`  ✅ Combined PDF: ${combinedDoc.getPageCount()} pages, ${(combinedBytes.length / 1024).toFixed(1)} KB`);

      const filename = `test-package-${scenario.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      writeFileSync(filename, combinedBytes);
      console.log(`  📄 Saved: ${filename}`);
      passed++;
    } catch (err) {
      console.log(`  ❌ Combined PDF failed: ${err}`);
      failed++;
    }

    // 8. Mailing instructions
    const instructions = generateMailingInstructions(input, forms);
    const hasAddress = instructions.includes('Internal Revenue Service');
    if (hasAddress) {
      console.log('  ✅ Mailing instructions generated with IRS address');
      passed++;
    } else {
      console.log('  ❌ Mailing instructions missing IRS address');
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
