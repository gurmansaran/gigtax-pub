#!/usr/bin/env node
/**
 * Maps all AcroForm field positions in the IRS Accessible Form 1040.
 * Run: node scripts/map-1040-fields.mjs
 */

import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';

const bytes = readFileSync('assets/pdfs/f1040.pdf');
const pdfDoc = await PDFDocument.load(bytes);
const form = pdfDoc.getForm();

const fields = form.getFields();
const results = [];

for (const f of fields) {
  const name = f.getName();
  const type = f.constructor.name;
  const widgets = f.acroField.getWidgets();
  for (const w of widgets) {
    const rect = w.getRectangle();
    const pageNum = name.includes('Page2') ? 1 : 0;
    results.push({
      name: name.replace('topmostSubform[0].', ''),
      type: type.replace('PDF', ''),
      page: pageNum,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    });
  }
}

// Sort by page, then by y descending, then by x ascending
results.sort((a, b) => {
  if (a.page !== b.page) return a.page - b.page;
  if (Math.abs(a.y - b.y) > 5) return b.y - a.y;
  return a.x - b.x;
});

console.log('Page | Y   | X   | W   | H  | Type      | Field Name');
console.log('-----|-----|-----|-----|----|-----------|----------');
for (const r of results) {
  console.log(
    String(r.page).padEnd(5) + '| ' +
    String(r.y).padEnd(4) + '| ' +
    String(r.x).padEnd(4) + '| ' +
    String(r.w).padEnd(4) + '| ' +
    String(r.h).padEnd(3) + '| ' +
    r.type.padEnd(10) + '| ' +
    r.name
  );
}
