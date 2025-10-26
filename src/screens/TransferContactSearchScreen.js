import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getUserContacts, searchContactsByQuery, getContactByCLABE } from '../services/firestoreService';
import { validateAccountExists, getAccountById } from '../services/nessieService';
import StandardHeader from '../components/StandardHeader';
import { useFocusEffect } from '@react-navigation/native';

const TransferContactSearchScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { tarjetaDigital } = route.params || {};
  const [currentCard, setCurrentCard] = useState(tarjetaDigital || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allContacts, setAllContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isValidatingCLABE, setIsValidatingCLABE] = useState(false);
  const [clabeValidation, setClabeValidation] = useState(null); // { valid: true/false, nessieAccountId: '...' }

  // Refresh debit account balance when screen focuses
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const refreshBalance = async () => {
        try {
          if (tarjetaDigital?.nessieAccountId) {
            const accountData = await getAccountById(tarjetaDigital.nessieAccountId);
            if (isActive) {
              setCurrentCard({ ...tarjetaDigital, saldo: accountData.balance, balance: accountData.balance });
            }
          }
        } catch (err) {
          // keep previous value on failure
        }
      };
      refreshBalance();
      return () => { isActive = false; };
    }, [tarjetaDigital?.nessieAccountId])
  );

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = getUserContacts(user.uid, (contacts) => {
      setAllContacts(contacts);
      setFilteredContacts(contacts);
      setRecentContacts(contacts.slice(0, 5));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    const filtered = searchContactsByQuery(allContacts, searchQuery);
    setFilteredContacts(filtered);

    // Check if search query is a potential CLABE (only numbers, 16 digits)
    const cleanedQuery = searchQuery.replace(/\s/g, '');
    if (/^\d{16}$/.test(cleanedQuery)) {
      validateCLABE(cleanedQuery);
    } else {
      setClabeValidation(null);
    }
  }, [searchQuery, allContacts]);

  const validateCLABE = async (clabe) => {
    setIsValidatingCLABE(true);
    setClabeValidation(null);

    try {
      // Check if contact already exists
      const existingContact = await getContactByCLABE(user.uid, clabe);
      if (existingContact) {
        setClabeValidation({ 
          valid: false, 
          error: 'Contact already exists',
          existingContact 
        });
        setIsValidatingCLABE(false);
        return;
      }

      // Validate against Nessie API
      const validation = await validateAccountExists(clabe);
      
      if (validation.exists) {
        setClabeValidation({ 
          valid: true, 
          nessieAccountId: validation.accountData.id,
          clabe: clabe
        });
      } else {
        setClabeValidation({ 
          valid: false, 
          error: 'Account not found' 
        });
      }
    } catch (error) {
      console.error('CLABE validation error:', error);
      setClabeValidation({ 
        valid: false, 
        error: 'Could not validate account' 
      });
    } finally {
      setIsValidatingCLABE(false);
    }
  };

  const handleCreateContact = () => {
    if (clabeValidation?.valid) {
      Keyboard.dismiss();
      navigation.navigate('TransferAddContact', { 
        tarjetaDigital,
        prefilledCLABE: clabeValidation.clabe,
        prefilledNessieAccountId: clabeValidation.nessieAccountId
      });
    }
  };

  const handleSelectContact = (contact) => {
    navigation.navigate('TransferAmount', { contact, tarjetaDigital: currentCard || tarjetaDigital });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const renderContactItem = ({ item }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleSelectContact(item)}
      activeOpacity={0.7}
    >
      <View style={styles.contactAvatar}>
        <Text style={styles.contactInitials}>{getInitials(item.contactName)}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.contactName}</Text>
        <Text style={styles.contactDetails}>
          {item.contactAlias ? `${item.contactAlias} • ` : ''}
          •••• {item.contactCLABE.slice(-4)}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color="#999" />
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="address-book" size={64} color="#CCCCCC" />
      <Text style={styles.emptyTitle}>No contacts yet</Text>
      <Text style={styles.emptySubtitle}>
        Add a contact to start transferring money
      </Text>
      <TouchableOpacity
        style={styles.addContactButton}
        onPress={() => navigation.navigate('TransferAddContact', { tarjetaDigital: currentCard || tarjetaDigital })}
        activeOpacity={0.8}
      >
        <Icon name="plus" size={18} color="#FFFFFF" />
        <Text style={styles.addContactButtonText}>Add Contact</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StandardHeader 
        onBack={() => navigation.goBack()}
      />

      {/* Title */}
      <View style={styles.titleSection}>
        <Text style={styles.title}>Who do you want to send money to?</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Name, CLABE, card or phone"
            placeholderTextColor="#999"
            autoCapitalize="none"
            keyboardType="default"
          />
          {isValidatingCLABE && (
            <ActivityIndicator size="small" color="#00487A" />
          )}
          {!isValidatingCLABE && clabeValidation?.valid && (
            <Icon name="check-circle" size={20} color="#34C759" />
          )}
          {!isValidatingCLABE && clabeValidation?.error && (
            <Icon name="exclamation-circle" size={20} color="#F12D23" />
          )}
          {!isValidatingCLABE && !clabeValidation && searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="times-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* CLABE Validation Message */}
        {clabeValidation?.valid && (
          <TouchableOpacity 
            style={styles.createContactBanner}
            onPress={handleCreateContact}
            activeOpacity={0.8}
          >
            <View style={styles.createContactLeft}>
              <View style={styles.createContactIcon}>
                <Icon name="user-plus" size={18} color="#00487A" />
              </View>
              <View style={styles.createContactTextContainer}>
                <Text style={styles.createContactTitle}>Create new contact</Text>
                <Text style={styles.createContactSubtitle}>
                  Account ••••{clabeValidation.clabe.slice(-4)}
                </Text>
              </View>
            </View>
            <Icon name="arrow-right" size={18} color="#00487A" />
          </TouchableOpacity>
        )}

        {/* CLABE Validation Error */}
        {clabeValidation?.error && (
          <View style={styles.errorBanner}>
            <Icon name="info-circle" size={16} color="#F12D23" />
            <Text style={styles.errorBannerText}>{clabeValidation.error}</Text>
          </View>
        )}

        {/* Helper Text */}
        {!clabeValidation && searchQuery.length === 0 && (
          <Text style={styles.helperText}>
            You can create a new contact with their CLABE, card or phone and search contacts by name.
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00487A" />
        </View>
      ) : allContacts.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContactItem}
          ListHeaderComponent={
            searchQuery === '' && recentContacts.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent</Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button */}
      {!loading && allContacts.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('TransferAddContact', { tarjetaDigital: currentCard || tarjetaDigital })}
          activeOpacity={0.9}
        >
          <Icon name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
    paddingTop: 10,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 36,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  createContactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F4FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#00487A',
  },
  createContactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  createContactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  createContactTextContainer: {
    flex: 1,
  },
  createContactTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#00487A',
    marginBottom: 2,
  },
  createContactSubtitle: {
    fontSize: 13,
    color: '#00487A',
    opacity: 0.7,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#F12D23',
    flex: 1,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F4FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00487A',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  contactDetails: {
    fontSize: 13,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  addContactButton: {
    flexDirection: 'row',
    backgroundColor: '#00487A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  addContactButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00487A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default TransferContactSearchScreen;

