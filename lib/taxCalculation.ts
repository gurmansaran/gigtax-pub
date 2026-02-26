/**
 * DEPRECATED — This file is a re-export wrapper.
 * All tax calculation logic has been consolidated into unifiedTaxEngine.ts.
 * This file exists only for backward compatibility with any remaining imports.
 *
 * Use `import { ... } from '@/lib/unifiedTaxEngine'` for new code.
 */

export { type FilingStatus } from './unifiedTaxEngine';

// Re-export the unified tax engine's calculateFromTaxInput as calculateTax
// for backward compatibility with any code that still imports from this module.
import { calculateFromTaxInput, type FinalTaxResult } from './unifiedTaxEngine';

export interface TaxCalculationInput {
  w2Income: number;
  selfEmployedIncome: number;
  capitalGains: number;
  filingStatus?: 'single' | 'married_joint' | 'married_separate' | 'head_household';
  withholding?: number;
  estimatedPayments?: number;
  state?: string;
}

export interface TaxCalculationOutput {
  incomeBreakdown: { w2: number; selfEmployed: number; capitalGains: number; totalGross: number };
  taxLiability: { federal: number; state: number; selfEmployment: number; totalLiability: number };
  deductions: { standardDeduction: number; qbiDeduction: number; totalDeductions: number };
  finalCalculation: { totalTax: number; totalPaid: number; amountDueOrRefund: number };
}

export function calculateTax(input: TaxCalculationInput): TaxCalculationOutput {
  const result: FinalTaxResult = calculateFromTaxInput({
    filingStatus: input.filingStatus ?? 'single',
    gigIncome: input.selfEmployedIncome,
    gigExpenses: { miles: 0, actual: 0, other: 0 },
    w2Income: { self: input.w2Income, spouse: 0 },
    capitalGains: { shortTerm: input.capitalGains, longTerm: 0 },
    iraContributions: { self: 0, spouse: 0 },
    isRetirementPlanActive: { self: false, spouse: false },
    state: input.state,
  });

  const totalGross = input.w2Income + input.selfEmployedIncome + input.capitalGains;
  const totalPaid = (input.withholding ?? 0) + (input.estimatedPayments ?? 0);

  return {
    incomeBreakdown: {
      w2: input.w2Income,
      selfEmployed: input.selfEmployedIncome,
      capitalGains: input.capitalGains,
      totalGross,
    },
    taxLiability: {
      federal: result.federalTax,
      state: result.estimatedStateTax,
      selfEmployment: result.seTax,
      totalLiability: result.totalTax,
    },
    deductions: {
      standardDeduction: result.standardDeductionAmount,
      qbiDeduction: result.qbiDeduction,
      totalDeductions: result.deductionAmount + result.qbiDeduction,
    },
    finalCalculation: {
      totalTax: result.totalTax,
      totalPaid,
      amountDueOrRefund: result.totalTax - totalPaid,
    },
  };
}
