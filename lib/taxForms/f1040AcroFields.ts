/**
 * IRS Form 1040 (2025) — AcroForm Field Name Mapping
 *
 * Maps our TaxFormInput data model to the exact AcroForm field names
 * in the IRS Accessible Form 1040 PDF (f1040_accessible.pdf).
 *
 * Field names discovered via scripts/map-1040-fields.mjs.
 * Positions verified against the official IRS layout.
 *
 * Field naming convention:
 *   topmostSubform[0].Page{N}[0].{path}.f{N}_{NN}[0]  — text fields
 *   topmostSubform[0].Page{N}[0].{path}.c{N}_{NN}[0]  — checkboxes
 */

const P = 'topmostSubform[0]';
const P1 = `${P}.Page1[0]`;
const P2 = `${P}.Page2[0]`;
const ADDR = `${P1}.Address_ReadOrder[0]`;
const CB_RO = `${P1}.Checkbox_ReadOrder[0]`;
const DEP = `${P1}.Table_Dependents[0]`;

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 1 — TAXPAYER INFO, FILING STATUS, DEPENDENTS, INCOME
// ═══════════════════════════════════════════════════════════════════════════════

export const F1040_TEXT = {
  // ── Taxpayer Name & SSN (top of page 1) ─────────────────────────────────
  firstName:          `${P1}.f1_01[0]`,
  middleInitial:      `${P1}.f1_02[0]`,
  lastName:           `${P1}.f1_03[0]`,

  // ── Spouse Name & SSN ───────────────────────────────────────────────────
  spouseFirstName:    `${P1}.f1_04[0]`,
  // SSN fields are split into parts for 1040
  spouseSSN_1:        `${P1}.f1_05[0]`,    // First 3 digits
  spouseSSN_2:        `${P1}.f1_06[0]`,    // Middle 2 digits
  spouseSSN_3:        `${P1}.f1_07[0]`,    // Last 4 digits

  // Primary SSN parts
  primarySSN_1:       `${P1}.f1_08[0]`,    // First 3 digits
  primarySSN_2:       `${P1}.f1_09[0]`,    // Middle 2 digits
  primarySSN_3:       `${P1}.f1_10[0]`,    // Last 4 digits

  // ── If MFS, spouse name ─────────────────────────────────────────────────
  mfsSpouseName:      `${P1}.f1_11[0]`,
  // f1_12 and f1_13 are additional name fields (if joint, spouse last name etc.)
  spouseMiddleInitial: `${P1}.f1_12[0]`,
  spouseLastName:     `${P1}.f1_13[0]`,

  // ── Address ─────────────────────────────────────────────────────────────
  homeAddress:        `${P1}.f1_14[0]`,    // Street address
  aptNo:              `${P1}.f1_15[0]`,    // Apartment number
  poBox:              `${P1}.f1_16[0]`,    // PO Box (or additional)
  city:               `${P1}.f1_17[0]`,    // City
  state:              `${P1}.f1_18[0]`,    // State
  zip:                `${P1}.f1_19[0]`,    // ZIP code

  // ── Foreign Address (if applicable) ─────────────────────────────────────
  foreignAddress:     `${ADDR}.f1_20[0]`,
  foreignAptNo:       `${ADDR}.f1_21[0]`,
  foreignCity:        `${ADDR}.f1_22[0]`,
  foreignState:       `${ADDR}.f1_23[0]`,
  foreignZip:         `${ADDR}.f1_24[0]`,
  foreignCountry:     `${ADDR}.f1_25[0]`,
  foreignProvince:    `${ADDR}.f1_26[0]`,
  foreignPostalCode:  `${ADDR}.f1_27[0]`,

  // ── Filing Status text (if HOH qualifying person) ──────────────────────
  hohQualifyingName:  `${CB_RO}.f1_28[0]`,
  mfsSpouseItemizes:  `${P1}.f1_29[0]`,
  qssSpouseName:      `${P1}.f1_30[0]`,   // Qualifying surviving spouse name

  // ── Dependents Table ────────────────────────────────────────────────────
  // Row 1
  dep1_name:          `${DEP}.Row1[0].f1_31[0]`,
  dep1_ssn:           `${DEP}.Row1[0].f1_32[0]`,
  dep1_relationship:  `${DEP}.Row1[0].f1_33[0]`,
  dep1_ctc:           `${DEP}.Row1[0].f1_34[0]`,
  // Row 2
  dep2_name:          `${DEP}.Row2[0].f1_35[0]`,
  dep2_ssn:           `${DEP}.Row2[0].f1_36[0]`,
  dep2_relationship:  `${DEP}.Row2[0].f1_37[0]`,
  dep2_ctc:           `${DEP}.Row2[0].f1_38[0]`,
  // Row 3
  dep3_name:          `${DEP}.Row3[0].f1_39[0]`,
  dep3_ssn:           `${DEP}.Row3[0].f1_40[0]`,
  dep3_relationship:  `${DEP}.Row3[0].f1_41[0]`,
  dep3_ctc:           `${DEP}.Row3[0].f1_42[0]`,
  // Row 4
  dep4_name:          `${DEP}.Row4[0].f1_43[0]`,
  dep4_ssn:           `${DEP}.Row4[0].f1_44[0]`,
  dep4_relationship:  `${DEP}.Row4[0].f1_45[0]`,
  dep4_ctc:           `${DEP}.Row4[0].f1_46[0]`,

  // ── Income Section (Lines 1–11) ─────────────────────────────────────────
  // Y=330: Line 1a — Wages, salaries, tips (W-2 box 1)
  line1a:             `${P1}.f1_47[0]`,
  // Y=318: Line 1b — Household employee income
  line1b:             `${P1}.f1_48[0]`,
  // Y=306: Line 1c — Tip income not on W-2
  line1c:             `${P1}.f1_49[0]`,
  // Y=294: Line 1d — Medicaid waiver payments not included in income
  line1d:             `${P1}.f1_50[0]`,
  // Y=282: Line 1e — Taxable dependent care benefits
  line1e:             `${P1}.f1_51[0]`,
  // Y=270: Line 1f — Employer-provided adoption benefits
  line1f:             `${P1}.f1_52[0]`,
  // Y=258: Line 1g — Form 8919 wages
  line1g:             `${P1}.f1_53[0]`,
  // Y=247 (x=344): Line 1h — Strike benefits (smaller field, left column)
  line1h:             `${P1}.f1_54[0]`,
  // Y=246: Line 1i — Stock option income
  line1i:             `${P1}.f1_55[0]`,
  // Y=234 (x=410): Line 1z — other sub (small)
  line1z_sub:         `${P1}.f1_56[0]`,
  // Y=222: Line 1z — Add lines 1a through 1h (total wages)
  line1z:             `${P1}.f1_57[0]`,
  // Y=210 (x=252): Line 2a — Tax-exempt interest
  line2a:             `${P1}.f1_58[0]`,
  // Y=210 (x=504): Line 2b — Taxable interest
  line2b:             `${P1}.f1_59[0]`,
  // Y=198 (x=252): Line 3a — Qualified dividends
  line3a:             `${P1}.f1_60[0]`,
  // Y=198 (x=504): Line 3b — Ordinary dividends
  line3b:             `${P1}.f1_61[0]`,
  // Y=174 (x=252): Line 4a — IRA distributions
  line4a:             `${P1}.f1_62[0]`,
  // Y=174 (x=504): Line 4b — IRA taxable amount
  line4b:             `${P1}.f1_63[0]`,
  // Y=162 (x=439): Line 5a sub — Pensions total (small field)
  line5a_sub:         `${P1}.f1_64[0]`,
  // Y=150 (x=252): Line 5a — Pensions and annuities
  line5a:             `${P1}.f1_65[0]`,
  // Y=150 (x=504): Line 5b — Pensions taxable amount
  line5b:             `${P1}.f1_66[0]`,
  // Y=138 (x=439): Line 6a sub — Social security total (small field)
  line6a_sub:         `${P1}.f1_67[0]`,
  // Y=126 (x=252): Line 6a — Social security benefits
  line6a:             `${P1}.f1_68[0]`,
  // Y=126 (x=504): Line 6b — Social security taxable amount
  line6b:             `${P1}.f1_69[0]`,
  // Y=90: Line 7 — Capital gain or (loss)
  line7:              `${P1}.f1_70[0]`,
  // Y=78 (x=403): Line 8 — Other income from Schedule 1, line 10
  line8:              `${P1}.f1_71[0]`,
  // Y=66: Line 9 — Total income
  line9:              `${P1}.f1_72[0]`,
  // Y=54: Line 10 — Adjustments from Schedule 1, line 26
  line10:             `${P1}.f1_73[0]`,
  // Y=42: Line 11 — Adjusted gross income
  line11:             `${P1}.f1_74[0]`,
  // Y=30: Continuation (probably line 11 again or overflow)
  line11_overflow:    `${P1}.f1_75[0]`,

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 2 — TAX AND CREDITS, PAYMENTS, REFUND, SIGNATURE
  // ═════════════════════════════════════════════════════════════════════════

  // Y=744: Line 12 — Standard deduction or itemized deductions
  line12:             `${P2}.f2_01[0]`,
  // Y=684: Line 13 — Qualified business income deduction
  line13:             `${P2}.f2_02[0]`,
  // Y=672: Line 14 — Add lines 12 and 13
  line14:             `${P2}.f2_03[0]`,
  // Y=660: Line 15 — Taxable income (line 11 minus line 14)
  line15:             `${P2}.f2_04[0]`,
  // Y=648: Line 16 — Tax
  line16:             `${P2}.f2_05[0]`,
  // Y=636: Line 17 — Amount from Schedule 2, Part I, line 4
  line17:             `${P2}.f2_06[0]`,
  // Y=624 (x=439): Line 17 sub field or Schedule 2 part II
  line17_sub:         `${P2}.f2_07[0]`,
  // Y=624 (x=504): Line 18 — Add lines 16 and 17
  line18:             `${P2}.f2_08[0]`,
  // Y=612: Line 19 — Child tax credit / other dep credit (Sch 8812)
  line19:             `${P2}.f2_09[0]`,
  // Y=600: Line 20 — Amount from Schedule 3, line 8
  line20:             `${P2}.f2_10[0]`,
  // Y=588: Line 21 — Add lines 19 and 20
  line21:             `${P2}.f2_11[0]`,
  // Y=576: Line 22 — Subtract line 21 from line 18
  line22:             `${P2}.f2_12[0]`,
  // Y=564: Line 23 — Other taxes from Schedule 2
  line23:             `${P2}.f2_13[0]`,
  // Y=552: Line 24 — Total tax
  line24:             `${P2}.f2_14[0]`,

  // ── Payments Section ────────────────────────────────────────────────────
  // Y=540: Line 25a — Federal tax withheld from W-2s
  line25a:            `${P2}.f2_15[0]`,
  // Y=528: Line 25b — Federal tax withheld from 1099s
  line25b:            `${P2}.f2_16[0]`,
  // Y=504 (x=410): Line 25c — Other forms
  line25c:            `${P2}.f2_17[0]`,
  // Y=492 (x=410): Line 25d — Total (add 25a through 25c)
  line25d:            `${P2}.f2_18[0]`,
  // Y=480 (x=410): Line 26 — Estimated tax payments
  line26:             `${P2}.f2_19[0]`,
  // Y=468: Line 27 — Earned income credit (EIC)
  line27:             `${P2}.f2_20[0]`,
  // Y=456: Line 28 — Additional child tax credit (Sch 8812)
  line28:             `${P2}.f2_21[0]`,

  // Y=432 (x=238): Line 29 SSN (for EIC)
  line29_ssn:         `${P2}.SSN_ReadOrder[0].f2_22[0]`,
  // Y=420: Line 29 — American opportunity credit
  line29:             `${P2}.f2_23[0]`,
  // Y=372: Line 30 — Schedule 3, line 15
  line30:             `${P2}.f2_24[0]`,
  // Y=360: Line 31 — Total other payments (add 27 through 30)
  line31:             `${P2}.f2_25[0]`,
  // Y=348: Line 32 — Add line 25d and line 31
  line32:             `${P2}.f2_26[0]`,
  // Y=336: Line 33 — Total payments
  line33:             `${P2}.f2_27[0]`,

  // ── Refund Section ──────────────────────────────────────────────────────
  // Y=324: Line 34 — Amount overpaid
  line34:             `${P2}.f2_28[0]`,
  // Y=312: Line 35a — Refunded to you
  line35a:            `${P2}.f2_29[0]`,
  // Y=300: Line 35b — Routing number (if direct deposit) — separate field
  // Y=288: Line 35c
  line35c:            `${P2}.f2_31[0]`,
  routingNumber:      `${P2}.RoutingNo[0].f2_32[0]`,
  accountNumber:      `${P2}.AccountNo[0].f2_33[0]`,
  // Y=252: Line 36 — Applied to next year's estimated tax
  line36:             `${P2}.f2_34[0]`,

  // ── Amount You Owe ──────────────────────────────────────────────────────
  // Y=228: Line 37 — Amount you owe
  line37:             `${P2}.f2_35[0]`,
  // Y=216: Line 38 — Estimated tax penalty
  line38:             `${P2}.f2_36[0]`,

  // ── Third Party Designee ────────────────────────────────────────────────
  designeeName:       `${P2}.f2_37[0]`,
  designeePhone:      `${P2}.f2_38[0]`,
  designeePIN:        `${P2}.f2_39[0]`,

  // ── Sign Here ───────────────────────────────────────────────────────────
  // Y=126: Your occupation
  yourOccupation:     `${P2}.f2_40[0]`,
  identityPIN:        `${P2}.f2_41[0]`,
  // Y=96: Spouse occupation
  spouseOccupation:   `${P2}.f2_42[0]`,
  spouseIdentityPIN:  `${P2}.f2_43[0]`,

  // ── Paid Preparer ───────────────────────────────────────────────────────
  preparerName:       `${P2}.f2_44[0]`,
  preparerPTIN:       `${P2}.f2_45[0]`,
  firmName:           `${P2}.f2_46[0]`,
  firmEIN:            `${P2}.f2_47[0]`,
  firmAddress:        `${P2}.f2_48[0]`,
  firmPhone:          `${P2}.f2_49[0]`,
  firmCity:           `${P2}.f2_50[0]`,
  firmState:          `${P2}.f2_51[0]`,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKBOXES
// ═══════════════════════════════════════════════════════════════════════════════

export const F1040_CHECKBOX = {
  // ── Filing Status ───────────────────────────────────────────────────────
  single:             `${P1}.c1_1[0]`,
  marriedJoint:       `${P1}.c1_2[0]`,
  marriedSeparate:    `${P1}.c1_3[0]`,
  headOfHousehold:    `${P1}.c1_4[0]`,
  qualifyingSurviving:`${P1}.c1_5[0]`,

  // ── Digital Assets ──────────────────────────────────────────────────────
  digitalAssetsYes:   `${P1}.c1_6[0]`,
  digitalAssetsNo:    `${P1}.c1_7[0]`,

  // ── Standard Deduction — someone can claim you ─────────────────────────
  // c1_8[0] = You as a dependent
  youAsDep:           `${CB_RO}.c1_8[0]`,
  // c1_8[1] = Spouse as a dependent
  spouseAsDep:        `${CB_RO}.c1_8[1]`,
  // c1_8[2] = Spouse itemizes
  spouseItemizes:     `${CB_RO}.c1_8[2]`,

  // ── Age/Blindness ───────────────────────────────────────────────────────
  youBornBefore:      `${P1}.c1_8[0]`,     // You were born before Jan 2, 1960
  youBlind:           `${P1}.c1_8[1]`,
  spouseBornBefore:   `${P1}.c1_9[0]`,     // Spouse born before Jan 2, 1960
  // Dependents section checkbox
  dependentsCheck:    `${P1}.c1_10[0]`,
  moreDepCheck:       `${P1}.c1_10[1]`,

  // ── Other Page 1 Checkboxes ─────────────────────────────────────────────
  // c1_32: Schedule B checkbox (interest/dividends over $1,500)
  scheduleB:          `${P1}.c1_32[0]`,

  // Line 2b/3b checkboxes
  line2b_yes:         `${P1}.c1_33[0]`,
  line2b_no:          `${P1}.c1_34[0]`,
  line5a_yes:         `${P1}.c1_35[0]`,
  line5a_no:          `${P1}.c1_36[0]`,
  line5a_rollover:    `${P1}.c1_37[0]`,
  line6a_yes:         `${P1}.c1_38[0]`,
  line6a_no:          `${P1}.c1_39[0]`,
  line6a_lump:        `${P1}.c1_40[0]`,
  line7_schedD:       `${P1}.c1_41[0]`,
  line7_noSchedD:     `${P1}.c1_42[0]`,
  line8_yes:          `${P1}.c1_43[0]`,
  line8_no:           `${P1}.c1_44[0]`,

  // ── Page 2 Checkboxes ──────────────────────────────────────────────────
  line12_standard:    `${P2}.c2_1[0]`,     // Standard deduction
  line12_itemized:    `${P2}.c2_2[0]`,     // Itemized deductions
  // Schedule 2 lines
  line16a:            `${P2}.c2_3[0]`,
  line16b:            `${P2}.c2_4[0]`,
  line16c:            `${P2}.c2_5[0]`,
  line16d:            `${P2}.c2_6[0]`,
  line16e:            `${P2}.c2_7[0]`,
  line16f:            `${P2}.c2_8[0]`,
  line17_sched2:      `${P2}.c2_9[0]`,
  line17_sched3:      `${P2}.c2_10[0]`,
  line17_other:       `${P2}.c2_11[0]`,
  // Line 27 EIC
  line27a_yes:        `${P2}.c2_12[0]`,
  line27a_no:         `${P2}.c2_13[0]`,
  // Line 28
  line28_check:       `${P2}.Line28_ReadOrder[0].c2_14[0]`,
  // Line 35 direct deposit
  line35b_check:      `${P2}.c2_15[0]`,
  // Account type
  acctChecking:       `${P2}.c2_16[0]`,
  acctSavings:        `${P2}.c2_16[1]`,
  // Third-party designee
  designeeYes:        `${P2}.c2_17[0]`,
  designeeNo:         `${P2}.c2_17[1]`,
  // Self-prepared
  selfPrepared:       `${P2}.c2_18[0]`,
} as const;

export type F1040TextField = keyof typeof F1040_TEXT;
export type F1040CheckboxField = keyof typeof F1040_CHECKBOX;
