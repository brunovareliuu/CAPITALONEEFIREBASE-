import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, createTransaction, updateAccountBalance, createSavingsTransfer, getAccountById } from '../services/firestoreService';
import EventBus from '../utils/EventBus';

const TransferSavingsScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { fromAccount, toAccount, accountType } = route.params || {};

  const [transferring, setTransferring] = useState(false);
  const [amount, setAmount] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Real-time balances from Firestore accounts
  const [checkingBalance, setCheckingBalance] = useState(0);
  const [savingsBalance, setSavingsBalance] = useState(0);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [balanceUpdated, setBalanceUpdated] = useState(false);

  // Account objects loaded from Firestore
  const [checkingAccount, setCheckingAccount] = useState(null);
  const [savingsAccount, setSavingsAccount] = useState(null);

  // Quick amount presets
  const quickAmounts = [50, 100, 200, 500];

  // Load account objects and balances from Firestore
  useEffect(() => {
    const loadAccountsAndBalances = async () => {
      if (!fromAccount || !toAccount) {
        setLoadingBalances(false);
        return;
      }

      try {
        setLoadingBalances(true);

        // Load checking account from Firestore using accountId
        let checkingAccountData = null;
        if (fromAccount.accountId) {
          const checkingDoc = await getAccountById(fromAccount.accountId);
          if (checkingDoc.exists()) {
            checkingAccountData = {
              id: fromAccount.accountId,
              ...checkingDoc.data(),
              nickname: fromAccount.nickname || checkingDoc.data().nickname || 'Checking'
            };
            setCheckingAccount(checkingAccountData);
            setCheckingBalance(checkingDoc.data().balance || 0);
          }
        } else {
          // Fallback to direct account object
          checkingAccountData = fromAccount;
          setCheckingAccount(checkingAccountData);
          setCheckingBalance(fromAccount.balance || 0);
        }

        // Load savings account from Firestore using accountId
        let savingsAccountData = null;
        if (toAccount.accountId) {
          const savingsDoc = await getAccountById(toAccount.accountId);
          if (savingsDoc.exists()) {
            savingsAccountData = {
              id: toAccount.accountId,
              ...savingsDoc.data(),
              nickname: toAccount.nickname || savingsDoc.data().nickname || 'Savings'
            };
            setSavingsAccount(savingsAccountData);
            setSavingsBalance(savingsDoc.data().balance || 0);
          }
        } else {
          // Fallback to direct account object
          savingsAccountData = toAccount;
          setSavingsAccount(savingsAccountData);
          setSavingsBalance(toAccount.balance || 0);
        }

      } catch (error) {
        console.error('Error loading accounts and balances:', error);
        // Fallback to card balances
        setCheckingBalance(fromAccount?.saldo || fromAccount?.balance || 0);
        setSavingsBalance(toAccount?.saldo || toAccount?.balance || 0);
      } finally {
        setLoadingBalances(false);
      }
    };

    loadAccountsAndBalances();
  }, [fromAccount, toAccount]);

  // Listen for balance updates from other transfers
  useEffect(() => {
    const handleBalanceUpdate = (data) => {
      if (!data) return;

      // Update checking account balance
      if (checkingAccount && data.accountId === checkingAccount.id) {
        setCheckingBalance(data.newBalance);
        setBalanceUpdated(true);
        // Reset indicator after 2 seconds
        setTimeout(() => setBalanceUpdated(false), 2000);
      }
      // Update savings account balance
      else if (savingsAccount && data.accountId === savingsAccount.id) {
        setSavingsBalance(data.newBalance);
        setBalanceUpdated(true);
        // Reset indicator after 2 seconds
        setTimeout(() => setBalanceUpdated(false), 2000);
      }
    };

    EventBus.on('balance:updated', handleBalanceUpdate);
    return () => EventBus.off('balance:updated', handleBalanceUpdate);
  }, [checkingAccount, savingsAccount]);

  const handleQuickAmount = (quickAmount) => {
    setAmount(quickAmount.toString());
  };

  const handleTransfer = () => {
    // Validations
    if (!checkingAccount || !savingsAccount) {
      Alert.alert('Error', 'Accounts not loaded yet. Please wait...');
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (transferAmount > checkingBalance) {
      Alert.alert('Error', `Insufficient funds. Available: $${checkingBalance.toFixed(2)}`);
      return;
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  // 🔥 Nueva versión usando Firebase para transferencias a Savings
  const executeTransferWithFirebase = async () => {
    setShowConfirmModal(false);
    setTransferring(true);

    try {
      const amt = parseFloat(amount);
      console.log('🔥 Iniciando transferencia a savings con Firebase...');

      // Usar createSavingsTransfer para transferencias a savings
      console.log('🔥 Creating savings transfer:', {
        checkingAccountId: fromAccount.id,
        savingsAccountId: toAccount.id,
        amount: amt
      });

      const result = await createSavingsTransfer(
        checkingAccount.id, // checking account ID
        savingsAccount.id,  // savings account ID
        amt,
        'Transfer to Savings'
      );

      console.log('✅ Savings transfer completed:', result);

      // Emitir eventos para actualizar UI en tiempo real
      EventBus.emit('balance:updated', {
        accountId: checkingAccount.id,
        newBalance: result.checkingAccount.balance,
        timestamp: Date.now(),
      });

      EventBus.emit('balance:updated', {
        accountId: savingsAccount.id,
        newBalance: result.savingsAccount.balance,
        timestamp: Date.now(),
      });

      // Navegar a confirmación con el formato correcto
      navigation.replace('TransferConfirmation', {
        transfer: {
          id: result.transactionId,
          amount: amt,
          description: 'Transfer to Savings',
          payerAccount: result.checkingAccount,
          payeeAccount: result.savingsAccount,
        },
        previousBalance: checkingBalance,
        updatedPayerBalance: result.checkingAccount.balance,
        amount: amt,
      });

    } catch (error) {
      console.error('❌ Savings transfer error:', error);
      Alert.alert('Transfer Failed', error.message || 'An error occurred during the transfer');
    } finally {
      setTransferring(false);
    }
  };


  // Show loading state while balances are loading
  if (loadingBalances) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading account balances...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Validations
  const transferAmount = parseFloat(amount) || 0;
  const isFormValid = checkingAccount && savingsAccount && transferAmount > 0 && transferAmount <= checkingBalance;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Icon name="arrow-left" size={20} color="#007AFF" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Transfer to Savings</Text>
              <Text style={styles.headerSubtitle}>Move money from checking to savings</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Transfer Flow Visualization */}
          <View style={styles.transferFlowSection}>
            <View style={styles.accountBubble}>
              <View style={styles.accountHeader}>
                <Icon name="university" size={16} color="#007AFF" />
                <Text style={styles.bubbleName}>{checkingAccount?.nickname || fromAccount?.nickname || 'Checking'}</Text>
                {balanceUpdated && (
                  <View style={styles.updatedIndicator}>
                    <Icon name="sync" size={10} color="#34C759" />
                  </View>
                )}
              </View>
              <Text style={styles.bubbleType}>From</Text>
              {loadingBalances ? (
                <ActivityIndicator size="small" color="#007AFF" style={styles.balanceLoader} />
              ) : (
                <Text style={styles.bubbleAmount}>${checkingBalance.toFixed(2)}</Text>
              )}
            </View>

            <View style={styles.arrowContainer}>
              <View style={[styles.arrowIcon, balanceUpdated && styles.arrowIconActive]}>
                <Icon name="arrow-right" size={20} color="#007AFF" />
              </View>
            </View>

            <View style={styles.accountBubble}>
              <View style={styles.accountHeader}>
                <Icon name="piggy-bank" size={16} color="#34C759" />
                <Text style={styles.bubbleName}>{savingsAccount?.nickname || toAccount?.nickname || 'Savings'}</Text>
                {balanceUpdated && (
                  <View style={styles.updatedIndicator}>
                    <Icon name="sync" size={10} color="#34C759" />
                  </View>
                )}
              </View>
              <Text style={styles.bubbleType}>To</Text>
              {loadingBalances ? (
                <ActivityIndicator size="small" color="#34C759" style={styles.balanceLoader} />
              ) : (
                <Text style={[styles.bubbleAmount, { color: '#34C759' }]}>${savingsBalance.toFixed(2)}</Text>
              )}
            </View>
          </View>

          {/* Quick Amount Buttons */}
          <View style={styles.quickAmountsSection}>
            <Text style={styles.sectionTitle}>Quick Transfer</Text>
            <View style={styles.quickAmountsGrid}>
              {quickAmounts.map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  style={styles.quickAmountButton}
                  onPress={() => handleQuickAmount(quickAmount)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickAmountText}>${quickAmount}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Amount Input */}
          <View style={styles.amountSection}>
            <Text style={styles.sectionTitle}>Or enter amount</Text>
            <View style={styles.amountCard}>
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  maxLength={10}
                />
              </View>
              <Text style={styles.availableBalance}>
                Available: ${checkingBalance.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Transfer Preview */}
          {isFormValid && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Icon name="receipt" size={20} color="#007AFF" />
                <Text style={styles.previewTitle}>Transfer Summary</Text>
              </View>

              <View style={styles.amountDisplay}>
                <Text style={styles.amountLabel}>Amount to Transfer</Text>
                <Text style={styles.amountValue}>${transferAmount.toFixed(2)}</Text>
              </View>

              <View style={styles.balancePreview}>
                <Text style={styles.balancePreviewLabel}>Checking balance after transfer:</Text>
                <Text style={styles.balancePreviewAmount}>
                  ${(checkingBalance - transferAmount).toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Transfer Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.transferButton,
              !isFormValid && styles.transferButtonDisabled,
              isFormValid && styles.transferButtonActive
            ]}
            onPress={handleTransfer}
            disabled={!isFormValid || transferring}
            activeOpacity={0.8}
          >
            {transferring ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="arrow-up" size={20} color="#fff" />
                <Text style={styles.transferButtonText}>
                  {isFormValid ? `Transfer $${transferAmount.toFixed(2)}` : 'Enter Amount'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmModal}>
              <Icon name="arrow-up" size={48} color="#34C759" />
              <Text style={styles.confirmTitle}>Confirm Transfer</Text>
              <Text style={styles.confirmMessage}>
                Transfer ${transferAmount.toFixed(2)} from {checkingAccount?.nickname || fromAccount?.nickname} to {savingsAccount?.nickname || toAccount?.nickname}?
              </Text>
              <Text style={styles.confirmSubtext}>This will move money to your savings account.</Text>

              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={styles.confirmButtonCancel}
                  onPress={() => setShowConfirmModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.confirmButtonCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmButtonConfirm}
                  onPress={executeTransferWithFirebase} // 🔥 Usar Firebase
                  activeOpacity={0.7}
                >
                  <Text style={styles.confirmButtonConfirmText}>Transfer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
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

  // Header with white background
  headerContainer: {
    backgroundColor: '#fff',
    paddingTop: 0,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },


  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  // Account card styles
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  accountGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  accountType: {
    fontSize: 14,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Input styles
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    paddingRight: 50,
    fontSize: 16,
    color: '#1a1a1a',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputIcon: {
    position: 'absolute',
    right: 16,
    top: 18,
  },
  statusIcon: {
    position: 'absolute',
    right: 16,
    top: 18,
  },

  // Status cards
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorStatusCard: {
    backgroundColor: '#FFEBEE',
    shadowColor: '#FF3B30',
  },
  statusIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  // Amount card styles
  amountCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FF9500',
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  amountFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  availableLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  availableAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  // Medium selector styles
  mediumCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  mediumSelector: {
    flexDirection: 'row',
    gap: 16,
  },
  mediumButton: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  mediumButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mediumIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediumText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  mediumTextActive: {
    color: '#007AFF',
  },
  mediumSubtext: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },

  // Description styles
  descriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  descriptionInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
  // Preview card styles
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  transferFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  accountBubble: {
    alignItems: 'center',
    flex: 1,
  },
  bubbleName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  bubbleType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  arrowContainer: {
    paddingHorizontal: 16,
  },
  amountDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FF9500',
  },
  balancePreview: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  balancePreviewLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  balancePreviewAmount: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007AFF',
  },

  // Footer styles
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  transferButtonActive: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  transferButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  transferButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButtonCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  confirmButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButtonConfirm: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  confirmButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // New styles for TransferSavingsScreen
  transferFlowSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 30,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  accountBubble: {
    alignItems: 'center',
    flex: 1,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  arrowIcon: {
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
    padding: 12,
  },
  arrowIconActive: {
    backgroundColor: '#E8F5E8',
    transform: [{ scale: 1.1 }],
  },
  updatedIndicator: {
    marginLeft: 4,
    padding: 2,
    borderRadius: 8,
    backgroundColor: '#E8F5E8',
  },
  bubbleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  bubbleType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  bubbleAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  balanceLoader: {
    marginTop: 4,
  },
  arrowContainer: {
    paddingHorizontal: 20,
  },
  quickAmountsSection: {
    marginHorizontal: 20,
    marginTop: 30,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  quickAmountButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E8F4FA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00487A',
  },
  amountSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  amountCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  availableBalance: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});

export default TransferSavingsScreen;

