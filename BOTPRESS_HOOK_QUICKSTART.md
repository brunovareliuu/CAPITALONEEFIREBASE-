# 🚀 Botpress Hook - Capital One (Guía Rápida)

## ✅ Implementación en 3 Pasos

### Paso 1: Copiar el Código

1. Abre `botpress-credit-score-hook.js`
2. Copia **TODO** el contenido
3. Ve a Botpress → **Hooks** → **Before Incoming Message**
4. Pega el código completo

### Paso 2: Usar el Contexto en AI Task

En tu **AI Task**, agrega el contexto:

```
System Prompt:
Eres Capi, el asistente financiero de Capital One en México.
Ayudas a usuarios con préstamos, productos bancarios y educación financiera.

Context:
{{user.aiPrompt}}

User Message:
{{event.preview}}
```

### Paso 3: ¡Listo!

El bot ahora:
- ✅ Obtiene automáticamente el teléfono de WhatsApp
- ✅ Busca al usuario en Capital One
- ✅ Carga su credit score y perfil
- ✅ Genera un prompt personalizado
- ✅ Guarda todo en variables de usuario

---

## 📊 Variables Disponibles

Después del hook, tendrás acceso a:

| Variable | Tipo | Ejemplo |
|----------|------|---------|
| `user.firstName` | string | "Marcelo" |
| `user.fullName` | string | "Marcelo García" |
| `user.creditScore` | number | 730 |
| `user.creditCategory` | string | "Good" |
| `user.loanLimit` | number | 50000 |
| `user.interestRate` | string | "10-14%" |
| `user.aiPrompt` | string | (Prompt completo) |
| `user.found` | boolean | true |
| `user.userPhoneNumber` | string | "5218120394578" |

---

## 💬 Ejemplo de Uso en Flujo

```javascript
// En un nodo de texto
Hola {{user.firstName}}! 👋

Tu credit score es {{user.creditScore}}/850 ({{user.creditCategory}}).
Puedes solicitar préstamos hasta ${{user.loanLimit}} MXN.

¿Te interesa algún producto?
```

---

## 🔍 Cómo Funciona

```
Usuario escribe en WhatsApp
        ↓
Hook obtiene número: event.tags.conversation['whatsapp:userPhone']
        ↓
Llama a Firebase endpoint: getCreditScoreByPhone
        ↓
Genera prompt personalizado con generateUserAIPrompt()
        ↓
Guarda en user.aiPrompt y otras variables
        ↓
AI Task usa {{user.aiPrompt}} como contexto
        ↓
Bot responde con información personalizada
```

---

## 🎯 El Número de Teléfono

El código obtiene automáticamente el número:

```javascript
const numeroTelefono = event.tags.conversation['whatsapp:userPhone'];
```

Y lo normaliza en el endpoint (quita el "1" extra de México automáticamente).

---

## 🔧 Debug

Para ver los logs en Botpress:

```javascript
console.log('Credit Score:', user.creditScore);
console.log('Categoría:', user.creditCategory);
console.log('Prompt cargado:', user.aiPrompt ? 'Sí' : 'No');
```

Aparecerán en: **Botpress Console** → **Logs**

---

## ⚠️ Manejo de Errores

Si el usuario no existe o hay error:

```javascript
user.found = false
user.firstName = 'Usuario'
user.aiPrompt = 'Usuario no encontrado en Capital One...'
```

El bot seguirá funcionando, solo sin contexto específico.

---

## 🎉 ¡Eso es Todo!

Con esto, tu bot de Capital One está **100% personalizado** para cada usuario.

**Endpoint usado:**
```
https://us-central1-capitalonehackmty.cloudfunctions.net/getCreditScoreByPhone
```

**Documentación completa:**
- `BOTPRESS_INTEGRATION.md` - Guía detallada
- `botpress-integration.js` - Funciones auxiliares
- `WHATSAPP_CONFIG.md` - Info del endpoint

