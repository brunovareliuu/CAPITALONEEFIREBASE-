import AsyncStorage from '@react-native-async-storage/async-storage';

const PAYMENT_HISTORY_KEY = '@payment_history';

// Get payment history for a specific bill
export const getPaymentHistory = async (billId) => {
  try {
    const historyJson = await AsyncStorage.getItem(PAYMENT_HISTORY_KEY);
    const allHistory = historyJson ? JSON.parse(historyJson) : {};

    return allHistory[billId] || [];
  } catch (error) {
    console.error('Error getting payment history:', error);
    return [];
  }
};

// Add a payment to history
export const addPaymentToHistory = async (billId, paymentData) => {
  try {
    const historyJson = await AsyncStorage.getItem(PAYMENT_HISTORY_KEY);
    const allHistory = historyJson ? JSON.parse(historyJson) : {};

    if (!allHistory[billId]) {
      allHistory[billId] = [];
    }

    // Add payment with timestamp
    const payment = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      amount: paymentData.amount,
      month: paymentData.month,
      year: paymentData.year,
      ...paymentData
    };

    allHistory[billId].unshift(payment); // Add to beginning of array

    await AsyncStorage.setItem(PAYMENT_HISTORY_KEY, JSON.stringify(allHistory));
    return payment;
  } catch (error) {
    console.error('Error adding payment to history:', error);
    throw error;
  }
};

// Check if payment was made for current month
export const isPaidThisMonth = async (billId) => {
  try {
    const history = await getPaymentHistory(billId);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return history.some(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate.getMonth() === currentMonth &&
             paymentDate.getFullYear() === currentYear;
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return false;
  }
};

// Get recent payments (last 12 months)
export const getRecentPayments = async (billId, months = 12) => {
  try {
    const history = await getPaymentHistory(billId);
    const now = new Date();

    return history.filter(payment => {
      const paymentDate = new Date(payment.date);
      const diffTime = now.getTime() - paymentDate.getTime();
      const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30); // Approximate months
      return diffMonths <= months;
    });
  } catch (error) {
    console.error('Error getting recent payments:', error);
    return [];
  }
};

// Clear payment history for a bill (for testing)
export const clearPaymentHistory = async (billId) => {
  try {
    const historyJson = await AsyncStorage.getItem(PAYMENT_HISTORY_KEY);
    const allHistory = historyJson ? JSON.parse(historyJson) : {};

    delete allHistory[billId];

    await AsyncStorage.setItem(PAYMENT_HISTORY_KEY, JSON.stringify(allHistory));
  } catch (error) {
    console.error('Error clearing payment history:', error);
  }
};
