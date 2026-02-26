/**
 * Schedule C — Profit or Loss From Business (Sole Proprietorship)
 * For gig workers: rideshare drivers, delivery drivers, freelancers.
 *
 * Maps income from 1099s and business expenses to Schedule C lines.
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

const AMT_X = 470;
const AMT_W = 106;

export function mapScheduleC(input: TaxFormInput): FormDefinition {
  const { taxReturn: d, result: r, profile: p } = input;

  // Income
  const grossReceipts = d.income1099.reduce((s, i) => s + i.grossAmount, 0);

  // Expenses
  const carTruckExpenses = d.businessExpenses ?? 0;
  const parkingTolls = d.parkingAndTolls ?? 0;
  const totalExpenses = carTruckExpenses + parkingTolls;
  const tentativeProfit = grossReceipts - totalExpenses;
  const homeOffice = r.homeOfficeDeduction;
  const netProfit = r.netBusinessIncome;

  // Business info
  const businessName = d.income1099.length > 0
    ? d.income1099[0].source || 'Rideshare/Delivery'
    : 'Rideshare/Delivery';
  const principalBusiness = 'Rideshare / Delivery / Gig Work';
  const businessCode = '485300'; // Taxi & rideshare service

  const statics: FormStaticElement[] = [];
  const fields: FormField[] = [];

  // ─── Header ─────────────────────────────────────────────────────────────
  statics.push(...buildFormHeader(
    'Schedule C (Form 1040)',
    'Profit or Loss From Business (Sole Proprietorship)',
  ));

  // Name and SSN
  let y = PAGE_HEIGHT - 90;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Name of proprietor', fontSize: 7 },
    { type: 'text', page: 0, x: 380, y, text: 'Social security number (SSN)', fontSize: 7 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 42, y - 12, `${p.firstName} ${p.lastName}`, { fontSize: 10, maxWidth: 320 }));
  fields.push(buildTextField(0, 382, y - 12, formatSSN(p.ssn), { fontSize: 10 }));

  // Lines A-F
  y -= 28;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'A  Principal business or profession, including product or service', fontSize: 8 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 340, y, principalBusiness, { fontSize: 9, maxWidth: 230 }));

  y -= 18;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'B  Enter code from instructions', fontSize: 8 },
    { type: 'rect', page: 0, x: 250, y: y - 3, width: 70, height: 14 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 255, y - 1, businessCode, { fontSize: 10, bold: true }));

  y -= 18;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'C  Business name (if different from your name)', fontSize: 8 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );

  y -= 18;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'F  Accounting method:', fontSize: 8 },
    { type: 'rect', page: 0, x: 160, y: y - 2, width: 10, height: 10 },
    { type: 'text', page: 0, x: 174, y, text: 'Cash', fontSize: 8 },
    { type: 'rect', page: 0, x: 210, y: y - 2, width: 10, height: 10 },
    { type: 'text', page: 0, x: 224, y, text: 'Accrual', fontSize: 8 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildCheckbox(0, 160, y - 2, true)); // Cash method

  y -= 18;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'G  Did you "materially participate" in the operation of this business?', fontSize: 8 },
    { type: 'rect', page: 0, x: 390, y: y - 2, width: 10, height: 10 },
    { type: 'text', page: 0, x: 404, y, text: 'Yes', fontSize: 8 },
    { type: 'rect', page: 0, x: 440, y: y - 2, width: 10, height: 10 },
    { type: 'text', page: 0, x: 454, y, text: 'No', fontSize: 8 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildCheckbox(0, 390, y - 2, true)); // Yes, materially participate

  // ─── Part I — Income ────────────────────────────────────────────────────
  y -= 22;
  statics.push(...buildSectionHeader(0, y, 'Part I — Income'));
  y -= 18;
  statics.push(...buildFormLine(0, y, '1', 'Gross receipts or sales', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(grossReceipts), { x: AMT_X + 2, width: AMT_W - 4 }));
  y -= 18;
  statics.push(...buildFormLine(0, y, '2', 'Returns and allowances', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, '0', { x: AMT_X + 2, width: AMT_W - 4 }));
  y -= 18;
  statics.push(...buildFormLine(0, y, '5', 'Cost of goods sold (from Part III)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, '0', { x: AMT_X + 2, width: AMT_W - 4 }));
  y -= 18;
  statics.push(...buildFormLine(0, y, '7', 'Gross income (line 1 minus line 6)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(grossReceipts), { x: AMT_X + 2, width: AMT_W - 4 }));

  // ─── Part II — Expenses ─────────────────────────────────────────────────
  y -= 22;
  statics.push(...buildSectionHeader(0, y, 'Part II — Expenses'));
  y -= 18;
  statics.push(...buildFormLine(0, y, '9', 'Car and truck expenses (see instructions)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(carTruckExpenses), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '22', 'Supplies', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(parkingTolls), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '28', 'Total expenses before expenses for business use of home', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(totalExpenses), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '29', 'Tentative profit or (loss) (line 7 minus line 28)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(tentativeProfit), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '30', 'Expenses for business use of your home (simplified method)', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(homeOffice), { x: AMT_X + 2, width: AMT_W - 4 }));

  y -= 18;
  statics.push(...buildFormLine(0, y, '31', 'Net profit or (loss) — to Form 1040, Schedule 1, line 3', { amountBoxX: AMT_X, amountBoxWidth: AMT_W }));
  fields.push(buildAmountField(0, y, formNum(netProfit), { x: AMT_X + 2, width: AMT_W - 4 }));

  // ─── Income sources list ────────────────────────────────────────────────
  if (d.income1099.length > 0) {
    y -= 22;
    statics.push(...buildSectionHeader(0, y, '1099 Income Sources'));
    for (const inc of d.income1099.slice(0, 6)) {
      y -= 16;
      const formTypeLabel = inc.formType || '1099-NEC';
      statics.push(
        { type: 'text', page: 0, x: 42, y, text: `${inc.source || 'Platform'} (${formTypeLabel})`, fontSize: 8 },
      );
      fields.push(buildAmountField(0, y, formNum(inc.grossAmount), { x: AMT_X + 2, width: AMT_W - 4 }));
    }
  }

  return {
    formType: 'scheduleC',
    title: 'Schedule C (Form 1040)',
    subtitle: 'Profit or Loss From Business (Sole Proprietorship)',
    pageCount: 1,
    staticElements: statics,
    fields,
  };
}
