import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { saveContact, getContactByCLABE, findAccountByNumber } from '../services/firestoreService';
import StandardHeader from '../components/StandardHeader';

const TransferAddContactScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { tarjetaDigital, prefilledCLABE, prefilledAccountId } = route.params || {};

  console.log('🔥 TransferAddContactScreen - Route params:', route.params);

  // If CLABE is prefilled, start at step 2
  const [step, setStep] = useState(prefilledCLABE ? 2 : 1);
  
  // Step 1: CLABE
  const [clabe, setClabe] = useState(prefilledCLABE || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [accountId, setAccountId] = useState(prefilledAccountId || ''); // 🔥 Ahora es el ID de Firestore
  
  // Step 2: Name & Alias
  const [contactName, setContactName] = useState('');
  const [contactAlias, setContactAlias] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Format CLABE with spaces (XXXX XXXX XXXX XXXX)
  const formatCLABE = (text) => {
    const cleaned = text.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ');
  };

  const handleCLABEChange = (text) => {
    const cleaned = text.replace(/\s/g, '');
    if (cleaned.length <= 16 && /^\d*$/.test(cleaned)) {
      setClabe(cleaned);
      setValidationError('');
      setAccountId('');
      
      // Auto-validate when 16 digits are entered
      if (cleaned.length === 16) {
        validateCLABE(cleaned);
      }
    }
  };

  const isStep1Valid = clabe.length === 16 && !validationError && !isValidating && accountId;

  const validateCLABE = async (clabeToValidate) => {
    const clabeValue = clabeToValidate || clabe;
    if (clabeValue.length !== 16) {
      console.log('⚠️ CLABE too short:', clabeValue.length);
      return;
    }

    console.log('🔍 Validating account number:', clabeValue);
    console.log('🔥 Starting validation process...');

    // 🔥 Limpiar estado anterior
    setIsValidating(true);
    setValidationError('');
    setAccountId('');

    try {
      console.log('🔍 Checking if contact already exists...');
      // Check if contact already exists
      const existingContact = await getContactByCLABE(user.uid, clabeValue);
      if (existingContact) {
        console.log('❌ Contact already exists');
        setValidationError('Contact already exists');
        setIsValidating(false);
        return;
      }

      console.log('🔥 Searching account in Firestore by number...');
      // 🔥 Buscar cuenta en Firestore por accountNumber y tipo "Checking" (en toda la base de datos)
      const validation = await findAccountByNumber(clabeValue);

      if (validation.exists) {
        console.log('✅ Account found in Firestore:', validation.accountData);
        console.log('✅ Setting accountId to:', validation.accountData.id);
        // 🔥 Ahora accountId será el ID de Firestore
        setAccountId(validation.accountData.id);
        setValidationError('');
        console.log('✅ Validation successful');
      } else {
        console.log('❌ Account not found in Firestore:', validation.error);
        setValidationError(validation.error || 'Account not found');
      }
    } catch (error) {
      console.error('❌ Validation error:', error);
      setValidationError(error.message || 'Could not validate account');
    } finally {
      console.log('🔄 Validation process finished');
      setIsValidating(false);
    }
  };

  const handleNextStep = async () => {
    if (clabe.length === 16 && !accountId) {
      // Need to validate first
      await validateCLABE();
      // After validation, check if valid
      return;
    }

    if (isStep1Valid) {
      setStep(2);
    }
  };

  // Auto-advance to step 2 after successful validation
  useEffect(() => {
    if (step === 1 && accountId && !validationError && clabe.length === 16) {
      // Small delay to show the checkmark
      const timer = setTimeout(() => {
        setStep(2);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [accountId, validationError, clabe, step]);

  const handleSaveContact = async () => {
    if (!contactName.trim() || contactName.trim().length < 3) {
      Alert.alert('Error', 'Please enter a valid name (minimum 3 characters)');
      return;
    }

    setIsSaving(true);

    try {
      const contactData = {
        contactName: contactName.trim(),
        contactAlias: contactAlias.trim(),
        contactCLABE: clabe,
        contactAccountId: accountId, // 🔥 Ahora es el ID de Firestore
      };

      const contactId = await saveContact(user.uid, contactData);

      Alert.alert('Success', 'Contact saved successfully', [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('TransferAmount', {
              contact: {
                id: contactId,
                ...contactData,
              },
              tarjetaDigital
            });
          }
        }
      ]);
    } catch (error) {
      console.error('Error saving contact:', error);
      Alert.alert('Error', error.message || 'Could not save contact');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StandardHeader 
          title="Add Contact"
          onBack={() => {
            if (step === 2 && !prefilledCLABE) {
              setStep(1);
            } else {
              navigation.goBack();
            }
          }}
        />

        {/* Progress Indicator - only show if not prefilled */}
        {!prefilledCLABE && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
            </View>
            <Text style={styles.progressText}>Step {step} of 2</Text>
          </View>
        )}

        {step === 1 ? (
          // Step 1: CLABE Input
          <View style={styles.content}>
            <Text style={styles.title}>Enter account number</Text>
            <Text style={styles.subtitle}>
              Enter the 16-digit account number
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.clabeInput}
                value={formatCLABE(clabe)}
                onChangeText={handleCLABEChange}
                placeholder="0000 0000 0000 0000"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                maxLength={19}
                autoFocus
              />
              {clabe.length === 16 && !isValidating && !validationError && accountId && (
                <Icon name="check-circle" size={24} color="#34C759" style={styles.validationIcon} />
              )}
              {isValidating && (
                <ActivityIndicator size="small" color="#00487A" style={styles.validationIcon} />
              )}
              {clabe.length === 16 && !isValidating && validationError && (
                <Icon name="times-circle" size={24} color="#F12D23" style={styles.validationIcon} />
              )}
            </View>

            {/* Validation Status Messages */}
            {isValidating && (
              <View style={styles.infoContainer}>
                <Icon name="info-circle" size={16} color="#00487A" />
                <Text style={styles.infoText}>Validating account...</Text>
              </View>
            )}

            {clabe.length === 16 && !isValidating && accountId && (
              <View style={styles.successContainer}>
                <Icon name="check-circle" size={16} color="#34C759" />
                <Text style={styles.successText}>Account found! You can create this contact.</Text>
              </View>
            )}

            {validationError && (
              <View style={styles.errorContainer}>
                <Icon name="exclamation-circle" size={16} color="#F12D23" />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.nextButton, !isStep1Valid && styles.nextButtonDisabled]}
              onPress={handleNextStep}
              disabled={!isStep1Valid}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>Next</Text>
              <Icon name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          // Step 2: Name & Alias
          <View style={styles.content}>
            <Text style={styles.title}>Beneficiary details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full name *</Text>
              <TextInput
                style={styles.input}
                value={contactName}
                onChangeText={setContactName}
                placeholder="John Doe"
                placeholderTextColor="#999"
                autoCapitalize="words"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Alias (optional)</Text>
              <TextInput
                style={styles.input}
                value={contactAlias}
                onChangeText={setContactAlias}
                placeholder="e.g., Mom, Best friend"
                placeholderTextColor="#999"
                autoCapitalize="words"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, (!contactName.trim() || contactName.trim().length < 3) && styles.saveButtonDisabled]}
              onPress={handleSaveContact}
              disabled={!contactName.trim() || contactName.trim().length < 3 || isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Contact</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00487A',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  clabeInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#00487A',
    borderBottomWidth: 2,
    borderBottomColor: '#00487A',
    paddingVertical: 12,
    paddingRight: 40,
    letterSpacing: 2,
  },
  validationIcon: {
    position: 'absolute',
    right: 8,
    top: 12,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#00487A',
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  successText: {
    fontSize: 13,
    color: '#34C759',
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#F12D23',
    flex: 1,
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#00487A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 30,
  },
  nextButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
  },
  saveButton: {
    backgroundColor: '#00487A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  saveButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default TransferAddContactScreen;

