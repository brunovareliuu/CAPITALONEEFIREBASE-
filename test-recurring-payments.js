// Script de prueba para verificar el funcionamiento de los pagos recurrentes
// Ejecutar con: node test-recurring-payments.js

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK (solo para testing)
const serviceAccount = require('./firebase-service-account.json'); // You'll need to create this

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();

  async function testRecurringPayments() {
    console.log('🧪 Testing Recurring Payments System...');

    try {
      // Test data
      const userId = 'test-user-123';
      const billId = 'test-bill-456';

      // Test 1: Initialize recurring bill
      console.log('1️⃣ Testing bill initialization...');
      const billRef = db.collection('recurringPayments').doc(`${userId}_${billId}`);
      await billRef.set({
        userId,
        billId,
        billData: {
          payee: 'Test Electric Company',
          recurring_date: 15,
          payment_amount: 150.00
        },
        paymentHistory: [],
        lastPaymentDate: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Bill initialized');

      // Test 2: Add payment
      console.log('2️⃣ Testing payment addition...');
      const payment = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        amount: 150.00,
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        payee: 'Test Electric Company',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      await billRef.update({
        paymentHistory: admin.firestore.FieldValue.arrayUnion(payment),
        lastPaymentDate: payment.date,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Payment added');

      // Test 3: Retrieve data
      console.log('3️⃣ Testing data retrieval...');
      const doc = await billRef.get();
      if (doc.exists) {
        const data = doc.data();
        console.log('✅ Data retrieved:', {
          billId: data.billId,
          paymentCount: data.paymentHistory?.length || 0,
          lastPayment: data.lastPaymentDate
        });
      }

      // Test 4: Query user bills
      console.log('4️⃣ Testing user bills query...');
      const userBillsQuery = await db.collection('recurringPayments')
        .where('userId', '==', userId)
        .get();

      console.log(`✅ Found ${userBillsQuery.size} bills for user`);

      console.log('🎉 All tests passed!');

    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  // Run tests if this file is executed directly
  if (require.main === module) {
    testRecurringPayments();
  }
}

module.exports = { testRecurringPayments };
