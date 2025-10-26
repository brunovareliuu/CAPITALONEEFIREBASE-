import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getUserRecurringBills,
  initializeRecurringBill,
  addPaymentToHistory
} from './firebaseRecurringService';

// Migrate existing AsyncStorage data to Firebase
export const migrateAsyncStorageToFirebase = async (userId) => {
  try {
    console.log('🔄 Starting migration from AsyncStorage to Firebase...');

    // Get existing data from AsyncStorage
    const historyJson = await AsyncStorage.getItem('@payment_history');
    if (!historyJson) {
      console.log('ℹ️ No AsyncStorage data found, migration not needed');
      return { migrated: false, message: 'No data to migrate' };
    }

    const allHistory = JSON.parse(historyJson);
    let migratedCount = 0;
    let totalPayments = 0;

    // Process each bill's history
    for (const [billId, payments] of Object.entries(allHistory)) {
      try {
        console.log(`📄 Migrating bill ${billId} with ${payments.length} payments`);

        // Initialize the bill in Firebase with basic data from first payment
        const firstPayment = payments[0] || {};
        const billData = {
          payee: firstPayment.payee || 'Migrated Bill',
          recurring_date: firstPayment.recurring_date || 1,
          payment_amount: firstPayment.amount || 0,
          nickname: firstPayment.nickname || ''
        };

        // Initialize the bill in Firebase
        await initializeRecurringBill(userId, billId, billData);

        // Add all payments to Firebase
        for (const payment of payments) {
          await addPaymentToHistory(userId, billId, {
            amount: payment.amount || 0,
            month: payment.month || new Date(payment.date).getMonth(),
            year: payment.year || new Date(payment.date).getFullYear(),
            payee: payment.payee || billData.payee
          });
          totalPayments++;
        }

        migratedCount++;
        console.log(`✅ Migrated bill ${billId} with ${payments.length} payments`);

      } catch (error) {
        console.error(`❌ Error migrating bill ${billId}:`, error);
        // Continue with other bills even if one fails
      }
    }

    // Clear AsyncStorage after successful migration
    if (migratedCount > 0) {
      await AsyncStorage.removeItem('@payment_history');
      console.log('🗑️ Cleared old AsyncStorage data');
    }

    console.log(`🎉 Migration completed! Migrated ${migratedCount} bills with ${totalPayments} total payments`);

    return {
      migrated: true,
      migratedCount,
      totalPayments,
      message: `Successfully migrated ${migratedCount} bills (${totalPayments} payments) from AsyncStorage to Firebase`
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      migrated: false,
      error: error.message,
      message: 'Migration failed: ' + error.message
    };
  }
};

// Check if migration is needed
export const checkMigrationNeeded = async () => {
  try {
    const historyJson = await AsyncStorage.getItem('@payment_history');
    return historyJson !== null;
  } catch (error) {
    console.error('Error checking migration needed:', error);
    return false;
  }
};
