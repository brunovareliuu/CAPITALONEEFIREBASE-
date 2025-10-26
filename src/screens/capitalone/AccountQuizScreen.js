import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
  PixelRatio,
  ActivityIndicator,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile, addCard } from '../../services/firestoreService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const scale = (size) => {
  const guidelineBaseWidth = 375;
  return (screenWidth / guidelineBaseWidth) * size;
};

const scaleFont = (size) => {
  const scaleFactor = PixelRatio.getFontScale();
  return scale(size) / scaleFactor;
};

const scaleSpacing = (size) => {
  return scale(size);
};

const isSmallScreen = screenHeight < 600;
const isLargeScreen = screenWidth > 768;

// Progress Indicator Component (copied from SignUpScreen)
const ProgressIndicator = ({ currentStep, totalSteps = 2 }) => {
  return (
    <View style={styles.progressContainer}>
      {Array.from({length: totalSteps}, (_, index) => {
        const isActive = index < currentStep;
        const isCurrent = index === currentStep - 1;

        return (
          <Animated.View
            key={index}
            style={[
              styles.progressDot,
              isActive && styles.progressDotActive,
              isCurrent && styles.progressDotCurrent
            ]}
          >
            {isCurrent && (
              <Animated.View
                style={[
                  styles.progressDotPulse,
                  {
                    opacity: new Animated.Value(0.3),
                    transform: [{ scale: new Animated.Value(1) }],
                  }
                ]}
              />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
};

const accountTypes = [
  {
    type: 'Credit Card',
    icon: 'credit-card',
    color: '#007AFF',
    description: 'Build credit and earn rewards',
  },
  {
    type: 'Savings',
    icon: 'piggy-bank',
    color: '#34C759',
    description: 'Save money and earn interest',
  },
  {
    type: 'Checking',
    icon: 'wallet',
    color: '#FF9500',
    description: 'Everyday spending account',
  },
];

const AccountQuizScreen = ({ navigation, route }) => {
  const { user, triggerNavigationUpdate } = useAuth();
  const { skipTypeSelection, accountType, prefillNickname } = route.params || {};

  const [currentStep, setCurrentStep] = useState(skipTypeSelection ? 2 : 1); // 1: Select Type, 2: Enter Details
  const [selectedType, setSelectedType] = useState(accountType || null);
  const [nickname, setNickname] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Pre-fill nickname and credit limit when component mounts
  useEffect(() => {
    if (prefillNickname && user && selectedType) {
      const firstName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'User';
      let accountTypeLabel;
      if (selectedType === 'Credit Card') {
        accountTypeLabel = 'Credit Card';
      } else if (selectedType === 'Savings') {
        accountTypeLabel = 'Savings Account';
      } else {
        accountTypeLabel = 'Debit Card';
      }
      const prefilledNickname = `${firstName}'s ${accountTypeLabel}`;
      setNickname(prefilledNickname);

      // Pre-fill credit limit for Credit Cards
      if (selectedType === 'Credit Card') {
        setCreditLimit('7000');
      }
    }
  }, [prefillNickname, user, selectedType]);

  // Remove ScrollView and use View instead for compact design
  const renderContent = () => {
    if (currentStep === 1) {
      return renderTypeSelection();
    } else {
      return renderDetailsForm();
    }
  };

  // Generate 16-digit account number
  const generateAccountNumber = () => {
    let accountNumber = '';
    for (let i = 0; i < 16; i++) {
      accountNumber += Math.floor(Math.random() * 10);
    }
    return accountNumber;
  };

  const handleSelectType = (type) => {
    setSelectedType(type);
    setErrors({});
  };

  const handleContinue = () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select an account type');
      return;
    }
    setCurrentStep(2);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!nickname.trim()) {
      newErrors.nickname = 'Nickname is required';
    }

    if (selectedType === 'Credit Card') {
      if (!creditLimit.trim()) {
        newErrors.creditLimit = 'Credit limit is required';
      } else if (isNaN(creditLimit) || parseFloat(creditLimit) <= 0) {
        newErrors.creditLimit = 'Please enter a valid amount';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Get user profile to get nessieCustomerId
      const userDoc = await getUserProfile(user.uid);
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }

      const userData = userDoc.data();
      const nessieCustomerId = userData.nessieCustomerId;

      if (!nessieCustomerId) {
        throw new Error('Nessie Customer ID not found');
      }

      // Prepare account data
      const accountNumber = generateAccountNumber();
      const balance = selectedType === 'Credit Card'
        ? 7000 // Credit limit for credit cards
        : selectedType === 'Checking'
        ? 10000 // Initial balance for debit cards
        : selectedType === 'Savings'
        ? 1000 // Initial balance for savings accounts
        : 5000; // Initial balance for other account types

      const accountData = {
        type: selectedType,
        nickname: nickname.trim(),
        rewards: 0,
        balance: balance,
        account_number: accountNumber,
      };

      // Create account in Nessie API
      const NESSIE_API_KEY = 'cf56fb5b0f0c73969f042c7ad5457306';
      const url = `http://api.nessieisreal.com/customers/${nessieCustomerId}/accounts?key=${NESSIE_API_KEY}`;

      console.log('Creating account in Nessie API...');
      console.log('Account data:', accountData);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Nessie API Error:', response.status, errorText);
        throw new Error(`Failed to create account: ${response.status}`);
      }

      const result = await response.json();
      console.log('Account created successfully:', result);

      // Save card to Firestore for regular cards (not digital cards)
      if (selectedType !== 'Checking') { // Don't save debit cards here, they get saved as digital cards later
        const cardData = {
          name: nickname.trim(),
          type: selectedType,
          initialBalance: balance,
          ownerId: user.uid,
          members: [user.uid],
          isShared: false,
          color: selectedType === 'Credit Card' ? '#004977' : '#FF8C00', // Blue for credit, orange for savings
          nessieAccountId: result.objectCreated._id,
          creditLimit: selectedType === 'Credit Card' ? balance : 0, // Credit limit equals balance for credit cards
          balance: balance, // Available balance
          usedBalance: 0, // Amount used (for credit cards)
          createdAt: new Date(),
        };

        await addCard(user.uid, cardData);
        console.log('Card saved to Firestore:', cardData);
      }

      // Marcar que el usuario completó el quiz de cuenta
      await updateUserProfile(user.uid, {
        completedAccountQuiz: true,
      });

      // Navigate based on account type
      if (selectedType === 'Checking') {
        // For debit cards, go to NickNameDebitScreen first
        navigation.navigate('NickNameDebit', {
          debitCardAccount: result.objectCreated,
        });
      } else {
        // For credit cards, go directly to TarjetaDigitalScreen
        navigation.navigate('TarjetaDigital', {
          nickname: nickname.trim(),
          accountData: result.objectCreated,
        });
      }

    } catch (error) {
      console.error('Error creating account:', error);
      Alert.alert(
        'Error',
        'Could not create account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };


  const renderTypeSelection = () => (
    <View style={styles.centeredContent}>
      <Text style={styles.title}>What type of account do you want?</Text>
      <Text style={styles.subtitle}>Select the account type that best fits your needs</Text>

      <View style={styles.accountTypesContainer}>
        {accountTypes.map((account) => {
          const isSelected = selectedType === account.type;
          const cardStyle = [styles.accountTypeCard];
          if (isSelected) {
            cardStyle.push(styles.accountTypeCardSelected);
          }

          return (
            <TouchableOpacity
              key={account.type}
              style={[...cardStyle, isSelected && { borderColor: account.color }]}
              onPress={() => handleSelectType(account.type)}
              activeOpacity={0.7}
            >
              <View style={[styles.accountTypeIcon, {
                backgroundColor: '#007AFF15'
              }]}>
                <Icon name={account.icon} size={24} color="#007AFF" />
              </View>
              <Text style={styles.accountTypeName}>{account.type}</Text>
              {isSelected && (
                <View style={styles.checkmark}>
                  <Icon name="check-circle" size={14} color={account.color} solid />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.continueButton, !selectedType && styles.disabledButton]}
        onPress={handleContinue}
        disabled={!selectedType}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
        <Icon name="chevron-right" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderDetailsForm = () => {
    const selectedAccount = accountTypes.find(a => a.type === selectedType);

    return (
      <View style={styles.centeredContent}>
        <View style={[styles.selectedTypeHeader, { alignSelf: 'flex-start' }]}>
          <View style={[styles.selectedTypeIcon, { backgroundColor: selectedAccount.color + '20' }]}>
            <Icon name={selectedAccount.icon} size={28} color={selectedAccount.color} />
          </View>
          <Text style={styles.selectedTypeName}>{selectedType}</Text>
        </View>

        <Text style={[styles.formTitle, { textAlign: 'left', alignSelf: 'flex-start' }]}>Account Details</Text>

        {/* Nickname Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nickname *</Text>
          <TextInput
            style={[styles.input, errors.nickname && styles.inputError]}
            placeholder="Ex: My main card"
            placeholderTextColor="#888"
            value={nickname}
            onChangeText={(text) => {
              setNickname(text);
              if (errors.nickname) {
                setErrors({ ...errors, nickname: null });
              }
            }}
          />
          {errors.nickname && (
            <Text style={styles.errorText}>{errors.nickname}</Text>
          )}
        </View>

        {/* Credit Limit Input (only for Credit Card) */}
        {selectedType === 'Credit Card' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Credit Limit *</Text>
            <View style={[styles.input, styles.inputWithIcon, errors.creditLimit && styles.inputError]}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.inputAmount}
                placeholder="0.00"
                placeholderTextColor="#888"
                value={creditLimit}
                onChangeText={(text) => {
                  // Only allow numbers and decimal point
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  setCreditLimit(cleaned);
                  if (errors.creditLimit) {
                    setErrors({ ...errors, creditLimit: null });
                  }
                }}
                keyboardType="decimal-pad"
              />
            </View>
            {errors.creditLimit && (
              <Text style={styles.errorText}>{errors.creditLimit}</Text>
            )}
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Icon name="info-circle" size={20} color="#007AFF" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoText}>
              {selectedType === 'Credit Card'
                ? 'Your credit card will start with a $7,000 credit limit.'
                : 'Your account will start with a balance of $5,000.'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.createButton, loading && styles.disabledButton]}
          onPress={handleCreateAccount}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.createButtonText}>Create Account</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButtonBottom}
          onPress={() => {
            if (skipTypeSelection) {
              navigation.goBack(); // Go back to HomeScreen
            } else {
              setCurrentStep(1); // Go back to type selection
            }
          }}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.content}>
          {renderContent()}
          {!skipTypeSelection && <ProgressIndicator currentStep={currentStep} totalSteps={2} />}
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: scaleSpacing(20),
    paddingBottom: scaleSpacing(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scaleSpacing(15),
  },
  progressDot: {
    width: scaleSpacing(isSmallScreen ? 8 : 10),
    height: scaleSpacing(isSmallScreen ? 8 : 10),
    borderRadius: scaleSpacing(isSmallScreen ? 4 : 5),
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    marginHorizontal: scaleSpacing(4),
  },
  progressDotActive: {
    backgroundColor: '#007AFF',
  },
  progressDotCurrent: {
    backgroundColor: '#007AFF',
    transform: [{ scale: 1.2 }],
  },
  progressDotPulse: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: scaleSpacing(isSmallScreen ? 4 : 5),
    backgroundColor: '#007AFF',
  },
  centeredContent: {
    width: '100%',
    maxWidth: scale(380),
    alignItems: 'center',
    paddingVertical: scaleSpacing(20),
  },
  title: {
    fontSize: scaleFont(24),
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: scaleSpacing(12),
  },
  subtitle: {
    fontSize: scaleFont(14),
    color: '#666',
    textAlign: 'center',
    marginBottom: scaleSpacing(30),
    lineHeight: scaleFont(20),
  },
  accountTypesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scaleSpacing(30),
    paddingHorizontal: scaleSpacing(5),
  },
  accountTypeCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(16),
    flex: 1,
    marginHorizontal: scaleSpacing(4),
    borderWidth: 2,
    borderColor: '#F8F9FA',
    alignItems: 'center',
    position: 'relative',
  },
  accountTypeCardSelected: {
    // Border color will be set dynamically
  },
  accountTypeIcon: {
    width: scaleSpacing(48),
    height: scaleSpacing(48),
    borderRadius: scaleSpacing(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleSpacing(8),
  },
  accountTypeName: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: scaleSpacing(8),
    right: scaleSpacing(8),
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: scaleSpacing(12),
    paddingVertical: scaleSpacing(18),
    paddingHorizontal: scaleSpacing(100),
    gap: scaleSpacing(8),
    minWidth: scaleSpacing(160),
  },
  continueButtonText: {
    color: '#fff',
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  backButtonText: {
    fontSize: scaleFont(16),
    color: '#007AFF',
    fontWeight: '600',
  },
  backButtonBottom: {
    alignSelf: 'center',
    marginTop: scaleSpacing(20),
  },
  selectedTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSpacing(35),
    gap: scaleSpacing(12),
  },
  selectedTypeIcon: {
    width: scaleSpacing(48),
    height: scaleSpacing(48),
    borderRadius: scaleSpacing(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedTypeName: {
    fontSize: scaleFont(24),
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'left',
  },
  formTitle: {
    fontSize: scaleFont(20),
    fontWeight: '600',
    color: '#000',
    marginBottom: scaleSpacing(25),
    textAlign: 'left',
  },
  inputGroup: {
    marginBottom: scaleSpacing(24),
    width: '100%',
  },
  inputLabel: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: '#333',
    marginBottom: scaleSpacing(8),
    textAlign: 'left',
  },
  input: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: scaleSpacing(12),
    paddingHorizontal: scaleSpacing(16),
    paddingVertical: scaleSpacing(16),
    fontSize: scaleFont(16),
    color: '#333',
    minHeight: scaleSpacing(50),
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#333',
    marginRight: scaleSpacing(8),
  },
  inputAmount: {
    flex: 1,
    fontSize: scaleFont(16),
    color: '#333',
  },
  errorText: {
    fontSize: scaleFont(12),
    color: '#FF3B30',
    marginTop: scaleSpacing(4),
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F7FF',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(18),
    marginBottom: scaleSpacing(35),
    gap: scaleSpacing(12),
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: scaleFont(14),
    color: '#007AFF',
    lineHeight: scaleFont(20),
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    borderRadius: scaleSpacing(12),
    paddingVertical: scaleSpacing(18),
    paddingHorizontal: scaleSpacing(100),
    gap: scaleSpacing(8),
    minWidth: scaleSpacing(180),
  },
  createButtonText: {
    color: '#fff',
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
});

export default AccountQuizScreen;


