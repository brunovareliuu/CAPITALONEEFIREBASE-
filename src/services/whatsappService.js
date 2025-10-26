/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHATSAPP SERVICE - Cliente
 * Capital One
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este servicio maneja la comunicación con Firebase Cloud Functions
 * para enviar mensajes de WhatsApp de forma segura.
 * 
 * IMPORTANTE: Las credenciales de WhatsApp (ACCESS_TOKEN) nunca están expuestas
 * en el cliente. Todo el procesamiento seguro se hace en Cloud Functions.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

// URL de la Cloud Function desplegada
const FUNCTION_URL = 'https://us-central1-capitalonehackmty.cloudfunctions.net/sendWelcomeWhatsApp';

// Timeout del cliente (30 segundos)
const CLIENT_TIMEOUT_MS = 30000;

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES PRIVADAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Formatea el número de teléfono para WhatsApp
 * @param {string} phoneNumber - Número de teléfono
 * @return {string} Número formateado (solo dígitos)
 */
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  // Remover todos los caracteres no numéricos
  return phoneNumber.replace(/\D/g, '');
};

/**
 * Extrae solo el primer nombre de un nombre completo
 * @param {string} fullName - Nombre completo
 * @return {string} Solo el primer nombre
 */
const getFirstName = (fullName) => {
  if (!fullName) return '';
  // Tomar solo el primer elemento antes del primer espacio
  return fullName.trim().split(' ')[0];
};

/**
 * Valida los parámetros antes de enviar
 * @param {string} phoneNumber - Número de teléfono
 * @param {string} clientName - Nombre del cliente
 * @return {Object} {valid: boolean, error?: string}
 */
const validateParams = (phoneNumber, clientName) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      valid: false,
      error: 'Phone number is required and must be a string',
    };
  }

  if (!clientName || typeof clientName !== 'string') {
    return {
      valid: false,
      error: 'Client name is required and must be a string',
    };
  }

  const formatted = formatPhoneNumber(phoneNumber);
  
  if (formatted.length < 10) {
    return {
      valid: false,
      error: 'Phone number must have at least 10 digits',
    };
  }

  if (clientName.trim().length < 2) {
    return {
      valid: false,
      error: 'Client name must be at least 2 characters',
    };
  }

  return { valid: true };
};

/**
 * Crea un timeout promise
 * @param {number} ms - Milisegundos
 * @return {Promise} Promise que rechaza después del timeout
 */
const timeoutPromise = (ms) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout after ${ms}ms`));
    }, ms);
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Envía un mensaje de bienvenida por WhatsApp a un nuevo usuario
 * 
 * Esta función llama a la Cloud Function 'sendWelcomeWhatsApp' de forma segura.
 * 
 * @param {string} phoneNumber - Número de teléfono con código de país (ej: "528120394578")
 * @param {string} clientName - Nombre del cliente que recibirá el mensaje
 * 
 * @return {Promise<Object>} Resultado del envío
 *   - success: boolean - Si el mensaje se envió exitosamente
 *   - messageId?: string - ID del mensaje de WhatsApp (si fue exitoso)
 *   - error?: string - Mensaje de error (si falló)
 * 
 * @example
 * try {
 *   const result = await sendWelcomeMessage('528120394578', 'Juan Pérez');
 *   if (result.success) {
 *     console.log('✅ WhatsApp sent:', result.messageId);
 *   }
 * } catch (error) {
 *   console.error('❌ WhatsApp failed:', error.message);
 * }
 */
export const sendWelcomeMessage = async (phoneNumber, clientName) => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📱 WhatsApp Service: Sending welcome message');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // ═════════════════════════════════════════════════════════════════════
    // 1. VALIDACIÓN LOCAL
    // ═════════════════════════════════════════════════════════════════════
    
    const validation = validateParams(phoneNumber, clientName);
    if (!validation.valid) {
      console.error('❌ Validation error:', validation.error);
      throw new Error(validation.error);
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    const firstName = getFirstName(clientName);

    console.log('📋 Validated params:', {
      phone: `${formattedPhone.substring(0, 3)}***`,
      originalName: clientName,
      firstName: firstName,
    });

    // ═════════════════════════════════════════════════════════════════════
    // 2. LLAMAR A CLOUD FUNCTION (usando fetch directo)
    // ═════════════════════════════════════════════════════════════════════

    console.log('📤 Calling Cloud Function: sendWelcomeWhatsApp');
    console.log('   URL:', FUNCTION_URL);

    const fetchPromise = fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          phoneNumber: formattedPhone,
          clientName: firstName,
        },
      }),
    });

    const response = await Promise.race([
      fetchPromise,
      timeoutPromise(CLIENT_TIMEOUT_MS),
    ]);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // ═════════════════════════════════════════════════════════════════════
    // 3. PROCESAR RESPUESTA
    // ═════════════════════════════════════════════════════════════════════

    if (result.result && result.result.success) {
      console.log('✅ WhatsApp message sent successfully');
      console.log('📨 Message ID:', result.result.messageId);
      console.log('⏱️  Execution time:', result.result.executionTime);
      console.log('═══════════════════════════════════════════════════════════');

      return {
        success: true,
        messageId: result.result.messageId,
        executionTime: result.result.executionTime,
        timestamp: result.result.timestamp,
      };
    } else {
      console.warn('⚠️ WhatsApp message failed:', result.result?.error || 'Unknown error');
      console.log('═══════════════════════════════════════════════════════════');

      return {
        success: false,
        error: result.result?.error || 'Unknown error',
      };
    }
  } catch (error) {
    // ═════════════════════════════════════════════════════════════════════
    // MANEJO DE ERRORES
    // ═════════════════════════════════════════════════════════════════════

    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ WhatsApp Service Error');
    console.error('═══════════════════════════════════════════════════════════');

    let errorMessage = 'Failed to send WhatsApp message';
    let errorCode = 'UNKNOWN_ERROR';

    // Errores HTTP
    if (error.message && error.message.includes('HTTP error')) {
      errorCode = 'HTTP_ERROR';
      errorMessage = error.message;
      
      console.error('🔴 HTTP Error');
      console.error('   Message:', error.message);
    }
    // Errores de timeout
    else if (error.message && error.message.includes('timeout')) {
      errorCode = 'TIMEOUT';
      errorMessage = 'Request timeout - WhatsApp service took too long to respond';
      
      console.error('⏱️  Timeout Error');
      console.error('   Message:', error.message);
    }
    // Errores de red
    else if (error.message && (error.message.includes('network') || error.message.includes('fetch'))) {
      errorCode = 'NETWORK_ERROR';
      errorMessage = 'Network error - Please check your internet connection';
      
      console.error('🌐 Network Error');
      console.error('   Message:', error.message);
    }
    // Otros errores
    else {
      console.error('🔴 Unexpected Error');
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }

    console.error('═══════════════════════════════════════════════════════════');

    return {
      success: false,
      error: errorMessage,
      errorCode: errorCode,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES PARA FUTURAS IMPLEMENTACIONES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * NOTA: Aquí se pueden agregar más funciones para otros templates de WhatsApp
 * 
 * Ejemplos:
 * - sendPaymentReminder(phoneNumber, clientName, amount, dueDate)
 * - sendExpenseAlert(phoneNumber, clientName, expenseDetails)
 * - sendBudgetAlert(phoneNumber, clientName, budgetName, percentage)
 * - sendTransferConfirmation(phoneNumber, clientName, amount, recipient)
 * 
 * Todas seguirían el mismo patrón:
 * 1. Validar parámetros localmente
 * 2. Llamar a la Cloud Function correspondiente
 * 3. Manejar la respuesta y errores
 */

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT POR DEFECTO
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  sendWelcomeMessage,
};
