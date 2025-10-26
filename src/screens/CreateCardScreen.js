import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addCard, upsertShareCode, removeShareCode, getUserProfile } from '../services/firestoreService'; // Importa la función del servicio
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import TourOverlay from '../components/TourOverlay';
// ColorPicker removido - usando solo colores predefinidos

const CreateCardScreen = ({ navigation, route }) => {
  const { isShared = false } = route?.params || {};
  const { user } = useAuth();
  const { isTourActive, currentStep, completeAction, nextStep } = useTour();
  const [currencyIcon, setCurrencyIcon] = useState(null);
  const [showTourTooltip, setShowTourTooltip] = useState(true);
  // Estado del color picker removido - usando solo colores predefinidos
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'debit', // 'credit', 'debit', 'cash'
    color: colors.cardColors.blue,
    textColor: colors.cardColors.white, // Default text color
    isShared: isShared,
    shareCode: '',
    creditLimit: '',
    initialBalance: '',
    // Savings fields
    goalAmount: '',
    deadline: '', // YYYY-MM-DD
    intervalDays: '1',
    frequency: 'daily', // 'daily' | 'weekly' | 'biweekly' | 'monthly'
    // customColor removido - usando solo colores predefinidos
  });

  const predefinedColors = Object.values(colors.cardColors);
  const predefinedTextColors = Object.values(colors.cardColors);

  // Generar código automáticamente cuando se crea el componente
  useEffect(() => {
    generateShareCode();
    if (user) {
      const fetchUserProfile = async () => {
        const profileSnap = await getUserProfile(user.uid);
        if (profileSnap.exists()) {
          const profile = profileSnap.data();
          if (profile.currency && profile.currency.icon) {
            setCurrencyIcon(profile.currency.icon);
          }
        }
      };
      fetchUserProfile();
    }
  }, [user]);

  const generateShareCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    setFormData(prev => ({ ...prev, shareCode: result }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a name for the card');
      return;
    }

    if (formData.type === 'credit' && (!formData.creditLimit || parseFloat(formData.creditLimit) <= 0)) {
      Alert.alert('Error', 'Please enter a valid credit limit');
      return;
    }

    try {
      // Crear la tarjeta en Firestore
      const parseNumber = (v) => {
        if (v === '' || v === null || v === undefined) return 0;
        const cleaned = String(v).replace(/,/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      };

      const cardData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        color: formData.color,
        isShared: formData.isShared,
        shareCode: formData.shareCode,
        creditLimit: formData.type === 'credit' ? parseNumber(formData.creditLimit) : null,
        initialBalance: formData.type === 'credit' ? -parseNumber(formData.initialBalance) : parseNumber(formData.initialBalance),
        // savings extras
        goalAmount: formData.type === 'savings' ? parseNumber(formData.goalAmount) : null,
        deadline: formData.type === 'savings' ? (formData.deadline || null) : null,
        intervalDays: formData.type === 'savings' ? parseInt(formData.intervalDays || '1', 10) : null,
        userId: user.uid,
        createdAt: new Date(),
      };

      const cardRef = await addCard(user.uid, cardData); // Usa la función del servicio
      const newCardId = cardRef.id; // Obtener el ID de la tarjeta creada

      // Manejar el código de compartir si la tarjeta es compartida
      if (cardData.isShared && cardData.shareCode) {
        await upsertShareCode(user.uid, user.uid, newCardId, cardData.shareCode);
      }

      Alert.alert(
        'Card Created',
        `Your card "${cardData.name}" has been created successfully${formData.isShared ? `\n\nShare code: ${formData.shareCode}` : ''}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Check if we're in tour mode and complete the action
              if (isTourActive && currentStep === 1) {
                completeAction('cardCreated');
                nextStep();
                // Replace current screen with CreateCategory to avoid going back through previous screens
                navigation.replace('CreateCategory');
              } else {
                navigation.goBack();
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating card:', error);
      Alert.alert('Error', 'Could not create the card. Please try again.');
    }
  };

  const copyShareCode = async () => {
    try {
      await Clipboard.setStringAsync(formData.shareCode);
      Alert.alert('Code Copied', 'The code has been copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Could not copy the code');
    }
  };

  // Función handleCustomColor removida - usando solo colores predefinidos

  const isValidHexColor = (color) => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  };

  const getCardIcon = (type) => {
    switch(type) {
      case 'cash': return 'money-bill-wave';
      case 'credit': return 'credit-card';
      case 'debit': return 'credit-card';
      case 'savings': return 'piggy-bank';
      default: return 'credit-card';
    }
  };

  const getCardTypeLabel = (type) => {
    switch(type) {
      case 'cash': return 'CASH';
      case 'credit': return 'CREDIT';
      case 'debit': return 'DEBIT';
      case 'savings': return 'SAVINGS';
      default: return 'CARD';
    }
  };

  const CardPreview = () => (
    <View style={[styles.cardPreview, { backgroundColor: formData.color }]}> 
      <View style={styles.cardPreviewHeader}>
        <View style={styles.cardPreviewInfo}>
          <Icon 
            name={getCardIcon(formData.type)} 
            size={20} 
            color={'#fff'} 
          />
          <View style={styles.cardPreviewTitleContainer}>
            <Text style={[styles.cardPreviewTitle, { color: '#fff' }]}> 
              {formData.name || 'Card Name'}
            </Text>
            <Text style={[styles.cardPreviewTypeLabel, { color: 'rgba(255, 255, 255, 0.8)' }]}> 
              {getCardTypeLabel(formData.type)}
            </Text>
          </View>
        </View>
        {formData.isShared && (
          <TouchableOpacity onPress={copyShareCode}>
            <Text style={[styles.cardPreviewCode, { color: 'rgba(255, 255, 255, 0.8)' }]}> 
              #{formData.shareCode}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.cardPreviewBalance}>
        <Text style={[styles.cardPreviewBalanceLabel, { color: 'rgba(255, 255, 255, 0.8)' }]}> 
          {formData.type === 'credit' ? 'Balance Taken' : 'Available Balance'}
        </Text>
        <Text style={[styles.cardPreviewBalanceAmount, { color: '#fff' }]}> 
          {currencyIcon && <Icon name={currencyIcon} size={24} color='#fff' />} {formData.initialBalance ? parseFloat(formData.initialBalance).toFixed(2) : '0.00'}
        </Text>
      </View>
      {formData.description && (
        <Text style={[styles.cardPreviewDescription, { color: 'rgba(255, 255, 255, 0.9)' }]}> 
          {formData.description}
        </Text>
      )}
    </View>
  );

  // ColorPickerModal removido - usando solo colores predefinidos

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="times" size={18} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isShared ? 'Create Shared Card' : 'Create New Card'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
        >
          {/* Vista previa de la tarjeta */}
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <CardPreview />
          </View>

          {/* Nombre de la tarjeta */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Card Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your bank name maybe"
              placeholderTextColor="#999"
              value={formData.name}
              onChangeText={(value) => setFormData({ ...formData, name: value })}
              maxLength={25}
              returnKeyType="next"
              blurOnSubmit={true}
            />
            <Text style={styles.charCount}>{formData.name.length}/25</Text>
          </View>

          {/* Tipo de tarjeta */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Type</Text>
            <View style={styles.typeButtons}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.type === 'debit' && styles.typeButtonActive
                ]}
                onPress={() => setFormData({ ...formData, type: 'debit' })}
              >
                <Icon name="credit-card" size={20} color={formData.type === 'debit' ? '#007AFF' : '#666'} />
                <Text style={[
                  styles.typeText,
                  formData.type === 'debit' && styles.typeTextActive
                ]}>
                  Debit
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.type === 'credit' && styles.typeButtonActive
                ]}
                onPress={() => setFormData({ ...formData, type: 'credit' })}
              >
                <Icon name="credit-card" size={20} color={formData.type === 'credit' ? '#007AFF' : '#666'} />
                <Text style={[
                  styles.typeText,
                  formData.type === 'credit' && styles.typeTextActive
                ]}>
                  Credit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.type === 'cash' && styles.typeButtonActive
                ]}
                onPress={() => setFormData({ ...formData, type: 'cash' })}
              >
                <Icon name="money-bill-wave" size={20} color={formData.type === 'cash' ? '#007AFF' : '#666'} />
                <Text style={[
                  styles.typeText,
                  formData.type === 'cash' && styles.typeTextActive
                ]}>
                  Cash
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.type === 'savings' && styles.typeButtonActive
                ]}
                onPress={() => setFormData({ ...formData, type: 'savings' })}
              >
                <Icon name="piggy-bank" size={20} color={formData.type === 'savings' ? '#007AFF' : '#666'} />
                <Text style={[
                  styles.typeText,
                  formData.type === 'savings' && styles.typeTextActive
                ]}>
                  Savings
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance Inicial */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{formData.type === 'credit' ? 'Balance Taken' : 'Initial Balance'}</Text>
            <View style={styles.currencyContainer}>
              {currencyIcon && <Icon name={currencyIcon} style={styles.currencySymbol} />}
              <TextInput
                style={styles.currencyInput}
                placeholder="0.00"
                placeholderTextColor="#999"
                value={formData.initialBalance}
                onChangeText={(value) => {
                  // Allow only numbers and one decimal point
                  const cleanValue = value.replace(/[^0-9.]/g, '');
                  const parts = cleanValue.split('.');
                  if (parts.length <= 2) {
                    let integerPart = parts[0].replace(/^0+(?=\d)/, '');
                    let decimalPart = parts.length === 2 ? parts[1].slice(0, 2) : '';
                    // add thousands separators to integer part for display
                    const displayInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                    const displayValue = decimalPart ? `${displayInt}.${decimalPart}` : displayInt;
                    setFormData({ ...formData, initialBalance: displayValue });
                  }
                }}
                keyboardType="numeric"
                returnKeyType="next"
                blurOnSubmit={true}
              />
            </View>
            <Text style={styles.inputHelp}>
              {formData.type === 'credit' ? 'Enter the amount of credit you have already used' : 'Enter the current balance for this card'}
            </Text>
          </View>

          {/* Límite de crédito (solo para tarjetas de crédito) */}
          {formData.type === 'credit' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Credit Limit</Text>
              <TextInput
                style={styles.input}
                placeholder="1000.00"
                placeholderTextColor="#999"
                value={formData.creditLimit}
                onChangeText={(value) => {
                  const cleanValue = value.replace(/[^0-9.]/g, '');
                  const parts = cleanValue.split('.');
                  if (parts.length <= 2) {
                    let integerPart = parts[0].replace(/^0+(?=\d)/, '');
                    let decimalPart = parts.length === 2 ? parts[1].slice(0, 2) : '';
                    const displayInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                    const displayValue = decimalPart ? `${displayInt}.${decimalPart}` : displayInt;
                    setFormData({ ...formData, creditLimit: displayValue });
                  }
                }}
                keyboardType="numeric"
                returnKeyType="next"
                blurOnSubmit={true}
              />
            </View>
          )}

          {/* Savings specific fields */}
          {formData.type === 'savings' && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Savings Goal</Text>
                <View style={styles.currencyContainer}>
                  {currencyIcon && <Icon name={currencyIcon} style={styles.currencySymbol} />}
                  <TextInput
                    style={styles.currencyInput}
                    placeholder="0.00"
                    placeholderTextColor="#999"
                    value={formData.goalAmount}
                    onChangeText={(value) => {
                      const cleanValue = value.replace(/[^0-9.]/g, '');
                      const parts = cleanValue.split('.');
                      if (parts.length <= 2) {
                        let integerPart = parts[0].replace(/^0+(?=\d)/, '');
                        let decimalPart = parts.length === 2 ? parts[1].slice(0, 2) : '';
                        const displayInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                        const displayValue = decimalPart ? `${displayInt}.${decimalPart}` : displayInt;
                        setFormData({ ...formData, goalAmount: displayValue });
                      }
                    }}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Deadline</Text>
                <View>
                  <DateTimePicker
                    value={(() => { 
                      if (formData.deadline) {
                        const p = formData.deadline.split('-');
                        if (p.length === 3) return new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10));
                      }
                      const d = new Date(); d.setDate(d.getDate()+7); return d;
                    })()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, selectedDate) => {
                      const currentDate = selectedDate || new Date();
                      const y = currentDate.getFullYear();
                      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
                      const d = String(currentDate.getDate()).padStart(2, '0');
                      setFormData({ ...formData, deadline: `${y}-${m}-${d}` });
                    }}
                    style={{ alignSelf: 'stretch' }}
                  />
                </View>
              </View>

              
            </>
          )}

          {/* Colores */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Color</Text>
            <View style={styles.colorsGrid}>
              {predefinedColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color },
                    formData.color === color && styles.colorButtonActive
                  ]}
                  onPress={() => setFormData({ ...formData, color })}
                >
                  {formData.color === color && (
                    <Icon name="check" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
              
              {/* Botón de color personalizado removido */}
            </View>
            
            {/* Display de color personalizado removido */}
          </View>

          {/* Descripción */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description (Optional)</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Add a description to better identify this card"
              placeholderTextColor="#999"
              value={formData.description}
              onChangeText={(value) => setFormData({ ...formData, description: value })}
              multiline
              maxLength={100}
              returnKeyType="done"
              blurOnSubmit={true}
            />
            <Text style={styles.charCount}>{formData.description.length}/100</Text>
          </View>

          {/* Tarjeta compartida */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[
                styles.shareToggle,
                formData.isShared && styles.shareToggleActive
              ]}
              onPress={() => setFormData({ 
                ...formData, 
                isShared: !formData.isShared
              })}
            >
              <Icon 
                name={formData.isShared ? "check-square" : "square"} 
                size={16} 
                color={formData.isShared ? '#007AFF' : '#666'} 
              />
              <Text style={[
                styles.shareToggleText,
                formData.isShared && styles.shareToggleTextActive
              ]}>
                Make this card shared
              </Text>
            </TouchableOpacity>
          </View>

          {formData.isShared && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Share Code</Text>
              <View style={styles.shareCodeContainer}>
                <TouchableOpacity 
                  style={styles.shareCodeInput}
                  onPress={copyShareCode}
                >
                  <Text style={styles.shareCodeText}>{formData.shareCode}</Text>
                  <Icon name="copy" size={16} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.generateButton}
                  onPress={generateShareCode}
                >
                  <Icon name="sync-alt" size={14} color="#fff" />
                  <Text style={styles.generateButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.shareCodeHelp}>
                Tap the code to copy it. Share it so others can join your card
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Icon name="plus" size={16} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.saveButtonText}>Create Card</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* ColorPickerModal removido */}

      {/* Tour Overlay */}
      {isTourActive && currentStep === 1 && showTourTooltip && (
        <TourOverlay
          visible={true}
          step={{
            stepNumber: 2,
            totalSteps: 4,
            icon: 'credit-card',
            title: 'Create your first card',
            description: 'Cards help you organize your expenses. They can be physical (debit, credit) or virtual. Give it a name and choose a color, then tap "Create Card".',
            buttonText: 'Got it',
          }}
          onNext={() => setShowTourTooltip(false)}
          onSkip={null}
          showSkipButton={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 200,
  },
  section: {
    marginBottom: 25,
  },
  previewSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  
  // Card Preview
  cardPreview: {
    borderRadius: 16,
    padding: 20,
    height: 140,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardPreviewInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardPreviewTitleContainer: {
    marginLeft: 10,
  },
  cardPreviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  cardPreviewTypeLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardPreviewCode: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  cardPreviewBalance: {
    alignItems: 'flex-start',
  },
  cardPreviewBalanceLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 3,
  },
  cardPreviewBalanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardPreviewCreditLimit: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  cardPreviewDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
  },
  
  // Form Elements
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 5,
  },
  
  // Currency Input
  currencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  currencyInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'transparent',
  },
  inputHelp: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    lineHeight: 16,
  },
  
  // Type Selection
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginTop: 5,
  },
  typeTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  
  // Colors
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorButtonActive: {
    borderColor: '#333',
  },
  customColorButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  customColorDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  customColorSample: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  customColorText: {
    fontSize: 14,
    color: '#333',
  },
  
  // Description
  descriptionInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  
  // Share Code
  shareCodeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  shareCodeInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 15,
  },
  shareCodeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  // Frequency pills
  freqPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  freqPillActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  freqText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  freqTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  shareCodeHelp: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  
  // Share Toggle
  shareToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  shareToggleActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  shareToggleText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginLeft: 10,
  },
  shareToggleTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  
  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    marginTop: 20,
    marginBottom: 40,
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Color Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    width: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  colorPickerWrapper: {
    height: 300,
    marginVertical: 20,
  },
  colorPickerStyle: {
    flex: 1,
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  colorPreviewCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  colorPreviewText: {
    fontSize: 14,
    color: '#333',
  },
  modalSaveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CreateCardScreen; 
