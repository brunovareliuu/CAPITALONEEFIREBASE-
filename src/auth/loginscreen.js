import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  PixelRatio
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

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

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (email.trim() === '' || password.trim() === '') {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation will be handled by auth state change
      // Reset navigation stack to prevent going back
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    navigation.navigate('SignUp');
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for password reset instructions. The email may take a few minutes to arrive.'
      );
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error.code));
    }
  };

  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'User not found';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/invalid-email':
        return 'Invalid email';
      case 'auth/user-disabled':
        return 'User account disabled';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Try again later';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection';
      default:
        return 'Sign in failed. Please try again';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Background with gradient */}
      <View style={styles.backgroundContainer}>
        <View style={styles.gradientOverlay} />

        {/* Content */}
        <View style={styles.contentContainer}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../logos/textblue.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          {/* Form Container */}
          <View style={styles.formContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#999999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#999999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.signInButton, loading && styles.disabledButton]}
              onPress={handleSignIn}
              disabled={loading}
            >
              <Text style={styles.signInButtonText}>
                {loading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <View style={styles.optionsContainer}>
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity onPress={handleSignUp}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaleSpacing(24),
    paddingVertical: scaleSpacing(isSmallScreen ? 20 : 40),
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scaleSpacing(isSmallScreen ? 5 : 10),
    paddingTop: scaleSpacing(isSmallScreen ? -10 : -20),
  },
  logoText: {
    fontSize: scaleFont(isLargeScreen ? 36 : isSmallScreen ? 28 : 32),
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 1,
  },
  logoImage: {
    width: scaleSpacing(isLargeScreen ? 400 : isSmallScreen ? 280 : 340),
    height: scaleSpacing(isLargeScreen ? 120 : isSmallScreen ? 84 : 102),
  },
  title: {
    fontSize: scaleFont(isLargeScreen ? 28 : isSmallScreen ? 24 : 26),
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: scaleSpacing(5),
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: scaleFont(isLargeScreen ? 16 : isSmallScreen ? 14 : 15),
    color: '#666666',
    textAlign: 'center',
    marginBottom: scaleSpacing(isSmallScreen ? 8 : 16),
    lineHeight: scaleFont(isSmallScreen ? 20 : 22),
  },
  formContainer: {
    width: '100%',
    maxWidth: scale(isLargeScreen ? 400 : 320),
  },
  label: {
    fontSize: scaleFont(isSmallScreen ? 15 : 16),
    color: '#333333',
    marginBottom: scaleSpacing(8),
    fontWeight: '500',
  },
  input: {
    width: '100%',
    height: scaleSpacing(isSmallScreen ? 48 : 52),
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: scaleSpacing(12),
    paddingHorizontal: scaleSpacing(16),
    fontSize: scaleFont(isSmallScreen ? 16 : 17),
    marginBottom: scaleSpacing(isSmallScreen ? 16 : 20),
    color: '#333333',
  },
  signInButton: {
    width: '100%',
    height: scaleSpacing(isSmallScreen ? 48 : 52),
    backgroundColor: '#007AFF',
    borderRadius: scaleSpacing(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scaleSpacing(8),
    marginBottom: scaleSpacing(isSmallScreen ? 20 : 24),
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: scaleSpacing(2),
    },
    shadowOpacity: 0.3,
    shadowRadius: scaleSpacing(4),
    elevation: 4,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: scaleFont(isSmallScreen ? 16 : 17),
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  optionsContainer: {
    alignItems: 'center',
    marginBottom: scaleSpacing(isSmallScreen ? 24 : 32),
  },
  forgotPasswordText: {
    fontSize: scaleFont(isSmallScreen ? 14 : 15),
    color: '#007AFF',
    fontWeight: '500',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scaleSpacing(isSmallScreen ? 16 : 20),
  },
  signUpText: {
    fontSize: scaleFont(isSmallScreen ? 15 : 16),
    color: '#666666',
  },
  signUpLink: {
    fontSize: scaleFont(isSmallScreen ? 15 : 16),
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default LoginScreen; 
