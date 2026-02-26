/**
 * Form 1040-V — Payment Voucher
 * Generated only when taxpayer owes money (finalBillOrRefund > 0).
 * Accompanies check/money order mailed with the tax return.
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

export function mapForm1040V(input: TaxFormInput): FormDefinition {
  const { taxReturn: d, result: r, profile: p } = input;

  const amountOwed = r.finalBillOrRefund > 0 ? r.finalBillOrRefund : 0;

  const statics: FormStaticElement[] = [];
  const fields: FormField[] = [];

  statics.push(...buildFormHeader(
    'Form 1040-V',
    'Payment Voucher',
  ));

  let y = PAGE_HEIGHT - 90;

  // Instructions
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Purpose of Form — Use Form 1040-V when mailing a payment with your Form 1040.', fontSize: 8 },
  );
  y -= 14;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Make your check or money order payable to "United States Treasury."', fontSize: 8, bold: true },
  );
  y -= 14;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Write your SSN, daytime phone number, and "2025 Form 1040" on your payment.', fontSize: 8 },
  );
  y -= 14;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Do not send cash. Do not staple or attach your payment to this voucher.', fontSize: 8 },
  );

  // Voucher section
  y -= 30;
  statics.push(
    { type: 'line', page: 0, x: 36, y: y + 6, x2: 576, y2: y + 6, lineWidth: 2 },
    { type: 'text', page: 0, x: 40, y: y - 8, text: 'Detach here and mail with your payment and Form 1040', fontSize: 7, bold: true },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 2 },
  );

  y -= 30;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Form 1040-V', fontSize: 14, bold: true },
    { type: 'text', page: 0, x: 180, y: y + 2, text: 'Department of the Treasury', fontSize: 7 },
    { type: 'text', page: 0, x: 180, y: y - 8, text: 'Internal Revenue Service', fontSize: 7 },
    { type: 'text', page: 0, x: 430, y, text: 'Payment Voucher', fontSize: 10, bold: true },
    { type: 'text', page: 0, x: 430, y: y - 12, text: 'Tax Year 2025', fontSize: 8 },
  );

  // Amount paid box
  y -= 32;
  statics.push(...buildSectionHeader(0, y, 'Amount You Are Paying'));
  y -= 20;
  statics.push(
    { type: 'rect', page: 0, x: 40, y: y - 4, width: 200, height: 24 },
    { type: 'text', page: 0, x: 42, y: y + 10, text: 'Amount of payment', fontSize: 7 },
  );
  fields.push(buildTextField(0, 50, y, formNum(amountOwed), { fontSize: 14, bold: true }));

  // Taxpayer info
  y -= 36;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Your first name and middle initial', fontSize: 7 },
    { type: 'text', page: 0, x: 300, y, text: 'Last name', fontSize: 7 },
    { type: 'text', page: 0, x: 450, y, text: 'Your SSN', fontSize: 7 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 42, y - 12, p.firstName, { fontSize: 10, maxWidth: 240 }));
  fields.push(buildTextField(0, 302, y - 12, p.lastName, { fontSize: 10, maxWidth: 140 }));
  fields.push(buildTextField(0, 452, y - 12, formatSSN(p.ssn), { fontSize: 10 }));

  y -= 28;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'Home address (number and street)', fontSize: 7 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 42, y - 12, p.address, { fontSize: 10, maxWidth: 520 }));

  y -= 28;
  statics.push(
    { type: 'text', page: 0, x: 40, y, text: 'City, town, or post office', fontSize: 7 },
    { type: 'text', page: 0, x: 350, y, text: 'State', fontSize: 7 },
    { type: 'text', page: 0, x: 420, y, text: 'ZIP code', fontSize: 7 },
    { type: 'line', page: 0, x: 36, y: y - 14, x2: 576, y2: y - 14, lineWidth: 0.5 },
  );
  fields.push(buildTextField(0, 42, y - 12, p.city, { fontSize: 10, maxWidth: 290 }));
  fields.push(buildTextField(0, 352, y - 12, p.state, { fontSize: 10 }));
  fields.push(buildTextField(0, 422, y - 12, p.zip, { fontSize: 10 }));

  statics.push(
    { type: 'text', page: 0, x: 40, y: 40, text: 'Prepared using GigTax software', fontSize: 7 },
  );

  return {
    formType: 'f1040V',
    title: 'Form 1040-V',
    subtitle: 'Payment Voucher',
    pageCount: 1,
    staticElements: statics,
    fields,
  };
}
