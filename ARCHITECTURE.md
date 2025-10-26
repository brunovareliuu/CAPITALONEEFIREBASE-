# Arquitectura del Sistema Capital One

## Módulos Principales

### 1. Autenticación y Perfil de Usuario
- **Ubicación**: `src/auth/`, `src/context/AuthContext.js`
- **Funcionalidad**: Registro, login, gestión de sesión de usuario
- **Integración**: Firebase Authentication
- **Datos almacenados**:
  - Perfil de usuario en Firestore (`users/{userId}`)
  - Preferencias de moneda y configuración

### 2. Sistema de Tarjetas Digitales
- **Ubicación**: `src/screens/capitalone/`, `src/services/firestoreService.js`
- **Funcionalidad**:
  - Creación de cuentas en Firestore
  - Gestión de tarjetas digitales vinculadas a cuentas Firebase
  - Sincronización de balances en tiempo real
- **Base de datos**: Firestore (Firebase)

### 3. Sistema de Transferencias P2P

#### **Módulo: Transfer Service**
- **Ubicación**: `src/services/firestoreService.js`
- **Funcionalidad**:
  - Validación de cuentas vía Firestore
  - Creación de transfers P2P
  - Actualización en tiempo real de balances
- **Base de datos**: Firestore (Firebase)

#### **Funciones Principales**:

```javascript
// Validación de cuentas
getAccountById(accountId)
// Retorna: Promise<DocumentSnapshot> - Documento de cuenta de Firestore

// Crear transferencia P2P
createFirebaseTransfer(payerAccountId, payeeAccountId, amount, medium, description)
// Valida ambas cuentas, verifica fondos, ejecuta transferencia en Firestore

// Actualizar balances en tiempo real
updateAccountBalance(accountId, amount)
// Actualiza balance de cuenta en Firestore

// Obtener transacciones del usuario
getUserTransactions(userId)
// Retorna: Promise<QuerySnapshot> - Transacciones del usuario
```

#### **Screens**:

1. **TransferScreen** (`src/screens/TransferScreen.js`)
   - Formulario simplificado para transferencias
   - Input de Account ID con validación debounced
   - Selector de cuenta origen
   - Input de monto con validación de fondos
   - Selector de medium (balance/rewards)
   - Preview de balances actualizados
   - Modal de confirmación antes de ejecutar

2. **TransferConfirmationScreen** (`src/screens/TransferConfirmationScreen.js`)
   - Animación de éxito
   - Resumen de transferencia con balances actualizados
   - Transfer ID y detalles
   - Acciones: Nueva transferencia, Ver historial, Ir a Home

3. **TransferHistoryScreen** (`src/screens/TransferHistoryScreen.js`)
   - Lista de transferencias del usuario
   - Pull to refresh
   - Filtros por tipo
   - Estado de cada transferencia

#### **Firestore Collections**:

**`transfers/{transferId}`**
- `userId` (string, indexed) - UID del usuario que envía
- `payerAccountId` (string) - ID cuenta origen en Firestore
- `payeeAccountId` (string) - ID cuenta destino en Firestore
- `payerName` (string) - Nombre del pagador
- `payeeName` (string) - Nombre del receptor
- `amount` (number) - Monto transferido
- `medium` (string) - 'balance' o 'rewards'
- `description` (string) - Descripción opcional
- `type` (string) - 'transfer_in' o 'transfer_out'
- `status` (string) - 'pending', 'completed', 'cancelled'
- `transactionDate` (timestamp) - Fecha de transacción
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

#### **Security**:
- Validación restrictiva de Account ID en cada request
- Verificación de fondos suficientes antes de transferir
- Firestore rules: solo lectura/escritura de propias transferencias
- No se pueden transferir a la misma cuenta
- Validaciones de monto (> 0, <= balance disponible)

#### **Flujo de Transferencia**:
1. Usuario selecciona cuenta origen
2. Usuario ingresa Account ID destino
3. Sistema valida cuenta destino en Firestore
4. Usuario ingresa monto y descripción opcional
5. Sistema valida fondos suficientes
6. Modal de confirmación
7. Ejecución de transferencia en Firestore
8. Actualización de balances en tiempo real
9. Navegación a pantalla de confirmación

#### **Navegación**:
```javascript
// App.js
<Stack.Screen name="Transfer" component={TransferScreen} />
<Stack.Screen name="TransferConfirmation" component={TransferConfirmationScreen} />
<Stack.Screen name="TransferHistory" component={TransferHistoryScreen} />
```

#### **Integración con HomeScreen**:
- Botón "Transferir" en Quick Actions
- Botón "Historial" para ver transferencias pasadas

### 4. Gestión de Gastos y Categorías
- **Ubicación**: `src/screens/`, `src/services/firestoreService.js`
- **Funcionalidad**:
  - Creación y edición de categorías personalizadas
  - Registro de gastos e ingresos
  - Categorización de transacciones
  - Transacciones compartidas en tarjetas compartidas
- **Collections**:
  - `users/{userId}/categories`
  - `cards/{cardId}/expenses`
  - `cards/{cardId}/expenses/{expenseId}/categorizations/{userId}`

### 5. Sistema de Planes (Savings y Gestión)
- **Ubicación**: `src/screens/`, `src/services/firestoreService.js`
- **Funcionalidad**:
  - Planes de ahorro con metas
  - Planes de gestión de gastos grupales
  - Invitaciones con códigos
  - Liquidaciones entre miembros
- **Collections**:
  - `plan/{planId}`
  - `plan/{planId}/savingsLogs/{dateId}`
  - `plan/{planId}/people/{personId}`
  - `plan/{planId}/expenses/{expenseId}`
  - `planInvites/{code}`

### 6. Presupuestos (Budgets)
- **Ubicación**: `src/screens/Budget*.js`
- **Funcionalidad**:
  - Creación de presupuestos por categoría
  - Seguimiento de gastos vs presupuesto
  - Alertas de límites
- **Collection**: `budgets/{budgetId}`

### 7. Transacciones Pendientes
- **Ubicación**: `src/screens/PendingTransactionsScreen.js`
- **Funcionalidad**:
  - Gestión de transacciones sin categorizar
  - Categorización de transacciones compartidas
- **Collection**: `transactions/{transactionId}`

## Reglas de Firestore

### Transfers
```javascript
match /transfers/{transferId} {
  allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
  allow create: if isSignedIn() && request.auth.uid == request.resource.data.userId;
  allow update: if isSignedIn() && request.auth.uid == resource.data.userId;
}
```

## Variables de Entorno

### Nessie API (Capital One)
- `NESSIE_API_KEY`: cf56fb5b0f0c73969f042c7ad5457306
- `NESSIE_BASE_URL`: http://api.nessieisreal.com

### Firebase
- Configuración en `src/config/firebase.js`
- Proyecto: capitalonehackmty

### WhatsApp Business API
- **Cloud Function**: `sendWelcomeWhatsApp`
- **Template**: `bienvenida_capi` (APPROVED ✅)
- **Idioma**: es_ES
- **Trigger**: Se envía automáticamente al crear una cuenta nueva
- **Secrets en Firebase Functions**:
  - `WHATSAPP_PHONE_NUMBER_ID`: 746704208532528
  - `WHATSAPP_ACCESS_TOKEN`: (configurado en Firebase Secrets)
- **Integración**:
  - Cliente: `src/services/whatsappService.js`
  - Servidor: `functions/index.js`
  - Configuración: `WHATSAPP_CONFIG.md`

## Dependencias Principales

- **React Native**: Framework de desarrollo móvil
- **Firebase**: Backend (Auth, Firestore, Functions)
- **Expo**: Herramientas de desarrollo y build
- **React Navigation**: Navegación entre pantallas
- **Expo Vector Icons**: Iconografía

## Estructura de Datos

### Usuario (Firestore)
```javascript
{
  email: string,
  name: string,
  phoneNumber: string, // formato: "{countryCode}{number}"
  currency: {
    code: string,
    icon: string,
    name: string
  },
  nessieCustomerId: string,
  completedAccountQuiz: boolean,
  createdAt: timestamp
}
```

### Tarjeta Digital (Firestore)
```javascript
{
  userId: string,
  numeroTarjeta: string,
  cvv: string,
  nombreTitular: string,
  fechaVencimiento: string,
  tipo: string, // "Checking", "Savings", "Credit Card"
  saldo: number,
  nessieAccountId: string,
  createdAt: timestamp
}
```

### Transferencia (Firestore)
```javascript
{
  userId: string,
  nessieTransferId: string,
  payer_id: string,
  payee_id: string,
  payer_nickname: string,
  payee_nickname: string,
  amount: number,
  medium: string, // "balance" | "rewards"
  description: string,
  status: string, // "pending" | "completed" | "cancelled"
  transaction_date: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Transfer (Nessie API)
```javascript
{
  _id: string,
  type: "p2p",
  transaction_date: string,
  status: string,
  medium: string,
  payer_id: string,
  payee_id: string,
  amount: number,
  description: string
}
```

## Flujos Principales

### 1. Onboarding de Usuario Nuevo
1. WelcomeScreen → LoginScreen/SignUpScreen
2. Registro con email, contraseña, nombre, teléfono, moneda
3. Creación de usuario en Firebase Auth
4. Creación de perfil en Firestore
5. **Envío automático de mensaje WhatsApp de bienvenida** (template: `bienvenida_capi`)
6. AccountQuizScreen (creación de cuenta Nessie)
7. TarjetaDigitalScreen (creación de tarjeta digital)
8. HomeScreen (acceso completo a la app)

### 2. Transferencia P2P
1. HomeScreen → Quick Action "Transferir" → TransferScreen
2. Selección de cuenta origen
3. Input y validación de Account ID destino
4. Input de monto y validación de fondos
5. (Opcional) Descripción
6. Modal de confirmación
7. Ejecución vía Nessie API
8. Guardado en Firestore
9. TransferConfirmationScreen con balances actualizados
10. Opciones: Nueva transferencia, Ver historial, Home

### 3. Visualización de Historial
1. HomeScreen → Quick Action "Historial" → TransferHistoryScreen
2. Lista de todas las transferencias del usuario
3. Pull to refresh para actualizar
4. Tap en transferencia para ver detalles

## Seguridad

### Firebase Rules
- Usuarios solo pueden leer/escribir sus propios datos
- Tarjetas: miembros pueden leer, owner puede modificar
- Planes: miembros pueden leer, owner puede modificar
- Transferencias: solo el usuario que envía puede leer/escribir

### API Keys
- Nessie API Key almacenada en código (sandbox pública)
- WhatsApp credentials en Firebase Secrets
- Firebase config expuesto (rules protegen data)

## Optimizaciones

### Firestore
- Índices compuestos para queries complejas
- Real-time listeners para sincronización automática
- Minimización de lecturas con consultas específicas
- Batch writes para operaciones múltiples

### Nessie API
- Validación restrictiva antes de operaciones
- Refresh de balances solo después de cambios
- Caché de información de cuentas cuando es apropiado
- Manejo de errores y retry logic

### UX
- Loading states en todas las operaciones async
- Animaciones smooth para transiciones
- Debouncing en validaciones en tiempo real
- Pull to refresh en listas
- Error handling user-friendly

## Próximos Pasos / Mejoras Futuras

1. **Rate Limiting**: Implementar límites de transferencias por periodo
2. **Notificaciones**: Push notifications para transferencias recibidas
3. **Scheduled Transfers**: Transferencias programadas
4. **Recurring Transfers**: Transferencias recurrentes
5. **Transfer Templates**: Plantillas para transferencias frecuentes
6. **Multi-currency**: Soporte para múltiples monedas
7. **QR Code**: Generación de QR con Account ID para facilitar transferencias
8. **Biometric Auth**: Confirmación biométrica para transferencias
9. **Export History**: Exportar historial en PDF/CSV
10. **Analytics**: Dashboard de gastos y transferencias

