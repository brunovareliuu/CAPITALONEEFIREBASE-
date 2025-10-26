import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { getPlanExpenses, getPlanPeople, updateExpense, deleteExpense, addPlanExpense, getUserProfile } from '../services/firestoreService';

const PersonDeletionModal = ({ visible, onClose, planId, person, onDeleteSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState('confirm'); // 'confirm', 'transfer', 'delete'
  const [transferToPerson, setTransferToPerson] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [availablePeople, setAvailablePeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [personContributions, setPersonContributions] = useState([]);
  const [currencyIcon, setCurrencyIcon] = useState(null);

  useEffect(() => {
    if (visible && person) {
      loadPersonContributions();
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
  }, [visible, person]);

  const loadPersonContributions = async () => {
    if (!planId || !person) return;

    try {
      // Get all expenses for this plan
      const expensesUnsubscribe = getPlanExpenses(planId, (expenses) => {
        const personExpenses = expenses.filter(exp => exp.payerId === person.id);
        setPersonContributions(personExpenses);
      });

      // Get all people in the plan
      const peopleUnsubscribe = getPlanPeople(planId, (people) => {
        const otherPeople = people.filter(p => p.id !== person.id && p.userId !== user.uid); // Exclude the person being deleted and current user
        setAvailablePeople(otherPeople.map(p => ({
          id: p.id,
          name: p.userId === user.uid ? 'You' : (p.name || 'Unknown')
        })));
      });

      return () => {
        expensesUnsubscribe && expensesUnsubscribe();
        peopleUnsubscribe && peopleUnsubscribe();
      };
    } catch (error) {
      console.error('Error loading contributions:', error);
    }
  };

  const totalContributions = personContributions.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

  const handleTransferContributions = () => {
    if (!transferToPerson) {
      Alert.alert('Error', 'Please select a person to transfer contributions to');
      return;
    }

    const amount = transferAmount ? parseFloat(transferAmount) : totalContributions;

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (amount > totalContributions) {
      Alert.alert('Error', 'Transfer amount cannot be greater than total contributions');
      return;
    }

    setStep('transfer');
  };

  const confirmTransfer = async () => {
    setLoading(true);
    try {
      const amount = transferAmount ? parseFloat(transferAmount) : totalContributions;

      if (amount >= totalContributions) {
        // Transfer all contributions - update each expense to the new payer
        for (const expense of personContributions) {
          await updateExpense(planId, expense.id, {
            payerId: transferToPerson.id,
            payerName: transferToPerson.name
          });
        }
      } else {
        // Transfer partial amount - create a new expense for the transferred amount
        const transferExpense = {
          description: `Transfer from ${person.name}`,
          amount: amount,
          payerId: transferToPerson.id,
          payerName: transferToPerson.name,
          date: new Date().toISOString().slice(0, 10),
          type: 'transfer'
        };

        await addPlanExpense(planId, transferExpense);

        // Reduce the original person's contributions proportionally
        const remainingAmount = totalContributions - amount;
        const ratio = remainingAmount / totalContributions;

        for (const expense of personContributions) {
          const newAmount = expense.amount * ratio;
          if (newAmount > 0) {
            await updateExpense(planId, expense.id, {
              amount: newAmount
            });
          } else {
            await deleteExpense(planId, expense.id);
          }
        }
      }

      // Now delete the person
      await onDeleteSuccess();
      Alert.alert('Success', `Contributions transferred and person deleted successfully`);
      onClose();
    } catch (error) {
      console.error('Error transferring contributions:', error);
      Alert.alert('Error', 'Failed to transfer contributions');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteWithContributions = async () => {
    setLoading(true);
    try {
      // Delete all contributions
      for (const expense of personContributions) {
        await deleteExpense(planId, expense.id);
      }

      // Now delete the person
      await onDeleteSuccess();
      Alert.alert('Success', `Person and all contributions deleted successfully`);
      onClose();
    } catch (error) {
      console.error('Error deleting contributions:', error);
      Alert.alert('Error', 'Failed to delete contributions');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep('confirm');
    setTransferToPerson(null);
    setTransferAmount('');
    setAvailablePeople([]);
    setPersonContributions([]);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!person) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Delete Person</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Icon name="times" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {step === 'confirm' && (
              <>
                <View style={styles.warningSection}>
                  <Icon name="exclamation-triangle" size={48} color="#FF9500" />
                  <Text style={styles.warningTitle}>Person with Contributions</Text>
                  <Text style={styles.warningText}>
                    {person.name || 'This person'} has contributed {currencyIcon && <Icon name={currencyIcon} size={16} color='#666' />} {totalContributions.toFixed(2)} to the plan.
                  </Text>
                  <Text style={styles.warningText}>
                    What would you like to do with these contributions?
                  </Text>
                </View>

                <View style={styles.contributionsList}>
                  <Text style={styles.contributionsTitle}>Contributions from {person.name}:</Text>
                  {personContributions.map((expense) => (
                    <View key={expense.id} style={styles.expenseItem}>
                      <Text style={styles.expenseDescription}>{expense.description}</Text>
                      <Text style={styles.expenseAmount}>{currencyIcon && <Icon name={currencyIcon} size={14} color={colors.primary} />} {Math.abs(expense.amount).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.optionsSection}>
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => setStep('transfer')}
                  >
                    <Icon name="exchange-alt" size={20} color="#007AFF" />
                    <View style={styles.optionTextContainer}>
                      <Text style={styles.optionTitle}>Transfer Contributions</Text>
                      <Text style={styles.optionDescription}>
                        Pass the contributions to another person
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => setStep('delete')}
                  >
                    <Icon name="trash" size={20} color="#FF3B30" />
                    <View style={styles.optionTextContainer}>
                      <Text style={styles.optionTitle}>Delete Everything</Text>
                      <Text style={styles.optionDescription}>
                        Delete person and all their contributions
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 'transfer' && (
              <>
                <View style={styles.transferSection}>
                  <Text style={styles.sectionTitle}>Transfer Contributions</Text>
                  <Text style={styles.sectionDescription}>
                    Select who to transfer {person.name}'s contributions to
                  </Text>

                  <View style={styles.peopleList}>
                    {availablePeople.length === 0 ? (
                      <Text style={styles.noPeopleText}>No other people available to transfer to</Text>
                    ) : (
                      availablePeople.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.personOption,
                            transferToPerson?.id === p.id && styles.personOptionSelected
                          ]}
                          onPress={() => setTransferToPerson(p)}
                        >
                          <Text style={styles.personName}>{p.name}</Text>
                          {transferToPerson?.id === p.id && (
                            <Icon name="check" size={16} color="#007AFF" />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>

                  <View style={styles.amountSection}>
                    <Text style={styles.amountLabel}>Amount to transfer (optional)</Text>
                    <Text style={styles.amountHint}>
                      Leave empty to transfer everything ({currencyIcon && <Icon name={currencyIcon} size={14} color='#666' />} {totalContributions.toFixed(2)})
                    </Text>
                    <View style={styles.amountInputContainer}>
                      {currencyIcon && <Icon name={currencyIcon} style={styles.currencySymbol} />}
                      <TextInput
                        style={styles.amountInput}
                        value={transferAmount}
                        onChangeText={setTransferAmount}
                        placeholder={totalContributions.toFixed(2)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setStep('confirm')}
                    disabled={loading}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, (!transferToPerson || loading) && styles.buttonDisabled]}
                    onPress={confirmTransfer}
                    disabled={!transferToPerson || loading}
                  >
                    <Text style={styles.confirmButtonText}>
                      {loading ? 'Processing...' : 'Transfer and Delete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 'delete' && (
              <>
                <View style={styles.deleteConfirmationSection}>
                  <Icon name="trash" size={48} color="#FF3B30" />
                  <Text style={styles.deleteTitle}>Delete Person and Contributions</Text>
                  <Text style={styles.deleteText}>
                    This will delete {person.name} from the plan along with all their contributions for {currencyIcon && <Icon name={currencyIcon} size={16} color='#666' />} {totalContributions.toFixed(2)}.
                  </Text>
                  <Text style={styles.deleteWarning}>
                    This action cannot be undone.
                  </Text>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setStep('confirm')}
                    disabled={loading}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.dangerButton, loading && styles.buttonDisabled]}
                    onPress={confirmDeleteWithContributions}
                    disabled={loading}
                  >
                    <Text style={styles.confirmButtonText}>
                      {loading ? 'Deleting...' : 'Delete Everything'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  warningSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  contributionsList: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  contributionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  expenseDescription: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  optionsSection: {
    gap: 12,
    marginTop: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  optionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  transferSection: {
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  peopleList: {
    marginBottom: 20,
  },
  personOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  personOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E3F2FD',
  },
  personName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  noPeopleText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  amountSection: {
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  amountHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  deleteConfirmationSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 8,
  },
  deleteText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  deleteWarning: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default PersonDeletionModal;
