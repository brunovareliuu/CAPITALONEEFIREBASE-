import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../services/firestoreService';
import { getCustomerAccounts, getAccountTransfers } from '../services/nessieService';
import StandardHeader from '../components/StandardHeader';

const TransferHistoryScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, sent, received

  const loadTransfers = async () => {
    try {
      if (!user) return;

      // 1. Obtener datos del usuario (Firestore) - SOLO para obtener nessieCustomerId
      const userProfileDoc = await getUserProfile(user.uid);
      if (!userProfileDoc.exists()) {
        setTransfers([]);
        setLoading(false);
        return;
      }

      const userData = userProfileDoc.data();
      if (!userData || !userData.nessieCustomerId) {
        setTransfers([]);
        setLoading(false);
        return;
      }

      // 2. Obtener cuentas del usuario (Nessie API)
      const accounts = await getCustomerAccounts(userData.nessieCustomerId);
      if (accounts.length === 0) {
        setTransfers([]);
        setLoading(false);
        return;
      }

      // 3. Obtener transferencias de TODAS las cuentas del usuario (SOLO API)
      const allTransfersPromises = accounts.map(account =>
        getAccountTransfers(account._id)
      );

      const allTransfersArrays = await Promise.all(allTransfersPromises);
      
      // 4. Combinar y formatear todas las transferencias
      const allTransfers = allTransfersArrays
        .flat()
        .map((transfer, index) => ({
          id: transfer._id || `transfer-${index}`,
          ...transfer
        }))
        .sort((a, b) => {
          // Ordenar por fecha (más reciente primero)
          const dateA = new Date(a.transaction_date || 0);
          const dateB = new Date(b.transaction_date || 0);
          return dateB - dateA;
        });

      setTransfers(allTransfers);
      setLoading(false);
    } catch (error) {
      console.error('Error loading transfers:', error);
      setTransfers([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransfers();
    setRefreshing(false);
  };

  const filteredTransfers = transfers.filter((transfer) => {
    if (filter === 'all') return true;
    // Since we only save transfers for the sender, all are "sent"
    return true;
  });

  const renderTransferItem = ({ item }) => {
    const date = item.transaction_date
      ? new Date(item.transaction_date)
      : new Date();

    // Determinar si es enviado o recibido
    // En el API de Nessie, el tipo 'p2p' siempre es enviado desde la cuenta consultada
    const isSent = item.type === 'p2p';

    // Obtener el nickname correcto
    // Si payer_id está definido, usamos ese sistema
    // Si no, usamos una descripción genérica
    const otherPartyName = isSent 
      ? (item.payee_id || 'Unknown') 
      : (item.payer_id || 'Unknown');

    return (
      <TouchableOpacity style={styles.transferItem} activeOpacity={0.7}>
        <View style={styles.transferIconContainer}>
          <View style={[styles.transferIcon, isSent ? styles.transferIconSent : styles.transferIconReceived]}>
            <Icon
              name={isSent ? 'arrow-up' : 'arrow-down'}
              size={16}
              color={isSent ? '#FF3B30' : '#34C759'}
            />
          </View>
        </View>

        <View style={styles.transferContent}>
          <Text style={styles.transferTitle}>
            {isSent ? 'Sent to' : 'Received from'} {otherPartyName}
          </Text>
          <View style={styles.transferMeta}>
            <Text style={styles.transferDate}>
              {date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            {item.status && (
              <View style={[styles.statusBadge, item.status === 'completed' && styles.statusBadgeCompleted]}>
                <Text style={styles.statusText}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            )}
          </View>
          {item.description && (
            <Text style={styles.transferDescription}>{item.description}</Text>
          )}
        </View>

        <View style={styles.transferRight}>
          <Text style={[styles.transferAmount, isSent ? styles.transferAmountSent : styles.transferAmountReceived]}>
            {isSent ? '-' : '+'}${item.amount?.toFixed(2) || '0.00'}
          </Text>
          <Text style={styles.transferMedium}>{item.medium || 'balance'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="exchange-alt" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Transfers Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your transfer history will appear here
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate('Transfer')}
        activeOpacity={0.8}
      >
        <Icon name="paper-plane" size={16} color="#fff" />
        <Text style={styles.emptyButtonText}>Make a Transfer</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StandardHeader title="Transfer History" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StandardHeader
        title="Transfer History"
        onBack={() => navigation.goBack()}
        rightComponent={(
          <TouchableOpacity onPress={() => navigation.navigate('TransferContactSearch')}>
            <Icon name="plus" size={20} color="#007AFF" />
          </TouchableOpacity>
        )}
      />

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filteredTransfers}
        renderItem={renderTransferItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredTransfers.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#d1d1d6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#d1d1d6',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
  },
  listContentEmpty: {
    flex: 1,
  },
  transferItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  transferIconContainer: {
    marginRight: 12,
  },
  transferIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferIconSent: {
    backgroundColor: '#FFEBEE',
  },
  transferIconReceived: {
    backgroundColor: '#E8F5E8',
  },
  transferContent: {
    flex: 1,
  },
  transferTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  transferMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transferDate: {
    fontSize: 12,
    color: '#999',
  },
  transferDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#FFF3E0',
  },
  statusBadgeCompleted: {
    backgroundColor: '#E8F5E8',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  transferRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  transferAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  transferAmountSent: {
    color: '#FF3B30',
  },
  transferAmountReceived: {
    color: '#34C759',
  },
  transferMedium: {
    fontSize: 12,
    color: '#999',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default TransferHistoryScreen;

