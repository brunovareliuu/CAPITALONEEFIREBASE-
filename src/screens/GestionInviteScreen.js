import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getOrCreatePlanInvite } from '../services/firestoreService';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';

const GestionInviteScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const planId = route?.params?.planId;
  const planTitle = route?.params?.planTitle || 'this plan';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!planId || !user?.uid) return;
      try {
        const res = await getOrCreatePlanInvite(planId, user.uid);
        if (mounted) setCode(res.code);
      } catch (e) {
        Alert.alert('Error', 'Could not generate an invitation code.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [planId, user?.uid]);

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Code Copied', 'The invitation code has been copied to your clipboard.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={16} color={'#333'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite Person</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <Icon name="link" size={40} color="#ccc" />
        <Text style={styles.title}>Share this code</Text>
        <Text style={styles.subtitle}>
          Anyone with this code will be able to join "{planTitle}".
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{code}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} disabled={loading || !code}>
          <Icon name="copy" size={16} color={'#fff'} />
          <Text style={styles.copyBtnText}>Copy Code</Text>
        </TouchableOpacity>
      </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  codeBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 25,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  codeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 2,
  },
  copyBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 14,
    gap: 12,
  },
  copyBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default GestionInviteScreen;
