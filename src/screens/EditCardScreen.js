import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
  Animated,
  Easing,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCardById, updateCard, deleteCard, getParticipants, regenerateShareCode, upsertShareCode, removeShareCode, deleteParticipant, leaveSharedCard, getExpenses } from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';

const DateSelector = ({ value, onChange }) => {
  const [date, setDate] = useState(() => {
    if (value && new Date(value).toString() !== 'Invalid Date') {
      const parts = value.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    return new Date();
  });

  const [show, setShow] = useState(true);

  const onChangeInner = (_, selectedDate) => {
    const currentDate = selectedDate || date;
    setDate(currentDate);
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(currentDate.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
  };

  return (
    <View>
      <DateTimePicker
        value={date}
        mode="date"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={onChangeInner}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
};

const CardPreview = ({ name, type, color, goalAmount, deadline, balance }) => {
    const textPrimary = '#fff';
    const textSecondary = 'rgba(255,255,255,0.85)';
    const bg = color;
    
    const getCardIcon = (type) => {
        switch(type) {
          case 'cash': return 'money-bill-wave';
          case 'credit': return 'credit-card';
          case 'debit': return 'credit-card';
          case 'savings': return 'piggy-bank';
          default: return 'credit-card';
        }
    };

    const getCardTypeLabel = (type) => {
        switch(type) {
          case 'cash': return 'CASH';
          case 'credit': return 'CREDIT';
          case 'debit': return 'DEBIT';
          case 'savings': return 'SAVINGS';
          default: return 'CARD';
        }
    };

    const icon = getCardIcon(type);
    const typeLabel = getCardTypeLabel(type);

    const isSavings = type === 'savings';

    const balanceToShow = useMemo(() => {
      if (isSavings) return null; // Savings shows progress, not balance
      const num = parseFloat(balance);
      return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, [balance, isSavings]);

    const progress = useMemo(() => {
        if (!isSavings) return { pct: 0, current: 0, goal: 0 };
        const goal = parseFloat(goalAmount || '0');
        const current = 0;
        const pct = goal > 0 ? Math.round((current / goal) * 100) : 0;
        return { pct, current, goal };
    }, [goalAmount, isSavings]);

    return (
      <View style={[styles.previewCard, { backgroundColor: bg }]}>
        <View style={styles.previewHeader}>
          <View style={styles.previewHeaderLeft}>
            <View style={styles.previewIconPill}>
              <Icon name={icon} size={18} color={textPrimary} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.previewTitle, { color: textPrimary }]} numberOfLines={1}>
                {name || 'Card Name'}
              </Text>
              <Text style={[styles.previewSubtitle, { color: textSecondary }]} numberOfLines={1}>
                {typeLabel}
              </Text>
            </View>
          </View>
        </View>

        {isSavings ? (
          <View>
            <Text style={[styles.previewAmountText, { color: textPrimary }]}>
              {`${progress.current.toLocaleString()} / ${progress.goal.toLocaleString() || '0'}`}
            </Text>
            <View style={styles.previewProgressBarWrapper}>
              <View style={[styles.previewProgressBarTrack, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
              <View style={[styles.previewProgressBarFill, { width: `${progress.pct}%`, backgroundColor: '#fff' }]} />
            </View>
            <View style={styles.previewFooter}>
              <View style={styles.previewDeadlineRow}>
                <Icon name="calendar" size={12} color={textSecondary} />
                <Text style={[styles.previewDeadlineText, { color: textSecondary }]}>
                  {deadline || 'YYYY-MM-DD'}
                </Text>
              </View>
              <Text style={[styles.previewProgressPercentage, { color: textPrimary }]}>{`${progress.pct}%`}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.balanceContainer}>
            <Text style={[styles.balanceLabel, { color: textSecondary }]}>Balance</Text>
            <Text style={[styles.balanceAmount, { color: textPrimary }]}>{`${balanceToShow}`}</Text>
          </View>
        )}
      </View>
    );
};

const EditCardScreen = ({ navigation, route }) => {
  const { cardId } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'debit',
    color: colors.cardColors.blue,
    isShared: false,
    shareCode: '',
    codeVersion: 1,
    initialBalance: '',
    goalAmount: '', 
    deadline: '',
    ownerId: null,
  });
  const [participants, setParticipants] = useState([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState(new Set());
  const [expenses, setExpenses] = useState([]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const isOwner = user && user.uid === formData.ownerId;

  const predefinedColors = Object.values(colors.cardColors);

  useEffect(() => {
    loadCardData();
  }, [cardId]);

  useEffect(() => {
    if (!cardId) return;
    const unsubscribe = getExpenses(cardId, setExpenses);
    return () => unsubscribe();
  }, [cardId]);

  const cardBalance = useMemo(() => {
    const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    return (parseFloat(formData.initialBalance) || 0) + totalExpenses;
  }, [formData.initialBalance, expenses]);

  useEffect(() => {
    let unsubscribe = () => {};
    if (formData.isShared) {
      unsubscribe = getParticipants(cardId, (p) => {
          setParticipants(p);
          if (!formData.ownerId) {
              const owner = p.find(person => person.role === 'owner');
              if(owner) {
                  setFormData(prev => ({...prev, ownerId: owner.uid}));
              }
          }
      });
    } else {
      setParticipants([]);
    }
    return () => unsubscribe();
  }, [cardId, formData.isShared, formData.ownerId]);

  // Entry animations
  useEffect(() => {
    const startAnimations = () => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
    };

    // Small delay to ensure component is mounted
    setTimeout(startAnimations, 50);
  }, []);

  const loadCardData = async () => {
    try {
      const cardDoc = await getCardById(cardId);
      if (cardDoc.exists()) {
        const cardData = cardDoc.data();
        setFormData({
          name: cardData.name || '',
          description: cardData.description || '',
          type: cardData.type || 'debit',
          color: cardData.color || colors.cardColors.blue,
          isShared: cardData.isShared || false,
          shareCode: cardData.shareCode || '',
          codeVersion: cardData.codeVersion || 1,
          initialBalance: cardData.initialBalance ? cardData.initialBalance.toString() : '',
          goalAmount: cardData.goalAmount ? cardData.goalAmount.toString() : '',
          deadline: cardData.deadline || '',
          ownerId: cardData.ownerId || null,
        });
      } else {
        Alert.alert('Error', 'Card not found');
        navigation.goBack();
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading card:', error);
      Alert.alert('Error', 'Could not load card data');
      setLoading(false);
    }
  };

  const generateShareCode = async () => {
    if (!isOwner) return;
    try {
      const res = await regenerateShareCode(cardId, user.uid);
      setFormData({ ...formData, isShared: true, shareCode: res.shareCode });
      Alert.alert('Share code updated', 'Participants must rejoin with the new code');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not regenerate code');
    }
  };

  const copyShareCode = async () => {
    await Clipboard.setStringAsync(formData.shareCode);
    Alert.alert('Code Copied', 'The code has been copied to clipboard');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a name for the card');
      return;
    }

    try {
      const cardData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        color: formData.color,
        isShared: formData.isShared,
        shareCode: formData.shareCode,
        codeVersion: formData.codeVersion || 1,
        updatedAt: new Date(),
        ownerId: formData.ownerId || user.uid,
      };

      if (formData.type === 'savings') {
        cardData.goalAmount = formData.goalAmount ? parseFloat(formData.goalAmount) : 0;
        cardData.deadline = formData.deadline.trim() || null;
      }

      await updateCard(cardId, cardData);

      if (cardData.isShared && cardData.shareCode) {
        await upsertShareCode(user.uid, user.uid, cardId, cardData.shareCode);
      } else if (!cardData.isShared && formData.shareCode) {
        try { await removeShareCode(formData.shareCode, user.uid); } catch (e) { /* ignore */ }
      }

      Alert.alert(
        'Card Updated',
        `Your card "${cardData.name}" has been updated successfully`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error updating card:', error);
      Alert.alert('Error', 'Could not update the card. Please try again.');
    }
  };

  const handleDelete = () => {
    if (!isOwner) return;
    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this card? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCard(cardId);
              Alert.alert(
                'Card Deleted',
                'The card has been deleted successfully',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error('Error deleting card:', error);
              Alert.alert('Error', 'Could not delete the card. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleLeaveCard = () => {
    Alert.alert(
      'Leave Card',
      'Are you sure you want to leave this card? Your personal categorizations will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveSharedCard(cardId, user.uid);
              Alert.alert(
                'You have left the card',
                'Your personal categorizations have been removed.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error('Error leaving card:', error);
              Alert.alert('Error', 'Could not leave the card. Please try again.');
            }
          }
        }
      ]
    );
  };

  const toggleSelectParticipant = (participant) => {
    if (!isOwner || participant.uid === user.uid) return;
    setSelectedParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(participant.uid)) {
        next.delete(participant.uid);
      } else {
        next.add(participant.uid);
      }
      return next;
    });
  };

  const handleRemoveSelectedParticipants = () => {
    if (selectedParticipantIds.size === 0) return;
    Alert.alert(
      'Remove Participants',
      `Are you sure you want to remove ${selectedParticipantIds.size} participant(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const removalPromises = [];
              selectedParticipantIds.forEach(participantId => {
                removalPromises.push(deleteParticipant(cardId, participantId, user.uid));
              });
              await Promise.all(removalPromises);
              setSelectedParticipantIds(new Set());
              Alert.alert('Participants Removed', 'The selected participants have been removed.');
            } catch (error) {
              console.error('Error removing participants:', error);
              Alert.alert('Error', error.message || 'Could not remove participants.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <View style={styles.loadingContainer}><Text>Loading...</Text></View>;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ],
        }
      ]}
    >
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="times" size={18} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Card</Text>
          <TouchableOpacity onPress={handleSave}>
            <Icon name="save" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <CardPreview
                name={formData.name}
                type={formData.type}
                color={formData.color}
                goalAmount={formData.goalAmount}
                deadline={formData.deadline}
                balance={cardBalance.toString()}
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Card Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Home Expenses, Travel, Cash..."
              value={formData.name}
              onChangeText={(value) => setFormData({ ...formData, name: value })}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add a description for this card..."
              value={formData.description}
              onChangeText={(value) => setFormData({ ...formData, description: value })}
              multiline
            />
          </View>

          {formData.type === 'savings' && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Goal Amount</Text>
                <View style={styles.currencyContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyInput}
                    placeholder="1000.00"
                    value={formData.goalAmount}
                    onChangeText={(value) => setFormData({ ...formData, goalAmount: value.replace(/[^0-9.]/g, '') })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Deadline</Text>
                <DateSelector
                  value={formData.deadline}
                  onChange={(dateString) => setFormData({ ...formData, deadline: dateString })}
                />
              </View>
            </>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Color</Text>
            <View style={styles.colorsGrid}>
              {predefinedColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color },
                    formData.color === color && styles.colorButtonActive
                  ]}
                  onPress={() => setFormData({ ...formData, color })}
                >
                  {formData.color === color && <Icon name="check" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Share Card</Text>
            <View style={styles.shareToggleRow}>
              <Text style={styles.shareToggleLabel}>Enable Sharing</Text>
              <Switch
                trackColor={{ false: '#767577', true: '#dbeafe' }}
                thumbColor={formData.isShared ? colors.primary : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={(value) => isOwner && setFormData({ ...formData, isShared: value })}
                value={formData.isShared}
                disabled={!isOwner}
              />
            </View>
          </View>

          {formData.isShared && isOwner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Share Code</Text>
              {!formData.shareCode ? (
                <TouchableOpacity style={styles.primaryButton} onPress={generateShareCode}>
                  <Icon name="share-alt" size={16} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.primaryButtonText}>Generate Code</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.shareCodeRow}>
                    <Text style={styles.shareCodeInput}>{formData.shareCode}</Text>
                    <TouchableOpacity style={styles.shareCodeButton} onPress={copyShareCode}>
                      <Icon name="copy" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.secondaryButton} onPress={generateShareCode}>
                    <Icon name="sync" size={14} color={colors.primary} style={styles.buttonIcon} />
                    <Text style={styles.secondaryButtonText}>Regenerate Code</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {formData.isShared && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Participants ({participants.length})</Text>
              {participants.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {participants.map((p) => {
                    const isYou = p.uid === user.uid;
                    const isParticipantOwner = p.uid === formData.ownerId;
                    const selected = selectedParticipantIds.has(p.uid);
                    return (
                      <TouchableOpacity
                        key={p.id || p.uid}
                        onPress={() => toggleSelectParticipant(p)}
                        activeOpacity={!isOwner || isYou ? 1 : 0.7}
                        style={[styles.participantRow, selected && styles.participantRowSelected]}
                      >
                        <View style={{flex: 1}}>
                          <Text style={styles.participantName}>{p.displayName || p.email || 'Unnamed User'}</Text>
                          {isParticipantOwner ? (
                            <Text style={styles.ownerBadge}>Owner</Text>
                          ) : (
                            <Text style={styles.participantEmail}>{p.role}</Text>
                          )}
                        </View>
                        {isOwner && !isYou && (
                          <View style={[styles.checkbox, selected && styles.checkboxChecked]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  {isOwner && selectedParticipantIds.size > 0 && (
                    <TouchableOpacity
                      onPress={handleRemoveSelectedParticipants}
                      style={styles.bulkDeleteBtn}
                    >
                      <Icon name="trash" size={14} color="#fff" />
                      <Text style={styles.bulkDeleteBtnText}>Remove Selected</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text style={styles.noParticipantsText}>No other participants yet.</Text>
              )}
            </View>
          )}

          <View style={styles.buttonContainer}>
            {isOwner ? (
                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                    <Icon name="trash" size={16} color="#FF3B30" style={styles.buttonIcon} />
                    <Text style={styles.deleteButtonText}>Delete Card</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveCard}>
                    <Icon name="sign-out-alt" size={16} color="#FF3B30" style={styles.buttonIcon} />
                    <Text style={styles.deleteButtonText}>Leave Card</Text>
                </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyboardContainer: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    headerSaveButton: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.primary,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        color: '#333',
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    currencyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 12,
        paddingHorizontal: 15,
    },
    currencySymbol: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 10,
    },
    currencyInput: {
        flex: 1,
        paddingVertical: 15,
        fontSize: 16,
        color: '#333',
    },
    colorsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    colorButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    colorButtonActive: {
        borderColor: '#007AFF',
    },
    buttonContainer: {
        marginTop: 20,
    },
    buttonIcon: {
        marginRight: 8,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFE5E5',
        borderRadius: 12,
        padding: 18,
        marginBottom: 20,
    },
    leaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFE5E5',
        borderRadius: 12,
        padding: 18,
        marginBottom: 20,
    },
    deleteButtonText: {
        color: '#FF3B30',
        fontSize: 18,
        fontWeight: 'bold',
    },
    previewCard: {
      borderRadius: 16,
      padding: 18,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 6,
    },
    previewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    previewHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },
    previewIconPill: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    previewSubtitle: {
      fontSize: 12,
      fontWeight: '500',
    },
    balanceContainer: {
      alignItems: 'flex-start',
      marginTop: 8,
    },
    balanceLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    balanceAmount: {
      fontSize: 22,
      fontWeight: '700',
    },
    previewAmountText: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 10,
    },
    previewProgressBarWrapper: {
      height: 10,
      borderRadius: 6,
      overflow: 'hidden',
      position: 'relative',
      marginBottom: 10,
    },
    previewProgressBarTrack: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 6,
    },
    previewProgressBarFill: {
      height: '100%',
      borderRadius: 6,
    },
    previewFooter: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    previewDeadlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    previewDeadlineText: {
      fontSize: 12,
      fontWeight: '500',
    },
    previewProgressPercentage: {
      fontSize: 14,
      fontWeight: '700',
    },
    shareToggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
      borderRadius: 12,
      padding: 15,
      borderWidth: 1,
      borderColor: '#e9ecef',
    },
    shareToggleLabel: {
      fontSize: 16,
      color: '#333',
      fontWeight: '500',
    },
    shareCodeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
      borderRadius: 12,
      paddingHorizontal: 15,
      borderWidth: 1,
      borderColor: '#e9ecef',
      marginBottom: 10,
    },
    shareCodeInput: {
      flex: 1,
      paddingVertical: 15,
      fontSize: 16,
      color: '#333',
      letterSpacing: 2,
    },
    shareCodeButton: {
      padding: 10,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 18,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      padding: 18,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: 'bold',
    },
    noParticipantsText: {
      textAlign: 'center',
      color: '#666',
      padding: 20,
      backgroundColor: '#f8f9fa',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#e9ecef',
    },
    participantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#e9ecef',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    participantRowSelected: {
      borderColor: '#dc2626',
      backgroundColor: '#FFF5F5',
    },
    participantName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
    },
    participantEmail: {
      fontSize: 12,
      color: '#666',
      textTransform: 'capitalize',
    },
    ownerBadge: {
      fontSize: 12,
      fontWeight: 'bold',
      color: colors.primary,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: '#e9ecef',
      backgroundColor: '#f8f9fa',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    bulkDeleteBtn: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#dc2626',
      borderRadius: 10,
      paddingVertical: 12,
    },
    bulkDeleteBtnText: {
      color: '#fff',
      fontWeight: '700',
    },
});

export default EditCardScreen;
