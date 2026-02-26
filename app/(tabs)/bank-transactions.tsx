import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  fetchTransactions,
  categorizeTransaction,
  type PlaidTransaction,
} from '@/lib/plaidService';
import { addExpense } from '@/lib/expenseStore';
import { useAuth } from '@/lib/CtxProvider';

function formatMoney(amount: number) {
  return `$${Math.abs(amount).toFixed(2)}`;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CATEGORY_MAP: Record<string, 'Gas' | 'Repairs' | 'Insurance' | 'Supplies' | 'Other'> = {
  Gas: 'Gas',
  'Oil Changes': 'Repairs',
  Repairs: 'Repairs',
  Insurance: 'Insurance',
  Supplies: 'Supplies',
};

export default function BankTransactionsScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<PlaidTransaction[]>([]);
  const [categorizedTransactions, setCategorizedTransactions] = useState<
    Array<PlaidTransaction & { suggestedCategory?: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadTransactions = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const fetched = await fetchTransactions(user.id);
      setTransactions(fetched);

      // Auto-categorize transactions
      const categorized = fetched.map((txn) => {
        const category = categorizeTransaction(txn);
        return {
          ...txn,
          suggestedCategory: category || undefined,
        };
      });

      setCategorizedTransactions(categorized);
    } catch (error) {
      console.error('Error loading transactions:', error);
      Alert.alert('Error', 'Failed to load bank transactions');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  const handleAddExpense = async (transaction: PlaidTransaction & { suggestedCategory?: string }, category: string) => {
    if (!transaction.suggestedCategory) return;

    setIsProcessing(true);
    try {
      const expenseCategory = CATEGORY_MAP[category] || 'Other';

      await addExpense({
        category: expenseCategory,
        amount: Math.abs(transaction.amount),
        date: transaction.date,
        description: transaction.merchantName || transaction.name,
        fromBankTransaction: true,
        transactionId: transaction.transactionId,
      });

      Alert.alert('✅ Expense Added', 'Transaction added as a business expense');
      
      // Remove from list
      setCategorizedTransactions((prev) =>
        prev.filter((t) => t.transactionId !== transaction.transactionId)
      );
    } catch (error) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', 'Failed to add expense');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderTransactionItem = ({
    item,
  }: {
    item: PlaidTransaction & { suggestedCategory?: string };
  }) => {
    const isExpense = item.amount < 0;
    const suggestedCategory = item.suggestedCategory;

    if (!isExpense || !suggestedCategory) {
      return null; // Only show negative transactions with suggested categories
    }

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionName}>
              {item.merchantName || item.name}
            </Text>
            <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
          </View>
          <Text style={styles.transactionAmount}>{formatMoney(item.amount)}</Text>
        </View>

        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>
            Suggested: {suggestedCategory}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddExpense(item, suggestedCategory)}
          disabled={isProcessing}>
          <Text style={styles.addButtonText}>
            + Add as {CATEGORY_MAP[suggestedCategory] || 'Expense'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const suggestedExpenses = categorizedTransactions.filter(
    (t) => t.amount < 0 && t.suggestedCategory
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Auto-Detected Expenses</Text>
          <Text style={styles.subtitle}>
            We found potential business expenses from your bank transactions
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#C6FF5E" />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        ) : suggestedExpenses.length > 0 ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>
                {suggestedExpenses.length} potential expense{suggestedExpenses.length !== 1 ? 's' : ''} found
              </Text>
              <Text style={styles.summaryValue}>
                {formatMoney(
                  suggestedExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)
                )}
              </Text>
            </View>

            {suggestedExpenses.map((item, index) => (
              <React.Fragment key={item.transactionId}>
                {index > 0 && <View style={styles.separator} />}
                {renderTransactionItem({ item })}
              </React.Fragment>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No expenses detected</Text>
            <Text style={styles.emptySubtext}>
              Link your bank account in Profile to auto-detect expenses
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    lineHeight: 22,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#999',
    marginTop: 12,
  },
  summaryCard: {
    backgroundColor: '#1A1F0F',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(198, 255, 94, 0.35)',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#C6FF5E',
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#C6FF5E',
  },
  transactionCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: '#999',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C6FF5E',
  },
  categoryBadge: {
    backgroundColor: '#1A1F0F',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  categoryBadgeText: {
    fontSize: 13,
    color: '#C6FF5E',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#C6FF5E',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#121212',
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    height: 12,
  },
  emptyState: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
