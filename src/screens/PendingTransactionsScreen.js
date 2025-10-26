import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { getCards, getExpenses, deleteExpense, getCategories, getExpenseCategorizationsForCard, getUserProfile } from '../services/firestoreService';

const PendingTransactionsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Centralized data states
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expensesByCard, setExpensesByCard] = useState({});
  const [expenseCategorizations, setExpenseCategorizations] = useState({});
  const [userProfile, setUserProfile] = useState(null);

  // Fetch cards and categories
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const unsubCards = getCards(user.uid, (userCards) => {
      setCards(userCards);
      setLoading(false);
    });
    const unsubCats = getCategories(user.uid, setCategories);

    // Fetch user profile
    getUserProfile(user.uid).then(doc => {
      if (doc.exists()) {
        setUserProfile(doc.data());
      }
    });

    return () => {
      unsubCards();
      unsubCats();
    };
  }, [user]);

  // Fetch expenses for the cards
  useEffect(() => {
    if (!user || cards.length === 0) {
      setExpensesByCard({});
      return;
    }
    const unsubscribes = cards.map(card =>
      getExpenses(card.id, (expenses) => {
        setExpensesByCard(prev => ({ ...prev, [card.id]: expenses }));
      })
    );
    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, cards]);

  // Fetch categorizations for the cards
  useEffect(() => {
    if (!user || cards.length === 0) {
      setExpenseCategorizations({});
      return;
    }
    const unsubscribes = cards.map(card =>
      getExpenseCategorizationsForCard(card.id, (categorizations) => {
        setExpenseCategorizations(prev => ({ ...prev, [card.id]: categorizations }));
      })
    );
    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, cards]);

  // Refresh data when screen comes into focus (after returning from EditExpenseScreen)
  useFocusEffect(
    useCallback(() => {
      if (user && cards.length > 0) {
        // Force refresh of categorizations
        const refreshCategorizations = cards.map(card =>
          getExpenseCategorizationsForCard(card.id, (categorizations) => {
            setExpenseCategorizations(prev => ({ ...prev, [card.id]: categorizations }));
          })
        );
        // Clean up the temporary listeners after a short delay
        setTimeout(() => {
          refreshCategorizations.forEach(unsub => unsub());
        }, 1000);
      }
    }, [user, cards])
  );

  // Check if an expense is pending for the current user
  const isExpensePending = useCallback((card, expense) => {
    // For shared cards, it's pending if the user hasn't categorized it
    if (card?.isShared) {
      const cardCategorizations = expenseCategorizations[card.id] || {};
      const expenseCats = cardCategorizations[expense.id] || {};
      const userCategorization = expenseCats[user.uid] || {};
      return !userCategorization.category;
    }
    // For regular expenses, it's pending if:
    // 1. Status is 'pending' AND user hasn't categorized it
    if (expense.status === 'pending') {
      const cardCategorizations = expenseCategorizations[card.id] || {};
      const expenseCats = cardCategorizations[expense.id] || {};
      const userCategorization = expenseCats[user.uid] || {};
      return !userCategorization.category;
    }
    // If status is not 'pending', it's not pending
    return false;
  }, [user, expenseCategorizations]);

  // Derive the final list of pending transactions
  const transactions = useMemo(() => {
    let allPendingTxs = [];
    cards.forEach(card => {
      const cardExpenses = expensesByCard[card.id] || [];
      const pendingInCard = cardExpenses
        .filter(e => isExpensePending(card, e))
        .map(e => ({ ...e, cardId: card.id }));
      allPendingTxs.push(...pendingInCard);
    });
    const uniqueTxs = Array.from(new Map(allPendingTxs.map(tx => [tx.id, tx])).values());
    return uniqueTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [cards, expensesByCard, expenseCategorizations, isExpensePending]);

  const handleCategorizeTransaction = (transaction) => {
    // Navigate to EditExpense screen for pending transactions
    navigation.navigate('EditExpense', {
      cardId: transaction.cardId,
      expense: transaction,
    });
  };

  const handleDeleteTransaction = async (transaction) => {
    const { id: expenseId, cardId } = transaction;
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this pending transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(cardId, expenseId);
              Alert.alert('Success', 'Transaction deleted successfully');
            } catch (error) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Error', 'Could not delete transaction. Please try again.');
            }
          }
        }
      ]
    );
  };

  const getTransactionTypeLabel = (type) => {
    switch(type) {
      case 'income': return 'Income';
      case 'expense': return 'Expense';
      case 'transfer': return 'Transfer';
      default: return 'Unknown';
    }
  };

  const findCategory = (categoryId) => categories.find((c) => c.id === categoryId);

  const findCard = (cardId) => cards.find((c) => c.id === cardId);



  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString) => {
    // Parse YYYY-MM-DD locally to avoid timezone shifts
    const parts = (dateString || '').split('-');
    const date = parts.length === 3
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0, 0)
      : new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short'
      });
    }
  };

  const renderTransaction = ({ item }) => {
    const card = findCard(item.cardId);

    let resolvedCategoryId = item.category; // Default for non-shared or legacy expenses
    if (card?.isShared) {
      const cardCategorizations = (expenseCategorizations || {})[card.id] || {};
      const expenseCats = cardCategorizations[item.id] || {};
      const userCategorization = (expenseCats || {})[user.uid] || {};
      // Use the user-specific category if it exists, otherwise it remains pending (null)
      resolvedCategoryId = userCategorization.category || null;
    }

    const cat = findCategory(resolvedCategoryId);
    const isSharedExpense = item.sharedExpense || item.participants;

    return (
      <TouchableOpacity
        style={[styles.expenseItem, styles.expenseItemPending, isSharedExpense && styles.expenseItemShared]}
        activeOpacity={0.8}
        onPress={() => handleCategorizeTransaction(item)}
      >
        <View style={styles.expenseLeft}>
          <Text style={[styles.pendingText, isSharedExpense && styles.pendingTextShared]}>
            {isSharedExpense ? 'SHARED EXPENSE' : 'PENDING'}
          </Text>
          <Text style={styles.expenseDescription}>
            {item.description || (item.category ? 'Without Bio' : 'Pending categorization')}
          </Text>
          {(() => {
            if (item.category === 'Credit Card Payment') {
              let text = 'Card Payment';
              if (item.type === 'expense') { // Debit card
                const creditCardName = item.description.replace('Card payment: ', '');
                text = `Payment for ${creditCardName}`;
              } else { // Credit card
                const fromCardName = item.description.replace('Card payment from: ', '');
                text = `Payment from ${fromCardName}`;
              }
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="exchange-alt" size={12} color="#666" />
                  <Text style={styles.expenseMeta}>{text}</Text>
                </View>
              );
            }
            if (!cat) {
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={'question-circle'} size={12} color="#666" />
                  <Text style={styles.expenseMeta}>
                    Pending categorization
                  </Text>
                </View>
              );
            }
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {cat ? <Icon name={cat.icon || 'tag'} size={12} color="#666" /> : null}
                <Text style={styles.expenseMeta}>
                  {cat ? cat.name : 'Category'}
                </Text>
              </View>
            );
          })()}

          {/* Tarjeta */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="credit-card" size={12} color="#666" />
            <Text style={styles.expenseMeta}>
              {card ? card.name : 'Unknown Card'}
            </Text>
          </View>

          <Text style={styles.expenseMeta}>Frequency: {item.recurrence || 'one-time'}</Text>
          <Text style={styles.expenseDate}>{formatDate(item.date)}</Text>
        </View>
        <Text style={[
          styles.expenseAmount,
          item.amount < 0 ? styles.expenseNegative : styles.expensePositive
        ]}>
          {item.amount < 0 ? '-' : '+'}<Icon name={userProfile?.currency?.icon || 'dollar-sign'} size={14} />{formatCurrency(item.amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Icon name="clipboard-list" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No pending transactions</Text>
            <Text style={styles.emptySubtitle}>
              Transactions without category or description will appear here
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Transaction styles similar to HomeScreen.js
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  expenseItemPending: {
    borderColor: '#FF9500',
    borderWidth: 1,
  },
  expenseItemShared: {
    borderColor: '#FF3B30',
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  pendingText: {
    color: '#FF9500',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  pendingTextShared: {
    color: '#FF3B30',
  },
  expenseLeft: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 3,
  },
  expenseMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  expenseDate: {
    fontSize: 12,
    color: '#666',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  expenseNegative: {
    color: '#FF3B30',
  },
  expensePositive: {
    color: '#34C759',
  },
});

export default PendingTransactionsScreen;