import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { getRecurringExpenses, addExpense, updateExpense, getUserProfile, getCards, getExpenseCategorizationsForCard, getCategories } from '../services/firestoreService';
import moment from 'moment';

const FrequencyTransactionsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [allRecurringExpenses, setAllRecurringExpenses] = useState([]);
  const [activeCards, setActiveCards] = useState(null);
  const [currencyIcon, setCurrencyIcon] = useState('dollar-sign');
  const [expenseCategorizations, setExpenseCategorizations] = useState({});
  const [categories, setCategories] = useState([]);

  const findCategory = (categoryId) => categories.find((c) => c.id === categoryId);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const expensesUnsubscribe = getRecurringExpenses(user.uid, (expenses) => {
      setAllRecurringExpenses(expenses);
    });

    let cardCategorizationUnsubscribes = [];
    const cardsUnsubscribe = getCards(user.uid, (cards) => {
      setActiveCards(cards);

      cardCategorizationUnsubscribes.forEach(unsub => unsub());
      cardCategorizationUnsubscribes = [];

      cards.forEach(card => {
        const unsub = getExpenseCategorizationsForCard(card.id, (categorizations) => {
          setExpenseCategorizations(prev => ({
            ...prev,
            [card.id]: categorizations || {},
          }));
        });
        cardCategorizationUnsubscribes.push(unsub);
      });
    });

    const categoriesUnsubscribe = getCategories(user.uid, setCategories);

    getUserProfile(user.uid).then(profileSnap => {
      if (profileSnap.exists()) {
        const profile = profileSnap.data();
        if (profile.currency) setCurrencyIcon(profile.currency.icon);
      }
    });

    return () => {
      expensesUnsubscribe();
      cardsUnsubscribe();
      categoriesUnsubscribe();
      cardCategorizationUnsubscribes.forEach(unsub => unsub());
    };
  }, [user]);

  useEffect(() => {
    if (activeCards !== null) {
      const activeCardIds = activeCards.map(c => c.id);
      const filteredExpenses = allRecurringExpenses.filter(expense => activeCardIds.includes(expense.cardId));
      setRecurringExpenses(filteredExpenses);
      setLoading(false);
    }
  }, [allRecurringExpenses, activeCards]);

  const calculateNextDueDate = (expense) => {
    const { timestamp, recurrence } = expense;
    const lastDate = timestamp.toDate();
    let nextDate = moment(lastDate);

    switch (recurrence) {
      case 'monthly':
        nextDate.add(1, 'months');
        break;
      case 'bimonthly':
        nextDate.add(2, 'months');
        break;
      case 'quarterly':
        nextDate.add(3, 'months');
        break;
      case 'semiannual':
        nextDate.add(6, 'months');
        break;
      case 'annual':
        nextDate.add(1, 'years');
        break;
      default:
        return { nextDate: null, remaining: 'Invalid recurrence' };
    }

    const remaining = nextDate.fromNow();
    return { nextDate: nextDate.toDate(), remaining };
  };

  const handleRecreate = (expense) => {
    Alert.alert(
      "Repeat Transaction",
      `Do you want to create a new transaction for "${expense.description}"? This will also reset the recurrence counter for the original transaction.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Create',
          onPress: async () => {
            try {
              const newExpenseData = {
                ...expense,
                recurrence: 'one-time',
                timestamp: new Date(),
                date: new Date().toISOString().slice(0, 10),
                originalRecurrenceId: expense.id,
              };
              delete newExpenseData.id;
              await addExpense(user.uid, expense.cardId, newExpenseData);
              await updateExpense(expense.cardId, expense.id, { timestamp: new Date() });
              Alert.alert('Success', 'New transaction created successfully.');
            } catch (error) {
              console.error("Error recreating transaction:", error);
              Alert.alert('Error', 'Could not create the new transaction.');
            }
          },
        },
      ]
    );
  };

  const handleCancelFrequency = (expense) => {
    Alert.alert(
      "Cancel Recurrence",
      `Are you sure you want to cancel the recurrence for "${expense.description}"? This transaction will no longer be treated as a recurring expense.`,
      [
        { text: 'Keep Recurrence', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateExpense(expense.cardId, expense.id, { recurrence: 'one-time' });
              Alert.alert('Success', 'The transaction is no longer recurring.');
            } catch (error) {
              console.error("Error canceling recurrence:", error);
              Alert.alert('Error', 'Could not cancel the recurrence.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const { nextDate, remaining } = calculateNextDueDate(item);
    const isOverdue = nextDate ? moment().isAfter(nextDate) : false;
    const lastPaidDate = moment(item.timestamp.toDate()).format('MMM D, YYYY');

    const card = activeCards ? activeCards.find(c => c.id === item.cardId) : null;
    const cardColor = card ? card.color : '#333';

    let cat;
    if (expenseCategorizations && item.cardId && expenseCategorizations[item.cardId]) {
        const cardCategorizations = expenseCategorizations[item.cardId];
        const expenseCats = cardCategorizations[item.id] || {};
        const userCategorization = (expenseCats || {})[user.uid] || {};

        if (userCategorization && userCategorization.category) {
            cat = findCategory(userCategorization.category);
        } else {
            cat = findCategory(item.category);
        }
    } else {
        cat = findCategory(item.category);
    }

    return (
      <View style={styles.itemWrapper}>
        <View style={[styles.cardSlide, { backgroundColor: cardColor }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardInfo}>
              <Icon name="sync-alt" size={24} color={'#fff'} />
              <View style={styles.cardTitleContainer}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.cardTypeLabel}>
                    {cat ? `${cat.name} • ` : ''}{item.recurrence}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardBalance}>
            <Text style={styles.balanceAmount}>
              <Icon name={currencyIcon} size={28} color={'#fff'} /> {Math.abs(item.amount).toFixed(2)}
            </Text>
          </View>

          <View>
            <Text style={styles.cardDescription}>Last paid: {lastPaidDate}</Text>
            {nextDate && (
              <Text style={[styles.cardDescription, isOverdue && { color: colors.error, fontWeight: 'bold' }]}>
                {isOverdue ? `Overdue since ${moment(nextDate).format('MMM D, YYYY')}` : `Next: ${moment(nextDate).format('MMM D, YYYY')}`}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleRecreate(item)}>
            <Icon name="plus-circle" size={18} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>Repeat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleCancelFrequency(item)}>
            <Icon name="ban" size={18} color={colors.error} />
            <Text style={[styles.actionButtonText, { color: colors.error }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={18} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recurring Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={recurringExpenses}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Icon name="sync-alt" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No recurring transactions found.</Text>
            <Text style={styles.emptySubText}>Create an expense with a recurrence (e.g. monthly) to see it here.</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  itemWrapper: {
    marginBottom: 20,
  },
  cardSlide: {
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTitleContainer: {
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  cardTypeLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'capitalize',
  },
  cardBalance: {
    alignItems: 'flex-start',
    marginVertical: 20,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FrequencyTransactionsScreen;