import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { addExpense, getExpenses, deleteExpense, type Expense } from '@/lib/expenseStore';
import { pickReceiptImage, takeReceiptPhoto, uploadReceiptImage } from '@/lib/receiptStore';
import { useAuth } from '@/lib/CtxProvider';
import { useRobinhoodTheme } from '@/hooks/use-robinhood-theme';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import BankLinkButton from '@/components/BankLinkButton';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import KeyboardDoneButton from '@/components/KeyboardDoneButton';
import { formatMMDDYYYY, parseMMDDYYYYToISO, isoToMMDDYYYY } from '@/lib/dateUtils';
import { ExpensesSkeleton } from '@/components/ui/Skeletons';


const API_URL = 'https://ztlonstelcxprhtaasch.supabase.co/functions/v1/analyze-receipt';

const CATEGORIES: Array<{ key: Expense['category']; icon: string; label: string }> = [
  { key: 'Supplies', icon: 'package', label: 'Supplies' },
  { key: 'Utilities', icon: 'smartphone', label: 'Utilities' },
  { key: 'Meals', icon: 'coffee', label: 'Meals' },
  { key: 'Repairs', icon: 'tool', label: 'Repairs' },
  { key: 'Legal', icon: 'briefcase', label: 'Legal' },
  { key: 'Insurance', icon: 'shield', label: 'Insurance' },
  { key: 'Gas', icon: 'truck', label: 'Gas' },
  { key: 'Other', icon: 'dollar-sign', label: 'Other' },
];

interface ScannedTransaction {
  id: string;
  date: string;
  name: string;
  amount: number;
  category?: string;
  smartCategory?: string;
  deductibleAmount?: number;
}

export default function ExpensesScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useRobinhoodTheme();
  const doneAccessoryId = 'expenses-done';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Expense['category']>('Supplies');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => isoToMMDDYYYY(new Date().toISOString().split('T')[0]));
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  const [editingExpense, setEditingExpense] = useState<(Expense & { dbCategory?: string }) | null>(null);

  // Plaid state
  const [isBankConnected, setIsBankConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const loadExpenses = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch from database (primary source)
      const { data: dbExpenses, error } = await supabase
        .from('user_expenses')
        .select('id, amount, merchant, date, category, deductible_amount')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error loading database expenses:', error);
        // Fallback to AsyncStorage
        const loadedExpenses = await getExpenses();
        setExpenses(loadedExpenses);
        const total = loadedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        setTotalExpenses(total);
      } else {
        // Store database expenses — use deductible_amount as displayed amount
        const expensesList = (dbExpenses || []).map((dbExp: any) => {
          const rawAmount = parseFloat(dbExp.amount?.toString() || '0');
          const deductible = parseFloat(dbExp.deductible_amount?.toString() || '0');
          return {
            id: dbExp.id,
            category: mapDbCategoryToExpenseCategory(dbExp.category),
            dbCategory: dbExp.category, // Keep original for display
            amount: deductible > 0 ? deductible : rawAmount, // Show write-off amount
            originalAmount: rawAmount, // Keep original for edit modal
            date: dbExp.date,
            description: dbExp.merchant || 'Expense',
            fromBankTransaction: true,
          };
        });

        setExpenses(expensesList as any);

        // Calculate total from deductible amounts
        const deductibleTotal = dbExpenses?.reduce((sum, exp) => sum + (parseFloat(exp.deductible_amount?.toString() || '0') || 0), 0) || 0;
        setTotalExpenses(deductibleTotal);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  // Map database category to Expense category type
  const mapDbCategoryToExpenseCategory = (dbCategory: string): Expense['category'] => {
    const categoryMap: Record<string, Expense['category']> = {
      'Business Meals': 'Meals',
      'Vehicle - Gas': 'Gas',
      'Vehicle - Maintenance': 'Repairs',
      'Commissions & Fees': 'Other',
      'Phone & Internet': 'Utilities',
      'Uncategorized': 'Other',
    };
    return categoryMap[dbCategory] || 'Other';
  };

  // Map Expense category to database category
  const mapCategoryToDbCategory = (category: Expense['category']): string => {
    const categoryMap: Record<Expense['category'], string> = {
      'Meals': 'Business Meals',
      'Gas': 'Vehicle - Gas',
      'Repairs': 'Vehicle - Maintenance',
      'Supplies': 'Uncategorized',
      'Utilities': 'Phone & Internet',
      'Legal': 'Uncategorized',
      'Insurance': 'Uncategorized',
      'Other': 'Uncategorized',
      'Car Wash': 'Vehicle - Maintenance',
      'Roadside Assistance': 'Uncategorized',
      'Background Checks': 'Uncategorized',
      'Work Apps': 'Uncategorized',
      'Equipment': 'Uncategorized',
      'Bank Fees': 'Uncategorized',
    };
    return categoryMap[category] || 'Uncategorized';
  };

  // Get category display name from database category
  const getCategoryDisplayName = (dbCategory: string): string => {
    return dbCategory || 'Uncategorized';
  };

  // Get icon name for category
  const getCategoryIcon = (category: Expense['category']): string => {
    const iconMap: Record<Expense['category'], string> = {
      'Meals': 'coffee',
      'Gas': 'truck',
      'Repairs': 'tool',
      'Supplies': 'package',
      'Utilities': 'zap',
      'Legal': 'briefcase',
      'Insurance': 'shield',
      'Other': 'dollar-sign',
      'Car Wash': 'droplet',
      'Roadside Assistance': 'life-buoy',
      'Background Checks': 'user-check',
      'Work Apps': 'smartphone',
      'Equipment': 'camera',
      'Bank Fees': 'credit-card',
    };
    return iconMap[category] || 'dollar-sign';
  };

  // Check if bank is connected
  const checkBankConnection = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_bank_accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      setIsBankConnected(!error && !!data);
    } catch (error) {
      console.error('Error checking bank connection:', error);
      setIsBankConnected(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
      checkBankConnection();
    }, [loadExpenses, checkBankConnection])
  );

  const handleSaveExpense = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }

    const dateIso = parseMMDDYYYYToISO(date);
    if (!dateIso) {
      Alert.alert('Invalid Date', 'Please enter a valid date (MM/DD/YYYY).');
      return;
    }

    try {
      // Check for duplicates (exact amount and date match), skip when editing same expense
      let query = supabase
        .from('user_expenses')
        .select('id, amount, date, merchant')
        .eq('user_id', user.id)
        .eq('amount', amountNum.toString())
        .eq('date', dateIso)
        .limit(1);
      if (editingExpense) {
        query = query.neq('id', editingExpense.id);
      }
      const { data: existing, error: checkError } = await query.maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        const shouldContinue = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Duplicate Warning',
            `We found a matching expense for $${amountNum.toFixed(2)} on ${dateIso}. Save anyway?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Save Anyway', onPress: () => resolve(true) },
            ]
          );
        });
        if (!shouldContinue) return;
      }

      let receiptUrl: string | undefined;

      // Upload receipt if present
      if (receiptUri && user) {
        setIsUploadingReceipt(true);
        try {
          receiptUrl = await uploadReceiptImage(user.id, receiptUri);
        } catch (uploadError) {
          console.error('Error uploading receipt:', uploadError);
          Alert.alert('Warning', 'Expense saved but receipt upload failed');
        } finally {
          setIsUploadingReceipt(false);
        }
      }

      // Calculate deductible amount based on category
      const isMeals = selectedCategory === 'Meals' || calculateDeductible(amountNum, description.trim() || '').category === 'Business Meals';
      const deductiblePct = isMeals ? 0.5 : 1.0;
      const deductibleAmount = amountNum * deductiblePct;
      const dbCategory = mapCategoryToDbCategory(selectedCategory);

      const wasEditing = !!editingExpense;

      if (editingExpense) {
        // Update existing expense in database — use .select() to verify it worked
        const { data: updated, error: updateError } = await supabase
          .from('user_expenses')
          .update({
            amount: amountNum,
            merchant: description.trim() || 'Expense',
            date: dateIso,
            category: dbCategory,
            deductible_amount: deductibleAmount,
          })
          .eq('id', editingExpense.id)
          .select();
        if (updateError) throw updateError;
        if (!updated || updated.length === 0) {
          // Fallback: try without user_id filter (RLS handles auth)
          const { error: retryError } = await supabase
            .from('user_expenses')
            .update({
              amount: amountNum,
              merchant: description.trim() || 'Expense',
              date: dateIso,
              category: dbCategory,
              deductible_amount: deductibleAmount,
            })
            .eq('id', editingExpense.id)
            .select();
          if (retryError) throw retryError;
        }
      } else {
        // Insert new expense
        const { error: dbError } = await supabase
          .from('user_expenses')
          .insert({
            user_id: user.id,
            amount: amountNum,
            merchant: description.trim() || 'Expense',
            date: dateIso,
            category: dbCategory,
            deductible_amount: deductibleAmount,
            status: 'pending',
          });
        if (dbError) throw dbError;
        await addExpense({
          category: selectedCategory,
          amount: deductibleAmount, // Save the write-off amount to local storage too
          date: dateIso,
          description: description.trim(),
          receiptUrl,
        });
      }

      // Close modal and reset form BEFORE reloading
      setIsModalVisible(false);
      setEditingExpense(null);
      setAmount('');
      setDescription('');
      setDate(isoToMMDDYYYY(new Date().toISOString().split('T')[0]));
      setReceiptUri(null);

      // Reload from database to show fresh data
      await loadExpenses();
      Alert.alert('Success', wasEditing ? 'Expense updated.' : 'Expense saved successfully!');
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const analyzeReceiptFile = async (uri: string, contentType: string) => {
    setIsAnalyzingReceipt(true);
    try {
      const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ image: base64, type: 'expense', contentType }),
      });

      if (!response.ok) {
        console.error('AI analysis failed:', response.status, await response.text());
        return;
      }

      const parsed = await response.json();
      const amount = parsed.total_amount ?? parsed.amount;
      if (amount != null && typeof amount === 'number') {
        setAmount(amount.toFixed(2));
      }
      if (parsed.date && typeof parsed.date === 'string') {
        setDate(/^\d{4}-\d{2}-\d{2}/.test(parsed.date) ? isoToMMDDYYYY(parsed.date) : parsed.date);
      }
      if (parsed.merchant && typeof parsed.merchant === 'string') {
        setDescription(parsed.merchant);
      }
      if (parsed.category && typeof parsed.category === 'string') {
        const categoryMap: Record<string, Expense['category']> = {
          'Gas': 'Gas',
          'Meals': 'Meals',
          'Supplies': 'Supplies',
          'Maintenance': 'Repairs',
          'Other': 'Other',
        };
        if (categoryMap[parsed.category]) {
          setSelectedCategory(categoryMap[parsed.category]);
        }
      }
    } catch (error) {
      console.error('Error analyzing receipt:', error);
    } finally {
      setIsAnalyzingReceipt(false);
    }
  };

  const handlePickReceipt = async () => {
    try {
      const uri = await pickReceiptImage();
      if (uri) {
        setReceiptUri(uri);
        await analyzeReceiptFile(uri, 'image/jpeg');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const uri = await takeReceiptPhoto();
      if (uri) {
        setReceiptUri(uri);
        await analyzeReceiptFile(uri, 'image/jpeg');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      setReceiptUri(uri);
      await analyzeReceiptFile(uri, 'application/pdf');
    } catch (error) {
      Alert.alert('Error', 'Failed to pick PDF');
    }
  };

  const handleUniversalUpload = async () => {
    const presentSheet = () => {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Scan Document', 'Photo Library', 'Choose File (PDF)', 'Cancel'],
          cancelButtonIndex: 3,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            await handleTakePhoto();
          } else if (buttonIndex === 1) {
            await handlePickReceipt();
          } else if (buttonIndex === 2) {
            await handlePickPdf();
          }
        }
      );
    };

    if (Platform.OS === 'ios') {
      presentSheet();
    } else {
      Alert.alert('Upload Receipt', 'Choose a source', [
        { text: 'Scan Document', onPress: () => { void handleTakePhoto(); } },
        { text: 'Photo Library', onPress: () => { void handlePickReceipt(); } },
        { text: 'Choose File (PDF)', onPress: () => { void handlePickPdf(); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (user) {
                const { error } = await supabase
                  .from('user_expenses')
                  .delete()
                  .eq('id', id)
                  .eq('user_id', user.id);
                if (error) throw error;
              }
              await deleteExpense(id);
              await loadExpenses();
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', 'Failed to delete expense');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Handle bank connection success
  const handleBankConnected = () => {
    setIsBankConnected(true);
    Alert.alert('Success', 'Bank account connected successfully!');
  };

  // Scan for write-offs — auto-saves to DB immediately
  const handleScanExpenses = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to scan expenses');
      return;
    }

    setIsScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('scan-expenses', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success && data.transactions) {
        // Auto-save: categorize and insert into database immediately
        const expensesToInsert = data.transactions.map((tx: ScannedTransaction) => {
          const { deductibleAmount, category } = calculateDeductible(tx.amount, tx.name);
          return {
            user_id: user.id,
            amount: tx.amount,
            deductible_amount: deductibleAmount,
            merchant: tx.name,
            date: tx.date,
            category: category,
            status: 'pending',
          };
        });

        const { error: insertError } = await supabase
          .from('user_expenses')
          .insert(expensesToInsert);

        if (insertError) throw insertError;

        // Also sync to AsyncStorage
        for (const tx of data.transactions) {
          const { category } = calculateDeductible(tx.amount, tx.name);
          const expenseCategory: Expense['category'] =
            category === 'Business Meals' ? 'Meals' :
              category === 'Vehicle - Gas' ? 'Gas' :
                category === 'Vehicle - Maintenance' ? 'Repairs' :
                  category === 'Commissions & Fees' ? 'Other' : 'Other';
          await addExpense({
            category: expenseCategory,
            amount: tx.amount,
            date: tx.date,
            description: tx.name,
            fromBankTransaction: true,
            transactionId: tx.id,
          });
        }

        const totalDeductible = expensesToInsert.reduce((sum: number, exp: any) => sum + (parseFloat(exp.deductible_amount?.toString() || '0') || 0), 0);

        // Reload the expenses list
        await loadExpenses();

        Alert.alert(
          'Write-offs Saved',
          `Found and saved ${data.transactions.length} deductions totaling $${totalDeductible.toFixed(2)} to your tax return.`
        );
      } else {
        Alert.alert('No Transactions', 'No new deductible transactions were found. Check back after more bank activity.');
      }
    } catch (error: any) {
      console.error('Error scanning expenses:', error);
      Alert.alert(
        'Scan Error',
        error.message || 'Failed to scan expenses. Please try again.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  // Smart tax categorization with IRS percentage rules (expanded keywords)
  const calculateDeductible = (amount: number, merchant: string): { deductibleAmount: number; category: string } => {
    const merchantLower = merchant.toLowerCase();

    // Meals (50% Deductible)
    const mealKeywords = [
      'starbucks', 'mcdonalds', 'dunkin', 'taco bell', 'chick-fil-a',
      'burger king', 'wendy\'s', 'panda express', 'chipotle', 'panera',
      'subway', 'sonic', 'popeyes', 'kfc', 'arby\'s', 'jack in the box',
      'domino\'s', 'pizza hut', 'five guys', 'shake shack', 'wingstop',
      'zaxby\'s', 'culver\'s', 'whataburger', 'in-n-out', 'raising cane',
      'el pollo loco', 'del taco', 'noodles', 'firehouse subs',
      'jimmy john', 'jersey mike', 'wawa food', 'sheetz food',
    ];
    if (mealKeywords.some(keyword => merchantLower.includes(keyword))) {
      return {
        deductibleAmount: amount * 0.5,
        category: 'Business Meals',
      };
    }

    // Gas & Fuel (100% - Actual Expense Method)
    const gasKeywords = [
      'shell', 'chevron', 'exxon', 'mobil', 'bp', '7-eleven', 'wawa', 'qt', 'arco',
      'costco gas', '76', 'circle k', 'marathon', 'sunoco', 'love\'s',
      'pilot', 'flying j', 'tesoro', 'valero', 'sinclair', 'speedway',
      'murphy usa', 'conoco', 'phillips 66', 'citgo', 'gulf',
      'racetrac', 'quiktrip', 'maverik', 'caseys', 'kum & go',
      'holiday', 'kwik trip', 'sheetz fuel', 'kroger fuel',
      'safeway fuel', 'fred meyer fuel', 'sams club fuel', 'bjs gas',
      'fuel', 'gasoline', 'gas station',
    ];
    if (gasKeywords.some(keyword => merchantLower.includes(keyword))) {
      return {
        deductibleAmount: amount * 1.0,
        category: 'Vehicle - Gas',
      };
    }

    // Auto Parts & Maintenance (100% - Actual Expense Method)
    const maintenanceKeywords = [
      'jiffy lube', 'autozone', 'pep boys', "o'reilly", 'oreilly', 'firestone',
      'valvoline', 'car wash', 'advance auto', 'napa', 'rockauto',
      'discount tire', 'les schwab', 'big o tires', 'safelite', 'aaa',
      'goodyear', 'americas tire', 'mavis', 'monro', 'midas', 'meineke',
      'aamco', 'brakes plus', 'christian brothers', 'auto repair',
      'mechanic', 'smog check', 'oil change', 'tire shop', 'detail',
    ];
    if (maintenanceKeywords.some(keyword => merchantLower.includes(keyword))) {
      return {
        deductibleAmount: amount * 1.0,
        category: 'Vehicle - Maintenance',
      };
    }

    // Insurance (100% Deductible)
    const insuranceKeywords = [
      'geico', 'progressive', 'state farm', 'allstate', 'farmers',
      'usaa', 'liberty mutual', 'nationwide', 'travelers',
      'american family', 'esurance', 'safeco', 'mercury',
      'root insurance', 'lemonade auto', 'auto insurance',
      'car insurance',
    ];
    if (insuranceKeywords.some(keyword => merchantLower.includes(keyword))) {
      return {
        deductibleAmount: amount * 1.0,
        category: 'Insurance',
      };
    }

    // Tolls & Parking (100% Deductible)
    const parkingKeywords = [
      'ezpass', 'fastrak', 'sunpass', 'ipass', 'txtag',
      'parking', 'garage', 'toll', 'turnpike', 'spothero', 'parkwhiz',
    ];
    if (parkingKeywords.some(keyword => merchantLower.includes(keyword))) {
      return {
        deductibleAmount: amount * 1.0,
        category: 'Parking & Tolls',
      };
    }

    // Gig/Work Apps & Fees (100% Deductible)
    const platformKeywords = [
      'uber', 'lyft', 'doordash', 'grubhub', 'amazon flex', 'instacart',
      'shipt', 'taskrabbit', 'upwork', 'fiverr', 'adobe', 'apple',
      'google', 'checkr', 'background check', 'dmv', 'vehicle registration',
    ];
    if (platformKeywords.some(keyword => merchantLower.includes(keyword))) {
      return {
        deductibleAmount: amount * 1.0,
        category: 'Commissions & Fees',
      };
    }

    // Phone/Internet (100% Deductible)
    const phoneKeywords = [
      't-mobile', 'tmobile', 'verizon', 'at&t', 'att', 'xfinity',
      'spectrum', 'mint mobile', 'cricket', 'metro pcs', 'boost mobile',
      'visible', 'google fi', 'us cellular',
    ];
    if (phoneKeywords.some(keyword => merchantLower.includes(keyword))) {
      return {
        deductibleAmount: amount * 1.0,
        category: 'Phone & Internet',
      };
    }

    // Work Subscriptions (100% Deductible)
    const subKeywords = [
      'spotify', 'apple music', 'sirius', 'siriusxm', 'youtube premium',
      'quickbooks', 'freshbooks', 'expensify', 'stride', 'everlance',
      'gridwise',
    ];
    if (subKeywords.some(keyword => merchantLower.includes(keyword))) {
      return {
        deductibleAmount: amount * 1.0,
        category: 'Subscriptions',
      };
    }

    // Default: 100% deductible but uncategorized
    return {
      deductibleAmount: amount * 1.0,
      category: 'Uncategorized',
    };
  };

  // Group expenses by month (most recent first)
  const groupedExpenses = React.useMemo(() => {
    const groups: { key: string; label: string; data: (Expense & { dbCategory?: string })[] }[] = [];
    const map = new Map<string, (Expense & { dbCategory?: string })[]>();

    for (const exp of expenses) {
      const d = new Date(exp.date);
      // Use YYYY-MM as key for proper sorting
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(exp as any);
    }

    // Sort keys descending (most recent month first)
    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

    for (const key of sortedKeys) {
      const [year, month] = key.split('-');
      const monthDate = new Date(parseInt(year), parseInt(month) - 1);
      const label = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const items = map.get(key)!;
      // Sort items within month by date descending
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      groups.push({ key, label, data: items });
    }

    return groups;
  }, [expenses]);

  // Collapsed state for each month section
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const toggleMonthCollapse = (key: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openEditExpense = (item: Expense & { dbCategory?: string; originalAmount?: number }) => {
    setEditingExpense(item);
    // Use the original receipt amount so the deduction banner can recalculate correctly
    const displayAmount = (item as any).originalAmount ?? item.amount;
    setAmount(displayAmount.toString());
    const dateStr = typeof item.date === 'string' ? item.date : new Date(item.date).toISOString().split('T')[0];
    setDate(/^\d{4}-\d{2}-\d{2}/.test(dateStr) ? isoToMMDDYYYY(dateStr) : dateStr);
    setDescription(item.description || '');
    setSelectedCategory(item.category);
    setReceiptUri(null);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setEditingExpense(null);
    setAmount('');
    setDescription('');
    setDate(isoToMMDDYYYY(new Date().toISOString().split('T')[0]));
    setReceiptUri(null);
  };

  // (renderExpenseItem removed — month-grouped inline rendering replaces it)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
          >
            {/* Header - plain title */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Expenses</Text>
            </View>

            {isLoadingData ? (
              <ExpensesSkeleton />
            ) : (
              <>
                {/* Stats Banner - only when there's data */}
                {expenses.length > 0 && (
                  <View style={[styles.statsBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Write-Offs</Text>
                      <Text style={[styles.statValue, { color: colors.primary }]}>${totalExpenses.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Expenses</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{expenses.length}</Text>
                    </View>
                  </View>
                )}

                {/* Bank Connection Section - ALWAYS visible */}
                {!isBankConnected ? (
                  <View style={[styles.bankCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.bankCardHeader}>
                      <Feather name="credit-card" size={24} color={colors.primary} />
                      <Text style={[styles.bankCardTitle, { color: colors.text }]}>Connect Your Bank</Text>
                    </View>
                    <Text style={[styles.bankCardDescription, { color: colors.textSecondary }]}>
                      Automatically scan your transactions for tax write-offs
                    </Text>
                    <BankLinkButton onSuccess={handleBankConnected} />
                  </View>
                ) : (
                  <View style={[styles.bankCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.bankCardHeader}>
                      <Feather name="check-circle" size={24} color={colors.primary} />
                      <Text style={[styles.bankCardTitle, { color: colors.text }]}>Bank Connected</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.scanButton, { backgroundColor: colors.primary }]}
                      onPress={handleScanExpenses}
                      disabled={isScanning}>
                      {isScanning ? (
                        <View style={styles.buttonRow}>
                          <ActivityIndicator color={colors.background} />
                          <Text style={[styles.scanButtonText, { color: colors.background }]}>Scanning...</Text>
                        </View>
                      ) : (
                        <View style={styles.buttonRow}>
                          <Feather name="search" size={20} color={colors.background} />
                          <Text style={[styles.scanButtonText, { color: colors.background }]}>Scan for Write-offs</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Expenses List — Grouped by Month */}
                <View style={styles.expensesSection}>
                  {groupedExpenses.length > 0 ? (
                    groupedExpenses.map((group) => {
                      const isCollapsed = collapsedMonths.has(group.key);
                      const monthTotal = group.data.reduce((sum, exp) => sum + exp.amount, 0);
                      return (
                        <View key={group.key} style={{ marginBottom: 16 }}>
                          {/* Month Header — tap to expand/collapse */}
                          <TouchableOpacity
                            style={[styles.monthHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            onPress={() => toggleMonthCollapse(group.key)}
                            activeOpacity={0.7}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.monthTitle, { color: colors.text }]}>{group.label}</Text>
                              <Text style={[styles.monthMeta, { color: colors.textSecondary }]}>
                                {group.data.length} expense{group.data.length !== 1 ? 's' : ''}
                              </Text>
                            </View>
                            <Text style={[styles.monthTotal, { color: colors.primary }]}>
                              ${monthTotal.toFixed(2)}
                            </Text>
                            <Feather
                              name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                              size={20}
                              color={colors.textSecondary}
                              style={{ marginLeft: 8 }}
                            />
                          </TouchableOpacity>

                          {/* Expense items within month */}
                          {!isCollapsed && group.data.map((item, idx) => {
                            const merchantName = item.description || 'Expense';
                            const categoryDisplay = (item as any).dbCategory || item.category;
                            const iconName = getCategoryIcon(item.category);
                            return (
                              <View
                                key={item.id}
                                style={[
                                  styles.monthExpenseRow,
                                  { backgroundColor: colors.background, borderColor: colors.border },
                                  idx === group.data.length - 1 && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
                                ]}>
                                <TouchableOpacity
                                  style={styles.monthExpenseContent}
                                  onPress={() => openEditExpense(item as any)}
                                  activeOpacity={0.7}>
                                  <View style={[styles.expenseIcon, { backgroundColor: colors.surface }]}>
                                    <Feather name={iconName as any} size={18} color={colors.primary} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.expenseMerchant, { color: colors.text }]} numberOfLines={1}>{merchantName}</Text>
                                    <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>
                                      {formatDate(item.date)} {categoryDisplay ? `\u00B7 ${categoryDisplay}` : ''}
                                    </Text>
                                  </View>
                                  <Text style={[styles.expenseAmount, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
                                    ${item.amount.toFixed(2)}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.removeBtn}
                                  onPress={() => handleDeleteExpense(item.id)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                  <Feather name="x" size={16} color={colors.error || '#ef4444'} />
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })
                  ) : (
                    <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Feather name="inbox" size={32} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No expenses recorded yet</Text>
                      <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                        Connect your bank and scan for write-offs, or tap + to add manually
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>

          {/* Floating Action Button */}
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setEditingExpense(null);
              setAmount('');
              setDescription('');
              setDate(isoToMMDDYYYY(new Date().toISOString().split('T')[0]));
              setSelectedCategory('Supplies');
              setReceiptUri(null);
              setIsModalVisible(true);
            }}
            activeOpacity={0.8}>
            <Feather name="plus" size={28} color={colors.background} />
          </TouchableOpacity>

          {/* Add / Edit Write-Off Modal */}
          <Modal
            visible={isModalVisible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={closeModal}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingExpense ? 'Edit Write-Off' : 'Add Write-Off'}
                </Text>
                <TouchableOpacity onPress={closeModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Feather name="x" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
                {/* Deductibility Explanation Banner */}
                {(() => {
                  const amountNum = parseFloat(amount) || 0;
                  if (amountNum <= 0) return null;
                  // Use smart categorization from merchant name
                  const smart = calculateDeductible(amountNum, description || '');
                  // If user manually picked Meals, override to 50%
                  const isMeals = selectedCategory === 'Meals' || smart.category === 'Business Meals';
                  const pct = isMeals ? 50 : 100;
                  const deductible = amountNum * (pct / 100);
                  const categoryLabel = isMeals ? 'business meals' : smart.category.toLowerCase();
                  const merchantLabel = description?.trim() || selectedCategory;
                  return (
                    <View style={[styles.deductBanner, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}>
                      <View style={styles.deductBannerRow}>
                        <Feather name="info" size={16} color={colors.primary} />
                        <Text style={[styles.deductBannerTitle, { color: colors.primary }]}>Tax Deduction Breakdown</Text>
                      </View>
                      <Text style={[styles.deductBannerBody, { color: colors.text }]}>
                        {merchantLabel} was <Text style={{ fontWeight: '700' }}>${amountNum.toFixed(2)}</Text>
                        {pct < 100
                          ? `, but ${categoryLabel} are only ${pct}% deductible per IRS rules.`
                          : ` and ${categoryLabel} are ${pct}% deductible.`}
                      </Text>
                      <View style={[styles.deductBannerResult, { backgroundColor: `${colors.primary}15`, borderRadius: 8, padding: 10, marginTop: 4 }]}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>Your write-off (saved amount)</Text>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.primary, fontVariant: ['tabular-nums'] as any }}>${deductible.toFixed(2)}</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Amount Input - Large & Prominent */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AMOUNT</Text>
                <View style={[styles.amountInputContainer, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
                  <Text style={[styles.currencySymbol, { color: colors.primary }]}>$</Text>
                  <TextInput
                    style={[styles.amountInput, { color: colors.text }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                    editable={!isAnalyzingReceipt}
                    returnKeyType="done"
                    blurOnSubmit={true}
                    inputAccessoryViewID={doneAccessoryId}
                  />
                </View>

                {/* Date Input (MM/DD/YYYY) */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>DATE</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={colors.textSecondary}
                  value={date}
                  onChangeText={(text) => setDate(formatMMDDYYYY(text))}
                  editable={!isAnalyzingReceipt}
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  inputAccessoryViewID={doneAccessoryId}
                />

                {/* Category Selection - Visual Pills */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>CATEGORY</Text>
                <View style={styles.categoryContainer}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.categoryPill,
                        selectedCategory === cat.key
                          ? { backgroundColor: colors.primary, borderColor: 'transparent' }
                          : { borderColor: colors.border, backgroundColor: colors.surface }
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedCategory(cat.key);
                      }}
                      disabled={isAnalyzingReceipt}
                      activeOpacity={0.7}>
                      <Feather
                        name={cat.icon as any}
                        size={16}
                        color={selectedCategory === cat.key ? '#ffffff' : colors.primary}
                      />
                      <Text
                        style={[
                          styles.categoryText,
                          { color: selectedCategory === cat.key ? '#ffffff' : colors.text },
                        ]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Description Input */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>DESCRIPTION (OPTIONAL)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, height: 80, marginTop: 0 },
                  ]}
                  placeholder="e.g., Uber Eats for client meeting"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  value={description}
                  onChangeText={setDescription}
                  editable={!isAnalyzingReceipt}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  inputAccessoryViewID={doneAccessoryId}
                />

                {/* Receipt Upload Section */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>RECEIPT (OPTIONAL)</Text>
                {isAnalyzingReceipt && (
                  <View style={[styles.analyzingIndicator, { backgroundColor: colors.primary + '15' }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.analyzingText, { color: colors.primary }]}>AI is scanning your receipt...</Text>
                  </View>
                )}
                {receiptUri ? (
                  <View style={styles.receiptPreview}>
                    <Image source={{ uri: receiptUri }} style={styles.receiptImage} />
                    <TouchableOpacity
                      style={[styles.removeReceiptButton, { backgroundColor: colors.error || '#FF3B30' }]}
                      onPress={() => setReceiptUri(null)}
                      disabled={isAnalyzingReceipt}
                      activeOpacity={0.7}>
                      <Feather name="trash-2" size={16} color="#FFF" />
                      <Text style={styles.removeReceiptText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.receiptUploadButton, { borderColor: colors.primary }]}
                    onPress={handleUniversalUpload}
                    disabled={isAnalyzingReceipt}
                    activeOpacity={0.7}>
                    <Feather name="camera" size={28} color={colors.primary} />
                    <Text style={[styles.receiptUploadTitle, { color: colors.text }]}>Scan Receipt</Text>
                    <Text style={[styles.receiptUploadSubtext, { color: colors.textSecondary }]}>Auto-fill amount & category</Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 100 }} />
                <KeyboardDoneButton accessoryID={doneAccessoryId} />
              </ScrollView>

              {/* FIXED FOOTER BUTTONS (Outside ScrollView) */}
              <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
                <TouchableOpacity
                  style={[styles.footerButton, { borderColor: colors.border, backgroundColor: colors.surface, borderWidth: 1 }]}
                  onPress={closeModal}
                  disabled={isUploadingReceipt || isAnalyzingReceipt}
                  activeOpacity={0.7}>
                  <Text style={[styles.footerButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.footerButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleSaveExpense();
                  }}
                  disabled={isUploadingReceipt || isAnalyzingReceipt}
                  activeOpacity={0.8}>
                  {isUploadingReceipt ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={[styles.footerButtonText, { color: colors.background }]}>{editingExpense ? 'Update' : 'Save'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 0,
  },
  // ── Header ──
  header: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
  },
  // ── Stats Banner ──
  statsBanner: {
    flexDirection: 'row',
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  expensesSection: {
    marginTop: 8,
  },
  // ── Month Group ──
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 1,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  monthMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  monthTotal: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as any,
  },
  monthExpenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthExpenseContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeBtn: {
    padding: 6,
    marginLeft: 8,
  },
  expenseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseMerchant: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  expenseDate: {
    fontSize: 13,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  separator: {
    height: 12,
  },
  emptyState: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
    flex: 1,
  },
  modalScrollView: {
    flex: 1,
    maxHeight: 400,
  },
  modalScrollContent: {
    padding: 24,
    paddingBottom: 24,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    flex: 1,
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // ── Deductibility Explanation ──
  deductBanner: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
    gap: 8,
  },
  deductBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deductBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  deductBannerBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  deductBannerResult: {
    alignItems: 'center',
  },
  analyzingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  analyzingText: {
    fontSize: 14,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalClose: {
    fontSize: 28,
    fontWeight: '300',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    marginBottom: 24,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
    borderWidth: 1,
    marginBottom: 24,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  receiptUploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
  },
  receiptUploadTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  receiptUploadSubtext: {
    fontSize: 13,
    fontWeight: '400',
  },
  receiptButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  receiptButton: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  receiptButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  receiptPreview: {
    gap: 8,
  },
  receiptImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  removeReceiptButton: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  removeReceiptText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bankCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bankCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  bankCardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  bankCardDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  scanButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // (scanned preview removed — autosave replaces it)
});
