import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Dimensions,
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import {
  getPlanById,
  getPlanPeople,
  getPlanExpenses,
  deletePlanExpense,
  getOrCreatePlanInvite,
  addPlanPerson,
  deletePlanPerson,
  deleteExpense,
  getCards,
  getExpenses,
} from '../services/firestoreService';

const { width: screenWidth } = Dimensions.get('window');

const DetailsGestionPlansScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const initialPlan = route?.params?.plan || null;
  const planId = initialPlan?.id || route?.params?.planId;

  const [plan, setPlan] = useState(initialPlan || null);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);
  const [planExpenses, setPlanExpenses] = useState([]);
  const [ensuredSelf, setEnsuredSelf] = useState(false);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [listenersActive, setListenersActive] = useState(true);
  const [userCards, setUserCards] = useState([]);

  useEffect(() => {
    if (!planId || !user || !listenersActive) return;

    const unsubPlan = getPlanById(planId, (p) => {
      if (listenersActive) {
        if (p === null) {
          // Plan was deleted, navigate back
          setListenersActive(false);
          navigation.goBack();
          return;
        }
        setPlan(p);
        setLoading(false);
      }
    });
    const unsubPeople = getPlanPeople(planId, (list) => {
      if (listenersActive) {
        setPeople(list);
        setPeopleLoaded(true);
      }
    });
    const unsubPlanExpenses = getPlanExpenses(planId, (expenses) => {
      if (listenersActive) {
        setPlanExpenses(expenses);
      }
    });

    return () => {
      unsubPlan && unsubPlan();
      unsubPeople && unsubPeople();
      unsubPlanExpenses && unsubPlanExpenses();
    };
  }, [planId, user.uid, listenersActive]);

  // Load user cards to find linked expenses
  useEffect(() => {
    if (!user) return;
    const unsubscribe = getCards(user.uid, (cards) => {
      setUserCards(cards);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!plan || plan.kind !== 'gestion') return;
    if (ensuredSelf || !peopleLoaded) return;
    const hasSelf = people.some((p) => p.userId === user.uid);
    const COLORS = ['#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#FF2D55'];
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
  }, [plan, people, peopleLoaded, ensuredSelf, planId, user.uid, user?.displayName]);

  const { total, perHead, settlements, contributionRanking, pieChartData } = useMemo(() => {
    const actualContributions = {};
    const settlementAdjustments = {};

    people.forEach((p) => {
      actualContributions[p.id] = 0;
      settlementAdjustments[p.id] = 0;
    });

    planExpenses.forEach((e) => {
      if (e.settlement) {
        settlementAdjustments[e.payerId] = (settlementAdjustments[e.payerId] || 0) + (Number(e.amount) || 0);
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
        debtors[i].balance -= pay;
        creditors[j].balance += pay;
      }
      if (debtors[i].balance <= 0.01) i++;
      if (Math.abs(creditors[j].balance) <= 0.01) j++;
    }

    const contributionRanking = people.map(p => ({
      person: p,
      amount: effectiveContributions[p.id] || 0,
    })).sort((a, b) => b.amount - a.amount);

    const pieChartData = people.map(p => ({
        name: p.userId === user.uid ? 'You' : p.name,
        population: effectiveContributions[p.id] || 0,
        color: p.color || '#007AFF',
    })).filter(item => item.population > 0);

    return { total, perHead, settlements, contributionRanking, pieChartData };
  }, [people, planExpenses]);

  // Handle bidireccional deletion of plan expenses
  const handleDeletePlanExpense = async (planExpenseId, planExpense) => {
    try {
      // Delete from plan first
      await deletePlanExpense(planId, planExpenseId);

      // Find and delete corresponding card expense
      // We need to find the card expense that has the same description and is from the current user
      for (const card of userCards) {
        const cardExpenses = await new Promise((resolve) => {
          const unsubscribe = getExpenses(card.id, (expenses) => {
            unsubscribe();
            resolve(expenses);
          });
        });

        const linkedExpense = cardExpenses.find(expense =>
          expense.linkedPlanId === planId &&
          expense.linkedPlanExpenseId === planExpenseId &&
          expense.payerId === planExpense.payerId
        );

        if (linkedExpense) {
          await deleteExpense(card.id, linkedExpense.id);
          break; // Found and deleted, no need to continue
        }
      }
    } catch (error) {
      console.error('Error deleting plan expense:', error);
      Alert.alert('Error', 'Could not delete the expense');
    }
  };


  const flatListData = useMemo(() => [
    { id: 'balance', isBalanceCard: true },
    ...people
  ], [people]);


  const renderItem = useCallback(({ item }) => {
    if (item.isBalanceCard) {
      if (plan.distribution === 'custom') {
        return (
          <View style={[styles.personPage, user.uid !== plan.ownerId && styles.personPageMember]}>
            <View style={[styles.personHeaderCard, { backgroundColor: plan.color || '#007AFF' }]}>
              <View style={styles.personHeader}>
                              <Icon name="trophy" size={18} color={'#fff'} />
                              <Text style={styles.personTitle}>Balance</Text>
                            </View>
                            <Text style={styles.personContribution}>${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Ranking</Text>
                {contributionRanking.map((c, index) => (
                  <View key={c.person.id} style={styles.rankingRow}>
                    <Text style={styles.rankingPosition}>#{index + 1}</Text>
                    <Text style={styles.rankingName}>{c.person.userId === user.uid ? 'You' : c.person.name}</Text>
                    <Text style={styles.rankingAmount}>${c.amount.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.modifyButton} onPress={() => navigation.navigate('Settlements', { planId: plan.id })}>
                <Text style={styles.modifyButtonText}>Make Payment</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        );
      }

      return (
        <View style={[styles.personPage, user.uid !== plan.ownerId && styles.personPageMember]}>
          <View style={[styles.personHeaderCard, { backgroundColor: plan.color || '#007AFF' }]}>
            <View style={styles.personHeader}>
              <Icon name="balance-scale" size={18} color={'#fff'} />
              <Text style={styles.personTitle}>Balance</Text>
            </View>
            <Text style={styles.personContribution}>${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
          </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Contributions</Text>
              {pieChartData.length === 0 ? (
                <View style={[styles.pieChartContainer, { paddingVertical: 36 }]}> 
                  <Icon name="chart-pie" size={32} color={colors.primary} />
                  <Text style={{ marginTop: 10, color: '#666', fontWeight: '600' }}>No Contributions Yet</Text>
                </View>
              ) : (
                <>
                  <View style={styles.pieChartContainer}>
                    <PieChart
                      data={pieChartData}
                      width={screenWidth - 40}
                      height={220}
                      chartConfig={{
                        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      }}
                      accessor={"population"}
                      backgroundColor={"transparent"}
                      paddingLeft={"15"}
                      center={[70, -10]}
                      absolute
                      hasLegend={false}
                    />
                  </View>
                  <View style={styles.legendContainer}>
                    {pieChartData.map(c => (
                      <View key={c.name} style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: c.color || '#007AFF' }]} />
                        <Text style={styles.legendText}>{c.name}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Suggested Payments</Text>
              {settlements.length === 0 ? (
                <Text style={{ color: '#666', textAlign: 'center' }}>Nothing to Settle</Text>
              ) : settlements.map((s, idx) => {
                return (
                  <TouchableOpacity
                    key={`${s.from.id}-${s.to.id}-${idx}`}
                    style={styles.balanceRow}
                    onPress={() => {
                      navigation.navigate('Settlements', { planId: plan.id });
                    }}
                  >
                    <Text style={{ flex: 1, color: '#333' }}>{(s.from.userId === user.uid ? 'You' : s.from.name)} → {(s.to.userId === user.uid ? 'You' : s.to.name)}</Text>
                    <Text style={{ fontWeight: '700', color: '#333' }}>${s.amount.toFixed(2)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.modifyButton} onPress={() => navigation.navigate('Settlements', { planId: plan.id })}>
              <Text style={styles.modifyButtonText}>Modify Settlements</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    const p = item;
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
          <TouchableOpacity style={styles.addBtnPrimary} onPress={() => navigation.navigate('AddPlanContribution', { planId: plan.id })}>
            <Icon name="plus" size={14} color={'#fff'} />
            <Text style={styles.addBtnPrimaryText}>Add Contribution</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Your Expenses</Text>
            {expensesBy.length === 0 ? (
              <Text style={{ color: '#666', textAlign: 'center' }}>No Expenses</Text>
            ) : expensesBy.map(e => (
              <View key={e.id} style={[
                styles.expenseRow,
                e.settlement ? (e.receiverId ? styles.expenseRowNegative : styles.expenseRowPositive) : styles.expenseRowNegative
              ]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: '#333' }}>{e.description}</Text>
                  <Text style={{ color: '#666', fontSize: 12 }}>{e.date}</Text>
                </View>
                <Text style={{ fontWeight: '700', color: '#333', marginRight: 10 }}>${Math.abs(e.amount).toLocaleString()}</Text>
                {(p.userId === user.uid || plan.ownerId === user.uid) && (
                  <TouchableOpacity onPress={() => handleDeletePlanExpense(e.id, e)}>
                    <Icon name="trash" size={14} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }, [plan, planExpenses, settlements, total, user]);

  if (loading || !plan) {
    return <View style={styles.loadingContainer}><StatusBar style="light" /><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View>
        <View style={[styles.planCard, { backgroundColor: plan.color }]}>
          <Text style={styles.planTitle}>{plan.title}</Text>
          <View style={styles.statsBoxes}>
            <StatBox label="Total" value={`$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
            <StatBox label="Per Person" value={`$${perHead.toFixed(2)}`} />
            <StatBox label="People" value={people.length} />
          </View>
        </View>
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('GestionAddPerson', { planId: plan.id })}>
            <Icon name="user-plus" size={18} color={colors.primary} />
            <Text style={styles.actionButtonText}>Add Person</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('PlanInviteCode', { planId: plan.id })}>
            <Icon name="link" size={18} color={colors.primary} />
            <Text style={styles.actionButtonText}>Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('EditGestionPlan', { plan: plan })}>
            <Icon name="edit" size={18} color={colors.primary} />
            <Text style={styles.actionButtonText}>Edit Plan</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
          data={flatListData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          bounces={false}
          getItemLayout={(data, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
        />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddPlanContribution', { planId: plan.id })}
      >
        <Icon name="plus" size={20} color="#fff" />
      </TouchableOpacity>


    </View>
  );
};

const StatBox = ({ label, value }) => (
  <View style={styles.statBox}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  planCard: {
    paddingVertical: 40,
    paddingTop: 80, // Add padding to account for status bar
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  statsBoxes: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 20, // Add more padding
  },
  actionButton: {
    alignItems: 'center',
    gap: 5,
  },
  actionButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  personPage: {
    width: screenWidth,
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
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    padding: 12,
    marginTop: 8,
  },
  balanceRowPaid: {
    backgroundColor: '#34C759',
  },
  expenseRowPositive: {
    backgroundColor: '#e6ffe6', // Light green
    borderColor: '#34C759', // Green
  },
  expenseRowNegative: {
    backgroundColor: '#ffe6e6', // Light red
    borderColor: '#FF3B30', // Red
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modifyButton: {
    backgroundColor: '#6c757d', // A neutral grey color
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  modifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rankingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  rankingPosition: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6c757d',
    width: 40,
  },
  rankingName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  rankingAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },

  pieChartContainer: {
    alignItems: 'center',
    borderRadius: 20,
    padding: 10,
    backgroundColor: '#f8f9fa',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginVertical: 10,
  },

  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  legendColor: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  legendText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },

});

export default DetailsGestionPlansScreen;
