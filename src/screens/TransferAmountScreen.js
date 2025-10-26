import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { createTransfer, getAccountById as getNessieAccountById } from '../services/nessieService';
import { updateContactLastUsed, getAccountById, createFirebaseTransfer } from '../services/firestoreService';
import EventBus from '../utils/EventBus';
import StandardHeader from '../components/StandardHeader';

const TransferAmountScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { contact, tarjetaDigital } = route.params || {};
  
  const [amount, setAmount] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('debit');
  const [debitBalance, setDebitBalance] = useState(0);
  const [creditLimit, setCreditLimit] = useState(500);
  const [transferring, setTransferring] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRealBalance = async () => {
      console.log('📊 TransferAmountScreen - tarjetaDigital received:', tarjetaDigital);

      // 🔥 Determinar qué ID usar para obtener el balance
      const accountIdToUse = tarjetaDigital?.nessieAccountId || tarjetaDigital?.accountId;

      if (!accountIdToUse) {
        console.warn('⚠️ No account ID found in tarjetaDigital');
        // Fallback to stored balance
        const fallbackBalance = tarjetaDigital?.saldo || tarjetaDigital?.balance || 0;
        console.log('⚠️ Using fallback balance from tarjetaDigital:', fallbackBalance);
        setDebitBalance(fallbackBalance);
        setLoading(false);
        return;
      }

      try {
        if (tarjetaDigital?.nessieAccountId) {
          // 🔥 Cuenta antigua - usar Nessie API
          console.log('🌐 Fetching real balance from Nessie API for account:', tarjetaDigital.nessieAccountId);
          const accountData = await getNessieAccountById(tarjetaDigital.nessieAccountId);

          const realBalance = accountData.balance || 0;
          console.log('💰 Real balance from Nessie API:', realBalance);
          setDebitBalance(realBalance);
        } else if (tarjetaDigital?.accountId) {
          // 🔥 Cuenta nueva - usar Firestore
          console.log('🔥 Fetching balance from Firestore for account:', tarjetaDigital.accountId);
          const accountDoc = await getAccountById(tarjetaDigital.accountId);

          if (accountDoc.exists()) {
            const accountData = accountDoc.data();
            const realBalance = accountData.balance || 0;
            console.log('💰 Real balance from Firestore:', realBalance);
            console.log('📊 Full account data from Firestore:', accountData);
            setDebitBalance(realBalance);
          } else {
            console.warn('⚠️ Account not found in Firestore');
            const fallbackBalance = tarjetaDigital?.saldo || tarjetaDigital?.balance || 0;
            setDebitBalance(fallbackBalance);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching real balance:', error);
        // Fallback to stored balance if API fails
        const fallbackBalance = tarjetaDigital?.saldo || tarjetaDigital?.balance || 0;
        console.log('⚠️ Using fallback balance from tarjetaDigital:', fallbackBalance);
        setDebitBalance(fallbackBalance);
      } finally {
        setLoading(false);
      }
    };

    fetchRealBalance();
  }, [tarjetaDigital]);

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleAmountChange = (text) => {
    // Only allow numbers and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    
    setAmount(cleaned);
  };

  const isValidAmount = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return false;
    
    // Only debit account available
    return amt <= debitBalance;
  };

  const handleContinue = async () => {
    if (!isValidAmount()) return;

    setTransferring(true);

    try {
      const amt = parseFloat(amount);
      const previousBalance = debitBalance;
      const expectedNew = previousBalance - amt;

      console.log('💰 Balance ANTES del transfer:', previousBalance);
      console.log('💰 Monto a transferir:', amt);
      console.log('💰 Balance ESPERADO después:', expectedNew);
      console.log('📋 TarjetaDigital accountId:', tarjetaDigital?.accountId);
      console.log('📋 TarjetaDigital nessieAccountId:', tarjetaDigital?.nessieAccountId);

      // 🔥 Ahora usamos contactAccountId (ID de Firestore) en lugar de contactNessieAccountId
      const recipientAccountId = contact?.contactAccountId || contact?.contactNessieAccountId;
      console.log('📋 Contact account ID:', recipientAccountId);

      // 🔥 Usar accountId de Firebase si nessieAccountId es null
      const payerAccountId = tarjetaDigital?.nessieAccountId || tarjetaDigital?.accountId;
      console.log('📋 Payer account ID:', payerAccountId);

      if (!payerAccountId) {
        throw new Error('Debit account ID not found. Please refresh and try again.');
      }

      if (!recipientAccountId) {
        throw new Error('Recipient account ID not found. Please try again.');
      }

      // Update contact last used
      await updateContactLastUsed(user.uid, contact.id);

      // 🔥 Determinar si usar Firebase o Nessie para la transferencia
      let result;
      const shouldUseFirebase = !tarjetaDigital?.nessieAccountId && tarjetaDigital?.accountId;

      if (shouldUseFirebase) {
        // 🔥 Usar Firebase para cuentas nuevas
        console.log('🔥 Creating Firebase transfer:', {
          from: payerAccountId,
          to: recipientAccountId,
          amount: amt
        });

        result = await createFirebaseTransfer(
          payerAccountId,
          recipientAccountId,
          amt,
          'balance',
          `Transfer to ${contact.contactName}`
        );
      } else {
        // 🔄 Usar Nessie para cuentas antiguas
        console.log('🌐 Creating Nessie transfer:', {
          from: payerAccountId,
          to: recipientAccountId,
          amount: amt
        });

        result = await createTransfer(
          payerAccountId,
          recipientAccountId,
          amt,
          'balance',
          `Transfer to ${contact.contactName}`
        );
      }

      console.log('✅ Transfer created:', result);

      // 🔥 Emitir eventos de balance actualizado
      if (shouldUseFirebase) {
        console.log('🔥 Emitting balance update events...');
        console.log('💰 Payer balance event:', { accountId: payerAccountId, newBalance: expectedNew });
        console.log('💰 Payee balance event:', { accountId: recipientAccountId, newBalance: result.payeeAccount.balance });

        // Para Firebase transfers, emitir eventos para ambas cuentas
        EventBus.emit('balance:updated', {
          accountId: payerAccountId,
          newBalance: expectedNew,
          timestamp: Date.now(),
        });

        // También emitir para la cuenta receptora
        EventBus.emit('balance:updated', {
          accountId: recipientAccountId,
          newBalance: result.payeeAccount.balance,
          timestamp: Date.now(),
        });
      } else {
        // Para Nessie transfers, usar el evento original
        EventBus.emit('balance:updated', {
          accountId: result.payerAccount.id,
          newBalance: expectedNew,
          timestamp: Date.now(),
        });
      }

      // Navigate to confirmation screen
      navigation.replace('TransferConfirmation', {
        transfer: result,
        previousBalance: previousBalance,
        updatedPayerBalance: expectedNew,
        amount: amt,
        contact: contact,
        tarjetaDigital: tarjetaDigital,
      });

    } catch (error) {
      console.error('❌ Transfer error:', error);
      Alert.alert('Transfer Error', error.message || 'Could not complete transfer. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00487A" />
          <Text style={styles.loadingText}>Loading account details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!contact) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No contact selected</Text>
      </SafeAreaView>
    );
  }

  if (!tarjetaDigital) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Account information not available</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StandardHeader 
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Contact Info */}
          <View style={styles.contactSection}>
            <View style={styles.largeAvatar}>
              <Text style={styles.largeInitials}>{getInitials(contact.contactName)}</Text>
            </View>
            <Text style={styles.transferToLabel}>Transfer to</Text>
            <Text style={styles.contactNameLarge}>{contact.contactName}</Text>
            {contact.contactAlias && (
              <Text style={styles.contactAliasLarge}>{contact.contactAlias}</Text>
            )}
          </View>

          {/* Amount Input */}
          <View style={styles.amountSection}>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#CCCCCC"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
          </View>

          {/* Transfer From Section */}
          <View style={styles.transferFromSection}>
            <Text style={styles.sectionTitle}>Transfer from</Text>

            {/* Debit Account Card - Always selected, no option to change */}
            <View style={[styles.accountCard, styles.accountCardSelected]}>
              <View style={styles.accountCardLeft}>
                <Icon name="university" size={24} color="#00487A" />
                <View style={styles.accountCardInfo}>
                  <Text style={styles.accountCardTitle}>Capital One Debit Account</Text>
                  <Text style={styles.accountCardBalance}>
                    Available: ${debitBalance.toFixed(2)} MXN
                  </Text>
                  <Text style={styles.accountCardNote}>Immediate transfer</Text>
                </View>
              </View>
              <View style={[styles.radioButton, styles.radioButtonSelected]}>
                <View style={styles.radioButtonInner} />
              </View>
            </View>
          </View>

          {/* Continue Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.continueButton, !isValidAmount() && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={!isValidAmount() || transferring}
              activeOpacity={0.8}
            >
              {transferring ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contactSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  largeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F4FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  largeInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#00487A',
  },
  transferToLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  contactNameLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  contactAliasLarge: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  amountSection: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: '700',
    color: '#00487A',
    marginRight: 8,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: '#00487A',
    minWidth: 150,
    textAlign: 'left',
  },
  transferFromSection: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accountCardSelected: {
    borderColor: '#00487A',
    backgroundColor: '#E8F4FA',
  },
  accountCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountCardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  accountCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  creditCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#00487A',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  accountCardBalance: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  accountCardNote: {
    fontSize: 12,
    color: '#999',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#00487A',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00487A',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
  },
  continueButton: {
    backgroundColor: '#00487A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  continueButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    color: '#F12D23',
    textAlign: 'center',
    marginTop: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
});

export default TransferAmountScreen;

