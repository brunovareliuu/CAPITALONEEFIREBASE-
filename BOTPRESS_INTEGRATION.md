# 🤖 Integración Botpress - Capital One Credit Score Agent

## 📋 Descripción

Esta integración permite que tu bot de Botpress tenga contexto completo del usuario basándose en su **credit score** y **perfil financiero** desde el sistema de Capital One.

El bot sabrá:
- ✅ Nombre completo del usuario
- ✅ Credit score y categoría (Excellent, Very Good, Good, Fair, Poor)
- ✅ Límite de préstamo aprobado
- ✅ Productos financieros que puede ofrecer
- ✅ Tono y estilo de comunicación apropiado
- ✅ Personalidad financiera del usuario

---

## 🚀 Instalación Rápida

### Paso 1: Importar el Código

1. Copia el contenido de `botpress-integration.js`
2. En Botpress, ve a **Code Editor** → **Actions**
3. Crea una nueva Action llamada `fetchUserContext`
4. Pega el código (específicamente la función `generateUserAIPrompt`)

### Paso 2: Configurar el Hook

1. Ve a **Hooks** en Botpress
2. Crea o edita el Hook: **Before Incoming Message**
3. Pega el siguiente código:

```javascript
const whatsappPhone = event.payload.from; // Número del usuario desde WhatsApp

try {
  // Solo fetch si no tenemos el contexto cargado
  if (!user.aiPrompt || user.aiPrompt === '') {
    bp.logger.info('🔄 Fetching user context for:', whatsappPhone);
    
    // Llamar al endpoint de Credit Score
    const response = await axios.post(
      'https://us-central1-capitalonehackmty.cloudfunctions.net/getCreditScoreByPhone',
      {
        data: {
          phoneNumber: whatsappPhone
        }
      }
    );
    
    const result = response.data.result;
    
    if (result.found) {
      // Generar el prompt personalizado
      const aiPrompt = await bp.actions.generateUserAIPrompt(result);
      
      // Guardar en variables de usuario
      user.aiPrompt = aiPrompt;
      user.firstName = result.user.firstName;
      user.fullName = result.user.fullName;
      user.creditScore = result.creditScore.score;
      user.creditCategory = result.creditScore.category;
      user.loanLimit = result.creditScore.loanLimit;
      user.interestRate = result.creditScore.interestRate;
      
      bp.logger.info('✅ User context loaded:', user.firstName, '- Score:', user.creditScore);
    } else {
      // Usuario no encontrado
      user.aiPrompt = `El usuario no fue encontrado en el sistema de Capital One. Es un contacto nuevo sin historial financiero. Ofrece ayuda para crear una cuenta.`;
      user.firstName = 'Usuario';
      
      bp.logger.warn('⚠️ User not found in database');
    }
  }
} catch (error) {
  bp.logger.error('❌ Error loading user context:', error.message);
  
  // Fallback: prompt genérico
  user.aiPrompt = `Usuario nuevo sin historial registrado. Mantén una conversación general y ofrece ayuda para crear una cuenta en Capital One.`;
  user.firstName = 'Usuario';
}
```

### Paso 3: Configurar la Action `generateUserAIPrompt`

En **Code Editor** → **Actions** → `fetchUserContext.js`:

```javascript
/**
 * @title Generate User AI Prompt
 * @category Custom
 * @description Genera el prompt de contexto para el bot basado en credit score
 */

const generateUserAIPrompt = async (creditScoreData) => {
  // Validar que se encontró el usuario
  if (!creditScoreData || !creditScoreData.found) {
    return `El usuario no fue encontrado en el sistema de Capital One. 
Es un contacto nuevo y no tiene historial financiero registrado. 
Ofrece ayuda para crear una cuenta y comenzar su viaje financiero.`;
  }

  const { user, creditScore } = creditScoreData;

  // Determinar personalidad financiera
  let personalityProfile = '';
  let recommendations = '';
  let tone = '';

  if (creditScore.category === 'Excellent') {
    personalityProfile = `${user.firstName} es un usuario EXCELENTE con un historial crediticio impecable.`;
    recommendations = `Ofrécele productos premium como préstamos grandes, tarjetas VIP, y opciones de inversión.`;
    tone = 'profesional y respetuoso, reconociendo su excelente manejo financiero';
  } else if (creditScore.category === 'Very Good') {
    personalityProfile = `${user.firstName} es un usuario MUY BUENO con un historial crediticio sólido.`;
    recommendations = `Ofrécele préstamos medianos a grandes y productos financieros avanzados.`;
    tone = 'amigable y profesional';
  } else if (creditScore.category === 'Good') {
    personalityProfile = `${user.firstName} es un usuario BUENO con historial estable.`;
    recommendations = `Ofrécele préstamos moderados y consejos para mejorar su credit score.`;
    tone = 'motivador y educativo';
  } else if (creditScore.category === 'Fair') {
    personalityProfile = `${user.firstName} está trabajando en mejorar su historial crediticio.`;
    recommendations = `Ofrécele préstamos pequeños y educación financiera intensiva.`;
    tone = 'empático y de apoyo';
  } else {
    personalityProfile = `${user.firstName} necesita apoyo para reconstruir su crédito.`;
    recommendations = `Ofrécele microcréditos y educación financiera fundamental.`;
    tone = 'muy empático, enfocándote en soluciones alcanzables';
  }

  // Generar el prompt completo
  const aiPrompt = `
🎯 CONTEXTO DEL USUARIO - CAPITAL ONE 🏦

👤 INFORMACIÓN PERSONAL:
- Nombre: ${user.fullName}
- Primer nombre: ${user.firstName}
- Teléfono: ${user.phoneNumber}

💳 PERFIL CREDITICIO:
- Credit Score: ${creditScore.score}/850
- Categoría: ${creditScore.category}
- Límite de préstamo: $${creditScore.loanLimit.toLocaleString()} MXN
- Tasa de interés: ${creditScore.interestRate}

🧠 PERSONALIDAD FINANCIERA:
${personalityProfile}

📋 RECOMENDACIONES:
${recommendations}

🗣️ TONO: ${tone}

🤖 INSTRUCCIONES:
1. Usa "${user.firstName}" para dirigirte al usuario
2. NO ofrezcas préstamos mayores a $${creditScore.loanLimit.toLocaleString()}
3. Mantén un tono ${tone}
4. ${creditScore.score >= 670 
    ? 'Ofrece productos premium con confianza' 
    : 'Enfócate en educación financiera y productos pequeños'}

💡 SALUDO SUGERIDO:
"¡Hola ${user.firstName}! 👋 Soy Capi, tu asistente financiero de Capital One.
${creditScore.category === 'Excellent' 
  ? `Veo que tienes un crédito EXCELENTE (${creditScore.score} puntos) 🌟. Tengo opciones premium para ti.`
  : creditScore.category === 'Very Good'
  ? `Veo que tienes un crédito MUY BUENO (${creditScore.score} puntos) 💪. Tengo opciones interesantes para ti.`
  : creditScore.category === 'Good'
  ? `Veo que tienes un crédito BUENO (${creditScore.score} puntos) ✅. Tengo opciones que pueden ayudarte.`
  : `Estoy aquí para ayudarte a mejorar tu situación financiera 💪. Tengo opciones diseñadas para ti.`
}
¿En qué puedo ayudarte hoy? 😊"
`.trim();

  return aiPrompt;
};

return generateUserAIPrompt(args.creditScoreData);
```

---

## 📊 Variables de Usuario Disponibles

Después de ejecutar el hook, tendrás estas variables disponibles:

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `user.aiPrompt` | string | Prompt completo con contexto (IMPORTANTE) |
| `user.firstName` | string | Primer nombre del usuario |
| `user.fullName` | string | Nombre completo |
| `user.creditScore` | number | Score crediticio (300-850) |
| `user.creditCategory` | string | Excellent/Very Good/Good/Fair/Poor |
| `user.loanLimit` | number | Límite máximo de préstamo en MXN |
| `user.interestRate` | string | Rango de tasa de interés |

---

## 🎯 Cómo Usar el Contexto

### Opción 1: Inyectar en AI Task (Recomendado)

En tu **AI Task**, agrega el prompt al contexto:

```
AI Task Configuration:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

System Prompt:
Eres Capi, el asistente financiero de Capital One en México.
Ayudas a usuarios con sus finanzas, préstamos y productos bancarios.

Context:
{{user.aiPrompt}}

User Message:
{{event.preview}}
```

### Opción 2: Usar en Flujos de Conversación

```javascript
// En un nodo de texto
Hola {{user.firstName}}! 👋

Tu credit score es {{user.creditScore}} ({{user.creditCategory}}).
Puedes solicitar préstamos hasta ${{user.loanLimit}}.

¿Te interesa algún producto en particular?
```

### Opción 3: Condicionales Basadas en Credit Score

```javascript
// En un nodo de condición
if (user.creditCategory === 'Excellent' || user.creditCategory === 'Very Good') {
  // Ofrecer productos premium
  goto('offer_premium_products');
} else if (user.creditCategory === 'Good') {
  // Ofrecer productos estándar
  goto('offer_standard_products');
} else {
  // Ofrecer educación financiera
  goto('offer_financial_education');
}
```

---

## 💬 Ejemplos de Conversaciones

### Ejemplo 1: Usuario Excellent (Score: 820)

```
Usuario: Hola
Bot: ¡Hola Marcelo! 👋 Soy Capi, tu asistente financiero de Capital One.

Veo que tienes un crédito EXCELENTE (820 puntos) 🌟. ¡Felicidades por tu manejo 
financiero impecable! Tengo opciones premium especialmente para ti.

¿En qué puedo ayudarte hoy? 😊

Usuario: Quiero un préstamo
Bot: ¡Perfecto! Con tu crédito excelente, puedes solicitar préstamos hasta 
$100,000 MXN con tasas desde 5-7% 💰

¿Qué tipo de préstamo te interesa?
🏠 Préstamo hipotecario
🚗 Préstamo automotriz
💼 Préstamo de negocio
```

### Ejemplo 2: Usuario Fair (Score: 620)

```
Usuario: Hola
Bot: ¡Hola María! 👋 Soy Capi, tu asistente financiero de Capital One.

Veo que estás trabajando en tu historial crediticio (620 puntos) 💪. 
¡Estoy aquí para apoyarte! Tengo opciones que pueden ayudarte a mejorar paso a paso.

¿En qué puedo ayudarte hoy? 😊

Usuario: Necesito dinero
Bot: Entiendo María. Con tu perfil actual, puedo ofrecerte:

💰 Préstamos pequeños hasta $25,000
📚 Programa de educación financiera gratuito
💳 Cuenta de ahorro para construir tu historial

Además, tengo consejos para mejorar tu credit score. ¿Te interesa saber más?
```

---

## 🔧 Troubleshooting

### Problema: `user.aiPrompt` está vacío

**Solución:**
- Verifica que el hook se ejecuta **antes** de tu primer AI Task
- Revisa los logs de Botpress: `bp.logger.info('User context:', user)`
- Confirma que el número de WhatsApp está en formato correcto

### Problema: El bot no personaliza las respuestas

**Solución:**
- Asegúrate de que `{{user.aiPrompt}}` está en el contexto de tu AI Task
- Verifica que la variable existe: usa `{{user.aiPrompt | default("No context")}}`

### Problema: Error al llamar al endpoint

**Solución:**
```javascript
// Agregar timeout y retry
const response = await axios.post(
  'https://us-central1-capitalonehackmty.cloudfunctions.net/getCreditScoreByPhone',
  { data: { phoneNumber: whatsappPhone } },
  { timeout: 10000 } // 10 segundos
);
```

---

## 📈 Mejoras Futuras

- [ ] Caché del contexto por 24 horas
- [ ] Actualización automática del score después de transacciones
- [ ] Notificaciones proactivas de cambios en credit score
- [ ] Integración con historial de conversaciones
- [ ] Análisis de sentimiento para ajustar tono

---

## 🎓 Conceptos Clave

### ¿Qué es `user.aiPrompt`?

Es una **variable de contexto** que contiene toda la información del usuario en formato de prompt. 
Cuando se inyecta en un AI Task, el modelo de lenguaje (GPT, Claude, etc.) tiene acceso completo 
al perfil financiero del usuario y puede personalizar sus respuestas automáticamente.

### ¿Por qué es importante?

- ✅ El bot **sabe quién es el usuario** sin preguntar
- ✅ Ofrece **productos apropiados** al nivel crediticio
- ✅ Mantiene un **tono adecuado** a la situación
- ✅ No ofrece productos que el usuario **no califica**
- ✅ Personaliza la **experiencia completa**

---

## 📞 Soporte

Si tienes dudas sobre la integración:
1. Revisa los logs en Botpress Console
2. Verifica el endpoint: `https://us-central1-capitalonehackmty.cloudfunctions.net/getCreditScoreByPhone`
3. Confirma que el formato de teléfono es correcto (con el "1" extra de WhatsApp para México)

---

## ✅ Checklist de Implementación

- [ ] Código copiado en Botpress Actions
- [ ] Hook configurado (Before Incoming Message)
- [ ] AI Task configurado con `{{user.aiPrompt}}`
- [ ] Variables de usuario probadas
- [ ] Conversación de prueba exitosa
- [ ] Manejo de errores implementado
- [ ] Logs verificados

---

¡Listo! Tu bot de Botpress ahora tiene **contexto completo** de cada usuario de Capital One. 🚀🏦

