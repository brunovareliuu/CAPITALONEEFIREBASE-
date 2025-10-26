// Sistema de colores minimalista estilo iPhone
// NOTA: Este archivo se mantiene para compatibilidad con componentes no migrados
// Los nuevos componentes deben usar useTheme() de ThemeContext

export const lightColors = {
  // Colores principales
  primary: '#007AFF',
  secondary: '#FF9500',
  
  // Fondos
  background: '#FFFFFF',
  backgroundSecondary: '#F2F2F7',
  
  // Texto
  text: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  
  // Componentes
  card: '#FFFFFF',
  border: '#E5E5EA',
  
  // Estados
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.4)',
  
  // Sombras
  shadow: 'rgba(0, 0, 0, 0.1)',

  // Colores para tarjetas y categorías
  cardColors: {
    red: '#FF3B30',
    black: '#000000',
    navy: '#000080',
    blue: '#0080FF',
    orange: '#FF9500',
    yellow: '#FFCC00',
    green: '#34C759',
    teal: '#5AC8FA',
    indigo: '#5856D6',
    purple: '#AF52DE',
    pink: '#FF2D55',
    brown: '#A2845E',
    gray: '#8E8E93',
    cyan: '#32ADE6',
    lime: '#A7D129',
    mint: '#00C7BE',
    lavender: '#C69CFF',
    rose: '#FF69B4',
    gold: '#FFD700',
    silver: '#C0C0C0',
    maroon: '#800000',
  },
};

export const darkColors = {
  // Colores principales (más brillantes en dark mode)
  primary: '#0A84FF',
  secondary: '#FF9F0A',
  
  // Fondos
  background: '#000000',
  backgroundSecondary: '#1C1C1E',
  
  // Texto
  text: '#FFFFFF',
  textSecondary: '#98989D',
  textTertiary: '#48484A',
  
  // Componentes
  card: '#1C1C1E',
  border: '#38383A',
  
  // Estados
  success: '#32D74B',
  error: '#FF453A',
  warning: '#FF9F0A',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.7)',
  
  // Sombras
  shadow: 'rgba(0, 0, 0, 0.3)',

  // Colores para tarjetas y categorías (ajustados para dark mode)
  cardColors: {
    red: '#FF453A',
    black: '#1C1C1E',
    navy: '#0A61D9',
    blue: '#0A84FF',
    orange: '#FF9F0A',
    yellow: '#FFD60A',
    green: '#32D74B',
    teal: '#64D2FF',
    indigo: '#5E5CE6',
    purple: '#BF5AF2',
    pink: '#FF375F',
    brown: '#AC8E68',
    gray: '#98989D',
    cyan: '#5AC8FA',
    lime: '#C0E32D',
    mint: '#63E6E2',
    lavender: '#D0AAFF',
    rose: '#FF7EB9',
    gold: '#FFD60A',
    silver: '#D1D1D6',
    maroon: '#AC3030',
  },
};

// Exportación por defecto para compatibilidad
export const colors = lightColors;
export default colors; 
