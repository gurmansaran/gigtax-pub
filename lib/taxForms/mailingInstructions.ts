/**
 * Mailing Instructions Generator
 * Creates a text document with step-by-step instructions for printing,
 * signing, and mailing the tax return to the IRS.
 */

import type { TaxFormInput, FormType } from './types';
import { formatDollar } from './types';

// IRS mailing addresses by state and payment status
// Source: https://www.irs.gov/filing/where-to-file-paper-tax-returns-with-or-without-a-payment
const IRS_ADDRESSES: Record<string, { withPayment: string; noPayment: string }> = {
  // Group 1: AL, GA, KY, NJ, NC, SC, TN, VA
  AL: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  GA: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  KY: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  NJ: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  NC: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  SC: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  TN: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  VA: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  // Group 2: FL, LA, MS, TX
  FL: {
    withPayment: 'Internal Revenue Service\nP.O. Box 1214\nCharlotte, NC 28201-1214',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nAustin, TX 73301-0002',
  },
  LA: {
    withPayment: 'Internal Revenue Service\nP.O. Box 1214\nCharlotte, NC 28201-1214',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nAustin, TX 73301-0002',
  },
  MS: {
    withPayment: 'Internal Revenue Service\nP.O. Box 1214\nCharlotte, NC 28201-1214',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nAustin, TX 73301-0002',
  },
  TX: {
    withPayment: 'Internal Revenue Service\nP.O. Box 1214\nCharlotte, NC 28201-1214',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nAustin, TX 73301-0002',
  },
  // Group 3: AK, AZ, CA, CO, HI, ID, NM, NV, OR, UT, WA, WY
  AK: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  AZ: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  CA: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  CO: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  HI: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  ID: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  NM: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  NV: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  OR: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  UT: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  WA: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  WY: {
    withPayment: 'Internal Revenue Service\nP.O. Box 7704\nSan Francisco, CA 94120-7704',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nFresno, CA 93888-0002',
  },
  // Group 4: CT, DE, DC, IL, IN, IA, KS, ME, MD, MA, MI, MN, MO, MT, NE, NH, NY, ND, OH, OK, PA, RI, SD, VT, WI, WV
  CT: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  DE: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  DC: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  IL: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  IN: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  NY: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  PA: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  OH: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
  MA: {
    withPayment: 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000',
    noPayment: 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002',
  },
};

function getIRSAddress(state: string, owesTax: boolean): string {
  const entry = IRS_ADDRESSES[state.toUpperCase()];
  if (!entry) {
    return owesTax
      ? 'Internal Revenue Service\nP.O. Box 931000\nLouisville, KY 40293-1000'
      : 'Department of the Treasury\nInternal Revenue Service\nKansas City, MO 64999-0002';
  }
  return owesTax ? entry.withPayment : entry.noPayment;
}

const FORM_NAMES: Record<FormType, string> = {
  f1040: 'Form 1040',
  scheduleC: 'Schedule C',
  scheduleSE: 'Schedule SE',
  schedule1: 'Schedule 1',
  schedule2: 'Schedule 2',
  schedule3: 'Schedule 3',
  scheduleA: 'Schedule A',
  f1040V: 'Form 1040-V',
};

export function generateMailingInstructions(
  input: TaxFormInput,
  formList: FormType[],
): string {
  const { taxReturn: d, result: r, profile: p } = input;
  const owes = r.finalBillOrRefund > 0;
  const amount = Math.abs(r.finalBillOrRefund);
  const address = getIRSAddress(p.state, owes);
  const isMFJ = d.filingStatus === 'married_joint';

  const formListStr = formList.map(f => `  - ${FORM_NAMES[f]}`).join('\n');

  return `MAILING INSTRUCTIONS FOR YOUR 2025 TAX RETURN
${'='.repeat(50)}

Generated by GigTax on ${new Date().toLocaleDateString()}

YOUR TAX RETURN INCLUDES:
${formListStr}

${'─'.repeat(50)}

STEP 1: PRINT YOUR TAX RETURN
  - Print all pages of the attached PDF
  - Use white 8.5" x 11" paper
  - Print single-sided only
  - Make sure all pages are clear and legible

STEP 2: SIGN YOUR RETURN
  - Sign and date page 2 of Form 1040 in black or blue ink
${isMFJ ? '  - BOTH you and your spouse must sign\n' : ''}\
  - Do NOT use pencil or colored ink

STEP 3: ATTACH YOUR W-2s AND 1099s
  - Attach Copy B of all W-2 forms to the FRONT of Form 1040
  - Attach Copy B of all 1099 forms that show withholding
  - Use staples or paper clips (do not glue or tape)

STEP 4: ${owes ? 'INCLUDE PAYMENT' : 'EXPECT YOUR REFUND'}
${owes ? `\
  - You owe: ${formatDollar(amount)}
  - Include Form 1040-V payment voucher (included in your PDF)
  - Make check payable to "United States Treasury"
  - Write your SSN, "2025 Form 1040", and daytime phone on check
  - DO NOT send cash
  - DO NOT staple or attach your payment to the voucher` : `\
  - Your refund: ${formatDollar(amount)}
  - If you filed Direct Deposit info: 2-3 weeks after IRS receives return
  - If paper check: 6-8 weeks after IRS receives return
  - Track your refund at IRS.gov/refunds`}

STEP 5: MAIL TO THIS ADDRESS
${address.split('\n').map(l => `  ${l}`).join('\n')}

STEP 6: KEEP COPIES
  - Make a complete copy of your return for your records
  - Keep all receipts and supporting documents for at least 3 years
  - Store in a safe place

STEP 7: TRACK YOUR RETURN
  - Use certified mail with return receipt (~$3.70 at USPS)
  - Keep tracking number
  - Allow 4 weeks for IRS processing

IMPORTANT DATES
  - Filing deadline: April 15, 2026
  - Extension deadline (if filed Form 4868): October 15, 2026
  - 2026 Estimated Tax Payment Due Dates:
      Q1: April 15, 2026
      Q2: June 16, 2026
      Q3: September 15, 2026
      Q4: January 15, 2027

Questions? Visit IRS.gov or call 1-800-829-1040
`;
}
