import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome5 as Icon } from '@expo/vector-icons';

/**
 * StandardHeader - Componente estándar para headers en toda la app
 * @param {string} title - Título del header
 * @param {function} onBack - Función a ejecutar al presionar el botón back
 * @param {string} rightComponent - Componente opcional a la derecha (opcional)
 */
const StandardHeader = ({ title, onBack, rightComponent = null }) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity 
        onPress={onBack}
        style={styles.backButton}
        activeOpacity={0.7}
      >
        <Icon name="arrow-left" size={20} color="#00487A" />
      </TouchableOpacity>
      
      {title && <Text style={styles.headerTitle}>{title}</Text>}
      
      <View style={styles.rightContainer}>
        {rightComponent}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50, // Espacio para status bar (reducido)
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  rightContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StandardHeader;

