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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { createTarjetaDigital, getUserProfile } from '../../services/firestoreService';
import { getCustomerAccounts } from '../../services/nessieService';

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

// Determinar si es pantalla pequeña
const isSmallScreen = screenHeight < 600;

const TarjetaDigitalScreen = ({ navigation, route }) => {
  const { user, logout, triggerNavigationUpdate } = useAuth();
  const { nickname, accountData, debitCardAccount } = route.params || {};

  const [userProfile, setUserProfile] = useState(null);
  const [nessieAccounts, setNessieAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [showCvv, setShowCvv] = useState(false);

  // Función para obtener el color según el tipo de cuenta
  const getCardColor = (accountType) => {
    if (!accountType) return '#004977';
    const type = accountType.toLowerCase();
    if (type.includes('credit')) return '#004977'; // Azul marino
    if (type.includes('checking')) return '#004977'; // Azul marino para débito
    if (type.includes('savings')) return '#FF8C00'; // Naranja
    return '#004977'; // Default azul marino
  };

  // Function to get the card type text
  const getCardTypeText = (accountType) => {
    if (!accountType) return 'DEBIT';
    const type = accountType.toLowerCase();
    if (type.includes('credit')) return 'CREDIT';
    if (type.includes('checking')) return 'DEBIT';
    if (type.includes('savings')) return 'SAVINGS';
    return 'DEBIT';
  };

  // Generar datos de tarjeta al montar el componente
  useEffect(() => {
    // Generar fecha de expiración (5 años desde hoy)
    const today = new Date();
    const expiryYear = today.getFullYear() + 5;
    const expiryMonth = String(today.getMonth() + 1).padStart(2, '0');
    setExpiryDate(`${expiryMonth}/${String(expiryYear).slice(-2)}`);

    // Generar CVV (3 dígitos)
    const generatedCvv = Math.floor(100 + Math.random() * 900).toString();
    setCvv(generatedCvv);

    // Cargar perfil del usuario y cuentas de Nessie
    if (user) {
      const loadUserData = async () => {
        try {
          // Load user profile
          const profileDoc = await getUserProfile(user.uid);
          if (profileDoc.exists()) {
            setUserProfile(profileDoc.data());
          }

          // If we have account data from params, use it directly
          if (accountData || debitCardAccount) {
            const accountToUse = accountData || debitCardAccount;
            setNessieAccounts([accountToUse]);
          } else {
            // Load Nessie accounts
            const nessieCustomerId = profileDoc.data()?.nessieCustomerId;
            if (nessieCustomerId) {
              const accounts = await getCustomerAccounts(nessieCustomerId);
              setNessieAccounts(accounts || []);
            }
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      };
      loadUserData();
    }
  }, [user]);

  // Formatear número de cuenta para mostrar
  const formatAccountNumber = (accountNumber) => {
    if (!accountNumber) return '';
    return accountNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  // Crear tarjeta digital
  const handleCreateTarjeta = async () => {
    if (!user || !userProfile) {
      Alert.alert('Error', 'No se pudo obtener la información del usuario');
      return;
    }

    if (nessieAccounts.length === 0) {
      Alert.alert('Error', 'No se encontró información de la cuenta');
      return;
    }

    const account = nessieAccounts[0];
    setLoading(true);
    try {
      // Datos de la tarjeta digital con información de Nessie
      const tarjetaData = {
        userId: user.uid,
        nombreTitular: userProfile.name || user.displayName || 'Usuario',
        email: userProfile.email || user.email,
        accountNumber: account.account_number,
        numeroTarjeta: account.account_number, // Usar account number como número de tarjeta
        fechaExpiracion: expiryDate,
        cvv: cvv,
        tipo: account.type,
        tipoTexto: getCardTypeText(account.type),
        color: getCardColor(account.type),
        saldo: account.balance,
        rewards: account.rewards || 0,
        nickname: nickname || account.nickname, // Use provided nickname or fallback to account nickname
        nessieAccountId: account._id,
        createdAt: new Date(),
        activa: true,
      };

      // Guardar en Firestore
      await createTarjetaDigital(tarjetaData);

      // Mostrar mensaje de éxito y navegar
      Alert.alert(
        'Card Created!',
        'Your digital card has been created successfully.',
        [
          {
            text: 'Continue',
            onPress: () => {
              // Trigger navigation update to go to main app
              triggerNavigationUpdate();
            },
          },
        ]
      );

    } catch (error) {
      console.error('Error creating tarjeta:', error);
      Alert.alert('Error', 'Could not create digital card. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Copiar número de cuenta al portapapeles
  const copyAccountNumber = async () => {
    if (nessieAccounts.length > 0) {
      await Clipboard.setStringAsync(nessieAccounts[0].account_number);
      Alert.alert('Copied', 'Account number copied to clipboard');
    }
  };

  return (
    <SafeAreaView style={styles.screenContainer}>
      <StatusBar style="dark" />

      {/* Header sin botón de back */}
      <View style={styles.screenHeader}>
        <View style={styles.placeholder} />
        <Text style={styles.screenTitle}>Create Digital Card</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        bounces={true}
      >
        {/* Contenedor blanco con bordes redondeados */}
        <View style={styles.whiteContainer}>

        {/* Vista previa de la tarjeta con información de Nessie */}
        {nessieAccounts.length > 0 && (
          <View style={styles.cardPreview}>
            <View style={[styles.card, { backgroundColor: getCardColor(nessieAccounts[0].type) }]}>
              {/* Patrón de fondo sutil */}
              <View style={styles.cardPattern}>
                <View style={styles.patternCircle1} />
                <View style={styles.patternCircle2} />
              </View>

              <View style={styles.cardHeader}>
                <View style={styles.cardLogo}>
                  <Icon name={
                    nessieAccounts[0].type.toLowerCase().includes('credit') ? 'credit-card' :
                    nessieAccounts[0].type.toLowerCase().includes('savings') ? 'piggy-bank' : 'wallet'
                  } size={24} color="#fff" />
                  <Text style={styles.cardTypeText}>{getCardTypeText(nessieAccounts[0].type)}</Text>
                </View>
                <Text style={styles.cardBrand}>Capital One</Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardNumber}>
                  **** **** **** {nessieAccounts[0].account_number.slice(-4)}
                </Text>

                <View style={styles.cardDetails}>
                  <View style={styles.cardHolder}>
                    <Text style={styles.cardHolderLabel}>TITULAR</Text>
                    <Text style={styles.cardHolderName}>
                      {userProfile?.name || user?.displayName || 'Usuario'}
                    </Text>
                  </View>
                  <View style={styles.cardExpiry}>
                    <Text style={styles.cardExpiryLabel}>VÁLIDA HASTA</Text>
                    <Text style={styles.cardExpiryValue}>
                      {expiryDate}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cardCvv}
                    onPress={() => setShowCvv(!showCvv)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cardCvvLabel}>CVV</Text>
                    <View style={styles.cvvContainer}>
                      <Text style={styles.cardCvvValue}>
                        {showCvv ? cvv : '***'}
                      </Text>
                      <Icon
                        name={showCvv ? 'eye-slash' : 'eye'}
                        size={12}
                        color="rgba(255,255,255,0.8)"
                        style={styles.cvvIcon}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Cardholder Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cardholder Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Icon name="user" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>
                  {userProfile?.name || user?.displayName || 'User'}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Icon name="envelope" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>
                  {userProfile?.email || user?.email}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Account Number */}
        {nessieAccounts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Number</Text>
            <View style={styles.clabeCard}>
              <View style={styles.clabeContent}>
                <Text style={styles.clabeText}>{formatAccountNumber(nessieAccounts[0].account_number)}</Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={copyAccountNumber}
                >
                  <Icon name="copy" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.clabeNote}>
              This is your unique account number for transactions.
            </Text>
          </View>
        )}

        {/* Security Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Information</Text>
          <View style={styles.securityCard}>
            <View style={styles.securityRow}>
              <View style={styles.securityItem}>
                <Text style={styles.securityLabel}>Expiration Date</Text>
                <Text style={styles.securityValue}>{expiryDate}</Text>
              </View>
              <View style={styles.securityItem}>
                <Text style={styles.securityLabel}>CVV Code</Text>
                <Text style={styles.securityValue}>{cvv}</Text>
              </View>
            </View>
          </View>
        </View>


        {/* Botón crear */}
        {nessieAccounts.length > 0 && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.createButton,
                { backgroundColor: getCardColor(nessieAccounts[0].type) },
                loading && styles.disabledButton
              ]}
              onPress={handleCreateTarjeta}
              disabled={loading}
            >
              <Text style={styles.createButtonText}>
                {loading ? 'Creating card...' : 'Create Digital Card'}
              </Text>
              {!loading && <Icon name="arrow-right" size={16} color="#fff" style={styles.buttonIcon} />}
            </TouchableOpacity>
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
    backgroundColor: '#FFFFFF',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSpacing(20),
    paddingVertical: scaleSpacing(15),
    backgroundColor: '#FFFFFF',
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
    color: '#000000',
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
  cardPreview: {
    marginBottom: scaleSpacing(30),
  },
  card: {
    height: scaleSpacing(180),
    borderRadius: scaleSpacing(20),
    padding: scaleSpacing(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  cardPattern: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: scaleSpacing(120),
    height: scaleSpacing(120),
    opacity: 0.1,
  },
  patternCircle1: {
    position: 'absolute',
    top: scaleSpacing(20),
    right: scaleSpacing(20),
    width: scaleSpacing(60),
    height: scaleSpacing(60),
    borderRadius: scaleSpacing(30),
    backgroundColor: '#fff',
  },
  patternCircle2: {
    position: 'absolute',
    top: scaleSpacing(40),
    right: scaleSpacing(40),
    width: scaleSpacing(40),
    height: scaleSpacing(40),
    borderRadius: scaleSpacing(20),
    backgroundColor: '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSpacing(20),
  },
  cardLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSpacing(8),
  },
  cardTypeText: {
    color: '#fff',
    fontSize: scaleFont(12),
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cardBrand: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  cardBody: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: scaleSpacing(8),
  },
  cardNumber: {
    color: '#fff',
    fontSize: scaleFont(18),
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: scaleSpacing(15),
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardHolder: {
    flex: 2,
  },
  cardHolderLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: scaleFont(10),
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: scaleSpacing(4),
  },
  cardHolderName: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  cardExpiry: {
    flex: 1,
    alignItems: 'center',
  },
  cardExpiryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: scaleFont(8),
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: scaleSpacing(4),
  },
  cardExpiryValue: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  cardCvv: {
    flex: 1,
    alignItems: 'center',
  },
  cardCvvLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: scaleFont(10),
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: scaleSpacing(4),
  },
  cvvContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSpacing(4),
  },
  cardCvvValue: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  cvvIcon: {
    marginTop: scaleSpacing(1),
  },
  section: {
    marginBottom: scaleSpacing(24),
  },
  sectionTitle: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: scaleSpacing(12),
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSpacing(16),
    padding: scaleSpacing(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSpacing(12),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSpacing(12),
  },
  infoContent: {
    flex: 1,
    marginLeft: scaleSpacing(12),
  },
  infoLabel: {
    fontSize: scaleFont(12),
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: scaleFont(16),
    color: '#000000',
    fontWeight: '500',
    marginTop: scaleSpacing(2),
  },
  clabeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSpacing(16),
    padding: scaleSpacing(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  clabeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clabeText: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: scaleSpacing(16),
    paddingVertical: scaleSpacing(10),
    borderRadius: scaleSpacing(12),
    gap: scaleSpacing(8),
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  clabeNote: {
    fontSize: scaleFont(12),
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: scaleSpacing(8),
    lineHeight: scaleFont(16),
  },
  buttonContainer: {
    marginTop: scaleSpacing(20),
    marginBottom: scaleSpacing(20),
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scaleSpacing(16),
    paddingVertical: scaleSpacing(18),
    paddingHorizontal: scaleSpacing(32),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    gap: scaleSpacing(10),
  },
  createButtonText: {
    color: '#fff',
    fontSize: scaleFont(16),
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginLeft: scaleSpacing(4),
  },
  disabledButton: {
    opacity: 0.6,
  },
  securityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSpacing(16),
    padding: scaleSpacing(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  securityItem: {
    flex: 1,
    alignItems: 'center',
  },
  securityLabel: {
    fontSize: scaleFont(12),
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scaleSpacing(4),
  },
  securityValue: {
    fontSize: scaleFont(18),
    color: '#000000',
    fontWeight: 'bold',
  },
});

export default TarjetaDigitalScreen;
