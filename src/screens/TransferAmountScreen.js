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
import { updateContactLastUsed, getAccountById, createFirebaseTransfer, updateAccountBalance, createTransaction, getUserIdByAccountId, getUserProfile, findUserByCardAccountNumber } from '../services/firestoreService';
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

      // 🔥 Usar accountId de Firebase
      const accountIdToUse = tarjetaDigital?.accountId;

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
        if (tarjetaDigital?.accountId) {
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
      console.log('💰 Delta a aplicar:', -amt);
      console.log('💰 Balance ESPERADO después:', expectedNew);
      console.log('📋 TarjetaDigital accountId:', tarjetaDigital?.accountId);

      // 🔥 Usar contactAccountId de Firestore
      const recipientAccountId = contact?.contactAccountId;
      console.log('📋 Contact account ID:', recipientAccountId);

      // 🔥 Usar accountId de Firebase
      const payerAccountId = tarjetaDigital?.accountId;
      console.log('📋 Payer account ID:', payerAccountId);

      if (!payerAccountId) {
        throw new Error('Debit account ID not found. Please refresh and try again.');
      }

      if (!recipientAccountId) {
        throw new Error('Recipient account ID not found. Please try again.');
      }

      // Update contact last used
      await updateContactLastUsed(user.uid, contact.id);

      // 🔥 Procesar transferencia en Firebase
      console.log('🔥 Creating Firebase transfer:', {
        from: payerAccountId,
        to: recipientAccountId,
        amount: amt
      });

      // 1. Actualizar balance del remitente (restar el monto transferido)
      const payerResult = await updateAccountBalance(payerAccountId, -amt);
      console.log('✅ Payer balance updated:', payerResult);

      // 2. Encontrar al usuario del destinatario usando la CLABE (accountNumber)
      console.log('🔍 Finding recipient user by CLABE (accountNumber):', contact.contactCLABE);
      const { userId: recipientUserId, cardData } = await findUserByCardAccountNumber(contact.contactCLABE);
      console.log('🔍 Recipient userId found:', recipientUserId);

      if (!recipientUserId) {
        console.warn('⚠️ Recipient account not found or has no user. Transfer will only affect sender.');
      } else {
        console.log('✅ Found recipient user ID:', recipientUserId);

        // 3. Actualizar balance del destinatario (sumar el monto recibido)
        try {
          const recipientResult = await updateAccountBalance(recipientAccountId, amt);
          console.log('✅ Recipient balance updated:', recipientResult);

          // Emitir evento para actualizar balance del destinatario
          EventBus.emit('balance:updated', {
            accountId: recipientAccountId,
            newBalance: recipientResult.newBalance,
            timestamp: Date.now(),
          });
        } catch (recipientError) {
          console.error('❌ Error updating recipient balance:', recipientError);
          // No fallar la transacción completa por esto, pero registrar el error
        }
      }

      // 4. Crear transacción para el remitente (amount negativo)
      const senderTransactionData = {
        userId: user.uid,
        type: 'transfer',
        amount: -amt, // Negativo para el remitente
        description: `Transfer to ${contact.contactName}`,
        fromAccountId: payerAccountId,
        toAccountId: recipientAccountId,
        toAccountNumber: contact.contactCLABE,
        toAccountHolder: contact.contactName,
        fromAccountOwner: user.uid, // Para reglas de Firestore
        toAccountOwner: recipientUserId || null, // Para reglas de Firestore
        medium: 'balance',
        status: 'completed',
        timestamp: new Date(),
      };

      await createTransaction(senderTransactionData);
      console.log('✅ Sender transaction created');

      // 5. Crear transacción para el destinatario si existe (amount positivo)
      if (recipientUserId) {
        const recipientTransactionData = {
          userId: recipientUserId,
          type: 'transfer',
          amount: amt, // Positivo para el destinatario
          description: `Transfer from ${user.displayName || user.email}`,
          fromAccountId: payerAccountId,
          toAccountId: recipientAccountId,
          fromAccountNumber: '', // No tenemos el número del remitente
          fromAccountHolder: user.displayName || user.email?.split('@')[0] || 'Unknown',
          fromAccountOwner: user.uid, // Para reglas de Firestore
          toAccountOwner: recipientUserId, // Para reglas de Firestore
          medium: 'balance',
          status: 'completed',
          timestamp: new Date(),
        };

        try {
          await createTransaction(recipientTransactionData);
          console.log('✅ Recipient transaction created');
        } catch (recipientTxError) {
          console.error('❌ Error creating recipient transaction:', recipientTxError);
          // No fallar por esto
        }

        // 📱 Enviar notificación de WhatsApp al receptor
        try {
          console.log('═══════════════════════════════════════════════════════════');
          console.log('📱 SENDING WHATSAPP NOTIFICATION TO RECEIVER');
          console.log('═══════════════════════════════════════════════════════════');
          
          const { sendDepositNotification } = require('../services/whatsappService');
          
          // Obtener perfil del receptor para su teléfono y nombre
          const recipientProfile = await getUserProfile(recipientUserId);
          
          if (recipientProfile.exists()) {
            const recipientData = recipientProfile.data();
            const recipientPhone = recipientData.phoneNumber;
            const recipientFirstName = recipientData.first_name || recipientData.displayName?.split(' ')[0] || 'Usuario';
            
            console.log('📋 Recipient phone:', recipientPhone ? `${recipientPhone.substring(0, 3)}***` : 'NOT FOUND');
            console.log('👤 Recipient name:', recipientFirstName);
            
            // Obtener nombre del remitente (usuario actual) - SOLO EL PRIMER NOMBRE
            const payerProfile = await getUserProfile(user.uid);
            let payerFirstName = 'Usuario';
            
            if (payerProfile.exists()) {
              const payerData = payerProfile.data();
              // Extraer SOLO el primer nombre
              if (payerData.first_name) {
                payerFirstName = payerData.first_name;
              } else if (payerData.displayName) {
                payerFirstName = payerData.displayName.split(' ')[0];
              }
            }
            
            console.log('👤 Sender (payer) first name:', payerFirstName);
            
            if (recipientPhone) {
              console.log('📤 Calling sendDepositNotification...');
              const result = await sendDepositNotification(recipientPhone, payerFirstName);
              
              if (result.success) {
                console.log('✅ ¡WhatsApp notification sent successfully!');
                console.log('📨 Message ID:', result.messageId);
              } else {
                console.error('❌ WhatsApp notification failed:', result.error);
              }
            } else {
              console.warn('⚠️ Receiver has no phone number, skipping WhatsApp notification');
            }
          } else {
            console.warn('⚠️ Receiver profile not found, skipping WhatsApp notification');
          }
          
          console.log('═══════════════════════════════════════════════════════════');
        } catch (whatsappError) {
          // No fallar la transferencia si WhatsApp falla
          console.error('═══════════════════════════════════════════════════════════');
          console.error('❌ WHATSAPP NOTIFICATION FAILED (NON-CRITICAL)');
          console.error('═══════════════════════════════════════════════════════════');
          console.error('Error:', whatsappError.message);
          console.error('Stack:', whatsappError.stack);
          console.error('═══════════════════════════════════════════════════════════');
        }
      }

      // 6. Crear resultado compatible
      const result = {
        payerAccount: { id: payerAccountId, balance: payerResult.newBalance },
        payeeAccount: { id: recipientAccountId, balance: recipientUserId ? 'updated' : 'not_found' },
        amount: amt,
        description: `Transfer to ${contact.contactName}`,
        medium: 'balance',
        status: 'completed'
      };

      console.log('✅ Transfer created:', result);

      // 🔥 Emitir evento de balance actualizado
      console.log('🔥 Emitting balance update event...');
      EventBus.emit('balance:updated', {
        accountId: payerAccountId,
        newBalance: expectedNew,
        timestamp: Date.now(),
      });

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

