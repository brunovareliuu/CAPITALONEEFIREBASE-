
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
import { getCards, getCategories, addContributionToPlan, getUserProfile } from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';

const dateIdLocal = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const AddContributionScreen = ({ route, navigation }) => {
  const { plan, member } = route.params;
  const { user } = useAuth();
  const isCurrentUser = member.userId === user.uid;

  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
    selectedCard: '',
    type: 'income', // 'income' or 'expense' for the plan member
  });
  const [userCards, setUserCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [currencyIcon, setCurrencyIcon] = useState(null);

  useEffect(() => {
    navigation.setOptions({ title: `Contribution for ${member.name}` });
    if (user) {
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
    }
  }, [member, navigation, user]);

  useEffect(() => {
    if (!user || !isCurrentUser) {
      setCardsLoading(false);
      return;
    }

    const unsubscribeCards = getCards(user.uid, (cards) => {
      setUserCards(cards);
      setCardsLoading(false);
    });
    const unsubscribeCategories = getCategories(user.uid, setCategories);

    return () => {
      unsubscribeCards();
      unsubscribeCategories();
    };
  }, [user, isCurrentUser]);

  const formatAmountInput = (raw) => {
    if (!raw) return '';
    let sanitized = raw.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    const [integerPart, fractionalPart] = sanitized.split('.');
    const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fractionalPart !== undefined ? `${withCommas}.${fractionalPart}` : withCommas;
  };

  const handleSaveContribution = async () => {
    if (!formData.amount || !formData.description) {
      Alert.alert('Error', 'Please provide an amount and description.');
      return;
    }
    if (isCurrentUser && (!formData.category || !formData.selectedCard)) {
      Alert.alert('Error', 'Please select a card and category for your contribution.');
      return;
    }

    try {
      const cleanAmount = formData.amount.replace(/,/g, '');
      const amount = parseFloat(cleanAmount);
      const finalAmount = formData.type === 'income' ? amount : -amount;

      const contributionData = {
        amount: finalAmount,
        description: formData.description,
        memberId: member.userId,
        memberName: member.name,
        date: dateIdLocal(),
        type: formData.type,
      };

      let userExpenseData = null;
      if (isCurrentUser) {
        userExpenseData = {
          userId: user.uid,
          cardId: formData.selectedCard,
          category: formData.category,
          planName: plan.name,
          description: formData.description,
        };
      }

      await addContributionToPlan(plan.id, contributionData, userExpenseData);

      Alert.alert(
        'Contribution Saved',
        `The contribution has been successfully saved.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      console.error('Error saving contribution:', error);
      Alert.alert('Error', `Could not save the contribution. ${error.message}`);
    }
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

  const CardButton = ({ card, isSelected, onPress }) => (
    <TouchableOpacity
      style={[styles.cardSelectionButton, isSelected && styles.selectedCard]}
      onPress={onPress}
    >
      <View style={[styles.cardIconContainer, { backgroundColor: card.color }]}>
        <Icon name={getCardIcon(card.type)} size={18} color="#fff" />
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardNameText, isSelected && styles.selectedCardText]}>{card.name}</Text>
      </View>
      {isSelected && <Icon name="check" size={16} color="#007AFF" />}
    </TouchableOpacity>
  );

  const TypeToggle = () => (
    <View style={styles.typeToggleContainer}>
      <TouchableOpacity
        style={[styles.typeToggleButton, formData.type === 'expense' && styles.typeToggleExpense]}
        onPress={() => setFormData({ ...formData, type: 'expense' })}
      >
        <Icon name="arrow-down" size={16} color={formData.type === 'expense' ? '#fff' : '#FF3B30'} />
        <Text style={[styles.typeToggleText, formData.type === 'expense' && styles.typeToggleSelectedText]}>Expense</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.typeToggleButton, formData.type === 'income' && styles.typeToggleIncome]}
        onPress={() => setFormData({ ...formData, type: 'income' })}
      >
        <Icon name="arrow-up" size={16} color={formData.type === 'income' ? '#fff' : '#34C759'} />
        <Text style={[styles.typeToggleText, formData.type === 'income' && styles.typeToggleSelectedText]}>Income</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add Contribution</Text>
          <Text style={styles.headerSubtitle}>For {member.name} in "{plan.name}"</Text>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.amountSection}>
            <Text style={styles.sectionTitle}>Amount</Text>
            <View style={styles.amountInputContainer}>
              {currencyIcon && <Icon name={currencyIcon} style={styles.currencySymbol} />}
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                value={formData.amount}
                onChangeText={(value) => setFormData({ ...formData, amount: formatAmountInput(value) })}
                keyboardType="decimal-pad"
              />
            </View>
            <TypeToggle />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="e.g., Groceries, Rent contribution"
              value={formData.description}
              onChangeText={(value) => setFormData({ ...formData, description: value })}
            />
          </View>

          {isCurrentUser && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>My Card Used</Text>
                {cardsLoading ? <Text>Loading cards...</Text> : (
                  <View style={styles.cardsGrid}>
                    {userCards.map((card) => (
                      <CardButton
                        key={card.id}
                        card={card}
                        isSelected={formData.selectedCard === card.id}
                        onPress={() => setFormData({ ...formData, selectedCard: card.id })}
                      />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Category for my Expense</Text>
                <View style={styles.categoriesGrid}>
                  {categories.map((cat) => <CategoryButton key={cat.id} category={cat} />)}
                </View>
              </View>
            </>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveContribution}>
            <Icon name="save" size={16} color="#fff" />
            <Text style={styles.saveButtonText}>Save Contribution</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  keyboardContainer: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 16, color: '#666' },
  content: { flex: 1, paddingHorizontal: 20 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 15 },
  amountSection: { alignItems: 'center', marginBottom: 30 },
  amountInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  currencySymbol: { fontSize: 32, fontWeight: 'bold', color: '#333', marginRight: 10 },
  amountInput: { fontSize: 48, fontWeight: 'bold', color: '#333', minWidth: 150 },
  descriptionInput: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef', borderRadius: 12, padding: 15, fontSize: 16 },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryButton: { width: '48%', padding: 15, borderRadius: 12, alignItems: 'center', opacity: 0.8, borderWidth: 2, borderColor: 'transparent' },
  selectedCategory: { opacity: 1, borderWidth: 3, borderColor: '#007AFF' },
  categoryName: { color: '#fff', fontWeight: '600', fontSize: 14, marginTop: 8 },
  cardsGrid: { gap: 10 },
  cardSelectionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderWidth: 2, borderColor: '#e9ecef', borderRadius: 12, padding: 15, gap: 15 },
  selectedCard: { borderColor: '#007AFF', backgroundColor: '#E3F2FD' },
  cardIconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardNameText: { fontSize: 16, fontWeight: '600', color: '#333' },
  selectedCardText: { color: '#007AFF' },
  typeToggleContainer: { flexDirection: 'row', backgroundColor: '#f8f9fa', borderRadius: 12, padding: 4, marginTop: 20 },
  typeToggleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 8 },
  typeToggleExpense: { backgroundColor: '#FF3B30' },
  typeToggleIncome: { backgroundColor: '#34C759' },
  typeToggleText: { fontSize: 16, fontWeight: '600' },
  typeToggleSelectedText: { color: '#fff' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', borderRadius: 12, padding: 18, marginTop: 20, marginBottom: 40 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
});

export default AddContributionScreen;
