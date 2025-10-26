/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOTPRESS HOOK - Capital One Credit Score Integration
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este código va en un HOOK de Botpress (Before Incoming Message)
 * Obtiene el número de WhatsApp y carga el contexto del usuario de Capital One
 * 
 * UBICACIÓN: Botpress → Hooks → Before Incoming Message
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OBTENER NÚMERO DE TELÉFONO DE WHATSAPP
// ═══════════════════════════════════════════════════════════════════════════════

const numeroTelefono = event.tags.conversation['whatsapp:userPhone'];
user.userPhoneNumber = numeroTelefono; // Guardar para uso posterior

console.log('📱 Número de WhatsApp detectado:', numeroTelefono);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CONFIGURACIÓN DEL ENDPOINT DE CAPITAL ONE
// ═══════════════════════════════════════════════════════════════════════════════

const capitalOneEndpoint = 'https://us-central1-capitalonehackmty.cloudfunctions.net/getCreditScoreByPhone';

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FUNCIÓN PARA GENERAR EL AI PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

function generateUserAIPrompt(creditScoreData) {
  // Usuario no encontrado
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
    tone = 'amigable y profesional, destacando sus fortalezas';
  } else if (creditScore.category === 'Good') {
    personalityProfile = `${user.firstName} es un usuario BUENO con historial estable.`;
    recommendations = `Ofrécele préstamos moderados y consejos para mejorar su credit score.`;
    tone = 'motivador y educativo';
  } else if (creditScore.category === 'Fair') {
    personalityProfile = `${user.firstName} está trabajando en mejorar su historial crediticio.`;
    recommendations = `Ofrécele préstamos pequeños y educación financiera.`;
    tone = 'empático y de apoyo';
  } else {
    personalityProfile = `${user.firstName} necesita apoyo para reconstruir su crédito.`;
    recommendations = `Ofrécele microcréditos y educación financiera fundamental.`;
    tone = 'muy empático';
  }

  // Generar prompt completo
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
  ? `Veo que tienes un crédito EXCELENTE (${creditScore.score} puntos) 🌟. ¡Felicidades! Tengo opciones premium para ti.`
  : creditScore.category === 'Very Good'
  ? `Veo que tienes un crédito MUY BUENO (${creditScore.score} puntos) 💪. Tengo opciones interesantes para ti.`
  : creditScore.category === 'Good'
  ? `Veo que tienes un crédito BUENO (${creditScore.score} puntos) ✅. Tengo opciones que te ayudarán.`
  : creditScore.category === 'Fair'
  ? `Veo que estás trabajando en tu historial (${creditScore.score} puntos) 💪. ¡Estoy aquí para ayudarte!`
  : `Estoy aquí para ayudarte a construir un mejor futuro financiero 🌟. Tengo opciones para ti.`
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

// ═══════════════════════════════════════════════════════════════════════════════
// 4. INICIALIZAR TEMP SI NO EXISTE
// ═══════════════════════════════════════════════════════════════════════════════

if (typeof temp === 'undefined') {
  temp = {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FUNCIÓN PARA BUSCAR USUARIO EN CAPITAL ONE
// ═══════════════════════════════════════════════════════════════════════════════

const buscarUsuarioCapitalOne = async () => {
  try {
    console.log('🔍 Buscando usuario en Capital One...');
    console.log('📱 Teléfono:', numeroTelefono);

    // Configuración de la petición
    const config = {
      method: 'post',
      url: capitalOneEndpoint,
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        data: {
          phoneNumber: numeroTelefono
        }
      }
    };

    // Realizar petición al endpoint
    const response = await axios(config);

    if (response.status === 200) {
      const result = response.data.result;

      if (result.found && result.user && result.creditScore) {
        console.log('✅ Usuario encontrado:', result.user.fullName);
        console.log('💳 Credit Score:', result.creditScore.score);
        console.log('🎯 Categoría:', result.creditScore.category);

        // Generar el AI Prompt
        const aiPrompt = generateUserAIPrompt(result);

        // Guardar datos en temp
        temp.capitalOne = {
          found: true,
          firstName: result.user.firstName,
          fullName: result.user.fullName,
          phoneNumber: result.user.phoneNumber,
          creditScore: result.creditScore.score,
          creditCategory: result.creditScore.category,
          loanLimit: result.creditScore.loanLimit,
          interestRate: result.creditScore.interestRate,
          description: result.creditScore.description,
          minScore: result.creditScore.minScore,
          maxScore: result.creditScore.maxScore,
          aiPrompt: aiPrompt,
          error: null
        };

        console.log('✅ Contexto generado exitosamente');
        console.log('📝 Prompt length:', aiPrompt.length, 'caracteres');

      } else {
        // Usuario no encontrado
        console.log('⚠️ Usuario no encontrado en Capital One');

        const defaultPrompt = `El usuario no fue encontrado en el sistema de Capital One. 
Es un contacto nuevo y no tiene historial financiero registrado. 
Ofrece ayuda para crear una cuenta y comenzar su viaje financiero.`;

        temp.capitalOne = {
          found: false,
          firstName: 'Usuario',
          fullName: 'Usuario',
          phoneNumber: numeroTelefono,
          creditScore: null,
          creditCategory: null,
          loanLimit: null,
          interestRate: null,
          description: 'Usuario nuevo sin historial',
          minScore: null,
          maxScore: null,
          aiPrompt: defaultPrompt,
          error: 'Usuario no encontrado'
        };
      }
    } else {
      // Error en la respuesta
      console.error('❌ Error en respuesta del endpoint:', response.status);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

  } catch (error) {
    // Manejar errores
    console.error('❌ Error al buscar usuario:', error.message);

    const errorPrompt = `Hubo un error al cargar la información del usuario. 
Por favor, ofrece ayuda general y solicita que intente más tarde si necesita información específica de su cuenta.`;

    temp.capitalOne = {
      found: false,
      firstName: 'Usuario',
      fullName: 'Usuario',
      phoneNumber: numeroTelefono,
      creditScore: null,
      creditCategory: null,
      loanLimit: null,
      interestRate: null,
      description: 'Error al cargar datos',
      minScore: null,
      maxScore: null,
      aiPrompt: errorPrompt,
      error: error.message
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. EJECUTAR BÚSQUEDA Y ASIGNAR VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

try {
  // Verificar si ya tenemos el contexto cargado (para evitar llamadas repetidas)
  if (!user.aiPrompt || user.aiPrompt === '') {
    console.log('🔄 Cargando contexto de Capital One...');

    // Llamar a la función y esperar resultado
    await buscarUsuarioCapitalOne();

    // Asignar valores a las variables de usuario
    user.firstName = temp.capitalOne?.firstName || 'Usuario';
    user.fullName = temp.capitalOne?.fullName || 'Usuario';
    user.creditScore = temp.capitalOne?.creditScore || null;
    user.creditCategory = temp.capitalOne?.creditCategory || null;
    user.loanLimit = temp.capitalOne?.loanLimit || null;
    user.interestRate = temp.capitalOne?.interestRate || null;
    user.description = temp.capitalOne?.description || '';
    user.minScore = temp.capitalOne?.minScore || null;
    user.maxScore = temp.capitalOne?.maxScore || null;
    user.aiPrompt = temp.capitalOne?.aiPrompt || '';
    user.found = temp.capitalOne?.found || false;

    // Logs para depuración
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ CONTEXTO DE USUARIO CARGADO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('👤 Nombre:', user.fullName);
    console.log('📱 Teléfono:', user.userPhoneNumber);
    console.log('💳 Credit Score:', user.creditScore);
    console.log('🎯 Categoría:', user.creditCategory);
    console.log('💰 Límite préstamo:', user.loanLimit ? `$${user.loanLimit}` : 'N/A');
    console.log('📊 Tasa interés:', user.interestRate || 'N/A');
    console.log('✅ Usuario encontrado:', user.found ? 'Sí' : 'No');
    console.log('📝 Prompt cargado:', user.aiPrompt ? 'Sí' : 'No');
    console.log('═══════════════════════════════════════════════════════════');

  } else {
    console.log('ℹ️ Contexto ya cargado previamente, omitiendo búsqueda');
  }

} catch (error) {
  console.error('❌ Error en ejecución principal:', error.message);

  // Valores por defecto en caso de error
  user.firstName = 'Usuario';
  user.fullName = 'Usuario';
  user.creditScore = null;
  user.creditCategory = null;
  user.loanLimit = null;
  user.interestRate = null;
  user.description = 'Error al cargar información';
  user.minScore = null;
  user.maxScore = null;
  user.aiPrompt = 'Hubo un error al cargar tu información. Estoy aquí para ayudarte de todas formas.';
  user.found = false;

  temp.capitalOne = {
    error: 'Execution error: ' + error.message
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIN DEL HOOK
// ═══════════════════════════════════════════════════════════════════════════════

