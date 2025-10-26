import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext({});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Colores modo claro
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

// Colores modo oscuro
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

const THEME_STORAGE_KEY = '@app_theme_mode';

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [themeMode, setThemeMode] = useState('auto'); // 'auto', 'light', 'dark'
  const [loading, setLoading] = useState(true);

  // Cargar preferencia guardada al iniciar
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Listener para cambios del sistema cuando está en modo auto
  useEffect(() => {
    if (themeMode === 'auto') {
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        setIsDarkMode(colorScheme === 'dark');
      });
      return () => subscription.remove();
    }
  }, [themeMode]);

  const loadThemePreference = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      
      // Validar que sea un string válido
      const validModes = ['auto', 'light', 'dark'];
      
      if (savedMode && validModes.includes(savedMode)) {
        setThemeMode(savedMode);
        if (savedMode === 'auto') {
          const systemTheme = Appearance.getColorScheme();
          setIsDarkMode(systemTheme === 'dark');
        } else {
          setIsDarkMode(savedMode === 'dark');
        }
      } else {
        // Si hay un valor inválido, limpiarlo y usar modo auto
        if (savedMode) {
          await AsyncStorage.removeItem(THEME_STORAGE_KEY);
        }
        const systemTheme = Appearance.getColorScheme();
        setIsDarkMode(systemTheme === 'dark');
        setThemeMode('auto');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
      // En caso de error, usar valores por defecto
      const systemTheme = Appearance.getColorScheme();
      setIsDarkMode(systemTheme === 'dark');
      setThemeMode('auto');
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = async (mode = null) => {
    try {
      let newMode = mode;
      
      // Si se llama desde un Switch, mode será un booleano
      // Convertirlo a string apropiado
      if (typeof mode === 'boolean') {
        newMode = mode ? 'dark' : 'light';
      }
      
      if (!newMode) {
        // Si no se especifica modo, ciclar entre auto -> light -> dark
        if (themeMode === 'auto') {
          newMode = 'light';
        } else if (themeMode === 'light') {
          newMode = 'dark';
        } else {
          newMode = 'auto';
        }
      }

      setThemeMode(newMode);
      
      if (newMode === 'auto') {
        const systemTheme = Appearance.getColorScheme();
        setIsDarkMode(systemTheme === 'dark');
      } else {
        setIsDarkMode(newMode === 'dark');
      }

      // Asegurarse de guardar siempre un string
      await AsyncStorage.setItem(THEME_STORAGE_KEY, String(newMode));
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const colors = isDarkMode ? darkColors : lightColors;

  const value = {
    isDarkMode,
    themeMode,
    colors,
    toggleTheme,
    loading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
