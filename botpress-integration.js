/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOTPRESS INTEGRATION - Credit Score AI Prompt Generator
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este archivo genera el prompt de contexto para el bot de Botpress basándose
 * en la información del credit score del usuario.
 * 
 * Uso:
 * 1. Llamar al endpoint getCreditScoreByPhone con el número de WhatsApp
 * 2. Pasar la respuesta a generateUserAIPrompt()
 * 3. Asignar el resultado a user.aiPrompt en Botpress
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Genera el prompt de AI personalizado para Botpress
 * 
 * @param {Object} creditScoreData - Datos del endpoint getCreditScoreByPhone
 * @returns {string} - Prompt formateado para user.aiPrompt
 */
function generateUserAIPrompt(creditScoreData) {
  // Validar que se encontró el usuario
  if (!creditScoreData || !creditScoreData.found) {
    return `El usuario no fue encontrado en el sistema de Capital One. 
Es un contacto nuevo y no tiene historial financiero registrado. 
Ofrece ayuda para crear una cuenta y comenzar su viaje financiero.`;
  }

  const { user, creditScore } = creditScoreData;

  // Determinar personalidad financiera basada en credit score
  let personalityProfile = '';
  let recommendations = '';
  let tone = '';

  if (creditScore.category === 'Excellent') {
    personalityProfile = `${user.firstName} es un usuario EXCELENTE con un historial crediticio impecable. Demuestra responsabilidad financiera excepcional y manejo experto de sus finanzas.`;
    recommendations = `Ofrécele productos premium como préstamos grandes para inversiones, tarjetas de crédito con beneficios exclusivos, y opciones de inversión avanzadas. Es candidato ideal para productos VIP.`;
    tone = 'profesional y respetuoso, reconociendo su excelente manejo financiero';
  } else if (creditScore.category === 'Very Good') {
    personalityProfile = `${user.firstName} es un usuario MUY BUENO con un historial crediticio sólido. Maneja bien sus finanzas y toma decisiones responsables.`;
    recommendations = `Ofrécele préstamos medianos a grandes, mejoras en límites de crédito, y productos financieros avanzados. Puede calificar para tasas de interés competitivas.`;
    tone = 'amigable y profesional, destacando sus fortalezas financieras';
  } else if (creditScore.category === 'Good') {
    personalityProfile = `${user.firstName} es un usuario BUENO con un historial crediticio estable. Tiene buen control de sus finanzas aunque hay espacio para mejorar.`;
    recommendations = `Ofrécele préstamos moderados, consejos para mejorar su credit score, y productos que le ayuden a optimizar su situación financiera. Enfócate en educación financiera.`;
    tone = 'motivador y educativo, ayudándole a mejorar su situación';
  } else if (creditScore.category === 'Fair') {
    personalityProfile = `${user.firstName} es un usuario REGULAR que está trabajando en mejorar su historial crediticio. Necesita apoyo y orientación financiera.`;
    recommendations = `Ofrécele préstamos pequeños, herramientas de ahorro, y educación financiera intensiva. Enfócate en productos que le ayuden a reconstruir su crédito. Sé empático con su situación.`;
    tone = 'empático y de apoyo, sin juzgar su situación actual';
  } else {
    personalityProfile = `${user.firstName} es un usuario que necesita MEJORAR su historial crediticio. Está en proceso de reconstrucción financiera y requiere apoyo especializado.`;
    recommendations = `Ofrécele microcréditos, cuentas de ahorro básicas, y educación financiera fundamental. Enfócate en construir confianza y hábitos financieros saludables paso a paso. Sé muy empático.`;
    tone = 'muy empático y de apoyo, enfocándote en soluciones pequeñas y alcanzables';
  }

  // Generar el prompt completo
  const aiPrompt = `
🎯 CONTEXTO DEL USUARIO - CAPITAL ONE 🏦

═══════════════════════════════════════════════════════════════════════

👤 INFORMACIÓN PERSONAL:
- Nombre: ${user.fullName}
- Primer nombre: ${user.firstName}
- Teléfono: ${user.phoneNumber}

💳 PERFIL CREDITICIO:
- Credit Score: ${creditScore.score}/850
- Categoría: ${creditScore.category}
- Rango: ${creditScore.minScore}-${creditScore.maxScore}

💰 CAPACIDAD FINANCIERA:
- Límite de préstamo aprobado: $${creditScore.loanLimit.toLocaleString()} MXN
- Tasa de interés estimada: ${creditScore.interestRate}
- Descripción: ${creditScore.description}

🧠 PERSONALIDAD FINANCIERA:
${personalityProfile}

📋 RECOMENDACIONES PARA EL AGENTE:
${recommendations}

🗣️ TONO DE COMUNICACIÓN:
Mantén un tono ${tone}. ${user.firstName} merece ser tratado con respeto y profesionalismo.

═══════════════════════════════════════════════════════════════════════

🤖 INSTRUCCIONES PARA EL BOT:

1. SALUDO PERSONALIZADO:
   - Siempre usa "${user.firstName}" para dirigirte al usuario
   - Reconoce su nivel crediticio de forma positiva
   - Hazle sentir bienvenido y valorado

2. PRODUCTOS QUE PUEDES OFRECER:
   ${creditScore.category === 'Excellent' || creditScore.category === 'Very Good' 
     ? `✅ Préstamos grandes (hasta $${creditScore.loanLimit.toLocaleString()})
   ✅ Tarjetas de crédito premium
   ✅ Líneas de crédito flexibles
   ✅ Productos de inversión`
     : creditScore.category === 'Good'
     ? `✅ Préstamos moderados (hasta $${creditScore.loanLimit.toLocaleString()})
   ✅ Tarjetas de crédito estándar
   ✅ Herramientas de ahorro
   ✅ Educación financiera`
     : `✅ Microcréditos (hasta $${creditScore.loanLimit.toLocaleString()})
   ✅ Cuentas de ahorro básicas
   ✅ Educación financiera personalizada
   ✅ Herramientas de presupuesto`
   }

3. LÍMITES Y RESTRICCIONES:
   ⚠️ NO ofrezcas préstamos mayores a $${creditScore.loanLimit.toLocaleString()}
   ⚠️ La tasa de interés será aproximadamente ${creditScore.interestRate}
   ${creditScore.score < 670 
     ? `⚠️ Enfócate en productos de reconstrucción de crédito
   ⚠️ Sé especialmente empático con su situación`
     : `✅ Puedes ofrecer productos avanzados con confianza`
   }

4. ESTRATEGIA DE CONVERSACIÓN:
   ${creditScore.category === 'Excellent' || creditScore.category === 'Very Good'
     ? `- Ofrece productos premium de inmediato
   - Destaca los beneficios exclusivos
   - Enfócate en oportunidades de crecimiento
   - Trata al usuario como un cliente VIP`
     : creditScore.category === 'Good'
     ? `- Ofrece productos estándar con confianza
   - Incluye tips para mejorar su credit score
   - Balancea productos con educación
   - Muestra el camino hacia mejores productos`
     : `- Enfócate en productos pequeños y alcanzables
   - Prioriza la educación financiera
   - Construye confianza gradualmente
   - Celebra cada pequeño logro
   - Ofrece apoyo emocional cuando sea apropiado`
   }

5. LENGUAJE Y ESTILO:
   - Usa un lenguaje claro y accesible (no técnico)
   - Sé cálido y cercano, no robótico
   - Usa emojis moderadamente (💰 🏦 ✅ 🎯 📊)
   - Mantén respuestas concisas pero informativas
   - Pregunta antes de asumir

6. OBJETIVOS DE LA CONVERSACIÓN:
   ${creditScore.score >= 740
     ? `🎯 Vender un préstamo o producto premium
   🎯 Ofrecer mejoras en productos existentes
   🎯 Fidelizar como cliente VIP`
     : creditScore.score >= 580
     ? `🎯 Ayudar a mejorar su credit score
   🎯 Ofrecer productos apropiados a su nivel
   🎯 Educar sobre finanzas personales
   🎯 Construir una relación a largo plazo`
     : `🎯 Reconstruir confianza en el sistema financiero
   🎯 Ofrecer productos de inicio alcanzables
   🎯 Educación financiera fundamental
   🎯 Celebrar pequeños pasos hacia la mejora`
   }

═══════════════════════════════════════════════════════════════════════

💡 EJEMPLO DE APERTURA:

"¡Hola ${user.firstName}! 👋 Soy Capi, tu asistente financiero de Capital One.

${creditScore.category === 'Excellent' 
  ? `Veo que tienes un crédito EXCELENTE (${creditScore.score} puntos) 🌟. ¡Felicidades por tu manejo financiero impecable! Tengo opciones premium especialmente para ti.`
  : creditScore.category === 'Very Good'
  ? `Veo que tienes un crédito MUY BUENO (${creditScore.score} puntos) 💪. ¡Excelente trabajo! Tengo algunas opciones interesantes que se ajustan perfectamente a tu perfil.`
  : creditScore.category === 'Good'
  ? `Veo que tienes un crédito BUENO (${creditScore.score} puntos) ✅. Vas por buen camino, y tengo opciones que pueden ayudarte a seguir mejorando.`
  : creditScore.category === 'Fair'
  ? `Veo que estás trabajando en tu historial crediticio (${creditScore.score} puntos) 💪. ¡Estoy aquí para apoyarte! Tengo opciones que pueden ayudarte a mejorar paso a paso.`
  : `Estoy aquí para ayudarte a construir un mejor futuro financiero 🌟. Todos empezamos en algún lugar, y tengo opciones diseñadas especialmente para ti.`
}

¿En qué puedo ayudarte hoy? 😊"

═══════════════════════════════════════════════════════════════════════

⚡ RESPUESTAS RÁPIDAS SUGERIDAS:

${creditScore.score >= 670
  ? `1. "💰 Quiero solicitar un préstamo"
2. "💳 ¿Qué tarjetas tengo disponibles?"
3. "📊 ¿Cómo puedo mejorar mi crédito?"
4. "🎯 ¿Qué productos me recomiendas?"`
  : `1. "💰 ¿Qué préstamos puedo obtener?"
2. "📚 ¿Cómo mejoro mi crédito?"
3. "💡 Consejos de ahorro"
4. "🏦 ¿Cómo funciona Capital One?"`
}

═══════════════════════════════════════════════════════════════════════

✨ RECUERDA: ${user.firstName} es una persona real con metas y sueños financieros.
Tu objetivo es ayudarle a alcanzarlos, no solo vender productos.

═══════════════════════════════════════════════════════════════════════
`.trim();

  return aiPrompt;
}

/**
 * Función principal para integración con Botpress
 * 
 * @param {string} whatsappPhone - Número de WhatsApp del usuario
 * @returns {Promise<Object>} - { success: boolean, aiPrompt: string, error?: string }
 */
async function fetchAndGeneratePrompt(whatsappPhone) {
  try {
    console.log('🔍 Fetching credit score for:', whatsappPhone);

    // Llamar al endpoint de Firebase
    const response = await fetch(
      'https://us-central1-capitalonehackmty.cloudfunctions.net/getCreditScoreByPhone',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            phoneNumber: whatsappPhone,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const creditScoreData = result.result;

    console.log('✅ Credit score fetched successfully');

    // Generar el prompt
    const aiPrompt = generateUserAIPrompt(creditScoreData);

    console.log('✅ AI Prompt generated successfully');
    console.log('📝 Prompt length:', aiPrompt.length, 'characters');

    return {
      success: true,
      aiPrompt: aiPrompt,
      userData: creditScoreData.found ? creditScoreData.user : null,
      creditScore: creditScoreData.found ? creditScoreData.creditScore : null,
    };
  } catch (error) {
    console.error('❌ Error fetching/generating prompt:', error);

    return {
      success: false,
      aiPrompt: null,
      error: error.message,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CÓDIGO ESPECÍFICO PARA BOTPRESS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * BOTPRESS EXECUTE CODE HOOK
 * 
 * Este código debe ejecutarse en un Hook de Botpress (Execute Code)
 * al inicio de la conversación o cuando se recibe un mensaje de un usuario nuevo.
 * 
 * Ubicación recomendada: Before Incoming Message Hook
 */

/*
// ==================== CÓDIGO PARA BOTPRESS ====================
// Copia este bloque en tu Hook de Botpress

const whatsappPhone = event.payload.from; // O la variable que contenga el teléfono

try {
  // Verificar si ya tenemos el prompt cargado
  if (!user.aiPrompt || user.aiPrompt === '') {
    console.log('🔄 Fetching user context...');
    
    // Llamar al endpoint
    const response = await axios.post(
      'https://us-central1-capitalonehackmty.cloudfunctions.net/getCreditScoreByPhone',
      {
        data: {
          phoneNumber: whatsappPhone
        }
      }
    );
    
    const creditScoreData = response.data.result;
    
    // Generar el prompt usando la función
    const aiPrompt = generateUserAIPrompt(creditScoreData);
    
    // Asignar a las variables de usuario
    user.aiPrompt = aiPrompt;
    user.firstName = creditScoreData.found ? creditScoreData.user.firstName : 'Usuario';
    user.fullName = creditScoreData.found ? creditScoreData.user.fullName : 'Usuario';
    user.creditScore = creditScoreData.found ? creditScoreData.creditScore.score : null;
    user.creditCategory = creditScoreData.found ? creditScoreData.creditScore.category : null;
    user.loanLimit = creditScoreData.found ? creditScoreData.creditScore.loanLimit : null;
    
    console.log('✅ User context loaded for:', user.firstName);
  }
} catch (error) {
  console.error('❌ Error loading user context:', error);
  
  // Prompt por defecto si falla
  user.aiPrompt = 'Usuario nuevo sin historial. Ofrece ayuda para crear cuenta.';
  user.firstName = 'Usuario';
}

// ==================== FIN CÓDIGO BOTPRESS ====================
*/

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR FUNCIONES
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  generateUserAIPrompt,
  fetchAndGeneratePrompt,
};

// ═══════════════════════════════════════════════════════════════════════════════
// EJEMPLO DE USO
// ═══════════════════════════════════════════════════════════════════════════════

/*
// Ejemplo 1: Generar prompt desde datos existentes
const creditScoreData = {
  found: true,
  user: {
    firstName: "Marcelo",
    fullName: "Marcelo García",
    phoneNumber: "528120394578"
  },
  creditScore: {
    score: 730,
    category: "Good",
    description: "Buen historial crediticio...",
    loanLimit: 50000,
    interestRate: "10-14%",
    minScore: 670,
    maxScore: 739
  }
};

const prompt = generateUserAIPrompt(creditScoreData);
console.log(prompt);

// Ejemplo 2: Fetch y generar en un solo paso
fetchAndGeneratePrompt("5218120394578").then(result => {
  if (result.success) {
    console.log("✅ Prompt generado:");
    console.log(result.aiPrompt);
  } else {
    console.error("❌ Error:", result.error);
  }
});
*/

