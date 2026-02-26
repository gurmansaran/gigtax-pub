/**
 * DEPRECATED — This file is a re-export wrapper.
 * All tax calculation logic has been consolidated into unifiedTaxEngine.ts.
 * This file exists only for backward compatibility with any remaining imports.
 *
 * Use `import { ... } from '@/lib/unifiedTaxEngine'` for new code.
 */

export {
  calculateUnifiedTax as calculateFinalTax,
  calculateIRASuggestion,
  getMarginalRate,
  type TaxReturnState,
  type FinalTaxResult,
  type FilingStatus,
} from './unifiedTaxEngine';
