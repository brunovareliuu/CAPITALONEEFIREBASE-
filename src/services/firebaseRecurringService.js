import { db } from '../config/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';

// Collection for recurring payments
const RECURRING_PAYMENTS_COLLECTION = 'recurringPayments';

// Get document ID for a user's bill
const getBillDocId = (userId, billId) => `${userId}_${billId}`;

// Initialize recurring payment document for a bill (only if it doesn't exist)
export const initializeRecurringBill = async (userId, billId, billData) => {
  try {
    const docId = getBillDocId(userId, billId);
    const docRef = doc(db, RECURRING_PAYMENTS_COLLECTION, docId);

    // Check if document already exists
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log('📄 Recurring bill already exists, skipping initialization');
      return docSnap.data();
    }

    console.log('📄 Creating new recurring bill document');

    // Build billData object dynamically, only including valid fields
    const billDataObj = {};
    if (billData.payee) billDataObj.payee = billData.payee;
    if (billData.recurring_date !== undefined && billData.recurring_date !== null) {
      billDataObj.recurring_date = billData.recurring_date;
    }
    if (billData.payment_amount) billDataObj.payment_amount = billData.payment_amount;
    if (billData.nickname) billDataObj.nickname = billData.nickname;

    const initialData = {
      userId,
      billId,
      billData: billDataObj,
      paymentHistory: [],
      lastPaymentDate: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setDoc(docRef, initialData);
    console.log('✅ Recurring bill initialized successfully');
    return initialData;
  } catch (error) {
    console.error('❌ Error initializing recurring bill:', error);
    throw error;
  }
};

// Add a payment to history
export const addPaymentToHistory = async (userId, billId, paymentData) => {
  try {
    console.log('💾 Adding payment to Firebase:', { userId, billId, paymentData });

    const docId = getBillDocId(userId, billId);
    const docRef = doc(db, RECURRING_PAYMENTS_COLLECTION, docId);

    // Check if document exists, if not, initialize it
    let docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.log('📄 Document does not exist, initializing...');
      // Create minimal billData from paymentData for initialization
      const minimalBillData = {
        payee: paymentData.payee,
        payment_amount: paymentData.amount,
        nickname: paymentData.payee || 'Bill Payment'
        // Note: recurring_date is not included here as it may not be available
      };
      await initializeRecurringBill(userId, billId, minimalBillData);
      docSnap = await getDoc(docRef);
    } else {
      console.log('📄 Document exists, adding payment to existing history');
    }

    const currentData = docSnap.data();
    const currentHistoryLength = currentData.paymentHistory?.length || 0;
    console.log('📊 Current document data paymentHistory length:', currentHistoryLength);

    const payment = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      amount: paymentData.amount,
      month: paymentData.month,
      year: paymentData.year,
      payee: paymentData.payee,
      timestamp: new Date()
    };

    const updatedHistory = [payment, ...(currentData.paymentHistory || [])];
    console.log('📝 Adding payment to history. New length:', updatedHistory.length);

    await updateDoc(docRef, {
      paymentHistory: updatedHistory,
      lastPaymentDate: payment.date,
      updatedAt: new Date()
    });

    console.log('✅ Payment successfully saved to Firebase');

    return payment;
  } catch (error) {
    console.error('❌ Error adding payment to history:', error);
    throw error;
  }
};

// Get payment history for a bill
export const getPaymentHistory = async (userId, billId) => {
  try {
    const docId = getBillDocId(userId, billId);
    const docRef = doc(db, RECURRING_PAYMENTS_COLLECTION, docId);

    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.log('📄 No payment history document found for bill:', billId);
      return [];
    }

    const data = docSnap.data();
    const history = data.paymentHistory || [];
    console.log('📄 Retrieved payment history for bill', billId, '- length:', history.length);
    return history;
  } catch (error) {
    console.error('❌ Error getting payment history:', error);
    return [];
  }
};

// Check if payment was made this month
export const isPaidThisMonth = async (userId, billId) => {
  try {
    const history = await getPaymentHistory(userId, billId);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const isPaid = history.some(payment => {
      const paymentDate = new Date(payment.date);
      const paymentMonth = paymentDate.getMonth();
      const paymentYear = paymentDate.getFullYear();

      return paymentMonth === currentMonth && paymentYear === currentYear;
    });

    console.log('🔍 Bill', billId, 'paid this month:', isPaid, '(history length:', history.length + ')');
    return isPaid;
  } catch (error) {
    console.error('❌ Error checking payment status:', error);
    return false;
  }
};

// Get recent payments (last N months)
export const getRecentPayments = async (userId, billId, months = 12) => {
  try {
    const history = await getPaymentHistory(userId, billId);
    const now = new Date();

    const recentPayments = history.filter(payment => {
      const paymentDate = new Date(payment.date);
      const diffTime = now.getTime() - paymentDate.getTime();
      const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30); // Approximate months
      return diffMonths <= months;
    });

    console.log('📄 Recent payments for bill', billId, '- total:', history.length, 'recent:', recentPayments.length);
    return recentPayments;
  } catch (error) {
    console.error('❌ Error getting recent payments:', error);
    return [];
  }
};

// Get all recurring bills for a user
export const getUserRecurringBills = async (userId) => {
  try {
    const q = query(
      collection(db, RECURRING_PAYMENTS_COLLECTION),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const bills = [];

    querySnapshot.forEach((doc) => {
      bills.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return bills;
  } catch (error) {
    console.error('Error getting user recurring bills:', error);
    return [];
  }
};

// Get bill status (paid this month, last payment, etc.)
export const getBillStatus = async (userId, billId) => {
  try {
    const history = await getPaymentHistory(userId, billId);
    const paidThisMonth = await isPaidThisMonth(userId, billId);

    if (history.length === 0) {
      return {
        paidThisMonth: false,
        lastPaymentDate: null,
        totalPayments: 0,
        paymentHistory: []
      };
    }

    const lastPayment = history[0]; // History is ordered with most recent first

    return {
      paidThisMonth,
      lastPaymentDate: lastPayment.date,
      totalPayments: history.length,
      paymentHistory: history
    };
  } catch (error) {
    console.error('Error getting bill status:', error);
    return {
      paidThisMonth: false,
      lastPaymentDate: null,
      totalPayments: 0,
      paymentHistory: []
    };
  }
};

// Clean up old payment records (keep only last 24 months)
export const cleanupOldPayments = async (userId, billId) => {
  try {
    const history = await getPaymentHistory(userId, billId);
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

    const filteredHistory = history.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= cutoffDate;
    });

    if (filteredHistory.length !== history.length) {
      const docId = getBillDocId(userId, billId);
      const docRef = doc(db, RECURRING_PAYMENTS_COLLECTION, docId);

      await updateDoc(docRef, {
        paymentHistory: filteredHistory,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error cleaning up old payments:', error);
  }
};

// Permanently delete a recurring bill from Firebase
export const deleteRecurringBill = async (userId, billId) => {
  try {
    const docId = getBillDocId(userId, billId);
    const docRef = doc(db, RECURRING_PAYMENTS_COLLECTION, docId);

    // Check if document exists before deleting
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await deleteDoc(docRef);
      console.log(`✅ Deleted recurring bill ${billId} from Firebase`);
      return true;
    } else {
      console.log(`ℹ️ Recurring bill ${billId} not found in Firebase`);
      return true; // Not an error if it doesn't exist
    }
  } catch (error) {
    console.error('Error deleting recurring bill from Firebase:', error);
    throw error;
  }
};