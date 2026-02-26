/**
 * Schedule 1 — Additional Income and Adjustments to Income
 * Part I: Additional Income (business income, capital gains, unemployment, etc.)
 * Part II: Adjustments (SE tax deduction, IRA, HSA, student loan, health ins, etc.)
 */

import type { TaxFormInput, FormDefinition, FormStaticElement, FormField } from '../types';
import { formNum, formatSSN } from '../types';
import {
  buildFormHeader,
  buildSectionHeader,
  buildFormLine,
  buildAmountField,
  buildTextField,
  PAGE_HEIGHT,
} from '../replicaRenderer';

const AMT_X = 470;
const AMT_W = 106;

export function mapSchedule1(input: TaxFormInput): FormDefinition {
  const { taxReturn: d, result: r, profile: p } = input;

  // Part I values
  const businessIncome = r.netBusinessIncome;
  const capitalGains = (d.capitalGainsShortTerm ?? 0) + (d.capitalGainsLongTerm ?? 0);
  const unemploymentIncome = d.unemploymentIncome ?? 0;
  const rentalIncome = d.rentalIncome ?? 0;
  const alimonyReceived = d.alimonyReceived ?? 0;
  const gamblingWinnings = d.gamblingWinnings ?? 0;
  const otherIncome = rentalIncome + alimonyReceived + gamblingWinnings;
  const totalAdditionalIncome = businessIncome + unemploymentIncome + otherIncome;

  // Part II values
  const seTaxDeduction = r.seTaxDeduction;
  const healthInsDeduction = Math.min(d.healthInsurancePremiums ?? 0, Math.max(0, r.netBusinessIncome));
  const iraDeduction = r.iraDeduction;
  const studentLoanInterest = Math.min(d.studentLoanInterest ?? 0, 2500);
  const hsaDeduction = r.hsaDeduction;
  const sepIraDeduction = r.sepIraDeduction;
  const homeOfficeDeduction = r.homeOfficeDeduction;
  const totalAdjustments = seTaxDeduction + healthInsDeduction + iraDeduction +
    studentLoanInterest + hsaDeduction + sepIraDeduction + homeOfficeDeduction;

  const statics: FormStaticElement[] = [];
  const fields: FormField[] = [];

  // ─── Header ─────────────────────────────────────────────────────────────
  statics.push(...buildFormHeader(
    'Schedule 1 (Form 1040)',
    'Additional Income and Adjustments to Income',
  ));

  let y = PAGE_HEIGHT - 90;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Name(s) shown on Form 1040', fontSize: 7 },
    { type: 'text', page: 0, x: 380, y, text: 'Your social security number', fontSize: 7 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 42, y - 12, `${p.firstName} ${p.lastName}`, { fontSize: 10, maxWidth: 320 }));
  fields.push(buildTextField(0, 382, y - 12, formatSSN(p.ssn), { fontSize: 10 }));

  // ─── Part I — Additional Income ─────────────────────────────────────────
  y -= 28;
  statics.push(...buildSectionHeader(0, y, 'Part I — Additional Income'));

  y -= 18;
  statics.push(...buildFormLine(0, y, '3', 'Business income or (loss) (Schedule C)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(businessIncome), { x: AMT_X + 2, width: AMT_W - 4 }));

  if (unemploymentIncome > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '7', 'Unemployment compensation', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(unemploymentIncome), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  if (otherIncome > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '8z', 'Other income (rental, alimony, gambling)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(otherIncome), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  y -= 18;
  statics.push(...buildFormLine(0, y, '10', 'Total additional income (to Form 1040, line 8)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(totalAdditionalIncome), { x: AMT_X + 2, width: AMT_W - 4 }));

  // ─── Part II — Adjustments to Income ────────────────────────────────────
  y -= 22;
  statics.push(...buildSectionHeader(0, y, 'Part II — Adjustments to Income'));

  if (hsaDeduction > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '13', 'HSA deduction', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(hsaDeduction), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  if (seTaxDeduction > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '15', 'Deductible part of self-employment tax (Schedule SE)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(seTaxDeduction), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  if (sepIraDeduction > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '16', 'SEP, SIMPLE, and qualified plans', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(sepIraDeduction), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  if (healthInsDeduction > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '17', 'Self-employed health insurance deduction', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(healthInsDeduction), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  if (iraDeduction > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '20', 'IRA deduction', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(iraDeduction), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  if (studentLoanInterest > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '21', 'Student loan interest deduction', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(studentLoanInterest), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  if (homeOfficeDeduction > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '24a', 'Home office deduction (simplified method)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(homeOfficeDeduction), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  y -= 18;
  statics.push(...buildFormLine(0, y, '26', 'Total adjustments to income (to Form 1040, line 10)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(totalAdjustments), { x: AMT_X + 2, width: AMT_W - 4 }));

  statics.push(
    { type: 'text', page: 0, x: 40, y: 40, text: 'Prepared using GigTax software', fontSize: 7 },
  );

  return {
    formType: 'schedule1',
    title: 'Schedule 1 (Form 1040)',
    subtitle: 'Additional Income and Adjustments to Income',
    pageCount: 1,
    staticElements: statics,
    fields,
  };
}
