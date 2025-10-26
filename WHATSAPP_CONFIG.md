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

### 2. Template: `nuevo_deposito_en_tu_cuenta`
- **Estado**: APPROVED ✅
- **Idioma**: `es_ES` (Español)
- **Categoría**: UTILITY
- **Trigger**: Al recibir una transferencia de dinero
- **Variables**:
  - `{{1}}`: Nombre del remitente (quien envió el dinero)

#### Contenido del Mensaje

Cuando un usuario recibe dinero, recibirá este mensaje:

```
┌─────────────────────────────────────────────────┐
│ 💰 ¡Nuevo depósito en tu cuenta!                │
│                                                  │
│ Has recibido dinero de {{1}}                    │
│                                                  │
│ — Capi                                          │
│ Tu asistente financiero en Capital One         │
└─────────────────────────────────────────────────┘
```

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

1. **sendWelcomeWhatsApp** - Envía mensaje de bienvenida al registrar usuario
2. **sendDepositNotification** - Envía notificación cuando se recibe dinero

## Futuras Implementaciones

Este archivo también servirá para configurar futuros templates de WhatsApp:

- Recordatorio de pagos
- Alertas de gastos excedidos
- Notificaciones de presupuestos
- etc.

Todos seguirán el mismo patrón de configuración.

