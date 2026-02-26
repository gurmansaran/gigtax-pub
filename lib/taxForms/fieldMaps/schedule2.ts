/**
 * Schedule 2 — Additional Taxes
 * Part I: Tax (self-employment tax, NIIT)
 * Part II: Other taxes (not typically used for gig workers)
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

export function mapSchedule2(input: TaxFormInput): FormDefinition {
  const { taxReturn: d, result: r, profile: p } = input;

  const seTax = r.seTax;
  const niit = r.niit;
  const totalAdditionalTax = seTax + niit;

  const statics: FormStaticElement[] = [];
  const fields: FormField[] = [];

  statics.push(...buildFormHeader(
    'Schedule 2 (Form 1040)',
    'Additional Taxes',
  ));

  let y = PAGE_HEIGHT - 90;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Name(s) shown on Form 1040', fontSize: 7 },
    { type: 'text', page: 0, x: 380, y, text: 'Your social security number', fontSize: 7 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 42, y - 12, `${p.firstName} ${p.lastName}`, { fontSize: 10, maxWidth: 320 }));
  fields.push(buildTextField(0, 382, y - 12, formatSSN(p.ssn), { fontSize: 10 }));

  // Part I
  y -= 28;
  statics.push(...buildSectionHeader(0, y, 'Part I — Tax'));

  if (seTax > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '4', 'Self-employment tax (Schedule SE, line 12)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(seTax), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  if (niit > 0) {
    y -= 18;
    statics.push(...buildFormLine(0, y, '12', 'Net investment income tax (3.8%)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
    fields.push(buildAmountField(0, y, formNum(niit), { x: AMT_X + 2, width: AMT_W - 4 }));
  }

  y -= 18;
  statics.push(...buildFormLine(0, y, '21', 'Total additional taxes (to Form 1040, line 17)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(totalAdditionalTax), { x: AMT_X + 2, width: AMT_W - 4 }));

  statics.push(
    { type: 'text', page: 0, x: 40, y: 40, text: 'Prepared using GigTax software', fontSize: 7 },
  );

  return {
    formType: 'schedule2',
    title: 'Schedule 2 (Form 1040)',
    subtitle: 'Additional Taxes',
    pageCount: 1,
    staticElements: statics,
    fields,
  };
}
