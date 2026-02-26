/**
 * Schedule A — Itemized Deductions
 * Generated only when deductionMethod === 'Itemized'.
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
const SALT_CAP = 10_000;

export function mapScheduleA(input: TaxFormInput): FormDefinition {
  const { taxReturn: d, result: r, profile: p } = input;

  const mortgageInterest = d.mortgageInterest ?? 0;
  const charitableDonations = d.charitableDonations ?? 0;
  const propertyTaxes = d.propertyTaxes ?? 0;

  // SALT: state/local taxes + property taxes, capped at $10,000
  // Estimate state tax for SALT purposes (mirrors engine logic)
  const saltTotal = Math.min(SALT_CAP, propertyTaxes + r.estimatedStateTax);

  const totalItemized = r.itemizedDeductionAmount;

  const statics: FormStaticElement[] = [];
  const fields: FormField[] = [];

  statics.push(...buildFormHeader(
    'Schedule A (Form 1040)',
    'Itemized Deductions',
  ));

  let y = PAGE_HEIGHT - 90;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Name(s) shown on Form 1040', fontSize: 7 },
    { type: 'text', page: 0, x: 380, y, text: 'Your social security number', fontSize: 7 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 42, y - 12, `${p.firstName} ${p.lastName}`, { fontSize: 10, maxWidth: 320 }));
  fields.push(buildTextField(0, 382, y - 12, formatSSN(p.ssn), { fontSize: 10 }));

  // Taxes You Paid
  y -= 28;
  statics.push(...buildSectionHeader(0, y, 'Taxes You Paid'));

  y -= 18;
  statics.push(...buildFormLine(0, y, '5a', 'State and local income taxes', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(r.estimatedStateTax), { x: AMT_X + 2, width: AMT_W - 4 }));

  if (propertyTaxes > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '5b', 'State and local real estate taxes', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(propertyTaxes), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  y -= 18;
  statics.push(...buildFormLine(0, y, '5d', 'Add lines 5a through 5c', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(propertyTaxes + r.estimatedStateTax), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '5e', 'Enter the smaller of line 5d or $10,000', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(saltTotal), { x: AMT_X + 2, width: AMT_W - 4 }));

  // Interest You Paid
  if (mortgageInterest > 0) {
    y -= 22;
    statics.push(...buildSectionHeader(0, y, 'Interest You Paid'));

    y -= 18;
    statics.push(...buildFormLine(0, y, '8a', 'Home mortgage interest and points', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(mortgageInterest), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  // Gifts to Charity
  if (charitableDonations > 0) {
    y -= 22;
    statics.push(...buildSectionHeader(0, y, 'Gifts to Charity'));

    y -= 18;
    statics.push(...buildFormLine(0, y, '12', 'Gifts by cash or check', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(charitableDonations), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  // Total
  y -= 22;
  statics.push(...buildSectionHeader(0, y, 'Total Itemized Deductions'));

  y -= 18;
  statics.push(...buildFormLine(0, y, '17', 'Total itemized deductions (to Form 1040, line 12)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(totalItemized), { x: AMT_X + 2, width: AMT_W - 4 }));

  statics.push(
    { type: 'text', page: 0, x: 40, y: 40, text: 'Prepared using GigTax software', fontSize: 7 },
  );

  return {
    formType: 'scheduleA',
    title: 'Schedule A (Form 1040)',
    subtitle: 'Itemized Deductions',
    pageCount: 1,
    staticElements: statics,
    fields,
  };
}
