import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import {
  getPlanById,
  getPlanPeople,
  getPlanExpenses,
  addPlanExpense,
  getCards,
  getCategories,
  addExpense,
} from '../services/firestoreService';

function formatDateId(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const SettlementsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { planId } = route.params;
  const { user } = useAuth();

  const [plan, setPlan] = useState(null);
  const [people, setPeople] = useState([]);
  const [planExpenses, setPlanExpenses] = useState([]);
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPayerId, setSelectedPayerId] = useState(null);
  const [selectedReceiverId, setSelectedReceiverId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const selfPerson = useMemo(() => people.find(p => p.userId === user.uid), [people, user.uid]);
  const isSelfInvolved = useMemo(() => selfPerson && (selectedPayerId === selfPerson.id || selectedReceiverId === selfPerson.id), [selfPerson, selectedPayerId, selectedReceiverId]);

  useEffect(() => {
    if (!planId || !user?.uid) return;

    const unsubPlan = getPlanById(planId, setPlan);
    const unsubPeople = getPlanPeople(planId, (list) => {
      setPeople(list);
      const self = list.find(p => p.userId === user.uid) || null;
      const others = list.filter(p => !self || p.id !== self.id);
      if (!selectedPayerId) {
        setSelectedPayerId(self ? self.id : list[0]?.id || null);
      }
      if (!selectedReceiverId) {
        const defaultReceiver = others[0]?.id || (list[0] && list[0].id !== selectedPayerId ? list[0].id : list[1]?.id) || null;
        setSelectedReceiverId(defaultReceiver);
      }
    });
    const unsubExpenses = getPlanExpenses(planId, (expenses) => {
      setPlanExpenses(expenses);
      setLoading(false);
    });
    const unsubCards = getCards(user.uid, setCards);
    const unsubCategories = getCategories(user.uid, setCategories);

    return () => {
      unsubPlan && unsubPlan();
      unsubPeople && unsubPeople();
      unsubExpenses && unsubExpenses();
      unsubCards && unsubCards();
      unsubCategories && unsubCategories();
    };
  }, [planId, user?.uid]);

  const { settlements, paymentHistory } = useMemo(() => {
    const actualContributions = {};
    const settlementAdjustments = {};
    const paymentHistory = [];

    people.forEach((p) => {
      actualContributions[p.id] = 0;
      settlementAdjustments[p.id] = 0;
    });

    planExpenses.forEach((e) => {
      const person = people.find(p => p.id === e.payerId);
      if (e.settlement) {
        settlementAdjustments[e.payerId] = (settlementAdjustments[e.payerId] || 0) + (Number(e.amount) || 0);
        if (e.amount > 0) { // Only log the positive side of the transaction for history
            const receiver = people.find(p => p.id === e.receiverId);
            paymentHistory.push({
                id: e.id,
                from: person,
                to: receiver,
                amount: e.amount,
                date: e.date,
                description: e.description,
            });
        }
      } else {
        actualContributions[e.payerId] = (actualContributions[e.payerId] || 0) + (Number(e.amount) || 0);
      }
    });

    const total = Object.values(actualContributions).reduce((t, v) => t + v, 0);
    const perHead = people.length > 0 ? total / people.length : 0;

    const effectiveContributions = {};
    people.forEach((p) => {
      effectiveContributions[p.id] = (actualContributions[p.id] || 0) + (settlementAdjustments[p.id] || 0);
    });

    const balances = people.map((p) => ({
      person: p,
      balance: perHead - (effectiveContributions[p.id] || 0)
    }));
    const debtors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
    const creditors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance);
    const settlements = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].balance, Math.abs(creditors[j].balance));
      if (pay > 0.01) {
        settlements.push({ from: debtors[i].person, to: creditors[j].person, amount: pay });
      }
      debtors[i].balance -= pay;
      creditors[j].balance += pay;
      if (debtors[i].balance <= 0.01) i++;
      if (Math.abs(creditors[j].balance) <= 0.01) j++;
    }
    return { settlements, paymentHistory: paymentHistory.sort((a,b) => new Date(b.date) - new Date(a.date)) };
  }, [people, planExpenses]);

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

  const handleRecordPayment = async () => {
    if (!selectedPayerId || !selectedReceiverId || !paymentAmount) {
      Alert.alert('Error', 'Please select a payer, receiver, and amount.');
      return;
    }
    if (selectedPayerId === selectedReceiverId) {
      Alert.alert('Error', 'Payer and receiver must be different.');
      return;
    }
    if (isSelfInvolved && (!selectedCardId || !selectedCategoryId)) {
        Alert.alert('Error', 'Please select a card and category for the transaction.');
        return;
    }

    const payerPerson = people.find(p => p.id === selectedPayerId);
    const receiverPerson = people.find(p => p.id === selectedReceiverId);
    const amount = parseFloat(paymentAmount.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    try {
      const today = formatDateId(new Date());
      const descriptionForPayer = description.trim() || `Payment to ${receiverPerson?.name || 'receiver'}`;
      const descriptionForReceiver = `Payment from ${payerPerson?.name || 'payer'}`;

      const promises = [
        addPlanExpense(planId, {
          payerId: selectedPayerId,
          description: descriptionForPayer,
          amount: amount,
          date: today,
          createdBy: user.uid,
          settlement: true,
          receiverId: selectedReceiverId,
        }),
        addPlanExpense(planId, {
          payerId: selectedReceiverId,
          description: descriptionForReceiver,
          amount: -Math.abs(amount),
          date: today,
          createdBy: user.uid,
          settlement: true,
          senderId: selectedPayerId,
        }),
      ];

      if (isSelfInvolved) {
        const personalAmount = selectedPayerId === selfPerson.id ? -Math.abs(amount) : Math.abs(amount);
        const baseDescription = selectedPayerId === selfPerson.id ? descriptionForPayer : descriptionForReceiver;
        const expenseData = {
            amount: personalAmount,
            description: `Payment Plan ${plan?.title || ''}`,
            category: selectedCategoryId,
            type: personalAmount < 0 ? 'expense' : 'income',
            recurrence: 'one-time',
            date: today,
            timestamp: new Date(),
            linkedPlanId: planId,
        };
        promises.push(addExpense(user.uid, selectedCardId, expenseData));
      }

      await Promise.all(promises);

      Alert.alert('Success', 'Payment recorded successfully', [
        {
          text: 'OK',
          onPress: () => {
            setPaymentAmount('');
            setDescription('');
            setSelectedCardId(null);
            setSelectedCategoryId(null);
            // Use goBack to return to the previous screen in the stack
            navigation.goBack();
          }
        }
      ]);
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert('Error', 'Could not record payment.');
    }
  };

  if (loading || !plan) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderPersonName = (person) => {
    if (!person) return '';
    return person.userId === user.uid ? 'You' : person.name;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-left" size={16} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settlements</Text>
          <View style={{width: 36}} />
        </View>
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Suggested Settlements</Text>
          {settlements.length === 0 ? (
            <Text style={styles.noDataText}>All settled up!</Text>
          ) : settlements.map((s, idx) => (
            <View key={idx} style={styles.settlementRow}>
              <Text style={styles.settlementText}>{renderPersonName(s.from)} pays {renderPersonName(s.to)}</Text>
              <Text style={styles.settlementAmount}>€{s.amount.toFixed(2)}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Record a Manual Payment</Text>
          <View style={styles.formContainer}>
            <Text style={styles.label}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySymbol}>€</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                value={paymentAmount}
                onChangeText={(v) => setPaymentAmount(formatAmountInput(v))}
                placeholder="0.00"
                placeholderTextColor="#999"
              />
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.textInput} placeholder="e.g., Dinner, tickets" value={description} onChangeText={setDescription} />

            <Text style={styles.label}>Payer</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {people.map((p) => (
                <TouchableOpacity key={p.id} style={[styles.personCardBtn, selectedPayerId === p.id && styles.personCardBtnActive]} onPress={() => {
                  setSelectedPayerId(p.id);
                  if (p.id === selectedReceiverId) {
                    const alt = people.find(x => x.id !== p.id)?.id || null;
                    setSelectedReceiverId(alt);
                  }
                }}>
                  <View style={[styles.personIcon, { backgroundColor: p.color || '#9aa0a6' }]}>
                    <Icon name={'user'} size={14} color={'#fff'} />
                  </View>
                  <Text style={[styles.personBtnText, selectedPayerId === p.id && styles.personBtnTextActive]}>{renderPersonName(p)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Receiver</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {people.map((p) => (
                <TouchableOpacity key={p.id} style={[styles.personCardBtn, selectedReceiverId === p.id && styles.personCardBtnActive, p.id === selectedPayerId && styles.personCardBtnDisabled]} onPress={() => {
                  if (p.id === selectedPayerId) return;
                  setSelectedReceiverId(p.id);
                }}>
                  <View style={[styles.personIcon, { backgroundColor: p.color || '#9aa0a6' }]}>
                    <Icon name={'user'} size={14} color={'#fff'} />
                  </View>
                  <Text style={[styles.personBtnText, selectedReceiverId === p.id && styles.personBtnTextActive]}>{renderPersonName(p)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {isSelfInvolved && (
              <>
                <Text style={styles.label}>My Card</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {cards.map((c) => (
                    <TouchableOpacity key={c.id} style={[styles.cardItem, {backgroundColor: c.color || colors.gray}, selectedCardId === c.id && styles.selectedCard]} onPress={() => setSelectedCardId(c.id)}>
                        <Text style={styles.cardName}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {categories.map((cat) => (
                        <TouchableOpacity key={cat.id} style={[styles.categoryPill, {backgroundColor: cat.color}, selectedCategoryId === cat.id && styles.selectedCategory]} onPress={() => setSelectedCategoryId(cat.id)}>
                            <Text style={styles.categoryPillText}>{cat.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={styles.recordButton} onPress={handleRecordPayment}>
              <Text style={styles.recordButtonText}>Record Payment</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Payment History</Text>
            {paymentHistory.length === 0 ? (
            <Text style={styles.noDataText}>No payments recorded yet.</Text>
            ) : paymentHistory.map((p) => (
            <View key={p.id} style={styles.settlementRow}>
                <View>
                    <Text style={styles.settlementText}>{renderPersonName(p.from)} paid {renderPersonName(p.to)}</Text>
                    <Text style={styles.historyDescription}>{p.description}</Text>
                    <Text style={styles.historyDate}>{p.date}</Text>
                </View>
                <Text style={styles.settlementAmount}>€{p.amount.toFixed(2)}</Text>
            </View>
            ))}

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, marginTop: 20, color: '#333' },
  noDataText: { color: '#666', textAlign: 'center', marginBottom: 20, fontStyle: 'italic' },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  settlementText: { fontSize: 16, color: '#333', fontWeight: '600' },
  settlementAmount: { fontSize: 16, fontWeight: 'bold', color: colors.primary },
  historyDescription: { fontSize: 14, color: '#666', marginTop: 4 },
  historyDate: { fontSize: 12, color: '#999', marginTop: 4 },
  formContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 20,
  },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333', marginTop: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  currencySymbol: { fontSize: 24, fontWeight: 'bold', color: '#333', marginRight: 8 },
  amountInput: { flex: 1, borderWidth: 1, borderColor: '#e9ecef', borderRadius: 8, padding: 10, fontSize: 18, backgroundColor: '#fff' },
  textInput: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff', fontSize: 16 },
  recordButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  personCardBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: '#e9ecef', marginRight: 10 },
  personCardBtnActive: { backgroundColor: colors.primary },
  personCardBtnDisabled: { opacity: 0.5, backgroundColor: '#e9ecef' },
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  selectedCategory: { borderWidth: 2, borderColor: colors.primary },
  categoryPillText: { color: '#fff', fontWeight: '600' },
});

export default SettlementsScreen;
