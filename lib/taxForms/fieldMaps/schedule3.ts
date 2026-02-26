/**
 * Schedule 3 — Additional Credits and Payments
 * Part I: Nonrefundable Credits (education, child care, saver's)
 * Part II: Other Payments and Refundable Credits (estimated tax payments)
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

export function mapSchedule3(input: TaxFormInput): FormDefinition {
  const { taxReturn: d, result: r, profile: p } = input;

  const educationCredit = r.educationCredit;
  const childCareCredit = r.childCareCredit;
  const saversCredit = r.saversCredit;
  const totalNonrefundableCredits = educationCredit + childCareCredit + saversCredit;
  const estimatedPayments = d.estimatedTaxesPaid ?? 0;

  const statics: FormStaticElement[] = [];
  const fields: FormField[] = [];

  statics.push(...buildFormHeader(
    'Schedule 3 (Form 1040)',
    'Additional Credits and Payments',
  ));

  let y = PAGE_HEIGHT - 90;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Name(s) shown on Form 1040', fontSize: 7 },
    { type: 'text', page: 0, x: 380, y, text: 'Your social security number', fontSize: 7 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 42, y - 12, `${p.firstName} ${p.lastName}`, { fontSize: 10, maxWidth: 320 }));
  fields.push(buildTextField(0, 382, y - 12, formatSSN(p.ssn), { fontSize: 10 }));

  // Part I — Nonrefundable Credits
  y -= 28;
  statics.push(...buildSectionHeader(0, y, 'Part I — Nonrefundable Credits'));

  if (educationCredit > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '2', 'Education credits (Form 8863)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(educationCredit), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  if (childCareCredit > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '3', 'Child and dependent care credit (Form 2441)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(childCareCredit), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  if (saversCredit > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '4', 'Retirement savings contributions credit (Form 8880)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(saversCredit), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  y -= 18;
  statics.push(...buildFormLine(0, y, '8', 'Total nonrefundable credits (to Form 1040, line 20)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(totalNonrefundableCredits), { x: AMT_X + 2, width: AMT_W - 4 }));

  // Part II — Other Payments and Refundable Credits
  y -= 22;
  statics.push(...buildSectionHeader(0, y, 'Part II — Other Payments and Refundable Credits'));

  if (estimatedPayments > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '10', 'Estimated tax payments and amount applied from prior year', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(estimatedPayments), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  y -= 18;
  statics.push(...buildFormLine(0, y, '15', 'Total other payments and refundable credits (to Form 1040, line 31)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(estimatedPayments), { x: AMT_X + 2, width: AMT_W - 4 }));

  statics.push(
    { type: 'text', page: 0, x: 40, y: 40, text: 'Prepared using GigTax software', fontSize: 7 },
  );

  return {
    formType: 'schedule3',
    title: 'Schedule 3 (Form 1040)',
    subtitle: 'Additional Credits and Payments',
    pageCount: 1,
    staticElements: statics,
    fields,
  };
}
