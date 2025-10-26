import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../styles/colors';
import { getOrCreatePlanInvite, getPlanInviteCode } from '../services/firestoreService';
import SvgQRCode from 'react-native-qrcode-svg';
import logo from '../../assets/logo.png';

const PlanInviteCodeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const planId = route?.params?.planId;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // intentar leer código ya existente; si no existe y somos dueños, getOrCreate lo creará
        const existing = await getPlanInviteCode(planId);
        if (existing?.code) {
          if (mounted) setCode(existing.code);
        } else {
          const res = await getOrCreatePlanInvite(planId, user?.uid);
          if (mounted) setCode(res.code);
        }
      } catch (e) {
        Alert.alert('Error', 'No se pudo obtener el código de invitación');
        navigation.goBack();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [planId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Código de invitación</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeText}>{code}</Text>
      </View>
      <View style={{ marginVertical: 16 }}>
        <SvgQRCode value={`nichtarm://invite/${code}`} size={160} logo={logo} logoSize={36} logoBackgroundColor='transparent' />
      </View>
      <TouchableOpacity style={styles.copyBtn} onPress={() => Clipboard.setStringAsync(code)}>
        <Icon name="copy" size={16} color="#fff" />
        <Text style={styles.copyText}>Copiar código</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.closeText}>Cerrar</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 },
  codeBox: { borderWidth: 2, borderColor: colors.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 24, marginBottom: 16 },
  codeText: { fontSize: 24, fontWeight: '900', letterSpacing: 2, color: colors.primary },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  copyText: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  closeBtn: { marginTop: 16 },
  closeText: { color: colors.primary, fontWeight: '700' },
});

export default PlanInviteCodeScreen;
