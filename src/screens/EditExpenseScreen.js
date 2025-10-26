import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { getCategories, updateExpense, deleteExpense, getCards, updatePlanExpense, deletePlanExpense, updatePendingTransaction, getCardById, setExpenseCategorization, getUserProfile } from '../services/firestoreService';

const formatDateLocal = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getCardIcon = (type) => {
  switch (type) {
    case 'debit': return 'credit-card';
    case 'credit': return 'credit-card';
    case 'cash': return 'money-bill-wave';
    case 'savings': return 'piggy-bank';
    default: return 'wallet';
  }
};

const getCardTypeLabel = (type) => {
  switch (type) {
    case 'debit': return 'Debit';
    case 'credit': return 'Credit';
    case 'cash': return 'Cash';
    case 'savings': return 'Savings';
    default: return 'Card';
  }
};

const DateSelector = ({ value, onChange }) => {
  const parseLocalMidday = (str) => {
    const parts = (str || '').split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d, 12, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const [date, setDate] = useState(() => parseLocalMidday(value) || (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  })());

  useEffect(() => {
    const parsed = parseLocalMidday(value);
    if (parsed) setDate(parsed);
  }, [value]);

  const handleChange = (_, selected) => {
    const current = selected || date;
    const normalized = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 12, 0, 0, 0);
    setDate(normalized);
    const y = normalized.getFullYear();
    const m = String(normalized.getMonth() + 1).padStart(2, '0');
    const d = String(normalized.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
  };

  return (
    <View>
      <DateTimePicker
        value={date}
        mode="date"
        display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
        onChange={handleChange}
        maximumDate={new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 23, 59, 59, 999)}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
};

const formatAmountInput = (raw) => {
  if (!raw) return '';
  let sanitized = raw.replace(/[^0-9.]/g, '');
  const parts = sanitized.split('.');
  const integerPartRaw = parts[0];
  const fractionalPartRaw = parts.slice(1).join('');
  if (!integerPartRaw) return '';
  const withCommas = integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${withCommas}.${fractionalPartRaw}` : withCommas;
};

const EditExpenseScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { cardId, expense } = route.params; // expense snapshot data
  const [categories, setCategories] = useState([]);
  const [userCards, setUserCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [isSharedCard, setIsSharedCard] = useState(false);
  const [currency, setCurrency] = useState({ code: 'USD', icon: 'dollar-sign' });

  useEffect(() => {
    if (user) {
      getUserProfile(user.uid).then(profileSnap => {
        if (profileSnap.exists()) {
          const profile = profileSnap.data();
          if (profile.currency) {
            setCurrency(profile.currency);
          }
        }
      });
    }
  }, [user]);
  // Function to normalize date to YYYY-MM-DD format
  const normalizeDate = (dateValue) => {
    if (!dateValue) return formatDateLocal(new Date());

    // If it's already a string in YYYY-MM-DD format, return as is
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }

    // If it's a Firestore timestamp, convert to Date
    if (dateValue.toDate) {
      return formatDateLocal(dateValue.toDate());
    }

    // If it's a regular Date object
    if (dateValue instanceof Date) {
      return formatDateLocal(dateValue);
    }

    // Try to parse as string
    try {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        return formatDateLocal(parsed);
      }
    } catch (e) {
      // Ignore parsing errors
    }

    // Fallback to current date
    return formatDateLocal(new Date());
  };

  const [formData, setFormData] = useState({
    amount: '',
    description: expense?.description || '',
    category: expense?.category || '',
    type: expense?.type || 'expense',
    recurrence: expense?.recurrence || 'one-time',
    date: normalizeDate(expense?.date),
  });

  // For pending transactions, we need to set the amount properly
  const isPendingTransaction = expense?.pending === true;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const isCreditPayment = (
    expense?.category === 'Credit Card Payment' &&
    (expense?.sourceCardId || expense?.destinationCardId)
  );

  const onCancelDate = () => {
    setShowDatePicker(false);
  };

  const onConfirmDate = () => {
    const localDate = formatDateLocal(tempDate);
    setFormData({ ...formData, date: localDate });
    setShowDatePicker(false);
  };

  useEffect(() => {
    if (!formData.date) return;
    const parts = formData.date.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const mid = new Date(y, m, d, 12, 0, 0, 0);
      if (!isNaN(mid.getTime())) setTempDate(mid);
    }
  }, [formData.date]);

  useEffect(() => {
    const unsubscribe = getCategories(user.uid, (userCategories) => setCategories(userCategories));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = getCards(user.uid, (cards) => {
      setUserCards(cards);
      setCardsLoading(false);

      // Check if the current card is shared
      if (cardId && cards && Array.isArray(cards)) {
        const currentCard = cards.find(card => card.id === cardId);
        const isShared = currentCard?.isShared || false;

        setIsSharedCard(isShared);
      }
    });
    return () => unsubscribe();
  }, [user, cardId]);

  useEffect(() => {
    const absAmount = Math.abs(expense?.amount || 0);
    setFormData((prev) => ({ ...prev, amount: formatAmountInput(String(Math.round(absAmount))) }));
  }, [expense]);

  // For pending transactions, set card selection if not set
  useEffect(() => {
    if (isPendingTransaction && userCards.length > 0 && !cardId) {
      // Auto-select the first card for pending transactions if no cardId provided
      const firstCard = userCards[0];
      if (firstCard) {
        // Since we're in EditExpenseScreen for pending transactions, we need to handle this differently
        // The cardId should be passed from PendingTransactionsScreen
      }
    }
  }, [isPendingTransaction, userCards, cardId]);

  // Entry animations
  useEffect(() => {
    const startAnimations = () => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
    };

    // Small delay to ensure component is mounted
    setTimeout(startAnimations, 50);
  }, []);

  // Check if this is a plan-linked expense
  const isPlanExpense = expense?.linkedPlanId;

  const handleSave = async () => {
    if (!formData.description || (!isCreditPayment && !formData.category)) {
      Alert.alert('Error', 'Please complete all required fields');
      return;
    }

    try {
      // Unified Logic: Always save the category to the subcollection for consistency.
      await setExpenseCategorization(cardId, expense.id, user.uid, {
        category: formData.category,
      });

      // Then, update the main expense document with other details.
      const payload = {
        description: formData.description,
        date: formData.date,
        recurrence: formData.recurrence,
        status: 'completed', // Ensure status is marked as completed.
      };

      await updateExpense(cardId, expense.id, payload);

      Alert.alert('Saved', 'Transaction updated', [{ text: 'OK', onPress: () => navigation.goBack() }]);

    } catch (e) {
      Alert.alert('Error', 'Could not update the transaction');
    }
  };

  const handleDelete = () => {
    const deleteMessage = isPlanExpense
      ? 'Are you sure you want to delete this transaction? This will also remove it from the associated plan.'
      : 'Are you sure you want to delete this transaction?';

    Alert.alert('Delete', deleteMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          // Delete from card first
          await deleteExpense(cardId, expense.id);

          // If it's a plan expense, also delete from the plan
          if (isPlanExpense && expense.linkedPlanExpenseId) {
            await deletePlanExpense(expense.linkedPlanId, expense.linkedPlanExpenseId);
          }

          navigation.goBack();
        } catch (e) {
          Alert.alert('Error', 'Could not delete the transaction');
        }
      } }
    ]);
  };

  const CategoryButton = ({ category }) => (
    <TouchableOpacity
      style={[styles.categoryButton, { backgroundColor: category.color }, formData.category === category.id && styles.selectedCategory]}
      onPress={() => setFormData({ ...formData, category: category.id })}
    >
      <Icon name={category.icon} size={18} color="#fff" />
      <Text style={styles.categoryName}>{category.name}</Text>
    </TouchableOpacity>
  );

  const TypeToggle = () => (
    <View style={styles.typeToggleContainer}>
      <TouchableOpacity
        style={[
          styles.typeToggleButton,
          styles.typeToggleLeft,
          formData.type === 'expense' && styles.typeToggleSelected,
          formData.type === 'expense' && styles.typeToggleExpense,
        ]}
        onPress={() => setFormData({ ...formData, type: 'expense' })}
      >
        <Icon
          name="arrow-down"
          size={16}
          color={formData.type === 'expense' ? '#fff' : '#FF3B30'}
        />
        <Text
          style={[
            styles.typeToggleText,
            formData.type === 'expense' && styles.typeToggleSelectedText,
          ]}
        >
          Expense
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.typeToggleButton,
          styles.typeToggleRight,
          formData.type === 'income' && styles.typeToggleSelected,
          formData.type === 'income' && styles.typeToggleIncome,
        ]}
        onPress={() => setFormData({ ...formData, type: 'income' })}
      >
        <Icon
          name="arrow-up"
          size={16}
          color={formData.type === 'income' ? '#fff' : '#34C759'}
        />
        <Text
          style={[
            styles.typeToggleText,
            formData.type === 'income' && styles.typeToggleSelectedText,
          ]}
        >
          Income
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ],
        }
      ]}
    >
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="times" size={18} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isPendingTransaction ? 'Categorize Transaction' : 'Edit Transaction'}
          </Text>
          <TouchableOpacity onPress={handleSave}>
            <Icon name="save" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amount</Text>
              <View style={styles.amountRow}>
                <Icon name={currency.icon || 'dollar-sign'} size={32} color="#333" style={{marginRight: 10}} />
                <TextInput
                  style={[styles.amountInput, isPlanExpense && styles.disabledInput]}
                  placeholder="0"
                  placeholderTextColor="#999"
                  value={formData.amount}
                  onChangeText={(value) => setFormData({ ...formData, amount: formatAmountInput(value) })}
                  keyboardType="decimal-pad"
                  editable={!isCreditPayment && !isPlanExpense}
                />
              </View>
              {!isCreditPayment && !isPlanExpense && <TypeToggle />}
              {isPlanExpense && (
                <Text style={styles.planExpenseNote}>
                  Amount and type cannot be modified for plan expenses
                </Text>
              )}
            </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              style={[styles.descriptionInput, isPlanExpense && styles.disabledInput]}
              placeholder="Description"
              placeholderTextColor="#999"
              value={formData.description}
              onChangeText={(v) => setFormData({ ...formData, description: v })}
              maxLength={100}
              returnKeyType="done"
              blurOnSubmit={true}
              editable={!isPlanExpense}
            />
            {isPlanExpense && (
              <Text style={styles.planExpenseNote}>
                Description cannot be modified for plan expenses
              </Text>
            )}
          </View>

          {isPendingTransaction && !isCreditPayment && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Card</Text>
              <View style={styles.cardsGrid}>
                {userCards.map((card) => (
                  <TouchableOpacity
                    key={card.id}
                    style={[
                      styles.cardSelectionButton,
                      cardId === card.id && styles.selectedCard
                    ]}
                    onPress={() => {
                      // Navigate to the same screen with the selected card
                      navigation.navigate('EditExpense', {
                        cardId: card.id,
                        expense: expense,
                      });
                    }}
                  >
                    <View style={[styles.cardIconContainer, { backgroundColor: card.color }]}>
                      <Icon name={getCardIcon(card.type)} size={18} color="#fff" />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardNameText, cardId === card.id && styles.selectedCardText]}>
                        {card.name}
                      </Text>
                      <Text style={styles.cardTypeText}>{getCardTypeLabel(card.type)}</Text>
                    </View>
                    {cardId === card.id && (
                      <Icon name="check" size={16} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {!isCreditPayment && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.categoriesGrid}>
                {categories.map((c) => (
                  <CategoryButton key={c.id} category={c} />
                ))}
              </View>
            </View>
          )}

          {/* Type selection handled by TypeToggle above */}

          {!isCreditPayment && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Frequency</Text>
              <View style={styles.recurrenceRow}>
                {[
                  { key: 'one-time', label: 'One time' },
                  { key: 'monthly', label: 'Monthly' },
                  { key: 'bimonthly', label: 'Bimonthly' },
                  { key: 'quarterly', label: 'Quarterly' },
                  { key: 'semiannual', label: 'Semiannual' },
                  { key: 'annual', label: 'Annual' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.recurrencePill, formData.recurrence === opt.key && styles.recurrencePillActive]}
                    onPress={() => setFormData({ ...formData, recurrence: opt.key })}
                  >
                    <Text style={[styles.recurrenceText, formData.recurrence === opt.key && styles.recurrenceTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {isCreditPayment && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Credit Card Payment</Text>
              {/* To Card (Credit) - UI similar a AddExpenseScreen, deshabilitado */}
              <Text style={[styles.sectionTitle, { fontSize: 16, marginTop: 10 }]}>To Card (Credit)</Text>
              <View style={styles.cardsGrid}>
                {(() => {
                  const creditId = expense.destinationCardId || cardId;
                  const card = userCards.find(c => c.id === creditId && c.type === 'credit');
                  if (!card) return null;
                  return (
                    <View style={[styles.cardSelectionButton, styles.selectedCard, { opacity: 1 }]}>
                      <View style={[styles.cardIconContainer, { backgroundColor: card.color }]}>
                        <Icon name={getCardIcon(card.type)} size={18} color="#fff" />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={[styles.cardNameText, styles.selectedCardText]}>{card.name}</Text>
                        <Text style={styles.cardTypeText}>{getCardTypeLabel(card.type)}</Text>
                      </View>
                      <Icon name="lock" size={16} color="#6c757d" />
                    </View>
                  );
                })()}
              </View>

              {/* From Card (Debit/Cash) - UI similar a AddExpenseScreen, deshabilitado */}
              <Text style={[styles.sectionTitle, { fontSize: 16, marginTop: 20 }]}>From Card (Debit/Cash)</Text>
              <View style={styles.cardsGrid}>
                {(() => {
                  const fromId = expense.sourceCardId || cardId;
                  const card = userCards.find(c => c.id === fromId && (c.type === 'debit' || c.type === 'cash'));
                  if (!card) return null;
                  return (
                    <View style={[styles.cardSelectionButton, styles.selectedCard, { opacity: 1 }]}>
                      <View style={[styles.cardIconContainer, { backgroundColor: card.color }]}>
                        <Icon name={getCardIcon(card.type)} size={18} color="#fff" />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={[styles.cardNameText, styles.selectedCardText]}>{card.name}</Text>
                        <Text style={styles.cardTypeText}>{getCardTypeLabel(card.type)}</Text>
                      </View>
                      <Icon name="lock" size={16} color="#6c757d" />
                    </View>
                  );
                })()}
              </View>
            </View>
          )}

          {!isCreditPayment && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Date</Text>
              <DateSelector
                value={formData.date}
                onChange={(dateString) => setFormData({ ...formData, date: dateString })}
              />
            </View>
          )}

          {!isCreditPayment && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Icon name="trash" size={16} color="#FF3B30" style={{ marginRight: 8 }} />
              <Text style={styles.deleteButtonText}>Delete Transaction</Text>
            </TouchableOpacity>
          )}
          {isCreditPayment && (
            <Text style={{ textAlign: 'center', color: '#666', marginTop: 10, marginBottom: 20 }}>
              This credit card payment cannot be edited.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Modal de fecha eliminado: el DateSelector maneja el cambio de fecha */}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSaveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  currency: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    minWidth: 200,
  },
  descriptionInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  // Cards preview (alineado con AddExpenseScreen)
  cardsGrid: {
    gap: 10,
    marginTop: 8,
  },
  cardSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 15,
    gap: 15,
  },
  selectedCard: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  selectedCardText: {
    color: '#007AFF',
  },
  cardTypeText: {
    fontSize: 12,
    color: '#666',
  },
  categoryButton: {
    width: '48%',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    opacity: 0.8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCategory: {
    opacity: 1,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  categoryName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginTop: 8,
  },
  // Type Toggle (replicado de AddExpenseScreen)
  typeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
    marginBottom: 25,
    marginTop: 10,
  },
  typeToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  typeToggleLeft: {
    marginRight: 2,
  },
  typeToggleRight: {
    marginLeft: 2,
  },
  typeToggleSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  typeToggleExpense: {
    backgroundColor: '#FF3B30',
  },
  typeToggleIncome: {
    backgroundColor: '#34C759',
  },
  typeToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  typeToggleSelectedText: {
    color: '#fff',
  },
  recurrenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  recurrencePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  recurrencePillActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  recurrenceText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  recurrenceTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  planExpenseNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default EditExpenseScreen;
