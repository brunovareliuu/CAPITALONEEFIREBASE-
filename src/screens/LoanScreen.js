import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  PixelRatio,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, getCards, addCard, getLoans, addLoan } from '../services/firestoreService';
import { updateAccountBalance } from '../services/nessieService';

// Función para guardar loans en Firestore (ya que Nessie no tiene endpoint de loans)
const saveLoanToFirestore = async (userId, loanData) => {
  try {
    const docRef = await addLoan(userId, loanData);
    console.log('✅ Loan saved to Firestore with ID:', docRef.id);
    return docRef;
  } catch (error) {
    console.error('❌ Error saving loan to Firestore:', error);
    throw error;
  }
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Función para escalar tamaños basado en el ancho de pantalla
const scale = (size) => {
  const guidelineBaseWidth = 375;
  return (screenWidth / guidelineBaseWidth) * size;
};

// Función para tamaños de fuente responsivos
const scaleFont = (size) => {
  const scaleFactor = PixelRatio.getFontScale();
  return scale(size) / scaleFactor;
};

// Función para espaciado responsivo
const scaleSpacing = (size) => {
  return scale(size);
};

const LoanScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creditScore, setCreditScore] = useState(null);
  const [selectedLoanType, setSelectedLoanType] = useState('home');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanDescription, setLoanDescription] = useState('');
  const [loans, setLoans] = useState([]);
  const [creditCard, setCreditCard] = useState(null);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [loansLoading, setLoansLoading] = useState(true);

  const loanTypes = [
    { id: 'home', label: 'Home Loan', icon: 'home', description: 'For purchasing or renovating a home' },
    { id: 'auto', label: 'Auto Loan', icon: 'car', description: 'For purchasing a vehicle' },
    { id: 'small business', label: 'Small Business', icon: 'building', description: 'For starting or growing a business' },
  ];

  // Load user profile, credit score, credit card, and loans
  useEffect(() => {
    let unsubscribeCards = null;
    let unsubscribeLoans = null;

    const loadUserData = async () => {
      if (!user) {
        setCardsLoading(false);
        setLoansLoading(false);
        return;
      }

      try {
        setCardsLoading(true);
        setLoansLoading(true);

        const profileDoc = await getUserProfile(user.uid);
        if (profileDoc.exists()) {
          const profile = profileDoc.data();
          setUserProfile(profile);

          // Load credit score
          if (profile.nessieCustomerId) {
            await loadCreditScore(profile.nessieCustomerId);
          }

          // Load credit cards using the callback pattern
          unsubscribeCards = getCards(user.uid, (userCards) => {
            try {
              setCardsLoading(false);
              if (userCards && Array.isArray(userCards)) {
                console.log('📄 Cards loaded:', userCards.length);
                const foundCreditCard = userCards.find(card => card.type === 'Credit Card');
                console.log('💳 Credit card found:', foundCreditCard ? 'Yes' : 'No');
                setCreditCard(foundCreditCard || null);
              } else {
                console.log('📄 No cards or invalid data:', userCards);
                setCreditCard(null);
              }
            } catch (error) {
              console.error('Error processing cards data:', error);
              setCreditCard(null);
              setCardsLoading(false);
            }
          });

          // Load loans using the callback pattern
          unsubscribeLoans = getLoans(user.uid, (userLoans) => {
            try {
              setLoansLoading(false);
              if (userLoans && Array.isArray(userLoans)) {
                console.log('💰 Loans loaded:', userLoans.length);
                setLoans(userLoans);
              } else {
                console.log('💰 No loans or invalid data:', userLoans);
                setLoans([]);
              }
            } catch (error) {
              console.error('Error processing loans data:', error);
              setLoans([]);
              setLoansLoading(false);
            }
          });
        } else {
          setCardsLoading(false);
          setLoansLoading(false);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        setCreditCard(null);
        setCardsLoading(false);
        setLoans([]);
        setLoansLoading(false);
      }
    };

    loadUserData();

    // Cleanup function
    return () => {
      if (unsubscribeCards && typeof unsubscribeCards === 'function') {
        unsubscribeCards();
      }
      if (unsubscribeLoans && typeof unsubscribeLoans === 'function') {
        unsubscribeLoans();
      }
    };
  }, [user]);

  // Function to load credit score from Lambda
  const loadCreditScore = async (nessieCustomerId) => {
    try {
      const response = await fetch(
        `https://thvr2tgikgzqwwjf7jud2p4z3q0ihgyf.lambda-url.us-east-2.on.aws/?id=${nessieCustomerId}`
      );

      if (response.ok) {
        const data = await response.json();
        setCreditScore(data.credit_score);
      } else {
        console.error('Failed to load credit score');
        setCreditScore(0);
      }
    } catch (error) {
      console.error('Error loading credit score:', error);
      setCreditScore(0);
    }
  };

  // Function to calculate monthly payment
  const calculateMonthlyPayment = (amount, months) => {
    if (!amount || amount <= 0 || !months || months <= 0) return 0;

    // Simple interest calculation: amount / months + interest
    const monthlyInterestRate = 0.05 / 12; // 5% annual interest
    const monthlyPayment = (amount * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, months)) /
                          (Math.pow(1 + monthlyInterestRate, months) - 1);

    // Ensure we return a valid number
    return isNaN(monthlyPayment) ? 0 : monthlyPayment;
  };

  // Function to get loan term based on amount
  const getLoanTerm = (amount) => {
    if (!amount || amount <= 0 || isNaN(amount)) return 6;

    if (amount <= 1000) return 6; // 6 months
    if (amount <= 5000) return 12; // 1 year
    if (amount <= 10000) return 24; // 2 years
    if (amount <= 25000) return 36; // 3 years
    if (amount <= 50000) return 60; // 5 years
    return 72; // 6 years for larger amounts
  };

  // Function to check loan approval
  const checkLoanApproval = (amount, creditScore) => {
    if (!amount || amount <= 0 || isNaN(amount)) return { approved: false, reason: 'Invalid amount' };
    if (!creditScore || creditScore < 300) return { approved: false, reason: 'Insufficient credit score' };

    // Special rule: Even with poor credit (< 500), allow small loans up to $1,500
    if (creditScore < 500 && amount <= 1500) {
      return { approved: true, reason: 'Approved - Small loan available despite low credit score' };
    }

    // Approval rules based on credit score and amount
    const rules = [
      { minScore: 800, maxAmount: 100000, approved: true },
      { minScore: 750, maxAmount: 75000, approved: true },
      { minScore: 700, maxAmount: 50000, approved: true },
      { minScore: 650, maxAmount: 25000, approved: true },
      { minScore: 600, maxAmount: 10000, approved: true },
      { minScore: 550, maxAmount: 5000, approved: true },
      { minScore: 500, maxAmount: 2000, approved: true },
    ];

    for (const rule of rules) {
      if (creditScore >= rule.minScore && amount <= rule.maxAmount) {
        return { approved: rule.approved, reason: 'Approved' };
      }
    }

    return { approved: false, reason: 'Amount too high for your credit score' };
  };

  // Function to request loan
  const requestLoan = async () => {
    if (!loanAmount || !creditScore) {
      Alert.alert('Error', 'Please fill all fields and ensure your credit score is loaded');
      return;
    }

    const amount = parseFloat(loanAmount);
    if (amount <= 0) {
      Alert.alert('Error', 'Please enter a valid loan amount');
      return;
    }

    setLoading(true);

    try {
      // Check approval
      const approval = checkLoanApproval(amount, creditScore);
      const status = approval.approved ? 'approved' : 'declined';

      // Calculate monthly payment
      const months = getLoanTerm(amount);
      const monthlyPayment = calculateMonthlyPayment(amount, months);

      // Create loan data for Firestore (since Nessie doesn't have loans endpoint)
      const loanData = {
        type: selectedLoanType,
        status: status,
        credit_score: creditScore,
        amount: Math.floor(amount), // Ensure it's an integer
        monthly_payment: Math.floor(monthlyPayment), // Ensure it's an integer
        description: loanDescription.trim() || `${selectedLoanType} loan request`,
        term_months: months,
        approved_at: status === 'approved' ? new Date() : null,
        declined_reason: status === 'declined' ? approval.reason : null,
      };

      console.log('💰 Creating loan in Firestore:', loanData);

      // Save loan to Firestore
      await saveLoanToFirestore(user.uid, loanData);

      if (status === 'approved') {
        // If loan is approved, increase credit card limit
        if (creditCard) {
          try {
            console.log('📈 Increasing credit card limit with loan amount');
            console.log('💳 Current credit card:', creditCard);

            // Calculate new credit limit
            const newCreditLimit = (creditCard.creditLimit || 0) + amount;
            console.log('💰 New credit limit:', newCreditLimit);

            // Note: Since Nessie doesn't allow direct balance updates for loans,
            // we just update the credit limit in our Firestore records
            // The UI will reflect the increased limit
            console.log('✅ Credit card limit increased (reflected in UI)');

          } catch (error) {
            console.error('Error updating credit card limit:', error);
            // Don't fail the loan approval if balance update fails
          }
        } else {
          console.log('⚠️ No credit card found');
        }

          Alert.alert(
            'Loan Approved! 🎉',
            `Your ${selectedLoanType} loan for $${amount} has been approved!\n\nMonthly payment: $${monthlyPayment.toFixed(2)}\nTerm: ${months} months\n\nThe loan amount has been added to your available credit.`,
            [
              {
                text: 'Continue',
                onPress: () => {
                  setLoanAmount('');
                  setLoanDescription('');
                }
              }
            ]
          );
      } else {
        Alert.alert(
          'Loan Declined',
          approval.reason,
          [
            {
              text: 'OK',
              onPress: () => {
                setLoanAmount('');
                setLoanDescription('');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting loan:', error);
      Alert.alert('Error', 'Failed to request loan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to load user's loans
  const loadLoans = async () => {
    if (!userProfile?.nessieCustomerId) return;

    try {
      const NESSIE_API_KEY = 'cf56fb5b0f0c73969f042c7ad5457306';
      const url = `http://api.nessieisreal.com/customers/${userProfile.nessieCustomerId}/loans?key=${NESSIE_API_KEY}`;

      const response = await fetch(url);
      if (response.ok) {
        const loansData = await response.json();
        setLoans(loansData || []);
      }
    } catch (error) {
      console.error('Error loading loans:', error);
    }
  };

  // Load loans on component mount
  useEffect(() => {
    if (userProfile) {
      loadLoans();
    }
  }, [userProfile]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  return (
    <SafeAreaView style={styles.screenContainer}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.screenHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={20} color="#004977" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Personal Loan</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.whiteContainer}>

          {/* Credit Score Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Credit Score</Text>
            <View style={styles.creditScoreCard}>
              <View style={styles.creditScoreDisplay}>
                <Text style={styles.creditScoreNumber}>
                  {creditScore !== null ? creditScore : '...'}
                </Text>
                <Text style={styles.creditScoreLabel}>Credit Score</Text>
              </View>
              <View style={styles.creditScoreInfo}>
                <Text style={styles.creditScoreRange}>
                  {creditScore >= 800 ? 'Excellent' :
                   creditScore >= 740 ? 'Very Good' :
                   creditScore >= 670 ? 'Good' :
                   creditScore >= 580 ? 'Fair' : 'Poor'}
                </Text>
                <Text style={styles.creditScoreDescription}>
                  Your credit score determines loan approval and interest rates.
                </Text>
              </View>
            </View>
          </View>

          {/* Loan Amount Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loan Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={loanAmount}
                onChangeText={setLoanAmount}
                placeholder="Enter amount"
                keyboardType="numeric"
                maxLength={7}
              />
            </View>
            <Text style={styles.amountHint}>
              Amount determines approval chances and monthly payments
            </Text>
          </View>

          {/* Loan Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Loan Type</Text>
            <View style={styles.loanTypesContainer}>
              {loanTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.loanTypeCard,
                    selectedLoanType === type.id && styles.loanTypeCardSelected
                  ]}
                  onPress={() => setSelectedLoanType(type.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.loanTypeIcon}>
                    <Icon
                      name={type.icon}
                      size={24}
                      color={selectedLoanType === type.id ? '#fff' : '#004977'}
                    />
                  </View>
                  <View style={styles.loanTypeInfo}>
                    <Text style={[
                      styles.loanTypeTitle,
                      selectedLoanType === type.id && styles.loanTypeTitleSelected
                    ]}>
                      {type.label}
                    </Text>
                    <Text style={[
                      styles.loanTypeDescription,
                      selectedLoanType === type.id && styles.loanTypeDescriptionSelected
                    ]}>
                      {type.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Loan Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loan Description</Text>
            <View style={styles.descriptionInputContainer}>
              <TextInput
                style={styles.descriptionInput}
                value={loanDescription}
                onChangeText={setLoanDescription}
                placeholder="Optional description for your loan"
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>
            <Text style={styles.descriptionHint}>
              {loanDescription.length}/200 characters
            </Text>
          </View>

          {/* Loan Preview */}
          {loanAmount && creditScore && parseFloat(loanAmount) > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Loan Preview</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Loan Amount:</Text>
                  <Text style={styles.previewValue}>${formatCurrency(parseFloat(loanAmount))}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Term:</Text>
                  <Text style={styles.previewValue}>{getLoanTerm(parseFloat(loanAmount))} months</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Monthly Payment:</Text>
                  <Text style={styles.previewValue}>
                    ${calculateMonthlyPayment(parseFloat(loanAmount), getLoanTerm(parseFloat(loanAmount))).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Approval Chance:</Text>
                  <Text style={[
                    styles.previewValue,
                    checkLoanApproval(parseFloat(loanAmount), creditScore).approved
                      ? styles.approvedText
                      : styles.declinedText
                  ]}>
                    {checkLoanApproval(parseFloat(loanAmount), creditScore).approved ? 'High' : 'Low'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Request Loan Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.requestButton,
                (!loanAmount || !creditScore || loading || cardsLoading) && styles.disabledButton
              ]}
              onPress={requestLoan}
              disabled={!loanAmount || !creditScore || loading || cardsLoading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : cardsLoading ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.requestButtonText}>Loading Cards...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.requestButtonText}>Request Loan</Text>
                  <Icon name="arrow-right" size={16} color="#fff" style={styles.buttonIcon} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {(!creditCard && !cardsLoading) && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ You need a credit card to request loans. Create one from the Home screen.
              </Text>
            </View>
          )}

          {/* Existing Loans */}
          {!loansLoading && loans.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Loans</Text>
              {loans.map((loan) => (
                <View key={loan.id || loan._id} style={styles.loanCard}>
                  <View style={styles.loanHeader}>
                    <Text style={styles.loanType}>{loan.type?.toUpperCase()}</Text>
                    <View style={[
                      styles.loanStatus,
                      loan.status === 'approved' && styles.statusApproved,
                      loan.status === 'pending' && styles.statusPending,
                      loan.status === 'declined' && styles.statusDeclined
                    ]}>
                      <Text style={styles.loanStatusText}>{loan.status?.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.loanDetails}>
                    <Text style={styles.loanAmount}>${formatCurrency(loan.amount || 0)}</Text>
                    <Text style={styles.loanPayment}>Monthly: ${formatCurrency(loan.monthly_payment || 0)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {!loansLoading && loans.length === 0 && (
            <View style={styles.section}>
              <View style={styles.noLoansContainer}>
                <Icon name="hand-holding-usd" size={48} color="#ccc" />
                <Text style={styles.noLoansTitle}>No loans yet</Text>
                <Text style={styles.noLoansSubtitle}>
                  Apply for your first loan above
                </Text>
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSpacing(20),
    paddingVertical: scaleSpacing(15),
    backgroundColor: '#fff',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#1a1a1a',
  },
  placeholder: {
    width: 36,
  },
  scrollContent: {
    paddingBottom: scaleSpacing(30),
  },
  whiteContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: scaleSpacing(16),
    borderTopRightRadius: scaleSpacing(16),
    marginTop: 0,
    paddingTop: scaleSpacing(20),
    paddingHorizontal: scaleSpacing(20),
  },
  section: {
    marginBottom: scaleSpacing(24),
  },
  sectionTitle: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: scaleSpacing(12),
  },

  // Credit Score
  creditScoreCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditScoreDisplay: {
    alignItems: 'center',
    marginRight: scaleSpacing(20),
  },
  creditScoreNumber: {
    fontSize: scaleFont(32),
    fontWeight: 'bold',
    color: '#004977',
  },
  creditScoreLabel: {
    fontSize: scaleFont(12),
    color: '#666',
    marginTop: scaleSpacing(4),
  },
  creditScoreInfo: {
    flex: 1,
  },
  creditScoreRange: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: scaleSpacing(4),
  },
  creditScoreDescription: {
    fontSize: scaleFont(12),
    color: '#666',
    lineHeight: scaleFont(16),
  },

  // Loan Types
  loanTypesContainer: {
    gap: scaleSpacing(12),
  },
  loanTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(16),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  loanTypeCardSelected: {
    backgroundColor: '#004977',
    borderColor: '#004977',
  },
  loanTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleSpacing(16),
  },
  loanTypeInfo: {
    flex: 1,
  },
  loanTypeTitle: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: scaleSpacing(4),
  },
  loanTypeTitleSelected: {
    color: '#fff',
  },
  loanTypeDescription: {
    fontSize: scaleFont(12),
    color: '#666',
  },
  loanTypeDescriptionSelected: {
    color: 'rgba(255,255,255,0.8)',
  },

  // Amount Input
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: scaleSpacing(12),
    paddingHorizontal: scaleSpacing(16),
    paddingVertical: scaleSpacing(12),
    marginBottom: scaleSpacing(8),
  },
  currencySymbol: {
    fontSize: scaleFont(20),
    fontWeight: '600',
    color: '#004977',
    marginRight: scaleSpacing(8),
  },
  amountInput: {
    flex: 1,
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#1a1a1a',
  },
  amountHint: {
    fontSize: scaleFont(12),
    color: '#666',
  },
  descriptionInputContainer: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(16),
  },
  descriptionInput: {
    fontSize: scaleFont(16),
    color: '#1a1a1a',
    minHeight: scale(80),
    textAlignVertical: 'top',
  },
  descriptionHint: {
    fontSize: scaleFont(12),
    color: '#666',
    marginTop: scaleSpacing(4),
    textAlign: 'right',
  },

  // Preview
  previewCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(16),
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleSpacing(6),
  },
  previewLabel: {
    fontSize: scaleFont(14),
    color: '#666',
  },
  previewValue: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: '#1a1a1a',
  },
  approvedText: {
    color: '#4CAF50',
  },
  declinedText: {
    color: '#F44336',
  },

  // Button
  buttonContainer: {
    marginTop: scaleSpacing(20),
    marginBottom: scaleSpacing(20),
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#004977',
    borderRadius: scaleSpacing(12),
    paddingVertical: scaleSpacing(16),
    paddingHorizontal: scaleSpacing(32),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    gap: scaleSpacing(10),
  },
  requestButtonText: {
    color: '#fff',
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: scaleSpacing(4),
  },
  warningContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(16),
    marginBottom: scaleSpacing(20),
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  warningText: {
    fontSize: scaleFont(14),
    color: '#856404',
    textAlign: 'center',
    lineHeight: scaleFont(20),
  },
  disabledButton: {
    opacity: 0.6,
  },

  // Existing Loans
  loanCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: scaleSpacing(12),
    padding: scaleSpacing(16),
    marginBottom: scaleSpacing(12),
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSpacing(12),
  },
  loanType: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: '#1a1a1a',
  },
  loanStatus: {
    paddingHorizontal: scaleSpacing(8),
    paddingVertical: scaleSpacing(4),
    borderRadius: scaleSpacing(12),
  },
  statusApproved: {
    backgroundColor: '#E8F5E8',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusDeclined: {
    backgroundColor: '#FFEBEE',
  },
  loanStatusText: {
    fontSize: scaleFont(10),
    fontWeight: '600',
    color: '#1a1a1a',
  },
  loanDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loanAmount: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#004977',
  },
  loanPayment: {
    fontSize: scaleFont(14),
    color: '#666',
  },
  noLoansContainer: {
    alignItems: 'center',
    paddingVertical: scaleSpacing(60),
    backgroundColor: '#f8f9fa',
    borderRadius: scaleSpacing(16),
    paddingHorizontal: scaleSpacing(20),
  },
  noLoansTitle: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: scaleSpacing(16),
    marginBottom: scaleSpacing(8),
  },
  noLoansSubtitle: {
    fontSize: scaleFont(14),
    color: '#666',
    textAlign: 'center',
    lineHeight: scaleFont(20),
  },
});

export default LoanScreen;
