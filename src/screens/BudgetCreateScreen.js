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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { addBudget, getCategories, updateBudget, getBudget } from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';

const BudgetCreateScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // Detectar si estamos editando un budget existente
  const { budgetId, editMode } = route?.params || {};
  const isEditing = editMode && budgetId;

  const [formData, setFormData] = useState({
    categoryId: '',
    targetAmount: '',
    type: 'expense', // 'expense' o 'savings'
    frequency: 'monthly', // 'weekly', 'monthly', 'yearly'
  });

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currencyIcon, setCurrencyIcon] = useState(null);

  const formatAmountInput = (raw) => {
    if (!raw) return '';
    let sanitized = raw.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const integerPartRaw = parts[0];
    const fractionalPartRaw = parts.slice(1).join('');
    if (!integerPartRaw) return '';
    const withCommas = integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${withCommas}.${fractionalPartRaw}` : withCommas;
  };

  useEffect(() => {
    if (!user) return;
    const unsubscribe = getCategories(user.uid, (userCategories) => {
      setCategories(userCategories);
    });

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

    return () => unsubscribe();
  }, [user]);

  // Cargar datos del budget si estamos editando
  useEffect(() => {
    if (!isEditing || !budgetId) return;

    setLoading(true);
    const unsubscribe = getBudget(budgetId, (budget) => {
      if (budget) {
        setFormData({
          categoryId: budget.categoryId || '',
          targetAmount: formatAmountInput(budget.targetAmount?.toString() || ''),
          type: budget.type || 'expense',
          frequency: budget.frequency || 'monthly',
        });

        // Encontrar y seleccionar la categoría
        const category = categories.find(c => c.id === budget.categoryId);
        if (category) {
          setSelectedCategory(category);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isEditing, budgetId, categories]);

  const budgetTypes = [
    { key: 'expense', label: 'Budget', icon: 'wallet', description: 'Control expenses in this category' },
    { key: 'savings', label: 'Savings', icon: 'piggy-bank', description: 'Save money in this category' },
  ];

  const frequencies = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
  ];

  const handleSave = async () => {
    if (!formData.categoryId) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    const targetAmount = parseFloat(formData.targetAmount.replace(/,/g, ''));
    if (!targetAmount || targetAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than 0');
      return;
    }

    try {
      const category = categories.find(c => c.id === formData.categoryId);
      const budgetData = {
        categoryId: formData.categoryId,
        categoryName: category?.name || 'Category',
        categoryIcon: category?.icon || 'tag',
        categoryColor: category?.color || colors.cardColors.blue,
        targetAmount,
        type: formData.type,
        frequency: formData.frequency,
      };

      if (isEditing) {
        // Actualizar budget existente
        await updateBudget(budgetId, budgetData);
        Alert.alert(
          'Budget Updated',
          `Budget for "${category?.name}" has been successfully updated`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        // Crear nuevo budget
        budgetData.currentAmount = 0;
        budgetData.startDate = new Date();
        await addBudget(user.uid, budgetData);
        Alert.alert(
          'Budget Created',
          `Budget for "${category?.name}" has been successfully created`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error saving budget:', error);
      Alert.alert('Error', `Could not ${isEditing ? 'update' : 'create'} the budget. Please try again.`);
    }
  };

  const selectCategory = (category) => {
    setFormData({ ...formData, categoryId: category.id });
    setSelectedCategory(category);
  };

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
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Budget' : 'New Budget'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Vista previa del presupuesto */}
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <View style={[styles.budgetPreview, { backgroundColor: selectedCategory?.color || colors.cardColors.blue }]}>
              <Icon name={selectedCategory?.icon || 'tag'} size={32} color="#fff" />
              <Text style={styles.budgetPreviewText}>
                {selectedCategory?.name || 'Select a category'}
              </Text>
              {selectedCategory && (
                <Text style={styles.budgetPreviewAmount}>
                  {currencyIcon && <Icon name={currencyIcon} size={14} color='rgba(255,255,255,0.9)' />} {formData.targetAmount.replace(/,/g, '') || '0'} / {frequencies.find(f => f.key === formData.frequency)?.label}
                </Text>
              )}
            </View>
          </View>

          {/* Selección de categoría */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    { backgroundColor: category.color },
                    formData.categoryId === category.id && styles.categoryButtonSelected
                  ]}
                  onPress={() => selectCategory(category)}
                >
                  <Icon name={category.icon} size={20} color="#fff" />
                  <Text style={styles.categoryButtonText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {categories.length === 0 && (
              <Text style={styles.noCategoriesText}>
                You have no categories. Create one from the menu first.
              </Text>
            )}
          </View>

          {/* Monto objetivo */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Target Amount</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 1,234.56"
              placeholderTextColor="#999"
              value={formData.targetAmount}
              onChangeText={(value) => setFormData({ ...formData, targetAmount: formatAmountInput(value) })}
              keyboardType="numeric"
            />
          </View>

          {/* Tipo de presupuesto */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget Type</Text>
            {budgetTypes.map((budgetType) => (
              <TouchableOpacity
                key={budgetType.key}
                style={[
                  styles.typeButton,
                  formData.type === budgetType.key && styles.typeButtonSelected
                ]}
                onPress={() => setFormData({ ...formData, type: budgetType.key })}
              >
                <View style={styles.typeButtonLeft}>
                  <Icon name={budgetType.icon} size={20} color={formData.type === budgetType.key ? '#007AFF' : '#666'} />
                  <View style={styles.typeButtonTextContainer}>
                    <Text style={[
                      styles.typeButtonTitle,
                      formData.type === budgetType.key && styles.typeButtonTitleSelected
                    ]}>
                      {budgetType.label}
                    </Text>
                    <Text style={[
                      styles.typeButtonDescription,
                      formData.type === budgetType.key && styles.typeButtonDescriptionSelected
                    ]}>
                      {budgetType.description}
                    </Text>
                  </View>
                </View>
                {formData.type === budgetType.key && (
                  <Icon name="check-circle" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Frecuencia */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frecuencia</Text>
            <View style={styles.frequencyContainer}>
              {frequencies.map((freq) => (
                <TouchableOpacity
                  key={freq.key}
                  style={[
                    styles.frequencyButton,
                    formData.frequency === freq.key && styles.frequencyButtonSelected
                  ]}
                  onPress={() => setFormData({ ...formData, frequency: freq.key })}
                >
                  <Text style={[
                    styles.frequencyButtonText,
                    formData.frequency === freq.key && styles.frequencyButtonTextSelected
                  ]}>
                    {freq.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, !formData.categoryId && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!formData.categoryId}
          >
            <Icon name="save" size={16} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.saveButtonText}>
              {isEditing ? 'Update Budget' : 'Create Budget'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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

  // Budget Preview
  budgetPreview: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  budgetPreviewText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  budgetPreviewAmount: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },

  // Categories
  categoriesScroll: {
    marginBottom: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryButtonSelected: {
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    elevation: 6,
  },
  categoryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  noCategoriesText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 20,
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

  // Budget Types
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  typeButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  typeButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeButtonTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  typeButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  typeButtonTitleSelected: {
    color: '#007AFF',
  },
  typeButtonDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  typeButtonDescriptionSelected: {
    color: '#007AFF',
  },

  // Frequency
  frequencyContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  frequencyButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  frequencyButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  frequencyButtonTextSelected: {
    color: '#007AFF',
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
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default BudgetCreateScreen;
