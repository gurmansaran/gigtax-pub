/**
 * Form 1040 — U.S. Individual Income Tax Return
 * Maps TaxReturnState + FinalTaxResult + TaxProfileData to a FormDefinition.
 *
 * Two pages:
 *   Page 0: Header, Filing Status, Name/Address/SSN, Income (Lines 1–11)
 *   Page 1: Deductions (12–15), Tax (16–24), Payments (25–33), Refund/Owed (34–37), Signature
 */

import type { TaxFormInput, FormDefinition, FormStaticElement, FormField } from '../types';
import { formNum, formatSSN } from '../types';
import {
  buildFormHeader,
  buildSectionHeader,
  buildFormLine,
  buildAmountField,
  buildTextField,
  buildCheckbox,
  PAGE_HEIGHT,
} from '../replicaRenderer';

// ─── Layout Constants ────────────────────────────────────────────────────────

const LEFT = 36;
const AMT_X = 470;
const AMT_W = 106;

// ─── Main Mapper ─────────────────────────────────────────────────────────────

export function mapForm1040(input: TaxFormInput): FormDefinition {
  const { taxReturn: d, result: r, profile: p } = input;

  // Computed values not directly in FinalTaxResult
  const w2Wages = d.w2Incomes.reduce((s, w) => s + w.wages, 0);
  const w2Withholding = d.w2Incomes.reduce((s, w) => s + w.withheld, 0);
  const withholding1099 = d.income1099.reduce((s, i) => s + (i.withheld ?? 0), 0);
  const totalCapitalGains = (d.capitalGainsShortTerm ?? 0) + (d.capitalGainsLongTerm ?? 0);

  // Schedule 1 amounts
  const schedule1Income = r.netBusinessIncome + (d.unemploymentIncome ?? 0) +
    (d.rentalIncome ?? 0) + (d.alimonyReceived ?? 0) + (d.gamblingWinnings ?? 0);

  const healthInsDeduction = Math.min(d.healthInsurancePremiums ?? 0, Math.max(0, r.netBusinessIncome));
  const schedule1Adjustments = r.seTaxDeduction + r.iraDeduction + r.hsaDeduction +
    r.sepIraDeduction + r.homeOfficeDeduction +
    Math.min(d.studentLoanInterest ?? 0, 2500) + healthInsDeduction;

  // Lines 16-24 intermediate calculations
  const line16 = r.tentativeTax;
  const line17 = r.seTax + r.niit; // Schedule 2
  const line18 = line16 + line17;
  const line19 = r.childTaxCredit;
  const line20 = r.educationCredit + r.childCareCredit + r.saversCredit; // Schedule 3 credits
  const line21 = line19 + line20;
  const line22 = Math.max(0, line18 - line21);
  const line24 = r.federalTax + r.seTax + r.niit;

  // Payments
  const totalWithheld = w2Withholding + withholding1099 + (d.spouseWithholding ?? 0);
  const line33 = totalWithheld + (d.estimatedTaxesPaid ?? 0) + r.eitc;
  const isRefund = r.finalBillOrRefund < 0;
  const refundAmount = isRefund ? Math.abs(r.finalBillOrRefund) : 0;
  const owedAmount = r.finalBillOrRefund > 0 ? r.finalBillOrRefund : 0;

  // Filing status label
  const filingStatusLabel = ({
    single: 'Single',
    married_joint: 'Married filing jointly',
    married_separate: 'Married filing separately',
    head_household: 'Head of household',
  })[d.filingStatus] ?? 'Single';

  // ─── Build Static Elements ──────────────────────────────────────────────

  const statics: FormStaticElement[] = [];

  // PAGE 0: Header
  statics.push(...buildFormHeader(
    'Form 1040',
    'U.S. Individual Income Tax Return',
  ));

  // Name/Address/SSN section
  let y = PAGE_HEIGHT - 90;
  statics.push(...buildSectionHeader(0, y, 'Taxpayer Information'));
  y -= 18;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Your first name and middle initial', fontSize: 7 },
    { type: 'text', page: 0, x: 250, y, text: 'Last name', fontSize: 7 },
    { type: 'text', page: 0, x: 440, y, text: 'Your social security number', fontSize: 7 },
  );
  y -= 14;
  statics.push(
    { type: 'line', page: 0, x: LEFT, y: y - 2, x2: 576, y2: y - 2, lineWidth: 0.5 },
  );
  y -= 16;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Home address (number and street)', fontSize: 7 },
    { type: 'text', page: 0, x: 440, y, text: 'Apt. no.', fontSize: 7 },
  );
  y -= 14;
  statics.push(
    { type: 'line', page: 0, x: LEFT, y: y - 2, x2: 576, y2: y - 2, lineWidth: 0.5 },
  );
  y -= 16;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'City, town, or post office. If you have a foreign address, see instructions.', fontSize: 7 },
    { type: 'text', page: 0, x: 380, y, text: 'State', fontSize: 7 },
    { type: 'text', page: 0, x: 440, y, text: 'ZIP code', fontSize: 7 },
  );
  y -= 14;
  statics.push(
    { type: 'line', page: 0, x: LEFT, y: y - 2, x2: 576, y2: y - 2, lineWidth: 0.5 },
  );

  // Filing Status
  y -= 18;
  statics.push(...buildSectionHeader(0, y, 'Filing Status'));
  y -= 16;
  statics.push(
    { type: 'rect', page: 0, x: 42, y: y - 2, width: 10, height: 10 },
    { type: 'text', page: 0, x: 56, y, text: 'Single', fontSize: 8 },
    { type: 'rect', page: 0, x: 112, y: y - 2, width: 10, height: 10 },
    { type: 'text', page: 0, x: 126, y, text: 'Married filing jointly', fontSize: 8 },
    { type: 'rect', page: 0, x: 252, y: y - 2, width: 10, height: 10 },
    { type: 'text', page: 0, x: 266, y, text: 'Married filing separately', fontSize: 8 },
    { type: 'rect', page: 0, x: 412, y: y - 2, width: 10, height: 10 },
    { type: 'text', page: 0, x: 426, y, text: 'Head of household', fontSize: 8 },
  );
  const filingStatusY = y;

  // Income Section
  y -= 22;
  statics.push(...buildSectionHeader(0, y, 'Income'));
  y -= 18;
  statics.push(...buildFormLine(0, y, '1a', 'Wages, salaries, tips (W-2 box 1)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line1aY = y;
  y -= 18;
  statics.push(...buildFormLine(0, y, '2b', 'Taxable interest', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line2bY = y;
  y -= 18;
  statics.push(...buildFormLine(0, y, '3b', 'Ordinary dividends', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line3bY = y;
  y -= 18;
  statics.push(...buildFormLine(0, y, '6b', 'Social security benefits (taxable amount)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line6bY = y;
  y -= 18;
  statics.push(...buildFormLine(0, y, '7', 'Capital gain or (loss) (Schedule D)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line7Y = y;
  y -= 18;
  statics.push(...buildFormLine(0, y, '8', 'Other income from Schedule 1, line 10', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line8Y = y;
  y -= 18;
  statics.push(...buildFormLine(0, y, '9', 'Total income (add lines 1z through 8)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line9Y = y;
  y -= 18;
  statics.push(...buildFormLine(0, y, '10', 'Adjustments to income from Schedule 1, line 26', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line10Y = y;
  y -= 18;
  statics.push(...buildFormLine(0, y, '11', 'Adjusted gross income (line 9 minus line 10)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line11Y = y;

  // PAGE 1 static elements
  let y2 = PAGE_HEIGHT - 40;

  // Header for page 2
  statics.push(
    { type: 'text', page: 1, x: LEFT, y: y2, text: 'Form 1040 (2025)', fontSize: 8, bold: true },
    { type: 'text', page: 1, x: 500, y: y2, text: 'Page 2', fontSize: 8 },
    { type: 'line', page: 1, x: LEFT, y: y2 - 6, x2: 576, y2: y2 - 6, lineWidth: 1 },
  );

  y2 -= 20;
  statics.push(...buildSectionHeader(1, y2, 'Tax and Credits'));
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '12', `Standard deduction or itemized deductions (${r.deductionMethod})`, { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line12Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '13', 'Qualified business income deduction (Section 199A)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line13Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '14', 'Add lines 12 and 13', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line14Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '15', 'Taxable income (line 11 minus line 14, if zero or less, enter -0-)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line15Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '16', 'Tax (from Tax Table or Tax Computation Worksheet)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line16Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '17', 'Amount from Schedule 2, Part I, line 4', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line17Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '18', 'Add lines 16 and 17', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line18Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '19', 'Child tax credit from Schedule 8812', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line19Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '20', 'Amount from Schedule 3, line 8', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line20Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '21', 'Add lines 19 and 20', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line21Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '22', 'Subtract line 21 from line 18', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line22Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '24', 'Total tax', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line24Y = y2;

  // Payments section
  y2 -= 22;
  statics.push(...buildSectionHeader(1, y2, 'Payments'));
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '25a', 'Federal income tax withheld from W-2s', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line25aY = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '25b', 'Federal income tax withheld from 1099s', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line25bY = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '25d', 'Total federal tax withheld', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line25dY = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '26', 'Estimated tax payments', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line26Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '27', 'Earned income credit (EIC)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line27Y = y2;
  y2 -= 18;
  statics.push(...buildFormLine(1, y2, '33', 'Total payments', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  const line33Y = y2;

  // Refund / Amount Owed
  y2 -= 22;
  statics.push(...buildSectionHeader(1, y2, isRefund ? 'Refund' : 'Amount You Owe'));
  y2 -= 18;
  if (isRefund) {
    statics.push(...buildFormLine(1, y2, '34', 'Amount overpaid (line 33 minus line 24)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  } else {
    statics.push(...buildFormLine(1, y2, '37', 'Amount you owe (line 24 minus line 33)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  }
  const line34_37Y = y2;

  // Signature line
  y2 -= 30;
  statics.push(
    { type: 'line', page: 1, x: LEFT, y: y2, x2: 576, y2, lineWidth: 1 },
    { type: 'text', page: 1, x: 40, y: y2 - 12, text: 'Under penalties of perjury, I declare that I have examined this return and accompanying schedules and statements,', fontSize: 7 },
    { type: 'text', page: 1, x: 40, y: y2 - 22, text: 'and to the best of my knowledge and belief, they are true, correct, and complete.', fontSize: 7 },
    { type: 'text', page: 1, x: 40, y: y2 - 40, text: 'Your signature', fontSize: 7 },
    { type: 'line', page: 1, x: 40, y: y2 - 42, x2: 250, y2: y2 - 42, lineWidth: 0.5 },
    { type: 'text', page: 1, x: 270, y: y2 - 40, text: 'Date', fontSize: 7 },
    { type: 'line', page: 1, x: 270, y: y2 - 42, x2: 370, y2: y2 - 42, lineWidth: 0.5 },
    { type: 'text', page: 1, x: 390, y: y2 - 40, text: 'Occupation', fontSize: 7 },
    { type: 'line', page: 1, x: 390, y: y2 - 42, x2: 576, y2: y2 - 42, lineWidth: 0.5 },
  );

  // Software note
  statics.push(
    { type: 'text', page: 1, x: 40, y: 40, text: 'Prepared using GigTax software — Self-prepared', fontSize: 7 },
  );

  // ─── Build Dynamic Fields ───────────────────────────────────────────────

  const fields: FormField[] = [];

  // Page 0: Personal info
  const nameY = PAGE_HEIGHT - 118;
  fields.push(buildTextField(0, 42, nameY, `${p.firstName} ${p.lastName}`, { fontSize: 10, maxWidth: 200 }));
  fields.push(buildTextField(0, 442, nameY, formatSSN(p.ssn), { fontSize: 10 }));

  const addrY = PAGE_HEIGHT - 148;
  fields.push(buildTextField(0, 42, addrY, p.address, { fontSize: 9, maxWidth: 380 }));

  const cityY = PAGE_HEIGHT - 178;
  fields.push(buildTextField(0, 42, cityY, p.city, { fontSize: 9, maxWidth: 330 }));
  fields.push(buildTextField(0, 382, cityY, p.state, { fontSize: 9 }));
  fields.push(buildTextField(0, 442, cityY, p.zip, { fontSize: 9 }));

  // Filing status checkboxes
  fields.push(buildCheckbox(0, 42, filingStatusY - 2, d.filingStatus === 'single'));
  fields.push(buildCheckbox(0, 112, filingStatusY - 2, d.filingStatus === 'married_joint'));
  fields.push(buildCheckbox(0, 252, filingStatusY - 2, d.filingStatus === 'married_separate'));
  fields.push(buildCheckbox(0, 412, filingStatusY - 2, d.filingStatus === 'head_household'));

  // Income lines
  fields.push(buildAmountField(0, line1aY, formNum(w2Wages), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(0, line2bY, formNum(d.interestIncome), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(0, line3bY, formNum(d.dividendIncome), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(0, line6bY, formNum(r.taxableSocialSecurity), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(0, line7Y, formNum(totalCapitalGains), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(0, line8Y, formNum(schedule1Income), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(0, line9Y, formNum(r.grossIncome), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(0, line10Y, formNum(schedule1Adjustments), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(0, line11Y, formNum(r.agi), { x: AMT_X + 2, width: AMT_W - 4 }));

  // Page 1: Tax and Credits
  fields.push(buildAmountField(1, line12Y, formNum(r.deductionAmount), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line13Y, formNum(r.qbiDeduction), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line14Y, formNum(r.deductionAmount + r.qbiDeduction), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line15Y, formNum(r.taxableIncome), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line16Y, formNum(line16), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line17Y, formNum(line17), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line18Y, formNum(line18), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line19Y, formNum(line19), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line20Y, formNum(line20), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line21Y, formNum(line21), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line22Y, formNum(line22), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line24Y, formNum(line24), { x: AMT_X + 2, width: AMT_W - 4 }));

  // Page 1: Payments
  fields.push(buildAmountField(1, line25aY, formNum(w2Withholding), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line25bY, formNum(withholding1099), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line25dY, formNum(totalWithheld), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line26Y, formNum(d.estimatedTaxesPaid), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line27Y, formNum(r.eitc), { x: AMT_X + 2, width: AMT_W - 4 }));
  fields.push(buildAmountField(1, line33Y, formNum(line33), { x: AMT_X + 2, width: AMT_W - 4 }));

  // Refund or Amount Owed
  if (isRefund) {
    fields.push(buildAmountField(1, line34_37Y, formNum(refundAmount), { x: AMT_X + 2, width: AMT_W - 4 }));
  } else {
    fields.push(buildAmountField(1, line34_37Y, formNum(owedAmount), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  return {
    formType: 'f1040',
    title: 'Form 1040',
    subtitle: 'U.S. Individual Income Tax Return',
    pageCount: 2,
    staticElements: statics,
    fields,
  };
}
