/**
 * TaxBreakdown — "How We Calculate Everything" Explainer
 *
 * A collapsible, step-by-step breakdown of the entire tax calculation.
 * Runs the tax engine in debug mode and translates the raw debug steps
 * into a human-readable, visually rich walkthrough.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import {
  calculateUnifiedTax,
  getMarginalRate,
  type TaxReturnState,
  type FinalTaxResult,
  type FilingStatus,
} from '@/lib/unifiedTaxEngine';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Tax Brackets (2025) ────────────────────────────────────────────────────
const TAX_BRACKETS: Record<FilingStatus, Array<{ min: number; max: number; rate: number }>> = {
  single: [
    { min: 0, max: 11_925, rate: 0.10 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 626_350, rate: 0.35 },
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { min: 0, max: 23_850, rate: 0.10 },
    { min: 23_850, max: 96_950, rate: 0.12 },
    { min: 96_950, max: 206_700, rate: 0.22 },
    { min: 206_700, max: 394_600, rate: 0.24 },
    { min: 394_600, max: 501_050, rate: 0.32 },
    { min: 501_050, max: 751_600, rate: 0.35 },
    { min: 751_600, max: Infinity, rate: 0.37 },
  ],
  married_separate: [
    { min: 0, max: 11_925, rate: 0.10 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 375_800, rate: 0.35 },
    { min: 375_800, max: Infinity, rate: 0.37 },
  ],
  head_household: [
    { min: 0, max: 17_000, rate: 0.10 },
    { min: 17_000, max: 64_850, rate: 0.12 },
    { min: 64_850, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_500, rate: 0.32 },
    { min: 250_500, max: 626_350, rate: 0.35 },
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
};

const LTCG_BRACKETS: Record<FilingStatus, Array<{ min: number; max: number; rate: number }>> = {
  single: [
    { min: 0, max: 48_350, rate: 0 },
    { min: 48_350, max: 533_400, rate: 0.15 },
    { min: 533_400, max: Infinity, rate: 0.20 },
  ],
  married_joint: [
    { min: 0, max: 96_700, rate: 0 },
    { min: 96_700, max: 600_050, rate: 0.15 },
    { min: 600_050, max: Infinity, rate: 0.20 },
  ],
  married_separate: [
    { min: 0, max: 48_350, rate: 0 },
    { min: 48_350, max: 533_400, rate: 0.15 },
    { min: 533_400, max: Infinity, rate: 0.20 },
  ],
  head_household: [
    { min: 0, max: 64_950, rate: 0 },
    { min: 64_950, max: 551_350, rate: 0.15 },
    { min: 551_350, max: Infinity, rate: 0.20 },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) => '$' + Math.abs(Math.round(n)).toLocaleString();
const pct = (n: number) => (n * 100).toFixed(1) + '%';
const pctInt = (n: number) => Math.round(n * 100) + '%';

const filingStatusLabel = (fs: FilingStatus): string => {
  switch (fs) {
    case 'single': return 'Single';
    case 'married_joint': return 'Married Filing Jointly';
    case 'married_separate': return 'Married Filing Separately';
    case 'head_household': return 'Head of Household';
  }
};

/** Calculate progressive tax with bracket detail for display */
function getBracketBreakdown(
  income: number,
  brackets: Array<{ min: number; max: number; rate: number }>
): Array<{ min: number; max: number; rate: number; taxable: number; tax: number }> {
  const result: Array<{ min: number; max: number; rate: number; taxable: number; tax: number }> = [];
  let remaining = income;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, b.max - b.min);
    const tax = taxable * b.rate;
    result.push({ min: b.min, max: b.max, rate: b.rate, taxable, tax });
    remaining -= taxable;
  }
  return result;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface TaxBreakdownProps {
  data: TaxReturnState;
  result: FinalTaxResult;
}

// ─── Collapsible Section Sub-Component ──────────────────────────────────────

function BreakdownSection({ title, icon, children, colors, defaultOpen = false }: {
  title: string;
  icon: string;
  children: React.ReactNode;
  colors: any;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);
  };

  return (
    <View style={[s.section, { borderColor: colors.border }]}>
      <TouchableOpacity
        style={s.sectionHeader}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <View style={[s.sectionIcon, { backgroundColor: colors.primary + '12' }]}>
          <Feather name={icon as any} size={16} color={colors.primary} />
        </View>
        <Text style={[s.sectionTitle, { color: colors.text }]}>{title}</Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {open && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TaxBreakdown({ data, result }: TaxBreakdownProps) {
  const { colors } = useRobinhoodTheme();

  // Recompute with debug mode to get step-by-step details
  const debugResult = useMemo(() => calculateUnifiedTax(data, true), [data]);
  const debugLog = debugResult.debugLog ?? [];

  // Pull specific debug steps by step key for reference
  const getStep = (stepKey: string) => debugLog.find(s => s.step === stepKey);

  // ── Helpers for rendering ───────────────────────────────────────────────
  const Row = ({ label, value, dim, bold }: { label: string; value: string; dim?: boolean; bold?: boolean }) => (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: dim ? colors.textSecondary : colors.text }, bold && { fontWeight: '600' }]}>{label}</Text>
      <Text style={[s.rowValue, { color: dim ? colors.textSecondary : colors.text }, bold && { fontWeight: '700' }]}>{value}</Text>
    </View>
  );

  const Divider = () => <View style={[s.divider, { backgroundColor: colors.border }]} />;

  const Note = ({ text }: { text: string }) => (
    <View style={[s.noteBox, { backgroundColor: colors.primary + '08' }]}>
      <Feather name="info" size={13} color={colors.primary} style={{ marginTop: 1 }} />
      <Text style={[s.noteText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );

  const Highlight = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <View style={[s.highlight, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
      <Text style={[s.highlightLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[s.highlightValue, { color: colors.primary }]}>{value}</Text>
      {sub ? <Text style={[s.highlightSub, { color: colors.textSecondary }]}>{sub}</Text> : null}
    </View>
  );

  // ── Derived values ──────────────────────────────────────────────────────
  const fs = data.filingStatus;
  const brackets = TAX_BRACKETS[fs];
  const ltcgBrackets = LTCG_BRACKETS[fs];
  const marginalRate = getMarginalRate(result.taxableIncome, fs);

  const w2Total = data.w2Incomes.reduce((s, w) => s + w.wages, 0);
  const income1099Total = data.income1099.reduce((s, i) => s + i.grossAmount, 0);
  const totalTips = data.income1099.reduce((s, i) => s + i.tipPortion, 0);
  const totalBusinessExpenses = (data.businessExpenses ?? 0) + (data.parkingAndTolls ?? 0) + result.vehicleDepreciationDeduction;
  const netBusinessIncome = Math.max(0, income1099Total - totalBusinessExpenses);

  const ordinaryTaxableIncome = Math.max(0, result.taxableIncome - (data.capitalGainsLongTerm ?? 0));
  const ltcgInTaxable = Math.min(data.capitalGainsLongTerm ?? 0, result.taxableIncome);

  const bracketDetail = getBracketBreakdown(ordinaryTaxableIncome, brackets);
  const ltcgDetail = ltcgInTaxable > 0 ? getBracketBreakdown(ltcgInTaxable, ltcgBrackets) : [];

  // SE tax breakdown
  const SE_MULTIPLIER = 0.9235;
  const SS_BASE = 176_100;
  const seBase = netBusinessIncome * SE_MULTIPLIER;
  const remainingSS = Math.max(0, SS_BASE - w2Total);

  return (
    <View style={s.container}>
      {/* ── 1. Filing Status ───────────────────────────────────────────── */}
      <BreakdownSection title="Filing Status" icon="user" colors={colors} defaultOpen>
        <Row label="Status" value={filingStatusLabel(fs)} bold />
        <Row label="State" value={data.stateOfResidence || 'Not specified'} />
        <Row label="Dependents" value={String(data.dependents ?? 0)} />
        <Note text={`Your filing status determines your tax bracket thresholds, standard deduction amount, and eligibility for various credits.`} />
      </BreakdownSection>

      {/* ── 2. Income ──────────────────────────────────────────────────── */}
      <BreakdownSection title="How We Totaled Your Income" icon="dollar-sign" colors={colors}>
        {w2Total > 0 && <Row label="W-2 Wages" value={fmt(w2Total)} />}
        {income1099Total > 0 && <Row label="1099 Gross Income" value={fmt(income1099Total)} />}
        {totalBusinessExpenses > 0 && (
          <>
            <Row label="Business Expenses" value={'-' + fmt(totalBusinessExpenses)} dim />
            <Row label="Net Business Income" value={fmt(netBusinessIncome)} bold />
          </>
        )}
        {(data.capitalGainsShortTerm ?? 0) > 0 && <Row label="Short-Term Capital Gains" value={fmt(data.capitalGainsShortTerm)} />}
        {(data.capitalGainsLongTerm ?? 0) > 0 && <Row label="Long-Term Capital Gains" value={fmt(data.capitalGainsLongTerm)} />}
        {data.spouseIncome > 0 && <Row label="Spouse Income" value={fmt(data.spouseIncome)} />}
        {(data.interestIncome ?? 0) > 0 && <Row label="Interest Income" value={fmt(data.interestIncome!)} />}
        {(data.dividendIncome ?? 0) > 0 && <Row label="Dividend Income" value={fmt(data.dividendIncome!)} />}
        {(data.socialSecurityIncome ?? 0) > 0 && <Row label="Social Security (taxable portion)" value={fmt(result.taxableSocialSecurity)} />}
        {(data.rentalIncome ?? 0) > 0 && <Row label="Rental Income" value={fmt(data.rentalIncome!)} />}
        {(data.unemploymentIncome ?? 0) > 0 && <Row label="Unemployment" value={fmt(data.unemploymentIncome!)} />}
        {totalTips > 0 && <Row label="Tips Reported" value={fmt(totalTips)} dim />}
        <Divider />
        <Highlight label="Gross Income" value={fmt(result.grossIncome)} />
        <Note text="We add up all your income sources. 1099 income is reduced by business expenses to get your net business income. Tips are reported but excluded from your taxable income under the 2025 No Tax on Tips Act." />
      </BreakdownSection>

      {/* ── 3. Above-the-line Deductions & AGI ─────────────────────────── */}
      <BreakdownSection title="Above-the-Line Deductions" icon="minus-circle" colors={colors}>
        <Note text="These deductions reduce your income before calculating AGI. They benefit you regardless of whether you itemize." />
        {result.seTaxDeduction > 0 && <Row label="SE Tax Deduction (50% of SE tax)" value={'-' + fmt(result.seTaxDeduction)} />}
        {result.homeOfficeDeduction > 0 && <Row label="Home Office Deduction" value={'-' + fmt(result.homeOfficeDeduction)} />}
        {result.iraDeduction > 0 && <Row label="IRA Deduction" value={'-' + fmt(result.iraDeduction)} />}
        {result.hsaDeduction > 0 && <Row label="HSA Deduction" value={'-' + fmt(result.hsaDeduction)} />}
        {result.sepIraDeduction > 0 && <Row label="SEP-IRA Deduction" value={'-' + fmt(result.sepIraDeduction)} />}
        {(data.studentLoanInterest ?? 0) > 0 && <Row label="Student Loan Interest" value={'-' + fmt(data.studentLoanInterest)} />}
        {(data.healthInsurancePremiums ?? 0) > 0 && <Row label="Health Insurance (SE)" value={'-' + fmt(data.healthInsurancePremiums)} />}
        <Divider />
        <Highlight label="Adjusted Gross Income (AGI)" value={fmt(result.agi)} sub="Gross income minus above-the-line deductions" />
      </BreakdownSection>

      {/* ── 4. Standard vs Itemized ────────────────────────────────────── */}
      <BreakdownSection title="Your Deduction Method" icon="check-square" colors={colors}>
        <Row label="Standard Deduction" value={fmt(result.standardDeductionAmount)} bold={result.deductionMethod === 'Standard'} />
        <Row label="Itemized Deduction" value={fmt(result.itemizedDeductionAmount)} bold={result.deductionMethod === 'Itemized'} />
        {result.deductionMethod === 'Itemized' && (
          <>
            <Divider />
            {(data.mortgageInterest ?? 0) > 0 && <Row label="  Mortgage Interest" value={fmt(result.mortgageInterestCapped)} dim />}
            {result.mortgageInterestCapped < (data.mortgageInterest ?? 0) && (
              <Note text={`Limited from ${fmt(data.mortgageInterest)} — the IRS caps the deduction at interest on the first $750,000 of mortgage debt.`} />
            )}
            {(data.propertyTaxes ?? 0) > 0 && <Row label="  Property Taxes" value={fmt(data.propertyTaxes)} dim />}
            {(data.charitableDonations ?? 0) > 0 && <Row label="  Charitable Donations" value={fmt(data.charitableDonations)} dim />}
            <Row label="  SALT (capped at $10,000)" value={fmt(result.saltDeduction)} dim />
          </>
        )}
        {result.qbiDeduction > 0 && (
          <>
            <Divider />
            <Row label="QBI Deduction (Sec. 199A)" value={'-' + fmt(result.qbiDeduction)} />
            <Note text="The Qualified Business Income deduction lets you deduct up to 20% of your net business income. It phases out at higher incomes." />
          </>
        )}
        {totalTips > 0 && (
          <>
            <Divider />
            <Row label="Tip Exclusion (No Tax on Tips)" value={'-' + fmt(totalTips)} />
            <Note text="Under the 2025 No Tax on Tips Act, tip income is fully excluded from your taxable income." />
          </>
        )}
        <Divider />
        <Highlight
          label="Taxable Income"
          value={fmt(result.taxableIncome)}
          sub={`AGI ${fmt(result.agi)} - ${result.deductionMethod} ${fmt(result.deductionAmount)}${result.qbiDeduction > 0 ? ` - QBI ${fmt(result.qbiDeduction)}` : ''}${totalTips > 0 ? ` - Tips ${fmt(totalTips)}` : ''}`}
        />
        <Note text={`We chose the ${result.deductionMethod} deduction because it was higher${result.deductionSavings > 0 ? `, saving you an additional ${fmt(result.deductionSavings)}` : ''}.`} />
      </BreakdownSection>

      {/* ── 5. Federal Tax Brackets ────────────────────────────────────── */}
      <BreakdownSection title="Federal Tax Brackets" icon="layers" colors={colors}>
        <Note text={`The U.S. uses progressive tax brackets. Each portion of your income is taxed at a different rate. Your top marginal rate is ${pctInt(marginalRate)}, but your effective rate is much lower.`} />
        <View style={[s.bracketTable, { borderColor: colors.border }]}>
          <View style={[s.bracketHeaderRow, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[s.bracketHeaderText, { color: colors.primary, flex: 2 }]}>Bracket</Text>
            <Text style={[s.bracketHeaderText, { color: colors.primary, flex: 1 }]}>Rate</Text>
            <Text style={[s.bracketHeaderText, { color: colors.primary, flex: 1.2, textAlign: 'right' }]}>Amount</Text>
            <Text style={[s.bracketHeaderText, { color: colors.primary, flex: 1, textAlign: 'right' }]}>Tax</Text>
          </View>
          {bracketDetail.map((b, i) => {
            const isLast = i === bracketDetail.length - 1;
            return (
              <View key={i} style={[s.bracketRow, isLast && { borderBottomWidth: 0 }, { borderColor: colors.border }]}>
                <Text style={[s.bracketCell, { color: colors.textSecondary, flex: 2, fontSize: 11 }]}>
                  {fmt(b.min)} - {b.max === Infinity ? 'up' : fmt(b.max)}
                </Text>
                <Text style={[s.bracketCell, { color: isLast ? colors.primary : colors.text, flex: 1, fontWeight: isLast ? '700' : '400' }]}>
                  {pctInt(b.rate)}
                </Text>
                <Text style={[s.bracketCell, { color: colors.text, flex: 1.2, textAlign: 'right' }]}>
                  {fmt(b.taxable)}
                </Text>
                <Text style={[s.bracketCell, { color: colors.text, flex: 1, textAlign: 'right', fontWeight: '600' }]}>
                  {fmt(b.tax)}
                </Text>
              </View>
            );
          })}
        </View>
        <Highlight
          label="Ordinary Income Tax"
          value={fmt(result.tentativeTax - result.ltcgTax)}
          sub={`Marginal rate: ${pctInt(marginalRate)} | Effective rate: ${ordinaryTaxableIncome > 0 ? pct((result.tentativeTax - result.ltcgTax) / ordinaryTaxableIncome) : '0%'}`}
        />
      </BreakdownSection>

      {/* ── 6. Capital Gains (if applicable) ───────────────────────────── */}
      {result.ltcgTax > 0 && (
        <BreakdownSection title="Capital Gains Tax" icon="trending-up" colors={colors}>
          <Note text="Long-term capital gains are taxed at preferential rates (0%, 15%, or 20%). The brackets are 'stacked' on top of your ordinary income, meaning your ordinary income pushes your gains into higher brackets." />
          <View style={[s.bracketTable, { borderColor: colors.border }]}>
            <View style={[s.bracketHeaderRow, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[s.bracketHeaderText, { color: colors.primary, flex: 2 }]}>Bracket</Text>
              <Text style={[s.bracketHeaderText, { color: colors.primary, flex: 1 }]}>Rate</Text>
              <Text style={[s.bracketHeaderText, { color: colors.primary, flex: 1.2, textAlign: 'right' }]}>Amount</Text>
              <Text style={[s.bracketHeaderText, { color: colors.primary, flex: 1, textAlign: 'right' }]}>Tax</Text>
            </View>
            {ltcgDetail.map((b, i) => (
              <View key={i} style={[s.bracketRow, i === ltcgDetail.length - 1 && { borderBottomWidth: 0 }, { borderColor: colors.border }]}>
                <Text style={[s.bracketCell, { color: colors.textSecondary, flex: 2, fontSize: 11 }]}>
                  {fmt(b.min)} - {b.max === Infinity ? 'up' : fmt(b.max)}
                </Text>
                <Text style={[s.bracketCell, { color: colors.text, flex: 1 }]}>{pctInt(b.rate)}</Text>
                <Text style={[s.bracketCell, { color: colors.text, flex: 1.2, textAlign: 'right' }]}>{fmt(b.taxable)}</Text>
                <Text style={[s.bracketCell, { color: colors.text, flex: 1, textAlign: 'right', fontWeight: '600' }]}>{fmt(b.tax)}</Text>
              </View>
            ))}
          </View>
          <Highlight label="Capital Gains Tax" value={fmt(result.ltcgTax)} />
        </BreakdownSection>
      )}

      {/* ── 7. Self-Employment Tax ─────────────────────────────────────── */}
      {result.seTax > 0 && (
        <BreakdownSection title="Self-Employment Tax" icon="briefcase" colors={colors}>
          <Note text="As a gig worker or self-employed individual, you pay both the employer and employee portions of Social Security (12.4%) and Medicare (2.9%) taxes. The IRS first reduces your net income by 7.65% (the 'SE adjustment')." />
          <Row label="Net Business Income" value={fmt(netBusinessIncome)} />
          <Row label="SE Adjustment (x 92.35%)" value={fmt(seBase)} dim />
          <Divider />
          <Row label="Social Security (12.4%)" value={fmt(Math.min(seBase, remainingSS) * 0.124)} />
          {remainingSS < seBase && <Row label="  SS Wage Base Cap" value={fmt(SS_BASE)} dim />}
          <Row label="Medicare (2.9%)" value={fmt(seBase * 0.029)} />
          {seBase > 200_000 && <Row label="Additional Medicare (0.9%)" value={fmt((seBase - 200_000) * 0.009)} />}
          <Divider />
          <Highlight label="Total SE Tax" value={fmt(result.seTax)} sub={`You can deduct 50% (${fmt(result.seTaxDeduction)}) as an above-the-line deduction`} />
        </BreakdownSection>
      )}

      {/* ── 8. NIIT ────────────────────────────────────────────────────── */}
      {result.niit > 0 && (
        <BreakdownSection title="Net Investment Income Tax" icon="percent" colors={colors}>
          <Note text="The NIIT is a 3.8% surtax on investment income (interest, dividends, capital gains) for high earners." />
          <Row label="Investment Income" value={fmt((data.interestIncome ?? 0) + (data.dividendIncome ?? 0) + (data.capitalGainsShortTerm ?? 0) + (data.capitalGainsLongTerm ?? 0))} />
          <Row label="AGI Threshold" value={fmt(fs === 'married_joint' ? 250_000 : 200_000)} dim />
          <Row label="NIIT (3.8%)" value={fmt(result.niit)} bold />
        </BreakdownSection>
      )}

      {/* ── 9. Credits ─────────────────────────────────────────────────── */}
      {(result.childTaxCredit > 0 || result.educationCredit > 0 || result.eitc > 0 || result.saversCredit > 0 || result.childCareCredit > 0 || result.premiumTaxCredit > 0) && (
        <BreakdownSection title="Tax Credits Applied" icon="award" colors={colors}>
          <Note text="Credits directly reduce your tax bill, dollar for dollar. They are applied after calculating your taxes." />
          {result.childTaxCredit > 0 && <Row label="Child Tax Credit" value={'-' + fmt(result.childTaxCredit)} />}
          {result.educationCredit > 0 && <Row label="Education Credit (AOTC)" value={'-' + fmt(result.educationCredit)} />}
          {result.eitc > 0 && <Row label="Earned Income Tax Credit" value={'-' + fmt(result.eitc)} />}
          {result.saversCredit > 0 && <Row label="Saver's Credit" value={'-' + fmt(result.saversCredit)} />}
          {result.childCareCredit > 0 && <Row label="Child Care Credit" value={'-' + fmt(result.childCareCredit)} />}
          {result.premiumTaxCredit > 0 && <Row label="Premium Tax Credit (ACA)" value={'-' + fmt(result.premiumTaxCredit)} />}
          <Divider />
          <Row
            label="Total Credits"
            value={'-' + fmt(result.childTaxCredit + result.educationCredit + result.eitc + result.saversCredit + result.childCareCredit + result.premiumTaxCredit)}
            bold
          />
        </BreakdownSection>
      )}

      {/* ── 10. State Tax ──────────────────────────────────────────────── */}
      {result.estimatedStateTax > 0 && (
        <BreakdownSection title={`State Tax (${data.stateOfResidence || 'Est.'})`} icon="map-pin" colors={colors}>
          <Note text={`State taxes are calculated separately using ${data.stateOfResidence || 'your state'}'s own brackets, deductions, and rules.`} />
          <Row label="AGI" value={fmt(result.agi)} dim />
          <Row label="State Standard Deduction" value={'-' + fmt(getStep('28')?.inputs?.stateStdDed as number ?? 0)} dim />
          <Row label="State Taxable Income" value={fmt(getStep('28')?.inputs?.stateTaxableIncome as number ?? 0)} />
          <Row label="State Income Tax" value={fmt(getStep('28')?.inputs?.stateIncomeTax as number ?? 0)} bold />
          {result.caSDI > 0 && (
            <>
              <Divider />
              <Row label="CA SDI (1.2% on W-2 wages)" value={fmt(result.caSDI)} />
              <Note text="California State Disability Insurance is a payroll tax applied to W-2 wages, calculated separately from income tax." />
            </>
          )}
          <Divider />
          <Highlight label="Total State Tax" value={fmt(result.estimatedStateTax)} />
        </BreakdownSection>
      )}

      {/* ── 11. The Final Math ─────────────────────────────────────────── */}
      <BreakdownSection title="The Final Math" icon="zap" colors={colors} defaultOpen>
        <Row label="Federal Tax" value={fmt(result.federalTax)} />
        {result.estimatedStateTax > 0 && <Row label="State Tax" value={fmt(result.estimatedStateTax)} />}
        <Row label="Total Tax" value={fmt(result.totalTax)} bold />
        <Divider />
        <Row label="Total Withholding & Payments" value={'-' + fmt(result.totalWithholding)} />
        {data.w2Incomes.reduce((s, w) => s + w.withheld, 0) > 0 && <Row label="  W-2 Withholding" value={fmt(data.w2Incomes.reduce((s, w) => s + w.withheld, 0))} dim />}
        {data.income1099.reduce((s, i) => s + (i.withheld ?? 0), 0) > 0 && <Row label="  1099 Withholding" value={fmt(data.income1099.reduce((s, i) => s + (i.withheld ?? 0), 0))} dim />}
        {(data.spouseWithholding ?? 0) > 0 && <Row label="  Spouse Withholding" value={fmt(data.spouseWithholding)} dim />}
        {(data.estimatedTaxesPaid ?? 0) > 0 && <Row label="  Estimated Tax Payments" value={fmt(data.estimatedTaxesPaid)} dim />}
        <Divider />
        <Highlight
          label={result.finalBillOrRefund > 0 ? 'Amount You Owe' : 'Your Refund'}
          value={fmt(Math.abs(result.finalBillOrRefund))}
          sub={result.finalBillOrRefund > 0
            ? 'Total tax minus what you already paid'
            : 'You overpaid, the IRS owes you this back'}
        />
      </BreakdownSection>

      {/* ── 12. Effective Rates Explained ──────────────────────────────── */}
      <BreakdownSection title="Your Tax Rates Explained" icon="bar-chart-2" colors={colors}>
        <Note text="Your marginal rate is the rate on your next dollar of income. Your effective rate is what you actually paid as a percentage of total income. The effective rate is always lower because of progressive brackets." />
        <Row label="Top Marginal Bracket" value={pctInt(marginalRate)} bold />
        <Row label="Effective Federal Rate" value={pct(result.effectiveFederalRate)} />
        {result.effectiveStateRate > 0 && <Row label="Effective State Rate" value={pct(result.effectiveStateRate)} />}
        <Row label="Effective Combined Rate" value={pct(result.effectiveTotalRate)} bold />
        <Divider />
        <Note text={`Even though your top bracket is ${pctInt(marginalRate)}, you only paid ${pct(result.effectiveTotalRate)} overall because lower portions of your income were taxed at lower rates.`} />
      </BreakdownSection>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    gap: 12,
    marginTop: 8,
  },
  section: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: 13,
    flex: 1,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
  noteBox: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginVertical: 4,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  highlight: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    marginVertical: 4,
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  highlightValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  highlightSub: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  bracketTable: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginVertical: 4,
  },
  bracketHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  bracketHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bracketRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bracketCell: {
    fontSize: 12,
  },
});
