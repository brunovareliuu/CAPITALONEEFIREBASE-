import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Clipboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import StandardHeader from '../components/StandardHeader';

const ReceiveMoneyScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { tarjetaDigital } = route.params || {};
  
  // CLABE is the account_number from tarjetaDigital (16 digits)
  // This is the same as numeroTarjeta or accountNumber field
  const clabeNumber = tarjetaDigital?.numeroTarjeta || 
                      tarjetaDigital?.accountNumber || 
                      tarjetaDigital?.account_number || 
                      '0000000000000000';
  
  console.log('📋 ReceiveMoneyScreen - tarjetaDigital:', tarjetaDigital);
  console.log('💳 CLABE Number:', clabeNumber);
  
  const userData = {
    name: user?.displayName || 'User Name',
    clabe: clabeNumber,
    depositCode: '5101258923268037',
    entity: 'Capital One Mexico',
  };

  const [showDetails, setShowDetails] = useState(false);

  const copyToClipboard = (text, label) => {
    Clipboard.setString(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const shareData = async () => {
    const accountText = isSavingsAccount
      ? `my ${accountDisplayName} (Savings Account)`
      : 'my account';

    const message = `Hello!

These are my details to deposit money to ${accountText}:

*Beneficiary:* ${userData.name}
*CLABE:* ${userData.clabe}
*Financial Entity:* ${userData.entity}

To deposit at stores like OXXO, Soriana, Kiosko, Chedraui, Farmacias del Ahorro and Waldo's without a card:
*Code:* ${userData.depositCode}`;

    try {
      await Share.share({
        message: message,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share data');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StandardHeader 
        onBack={() => navigation.goBack()}
      />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>
            {isSavingsAccount
              ? `Deposit money in your ${accountDisplayName}`
              : 'Receive deposits in your Capital One Debit Account'
            }
          </Text>
        </View>

        {/* CLABE Box */}
        <View style={styles.clabeContainer}>
          <View style={styles.clabeBox}>
            <View style={styles.clabeRow}>
              {/* Left Column - 80% width, 2 rows */}
              <View style={styles.clabeLeftColumn}>
                {/* Top Row - CLABE Label */}
                <View style={styles.clabeLabelRow}>
                  <Text style={styles.clabeLabel}>CLABE</Text>
                </View>
                {/* Bottom Row - CLABE Number */}
                <View style={styles.clabeNumberRow}>
                  <Text style={styles.clabeNumber}>{userData.clabe}</Text>
                </View>
              </View>

              {/* Right Column - 20% width, Copy & More buttons */}
              <View style={styles.clabeRightColumn}>
                <TouchableOpacity 
                  style={styles.copyButton}
                  onPress={() => copyToClipboard(userData.clabe, 'CLABE')}
                  activeOpacity={0.7}
                >
                  <Icon name="copy" size={20} color="#00487A" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.moreButton}
                  onPress={() => setShowDetails(!showDetails)}
                >
                  <Icon name="ellipsis-v" size={18} color="#00487A" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Details Section */}
        {showDetails && (
          <View style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>Your Details</Text>

            {/* Name */}
            <View style={styles.detailItem}>
              <View style={styles.detailLeft}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{userData.name}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => copyToClipboard(userData.name, 'Name')}
                style={styles.copyIconButton}
              >
                <Icon name="copy" size={18} color="#00487A" />
              </TouchableOpacity>
            </View>

            {/* CLABE */}
            <View style={styles.detailItem}>
              <View style={styles.detailLeft}>
                <Text style={styles.detailLabel}>CLABE</Text>
                <Text style={styles.detailValue}>{userData.clabe}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => copyToClipboard(userData.clabe, 'CLABE')}
                style={styles.copyIconButton}
              >
                <Icon name="copy" size={18} color="#00487A" />
              </TouchableOpacity>
            </View>

            {/* Deposit Code */}
            <View style={styles.detailItem}>
              <View style={styles.detailLeft}>
                <Text style={styles.detailLabel}>Deposits in Cash</Text>
                <Text style={styles.detailValue}>{userData.depositCode}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => copyToClipboard(userData.depositCode, 'Deposit Code')}
                style={styles.copyIconButton}
              >
                <Icon name="copy" size={18} color="#00487A" />
              </TouchableOpacity>
            </View>

            {/* Financial Entity */}
            <View style={styles.detailItem}>
              <View style={styles.detailLeft}>
                <Text style={styles.detailLabel}>Financial Entity</Text>
                <Text style={styles.detailValue}>{userData.entity}</Text>
              </View>
            </View>

            {/* Share Button */}
            <TouchableOpacity 
              style={styles.shareButton}
              onPress={shareData}
              activeOpacity={0.8}
            >
              <Icon name="share-alt" size={18} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Share Details</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Icon name="info-circle" size={16} color="#666" />
            <Text style={styles.infoText}>
              Use your CLABE for bank transfers
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="store" size={16} color="#666" />
            <Text style={styles.infoText}>
              Use your code for cash deposits at stores
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 36,
  },
  clabeContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  clabeBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  clabeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  clabeLeftColumn: {
    width: '80%',
    justifyContent: 'space-between',
  },
  clabeLabelRow: {
    justifyContent: 'flex-start',
    marginBottom: 4,
  },
  clabeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clabeNumberRow: {
    justifyContent: 'flex-start',
  },
  clabeNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00487A',
    letterSpacing: 1,
  },
  clabeRightColumn: {
    width: '20%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F4FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F4FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    marginHorizontal: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  detailLeft: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  copyIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F4FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00487A',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    flex: 1,
  },
});

export default ReceiveMoneyScreen;

