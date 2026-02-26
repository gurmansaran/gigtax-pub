/**
 * Tax Return types for the File Now wizard.
 * Wraps the engine's TaxReturnState with persistence metadata.
 */

import { TaxReturnState, FinalTaxResult } from '../unifiedTaxEngine';

// ─── Status ──────────────────────────────────────────────────────────────────

export type TaxReturnStatus = 'draft' | 'completed' | 'filed';

// ─── Supabase Row ────────────────────────────────────────────────────────────

export interface TaxReturnRecord {
  id: string;
  user_id: string;
  tax_year: number;
  status: TaxReturnStatus;
  current_section: number;
  current_sub_step: number;
  data: TaxReturnState;
  result: FinalTaxResult | null;
  created_at: string;
  updated_at: string;
}

// ─── Wizard Section ──────────────────────────────────────────────────────────

export interface WizardSection {
  id: number;
  key: string;
  title: string;
  icon: string; // Feather icon name
  subStepCount: number;
  isComplete: (data: TaxReturnState) => boolean;
}

// ─── Context Interface ───────────────────────────────────────────────────────

export interface TaxReturnContextType {
  data: TaxReturnState;
  result: FinalTaxResult | null;
  currentSection: number;
  currentSubStep: number;
  status: TaxReturnStatus;
  loading: boolean;
  saving: boolean;

  updateField: (field: keyof TaxReturnState, value: any) => void;
  updateFields: (updates: Partial<TaxReturnState>) => void;
  goToSection: (section: number, subStep?: number) => void;
  nextSubStep: () => void;
  prevSubStep: () => void;
  nextSection: () => void;
  prevSection: () => void;
  saveDraft: () => Promise<void>;
  loadDraft: () => Promise<boolean>;
  resetReturn: () => void;
  completeReturn: () => Promise<void>;
}

// ─── Default Empty State ─────────────────────────────────────────────────────

export function createEmptyTaxReturn(): TaxReturnState {
  return {
    filingStatus: 'single',
    w2Incomes: [],
    income1099: [],
    capitalGains: 0,
    capitalGainsShortTerm: 0,
    capitalGainsLongTerm: 0,
    spouseIncome: 0,
    spouseWithholding: 0,
    dependents: 0,
    iraContribution: 0,
    estimatedTaxesPaid: 0,
    studentLoanInterest: 0,
    healthInsurancePremiums: 0,
    stateOfResidence: '',
    mortgageInterest: 0,
    propertyTaxes: 0,
    charitableDonations: 0,
    deductionType: 'Standard',
    unemploymentIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    socialSecurityIncome: 0,
    rentalIncome: 0,
    alimonyReceived: 0,
    gamblingWinnings: 0,
    educationExpenses: 0,
    homeOffice: null,
    lastYearTaxLiability: 0,
    businessExpenses: 0,
    parkingAndTolls: 0,
    sepIraContribution: 0,
    hsaContribution: 0,
    hsaFamilyPlan: false,
    primary65Plus: false,
    primaryBlind: false,
    spouse65Plus: false,
    spouseBlind: false,
    dependentDetails: [],
    coveredByWorkplacePlan: false,
    spouseCoveredByWorkplacePlan: false,
    childCareExpenses: 0,
    phoneMonthlyBill: 0,
    phoneBusinessUsePercent: 50,
    internetMonthlyBill: 0,
    internetBusinessUsePercent: 50,
    totalMilesDriven: 0,
    businessMilesDriven: 0,
    actualVehicleExpenses: 0,
    carWashExpenses: 0,
    roadsideAssistanceExpenses: 0,
    backgroundCheckExpenses: 0,
    workAppExpenses: 0,
    equipmentExpenses: 0,
    bankFeeExpenses: 0,
    vehicleDepreciation: undefined,
    premiumTaxCredit: undefined,
    // Vulnerability fix fields
    qualifiedDividends: 0,
    isSSTB: false,
    canBeClaimedAsDependent: false,
    eligibleForEmployerHealthPlan: false,
    priorYearCapitalLossCarryforward: 0,
    priorYearNOL: 0,
    isoExerciseIncome: 0,
    isSubjectToKiddieTax: false,
    parentMarginalRate: 0,
    priorCharitableCarryforward: 0,
    workState: '',
    workStateIncomePercent: 0,
  };
}
