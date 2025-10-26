/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOTPRESS - Extract AI Response from OpenAI
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este código extrae el mensaje generado por el LLM (OpenAI) desde la estructura
 * de respuesta y lo guarda en workflow.aiResponse
 * 
 * UBICACIÓN: Después del nodo de AI Task / Generate (OpenAI)
 * 
 * USO: Execute Code node o en un Hook después de la generación del AI
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

try {
  console.log('🤖 Extrayendo respuesta del LLM...');

  // Verificar que workflow.openia existe y tiene la estructura correcta
  if (workflow.openia && 
      workflow.openia.choices && 
      Array.isArray(workflow.openia.choices) && 
      workflow.openia.choices.length > 0) {
    
    // Extraer el contenido de la primera opción (choices[0].content)
    const aiMessage = workflow.openia.choices[0].content;
    
    // Guardar en workflow.aiResponse
    workflow.aiResponse = aiMessage;
    
    // Logs para debugging
    console.log('✅ Respuesta del AI extraída exitosamente');
    console.log('📝 Longitud del mensaje:', aiMessage ? aiMessage.length : 0, 'caracteres');
    console.log('🎯 Provider:', workflow.openia.provider || 'Unknown');
    console.log('🤖 Model:', workflow.openia.model || 'Unknown');
    console.log('💬 Preview:', aiMessage ? aiMessage.substring(0, 100) + '...' : 'Empty');
    
    // Información adicional del response
    if (workflow.openia.choices[0].role) {
      console.log('👤 Role:', workflow.openia.choices[0].role);
    }
    
    if (workflow.openia.choices[0].type) {
      console.log('📄 Type:', workflow.openia.choices[0].type);
    }
    
  } else {
    // Si no existe la estructura esperada
    console.error('❌ Error: workflow.openia no tiene la estructura esperada');
    console.error('Estructura actual:', JSON.stringify(workflow.openia, null, 2));
    
    // Asignar un mensaje de error por defecto
    workflow.aiResponse = 'Lo siento, hubo un error al generar la respuesta. Por favor intenta de nuevo.';
  }
  
} catch (error) {
  // Manejo de errores
  console.error('❌ Error al extraer respuesta del AI:', error.message);
  console.error('Stack:', error.stack);
  
  // Asignar mensaje de error
  workflow.aiResponse = 'Lo siento, hubo un error técnico. Por favor intenta de nuevo.';
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICACIÓN FINAL
// ═══════════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════');
console.log('✅ EXTRACCIÓN COMPLETADA');
console.log('═══════════════════════════════════════════════════════════');
console.log('workflow.aiResponse:', workflow.aiResponse ? 'Asignado ✓' : 'Vacío ✗');
console.log('═══════════════════════════════════════════════════════════');

