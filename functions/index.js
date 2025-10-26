/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAPITAL ONE - CLOUD FUNCTIONS
 * WhatsApp Business API Integration & Credit Score Services
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Este archivo contiene las Cloud Functions para la aplicación Capital One.
 *
 * Funciones disponibles:
 * - sendWelcomeWhatsApp: Envía mensaje de bienvenida al registrarse un usuario
 * - sendDepositNotification: Envía notificación cuando un usuario recibe dinero
 * - getCreditScoreByPhone: Busca usuario por teléfono y retorna su credit score
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const {logger} = require("firebase-functions");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");

// Inicializar Firebase Admin SDK
admin.initializeApp();

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════════════════════

// Configurar región y timeouts globales
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
  timeoutSeconds: 60,
  memory: "256MiB",
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECRETS - Variables de entorno seguras
// ═══════════════════════════════════════════════════════════════════════════════

// Definir los secrets que se configurarán en Firebase
const whatsappPhoneNumberId = defineSecret("WHATSAPP_PHONE_NUMBER_ID");
const whatsappAccessToken = defineSecret("WHATSAPP_ACCESS_TOKEN");

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const WHATSAPP_API_VERSION = "v20.0";
const WHATSAPP_TEMPLATE_NAME = "bienvenida_capi";
const WHATSAPP_TEMPLATE_LANGUAGE = "es_ES";

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Valida el formato del número de teléfono
 * @param {string} phoneNumber - Número de teléfono a validar
 * @return {Object} {valid: boolean, formatted: string, error?: string}
 */
function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    return {
      valid: false,
      error: "Phone number is required",
    };
  }

  // Remover todos los caracteres no numéricos
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Validar longitud (mínimo 10 dígitos, máximo 15)
  if (cleaned.length < 10) {
    return {
      valid: false,
      error: `Phone number too short: ${cleaned.length} digits (minimum 10)`,
    };
  }

  if (cleaned.length > 15) {
    return {
      valid: false,
      error: `Phone number too long: ${cleaned.length} digits (maximum 15)`,
    };
  }

  return {
    valid: true,
    formatted: cleaned,
  };
}

/**
 * Valida el nombre del cliente
 * @param {string} clientName - Nombre del cliente a validar
 * @return {Object} {valid: boolean, error?: string}
 */
function validateClientName(clientName) {
  if (!clientName || typeof clientName !== "string") {
    return {
      valid: false,
      error: "Client name is required and must be a string",
    };
  }

  const trimmed = clientName.trim();

  if (trimmed.length < 2) {
    return {
      valid: false,
      error: "Client name must be at least 2 characters",
    };
  }

  if (trimmed.length > 100) {
    return {
      valid: false,
      error: "Client name must be less than 100 characters",
    };
  }

  return {
    valid: true,
  };
}

/**
 * Construye el payload para la API de WhatsApp
 * @param {string} phoneNumber - Número de teléfono (ya validado y formateado)
 * @param {string} clientName - Nombre del cliente
 * @return {Object} Payload para la API de WhatsApp
 */
function buildWhatsAppPayload(phoneNumber, clientName) {
  return {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "template",
    template: {
      name: WHATSAPP_TEMPLATE_NAME,
      language: {
        code: WHATSAPP_TEMPLATE_LANGUAGE,
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: clientName,
            },
          ],
        },
      ],
    },
  };
}

/**
 * Envía el mensaje a la API de WhatsApp
 * @param {string} phoneNumberId - ID del número de teléfono de WhatsApp Business
 * @param {string} accessToken - Token de acceso de WhatsApp Business API
 * @param {Object} payload - Payload a enviar
 * @return {Promise<Object>} Respuesta de la API
 */
async function sendToWhatsAppAPI(phoneNumberId, accessToken, payload) {
  const apiUrl = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

  logger.info("📤 Sending request to WhatsApp API", {
    url: apiUrl,
    to: payload.to,
    template: payload.template.name,
  });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error("❌ WhatsApp API error", {
      status: response.status,
      statusText: response.statusText,
      error: data.error,
    });

    throw new Error(
        data.error?.message || `WhatsApp API error: ${response.status}`,
    );
  }

  logger.info("✅ WhatsApp message sent successfully", {
    messageId: data.messages?.[0]?.id,
    to: payload.to,
  });

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cloud Function: sendWelcomeWhatsApp
 *
 * Envía un mensaje de bienvenida por WhatsApp a un nuevo usuario.
 *
 * @param {Object} data - Datos de la petición
 * @param {string} data.phoneNumber - Número de teléfono (con código de país, sin +)
 * @param {string} data.clientName - Nombre del cliente
 *
 * @return {Promise<Object>} Resultado del envío
 *
 * Ejemplo de uso desde el cliente:
 * ```javascript
 * const result = await sendWelcomeWhatsApp({
 *   phoneNumber: "528120394578",
 *   clientName: "Juan Pérez"
 * });
 * ```
 */
exports.sendWelcomeWhatsApp = onCall(
    {
      secrets: [whatsappPhoneNumberId, whatsappAccessToken],
      cors: true,
      // Permitir llamadas no autenticadas (para el signup)
      invoker: "public",
    },
    async (request) => {
      const startTime = Date.now();

      logger.info("═══════════════════════════════════════════════════════════");
      logger.info("📨 NUEVA SOLICITUD: sendWelcomeWhatsApp");
      logger.info("═══════════════════════════════════════════════════════════");

      try {
        // ═════════════════════════════════════════════════════════════════════
        // 1. EXTRACCIÓN DE DATOS
        // ═════════════════════════════════════════════════════════════════════

        const {phoneNumber, clientName} = request.data;

        logger.info("📋 Datos recibidos:", {
          phoneNumber: phoneNumber ? `${phoneNumber.substring(0, 3)}***` : "missing",
          clientName: clientName || "missing",
        });

        // ═════════════════════════════════════════════════════════════════════
        // 2. VALIDACIONES
        // ═════════════════════════════════════════════════════════════════════

        // Validar número de teléfono
        const phoneValidation = validatePhoneNumber(phoneNumber);
        if (!phoneValidation.valid) {
          logger.warn("⚠️ Número de teléfono inválido:", phoneValidation.error);
          throw new HttpsError("invalid-argument", phoneValidation.error);
        }

        // Validar nombre del cliente
        const nameValidation = validateClientName(clientName);
        if (!nameValidation.valid) {
          logger.warn("⚠️ Nombre de cliente inválido:", nameValidation.error);
          throw new HttpsError("invalid-argument", nameValidation.error);
        }

        const formattedPhone = phoneValidation.formatted;
        const trimmedName = clientName.trim();

        logger.info("✅ Validaciones exitosas", {
          formattedPhone: `${formattedPhone.substring(0, 3)}***`,
          clientName: trimmedName,
        });

        // ═════════════════════════════════════════════════════════════════════
        // 3. OBTENER CREDENCIALES DE WHATSAPP (SECRETS)
        // ═════════════════════════════════════════════════════════════════════

        const phoneNumberId = whatsappPhoneNumberId.value().trim();
        const accessToken = whatsappAccessToken.value().trim();

        if (!phoneNumberId || !accessToken) {
          logger.error("❌ WhatsApp credentials not configured");
          throw new HttpsError(
              "failed-precondition",
              "WhatsApp credentials are not configured",
          );
        }

        logger.info("🔑 Credenciales de WhatsApp obtenidas");

        // ═════════════════════════════════════════════════════════════════════
        // 4. CONSTRUIR PAYLOAD
        // ═════════════════════════════════════════════════════════════════════

        const payload = buildWhatsAppPayload(formattedPhone, trimmedName);

        logger.info("📦 Payload construido:", {
          to: formattedPhone,
          template: WHATSAPP_TEMPLATE_NAME,
          language: WHATSAPP_TEMPLATE_LANGUAGE,
          clientName: trimmedName,
        });

        // ═════════════════════════════════════════════════════════════════════
        // 5. ENVIAR A WHATSAPP API
        // ═════════════════════════════════════════════════════════════════════

        const whatsappResponse = await sendToWhatsAppAPI(
            phoneNumberId,
            accessToken,
            payload,
        );

        // ═════════════════════════════════════════════════════════════════════
        // 6. RESPUESTA EXITOSA
        // ═════════════════════════════════════════════════════════════════════

        const executionTime = Date.now() - startTime;

        logger.info("═══════════════════════════════════════════════════════════");
        logger.info("✅ MENSAJE ENVIADO EXITOSAMENTE");
        logger.info("═══════════════════════════════════════════════════════════");
        logger.info(`⏱️  Tiempo de ejecución: ${executionTime}ms`);
        logger.info(`📱 Teléfono: ${formattedPhone.substring(0, 3)}***`);
        logger.info(`👤 Cliente: ${trimmedName}`);
        logger.info(`📨 Message ID: ${whatsappResponse.messages?.[0]?.id || "N/A"}`);
        logger.info("═══════════════════════════════════════════════════════════");

        return {
          success: true,
          messageId: whatsappResponse.messages?.[0]?.id,
          phone: formattedPhone,
          clientName: trimmedName,
          executionTime: `${executionTime}ms`,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        // ═════════════════════════════════════════════════════════════════════
        // MANEJO DE ERRORES
        // ═════════════════════════════════════════════════════════════════════

        const executionTime = Date.now() - startTime;

        logger.error("═══════════════════════════════════════════════════════════");
        logger.error("❌ ERROR AL ENVIAR MENSAJE");
        logger.error("═══════════════════════════════════════════════════════════");
        logger.error(`⏱️  Tiempo hasta el error: ${executionTime}ms`);
        logger.error("🔴 Error:", error.message);
        logger.error("📚 Stack:", error.stack);
        logger.error("═══════════════════════════════════════════════════════════");

        // Si ya es un HttpsError, re-lanzarlo
        if (error instanceof HttpsError) {
          throw error;
        }

        // Si es un error de red o de la API de WhatsApp
        if (error.message.includes("WhatsApp API error")) {
          throw new HttpsError(
              "unavailable",
              "WhatsApp service is temporarily unavailable. Please try again later.",
              {originalError: error.message},
          );
        }

        // Error genérico
        throw new HttpsError(
            "internal",
            "Failed to send WhatsApp message",
            {originalError: error.message},
        );
      }
    },
);

/**
 * Cloud Function: sendDepositNotification
 *
 * Envía una notificación por WhatsApp cuando un usuario recibe dinero.
 *
 * @param {Object} data - Datos de la petición
 * @param {string} data.phoneNumber - Número de teléfono del receptor (con código de país, sin +)
 * @param {string} data.senderName - Nombre del receptor (quien recibe el dinero)
 *
 * @return {Promise<Object>} Resultado del envío
 *
 * NOTA: A pesar del nombre del parámetro "senderName", se envía el NOMBRE DEL RECEPTOR
 * para que el template diga: "Hola {Nombre del Receptor}"
 *
 * Ejemplo de uso desde el cliente:
 * ```javascript
 * const result = await sendDepositNotification({
 *   phoneNumber: "528120394578",
 *   senderName: "Bruno"  // Nombre del receptor
 * });
 * ```
 */
exports.sendDepositNotification = onCall(
    {
      secrets: [whatsappPhoneNumberId, whatsappAccessToken],
      cors: true,
      invoker: "public",
    },
    async (request) => {
      const startTime = Date.now();

      logger.info("═══════════════════════════════════════════════════════════");
      logger.info("💰 NUEVA SOLICITUD: sendDepositNotification");
      logger.info("═══════════════════════════════════════════════════════════");

      try {
        // ═════════════════════════════════════════════════════════════════════
        // 1. EXTRACCIÓN DE DATOS
        // ═════════════════════════════════════════════════════════════════════

        const {phoneNumber, senderName} = request.data;

        logger.info("📋 Datos recibidos:", {
          phoneNumber: phoneNumber ? `${phoneNumber.substring(0, 3)}***` : "missing",
          senderName: senderName || "missing",
        });

        // ═════════════════════════════════════════════════════════════════════
        // 2. VALIDACIONES
        // ═════════════════════════════════════════════════════════════════════

        // Validar número de teléfono
        const phoneValidation = validatePhoneNumber(phoneNumber);
        if (!phoneValidation.valid) {
          logger.warn("⚠️ Número de teléfono inválido:", phoneValidation.error);
          throw new HttpsError("invalid-argument", phoneValidation.error);
        }

        // Validar nombre del receptor
        const nameValidation = validateClientName(senderName);
        if (!nameValidation.valid) {
          logger.warn("⚠️ Nombre de receptor inválido:", nameValidation.error);
          throw new HttpsError("invalid-argument", nameValidation.error);
        }

        const formattedPhone = phoneValidation.formatted;
        const trimmedName = senderName.trim();

        logger.info("✅ Validaciones exitosas", {
          formattedPhone: `${formattedPhone.substring(0, 3)}***`,
          recipientName: trimmedName,
        });

        // ═════════════════════════════════════════════════════════════════════
        // 3. OBTENER CREDENCIALES DE WHATSAPP (SECRETS)
        // ═════════════════════════════════════════════════════════════════════

        const phoneNumberId = whatsappPhoneNumberId.value().trim();
        const accessToken = whatsappAccessToken.value().trim();

        if (!phoneNumberId || !accessToken) {
          logger.error("❌ WhatsApp credentials not configured");
          throw new HttpsError(
              "failed-precondition",
              "WhatsApp credentials are not configured",
          );
        }

        logger.info("🔑 Credenciales de WhatsApp obtenidas");

        // ═════════════════════════════════════════════════════════════════════
        // 4. CONSTRUIR PAYLOAD PARA TEMPLATE: nuevo_depsito_en_tu_cuenta
        // ═════════════════════════════════════════════════════════════════════

        const payload = {
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "template",
          template: {
            name: "nuevo_depsito_en_tu_cuenta",
            language: {
              code: "es_ES",
            },
            components: [
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: trimmedName, // Nombre del remitente
                  },
                ],
              },
            ],
          },
        };

        logger.info("📦 Payload construido:", {
          to: formattedPhone,
          template: "nuevo_depsito_en_tu_cuenta",
          language: "es_ES",
          recipientName: trimmedName,
        });

        // ═════════════════════════════════════════════════════════════════════
        // 5. ENVIAR A WHATSAPP API
        // ═════════════════════════════════════════════════════════════════════

        const whatsappResponse = await sendToWhatsAppAPI(
            phoneNumberId,
            accessToken,
            payload,
        );

        // ═════════════════════════════════════════════════════════════════════
        // 6. RESPUESTA EXITOSA
        // ═════════════════════════════════════════════════════════════════════

        const executionTime = Date.now() - startTime;

        logger.info("═══════════════════════════════════════════════════════════");
        logger.info("✅ NOTIFICACIÓN DE DEPÓSITO ENVIADA EXITOSAMENTE");
        logger.info("═══════════════════════════════════════════════════════════");
        logger.info(`⏱️  Tiempo de ejecución: ${executionTime}ms`);
        logger.info(`📱 Teléfono: ${formattedPhone.substring(0, 3)}***`);
        logger.info(`👤 Receptor: ${trimmedName}`);
        logger.info(`📨 Message ID: ${whatsappResponse.messages?.[0]?.id || "N/A"}`);
        logger.info("═══════════════════════════════════════════════════════════");

        return {
          success: true,
          messageId: whatsappResponse.messages?.[0]?.id,
          phone: formattedPhone,
          recipientName: trimmedName,
          executionTime: `${executionTime}ms`,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        // ═════════════════════════════════════════════════════════════════════
        // MANEJO DE ERRORES
        // ═════════════════════════════════════════════════════════════════════

        const executionTime = Date.now() - startTime;

        logger.error("═══════════════════════════════════════════════════════════");
        logger.error("❌ ERROR AL ENVIAR NOTIFICACIÓN DE DEPÓSITO");
        logger.error("═══════════════════════════════════════════════════════════");
        logger.error(`⏱️  Tiempo hasta el error: ${executionTime}ms`);
        logger.error("🔴 Error:", error.message);
        logger.error("📚 Stack:", error.stack);
        logger.error("═══════════════════════════════════════════════════════════");

        // Si ya es un HttpsError, re-lanzarlo
        if (error instanceof HttpsError) {
          throw error;
        }

        // Si es un error de red o de la API de WhatsApp
        if (error.message.includes("WhatsApp API error")) {
          throw new HttpsError(
              "unavailable",
              "WhatsApp service is temporarily unavailable. Please try again later.",
              {originalError: error.message},
          );
        }

        // Error genérico
        throw new HttpsError(
            "internal",
            "Failed to send deposit notification",
            {originalError: error.message},
        );
      }
    },
);

// ═══════════════════════════════════════════════════════════════════════════════
// CREDIT SCORE & USER LOOKUP - Para Agente de WhatsApp
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normaliza un número de teléfono de WhatsApp a formato de base de datos
 * Los números de WhatsApp mexicanos tienen un "1" extra que no está en la BD
 *
 * @param {string} whatsappPhone - Número en formato WhatsApp (ej: "5218120394578")
 * @return {string} - Número normalizado (ej: "528120394578")
 *
 * Ejemplos:
 * - "5218120394578" → "528120394578" (México, se quita el "1")
 * - "528120394578" → "528120394578" (ya normalizado)
 * - "14155552671" → "14155552671" (EE.UU., no se modifica)
 */
function normalizeWhatsAppPhone(whatsappPhone) {
  const cleaned = whatsappPhone.replace(/\D/g, "");

  // Si empieza con 521 (México con el 1 de WhatsApp), quitar el 1
  if (cleaned.startsWith("521")) {
    const normalized = "52" + cleaned.substring(3);
    logger.info(`📞 Normalized phone: ${cleaned} → ${normalized}`);
    return normalized;
  }

  logger.info(`📞 Phone already normalized: ${cleaned}`);
  return cleaned;
}

/**
 * Clasifica un credit score en uno de 5 grupos
 *
 * @param {number} score - Credit score (300-850)
 * @return {Object} - {category: string, description: string, minScore: number, maxScore: number}
 */
function classifyCreditScore(score) {
  if (score >= 800) {
    return {
      category: "Excellent",
      description: "Excelente historial crediticio. Aprobación garantizada para préstamos grandes.",
      minScore: 800,
      maxScore: 850,
      loanLimit: 100000,
      interestRate: "5-7%",
    };
  } else if (score >= 740) {
    return {
      category: "Very Good",
      description: "Muy buen historial crediticio. Altas probabilidades de aprobación.",
      minScore: 740,
      maxScore: 799,
      loanLimit: 75000,
      interestRate: "7-10%",
    };
  } else if (score >= 670) {
    return {
      category: "Good",
      description: "Buen historial crediticio. Buenas opciones de préstamos disponibles.",
      minScore: 670,
      maxScore: 739,
      loanLimit: 50000,
      interestRate: "10-14%",
    };
  } else if (score >= 580) {
    return {
      category: "Fair",
      description: "Historial crediticio regular. Opciones de préstamos limitadas.",
      minScore: 580,
      maxScore: 669,
      loanLimit: 25000,
      interestRate: "14-18%",
    };
  } else {
    return {
      category: "Poor",
      description: "Historial crediticio necesita mejora. Préstamos pequeños disponibles.",
      minScore: 300,
      maxScore: 579,
      loanLimit: 5000,
      interestRate: "18-25%",
    };
  }
}

/**
 * Calcula el credit score de un usuario basado en sus datos financieros
 *
 * Factores considerados:
 * - Balance total en cuentas
 * - Número de préstamos aprobados/rechazados
 * - Historial de transacciones
 * - Uso de tarjetas de crédito
 *
 * @param {Object} userData - Datos del usuario desde Firestore
 * @return {Promise<number>} - Credit score calculado (300-850)
 */
async function calculateCreditScore(userData) {
  const db = admin.firestore();
  let score = 300; // Score base

  try {
    // FACTOR 1: Préstamos (40% del score - hasta 240 puntos)
    const loansSnapshot = await db.collection("loans")
        .where("userId", "==", userData.uid)
        .get();

    const loans = loansSnapshot.docs.map((doc) => doc.data());
    const approvedLoans = loans.filter((l) => l.status === "approved").length;
    const declinedLoans = loans.filter((l) => l.status === "declined").length;

    // Préstamos aprobados suman puntos
    score += Math.min(approvedLoans * 50, 200);

    // Préstamos rechazados restan puntos
    score -= declinedLoans * 30;

    logger.info(`💰 Loans factor: +${Math.min(approvedLoans * 50, 200)} (approved: ${approvedLoans}) -${declinedLoans * 30} (declined: ${declinedLoans})`);

    // FACTOR 2: Balance total (30% del score - hasta 180 puntos)
    const cardsSnapshot = await db.collection("cards")
        .where("userId", "==", userData.uid)
        .get();

    let totalBalance = 0;
    cardsSnapshot.forEach((doc) => {
      const card = doc.data();
      if (card.type !== "credit" && card.initialBalance) {
        totalBalance += card.initialBalance;
      }
    });

    // Por cada $1,000 de balance, agregar 10 puntos (máximo 180)
    const balancePoints = Math.min(Math.floor(totalBalance / 1000) * 10, 180);
    score += balancePoints;

    logger.info(`💵 Balance factor: +${balancePoints} (total balance: $${totalBalance})`);

    // FACTOR 3: Transacciones (20% del score - hasta 120 puntos)
    const transactionsSnapshot = await db.collection("transactions")
        .where("userId", "==", userData.uid)
        .limit(100)
        .get();

    const transactionCount = transactionsSnapshot.size;
    const transactionPoints = Math.min(transactionCount * 2, 120);
    score += transactionPoints;

    logger.info(`📊 Transaction factor: +${transactionPoints} (transactions: ${transactionCount})`);

    // FACTOR 4: Antigüedad de cuenta (10% del score - hasta 60 puntos)
    if (userData.createdAt) {
      const accountAge = Date.now() - userData.createdAt.toMillis();
      const daysSinceCreation = Math.floor(accountAge / (1000 * 60 * 60 * 24));
      const agePoints = Math.min(Math.floor(daysSinceCreation / 30) * 10, 60);
      score += agePoints;

      logger.info(`📅 Account age factor: +${agePoints} (days: ${daysSinceCreation})`);
    }

    // Asegurar que el score esté entre 300 y 850
    score = Math.max(300, Math.min(850, score));

    logger.info(`✅ Final credit score: ${score}`);

    return score;
  } catch (error) {
    logger.error("❌ Error calculating credit score:", error);
    // En caso de error, retornar score por defecto
    return 650; // Score promedio "Good"
  }
}

/**
 * Cloud Function: getCreditScoreByPhone
 *
 * Busca un usuario por su número de teléfono de WhatsApp y retorna su información de crédito.
 *
 * @param {Object} data - Datos de la petición
 * @param {string} data.phoneNumber - Número de teléfono en formato WhatsApp (ej: "5218120394578")
 *
 * @return {Promise<Object>} Información del usuario:
 *   - success: boolean
 *   - found: boolean (si se encontró el usuario)
 *   - user: {
 *       firstName: string,
 *       lastName: string,
 *       fullName: string,
 *       phoneNumber: string
 *     }
 *   - creditScore: {
 *       score: number,
 *       category: string (Excellent/Very Good/Good/Fair/Poor),
 *       description: string,
 *       loanLimit: number,
 *       interestRate: string
 *     }
 *
 * Ejemplo de uso:
 * ```javascript
 * const result = await getCreditScoreByPhone({
 *   phoneNumber: "5218120394578"
 * });
 * ```
 */
exports.getCreditScoreByPhone = onCall(
    {
      cors: true,
      invoker: "public",
    },
    async (request) => {
      const startTime = Date.now();
      logger.info("═══════════════════════════════════════════════════════════");
      logger.info("🔍 NUEVA SOLICITUD: getCreditScoreByPhone");
      logger.info("═══════════════════════════════════════════════════════════");

      try {
        const {phoneNumber} = request.data;

        logger.info("📋 Datos recibidos:", {
          phoneNumber: phoneNumber ? `${phoneNumber.substring(0, 3)}***` : "missing",
        });

        // ═════════════════════════════════════════════════════════════════════
        // 1. VALIDAR Y NORMALIZAR NÚMERO DE TELÉFONO
        // ═════════════════════════════════════════════════════════════════════

        if (!phoneNumber) {
          throw new HttpsError("invalid-argument", "Phone number is required");
        }

        // Normalizar el número (quitar el "1" extra de WhatsApp para México)
        const normalizedPhone = normalizeWhatsAppPhone(phoneNumber);

        logger.info("✅ Phone normalized:", {
          original: phoneNumber,
          normalized: `${normalizedPhone.substring(0, 3)}***`,
        });

        // ═════════════════════════════════════════════════════════════════════
        // 2. BUSCAR USUARIO EN FIRESTORE
        // ═════════════════════════════════════════════════════════════════════

        const db = admin.firestore();
        const usersRef = db.collection("users");

        logger.info("🔍 Searching user by phone number...");

        const querySnapshot = await usersRef
            .where("phoneNumber", "==", normalizedPhone)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
          logger.warn("⚠️ User not found with phone:", normalizedPhone);

          const executionTime = Date.now() - startTime;
          logger.info("═══════════════════════════════════════════════════════════");
          logger.info(`⏱️  Tiempo de ejecución: ${executionTime}ms`);
          logger.info("═══════════════════════════════════════════════════════════");

          return {
            success: true,
            found: false,
            message: "Usuario no encontrado con este número de teléfono",
            phoneNumber: normalizedPhone,
            executionTime: `${executionTime}ms`,
          };
        }

        // ═════════════════════════════════════════════════════════════════════
        // 3. OBTENER DATOS DEL USUARIO
        // ═════════════════════════════════════════════════════════════════════

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        logger.info("✅ User found:", {
          userId: userId,
          firstName: userData.first_name || "N/A",
          lastName: userData.last_name || "N/A",
        });

        // ═════════════════════════════════════════════════════════════════════
        // 4. CALCULAR CREDIT SCORE
        // ═════════════════════════════════════════════════════════════════════

        logger.info("💳 Calculating credit score...");

        const creditScore = await calculateCreditScore({...userData, uid: userId});
        const classification = classifyCreditScore(creditScore);

        logger.info("✅ Credit score calculated:", {
          score: creditScore,
          category: classification.category,
        });

        // ═════════════════════════════════════════════════════════════════════
        // 5. PREPARAR RESPUESTA
        // ═════════════════════════════════════════════════════════════════════

        const executionTime = Date.now() - startTime;

        const response = {
          success: true,
          found: true,
          user: {
            firstName: userData.first_name || "Usuario",
            lastName: userData.last_name || "",
            fullName: `${userData.first_name || "Usuario"} ${userData.last_name || ""}`.trim(),
            phoneNumber: normalizedPhone,
          },
          creditScore: {
            score: creditScore,
            category: classification.category,
            description: classification.description,
            loanLimit: classification.loanLimit,
            interestRate: classification.interestRate,
            minScore: classification.minScore,
            maxScore: classification.maxScore,
          },
          executionTime: `${executionTime}ms`,
          timestamp: new Date().toISOString(),
        };

        logger.info("═══════════════════════════════════════════════════════════");
        logger.info("✅ CREDIT SCORE OBTENIDO EXITOSAMENTE");
        logger.info("═══════════════════════════════════════════════════════════");
        logger.info(`👤 Usuario: ${response.user.fullName}`);
        logger.info(`📱 Teléfono: ${normalizedPhone.substring(0, 3)}***`);
        logger.info(`💳 Credit Score: ${creditScore} (${classification.category})`);
        logger.info(`💰 Límite de préstamo: $${classification.loanLimit.toLocaleString()}`);
        logger.info(`⏱️  Tiempo de ejecución: ${executionTime}ms`);
        logger.info("═══════════════════════════════════════════════════════════");

        return response;
      } catch (error) {
        const executionTime = Date.now() - startTime;

        logger.error("═══════════════════════════════════════════════════════════");
        logger.error("❌ ERROR AL OBTENER CREDIT SCORE");
        logger.error("═══════════════════════════════════════════════════════════");
        logger.error(`⏱️  Tiempo hasta el error: ${executionTime}ms`);
        logger.error("🔴 Error:", error.message);
        logger.error("📚 Stack:", error.stack);
        logger.error("═══════════════════════════════════════════════════════════");

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError(
            "internal",
            "Failed to get credit score information",
            {originalError: error.message},
        );
      }
    },
);

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN PARA FUTURAS FUNCIONES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * NOTAS PARA FUTURAS IMPLEMENTACIONES:
 *
 * 1. Para agregar más templates de WhatsApp:
 *    - Crear una función similar a sendWelcomeWhatsApp o sendDepositNotification
 *    - Reutilizar las funciones auxiliares (validatePhoneNumber, sendToWhatsAppAPI)
 *    - Cambiar solo el nombre del template y los parámetros
 *
 * 2. Templates disponibles para implementar:
 *    - Recordatorio de pago
 *    - Notificación de nuevo gasto
 *    - Alerta de presupuesto excedido
 *
 * 3. Para testing local:
 *    - Usar Firebase Emulator Suite: npm run serve
 *    - Configurar las variables de entorno localmente
 *
 * 4. Para monitoreo:
 *    - Ver logs: npm run logs
 *    - Firebase Console > Functions > Logs
 *    - Firebase Console > Functions > Metrics
 */

