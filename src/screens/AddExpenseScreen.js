import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '../config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { getCards, getCategories, addExpense, payCreditCard, addPendingTransaction, getUserProfile, getAccountById, updateAccount, createPurchase } from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';

const dateIdLocal = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const AddExpenseScreen = ({ navigation }) => {
  const { user, triggerDataRefresh } = useAuth();
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    selectedCard: '', // ID de la tarjeta seleccionada
  });
  const [userCards, setUserCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [currencyIcon, setCurrencyIcon] = useState(null);
  const [cardBalances, setCardBalances] = useState({}); // Almacena balances desde API


  // Cargar tarjetas y perfil de usuario
  useEffect(() => {
    if (!user) return;

    const unsubscribeCards = getCards(user.uid, async (cards) => {
      setUserCards(cards);
      setCardsLoading(false);

      // Cargar balances desde Firebase para todas las tarjetas
      const balances = {};
      for (const card of cards) {
        if (card.accountId) {
          try {
            // Obtener balance desde la cuenta de Firebase
            const accountDoc = await getAccountById(card.accountId);
            if (accountDoc.exists()) {
              const accountData = accountDoc.data();
              balances[card.id] = accountData.balance || 0;
            } else {
              balances[card.id] = 0;
            }
          } catch (error) {
            console.error(`Error getting balance for card ${card.id}:`, error);
            balances[card.id] = 0;
          }
        } else {
          // Fallback: usar balance calculado localmente
          balances[card.id] = getCardBalance(card.id);
        }
      }
      setCardBalances(balances);
    });

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

    return () => unsubscribeCards();
  }, [user]);

  const formatAmountInput = (raw) => {
    if (!raw) return '';
    // Permitir un solo punto decimal
    let sanitized = raw.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const integerPartRaw = parts[0];
    const fractionalPartRaw = parts.slice(1).join(''); // descarta puntos extra
    if (!integerPartRaw) return '';
    const withCommas = integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${withCommas}.${fractionalPartRaw}` : withCommas;
  };

  const [categories, setCategories] = useState([]);

  // Cargar tarjetas del usuario
  useEffect(() => {
    if (!user) return;
    const unsubscribe = getCards(user.uid, (cards) => {
      setUserCards(cards);
    });
    return () => unsubscribe();
  }, [user]);

  // Cargar categorías personalizadas del usuario
  useEffect(() => {
    if (!user) return;
    const unsubscribe = getCategories(user.uid, (userCategories) => {
      setCategories(userCategories);
    });
    return () => unsubscribe();
  }, [user]);

  // Reset form when screen loses focus (user navigates away)
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // This cleanup function runs when screen loses focus
        setFormData({
          amount: '',
          description: '',
          selectedCard: '',
        });
      };
    }, [])
  );

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

  const handleSaveExpense = async () => {
    if (!formData.amount) {
      Alert.alert('Error', 'Please enter an amount.');
      return;
    }

    if (!formData.selectedCard) {
      Alert.alert('Error', 'Please select a card.');
      return;
    }

    try {
      const cleanAmount = formData.amount.replace(/,/g, '');
      const amount = parseFloat(cleanAmount);

      // Buscar la tarjeta seleccionada
      const selectedCard = userCards.find(card => card.id === formData.selectedCard);
      if (!selectedCard || !selectedCard.accountId) {
        Alert.alert('Error', 'Selected card is not properly configured.');
        return;
      }

      // 1. Obtener el balance actual de la cuenta
      const accountDoc = await getAccountById(selectedCard.accountId);
      if (!accountDoc.exists()) {
        Alert.alert('Error', 'Account not found.');
        return;
      }

      const accountData = accountDoc.data();
      const currentBalance = accountData.balance || 0;

      // Verificar que hay suficiente balance
      if (currentBalance < amount) {
        Alert.alert('Error', 'Insufficient balance for this purchase.');
        return;
      }

      // 2. Actualizar el balance de la cuenta
      const newBalance = currentBalance - amount;
      await updateAccount(selectedCard.accountId, {
        balance: newBalance,
        updatedAt: new Date()
      });

      // 3. Guardar la compra en la colección purchases
      const purchaseData = {
        userId: user.uid,
        accountId: selectedCard.accountId,
        amount: -amount, // Negativo para expenses
        description: formData.description || 'Purchase',
        date: dateIdLocal(), // YYYY-MM-DD (local)
        timestamp: new Date(),
        status: 'completed',
        type: 'purchase',
      };
      console.log('💾 Purchase data to save:', purchaseData);

      await createPurchase(purchaseData);

      // 3. Trigger refresh para actualizar la UI
      console.log('🔄 Refreshing data after purchase...');
      triggerDataRefresh();

      Alert.alert(
        'Purchase Completed',
        `Purchase of $${amount.toFixed(2)} completed successfully`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      console.error('❌ Error creating purchase:', error);
      Alert.alert('Error', 'Could not complete the purchase. Please try again.');
    }
  };

  const handleCreateCategory = () => {
    navigation.navigate('CreateCategory');
  };

  const handleEditCategories = () => {
    navigation.navigate('EditCategory');
  };

  // Función para manejar selección de tarjeta y obtener balance desde API
  const handleCardSelection = async (cardId) => {
    setFormData({ ...formData, selectedCard: cardId });

    // Buscar la tarjeta seleccionada
    const selectedCard = userCards.find(card => card.id === cardId);
    if (selectedCard && selectedCard.accountId) {
      try {
        // Obtener balance desde Firebase
        const accountDoc = await getAccountById(selectedCard.accountId);
        if (accountDoc.exists()) {
          const accountData = accountDoc.data();
          setCardBalances(prev => ({
            ...prev,
            [cardId]: accountData.balance || 0
          }));
        }
      } catch (error) {
        console.error('Error getting balance from Firebase:', error);
        // Fallback: usar balance calculado localmente
        const localBalance = getCardBalance(cardId);
        setCardBalances(prev => ({
          ...prev,
          [cardId]: localBalance
        }));
      }
    }
  };

  const CategoryButton = ({ category }) => (
    <TouchableOpacity
      style={[
        styles.categoryButton,
        { backgroundColor: category.color },
        formData.category === category.id && styles.selectedCategory
      ]}
      onPress={() => setFormData({ ...formData, category: category.id })}
    >
      <Icon name={category.icon} size={20} color="#fff" />
      <Text style={styles.categoryName}>{category.name}</Text>
    </TouchableOpacity>
  );

  const CardButton = ({ card, isSelected, onPress, balance }) => (
    <TouchableOpacity
      style={[
        styles.cardSelectionButton,
        isSelected && styles.selectedCard
      ]}
      onPress={onPress}
    >
      <View style={[styles.cardIconContainer, { backgroundColor: card.color }]}>
        <Icon
          name={getCardIcon(card.type)}
          size={18}
          color="#fff"
        />
      </View>
      <View style={styles.cardInfo}>
        <Text style={[
          styles.cardNameText,
          isSelected && styles.selectedCardText
        ]}>
          {card.nickname || card.name}
        </Text>
      </View>
      {isSelected && (
        <Icon name="check" size={16} color="#007AFF" />
      )}
    </TouchableOpacity>
  );

  const TypeToggle = () => (
    <View style={styles.typeToggleContainer}>
      <TouchableOpacity
        style={[
          styles.typeToggleButton,
          styles.typeToggleLeft,
          formData.type === 'expense' && styles.typeToggleSelected,
          formData.type === 'expense' && styles.typeToggleExpense
        ]}
        onPress={() => setFormData({ ...formData, type: 'expense' })}
      >
        <Icon 
          name="arrow-down" 
          size={16} 
          color={formData.type === 'expense' ? '#fff' : '#FF3B30'} 
        />
        <Text style={[
          styles.typeToggleText,
          formData.type === 'expense' && styles.typeToggleSelectedText
        ]}>
          Expense
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.typeToggleButton,
          styles.typeToggleRight,
          formData.type === 'income' && styles.typeToggleSelected,
          formData.type === 'income' && styles.typeToggleIncome
        ]}
        onPress={() => setFormData({ ...formData, type: 'income' })}
      >
        <Icon 
          name="arrow-up" 
          size={16} 
          color={formData.type === 'income' ? '#fff' : '#34C759'} 
        />
        <Text style={[
          styles.typeToggleText,
          formData.type === 'income' && styles.typeToggleSelectedText
        ]}>
          Income
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Make a Purchase</Text>
        </View>

        <ScrollView 
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.amountSection}>
            <Text style={styles.sectionTitle}>Amount</Text>
            <View style={styles.amountInputContainer}>
              {currencyIcon && <Icon name={currencyIcon} style={styles.currencySymbol} />}
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#999"
                value={formData.amount}
                onChangeText={(value) => setFormData({ ...formData, amount: formatAmountInput(value) })}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Card Used</Text>
            {cardsLoading ? (
              <View style={styles.noCardsContainer}>
                <Icon name="spinner" size={32} color="#ccc" />
                <Text style={styles.noCardsText}>Loading cards...</Text>
              </View>
            ) : userCards.length === 0 ? (
              <View style={styles.noCardsContainer}>
                <Icon name="credit-card" size={32} color="#ccc" />
                <Text style={styles.noCardsText}>
                  No cards available
                </Text>
              </View>
            ) : (
              <View style={styles.cardsGrid}>
                {userCards.map((card) => (
                  <CardButton
                    key={card.id}
                    card={card}
                    isSelected={formData.selectedCard === card.id}
                    onPress={() => handleCardSelection(card.id)}
                    balance={cardBalances[card.id]}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="What did you purchase?"
              placeholderTextColor="#999"
              value={formData.description}
              onChangeText={(value) => setFormData({ ...formData, description: value })}
              maxLength={100}
              returnKeyType="done"
              blurOnSubmit={true}
            />
          </View>


          </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveExpense}>
            <Icon name="shopping-cart" size={16} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.saveButtonText}>Make Purchase</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
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
    justifyContent: 'flex-start',
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
    fontSize: 28,
    fontWeight: '800',
    color: '#333',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  amountSection: {
    marginBottom: 30,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addCategoryText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 5,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  currencySymbol: {
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
    marginTop: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  noCategoriesText: {
    width: '100%',
    textAlign: 'center',
    color: '#666',
    paddingVertical: 8,
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
  noCardsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  noCardsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    marginBottom: 20,
    textAlign: 'center',
  },
  createCardButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createCardButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
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
  
  // Type Toggle
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  recurrenceContainer: {
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

  payCreditCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000080',
    borderRadius: 12,
    padding: 18,
    gap: 10,
    marginTop: 16,
  },
  payCreditCardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    padding: 18,
    gap: 10,
  },
  goBackButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10, // A bit more padding at the bottom for safe area
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
});

export default AddExpenseScreen; 
