/**
 * Wizard section registry — defines the 6 major sections of the File Now wizard.
 */

import { WizardSection } from './types/TaxReturn';
import { TaxReturnState } from './unifiedTaxEngine';

export const WIZARD_SECTIONS: WizardSection[] = [
  {
    id: 0,
    key: 'personal',
    title: 'Personal Info',
    icon: 'user',
    subStepCount: 5, // profile confirm, filing status, spouse, dependents, age/blind
    isComplete: (d: TaxReturnState) =>
      !!d.filingStatus && !!d.stateOfResidence,
  },
  {
    id: 1,
    key: 'income',
    title: 'Income',
    icon: 'dollar-sign',
    subStepCount: 6, // type selector, W-2s, 1099s, cap gains, other income, spouse income
    isComplete: (d: TaxReturnState) =>
      d.w2Incomes.length > 0 || d.income1099.length > 0 || d.interestIncome > 0 || d.dividendIncome > 0,
  },
  {
    id: 2,
    key: 'expenses',
    title: 'Expenses',
    icon: 'briefcase',
    subStepCount: 5, // biz info, vehicle, home office, categories, auto-import
    isComplete: (_d: TaxReturnState) => true, // Optional section
  },
  {
    id: 3,
    key: 'deductions',
    title: 'Deductions',
    icon: 'scissors',
    subStepCount: 6, // std vs itemized, itemized details, health ins, retirement, student loan, QBI
    isComplete: (_d: TaxReturnState) => true, // Optional section
  },
  {
    id: 4,
    key: 'credits',
    title: 'Credits',
    icon: 'award',
    subStepCount: 5, // CTC, education, child care, EITC, est. payments
    isComplete: (_d: TaxReturnState) => true, // Optional section
  },
  {
    id: 5,
    key: 'review',
    title: 'Review',
    icon: 'check-circle',
    subStepCount: 4, // summary, refund display, edit buttons, PDF gen
    isComplete: (_d: TaxReturnState) => false, // Never auto-complete
  },
];

export const TOTAL_SECTIONS = WIZARD_SECTIONS.length;
