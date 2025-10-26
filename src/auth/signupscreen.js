import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  PixelRatio,
  Animated,
  Modal,
  FlatList
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CommonActions } from '@react-navigation/native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../config/firebase';
import { createUserProfile } from '../services/firestoreService';
import { sendWelcomeMessage } from '../services/whatsappService';
import { FontAwesome5 as Icon } from '@expo/vector-icons';

// Obtener dimensiones de la pantalla
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Función para escalar tamaños basado en el ancho de pantalla
const scale = (size) => {
  const guidelineBaseWidth = 375; // iPhone 6/7/8 width
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

// Determinar si es pantalla pequeña
const isSmallScreen = screenHeight < 600;
const isLargeScreen = screenWidth > 768;

// Progress Indicator Component
const ProgressIndicator = ({ currentStep, totalSteps = 7 }) => {
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

// Email Step Component
const EmailStep = ({ formData, setFormData, onNext, error }) => {
  const [localError, setLocalError] = useState('');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return 'Email is required';
    if (!emailRegex.test(email)) return 'Please enter a valid email';
    return '';
  };

  const handleContinue = () => {
    const emailError = validateEmail(formData.email);
    if (emailError) {
      setLocalError(emailError);
      return;
    }
    setLocalError('');
    onNext();
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your email?</Text>
      <Text style={styles.stepSubtitle}>We'll use this to create your account</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, (localError || error) && styles.inputError]}
          placeholder="your.mail@gmail.com"
          placeholderTextColor="#888"
          value={formData.email}
          onChangeText={(text) => {
            setFormData({...formData, email: text});
            if (localError) setLocalError('');
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {(localError || error) && (
          <Text style={styles.errorText}>{localError || error}</Text>
        )}
      </View>

      <TouchableOpacity style={[styles.continueButton, {flex: 0}]} onPress={handleContinue}>
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
};

// Password Step Component
const PasswordStep = ({ formData, setFormData, onNext, onPrev, error }) => {
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePasswords = () => {
    if (!formData.password) return 'Password is required';
    if (formData.password.length < 6) return 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    return '';
  };

  const handleContinue = () => {
    const passwordError = validatePasswords();
    if (passwordError) {
      setLocalError(passwordError);
      return;
    }
    setLocalError('');
    onNext();
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Create your password</Text>
      <Text style={styles.stepSubtitle}>Make sure it's secure and easy to remember</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, localError && styles.inputError]}
          placeholder="Your password (min. 6 characters)"
          placeholderTextColor="#888"
          value={formData.password}
          onChangeText={(text) => {
            setFormData({...formData, password: text});
            if (localError) setLocalError('');
          }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Icon name={showPassword ? 'eye-slash' : 'eye'} size={scaleFont(18)} color="#888" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, localError && styles.inputError]}
          placeholder="Confirm your secure password"
          placeholderTextColor="#888"
          value={formData.confirmPassword}
          onChangeText={(text) => {
            setFormData({...formData, confirmPassword: text});
            if (localError) setLocalError('');
          }}
          secureTextEntry={!showConfirmPassword}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
        >
          <Icon name={showConfirmPassword ? 'eye-slash' : 'eye'} size={scaleFont(18)} color="#888" />
        </TouchableOpacity>
      </View>

      {localError && <Text style={styles.errorText}>{localError}</Text>}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onPrev}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Name Step Component
const NameStep = ({ formData, setFormData, onNext, onPrev, error }) => {
  const [localError, setLocalError] = useState('');

  const validateNames = () => {
    if (!formData.first_name?.trim()) return 'First name is required';
    if (!formData.last_name?.trim()) return 'Last name is required';
    if (formData.first_name.trim().length < 2) return 'First name must be at least 2 characters';
    if (formData.last_name.trim().length < 2) return 'Last name must be at least 2 characters';
    return '';
  };

  const handleContinue = () => {
    const namesError = validateNames();
    if (namesError) {
      setLocalError(namesError);
      return;
    }
    setLocalError('');
    onNext();
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your name?</Text>
      <Text style={styles.stepSubtitle}>This will be displayed in your profile</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, (localError || error) && styles.inputError]}
          placeholder="First name"
          placeholderTextColor="#888"
          value={formData.first_name}
          onChangeText={(text) => {
            setFormData({...formData, first_name: text});
            if (localError) setLocalError('');
          }}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, (localError || error) && styles.inputError]}
          placeholder="Last name"
          placeholderTextColor="#888"
          value={formData.last_name}
          onChangeText={(text) => {
            setFormData({...formData, last_name: text});
            if (localError) setLocalError('');
          }}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {(localError || error) && (
          <Text style={styles.errorText}>{localError || error}</Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onPrev}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Address Step 1 Component (City and State)
const AddressStep1 = ({ formData, setFormData, onNext, onPrev, error }) => {
  const [localError, setLocalError] = useState('');

  const validateAddress1 = () => {
    if (!formData.city?.trim()) return 'City is required';
    if (!formData.state?.trim()) return 'State is required';
    if (formData.city.trim().length < 2) return 'City must be at least 2 characters';
    if (!/^[A-Za-z]{2}$/.test(formData.state.trim())) return 'State must be exactly 2 letters (e.g., CA, NY, TX)';
    return '';
  };

  const handleContinue = () => {
    const addressError = validateAddress1();
    if (addressError) {
      setLocalError(addressError);
      return;
    }
    setLocalError('');
    onNext();
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where do you live?</Text>
      <Text style={styles.stepSubtitle}>Enter your city and state</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, (localError || error) && styles.inputError]}
          placeholder="City"
          placeholderTextColor="#888"
          value={formData.city}
          onChangeText={(text) => {
            setFormData({...formData, city: text});
            if (localError) setLocalError('');
          }}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, (localError || error) && styles.inputError]}
          placeholder="State (e.g., CA, NY, TX)"
          placeholderTextColor="#888"
          value={formData.state}
          onChangeText={(text) => {
            setFormData({...formData, state: text.toUpperCase()});
            if (localError) setLocalError('');
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={2}
        />
        {(localError || error) && (
          <Text style={styles.errorText}>{localError || error}</Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onPrev}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Address Step 2 Component (Street address and ZIP)
const AddressStep2 = ({ formData, setFormData, onNext, onPrev, error }) => {
  const [localError, setLocalError] = useState('');

  const validateAddress2 = () => {
    if (!formData.street_number?.trim()) return 'Street number is required';
    if (!formData.street_name?.trim()) return 'Street name is required';
    if (!formData.zip?.trim()) return 'ZIP code is required';
    if (formData.street_name.trim().length < 2) return 'Street name must be at least 2 characters';
    if (!/^\d{5}(-\d{4})?$/.test(formData.zip.trim())) return 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)';
    return '';
  };

  const handleContinue = () => {
    const addressError = validateAddress2();
    if (addressError) {
      setLocalError(addressError);
      return;
    }
    setLocalError('');
    onNext();
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Complete your address</Text>
      <Text style={styles.stepSubtitle}>Enter your street address and ZIP code</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, (localError || error) && styles.inputError]}
          placeholder="Street number"
          placeholderTextColor="#888"
          value={formData.street_number}
          onChangeText={(text) => {
            setFormData({...formData, street_number: text});
            if (localError) setLocalError('');
          }}
          keyboardType="numeric"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, (localError || error) && styles.inputError]}
          placeholder="Street name"
          placeholderTextColor="#888"
          value={formData.street_name}
          onChangeText={(text) => {
            setFormData({...formData, street_name: text});
            if (localError) setLocalError('');
          }}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, (localError || error) && styles.inputError]}
          placeholder="ZIP code (e.g., 12345)"
          placeholderTextColor="#888"
          value={formData.zip}
          onChangeText={(text) => {
            setFormData({...formData, zip: text});
            if (localError) setLocalError('');
          }}
          keyboardType="numeric"
          autoCorrect={false}
        />
        {(localError || error) && (
          <Text style={styles.errorText}>{localError || error}</Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onPrev}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Countries data with dial codes and validation rules
const countries = [
  { name: 'Mexico', iso: 'MX', dialCode: '+52', flag: '🇲🇽', phoneLength: 10 },
  { name: 'United States', iso: 'US', dialCode: '+1', flag: '🇺🇸', phoneLength: 10 },
  { name: 'Canada', iso: 'CA', dialCode: '+1', flag: '🇨🇦', phoneLength: 10 },
  { name: 'Brazil', iso: 'BR', dialCode: '+55', flag: '🇧🇷', phoneLength: 11 },
  { name: 'Argentina', iso: 'AR', dialCode: '+54', flag: '🇦🇷', phoneLength: 10 },
  { name: 'Chile', iso: 'CL', dialCode: '+56', flag: '🇨🇱', phoneLength: 9 },
  { name: 'Colombia', iso: 'CO', dialCode: '+57', flag: '🇨🇴', phoneLength: 10 },
  { name: 'Spain', iso: 'ES', dialCode: '+34', flag: '🇪🇸', phoneLength: 9 },
];

const currencies = [
  { code: 'USD', name: 'US Dollar', icon: 'dollar-sign' },
  { code: 'EUR', name: 'Euro', icon: 'euro-sign' },
  { code: 'GBP', name: 'British Pound', icon: 'pound-sign' },
  { code: 'BRL', name: 'Brazilian Real', icon: 'yen-sign' }, // Placeholder
  { code: 'MXN', name: 'Mexican Peso', icon: 'dollar-sign' }, // Placeholder
];

// Phone Step Component
const PhoneStep = ({ formData, setFormData, onNext, onPrev, error }) => {
  const [localError, setLocalError] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCountries = countries.filter(country => 
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.dialCode.includes(searchQuery) ||
    country.iso.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const validatePhoneNumber = (phoneNumber, country) => {
    if (!phoneNumber.trim()) return 'Phone number is required';
    
    const numericPhone = phoneNumber.replace(/\D/g, '');
    
    if (!/^\d+$/.test(numericPhone)) return 'Phone number must contain only digits';
    
    if (numericPhone.length !== country.phoneLength) {
      return `Phone number for ${country.name} must be ${country.phoneLength} digits`;
    }
    
    return '';
  };

  const handleContinue = () => {
    const phoneError = validatePhoneNumber(formData.phoneNumber, formData.countryCode);
    if (phoneError) {
      setLocalError(phoneError);
      return;
    }
    setLocalError('');
    onNext();
  };

  const selectCountry = (country) => {
    setFormData({...formData, countryCode: country});
    setShowCountryPicker(false);
    setSearchQuery('');
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your phone number?</Text>
      <Text style={styles.stepSubtitle}>We'll use this to verify your account</Text>

      <View style={styles.inputContainer}>
        <View style={[styles.phoneInputRow, (localError || error) && styles.inputError]}>
          <TouchableOpacity 
            style={styles.countrySelectorInline}
            onPress={() => setShowCountryPicker(true)}
          >
            <Text style={styles.countryFlag}>{formData.countryCode.flag}</Text>
            <Text style={styles.countryDialCode}>{formData.countryCode.dialCode}</Text>
            <Icon name="chevron-down" size={scaleFont(14)} color="#666" />
          </TouchableOpacity>

          <View style={styles.phoneDivider} />

          <TextInput
            style={styles.phoneInput}
            placeholder={`${formData.countryCode.phoneLength} digits`}
            placeholderTextColor="#888"
            value={formData.phoneNumber}
            onChangeText={(text) => {
              const numericText = text.replace(/\D/g, '');
              setFormData({...formData, phoneNumber: numericText});
              if (localError) setLocalError('');
            }}
            keyboardType="phone-pad"
            maxLength={formData.countryCode.phoneLength}
          />
        </View>
        {(localError || error) && (
          <Text style={styles.errorText}>{localError || error}</Text>
        )}
      </View>

      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Icon name="times" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Icon name="search" size={16} color="#888" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search country..."
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.iso}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    formData.countryCode.iso === item.iso && styles.countryItemSelected
                  ]}
                  onPress={() => selectCountry(item)}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <Text style={styles.countryItemName}>{item.name}</Text>
                  <Text style={styles.countryItemCode}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onPrev}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Currency Step Component
const CurrencyStep = ({ formData, setFormData, onPrev, onSubmit, loading }) => {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose your currency</Text>
      <Text style={styles.stepSubtitle}>This will be used for all your transactions</Text>

      <View style={styles.currencyListContainer}>
        {currencies.map((currency) => (
          <TouchableOpacity
            key={currency.code}
            style={[
              styles.currencyRow,
              formData.currency.code === currency.code && styles.currencyRowSelected
            ]}
            onPress={() => setFormData({...formData, currency: currency})}
          >
            <Icon name={currency.icon} style={styles.currencyIcon} />
            <View style={styles.currencyInfo}>
                <Text style={styles.currencyCode}>{currency.code}</Text>
                <Text style={styles.currencyName}>{currency.name}</Text>
            </View>
            {formData.currency.code === currency.code && (
              <Icon name="check-circle" style={styles.currencyCheck} solid />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={onPrev}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, loading && styles.disabledButton]}
          onPress={onSubmit}
          disabled={loading}
        >
          <Text style={styles.continueButtonText}>
            {loading ? 'Creating Account' : 'Create Account'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const SignUpScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phoneNumber: '',
    countryCode: countries.find(c => c.iso === 'MX'),
    city: '',
    state: '',
    street_number: '',
    street_name: '',
    zip: '',
    currency: currencies.find(c => c.code === 'EUR'),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Logo animation refs for smooth entrance
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(20)).current;

  // Initial logo animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoTranslateY, {
        toValue: 0,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Animation effect when step changes
  useEffect(() => {
    // Reset animations
    fadeAnim.setValue(0);
    slideAnim.setValue(10);

    // Animate in with smoother, faster timing
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep]);

  // Navigation functions with smoother, faster animations
  const nextStep = () => {
    if (currentStep < 7) {
      // Animate out faster and smoother
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: -15,
          tension: 220,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentStep(currentStep + 1);
        setError('');
      });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      // Animate out faster and smoother
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 15,
          tension: 220,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentStep(currentStep - 1);
        setError('');
      });
    }
  };

  // Render current step
  const renderCurrentStep = () => {
    switch(currentStep) {
      case 1:
        return <EmailStep formData={formData} setFormData={setFormData} onNext={nextStep} error={error} />;
      case 2:
        return <PasswordStep formData={formData} setFormData={setFormData} onNext={nextStep} onPrev={prevStep} error={error} />;
      case 3:
        return <NameStep formData={formData} setFormData={setFormData} onNext={nextStep} onPrev={prevStep} error={error} />;
      case 4:
        return <PhoneStep formData={formData} setFormData={setFormData} onNext={nextStep} onPrev={prevStep} error={error} />;
      case 5:
        return <AddressStep1 formData={formData} setFormData={setFormData} onNext={nextStep} onPrev={prevStep} error={error} />;
      case 6:
        return <AddressStep2 formData={formData} setFormData={setFormData} onNext={nextStep} onPrev={prevStep} error={error} />;
      case 7:
        return <CurrencyStep formData={formData} setFormData={setFormData} onPrev={prevStep} onSubmit={handleSignUp} loading={loading} />;
      default:
        return null;
    }
  };

  const handleSignUp = async () => {
    // Final validation
    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name ||
        !formData.phoneNumber || !formData.city || !formData.state || !formData.street_number ||
        !formData.street_name || !formData.zip) {
      setError('Please complete all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Step 1: Create user in Firebase Auth FIRST to get UID
      console.log('Creating Firebase user first...');
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const firebaseUID = userCredential.user.uid;
      console.log('Firebase user created with UID:', firebaseUID);

      // Step 3: Update Firebase user profile
      const displayName = `${formData.first_name} ${formData.last_name}`;
      await updateProfile(userCredential.user, {
        displayName: displayName,
      });

      // Step 4: Save user data to Firestore - SIEMPRE SE GUARDA, AUNQUE NESSIE FALLE
      console.log('Saving complete user profile to Firestore...');
      const formattedPhoneNumber = formData.countryCode.dialCode.replace('+', '') + formData.phoneNumber;

      await createUserProfile(firebaseUID, {
        // === CAMPOS PRINCIPALES ===
        email: formData.email,
        password: formData.password, // Store password for reference
        uid: firebaseUID, // Firebase UID (identificador principal)
        phoneNumber: formattedPhoneNumber, // Phone number with country code
        currency: formData.currency,
        completedAccountQuiz: false, // Usuario debe completar el quiz de cuenta
        createdAt: new Date(),

        // === INFORMACIÓN PERSONAL ===
        first_name: formData.first_name,
        last_name: formData.last_name,
        displayName: displayName, // Nombre completo para display

        // Dirección completa
        address: {
          street_number: formData.street_number,
          street_name: formData.street_name,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
        },

        // Información adicional del país para el teléfono
        countryCode: formData.countryCode,

        // Estado de la cuenta
        isActive: true,
        accountType: 'personal',
        lastLoginAt: new Date(),

        // Metadata del registro
        registrationMethod: 'email_password',
        registrationCompleted: true,
      });

      console.log('User registration completed successfully in Firebase');
      console.log('Firebase UID:', firebaseUID);
      console.log('Phone Number:', formattedPhoneNumber);
      console.log('Complete profile saved to Firestore');

      // Send welcome message via WhatsApp
      try {
        await sendWelcomeMessage(
          formattedPhoneNumber,
          formData.first_name
        );
        console.log('Welcome message sent successfully');
      } catch (whatsappError) {
        console.error('Error sending welcome message:', whatsappError);
        // Don't fail registration if WhatsApp fails
      }

      // Step 5: Navigation will be handled automatically by AppNavigation
      // Si Nessie falló, AppNavigation debería manejar que el usuario no tiene cuenta bancaria todavía

    } catch (error) {
      console.error('Registration error:', error);

      // Handle different types of errors
      if (error.code) {
        // Firebase Auth errors
        setError(getErrorMessage(error.code));
      } else {
        setError('Failed to create account. Please check your information and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode) => {
    console.error("Firebase Auth Error Code:", errorCode); // Añadido para depuración
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email is already registered';
      case 'auth/invalid-email':
        return 'Invalid email';
      case 'auth/weak-password':
        return 'The password is too weak';
      case 'auth/operation-not-allowed':
        return 'Operation not allowed';
      default:
        return 'Error creating account';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.backgroundContainer}>
        <View style={styles.gradientOverlay} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  opacity: logoOpacity,
                  transform: [{ translateY: logoTranslateY }],
                }
              ]}
            >
              <Image
                source={require('../../logos/textblue.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>

            <Animated.View
              style={[
                styles.contentContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                }
              ]}
            >
              {renderCurrentStep()}
            </Animated.View>

            <ProgressIndicator currentStep={currentStep} />

            {currentStep === 1 && (
              <View style={styles.signInContainer}>
                <Text style={styles.signInText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.signInLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backgroundContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: scaleSpacing(24),
    paddingVertical: scaleSpacing(20),
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scaleSpacing(isSmallScreen ? 5 : 8),
    paddingTop: scaleSpacing(isSmallScreen ? 2 : 4),
  },
  logoImage: {
    width: scaleSpacing(isLargeScreen ? 350 : isSmallScreen ? 250 : 300),
    height: scaleSpacing(isLargeScreen ? 100 : isSmallScreen ? 75 : 90),
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scaleSpacing(isSmallScreen ? 8 : 12),
    marginBottom: scaleSpacing(isSmallScreen ? 8 : 12),
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
  contentContainer: {
    marginBottom: scaleSpacing(isSmallScreen ? 5 : 8),
  },
  stepContainer: {
    width: '100%',
    maxWidth: scale(isLargeScreen ? 400 : 320),
    alignSelf: 'center',
  },
  stepTitle: {
    fontSize: scaleFont(isLargeScreen ? 24 : isSmallScreen ? 20 : 22),
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: scaleSpacing(2),
    letterSpacing: 0.5,
  },
  stepSubtitle: {
    fontSize: scaleFont(isLargeScreen ? 14 : isSmallScreen ? 12 : 13),
    color: '#666666',
    textAlign: 'center',
    marginBottom: scaleSpacing(isSmallScreen ? 12 : 16),
    lineHeight: scaleFont(isSmallScreen ? 18 : 20),
  },
  inputContainer: {
    marginBottom: scaleSpacing(isSmallScreen ? 8 : 12),
  },
  input: {
    width: '100%',
    height: scaleSpacing(isSmallScreen ? 48 : 52),
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: scaleSpacing(12),
    paddingHorizontal: scaleSpacing(16),
    fontSize: scaleFont(isSmallScreen ? 13 : 14),
    color: '#333333',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: scaleSpacing(16),
  },
  errorText: {
    fontSize: scaleFont(isSmallScreen ? 12 : 13),
    color: '#FF3B30',
    marginTop: scaleSpacing(4),
    textAlign: 'center',
  },
  currencyListContainer: {
    width: '100%',
    marginBottom: scaleSpacing(12),
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scaleSpacing(12),
    backgroundColor: '#F8F9FA',
    borderRadius: scaleSpacing(12),
    borderWidth: 2,
    borderColor: '#F8F9FA',
    marginBottom: scaleSpacing(10),
  },
  currencyRowSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  currencyIcon: {
    fontSize: scaleFont(18),
    color: '#333',
    marginRight: scaleSpacing(14),
    width: scaleSpacing(22),
    textAlign: 'center',
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: '#333',
  },
  currencyName: {
    fontSize: scaleFont(12),
    color: '#666',
  },
  currencyCheck: {
    fontSize: scaleFont(20),
    color: '#007AFF',
  },
  continueButton: {
    flex: 1,
    height: scaleSpacing(isSmallScreen ? 48 : 52),
    backgroundColor: '#007AFF',
    borderRadius: scaleSpacing(12),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: scaleFont(isSmallScreen ? 15 : 16),
    fontWeight: '600',
  },
  backButton: {
    flex: 1,
    height: scaleSpacing(isSmallScreen ? 48 : 52),
    backgroundColor: '#F8F9FA',
    borderRadius: scaleSpacing(12),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  backButtonText: {
    color: '#333333',
    fontSize: scaleFont(isSmallScreen ? 15 : 16),
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: scaleSpacing(12),
    marginTop: scaleSpacing(10),
  },
  disabledButton: {
    opacity: 0.6,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scaleSpacing(isSmallScreen ? 4 : 6),
  },
  signInText: {
    fontSize: scaleFont(isSmallScreen ? 15 : 16),
    color: '#666666',
  },
  signInLink: {
    fontSize: scaleFont(isSmallScreen ? 15 : 16),
    color: '#007AFF',
    fontWeight: '600',
  },
  // Phone Input Styles
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: scaleSpacing(12),
    height: scaleSpacing(isSmallScreen ? 48 : 52),
    overflow: 'hidden',
  },
  countrySelectorInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSpacing(12),
    paddingVertical: scaleSpacing(14),
  },
  countryFlag: {
    fontSize: scaleFont(20),
    marginRight: scaleSpacing(6),
  },
  countryDialCode: {
    fontSize: scaleFont(15),
    color: '#333',
    fontWeight: '600',
    marginRight: scaleSpacing(4),
  },
  phoneDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#E9ECEF',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: scaleSpacing(12),
    fontSize: scaleFont(isSmallScreen ? 13 : 14),
    color: '#333333',
    height: '100%',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: scaleSpacing(20),
    borderTopRightRadius: scaleSpacing(20),
    paddingTop: scaleSpacing(20),
    maxHeight: screenHeight * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleSpacing(20),
    marginBottom: scaleSpacing(16),
  },
  modalTitle: {
    fontSize: scaleFont(20),
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: scaleSpacing(12),
    marginHorizontal: scaleSpacing(20),
    marginBottom: scaleSpacing(16),
    paddingHorizontal: scaleSpacing(12),
  },
  searchIcon: {
    marginRight: scaleSpacing(8),
  },
  searchInput: {
    flex: 1,
    paddingVertical: scaleSpacing(12),
    fontSize: scaleFont(14),
    color: '#333',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSpacing(20),
    paddingVertical: scaleSpacing(14),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  countryItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  countryItemFlag: {
    fontSize: scaleFont(24),
    marginRight: scaleSpacing(12),
  },
  countryItemName: {
    flex: 1,
    fontSize: scaleFont(15),
    color: '#333',
  },
  countryItemCode: {
    fontSize: scaleFont(14),
    color: '#666',
    fontWeight: '600',
  },
});

export default SignUpScreen;
