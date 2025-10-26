import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { joinPlanByInvite } from '../services/firestoreService';

const JoinPlanScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const inviteCodeFromParams = route?.params?.code;

  const [inviteCode, setInviteCode] = useState(inviteCodeFromParams || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (inviteCodeFromParams) {
      handleJoin(inviteCodeFromParams);
    }
  }, [inviteCodeFromParams]);

  const handleJoin = async (codeToJoin) => {
    const code = (codeToJoin || inviteCode).trim().toUpperCase();
    if (!code) {
      Alert.alert('Error', 'Please enter an invite code.');
      return;
    }

    setLoading(true);
    try {
      const { planId } = await joinPlanByInvite(user.uid, code);
      navigation.replace('JoinPlanColor', { planId });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e.message || 'Could not join the plan. Please check the code.');
      // If the user came from a deep link and it failed, maybe we should let them go back
      if (inviteCodeFromParams) {
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && inviteCodeFromParams) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Joining plan...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={18} color="#666" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join a Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Invite Code</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., A1B2C3"
          placeholderTextColor="#999"
          autoCapitalize="characters"
          value={inviteCode}
          onChangeText={setInviteCode}
          editable={!loading}
        />

        <TouchableOpacity style={styles.joinButton} onPress={() => handleJoin()} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="sign-in-alt" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.joinButtonText}>Join</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  content: { paddingHorizontal: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    minHeight: 50,
  },
  joinButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default JoinPlanScreen;
