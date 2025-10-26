import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { getBudgets, getCards, getExpenses, getExpenseCategorizationsForCard, getCategories, getUserProfile } from '../services/firestoreService';

const BudgetManagementScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Centralized data states
  const [budgets, setBudgets] = useState([]);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expensesByCard, setExpensesByCard] = useState({});
  const [expenseCategorizations, setExpenseCategorizations] = useState({});
  const [currency, setCurrency] = useState({ code: 'EUR', icon: 'euro-sign' });

  // --- Data Fetching --- //

  // Fetch budgets and user's personal categories
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const unsubBudgets = getBudgets(user.uid, (list) => {
      setBudgets(list);
      setLoading(false);
    });
    const unsubCats = getCategories(user.uid, setCategories);

    const fetchUserProfile = async () => {
      const profileSnap = await getUserProfile(user.uid);
      if (profileSnap.exists()) {
        const profile = profileSnap.data();
        if (profile.currency) {
          setCurrency(profile.currency);
        }
      }
    };
    fetchUserProfile();

    return () => {
      unsubBudgets();
      unsubCats();
    };
  }, [user]);

  // Fetch all cards the user is a member of
  useEffect(() => {
    if (!user) return;
    const unsubCards = getCards(user.uid, setCards);
    return () => unsubCards();
  }, [user]);

  // Fetch all expenses for all cards
  useEffect(() => {
    if (cards.length === 0) {
      setExpensesByCard({});
      return;
    }
    const unsubscribes = cards.map(card =>
      getExpenses(card.id, (expenses) => {
        setExpensesByCard(prev => ({ ...prev, [card.id]: expenses.map(e => ({ ...e, cardId: card.id })) }));
      })
    );
    return () => unsubscribes.forEach(unsub => unsub());
  }, [cards]);

  // Fetch all categorizations for all cards
  useEffect(() => {
    if (cards.length === 0) {
      setExpenseCategorizations({});
      return;
    }
    const unsubscribes = cards.map(card =>
      getExpenseCategorizationsForCard(card.id, (categorizations) => {
        setExpenseCategorizations(prev => ({ ...prev, [card.id]: categorizations }));
      })
    );
    return () => unsubscribes.forEach(unsub => unsub());
  }, [cards]);


  // --- Memoized Computations --- //

  

  const getBudgetTypeLabel = (type) => {
    switch(type) {
      case 'savings': return 'Savings';
      case 'expense': return 'Budget';
      default: return 'Budget';
    }
  };

  const getFrequencyLabel = (frequency) => {
    switch(frequency) {
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'yearly': return 'Yearly';
      default: return 'One-time';
    }
  };

  const renderBudgetItem = ({ item }) => {
    const bgColor = item.categoryColor || colors.cardColors.blue;
    const textPrimary = '#ffffff';
    const textSecondary = 'rgba(255,255,255,0.85)';

    const formatNumber = (num) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

    return (
      <TouchableOpacity
        style={[styles.budgetCard, { backgroundColor: bgColor }]}
        onPress={() => navigation.navigate('BudgetDetails', { budgetId: item.id })}
        activeOpacity={0.9}
      >
        <View style={styles.budgetHeader}>
          <View style={styles.budgetHeaderLeft}>
            <View style={styles.iconPill}>
              <Icon name={item.categoryIcon || 'tag'} size={16} color={textPrimary} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.budgetTitle, { color: textPrimary }]} numberOfLines={1}>
                {item.categoryName}
              </Text>
              <Text style={[styles.budgetSubtitle, { color: textSecondary }]} numberOfLines={1}>
                {getBudgetTypeLabel(item.type)} • {getFrequencyLabel(item.frequency)}
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={14} color={textSecondary} />
        </View>

        <View style={styles.budgetContent}>
          <Text style={[styles.targetLabel, { color: textSecondary }]}>
            Target: {currency.icon && <Icon name={currency.icon} size={14} color={textSecondary} style={{ marginRight: 4 }} />} {formatNumber(Number(item.targetAmount || 0))}
          </Text>
        </View>
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
        <Text style={styles.headerTitle}>Budgets</Text>
        <View style={{ width: 40 }} />
      </View>

      {budgets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Icon name="chart-pie" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No budgets yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first budget to start tracking your expenses
            </Text>

            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('BudgetCreate')}
            >
              <Icon name="plus" size={16} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.createButtonText}>Create Budget</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={budgets}
          renderItem={renderBudgetItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button */}
      {budgets.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.fab}
          onPress={() => navigation.navigate('BudgetCreate')}
        >
          <Icon name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 15,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  listContainer: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  budgetCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  budgetContent: {
  },
  amountsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBarTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  budgetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
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
  budgetTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  budgetSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 12,
  },
  targetLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default BudgetManagementScreen;
