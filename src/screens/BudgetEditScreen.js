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
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { updateBudget } from '../services/firestoreService';

const BudgetEditScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { budget } = route.params;

  const [formData, setFormData] = useState({
    name: budget?.categoryName || '',
    targetAmount: budget?.targetAmount?.toString() || '',
    frequency: budget?.frequency || 'monthly',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.targetAmount) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const targetAmount = parseFloat(formData.targetAmount.replace(/,/g, ''));
    if (isNaN(targetAmount) || targetAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid target amount');
      return;
    }

    setSaving(true);
    try {
      await updateBudget(budget.id, {
        categoryName: formData.name.trim(),
        targetAmount,
        frequency: formData.frequency,
        updatedAt: new Date(),
      });

      Alert.alert('Success', 'Budget updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error updating budget:', error);
      Alert.alert('Error', 'Could not update budget');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Budget</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.formSection}>
            <Text style={styles.inputLabel}>Budget Name</Text>
            <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(val) => setFormData(prev => ({...prev, name: val}))}
                placeholder="Enter budget name"
                placeholderTextColor="#999"
            />

            <Text style={styles.inputLabel}>Target Amount</Text>
            <TextInput
                style={styles.textInput}
                value={formData.targetAmount}
                onChangeText={(text) => setFormData(prev => ({...prev, targetAmount: text.replace(/[^0-9.,]/g, '')}))}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
            />

            <Text style={styles.inputLabel}>Frequency</Text>
            <View style={styles.frequencyContainer}>
                {['weekly', 'monthly', 'yearly'].map((freq) => (
                <TouchableOpacity
                    key={freq}
                    style={[
                    styles.frequencyOption,
                    formData.frequency === freq && styles.frequencyOptionActive
                    ]}
                    onPress={() => setFormData(prev => ({...prev, frequency: freq}))}
                >
                    <Text style={[
                    styles.frequencyText,
                    formData.frequency === freq && styles.frequencyTextActive
                    ]}>
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                </TouchableOpacity>
                ))}
            </View>
            </View>
        </ScrollView>

        <View style={styles.footer}>
            <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
            >
            {saving ? (
                <ActivityIndicator size="small" color="#fff" />
            ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
            </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
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
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
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
    content: {
        flex: 1,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
    },
    formSection: {
        padding: 20,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
        marginTop: 16,
    },
    textInput: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        color: '#333',
    },
    frequencyContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    frequencyOption: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
        alignItems: 'center',
    },
    frequencyOptionActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    frequencyText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    frequencyTextActive: {
        color: '#fff',
    },
    saveButton: {
        backgroundColor: colors.primary,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default BudgetEditScreen;