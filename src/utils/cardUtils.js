// Utilidades para manejo de tarjetas

// Función para determinar el tipo de tarjeta digital
export const getCardType = (tarjetaDigital) => {
  if (!tarjetaDigital) return null;

  // Usar la propiedad tipo o type de la tarjeta digital
  return tarjetaDigital.tipo || tarjetaDigital.type || null;
};

// Función para obtener colores de la tarjeta digital (usa el color guardado)
export const getCardColors = (tarjetaDigital) => {
  if (!tarjetaDigital) {
    return {
      gradient: ['#004977', '#003d5c'],
      solid: '#2C3E50',
      accent: '#007AFF'
    };
  }

  // Usar el color guardado en la tarjeta digital
  const cardColor = tarjetaDigital.color || '#004977';

  return {
    gradient: [cardColor, cardColor], // Gradiente simple con el color de la tarjeta
    solid: cardColor,
    accent: cardColor
  };
};

// Función para obtener el nombre del tipo de tarjeta (usa tipoTexto de Firestore)
export const getCardTypeLabel = (tarjetaDigital) => {
  if (!tarjetaDigital) return null;

  // Usar tipoTexto si existe, sino traducir el tipo técnico
  if (tarjetaDigital.tipoTexto) {
    return tarjetaDigital.tipoTexto;
  }

  // Fallback a la traducción del tipo técnico
  const type = tarjetaDigital.tipo || tarjetaDigital.type;
  if (!type) return null;

  const labels = {
    credit: 'CRÉDITO',
    checking: 'DÉBITO',
    savings: 'AHORROS'
  };
  return labels[type] || null;
};

// Función para determinar si mostrar el badge del tipo
export const shouldShowTypeBadge = (tarjetaDigital) => {
  if (!tarjetaDigital) return false;

  const tipoTexto = tarjetaDigital.tipoTexto;
  const type = tarjetaDigital.tipo || tarjetaDigital.type;

  // Si tiene tipoTexto, mostrar badge si es diferente de "DÉBITO"
  if (tipoTexto) {
    return tipoTexto !== 'DÉBITO';
  }

  // Si no tiene tipoTexto, usar lógica del tipo técnico
  return type && type !== 'debit' && type !== 'checking';
};
