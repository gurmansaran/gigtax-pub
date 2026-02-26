/**
 * Form Package Generator — Orchestrates tax form PDF generation.
 *
 * 1. Determines which forms are needed based on the user's tax situation
 * 2. Generates Form 1040 using the real IRS Accessible PDF (AcroForm fill)
 * 3. Generates schedules using field mappers + replica renderer
 * 4. Combines all forms into a single PDF package
 * 5. Returns the combined PDF bytes + mailing instructions
 */

import { PDFDocument } from 'pdf-lib';
import type {
  TaxFormInput,
  FormType,
  FormDefinition,
  FormGenerationResult,
  TaxFormPackage,
  TaxProfileData,
} from './types';
import { renderFormPages } from './replicaRenderer';
import { fillIRS1040 } from './irsFormFiller';
import {
  mapForm1040,
  mapScheduleC,
  mapScheduleSE,
  mapSchedule1,
  mapSchedule2,
  mapSchedule3,
  mapScheduleA,
  mapForm1040V,
} from './fieldMaps';
import { generateMailingInstructions } from './mailingInstructions';
import type { TaxReturnState, FinalTaxResult } from '../unifiedTaxEngine';

// ─── Form Mapper Registry ────────────────────────────────────────────────────

const FORM_MAPPERS: Record<FormType, (input: TaxFormInput) => FormDefinition> = {
  f1040: mapForm1040,
  scheduleC: mapScheduleC,
  scheduleSE: mapScheduleSE,
  schedule1: mapSchedule1,
  schedule2: mapSchedule2,
  schedule3: mapSchedule3,
  scheduleA: mapScheduleA,
  f1040V: mapForm1040V,
};

// IRS-prescribed form ordering
const FORM_ORDER: FormType[] = [
  'f1040',
  'schedule1',
  'schedule2',
  'schedule3',
  'scheduleA',
  'scheduleC',
  'scheduleSE',
  'f1040V',
];

// ─── Form Selection Logic ────────────────────────────────────────────────────

/**
 * Determine which IRS forms are required based on the user's tax situation.
 */
export function determineRequiredForms(input: TaxFormInput): FormType[] {
  const { taxReturn: d, result: r } = input;
  const forms = new Set<FormType>();

  // Form 1040 is always required
  forms.add('f1040');

  const has1099 = d.income1099.length > 0;
  const hasSETax = r.seTax > 0;
  const hasBusinessIncome = r.netBusinessIncome > 0;

  // Schedule C: any 1099 income
  if (has1099) {
    forms.add('scheduleC');
  }

  // Schedule SE: self-employment tax applies
  if (hasSETax) {
    forms.add('scheduleSE');
  }

  // Schedule 1: additional income or above-the-line adjustments
  const hasSchedule1Income = hasBusinessIncome ||
    (d.unemploymentIncome ?? 0) > 0 ||
    (d.rentalIncome ?? 0) > 0 ||
    (d.alimonyReceived ?? 0) > 0 ||
    (d.gamblingWinnings ?? 0) > 0;

  const hasSchedule1Adjustments = r.seTaxDeduction > 0 ||
    r.iraDeduction > 0 ||
    r.hsaDeduction > 0 ||
    r.sepIraDeduction > 0 ||
    r.homeOfficeDeduction > 0 ||
    (d.studentLoanInterest ?? 0) > 0 ||
    (d.healthInsurancePremiums ?? 0) > 0;

  if (hasSchedule1Income || hasSchedule1Adjustments) {
    forms.add('schedule1');
  }

  // Schedule 2: SE tax or NIIT
  if (hasSETax || r.niit > 0) {
    forms.add('schedule2');
  }

  // Schedule 3: credits or estimated payments
  if (r.educationCredit > 0 || r.childCareCredit > 0 ||
      r.saversCredit > 0 || (d.estimatedTaxesPaid ?? 0) > 0) {
    forms.add('schedule3');
  }

  // Schedule A: itemized deductions
  if (r.deductionMethod === 'Itemized') {
    forms.add('scheduleA');
  }

  // Form 1040-V: payment voucher (owes tax)
  if (r.finalBillOrRefund > 0) {
    forms.add('f1040V');
  }

  // Return in IRS-prescribed order
  return FORM_ORDER.filter(f => forms.has(f));
}

// ─── Package Generation ──────────────────────────────────────────────────────

/**
 * Generate a complete tax return PDF package.
 *
 * @param taxReturn - User's tax return data from the wizard
 * @param result - Calculated tax result from unifiedTaxEngine
 * @param profile - Normalized user profile data (name, SSN, address)
 * @returns TaxFormPackage with combined PDF bytes and mailing instructions
 */
export async function generateTaxFormPackage(
  taxReturn: TaxReturnState,
  result: FinalTaxResult,
  profile: TaxProfileData,
): Promise<TaxFormPackage> {
  const input: TaxFormInput = { taxReturn, result, profile };

  // 1. Determine which forms are needed
  const formList = determineRequiredForms(input);
  console.log(`[TaxForms] Generating ${formList.length} forms:`, formList);

  // 2. Generate each form
  const results: FormGenerationResult[] = [];

  for (const formType of formList) {
    let pdfBytes: Uint8Array;

    if (formType === 'f1040') {
      // Use real IRS Accessible Form 1040 PDF with AcroForm filling
      try {
        pdfBytes = await fillIRS1040(input);
        console.log(`[TaxForms] Filled official IRS Form 1040`);
      } catch (err) {
        // Fallback to replica renderer if IRS PDF filling fails
        console.warn(`[TaxForms] IRS 1040 fill failed, using replica:`, err);
        const formDef = mapForm1040(input);
        pdfBytes = await renderFormPages(formDef);
      }
    } else {
      // All schedules use replica renderer (IRS doesn't publish AcroForm versions)
      const mapper = FORM_MAPPERS[formType];
      if (!mapper) {
        console.warn(`[TaxForms] No mapper for ${formType}, skipping`);
        continue;
      }
      const formDef = mapper(input);
      pdfBytes = await renderFormPages(formDef);
    }

    const doc = await PDFDocument.load(pdfBytes);
    results.push({
      formType,
      pdfBytes,
      pageCount: doc.getPageCount(),
    });

    console.log(`[TaxForms] Generated ${formType} (${doc.getPageCount()} pages)`);
  }

  // 3. Combine all forms into one PDF
  const combinedDoc = await PDFDocument.create();

  for (const formResult of results) {
    const sourceDoc = await PDFDocument.load(formResult.pdfBytes);
    const pages = await combinedDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
    for (const page of pages) {
      combinedDoc.addPage(page);
    }
  }

  const combinedPdfBytes = await combinedDoc.save();
  const totalPages = results.reduce((sum, r) => sum + r.pageCount, 0);
  console.log(`[TaxForms] Combined PDF: ${totalPages} pages, ${(combinedPdfBytes.length / 1024).toFixed(1)} KB`);

  // 4. Generate mailing instructions
  const mailingInstructions = generateMailingInstructions(input, formList);

  return {
    forms: results,
    combinedPdfBytes,
    formList,
    generatedAt: new Date().toISOString(),
    mailingInstructions,
  };
}
