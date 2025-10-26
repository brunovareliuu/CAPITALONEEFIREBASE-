# 🤖 Extraer Respuesta del LLM (OpenAI)

## 🎯 Objetivo

Extraer el mensaje generado por OpenAI desde:
```
workflow.openia.choices[0].content
```

Y guardarlo en:
```
workflow.aiResponse
```

---

## 🚀 Uso en Botpress

### Opción 1: Versión Completa (Recomendada)

**Archivo:** `botpress-extract-ai-response.js`

✅ Manejo completo de errores
✅ Logs detallados para debugging
✅ Validación de estructura
✅ Mensajes de fallback

**Cuándo usar:**
- Producción
- Necesitas debugging
- Quieres logs detallados

### Opción 2: Versión Simple

**Archivo:** `botpress-extract-ai-simple.js`

✅ Solo 2 líneas de código
✅ Mínimo overhead
✅ Más rápido

**Cuándo usar:**
- Testing rápido
- Prototipo
- Ya confías en que funciona

---

## 📋 Implementación

### Paso 1: Ubicar el Nodo

Después de tu **AI Task / Generate (OpenAI)**, agrega un nodo de **Execute Code**.

### Paso 2: Copiar el Código

**Versión Completa:**
```javascript
try {
  console.log('🤖 Extrayendo respuesta del LLM...');

  if (workflow.openia && 
      workflow.openia.choices && 
      Array.isArray(workflow.openia.choices) && 
      workflow.openia.choices.length > 0) {
    
    const aiMessage = workflow.openia.choices[0].content;
    workflow.aiResponse = aiMessage;
    
    console.log('✅ Respuesta del AI extraída exitosamente');
    console.log('📝 Longitud:', aiMessage ? aiMessage.length : 0, 'caracteres');
    console.log('🤖 Model:', workflow.openia.model || 'Unknown');
    
  } else {
    console.error('❌ Error: workflow.openia no tiene la estructura esperada');
    workflow.aiResponse = 'Lo siento, hubo un error al generar la respuesta.';
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  workflow.aiResponse = 'Lo siento, hubo un error técnico.';
}

console.log('✅ workflow.aiResponse:', workflow.aiResponse ? 'Asignado ✓' : 'Vacío ✗');
```

**Versión Simple:**
```javascript
workflow.aiResponse = workflow.openia?.choices?.[0]?.content || 'Error al generar respuesta';
console.log('✅ AI Response:', workflow.aiResponse ? 'Guardado' : 'Error');
```

### Paso 3: Usar la Variable

Ahora puedes usar `workflow.aiResponse` en cualquier lugar:

**En un nodo de texto:**
```
{{workflow.aiResponse}}
```

**En código JavaScript:**
```javascript
const respuesta = workflow.aiResponse;
console.log(respuesta);
```

**En condiciones:**
```javascript
if (workflow.aiResponse && workflow.aiResponse.length > 0) {
  // Hay respuesta
} else {
  // No hay respuesta
}
```

---

## 🔍 Estructura de workflow.openia

```javascript
workflow.openia = {
  id: "chatcmpl-CUmjP1jErrR58eSH7NQQZPMa2R53w",
  provider: "OpenAI",
  model: "gpt-5-mini-2025-08-07",
  choices: [
    {
      role: "assistant",
      type: "text",
      content: "¡Hola! Soy un asistente experto en productos..." // ← ESTO extraemos
    }
  ]
}
```

**Extraemos:** `choices[0].content` ← El mensaje del AI

**Guardamos en:** `workflow.aiResponse`

---

## 📊 Ejemplo Completo

```javascript
// Antes de ejecutar el código
workflow.openia = { 
  choices: [
    { 
      content: "¡Hola Marcelo! Con tu crédito de 730 puntos..." 
    }
  ] 
};

// Después de ejecutar el código
workflow.aiResponse = "¡Hola Marcelo! Con tu crédito de 730 puntos...";

// Ahora puedes usar workflow.aiResponse en cualquier parte
```

---

## 🔧 Debugging

### Ver los Logs

En Botpress Console verás:

**Versión Completa:**
```
🤖 Extrayendo respuesta del LLM...
✅ Respuesta del AI extraída exitosamente
📝 Longitud del mensaje: 487 caracteres
🎯 Provider: OpenAI
🤖 Model: gpt-5-mini-2025-08-07
💬 Preview: ¡Hola Marcelo! Con tu crédito de 730 puntos...
═══════════════════════════════════════════════════════════
✅ EXTRACCIÓN COMPLETADA
═══════════════════════════════════════════════════════════
workflow.aiResponse: Asignado ✓
═══════════════════════════════════════════════════════════
```

**Versión Simple:**
```
✅ AI Response: Guardado
```

### Si hay Error

```
❌ Error: workflow.openia no tiene la estructura esperada
Estructura actual: {...}
workflow.aiResponse: Error al generar respuesta
```

---

## ⚠️ Notas Importantes

1. **Ejecuta DESPUÉS del AI Task**
   - El código debe ejecutarse DESPUÉS de que OpenAI genere la respuesta

2. **workflow.openia debe existir**
   - Si no existe, asignará mensaje de error

3. **Fallback automático**
   - Si falla, `workflow.aiResponse` tendrá un mensaje de error apropiado

4. **Compatible con optional chaining**
   - La versión simple usa `?.` para evitar errores si algo no existe

---

## 🎯 Flujo Completo

```
1. Usuario envía mensaje
   ↓
2. Hook carga contexto (user.aiPrompt)
   ↓
3. AI Task genera respuesta (workflow.openia)
   ↓
4. Execute Code extrae mensaje (workflow.aiResponse)
   ↓
5. Bot envía workflow.aiResponse al usuario
```

---

## ✅ Checklist

- [ ] Hook configurado (carga user.aiPrompt)
- [ ] AI Task configurado (usa {{user.aiPrompt}})
- [ ] Execute Code agregado DESPUÉS del AI Task
- [ ] Código copiado (versión completa o simple)
- [ ] workflow.aiResponse usado en siguiente nodo
- [ ] Probado con mensaje de prueba

---

¡Listo! Ahora puedes extraer y usar la respuesta del LLM fácilmente. 🚀

