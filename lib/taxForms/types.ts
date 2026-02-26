/**
 * Shared types for the tax form PDF generation system.
 * Used by field mappers, replica renderer, and form package generator.
 */

import type { TaxReturnState, FinalTaxResult } from '../unifiedTaxEngine';

// ─── Form Types ──────────────────────────────────────────────────────────────

export type FormType =
  | 'f1040'
  | 'scheduleC'
  | 'scheduleSE'
  | 'schedule1'
  | 'schedule2'
  | 'schedule3'
  | 'scheduleA'
  | 'f1040V';

// ─── Input Types ─────────────────────────────────────────────────────────────

/** Normalized profile data extracted from TaxProfileContextType */
export interface TaxProfileData {
  firstName: string;
  lastName: string;
  ssn: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dateOfBirth: string;
  spouseName: string;
  spouseSSN: string;
  phone: string;
  email: string;
}

/** Combined input for all field mappers */
export interface TaxFormInput {
  taxReturn: TaxReturnState;
  result: FinalTaxResult;
  profile: TaxProfileData;
}

// ─── Form Definition Types ───────────────────────────────────────────────────

export type TextAlign = 'left' | 'right' | 'center';

/** A single value to render on a form page */
export interface FormField {
  /** Value to display */
  value: string;
  /** Page index (0-based) */
  page: number;
  /** X coordinate in points from left */
  x: number;
  /** Y coordinate in points from bottom */
  y: number;
  /** Font size in points (default 10) */
  fontSize?: number;
  /** Text alignment relative to x (default 'left') */
  align?: TextAlign;
  /** Use bold font (default false) */
  bold?: boolean;
  /** Max width in points for clipping (optional) */
  maxWidth?: number;
}

/** A static label or line drawn on every form */
export interface FormStaticElement {
  type: 'text' | 'line' | 'rect';
  page: number;
  x: number;
  y: number;
  // For text
  text?: string;
  fontSize?: number;
  bold?: boolean;
  // For line
  x2?: number;
  y2?: number;
  lineWidth?: number;
  // For rect
  width?: number;
  height?: number;
  fill?: boolean;
  fillColor?: { r: number; g: number; b: number };
}

/** Complete definition for rendering a form */
export interface FormDefinition {
  formType: FormType;
  title: string;
  subtitle: string;
  pageCount: number;
  /** Static elements (labels, lines, boxes) drawn first */
  staticElements: FormStaticElement[];
  /** Dynamic fields populated from tax data */
  fields: FormField[];
}

// ─── Output Types ────────────────────────────────────────────────────────────

export interface FormGenerationResult {
  formType: FormType;
  pdfBytes: Uint8Array;
  pageCount: number;
}

export interface TaxFormPackage {
  forms: FormGenerationResult[];
  combinedPdfBytes: Uint8Array;
  formList: FormType[];
  generatedAt: string;
  mailingInstructions: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format number as whole dollars (no commas, no $ sign) for IRS forms */
export function formNum(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '';
  const rounded = Math.round(n);
  if (rounded === 0) return '0';
  return String(rounded);
}

/** Format SSN as XXX-XX-XXXX */
export function formatSSN(ssn: string | undefined): string {
  if (!ssn) return '';
  const digits = ssn.replace(/\D/g, '');
  if (digits.length !== 9) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/** Format number with commas for display (e.g. mailing instructions) */
export function formatDollar(n: number): string {
  return `$${Math.abs(Math.round(n)).toLocaleString()}`;
}
