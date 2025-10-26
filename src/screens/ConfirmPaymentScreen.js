import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { settlePayment, getUserProfile } from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';

const ConfirmPaymentScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { settlement, planId } = route.params;
  const { user } = useAuth();
  const [currencyIcon, setCurrencyIcon] = useState(null);

  useEffect(() => {
    if (user) {
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
    }
  }, [user]);

  const handleConfirm = async () => {
    try {
      await settlePayment(planId, settlement.from, settlement.to, settlement.amount);
      Alert.alert('Payment Confirmed', `You have confirmed the payment from ${settlement.from.name} to ${settlement.to.name}.`);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'There was an error confirming the payment.');
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Payment</Text>
        <View style={{width: 36}} />
      </View>
      <View style={styles.content}>
        <Text style={styles.confirmationText}>
          Are you sure you want to confirm that <Text style={{fontWeight: 'bold'}}>{settlement.from.name}</Text> has paid <Text style={{fontWeight: 'bold'}}>{settlement.to.name}</Text> an amount of <Text style={{fontWeight: 'bold'}}>{currencyIcon && <Icon name={currencyIcon} size={18} />} {settlement.amount.toFixed(2)}</Text>?
        </Text>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Confirm Payment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  content: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  confirmationText: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ConfirmPaymentScreen;
