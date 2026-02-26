/**
 * Schedule SE — Self-Employment Tax
 * Computes SE tax from Schedule C net profit.
 *
 * Uses Short Schedule SE (most filers qualify).
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
const SS_WAGE_BASE = 176_100;
const SE_MULTIPLIER = 0.9235;

export function mapScheduleSE(input: TaxFormInput): FormDefinition {
  const { taxReturn: d, result: r, profile: p } = input;

  const netProfit = r.netBusinessIncome;
  const w2Wages = d.w2Incomes.reduce((s, w) => s + w.wages, 0);

  // SE calculations (mirror unifiedTaxEngine.ts)
  const line3 = netProfit;
  const line4a = Math.round(line3 * SE_MULTIPLIER);
  const line5a = w2Wages;
  const line6 = SS_WAGE_BASE;
  const line7 = Math.max(0, line6 - line5a);
  const line8a = Math.min(line4a, line7);
  const line10 = Math.round(line8a * 0.124); // Social Security tax
  const line11 = Math.round(line4a * 0.029); // Medicare tax
  const line12 = line10 + line11; // Total SE tax
  const line13 = Math.round(line12 * 0.5); // Deductible portion

  const statics: FormStaticElement[] = [];
  const fields: FormField[] = [];

  // ─── Header ─────────────────────────────────────────────────────────────
  statics.push(...buildFormHeader(
    'Schedule SE (Form 1040)',
    'Self-Employment Tax',
  ));

  // Name and SSN
  let y = PAGE_HEIGHT - 90;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Name of person with self-employment income', fontSize: 7 },
    { type: 'text', page: 0, x: 380, y, text: 'Social security number', fontSize: 7 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 42, y - 12, `${p.firstName} ${p.lastName}`, { fontSize: 10, maxWidth: 320 }));
  fields.push(buildTextField(0, 382, y - 12, formatSSN(p.ssn), { fontSize: 10 }));

  // ─── Short Schedule SE ──────────────────────────────────────────────────
  y -= 28;
  statics.push(...buildSectionHeader(0, y, 'Section A — Short Schedule SE'));

  y -= 18;
  statics.push(...buildFormLine(0, y, '1a', 'Net farm profit or (loss) from Schedule F', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, '0', { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '2', 'Net profit or (loss) from Schedule C, line 31', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(netProfit), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '3', 'Combine lines 1a, 1b, and 2', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(line3), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '4a', 'If line 3 is more than zero, multiply line 3 by 92.35% (0.9235)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(line4a), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 22;
  statics.push(...buildSectionHeader(0, y, 'Social Security Tax Calculation'));

  y -= 18;
  statics.push(...buildFormLine(0, y, '5a', 'W-2 wages subject to social security tax', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(line5a), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '6', 'Social security wage base for 2025', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(line6), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '7', 'Subtract line 5a from line 6 (if zero or less, enter -0-)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(line7), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '8a', 'Smaller of line 4a or line 7', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(line8a), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '10', 'Social security tax: multiply line 8a by 12.4% (0.124)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(line10), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '11', 'Medicare tax: multiply line 4a by 2.9% (0.029)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(line11), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 22;
  statics.push(...buildSectionHeader(0, y, 'Total Self-Employment Tax'));

  y -= 18;
  statics.push(...buildFormLine(0, y, '12', 'Self-employment tax (add lines 10 and 11) — to Schedule 2, line 4', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(line12), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '13', 'Deduction for one-half of SE tax — to Schedule 1, line 15', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(line13), { x: AMT_X + 2, width: AMT_W - 4 }));

  // Note
  statics.push(
    { type: 'text', page: 0, x: 40, y: 50, text: 'Prepared using GigTax software', fontSize: 7 },
  );

  return {
    formType: 'scheduleSE',
    title: 'Schedule SE (Form 1040)',
    subtitle: 'Self-Employment Tax',
    pageCount: 1,
    staticElements: statics,
    fields,
  };
}
