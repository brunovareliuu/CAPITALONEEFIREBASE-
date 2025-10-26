import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getCategories, updateEvent, deleteEvent } from '../services/firestoreService';

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

const EditEventScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { planId, event } = route.params; // event snapshot data
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    amount: '',
    description: event?.description || '',
    category: event?.category || '',
    recurrence: event?.recurrence || 'one-time',
    date: event?.date || new Date().toISOString().split('T')[0],
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [currency, setCurrency] = useState({ code: 'USD', icon: 'dollar-sign' });

  useEffect(() => {
    if (user) {
      getUserProfile(user.uid).then(profileSnap => {
        if (profileSnap.exists()) {
          const profile = profileSnap.data();
          if (profile.currency) {
            setCurrency(profile.currency);
          }
        }
      });
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = getCategories(user.uid, (userCategories) => setCategories(userCategories));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const absAmount = Math.abs(event?.amount || 0);
    setFormData((prev) => ({ ...prev, amount: formatAmountInput(String(Math.round(absAmount))) }));
  }, [event]);

  const handleSave = async () => {
    if (!formData.description || !formData.category) {
      Alert.alert('Error', 'Please complete description and category fields');
      return;
    }
    try {
      const cleanAmount = formData.amount ? formData.amount.replace(/,/g, '') : '0';
      const amount = parseFloat(cleanAmount);

      await updateEvent(user.uid, planId, event.id, {
        amount: amount,
        description: formData.description,
        category: formData.category,
        recurrence: formData.recurrence,
        date: formData.date,
      });
      Alert.alert('Saved', 'Event updated successfully', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not update the event');
    }
  };

  const onOpenDatePicker = () => {
    const current = formData.date ? new Date(formData.date) : new Date();
    setTempDate(current);
    setShowDatePicker(true);
  };

  const onConfirmDate = () => {
    const iso = tempDate.toISOString().split('T')[0];
    setFormData({ ...formData, date: iso });
    setShowDatePicker(false);
  };

  const onCancelDate = () => setShowDatePicker(false);

  const handleDelete = () => {
    Alert.alert('Delete', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteEvent(planId, event.id);
          navigation.goBack();
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Could not delete the transaction');
        }
      } }
    ]);
  };

  const CategoryButton = ({ category }) => (
    <TouchableOpacity
      style={[styles.categoryButton, { backgroundColor: category.color }, formData.category === category.id && styles.selectedCategory]}
      onPress={() => setFormData({ ...formData, category: category.id })}
    >
      <Icon name={category.icon} size={18} color="#fff" />
      <Text style={styles.categoryName}>{category.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={18} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Transaction</Text>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Icon name="trash" size={16} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amount</Text>
            <View style={styles.amountRow}>
              <Icon name={currency.icon || 'dollar-sign'} size={32} color="#333" style={{marginRight: 8}} />
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#999"
                value={formData.amount}
                onChangeText={(value) => setFormData({ ...formData, amount: formatAmountInput(value) })}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Description"
              placeholderTextColor="#999"
              value={formData.description}
              onChangeText={(v) => setFormData({ ...formData, description: v })}
              multiline
              maxLength={100}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.categoriesGrid}>
              {categories.map((c) => (
                <CategoryButton key={c.id} category={c} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Type</Text>
            <View style={styles.typeRow}>
              {['expense', 'income'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typePill, formData.type === t && styles.typePillActive]}
                  onPress={() => setFormData({ ...formData, type: t })}
                >
                  <Text style={[styles.typeText, formData.type === t && styles.typeTextActive]}>
                    {t === 'expense' ? 'Expense' : 'Income'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequency</Text>
            <View style={styles.recurrenceRow}>
              {[
                                  { key: 'one-time', label: 'One time' },
                                  { key: 'monthly', label: 'Monthly' },
                                  { key: 'bimonthly', label: 'Bimonthly' },
                                  { key: 'quarterly', label: 'Quarterly' },
                                  { key: 'semiannual', label: 'Semiannual' },
                                  { key: 'annual', label: 'Annual' }              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.recurrencePill, formData.recurrence === opt.key && styles.recurrencePillActive]}
                  onPress={() => setFormData({ ...formData, recurrence: opt.key })}
                >
                  <Text style={[styles.recurrenceText, formData.recurrence === opt.key && styles.recurrenceTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date</Text>
            <TouchableOpacity style={styles.dateButton} onPress={onOpenDatePicker}>
              <Icon name="calendar-alt" size={16} color="#007AFF" style={{ marginRight: 8 }} />
              <Text style={styles.dateButtonText}>{formData.date}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Icon name="save" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Date Picker Modal */}
      {Platform.OS === 'ios' ? (
        <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={onCancelDate}>
          <View style={[styles.modalOverlay, { justifyContent: 'flex-end' }]}> 
            <View style={[styles.modalContainer, { width: '100%', borderRadius: 0, borderTopLeftRadius: 16, borderTopRightRadius: 16 }] }>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select date</Text>
                <TouchableOpacity onPress={onCancelDate}>
                  <Icon name="times" size={18} color="#666" />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={(e, d) => setTempDate(d || tempDate)}
                style={{ backgroundColor: '#fff' }}
              />
              <TouchableOpacity style={styles.saveButton} onPress={onConfirmDate}>
                <Icon name="save" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="calendar"
            onChange={(e, d) => {
              if (d) {
                const iso = d.toISOString().split('T')[0];
                setFormData({ ...formData, date: iso });
              }
              setShowDatePicker(false);
            }}
          />
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  keyboardContainer: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  deleteButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 20 },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 10 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 32, fontWeight: 'bold', color: '#333', marginRight: 8 },
  amountInput: { fontSize: 36, fontWeight: 'bold', color: '#333', textAlign: 'left', minWidth: 200 },
  descriptionInput: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef', borderRadius: 12, padding: 15, fontSize: 16, color: '#333' },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryButton: { width: '48%', padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 10, opacity: 0.8 },
  selectedCategory: { opacity: 1, borderWidth: 3, borderColor: '#333' },
  categoryName: { color: '#fff', fontWeight: '600', fontSize: 14, marginTop: 8 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef' },
  typePillActive: { backgroundColor: '#E3F2FD', borderColor: '#007AFF' },
  typeText: { fontSize: 12, color: '#666', fontWeight: '500' },
  typeTextActive: { color: '#007AFF', fontWeight: '600' },
  recurrenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recurrencePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef' },
  recurrencePillActive: { backgroundColor: '#E3F2FD', borderColor: '#007AFF' },
  recurrenceText: { fontSize: 12, color: '#666', fontWeight: '500' },
  recurrenceTextActive: { color: '#007AFF', fontWeight: '600' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', borderRadius: 12, padding: 16, marginTop: 10, marginBottom: 30 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContainer: { backgroundColor: '#fff', padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
});

export default EditExpenseScreen;
