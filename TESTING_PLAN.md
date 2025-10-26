# Plan de Pruebas - Sistema de Transferencias P2P

## Objetivo
Verificar que el sistema de transferencias P2P funciona correctamente con validación restrictiva de Account ID, actualización de balances en tiempo real, y guardado correcto en Firestore.

## Pre-requisitos
1. App corriendo en simulador o dispositivo
2. Usuario con cuenta Nessie creada
3. Al menos una cuenta con balance > 0
4. Conexión a internet estable
5. Firebase Firestore rules desplegadas

## Test Cases

### 1. Validación de Account ID

#### Test 1.1: Account ID Válido
**Pasos:**
1. Abrir TransferScreen desde Quick Actions en HomeScreen
2. Seleccionar cuenta origen
3. Ingresar Account ID válido de otra cuenta Nessie
4. Esperar validación automática (500ms debounce)

**Resultado Esperado:**
- ✅ Icono verde de verificación aparece
- ✅ Mensaje: "Account verified: [nickname] ([type])"
- ✅ Botón de transferencia se habilita

#### Test 1.2: Account ID Inexistente
**Pasos:**
1. Ingresar Account ID que no existe: "INVALID_ID_12345"
2. Esperar validación

**Resultado Esperado:**
- ❌ Icono rojo de error aparece
- ❌ Mensaje: "Account ID not found. Please verify the ID."
- ❌ Botón de transferencia permanece deshabilitado

#### Test 1.3: Account ID de la Misma Cuenta
**Pasos:**
1. Ingresar el Account ID de la cuenta seleccionada como origen
2. Esperar validación

**Resultado Esperado:**
- ❌ Icono rojo de error
- ❌ Mensaje: "Cannot transfer to the same account"
- ❌ Botón deshabilitado

#### Test 1.4: Account ID Mal Formado
**Pasos:**
1. Ingresar menos de 5 caracteres: "ABC"
2. Verificar que no se ejecute validación

**Resultado Esperado:**
- No se muestra icono
- No se ejecuta validación
- Botón deshabilitado

### 2. Validación de Fondos

#### Test 2.1: Fondos Suficientes
**Pasos:**
1. Cuenta origen con balance: $1000
2. Ingresar monto: $500
3. Verificar preview de balance

**Resultado Esperado:**
- ✅ Preview muestra: "New balance: $500.00"
- ✅ Botón habilitado
- ✅ No mensajes de error

#### Test 2.2: Fondos Insuficientes
**Pasos:**
1. Cuenta origen con balance: $100
2. Ingresar monto: $500

**Resultado Esperado:**
- ❌ Botón deshabilitado
- ❌ Mensaje de error al intentar continuar

#### Test 2.3: Monto Cero
**Pasos:**
1. Ingresar monto: $0

**Resultado Esperado:**
- ❌ Botón deshabilitado
- No se permite continuar

#### Test 2.4: Monto Negativo
**Pasos:**
1. Intentar ingresar monto negativo

**Resultado Esperado:**
- Input solo permite números positivos
- No se acepta entrada negativa

### 3. Ejecución de Transferencia

#### Test 3.1: Transferencia Exitosa
**Pasos:**
1. Cuenta A: $1000
2. Cuenta B: $500
3. Transferir $100 de A → B
4. Confirmar en modal
5. Esperar ejecución

**Resultado Esperado:**
- ✅ Loading state durante ejecución
- ✅ Navegación a TransferConfirmationScreen
- ✅ Animación de éxito
- ✅ Balance actualizado Cuenta A: $900
- ✅ Balance actualizado Cuenta B: $600
- ✅ Transfer ID mostrado
- ✅ Registro guardado en Firestore `transfers/{transferId}`

#### Test 3.2: Transferencia con Descripción
**Pasos:**
1. Crear transferencia con descripción: "Pago de renta"
2. Ejecutar

**Resultado Esperado:**
- ✅ Descripción aparece en confirmation screen
- ✅ Descripción guardada en Firestore
- ✅ Descripción visible en historial

#### Test 3.3: Transferencia usando Rewards
**Pasos:**
1. Seleccionar cuenta con rewards > 0
2. Cambiar medium a "Rewards"
3. Ingresar monto válido
4. Ejecutar

**Resultado Esperado:**
- ✅ Transferencia se ejecuta desde rewards
- ✅ Balance de rewards se actualiza
- ✅ Medium "rewards" guardado en Firestore

### 4. Actualización en Tiempo Real

#### Test 4.1: Balances Actualizados Después de Transfer
**Pasos:**
1. Ejecutar transferencia exitosa
2. Verificar balances en confirmation screen
3. Regresar a HomeScreen
4. Verificar balances actualizados

**Resultado Esperado:**
- ✅ Balances en confirmation screen reflejan cambio
- ✅ HomeScreen muestra balances actualizados
- ✅ No se requiere pull to refresh manual

### 5. Historial de Transferencias

#### Test 5.1: Ver Historial Vacío
**Pasos:**
1. Usuario sin transferencias previas
2. Abrir TransferHistoryScreen

**Resultado Esperado:**
- ✅ Empty state visible
- ✅ Mensaje: "No Transfers Yet"
- ✅ Botón "Make a Transfer"

#### Test 5.2: Ver Historial con Transferencias
**Pasos:**
1. Usuario con transferencias previas
2. Abrir TransferHistoryScreen

**Resultado Esperado:**
- ✅ Lista de transferencias ordenadas por fecha (más reciente primero)
- ✅ Cada item muestra:
  - Nickname cuenta destino
  - Monto con signo negativo (sent)
  - Fecha
  - Status badge
  - Descripción (si existe)

#### Test 5.3: Pull to Refresh
**Pasos:**
1. En TransferHistoryScreen
2. Pull down para refresh

**Resultado Esperado:**
- ✅ Indicador de loading aparece
- ✅ Lista se actualiza (si hay cambios)

### 6. Edge Cases y Manejo de Errores

#### Test 6.1: Network Error Durante Validación
**Pasos:**
1. Desactivar internet
2. Ingresar Account ID
3. Esperar validación

**Resultado Esperado:**
- ❌ Error message: "Network error. Please check your connection."
- ❌ Botón deshabilitado

#### Test 6.2: Network Error Durante Transfer
**Pasos:**
1. Configurar transferencia válida
2. Desactivar internet justo antes de confirmar
3. Intentar ejecutar

**Resultado Esperado:**
- ❌ Alert con mensaje de error
- ❌ No se guarda en Firestore
- ❌ Balances no cambian
- Usuario permanece en TransferScreen

#### Test 6.3: Cancelar Transferencia
**Pasos:**
1. Configurar transferencia
2. Abrir modal de confirmación
3. Presionar "Cancel"

**Resultado Esperado:**
- ✅ Modal se cierra
- ✅ Usuario regresa a TransferScreen
- ✅ Datos del formulario preservados
- ✅ No se ejecuta transferencia

### 7. Firestore Security

#### Test 7.1: Usuario Solo Ve Sus Transferencias
**Verificación manual en Firebase Console:**
1. Usuario A crea transferencias
2. Usuario B no debe poder leer transferencias de A

**Resultado Esperado:**
- ✅ Query filtrada por `userId`
- ✅ Solo transferencias propias visibles

#### Test 7.2: No Se Puede Modificar Transfer de Otro Usuario
**Verificación:**
- Intentar update directo en consola con otro userId

**Resultado Esperado:**
- ❌ Permission denied

### 8. Integration Tests

#### Test 8.1: Flujo Completo E2E
**Pasos:**
1. Login
2. HomeScreen → Click "Transferir"
3. Seleccionar cuenta origen
4. Ingresar Account ID válido
5. Verificar validación exitosa
6. Ingresar monto $50
7. Agregar descripción "Test transfer"
8. Click "Send $50.00"
9. Confirmar en modal
10. Verificar confirmation screen
11. Click "View Transfer History"
12. Verificar transferencia en lista
13. Regresar a Home
14. Verificar balance actualizado

**Resultado Esperado:**
- ✅ Flujo completo sin errores
- ✅ Transferencia visible en historial
- ✅ Balances actualizados correctamente
- ✅ Registro en Firestore correcto

## Checklist de Verificación

### Funcionalidad Core
- [ ] Validación restrictiva de Account ID funciona
- [ ] Transferencias se ejecutan correctamente
- [ ] Balances se actualizan en tiempo real
- [ ] Historial muestra todas las transferencias
- [ ] Firestore guarda registros correctamente

### UI/UX
- [ ] Loading states visibles durante operaciones async
- [ ] Animaciones smooth en confirmation screen
- [ ] Mensajes de error claros y específicos
- [ ] Debouncing funciona en validación de Account ID
- [ ] Modal de confirmación previene transfers accidentales

### Seguridad
- [ ] Firestore rules protegen transfers
- [ ] Validación de fondos en cliente y servidor (API)
- [ ] No se pueden hacer transfers a misma cuenta
- [ ] Solo owner puede ver sus transfers

### Performance
- [ ] Validación de Account ID < 1s
- [ ] Ejecución de transfer < 3s
- [ ] Actualización de balances < 2s
- [ ] Historial carga < 1s

## Resultados de Pruebas

| Test Case | Status | Notas |
|-----------|--------|-------|
| 1.1 - Account ID Válido | ⏳ Pendiente | |
| 1.2 - Account ID Inexistente | ⏳ Pendiente | |
| 1.3 - Misma Cuenta | ⏳ Pendiente | |
| 1.4 - Mal Formado | ⏳ Pendiente | |
| 2.1 - Fondos Suficientes | ⏳ Pendiente | |
| 2.2 - Fondos Insuficientes | ⏳ Pendiente | |
| 2.3 - Monto Cero | ⏳ Pendiente | |
| 3.1 - Transfer Exitoso | ⏳ Pendiente | |
| 3.2 - Con Descripción | ⏳ Pendiente | |
| 3.3 - Usando Rewards | ⏳ Pendiente | |
| 4.1 - Balances Actualizados | ⏳ Pendiente | |
| 5.1 - Historial Vacío | ⏳ Pendiente | |
| 5.2 - Con Transferencias | ⏳ Pendiente | |
| 5.3 - Pull to Refresh | ⏳ Pendiente | |
| 6.1 - Network Error Validación | ⏳ Pendiente | |
| 6.2 - Network Error Transfer | ⏳ Pendiente | |
| 6.3 - Cancelar Transfer | ⏳ Pendiente | |
| 8.1 - Flujo E2E Completo | ⏳ Pendiente | |

## Notas de Testing

- **Ambiente**: Desarrollo (Firebase capitalonehackmty)
- **API**: Nessie sandbox (Capital One)
- **Versión App**: [Pendiente]
- **Tester**: [Pendiente]
- **Fecha**: [Pendiente]

## Issues Encontrados

_(Se llenarán durante testing)_

## Mejoras Sugeridas

_(Se llenarán durante testing)_

