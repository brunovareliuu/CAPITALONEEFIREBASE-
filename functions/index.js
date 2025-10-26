/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAPITAL ONE - CLOUD FUNCTIONS
 * WhatsApp Business API Integration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Este archivo contiene las Cloud Functions para integrar WhatsApp Business API
 * con la aplicación Capital One.
 *
 * Funciones disponibles:
 * - sendWelcomeWhatsApp: Envía mensaje de bienvenida al registrarse un usuario
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const {logger} = require("firebase-functions");
const {defineSecret} = require("firebase-functions/params");

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
 * @param {string} data.senderName - Nombre de quien envió el dinero
 *
 * @return {Promise<Object>} Resultado del envío
 *
 * Ejemplo de uso desde el cliente:
 * ```javascript
 * const result = await sendDepositNotification({
 *   phoneNumber: "528120394578",
 *   senderName: "Juan Pérez"
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

        // Validar nombre del remitente
        const nameValidation = validateClientName(senderName);
        if (!nameValidation.valid) {
          logger.warn("⚠️ Nombre de remitente inválido:", nameValidation.error);
          throw new HttpsError("invalid-argument", nameValidation.error);
        }

        const formattedPhone = phoneValidation.formatted;
        const trimmedName = senderName.trim();

        logger.info("✅ Validaciones exitosas", {
          formattedPhone: `${formattedPhone.substring(0, 3)}***`,
          senderName: trimmedName,
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
        // 4. CONSTRUIR PAYLOAD PARA TEMPLATE: nuevo_deposito_en_tu_cuenta
        // ═════════════════════════════════════════════════════════════════════

        const payload = {
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "template",
          template: {
            name: "nuevo_deposito_en_tu_cuenta",
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
          template: "nuevo_deposito_en_tu_cuenta",
          language: "es_ES",
          senderName: trimmedName,
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
        logger.info(`👤 Remitente: ${trimmedName}`);
        logger.info(`📨 Message ID: ${whatsappResponse.messages?.[0]?.id || "N/A"}`);
        logger.info("═══════════════════════════════════════════════════════════");

        return {
          success: true,
          messageId: whatsappResponse.messages?.[0]?.id,
          phone: formattedPhone,
          senderName: trimmedName,
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

