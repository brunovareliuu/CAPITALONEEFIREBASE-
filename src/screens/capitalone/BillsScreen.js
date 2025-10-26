import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import StandardHeader from '../../components/StandardHeader';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getUserProfile } from '../../services/firestoreService';
import { getCustomerAccounts, createBill, getAccountBills, updateBill, deleteBill } from '../../services/nessieService';
import { addPaymentToHistory, initializeRecurringBill, deleteRecurringBill } from '../../services/firebaseRecurringService';

const BillsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [userAccounts, setUserAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // all, pending, completed, cancelled, recurring

  // Form states for creating bills
  const [billForm, setBillForm] = useState(() => {
    // Initialize with current date (today)
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayString = `${y}-${m}-${d}`;

    return {
      payee: '',
      nickname: '',
      payment_amount: '',
      payment_date: todayString,
      recurring_date: d, // Initialize with the day of the month
      is_recurring: false, // New field to control if it's recurring
      status: 'pending'
    };
  });

  // Load user profile and accounts
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const profileDoc = await getUserProfile(user.uid);
        if (profileDoc.exists()) {
          const profile = profileDoc.data();
          setUserProfile(profile);

          // Load user's accounts from Nessie
          if (profile.nessieCustomerId) {
            const accounts = await getCustomerAccounts(profile.nessieCustomerId);
            setUserAccounts(accounts.filter(acc => acc.balance > 0));
            if (accounts.length > 0) {
              setSelectedAccount(accounts[0]);
            }
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        Alert.alert('Error', 'Failed to load account data');
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [user]);

  // Load bills when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadBills();
    }
  }, [selectedAccount]);

  // Refresh bills when screen comes back into focus (e.g., after updating a bill in BillsDetailsScreen)
  useFocusEffect(
    React.useCallback(() => {
      if (selectedAccount) {
        console.log('🔄 BillsScreen focused - refreshing bills data');
        loadBills();
      }
    }, [selectedAccount])
  );

  const loadBills = async () => {
    if (!selectedAccount) return;

    try {
      console.log('📄 Loading bills for account:', selectedAccount._id);
      const accountBills = await getAccountBills(selectedAccount._id);
      console.log('📄 Bills loaded:', accountBills.length);
      setBills(accountBills);
    } catch (error) {
      console.error('Error loading bills:', error);
      Alert.alert('Error', 'Failed to load bills');
    }
  };

  const handleCreateBill = async () => {
    if (!billForm.payee.trim()) {
      Alert.alert('Error', 'Please enter a payee');
      return;
    }

    if (!billForm.payment_amount.trim()) {
      Alert.alert('Error', 'Please enter a payment amount');
      return;
    }

    const amount = parseFloat(billForm.payment_amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    if (!selectedAccount) {
      Alert.alert('Error', 'No account selected');
      return;
    }

    setCreating(true);
    try {
      console.log('💰 Creating bill...');
      const billData = {
        status: billForm.is_recurring ? 'recurring' : 'pending', // Status based on is_recurring
        payee: billForm.payee.trim(),
        nickname: billForm.nickname.trim() || billForm.payee.trim(),
        payment_amount: amount,
      };

      // Solo agregar payment_date si tiene valor válido
      if (billForm.payment_date && billForm.payment_date.trim()) {
        billData.payment_date = billForm.payment_date.trim();
      }

      // Solo agregar recurring_date si es recurring y tiene valor válido
      if (billForm.is_recurring && billForm.recurring_date && billForm.recurring_date.trim()) {
        billData.recurring_date = parseInt(billForm.recurring_date.trim());
      }

      console.log('Bill data to send:', billData);
      const createdBill = await createBill(selectedAccount._id, billData);
      console.log('✅ Bill created:', createdBill);

      // Initialize recurring bill in Firebase if it's recurring
      if (billForm.is_recurring) {
        try {
          await initializeRecurringBill(user.uid, createdBill._id, createdBill);
          console.log('✅ Recurring bill initialized in Firebase');
        } catch (error) {
          console.error('Error initializing recurring bill in Firebase:', error);
          // Don't fail the whole operation if Firebase fails
        }
      }

      // Reload bills
      await loadBills();

      // Reset form and close modal
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const todayString = `${y}-${m}-${d}`;

      setBillForm({
        payee: '',
        nickname: '',
        payment_amount: '',
        payment_date: todayString,
        recurring_date: d,
        is_recurring: false,
        status: 'pending'
      });
      setShowCreateModal(false);

      Alert.alert('Success', 'Bill created successfully!');
    } catch (error) {
      console.error('Error creating bill:', error);
      Alert.alert('Error', 'Failed to create bill. Please try again.');
    } finally {
      setCreating(false);
    }
  };


  const handleUpdateBillStatus = async (billId, newStatus) => {
    try {
      console.log('🔄 Updating bill status:', billId, newStatus);
      await updateBill(billId, { status: newStatus });
      await loadBills(); // Reload bills
      Alert.alert('Success', `Bill marked as ${newStatus}`);
    } catch (error) {
      console.error('Error updating bill:', error);
      Alert.alert('Error', 'Failed to update bill status');
    }
  };

  const handleDeleteBill = async (billId, payee) => {
    Alert.alert(
      'Cancel Bill',
      `Are you sure you want to cancel the bill for ${payee}? This will mark it as cancelled but keep it in your records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cancel Bill',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚫 Cancelling bill:', billId);
              await updateBill(billId, { status: 'cancelled' });
              await loadBills(); // Reload bills
              Alert.alert('Success', 'Bill cancelled successfully');
            } catch (error) {
              console.error('Error cancelling bill:', error);
              Alert.alert('Error', 'Failed to cancel bill');
            }
          }
        }
      ]
    );
  };

  const handlePermanentDelete = async (billId, payee, isRecurring) => {
    Alert.alert(
      'Eliminar Permanentemente',
      `¿Estás completamente seguro de que quieres eliminar permanentemente la factura de ${payee}? Esta acción no se puede deshacer y se perderá todo el historial de pagos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar Definitivamente',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Permanently deleting bill:', billId);

              // Delete from Nessie first
              await deleteBill(billId);
              console.log('✅ Deleted from Nessie');

              // Delete from Firebase if it was recurring
              if (isRecurring) {
                await deleteRecurringBill(user.uid, billId);
                console.log('✅ Deleted from Firebase');
              }

              // Reload bills to update the UI
              await loadBills();
              Alert.alert('Eliminado', 'La factura ha sido eliminada permanentemente');

            } catch (error) {
              console.error('Error permanently deleting bill:', error);
              Alert.alert('Error', 'No se pudo eliminar la factura. Inténtalo de nuevo.');
            }
          }
        }
      ]
    );
  };

  // Handle bill press - show action menu for all bills
  const handleBillPress = (bill) => {
    handleBillActions(bill);
  };

  // Quick actions for bills
  const handleBillActions = (bill) => {
    const options = [];

    // Add Pay option for pending bills
    if (bill.status === 'pending') {
      options.push({
        text: 'Pagar',
        style: 'default',
        onPress: async () => {
          try {
            setLoading(true);

            // Register payment in Firebase
            await addPaymentToHistory(user.uid, bill._id, {
              amount: bill.payment_amount,
              month: new Date().getMonth(),
              year: new Date().getFullYear(),
              payee: bill.payee
            });

            // Update bill status to completed in Nessie
            await updateBill(bill._id, { status: 'completed' });

            // Reload bills to show updated status
            await loadBills();

            Alert.alert('¡Pago Exitoso!', `Pago de $${formatCurrency(bill.payment_amount)} registrado correctamente.`);
          } catch (error) {
            console.error('Error processing payment:', error);
            Alert.alert('Error', 'No se pudo procesar el pago. Inténtalo de nuevo.');
          } finally {
            setLoading(false);
          }
        }
      });
    }

    // Add Cancel option for pending/recurring bills
    if (bill.status === 'pending' || bill.status === 'recurring') {
      options.push({
        text: 'Cancelar Bill',
        style: 'destructive',
        onPress: () => handleDeleteBill(bill._id, bill.payee)
      });
    }

    // Add Details option for all bills
    options.push({
      text: 'Ver Detalles',
      onPress: () => navigation.navigate('BillsDetails', { bill })
    });

    // Show action sheet
    Alert.alert(
      `Opciones para ${bill.payee}`,
      `Monto: $${formatCurrency(bill.payment_amount)}`,
      [
        ...options,
        { text: 'Cerrar', style: 'cancel' }
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FF9500';
      case 'completed': return '#34C759';
      case 'cancelled': return '#FF3B30';
      case 'recurring': return '#007AFF';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return 'clock';
      case 'completed': return 'check-circle';
      case 'cancelled': return 'times-circle';
      case 'recurring': return 'sync';
      default: return 'question-circle';
    }
  };

  // Filter bills based on active filter
  const getFilteredBills = () => {
    if (activeFilter === 'all') return bills;

    return bills.filter(bill => {
      switch (activeFilter) {
        case 'pending':
          return bill.status === 'pending';
        case 'completed':
          return bill.status === 'completed';
        case 'cancelled':
          return bill.status === 'cancelled';
        case 'recurring':
          return bill.status === 'recurring' || bill.recurring_date;
        default:
          return true;
      }
    });
  };

  // Filter options
  const filterOptions = [
    { id: 'all', label: 'All', icon: 'list' },
    { id: 'pending', label: 'Pending', icon: 'clock' },
    { id: 'completed', label: 'Completed', icon: 'check-circle' },
    { id: 'cancelled', label: 'Cancelled', icon: 'times-circle' },
    { id: 'recurring', label: 'Recurring', icon: 'sync' },
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate days until next payment for recurring bills
  const getDaysUntilNextPayment = (bill) => {
    if (!bill.recurring_date) return 0;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Create date for this month's payment using the recurring day
    const thisMonthPayment = new Date(currentYear, currentMonth, bill.recurring_date);

    // If this month's payment hasn't passed yet, return days until then
    if (thisMonthPayment >= today) {
      const diffTime = thisMonthPayment.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Otherwise, calculate next month's payment
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonthPayment = new Date(nextYear, nextMonth, bill.recurring_date);

    const diffTime = nextMonthPayment.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading bills...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <StandardHeader
        title="Bills"
        onBack={() => navigation.goBack()}
        rightComponent={(
          <TouchableOpacity onPress={() => setShowCreateModal(true)}>
            <Icon name="plus" size={20} color="#007AFF" />
          </TouchableOpacity>
        )}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Account Selector */}
        {userAccounts.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountSelectorContainer}
            >
              {userAccounts.map((account) => (
                <TouchableOpacity
                  key={account._id}
                  style={[
                    styles.accountOption,
                    selectedAccount?._id === account._id && styles.accountOptionSelected
                  ]}
                  onPress={() => setSelectedAccount(account)}
                >
                  <Text style={[
                    styles.accountOptionText,
                    selectedAccount?._id === account._id && styles.accountOptionTextSelected
                  ]}>
                    {account.nickname || account.type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bills Filters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Filter Bills</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContainer}
          >
            <View style={styles.filterButtons}>
              {filterOptions.map((filter) => (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    styles.filterButton,
                    activeFilter === filter.id && styles.filterButtonActive
                  ]}
                  onPress={() => setActiveFilter(filter.id)}
                  activeOpacity={0.8}
                >
                  <Icon
                    name={filter.icon}
                    size={16}
                    color={activeFilter === filter.id ? '#fff' : '#666'}
                    style={styles.filterIcon}
                  />
                  <Text style={[
                    styles.filterButtonText,
                    activeFilter === filter.id && styles.filterButtonTextActive
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Bills List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Bills</Text>
            <Text style={styles.billsCount}>{getFilteredBills().length} bills</Text>
          </View>

          {getFilteredBills().length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="receipt" size={48} color="#ccc" />
              <Text style={styles.emptyTitle}>No bills yet</Text>
              <Text style={styles.emptySubtitle}>
                Create your first bill to start tracking payments
              </Text>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Icon name="plus" size={16} color="#fff" />
                <Text style={styles.emptyActionText}>Create Bill</Text>
              </TouchableOpacity>
            </View>
          ) : (
            getFilteredBills().map((bill) => (
              <TouchableOpacity
                key={bill._id}
                style={styles.billItem}
                onPress={() => handleBillPress(bill)}
                activeOpacity={0.7}
              >
                <View style={styles.billHeader}>
                  <View style={styles.payeeContainer}>
                    <Text style={styles.payeeText}>{bill.payee}</Text>
                    {bill.nickname && bill.nickname !== bill.payee && (
                      <Text style={styles.nicknameText}>{bill.nickname}</Text>
                    )}
                  </View>
                  <View style={styles.rightContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(bill.status) }]}>
                      <Icon name={getStatusIcon(bill.status)} size={12} color="#fff" />
                      <Text style={styles.statusText}>{bill.status}</Text>
                    </View>
                    <Icon name="chevron-right" size={16} color="#ccc" style={styles.arrowIcon} />
                  </View>
                </View>

                <View style={styles.billDetails}>
                  <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>Amount:</Text>
                    <Text style={styles.amountValue}>$ {formatCurrency(bill.payment_amount)}</Text>
                  </View>

                  {bill.payment_date && (
                    <View style={styles.dateContainer}>
                      <Text style={styles.dateLabel}>Due Date:</Text>
                      <Text style={styles.dateValue}>{bill.payment_date}</Text>
                    </View>
                  )}

                  {bill.status === 'recurring' && bill.recurring_date && (
                    <View style={styles.recurringContainer}>
                      <Text style={styles.recurringLabel}>Recurring:</Text>
                      <Text style={styles.recurringValue}>{bill.recurring_date}th of each month</Text>
                    </View>
                  )}
                </View>

              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create Bill Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCreateModal(false)}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity activeOpacity={1}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Create New Bill</Text>
                  <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                    <Icon name="times" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>

                  {/* Payee */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payee *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g., Comcast, Washington Gas"
                      value={billForm.payee}
                      onChangeText={(text) => setBillForm({...billForm, payee: text})}
                    />
                  </View>

                  {/* Nickname */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nickname</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g., Internet Bill, Utilities"
                      value={billForm.nickname}
                      onChangeText={(text) => setBillForm({...billForm, nickname: text})}
                    />
                  </View>

                  {/* Amount */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Amount *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      value={billForm.payment_amount}
                      onChangeText={(text) => setBillForm({...billForm, payment_amount: text})}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  {/* Payment Date */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Date</Text>
                    <DateSelector
                      value={billForm.payment_date}
                      onChange={(dateString) => {
                        // Extraer el día directamente de la cadena YYYY-MM-DD para evitar problemas de zona horaria
                        const dayOfMonth = dateString.split('-')[2]; // Día es la tercera parte

                        setBillForm({
                          ...billForm,
                          payment_date: dateString,
                          recurring_date: dayOfMonth // Automáticamente usar el día del mes
                        });
                      }}
                    />
                    <Text style={styles.inputHelper}>Select the payment date (recurring date will auto-fill)</Text>
                  </View>

                  {/* Is Recurring */}
                  <View style={styles.inputGroup}>
                    <TouchableOpacity
                      style={styles.checkboxContainer}
                      onPress={() => setBillForm({
                        ...billForm,
                        is_recurring: !billForm.is_recurring
                      })}
                    >
                      <View style={[
                        styles.checkbox,
                        billForm.is_recurring && styles.checkboxChecked
                      ]}>
                        {billForm.is_recurring && (
                          <Icon name="check" size={12} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.checkboxLabel}>Esto es recurrente</Text>
                    </TouchableOpacity>
                    <Text style={styles.inputHelper}>
                      Marca si esta factura se repite mensualmente
                    </Text>
                  </View>

                  {/* Recurring Date - Only show if is_recurring */}
                  {billForm.is_recurring && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Recurring Date</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Day of month (1-31)"
                        value={billForm.recurring_date}
                        onChangeText={(text) => setBillForm({...billForm, recurring_date: text})}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.inputHelper}>Auto-filled from payment date (can be changed)</Text>
                    </View>
                  )}

                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowCreateModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.createBillButton, creating && styles.createBillButtonDisabled]}
                    onPress={handleCreateBill}
                    disabled={creating}
                  >
                    {creating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Icon name="plus" size={16} color="#fff" />
                        <Text style={styles.createBillButtonText}>Create Bill</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  // Header styles removed - using StandardHeader
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  billsCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  accountSelectorContainer: {
    paddingVertical: 4,
  },
  accountOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  accountOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  accountOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  accountOptionTextSelected: {
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  billItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrowIcon: {
    marginLeft: 4,
  },
  payeeContainer: {
    flex: 1,
  },
  payeeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  nicknameText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  billDetails: {
    marginBottom: 16,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF9500',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  dateValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  recurringContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recurringLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  recurringValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  billActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  completeButton: {
    backgroundColor: '#34C759',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },
  inputHelper: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  statusOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusOptionTextSelected: {
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  createBillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    gap: 8,
  },
  createBillButtonDisabled: {
    opacity: 0.6,
  },
  createBillButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Checkbox Styles
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },

  // Filter Styles
  filterScrollContainer: {
    paddingVertical: 4,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 80,
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

// Componente interno para seleccionar fecha con DateTimePicker estilo rueda
const DateSelector = ({ value, onChange }) => {
  const [date, setDate] = useState(() => {
    // Siempre inicializar con la fecha actual
    let initialDate = new Date();

    // Asegurarse de que la fecha inicial sea válida
    if (isNaN(initialDate.getTime()) || initialDate.getFullYear() < 2000) {
      initialDate = new Date();
    }

    // Si hay un valor válido, usarlo
    if (value && value.trim() !== '') {
      const parts = value.split('-');
      if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
        const parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        // Verificar que la fecha sea válida y no del pasado remoto
        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900 && parsedDate.getFullYear() <= 2100) {
          initialDate = parsedDate;
        }
      }
    }

    return initialDate;
  });

  const [show, setShow] = useState(true);

  const onChangeInner = (_, selectedDate) => {
    if (selectedDate) {
      const currentDate = selectedDate;
      setDate(currentDate);
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
      const d = String(currentDate.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${d}`);
    }
  };

  return (
    <View style={{ backgroundColor: '#f8f9fa', borderRadius: 12, padding: 10 }}>
      <DateTimePicker
        value={date}
        mode="date"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={onChangeInner}
        minimumDate={new Date(1, 0, 1)} // Fecha más antigua posible (1 de enero del año 1)
        maximumDate={new Date(9999, 11, 31)} // Fecha más futura posible (31 de diciembre del año 9999)
        textColor="#1a1a1a"
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
};

export default BillsScreen;
