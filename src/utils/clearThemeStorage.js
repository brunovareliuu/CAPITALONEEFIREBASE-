// Utilidad para limpiar el almacenamiento de tema corrupto
// Ejecutar esto una vez si tienes problemas con el tema
import AsyncStorage from '@react-native-async-storage/async-storage';

export const clearThemeStorage = async () => {
  try {
    await AsyncStorage.removeItem('@app_theme_mode');
    console.log('Theme storage cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing theme storage:', error);
    return false;
  }
};

export default clearThemeStorage;
