import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
  FlatList,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getCards, getExpenses, getCategories, getExpenseCategorizationsForCard, getUserProfile } from '../services/firestoreService';
import { colors } from '../styles/colors';
import { StatusBar } from 'expo-status-bar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: screenWidth } = Dimensions.get('window');

// --- Helper Functions ---
const getWeekRange = (date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getWeekOfMonth = (date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return Math.ceil((date.getDate() + firstDay) / 7);
}

// --- Main Component ---
const GeneralScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  // Data State
  const [cards, setCards] = useState([]);
  const [expensesByCard, setExpensesByCard] = useState({});
  const [categories, setCategories] = useState([]);
  const [expenseCategorizations, setExpenseCategorizations] = useState({}); // To store user-specific categorizations
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [currencyIcon, setCurrencyIcon] = useState('euro-sign');

  // UI State
  const [timeFilter, setTimeFilter] = useState('month');
  const [customDateRange, setCustomDateRange] = useState(() => {
    const today = new Date();
    const oneWeekFromToday = new Date(today);
    oneWeekFromToday.setDate(today.getDate() + 7);
    return { start: today, end: oneWeekFromToday };
  });
  const [isRangePickerModalVisible, setRangePickerModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [datePickerStep, setDatePickerStep] = useState('start'); // 'start' or 'end'
  const flatListRef = useRef(null);

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) return;
    const unsubCards = getCards(user.uid, (cs) => {
      setCards(cs);
      setSelectedCardIds(new Set(cs.map(c => c.id)));
      setLoading(false);
    });
    const unsubCats = getCategories(user.uid, setCategories);

    const fetchUserProfile = async () => {
      try {
        const userProfileSnap = await getUserProfile(user.uid);
        if (userProfileSnap.exists()) {
          const userProfile = userProfileSnap.data();
          if (userProfile.currency && userProfile.currency.icon) {
            setCurrencyIcon(userProfile.currency.icon);
          }
        }
      } catch (error) {
        console.error("Failed to fetch user profile for currency icon:", error);
      }
    };
    fetchUserProfile();

    return () => {
      unsubCards && unsubCards();
      unsubCats && unsubCats();
    };
  }, [user]);

  useEffect(() => {
    if (!user || cards.length === 0) return;

    const expenseUnsubscribes = cards.map(card =>
      getExpenses(card.id, (list) => {
        // Add cardId to each expense for context
        const expensesWithCardId = list.map(expense => ({ ...expense, cardId: card.id }));
        setExpensesByCard(prev => ({ ...prev, [card.id]: expensesWithCardId }));
      })
    );

    const categorizationUnsubscribes = cards.map(card =>
      getExpenseCategorizationsForCard(card.id, (categorizations) => {
        setExpenseCategorizations(prev => ({ ...prev, [card.id]: categorizations }));
      })
    );

    return () => {
      expenseUnsubscribes.forEach((u) => u && u());
      categorizationUnsubscribes.forEach((u) => u && u());
    };
  }, [user, cards]);

  // Initialize selected categories with all categories
  useEffect(() => {
    if (categories.length > 0 && selectedCategories.size === 0) {
      const allCategoryIds = categories.map(cat => cat.id);
      setSelectedCategories(new Set(allCategoryIds));
    }
  }, [categories, selectedCategories.size]);

  // Helper to get the correct category for the current user
  const getUserCategoryForExpense = (expense) => {
    // Unified logic: Always prioritize the user-specific categorization, as this is the current data model.
    if (expenseCategorizations && expense.cardId && expense.id && user) {
      const cardCategorizations = expenseCategorizations[expense.cardId] || {};
      const expenseCats = cardCategorizations[expense.id] || {};
      const userCategorization = (expenseCats || {})[user.uid] || {};
      if (userCategorization.category) {
        return userCategorization.category;
      }
    }
    // Fallback for legacy data where the category might be on the expense document itself.
    return expense.category;
  };

  // --- Memoized Computations ---
  const aggregates = useMemo(() => {
    const allExpenses = Array.from(selectedCardIds).flatMap(cardId => expensesByCard[cardId] || []);

    const periodExpenses = allExpenses.filter(e => {
      const expenseDate = new Date(e.timestamp?.toDate() || e.date);
      if (isNaN(expenseDate.getTime())) return false;

      if (timeFilter === 'all') return true;
      if (timeFilter === 'day') return expenseDate.toDateString() === new Date().toDateString();
      if (timeFilter === 'week') {
        const { start, end } = getWeekRange(new Date());
        return expenseDate >= start && expenseDate <= end;
      }
      if (timeFilter === 'month') {
        const today = new Date();
        return expenseDate.getFullYear() === today.getFullYear() && expenseDate.getMonth() === today.getMonth();
      }
      if (timeFilter === 'custom') {
        const start = new Date(customDateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customDateRange.end);
        end.setHours(23, 59, 59, 999);
        return expenseDate >= start && expenseDate <= end;
      }
      return false;
    });

    // Apply category filter
    const filteredExpenses = periodExpenses.filter(e => {
      if (selectedCategories.size === 0) return true;
      const categoryId = getUserCategoryForExpense(e);
      return selectedCategories.has(categoryId);
    });

    const sum = (arr) => arr.reduce((t, e) => t + Number(e.amount || 0), 0);
    const totalIncome = sum(filteredExpenses.filter((e) => e.type === 'income'));
    const totalExpense = sum(filteredExpenses.filter((e) => e.type === 'expense'));
    const netBalance = totalIncome + totalExpense;

    const byCat = filteredExpenses.reduce((acc, e) => {
      if (e.type === 'income') return acc;
      const categoryId = getUserCategoryForExpense(e) || 'Uncategorized';
      if (!acc[categoryId]) acc[categoryId] = { total: 0, count: 0 };
      acc[categoryId].total += Math.abs(Number(e.amount || 0));
      acc[categoryId].count++;
      return acc;
    }, {});

    const augmentedExpenses = filteredExpenses.map(e => ({
        ...e,
        resolvedCategory: getUserCategoryForExpense(e)
    })).sort((a,b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));

    return { totalIncome, totalExpense, netBalance, byCat, periodExpenses: augmentedExpenses };
  }, [expensesByCard, selectedCardIds, timeFilter, customDateRange, categories, expenseCategorizations, cards, user, selectedCategories]);

  const findCategory = (id) => categories.find((c) => c.id === id);

  // --- UI Handlers ---
  const toggleCardSelection = (cardId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const toggleCategorySelection = (categoryId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const selectAllCategories = () => {
    const allCategoryIds = categories.map(cat => cat.id);
    setSelectedCategories(new Set(allCategoryIds));
  };

  const clearAllCategories = () => {
    setSelectedCategories(new Set());
  };

  // --- Date Picker Handlers ---
  const handleStartDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setCustomDateRange(prev => ({ ...prev, start: selectedDate }));
    }
    if (event.type === 'dismissed') {
      setShowStartDatePicker(false);
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setCustomDateRange(prev => ({ ...prev, end: selectedDate }));
    }
    if (event.type === 'dismissed') {
      setShowEndDatePicker(false);
    }
  };

  const handleNextToEndDate = () => {
    setDatePickerStep('end');
    if (Platform.OS === 'ios') {
      // En iOS el picker ya está visible en el modal
    } else {
      // En Android abrimos el diálogo nativo
      setShowEndDatePicker(true);
    }
  };


  const openStartDatePicker = () => {
    setShowStartDatePicker(true);
  };

  const openEndDatePicker = () => {
    setShowEndDatePicker(true);
  };

  // Reset picker state when modal opens/closes
  useEffect(() => {
    if (isRangePickerModalVisible) {
      setDatePickerStep('start');
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
    } else {
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
      setDatePickerStep('start');
    }
  }, [isRangePickerModalVisible]);

  // --- Render Functions for Pager ---
  const renderTransactionList = () => (
    <View style={styles.contentCard}>
      <Text style={styles.sectionTitle}>Transactions</Text>
      {aggregates.periodExpenses.length > 0 ? aggregates.periodExpenses.map(expense => {
        const cat = findCategory(expense.resolvedCategory);
        const isIncome = expense.type === 'income';
        return (
          <View key={expense.id} style={styles.transactionRow}>
            <View style={[styles.categoryIcon, { backgroundColor: cat?.color || colors.border }]}>
              <Icon name={cat?.icon || 'tag'} size={16} color="#fff" />
            </View>
            <View style={styles.transactionDetails}>
              <Text style={styles.transactionDescription}>{expense.description}</Text>
              <Text style={styles.transactionDate}>{new Date(expense.timestamp?.toDate() || expense.date).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.transactionAmount, { color: isIncome ? colors.success : colors.error }]}>
              {isIncome ? '+' : '-'}<Icon name={currencyIcon} size={16} color={isIncome ? colors.success : colors.error} />{`${Math.abs(expense.amount).toFixed(2)}`}
            </Text>
          </View>
        );
      }) : <Text style={styles.emptyText}>No transactions for this period.</Text>}
    </View>
  );

  const renderExpenses = () => (
    <View style={styles.contentCard}>
      <Text style={styles.sectionTitle}>Expenses</Text>
      {aggregates.periodExpenses.filter(e => e.type === 'expense').length > 0 ?
        aggregates.periodExpenses.filter(e => e.type === 'expense').map(expense => {
          const cat = findCategory(expense.resolvedCategory);
          return (
            <View key={expense.id} style={styles.transactionRow}>
              <View style={[styles.categoryIcon, { backgroundColor: cat?.color || colors.border }]}>
                <Icon name={cat?.icon || 'tag'} size={16} color="#fff" />
              </View>
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionDescription}>{expense.description}</Text>
                <Text style={styles.transactionDate}>{new Date(expense.timestamp?.toDate() || expense.date).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.transactionAmount, { color: colors.error }]}>
                -<Icon name={currencyIcon} size={16} color={colors.error} />{`${Math.abs(expense.amount).toFixed(2)}`}
              </Text>
            </View>
          );
        }) : <Text style={styles.emptyText}>No expenses for this period.</Text>}
    </View>
  );

  const renderIncome = () => (
    <View style={styles.contentCard}>
      <Text style={styles.sectionTitle}>Income</Text>
      {aggregates.periodExpenses.filter(e => e.type === 'income').length > 0 ?
        aggregates.periodExpenses.filter(e => e.type === 'income').map(expense => {
          const cat = findCategory(expense.resolvedCategory);
          return (
            <View key={expense.id} style={styles.transactionRow}>
              <View style={[styles.categoryIcon, { backgroundColor: cat?.color || colors.border }]}>
                <Icon name={cat?.icon || 'tag'} size={16} color="#fff" />
              </View>
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionDescription}>{expense.description}</Text>
                <Text style={styles.transactionDate}>{new Date(expense.timestamp?.toDate() || expense.date).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.transactionAmount, { color: colors.success }]}>
                +<Icon name={currencyIcon} size={16} color={colors.success} />{`${Math.abs(expense.amount).toFixed(2)}`}
              </Text>
            </View>
          );
        }) : <Text style={styles.emptyText}>No income for this period.</Text>}
    </View>
  );


  const renderFrequentTransactions = () => {
    // Get recurring transactions similar to FrequencyTransactionsScreen.js
    const recurringExpenses = aggregates.periodExpenses.filter(expense =>
      expense.recurrence && expense.recurrence !== 'one-time'
    );

    const expenseRecurring = recurringExpenses.filter(e => e.type === 'expense');
    const incomeRecurring = recurringExpenses.filter(e => e.type === 'income');

    const calculateNextDueDate = (expense) => {
      const { timestamp, recurrence } = expense;
      const lastDate = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      const nextDate = new Date(lastDate);

      switch (recurrence) {
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'bimonthly':
          nextDate.setMonth(nextDate.getMonth() + 2);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'semiannual':
          nextDate.setMonth(nextDate.getMonth() + 6);
          break;
        case 'annual':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
        default:
          return { nextDate: null, remaining: 'Invalid recurrence' };
      }

      const now = new Date();
      const diffTime = nextDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let remaining;
      if (diffDays === 0) {
        remaining = 'Due today';
      } else if (diffDays === 1) {
        remaining = 'Due tomorrow';
      } else if (diffDays < 0) {
        remaining = `${Math.abs(diffDays)} days overdue`;
      } else {
        remaining = `Due in ${diffDays} days`;
      }

      return { nextDate, remaining, isOverdue: diffDays < 0 };
    };

    return (
      <ScrollView style={styles.contentCard} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Active Recurring Transactions</Text>

        {/* Recurring Expenses */}
        {expenseRecurring.length > 0 && (
          <>
            <Text style={[styles.subSectionTitle, { color: colors.error, marginTop: 20 }]}>Recurring Expenses</Text>
            {expenseRecurring.map(expense => {
              const { nextDate, remaining, isOverdue } = calculateNextDueDate(expense);
              const cat = findCategory(expense.resolvedCategory);
              const card = cards.find(c => c.id === expense.cardId);

              return (
                <View key={expense.id} style={styles.recurringItem}>
                  <View style={styles.recurringHeader}>
                    <View style={[styles.categoryIcon, { backgroundColor: cat?.color || colors.border }]}>
                      <Icon name={cat?.icon || 'tag'} size={16} color="#fff" />
                    </View>
                    <View style={styles.recurringDetails}>
                      <Text style={styles.recurringDescription}>{expense.description}</Text>
                      <Text style={styles.recurringMeta}>
                        {cat?.name || 'Uncategorized'} • {card?.name || 'Unknown Card'} • {expense.recurrence}
                      </Text>
                    </View>
                    <Text style={[styles.recurringAmount, { color: colors.error }]}>
                      -<Icon name={currencyIcon} size={16} color={colors.error} />{Math.abs(expense.amount).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.recurringFooter}>
                    <Text style={styles.recurringDate}>
                      Last: {new Date(expense.timestamp?.toDate ? expense.timestamp.toDate() : expense.timestamp).toLocaleDateString()}
                    </Text>
                    {nextDate && (
                      <Text style={[styles.recurringNext, isOverdue && { color: colors.error, fontWeight: 'bold' }]}>
                        {remaining}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Recurring Income */}
        {incomeRecurring.length > 0 && (
          <>
            <Text style={[styles.subSectionTitle, { color: colors.success, marginTop: expenseRecurring.length > 0 ? 30 : 20 }]}>Recurring Income</Text>
            {incomeRecurring.map(expense => {
              const { nextDate, remaining, isOverdue } = calculateNextDueDate(expense);
              const cat = findCategory(expense.resolvedCategory);
              const card = cards.find(c => c.id === expense.cardId);

              return (
                <View key={expense.id} style={styles.recurringItem}>
                  <View style={styles.recurringHeader}>
                    <View style={[styles.categoryIcon, { backgroundColor: cat?.color || colors.border }]}>
                      <Icon name={cat?.icon || 'tag'} size={16} color="#fff" />
                    </View>
                    <View style={styles.recurringDetails}>
                      <Text style={styles.recurringDescription}>{expense.description}</Text>
                      <Text style={styles.recurringMeta}>
                        {cat?.name || 'Uncategorized'} • {card?.name || 'Unknown Card'} • {expense.recurrence}
                      </Text>
                    </View>
                    <Text style={[styles.recurringAmount, { color: colors.success }]}>
                      +<Icon name={currencyIcon} size={16} color={colors.success} />{Math.abs(expense.amount).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.recurringFooter}>
                    <Text style={styles.recurringDate}>
                      Last: {new Date(expense.timestamp?.toDate ? expense.timestamp.toDate() : expense.timestamp).toLocaleDateString()}
                    </Text>
                    {nextDate && (
                      <Text style={[styles.recurringNext, isOverdue && { color: colors.error, fontWeight: 'bold' }]}>
                        {remaining}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Empty State */}
        {recurringExpenses.length === 0 && (
          <View style={styles.emptyRecurring}>
            <Icon name="sync-alt" size={32} color="#ccc" />
            <Text style={styles.emptyRecurringText}>No active recurring transactions</Text>
            <Text style={styles.emptyRecurringSubtext}>
              Create expenses or income with recurrence (monthly, quarterly, etc.) to see them here.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };



  const PagerContent = [
    { key: 'transactions', render: renderTransactionList },
    { key: 'expenses', render: renderExpenses },
    { key: 'income', render: renderIncome },
    { key: 'frequent', render: renderFrequentTransactions },
  ];

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>

        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodSelector}>
          <TouchableOpacity style={[styles.periodButton, timeFilter === 'all' && styles.periodButtonActive]} onPress={() => setTimeFilter('all')}><Text style={[styles.periodText, timeFilter === 'all' && styles.periodTextActive]}>All</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.periodButton, timeFilter === 'day' && styles.periodButtonActive]} onPress={() => setTimeFilter('day')}><Text style={[styles.periodText, timeFilter === 'day' && styles.periodTextActive]}>Today</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.periodButton, timeFilter === 'week' && styles.periodButtonActive]} onPress={() => setTimeFilter('week')}><Text style={[styles.periodText, timeFilter === 'week' && styles.periodTextActive]}>This Week</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.periodButton, timeFilter === 'month' && styles.periodButtonActive]} onPress={() => setTimeFilter('month')}><Text style={[styles.periodText, timeFilter === 'month' && styles.periodTextActive]}>This Month</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.periodButton, timeFilter === 'custom' && styles.periodButtonActive]} onPress={() => setRangePickerModalVisible(true)}><Icon name="calendar-alt" size={14} color={timeFilter === 'custom' ? '#fff' : colors.textSecondary} /><Text style={[styles.periodText, timeFilter === 'custom' && styles.periodTextActive, { marginLeft: 6 }]}>Custom</Text></TouchableOpacity>
        </ScrollView>

        <View style={styles.summaryContainer}>
            <View style={styles.summaryTopRow}><View style={styles.summaryCard}><Icon name="arrow-up" size={16} color={colors.success} /><Text style={styles.summaryTitle}>Income</Text><Text style={[styles.summaryValue, { color: colors.success }]}><Icon name={currencyIcon} size={20} color={colors.success} />{aggregates.totalIncome.toFixed(2)}</Text></View><View style={styles.summaryCard}><Icon name="arrow-down" size={16} color={colors.error} /><Text style={styles.summaryTitle}>Expenses</Text><Text style={[styles.summaryValue, { color: colors.error }]}><Icon name={currencyIcon} size={20} color={colors.error} />{Math.abs(aggregates.totalExpense).toFixed(2)}</Text></View></View>
            <View style={styles.summaryNetCard}><Icon name="balance-scale" size={16} color={colors.primary} /><Text style={styles.summaryTitle}>Net Balance</Text><Text style={[styles.summaryValue, { color: colors.primary, fontSize: 22 }]}><Icon name={currencyIcon} size={22} color={colors.primary} />{aggregates.netBalance.toFixed(2)}</Text></View>
        </View>

        <View style={styles.section}><Text style={styles.sectionTitle}>Filter by Card</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{cards.map(card => (<TouchableOpacity key={card.id} style={[styles.cardChip, { backgroundColor: selectedCardIds.has(card.id) ? card.color : colors.backgroundSecondary }]} onPress={() => toggleCardSelection(card.id)}><Icon name="credit-card" size={12} color={selectedCardIds.has(card.id) ? '#fff' : colors.textSecondary} /><Text style={[styles.cardChipText, { color: selectedCardIds.has(card.id) ? '#fff' : colors.textSecondary }]}>{card.name}</Text></TouchableOpacity>))}</ScrollView></View>

        <View style={styles.section}>
          <View style={styles.categoryFilterHeader}>
            <Text style={styles.sectionTitle}>Filter by Category</Text>
            <View style={styles.categoryFilterActions}>
              <TouchableOpacity style={styles.filterActionButton} onPress={selectAllCategories}>
                <Text style={styles.filterActionText}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterActionButton} onPress={clearAllCategories}>
                <Text style={[styles.filterActionText, { color: colors.error }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {categories.map(category => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: selectedCategories.has(category.id) ? category.color : colors.backgroundSecondary,
                    borderColor: category.color,
                    borderWidth: 1
                  }
                ]}
                onPress={() => toggleCategorySelection(category.id)}
              >
                <Icon name={category.icon || 'tag'} size={12} color={selectedCategories.has(category.id) ? '#fff' : category.color} />
                <Text style={[
                  styles.categoryChipText,
                  { color: selectedCategories.has(category.id) ? '#fff' : colors.textSecondary }
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View>
          <View style={styles.paginationDots}>{PagerContent.map((_, index) => (<TouchableOpacity key={index} onPress={() => flatListRef.current.scrollToIndex({ index, animated: true })}><View style={[styles.dot, { backgroundColor: currentPage === index ? colors.primary : colors.border }]} /></TouchableOpacity>))}</View>
          <FlatList ref={flatListRef} horizontal pagingEnabled data={PagerContent} keyExtractor={item => item.key} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <View style={styles.pageStyle}>{item.render()}</View>} onScroll={e => {const x = e.nativeEvent.contentOffset.x; setCurrentPage(Math.round(x / screenWidth));}} scrollEventThrottle={16}/>
        </View>

      </ScrollView>

      <Modal animationType="slide" transparent={true} visible={isRangePickerModalVisible} onRequestClose={() => setRangePickerModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {datePickerStep === 'start' ? 'Select Start Date' : 'Select End Date'}
            </Text>

            {datePickerStep === 'start' ? (
              <>
                <TouchableOpacity style={styles.datePickerRow} onPress={openStartDatePicker}>
                  <Text style={styles.datePickerLabel}>Start Date</Text>
                  <View style={styles.dateDisplay}>
                    <Text style={styles.dateDisplayText}>{customDateRange.start.toLocaleDateString()}</Text>
                  </View>
                  <Icon name="calendar" size={16} color={colors.primary} style={{ marginLeft: 10 }} />
                </TouchableOpacity>

                {/* Start Date Picker inside modal - SOLO PARA iOS */}
                {Platform.OS === 'ios' && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={customDateRange.start}
                      mode="date"
                      display="spinner"
                      onChange={handleStartDateChange}
                      maximumDate={customDateRange.end}
                      textColor={colors.text}
                    />
                  </View>
                )}

                <TouchableOpacity style={styles.applyButton} onPress={handleNextToEndDate}>
                  <Text style={styles.applyButtonText}>Next</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.datePickerRow}>
                  <Text style={styles.datePickerLabel}>Start Date</Text>
                  <View style={styles.dateDisplay}>
                    <Text style={styles.dateDisplayText}>{customDateRange.start.toLocaleDateString()}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.datePickerRow} onPress={openEndDatePicker}>
                  <Text style={styles.datePickerLabel}>End Date</Text>
                  <View style={styles.dateDisplay}>
                    <Text style={styles.dateDisplayText}>{customDateRange.end.toLocaleDateString()}</Text>
                  </View>
                  <Icon name="calendar" size={16} color={colors.primary} style={{ marginLeft: 10 }} />
                </TouchableOpacity>

                {/* End Date Picker inside modal - SOLO PARA iOS */}
                {Platform.OS === 'ios' && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={customDateRange.end}
                      mode="date"
                      display="spinner"
                      onChange={handleEndDateChange}
                      minimumDate={customDateRange.start}
                      textColor={colors.text}
                    />
                  </View>
                )}

                <TouchableOpacity style={styles.applyButton} onPress={() => { setTimeFilter('custom'); setRangePickerModalVisible(false); }}>
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Date Pickers para Android - Aparecen como diálogos nativos */}
      {showStartDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={customDateRange.start}
          mode="date"
          display="default"
          onChange={handleStartDateChange}
          maximumDate={customDateRange.end}
        />
      )}

      {showEndDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={customDateRange.end}
          mode="date"
          display="default"
          onChange={handleEndDateChange}
          minimumDate={customDateRange.start}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scrollContent: { paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  periodSelector: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  periodButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.backgroundSecondary },
  periodButtonActive: { backgroundColor: colors.primary },
  periodText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  periodTextActive: { color: '#fff' },
  summaryContainer: { paddingHorizontal: 20, marginBottom: 20, gap: 10 },
  summaryTopRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, gap: 4 },
  summaryNetCard: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, gap: 4, alignItems: 'center' },
  summaryTitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  summaryValue: { fontSize: 20, fontWeight: 'bold' },
  section: { marginBottom: 25, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 15 },
  cardChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 12, gap: 6 },
  cardChipText: { fontSize: 14, fontWeight: '600' },
  pageStyle: { width: screenWidth },
  paginationDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15, paddingTop: 10 },
  dot: { width: 20, height: 3, borderRadius: 2, marginHorizontal: 3 },
  contentCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, minHeight: 300 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.backgroundSecondary },
  categoryInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  categoryIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  categoryName: { fontSize: 16, fontWeight: '600', color: colors.text },
  categoryTransactions: { fontSize: 12, color: colors.textSecondary },
  categoryAmount: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  transactionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.backgroundSecondary },
  transactionDetails: { flex: 1 },
  transactionDescription: { fontSize: 14, fontWeight: '600', color: colors.text },
  transactionDate: { fontSize: 12, color: colors.textSecondary },
  transactionAmount: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 20, fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '90%', gap: 15 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  datePickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  datePickerLabel: { fontSize: 16, fontWeight: '500' },
  dateDisplay: { backgroundColor: colors.backgroundSecondary, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10 },
  dateDisplayText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  applyButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  applyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  chartContainer: { padding: 10, minHeight: 200 },
  pieChartPlaceholder: { height: 30, borderRadius: 15, flexDirection: 'row', overflow: 'hidden', marginBottom: 15, backgroundColor: colors.border },
  pieSegmentLabel: { fontSize: 10, color: '#fff', fontWeight: 'bold', textAlign: 'center', lineHeight: 30 },
  legendContainer: { paddingTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  legendText: { fontSize: 14, color: colors.textSecondary },
  netCategoryItem: { justifyContent: 'space-between', width: '100%' },
  netCategoryInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netAmount: { fontSize: 16, fontWeight: 'bold' },
  trendChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 140, marginBottom: 15 },
  trendBar: { alignItems: 'center', flex: 1 },
  trendBarContainer: { height: 120, width: '60%', justifyContent: 'flex-end', alignItems: 'center' },
  trendIncomeBar: { width: 15, backgroundColor: colors.success, borderTopLeftRadius: 3, borderTopRightRadius: 3, position: 'absolute', right: '55%' },
  trendExpenseBar: { width: 15, backgroundColor: colors.error, borderTopLeftRadius: 3, borderTopRightRadius: 3, position: 'absolute', left: '55%' },
  trendLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 5 },
  trendLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  trendLegendItem: { flexDirection: 'row', alignItems: 'center' },

  // Category Filter Styles
  categoryFilterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  categoryFilterActions: { flexDirection: 'row', gap: 15 },
  filterActionButton: { paddingVertical: 4, paddingHorizontal: 8 },
  filterActionText: { fontSize: 14, fontWeight: '500', color: colors.primary },
  categoryChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, gap: 6 },
  categoryChipText: { fontSize: 14, fontWeight: '600' },

  // Frequent Transactions Styles
  subSectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  recurringItem: { backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: 15, marginBottom: 10 },
  recurringHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  recurringDetails: { flex: 1, marginLeft: 12 },
  recurringDescription: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 2 },
  recurringMeta: { fontSize: 12, color: colors.textSecondary },
  recurringAmount: { fontSize: 16, fontWeight: 'bold' },
  recurringFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recurringDate: { fontSize: 12, color: colors.textSecondary },
  recurringNext: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  emptyRecurring: { alignItems: 'center', paddingVertical: 40 },
  emptyRecurringText: { fontSize: 16, color: colors.textSecondary, marginTop: 15, marginBottom: 5 },
  emptyRecurringSubtext: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', maxWidth: 280 },
  pickerContainer: { marginVertical: 15, alignItems: 'center' },
});

export default GeneralScreen;