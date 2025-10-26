import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getPlanPeople, upsertPlanPersonByUserId } from '../services/firestoreService';

const palette = Object.values(colors.cardColors);

const JoinPlanColorScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const planId = route?.params?.planId;

  const [people, setPeople] = useState([]);
  const [selectedColor, setSelectedColor] = useState(palette[0]);

  useEffect(() => {
    if (!planId) return;
    const unsub = getPlanPeople(planId, (list) => {
      setPeople(list || []);
    });
    return () => { unsub && unsub(); };
  }, [planId]);

  const usedColors = useMemo(() => people.map(p => p.color).filter(Boolean), [people]);
  const freeColors = useMemo(() => palette.filter(c => !usedColors.includes(c)), [usedColors]);

  useEffect(() => {
    if (freeColors.length > 0) setSelectedColor(freeColors[0]);
  }, [freeColors.length]);

  const handleConfirm = async () => {
    try {
      await upsertPlanPersonByUserId(planId, user.uid, { name: user.displayName || 'You', color: selectedColor });
      navigation.replace('DetailsGestionPlans', { planId });
    } catch (e) {
      Alert.alert('Error', 'Could not save your color');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose your color</Text>
      <Text style={styles.subtitle}>This color will identify you in the plan</Text>
      <View style={styles.grid}>
        {palette.map((c) => {
          const disabled = usedColors.includes(c);
          const selected = selectedColor === c;
          return (
            <TouchableOpacity
              key={c}
              disabled={disabled}
              onPress={() => setSelectedColor(c)}
              style={[styles.colorButton, { backgroundColor: c }, disabled && styles.colorButtonDisabled, selected && styles.colorButtonSelected]}
            >
              {selected && !disabled ? <Icon name="check" size={16} color="#fff" /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={[styles.confirmBtn, freeColors.length === 0 && { opacity: 0.5 }]} onPress={handleConfirm} disabled={freeColors.length === 0}>
        <Text style={styles.confirmText}>Confirm</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 10 },
  colorButton: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'transparent' },
  colorButtonSelected: { borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 4 },
  colorButtonDisabled: { opacity: 0.35 },
  confirmBtn: { marginTop: 24, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '700' },
});

export default JoinPlanColorScreen;
