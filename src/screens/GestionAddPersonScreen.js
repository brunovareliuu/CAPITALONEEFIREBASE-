import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { addPlanPerson, getPlanPeople } from '../services/firestoreService';

const palette = ['#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', '#5856D6', '#FF3B30', '#0A84FF'];

const GestionAddPersonScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const planId = route?.params?.planId;

  const [name, setName] = useState('');
  const [color, setColor] = useState(palette[0]);
  const [loading, setLoading] = useState(false);
  const [existingColors, setExistingColors] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!planId) return;
    const unsub = getPlanPeople(planId, (list) => {
      const used = list.map((p) => p.color).filter(Boolean);
      setExistingColors(used);
      const firstFree = palette.find((c) => !used.includes(c)) || palette[0];
      setColor((prev) => used.includes(prev) ? firstFree : prev);
    });
    return () => { unsub && unsub(); };
  }, [planId]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a name for the person.');
      return;
    }
    if (existingColors.includes(color)) {
      const firstFree = palette.find((c) => !existingColors.includes(c)) || color;
      setColor(firstFree);
    }
    setLoading(true);
    try {
      await addPlanPerson(planId, { name: name.trim(), userId: null, color });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not add the person. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { inputRef.current && inputRef.current.focus && inputRef.current.focus(); }, 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={16} color={'#333'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Person</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.contentLayout}>
        <View style={styles.form}>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Person's Name</Text>
                <TextInput 
                    ref={inputRef}
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    onSubmitEditing={handleSave}
                    returnKeyType="done"
                    placeholder="e.g., John Doe"
                    placeholderTextColor="#999"
                    autoFocus
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Choose a Color</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScrollView}>
                {palette.map(c => (
                    <TouchableOpacity 
                        key={c} 
                        style={[
                          styles.colorDot,
                          { backgroundColor: c },
                          color === c && styles.colorDotActive,
                          existingColors.includes(c) && styles.colorDotDisabled
                        ]}
                        onPress={() => { if (!existingColors.includes(c)) setColor(c); }}
                        disabled={existingColors.includes(c)}
                    />
                ))}
                </ScrollView>
            </View>
        </View>

        <View style={styles.footer}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save Person'}</Text>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  contentContainer: { flex: 1 },
  contentLayout: { flexGrow: 1, justifyContent: 'space-between' },
  form: { padding: 20 },
  inputGroup: { marginBottom: 25 },
  label: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#444', 
    marginBottom: 10 
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 12, 
    paddingHorizontal: 15, 
    paddingVertical: 15, 
    backgroundColor: '#fff', 
    fontSize: 16
  },
  colorScrollView: { paddingVertical: 5 },
  colorDot: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    marginRight: 15, 
    borderWidth: 3, 
    borderColor: 'transparent' 
  },
  colorDotActive: { 
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  colorDotDisabled: {
    opacity: 0.4,
  },
  footer: {
    padding: 20,
    paddingBottom: 30,
  },
  saveBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
});

export default GestionAddPersonScreen;
