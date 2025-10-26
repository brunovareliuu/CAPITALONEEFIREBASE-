import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  PixelRatio,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../services/firestoreService';
import { getUserProfile } from '../services/firestoreService';
import { navigationRef } from '../utils/navigationRef';

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

const NickNameDebitScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { debitCardAccount } = route.params || {};

  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  // Animation refs
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(0.8)).current;

  // Handle initial flow or pre-fill nickname
  useEffect(() => {
    // If no debitCardAccount parameter, this is the initial flow - prefill nickname for debit
    if (!debitCardAccount && user) {
      const firstName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'User';
      const prefilledNickname = `${firstName}'s Debit Card`;
      setNickname(prefilledNickname);
    }

    // If we have debitCardAccount, prefill nickname
    if (debitCardAccount && user) {
      const firstName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'User';
      const prefilledNickname = `${firstName}'s Debit Card`;
      setNickname(prefilledNickname);
    }
  }, [debitCardAccount, user]);

  // Entry animations
  useEffect(() => {
    const startAnimations = () => {
      // Logo animation
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();

      // Content animation with delay
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(contentTranslateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }, 400);

      // Button animation with more delay
      setTimeout(() => {
        Animated.spring(buttonScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }, 800);
    };

    // Small delay to ensure component is mounted
    setTimeout(startAnimations, 100);
  }, []);

  const handleContinue = async () => {
    if (!nickname.trim()) {
      return;
    }

    setLoading(true);

    try {
      // If we don't have debitCardAccount (initial flow), create the debit account
      if (!debitCardAccount) {
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

        // Generate account number
        const generateAccountNumber = () => {
          let accountNumber = '';
          for (let i = 0; i < 16; i++) {
            accountNumber += Math.floor(Math.random() * 10);
          }
          return accountNumber;
        };

        // Prepare account data for debit card
        const accountNumber = generateAccountNumber();
        const accountData = {
          type: 'Checking',
          nickname: nickname.trim(),
          rewards: 0,
          balance: 10000, // $10,000 for debit cards
          account_number: accountNumber,
        };

        // Create account in Nessie API
        const NESSIE_API_KEY = 'cf56fb5b0f0c73969f042c7ad5457306';
        const url = `http://api.nessieisreal.com/customers/${nessieCustomerId}/accounts?key=${NESSIE_API_KEY}`;

        console.log('Creating debit account in Nessie API...');
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

        // Mark that the user completed the account quiz
        await updateUserProfile(user.uid, {
          completedAccountQuiz: true,
        });

        // Navigate directly to TarjetaDigital to create the digital card
        navigation.replace('TarjetaDigital', {
          nickname: nickname.trim(),
          accountData: result.objectCreated,
        });
      } else {
        // If we already have debitCardAccount, just navigate with nickname
        navigation.navigate('TarjetaDigital', {
          nickname: nickname.trim(),
          debitCardAccount: debitCardAccount,
        });
      }
    } catch (error) {
      console.error('Error creating account:', error);
      alert('Error creating account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        {/* Background */}
        <View style={styles.background}>
        {/* Logo Animation */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image source={require('../../logos/textwhite.png')} style={styles.logoImage} />
        </Animated.View>

        {/* Content */}
        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          <View style={styles.contentCard}>
            <Text style={styles.welcomeTitle}>
              Welcome to the family.{'\n'}This is the nickname for your first card,{'\n'}you can change it if you want.
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="Card nickname"
                placeholderTextColor="rgba(255,255,255,0.6)"
                selectionColor="#fff"
                autoFocus={true}
              />
            </View>

            <Animated.View
              style={[
                {
                  transform: [{ scale: buttonScale }],
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  (!nickname.trim() || loading) && styles.disabledButton
                ]}
                onPress={handleContinue}
                disabled={!nickname.trim() || loading}
                activeOpacity={0.8}
              >
                <Text style={styles.continueButtonText}>
                  {loading ? 'Creating...' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00487A',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: '#00487A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaleSpacing(15),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: scaleSpacing(20),
  },
  logoImage: {
    width: scale(250),
    height: scale(80),
    resizeMode: 'contain',
  },
  contentContainer: {
    width: '100%',
    maxWidth: scale(380),
  },
  contentCard: {
    alignItems: 'center',
    padding: scaleSpacing(24),
  },
  welcomeTitle: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: scaleSpacing(30),
    lineHeight: scaleFont(24),
  },
  inputContainer: {
    width: '100%',
    marginBottom: scaleSpacing(30),
    alignItems: 'center',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: scaleSpacing(12),
    paddingHorizontal: scaleSpacing(24),
    paddingVertical: scaleSpacing(16),
    fontSize: scaleFont(16),
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
    minWidth: scale(250),
  },
  continueButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    borderRadius: scaleSpacing(12),
    paddingVertical: scaleSpacing(16),
    paddingHorizontal: scaleSpacing(40),
    minWidth: scale(200),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
});

export default NickNameDebitScreen;
