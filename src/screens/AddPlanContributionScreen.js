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
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import {
  getPlanPeople,
  getCards,
  getCategories,
  addPlanExpense,
  addExpense,
  getPlanById,
  getUserProfile
} from '../services/firestoreService';

const formatDateId = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const AddPlanContributionScreen = ({ route, navigation }) => {
  const { planId } = route.params;
  const { user } = useAuth();

  const [plan, setPlan] = useState(null);
  const [people, setPeople] = useState([]);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPayerId, setSelectedPayerId] = useState(null);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [currencyIcon, setCurrencyIcon] = useState(null);

  const isSelfSelected = people.find(p => p.id === selectedPayerId)?.userId === user.uid;

  useEffect(() => {
    if (!planId || !user) return;

    getPlanById(planId, setPlan);
    getPlanPeople(planId, (list) => {
        setPeople(list);
        // Set current user as default payer
        const self = list.find(p => p.userId === user.uid);
        if (self) {
            setSelectedPayerId(self.id);
        }
    });
    getCards(user.uid, setCards);
    getCategories(user.uid, setCategories);

  }, [planId, user]);

  useEffect(() => {
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
  }, [user]);

  const formatAmountInput = (raw) => {
    if (!raw) return '';
    let sanitized = String(raw).replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const integerPartRaw = parts[0];
    const fractionalPartRaw = parts.slice(1).join('');
    if (!integerPartRaw) return '';
    const withCommas = integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${withCommas}.${fractionalPartRaw}` : withCommas;
  };

  const handleSave = async () => {
    const cleanAmount = parseFloat(String(amount).replace(/,/g, ''));
    if (!selectedPayerId || !description.trim() || isNaN(cleanAmount) || cleanAmount <= 0) {
      Alert.alert('Error', 'Please fill out all fields correctly.');
      return;
    }

    // Requerir tanto tarjeta como categoría para contribuciones personales
    if (isSelfSelected && !selectedCardId) {
        Alert.alert('Error', 'As this is your contribution, please select a card.');
        return;
    }

    if (isSelfSelected && !selectedCategoryId) {
        Alert.alert('Error', 'As this is your contribution, please select a category.');
        return;
    }

    try {
        // Determinar la categoría según el tipo de plan
        let categoryForExpense = null;
        let categoryForCard = null;

        if (isSelfSelected) {
            // Usar la categoría seleccionada por el usuario
            categoryForExpense = selectedCategoryId;
            categoryForCard = selectedCategoryId;
        }

        const planExpenseRef = await addPlanExpense(planId, {
            payerId: selectedPayerId,
            description: description.trim(),
            amount: cleanAmount,
            date: formatDateId(new Date()),
            createdBy: user.uid,
            settlement: false, // This is a direct contribution
            category: categoryForExpense, // Save category for plan expense
        });

        if (isSelfSelected) {
            const txData = {
                amount: -Math.abs(cleanAmount),
                description: `[${plan?.title || 'Plan'}] ${description.trim()}`,
                category: categoryForCard,
                type: 'expense',
                recurrence: 'one-time',
                date: formatDateId(new Date()),
                timestamp: new Date(),
                linkedPlanId: planId,
                linkedPlanExpenseId: planExpenseRef?.id,
                // Si es gestión sin categoría, marcar como pending
                status: (plan?.kind === 'gestion' && !categoryForCard) ? 'pending' : 'completed'
            };
            await addExpense(user.uid, selectedCardId, txData);
        }

        Alert.alert('Success', 'Contribution added successfully.');
        navigation.goBack();
    } catch (error) {
        console.error('Error saving contribution:', error);
        Alert.alert('Error', 'Could not save contribution.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardContainer}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Icon name="chevron-left" size={16} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Contribution</Text>
            <View style={{width: 36}} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.amountSection}>
            {currencyIcon && <Icon name={currencyIcon} style={styles.currencySymbol} />}
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#999"
              value={amount}
              onChangeText={(v) => setAmount(formatAmountInput(v))}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Groceries, rent"
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>Who paid?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {people.map(p => (
              <TouchableOpacity key={p.id} style={[styles.personCardBtn, selectedPayerId === p.id && styles.personCardBtnActive]} onPress={() => setSelectedPayerId(p.id)}>
                <View style={[styles.personIcon, { backgroundColor: p.color || '#9aa0a6' }]}>
                  <Icon name={'user'} size={14} color={'#fff'} />
                </View>
                <Text style={[styles.personBtnText, selectedPayerId === p.id && styles.personBtnTextActive]}>{p.userId === user?.uid ? 'You' : p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {isSelfSelected && (
            <>
              <Text style={styles.label}>My Card</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {cards.map((c) => (
                  <TouchableOpacity key={c.id} style={[styles.cardItem, {backgroundColor: c.color || colors.gray}, selectedCardId === c.id && styles.selectedCard]} onPress={() => setSelectedCardId(c.id)}>
                      <Text style={styles.cardName}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>
                Category {plan?.kind === 'savings' ? '(Auto-assigned)' : ''}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {categories.map((cat) => (
                      <TouchableOpacity key={cat.id} style={[styles.categoryPill, {backgroundColor: cat.color}, selectedCategoryId === cat.id && styles.selectedCategory]} onPress={() => setSelectedCategoryId(cat.id)}>
                          <Icon name={cat.icon || 'tag'} size={14} color="#fff" />
                          <Text style={styles.categoryPillText}>{cat.name}</Text>
                      </TouchableOpacity>
                  ))}
              </ScrollView>
              {plan?.kind === 'savings' && (
                <Text style={styles.autoCategoryNote}>
                  Category will be automatically assigned to this savings plan
                </Text>
              )}
            </>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  content: { flex: 1, paddingHorizontal: 20 },
  amountSection: { alignItems: 'center', marginBottom: 20, flexDirection: 'row', justifyContent: 'center' },
  currencySymbol: { fontSize: 32, fontWeight: 'bold', color: '#333', marginRight: 10 },
  amountInput: { fontSize: 48, fontWeight: 'bold', color: '#333', minWidth: 150, textAlign: 'left' },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 8 },
  textInput: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff', fontSize: 16 },
  personCardBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: '#f8f9fa', marginRight: 10 },
  personCardBtnActive: { backgroundColor: colors.primary },
  personIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  personBtnText: { fontWeight: '600', color: '#333' },
  personBtnTextActive: { color: '#fff' },
  cardItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
    height: 40,
  },
  cardName: { color: '#fff', fontWeight: 'bold' },
  selectedCard: { borderWidth: 2, borderColor: colors.primary },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    gap: 6,
  },
  selectedCategory: { borderWidth: 2, borderColor: colors.primary },
  categoryPillText: { color: '#fff', fontWeight: '600' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 12, padding: 18, marginTop: 20, marginBottom: 40 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  pendingNote: {
    fontSize: 12,
    color: '#FF9500',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 16,
  },
  autoCategoryContainer: {
    marginBottom: 12,
  },
  autoCategoryNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 16,
  },
});

export default AddPlanContributionScreen;
