import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { predefinedIcons } from '../styles/icons';
import { addPlan } from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';

const predefinedColors = Object.values(colors.cardColors);

const availableIcons = predefinedIcons;

const CreateGestionPlanScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    color: predefinedColors[0],
    icon: 'tasks',
    kind: 'gestion',
    distribution: 'equitable', // 'equitable' | 'custom'
  });
  const [iconPage, setIconPage] = useState(0);
  const iconsPerPage = 24;
  const paginatedIcons = availableIcons.reduce((acc, icon, index) => {
    const pageIndex = Math.floor(index / iconsPerPage);
    if (!acc[pageIndex]) acc[pageIndex] = [];
    acc[pageIndex].push(icon);
    return acc;
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title for the plan');
      return false;
    }
    return true;
  };

  const handleCreatePlan = () => {
    if (!validateForm()) return;

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      color: formData.color,
      icon: formData.icon,
      kind: formData.kind,
      distribution: formData.distribution,
    };
    addPlan(user.uid, payload)
      .then(() => {
        Alert.alert('Plan Created', 'Your management plan has been created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      })
      .catch((e) => {
        console.error(e);
        Alert.alert('Error', 'Could not create the plan');
      });
  };

  const handleCancel = () => {
    if (
      formData.title ||
      formData.description
    ) {
      Alert.alert(
        'Cancel',
        'Are you sure you want to cancel? The entered data will be lost.',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const PlanPreview = () => {
    const textPrimary = '#fff';
    const textSecondary = 'rgba(255,255,255,0.85)';
    const bg = formData.color;

    return (
      <View style={[styles.planCard, { backgroundColor: bg }]}
        accessibilityLabel="Plan preview">
        <View style={styles.planHeader}>
          <View style={styles.planHeaderLeft}>
            <View style={styles.iconPill}>
              <Icon name={formData.icon} size={18} color={textPrimary} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.planTitle, { color: textPrimary }]} numberOfLines={1}>
                {formData.title || 'Plan title'}
              </Text>
              <Text style={[styles.planSubtitle, { color: textSecondary }]} numberOfLines={1}>
                {formData.description || 'Optional description'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.planFooter}>
            <View style={styles.deadlineRow}>
                <Icon name="tasks" size={12} color={textSecondary} />
                <Text style={[styles.deadlineText, { color: textSecondary }]}>
                  {formData.distribution === 'equitable' ? 'Equitable' : 'Custom'}
                </Text>
            </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Icon name="times" size={18} color="#666" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Management Plan</Text>
        <TouchableOpacity onPress={handleCreatePlan}>
          <Icon name="save" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <PlanPreview />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Plan Information</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Plan Title</Text>
            <TextInput
              style={styles.textInput}
              value={formData.title}
              onChangeText={(value) => handleInputChange('title', value)}
              placeholder="e.g., Organize birthday party"
              placeholderTextColor="#C7C7CC"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder="Describe the tasks or the objective..."
              placeholderTextColor="#C7C7CC"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Distribution Type</Text>
          <View style={styles.distributionContainer}>
            <TouchableOpacity
              style={[styles.distributionButton, formData.distribution === 'equitable' && styles.distributionButtonActive]}
              onPress={() => handleInputChange('distribution', 'equitable')}
            >
              <Text style={[styles.distributionButtonText, formData.distribution === 'equitable' && styles.distributionButtonTextActive]}>
                Equitable
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.distributionButton, formData.distribution === 'custom' && styles.distributionButtonActive]}
              onPress={() => handleInputChange('distribution', 'custom')}
            >
              <Text style={[styles.distributionButtonText, formData.distribution === 'custom' && styles.distributionButtonTextActive]}>
                Custom
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Color</Text>
          <View style={styles.colorsGrid}>
            {predefinedColors.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorButton, { backgroundColor: c }, formData.color === c && styles.colorButtonActive]}
                onPress={() => handleInputChange('color', c)}
                activeOpacity={0.9}
              >
                {formData.color === c ? <Icon name="check" size={14} color="#fff" /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Icon</Text>
          <View style={styles.iconsGrid}>
            {(paginatedIcons[iconPage] || []).map((iconName) => (
              <TouchableOpacity
                key={iconName}
                style={[styles.iconButton, formData.icon === iconName && styles.iconButtonActive]}
                onPress={() => handleInputChange('icon', iconName)}
                activeOpacity={0.8}
              >
                <Icon name={iconName} size={18} color={formData.icon === iconName ? colors.primary : '#666'} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              onPress={() => setIconPage((p) => Math.max(0, p - 1))}
              disabled={iconPage === 0}
              style={[styles.paginationButton, iconPage === 0 && styles.paginationButtonDisabled]}
            >
              <Icon name="chevron-left" size={16} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.paginationText}>{iconPage + 1} / {paginatedIcons.length || 1}</Text>
            <TouchableOpacity
              onPress={() => setIconPage((p) => Math.min((paginatedIcons.length - 1) || 0, p + 1))}
              disabled={iconPage === (paginatedIcons.length - 1)}
              style={[styles.paginationButton, iconPage === (paginatedIcons.length - 1) && styles.paginationButtonDisabled]}
            >
              <Icon name="chevron-right" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleCreatePlan}>
          <Icon name="save" size={16} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.saveButtonText}>Create Management Plan</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  previewSection: {
    marginBottom: 16,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  inputContainer: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorButtonActive: {
    borderColor: '#333',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
  },
  iconButtonActive: {
    borderColor: colors.primary,
    backgroundColor: '#E3F2FD',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '60%',
    alignSelf: 'center',
    marginTop: 8,
  },
  paginationButton: {
    padding: 10,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  planCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  planSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  planFooter: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deadlineText: {
    fontSize: 12,
    fontWeight: '500',
  },
  distributionContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  distributionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  distributionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  distributionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  distributionButtonTextActive: {
    color: '#fff',
  },
});

export default CreateGestionPlanScreen; CreateGestionPlanScreen;
