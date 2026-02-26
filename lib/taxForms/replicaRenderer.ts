/**
 * Replica Renderer — Draws IRS-format form pages using pdf-lib.
 * Creates print-ready PDFs without depending on IRS fillable PDF templates.
 *
 * Uses pdf-lib's page drawing API: drawText, drawLine, drawRectangle.
 * Fonts: Courier for filled values (IRS standard), Helvetica for labels.
 * Page size: US Letter (612 x 792 points = 8.5" x 11").
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import type { FormDefinition, FormField, FormStaticElement } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const DEFAULT_FONT_SIZE = 10;
const LABEL_COLOR = rgb(0, 0, 0);
const VALUE_COLOR = rgb(0, 0, 0);
const LIGHT_GRAY = rgb(0.92, 0.92, 0.92);
const LINE_COLOR = rgb(0, 0, 0);

// ─── Main Render Function ────────────────────────────────────────────────────

/**
 * Render a complete form as a PDF from a FormDefinition.
 * Returns the PDF as a Uint8Array.
 */
export async function renderFormPages(formDef: FormDefinition): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);
  const courierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Create pages
  const pages: PDFPage[] = [];
  for (let i = 0; i < formDef.pageCount; i++) {
    pages.push(pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
  }

  // Draw static elements (form structure: labels, lines, boxes)
  for (const el of formDef.staticElements) {
    const page = pages[el.page];
    if (!page) continue;
    drawStaticElement(page, el, helvetica, helveticaBold);
  }

  // Draw dynamic fields (user's tax data values)
  for (const field of formDef.fields) {
    const page = pages[field.page];
    if (!page) continue;
    drawField(page, field, courier, courierBold);
  }

  return await pdfDoc.save();
}

// ─── Drawing Helpers ─────────────────────────────────────────────────────────

function drawStaticElement(
  page: PDFPage,
  el: FormStaticElement,
  font: PDFFont,
  fontBold: PDFFont,
): void {
  switch (el.type) {
    case 'text': {
      const f = el.bold ? fontBold : font;
      const size = el.fontSize ?? 8;
      page.drawText(el.text ?? '', {
        x: el.x,
        y: el.y,
        size,
        font: f,
        color: LABEL_COLOR,
      });
      break;
    }
    case 'line': {
      page.drawLine({
        start: { x: el.x, y: el.y },
        end: { x: el.x2 ?? el.x + 100, y: el.y2 ?? el.y },
        thickness: el.lineWidth ?? 0.5,
        color: LINE_COLOR,
      });
      break;
    }
    case 'rect': {
      if (el.fill && el.fillColor) {
        page.drawRectangle({
          x: el.x,
          y: el.y,
          width: el.width ?? 100,
          height: el.height ?? 14,
          color: rgb(el.fillColor.r, el.fillColor.g, el.fillColor.b),
        });
      }
      page.drawRectangle({
        x: el.x,
        y: el.y,
        width: el.width ?? 100,
        height: el.height ?? 14,
        borderWidth: el.lineWidth ?? 0.5,
        borderColor: LINE_COLOR,
        color: undefined,
      });
      break;
    }
  }
}

function drawField(
  page: PDFPage,
  field: FormField,
  font: PDFFont,
  fontBold: PDFFont,
): void {
  if (!field.value && field.value !== '0') return;

  const f = field.bold ? fontBold : font;
  const size = field.fontSize ?? DEFAULT_FONT_SIZE;
  const align = field.align ?? 'left';
  let x = field.x;

  if (align === 'right' && field.maxWidth) {
    const textWidth = f.widthOfTextAtSize(field.value, size);
    x = field.x + field.maxWidth - textWidth;
  } else if (align === 'center' && field.maxWidth) {
    const textWidth = f.widthOfTextAtSize(field.value, size);
    x = field.x + (field.maxWidth - textWidth) / 2;
  }

  // Clip text if it exceeds maxWidth
  let text = field.value;
  if (field.maxWidth) {
    while (f.widthOfTextAtSize(text, size) > field.maxWidth && text.length > 1) {
      text = text.slice(0, -1);
    }
  }

  page.drawText(text, {
    x,
    y: field.y,
    size,
    font: f,
    color: VALUE_COLOR,
  });
}

// ─── Form Layout Builders ────────────────────────────────────────────────────

/**
 * IRS-style form header with title, year, and OMB number.
 */
export function buildFormHeader(
  title: string,
  subtitle: string,
  year: string = '2025',
): FormStaticElement[] {
  return [
    // Top border
    { type: 'line', page: 0, x: 36, y: PAGE_HEIGHT - 36, x2: PAGE_WIDTH - 36, y2: PAGE_HEIGHT - 36, lineWidth: 2 },
    // Department of the Treasury label
    { type: 'text', page: 0, x: 38, y: PAGE_HEIGHT - 48, text: 'Department of the Treasury — Internal Revenue Service', fontSize: 7 },
    // Form title
    { type: 'text', page: 0, x: 38, y: PAGE_HEIGHT - 62, text: title, fontSize: 14, bold: true },
    // Subtitle
    { type: 'text', page: 0, x: 38, y: PAGE_HEIGHT - 76, text: subtitle, fontSize: 8 },
    // Tax year
    { type: 'text', page: 0, x: PAGE_WIDTH - 80, y: PAGE_HEIGHT - 62, text: year, fontSize: 14, bold: true },
    // OMB placeholder
    { type: 'text', page: 0, x: PAGE_WIDTH - 120, y: PAGE_HEIGHT - 48, text: 'OMB No. 1545-0074', fontSize: 6 },
    // Line under header
    { type: 'line', page: 0, x: 36, y: PAGE_HEIGHT - 82, x2: PAGE_WIDTH - 36, y2: PAGE_HEIGHT - 82, lineWidth: 1 },
  ];
}

/**
 * Section header bar (gray background with bold title).
 */
export function buildSectionHeader(
  page: number,
  y: number,
  title: string,
): FormStaticElement[] {
  return [
    { type: 'rect', page, x: 36, y: y - 2, width: PAGE_WIDTH - 72, height: 16,
      fill: true, fillColor: { r: 0.92, g: 0.92, b: 0.92 } },
    { type: 'text', page, x: 40, y: y + 1, text: title, fontSize: 9, bold: true },
    { type: 'line', page, x: 36, y: y - 2, x2: PAGE_WIDTH - 36, y2: y - 2, lineWidth: 0.5 },
  ];
}

/**
 * Standard form line with line number, description, and amount box.
 */
export function buildFormLine(
  page: number,
  y: number,
  lineNum: string,
  description: string,
  opts?: { dotLeader?: boolean; amountBoxX?: number; amountBoxWidth?: number },
): FormStaticElement[] {
  const amtX = opts?.amountBoxX ?? 470;
  const amtW = opts?.amountBoxWidth ?? 100;
  const elements: FormStaticElement[] = [
    // Line number
    { type: 'text', page, x: 40, y, text: lineNum, fontSize: 8, bold: true },
    // Description
    { type: 'text', page, x: 60, y, text: description, fontSize: 8 },
    // Amount box
    { type: 'rect', page, x: amtX, y: y - 3, width: amtW, height: 14 },
  ];
  // Underline for the row
  elements.push({
    type: 'line', page, x: 36, y: y - 3, x2: amtX + amtW, y2: y - 3, lineWidth: 0.25,
  });
  return elements;
}

/**
 * Place a value in a standard amount box (right-aligned).
 */
export function buildAmountField(
  page: number,
  y: number,
  value: string,
  opts?: { x?: number; width?: number },
): FormField {
  return {
    value,
    page,
    x: opts?.x ?? 472,
    y: y - 1,
    fontSize: 10,
    align: 'right',
    maxWidth: (opts?.width ?? 96),
  };
}

/**
 * Place a text value at arbitrary position.
 */
export function buildTextField(
  page: number,
  x: number,
  y: number,
  value: string,
  opts?: { fontSize?: number; bold?: boolean; maxWidth?: number; align?: 'left' | 'right' | 'center' },
): FormField {
  return {
    value,
    page,
    x,
    y,
    fontSize: opts?.fontSize ?? 10,
    bold: opts?.bold,
    maxWidth: opts?.maxWidth,
    align: opts?.align,
  };
}

/**
 * Checkbox "X" marker.
 */
export function buildCheckbox(
  page: number,
  x: number,
  y: number,
  checked: boolean,
): FormField {
  return {
    value: checked ? 'X' : '',
    page,
    x: x + 2,
    y: y + 1,
    fontSize: 10,
    bold: true,
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export { PAGE_WIDTH, PAGE_HEIGHT };
