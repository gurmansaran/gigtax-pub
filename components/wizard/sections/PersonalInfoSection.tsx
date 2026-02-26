/**
 * PersonalInfoSection — Wizard Section 0
 * Sub-steps: Profile Confirmation, Filing Status, Spouse Info, Dependents, Age/Blind
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { useTaxReturn } from '@/lib/TaxReturnContext';
import { useTaxProfile } from '@/lib/CtxProvider';
import { formatMMDDYYYY, parseMMDDYYYYToISO } from '@/lib/dateUtils';
import SSNInput from '@/components/tax/SSNInput';
import StateSelector from '@/components/tax/StateSelector';
import { checkReciprocity } from '@/lib/stateTax';
import type { FilingStatus } from '@/lib/unifiedTaxEngine';

// ─── Filing Status Cards ─────────────────────────────────────────────────────

const FILING_OPTIONS: { value: FilingStatus; label: string; desc: string; icon: string }[] = [
  { value: 'single', label: 'Single', desc: 'Unmarried or legally separated', icon: 'user' },
  { value: 'married_joint', label: 'Married Filing Jointly', desc: 'Combined income with spouse', icon: 'users' },
  { value: 'married_separate', label: 'Married Filing Separately', desc: 'Separate returns from spouse', icon: 'user-minus' },
  { value: 'head_household', label: 'Head of Household', desc: 'Unmarried with qualifying dependent', icon: 'home' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PersonalInfoSection() {
  const { colors } = useRobinhoodTheme();
  const { data, updateField, updateFields, currentSubStep } = useTaxReturn();
  const { taxProfile, loading: profileLoading, refreshProfile, updateTaxProfile } = useTaxProfile();

  // Ensure profile is loaded when this section first renders
  useEffect(() => {
    if (currentSubStep === 0 && !taxProfile.firstName && !profileLoading) {
      refreshProfile();
    }
  }, [currentSubStep]);

  // Inline-editable profile fields
  const [editFullName, setEditFullName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editZip, setEditZip] = useState('');
  const [editDob, setEditDob] = useState('');

  // Sync local edit fields when taxProfile loads
  useEffect(() => {
    if (!profileLoading) {
      setEditFullName(taxProfile.fullName || '');
      setEditAddress(taxProfile.address || '');
      setEditCity(taxProfile.city || '');
      setEditState(taxProfile.state || '');
      setEditZip(taxProfile.zip || '');
      if (taxProfile.dateOfBirth) {
        const m = taxProfile.dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        setEditDob(m ? `${m[2]}/${m[3]}/${m[1]}` : taxProfile.dateOfBirth);
      } else {
        setEditDob('');
      }
    }
  }, [profileLoading, taxProfile.fullName, taxProfile.address, taxProfile.dateOfBirth]);

  // Auto-save profile field on blur — updateTaxProfile already debounces DB writes
  const saveProfileField = useCallback((updates: Record<string, string | undefined>) => {
    const mapped: Record<string, any> = {};
    if (updates.fullName !== undefined) {
      const parts = updates.fullName.trim().split(' ');
      mapped.firstName = parts[0] || '';
      mapped.lastName = parts.slice(1).join(' ') || '';
    }
    if (updates.address !== undefined) mapped.address = updates.address.trim();
    if (updates.city !== undefined) mapped.city = updates.city.trim();
    if (updates.state !== undefined) {
      const st = updates.state.trim().toUpperCase().slice(0, 2);
      mapped.state = st;
      if (st && !data.stateOfResidence) updateField('stateOfResidence', st);
    }
    if (updates.zip !== undefined) mapped.zip = updates.zip.trim().replace(/\D/g, '').slice(0, 10);
    if (updates.dob !== undefined) {
      const iso = updates.dob ? parseMMDDYYYYToISO(updates.dob) : '';
      if (iso) mapped.dateOfBirth = iso;
    }
    if (Object.keys(mapped).length > 0) updateTaxProfile(mapped);
  }, [updateTaxProfile, data.stateOfResidence, updateField]);

  // Local state for spouse name/SSN (stored via RPC, not in TaxReturnState)
  const [spouseName, setSpouseName] = useState('');
  const [spouseSSN, setSpouseSSN] = useState('');

  // Local state for dependent editing
  const [depName, setDepName] = useState('');
  const [depDOB, setDepDOB] = useState('');
  const [depRelationship, setDepRelationship] = useState('child');

  const requiresSpouse = data.filingStatus === 'married_joint' || data.filingStatus === 'married_separate';

  const inputStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 14,
  };

  // ─── Helpers ────────────────────────────────────────────────────────────

  const formatDOB = (dob: string): string => {
    if (!dob) return '';
    const match = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
    }
    return dob;
  };

  // ─── Sub-step 0: Profile Confirmation ────────────────────────────────────

  const renderProfileConfirmation = () => {
    const profileComplete = !!taxProfile.firstName && !!taxProfile.state;

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Confirm Your Info</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {profileComplete
            ? 'We pulled this from your profile. Make sure everything looks correct.'
            : 'Fill in your details below to continue.'}
        </Text>

        {profileLoading ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', paddingVertical: 32 }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.cardLabel, { color: colors.textSecondary, marginTop: 8 }]}>Loading profile...</Text>
          </View>
        ) : profileComplete ? (
          <>
            {/* Read-only confirmation card */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardRow}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Name</Text>
                <Text style={[styles.cardValue, { color: colors.text }]}>
                  {taxProfile.fullName}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Address</Text>
                <Text style={[styles.cardValue, { color: colors.text }]} numberOfLines={2}>
                  {taxProfile.address
                    ? `${taxProfile.address}, ${taxProfile.city}, ${taxProfile.state} ${taxProfile.zip}`
                    : 'Not set'}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Date of Birth</Text>
                <Text style={[styles.cardValue, { color: colors.text }]}>
                  {formatDOB(taxProfile.dateOfBirth) || 'Not set'}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Email</Text>
                <Text style={[styles.cardValue, { color: colors.text }]}>
                  {taxProfile.email || 'Not set'}
                </Text>
              </View>
            </View>

            {/* Auto-fill state from profile */}
            {taxProfile.state && !data.stateOfResidence && (
              <TouchableOpacity
                style={[styles.importButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                onPress={() => updateField('stateOfResidence', taxProfile.state)}
              >
                <Feather name="download" size={16} color={colors.primary} />
                <Text style={[styles.importButtonText, { color: colors.primary }]}>
                  Import state ({taxProfile.state}) from profile
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {/* Inline editable form — saves automatically on blur */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 16 }]}>
              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="John Doe"
                  placeholderTextColor={colors.textSecondary}
                  value={editFullName}
                  onChangeText={setEditFullName}
                  onBlur={() => saveProfileField({ fullName: editFullName })}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Street Address</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="123 Main St"
                  placeholderTextColor={colors.textSecondary}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  onBlur={() => saveProfileField({ address: editAddress })}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>City</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="City"
                    placeholderTextColor={colors.textSecondary}
                    value={editCity}
                    onChangeText={setEditCity}
                    onBlur={() => saveProfileField({ city: editCity })}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>State</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="CA"
                    placeholderTextColor={colors.textSecondary}
                    value={editState}
                    onChangeText={(t) => setEditState(t.toUpperCase().slice(0, 2))}
                    onBlur={() => saveProfileField({ state: editState })}
                    autoCapitalize="characters"
                    maxLength={2}
                    returnKeyType="next"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>ZIP</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="90001"
                    placeholderTextColor={colors.textSecondary}
                    value={editZip}
                    onChangeText={setEditZip}
                    onBlur={() => saveProfileField({ zip: editZip })}
                    keyboardType="number-pad"
                    maxLength={10}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Date of Birth</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={colors.textSecondary}
                  value={editDob}
                  onChangeText={(t) => setEditDob(formatMMDDYYYY(t))}
                  onBlur={() => saveProfileField({ dob: editDob })}
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType="done"
                />
              </View>

              {taxProfile.email ? (
                <View>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
                  <View style={[inputStyle, { justifyContent: 'center', opacity: 0.6 }]}>
                    <Text style={{ color: colors.text, fontSize: 16 }}>{taxProfile.email}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>
    );
  };

  // ─── Sub-step 1: Filing Status ───────────────────────────────────────────

  const renderFilingStatus = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Filing Status</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Select how you'll file your return. This affects your tax brackets and standard deduction.
      </Text>

      <View style={styles.filingList}>
        {FILING_OPTIONS.map((option) => {
          const isSelected = data.filingStatus === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filingCard,
                {
                  backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
                },
              ]}
              onPress={() => updateField('filingStatus', option.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.filingIcon, { backgroundColor: isSelected ? colors.primary + '20' : colors.background }]}>
                <Feather name={option.icon as any} size={18} color={isSelected ? colors.primary : colors.textSecondary} />
              </View>
              <View style={styles.filingTextWrap}>
                <Text style={[styles.filingLabel, { color: colors.text }]}>{option.label}</Text>
                <Text style={[styles.filingDesc, { color: colors.textSecondary }]}>{option.desc}</Text>
              </View>
              {isSelected && <Feather name="check-circle" size={20} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* State of Residence */}
      <View style={styles.section}>
        <StateSelector
          label="State of Residence"
          hint="Used for state tax estimation"
          value={data.stateOfResidence}
          onSelect={(code) => updateField('stateOfResidence', code)}
          triggerStyle={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: 12,
            minHeight: 50,
            paddingHorizontal: 16,
          }}
        />
      </View>

      {/* Multi-State */}
      <View style={styles.section}>
        <View style={styles.toggleRow}>
          <Text style={[styles.label, { color: colors.text, flex: 1 }]}>
            Do you or your spouse work in multiple states?
          </Text>
          <Switch
            value={!!data.workState && data.workState !== data.stateOfResidence}
            onValueChange={(v) => {
              if (v) {
                updateField('workState', '');
                updateField('workStateIncomePercent', 50);
              } else {
                updateField('workState', data.stateOfResidence);
                updateField('workStateIncomePercent', 0);
              }
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>

        {!!data.workState && data.workState !== data.stateOfResidence ? (
          <>
            <StateSelector
              label="Work State"
              hint="State where you earn gig income"
              value={data.workState}
              onSelect={(code) => updateField('workState', code)}
              triggerStyle={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: 12,
                minHeight: 50,
                paddingHorizontal: 16,
                marginTop: 8,
              }}
            />

            {data.workState && data.stateOfResidence && (() => {
              const reciprocity = checkReciprocity(data.stateOfResidence, data.workState);

              if (reciprocity.hasReciprocity) {
                // Reciprocal or no-tax → green message, no extra calculation needed
                return (
                  <View style={{
                    marginTop: 10, padding: 12, borderRadius: 10,
                    backgroundColor: '#e8f5e9', borderLeftWidth: 3, borderLeftColor: '#66bb6a',
                  }}>
                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20 }}>
                      ✅ {reciprocity.message}
                    </Text>
                  </View>
                );
              }

              // Non-reciprocal → show income allocation slider
              return (
                <View style={{ marginTop: 10 }}>
                  <View style={{
                    padding: 12, borderRadius: 10,
                    backgroundColor: '#e3f2fd', borderLeftWidth: 3, borderLeftColor: '#42a5f5',
                  }}>
                    <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, fontWeight: '600' }}>
                      📊 Multi-state tax calculation active
                    </Text>
                    <Text style={{ fontSize: 13, color: '#555', lineHeight: 18, marginTop: 4 }}>
                      We'll calculate your nonresident {data.workState} tax and apply a credit to your {data.stateOfResidence} return.
                    </Text>
                  </View>

                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      What % of your gig income was earned in {data.workState}?
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <TouchableOpacity
                        onPress={() => updateField('workStateIncomePercent', Math.max(5, (data.workStateIncomePercent ?? 50) - 5))}
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 18, color: colors.text }}>−</Text>
                      </TouchableOpacity>

                      <View style={{
                        flex: 1, alignItems: 'center', justifyContent: 'center',
                        marginHorizontal: 12, paddingVertical: 8,
                        backgroundColor: colors.surface, borderRadius: 10,
                        borderWidth: 1, borderColor: colors.border,
                      }}>
                        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.primary }}>
                          {data.workStateIncomePercent ?? 50}%
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                          earned in {data.workState}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => updateField('workStateIncomePercent', Math.min(100, (data.workStateIncomePercent ?? 50) + 5))}
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 18, color: colors.text }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })()}
          </>
        ) : (
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            Tax calculated for your residence state only.
          </Text>
        )}
      </View>
    </View>
  );

  // ─── Sub-step 2: Spouse Info ─────────────────────────────────────────────

  const renderSpouseInfo = () => {
    if (!requiresSpouse) {
      return (
        <View style={styles.stepContainer}>
          <Text style={[styles.title, { color: colors.text }]}>Spouse Information</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Feather name="check-circle" size={20} color={colors.primary} />
              <Text style={[styles.cardValue, { color: colors.text }]}>
                Not applicable for {data.filingStatus === 'single' ? 'Single' : 'Head of Household'} filers.
              </Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Spouse Information</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter your spouse's details for your joint filing.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Spouse Full Name</Text>
          <TextInput
            style={inputStyle}
            placeholder="Spouse's full name"
            placeholderTextColor={colors.textSecondary}
            value={spouseName}
            onChangeText={setSpouseName}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        <View style={styles.section}>
          <SSNInput
            label="Spouse Social Security Number"
            value={spouseSSN}
            onChangeText={setSpouseSSN}
            placeholder="123-45-6789"
            maxLength={11}
            containerStyle={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: 12,
              minHeight: 50,
              paddingHorizontal: 16,
            }}
          />
        </View>
      </View>
    );
  };

  // ─── Sub-step 3: Dependents ──────────────────────────────────────────────

  const handleAddDependent = useCallback(() => {
    if (!depName.trim()) {
      Alert.alert('Required', 'Please enter the dependent\'s name.');
      return;
    }

    const currentDetails = data.dependentDetails || [];
    const newDetails = [
      ...currentDetails,
      { dateOfBirth: depDOB || undefined, relationship: depRelationship || 'child' },
    ];

    updateFields({
      dependents: newDetails.length,
      dependentDetails: newDetails,
    });

    setDepName('');
    setDepDOB('');
    setDepRelationship('child');
  }, [depName, depDOB, depRelationship, data.dependentDetails, updateFields]);

  const handleRemoveDependent = useCallback((index: number) => {
    const currentDetails = [...(data.dependentDetails || [])];
    currentDetails.splice(index, 1);
    updateFields({
      dependents: currentDetails.length,
      dependentDetails: currentDetails,
    });
  }, [data.dependentDetails, updateFields]);

  const renderDependents = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Dependents</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Add any qualifying dependents. Each may qualify for up to $2,000 in Child Tax Credit (under 17) or $500 Other Dependent Credit.
      </Text>

      {/* Existing dependents */}
      {(data.dependentDetails || []).map((dep, idx) => (
        <View
          key={idx}
          style={[styles.dependentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.dependentInfo}>
            <Feather name="user" size={16} color={colors.primary} />
            <View>
              <Text style={[styles.dependentName, { color: colors.text }]}>
                Dependent {idx + 1}
              </Text>
              <Text style={[styles.dependentMeta, { color: colors.textSecondary }]}>
                {dep.relationship || 'child'}{dep.dateOfBirth ? ` · DOB: ${dep.dateOfBirth}` : ''}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => handleRemoveDependent(idx)}>
            <Feather name="trash-2" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      ))}

      {/* Add dependent form */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Add Dependent</Text>

        <View style={styles.formField}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
          <TextInput
            style={inputStyle}
            placeholder="Dependent's name"
            placeholderTextColor={colors.textSecondary}
            value={depName}
            onChangeText={setDepName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.formField}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Date of Birth (MM/DD/YYYY)</Text>
          <TextInput
            style={inputStyle}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={colors.textSecondary}
            value={depDOB}
            onChangeText={setDepDOB}
            keyboardType="numeric"
            maxLength={10}
          />
        </View>

        <View style={styles.formField}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Relationship</Text>
          <View style={styles.pillRow}>
            {['child', 'stepchild', 'foster', 'sibling', 'parent', 'other'].map((rel) => (
              <TouchableOpacity
                key={rel}
                style={[
                  styles.pill,
                  {
                    backgroundColor: depRelationship === rel ? colors.primary + '15' : colors.background,
                    borderColor: depRelationship === rel ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setDepRelationship(rel)}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: depRelationship === rel ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {rel.charAt(0).toUpperCase() + rel.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={handleAddDependent}
        >
          <Feather name="plus" size={16} color={colors.background} />
          <Text style={[styles.addButtonText, { color: colors.background }]}>Add Dependent</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.depCount, { color: colors.textSecondary }]}>
        {data.dependents} dependent{data.dependents !== 1 ? 's' : ''} added
      </Text>
    </View>
  );

  // ─── Sub-step 4: Age & Blind ─────────────────────────────────────────────

  const renderAgeBilnd = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Additional Information</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Being 65+ or legally blind increases your standard deduction.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Primary Taxpayer</Text>

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Born before Jan 2, 1961 (65+)</Text>
          <Switch
            value={!!data.primary65Plus}
            onValueChange={(v) => updateField('primary65Plus', v)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Legally blind</Text>
          <Switch
            value={!!data.primaryBlind}
            onValueChange={(v) => updateField('primaryBlind', v)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {requiresSpouse && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Spouse</Text>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Born before Jan 2, 1961 (65+)</Text>
            <Switch
              value={!!data.spouse65Plus}
              onValueChange={(v) => updateField('spouse65Plus', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Legally blind</Text>
            <Switch
              value={!!data.spouseBlind}
              onValueChange={(v) => updateField('spouseBlind', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>
      )}

      {/* FIX #12: Dependent filing status */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Filing Status</Text>

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Can be claimed as someone else's dependent?</Text>
          <Switch
            value={!!data.canBeClaimedAsDependent}
            onValueChange={(v) => updateField('canBeClaimedAsDependent', v)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* FIX #17: Kiddie tax */}
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Subject to kiddie tax?</Text>
          <Switch
            value={!!data.isSubjectToKiddieTax}
            onValueChange={(v) => updateField('isSubjectToKiddieTax', v)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        {data.isSubjectToKiddieTax && (
          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Parent's top marginal tax rate</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: '10%', rate: 0.10 }, { label: '12%', rate: 0.12 },
                { label: '22%', rate: 0.22 }, { label: '24%', rate: 0.24 },
                { label: '32%', rate: 0.32 }, { label: '35%', rate: 0.35 },
                { label: '37%', rate: 0.37 },
              ].map(({ label, rate }) => (
                <TouchableOpacity
                  key={rate}
                  onPress={() => updateField('parentMarginalRate', rate)}
                  style={[
                    styles.optionPill,
                    {
                      borderColor: (data.parentMarginalRate ?? 0) === rate ? colors.primary : colors.border,
                      backgroundColor: (data.parentMarginalRate ?? 0) === rate ? colors.primary + '15' : colors.surface
                    },
                  ]}
                >
                  <Text style={{ color: (data.parentMarginalRate ?? 0) === rate ? colors.primary : colors.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  const steps = [renderProfileConfirmation, renderFilingStatus, renderSpouseInfo, renderDependents, renderAgeBilnd];

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

  section: { marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },

  // Cards
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  cardLabel: { fontSize: 13, fontWeight: '500' },
  cardValue: { fontSize: 15, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  // Warning
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  warningText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Import button
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  importButtonText: { fontSize: 14, fontWeight: '600' },

  // Filing status
  filingList: { gap: 8 },
  filingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  filingIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filingTextWrap: { flex: 1 },
  filingLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  filingDesc: { fontSize: 12, lineHeight: 16 },

  // Toggles
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  toggleLabel: { fontSize: 14, fontWeight: '500', flex: 1, marginRight: 12 },

  // Dependents
  dependentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dependentInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dependentName: { fontSize: 15, fontWeight: '600' },
  dependentMeta: { fontSize: 12 },
  depCount: { fontSize: 13, textAlign: 'center', marginTop: 4 },

  formField: { marginBottom: 12 },

  // Pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: '500' },

  // Add button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  addButtonText: { fontSize: 15, fontWeight: '600' },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
});
