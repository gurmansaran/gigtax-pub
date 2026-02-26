/**
 * TaxReturnContext — Central state manager for the File Now wizard.
 * Provides wizard state, navigation, tax calculation, and dual persistence
 * (AsyncStorage for speed + Supabase JSONB for cloud sync).
 */

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuth } from './CtxProvider';
import { TaxReturnState, FinalTaxResult, calculateUnifiedTax } from './unifiedTaxEngine';
import { TaxReturnContextType, TaxReturnStatus, createEmptyTaxReturn } from './types/TaxReturn';
import { WIZARD_SECTIONS } from './wizardSections';

// ─── Constants ───────────────────────────────────────────────────────────────

const TAX_YEAR = 2025;
const ASYNC_KEY_PREFIX = 'tax_return_draft_';
const SUPABASE_DEBOUNCE_MS = 500;
const CALC_DEBOUNCE_MS = 200;

function getAsyncKey(userId: string): string {
  return `${ASYNC_KEY_PREFIX}${TAX_YEAR}_${userId}`;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const TaxReturnContext = createContext<TaxReturnContextType | null>(null);

export function useTaxReturn(): TaxReturnContextType {
  const ctx = useContext(TaxReturnContext);
  if (!ctx) throw new Error('useTaxReturn must be used within TaxReturnProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function TaxReturnProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  // Core state
  const [data, setData] = useState<TaxReturnState>(createEmptyTaxReturn);
  const [result, setResult] = useState<FinalTaxResult | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentSubStep, setCurrentSubStep] = useState(0);
  const [status, setStatus] = useState<TaxReturnStatus>('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Refs for debounce timers
  const supabaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWrite = useRef<Promise<void> | null>(null);
  const returnId = useRef<string | null>(null);

  // ─── Tax Calculation (debounced) ─────────────────────────────────────────

  useEffect(() => {
    if (calcTimer.current) clearTimeout(calcTimer.current);
    calcTimer.current = setTimeout(() => {
      try {
        const taxResult = calculateUnifiedTax(data);
        setResult(taxResult);
      } catch (err) {
        console.error('Tax calculation error:', err);
      }
    }, CALC_DEBOUNCE_MS);

    return () => {
      if (calcTimer.current) clearTimeout(calcTimer.current);
    };
  }, [data]);

  // ─── Persistence: AsyncStorage (immediate) ──────────────────────────────

  const saveToAsync = useCallback(async (state: TaxReturnState, section: number, subStep: number) => {
    if (!userId) return;
    try {
      const payload = JSON.stringify({
        data: state,
        currentSection: section,
        currentSubStep: subStep,
        status,
        updated_at: new Date().toISOString(),
      });
      await AsyncStorage.setItem(getAsyncKey(userId), payload);
    } catch (err) {
      console.error('AsyncStorage save error:', err);
    }
  }, [userId, status]);

  // ─── Persistence: Supabase (debounced) ──────────────────────────────────

  const saveToSupabase = useCallback((state: TaxReturnState, section: number, subStep: number) => {
    if (!userId) return;

    if (supabaseTimer.current) clearTimeout(supabaseTimer.current);
    supabaseTimer.current = setTimeout(() => {
      const writePromise = (async () => {
        try {
          setSaving(true);
          const payload = {
            user_id: userId,
            tax_year: TAX_YEAR,
            status,
            current_section: section,
            current_sub_step: subStep,
            data: state as any,
            result: result as any,
            updated_at: new Date().toISOString(),
          };

          if (returnId.current) {
            // Update existing
            await supabase
              .from('tax_returns')
              .update(payload)
              .eq('id', returnId.current);
          } else {
            // Upsert (insert or update by unique constraint)
            const { data: row } = await supabase
              .from('tax_returns')
              .upsert(payload, { onConflict: 'user_id,tax_year' })
              .select('id')
              .single();
            if (row?.id) returnId.current = row.id;
          }
        } catch (err) {
          console.error('Supabase save error:', err);
        } finally {
          setSaving(false);
          pendingWrite.current = null;
        }
      })();
      pendingWrite.current = writePromise;
    }, SUPABASE_DEBOUNCE_MS);
  }, [userId, status, result]);

  // ─── Combined Save ──────────────────────────────────────────────────────

  const persistState = useCallback((state: TaxReturnState, section: number, subStep: number) => {
    saveToAsync(state, section, subStep);
    saveToSupabase(state, section, subStep);
  }, [saveToAsync, saveToSupabase]);

  // ─── Field Updates ──────────────────────────────────────────────────────

  const updateField = useCallback((field: keyof TaxReturnState, value: any) => {
    setData(prev => {
      const next = { ...prev, [field]: value };
      persistState(next, currentSection, currentSubStep);
      return next;
    });
  }, [persistState, currentSection, currentSubStep]);

  const updateFields = useCallback((updates: Partial<TaxReturnState>) => {
    setData(prev => {
      const next = { ...prev, ...updates };
      persistState(next, currentSection, currentSubStep);
      return next;
    });
  }, [persistState, currentSection, currentSubStep]);

  // ─── Navigation ─────────────────────────────────────────────────────────

  const goToSection = useCallback((section: number, subStep: number = 0) => {
    const clamped = Math.max(0, Math.min(section, WIZARD_SECTIONS.length - 1));
    setCurrentSection(clamped);
    setCurrentSubStep(subStep);
    persistState(data, clamped, subStep);
  }, [data, persistState]);

  const nextSubStep = useCallback(() => {
    const section = WIZARD_SECTIONS[currentSection];
    if (currentSubStep < section.subStepCount - 1) {
      const next = currentSubStep + 1;
      setCurrentSubStep(next);
      persistState(data, currentSection, next);
    }
  }, [currentSection, currentSubStep, data, persistState]);

  const prevSubStep = useCallback(() => {
    if (currentSubStep > 0) {
      const prev = currentSubStep - 1;
      setCurrentSubStep(prev);
      persistState(data, currentSection, prev);
    }
  }, [currentSubStep, data, currentSection, persistState]);

  const nextSection = useCallback(() => {
    if (currentSection < WIZARD_SECTIONS.length - 1) {
      const next = currentSection + 1;
      setCurrentSection(next);
      setCurrentSubStep(0);
      persistState(data, next, 0);
    }
  }, [currentSection, data, persistState]);

  const prevSection = useCallback(() => {
    if (currentSection > 0) {
      const prev = currentSection - 1;
      const lastSubStep = WIZARD_SECTIONS[prev].subStepCount - 1;
      setCurrentSection(prev);
      setCurrentSubStep(lastSubStep);
      persistState(data, prev, lastSubStep);
    }
  }, [currentSection, data, persistState]);

  // ─── Draft Management ───────────────────────────────────────────────────

  const saveDraft = useCallback(async () => {
    // Force immediate save to both stores
    await saveToAsync(data, currentSection, currentSubStep);
    // Flush pending Supabase write
    if (supabaseTimer.current) clearTimeout(supabaseTimer.current);
    if (pendingWrite.current) await pendingWrite.current;
    // Do immediate Supabase write
    if (!userId) return;
    try {
      setSaving(true);
      const payload = {
        user_id: userId,
        tax_year: TAX_YEAR,
        status,
        current_section: currentSection,
        current_sub_step: currentSubStep,
        data: data as any,
        result: result as any,
        updated_at: new Date().toISOString(),
      };
      const { data: row } = await supabase
        .from('tax_returns')
        .upsert(payload, { onConflict: 'user_id,tax_year' })
        .select('id')
        .single();
      if (row?.id) returnId.current = row.id;
    } catch (err) {
      console.error('Force save error:', err);
    } finally {
      setSaving(false);
    }
  }, [data, currentSection, currentSubStep, status, result, userId, saveToAsync]);

  const loadDraft = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      setLoading(false);
      return false;
    }

    try {
      setLoading(true);

      // Try AsyncStorage first (fastest)
      let asyncData: any = null;
      try {
        const raw = await AsyncStorage.getItem(getAsyncKey(userId));
        if (raw) asyncData = JSON.parse(raw);
      } catch {}

      // Try Supabase
      let supabaseData: any = null;
      try {
        const { data: row } = await supabase
          .from('tax_returns')
          .select('*')
          .eq('user_id', userId)
          .eq('tax_year', TAX_YEAR)
          .single();
        if (row) {
          supabaseData = row;
          returnId.current = row.id;
        }
      } catch {}

      // Pick the newer one
      let chosen: any = null;
      if (asyncData && supabaseData) {
        const asyncTime = new Date(asyncData.updated_at || 0).getTime();
        const supaTime = new Date(supabaseData.updated_at || 0).getTime();
        chosen = supaTime >= asyncTime
          ? { data: supabaseData.data, currentSection: supabaseData.current_section, currentSubStep: supabaseData.current_sub_step, status: supabaseData.status }
          : asyncData;
      } else if (supabaseData) {
        chosen = { data: supabaseData.data, currentSection: supabaseData.current_section, currentSubStep: supabaseData.current_sub_step, status: supabaseData.status };
      } else if (asyncData) {
        chosen = asyncData;
      }

      if (chosen?.data) {
        // Merge with defaults to handle missing fields from older drafts
        const merged = { ...createEmptyTaxReturn(), ...chosen.data };
        setData(merged);
        setCurrentSection(chosen.currentSection ?? 0);
        setCurrentSubStep(chosen.currentSubStep ?? 0);
        setStatus((chosen.status as TaxReturnStatus) ?? 'draft');
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (err) {
      console.error('loadDraft error:', err);
      setLoading(false);
      return false;
    }
  }, [userId]);

  const resetReturn = useCallback(() => {
    setData(createEmptyTaxReturn());
    setResult(null);
    setCurrentSection(0);
    setCurrentSubStep(0);
    setStatus('draft');
    returnId.current = null;

    // Clear AsyncStorage
    if (userId) {
      AsyncStorage.removeItem(getAsyncKey(userId)).catch(() => {});
    }

    // Delete from Supabase
    if (userId) {
      supabase
        .from('tax_returns')
        .delete()
        .eq('user_id', userId)
        .eq('tax_year', TAX_YEAR)
        .then(() => {});
    }
  }, [userId]);

  const completeReturn = useCallback(async () => {
    setStatus('completed');
    await saveDraft();
  }, [saveDraft]);

  // ─── Context Value ──────────────────────────────────────────────────────

  const value: TaxReturnContextType = {
    data,
    result,
    currentSection,
    currentSubStep,
    status,
    loading,
    saving,
    updateField,
    updateFields,
    goToSection,
    nextSubStep,
    prevSubStep,
    nextSection,
    prevSection,
    saveDraft,
    loadDraft,
    resetReturn,
    completeReturn,
  };

  return (
    <TaxReturnContext.Provider value={value}>
      {children}
    </TaxReturnContext.Provider>
  );
}
