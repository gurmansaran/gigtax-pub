/**
 * ExpensesSection — Wizard Section 2
 * Sub-steps: Business Overview, Vehicle/Mileage, Home Office,
 *            Business Expense Categories, Auto-Import
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Switch, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { useTaxReturn } from '@/lib/TaxReturnContext';
import { useAuth } from '@/lib/CtxProvider';
import { supabase } from '@/lib/supabase';
import { formatMoneyInput, parseMoneyInput } from '@/lib/moneyFormatter';
import { getTrips } from '@/lib/tripStore';
import BlurMoneyInput from '@/components/wizard/BlurMoneyInput';

// ─── Constants ───────────────────────────────────────────────────────────────

const STANDARD_MILEAGE_RATE = 0.70; // 2025 IRS rate
const HOME_OFFICE_SIMPLIFIED_RATE = 5; // $5/sqft
const HOME_OFFICE_MAX_SQFT = 300;

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExpensesSection() {
  const { colors } = useRobinhoodTheme();
  const { data, updateField, updateFields, currentSubStep } = useTaxReturn();
  const { user } = useAuth();

  // Local state for extra business details (stored in JSONB via updateFields)
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('sole_proprietor');
  const [totalMiles, setTotalMiles] = useState(0);
  const [actualVehicleExpenses, setActualVehicleExpenses] = useState(0);
  const [homeOfficeMethod, setHomeOfficeMethod] = useState<'simplified' | 'actual'>(
    data.homeOffice?.method || 'simplified'
  );
  const [homeOfficeSqFt, setHomeOfficeSqFt] = useState(data.homeOffice?.sqFtUsed || 0);

  // Expense categories
  const [phoneInternet, setPhoneInternet] = useState(0);
  const [supplies, setSupplies] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [professionalFees, setProfessionalFees] = useState(0);
  const [otherExpenses, setOtherExpenses] = useState(0);

  // Phone/Internet business use
  const [phoneMonthlyBill, setPhoneMonthlyBill] = useState(data.phoneMonthlyBill ?? 0);
  const [phoneBusinessPercent, setPhoneBusinessPercent] = useState(data.phoneBusinessUsePercent ?? 50);
  const [internetMonthlyBill, setInternetMonthlyBill] = useState(data.internetMonthlyBill ?? 0);
  const [internetBusinessPercent, setInternetBusinessPercent] = useState(data.internetBusinessUsePercent ?? 50);
  const [showPhoneWarning, setShowPhoneWarning] = useState(false);
  const [showInternetWarning, setShowInternetWarning] = useState(false);

  // Additional gig worker expense categories
  const [carWash, setCarWash] = useState(data.carWashExpenses ?? 0);
  const [roadsideAssistance, setRoadsideAssistance] = useState(data.roadsideAssistanceExpenses ?? 0);
  const [backgroundChecks, setBackgroundChecks] = useState(data.backgroundCheckExpenses ?? 0);
  const [workApps, setWorkApps] = useState(data.workAppExpenses ?? 0);
  const [equipment, setEquipment] = useState(data.equipmentExpenses ?? 0);
  const [bankFees, setBankFees] = useState(data.bankFeeExpenses ?? 0);

  // Calculate phone/internet deductions
  const phoneAnnualDeduction = Math.round((phoneMonthlyBill * 12) * (phoneBusinessPercent / 100));
  const internetAnnualDeduction = Math.round((internetMonthlyBill * 12) * (internetBusinessPercent / 100));
  const phoneInternetTotal = phoneAnnualDeduction + internetAnnualDeduction;

  // Business use percentage auto-calculation from miles
  const businessUsePercent = totalMiles > 0 ? Math.round((totalMiles / Math.max(totalMiles, 1)) * 100) : 0;
  const vehicleBusinessPercent = (data.totalMilesDriven ?? 0) > 0 && (data.businessMilesDriven ?? 0) > 0
    ? Math.round(((data.businessMilesDriven ?? 0) / (data.totalMilesDriven ?? 1)) * 100)
    : 0;

  // Auto-calculated mileage comparison — actual expenses multiplied by business use %
  const businessMiles = data.businessMilesDriven ?? totalMiles;
  const mileageDeduction = Math.round(businessMiles * STANDARD_MILEAGE_RATE);
  const actualBusinessDeduction = vehicleBusinessPercent > 0
    ? Math.round(actualVehicleExpenses * (vehicleBusinessPercent / 100))
    : actualVehicleExpenses;
  const autoSelectedMethod: 'standard' | 'actual' = mileageDeduction >= actualBusinessDeduction ? 'standard' : 'actual';
  const bestVehicleDeduction = Math.max(mileageDeduction, actualBusinessDeduction);

  // Auto-import state
  const [importLoading, setImportLoading] = useState(false);
  const [importedExpenses, setImportedExpenses] = useState<{ category: string; total: number }[]>([]);

  // Sync home office to context when changed
  useEffect(() => {
    if (homeOfficeSqFt > 0) {
      updateField('homeOffice', {
        sqFtUsed: Math.min(homeOfficeSqFt, HOME_OFFICE_MAX_SQFT),
        method: homeOfficeMethod,
      });
    } else {
      updateField('homeOffice', null);
    }
  }, [homeOfficeSqFt, homeOfficeMethod]);

  // Sync business expenses total — uses whichever vehicle method yields a higher deduction
  const gigExpensesTotal = carWash + roadsideAssistance + backgroundChecks + workApps + equipment + bankFees;

  // Recalculate total whenever individual values change
  const syncBusinessTotal = useCallback(() => {
    const total = phoneInternetTotal + supplies + insurance + professionalFees + otherExpenses + bestVehicleDeduction + gigExpensesTotal;
    updateField('businessExpenses', Math.round(total));
  }, [phoneInternetTotal, supplies, insurance, professionalFees, otherExpenses, bestVehicleDeduction, gigExpensesTotal]);

  useEffect(() => {
    syncBusinessTotal();
  }, [syncBusinessTotal]);

  // ─── Auto-import state ──────────────────────────────────────────────────
  const [mileageImported, setMileageImported] = useState(false);
  const [trackedMiles, setTrackedMiles] = useState(0);
  const [expensesImported, setExpensesImported] = useState(false);

  // Auto-import mileage from tracked trips when entering Vehicle sub-step
  useEffect(() => {
    if (currentSubStep !== 1 || mileageImported) return;
    (async () => {
      try {
        const trips = await getTrips();
        const currentYear = new Date().getFullYear();
        const yearTrips = trips.filter(t => {
          const d = new Date(t.date);
          return d.getFullYear() === currentYear;
        });
        const totalTracked = Math.round(yearTrips.reduce((sum, t) => sum + (t.miles || 0), 0));
        setTrackedMiles(totalTracked);
        if (totalTracked > 0) {
          // Pre-fill only if fields are currently 0
          if ((data.businessMilesDriven ?? 0) === 0) {
            setTotalMiles(totalTracked);
            updateField('businessMilesDriven', totalTracked);
          }
          if ((data.totalMilesDriven ?? 0) === 0) {
            updateField('totalMilesDriven', totalTracked);
          }
        }
        setMileageImported(true);
      } catch (err) {
        console.error('Auto-import mileage error:', err);
        setMileageImported(true);
      }
    })();
  }, [currentSubStep, mileageImported]);

  // Auto-import expenses from tracked data when entering Categories sub-step
  useEffect(() => {
    if (currentSubStep !== 3 || expensesImported || !user?.id) return;
    (async () => {
      try {
        const year = new Date().getFullYear();
        const { data: expenses } = await supabase
          .from('user_expenses')
          .select('category, amount')
          .eq('user_id', user.id)
          .gte('date', `${year}-01-01`)
          .lte('date', `${year}-12-31`);

        if (expenses && expenses.length > 0) {
          const byCategory: Record<string, number> = {};
          expenses.forEach((e: any) => {
            byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0);
          });

          // Map DB categories to wizard fields — only pre-fill if currently 0
          const mapping: Record<string, (v: number) => void> = {
            'Vehicle - Maintenance': (v) => { if (carWash === 0) { setCarWash(v); updateFields({ carWashExpenses: v }); } },
            'Car Wash': (v) => { if (carWash === 0) { setCarWash(v); updateFields({ carWashExpenses: v }); } },
            'Parking & Tolls': (v) => { if ((data.parkingAndTolls ?? 0) === 0) updateField('parkingAndTolls', Math.round(v)); },
            'Commissions & Fees': (v) => { if (workApps === 0) { setWorkApps(Math.round(v)); updateFields({ workAppExpenses: Math.round(v) }); } },
            'Work Apps': (v) => { if (workApps === 0) { setWorkApps(Math.round(v)); updateFields({ workAppExpenses: Math.round(v) }); } },
            'Equipment': (v) => { if (equipment === 0) { setEquipment(Math.round(v)); updateFields({ equipmentExpenses: Math.round(v) }); } },
            'Bank Fees': (v) => { if (bankFees === 0) { setBankFees(Math.round(v)); updateFields({ bankFeeExpenses: Math.round(v) }); } },
            'Roadside Assistance': (v) => { if (roadsideAssistance === 0) { setRoadsideAssistance(Math.round(v)); updateFields({ roadsideAssistanceExpenses: Math.round(v) }); } },
            'Background Checks': (v) => { if (backgroundChecks === 0) { setBackgroundChecks(Math.round(v)); updateFields({ backgroundCheckExpenses: Math.round(v) }); } },
          };

          Object.entries(byCategory).forEach(([cat, total]) => {
            if (mapping[cat]) mapping[cat](total);
          });

          // Build imported summary for Auto-Import step
          const grouped = Object.entries(byCategory).map(([category, total]) => ({ category, total }));
          setImportedExpenses(grouped);
        }
        setExpensesImported(true);
      } catch (err) {
        console.error('Auto-import expenses error:', err);
        setExpensesImported(true);
      }
    })();
  }, [currentSubStep, expensesImported, user?.id]);

  // ─── Sub-step 0: Business Overview ───────────────────────────────────────

  const renderBusinessOverview = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Business Information</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        If you're self-employed or have gig income, tell us about your business. This is optional.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.formField}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Business Name (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="e.g., John's Driving Services"
            placeholderTextColor={colors.textSecondary}
            value={businessName}
            onChangeText={setBusinessName}
          />
        </View>

        <View style={styles.formField}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Business Type</Text>
          <View style={styles.pillRow}>
            {[
              { key: 'sole_proprietor', label: 'Sole Proprietor' },
              { key: 'llc', label: 'Single-Member LLC' },
              { key: 'other', label: 'Other' },
            ].map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.pill,
                  {
                    backgroundColor: businessType === type.key ? colors.primary + '15' : colors.background,
                    borderColor: businessType === type.key ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setBusinessType(type.key)}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: businessType === type.key ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  // Sync vehicle fields to context
  useEffect(() => {
    updateFields({
      totalMilesDriven: data.totalMilesDriven ?? 0,
      businessMilesDriven: businessMiles,
      actualVehicleExpenses: actualVehicleExpenses,
    });
  }, [totalMiles, actualVehicleExpenses]);

  // ─── Sub-step 1: Vehicle / Mileage (Auto-Compare) ──────────────────────

  const renderVehicle = () => {
    const hasBothInputs = businessMiles > 0 && actualVehicleExpenses > 0;
    const savingsAmount = Math.abs(mileageDeduction - actualBusinessDeduction);

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Vehicle & Mileage</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter both your miles driven and actual expenses — we'll automatically use whichever gives you the bigger deduction.
        </Text>

        {/* Mileage Input */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Standard Mileage Rate</Text>
          <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: 8 }]}>
            IRS 2025 rate: ${STANDARD_MILEAGE_RATE}/mile
          </Text>
          <BlurMoneyInput
            label="Total Miles Driven (All Purposes)"
            value={data.totalMilesDriven ?? 0}
            onSave={(v) => updateField('totalMilesDriven', v)}
            importedHint={trackedMiles > 0 ? `${trackedMiles.toLocaleString()} miles tracked in GigTax` : undefined}
          />
          <BlurMoneyInput
            label="Business Miles Driven"
            value={data.businessMilesDriven ?? totalMiles}
            onSave={(v) => {
              setTotalMiles(v);
              updateField('businessMilesDriven', v);
            }}
            importedHint={trackedMiles > 0 ? `${trackedMiles.toLocaleString()} business miles calculated in GigTax` : undefined}
          />
          {vehicleBusinessPercent > 0 && (
            <View style={[styles.resultRow, { backgroundColor: colors.background }]}>
              <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Business Use %</Text>
              <Text style={[styles.resultValue, { color: colors.text }]}>{vehicleBusinessPercent}%</Text>
            </View>
          )}
          {mileageDeduction > 0 && (
            <View style={[styles.resultRow, { backgroundColor: autoSelectedMethod === 'standard' ? colors.primary + '10' : colors.background }]}>
              <Text style={[styles.resultLabel, { color: colors.text }]}>Mileage Deduction</Text>
              <Text style={[styles.resultValue, { color: autoSelectedMethod === 'standard' ? colors.primary : colors.textSecondary }]}>
                ${mileageDeduction.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Actual Expenses Input */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Actual Vehicle Expenses</Text>
          <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: 8 }]}>
            Gas, repairs, insurance, depreciation, etc. We'll apply your business use percentage ({vehicleBusinessPercent || '—'}%) automatically.
          </Text>
          <BlurMoneyInput
            label="Total Actual Vehicle Expenses (Before Business %)"
            value={actualVehicleExpenses}
            onSave={(n) => {
              setActualVehicleExpenses(n);
              updateField('actualVehicleExpenses', n);
            }}
          />
          {actualVehicleExpenses > 0 && vehicleBusinessPercent > 0 && (
            <View style={[styles.resultRow, { backgroundColor: autoSelectedMethod === 'actual' ? colors.primary + '10' : colors.background }]}>
              <Text style={[styles.resultLabel, { color: colors.text }]}>Actual Deduction ({vehicleBusinessPercent}%)</Text>
              <Text style={[styles.resultValue, { color: autoSelectedMethod === 'actual' ? colors.primary : colors.textSecondary }]}>
                ${actualBusinessDeduction.toLocaleString()}
              </Text>
            </View>
          )}
          {actualVehicleExpenses > 0 && vehicleBusinessPercent === 0 && (
            <View style={[styles.resultRow, { backgroundColor: colors.warning + '10' }]}>
              <Text style={[styles.resultLabel, { color: colors.warning }]}>Enter total & business miles above to calculate business use %</Text>
            </View>
          )}
        </View>

        {/* Auto-Comparison Result */}
        {hasBothInputs && (
          <View style={[styles.card, {
            backgroundColor: colors.primary + '08',
            borderColor: colors.primary,
            borderWidth: 1.5,
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Feather name="check-circle" size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.primary, marginBottom: 0 }]}>
                {autoSelectedMethod === 'standard' ? 'Standard Mileage' : 'Actual Expenses'} Selected
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              {autoSelectedMethod === 'standard'
                ? `Standard mileage ($${mileageDeduction.toLocaleString()}) saves you $${savingsAmount.toLocaleString()} more than actual expenses.`
                : `Actual expenses ($${actualBusinessDeduction.toLocaleString()}) saves you $${savingsAmount.toLocaleString()} more than standard mileage.`}
            </Text>
            <View style={[styles.resultRow, { backgroundColor: colors.primary + '15', marginTop: 8 }]}>
              <Text style={[styles.resultLabel, { color: colors.text, fontWeight: '700' }]}>Vehicle Deduction Used</Text>
              <Text style={[styles.resultValue, { color: colors.primary }]}>${bestVehicleDeduction.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Show single-method result if only one is entered */}
        {!hasBothInputs && bestVehicleDeduction > 0 && (
          <View style={[styles.card, { backgroundColor: colors.primary + '08', borderColor: colors.primary }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 13, flex: 1 }}>
                Enter both miles and actual expenses to see which method saves you more.
              </Text>
            </View>
          </View>
        )}

        {/* Parking & Tolls */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BlurMoneyInput
            label="Parking & Tolls"
            value={data.parkingAndTolls}
            onSave={(n) => updateField('parkingAndTolls', n)}
            hint="Business-related parking and toll expenses (always 100% deductible)"
          />
        </View>
      </View>
    );
  };

  // ─── Sub-step 2: Home Office ─────────────────────────────────────────────

  const renderHomeOffice = () => {
    const homeOfficeDeduction = homeOfficeMethod === 'simplified'
      ? Math.min(homeOfficeSqFt, HOME_OFFICE_MAX_SQFT) * HOME_OFFICE_SIMPLIFIED_RATE
      : 0;

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Home Office</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          If you use part of your home exclusively for business, you may qualify for a deduction.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>I have a home office</Text>
            <Switch
              value={homeOfficeSqFt > 0}
              onValueChange={(v) => {
                if (!v) {
                  setHomeOfficeSqFt(0);
                  updateField('homeOffice', null);
                } else {
                  setHomeOfficeSqFt(100);
                }
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {homeOfficeSqFt > 0 && (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Method</Text>
              {(['simplified', 'actual'] as const).map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.methodCard,
                    {
                      backgroundColor: homeOfficeMethod === method ? colors.primary + '10' : colors.background,
                      borderColor: homeOfficeMethod === method ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setHomeOfficeMethod(method)}
                >
                  <View style={styles.methodRow}>
                    <View style={[styles.radio, { borderColor: homeOfficeMethod === method ? colors.primary : colors.border }]}>
                      {homeOfficeMethod === method && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.methodLabel, { color: colors.text }]}>
                        {method === 'simplified' ? `Simplified ($${HOME_OFFICE_SIMPLIFIED_RATE}/sqft, max ${HOME_OFFICE_MAX_SQFT})` : 'Actual Expenses'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.formField}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Square Footage Used for Business</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  value={homeOfficeSqFt > 0 ? homeOfficeSqFt.toString() : ''}
                  onChangeText={(text) => setHomeOfficeSqFt(parseInt(text) || 0)}
                  keyboardType="numeric"
                />
              </View>
              {homeOfficeMethod === 'simplified' && homeOfficeDeduction > 0 && (
                <View style={[styles.resultRow, { backgroundColor: colors.primary + '10' }]}>
                  <Text style={[styles.resultLabel, { color: colors.text }]}>Home Office Deduction</Text>
                  <Text style={[styles.resultValue, { color: colors.primary }]}>${homeOfficeDeduction.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  // ─── Sub-step 3: Expense Categories ──────────────────────────────────────

  const renderCategories = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Business Expenses</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Enter deductible business expenses by category.
      </Text>

      {/* Phone Business Use */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Phone / Cellular</Text>
        <BlurMoneyInput label="Monthly Phone Bill" value={phoneMonthlyBill} onSave={(v) => { setPhoneMonthlyBill(v); updateFields({ phoneMonthlyBill: v }); }} hint="Your total monthly phone/cellular bill" />
        <View style={styles.formField}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Business Use Percentage</Text>
          <View style={styles.percentRow}>
            <TextInput
              style={[styles.input, styles.percentInput, { backgroundColor: colors.background, color: colors.text, borderColor: showPhoneWarning ? colors.warning : colors.border }]}
              placeholder="50"
              placeholderTextColor={colors.textSecondary}
              value={phoneBusinessPercent > 0 ? phoneBusinessPercent.toString() : ''}
              onChangeText={(text) => {
                const pct = Math.min(100, Math.max(0, parseInt(text) || 0));
                setPhoneBusinessPercent(pct);
                setShowPhoneWarning(pct > 80);
                updateFields({ phoneBusinessUsePercent: pct });
              }}
              keyboardType="numeric"
            />
            <Text style={[styles.percentSign, { color: colors.text }]}>%</Text>
          </View>
          {showPhoneWarning && (
            <Text style={[styles.warningText, { color: colors.warning }]}>
              IRS may scrutinize business use above 80%. Ensure you can document this percentage.
            </Text>
          )}
        </View>
        {phoneAnnualDeduction > 0 && (
          <View style={[styles.resultRow, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.resultLabel, { color: colors.text }]}>Annual Phone Deduction</Text>
            <Text style={[styles.resultValue, { color: colors.primary }]}>${phoneAnnualDeduction.toLocaleString()}</Text>
          </View>
        )}
      </View>

      {/* Internet Business Use */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Internet / Data</Text>
        <BlurMoneyInput label="Monthly Internet Bill" value={internetMonthlyBill} onSave={(v) => { setInternetMonthlyBill(v); updateFields({ internetMonthlyBill: v }); }} hint="Your total monthly internet/data bill" />
        <View style={styles.formField}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Business Use Percentage</Text>
          <View style={styles.percentRow}>
            <TextInput
              style={[styles.input, styles.percentInput, { backgroundColor: colors.background, color: colors.text, borderColor: showInternetWarning ? colors.warning : colors.border }]}
              placeholder="50"
              placeholderTextColor={colors.textSecondary}
              value={internetBusinessPercent > 0 ? internetBusinessPercent.toString() : ''}
              onChangeText={(text) => {
                const pct = Math.min(100, Math.max(0, parseInt(text) || 0));
                setInternetBusinessPercent(pct);
                setShowInternetWarning(pct > 80);
                updateFields({ internetBusinessUsePercent: pct });
              }}
              keyboardType="numeric"
            />
            <Text style={[styles.percentSign, { color: colors.text }]}>%</Text>
          </View>
          {showInternetWarning && (
            <Text style={[styles.warningText, { color: colors.warning }]}>
              IRS may scrutinize business use above 80%. Ensure you can document this percentage.
            </Text>
          )}
        </View>
        {internetAnnualDeduction > 0 && (
          <View style={[styles.resultRow, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.resultLabel, { color: colors.text }]}>Annual Internet Deduction</Text>
            <Text style={[styles.resultValue, { color: colors.primary }]}>${internetAnnualDeduction.toLocaleString()}</Text>
          </View>
        )}
      </View>

      {/* Gig Worker Specific Expenses */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Gig Worker Expenses</Text>
        <BlurMoneyInput label="Car Wash / Detailing" value={carWash} onSave={(v) => { setCarWash(v); updateFields({ carWashExpenses: v }); }} hint="Vehicle cleaning for rideshare/delivery" importedHint={expensesImported && carWash > 0 ? 'Imported from GigTax' : undefined} />
        <BlurMoneyInput label="Roadside Assistance (AAA, etc.)" value={roadsideAssistance} onSave={(v) => { setRoadsideAssistance(v); updateFields({ roadsideAssistanceExpenses: v }); }} importedHint={expensesImported && roadsideAssistance > 0 ? 'Imported from GigTax' : undefined} />
        <BlurMoneyInput label="Background Check Fees" value={backgroundChecks} onSave={(v) => { setBackgroundChecks(v); updateFields({ backgroundCheckExpenses: v }); }} hint="Required by gig platforms" importedHint={expensesImported && backgroundChecks > 0 ? 'Imported from GigTax' : undefined} />
        <BlurMoneyInput label="Work Apps & Subscriptions" value={workApps} onSave={(v) => { setWorkApps(v); updateFields({ workAppExpenses: v }); }} hint="Para, Gridwise, Mystro, Stride, etc." importedHint={expensesImported && workApps > 0 ? 'Imported from GigTax' : undefined} />
        <BlurMoneyInput label="Equipment" value={equipment} onSave={(v) => { setEquipment(v); updateFields({ equipmentExpenses: v }); }} hint="Phone mounts, dash cams, insulated bags, etc." importedHint={expensesImported && equipment > 0 ? 'Imported from GigTax' : undefined} />
        <BlurMoneyInput label="Bank / Payment Processing Fees" value={bankFees} onSave={(v) => { setBankFees(v); updateFields({ bankFeeExpenses: v }); }} hint="Instant cashout fees, transfer fees" importedHint={expensesImported && bankFees > 0 ? 'Imported from GigTax' : undefined} />
      </View>

      {/* Other Expense Categories */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Other Expenses</Text>
        <BlurMoneyInput label="Office Supplies" value={supplies} onSave={setSupplies} />
        <BlurMoneyInput label="Business Insurance" value={insurance} onSave={setInsurance} />
        <BlurMoneyInput label="Professional Fees" value={professionalFees} onSave={setProfessionalFees} hint="Legal, accounting, tax prep" />
        <BlurMoneyInput label="Other Business Expenses" value={otherExpenses} onSave={setOtherExpenses} />
      </View>

      {data.businessExpenses > 0 && (
        <View style={[styles.resultRow, { backgroundColor: colors.primary + '10' }]}>
          <Text style={[styles.resultLabel, { color: colors.text }]}>Total Business Expenses</Text>
          <Text style={[styles.resultValue, { color: colors.primary }]}>${data.businessExpenses.toLocaleString()}</Text>
        </View>
      )}
    </View>
  );

  // ─── Sub-step 4: Auto-Import Summary ────────────────────────────────────

  // Auto-run import when reaching this step
  useEffect(() => {
    if (currentSubStep !== 4 || !user?.id) return;
    if (importedExpenses.length > 0) return; // Already loaded
    (async () => {
      setImportLoading(true);
      try {
        const year = new Date().getFullYear();
        const { data: expenses } = await supabase
          .from('user_expenses')
          .select('category, amount')
          .eq('user_id', user.id)
          .gte('date', `${year}-01-01`)
          .lte('date', `${year}-12-31`);

        if (expenses && expenses.length > 0) {
          const byCategory: Record<string, number> = {};
          expenses.forEach((e: any) => {
            byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0);
          });
          const grouped = Object.entries(byCategory).map(([category, total]) => ({ category, total }));
          setImportedExpenses(grouped);
        } else {
          setImportedExpenses([]);
        }
      } catch (err) {
        console.error('Import expenses error:', err);
      } finally {
        setImportLoading(false);
      }
    })();
  }, [currentSubStep, user?.id]);

  const renderAutoImport = () => {
    const hasImportedData = trackedMiles > 0 || importedExpenses.length > 0;

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Import Summary</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {hasImportedData
            ? "Here's what we pulled from your GigTax data. Everything look right? Go back to adjust, or continue."
            : 'Review your expense data before continuing.'}
        </Text>

        {importLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your tracked data...</Text>
          </View>
        )}

        {/* Mileage Summary */}
        {trackedMiles > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Feather name="navigation" size={16} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Mileage</Text>
            </View>
            <View style={styles.importRow}>
              <Text style={[styles.importCategory, { color: colors.text }]}>Business Miles Tracked</Text>
              <Text style={[styles.importAmount, { color: colors.primary }]}>{(data.businessMilesDriven ?? 0).toLocaleString()}</Text>
            </View>
            <View style={styles.importRow}>
              <Text style={[styles.importCategory, { color: colors.text }]}>Mileage Deduction</Text>
              <Text style={[styles.importAmount, { color: colors.primary }]}>${mileageDeduction.toLocaleString()}</Text>
            </View>
            <Text style={[styles.importedHintText, { color: colors.primary }]}>
              Calculated from {trackedMiles.toLocaleString()} miles tracked in GigTax
            </Text>
          </View>
        )}

        {/* Expense Categories Summary */}
        {importedExpenses.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Feather name="file-text" size={16} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Tracked Expenses</Text>
            </View>
            {importedExpenses.map((exp, idx) => (
              <View key={idx} style={styles.importRow}>
                <Text style={[styles.importCategory, { color: colors.text }]}>{exp.category}</Text>
                <Text style={[styles.importAmount, { color: colors.primary }]}>${Math.round(exp.total).toLocaleString()}</Text>
              </View>
            ))}
            <View style={[styles.importRow, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }]}>
              <Text style={[styles.importCategory, { color: colors.text, fontWeight: '700' }]}>Total Tracked</Text>
              <Text style={[styles.importAmount, { color: colors.primary, fontWeight: '700' }]}>
                ${importedExpenses.reduce((sum, e) => sum + Math.round(e.total), 0).toLocaleString()}
              </Text>
            </View>
            <Text style={[styles.importedHintText, { color: colors.primary }]}>
              Imported from GigTax expense tracker
            </Text>
          </View>
        )}

        {/* Phone / Internet Summary */}
        {(phoneMonthlyBill > 0 || internetMonthlyBill > 0) && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Feather name="phone" size={16} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Phone & Internet</Text>
            </View>
            {phoneMonthlyBill > 0 && (
              <View style={styles.importRow}>
                <Text style={[styles.importCategory, { color: colors.text }]}>Phone (${phoneMonthlyBill}/mo at {phoneBusinessPercent}%)</Text>
                <Text style={[styles.importAmount, { color: colors.primary }]}>${phoneAnnualDeduction.toLocaleString()}/yr</Text>
              </View>
            )}
            {internetMonthlyBill > 0 && (
              <View style={styles.importRow}>
                <Text style={[styles.importCategory, { color: colors.text }]}>Internet (${internetMonthlyBill}/mo at {internetBusinessPercent}%)</Text>
                <Text style={[styles.importAmount, { color: colors.primary }]}>${internetAnnualDeduction.toLocaleString()}/yr</Text>
              </View>
            )}
          </View>
        )}

        {/* Total Business Expenses */}
        {data.businessExpenses > 0 && (
          <View style={[styles.card, {
            backgroundColor: colors.primary + '08',
            borderColor: colors.primary,
            borderWidth: 1.5,
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="check-circle" size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.primary, marginBottom: 0 }]}>Total Business Expenses</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary, marginTop: 8 }}>
              ${data.businessExpenses.toLocaleString()}
            </Text>
          </View>
        )}

        {!hasImportedData && !importLoading && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>
              No tracked data found. You can go back to manually enter expenses, or continue.
            </Text>
          </View>
        )}

        <View style={[styles.noteCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
          <Feather name="edit-3" size={14} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.primary }]}>
            All imported values are editable. Go back to any section to adjust.
          </Text>
        </View>
      </View>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const steps = [
    renderBusinessOverview,
    renderVehicle,
    renderHomeOffice,
    renderCategories,
    renderAutoImport,
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {steps[currentSubStep]?.() ?? steps[0]()}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  stepContainer: { gap: 16 },

  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 12, marginBottom: 4, fontStyle: 'italic' },

  formField: { marginBottom: 16 },

  input: {
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },

  // Cards
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8 },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: { fontSize: 15, fontWeight: '500', flex: 1, marginRight: 12 },

  // Pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: '500' },

  // Method cards
  methodCard: {
    borderRadius: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodLabel: { fontSize: 14, fontWeight: '600' },
  methodDesc: { fontSize: 12, marginTop: 2 },

  // Radio
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Result row
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    padding: 14,
  },
  resultLabel: { fontSize: 14, fontWeight: '500' },
  resultValue: { fontSize: 18, fontWeight: '700' },

  // Import
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  importButtonText: { fontSize: 16, fontWeight: '600' },

  importRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  importCategory: { fontSize: 14 },
  importAmount: { fontSize: 14, fontWeight: '600' },

  skipText: { fontSize: 14, lineHeight: 20 },

  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 12 },
  loadingText: { fontSize: 14 },

  // Note card
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 14, borderWidth: 1, gap: 10 },
  noteText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Imported hint
  importedHintText: { fontSize: 11, fontWeight: '600', marginTop: 8 },

  // Percent input
  percentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentInput: {
    width: 80,
  },
  percentSign: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
