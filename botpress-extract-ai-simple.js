/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * VERSIÓN SIMPLE - Extract AI Response
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Extrae: workflow.openia.choices[0].content
 * Guarda en: workflow.aiResponse
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Extraer el mensaje del LLM y guardarlo en workflow.aiResponse
workflow.aiResponse = workflow.openia?.choices?.[0]?.content || 'Error al generar respuesta';

// Log simple
console.log('✅ AI Response:', workflow.aiResponse ? 'Guardado' : 'Error');

