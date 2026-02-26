#!/usr/bin/env node
/**
 * Lists all AcroForm field names in assets/pdfs/f1040.pdf.
 * Run from gigtax dir: node scripts/list-1040-fields.mjs
 * Use the output to update lib/pdfGenerator.ts map() and checkbox calls
 * so the filled 1040 matches the official IRS form (Sprintax-quality).
 */

import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfPath = join(__dirname, '..', 'assets', 'pdfs', 'f1040.pdf');

const bytes = readFileSync(pdfPath);
const pdfDoc = await PDFDocument.load(bytes);
const form = pdfDoc.getForm();
const fields = form.getFields();

const text = [];
const checkboxes = [];

for (const f of fields) {
  const name = f.getName();
  try {
    form.getTextField(name);
    text.push(name);
  } catch {
    try {
      form.getCheckBox(name);
      checkboxes.push(name);
    } catch {
      // other type (e.g. dropdown)
      text.push(name + ' (other)');
    }
  }
}

console.log('=== Form 1040 PDF – Text (and other) fields ===');
text.sort();
text.forEach((n) => console.log(n));
console.log('\n=== Form 1040 PDF – Checkbox fields ===');
checkboxes.sort();
checkboxes.forEach((n) => console.log(n));
console.log('\nTotal: ' + text.length + ' text/other, ' + checkboxes.length + ' checkboxes');

if (text.length === 0 && checkboxes.length === 0) {
  console.log('\n--- No AcroForm fields found ---');
  console.log('The standard IRS fillable 1040 (irs.gov/pub/irs-pdf/f1040.pdf) uses XFA; pdf-lib only supports AcroForm.');
  console.log('Use the IRS Accessible 1040 (AcroForm) instead:');
  console.log('  https://www.irs.gov/pub/irs-access/f1040_accessible.pdf');
  console.log('Download it, replace assets/pdfs/f1040.pdf with that file, then run this script again.');
}
