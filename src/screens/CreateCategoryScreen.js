import React, { useState } from 'react';
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
import { StatusBar } from 'expo-status-bar';
import { addCategory } from '../services/firestoreService'; // Importa la función del servicio
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { predefinedIcons } from '../styles/icons';
import TourOverlay from '../components/TourOverlay';
// ColorPicker removido - usando solo colores predefinidos

const CreateCategoryScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { isTourActive, currentStep, completeAction, nextStep } = useTour();
  const [showTourTooltip, setShowTourTooltip] = useState(true);
  // Estado del color picker removido - usando solo colores predefinidos
  const [formData, setFormData] = useState({
    name: '',
    icon: 'tag',
    color: colors.cardColors.blue,
  });

  const predefinedColors = Object.values(colors.cardColors);

  

  const [iconPage, setIconPage] = useState(0);
  const iconsPerPage = 24; // Mostrar 24 por página como solicitado

  const paginatedIcons = predefinedIcons.reduce((acc, icon, index) => {
    const pageIndex = Math.floor(index / iconsPerPage);
    if (!acc[pageIndex]) {
      acc[pageIndex] = [];
    }
    acc[pageIndex].push(icon);
    return acc;
  }, []);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a name for the category');
      return;
    }

    try {
      const categoryData = {
        name: formData.name.trim(),
        icon: formData.icon,
        color: formData.color,
        userId: user.uid,
        createdAt: new Date(),
      };

      await addCategory(user.uid, categoryData);

      Alert.alert(
        'Category Created',
        `Category "${categoryData.name}" has been created successfully`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Check if we're in tour mode and complete the action
              if (isTourActive && currentStep === 2) {
                completeAction('categoryCreated');
                nextStep();
                // Replace current screen with CreatePlan to avoid going back through previous screens
                navigation.replace('CreatePlan');
              } else {
                navigation.goBack();
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating category:', error);
      Alert.alert('Error', 'Could not create category. Please try again.');
    }
  };

  // Función handleCustomColor removida - usando solo colores predefinidos

  const isValidHexColor = (color) => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  };

  const CategoryPreview = () => (
    <View style={[styles.categoryPreview, { backgroundColor: formData.color }]}>
      <Icon name={formData.icon} size={32} color="#fff" />
      <Text style={styles.categoryPreviewText}>
        {formData.name || 'Category name'}
      </Text>
    </View>
  );

  // ColorPickerModal removido - usando solo colores predefinidos

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={18} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Category</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Vista previa */}
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <CategoryPreview />
          </View>

          {/* Nombre */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Food, Transport, Home..."
              placeholderTextColor="#999"
              value={formData.name}
              onChangeText={(value) => setFormData({ ...formData, name: value })}
              maxLength={20}
            />
            <Text style={styles.charCount}>{formData.name.length}/20</Text>
          </View>

          {/* Iconos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Icon</Text>
            <View style={styles.iconsContainer}>
              <View style={styles.iconsGrid}>
                {(paginatedIcons[iconPage] || []).map((iconName) => (
                  <TouchableOpacity
                    key={iconName}
                    style={[
                      styles.iconButton,
                      formData.icon === iconName && styles.selectedIcon
                    ]}
                    onPress={() => setFormData({ ...formData, icon: iconName })}
                  >
                    <Icon 
                      name={iconName} 
                      size={20} 
                      color={formData.icon === iconName ? '#007AFF' : '#666'} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.paginationContainer}>
                <TouchableOpacity 
                  onPress={() => setIconPage(p => Math.max(0, p - 1))}
                  disabled={iconPage === 0}
                  style={[styles.paginationButton, iconPage === 0 && styles.paginationButtonDisabled]}
                >
                  <Icon name="chevron-left" size={16} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.paginationText}>{iconPage + 1} / {paginatedIcons.length}</Text>
                <TouchableOpacity 
                  onPress={() => setIconPage(p => Math.min(paginatedIcons.length - 1, p + 1))}
                  disabled={iconPage === paginatedIcons.length - 1}
                  style={[styles.paginationButton, iconPage === paginatedIcons.length - 1 && styles.paginationButtonDisabled]}
                >
                  <Icon name="chevron-right" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

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

              {/* Botón y display de color personalizado removidos */}
            </View>
          </View>


          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Icon name="save" size={16} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.saveButtonText}>Create Category</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ColorPickerModal removido */}

      {/* Tour Overlay */}
      {isTourActive && currentStep === 2 && showTourTooltip && (
        <TourOverlay
          visible={true}
          step={{
            stepNumber: 3,
            totalSteps: 4,
            icon: 'tag',
            title: 'Create your first category',
            description: 'Categories help you classify your expenses and income. For example: Food, Transport, Entertainment, etc. Choose an icon and color, then tap "Create Category".',
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
  
  // Category Preview
  categoryPreview: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  categoryPreviewText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
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
  
  // Icons
  iconsContainer: {
    alignItems: 'center',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 15,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIcon: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '60%',
  },
  paginationButton: {
    padding: 10,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
  colorInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  colorInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
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

export default CreateCategoryScreen; 
