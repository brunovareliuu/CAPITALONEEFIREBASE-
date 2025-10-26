import { auth } from '../config/firebase';

/**
 * API Key de Nessie (Capital One API)
 */
const NESSIE_API_KEY = 'cf56fb5b0f0c73969f042c7ad5457306';
const NESSIE_BASE_URL = 'http://api.nessieisreal.com';

/**
 * Crea un nuevo cliente en la API de Nessie
 * @param {object} customerData - Datos del cliente
 * @param {string} customerData.first_name - Nombre del cliente
 * @param {string} customerData.last_name - Apellido del cliente
 * @param {object} customerData.address - Dirección del cliente
 * @param {string} customerData.address.street_number - Número de calle
 * @param {string} customerData.address.street_name - Nombre de calle
 * @param {string} customerData.address.city - Ciudad
 * @param {string} customerData.address.state - Estado
 * @param {string} customerData.address.zip - Código postal
 * @returns {Promise<object>} Datos del cliente creado
 */
export const createNessieCustomer = async (customerData) => {
  try {
    // Validar datos requeridos
    if (!customerData.first_name || !customerData.last_name) {
      throw new Error('First name and last name are required');
    }

    if (!customerData.address ||
        !customerData.address.street_number ||
        !customerData.address.street_name ||
        !customerData.address.city ||
        !customerData.address.state ||
        !customerData.address.zip) {
      throw new Error('Complete address information is required');
    }

    const url = `${NESSIE_BASE_URL}/customers?key=${NESSIE_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        address: {
          street_number: customerData.address.street_number,
          street_name: customerData.address.street_name,
          city: customerData.address.city,
          state: customerData.address.state,
          zip: customerData.address.zip,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to create customer: ${response.status} ${response.statusText}`);
    }

    const customer = await response.json();
    console.log('Customer created successfully:', customer);
    return customer;

  } catch (error) {
    console.error('Error creating Nessie customer:', error);
    throw error;
  }
};

/**
 * Obtiene un cliente por su ID desde la API de Nessie
 * @param {string} customerId - ID del cliente en Nessie
 * @returns {Promise<object>} Datos del cliente
 */
export const getNessieCustomer = async (customerId) => {
  try {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const url = `${NESSIE_BASE_URL}/customers/${customerId}?key=${NESSIE_API_KEY}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Customer not found');
      }
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to get customer: ${response.status} ${response.statusText}`);
    }

    const customer = await response.json();
    return customer;

  } catch (error) {
    console.error('Error getting Nessie customer:', error);
    throw error;
  }
};

/**
 * Obtiene todos los clientes desde la API de Nessie
 * @returns {Promise<Array>} Lista de clientes
 */
export const getAllNessieCustomers = async () => {
  try {
    const url = `${NESSIE_BASE_URL}/customers?key=${NESSIE_API_KEY}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to get customers: ${response.status} ${response.statusText}`);
    }

    const customers = await response.json();
    return customers;

  } catch (error) {
    console.error('Error getting Nessie customers:', error);
    throw error;
  }
};

/**
 * Actualiza un cliente en la API de Nessie
 * @param {string} customerId - ID del cliente
 * @param {object} updateData - Datos a actualizar
 * @returns {Promise<object>} Datos del cliente actualizado
 */
export const updateNessieCustomer = async (customerId, updateData) => {
  try {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const url = `${NESSIE_BASE_URL}/customers/${customerId}?key=${NESSIE_API_KEY}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to update customer: ${response.status} ${response.statusText}`);
    }

    const customer = await response.json();
    return customer;

  } catch (error) {
    console.error('Error updating Nessie customer:', error);
    throw error;
  }
};

/**
 * Obtiene las cuentas de un cliente desde la API de Nessie
 * @param {string} customerId - ID del cliente en Nessie
 * @returns {Promise<Array>} Lista de cuentas del cliente
 */
export const getCustomerAccounts = async (customerId) => {
  try {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const url = `${NESSIE_BASE_URL}/customers/${customerId}/accounts?key=${NESSIE_API_KEY}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return []; // No accounts found
      }
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to get accounts: ${response.status} ${response.statusText}`);
    }

    const accounts = await response.json();
    return accounts;

  } catch (error) {
    console.error('Error getting customer accounts:', error);
    throw error;
  }
};

/**
 * Get account balance by account ID
 * @param {string} accountId - Nessie account ID
 * @returns {Promise<number>} Account balance
 */
export const getAccountBalance = async (accountId) => {
  if (!accountId) {
    throw new Error('Account ID is required');
  }

  const NESSIE_API_KEY = 'cf56fb5b0f0c73969f042c7ad5457306';
  const url = `http://api.nessieisreal.com/accounts/${accountId}?key=${NESSIE_API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Account not found');
      }
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to get account balance: ${response.status}`);
    }

    const account = await response.json();
    return account.balance || 0;

  } catch (error) {
    console.error('Error getting account balance:', error);
    throw error;
  }
};

/**
 * Update account balance in Nessie API
 * @param {string} accountId - Nessie account ID
 * @param {number} newBalance - New balance amount
 * @returns {Promise<Object>} Updated account data
 */
export const updateAccountBalance = async (accountId, newBalance) => {
  if (!accountId) {
    throw new Error('Account ID is required');
  }

  if (typeof newBalance !== 'number' || newBalance < 0) {
    throw new Error('Valid new balance is required');
  }

  const NESSIE_API_KEY = 'cf56fb5b0f0c73969f042c7ad5457306';
  const url = `http://api.nessieisreal.com/accounts/${accountId}?key=${NESSIE_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        balance: newBalance
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to update account balance: ${response.status}`);
    }

    const updatedAccount = await response.json();
    console.log('Account balance updated:', updatedAccount.balance);
    return updatedAccount;

  } catch (error) {
    console.error('Error updating account balance:', error);
    throw error;
  }
};

/**
 * Create a purchase transaction in Nessie API
 * @param {string} accountId - Nessie account ID
 * @param {number} amount - Purchase amount
 * @param {string} description - Purchase description
 * @returns {Promise<object>} Created purchase object
 */
export const createPurchase = async (accountId, amount, description) => {
  if (!accountId) {
    throw new Error('Account ID is required');
  }

  const NESSIE_API_KEY = 'cf56fb5b0f0c73969f042c7ad5457306';
  const url = `http://api.nessieisreal.com/accounts/${accountId}/purchases?key=${NESSIE_API_KEY}`;

  const purchaseData = {
    merchant_id: "57cf75cea73e494d8675ec49", // Siempre el mismo merchant
    medium: "balance", // Siempre balance
    purchase_date: new Date().toISOString().split('T')[0], // Fecha actual en formato YYYY-MM-DD
    amount: amount,
    status: "completed", // Crear directamente como completed
    description: description
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(purchaseData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to create purchase: ${response.status}`);
    }

    const result = await response.json();
    console.log('Purchase created in Nessie:', result);

    // La API de Nessie devuelve el objeto en objectCreated
    const purchaseObject = result.objectCreated || result;
    console.log('Purchase object:', purchaseObject);

    // Ya que se crea directamente como completed, obtener el balance actualizado
    if (purchaseObject && purchaseObject._id) {
      try {
        // Esperar un poco para que la API procese la purchase
        await new Promise(resolve => setTimeout(resolve, 500));

        // Obtener el balance actualizado
        const updatedBalance = await getAccountBalance(accountId);
        console.log('Balance after purchase:', updatedBalance);

        return { ...purchaseObject, finalBalance: updatedBalance };
      } catch (balanceError) {
        console.warn('Could not get updated balance:', balanceError);
      }
    } else {
      console.warn('Purchase created but no _id found in response:', result);
    }

    return purchaseObject || {};

  } catch (error) {
    console.error('Error creating purchase:', error);
    throw error;
  }
};

/**
 * Update purchase status
 * @param {string} purchaseId - Purchase ID
 * @param {string} status - New status ('pending' or 'completed')
 * @returns {Promise<object>} Updated purchase object
 */
export const updatePurchaseStatus = async (purchaseId, status) => {
  if (!purchaseId) {
    throw new Error('Purchase ID is required');
  }

  const NESSIE_API_KEY = 'cf56fb5b0f0c73969f042c7ad5457306';
  const url = `http://api.nessieisreal.com/purchases/${purchaseId}?key=${NESSIE_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to update purchase status: ${response.status}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error updating purchase status:', error);
    throw error;
  }
};

/**
 * Get purchases for an account
 * @param {string} accountId - Nessie account ID
 * @returns {Promise<Array>} Array of purchases
 */
export const getAccountPurchases = async (accountId) => {
  if (!accountId) {
    throw new Error('Account ID is required');
  }

  const NESSIE_API_KEY = 'cf56fb5b0f0c73969f042c7ad5457306';
  const url = `http://api.nessieisreal.com/accounts/${accountId}/purchases?key=${NESSIE_API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return []; // No purchases found
      }
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to get purchases: ${response.status}`);
    }

    const purchases = await response.json();
    return purchases || [];

  } catch (error) {
    console.error('Error getting account purchases:', error);
    throw error;
  }
};

/**
 * Get deposits for an account
 * @param {string} accountId - Nessie account ID
 * @returns {Promise<Array>} Array of deposits
 */
export const getAccountDeposits = async (accountId) => {
  if (!accountId) {
    throw new Error('Account ID is required');
  }

  const NESSIE_API_KEY = 'cf56fb5b0f0c73969f042c7ad5457306';
  const url = `http://api.nessieisreal.com/accounts/${accountId}/deposits?key=${NESSIE_API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return []; // No deposits found
      }
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to get deposits: ${response.status}`);
    }

    const deposits = await response.json();
    return deposits || [];

  } catch (error) {
    console.error('Error getting account deposits:', error);
    throw error;
  }
};

/**
 * Valida y busca una cuenta por Account Number (prioridad) o Account ID
 * @param {string} accountIdentifier - Número de cuenta (16 dígitos) o ID de cuenta
 * @returns {Promise<object>} { exists: boolean, accountData?: object, error?: string }
 */
export const validateAccountExists = async (accountIdentifier) => {
  try {
    // ESTRATEGIA: Primero buscar por account_number (es lo que el usuario usa)
    // Si no se encuentra, intentar por _id como fallback
    
    let account = null;

    // 1. Obtener todas las cuentas y buscar por account_number PRIMERO
    const allAccountsResponse = await fetch(
      `${NESSIE_BASE_URL}/accounts?key=${NESSIE_API_KEY}`
    );

    if (!allAccountsResponse.ok) {
      return {
        exists: false,
        error: 'Unable to verify account. Please try again.'
      };
    }

    const allAccounts = await allAccountsResponse.json();
    
    // Buscar por account_number (prioridad)
    account = allAccounts.find(acc => acc.account_number === accountIdentifier);
    
    // Si no se encuentra por account_number, buscar por _id
    if (!account) {
      account = allAccounts.find(acc => acc._id === accountIdentifier);
    }

    // Si aún no se encuentra, retornar error
    if (!account) {
      return {
        exists: false,
        error: 'Account Number not found. Please verify the 16-digit number.'
      };
    }

    // Validaciones adicionales restrictivas
    if (!account._id) {
      return {
        exists: false,
        error: 'Invalid account data.'
      };
    }

    if (!account.type || !account.nickname) {
      return {
        exists: false,
        error: 'Incomplete account data.'
      };
    }

    // Éxito: cuenta válida
    return {
      exists: true,
      accountData: {
        id: account._id,
        nickname: account.nickname,
        type: account.type,
        balance: account.balance || 0,
        rewards: account.rewards || 0,
        account_number: account.account_number
      }
    };

  } catch (error) {
    console.error('Error in validateAccountExists:', error);
    return {
      exists: false,
      error: 'Network error. Please check your connection.'
    };
  }
};

/**
 * Crea una transferencia P2P entre dos cuentas
 * @param {string} payerAccountId - ID de la cuenta origen
 * @param {string} payeeAccountId - ID de la cuenta destino
 * @param {number} amount - Monto a transferir
 * @param {string} medium - 'balance' o 'rewards'
 * @param {string} description - Descripción opcional
 * @returns {Promise<object>} Datos de la transferencia creada
 */
export const createTransfer = async (
  payerAccountId,
  payeeAccountId,
  amount,
  medium = 'balance',
  description = ''
) => {
  // PASO 1: Validar account destino (RESTRICTIVO)
  const payeeValidation = await validateAccountExists(payeeAccountId);
  if (!payeeValidation.exists) {
    throw new Error(payeeValidation.error);
  }

  // PASO 2: Validar account origen
  const payerValidation = await validateAccountExists(payerAccountId);
  if (!payerValidation.exists) {
    throw new Error('Your account was not found.');
  }

  // PASO 3: Verificar fondos suficientes
  const availableBalance = medium === 'balance'
    ? payerValidation.accountData.balance
    : payerValidation.accountData.rewards;

  if (availableBalance < amount) {
    throw new Error(
      `Insufficient ${medium}. Available: $${availableBalance.toFixed(2)}`
    );
  }

  // PASO 4: Crear transferencia en Nessie API
  // IMPORTANTE: Usar los IDs validados del API (no los que el usuario ingresó)
  const transferData = {
    medium: medium,
    payee_id: payeeValidation.accountData.id, // Usar el _id validado del API
    amount: parseFloat(amount),
    transaction_date: new Date().toISOString().split('T')[0],
    description: description || 'P2P Transfer'
  };

  console.log('📤 Sending transfer:', {
    from: payerValidation.accountData.nickname,
    to: payeeValidation.accountData.nickname,
    amount: parseFloat(amount),
    medium
  });

  const response = await fetch(
    `${NESSIE_BASE_URL}/accounts/${payerValidation.accountData.id}/transfers?key=${NESSIE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transferData)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Transfer API Error:', response.status, errorText);
    throw new Error(`Transfer failed: ${response.status}`);
  }

  const result = await response.json();
  console.log('✅ Transfer API Response:', result);

  return {
    transferId: result.objectCreated._id,
    transfer: result.objectCreated,
    payerAccount: payerValidation.accountData,
    payeeAccount: payeeValidation.accountData
  };
};

/**
 * Obtiene información actualizada de una cuenta por ID
 * @param {string} accountId - ID de la cuenta
 * @returns {Promise<object>} Datos de la cuenta
 */
export const getAccountById = async (accountId) => {
  const response = await fetch(
    `${NESSIE_BASE_URL}/accounts/${accountId}?key=${NESSIE_API_KEY}`
  );
  if (!response.ok) throw new Error('Account not found');
  return await response.json();
};

/**
 * Actualiza los balances de múltiples cuentas en tiempo real
 * @param {Array<string>} accountIds - Array de IDs de cuentas
 * @returns {Promise<Array>} Array de cuentas actualizadas
 */
export const refreshAccountsBalances = async (accountIds) => {
  const promises = accountIds.map(id =>
    getAccountById(id).catch(err => ({ error: err.message, id }))
  );
  return await Promise.all(promises);
};

/**
 * Espera hasta que el balance de una cuenta coincida con el esperado.
 * Útil inmediatamente después de crear una transferencia para confirmar el nuevo balance real del servidor.
 *
 * @param {string} accountId - ID de la cuenta a consultar
 * @param {number} expectedBalance - Balance esperado tras la operación
 * @param {number} maxAttempts - Número máximo de intentos (default 20)
 * @param {number} intervalMs - Intervalo entre intentos en milisegundos (default 500ms)
 * @returns {Promise<number>} Balance confirmado (o último balance si expira el tiempo)
 */
export const waitForBalanceUpdate = async (
  accountId,
  expectedBalance,
  maxAttempts = 20,
  intervalMs = 500
) => {
  console.log(`⏳ Esperando balance actualizado para ${accountId}...`);
  console.log(`   Expected: ${expectedBalance}`);
  
  let lastBalance = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const account = await getAccountById(accountId);
      lastBalance = typeof account?.balance === 'number' ? account.balance : lastBalance;

      console.log(`   Intento ${attempt + 1}/${maxAttempts}: Balance actual = ${account?.balance}`);

      if (typeof account?.balance === 'number') {
        const diff = Math.abs(account.balance - expectedBalance);
        if (diff < 0.01) {
          // Confirmado dentro de tolerancia de centavos
          console.log(`✅ Balance confirmado en intento ${attempt + 1}: ${account.balance}`);
          return account.balance;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Error en polling (intento ${attempt + 1}):`, e?.message);
    }

    // Esperar antes del siguiente intento
    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  // Timeout: devolver el último balance conocido
  console.warn(`⏱️ Timeout esperando balance. Último balance: ${lastBalance}`);
  try {
    const account = await getAccountById(accountId);
    if (typeof account?.balance === 'number') {
      console.log(`📊 Balance final obtenido: ${account.balance}`);
      return account.balance;
    }
  } catch (_ignored) {}
  return lastBalance;
};

/**
 * Obtiene todas las transferencias de una cuenta
 * @param {string} accountId - ID de la cuenta
 * @returns {Promise<Array>} Array de transferencias
 */
export const getAccountTransfers = async (accountId) => {
  const response = await fetch(
    `${NESSIE_BASE_URL}/accounts/${accountId}/transfers?key=${NESSIE_API_KEY}`
  );
  if (!response.ok) return [];
  return await response.json();
};


/**
 * Obtiene TODAS las transacciones de una cuenta (transfers + purchases)
 * Combina y ordena por fecha
 * @param {string} accountId - ID de la cuenta
 * @returns {Promise<Array>} Array de todas las transacciones combinadas
 */
export const getAllAccountTransactions = async (accountId) => {
  try {
    // Obtener transfers y purchases en paralelo
    const [transfers, purchases] = await Promise.all([
      getAccountTransfers(accountId),
      getAccountPurchases(accountId)
    ]);

    // Formatear y combinar
    const allTransactions = [
      ...transfers.map(t => ({
        ...t,
        transaction_type: 'transfer',
        date: t.transaction_date,
        // IMPORTANTE: Detectar si es incoming o outgoing
        is_incoming: t.payee_id === accountId, // Si esta cuenta es el payee, es dinero entrante
        is_outgoing: t.payer_id === accountId  // Si esta cuenta es el payer, es dinero saliente
      })),
      ...purchases.map(p => ({
        ...p,
        transaction_type: 'purchase',
        date: p.purchase_date,
        is_incoming: false, // Las purchases siempre son salientes (gastos)
        is_outgoing: true
      }))
    ];

    // Ordenar por fecha (más reciente primero)
    allTransactions.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });

    return allTransactions;
  } catch (error) {
    console.error('Error getting all account transactions:', error);
    return [];
  }
};

/**
 * Crea una nueva bill/factura
 * @param {string} accountId - ID de la cuenta
 * @param {object} billData - Datos de la bill
 * @param {string} billData.payee - Empresa que recibe el pago
 * @param {string} billData.nickname - Nickname opcional
 * @param {string} billData.payment_date - Fecha de pago opcional
 * @param {number} billData.recurring_date - Día del mes que se repite (opcional)
 * @param {number} billData.payment_amount - Monto del pago
 * @param {string} billData.status - Estado: 'pending', 'cancelled', 'completed', 'recurring'
 * @returns {Promise<object>} Bill creada
 */
export const createBill = async (accountId, billData) => {
  const url = `${NESSIE_BASE_URL}/accounts/${accountId}/bills?key=${NESSIE_API_KEY}`;

  // Formato exacto según documentación de Nessie
  const payload = {
    status: billData.status || 'pending',
    payee: billData.payee,
    nickname: billData.nickname || undefined, // undefined para que no se incluya si está vacío
    payment_amount: Number(billData.payment_amount) // Asegurar que sea number
  };

  // Solo agregar campos opcionales si existen
  if (billData.payment_date && billData.payment_date.trim()) {
    payload.payment_date = billData.payment_date.trim();
  }

  if (billData.recurring_date && billData.recurring_date.toString().trim()) {
    payload.recurring_date = parseInt(billData.recurring_date.toString().trim(), 10);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to create bill: ${response.status}`);
    }

    const result = await response.json();
    console.log('Bill created in Nessie:', result);
    console.log('Payload sent:', payload);

    // La API de Nessie devuelve el objeto en objectCreated
    const billObject = result.objectCreated || result;
    return billObject;
  } catch (error) {
    console.error('Error creating bill:', error);
    throw error;
  }
};

/**
 * Obtiene todas las bills de una cuenta
 * @param {string} accountId - ID de la cuenta
 * @returns {Promise<Array>} Array de bills
 */
export const getAccountBills = async (accountId) => {
  const url = `${NESSIE_BASE_URL}/accounts/${accountId}/bills?key=${NESSIE_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        return []; // No bills found
      }
      throw new Error(`Failed to get bills: ${response.status}`);
    }

    const bills = await response.json();
    return Array.isArray(bills) ? bills : [];
  } catch (error) {
    console.error('Error getting account bills:', error);
    return [];
  }
};

/**
 * Actualiza una bill existente
 * @param {string} billId - ID de la bill
 * @param {object} updateData - Datos a actualizar
 * @returns {Promise<object>} Bill actualizada
 */
export const updateBill = async (billId, updateData) => {
  const url = `${NESSIE_BASE_URL}/bills/${billId}?key=${NESSIE_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nessie API Error:', response.status, errorText);
      throw new Error(`Failed to update bill: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error updating bill:', error);
    throw error;
  }
};

/**
 * Elimina una bill
 * @param {string} billId - ID de la bill
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
export const deleteBill = async (billId) => {
  const url = `${NESSIE_BASE_URL}/bills/${billId}?key=${NESSIE_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete bill: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting bill:', error);
    throw error;
  }
};