import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { getCards, getCategories, updatePendingTransaction, getUserProfile } from '../services/firestoreService';

const CategorizeTransactionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { transaction } = route.params || {};

  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currencyIcon, setCurrencyIcon] = useState(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribeCards = getCards(user.uid, (userCards) => {
      setCards(userCards);
    });

    const unsubscribeCategories = getCategories(user.uid, (userCategories) => {
      setCategories(userCategories);
    });

    const fetchUserProfile = async () => {
      const profileSnap = await getUserProfile(user.uid);
      if (profileSnap.exists()) {
        const profile = profileSnap.data();
        if (profile.currency && profile.currency.icon) {
          setCurrencyIcon(profile.currency.icon);
        }
      }
    };
    fetchUserProfile();

    return () => {
      unsubscribeCards && unsubscribeCards();
      unsubscribeCategories && unsubscribeCategories();
    };
  }, [user]);

  const handleSave = async () => {
    if (!selectedCard || !selectedCategory) {
      Alert.alert('Error', 'Please select a card and a category.');
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        cardId: selectedCard.id,
        category: selectedCategory.id,
        categoryName: selectedCategory.name,
        cardName: selectedCard.name,
        amount: transaction.amount,
        description: transaction.description,
        type: transaction.type,
        date: transaction.date,
        userId: user.uid,
      };

      await updatePendingTransaction(transaction.id, updateData);

      Alert.alert(
        'Success',
        'Transaction categorized successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error categorizing transaction:', error);
      Alert.alert('Error', 'Could not categorize transaction');
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Transaction not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Categorize Transaction</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Transaction Details */}
        <View style={styles.transactionCard}>
          <View style={styles.transactionHeader}>
            <View style={[styles.transactionIcon, { backgroundColor: transaction.type === 'income' ? '#34C759' : '#FF3B30' }]}>
              <Icon name={transaction.type === 'income' ? 'plus' : 'minus'} size={16} color="#fff" />
            </View>
            <View>
              <Text style={styles.transactionDescription}>{transaction.description}</Text>
              <Text style={styles.transactionDate}>{transaction.date}</Text>
            </View>
          </View>
          <Text style={[styles.transactionAmount, transaction.type === 'income' ? styles.amountPositive : styles.amountNegative]}>
            {transaction.type === 'income' ? '+' : '-'}{currencyIcon && <Icon name={currencyIcon} size={18} color={transaction.type === 'income' ? styles.amountPositive.color : styles.amountNegative.color} />} {Math.abs(transaction.amount).toFixed(2)}
          </Text>
        </View>

        {/* Card Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Card</Text>
          {cards.length === 0 ? (
            <Text style={styles.emptyText}>No cards available</Text>
          ) : (
            cards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.optionItem,
                  selectedCard?.id === card.id && styles.optionItemSelected
                ]}
                onPress={() => setSelectedCard(card)}
              >
                <View style={[styles.cardIcon, { backgroundColor: card.color || '#007AFF' }]}>
                  <Icon name="credit-card" size={14} color="#fff" />
                </View>
                <Text style={styles.optionText}>{card.name}</Text>
                {selectedCard?.id === card.id && (
                  <Icon name="check" size={16} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Category</Text>
          {categories.length === 0 ? (
            <Text style={styles.emptyText}>No categories available</Text>
          ) : (
            categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.optionItem,
                  selectedCategory?.id === category.id && styles.optionItemSelected
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <View style={[styles.categoryIcon, { backgroundColor: category.color || '#007AFF' }]}>
                  <Icon name={category.icon || 'tag'} size={14} color="#fff" />
                </View>
                <Text style={styles.optionText}>{category.name}</Text>
                {selectedCategory?.id === category.id && (
                  <Icon name="check" size={16} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!selectedCard || !selectedCategory || loading) && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={!selectedCard || !selectedCategory || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="save" size={16} color="#fff" />
              <Text style={styles.saveButtonText}>Save Categorization</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 100,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  amountPositive: {
    color: '#34C759',
  },
  amountNegative: {
    color: '#FF3B30',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  optionItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E3F2FD',
  },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default CategorizeTransactionScreen;
