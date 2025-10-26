import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { getPlans } from '../services/firestoreService';
import { Modal, Pressable } from 'react-native';

const PlansScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFab, setShowFab] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = getPlans(user.uid, (list) => {
      setPlans(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const renderPlanItem = ({ item }) => {
    const isSavings = item.kind === 'savings';
    const current = Number(item?.currentAmount || 0);
    const target = Number(item?.targetAmount || 0);
    const hasTarget = isSavings && target > 0;
    const progress = hasTarget ? Math.min(100, (current / target) * 100) : 0;
    const bgColor = item.color || colors.cardColors.blue;
    const textPrimary = '#ffffff';
    const textSecondary = 'rgba(255,255,255,0.85)';

    return (
      <TouchableOpacity
        style={[styles.planCard, { backgroundColor: bgColor }]}
        onPress={() => {
          if (item.kind === 'gestion') {
            navigation.navigate('DetailsGestionPlans', { planId: item.id });
          } else {
            navigation.navigate('DetailsPlansScreen', { planId: item.id });
          }
        }}
        activeOpacity={0.9}
      >
        <View style={styles.planHeader}>
          <View style={styles.planHeaderLeft}>
            <View style={styles.iconPill}>
              <Icon name={item.icon || 'bullseye'} size={16} color={textPrimary} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.planTitle, { color: textPrimary }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.planSubtitle, { color: textSecondary }]} numberOfLines={1}>
                {item.description}
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={14} color={textSecondary} />
        </View>

        <View>
          {hasTarget ? (
            <>
              <Text style={[styles.amountText, { color: textPrimary }]}>
                ${current.toLocaleString()} / ${target.toLocaleString()}
              </Text>
              <View style={styles.progressBarWrapper}>
                <View style={[styles.progressBarTrack, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
                <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: '#fff' }]} />
              </View>
            </>
          ) : null}

          <View style={styles.planFooter}>
            {item.kind === 'savings' && item.deadline ? (
              <View style={styles.deadlineRow}>
                <Icon name="calendar" size={12} color={textSecondary} />
                <Text style={[styles.deadlineText, { color: textSecondary }]}>{item.deadline}</Text>
              </View>
            ) : item.kind === 'gestion' ? (
              <View style={styles.deadlineRow}>
                <Icon name="tasks" size={12} color={textSecondary} />
                <Text style={[styles.deadlineText, { color: textSecondary }]}>
                  {(item.distribution || 'equitable') === 'equitable' ? 'Equitable' : 'Custom'}
                </Text>
              </View>
            ) : <View />}

            {hasTarget ? (
              <Text style={[styles.progressPercentage, { color: textPrimary }]}>{progress.toFixed(0)}%</Text>
            ) : <View />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Plans</Text>
      </View>

      {plans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Icon name="bullseye" size={48} color="#666" />
            <Text style={styles.emptyTitle}>No plans yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first plan or join a shared plan
            </Text>
            
            <View style={styles.emptyButtons}>
              <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
                <Icon name="plus" size={16} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.createButtonText}>Create Plan</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.joinButton} onPress={() => navigation.navigate('JoinPlan')}>
                <Icon name="users" size={16} color={colors.primary} style={styles.buttonIcon} />
                <Text style={styles.joinButtonText}>Join Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={plans}
          renderItem={renderPlanItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setShowFab(false)}
          onScrollEndDrag={() => setShowFab(true)}
        />
      )}

      {/* Floating Action Button */}
      {plans.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}
        >
          <Icon name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={showCreateModal}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Plan</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowCreateModal(false)}>
                <Icon name="times" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={() => { setShowCreateModal(false); navigation.navigate('CreatePlan', { kind: 'savings' }); }}
              >
                <Icon name="piggy-bank" size={18} color="#fff" />
                <Text style={styles.modalPrimaryButtonText}>Savings Plan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => { setShowCreateModal(false); navigation.navigate('CreateGestionPlan'); }}
              >
                <Icon name="tasks" size={18} color="#007AFF" />
                <Text style={styles.modalSecondaryButtonText}>Management Plan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => { setShowCreateModal(false); navigation.navigate('JoinPlan'); }}
              >
                <Icon name="sign-in-alt" size={18} color="#007AFF" />
                <Text style={styles.modalSecondaryButtonText}>Join a Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  planCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  planHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  planSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  progressBarWrapper: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  progressBarTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  planFooter: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deadlineText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  emptyButtons: {
    width: '100%',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  joinButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtons: {
    gap: 12,
  },
  modalPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
    gap: 10,
  },
  modalSecondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default PlansScreen;
