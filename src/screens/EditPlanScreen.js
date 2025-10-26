import React, { useEffect, useMemo, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { predefinedIcons } from '../styles/icons';
import { updatePlan, deletePlan, getUserProfile } from '../services/firestoreService';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';

const predefinedColors = Object.values(colors.cardColors || { primary: colors.primary });
const availableIcons = predefinedIcons || ['bullseye'];

const EditPlanScreen = ({ plan: propPlan, onClose, isModal = false }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const plan = propPlan || route?.params?.plan || null;

  const [currencyIcon, setCurrencyIcon] = useState('dollar-sign');

  useEffect(() => {
    if (user?.uid) {
      getUserProfile(user.uid).then(profileSnap => {
        if (profileSnap.exists()) {
          const profile = profileSnap.data();
          if (profile.currency && profile.currency.icon) {
            setCurrencyIcon(profile.currency.icon);
          }
        }
      }).catch(e => console.error("Failed to fetch currency icon", e));
    }
  }, [user?.uid]);

  const [formData, setFormData] = useState({
    title: plan?.title || '',
    description: plan?.description || '',
    targetAmount: '',
    deadline: plan?.deadline || '',
    color: plan?.color || (predefinedColors[0] || colors.primary),
    icon: plan?.icon || 'bullseye',
    kind: plan?.kind || 'savings',
  });

  const [iconPage, setIconPage] = useState(0);
  const iconsPerPage = 24;
  const paginatedIcons = availableIcons.reduce((acc, icon, index) => {
    const pageIndex = Math.floor(index / iconsPerPage);
    if (!acc[pageIndex]) acc[pageIndex] = [];
    acc[pageIndex].push(icon);
    return acc;
  }, []);

  useEffect(() => {
    const n = Number(plan?.targetAmount || 0);
    const withCommas = new Intl.NumberFormat('en-US').format(n);
    setFormData(prev => ({ ...prev, targetAmount: withCommas }));
  }, [plan?.targetAmount]);

  const progressPreview = useMemo(() => {
    const amount = parseFloat(String(formData.targetAmount).replace(/,/g, '') || '0');
    const current = plan?.currentAmount || 0;
    const pct = amount > 0 ? Math.round((current / amount) * 100) : 0;
    return { current, amount, pct };
  }, [formData.targetAmount, plan?.currentAmount]);

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
    if (!String(formData.targetAmount || '').trim()) {
      Alert.alert('Error', 'Please enter the target amount');
      return false;
    }
    const normalized = parseFloat(String(formData.targetAmount).replace(/,/g, ''));
    if (isNaN(normalized) || normalized <= 0) {
      Alert.alert('Error', 'The target amount must be a valid number greater than 0');
      return false;
    }
    if (!String(formData.deadline || '').trim()) {
      Alert.alert('Error', 'Please select a deadline');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!plan?.id) {
      Alert.alert('Error', 'Invalid plan');
      return;
    }
    if (!validateForm()) return;

    const normalizeNumber = (v) => {
      if (!v) return 0;
      const cleaned = String(v).replace(/,/g, '');
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      targetAmount: normalizeNumber(formData.targetAmount),
      deadline: formData.deadline,
      color: formData.color,
      icon: formData.icon,
      kind: formData.kind,
    };

    try {
      await updatePlan(plan.id, payload);
      Alert.alert('Plan Updated', 'Your plan has been updated successfully', [
        { text: 'OK', onPress: () => isModal ? onClose?.() : navigation.goBack() },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not update the plan');
    }
  };

  const handleDeletePlan = () => {
    if (!plan?.id) {
      Alert.alert('Error', 'Invalid plan');
      return;
    }

    Alert.alert(
      'Delete Plan',
      'Are you sure you want to delete this plan? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlan(user.uid, plan.id);
              Alert.alert('Plan Deleted', 'The plan has been deleted successfully', [
                { text: 'OK', onPress: () => isModal ? onClose?.() : navigation.goBack() },
              ]);
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Could not delete the plan');
            }
          }
        }
      ]
    );
  };

  const PlanPreview = () => {
    const textPrimary = '#fff';
    const textSecondary = 'rgba(255,255,255,0.85)';
    const bg = formData.color;
    const pct = progressPreview.pct;

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

        <View>
          <Text style={[styles.amountText, { color: textPrimary }]}>
            {`${progressPreview.current.toLocaleString()} / ${progressPreview.amount.toLocaleString() || '0'}`}
          </Text>
          <View style={styles.progressBarWrapper}>
            <View style={[styles.progressBarTrack, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
            <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: '#fff' }]} />
          </View>
          <View style={styles.planFooter}>
            <View style={styles.deadlineRow}>
              <Icon name="calendar" size={12} color={textSecondary} />
              <Text style={[styles.deadlineText, { color: textSecondary }]}>
                {formData.deadline || 'YYYY-MM-DD'}
              </Text>
            </View>
            <Text style={[styles.progressPercentage, { color: textPrimary }]}>{`${pct}%`}</Text>
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
        <TouchableOpacity style={styles.backButton} onPress={() => isModal ? onClose?.() : navigation.goBack()}>
            <Icon name="times" size={18} color="#666" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Plan</Text>
        <TouchableOpacity onPress={handleSave}>
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
              placeholder="e.g., Summer Vacation"
              placeholderTextColor="#C7C7CC"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder="Describe your savings goal..."
              placeholderTextColor="#C7C7CC"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Target Amount</Text>
            <View style={styles.amountInputContainer}>
              <Icon name={currencyIcon} size={18} style={styles.currencySymbol} />
              <TextInput
                style={[styles.textInput, styles.amountInput]}
                value={formData.targetAmount}
                onChangeText={(value) => {
                  const cleanValue = String(value).replace(/[^0-9.]/g, '');
                  const parts = cleanValue.split('.');
                  if (parts.length <= 2) {
                    let integerPart = parts[0].replace(/^0+(?=\d)/, '');
                    let decimalPart = parts.length === 2 ? parts[1].slice(0, 2) : '';
                    const displayInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                    const displayValue = decimalPart ? `${displayInt}.${decimalPart}` : displayInt;
                    handleInputChange('targetAmount', displayValue);
                  }
                }}
                placeholder="0.00"
                placeholderTextColor="#C7C7CC"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Deadline</Text>
            <DateSelector
              value={formData.deadline}
              onChange={(dateString) => handleInputChange('deadline', dateString)}
            />
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Color</Text>
          <View style={styles.colorsGrid}>
            {(predefinedColors || [colors.primary]).map((c) => (
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


      </ScrollView>

      {/* Delete Plan Button */}
      <View style={styles.deleteContainer}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePlan}>
          <Icon name="trash" size={18} color="#fff" />
          <Text style={styles.deleteButtonText}>Delete Plan</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// DateSelector component copied from CreatePlanScreen
const DateSelector = ({ value, onChange }) => {
  const [date, setDate] = useState(() => {
    let initialDate = new Date();
    if (value && value.trim() !== '') {
      const parts = value.split('-');
      if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
        const parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
          initialDate = parsedDate;
        }
      }
    }
    return initialDate;
  });

  const onChangeInner = (_, selectedDate) => {
    if (selectedDate) {
      const currentDate = selectedDate;
      setDate(currentDate);
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
      const d = String(currentDate.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${d}`);
    }
  };

  return (
    <View>
      <DateTimePicker
        value={date}
        mode="date"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={onChangeInner}
        minimumDate={new Date()}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.background || '#ffffff',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text || '#111',
  },
  headerButton: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  content: {
    flex: 1,
    padding: 20,
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
    color: colors.text || '#111',
    marginBottom: 10,
  },
  inputContainer: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text || '#111',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text || '#111',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text || '#111',
    paddingHorizontal: 14,
  },
  amountInput: {
    flex: 1,
    borderWidth: 0,
    paddingLeft: 0,
  },
  inputHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
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
  // Delete Button Styles
  deleteContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Pagination Styles (copied from EditGestionPlanScreen)
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
    color: colors.text || '#333',
  },
  previewSection: {
    marginBottom: 16,
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
    marginBottom: 14,
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
  amountText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  progressBarWrapper: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  progressBarTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
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
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default EditPlanScreen;



