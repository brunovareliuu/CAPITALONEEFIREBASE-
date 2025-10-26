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
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { updateBill } from '../services/nessieService';
import {
  getPaymentHistory,
  addPaymentToHistory,
  isPaidThisMonth,
  getRecentPayments,
  initializeRecurringBill,
  deleteRecurringBill
} from '../services/firebaseRecurringService';
import { deleteBill } from '../services/nessieService';
import { migrateAsyncStorageToFirebase, checkMigrationNeeded } from '../services/migrationService';

const BillsDetailsScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { bill } = route.params;
  const [loading, setLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paidThisMonth, setPaidThisMonth] = useState(false);

  // Load payment history on component mount
  useEffect(() => {
    const loadPaymentData = async () => {
      try {
        console.log('📊 Loading payment data for bill:', bill._id);

        // Check if migration from AsyncStorage is needed
        const needsMigration = await checkMigrationNeeded();
        if (needsMigration) {
          console.log('🔄 Migration needed, starting...');
          const migrationResult = await migrateAsyncStorageToFirebase(user.uid);
          if (migrationResult.migrated) {
            Alert.alert('Actualización', migrationResult.message);
          }
        }

        // Initialize the recurring bill in Firebase if it doesn't exist
        await initializeRecurringBill(user.uid, bill._id, bill);

        const [history, paidStatus] = await Promise.all([
          getRecentPayments(user.uid, bill._id),
          isPaidThisMonth(user.uid, bill._id)
        ]);

        console.log('✅ Payment data loaded - history:', history.length, 'payments, paid this month:', paidStatus);

        setPaymentHistory(history);
        setPaidThisMonth(paidStatus);
      } catch (error) {
        console.error('❌ Error loading payment data:', error);
      }
    };

    if (user && bill) {
      loadPaymentData();
    }
  }, [user, bill]);

  // Calculate days until next payment
  const getDaysUntilNextPayment = (recurringDay) => {
    if (!recurringDay) return 0;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Create date for this month's payment using the recurring day
    const thisMonthPayment = new Date(currentYear, currentMonth, recurringDay);

    // If this month's payment hasn't passed yet, return days until then
    if (thisMonthPayment >= today) {
      const diffTime = thisMonthPayment.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Otherwise, calculate next month's payment
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonthPayment = new Date(nextYear, nextMonth, recurringDay);

    const diffTime = nextMonthPayment.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleDeleteBill = () => {
    Alert.alert(
      'Eliminar Factura',
      `¿Estás seguro de que quieres eliminar la factura de ${bill.payee}? Esta acción marcará la factura como cancelada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateBill(bill._id, { status: 'cancelled' });
              Alert.alert('Eliminada', 'La factura ha sido marcada como cancelada');
              navigation.goBack(); // Volver a la pantalla anterior
            } catch (error) {
              console.error('Error cancelling bill:', error);
              Alert.alert('Error', 'No se pudo eliminar la factura');
            }
          }
        }
      ]
    );
  };

  const handlePermanentDelete = () => {
    Alert.alert(
      'Eliminar Permanentemente',
      `¿Estás completamente seguro de que quieres eliminar permanentemente la factura de ${bill.payee}? Se perderá todo el historial de pagos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar Definitivamente',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from Nessie first
              await deleteBill(bill._id);
              console.log('✅ Deleted from Nessie');

              // Delete from Firebase
              await deleteRecurringBill(user.uid, bill._id);
              console.log('✅ Deleted from Firebase');

              Alert.alert('Eliminada', 'La factura ha sido eliminada permanentemente');
              navigation.goBack(); // Volver a la pantalla anterior
            } catch (error) {
              console.error('Error permanently deleting bill:', error);
              Alert.alert('Error', 'No se pudo eliminar la factura');
            }
          }
        }
      ]
    );
  };

  const handlePayment = async () => {
    if (paidThisMonth) {
      Alert.alert('Información', 'Ya registraste un pago para este mes.');
      return;
    }

    try {
      setLoading(true);
      console.log('💰 Starting payment registration for bill:', bill._id);

      // Register payment in history
      const now = new Date();
      console.log('📝 Adding payment to history for bill:', bill._id);

      await addPaymentToHistory(user.uid, bill._id, {
        amount: bill.payment_amount,
        month: now.getMonth(),
        year: now.getFullYear(),
        payee: bill.payee
      });

      console.log('✅ Payment added to Firebase successfully');

      // Update state
      const newHistory = await getRecentPayments(user.uid, bill._id);
      console.log('📊 Updated payment history:', newHistory.length, 'payments');

      setPaymentHistory(newHistory);
      setPaidThisMonth(true);

      const daysUntilNext = getDaysUntilNextPayment(bill.recurring_date);
      Alert.alert(
        '¡Pago Registrado!',
        `Pago registrado para ${bill.payee}.\n\nFaltan ${daysUntilNext} días para el próximo pago.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ Error registering payment:', error);
      Alert.alert('Error', 'No se pudo registrar el pago. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Function to determine bill status
  const getStatusText = (bill, paidThisMonth) => {
    // If bill has recurring_date, it's a recurring bill
    if (bill.recurring_date) {
      return 'Recurrente';
    }

    // If no recurring_date, it's a one-time bill
    if (paidThisMonth) {
      return 'Completada';
    }

    return 'Pendiente';
  };

  // Function to get status icon
  const getStatusIcon = (bill, paidThisMonth) => {
    // If bill has recurring_date, it's a recurring bill
    if (bill.recurring_date) {
      return 'sync';
    }

    // If no recurring_date, it's a one-time bill
    if (paidThisMonth) {
      return 'check-circle';
    }

    return 'clock';
  };

  // Function to get status color
  const getStatusColor = (bill, paidThisMonth) => {
    // If bill has recurring_date, it's a recurring bill
    if (bill.recurring_date) {
      return '#007AFF'; // Blue for recurring
    }

    // If no recurring_date, it's a one-time bill
    if (paidThisMonth) {
      return '#34C759'; // Green for completed
    }

    return '#FF9500'; // Orange for pending
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={20} color="#004977" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalles de Factura</Text>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            Alert.alert(
              'Opciones',
              '¿Qué deseas hacer con esta factura?',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Marcar como Cancelada',
                  onPress: handleDeleteBill
                },
                {
                  text: 'Eliminar Permanentemente',
                  style: 'destructive',
                  onPress: handlePermanentDelete
                }
              ]
            );
          }}
        >
          <Icon name="ellipsis-v" size={20} color="#004977" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Bill Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.payeeContainer}>
              <Text style={styles.payeeText}>{bill.payee}</Text>
              {bill.nickname && bill.nickname !== bill.payee && (
                <Text style={styles.nicknameText}>{bill.nickname}</Text>
              )}
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: getStatusColor(bill, paidThisMonth)
            }]}>
              <Icon name={getStatusIcon(bill, paidThisMonth)} size={12} color="#fff" />
              <Text style={styles.statusText}>{getStatusText(bill, paidThisMonth)}</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Monto:</Text>
              <Text style={styles.infoValue}>$ {formatCurrency(bill.payment_amount)}</Text>
            </View>

            {bill.recurring_date && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Día de pago:</Text>
                <Text style={styles.infoValue}>{bill.recurring_date} de cada mes</Text>
              </View>
            )}

            {bill.payment_date && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Fecha inicial:</Text>
                <Text style={styles.infoValue}>{formatDate(bill.payment_date)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Current Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {bill.recurring_date ? 'Estado del Mes Actual' : 'Estado del Pago'}
          </Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusIndicator, {
              backgroundColor: getStatusColor(bill, paidThisMonth)
            }]}>
              <Icon
                name={getStatusIcon(bill, paidThisMonth)}
                size={24}
                color="#fff"
              />
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>
                {paidThisMonth
                  ? (bill.recurring_date ? '¡Ya pagaste este mes!' : '¡Pago completado!')
                  : (bill.recurring_date ? 'Pendiente de pago' : 'Pago pendiente')
                }
              </Text>
              <Text style={styles.statusSubtitle}>
                {paidThisMonth
                  ? (bill.recurring_date ? 'El pago de este mes ya fue registrado' : 'Esta factura ha sido pagada')
                  : (bill.recurring_date
                      ? `Próximo pago: ${bill.recurring_date} de ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`
                      : 'Esta factura está pendiente de pago'
                    )
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Next Payment / Payment Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {bill.recurring_date ? 'Próximo Pago' : 'Estado del Pago'}
          </Text>
          <View style={styles.nextPaymentContainer}>
            <View style={styles.nextPaymentInfo}>
              <Text style={styles.nextPaymentAmount}>$ {formatCurrency(bill.payment_amount)}</Text>
              {bill.recurring_date ? (
                <>
                  <Text style={styles.nextPaymentDate}>
                    {bill.recurring_date} de {new Date(Date.now() + getDaysUntilNextPayment(bill.recurring_date) * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text style={styles.daysUntil}>
                    Faltan {getDaysUntilNextPayment(bill.recurring_date)} días
                  </Text>
                </>
              ) : (
                <Text style={styles.nextPaymentDate}>
                  {paidThisMonth ? 'Pago completado' : 'Pago pendiente'}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.payButton, (paidThisMonth || loading) && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={paidThisMonth || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="credit-card" size={16} color="#fff" />
              )}
              <Text style={styles.payButtonText}>
                {paidThisMonth ? 'Ya Pagado' : loading ? 'Registrando...' : 'Registrar Pago'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment History */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historial de Pagos</Text>
          {paymentHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Icon name="history" size={48} color="#ccc" />
              <Text style={styles.emptyHistoryTitle}>Sin historial aún</Text>
              <Text style={styles.emptyHistorySubtitle}>
                Los pagos registrados aparecerán aquí
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {paymentHistory.map((payment) => (
                <View key={payment.id} style={styles.historyItem}>
                  <View style={styles.historyItemLeft}>
                    <View style={styles.paymentIcon}>
                      <Icon name="check-circle" size={16} color="#34C759" />
                    </View>
                    <View>
                      <Text style={styles.historyAmount}>$ {formatCurrency(payment.amount)}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(payment.date).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyItemRight}>
                    <Text style={styles.historyMonth}>
                      {new Date(payment.date).toLocaleDateString('es-ES', {
                        month: 'short',
                        year: '2-digit'
                      }).toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  payeeContainer: {
    flex: 1,
  },
  payeeText: {
    fontSize: 22,
    fontWeight: '700',
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  cardBody: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  nextPaymentContainer: {
    gap: 16,
  },
  nextPaymentInfo: {
    alignItems: 'center',
    gap: 8,
  },
  nextPaymentAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF9500',
  },
  nextPaymentDate: {
    fontSize: 16,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  daysUntil: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  payButtonDisabled: {
    backgroundColor: '#ccc',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyHistoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyHistorySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  historyItemRight: {
    alignItems: 'flex-end',
  },
  historyMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});

export default BillsDetailsScreen;
