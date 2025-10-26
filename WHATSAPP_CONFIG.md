# Configuración de WhatsApp Business API - Capital One

## Credenciales de WhatsApp

Para que la integración de WhatsApp funcione correctamente, necesitas configurar las siguientes variables de entorno en Firebase Functions:

### Variables Requeridas:

1. **WHATSAPP_PHONE_NUMBER_ID**: `746704208532528` (actualizado para template `bienvenida_capi`)
2. **WHATSAPP_ACCESS_TOKEN**: `EAAatfRZA2uCIBPyJgesZAszfcEgVopEJ5tIeKOpV5icaZAJttoWRJ3HJ62iABSzltMvNBcMRgEKeK1vwNi2aEMBu6GSPKQ3yMTZA6WzmTLr4zARMtGZApppKQvEFtSBZCEXBGoZAHN7OQNQTbBVpAEuc0FGGjdcdTpbo1tfxw0s9ceSg4ptfygj3QOFBacm4YPi9gZDZD`

> **NOTA**: Las credenciales ya están configuradas en Firebase Functions Secrets. No es necesario volver a configurarlas a menos que hayan cambiado.

### Cómo Configurar (Opción 1 - Firebase Console):

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **nichtarm**
3. Ve a **Functions** > **Secrets**
4. Haz clic en **Create Secret** y agrega:

   **Secret 1:**
   - Name: `WHATSAPP_PHONE_NUMBER_ID`
   - Value: `746704208532528`

   **Secret 2:**
   - Name: `WHATSAPP_ACCESS_TOKEN`
   - Value: `EAAatfRZA2uCIBPyJgesZAszfcEgVopEJ5tIeKOpV5icaZAJttoWRJ3HJ62iABSzltMvNBcMRgEKeK1vwNi2aEMBu6GSPKQ3yMTZA6WzmTLr4zARMtGZApppKQvEFtSBZCEXBGoZAHN7OQNQTbBVpAEuc0FGGjdcdTpbo1tfxw0s9ceSg4ptfygj3QOFBacm4YPi9gZDZD`

### Cómo Configurar (Opción 2 - CLI):

```bash
# Navega al directorio del proyecto
cd "/Users/mg/Desktop/TEC/HACKATHON CAPITAL ONE/Capital-One"

# Configura los secrets usando Firebase CLI
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
# Te pedirá el valor, ingresa: 746704208532528

firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN
# Te pedirá el valor, ingresa el token completo
```

## Templates de WhatsApp Disponibles

### 1. Template: `bienvenida_capi`
- **Estado**: APPROVED ✅
- **Idioma**: `es_ES` (Español)
- **Categoría**: UTILITY
- **Trigger**: Al crear una cuenta nueva
- **Variables**:
  - `{{1}}`: Nombre del cliente (primer nombre)

#### Contenido del Mensaje

Cuando un usuario se registra, recibirá este mensaje:

```
┌─────────────────────────────────────────────────┐
│ 📋 HEADER: Bienvenid@ a Capital One!           │
│                                                  │
│ Hola {{1}},                                     │
│ ¡bienvenido(a) a Capital One!                   │
│                                                  │
│ Soy Capi, tu asistente financiero personal.    │
│ Tu nueva cuenta ha sido creada exitosamente.   │
│ A partir de ahora recibirás recordatorios,     │
│ consejos y notificaciones sobre tu progreso    │
│ financiero para ayudarte a alcanzar tus        │
│ metas. 💼                                       │
│                                                  │
│ — Capi                                          │
│ Tu asistente financiero en Capital One         │
└─────────────────────────────────────────────────┘
```

### 2. Template: `nuevo_depsito_en_tu_cuenta`
- **Estado**: APPROVED ✅
- **Idioma**: `es_ES` (Español)
- **Categoría**: UTILITY
- **Trigger**: Al recibir una transferencia de dinero
- **Variables**:
  - `{{1}}`: **Nombre del receptor** (quien recibe el dinero)
- **Nota**: El nombre tiene un typo intencional "depsito" (sin la "o")
- **Importante**: Se envía el nombre del RECEPTOR (no del remitente) para personalizar el saludo

#### Contenido del Mensaje

Cuando un usuario recibe dinero, recibirá este mensaje:

```
┌─────────────────────────────────────────────────┐
│ 💰 Hola {{1}}, ¡recibiste un depósito!         │
│                                                  │
│ Se ha acreditado dinero en tu cuenta           │
│                                                  │
│ — Capi                                          │
│ Tu asistente financiero en Capital One         │
└─────────────────────────────────────────────────┘
```

**Ejemplo**: Si el receptor se llama "Bruno", recibirá: "Hola Bruno, ¡recibiste un depósito!"

#### Implementación

```javascript
// En TransferAmountScreen.js
import { sendDepositNotification } from '../services/whatsappService';
import { getUserProfile } from '../services/firestoreService';

// IMPORTANTE: Obtener datos del RECEPTOR (quien recibe el dinero)
const recipientProfile = await getUserProfile(recipientUserId);
const recipientData = recipientProfile.data();
const recipientPhone = recipientData.phoneNumber;
const recipientFirstName = recipientData.first_name || recipientData.displayName?.split(' ')[0] || 'Usuario';

// Enviar notificación con el nombre del receptor
await sendDepositNotification(recipientPhone, recipientFirstName);
```

**Nota importante**: A pesar de que el parámetro se llama `senderName` en el código, se debe pasar el **nombre del receptor** para que el mensaje diga "Hola {Nombre}", personalizando la experiencia del usuario que recibe el dinero.

## Deploy de Firebase Functions

Una vez configuradas las variables de entorno:

```bash
cd "/Users/mg/Desktop/TEC/HACKATHON CAPITAL ONE/Capital-One/functions"
npm install
cd ..
firebase deploy --only functions
```

## Verificar Configuración

Después del deploy, puedes verificar que las secrets están configuradas:

```bash
firebase functions:secrets:access WHATSAPP_PHONE_NUMBER_ID
firebase functions:secrets:access WHATSAPP_ACCESS_TOKEN
```

## Testing

### 1. Test Local (Emulador)

```bash
# En una terminal, inicia el emulador
cd "/Users/mg/Desktop/TEC/HACKATHON CAPITAL ONE/Capital-One"
firebase emulators:start --only functions

# En whatsappService.js, descomenta la línea:
# connectFunctionsEmulator(functions, "localhost", 5001);
```

### 2. Test en Producción

1. Despliega las functions
2. Registra un nuevo usuario en la app
3. Verifica los logs:
   ```bash
   firebase functions:log --only sendWelcomeWhatsApp
   ```
4. Verifica que el mensaje llegó al WhatsApp del usuario

## Monitoreo

### Ver Logs en Tiempo Real

```bash
firebase functions:log --only sendWelcomeWhatsApp --follow
```

### Ver Métricas en Firebase Console

1. Ve a Firebase Console > Functions
2. Selecciona `sendWelcomeWhatsApp`
3. Ve a la pestaña "Metrics" para ver:
   - Invocaciones
   - Errores
   - Tiempo de ejecución
   - Memoria utilizada

## Renovar el Access Token

El Access Token de WhatsApp puede expirar. Si eso ocurre:

1. Ve a [Meta Business Manager](https://business.facebook.com/)
2. Genera un nuevo token
3. Actualiza el secret en Firebase:
   ```bash
   firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN
   ```
4. Redeploy las functions:
   ```bash
   firebase deploy --only functions
   ```

## Troubleshooting

### Error: "WhatsApp credentials not configured"

- Verifica que los secrets estén configurados correctamente
- Asegúrate de haber desplegado las functions después de configurar los secrets

### Error: "WhatsApp API error: 190"

- El Access Token ha expirado
- Genera un nuevo token y actualiza el secret

### Error: "Invalid phone number"

- Verifica que el número incluya el código de país
- Formato correcto: "528120394578" (sin +, sin espacios)

### El mensaje no llega al usuario

- Verifica que el template esté aprobado en WhatsApp Business Manager
- Verifica que el número de teléfono sea válido
- Revisa los logs de Firebase Functions para ver errores

## Costos

- **Firebase Cloud Functions**: ~$0.40 por millón de invocaciones
- **WhatsApp Business API**: ~$0.05 USD por mensaje en México
- **Total estimado**: <$0.10 USD por registro de usuario

## Cloud Functions Desplegadas

### WhatsApp Integration
1. **sendWelcomeWhatsApp** - Envía mensaje de bienvenida al registrar usuario
2. **sendDepositNotification** - Envía notificación cuando se recibe dinero

### Credit Score & User Services
3. **getCreditScoreByPhone** - Busca usuario por teléfono y retorna credit score e información crediticia

## Credit Score Service - getCreditScoreByPhone

### Descripción
Endpoint para agentes de WhatsApp que permite buscar un usuario por su número de teléfono y obtener su información de credit score.

### Endpoint
```
https://us-central1-capitalonehackmty.cloudfunctions.net/getCreditScoreByPhone
```

### Normalización de Teléfono
- Los números de WhatsApp mexicanos incluyen un "1" extra que **no está en la base de datos**
- El endpoint automáticamente normaliza el número:
  - WhatsApp: `5218120394578` → Base de datos: `528120394578`

### Request
```json
{
  "data": {
    "phoneNumber": "5218120394578"
  }
}
```

### Response (Usuario encontrado)
```json
{
  "success": true,
  "found": true,
  "user": {
    "firstName": "Marcelo",
    "lastName": "García",
    "fullName": "Marcelo García",
    "phoneNumber": "528120394578"
  },
  "creditScore": {
    "score": 730,
    "category": "Good",
    "description": "Buen historial crediticio. Buenas opciones de préstamos disponibles.",
    "loanLimit": 50000,
    "interestRate": "10-14%",
    "minScore": 670,
    "maxScore": 739
  },
  "executionTime": "245ms",
  "timestamp": "2025-10-26T10:30:00.000Z"
}
```

### Response (Usuario no encontrado)
```json
{
  "success": true,
  "found": false,
  "message": "Usuario no encontrado con este número de teléfono",
  "phoneNumber": "528120394578",
  "executionTime": "120ms"
}
```

### Clasificación de Credit Score

El sistema clasifica el credit score en **5 grupos**:

1. **Excellent** (800-850)
   - Excelente historial crediticio
   - Límite de préstamo: $100,000
   - Tasa de interés: 5-7%

2. **Very Good** (740-799)
   - Muy buen historial crediticio
   - Límite de préstamo: $75,000
   - Tasa de interés: 7-10%

3. **Good** (670-739)
   - Buen historial crediticio
   - Límite de préstamo: $50,000
   - Tasa de interés: 10-14%

4. **Fair** (580-669)
   - Historial crediticio regular
   - Límite de préstamo: $25,000
   - Tasa de interés: 14-18%

5. **Poor** (300-579)
   - Historial crediticio necesita mejora
   - Límite de préstamo: $5,000
   - Tasa de interés: 18-25%

### Cálculo del Credit Score

El credit score se calcula basándose en 4 factores principales:

1. **Préstamos** (40% - hasta 240 puntos)
   - +50 puntos por cada préstamo aprobado (máximo 200 puntos)
   - -30 puntos por cada préstamo rechazado

2. **Balance Total** (30% - hasta 180 puntos)
   - +10 puntos por cada $1,000 de balance (máximo 180 puntos)

3. **Historial de Transacciones** (20% - hasta 120 puntos)
   - +2 puntos por cada transacción (máximo 120 puntos)

4. **Antigüedad de Cuenta** (10% - hasta 60 puntos)
   - +10 puntos por cada mes de antigüedad (máximo 60 puntos)

**Score mínimo**: 300 puntos (base)
**Score máximo**: 850 puntos

### Ejemplo de Uso desde Cliente

```javascript
// Llamar al endpoint desde React Native o cualquier cliente
const response = await fetch(
  'https://us-central1-capitalonehackmty.cloudfunctions.net/getCreditScoreByPhone',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        phoneNumber: '5218120394578', // Formato WhatsApp (con el 1 extra)
      },
    }),
  }
);

const result = await response.json();

if (result.result.found) {
  console.log(`Usuario: ${result.result.user.fullName}`);
  console.log(`Credit Score: ${result.result.creditScore.score}`);
  console.log(`Categoría: ${result.result.creditScore.category}`);
  console.log(`Límite de préstamo: $${result.result.creditScore.loanLimit}`);
} else {
  console.log('Usuario no encontrado');
}
```

## Futuras Implementaciones

Este archivo también servirá para configurar futuros templates de WhatsApp:

- Recordatorio de pagos
- Alertas de gastos excedidos
- Notificaciones de presupuestos
- etc.

Todos seguirán el mismo patrón de configuración.

