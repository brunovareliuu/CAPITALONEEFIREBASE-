import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';

const TransferConfirmationScreen = ({ navigation, route }) => {
  const { transfer, previousBalance, updatedPayerBalance, amount, contact, tarjetaDigital } = route.params;
  const [checkmarkScale] = useState(new Animated.Value(0));
  const [checkmarkRotate] = useState(new Animated.Value(0));
  const [isSharing, setIsSharing] = useState(false);
  const receiptRef = useRef(null);

  // Ya recibimos previousBalance directamente desde TransferScreen
  // previousBalance = balance ANTES de la transferencia
  // updatedPayerBalance = balance DESPUÉS de la transferencia
  // contact = datos del contacto (si viene del nuevo flujo)

  useEffect(() => {
    // Animate checkmark
    Animated.parallel([
      Animated.spring(checkmarkScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(checkmarkRotate, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rotation = checkmarkRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleShareReceipt = async () => {
    try {
      setIsSharing(true);
      
      // Capture the receipt as an image
      const uri = await captureRef(receiptRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      // Share the image
      const shareResult = await Share.share({
        message: `Transfer Receipt - Capital One\n\nAmount: $${amount.toFixed(2)}\nTo: ${contact ? contact.contactName : transfer.payeeAccount.nickname}\nDate: ${new Date().toLocaleDateString('en-US')}`,
        url: uri,
        title: 'Transfer Receipt',
      });

      if (shareResult.action === Share.sharedAction) {
        if (shareResult.activityType) {
          console.log('Shared via', shareResult.activityType);
        } else {
          console.log('Shared successfully');
        }
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert(
        'Error',
        'Failed to share receipt. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Receipt Container - This is what will be captured as image */}
        <View ref={receiptRef} style={styles.receiptContainer}>
          <View style={styles.content}>
            {/* Success Icon */}
            <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  { scale: checkmarkScale },
                  { rotate: rotation },
                ],
              },
            ]}
          >
            <View style={styles.iconCircle}>
              <Icon name="check" size={48} color="#fff" />
            </View>
          </Animated.View>

          {/* Success Message */}
          <Text style={styles.title}>Transfer Successful!</Text>
          <Text style={styles.subtitle}>
            Your money has been sent successfully
          </Text>

          {/* Transfer Details Card */}
          <View style={styles.detailsCard}>
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Amount Sent</Text>
              <Text style={styles.amount}>${amount.toFixed(2)}</Text>
            </View>

            <View style={styles.divider} />

            {/* From Account */}
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Icon name="arrow-up" size={16} color="#FF3B30" />
                <Text style={styles.detailLabel}>From</Text>
              </View>
              <View style={styles.detailRight}>
                <Text style={styles.detailValue}>{transfer.payerAccount.nickname}</Text>
                {updatedPayerBalance !== null && previousBalance !== null && (
                  <View>
                    <Text style={styles.balanceTextSmall}>
                      Previous: ${previousBalance.toFixed(2)}
                    </Text>
                    <Text style={styles.balanceText}>
                      New balance: ${updatedPayerBalance.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

          {/* To Account - NO mostrar balance por seguridad */}
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Icon name="arrow-down" size={16} color="#34C759" />
              <Text style={styles.detailLabel}>To</Text>
            </View>
            <View style={styles.detailRight}>
              <Text style={styles.detailValue}>
                {contact ? contact.contactName : transfer.payeeAccount.nickname}
              </Text>
              {contact && contact.contactAlias && (
                <Text style={styles.detailSubValue}>({contact.contactAlias})</Text>
              )}
            </View>
          </View>

          {/* Transfer ID */}
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Icon name="hashtag" size={16} color="#666" />
              <Text style={styles.detailLabel}>Transfer ID</Text>
            </View>
            <Text style={styles.detailValueSmall}>{transfer.transferId}</Text>
          </View>

          {/* Date */}
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Icon name="calendar" size={16} color="#666" />
              <Text style={styles.detailLabel}>Date</Text>
            </View>
            <Text style={styles.detailValue}>
              {new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Status */}
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Icon name="info-circle" size={16} color="#666" />
              <Text style={styles.detailLabel}>Status</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Completed</Text>
            </View>
          </View>
          </View>
        </View>

        {/* Actions - Outside of receipt capture */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              // Navegar al Tab Navigator y luego a Home
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main', state: { routes: [{ name: 'Home' }] } }],
              });
            }}
            activeOpacity={0.8}
          >
            <Icon name="home" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Go to Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleShareReceipt}
            activeOpacity={0.8}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Icon name="share-alt" size={18} color="#007AFF" />
            )}
            <Text style={styles.secondaryButtonText}>
              {isSharing ? 'Preparing...' : 'Share Receipt'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={() => navigation.navigate('TransferHistory', { 
              refresh: Date.now() // Forzar recarga con timestamp
            })}
            activeOpacity={0.8}
          >
            <Icon name="history" size={16} color="#666" style={{ marginRight: 6 }} />
            <Text style={styles.textButtonText}>View Transfer History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  receiptContainer: {
    backgroundColor: '#f8f9fa',
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  amountContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  amount: {
    fontSize: 40,
    fontWeight: '700',
    color: '#007AFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailRight: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 16,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    textAlign: 'right',
  },
  detailSubValue: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
    textAlign: 'right',
    marginTop: 2,
  },
  detailValueSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1a1a1a',
    fontFamily: 'monospace',
  },
  balanceTextSmall: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  textButton: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  textButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
});

export default TransferConfirmationScreen;

