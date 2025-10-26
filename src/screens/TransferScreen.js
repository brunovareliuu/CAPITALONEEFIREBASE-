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
import { getUserProfile, createTransaction, updateAccountBalance, getAccountById, getUserAccounts } from '../services/firestoreService';
import EventBus from '../utils/EventBus';

const TransferScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [userAccounts, setUserAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);

  // Form state
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountIdInput, setAccountIdInput] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [medium, setMedium] = useState('balance');

  // Validation state
  const [accountIdVerified, setAccountIdVerified] = useState(false);
  const [verifiedAccountData, setVerifiedAccountData] = useState(null);
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // UI state
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Load user profile and accounts
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const profileDoc = await getUserProfile(user.uid);
        if (profileDoc.exists()) {
          const profile = profileDoc.data();
          setUserProfile(profile);

          // Load user's accounts from Firebase
          const accounts = await new Promise((resolve) => {
            const unsubscribe = getUserAccounts(user.uid, (userAccounts) => {
              unsubscribe();
              resolve(userAccounts);
            });
          });

          // Filter accounts that can be used for transfers (debit/checking accounts with positive balance)
          const transferableAccounts = accounts.filter(acc =>
            (acc.accountType === 'debit' || acc.accountType === 'checking') && acc.balance > 0
          );

          setUserAccounts(transferableAccounts);
          if (transferableAccounts.length > 0) {
            setSelectedAccount(transferableAccounts[0]);
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

  // Debounced validation of Account Number
  useEffect(() => {
    if (accountIdInput.length >= 10) {
      const timer = setTimeout(() => {
        verifyAccountId(accountIdInput);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setAccountIdVerified(false);
      setVerifiedAccountData(null);
      setVerifyError('');
    }
  }, [accountIdInput]);

  const verifyAccountId = async (accountId) => {
    if (!accountId.trim()) return;

    // Check if trying to send to own account (by _id or account_number)
    if (selectedAccount && (accountId === selectedAccount._id || accountId === selectedAccount.account_number)) {
      setAccountIdVerified(false);
      setVerifiedAccountData(null);
      setVerifyError('Cannot transfer to the same account');
      return;
    }

    setIsVerifying(true);
    try {
      const accountDoc = await getAccountById(accountId);
      if (accountDoc.exists()) {
        setAccountIdVerified(true);
        setVerifiedAccountData(accountDoc.data());
        setVerifyError('');
      } else {
        setAccountIdVerified(false);
        setVerifiedAccountData(null);
        setVerifyError('Account not found');
      }
    } catch (error) {
      setAccountIdVerified(false);
      setVerifiedAccountData(null);
      setVerifyError('Could not validate account');
    }
    setIsVerifying(false);
  };

  const handleTransfer = () => {
    // Validations
    if (!selectedAccount) {
      Alert.alert('Error', 'Please select a source account');
      return;
    }

    if (!accountIdVerified || !verifiedAccountData) {
      Alert.alert('Error', 'Please verify the recipient account ID');
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const availableBalance = medium === 'balance' ? selectedAccount.balance : selectedAccount.rewards || 0;
    if (transferAmount > availableBalance) {
      Alert.alert('Error', `Insufficient ${medium}. Available: $${availableBalance.toFixed(2)}`);
      return;
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  // 🔥 Nueva versión usando Firebase (reemplaza Nessie)
  const executeTransferWithFirebase = async () => {
    setShowConfirmModal(false);
    setTransferring(true);

    try {
      const amt = parseFloat(amount);
      console.log('🔥 Iniciando transferencia con Firebase...');

      // Paso 1: Obtener cuenta del pagador desde Firebase
      const payerAccountDoc = await getAccountById(selectedAccount.id);
      if (!payerAccountDoc.exists()) {
        throw new Error('Payer account not found in Firebase');
      }

      const payerAccountData = payerAccountDoc.data();
      const previousBalance = payerAccountData.balance;
      const expectedNewBalance = previousBalance - amt;

      console.log('💰 Balance ANTES del transfer:', previousBalance);
      console.log('💰 Monto a transferir:', amt);
      console.log('💰 Balance ESPERADO después:', expectedNewBalance);

      // Paso 2: Verificar fondos suficientes
      if (expectedNewBalance < 0 && !payerAccountData.allowOverdraft) {
        throw new Error('Insufficient funds');
      }

      // Paso 3: Actualizar balance del pagador
      console.log('📝 Actualizando balance del pagador...');
      const payerBalanceUpdate = await updateAccountBalance(selectedAccount.id, -amt);
      console.log('✅ Balance del pagador actualizado:', payerBalanceUpdate.newBalance);

      // Paso 4: Crear transacción en Firebase
      console.log('📝 Creando transacción en Firebase...');
      const transactionData = {
        userId: user.uid,
        type: 'transfer_out', // transfer_out, transfer_in, payment, etc.
        amount: amt,
        medium: medium, // 'balance' o 'rewards'
        description: description || 'P2P Transfer',

        // Información del pagador
        payerAccountId: selectedAccount.id,
        payerAccountNumber: selectedAccount.accountNumber,
        payerName: selectedAccount.nickname,

        // Información del receptor
        payeeAccountId: verifiedAccountData.id,
        payeeAccountNumber: verifiedAccountData.account_number,
        payeeName: verifiedAccountData.nickname,

        // Balances
        previousBalance: previousBalance,
        newBalance: payerBalanceUpdate.newBalance,

        // Metadata
        status: 'completed',
        transactionDate: new Date().toISOString().split('T')[0],
        createdBy: user.uid,
      };

      const transactionDoc = await createTransaction(transactionData);
      console.log('✅ Transacción creada en Firebase:', transactionDoc.id);

      // Paso 5: Emitir evento para actualizar UI en tiempo real
      EventBus.emit('balance:updated', {
        accountId: selectedAccount.id,
        newBalance: payerBalanceUpdate.newBalance,
        timestamp: Date.now(),
      });

      // Paso 6: Navegar a confirmación
      navigation.replace('TransferConfirmation', {
        transfer: {
          transferId: transactionDoc.id,
          ...transactionData,
          payerAccount: {
            id: selectedAccount.id,
            nickname: selectedAccount.nickname,
            balance: payerBalanceUpdate.newBalance
          },
          payeeAccount: verifiedAccountData
        },
        previousBalance: previousBalance,
        updatedPayerBalance: payerBalanceUpdate.newBalance,
        amount: amt,
      });

    } catch (error) {
      console.error('❌ Transfer error:', error);
      Alert.alert('Transfer Failed', error.message || 'An error occurred during the transfer');
    } finally {
      setTransferring(false);
    }
  };

  // 🔄 Versión original usando Nessie (mantener por compatibilidad)
  const executeTransfer = async () => {
    setShowConfirmModal(false);
    setTransferring(true);

    try {
      // 💰 Capturar el balance ANTES de la transferencia
      const previousBalance = selectedAccount.balance;
      const amt = parseFloat(amount);
      const expectedNew = previousBalance - amt;
      console.log('💰 Balance ANTES del transfer:', previousBalance);
      console.log('💰 Monto a transferir:', amt);
      console.log('💰 Balance ESPERADO después:', expectedNew);

      console.log('✈️ Processing transfer in Firebase...');

      // 1. Actualizar balance de la cuenta del remitente
      await updateAccountBalance(selectedAccount.id, expectedNew);

      // 2. Crear transacción en Firestore
      const transactionData = {
        type: 'transfer',
        amount: -amt, // Negativo para el remitente
        description: description || 'Transfer',
        fromAccountId: selectedAccount.id,
        toAccountId: verifiedAccountData.id,
        toAccountNumber: verifiedAccountData.accountNumber,
        toAccountHolder: verifiedAccountData.accountHolder,
        medium: medium,
        status: 'completed',
        timestamp: new Date(),
      };

      await createTransaction(user.uid, transactionData);

      console.log('✅ Transfer processed in Firebase');

      // 3. Emitir evento para actualizar Home en tiempo real
      EventBus.emit('balance:updated', {
        accountId: selectedAccount.id,
        newBalance: expectedNew,
        timestamp: Date.now(),
      });

      // 4. Crear objeto de transferencia para compatibilidad con TransferConfirmation
      const transferResult = {
        payerAccount: {
          id: selectedAccount.id,
          balance: expectedNew
        },
        payeeAccount: {
          id: verifiedAccountData.id,
          account_number: verifiedAccountData.accountNumber
        },
        amount: amt,
        description: description,
        medium: medium,
        status: 'completed'
      };

      // Navegar a confirmación
      navigation.replace('TransferConfirmation', {
        transfer: transferResult,
        previousBalance: previousBalance,
        updatedPayerBalance: expectedNew,
        amount: amt,
      });

    } catch (error) {
      console.error('❌ Transfer error:', error);
      Alert.alert('Transfer Failed', error.message || 'An error occurred during the transfer');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading accounts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (userAccounts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={20} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Money</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.emptyContainer}>
          <Icon name="wallet" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Accounts Available</Text>
          <Text style={styles.emptySubtitle}>
            You need at least one account with balance to send money
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const availableBalance = medium === 'balance' ? selectedAccount?.balance || 0 : selectedAccount?.rewards || 0;
  const transferAmount = parseFloat(amount) || 0;
  const isFormValid = accountIdVerified && transferAmount > 0 && transferAmount <= availableBalance;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header with white background */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={20} color="#007AFF" />
          </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Send Money</Text>
              <Text style={styles.headerSubtitle}>Transfer securely to any account</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* From Account */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="arrow-up" size={16} color="#007AFF" />
              <Text style={styles.sectionTitle}>From Account</Text>
            </View>
            <TouchableOpacity
              style={styles.accountCard}
              onPress={() => setShowAccountSelector(true)}
              activeOpacity={0.7}
            >
              <View style={styles.accountGradient}>
                <View style={styles.accountInfo}>
                  <View style={styles.accountIconContainer}>
                    <Icon name="university" size={24} color="#007AFF" />
                  </View>
                  <View style={styles.accountDetails}>
                    <Text style={styles.accountName}>{selectedAccount?.nickname || 'Select Account'}</Text>
                    <Text style={styles.accountType}>{selectedAccount?.type || ''}</Text>
                  </View>
                </View>
                <View style={styles.accountRight}>
                  <Text style={styles.accountBalance}>${selectedAccount?.balance?.toFixed(2) || '0.00'}</Text>
                  <View style={styles.chevronContainer}>
                    <Icon name="chevron-right" size={16} color="#007AFF" />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* To Account Number */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="arrow-down" size={16} color="#34C759" />
              <Text style={styles.sectionTitle}>To Account</Text>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Account Number</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 16-digit account number"
                  value={accountIdInput}
                  onChangeText={setAccountIdInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numeric"
                  maxLength={16}
                />
                {isVerifying && (
                  <ActivityIndicator size="small" color="#007AFF" style={styles.inputIcon} />
                )}
                {!isVerifying && accountIdInput.length > 0 && (
                  <View style={styles.statusIcon}>
                    <Icon
                      name={accountIdVerified ? 'check-circle' : 'times-circle'}
                      size={20}
                      color={accountIdVerified ? '#34C759' : '#FF3B30'}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Verification Status */}
            {accountIdVerified && verifiedAccountData && (
              <View style={styles.statusCard}>
                <View style={styles.statusIconContainer}>
                  <Icon name="check-circle" size={20} color="#34C759" />
                </View>
                <View style={styles.statusContent}>
                  <Text style={styles.statusTitle}>Account Verified</Text>
                  <Text style={styles.statusText}>
                    {verifiedAccountData.nickname} ({verifiedAccountData.type})
                  </Text>
                </View>
              </View>
            )}

            {verifyError && (
              <View style={[styles.statusCard, styles.errorStatusCard]}>
                <View style={styles.statusIconContainer}>
                  <Icon name="exclamation-triangle" size={20} color="#FF3B30" />
                </View>
                <View style={styles.statusContent}>
                  <Text style={styles.statusTitle}>Verification Failed</Text>
                  <Text style={styles.statusText}>{verifyError}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="dollar-sign" size={16} color="#FF9500" />
              <Text style={styles.sectionTitle}>Amount</Text>
            </View>

            <View style={styles.amountCard}>
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.amountFooter}>
                <Text style={styles.availableLabel}>Available Balance:</Text>
                <Text style={styles.availableAmount}>${availableBalance.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Medium Selector */}
          {selectedAccount?.rewards > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="coins" size={16} color="#AF52DE" />
                <Text style={styles.sectionTitle}>Transfer Method</Text>
              </View>
              <View style={styles.mediumCard}>
                <View style={styles.mediumSelector}>
                  <TouchableOpacity
                    style={[styles.mediumButton, medium === 'balance' && styles.mediumButtonActive]}
                    onPress={() => setMedium('balance')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.mediumIcon}>
                      <Icon name="wallet" size={20} color={medium === 'balance' ? '#007AFF' : '#666'} />
                    </View>
                    <Text style={[styles.mediumText, medium === 'balance' && styles.mediumTextActive]}>
                      Balance
                    </Text>
                    <Text style={styles.mediumSubtext}>${selectedAccount?.balance?.toFixed(2)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mediumButton, medium === 'rewards' && styles.mediumButtonActive]}
                    onPress={() => setMedium('rewards')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.mediumIcon}>
                      <Icon name="star" size={20} color={medium === 'rewards' ? '#007AFF' : '#666'} />
                    </View>
                    <Text style={[styles.mediumText, medium === 'rewards' && styles.mediumTextActive]}>
                      Rewards
                    </Text>
                    <Text style={styles.mediumSubtext}>{selectedAccount?.rewards} pts</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="comment" size={16} color="#666" />
              <Text style={styles.sectionTitle}>Description (Optional)</Text>
            </View>
            <View style={styles.descriptionCard}>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Add a note for this transfer..."
                value={description}
                onChangeText={setDescription}
                maxLength={100}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{description.length}/100</Text>
            </View>
          </View>

          {/* Transfer Preview */}
          {isFormValid && verifiedAccountData && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Icon name="receipt" size={20} color="#007AFF" />
                <Text style={styles.previewTitle}>Transfer Summary</Text>
              </View>

              <View style={styles.transferFlow}>
                <View style={styles.accountBubble}>
                  <Text style={styles.bubbleName}>{selectedAccount?.nickname}</Text>
                  <Text style={styles.bubbleType}>From</Text>
                </View>

                <View style={styles.arrowContainer}>
                  <Icon name="arrow-right" size={16} color="#007AFF" />
                </View>

                <View style={styles.accountBubble}>
                  <Text style={styles.bubbleName}>{verifiedAccountData.nickname}</Text>
                  <Text style={styles.bubbleType}>To</Text>
                </View>
              </View>

              <View style={styles.amountDisplay}>
                <Text style={styles.amountLabel}>Transfer Amount</Text>
                <Text style={styles.amountValue}>${transferAmount.toFixed(2)}</Text>
              </View>

              <View style={styles.balancePreview}>
                <Text style={styles.balancePreviewLabel}>Your new balance will be:</Text>
                <Text style={styles.balancePreviewAmount}>
                  ${(availableBalance - transferAmount).toFixed(2)}
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
                <Icon name="paper-plane" size={20} color="#fff" />
                <Text style={styles.transferButtonText}>
                  {isFormValid ? `Send $${transferAmount.toFixed(2)}` : 'Complete Form'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Account Selector Modal */}
        <Modal
          visible={showAccountSelector}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAccountSelector(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowAccountSelector(false)}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Account</Text>
                <TouchableOpacity onPress={() => setShowAccountSelector(false)}>
                  <Icon name="times" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {userAccounts.map((account) => (
                <TouchableOpacity
                  key={account._id}
                  style={styles.accountOption}
                  onPress={() => {
                    setSelectedAccount(account);
                    setShowAccountSelector(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountInfo}>
                    <View style={styles.accountIconContainer}>
                      <Icon name="university" size={18} color="#007AFF" />
                    </View>
                    <View style={styles.accountDetails}>
                      <Text style={styles.accountName}>{account.nickname}</Text>
                      <Text style={styles.accountType}>{account.type}</Text>
                    </View>
                  </View>
                  <Text style={styles.accountBalance}>${account.balance.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmModal}>
              <Icon name="exclamation-triangle" size={48} color="#FF9500" />
              <Text style={styles.confirmTitle}>Confirm Transfer</Text>
              <Text style={styles.confirmMessage}>
                You are about to send ${transferAmount.toFixed(2)} to {verifiedAccountData?.nickname}.
              </Text>
              <Text style={styles.confirmSubtext}>This action cannot be undone.</Text>

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
                  <Text style={styles.confirmButtonConfirmText}>Confirm</Text>
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
});

export default TransferScreen;

