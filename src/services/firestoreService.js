import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDocs,
  writeBatch,
  orderBy,
  runTransaction,
  collectionGroup,
  limit,
} from 'firebase/firestore';

const db = getFirestore();
const auth = getAuth();

// --- Funciones de Perfil de Usuario ---

/**
 * Crea el perfil de un usuario en la colección 'users'.
 * @param {string} userId - El UID del usuario de Firebase Authentication.
 * @param {object} userData - Datos iniciales del perfil (ej. email, displayName).
 */
export const createUserProfile = (userId, userData) => {
  const userDocRef = doc(db, 'users', userId);
  return setDoc(userDocRef, {
    ...userData,
    createdAt: serverTimestamp(),
  });
};

/**
 * Obtiene los datos del perfil de un usuario.
 * @param {string} userId - ID del usuario.
 * @returns {Promise<DocumentSnapshot>} Promesa que resuelve con el snapshot del documento del usuario.
 */
export const getUserProfile = (userId) => {
  if (!userId) throw new Error('User ID is required.');
  const userDocRef = doc(db, 'users', userId);
  return getDoc(userDocRef);
};

/**
 * Actualiza los datos del perfil de un usuario.
 * @param {string} userId - ID del usuario.
 * @param {object} updatedData - Datos a actualizar.
 * @returns {Promise<void>} Promesa que se resuelve cuando se actualiza el documento.
 */
export const updateUserProfile = (userId, updatedData) => {
  if (!userId) throw new Error('User ID is required to update profile.');
  const userDocRef = doc(db, 'users', userId);
  return updateDoc(userDocRef, {
    ...updatedData,
    updatedAt: serverTimestamp(),
  });
};


// --- Funciones para Tarjetas (Cards) [Colección global 'cards'] ---

/**
 * Obtiene las tarjetas de un usuario en tiempo real (donde es dueño o miembro).
 * @param {string} userId - ID del usuario.
 * @param {function} callback - Función a llamar con los datos de las tarjetas.
 * @returns {function} Función para desuscribirse de los listeners.
 */
export const getCards = (userId, callback) => {
  if (!userId) return () => {};
  
  const cardsRef = collection(db, 'cards');
  // Unifica la consulta usando 'array-contains' que funciona para dueños y miembros.
  const q = query(cardsRef, where('members', 'array-contains', userId));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const cards = [];
    querySnapshot.forEach((doc) => {
      cards.push({ id: doc.id, ...doc.data() });
    });
    callback(cards);
  }, (error) => {
    // Handle permission errors silently when cards are deleted
    if (error.code === 'permission-denied') {
      callback([]); // Return empty array instead of error
    } else {
      console.error("Error getting cards: ", error);
      callback([]);
    }
  });

  return unsubscribe;
};


/**
 * Añade una nueva tarjeta.
 * @param {string} userId - ID del usuario que crea la tarjeta.
 * @param {object} cardData - Datos de la tarjeta.
 * @returns {Promise<DocumentReference>}
 */
export const addCard = (userId, cardData) => {
  if (!userId) throw new Error('User ID is required to add a card.');
  const cardsRef = collection(db, 'cards');
  return addDoc(cardsRef, {
    ...cardData,
    ownerId: userId,
    members: [userId], // El creador siempre es el primer miembro.
    createdAt: serverTimestamp(),
  });
};

/**
 * Actualiza el nombre de una tarjeta si no tiene uno.
 * @param {string} cardId - ID de la tarjeta.
 * @param {string} defaultName - Nombre por defecto a asignar.
 * @returns {Promise<void>}
 */
export const updateCardNameIfEmpty = async (cardId, defaultName) => {
  if (!cardId) throw new Error('Card ID is required.');

  const cardRef = doc(db, 'cards', cardId);
  const cardSnap = await getDoc(cardRef);

  if (cardSnap.exists()) {
    const cardData = cardSnap.data();
    if (!cardData.name || cardData.name.trim() === '') {
      await updateDoc(cardRef, {
        name: defaultName,
        updatedAt: serverTimestamp()
      });
      console.log(`✅ Updated card ${cardId} with name: ${defaultName}`);
    }
  }
};

/**
 * Obtiene los datos de una tarjeta específica.
 * @param {string} cardId - ID de la tarjeta.
 * @returns {Promise<DocumentSnapshot>}
 */
export const getCardById = (cardId) => {
  if (!cardId) throw new Error('Card ID is required.');
  const cardDocRef = doc(db, 'cards', cardId);
  return getDoc(cardDocRef);
};

/**
 * Actualiza el balance de una tarjeta de crédito después de un gasto.
 * @param {string} cardId - ID de la tarjeta.
 * @param {number} amount - Monto del gasto (positivo).
 * @returns {Promise<void>}
 */
export const updateCreditCardBalance = async (cardId, amount) => {
  if (!cardId) throw new Error('Card ID is required.');
  if (typeof amount !== 'number' || amount <= 0) throw new Error('Valid amount is required.');

  const cardDocRef = doc(db, 'cards', cardId);

  return runTransaction(db, async (transaction) => {
    const cardDoc = await transaction.get(cardDocRef);
    if (!cardDoc.exists()) {
      throw new Error('Card not found.');
    }

    const cardData = cardDoc.data();
    const currentBalance = cardData.balance || 0;
    const currentUsedBalance = cardData.usedBalance || 0;

    // For credit cards: reduce available balance, increase used balance
    const newBalance = Math.max(0, currentBalance - amount);
    const newUsedBalance = currentUsedBalance + amount;

    transaction.update(cardDocRef, {
      balance: newBalance,
      usedBalance: newUsedBalance,
      updatedAt: serverTimestamp(),
    });
  });
};

/**
 * Actualiza el balance de una tarjeta de débito después de un gasto.
 * @param {string} cardId - ID de la tarjeta.
 * @param {number} amount - Monto del gasto (positivo).
 * @returns {Promise<void>}
 */
export const updateDebitCardBalance = async (cardId, amount) => {
  if (!cardId) throw new Error('Card ID is required.');
  if (typeof amount !== 'number' || amount <= 0) throw new Error('Valid amount is required.');

  const cardDocRef = doc(db, 'cards', cardId);

  return runTransaction(db, async (transaction) => {
    const cardDoc = await transaction.get(cardDocRef);
    if (!cardDoc.exists()) {
      throw new Error('Card not found.');
    }

    const cardData = cardDoc.data();
    const currentBalance = cardData.balance || 0;

    // For debit cards: reduce balance
    const newBalance = Math.max(0, currentBalance - amount);

    transaction.update(cardDocRef, {
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });
  });
};

/**
 * Actualiza una tarjeta.
 * @param {string} cardId - ID de la tarjeta.
 * @param {object} updatedData - Datos a actualizar.
 * @returns {Promise<void>}
 */
export const updateCard = (cardId, updatedData) => {
  if (!cardId) throw new Error('Card ID is required to update a card.');
  const cardDocRef = doc(db, 'cards', cardId);
  return updateDoc(cardDocRef, {
    ...updatedData,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Elimina una tarjeta.
 * @param {string} cardId - ID de la tarjeta.
 * @returns {Promise<void>}
 */
export const deleteCard = (cardId) => {
  if (!cardId) throw new Error('Card ID is required to delete a card.');
  const cardDocRef = doc(db, 'cards', cardId);
  return deleteDoc(cardDocRef);
};


// --- Funciones para Categorías (Categories) ---

/**
 * Obtiene las categorías de un usuario en tiempo real.
 * @param {string} userId - ID del usuario.
 * @param {function} callback - Función a llamar con las categorías.
 * @returns {function} Función para desuscribirse.
 */
export const getCategories = (userId, callback) => {
  if (!userId) return () => {};
  const categoriesRef = collection(db, 'users', userId, 'categories');
  const unsubscribe = onSnapshot(categoriesRef, (querySnapshot) => {
    const categories = [];
    querySnapshot.forEach((doc) => {
      categories.push({ id: doc.id, ...doc.data() });
    });
    callback(categories);
  }, (error) => {
    // Handle permission errors silently
    if (error.code === 'permission-denied') {
      callback([]); // Return empty array instead of error
    } else {
      console.error('Error getting categories:', error);
      callback([]);
    }
  });
  return unsubscribe;
};



/**
 * Añade una nueva categoría para un usuario.
 * @param {string} userId - ID del usuario.
 * @param {object} categoryData - Datos de la categoría.
 * @returns {Promise<DocumentReference>}
 */
export const addCategory = (userId, categoryData) => {
  if (!userId) throw new Error('User ID is required to add a category.');
  const categoriesRef = collection(db, 'users', userId, 'categories');
  return addDoc(categoriesRef, {
    ...categoryData,
    createdAt: serverTimestamp(),
    userId: userId, // Redundante pero puede ser útil.
  });
};

/**
 * Actualiza una categoría.
 * @param {string} userId - ID del usuario.
 * @param {string} categoryId - ID de la categoría.
 * @param {object} updatedData - Datos a actualizar.
 * @returns {Promise<void>}
 */
export const updateCategory = (userId, categoryId, updatedData) => {
  if (!userId || !categoryId) throw new Error('User ID and Category ID are required.');
  const categoryDocRef = doc(db, 'users', userId, 'categories', categoryId);
  return updateDoc(categoryDocRef, {
    ...updatedData,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Elimina una categoría.
 * @param {string} userId - ID del usuario.
 * @param {string} categoryId - ID de la categoría.
 * @returns {Promise<void>}
 */
export const deleteCategory = async (userId, categoryId) => {
  if (!userId || !categoryId) throw new Error('User ID and Category ID are required.');

  const batch = writeBatch(db);

  // Get category data to check if it's a plan category
  const categoryDocRef = doc(db, 'users', userId, 'categories', categoryId);
  const categorySnap = await getDoc(categoryDocRef);

  if (!categorySnap.exists()) {
    throw new Error('Category not found.');
  }

  const categoryData = categorySnap.data();

  // Use a collection group query to find and delete all categorizations using this category for the user.
  const categorizationsRef = collectionGroup(db, 'categorizations');
  const q = query(categorizationsRef, where('userId', '==', userId), where('category', '==', categoryId));
  const querySnapshot = await getDocs(q);

  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // If it's a savings plan category, also delete the plan
  if (categoryData.isPlanCategory && categoryData.planId) {
    const planDocRef = doc(db, 'plan', categoryData.planId);
    batch.delete(planDocRef);
  }

  // Delete the category itself
  batch.delete(categoryDocRef);

  return batch.commit();
};



// --- Funciones para Gastos/Ingresos (Expenses) ---

/**
 * Obtiene los gastos/ingresos de una tarjeta en tiempo real.
 * @param {string} cardId - ID de la tarjeta.
 * @param {function} callback - Función a llamar con los gastos.
 * @returns {function} Función para desuscribirse.
 */
export const getExpenses = (cardId, callback) => {
  if (!cardId) return () => {};
  const expensesRef = collection(db, 'cards', cardId, 'expenses');
  const q = query(expensesRef, orderBy('timestamp', 'desc'));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const expenses = [];
    querySnapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() });
    });
    callback(expenses);
  }, (error) => {
    // Handle permission errors silently when card is deleted
    if (error.code === 'permission-denied') {
      callback([]); // Return empty array instead of error
    } else {
      console.error(`Error getting expenses for card ${cardId}:`, error);
    }
  });
  return unsubscribe;
};


/**
 * Añade un nuevo gasto/ingreso a una tarjeta.
 * @param {string} userId - ID del usuario que crea el gasto.
 * @param {string} cardId - ID de la tarjeta.
 * @param {object} expenseData - Datos del gasto.
 * @returns {Promise<DocumentReference>}
 */
export const addExpense = async (userId, cardId, expenseData) => {
  if (!userId || !cardId) throw new Error('User ID and Card ID are required.');

  const expensesRef = collection(db, 'cards', cardId, 'expenses');
  const newExpenseRef = doc(expensesRef); // Create a reference for the new expense

  // Separate category from the rest of the data
  const { category, ...restOfExpenseData } = expenseData;

  const dataToSave = {
    ...restOfExpenseData,
    createdBy: userId,
    timestamp: serverTimestamp(),
  };

  // Set status based on categorization
  if (category) {
    // If category is provided, mark as completed
    dataToSave.status = 'completed';
  } else if (expenseData.status === 'pending') {
    // Preserve pending status if explicitly set and no category
    dataToSave.status = 'pending';
  }

  const batch = writeBatch(db);

  // 1. Add the main expense document (without category)
  batch.set(newExpenseRef, dataToSave);

  // 2. If a category was provided, add the categorization for the user who created it
  if (category) {
    const categorizationRef = doc(newExpenseRef, 'categorizations', userId);
    batch.set(categorizationRef, {
      category: category,
      userId: userId,
      categorizedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  return newExpenseRef;
};

/**
 * Actualiza un gasto/ingreso.
 * @param {string} cardId - ID de la tarjeta.
 * @param {string} expenseId - ID del gasto.
 * @param {object} updatedData - Datos a actualizar.
 * @returns {Promise<void>}
 */
export const updateExpense = (cardId, expenseId, updatedData) => {
  if (!cardId || !expenseId) throw new Error('Card ID and Expense ID are required.');

  // Exclude 'category' from the update to prevent overwriting the old field.
  // Categorization should be handled via setExpenseCategorization.
  const { category, ...restOfUpdatedData } = updatedData;
  if (category) {
    console.warn("updateExpense: 'category' field is deprecated. Use setExpenseCategorization for individual categories.");
  }

  const expenseDocRef = doc(db, 'cards', cardId, 'expenses', expenseId);
  return updateDoc(expenseDocRef, {
    ...restOfUpdatedData,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Elimina un gasto/ingreso.
 * @param {string} cardId - ID de la tarjeta.
 * @param {string} expenseId - ID del gasto.
 * @returns {Promise<void>}
 */
export const deleteExpense = (cardId, expenseId) => {
  if (!cardId || !expenseId) throw new Error('Card ID and Expense ID are required.');
  const expenseDocRef = doc(db, 'cards', cardId, 'expenses', expenseId);
  return deleteDoc(expenseDocRef);
};

/**
 * Pays a credit card from a debit/cash card.
 * @param {string} userId - ID of the user performing the payment.
 * @param {string} creditCardId - ID of the credit card to be paid.
 * @param {string} fromCardId - ID of the debit/cash card to pay from.
 * @param {number} amount - The amount to pay.
 * @param {string} description - The description of the transaction.
 * @returns {Promise<void>}
 */
export const payCreditCard = async (userId, creditCardId, fromCardId, amount, names) => {
  if (!userId || !creditCardId || !fromCardId || !amount) {
    throw new Error('User ID, credit card ID, from card ID, and amount are required.');
  }

  const batch = writeBatch(db);

  // Add a positive transaction to the credit card
  const creditCardExpensesRef = collection(db, 'cards', creditCardId, 'expenses');
  const dateIdLocal = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const creditTransaction = {
    amount: Math.abs(amount),
    description: `Payment from card: ${names.fromCardName}`,
    category: 'Credit Card Payment',
    type: 'income',
    date: dateIdLocal(),
    timestamp: new Date(),
    createdBy: userId,
    sourceCardId: fromCardId,
  };
  const creditDocRef = doc(creditCardExpensesRef);
  batch.set(creditDocRef, creditTransaction);

  // Add a negative transaction to the debit/cash card
  const fromCardExpensesRef = collection(db, 'cards', fromCardId, 'expenses');
  const fromTransaction = {
    amount: -Math.abs(amount),
    description: `Card payment: ${names.creditCardName}`,
    category: 'Credit Card Payment',
    type: 'expense',
    date: dateIdLocal(),
    timestamp: new Date(),
    createdBy: userId,
    destinationCardId: creditCardId,
  };
  const fromDocRef = doc(fromCardExpensesRef);
  batch.set(fromDocRef, fromTransaction);

  return batch.commit();
};

/**
 * Adds savings to a card's reserved amount in a transaction.
 * @param {string} cardId - ID of the card.
 * @param {number} amount - Amount to add to the reserved field.
 * @returns {Promise<void>}
 */
export const addSavingsToCard = async (cardId, amount) => {
  if (!cardId || !amount) throw new Error('cardId and amount are required');
  
  const cardRef = doc(db, 'cards', cardId);

  try {
    await runTransaction(db, async (transaction) => {
      const cardDoc = await transaction.get(cardRef);
      if (!cardDoc.exists()) {
        throw "Card does not exist!";
      }

      const currentReserved = Number(cardDoc.data().reserved) || 0;
      const newReserved = currentReserved + Number(amount);

      transaction.update(cardRef, { reserved: newReserved, updatedAt: serverTimestamp() });
    });
  } catch (e) {
    console.error("Transaction failed: ", e);
    throw e;
  }
};


// --- Funciones para Compartir y Participantes ---

/**
 * Obtiene los participantes de una tarjeta en tiempo real, incluyendo al host/owner.
 * @param {string} cardId - ID de la tarjeta.
 * @param {function} callback - Función a llamar con los participantes.
 * @returns {function} Función para desuscribirse.
 */
export const getParticipants = (cardId, callback) => {
  if (!cardId) return () => {};

  const cardRef = doc(db, 'cards', cardId);
  const participantsRef = collection(db, 'cards', cardId, 'participants');

  const unsubscribe = onSnapshot(participantsRef, async (querySnapshot) => {
    try {
      // Get card data to include the owner as a participant
      const cardSnap = await getDoc(cardRef);
      if (!cardSnap.exists()) {
        callback([]);
        return;
      }

      const cardData = cardSnap.data();
      const ownerId = cardData.ownerId;

      // Get regular participants
      const participantsPromises = querySnapshot.docs.map(async (docSnap) => {
        const participantData = docSnap.data();
        const participantId = docSnap.id;

        // Fallback object in case user profile doesn't exist
        let userProfile = {
          displayName: 'Unknown User',
          email: 'No email',
        };

        try {
          const userDoc = await getDoc(doc(db, 'users', participantId));
          if (userDoc.exists()) {
            userProfile = userDoc.data();
          }
        } catch (userError) {
          console.error(`Failed to fetch profile for user ${participantId}:`, userError);
        }

        return {
          id: participantId,
          uid: participantId,
          ...participantData,
          displayName: userProfile.displayName,
          email: userProfile.email,
          role: participantData.role || 'member',
        };
      });

      const regularParticipants = await Promise.all(participantsPromises);

      // Add owner as a participant if not already included
      let allParticipants = [...regularParticipants];
      const ownerAlreadyIncluded = regularParticipants.some(p => p.id === ownerId);

      if (!ownerAlreadyIncluded && ownerId) {
        let ownerProfile = {
          displayName: 'Unknown User',
          email: 'No email',
        };

        try {
          const ownerDoc = await getDoc(doc(db, 'users', ownerId));
          if (ownerDoc.exists()) {
            ownerProfile = ownerDoc.data();
          }
        } catch (ownerError) {
          console.error(`Failed to fetch profile for owner ${ownerId}:`, ownerError);
        }

        allParticipants.unshift({
          id: ownerId,
          uid: ownerId,
          role: 'owner',
          joinedAt: cardData.createdAt,
          displayName: ownerProfile.displayName,
          email: ownerProfile.email,
        });
      }

      callback(allParticipants);

    } catch (error) {
      console.error('Error processing participants:', error);
      callback([]);
    }
  }, (error) => {
    // Handle permission errors silently when card is deleted
    if (error.code === 'permission-denied') {
      callback([]); // Return empty array instead of error
    } else {
      console.error('Error getting participants snapshot:', error);
      callback([]);
    }
  });

  return unsubscribe;
};


/**
 * Regenera el código para compartir de una tarjeta.
 * @param {string} cardId - ID de la tarjeta.
 * @returns {Promise<{shareCode: string}>}
 */
export const regenerateShareCode = async (cardId, currentUserId) => {
  if (!cardId) throw new Error('Card ID is required.');
  if (!currentUserId) throw new Error('Current user ID is required.');

  const cardRef = doc(db, 'cards', cardId);
  const cardSnap = await getDoc(cardRef);
  if (!cardSnap.exists()) throw new Error('Card not found');

  const currentCardData = cardSnap.data();
  const oldShareCode = currentCardData.shareCode;
  const ownerId = currentCardData.ownerId;

  // Verify that current user is the owner
  if (currentUserId !== ownerId) {
    throw new Error('Only the card owner can regenerate the share code.');
  }

  // Generar nuevo código
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let newShareCode = '';
  for (let i = 0; i < 6; i++) {
    newShareCode += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  const batch = writeBatch(db);

  // 1. Actualizar la tarjeta con el nuevo código y marcar como compartida
  batch.update(cardRef, { shareCode: newShareCode, isShared: true });

  // 2. Eliminar el código antiguo de la colección 'shareCodes'
  if (oldShareCode) {
    const oldCodeRef = doc(db, 'shareCodes', oldShareCode);
    batch.delete(oldCodeRef);
  }

  // 3. Crear el nuevo código en la colección 'shareCodes'
  const newCodeRef = doc(db, 'shareCodes', newShareCode);
  batch.set(newCodeRef, { 
    cardId: cardId,
    ownerId: currentCardData.ownerId,
    createdAt: serverTimestamp() 
  });

  await batch.commit();

  return { shareCode: newShareCode };
};

/**
 * Verificar si un código de compartir existe y es válido.
 * @param {string} shareCode - El código para verificar.
 * @returns {Promise<boolean>} - True si el código existe y es válido.
 */
export const verifyShareCode = async (shareCode) => {
  try {
    const normalizedCode = shareCode.trim().toUpperCase();
    if (normalizedCode.length !== 6) return false;

    const codeRef = doc(db, 'shareCodes', normalizedCode);
    const codeSnap = await getDoc(codeRef);

    if (!codeSnap.exists()) return false;

    const { cardId } = codeSnap.data();
    if (!cardId) return false;

    // Verificar que la tarjeta aún existe
    const cardSnap = await getDoc(doc(db, 'cards', cardId));
    return cardSnap.exists();
  } catch (error) {
    console.error('Error verifying share code:', error);
    return false;
  }
};

/**
 * Unirse a una tarjeta usando un código.
 * @param {string} currentUserId - ID del usuario que se une.
 * @param {string} shareCode - El código para compartir.
 * @returns {Promise<{cardId: string}>}
 */
export const joinCardByCode = async (currentUserId, shareCode) => {
  if (!currentUserId || !shareCode) throw new Error('User ID and share code are required.');

  // Normalize the share code (remove spaces and convert to uppercase)
  const normalizedCode = shareCode.trim().toUpperCase();

  if (normalizedCode.length !== 6) {
    throw new Error('Share code must be exactly 6 characters long.');
  }

  // First, check if the share code exists in shareCodes collection
  const shareCodeRef = doc(db, 'shareCodes', normalizedCode);
  const shareCodeSnap = await getDoc(shareCodeRef);

  if (!shareCodeSnap.exists()) {
    throw new Error('Invalid share code. No card found with this code.');
  }

  const shareCodeData = shareCodeSnap.data();
  const cardId = shareCodeData.cardId;
  const cardRef = doc(db, 'cards', cardId);

  try {
    await runTransaction(db, async (transaction) => {
      const cardDoc = await transaction.get(cardRef);
      if (!cardDoc.exists()) {
        throw new Error('The card associated with this code no longer exists.');
      }

      const cardData = cardDoc.data();
      if (!cardData.isShared) {
        throw new Error('This card is no longer shared. Please ask the owner to share it again.');
      }

      if (cardData.members && cardData.members.includes(currentUserId)) {
        throw new Error('You are already a member of this card.');
      }

      // Perform writes
      transaction.update(cardRef, {
        members: arrayUnion(currentUserId),
      });

      const participantRef = doc(db, 'cards', cardId, 'participants', currentUserId);
      transaction.set(participantRef, {
        joinedAt: serverTimestamp(),
        role: 'member',
        joinedWithCode: normalizedCode,
      });
    });

    return { cardId };
  } catch (error) {
    console.error('Transaction failed for joining card:', error);
    throw error;
  }
};

/**
 * Crea/actualiza un participante en la subcolección de una tarjeta.
 * @param {string} cardId - ID de la tarjeta.
 * @param {string} participantId - ID del usuario a añadir/actualizar.
 * @param {object} data - Datos del participante.
 */
export const setParticipant = (cardId, participantId, data) => {
  if (!cardId || !participantId) throw new Error('Card ID and Participant ID are required.');
  const participantRef = doc(db, 'cards', cardId, 'participants', participantId);
  return setDoc(participantRef, data, { merge: true });
};

/**
 * Elimina un participante de una tarjeta compartida (solo el owner puede hacerlo).
 * @param {string} cardId - ID de la tarjeta.
 * @param {string} participantId - ID del usuario a eliminar.
 * @param {string} currentUserId - ID del usuario actual (debe ser el owner).
 */
export const deleteParticipant = async (cardId, participantId, currentUserId) => {
  if (!cardId || !participantId || !currentUserId) throw new Error('Card ID, Participant ID and Current User ID are required.');

  // Verificar que el usuario actual sea el owner de la tarjeta
  const cardRef = doc(db, 'cards', cardId);
  const cardSnap = await getDoc(cardRef);

  if (!cardSnap.exists()) {
    throw new Error('Card not found.');
  }

  const cardData = cardSnap.data();
  if (cardData.ownerId !== currentUserId) {
    throw new Error('Only the card owner can remove participants.');
  }

  if (participantId === currentUserId) {
    throw new Error('You cannot remove yourself as owner.');
  }

  // Usar batch para eliminar tanto del array members como de la subcolección
  const batch = writeBatch(db);

  // 1. Remover del array members de la tarjeta
  batch.update(cardRef, {
    members: arrayRemove(participantId),
    updatedAt: serverTimestamp(),
  });

  // 2. Eliminar de la subcolección de participantes
  const participantRef = doc(db, 'cards', cardId, 'participants', participantId);
  batch.delete(participantRef);

  // 3. Eliminar todas las categorizaciones del participante
  const expensesRef = collection(db, 'cards', cardId, 'expenses');
  const expensesSnap = await getDocs(expensesRef);

  expensesSnap.docs.forEach((expenseDoc) => {
    const categorizationRef = doc(db, 'cards', cardId, 'expenses', expenseDoc.id, 'categorizations', participantId);
    batch.delete(categorizationRef);
  });

  await batch.commit();
};

/**
 * Permite a un usuario salir de una tarjeta compartida, eliminando sus categorizaciones personales.
 * @param {string} cardId - ID de la tarjeta.
 * @param {string} userId - ID del usuario que sale.
 */
export const leaveSharedCard = async (cardId, userId) => {

  if (!cardId || !userId) throw new Error('Card ID and User ID are required.');

  const batch = writeBatch(db);

  try {
    // 1. Eliminar al usuario de la lista de miembros de la tarjeta
    const cardRef = doc(db, 'cards', cardId);
    batch.update(cardRef, {
      members: arrayRemove(userId),
      updatedAt: serverTimestamp(),
    });

    // 2. Eliminar al participante de la subcolección de participantes
    const participantRef = doc(db, 'cards', cardId, 'participants', userId);
    batch.delete(participantRef);

    // 3. Eliminar todas las categorizaciones personales del usuario para esta tarjeta
    const expensesRef = collection(db, 'cards', cardId, 'expenses');
    const expensesSnap = await getDocs(expensesRef);

    expensesSnap.docs.forEach((expenseDoc) => {
      const categorizationRef = doc(db, 'cards', cardId, 'expenses', expenseDoc.id, 'categorizations', userId);
      batch.delete(categorizationRef);
    });

    await batch.commit();

  } catch (error) {
    console.error('❌ Error leaving shared card:', error);
    console.error('❌ Error details:', error.code, error.message);
    throw error;
  }
};

/**
 * Crea o actualiza un código en la colección global 'shareCodes'.
 * @param {string} ownerId - ID del dueño de la tarjeta.
 * @param {string} cardId - ID de la tarjeta.
 * @param {string} code - El código a crear/actualizar.
 */
export const upsertShareCode = (currentUserId, ownerId, cardId, code) => {
  if (!currentUserId) throw new Error('Current user ID is required.');
  if (!ownerId || !cardId || !code) throw new Error('Owner ID, Card ID and Code are required.');

  // Verify that current user is the owner
  if (currentUserId !== ownerId) {
    throw new Error('Only the card owner can create share codes.');
  }

  const codeRef = doc(db, 'shareCodes', code);
  return setDoc(codeRef, {
    ownerId: ownerId,
    cardId: cardId,
    createdAt: serverTimestamp(),
  });
};

/**
 * Elimina un código de la colección global 'shareCodes'.
 * @param {string} code - El código a eliminar.
 * @param {string} currentUserId - ID del usuario actual.
 */
export const removeShareCode = async (code, currentUserId) => {
  if (!code) throw new Error('Code is required.');
  if (!currentUserId) throw new Error('Current user ID is required.');

  // First, check if the code exists and get the owner
  const codeRef = doc(db, 'shareCodes', code);
  const codeSnap = await getDoc(codeRef);

  if (!codeSnap.exists()) {
    throw new Error('Share code not found.');
  }

  const codeData = codeSnap.data();
  const ownerId = codeData.ownerId;

  // Verify that current user is the owner
  if (currentUserId !== ownerId) {
    throw new Error('Only the card owner can remove share codes.');
  }

  return deleteDoc(codeRef);
};


// --- Funciones para Planes (Plans) ---

/**
 * Obtiene los planes de un usuario en tiempo real.
 * @param {string} userId - ID del usuario.
 * @param {function} callback - Función a llamar con los planes.
 * @returns {function} Función para desuscribirse.
 */
export const getPlans = (userId, callback) => {
  if (!userId) return () => {};
  const plansRef = collection(db, 'plan');
  const q = query(plansRef, where('members', 'array-contains', userId));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const plans = [];
    querySnapshot.forEach((doc) => {
      plans.push({ id: doc.id, ...doc.data() });
    });
    callback(plans);
  }, (error) => {
    console.error('Error getting plans:', error);
  });
  
  return unsubscribe;
};


/**
 * Añade un nuevo plan.
 * @param {string} userId - ID del usuario que crea el plan.
 * @param {object} planData - Datos del plan.
 * @returns {Promise<DocumentReference>}
 */
export const addPlan = (userId, planData) => {
  if (!userId) throw new Error('User ID is required to add a plan.');
  const plansRef = collection(db, 'plan');
  return addDoc(plansRef, {
    ...planData,
    ownerId: userId,
    members: [userId],
    createdAt: serverTimestamp(),
  });
};

/**
 * Obtiene los datos de un plan específico en tiempo real.
 * @param {string} planId - ID del plan.
 * @param {function} callback - Función a llamar con los datos del plan.
 * @returns {function} Función para desuscribirse.
 */
export const getPlanById = (planId, callback) => {
  if (!planId) return () => {};
  const planDocRef = doc(db, 'plan', planId);
  
  const unsubscribe = onSnapshot(planDocRef, (doc) => {
    callback(doc.exists() ? { id: doc.id, ...doc.data() } : null);
  }, (error) => {
    console.error('Error getting plan by ID:', error);
  });

  return unsubscribe;
};


/**
 * Actualiza un plan.
 * @param {string} planId - ID del plan.
 * @param {object} updatedData - Datos a actualizar.
 * @returns {Promise<void>}
 */
export const updatePlan = (planId, updatedData) => {
  if (!planId) throw new Error('Plan ID is required to update a plan.');
  const planDocRef = doc(db, 'plan', planId);
  return updateDoc(planDocRef, {
    ...updatedData,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Elimina un plan.
 * @param {string} planId - ID del plan.
 * @returns {Promise<void>}
 */
export const deletePlan = async (userId, planId) => {
  if (!userId || !planId) throw new Error('User ID and Plan ID are required to delete a plan.');

  const batch = writeBatch(db);

  // Obtener el plan para verificar si es de ahorro
  const planDocRef = doc(db, 'plan', planId);
  const planSnap = await getDoc(planDocRef);

  if (!planSnap.exists()) {
    throw new Error('Plan not found.');
  }

  const planData = planSnap.data();

  // Si es un plan de ahorro, buscar y borrar su categoría
  if (planData.kind === 'savings') {
    // Buscar la categoría del plan en las categorías del usuario
    const categoriesRef = collection(db, 'users', userId, 'categories');
    const categoriesQuery = query(categoriesRef, where('planId', '==', planId));
    const categoriesSnap = await getDocs(categoriesQuery);

    categoriesSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
  }

  // Borrar el plan
  batch.delete(planDocRef);

  return batch.commit();
};

/**
 * Une un usuario a un plan.
 * @param {string} userId - ID del usuario a unir.
 * @param {string} planId - ID del plan.
 */
export const joinPlanById = (userId, planId) => {
  if (!userId || !planId) throw new Error('User ID and Plan ID are required.');
  const planRef = doc(db, 'plan', planId);
  return updateDoc(planRef, {
    members: arrayUnion(userId),
  });
};

// --- Subcolecciones de Planes ---

/**
 * Obtiene los logs de ahorro de un plan en tiempo real.
 * @param {string} planId - ID del plan.
 * @param {function} callback - Función a llamar con los logs.
 * @returns {function} Función para desuscribirse.
 */
export const getPlanSavingsLogs = (planId, callback) => {
  if (!planId) return () => {};
  const logsRef = collection(db, 'plan', planId, 'savingsLogs');
  const unsubscribe = onSnapshot(logsRef, (qs) => {
    const logs = {};
    qs.forEach((docSnap) => {
      logs[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
    });
    callback(logs);
  }, (error) => {
    console.error('Error getting savings logs:', error);
  });
  return unsubscribe;
};


/**
 * Crea/actualiza el log de ahorro de un día y actualiza el monto actual del plan.
 * @param {string} planId - ID del plan.
 * @param {string} userId - ID del usuario que hace el log.
 * @param {string} dateId - ID del log (ej. 'YYYY-MM-DD').
 * @param {number} amount - Monto a registrar.
 * @param {number} currentPlanAmount - Monto actual del plan antes de esta actualización.
 * @returns {Promise<number>} El delta aplicado al monto del plan.
 */
export const upsertPlanSavingLog = async (planId, userId, dateId, amount, currentPlanAmount) => {
  if (!planId || !userId || !dateId) throw new Error('planId, userId and dateId are required');
  
  const planRef = doc(db, 'plan', planId);
  const logRef = doc(db, 'plan', planId, 'savingsLogs', dateId);
  
  const logSnap = await getDoc(logRef);
  const previousAmount = logSnap.exists() ? (Number(logSnap.data().amount) || 0) : 0;
  const newAmount = Number(amount) || 0;
  const delta = newAmount - previousAmount;

  const batch = writeBatch(db);

  // 1. Actualizar el log del día
  batch.set(logRef, { amount: newAmount, userId, timestamp: serverTimestamp() }, { merge: true });
  
  // 2. Actualizar el monto actual del plan
  batch.update(planRef, { 
    currentAmount: (Number(currentPlanAmount) || 0) + delta,
    updatedAt: serverTimestamp() 
  });

  await batch.commit();
  return delta;
};

// --- Gestión: Personas y Gastos por Plan ---

/**
 * Escucha en tiempo real las personas de un plan de gestión
 */
export const getPlanPeople = (planId, callback) => {
  if (!planId) return () => {};
  const peopleRef = collection(db, 'plan', planId, 'people');
  const unsubscribe = onSnapshot(peopleRef, (qs) => {
    const people = [];
    qs.forEach((docSnap) => people.push({ id: docSnap.id, ...docSnap.data() }));
    callback(people);
  }, (error) => {
    console.error('Error getting plan people:', error);
    callback([]);
  });
  return unsubscribe;
};


export const addPlanPerson = (planId, data) => {
  if (!planId) throw new Error('planId is required');
  const peopleRef = collection(db, 'plan', planId, 'people');
  return addDoc(peopleRef, { ...data, createdAt: serverTimestamp() });
};

export const upsertPlanPersonByUserId = async (planId, userId, data) => {
  if (!planId || !userId) throw new Error('planId and userId are required');
  const peopleRef = collection(db, 'plan', planId, 'people');
  const q = query(peopleRef, where('userId', '==', userId));
  const qs = await getDocs(q);
  if (qs.empty) {
    return addDoc(peopleRef, { ...data, userId, createdAt: serverTimestamp() });
  } else {
    const personId = qs.docs[0].id;
    const ref = doc(db, 'plan', planId, 'people', personId);
    return setDoc(ref, { ...data, userId }, { merge: true });
  }
};

export const deletePlanPerson = (planId, personId) => {
  if (!planId || !personId) throw new Error('planId and personId are required');
  const ref = doc(db, 'plan', planId, 'people', personId);
  return deleteDoc(ref);
};

/**
 * Elimina una persona y, si tiene userId, la remueve de members del plan.
 */
export const deletePlanPersonAndMember = async (planId, person) => {
  if (!planId || !person?.id) throw new Error('planId and person are required');
  const ref = doc(db, 'plan', planId, 'people', person.id);
  const planRef = doc(db, 'plan', planId);
  const batch = writeBatch(db);
  batch.delete(ref);
  if (person.userId) {
    batch.update(planRef, { members: arrayRemove(person.userId), updatedAt: serverTimestamp() });
  }
  return batch.commit();
};

/**
 * Escucha en tiempo real los gastos de un plan de gestión
 */
export const getPlanExpenses = (planId, callback) => {
  if (!planId) return () => {};
  const expensesRef = collection(db, 'plan', planId, 'expenses');
  const q = query(expensesRef, orderBy('timestamp', 'desc'));
  const unsubscribe = onSnapshot(q, (qs) => {
    const list = [];
    qs.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
    callback(list);
  }, (error) => {
    console.error('Error getting plan expenses:', error);
    callback([]);
  });
  return unsubscribe;
};


export const addPlanExpense = (planId, data) => {
  if (!planId) throw new Error('planId is required');
  const expensesRef = collection(db, 'plan', planId, 'expenses');
  return addDoc(expensesRef, { ...data, timestamp: serverTimestamp() });
};

export const updatePlanExpense = (planId, expenseId, data) => {
  if (!planId || !expenseId) throw new Error('planId and expenseId are required');
  const ref = doc(db, 'plan', planId, 'expenses', expenseId);
  return updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

export const deletePlanExpense = (planId, expenseId) => {
  if (!planId || !expenseId) throw new Error('planId and expenseId are required');
  const ref = doc(db, 'plan', planId, 'expenses', expenseId);
  return deleteDoc(ref);
};

export const settlePayment = async (planId, fromPerson, toPerson, amount) => {
  if (!planId || !fromPerson || !toPerson || !amount) {
    throw new Error('planId, fromPerson, toPerson, and amount are required');
  }

  // Check if the recipient has any cards
  const cardsRef = collection(db, 'cards');
  const recipientCardsQuery = query(cardsRef, where('members', 'array-contains', toPerson.userId));
  const recipientCardsSnapshot = await getDocs(recipientCardsQuery);

  const batch = writeBatch(db);
  const expensesRef = collection(db, 'plan', planId, 'expenses');

  // Always create the settlement record in the plan
  const expenseFrom = {
    payerId: fromPerson.id,
    description: `Payment to ${toPerson.name}`,
    amount: Math.abs(amount),
    date: new Date().toISOString().slice(0,10),
    createdBy: fromPerson.userId,
    settlement: true,
  };
  const fromDocRef = doc(expensesRef);
  batch.set(fromDocRef, expenseFrom);

  // If recipient has cards, create direct expense
  if (!recipientCardsSnapshot.empty) {
    const expenseTo = {
      payerId: toPerson.id,
      description: `Payment from ${fromPerson.name}`,
      amount: -Math.abs(amount),
      date: new Date().toISOString().slice(0,10),
      createdBy: fromPerson.userId,
      settlement: true,
    };
    const toDocRef = doc(expensesRef);
    batch.set(toDocRef, expenseTo);
  } else {
    // If recipient has no cards, create a pending transaction for them to categorize
    const pendingTransaction = {
      userId: toPerson.userId,
      amount: Math.abs(amount), // Positive income for the recipient
      description: `Settlement payment from ${fromPerson.name} in plan`,
      type: 'income',
      date: new Date().toISOString().slice(0,10),
      settlement: true,
      planId: planId,
      pending: true,
      createdAt: serverTimestamp(),
    };
    const pendingRef = doc(collection(db, 'transactions'));
    batch.set(pendingRef, pendingTransaction);
  }

  return batch.commit();
};

// --- Invitaciones a Planes (link único) ---
export const createPlanInvite = async (planId, ownerId) => {
  if (!planId || !ownerId) throw new Error('planId and ownerId are required');
  // código simple A-Z0-9 de 6 caracteres
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += characters.charAt(Math.floor(Math.random() * characters.length));
  const ref = doc(db, 'planInvites', code);
  await setDoc(ref, { planId, ownerId, createdAt: serverTimestamp() });
  // guardar el código también en el documento del plan para fácil acceso
  const planRef = doc(db, 'plan', planId);
  await updateDoc(planRef, { inviteCode: code, updatedAt: serverTimestamp() });
  return { code };
};

export const joinPlanByInvite = async (currentUserId, code) => {
  if (!currentUserId || !code) throw new Error('User ID and invite code required');
  const inviteRef = doc(db, 'planInvites', code);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) throw new Error('Invalid or expired invite');
  const { planId } = snap.data();
  const planRef = doc(db, 'plan', planId);
  await updateDoc(planRef, { members: arrayUnion(currentUserId) });
  return { planId };
};

/**
 * Obtiene el código de invitación más reciente de un plan.
 * @param {string} planId
 * @returns {Promise<{code: string} | null>}
 */
export const getLatestPlanInvite = async (planId) => {
  if (!planId) throw new Error('planId is required');
  const invitesRef = collection(db, 'planInvites');
  const q = query(invitesRef, where('planId', '==', planId), orderBy('createdAt', 'desc'));
  const qs = await getDocs(q);
  const first = qs.docs[0];
  if (!first) return null;
  return { code: first.id, ...first.data() };
};

/**
 * Obtiene o crea un código de invitación para un plan.
 */
export const getOrCreatePlanInvite = async (planId, ownerId) => {
  if (!planId) throw new Error('planId is required');
  const planRef = doc(db, 'plan', planId);
  const snap = await getDoc(planRef);
  if (!snap.exists()) throw new Error('Plan not found');
  const data = snap.data();
  if (data?.inviteCode) return { code: data.inviteCode };
  // si no hay código y el solicitante es el dueño, crearlo
  if (ownerId && data?.ownerId === ownerId) {
    return await createPlanInvite(planId, ownerId);
  }
  throw new Error('Invite code not available. Ask the owner to generate it.');
};

export const getPlanInviteCode = async (planId) => {
  if (!planId) throw new Error('planId is required');
  const planRef = doc(db, 'plan', planId);
  const snap = await getDoc(planRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return data?.inviteCode ? { code: data.inviteCode } : null;
};

/**
 * Permite a un usuario salir de un plan.
 * - Lo elimina del array de miembros
 * - Elimina sus documentos en people/{person} vinculados a su userId
 */
export const leavePlan = async (planId, userId) => {
  if (!planId || !userId) throw new Error('planId and userId are required');
  const planRef = doc(db, 'plan', planId);
  await updateDoc(planRef, { members: arrayRemove(userId) });
  // borrar people con userId == userId
  const peopleRef = collection(db, 'plan', planId, 'people');
  const q = query(peopleRef, where('userId', '==', userId));
  const qs = await getDocs(q);
  const batch = writeBatch(db);
  qs.forEach((docSnap) => {
    batch.delete(doc(db, 'plan', planId, 'people', docSnap.id));
  });
  await batch.commit();
};

// --- Funciones para Transacciones Pendientes ---

/**
 * Crea una transacción pendiente (sin categoría/tarjeta asignada)
 * @param {string} userId - ID del usuario
 * @param {object} transactionData - Datos de la transacción
 */
export const addPendingTransaction = (userId, transactionData) => {
  if (!userId) throw new Error('User ID is required to add pending transaction.');


  const transactionsRef = collection(db, 'transactions');
  return addDoc(transactionsRef, {
    ...transactionData,
    userId: userId,
    pending: true,
    createdAt: serverTimestamp(),
  }).then((docRef) => {
    return docRef;
  });
};

/**
 * Actualiza una transacción pendiente asignándole categoría/tarjeta
 * @param {string} transactionId - ID de la transacción
 * @param {object} updateData - Datos de actualización
 */
export const updatePendingTransaction = async (transactionId, updateData) => {
  if (!transactionId) throw new Error('Transaction ID is required.');

  // First, get the pending transaction to check if it's shared
  const transactionRef = doc(db, 'transactions', transactionId);
  const transactionSnap = await getDoc(transactionRef);

  if (!transactionSnap.exists()) {
    throw new Error('Transaction not found.');
  }

  const transactionData = transactionSnap.data();
  const isSharedExpense = transactionData.sharedExpense || false;

  const batch = writeBatch(db);

  if (isSharedExpense) {
    // For shared expenses, create a personal categorized copy instead of updating the original
    // Keep the original transaction as pending for other users

    // Create the actual expense in the card with user's category
    const expenseData = {
      amount: updateData.amount || 0,
      description: updateData.description || 'Transacción categorizada',
      type: updateData.type || 'expense',
      date: updateData.date,
      timestamp: serverTimestamp(),
      createdBy: updateData.userId,
      sharedExpenseId: transactionId, // Reference to the original shared expense
      personalCategorization: true, // Mark as personal categorization
    };

    const expenseRef = doc(collection(db, 'cards', updateData.cardId, 'expenses'));
    batch.set(expenseRef, expenseData);

    if (updateData.category) {
      const categorizationRef = doc(expenseRef, 'categorizations', updateData.userId);
      batch.set(categorizationRef, {
        category: updateData.category,
        userId: updateData.userId,
        categorizedAt: serverTimestamp(),
      });
    }

    // Mark this transaction as categorized by this user (but keep it pending for others)
    const userCategorizationRef = doc(db, 'transactions', transactionId, 'categorizations', updateData.userId);
    batch.set(userCategorizationRef, {
      userId: updateData.userId,
      category: updateData.category,
      cardId: updateData.cardId,
      categorizedAt: serverTimestamp(),
    });

  } else {
    // For regular pending transactions, update as before
    batch.update(transactionRef, {
      ...updateData,
      pending: false,
      updatedAt: serverTimestamp(),
    });

    // Create the actual expense in the card
    const expenseData = {
      amount: updateData.amount || 0,
      description: updateData.description || 'Categorized Transaction',
      type: updateData.type || 'expense',
      date: updateData.date,
      timestamp: serverTimestamp(),
      createdBy: updateData.userId,
    };

    const expenseRef = doc(collection(db, 'cards', updateData.cardId, 'expenses'));
    batch.set(expenseRef, expenseData);

    if (updateData.category) {
      const categorizationRef = doc(expenseRef, 'categorizations', updateData.userId);
      batch.set(categorizationRef, {
        category: updateData.category,
        userId: updateData.userId,
        categorizedAt: serverTimestamp(),
      });
    }
  }

  return batch.commit();
};

/**
 * Elimina una transacción pendiente
 * @param {string} transactionId - ID de la transacción
 */
export const deletePendingTransaction = (transactionId) => {
  if (!transactionId) throw new Error('Transaction ID is required.');
  const transactionRef = doc(db, 'transactions', transactionId);
  return deleteDoc(transactionRef);
};

/**
 * Verifica si un usuario ya ha categorizado un gasto compartido
 * @param {string} transactionId - ID de la transacción compartida
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} True si ya ha sido categorizada por este usuario
 */
export const hasUserCategorizedSharedExpense = async (transactionId, userId) => {
  if (!transactionId || !userId) return false;

  try {
    const categorizationRef = doc(db, 'transactions', transactionId, 'categorizations', userId);
    const categorizationSnap = await getDoc(categorizationRef);
    return categorizationSnap.exists();
  } catch (error) {
    console.error('Error checking user categorization:', error);
    return false;
  }
};


/**
 * Obtiene las transacciones pendientes de un usuario (incluyendo gastos compartidos no categorizados)
 * @param {string} userId - ID del usuario
 * @param {function} callback - Función a llamar con los datos
 * @returns {function} Función para desuscribirse
 */
export const getPendingTransactions = (userId, callback) => {
  if (!userId) return () => {};

  // Get transactions where user is the intended recipient and are pending
  const transactionsRef = collection(db, 'transactions');
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('pending', '==', true)
  );


  const unsubscribe = onSnapshot(q, async (querySnapshot) => {
    const transactionsPromises = querySnapshot.docs.map(async (doc) => {
      const transactionData = doc.data();

      // For shared expenses, check if user has already categorized it
      if (transactionData.sharedExpense) {
        const alreadyCategorized = await hasUserCategorizedSharedExpense(doc.id, userId);
        if (alreadyCategorized) {
          return null; // Skip this transaction as user already categorized it
        }
      }

      return { id: doc.id, ...transactionData };
    });

    try {
      const transactions = (await Promise.all(transactionsPromises)).filter(Boolean);
      callback(transactions);
    } catch (error) {
      console.error('Error processing pending transactions:', error);
      callback([]);
    }
  }, (error) => {
    console.error('Error getting pending transactions:', error);
    // Handle permission errors silently when transactions are deleted
    if (error.code === 'permission-denied') {
      callback([]); // Return empty array instead of error
    } else {
      console.error('Error getting pending transactions:', error);
      callback([]);
    }
  });

  return unsubscribe;
};

/**
 * Obtiene todos los gastos recurrentes de un usuario.
 * @param {string} userId - ID del usuario.
 * @param {function} callback - Función que recibe la lista de gastos recurrentes.
 * @returns {function} Función para cancelar la suscripción.
 */
export const getRecurringExpenses = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const expensesQuery = query(
    collectionGroup(db, 'expenses'),
    where('createdBy', '==', userId),
    where('recurrence', '!=', 'one-time')
  );

  const unsubscribe = onSnapshot(expensesQuery, (querySnapshot) => {
    const expenses = [];
    querySnapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data(), cardId: doc.ref.parent.parent.id });
    });
    callback(expenses);
  }, (error) => {
    console.error('Error getting recurring expenses:', error);
    // This can happen if the required index is not created yet.
    // Firebase will provide a link in the console logs to create it.
    callback([]);
  });

  return unsubscribe;
};


// --- Funciones para generar códigos de compartir ---

/**
 * Genera un código aleatorio de 6 caracteres para compartir tarjetas.
 * @returns {string} Código generado.
 */
const generateShareCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Comparte una tarjeta generando un código único automáticamente.
 * @param {string} cardId - ID de la tarjeta a compartir.
 * @returns {Promise<string>} El código de compartir generado.
 */
export const shareCard = async (cardId, currentUserId) => {
  if (!cardId) throw new Error('Card ID is required.');
  if (!currentUserId) throw new Error('Current user ID is required.');

  const cardRef = doc(db, 'cards', cardId);

  // First, get the card to obtain ownerId and verify ownership
  const cardSnap = await getDoc(cardRef);
  if (!cardSnap.exists()) {
    throw new Error('Card not found.');
  }
  const cardData = cardSnap.data();
  const ownerId = cardData.ownerId;

  // Verify that current user is the owner
  if (currentUserId !== ownerId) {
    throw new Error('Only the card owner can share the card.');
  }

  // Generar código único (verificar que no exista en shareCodes)
  let shareCode;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    shareCode = generateShareCode();
    attempts++;

    // Verificar si el código ya existe en shareCodes
    const shareCodeRef = doc(db, 'shareCodes', shareCode);
    const shareCodeSnap = await getDoc(shareCodeRef);

    if (!shareCodeSnap.exists()) {
      break; // Código único encontrado
    }

    if (attempts >= maxAttempts) {
      throw new Error('Could not generate a unique share code. Please try again.');
    }
  } while (true);

  // Usar batch para actualizar tanto la tarjeta como crear el código en shareCodes
  const batch = writeBatch(db);

  // 1. Actualizar la tarjeta con el código generado y marcar como compartida
  batch.update(cardRef, {
    shareCode: shareCode,
    isShared: true,
    updatedAt: serverTimestamp(),
  });

  // 2. Crear el código en la colección shareCodes
  const shareCodeDocRef = doc(db, 'shareCodes', shareCode);
  batch.set(shareCodeDocRef, {
    cardId: cardId,
    ownerId: ownerId,
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  return shareCode;
};

/**
 * Deja de compartir una tarjeta eliminando su código.
 * @param {string} cardId - ID de la tarjeta.
 * @param {string} currentUserId - ID del usuario actual.
 * @returns {Promise<void>}
 */
export const unshareCard = async (cardId, currentUserId) => {
  if (!cardId) throw new Error('Card ID is required.');
  if (!currentUserId) throw new Error('Current user ID is required.');

  const cardRef = doc(db, 'cards', cardId);

  // Obtener el código actual de la tarjeta
  const cardSnap = await getDoc(cardRef);
  if (!cardSnap.exists()) {
    throw new Error('Card not found.');
  }

  const cardData = cardSnap.data();
  const shareCode = cardData.shareCode;
  const ownerId = cardData.ownerId;

  // Verify that current user is the owner
  if (currentUserId !== ownerId) {
    throw new Error('Only the card owner can stop sharing the card.');
  }

  const batch = writeBatch(db);

  // 1. Actualizar la tarjeta eliminando el código y marcando como no compartida
  batch.update(cardRef, {
    shareCode: null,
    isShared: false,
    updatedAt: serverTimestamp(),
  });

  // 2. Eliminar el código de la colección shareCodes si existe
  if (shareCode) {
    const shareCodeRef = doc(db, 'shareCodes', shareCode);
    batch.delete(shareCodeRef);
  }

  await batch.commit();
};

// --- Funciones para Presupuestos (Budgets) ---

/**
 * Agrega un nuevo presupuesto a la colección 'budgets'.
 * @param {string} userId - ID del usuario.
 * @param {object} budgetData - Datos del presupuesto.
 */
export const addBudget = async (userId, budgetData) => {
  if (!userId) throw new Error('User ID is required.');
  const budgetsCollectionRef = collection(db, 'budgets');
  return addDoc(budgetsCollectionRef, {
    ...budgetData,
    userId,
    createdAt: serverTimestamp(),
  });
};

/**
 * Actualiza un presupuesto existente.
 * @param {string} budgetId - ID del presupuesto.
 * @param {object} budgetData - Datos actualizados del presupuesto.
 */
export const updateBudget = async (budgetId, budgetData) => {
  if (!budgetId) throw new Error('Budget ID is required.');
  const budgetDocRef = doc(db, 'budgets', budgetId);
  return updateDoc(budgetDocRef, {
    ...budgetData,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Elimina un presupuesto existente.
 * @param {string} budgetId - ID del presupuesto.
 */
export const deleteBudget = async (budgetId) => {
  if (!budgetId) throw new Error('Budget ID is required.');
  const budgetDocRef = doc(db, 'budgets', budgetId);
  return deleteDoc(budgetDocRef);
};

/**
 * Obtiene un presupuesto específico por ID.
 * @param {string} budgetId - ID del presupuesto.
 * @param {function} callback - Función que recibe los datos del presupuesto.
 */
export const getBudget = (budgetId, callback) => {
  if (!budgetId) {
    callback(null);
    return () => {};
  }

  const budgetDocRef = doc(db, 'budgets', budgetId);

  const unsubscribe = onSnapshot(budgetDocRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() });
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error getting budget:', error);
    callback(null);
  });

  return unsubscribe;
};


/**
 * Obtiene todos los presupuestos de un usuario desde la colección 'budgets'.
 * @param {string} userId - ID del usuario.
 * @param {function} callback - Función que recibe la lista de presupuestos.
 * @returns {function} Función para cancelar la suscripción.
 */
export const getBudgets = (userId, callback) => {
  if (!userId) {
    console.error('User ID is required for getBudgets');
    callback([]);
    return () => {};
  }

  const budgetsCollectionRef = collection(db, 'budgets');
  const q = query(
    budgetsCollectionRef,
    where('userId', '==', userId)
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const budgets = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })).sort((a, b) => {
      // Ordenar manualmente por createdAt descendente
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    callback(budgets);
  }, (error) => {
    console.error('Error getting budgets:', error);
    callback([]);
  });

  return unsubscribe;
};

// --- Funciones para Categorizaciones de Expenses ---

/**
 * Establece una categorización individual para una expense en una tarjeta compartida
 * @param {string} cardId - ID de la tarjeta
 * @param {string} expenseId - ID de la expense
 * @param {string} userId - ID del usuario
 * @param {object} categorizationData - Datos de la categorización
 */
export const setExpenseCategorization = async (cardId, expenseId, userId, categorizationData) => {

  if (!cardId || !expenseId || !userId) {
    throw new Error('Card ID, Expense ID, and User ID are required.');
  }

  const categorizationRef = doc(db, 'cards', cardId, 'expenses', expenseId, 'categorizations', userId);
  const expenseRef = doc(db, 'cards', cardId, 'expenses', expenseId);

  try {
    const dataToSave = {
      ...categorizationData,
      userId,
      categorizedAt: serverTimestamp(),
    };

    const batch = writeBatch(db);

    // 1. Save the categorization
    batch.set(categorizationRef, dataToSave);

    // 2. Update the expense status if it was pending (for individual expenses)
    // Only update status for individual expenses, not shared ones
    batch.update(expenseRef, {
      status: 'completed', // Change from 'pending' to 'completed'
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    // Verify the categorization was saved
    const savedDoc = await getDoc(categorizationRef);
    if (!savedDoc.exists()) {
      throw new Error('Categorization was not saved to Firestore');
    }

  } catch (error) {
    console.error('❌ Error saving categorization:', error);
    throw error;
  }
};

/**
 * Obtiene todas las categorizaciones para una expense específica
 * @param {string} cardId - ID de la tarjeta
 * @param {string} expenseId - ID de la expense
 * @param {function} callback - Función que recibe las categorizaciones
 */
export const getExpenseCategorizations = (cardId, expenseId, callback) => {
  if (!cardId || !expenseId) {
    callback({});
    return () => {};
  }

  const categorizationsCollectionRef = collection(db, 'cards', cardId, 'expenses', expenseId, 'categorizations');

  const unsubscribe = onSnapshot(categorizationsCollectionRef, (querySnapshot) => {
    const categorizations = {};
    querySnapshot.docs.forEach(doc => {
      categorizations[doc.id] = doc.data();
    });
    callback(categorizations);
  }, (error) => {
    console.error('Error getting expense categorizations:', error);
    callback({});
  });

  return unsubscribe;
};

/**
 * Obtiene todas las categorizaciones para todas las expenses de una tarjeta
 * @param {string} cardId - ID de la tarjeta
 * @param {function} callback - Función que recibe todas las categorizaciones organizadas por expenseId
 */
export const getExpenseCategorizationsForCard = (cardId, callback) => {
  if (!cardId) {
    callback({});
    return () => {};
  }

  const expensesCollectionRef = collection(db, 'cards', cardId, 'expenses');

  const unsubscribe = onSnapshot(expensesCollectionRef, (expensesSnapshot) => {
    const allCategorizations = {};
    let loadedCount = 0;

    // Si no hay expenses, devolver vacío inmediatamente
    if (expensesSnapshot.docs.length === 0) {
      callback({});
      return;
    }

    // Para cada expense, obtener sus categorizaciones
    expensesSnapshot.docs.forEach(expenseDoc => {
      const expenseId = expenseDoc.id;
      const categorizationsRef = collection(db, 'cards', cardId, 'expenses', expenseId, 'categorizations');

      const expenseUnsubscribe = onSnapshot(categorizationsRef, (categorizationsSnapshot) => {
        const expenseCategorizations = {};
        categorizationsSnapshot.docs.forEach(catDoc => {
          expenseCategorizations[catDoc.id] = catDoc.data();
        });

        allCategorizations[expenseId] = expenseCategorizations;
        loadedCount++;

        // Notificar cuando tengamos todas las categorizaciones de todas las expenses
        if (loadedCount === expensesSnapshot.docs.length) {
          callback({ ...allCategorizations });
        }
      }, (error) => {
        // Handle permission errors or other issues silently
        if (error.code === 'permission-denied') {
          // Skip this categorization, continue with others
          loadedCount++;
          if (loadedCount === expensesSnapshot.docs.length) {
            callback({ ...allCategorizations });
          }
        }
      });
    });

    // Retornar función para desuscribir (aunque no se usa realmente aquí)
    return () => {
      // Los unsubscribes individuales se manejan automáticamente
    };
  }, (error) => {
    // Handle permission errors for the main expenses collection
    if (error.code === 'permission-denied') {
      callback({});
    }
  });

  return unsubscribe;
};



// --- Funciones para Cuentas Bancarias (Accounts) ---

/**
 * Crea una nueva cuenta bancaria en la colección 'accounts'.
 * @param {object} accountData - Datos de la cuenta bancaria.
 * @returns {Promise<DocumentReference>}
 */
export const createAccount = async (accountData, customId = null) => {
  if (!accountData.userId) throw new Error('User ID is required to create an account.');

  const accountsRef = collection(db, 'accounts');

  let accountDoc;
  if (customId) {
    // Use custom ID
    const customDocRef = doc(accountsRef, customId);
    await setDoc(customDocRef, {
      ...accountData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    accountDoc = { id: customId };
    console.log('✅ Account created in Firestore with custom ID:', customId);
  } else {
    // Use auto-generated ID
    accountDoc = await addDoc(accountsRef, {
      ...accountData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('✅ Account created in Firestore with auto-generated ID:', accountDoc.id);
  }

  return accountDoc;
};

/**
 * Obtiene el userId de una cuenta por su accountId.
 * @param {string} accountId - ID de la cuenta.
 * @returns {Promise<string|null>} User ID del propietario de la cuenta o null si no se encuentra.
 */
export const getUserIdByAccountId = async (accountId) => {
  if (!accountId) return null;

  try {
    const accountDoc = await getDoc(doc(db, 'accounts', accountId));
    if (accountDoc.exists()) {
      return accountDoc.data().userId || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting userId by accountId:', error);
    return null;
  }
};

/**
 * Actualiza el balance de una cuenta (usando transacción para consistencia)
 * @param {string} accountId - ID de la cuenta
 * @param {number} amount - Monto a agregar (positivo) o restar (negativo)
 * @returns {Promise<{success: boolean, newBalance: number}>}
 */
export const updateAccountBalance = async (accountId, amount) => {
  if (!accountId) throw new Error('Account ID is required');
  if (typeof amount !== 'number') throw new Error('Amount must be a number');

  const accountRef = doc(db, 'accounts', accountId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      const accountDoc = await transaction.get(accountRef);

      if (!accountDoc.exists()) {
        throw new Error('Account not found');
      }

      const currentData = accountDoc.data();
      const currentBalance = currentData.balance || 0;
      const newBalance = currentBalance + amount;

      // Validar que no quede balance negativo (salvo overdraft permitido)
      if (newBalance < 0 && !currentData.allowOverdraft) {
        throw new Error('Insufficient funds');
      }

      transaction.update(accountRef, {
        balance: newBalance,
        updatedAt: serverTimestamp(),
      });

      return { success: true, newBalance, previousBalance: currentBalance };
    });

    console.log(`✅ Account ${accountId} balance updated: ${result.previousBalance} → ${result.newBalance}`);
    return result;

  } catch (error) {
    console.error('❌ Error updating account balance:', error);
    throw error;
  }
};

// --- Funciones para Transacciones (Transactions) ---

/**
 * Crea una nueva transacción en la colección 'transactions'.
 * @param {object} transactionData - Datos de la transacción.
 * @returns {Promise<DocumentReference>}
 */
export const createTransaction = async (transactionData) => {
  if (!transactionData.userId) throw new Error('User ID is required to create a transaction.');
  if (!transactionData.type) throw new Error('Transaction type is required.');

  const transactionsRef = collection(db, 'transactions');
  const transactionDoc = await addDoc(transactionsRef, {
    ...transactionData,
    status: transactionData.status || 'completed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log('✅ Transaction created in Firestore with ID:', transactionDoc.id);
  return transactionDoc;
};

/**
 * Crea una nueva compra (purchase) en Firestore.
 * @param {Object} purchaseData - Datos de la compra.
 * @returns {Promise<DocumentReference>} Referencia al documento creado.
 */
export const createPurchase = async (purchaseData) => {
  if (!purchaseData.userId) throw new Error('User ID is required to create a purchase.');
  if (!purchaseData.accountId) throw new Error('Account ID is required to create a purchase.');

  const purchasesRef = collection(db, 'purchases');
  const purchaseDoc = await addDoc(purchasesRef, {
    ...purchaseData,
    status: purchaseData.status || 'completed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log('✅ Purchase created in Firestore with ID:', purchaseDoc.id);
  return purchaseDoc;
};

/**
 * Obtiene las compras de una cuenta en tiempo real.
 * @param {string} accountId - ID de la cuenta.
 * @param {function} callback - Función a llamar con las compras.
 * @returns {function} Función para cancelar la suscripción.
 */
export const getPurchasesByAccount = (accountId, callback) => {
  if (!accountId) {
    console.error('Account ID is required to get purchases');
    return () => {};
  }

  // Get current user to filter purchases by userId first, then by accountId
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error('No authenticated user');
    callback([]);
    return () => {};
  }

  const purchasesRef = collection(db, 'purchases');
  // Query by userId first (more efficient), then filter by accountId in client
  const q = query(purchasesRef, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const allPurchases = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter by accountId in client
    const accountPurchases = allPurchases.filter(purchase => purchase.accountId === accountId);

    console.log(`📦 Purchases for account ${accountId}:`, accountPurchases.length);
    callback(accountPurchases);
  }, (error) => {
    console.error('Error getting purchases:', error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Obtiene las transacciones de un usuario en tiempo real.
 * @param {string} userId - ID del usuario.
 * @param {function} callback - Función a llamar con las transacciones.
 * @param {number} maxResults - Número máximo de transacciones (opcional).
 * @returns {function} Función para desuscribirse.
 */
export const getUserTransactions = (userId, callback, maxResults = 50) => {
  if (!userId) return () => {};

  const transactionsRef = collection(db, 'transactions');
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const transactions = [];
    querySnapshot.forEach((doc) => {
      transactions.push({ id: doc.id, ...doc.data() });
    });
    callback(transactions);
  }, (error) => {
    console.error('Error getting user transactions:', error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Obtiene una transacción específica por ID.
 * @param {string} transactionId - ID de la transacción.
 * @returns {Promise<DocumentSnapshot>}
 */
export const getTransactionById = (transactionId) => {
  if (!transactionId) throw new Error('Transaction ID is required.');
  const transactionRef = doc(db, 'transactions', transactionId);
  return getDoc(transactionRef);
};

/**
 * Obtiene las transacciones de una cuenta específica (como payer o payee).
 * @param {string} accountId - ID de la cuenta.
 * @param {string} userId - ID del usuario autenticado.
 * @param {function} callback - Función a llamar con las transacciones.
 * @param {number} maxResults - Número máximo de transacciones a obtener (default: 50).
 * @returns {function} Función para desuscribirse.
 */
export const getAccountTransactions = (accountId, userId, callback, maxResults = 50) => {
  if (!accountId || !userId) {
    console.warn('Account ID and User ID are required for getAccountTransactions');
    callback([]);
    return () => {};
  }

  console.log('🔍 Getting transactions for account:', accountId, 'user:', userId);

  const transactionsRef = collection(db, 'transactions');

  // Crear consultas separadas para transacciones donde el usuario es payer o payee
  // Usamos consultas simples que no requieren índices compuestos complejos
  const payerQuery = query(
    transactionsRef,
    where('payerUserId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(maxResults * 2) // Obtener más para filtrar
  );

  const payeeQuery = query(
    transactionsRef,
    where('payeeUserId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(maxResults * 2) // Obtener más para filtrar
  );

  let payerTransactions = [];
  let payeeTransactions = [];
  let payerUnsubscribe = null;
  let payeeUnsubscribe = null;

  const combineAndCallback = () => {
    // Combinar todas las transacciones
    const allTransactions = [...payerTransactions, ...payeeTransactions];

    // Filtrar por la cuenta específica
    const accountTransactions = allTransactions.filter(transaction =>
      transaction.payerAccountId === accountId || transaction.payeeAccountId === accountId
    );

    // Eliminar duplicados (por si acaso)
    const uniqueTransactions = accountTransactions.filter((transaction, index, self) =>
      index === self.findIndex(t => t.id === transaction.id)
    );

    // Ordenar por fecha descendente y limitar
    const sortedTransactions = uniqueTransactions
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return dateB - dateA;
      })
      .slice(0, maxResults);

    console.log('✅ Found', sortedTransactions.length, 'transactions for account', accountId);
    callback(sortedTransactions);
  };

  // Listener para transacciones donde el usuario es payer
  payerUnsubscribe = onSnapshot(payerQuery, (querySnapshot) => {
    payerTransactions = [];
    querySnapshot.forEach((doc) => {
      payerTransactions.push({ id: doc.id, ...doc.data() });
    });
    combineAndCallback();
  }, (error) => {
    console.error('❌ Error getting payer transactions:', error);
    payerTransactions = [];
    combineAndCallback();
  });

  // Listener para transacciones donde el usuario es payee
  payeeUnsubscribe = onSnapshot(payeeQuery, (querySnapshot) => {
    payeeTransactions = [];
    querySnapshot.forEach((doc) => {
      payeeTransactions.push({ id: doc.id, ...doc.data() });
    });
    combineAndCallback();
  }, (error) => {
    console.error('❌ Error getting payee transactions:', error);
    payeeTransactions = [];
    combineAndCallback();
  });

  // Función para desuscribirse de ambos listeners
  const unsubscribe = () => {
    if (payerUnsubscribe) payerUnsubscribe();
    if (payeeUnsubscribe) payeeUnsubscribe();
  };

  return unsubscribe;
};

/**
 * Busca el userId del dueño de una tarjeta (card) por su accountNumber.
 * Busca en la colección 'cards' una tarjeta de tipo "Checking" con ese accountNumber.
 * @param {string} accountNumber - Número de cuenta (CLABE) a buscar.
 * @returns {Promise<{userId: string | null, cardData?: object}>}
 */
export const findUserByCardAccountNumber = async (accountNumber) => {
  if (!accountNumber) {
    console.error('❌ Account number is required');
    return { userId: null };
  }

  try {
    console.log('🔍 Searching for card with accountNumber:', accountNumber);
    
    const cardsRef = collection(db, 'cards');
    // Buscar tarjeta con ese accountNumber (CLABE)
    const q = query(cardsRef, where('accountNumber', '==', accountNumber));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Buscar específicamente una tarjeta "Checking"
      for (const docSnap of querySnapshot.docs) {
        const cardData = docSnap.data();
        
        // Verificar que sea tipo Checking o debit
        if (cardData.tipo === 'Checking' || cardData.accountType === 'debit') {
          // Obtener el userId del dueño de la tarjeta
          let userId = null;
          
          // Puede estar en ownerId o en members[0]
          if (cardData.ownerId) {
            userId = cardData.ownerId;
          } else if (cardData.members && cardData.members.length > 0) {
            userId = cardData.members[0];
          } else if (cardData.userId) {
            userId = cardData.userId;
          }
          
          if (userId) {
            console.log('✅ Found card owner userId:', userId);
            return {
              userId: userId,
              cardData: { id: docSnap.id, ...cardData }
            };
          }
        }
      }
      
      console.warn('⚠️ Card found but no Checking/debit type or no userId');
      return { userId: null };
    } else {
      console.warn('⚠️ No card found with accountNumber:', accountNumber);
      return { userId: null };
    }

  } catch (error) {
    console.error('❌ Error finding user by card account number:', error);
    return { userId: null };
  }
};

/**
 * Busca una cuenta por su número de cuenta (accountNumber) y tipo "Checking".
 * Si se proporciona targetUserId, busca solo en las cuentas de ese usuario.
 * Si no se proporciona, busca en toda la base de datos.
 * @param {string} accountNumber - Número de cuenta a buscar.
 * @param {string} targetUserId - ID del usuario propietario de la cuenta (opcional).
 * @returns {Promise<{exists: boolean, accountData?: object, error?: string}>}
 */
export const findAccountByNumber = async (accountNumber, targetUserId = null) => {
  if (!accountNumber) {
    return { exists: false, error: 'Account number is required' };
  }

  try {
    const accountsRef = collection(db, 'accounts');

    // 🔥 Si se proporciona targetUserId, buscar por accountNumber, type "Checking" y userId específico
    // 🔥 Si no se proporciona, buscar solo por accountNumber y type "Checking"
    const queryConstraints = [
      where('accountNumber', '==', accountNumber),
      where('type', '==', 'Checking')
    ];

    // 🔥 Agregar filtro por userId si se proporciona
    if (targetUserId) {
      queryConstraints.push(where('userId', '==', targetUserId));
      console.log('🔥 Searching account by number and userId:', accountNumber, targetUserId);
    } else {
      console.log('🔥 Searching account by number:', accountNumber);
    }

    const q = query(accountsRef, ...queryConstraints);
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Tomar el primer resultado (debería ser único)
      const accountDoc = querySnapshot.docs[0];
      const accountData = { id: accountDoc.id, ...accountDoc.data() };

      console.log('✅ Account found:', accountData);

      return {
        exists: true,
        accountData: accountData
      };
    } else {
      const errorMsg = targetUserId
        ? `Account not found for user ${targetUserId} or is not a checking account`
        : 'Account not found or is not a checking account';
      console.log('❌ Account not found:', accountNumber);
      return {
        exists: false,
        error: errorMsg
      };
    }

  } catch (error) {
    console.error('❌ Error finding account by number:', error);
    return {
      exists: false,
      error: 'Could not validate account'
    };
  }
};

/**
 * Actualiza el estado de una transacción.
 * @param {string} transactionId - ID de la transacción.
 * @param {string} status - Nuevo estado ('pending', 'completed', 'failed', 'cancelled').
 * @returns {Promise<void>}
 */
export const updateTransactionStatus = (transactionId, status) => {
  if (!transactionId) throw new Error('Transaction ID is required.');
  if (!['pending', 'completed', 'failed', 'cancelled'].includes(status)) {
    throw new Error('Invalid transaction status.');
  }

  const transactionRef = doc(db, 'transactions', transactionId);
  return updateDoc(transactionRef, {
    status: status,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Crea una transferencia completa usando Firebase (sin Nessie).
 * @param {string} payerAccountId - ID de la cuenta pagadora (de Firestore).
 * @param {string} payeeAccountId - ID de la cuenta receptora (de Firestore).
 * @param {number} amount - Monto a transferir.
 * @param {string} medium - Medio de transferencia ('balance', 'rewards').
 * @param {string} description - Descripción de la transferencia.
 * @returns {Promise<object>} Resultado de la transferencia.
 */
export const createFirebaseTransfer = async (payerAccountId, payeeAccountId, amount, medium = 'balance', description = '') => {
  console.log('🔥 Creating Firebase transfer:', { payerAccountId, payeeAccountId, amount, medium });

  // PASO 1: Validar cuentas existen en Firestore
  console.log('🔍 Validating accounts in Firestore...');

  const [payerDoc, payeeDoc] = await Promise.all([
    getAccountById(payerAccountId),
    getAccountById(payeeAccountId)
  ]);

  if (!payerDoc.exists()) {
    throw new Error('Payer account not found in Firebase');
  }

  if (!payeeDoc.exists()) {
    throw new Error('Payee account not found in Firebase');
  }

  const payerData = payerDoc.data();
  const payeeData = payeeDoc.data();

  console.log('✅ Payer account:', payerData);
  console.log('✅ Payee account:', payeeData);

  // PASO 2: Verificar que ambas cuentas sean de tipo "Checking"
  if (payerData.type !== 'Checking') {
    throw new Error('Payer account must be a checking account');
  }

  if (payeeData.type !== 'Checking') {
    throw new Error('Payee account must be a checking account');
  }

  // PASO 3: Verificar fondos suficientes
  const availableBalance = medium === 'balance'
    ? payerData.balance || 0
    : payerData.rewards || 0;

  if (availableBalance < amount) {
    throw new Error(
      `Insufficient ${medium}. Available: $${availableBalance.toFixed(2)}`
    );
  }

  console.log('💰 Available balance:', availableBalance);
  console.log('💸 Transfer amount:', amount);

    // PASO 4: Ejecutar la transferencia usando transacciones de Firestore
  console.log('🔄 Executing transfer with Firestore transactions...');

  let transferResult;
  try {
    transferResult = await runTransaction(db, async (transaction) => {
      // Obtener datos frescos de las cuentas
      const freshPayerDoc = await transaction.get(payerDoc.ref);
      const freshPayeeDoc = await transaction.get(payeeDoc.ref);

      if (!freshPayerDoc.exists() || !freshPayeeDoc.exists()) {
        throw new Error('One or both accounts no longer exist');
      }

      const freshPayerData = freshPayerDoc.data();
      const freshPayeeData = freshPayeeDoc.data();

      // Verificar fondos otra vez con datos frescos
      const freshBalance = medium === 'balance'
        ? freshPayerData.balance || 0
        : freshPayerData.rewards || 0;

      if (freshBalance < amount) {
        throw new Error('Insufficient funds (balance changed during transfer)');
      }

      // Calcular nuevos balances
      const newPayerBalance = freshBalance - amount;
      const newPayeeBalance = (medium === 'balance'
        ? freshPayeeData.balance || 0
        : freshPayeeData.rewards || 0) + amount;

      // Actualizar balances
      transaction.update(payerDoc.ref, {
        [medium]: newPayerBalance,
        updatedAt: serverTimestamp(),
      });

      transaction.update(payeeDoc.ref, {
        [medium === 'balance' ? 'balance' : 'rewards']: newPayeeBalance,
        updatedAt: serverTimestamp(),
      });

      console.log('✅ Balances updated in transaction');
      console.log('💰 Payer new balance:', newPayerBalance);
      console.log('💰 Payee new balance:', newPayeeBalance);

      // Retornar los balances calculados que se aplicaron en la transacción
      return {
        payerFinalBalance: newPayerBalance,
        payeeFinalBalance: newPayeeBalance
      };
    });

    // PASO 5: Crear registro de transacción
    console.log('📝 Creating transaction record...');
    const transactionData = {
      userId: payerData.userId, // Usuario que realiza la transferencia
      type: 'transfer_out', // Tipo de transacción
      amount: amount,
      medium: medium,
      description: description || 'Firebase Transfer',

      // Información del pagador
      payerAccountId: payerAccountId,
      payerAccountNumber: payerData.accountNumber,
      payerName: payerData.nickname || 'Unknown',
      payerUserId: payerData.userId, // UID del usuario que envía

      // Información del receptor
      payeeAccountId: payeeAccountId,
      payeeAccountNumber: payeeData.accountNumber,
      payeeName: payeeData.nickname || 'Unknown',
      payeeUserId: payeeData.userId, // UID del usuario que recibe

      // Balances (después de la transferencia)
      previousBalance: availableBalance,
      newBalance: availableBalance - amount,

      // Metadata
      status: 'completed',
      transactionDate: new Date().toISOString().split('T')[0],
      createdBy: payerData.userId,
      isFirebaseTransfer: true, // Flag para identificar transferencias de Firebase
    };

    const transactionDoc = await createTransaction(transactionData);
    console.log('✅ Transaction record created:', transactionDoc.id);

    // PASO 6: Enviar notificación de WhatsApp al receptor
    try {
      console.log('📱 Sending WhatsApp notification to receiver...');
      
      // Obtener perfil del receptor para su teléfono
      const payeeProfile = await getUserProfile(payeeData.userId);
      
      if (payeeProfile.exists()) {
        const payeeProfileData = payeeProfile.data();
        const payeePhone = payeeProfileData.phoneNumber;
        
        // Obtener nombre del remitente
        const payerProfile = await getUserProfile(payerData.userId);
        let payerName = payerData.nickname || 'Unknown';
        
        if (payerProfile.exists()) {
          const payerProfileData = payerProfile.data();
          payerName = payerProfileData.displayName || payerProfileData.first_name || payerData.nickname;
        }
        
        if (payeePhone) {
          // Importar dinámicamente el servicio de WhatsApp
          const { sendDepositNotification } = require('./whatsappService');
          
          await sendDepositNotification(payeePhone, payerName);
          console.log('✅ WhatsApp notification sent to receiver');
        } else {
          console.warn('⚠️ Receiver has no phone number, skipping WhatsApp notification');
        }
      } else {
        console.warn('⚠️ Receiver profile not found, skipping WhatsApp notification');
      }
    } catch (whatsappError) {
      // No fallar la transferencia si WhatsApp falla
      console.error('❌ WhatsApp notification failed (non-critical):', whatsappError.message);
    }

    // PASO 7: Retornar resultado compatible
    return {
      transferId: transactionDoc.id,
      transfer: transactionData,
      payerAccount: {
        id: payerAccountId,
        nickname: payerData.nickname,
        balance: transferResult.payerFinalBalance
      },
      payeeAccount: {
        id: payeeAccountId,
        nickname: payeeData.nickname,
        balance: transferResult.payeeFinalBalance
      }
    };

  } catch (error) {
    console.error('❌ Firebase transfer failed:', error);
    throw error;
  }
};

/**
 * Obtiene las cuentas de un usuario en tiempo real.
 * @param {string} userId - ID del usuario.
 * @param {function} callback - Función a llamar con las cuentas.
 * @returns {function} Función para desuscribirse.
 */
export const getUserAccounts = (userId, callback) => {
  if (!userId) return () => {};

  const accountsRef = collection(db, 'accounts');
  const q = query(accountsRef, where('userId', '==', userId));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const accounts = [];
    querySnapshot.forEach((doc) => {
      accounts.push({ id: doc.id, ...doc.data() });
    });
    callback(accounts);
  }, (error) => {
    console.error('Error getting user accounts:', error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Crea una transferencia de checking a savings account.
 * @param {string} checkingAccountId - ID de la cuenta checking (origen).
 * @param {string} savingsAccountId - ID de la cuenta savings (destino).
 * @param {number} amount - Monto a transferir.
 * @param {string} description - Descripción opcional de la transferencia.
 * @returns {Promise<object>} Resultado de la transferencia con balances actualizados.
 */
export const createSavingsTransfer = async (checkingAccountId, savingsAccountId, amount, description = 'Transfer to Savings') => {
  console.log('🔥 Creating Savings Transfer:', { checkingAccountId, savingsAccountId, amount });

  // PASO 1: Validar cuentas existen en Firestore
  console.log('🔍 Validating accounts in Firestore...');

  const [checkingDoc, savingsDoc] = await Promise.all([
    getAccountById(checkingAccountId),
    getAccountById(savingsAccountId)
  ]);

  if (!checkingDoc.exists()) {
    throw new Error('Checking account not found');
  }

  if (!savingsDoc.exists()) {
    throw new Error('Savings account not found');
  }

  const checkingData = checkingDoc.data();
  const savingsData = savingsDoc.data();

  console.log('✅ Checking account:', checkingData);
  console.log('✅ Savings account:', savingsData);

  // PASO 2: Verificar tipos de cuenta correctos
  if (checkingData.accountType !== 'debit') {
    throw new Error('Source account must be a checking/debit account');
  }

  if (savingsData.accountType !== 'savings') {
    throw new Error('Destination account must be a savings account');
  }

  // PASO 3: Verificar fondos suficientes en checking account
  const checkingBalance = checkingData.balance || 0;

  if (checkingBalance < amount) {
    throw new Error(
      `Insufficient funds. Available: $${checkingBalance.toFixed(2)}`
    );
  }

  console.log('💰 Checking balance:', checkingBalance);
  console.log('💸 Transfer amount:', amount);

  // PASO 4: Ejecutar la transferencia usando transacciones de Firestore
  console.log('🔄 Executing savings transfer with Firestore transactions...');

  let transferResult;
  try {
    transferResult = await runTransaction(db, async (transaction) => {
      // Obtener datos frescos de las cuentas
      const freshCheckingDoc = await transaction.get(checkingDoc.ref);
      const freshSavingsDoc = await transaction.get(savingsDoc.ref);

      if (!freshCheckingDoc.exists() || !freshSavingsDoc.exists()) {
        throw new Error('One or both accounts no longer exist');
      }

      const freshCheckingData = freshCheckingDoc.data();
      const freshSavingsData = freshSavingsDoc.data();

      // Verificar fondos otra vez con datos frescos
      const freshCheckingBalance = freshCheckingData.balance || 0;

      if (freshCheckingBalance < amount) {
        throw new Error('Insufficient funds (balance changed during transfer)');
      }

      // Calcular nuevos balances
      const newCheckingBalance = freshCheckingBalance - amount;
      const newSavingsBalance = (freshSavingsData.balance || 0) + amount;

      // Actualizar balances
      transaction.update(checkingDoc.ref, {
        balance: newCheckingBalance,
        updatedAt: serverTimestamp(),
      });

      transaction.update(savingsDoc.ref, {
        balance: newSavingsBalance,
        updatedAt: serverTimestamp(),
      });

      console.log('✅ Balances updated in savings transfer transaction');
      console.log('💰 New checking balance:', newCheckingBalance);
      console.log('💰 New savings balance:', newSavingsBalance);

      // Retornar los balances calculados
      return {
        checkingAccount: {
          id: checkingAccountId,
          balance: newCheckingBalance,
        },
        savingsAccount: {
          id: savingsAccountId,
          balance: newSavingsBalance,
        }
      };
    });

    // PASO 5: Crear registro de transacción
    console.log('📝 Creating savings transfer transaction record...');
    const transactionData = {
      userId: checkingData.userId, // Usuario que realiza la transferencia
      type: 'transfer_out', // Tipo de transacción
      amount: amount,
      medium: 'balance',
      description: description,

      // Información del pagador (checking account)
      payerAccountId: checkingAccountId,
      payerAccountNumber: checkingData.accountNumber,
      payerName: checkingData.nickname || 'Checking Account',
      payerUserId: checkingData.userId,

      // Información del receptor (savings account)
      payeeAccountId: savingsAccountId,
      payeeAccountNumber: savingsData.accountNumber,
      payeeName: savingsData.nickname || 'Savings Account',
      payeeUserId: savingsData.userId,

      // Balances (después de la transferencia)
      previousBalance: checkingBalance,
      newBalance: checkingBalance - amount,

      // Metadata
      status: 'completed',
      transactionDate: new Date().toISOString().split('T')[0],
      createdBy: checkingData.userId,
      isSavingsTransfer: true, // Flag para identificar transferencias a savings
    };

    const transactionDoc = await createTransaction(transactionData);
    console.log('✅ Savings transfer transaction record created:', transactionDoc.id);

    // PASO 6: Retornar resultado completo
    return {
      ...transferResult,
      transactionId: transactionDoc.id,
      success: true
    };

  } catch (error) {
    console.error('❌ Savings transfer failed:', error);
    throw error;
  }
};

/**
 * Actualiza una cuenta bancaria.
 * @param {string} accountId - ID de la cuenta.
 * @param {object} updateData - Datos a actualizar.
 * @returns {Promise<void>}
 */
export const updateAccount = (accountId, updateData) => {
  if (!accountId) throw new Error('Account ID is required to update.');
  const accountRef = doc(db, 'accounts', accountId);
  return updateDoc(accountRef, {
    ...updateData,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Obtiene una cuenta específica por ID.
 * @param {string} accountId - ID de la cuenta.
 * @returns {Promise<DocumentSnapshot>}
 */
export const getAccountById = (accountId) => {
  if (!accountId) throw new Error('Account ID is required.');
  const accountRef = doc(db, 'accounts', accountId);
  return getDoc(accountRef);
};

// --- Funciones para Tarjetas Digitales ---

/**
 * Crea una nueva tarjeta digital en la colección 'cards'.
 * @param {object} tarjetaData - Datos de la tarjeta digital.
 * @returns {Promise<DocumentReference>}
 */
export const createTarjetaDigital = (tarjetaData) => {
  if (!tarjetaData.userId) throw new Error('User ID is required to create a tarjeta digital.');
  const cardsRef = collection(db, 'cards');
  return addDoc(cardsRef, {
    ...tarjetaData,
    type: 'digital', // Indicar que es una tarjeta digital
    ownerId: tarjetaData.userId,
    members: [tarjetaData.userId], // El creador siempre es el primer miembro
    isShared: false, // Las tarjetas digitales no son compartidas inicialmente
    createdAt: serverTimestamp(),
  });
};

/**
 * Obtiene las tarjetas digitales de un usuario en tiempo real.
 * @param {string} userId - ID del usuario.
 * @param {function} callback - Función a llamar con los datos de las tarjetas.
 * @returns {function} Función para desuscribirse de los listeners.
 */
export const getTarjetasDigitales = (userId, callback) => {
  if (!userId) return () => {};

  const cardsRef = collection(db, 'cards');
  const q = query(cardsRef, where('ownerId', '==', userId), where('type', '==', 'digital'));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const tarjetas = [];
    querySnapshot.forEach((doc) => {
      tarjetas.push({ id: doc.id, ...doc.data() });
    });
    callback(tarjetas);
  }, (error) => {
    console.error('Error getting tarjetas digitales: ', error);
    callback([]);
  });

  return unsubscribe;
};

/**
 * Obtiene los datos de una tarjeta digital específica.
 * @param {string} tarjetaId - ID de la tarjeta.
 * @returns {Promise<DocumentSnapshot>}
 */
export const getTarjetaDigitalById = (tarjetaId) => {
  if (!tarjetaId) throw new Error('Tarjeta ID is required.');
  const tarjetaDocRef = doc(db, 'cards', tarjetaId);
  return getDoc(tarjetaDocRef);
};

/**
 * Actualiza una tarjeta digital.
 * @param {string} tarjetaId - ID de la tarjeta.
 * @param {object} updatedData - Datos a actualizar.
 * @returns {Promise<void>}
 */
export const updateTarjetaDigital = (tarjetaId, updatedData) => {
  if (!tarjetaId) throw new Error('Tarjeta ID is required to update.');
  const tarjetaDocRef = doc(db, 'cards', tarjetaId);
  return updateDoc(tarjetaDocRef, {
    ...updatedData,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Add a loan to Firestore (since Nessie doesn't have loans endpoint)
 * @param {string} userId - User ID
 * @param {Object} loanData - Loan data
 * @returns {Promise<DocumentReference>} Firestore document reference
 */
export const addLoan = (userId, loanData) => {
  if (!userId) throw new Error('User ID is required to add a loan.');

  const loansRef = collection(db, 'loans');
  return addDoc(loansRef, {
    ...loanData,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Get loans for a user from Firestore
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function to receive loans
 * @returns {Function} Unsubscribe function
 */
export const getLoans = (userId, callback) => {
  if (!userId) return () => {};

  const loansRef = collection(db, 'loans');
  const q = query(
    loansRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const loans = [];
    querySnapshot.forEach((doc) => {
      loans.push({ id: doc.id, ...doc.data() });
    });
    callback(loans);
  }, (error) => {
    console.error("Error getting loans: ", error);
    callback([]);
  });

  return unsubscribe;
};

// --- Funciones para Transferencias P2P ---


// --- Funciones para Contactos de Transferencias ---

/**
 * Guarda un nuevo contacto para transferencias en users/{userId}/contacts/{contactId}
 * @param {string} userId - UID del usuario
 * @param {object} contactData - { contactName, contactAlias, contactCLABE, contactAccountId }
 * @returns {Promise<string>} - ID del contacto creado
 */
export const saveContact = async (userId, contactData) => {
  try {
    if (!userId) throw new Error('User ID is required');
    if (!contactData.contactName) throw new Error('Contact name is required');
    if (!contactData.contactCLABE || contactData.contactCLABE.length !== 16) {
      throw new Error('Valid 16-digit CLABE is required');
    }
    if (!contactData.contactAccountId) {
      throw new Error('Account ID is required');
    }

    const contactsRef = collection(db, 'users', userId, 'contacts');
    const newContact = {
      contactName: contactData.contactName.trim(),
      contactAlias: contactData.contactAlias?.trim() || '',
      contactCLABE: contactData.contactCLABE.trim(),
      contactAccountId: contactData.contactAccountId,
      createdAt: serverTimestamp(),
      lastUsed: serverTimestamp(),
    };

    const docRef = await addDoc(contactsRef, newContact);
    console.log('✅ Contact saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving contact:', error);
    throw error;
  }
};

/**
 * Obtiene todos los contactos del usuario en tiempo real
 * @param {string} userId - UID del usuario
 * @param {function} callback - Función que recibe el array de contactos
 * @returns {function} - Función para cancelar la suscripción
 */
export const getUserContacts = (userId, callback) => {
  if (!userId) {
    console.error('User ID is required for getUserContacts');
    return () => {};
  }

  const contactsRef = collection(db, 'users', userId, 'contacts');
  const q = query(contactsRef, orderBy('lastUsed', 'desc'));

  const unsubscribe = onSnapshot(q, 
    (snapshot) => {
      const contacts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(contacts);
    },
    (error) => {
      console.error('Error fetching contacts:', error);
      callback([]);
    }
  );

  return unsubscribe;
};

/**
 * Busca contactos por nombre, alias o CLABE (client-side filtering)
 * @param {array} contacts - Array de todos los contactos del usuario
 * @param {string} searchQuery - Texto a buscar
 * @returns {array} - Contactos filtrados
 */
export const searchContactsByQuery = (contacts, searchQuery) => {
  if (!searchQuery || searchQuery.trim() === '') {
    return contacts;
  }

  const query = searchQuery.toLowerCase().trim();
  
  return contacts.filter(contact => {
    const name = (contact.contactName || '').toLowerCase();
    const alias = (contact.contactAlias || '').toLowerCase();
    const clabe = contact.contactCLABE || '';

    return name.includes(query) || 
           alias.includes(query) || 
           clabe.includes(query);
  });
};

/**
 * Actualiza el timestamp lastUsed de un contacto
 * @param {string} userId - UID del usuario
 * @param {string} contactId - ID del contacto
 */
export const updateContactLastUsed = async (userId, contactId) => {
  try {
    if (!userId || !contactId) {
      throw new Error('User ID and Contact ID are required');
    }

    const contactRef = doc(db, 'users', userId, 'contacts', contactId);
    await updateDoc(contactRef, {
      lastUsed: serverTimestamp()
    });
    console.log('✅ Contact lastUsed updated:', contactId);
  } catch (error) {
    console.error('Error updating contact lastUsed:', error);
    throw error;
  }
};

/**
 * Busca un contacto por CLABE
 * @param {string} userId - UID del usuario
 * @param {string} clabe - CLABE a buscar (16 dígitos)
 * @returns {Promise<object|null>} - Contacto encontrado o null
 */
export const getContactByCLABE = async (userId, clabe) => {
  try {
    if (!userId || !clabe) {
      throw new Error('User ID and CLABE are required');
    }

    const contactsRef = collection(db, 'users', userId, 'contacts');
    const q = query(contactsRef, where('contactCLABE', '==', clabe.trim()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const contactDoc = snapshot.docs[0];
    return {
      id: contactDoc.id,
      ...contactDoc.data()
    };
  } catch (error) {
    console.error('Error getting contact by CLABE:', error);
    throw error;
  }
};

/**
 * BILLS MANAGEMENT FUNCTIONS (Firebase/Firestore only)
 */

/**
 * Crea una nueva bill en Firestore
 * @param {string} userId - UID del usuario
 * @param {object} billData - Datos de la bill
 * @returns {Promise<object>} - Bill creada
 */
export const createBill = async (userId, billData) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const billsRef = collection(db, 'users', userId, 'bills');
    const billToCreate = {
      ...billData,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(billsRef, billToCreate);

    console.log('✅ Bill created in Firestore:', docRef.id);

    // Return the created bill with ID
    return {
      _id: docRef.id,
      ...billToCreate
    };
  } catch (error) {
    console.error('Error creating bill:', error);
    throw error;
  }
};

/**
 * Obtiene todas las bills de una cuenta específica
 * @param {string} userId - UID del usuario
 * @param {string} accountId - ID de la cuenta
 * @returns {Promise<array>} - Array de bills
 */
export const getBillsByAccount = async (userId, accountId) => {
  try {
    if (!userId || !accountId) {
      console.warn('User ID and Account ID are required for getBillsByAccount');
      return [];
    }

    const billsRef = collection(db, 'users', userId, 'bills');
    const q = query(billsRef, where('accountId', '==', accountId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const bills = snapshot.docs.map(doc => ({
      _id: doc.id,
      ...doc.data()
    }));

    console.log(`📄 Found ${bills.length} bills for account ${accountId}`);
    return bills;
  } catch (error) {
    console.error('Error getting bills by account:', error);
    throw error;
  }
};

/**
 * Obtiene todas las bills del usuario en tiempo real
 * @param {string} userId - UID del usuario
 * @param {function} callback - Función que recibe el array de bills
 * @returns {function} - Función para cancelar la suscripción
 */
export const getUserBills = (userId, callback) => {
  if (!userId) {
    console.error('User ID is required for getUserBills');
    return () => {};
  }

  const billsRef = collection(db, 'users', userId, 'bills');
  const q = query(billsRef, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(q,
    (snapshot) => {
      const bills = snapshot.docs.map(doc => ({
        _id: doc.id,
        ...doc.data()
      }));
      callback(bills);
    },
    (error) => {
      console.error('Error fetching bills:', error);
      callback([]);
    }
  );

  return unsubscribe;
};

/**
 * Actualiza una bill existente
 * @param {string} billId - ID de la bill
 * @param {object} updates - Campos a actualizar
 * @returns {Promise<void>}
 */
export const updateBill = async (billId, updates) => {
  try {
    if (!billId) {
      throw new Error('Bill ID is required');
    }

    // We need to find the user ID from the bill document
    // For now, we'll search through all users (not ideal but works for demo)
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    let billRef = null;
    let userId = null;

    for (const userDoc of usersSnapshot.docs) {
      const userBillsRef = collection(db, 'users', userDoc.id, 'bills');
      const billDoc = await getDoc(doc(userBillsRef, billId));
      if (billDoc.exists()) {
        billRef = doc(userBillsRef, billId);
        userId = userDoc.id;
        break;
      }
    }

    if (!billRef) {
      throw new Error('Bill not found');
    }

    await updateDoc(billRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Bill updated:', billId);
  } catch (error) {
    console.error('Error updating bill:', error);
    throw error;
  }
};

/**
 * Elimina una bill
 * @param {string} userId - UID del usuario
 * @param {string} billId - ID de la bill a eliminar
 * @returns {Promise<void>}
 */
export const deleteBill = async (userId, billId) => {
  try {
    if (!userId || !billId) {
      throw new Error('User ID and Bill ID are required');
    }

    const billRef = doc(db, 'users', userId, 'bills', billId);
    await deleteDoc(billRef);

    console.log('✅ Bill deleted:', billId);
  } catch (error) {
    console.error('Error deleting bill:', error);
    throw error;
  }
};

/**
 * Obtiene una bill específica por ID
 * @param {string} userId - UID del usuario
 * @param {string} billId - ID de la bill
 * @returns {Promise<object|null>} - Bill encontrada o null
 */
export const getBillById = async (userId, billId) => {
  try {
    if (!userId || !billId) {
      throw new Error('User ID and Bill ID are required');
    }

    const billRef = doc(db, 'users', userId, 'bills', billId);
    const billDoc = await getDoc(billRef);

    if (!billDoc.exists()) {
      return null;
    }

    return {
      _id: billDoc.id,
      ...billDoc.data()
    };
  } catch (error) {
    console.error('Error getting bill by ID:', error);
    throw error;
  }
};


