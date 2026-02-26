/**
 * Central tax data types.
 * TaxData strictly separates primary vs. spouse entities.
 */

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_household';

/** W-2 form (matches W2Form component shape). */
export interface W2Form {
  employer: string;
  ein: string;
  box1_wages: number;
  box2_fedWithheld: number;
  box3_ssWages: number;
  box4_ssTax: number;
  box5_medicareWages: number;
  box6_medicareTax: number;
}

/** 1099-NEC form (matches Form1099 component shape). */
export interface Form1099 {
  payer: string;
  ein: string;
  box1_compensation: number;
  box4_fedWithheld: number;
  tips: number;
}

export interface CapitalGains {
  shortTerm: number;
  longTerm: number;
}

export interface TaxDataEntity {
  w2s: W2Form[];
  forms1099: Form1099[];
  capitalGains: CapitalGains;
}

/**
 * TaxData - strictly separated primary vs. spouse.
 * Use for File Now wizard and tax engine.
 */
export interface TaxData {
  filingStatus: FilingStatus;
  primary: TaxDataEntity;
  spouse: TaxDataEntity;
}

export const defaultCapitalGains: CapitalGains = { shortTerm: 0, longTerm: 0 };

export function emptyTaxDataEntity(): TaxDataEntity {
  return {
    w2s: [],
    forms1099: [],
    capitalGains: { ...defaultCapitalGains },
  };
}

export function defaultTaxData(filingStatus: FilingStatus = 'single'): TaxData {
  return {
    filingStatus,
    primary: emptyTaxDataEntity(),
    spouse: emptyTaxDataEntity(),
  };
}
