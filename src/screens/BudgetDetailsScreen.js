import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import {
  getBudget,
  getCards,
  getExpenses,
  deleteBudget,
  getUserProfile,
  getExpenseCategorizationsForCard
} from '../services/firestoreService';

const getWeekOfMonth = (date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return Math.ceil((date.getDate() + firstDay) / 7);
};

const { width: screenWidth } = Dimensions.get('window');

// --- PeriodView Component ---
const PeriodView = ({ periodData, budget, currency, findCard, formatDate, formatCurrency, getUserCategoryForExpense }) => {
  const { title, expenses: periodExpenses, isCurrentPeriod } = periodData;

  const stats = useMemo(() => {
    const totalSpent = periodExpenses.filter(e => e.amount < 0).reduce((sum, expense) => sum + Math.abs(expense.amount), 0);
    const targetAmount = budget.targetAmount || 0;
    const remainingAmount = Math.max(0, targetAmount - totalSpent);
    const progressPercentage = targetAmount > 0 ? Math.min(100, (totalSpent / targetAmount) * 100) : 0;
    return { totalSpent, targetAmount, remainingAmount, progressPercentage };
  }, [periodExpenses, budget]);

  const renderExpenseItem = ({ item }) => {
    const card = findCard(item.cardId);
    const isIncome = item.amount > 0;
    return (
      <TouchableOpacity key={item.id} style={styles.expenseItem} activeOpacity={0.8}>
        <View style={styles.expenseLeft}>
          <Text style={styles.expenseDescription}>{item.description || 'Without Description'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Icon name="credit-card" size={12} color="#666" />
            <Text style={styles.expenseMeta}>{card ? card.name : 'Unknown Card'}</Text>
          </View>
        </View>
        <View style={styles.expenseRight}>
          <Text style={[styles.expenseAmount, isIncome ? styles.expensePositive : styles.expenseNegative]}>
            {isIncome ? '+' : '-'}
            <Icon name={currency.icon || 'dollar-sign'} size={14} />
            {formatCurrency(item.amount)}
          </Text>
          <Text style={styles.expenseDate}>{formatDate(item.date)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.periodContainer}>
      <ScrollView
        style={styles.periodScrollView}
        contentContainerStyle={styles.periodContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with period title */}
        <View style={styles.periodHeader}>
          <Text style={styles.periodTitle}>
            {title} {isCurrentPeriod ? '(Current)' : ''}
          </Text>
        </View>

        {/* Budget Card */}
        <View style={styles.statsContainer}>
          <View style={[styles.budgetCard, { backgroundColor: budget.categoryColor || colors.cardColors.blue }]}>
            <View style={styles.budgetHeader}>
              <View style={styles.iconPill}>
                <Icon name={budget.categoryIcon || 'tag'} size={16} color="#fff" />
              </View>
              <View style={styles.budgetInfo}>
                <Text style={[styles.budgetTitle, { color: '#fff' }]}>{budget.categoryName}</Text>
                <Text style={[styles.budgetSubtitle, { color: 'rgba(255,255,255,0.85)' }]}>
                  {budget.type === 'savings' ? 'Savings Goal' : 'Budget'} • {budget.frequency || 'Monthly'}
                </Text>
              </View>
            </View>

            <View style={styles.amountsRow}>
              <Text style={[styles.currentAmount, { color: '#fff' }]}>
                <Icon name={currency.icon || 'dollar-sign'} size={24} /> {formatCurrency(stats.totalSpent)}
              </Text>
              <Text style={[styles.targetAmount, { color: 'rgba(255,255,255,0.85)' }]}>
                / <Icon name={currency.icon || 'dollar-sign'} size={16} /> {formatCurrency(stats.targetAmount)}
              </Text>
            </View>

            <View style={styles.progressContainer}>
              <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
              <View style={[
                styles.progressFill,
                {
                  width: `${stats.progressPercentage}%`,
                  backgroundColor: stats.progressPercentage > 90 ? '#FF3B30' : stats.progressPercentage > 75 ? '#FF9500' : '#34C759'
                }
              ]} />
            </View>

            <View style={styles.statsRow}>
              <Text style={[styles.statsText, { color: '#fff' }]}>
                {stats.progressPercentage.toFixed(0)}% used
              </Text>
              <Text style={[styles.statsText, { color: 'rgba(255,255,255,0.85)' }]}>
                <Icon name={currency.icon || 'dollar-sign'} size={14} /> {formatCurrency(stats.remainingAmount)} remaining
              </Text>
            </View>
          </View>
        </View>

        {/* Transactions Section */}
        <View style={styles.expensesSection}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          {periodExpenses.length === 0 ? (
            <View style={styles.emptyExpenses}>
              <Icon name="receipt" size={32} color="#ccc" />
              <Text style={styles.emptyExpensesText}>No transactions in this period</Text>
            </View>
          ) : (
            <View style={styles.expensesList}>
              {periodExpenses.length > 0 ? (
                periodExpenses.map(item => renderExpenseItem({ item }))
              ) : (
                <View style={styles.noExpenses}>
                  <Icon name="receipt" size={32} color="#ccc" />
                  <Text style={styles.noExpensesText}>
                    No transactions in this period yet
                  </Text>
                  <Text style={styles.noExpensesSubtext}>
                    Transactions will appear here as you add them
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};


// --- Main Screen Component ---
const BudgetDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { budgetId } = route.params;
  const { user } = useAuth();

  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0);

  const flatListRef = useRef(null);

  const onPeriodViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      setCurrentPeriodIndex(newIndex || 0);
    }
  }).current;

  const [budget, setBudget] = useState(null);
  const [cards, setCards] = useState([]);
  const [expensesByCard, setExpensesByCard] = useState({});
  const [expenseCategorizations, setExpenseCategorizations] = useState({});
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState({ code: 'USD', icon: 'dollar-sign' });

  // Effect to fetch main budget data, cards, and user profile
  useEffect(() => {
    if (!user || !budgetId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const budgetUnsub = getBudget(budgetId, (budgetData) => {
      setBudget(budgetData);
      setLoading(false); // Stop loading once main budget doc is fetched
    });

    const cardsUnsub = getCards(user.uid, setCards);

    getUserProfile(user.uid).then(profileSnap => {
      if (profileSnap.exists()) {
        const profile = profileSnap.data();
        if (profile.currency) setCurrency(profile.currency);
      }
    });

    return () => {
      budgetUnsub();
      cardsUnsub();
    };
  }, [user, budgetId]);

  // Effect to fetch expenses and categorizations for each card
  useEffect(() => {
    if (cards.length === 0) {
      setExpensesByCard({});
      setExpenseCategorizations({});
      return;
    }

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
      expenseUnsubscribes.forEach(unsub => unsub());
      categorizationUnsubscribes.forEach(unsub => unsub());
      setExpensesByCard({});
      setExpenseCategorizations({});
    };
  }, [cards]);

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

  // Memo to derive final expenses list from expensesByCard state
  const allExpenses = useMemo(() => {
    const expenses = [];
    for (const cardId in expensesByCard) {
      expensesByCard[cardId].forEach(expense => {
        expenses.push({ ...expense, cardId });
      });
    }
    const filtered = expenses
      .filter(exp => {
        const resolvedCategory = getUserCategoryForExpense(exp);
        const matches = resolvedCategory === budget?.categoryId;
        console.log('Expense:', exp.description, 'resolved category:', resolvedCategory, 'budget category:', budget?.categoryId, 'matches:', matches);
        return matches;
      })
      .sort((a, b) => new Date(b.timestamp?.toDate() || b.date) - new Date(a.timestamp?.toDate() || a.date));

    console.log('Total expenses before filtering:', expenses.length);
    console.log('Filtered expenses:', filtered.length);
    return filtered;
  }, [expensesByCard, budget, expenseCategorizations, user]);

  const historicalPeriods = useMemo(() => {
    console.log('Generating historical periods - budget:', budget, 'allExpenses length:', allExpenses.length);

    if (!budget) {
      console.log('No budget found');
      return [];
    }

    // If no expenses, still show current period as demo
    if (!allExpenses.length) {
      console.log('No expenses found for this budget category');
      const now = new Date();
      const currentPeriod = {
        title: budget.frequency === 'weekly'
          ? `Week ${Math.ceil((now.getDate() - now.getDay() + 1) / 7)}, ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`
          : budget.frequency === 'yearly'
          ? `${now.getFullYear()}`
          : `${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        startDate: now,
        endDate: now,
        expenses: [],
        isCurrentPeriod: true
      };
      return [currentPeriod];
    }

    const periods = [];
    const now = new Date();
    const frequency = budget.frequency || 'monthly';
    const maxPeriods = 12; // Show up to 12 historical periods

    for (let i = 0; i < maxPeriods; i++) {
      let periodStart, periodEnd, periodTitle;

      switch (frequency) {
        case 'weekly': {
          // Calculate week start (Monday) for each week back
          const currentWeekStart = new Date(now);
          currentWeekStart.setDate(now.getDate() - now.getDay()); // Monday of current week
          currentWeekStart.setHours(0, 0, 0, 0);

          // Go back i weeks from current week start
          periodStart = new Date(currentWeekStart);
          periodStart.setDate(currentWeekStart.getDate() - (i * 7));

          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 6);
          periodEnd.setHours(23, 59, 59, 999);

          periodTitle = `${periodStart.toLocaleString('default', { month: 'long', year: 'numeric' })}\n${periodStart.toLocaleDateString('en-US', {day: 'numeric', month: 'short'})} - ${periodEnd.toLocaleDateString('en-US', {day: 'numeric', month: 'short'})}`;
          break;
        }
        case 'yearly': {
          const year = now.getFullYear() - i;
          periodStart = new Date(year, 0, 1);
          periodEnd = new Date(year, 11, 31, 23, 59, 59, 999);
          periodTitle = `${year}\n${periodStart.toLocaleDateString('en-US', {day: 'numeric', month: 'short'})} - ${periodEnd.toLocaleDateString('en-US', {day: 'numeric', month: 'short'})}`;
          break;
        }
        default: { // monthly
          const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          periodStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
          periodEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
          periodTitle = `${targetDate.toLocaleString('default', { month: 'long', year: 'numeric' })}\n${periodStart.toLocaleDateString('en-US', {day: 'numeric', month: 'short'})} - ${periodEnd.toLocaleDateString('en-US', {day: 'numeric', month: 'short'})}`;
        }
      }

      // Filter expenses for this period
      const periodExpenses = allExpenses.filter(expense => {
        const expenseDate = new Date(expense.timestamp?.toDate() || expense.date);
        return expenseDate >= periodStart && expenseDate <= periodEnd;
      });

      // Only include periods that have expenses or are recent (current/last period)
      // Always include current period (i === 0) even if no expenses
      if (periodExpenses.length > 0 || i === 0) {
        periods.push({
          title: periodTitle,
          startDate: periodStart,
          endDate: periodEnd,
          expenses: periodExpenses,
          isCurrentPeriod: i === 0
        });
      }
    }

    return periods;
  }, [budget, allExpenses]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString) => {
    const parts = (dateString || '').split('-');
    const date = parts.length === 3
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0, 0)
      : new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  const findCard = (cardId) => cards.find((c) => c.id === cardId);

  const groupedExpenses = useMemo(() => {
    if (!allExpenses.length || !budget) return [];

    const getPeriodKey = (date) => {
      if (budget.frequency === 'weekly') {
        const week = getWeekOfMonth(date);
        return `Week ${week}, ${date.toLocaleString('default', { month: 'long' })}`;
      }
      return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const groups = allExpenses.reduce((acc, expense) => {
      const expenseDate = new Date(expense.timestamp?.toDate() || expense.date);
      const key = getPeriodKey(expenseDate);
      if (!acc[key]) acc[key] = [];
      acc[key].push(expense);
      return acc;
    }, {});

    return Object.entries(groups).map(([title, data]) => ({ title, data }));
    }, [allExpenses, budget]);

  const handleEditBudget = () => {
    if (!budget) return;
    navigation.navigate('BudgetEditScreen', { budget });
  };

  const handleDeleteBudget = () => {
    Alert.alert(
      'Delete Budget',
      'Are you sure you want to delete this budget? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBudget(budgetId);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting budget:', error);
              Alert.alert('Error', 'Could not delete budget');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!budget) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Budget Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="exclamation-triangle" size={48} color="#666" />
          <Text style={styles.emptyTitle}>Budget not found</Text>
        </View>
      </View>
    );
  }

  console.log('Rendering BudgetDetailsScreen - budget:', !!budget, 'loading:', loading, 'historicalPeriods:', historicalPeriods.length);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{budget.categoryName}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleEditBudget}>
            <Icon name="edit" size={16} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleDeleteBudget}>
            <Icon name="trash" size={16} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

        <View style={styles.mainContent}>
          {historicalPeriods.length === 0 ? (
              <View style={styles.emptyContainer}>
                  <Icon name="receipt" size={48} color="#ccc" />
                  <Text style={styles.emptyTitle}>No data available</Text>
                  <Text style={styles.emptySubtitle}>Historical budget periods will appear here.</Text>
              </View>
            ) : (

            <>
              <FlatList
                ref={flatListRef}
                data={historicalPeriods}
                renderItem={({ item }) => (
                  <PeriodView
                    periodData={item}
                    budget={budget}
                    currency={currency}
                    findCard={findCard}
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                    getUserCategoryForExpense={getUserCategoryForExpense}
                  />
                )}
                keyExtractor={(item) => item.title}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onPeriodViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                getItemLayout={(data, index) => ({
                  length: screenWidth,
                  offset: screenWidth * index,
                  index,
                })}
                initialScrollIndex={0} // Show current period first
              />

              {/* Page Indicators */}
              {historicalPeriods.length > 1 && (
                <View style={styles.pageIndicators}>
                  {historicalPeriods.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.pageDot,
                        index === currentPeriodIndex && styles.pageDotActive
                      ]}
                      onPress={() => {
                        flatListRef.current?.scrollToIndex({
                          index,
                          animated: true
                        });
                      }}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </View>
    );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mainContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.background,
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
  content: {
    paddingBottom: 40,
  },

  // Period View Styles
  periodContainer: {
    width: screenWidth,
    flex: 1,
  },
  periodScrollView: {
    flex: 1,
  },
  periodContent: {
    paddingBottom: 100, // Extra padding for page indicators
  },
  periodHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  periodTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  budgetCard: {
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetInfo: {
    marginLeft: 10,
    flex: 1,
  },
  budgetTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  budgetSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  amountsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
    justifyContent: 'flex-start',
  },
  currentAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  targetAmount: {
    fontSize: 16,
    marginLeft: 4,
  },
  progressContainer: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  progressTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  expensesSection: {
    paddingHorizontal: 20,
    paddingTop: 30,
    flex: 1,
  },
  expensesList: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyExpenses: {
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  emptyExpensesText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    textAlign: 'center'
  },
  noExpenses: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noExpensesText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 15,
    allowFontScaling: false,
  },
  noExpensesSubtext: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 8,
    allowFontScaling: false,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  expenseLeft: {
    flex: 1,
    marginRight: 10,
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
  },
  expenseDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  expenseNegative: {
    color: colors.error,
  },
  expensePositive: {
    color: colors.success,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Page Indicators
  pageIndicators: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 4,
  },
  pageDotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
});

export default BudgetDetailsScreen;
''