import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ScrollView,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { colors } from '../styles/colors';

import { useAuth } from '../context/AuthContext';
import {
  getPlanById,
  getPlanSavingsLogs,
  upsertPlanSavingLog,
  getCards,
  updateCard,
  updatePlan,
  addExpense,
  getCategories,
  getPlanPeople,
  addPlanPerson,
  deletePlanPerson,
  getPlanExpenses,
  addPlanExpense,
  deletePlanExpense,
  getOrCreatePlanInvite,
} from '../services/firestoreService';

function formatDateId(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DetailsPlansScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const initialPlan = route?.params?.plan || null;
  const planId = initialPlan?.id || route?.params?.planId;

  const [plan, setPlan] = useState(initialPlan || null);
  const [logs, setLogs] = useState({});
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);
  const [planExpenses, setPlanExpenses] = useState([]);
  const [ensuredSelf, setEnsuredSelf] = useState(false);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonColor, setNewPersonColor] = useState('#007AFF');
  const COLORS = ['#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#FF2D55'];
  const [showAddContribution, setShowAddContribution] = useState(false);
  const [expensePayerId, setExpensePayerId] = useState(null);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseRecurrence, setExpenseRecurrence] = useState('one-time');
  const [expenseCardId, setExpenseCardId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [notesDraft, setNotesDraft] = useState('');
  const [activePersonIndex, setActivePersonIndex] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [amountInput, setAmountInput] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

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

  useEffect(() => {
    if (!planId || !user) return;

    const unsubPlan = getPlanById(planId, (p) => {
      setPlan(p);
      setLoading(false);
    });
    const unsubLogs = getPlanSavingsLogs(planId, (l) => setLogs(l || {}));
    const unsubCards = getCards(user.uid, (c) => setCards(c));
    const unsubCategories = getCategories(user.uid, (cats) => {
      setCategories(cats);
      // Para planes de ahorro, seleccionar automáticamente la categoría del plan
      if (plan?.kind === 'savings' && planId) {
        const planCategory = cats.find(cat => cat.planId === planId);
        if (planCategory) {
          setSelectedCategory(planCategory);
        }
      }
    });
    const unsubPeople = getPlanPeople(planId, (list) => { setPeople(list); setPeopleLoaded(true); });
    const unsubPlanExpenses = getPlanExpenses(planId, setPlanExpenses);

    return () => {
      unsubPlan && unsubPlan();
      unsubLogs && unsubLogs();
      unsubCards && unsubCards();
      unsubCategories && unsubCategories();
      unsubPeople && unsubPeople();
      unsubPlanExpenses && unsubPlanExpenses();
    };
  }, [planId, user.uid]);

  useEffect(() => {
    if (!plan || plan.kind !== 'gestion') return;
    if (ensuredSelf || !peopleLoaded) return;
    const hasSelf = people.some((p) => p.userId === user.uid);
    if (!hasSelf) {
      const usedColors = people.map((p) => p.color).filter(Boolean);
      const autoColor = COLORS.find((c) => !usedColors.includes(c)) || COLORS[0];
      addPlanPerson(planId, { name: user.displayName || 'You', userId: user.uid, isOwner: true, color: autoColor })
        .catch(() => {})
        .finally(() => setEnsuredSelf(true));
    } else {
      const selfDocs = people.filter((p) => p.userId === user.uid);
      if (selfDocs.length > 1) {
        selfDocs.slice(1).forEach((dup) => {
          deletePlanPerson(planId, dup.id).catch(() => {});
        });
      }
      setEnsuredSelf(true);
    }
  }, [plan, people, peopleLoaded, ensuredSelf, planId, user.uid, user.displayName]);

  useEffect(() => {
    if (plan?.notes != null && typeof plan.notes === 'string') {
      setNotesDraft(plan.notes);
    }
  }, [plan?.notes]);

  const { stats, markedDates } = useMemo(() => {
    if (!plan || plan.kind !== 'savings' || !plan.deadline) {
      return { stats: null, markedDates: {} };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayId = formatDateId(today);
    const deadline = new Date(plan.deadline);
    deadline.setHours(23, 59, 59, 999);
    const startDate = new Date(plan.createdAt?.toDate() || today);
    const currentAmount = Number(plan.currentAmount || 0);
    const targetAmount = Number(plan.targetAmount || 0);
    const remainingAmount = Math.max(0, targetAmount - currentAmount);
    const daysRemaining = Math.max(0, Math.ceil((deadline - today) / 86400000));
    const dailyRequired = daysRemaining > 0 ? remainingAmount / daysRemaining : 0;
    const planStats = {
      currentAmount,
      targetAmount,
      remainingAmount,
      daysRemaining,
      dailyRequired,
      progress: targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0,
    };
    const marks = {};
    let current = new Date(startDate);
    while (current <= deadline) {
      const dateId = formatDateId(current);
      const log = logs[dateId];
      const isToday = dateId === todayId;
      marks[dateId] = { marked: true, dotColor: colors.primary };
      if (log && log.amount > 0) {
        marks[dateId].dotColor = 'green';
      }
      if (isToday) {
        marks[dateId].customStyles = {
          container: { backgroundColor: colors.primary, borderRadius: 10 },
          text: { color: 'white', fontWeight: 'bold' },
        };
      }
      current.setDate(current.getDate() + 1);
    }
    return { stats: planStats, markedDates: marks };
  }, [plan, logs]);

  const gestionStats = useMemo(() => {
    if (plan?.kind !== 'gestion') return null;
    const contributed = {};
    people.forEach((p) => { contributed[p.id] = 0; });
    planExpenses.forEach((e) => { contributed[e.payerId] = (contributed[e.payerId] || 0) + (Number(e.amount) || 0); });
    const total = Object.values(contributed).reduce((t, v) => t + v, 0);
    const perHead = people.length > 0 ? total / people.length : 0;
    return { total, perHead, peopleCount: people.length };
  }, [plan, people, planExpenses]);

  const handleDayPress = (day) => {
    const dateId = day.dateString;
    const todayId = formatDateId(new Date());
    if (dateId > todayId) {
      Alert.alert("Future Day", "You cannot log savings for future days.");
      return;
    }
    setSelectedDate(dateId);
    setAmountInput(logs[dateId]?.amount.toString() || '');
    setSelectedCard(null); // Reset selected card
    // Reset selections for new modal
    setSelectedCategory(null);
    setModalVisible(true);
  };

  const handleSaveForDay = async () => {
    const amountNum = parseFloat(amountInput.replace(/,/g, ''));
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!selectedCard) {
      Alert.alert('Error', 'Please select a source card.');
      return;
    }
    // Always require category selection
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }
    if (selectedCard.id === planId) {
      Alert.alert('Error', 'You cannot use the same savings plan as the source card.');
      return;
    }
    try {
      await upsertPlanSavingLog(planId, user.uid, selectedDate, amountNum, plan.currentAmount || 0);
      const expenseData = {
        amount: -amountNum,
        description: `Savings for plan "${plan.title}"`,
        category: selectedCategory.id,
        date: formatDateId(new Date()),
        recurrence: 'one-time',
        timestamp: new Date(),
      };
      await addExpense(user.uid, selectedCard.id, expenseData);
      setModalVisible(false);
      Alert.alert('Done', 'Savings logged and transferred successfully.');
      // States will be cleared by the modal close handler
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save savings.');
    }
  };

  if (loading || !plan) {
    return <View style={styles.loadingContainer}><StatusBar style="light" /><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View>
        <View style={[styles.planCard, { backgroundColor: plan.color || colors.primary }]}>
          
          <TouchableOpacity onPress={() => navigation.navigate('EditPlan', { plan })} style={styles.editBtnAbs}>
            <Icon name="edit" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.planTitle}>{plan.title}</Text>
          {plan.kind === 'savings' && stats && (
            <View style={styles.statsBoxes}>
              <StatBox label="Saved" value={`$${stats.currentAmount.toLocaleString()}`} />
              <StatBox label="Goal" value={`$${stats.targetAmount.toLocaleString()}`} />
              <StatBox label="Days Left" value={stats.daysRemaining} />
            </View>
          )}
          {plan.kind === 'gestion' && gestionStats && (
            <View style={styles.statsBoxes}>
              <StatBox label="Total" value={`$${gestionStats.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}/>
              <StatBox label="Per Person" value={`$${gestionStats.perHead.toFixed(2)}`}/>
              <StatBox label="People" value={gestionStats.peopleCount}/>
            </View>
          )}
        </View>
        {plan.kind === 'gestion' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('GestionAddPerson', { planId: plan.id })}>
              <Icon name="user-plus" size={18} color={colors.primary} />
              <Text style={styles.actionButtonText}>Add Person</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('PlanInviteCode', { planId: plan.id })}>
              <Icon name="link" size={18} color={colors.primary} />
              <Text style={styles.actionButtonText}>Invite</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Settlements', { planId: plan.id })}>
                <Icon name="balance-scale" size={18} color={colors.primary} />
                <Text style={styles.actionButtonText}>Settle</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView>
        {plan.kind === 'savings' && stats ? (
          <View style={styles.content}>
            <View style={styles.statsContainer}>
              <Text style={styles.progressText}>{`${stats.currentAmount.toLocaleString()} / ${stats.targetAmount.toLocaleString()}`}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressBarFill, { width: `${stats.progress}%` }]} />
              </View>
            </View>
            <Calendar
              onDayPress={handleDayPress}
              markedDates={markedDates}
              markingType={'custom'}
              theme={calendarTheme}
            />
          </View>
        ) : plan.kind === 'gestion' ? (
          <>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={(e)=>{
              const w = e.nativeEvent.layoutMeasurement.width;
              const x = e.nativeEvent.contentOffset.x;
              const idx = Math.round(x / Math.max(1, w));
              setActivePersonIndex(idx);
            }} scrollEventThrottle={16}>
              {people.length === 0 ? (
                <View style={[styles.personPage, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#666' }}>No people yet</Text>
                </View>
              ) : people.map((p) => {
                const expensesBy = planExpenses.filter(e => e.payerId === p.id);
                const totalBy = expensesBy.reduce((t, e) => t + (Number(e.amount) || 0), 0);
                return (
                  <View key={p.id} style={styles.personPage}>
                    <View style={[styles.personHeaderCard, { backgroundColor: p.color || '#007AFF' }]}>
                      <View style={styles.personHeader}>
                        <Icon name="user" size={18} color={'#fff'} />
                        <Text style={styles.personTitle}>{p.userId === user.uid ? 'You' : p.name}</Text>
                      </View>
                      <Text style={styles.personContribution}>${totalBy.toLocaleString()}</Text>
                      {p.userId === user.uid && (
                        <TouchableOpacity style={styles.addBtnPrimary} onPress={() => { setExpenseDesc(''); setExpenseAmount(''); setExpensePayerId(p.id); setShowAddContribution(true); }}>
                          <Icon name="plus" size={14} color={'#fff'} />
                          <Text style={styles.addBtnPrimaryText}>Add Contribution</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.block}>
                      <Text style={styles.blockTitle}>Your expenses</Text>
                      {expensesBy.length === 0 ? (
                        <Text style={{ color: '#666', textAlign: 'center' }}>No expenses</Text>
                      ) : expensesBy.map(e => (
                        <View key={e.id} style={styles.expenseRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '600', color: '#333' }}>{e.description}</Text>
                            <Text style={{ color: '#666', fontSize: 12 }}>{e.date}</Text>
                          </View>
                          <Text style={{ fontWeight: '700', color: '#333', marginRight: 10 }}>${e.amount?.toLocaleString?.() || e.amount}</Text>
                          {p.userId === user.uid && (
                            <TouchableOpacity onPress={() => deletePlanExpense(planId, e.id)}>
                              <Icon name="trash" size={14} color="#FF3B30" />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <View style={styles.emptyView}>
            <Text>This is a management plan. More details coming soon.</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible || showAddPerson || showAddContribution}
        onRequestClose={() => {
          setModalVisible(false);
          setShowAddPerson(false);
          setShowAddContribution(false);
          // Clear states when modal closes
          setSelectedCard(null);
          setSelectedCategory(null);
          setAmountInput('');
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={{flex: 1}} onPress={() => { setModalVisible(false); setShowAddPerson(false); setShowAddContribution(false); }} />
          <View style={styles.modalContent}>
            {modalVisible && (
              <>
                <Text style={styles.modalTitle}>Log Saving</Text>
                <Text style={styles.modalDate}>{selectedDate}</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="$0.00"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  value={amountInput}
                  onChangeText={(v) => setAmountInput(formatAmountInput(v))}
                />
                <Text style={styles.cardSelectionTitle}>Select Source Card:</Text>
                <FlatList
                  data={cards.filter(c => c.id !== planId)}
                  keyExtractor={item => item.id}
                  renderItem={({item}) => (
                      <TouchableOpacity
                          style={[
                              styles.cardItem,
                              {backgroundColor: item.color || colors.gray},
                              selectedCard?.id === item.id && styles.selectedCard,
                              selectedCard?.id === item.id && styles.selectedCardBorder
                          ]}
                          onPress={() => setSelectedCard(item)}
                      >
                          <Text style={[styles.cardName, {color: '#fff'}]}>{item.name}</Text>
                      </TouchableOpacity>
                  )}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                />
                <Text style={styles.cardSelectionTitle}>Select Category:</Text>
                <FlatList
                  data={categories}
                  keyExtractor={item => item.id}
                  renderItem={({item}) => (
                      <TouchableOpacity
                          style={[
                              styles.categoryPill,
                              {backgroundColor: item.color || colors.gray},
                              selectedCategory?.id === item.id && styles.selectedCategoryBorder
                          ]}
                          onPress={() => setSelectedCategory(selectedCategory?.id === item.id ? null : item)}
                      >
                          <Icon name={item.icon || 'tag'} size={14} color="#fff" />
                          <Text style={[styles.cardName, {color: '#fff'}]}>{item.name}</Text>
                      </TouchableOpacity>
                  )}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                />
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveForDay}>
                  <Text style={styles.saveButtonText}>Save Saving</Text>
                </TouchableOpacity>
              </>
            )}

            {showAddPerson && (
              <>
                <Text style={styles.modalTitle}>Add Person</Text>
                <TextInput style={styles.amountInput} placeholder="Name" placeholderTextColor="#999" value={newPersonName} onChangeText={setNewPersonName} />
                <Text style={{ textAlign: 'center', color: '#666', marginBottom: 8 }}>Color</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {COLORS.map((c) => (
                    <TouchableOpacity key={c} onPress={() => setNewPersonColor(c)} style={[styles.colorDot, { backgroundColor: c }, newPersonColor === c && styles.colorDotActive]} />
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.saveButton} onPress={() => {
                  if (!newPersonName.trim()) return;
                  addPlanPerson(planId, { name: newPersonName.trim(), color: newPersonColor }).finally(() => setShowAddPerson(false));
                }}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </>
            )}

            {showAddContribution && (
              <>
                <Text style={styles.modalTitle}>New Contribution</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {people.map((p) => (
                    <TouchableOpacity key={p.id} style={[styles.personChip, expensePayerId === p.id && styles.personChipActive, expensePayerId === p.id && styles.selectedPersonBorder]} onPress={() => setExpensePayerId(p.id)}>
                      <Icon name="user" size={12} color={expensePayerId === p.id ? '#fff' : '#007AFF'} />
                      <Text style={[styles.personChipText, expensePayerId === p.id && { color: '#fff' }]}>{p.userId === user.uid ? 'You' : p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Description"
                  placeholderTextColor="#999"
                  value={expenseDesc}
                  onChangeText={setExpenseDesc}
                />
                <TextInput
                  style={styles.amountInput}
                  placeholder="€0.00"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                  value={expenseAmount}
                  onChangeText={(v) => setExpenseAmount(formatAmountInput(v))}
                />
                <View style={{ marginBottom: 8 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['one-time', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual'].map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.recurrencePill, expenseRecurrence === opt && styles.recurrencePillActive]}
                        onPress={() => setExpenseRecurrence(opt)}
                      >
                        <Text style={[styles.recurrenceText, expenseRecurrence === opt && styles.recurrenceTextActive]}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ marginBottom: 8 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryPill, {backgroundColor: cat.color || colors.gray}, expenseCategory === cat.id && styles.selectedCategoryBorder]}
                      onPress={() => setExpenseCategory(expenseCategory === cat.id ? null : cat.id)}
                    >
                      <Icon name={cat.icon || 'tag'} size={14} color="#fff" />
                      <Text style={[styles.categoryPillText, {color: '#fff'}]}>{cat.name}</Text>
                    </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <Text style={{ textAlign: 'center', color: '#666', marginBottom: 6 }}>Select Card</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {cards.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.cardItem, { backgroundColor: c.color || colors.gray }, expenseCardId === c.id && styles.selectedCard, expenseCardId === c.id && styles.selectedCardBorder]}
                      onPress={() => setExpenseCardId(c.id)}
                    >
                      <Text style={styles.cardName}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.saveButton} onPress={() => {
                  const amount = parseFloat(String(expenseAmount).replace(/,/g, ''));
                  if (!expensePayerId || !expenseDesc.trim() || !expenseCategory || !expenseCardId || isNaN(amount) || amount <= 0) { Alert.alert('Error', 'Please fill all fields'); return; }
                  const self = people.find(p => p.userId === user.uid)?.id;
                  const isForSelf = expensePayerId === self;
                  const payerPerson = people.find(p => p.id === expensePayerId);
                  const payerUserId = payerPerson?.userId;
                  (async () => {
                    try {
                      const planExpenseRef = await addPlanExpense(planId, { payerId: expensePayerId, description: expenseDesc.trim(), amount, date: formatDateId(new Date()), createdBy: user.uid, category: expenseCategory, recurrence: expenseRecurrence, cardId: expenseCardId });

                      if (isForSelf) {
                        // Para uno mismo: crear expense normal en la tarjeta especificada
                        const txData = {
                          amount: -Math.abs(amount),
                          description: `[Plan ${plan?.title || ''}] ${expenseDesc.trim()}`,
                          category: expenseCategory,
                          type: 'expense',
                          recurrence: expenseRecurrence,
                          date: formatDateId(new Date()),
                          timestamp: new Date(),
                          linkedPlanId: planId,
                          linkedPlanExpenseId: planExpenseRef?.id,
                          payerPersonId: expensePayerId,
                        };
                        await addExpense(user.uid, expenseCardId, txData);
                      } else {
                        // Para otro usuario: crear expense en pending para que categorice
                        const pendingTxData = {
                          amount: -Math.abs(amount),
                          description: `[Plan ${plan?.title || ''}] ${expenseDesc.trim()} (Paid by ${people.find(p => p.userId === user.uid)?.name || 'someone'})`,
                          type: 'expense',
                          recurrence: expenseRecurrence,
                          date: formatDateId(new Date()),
                          timestamp: new Date(),
                          linkedPlanId: planId,
                          linkedPlanExpenseId: planExpenseRef?.id,
                          payerPersonId: expensePayerId,
                          status: 'pending', // Forzar pending para que aparezca en pending screen
                          sharedExpense: true, // Marcar como gasto compartido
                          participants: people.map(p => p.userId), // Incluir todos los participantes
                        };
                        await addExpense(payerUserId, null, pendingTxData); // null cardId para que aparezca como pending
                      }
                      setShowAddContribution(false);
                      setExpenseDesc(''); setExpenseAmount(''); setExpenseCategory(''); setExpenseRecurrence('one-time'); setExpenseCardId(null);
                      Alert.alert('Saved', 'Contribution added and linked to card.');
                    } catch (err) {
                      console.error(err);
                      Alert.alert('Error', 'Could not save contribution');
                    }
                  })();
                }}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

const StatBox = ({ label, value }) => (
  <View style={styles.statBox}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const calendarTheme = {
  backgroundColor: '#ffffff',
  calendarBackground: '#ffffff',
  textSectionTitleColor: '#b6c1cd',
  selectedDayBackgroundColor: colors.primary,
  selectedDayTextColor: '#ffffff',
  todayTextColor: colors.primary,
  dayTextColor: '#2d4150',
  textDisabledColor: '#d9e1e8',
  arrowColor: colors.primary,
  monthTextColor: colors.primary,
  indicatorColor: colors.primary,
  textDayFontWeight: '300',
  textMonthFontWeight: 'bold',
  textDayHeaderFontWeight: '300',
  textDayFontSize: 16,
  textMonthFontSize: 16,
  textDayHeaderFontSize: 14,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  planCard: {
    paddingVertical: 20,
    paddingTop: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    position: 'relative',
  },
  backBtnAbs: { position: 'absolute', top: 50, left: 15, zIndex: 1, padding: 10 },
  editBtnAbs: { position: 'absolute', top: 50, right: 15, zIndex: 1, padding: 10 },
  planTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
    marginHorizontal: 60,
  },
  statsBoxes: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  actionButton: {
    alignItems: 'center',
    gap: 5,
  },
  actionButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  content: { flex: 1, paddingHorizontal: 20 },
  statsContainer: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginBottom: 16,
  },
  progressText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#333' },
  progressBar: { height: 10, borderRadius: 5, backgroundColor: '#e9ecef', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.primary },
  block: { padding: 16, borderRadius: 20, backgroundColor: '#f8f9fa', marginBottom: 16 },
  blockTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 12 },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    padding: 12,
    marginTop: 8,
  },
  personPage: {
    width: Dimensions.get('window').width,
    paddingHorizontal: 20,
  },
  personHeaderCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  personContribution: { color: '#fff', fontWeight: '800', fontSize: 22, marginTop: 12 },
  addBtnPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start', marginTop: 10 },
  addBtnPrimaryText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  modalDate: { fontSize: 16, color: '#666', marginBottom: 16, textAlign: 'center' },
  amountInput: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderColor: '#e9ecef',
    padding: 8,
    marginBottom: 16,
  },
  cardSelectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
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
  selectedCard: { },
  selectedCardBorder: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  colorDot: { width: 28, height: 28, borderRadius: 14, marginHorizontal: 6, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#007AFF' },
  personChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8 },
  personChipActive: { backgroundColor: '#007AFF' },
  personChipText: { color: '#007AFF', fontWeight: '600' },
  selectedPersonBorder: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  recurrencePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginRight: 8,
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
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 0,
    marginRight: 8,
    backgroundColor: '#f8f9fa',
    gap: 6,
  },
  categoryPillActive: {
    opacity: 1,
  },
  selectedCategoryBorder: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  categoryPillText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
});

export default DetailsPlansScreen;
