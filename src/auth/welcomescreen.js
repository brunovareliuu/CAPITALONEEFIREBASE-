import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  PixelRatio,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../styles/colors';

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

const WelcomeScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleCreateAccount = () => {
    navigation.navigate('SignUp');
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.backgroundContainer}>
        <View style={styles.gradientOverlay} />
        <Animated.View 
          style={[
            styles.contentContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image source={require('../../logos/textwhite.png')} style={styles.logoImage} resizeMode="contain" />
          </View>

          {/* Title */}
          <Text style={styles.mainTitle}>
            Start Managing Your Finances
          </Text>

          {/* Buttons */}
          <View style={styles.buttonsSection}>
            <TouchableOpacity style={styles.createAccountButton} onPress={handleCreateAccount}>
              <Text style={styles.createAccountButtonText}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundContainer: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    marginBottom: scaleSpacing(isSmallScreen ? 20 : 30),
    paddingTop: scaleSpacing(isSmallScreen ? 10 : 20),
  },
  logoImage: {
    width: scaleSpacing(isLargeScreen ? 350 : isSmallScreen ? 250 : 300),
    height: scaleSpacing(isLargeScreen ? 100 : isSmallScreen ? 75 : 90),
  },
  mainTitle: {
    fontSize: scaleFont(isLargeScreen ? 28 : isSmallScreen ? 20 : 24),
    fontWeight: '800',
    color: colors.background,
    textAlign: 'center',
    marginBottom: scaleSpacing(isSmallScreen ? 20 : 24),
    lineHeight: scaleFont(isSmallScreen ? 26 : 30),
    letterSpacing: 0.5,
  },
  buttonsSection: {
    width: '100%',
    maxWidth: scale(isLargeScreen ? 400 : 320),
    alignItems: 'center',
  },
  createAccountButton: {
    width: '100%',
    height: scaleSpacing(isSmallScreen ? 48 : 52),
    backgroundColor: colors.background,
    borderRadius: scaleSpacing(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleSpacing(isSmallScreen ? 16 : 20),
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: scaleSpacing(2),
    },
    shadowOpacity: 0.2,
    shadowRadius: scaleSpacing(4),
    elevation: 4,
  },
  createAccountButtonText: {
    color: colors.primary,
    fontSize: scaleFont(isSmallScreen ? 16 : 17),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signInButton: {
    width: '100%',
    height: scaleSpacing(isSmallScreen ? 48 : 52),
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: scaleSpacing(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInButtonText: {
    color: colors.background,
    fontSize: scaleFont(isSmallScreen ? 16 : 17),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disclaimer: {
    fontSize: scaleFont(isSmallScreen ? 11 : 12),
    color: colors.background,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: scaleFont(isSmallScreen ? 16 : 18),
    paddingHorizontal: scaleSpacing(10),
    marginTop: scaleSpacing(20),
  },
});

export default WelcomeScreen;
